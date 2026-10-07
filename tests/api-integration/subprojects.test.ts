import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

type User = typeof schema.userTable.$inferSelect;

const DAY = 24 * 60 * 60 * 1000;

function call(
  app: ReturnType<typeof createApp>["app"],
  method: string,
  path: string,
  body?: unknown,
) {
  return app.request(`http://localhost/api${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function setup(role = "owner") {
  const ctx = await createWorkspaceMember({ role });
  mockAuthenticatedSession(ctx.user);
  const { app } = createApp();
  return { ...ctx, app };
}

async function createProject(
  app: ReturnType<typeof createApp>["app"],
  workspaceId: string,
  slug: string,
  extra: Record<string, unknown> = {},
) {
  const response = await call(app, "POST", "/project", {
    workspaceId,
    name: `Project ${slug}`,
    icon: "Layout",
    slug,
    ...extra,
  });
  return response;
}

async function addTask(
  projectId: string,
  number: number,
  overrides: Partial<typeof schema.taskTable.$inferInsert> = {},
) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId, number, title: `Task ${number}`, ...overrides })
    .returning();
  return task;
}

async function addTime(taskId: string, userId: string, seconds: number) {
  const start = new Date(Date.now() - 10 * DAY);
  await db.insert(schema.timeEntryTable).values({
    taskId,
    userId,
    startTime: start,
    endTime: new Date(start.getTime() + seconds * 1000),
    duration: seconds,
  });
}

async function listProjects(
  app: ReturnType<typeof createApp>["app"],
  workspaceId: string,
) {
  const response = await call(
    app,
    "GET",
    `/project?workspaceId=${workspaceId}`,
  );
  expect(response.status).toBe(200);
  return (await response.json()) as Array<{
    id: string;
    parentProjectId: string | null;
    status: string;
    statistics: { overdueTasks: number; health: string; totalTasks: number };
  }>;
}

describe("API integration: subprojects", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("creates a subproject and exposes parent, status and stats in the list", async () => {
    const { app, workspace } = await setup();
    const parent = (await (
      await createProject(app, workspace.id, "par")
    ).json()) as { id: string; status: string; parentProjectId: string | null };
    expect(parent).toMatchObject({ status: "in_corso", parentProjectId: null });

    const response = await createProject(app, workspace.id, "kid", {
      parentProjectId: parent.id,
    });
    expect(response.status).toBe(200);
    const child = (await response.json()) as { id: string };

    const list = await listProjects(app, workspace.id);
    expect(list.find((p) => p.id === child.id)).toMatchObject({
      parentProjectId: parent.id,
      status: "in_corso",
      statistics: { overdueTasks: 0, health: "not_started", totalTasks: 0 },
    });
    expect(list.find((p) => p.id === parent.id)?.parentProjectId).toBeNull();

    // A subproject is a full project with its own board.
    const columns = await db.query.columnTable.findMany({
      where: eq(schema.columnTable.projectId, child.id),
    });
    expect(columns.map((c) => c.slug).sort()).toEqual([
      "done",
      "in-progress",
      "in-review",
      "to-do",
    ]);

    const subs = await call(app, "GET", `/project/${parent.id}/subprojects`);
    expect(subs.status).toBe(200);
    expect(
      ((await subs.json()) as Array<{ id: string }>).map((p) => p.id),
    ).toEqual([child.id]);
  });

  it("allows one level only and rejects self, subproject and template parents", async () => {
    const { app, workspace } = await setup();
    const make = async (slug: string, extra = {}) =>
      (await (await createProject(app, workspace.id, slug, extra)).json()) as {
        id: string;
      };
    const a = await make("aaa");
    const b = await make("bbb", { parentProjectId: a.id });
    const c = await make("ccc");

    // Nest under a subproject
    expect(
      (await createProject(app, workspace.id, "ddd", { parentProjectId: b.id }))
        .status,
    ).toBe(400);
    expect(
      (
        await call(app, "PUT", `/project/${c.id}/parent`, {
          parentProjectId: b.id,
        })
      ).status,
    ).toBe(400);
    // Self parent
    expect(
      (
        await call(app, "PUT", `/project/${c.id}/parent`, {
          parentProjectId: c.id,
        })
      ).status,
    ).toBe(400);
    // A project with children cannot become a child
    const clash = await call(app, "PUT", `/project/${a.id}/parent`, {
      parentProjectId: c.id,
    });
    expect(clash.status).toBe(409);

    // Set, then unset
    const set = await call(app, "PUT", `/project/${c.id}/parent`, {
      parentProjectId: a.id,
    });
    expect(set.status).toBe(200);
    expect(
      ((await set.json()) as { parentProjectId: string }).parentProjectId,
    ).toBe(a.id);
    const unset = await call(app, "PUT", `/project/${c.id}/parent`, {
      parentProjectId: null,
    });
    expect(unset.status).toBe(200);
    expect(
      ((await unset.json()) as { parentProjectId: null }).parentProjectId,
    ).toBeNull();

    // The database refuses self-parenting even if a controller regresses.
    await expect(
      db.execute(
        sql`UPDATE project SET parent_project_id = id WHERE id = ${c.id}`,
      ),
    ).rejects.toThrow();
  });

  it("keeps templates out of the hierarchy and does not copy it on duplication", async () => {
    const { app, workspace } = await setup();
    const parent = (await (
      await createProject(app, workspace.id, "par")
    ).json()) as {
      id: string;
    };
    const child = (await (
      await createProject(app, workspace.id, "kid", {
        parentProjectId: parent.id,
      })
    ).json()) as { id: string };
    await addTask(child.id, 1, { title: "child task" });
    await addTask(parent.id, 1, { title: "parent task" });

    // Template cannot be created as a subproject
    expect(
      (
        await createProject(app, workspace.id, "tpl", {
          sourceProjectId: parent.id,
          asTemplate: true,
          parentProjectId: parent.id,
        })
      ).status,
    ).toBe(400);

    const templateResponse = await createProject(app, workspace.id, "tpl", {
      sourceProjectId: child.id,
      asTemplate: true,
    });
    expect(templateResponse.status).toBe(200);
    const template = (await templateResponse.json()) as {
      id: string;
      parentProjectId: string | null;
      status: string;
    };
    // Saving a subproject as a template does not carry the parent over.
    expect(template.parentProjectId).toBeNull();

    // A template is neither a parent nor a child
    expect(
      (
        await createProject(app, workspace.id, "x1", {
          parentProjectId: template.id,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call(app, "PUT", `/project/${template.id}/parent`, {
          parentProjectId: parent.id,
        })
      ).status,
    ).toBe(400);

    // Duplicating a parent with tasks copies the project only, never its children
    const copyResponse = await createProject(app, workspace.id, "cpy", {
      sourceProjectId: parent.id,
      includeTasks: true,
    });
    expect(copyResponse.status).toBe(200);
    const copy = (await copyResponse.json()) as {
      id: string;
      parentProjectId: string | null;
    };
    expect(copy.parentProjectId).toBeNull();
    const copyChildren = await db.query.projectTable.findMany({
      where: eq(schema.projectTable.parentProjectId, copy.id),
    });
    expect(copyChildren).toHaveLength(0);
    const copiedTasks = await db.query.taskTable.findMany({
      where: eq(schema.taskTable.projectId, copy.id),
    });
    expect(copiedTasks.map((t) => t.title)).toEqual(["parent task"]);

    // Duplicating a subproject can place the copy in the same family explicitly.
    const siblingResponse = await createProject(app, workspace.id, "sib", {
      sourceProjectId: child.id,
      parentProjectId: parent.id,
    });
    expect(siblingResponse.status).toBe(200);
    expect(
      ((await siblingResponse.json()) as { parentProjectId: string })
        .parentProjectId,
    ).toBe(parent.id);
  });

  it("rejects a parent from another workspace as not found", async () => {
    const { app, workspace } = await setup();
    const other = await createWorkspaceMember();
    const { project: foreign } = await createProjectFixture({
      workspaceId: other.workspace.id,
    });
    const response = await createProject(app, workspace.id, "kid", {
      parentProjectId: foreign.id,
    });
    expect(response.status).toBe(404);
  });

  it("promotes subprojects to top level when the parent is deleted, keeping their data", async () => {
    const { app, workspace } = await setup();
    const parent = (await (
      await createProject(app, workspace.id, "par")
    ).json()) as {
      id: string;
    };
    const child = (await (
      await createProject(app, workspace.id, "kid", {
        parentProjectId: parent.id,
      })
    ).json()) as { id: string };
    const task = await addTask(child.id, 1);

    const deleted = await call(app, "DELETE", `/project/${parent.id}`);
    expect(deleted.status).toBe(200);

    const [survivor] = await db
      .select()
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, child.id));
    expect(survivor?.parentProjectId).toBeNull();
    const [keptTask] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, task.id));
    expect(keptTask).toBeDefined();
  });

  it("blocks moving a parent and detaches a moved subproject", async () => {
    const { app, workspace, user } = await setup();
    const [target] = await db
      .insert(schema.workspaceTable)
      .values({
        id: `workspace-${randomUUID()}`,
        createdAt: new Date(),
        name: "Target",
        slug: `workspace-${randomUUID()}`,
      })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: target.id,
      userId: user.id,
      role: "owner",
      joinedAt: new Date(),
    });

    const parent = (await (
      await createProject(app, workspace.id, "par")
    ).json()) as {
      id: string;
    };
    const child = (await (
      await createProject(app, workspace.id, "kid", {
        parentProjectId: parent.id,
      })
    ).json()) as { id: string };

    const blocked = await call(app, "PUT", `/project/${parent.id}/move`, {
      workspaceId: target.id,
    });
    expect(blocked.status).toBe(409);
    expect(await blocked.text()).toContain("subprojects");

    const moved = await call(app, "PUT", `/project/${child.id}/move`, {
      workspaceId: target.id,
    });
    expect(moved.status).toBe(200);
    expect(
      ((await moved.json()) as { parentProjectId: string | null })
        .parentProjectId,
    ).toBeNull();
    const [row] = await db
      .select()
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, child.id));
    expect(row).toMatchObject({
      workspaceId: target.id,
      parentProjectId: null,
    });
  });
});

describe("API integration: project status", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("sets every status, rejects unknown values and needs project:update", async () => {
    const { app, workspace } = await setup();
    const project = (await (
      await createProject(app, workspace.id, "stt")
    ).json()) as {
      id: string;
    };
    for (const status of [
      "in_attesa_cliente",
      "in_pausa",
      "chiuso",
      "in_corso",
    ]) {
      const response = await call(app, "PUT", `/project/${project.id}/status`, {
        status,
      });
      expect(response.status).toBe(200);
      expect(((await response.json()) as { status: string }).status).toBe(
        status,
      );
    }
    expect(
      (
        await call(app, "PUT", `/project/${project.id}/status`, {
          status: "nope",
        })
      ).status,
    ).toBe(400);

    // Read-only roles: viewer cannot edit, but still reads it.
    const viewer = await addWorkspaceMember(workspace.id, "viewer");
    mockAuthenticatedSession(viewer);
    expect(
      (
        await call(app, "PUT", `/project/${project.id}/status`, {
          status: "chiuso",
        })
      ).status,
    ).toBe(403);
    const read = await call(app, "GET", `/project/${project.id}`);
    expect(((await read.json()) as { status: string }).status).toBe("in_corso");
  });

  it("rejects an invalid status at the database level", async () => {
    const { workspace } = await setup();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    await expect(
      db.execute(
        sql`UPDATE project SET status = 'bogus' WHERE id = ${project.id}`,
      ),
    ).rejects.toThrow();
  });
});

describe("API integration: project dashboard", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function seedFamily() {
    const ctx = await setup();
    const { app, workspace, user } = ctx;
    const parent = (await (
      await createProject(app, workspace.id, "par")
    ).json()) as {
      id: string;
    };
    const kidA = (await (
      await createProject(app, workspace.id, "kia", {
        parentProjectId: parent.id,
      })
    ).json()) as { id: string };
    const kidB = (await (
      await createProject(app, workspace.id, "kib", {
        parentProjectId: parent.id,
      })
    ).json()) as { id: string };

    const past = new Date(Date.now() - 5 * DAY);
    const soon = new Date(Date.now() + 2 * DAY);
    const later = new Date(Date.now() + 30 * DAY);

    // parent: 2 tasks, 1 done, 1 open (due later), 100s tracked
    const p1 = await addTask(parent.id, 1, { status: "done" });
    await addTask(parent.id, 2, { dueDate: later });
    await addTime(p1.id, user.id, 100);
    // kidA: 4 tasks, 1 done, 2 overdue, 1 open no due date, 3600s tracked
    const a1 = await addTask(kidA.id, 1, { status: "done", dueDate: past });
    await addTask(kidA.id, 2, { dueDate: past });
    await addTask(kidA.id, 3, { dueDate: past, status: "in-progress" });
    await addTask(kidA.id, 4);
    await addTime(a1.id, user.id, 3000);
    await addTime(a1.id, user.id, 600);
    // kidB: 2 tasks both done, 7200s tracked. A running (null duration) timer adds nothing.
    const b1 = await addTask(kidB.id, 1, { status: "done" });
    await addTask(kidB.id, 2, { status: "archived", dueDate: past });
    await addTime(b1.id, user.id, 7200);
    await db.insert(schema.timeEntryTable).values({
      taskId: b1.id,
      userId: user.id,
      startTime: new Date(),
      duration: null,
    });
    // kidB has a due-soon task that is open -> only on kidC below
    const kidC = (await (
      await createProject(app, workspace.id, "kic", {
        parentProjectId: parent.id,
      })
    ).json()) as { id: string };
    await addTask(kidC.id, 1, { dueDate: soon });
    return { ...ctx, parent, kidA, kidB, kidC };
  }

  it("aggregates a parent with its subprojects and breaks it down", async () => {
    const { app, parent, kidA, kidB, kidC } = await seedFamily();
    const response = await call(app, "GET", `/project/${parent.id}/dashboard`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as any;

    expect(body.project).toMatchObject({ id: parent.id, status: "in_corso" });
    expect(body.project.backgroundObjectKey).toBeUndefined();
    expect(body.parent).toBeNull();

    expect(body.own).toMatchObject({
      totalTasks: 2,
      doneTasks: 1,
      remainingTasks: 1,
      progress: 50,
      overdueTasks: 0,
      trackedSeconds: 100,
      health: "on_track",
    });

    // 2 + 4 + 2 + 1 tasks, done 1 + 1 + 2 + 0, overdue 0 + 2 + 0 + 0,
    // seconds 100 + 3600 + 7200 + 0
    expect(body.summary).toMatchObject({
      totalTasks: 9,
      doneTasks: 4,
      remainingTasks: 5,
      progress: 44,
      overdueTasks: 2,
      dueSoonTasks: 1,
      trackedSeconds: 10900,
    });
    // 2 overdue of 5 open = 40% >= 25%
    expect(body.summary.health).toBe("late");

    const byId = new Map<string, any>(
      body.subprojects.map((s: any) => [s.id, s]),
    );
    expect(body.subprojects.map((s: any) => s.id)).toEqual([
      kidA.id,
      kidB.id,
      kidC.id,
    ]);
    expect(byId.get(kidA.id).metrics).toMatchObject({
      totalTasks: 4,
      doneTasks: 1,
      overdueTasks: 2,
      trackedSeconds: 3600,
      health: "late",
    });
    expect(byId.get(kidB.id).metrics).toMatchObject({
      totalTasks: 2,
      progress: 100,
      overdueTasks: 0,
      trackedSeconds: 7200,
      health: "complete",
    });
    expect(byId.get(kidC.id).metrics).toMatchObject({
      totalTasks: 1,
      dueSoonTasks: 1,
      health: "at_risk",
    });
  });

  it("shows a subproject its own numbers and its parent", async () => {
    const { app, parent, kidA } = await seedFamily();
    const response = await call(app, "GET", `/project/${kidA.id}/dashboard`);
    const body = (await response.json()) as any;
    expect(body.parent).toMatchObject({ id: parent.id });
    expect(body.subprojects).toEqual([]);
    expect(body.summary).toEqual(body.own);
    expect(body.summary.trackedSeconds).toBe(3600);
  });

  it("returns zeros for an empty project and ignores archived subprojects", async () => {
    const { app, workspace } = await setup();
    const parent = (await (
      await createProject(app, workspace.id, "par")
    ).json()) as {
      id: string;
    };
    const kid = (await (
      await createProject(app, workspace.id, "kid", {
        parentProjectId: parent.id,
      })
    ).json()) as { id: string };
    await addTask(kid.id, 1);
    let body = (await (
      await call(app, "GET", `/project/${parent.id}/dashboard`)
    ).json()) as any;
    expect(body.summary.totalTasks).toBe(1);

    await call(app, "PUT", `/project/${kid.id}/archive`);
    body = (await (
      await call(app, "GET", `/project/${parent.id}/dashboard`)
    ).json()) as any;
    expect(body.subprojects).toEqual([]);
    expect(body.summary).toMatchObject({
      totalTasks: 0,
      trackedSeconds: 0,
      progress: 0,
      health: "not_started",
    });
  });

  it("returns project activity for the project and its subprojects only", async () => {
    const { app, workspace, parent, kidA } = await seedFamily();
    const outsider = await createProjectFixture({ workspaceId: workspace.id });
    const inKid = await addTask(kidA.id, 99);
    const inOutsider = await addTask(outsider.project.id, 1);
    await db.insert(schema.activityTable).values([
      { taskId: inKid.id, type: "task_created", content: "kid" },
      { taskId: inOutsider.id, type: "task_created", content: "out" },
    ]);
    const response = await call(app, "GET", `/activity/project/${parent.id}`);
    expect(response.status).toBe(200);
    const rows = (await response.json()) as Array<{ taskId: string }>;
    expect(rows.map((r) => r.taskId)).toContain(inKid.id);
    expect(rows.map((r) => r.taskId)).not.toContain(inOutsider.id);
  });
});

describe("API integration: subprojects and restricted members", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function seedRestricted(grant: "child" | "parent") {
    const owner = await createWorkspaceMember({ role: "owner" });
    const parent = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Parent",
      slug: "par",
    });
    const child = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Child",
      slug: "kid",
    });
    await db
      .update(schema.projectTable)
      .set({ parentProjectId: parent.project.id })
      .where(eq(schema.projectTable.id, child.project.id));
    const parentTask = await addTask(parent.project.id, 1, { status: "done" });
    const childTask = await addTask(child.project.id, 1);
    await addTime(parentTask.id, owner.user.id, 500);
    await addTime(childTask.id, owner.user.id, 900);

    const restricted = await addWorkspaceMember(owner.workspace.id);
    await restrictToProjects(
      owner.workspace.id,
      restricted.id,
      grant === "child" ? [child.project.id] : [parent.project.id],
    );
    mockAuthenticatedSession(restricted);
    const { app } = createApp();
    return {
      app,
      owner,
      restricted: restricted as User,
      parent: parent.project,
      child: child.project,
    };
  }

  it("lets a member granted only a subproject reach it, listed as top-level", async () => {
    const { app, owner, parent, child } = await seedRestricted("child");
    const list = await listProjects(app, owner.workspace.id);
    expect(list.map((p) => p.id)).toEqual([child.id]);
    // The raw parent id comes back; the UI treats an unreachable parent as absent.
    expect(list[0]?.parentProjectId).toBe(parent.id);

    expect((await call(app, "GET", `/project/${child.id}`)).status).toBe(200);
    const dashboard = await call(app, "GET", `/project/${child.id}/dashboard`);
    expect(dashboard.status).toBe(200);
    const body = (await dashboard.json()) as any;
    expect(body.parent).toBeNull();
    expect(body.summary.trackedSeconds).toBe(900);

    expect(
      (await call(app, "GET", `/project/${parent.id}/dashboard`)).status,
    ).toBe(403);
    expect(
      (await call(app, "GET", `/project/${parent.id}/subprojects`)).status,
    ).toBe(403);
  });

  it("leaves ungranted subprojects out of a parent's aggregate and breakdown", async () => {
    const { app, parent } = await seedRestricted("parent");
    const body = (await (
      await call(app, "GET", `/project/${parent.id}/dashboard`)
    ).json()) as any;
    expect(body.subprojects).toEqual([]);
    expect(body.summary).toMatchObject({ totalTasks: 1, trackedSeconds: 500 });
  });

  it("does not reveal an ungranted parent when nesting", async () => {
    const { app, owner, parent, child } = await seedRestricted("child");
    const created = await createProject(app, owner.workspace.id, "new", {
      parentProjectId: parent.id,
    });
    expect(created.status).toBe(404);
    // Member role lacks project:update, so reparenting is refused outright.
    const reparent = await call(app, "PUT", `/project/${child.id}/parent`, {
      parentProjectId: null,
    });
    expect(reparent.status).toBe(403);
  });
});

describe("migration 0062", () => {
  it("can be applied repeatedly", async () => {
    await resetTestDatabase();
    const sqlText = readFileSync(
      resolve(
        __dirname,
        "../../apps/api/drizzle/0062_subprojects_dashboard.sql",
      ),
      "utf8",
    );
    for (let run = 0; run < 2; run++) {
      for (const statement of sqlText.split("--> statement-breakpoint")) {
        await db.execute(sql.raw(statement));
      }
    }
    const columns = await db.execute(
      sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'project' AND column_name IN ('parent_project_id', 'status')`,
    );
    expect(columns.rows).toHaveLength(2);
  });
});
