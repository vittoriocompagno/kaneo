import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

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

async function setup() {
  const ctx = await createWorkspaceMember({ role: "owner" });
  mockAuthenticatedSession(ctx.user);
  const { app } = createApp();
  const response = await call(app, "POST", "/project", {
    workspaceId: ctx.workspace.id,
    name: "Estimates",
    icon: "Layout",
    slug: "est",
  });
  const project = (await response.json()) as { id: string };
  return { ...ctx, app, project };
}

async function createTask(
  app: ReturnType<typeof createApp>["app"],
  projectId: string,
  extra: Record<string, unknown> = {},
) {
  const response = await call(app, "POST", `/task/${projectId}`, {
    title: "Task",
    description: "",
    priority: "low",
    status: "to-do",
    ...extra,
  });
  return response;
}

type TaskBody = { id: string; estimatedMinutes: number | null };

describe("API integration: task estimate", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("creates a task with an estimate and reads it back", async () => {
    const { app, project } = await setup();
    const response = await createTask(app, project.id, {
      estimatedMinutes: 90,
    });
    expect(response.status).toBe(200);
    const task = (await response.json()) as TaskBody;
    expect(task.estimatedMinutes).toBe(90);

    const read = await call(app, "GET", `/task/${task.id}`);
    expect(((await read.json()) as TaskBody).estimatedMinutes).toBe(90);

    const board = (await (
      await call(app, "GET", `/task/tasks/${project.id}`)
    ).json()) as {
      data: { columns: { tasks: TaskBody[] }[] };
    };
    const onBoard = board.data.columns.flatMap((column) => column.tasks);
    expect(onBoard.find((t) => t.id === task.id)?.estimatedMinutes).toBe(90);
  });

  it("stores no estimate (not zero) when none is sent", async () => {
    const { app, project } = await setup();
    const task = (await (await createTask(app, project.id)).json()) as TaskBody;
    expect(task.estimatedMinutes).toBeNull();
    const [row] = await db
      .select({ value: schema.taskTable.estimatedMinutes })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, task.id));
    expect(row?.value).toBeNull();
  });

  it("rejects negative, fractional and absurd estimates", async () => {
    const { app, project } = await setup();
    for (const estimatedMinutes of [-1, 1.5, 60 * 1000 + 1, "90"]) {
      const response = await createTask(app, project.id, { estimatedMinutes });
      expect(response.status, String(estimatedMinutes)).toBe(400);
    }
  });

  it("sets and clears the estimate through its own route", async () => {
    const { app, project } = await setup();
    const task = (await (await createTask(app, project.id)).json()) as TaskBody;

    const set = await call(app, "PUT", `/task/estimate/${task.id}`, {
      estimatedMinutes: 45,
    });
    expect(set.status).toBe(200);
    expect(((await set.json()) as TaskBody).estimatedMinutes).toBe(45);

    const cleared = await call(app, "PUT", `/task/estimate/${task.id}`, {
      estimatedMinutes: null,
    });
    expect(cleared.status).toBe(200);
    expect(((await cleared.json()) as TaskBody).estimatedMinutes).toBeNull();

    const invalid = await call(app, "PUT", `/task/estimate/${task.id}`, {
      estimatedMinutes: -5,
    });
    expect(invalid.status).toBe(400);

    const missing = await call(app, "PUT", "/task/estimate/nope", {
      estimatedMinutes: 5,
    });
    expect(missing.status).toBeGreaterThanOrEqual(400);
  });

  it("keeps the estimate when the full task update leaves it out, changes it when sent", async () => {
    const { app, project } = await setup();
    const task = (await (
      await createTask(app, project.id, { estimatedMinutes: 120 })
    ).json()) as TaskBody;
    const update = (extra: Record<string, unknown>) =>
      call(app, "PUT", `/task/${task.id}`, {
        title: "Renamed",
        status: "done",
        priority: "low",
        projectId: project.id,
        position: 0,
        ...extra,
      });

    // This is what the board sends when a card moves to Done.
    const moved = await update({});
    expect(moved.status).toBe(200);
    expect(((await moved.json()) as TaskBody).estimatedMinutes).toBe(120);

    const changed = await update({ estimatedMinutes: 30 });
    expect(((await changed.json()) as TaskBody).estimatedMinutes).toBe(30);

    const cleared = await update({ estimatedMinutes: null });
    expect(((await cleared.json()) as TaskBody).estimatedMinutes).toBeNull();
  });

  it("a status change through the board route keeps the estimate", async () => {
    const { app, project } = await setup();
    const task = (await (
      await createTask(app, project.id, { estimatedMinutes: 60 })
    ).json()) as TaskBody;
    const moved = await call(app, "PUT", `/task/status/${task.id}`, {
      status: "done",
    });
    expect(moved.status).toBe(200);
    expect(((await moved.json()) as TaskBody).estimatedMinutes).toBe(60);
  });

  it("duplicates the estimate with the task", async () => {
    const { app, project } = await setup();
    const task = (await (
      await createTask(app, project.id, { estimatedMinutes: 75 })
    ).json()) as TaskBody;
    const copy = await call(app, "POST", `/task/duplicate/${task.id}`, {
      title: "Copy",
    });
    expect(copy.status).toBe(200);
    const copied = (await copy.json()) as { id: string };
    const [row] = await db
      .select({ value: schema.taskTable.estimatedMinutes })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, copied.id));
    expect(row?.value).toBe(75);
  });

  it("sums estimates into the project dashboard next to tracked seconds", async () => {
    const { app, project, user } = await setup();
    const a = (await (
      await createTask(app, project.id, { estimatedMinutes: 90 })
    ).json()) as TaskBody;
    await createTask(app, project.id, { estimatedMinutes: 30 });
    await createTask(app, project.id);
    const start = new Date(Date.now() - 86_400_000);
    await db.insert(schema.timeEntryTable).values({
      taskId: a.id,
      userId: user.id,
      startTime: start,
      endTime: new Date(start.getTime() + 3600_000),
      duration: 3600,
    });

    const body = (await (
      await call(app, "GET", `/project/${project.id}/dashboard`)
    ).json()) as {
      own: { estimatedSeconds: number; trackedSeconds: number };
      summary: { estimatedSeconds: number; trackedSeconds: number };
    };
    expect(body.own).toMatchObject({
      estimatedSeconds: 7200,
      trackedSeconds: 3600,
    });
    expect(body.summary.estimatedSeconds).toBe(7200);
  });

  it("rolls subproject estimates up into the parent and the breakdown", async () => {
    const { app, project, workspace } = await setup();
    await createTask(app, project.id, { estimatedMinutes: 60 });
    const kid = (await (
      await call(app, "POST", "/project", {
        workspaceId: workspace.id,
        name: "Kid",
        icon: "Layout",
        slug: "kid",
        parentProjectId: project.id,
      })
    ).json()) as { id: string };
    await createTask(app, kid.id, { estimatedMinutes: 120 });

    const body = (await (
      await call(app, "GET", `/project/${project.id}/dashboard`)
    ).json()) as {
      own: { estimatedSeconds: number };
      summary: { estimatedSeconds: number };
      subprojects: { id: string; metrics: { estimatedSeconds: number } }[];
    };
    expect(body.own.estimatedSeconds).toBe(3600);
    expect(body.summary.estimatedSeconds).toBe(3600 + 7200);
    expect(body.subprojects[0]).toMatchObject({
      id: kid.id,
      metrics: { estimatedSeconds: 7200 },
    });
  });
});

describe("migration 0063", () => {
  it("adds a nullable column, can be applied repeatedly and keeps existing rows", async () => {
    await resetTestDatabase();
    const { project } = await setup();
    await db.insert(schema.taskTable).values([
      { projectId: project.id, number: 1, title: "Before 1" },
      { projectId: project.id, number: 2, title: "Before 2" },
    ]);
    await db.execute(
      sql`ALTER TABLE "task" DROP COLUMN IF EXISTS "estimated_minutes"`,
    );

    const sqlText = readFileSync(
      resolve(
        __dirname,
        "../../apps/api/drizzle/0063_task_estimated_minutes.sql",
      ),
      "utf8",
    );
    for (let run = 0; run < 2; run++) {
      for (const statement of sqlText.split("--> statement-breakpoint")) {
        await db.execute(sql.raw(statement));
      }
    }

    const column = await db.execute(
      sql`SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'task' AND column_name = 'estimated_minutes'`,
    );
    expect(column.rows).toEqual([
      { data_type: "integer", is_nullable: "YES", column_default: null },
    ]);
    const rows = await db.execute(
      sql`SELECT count(*)::int AS n, count(estimated_minutes)::int AS estimated FROM task`,
    );
    expect(rows.rows).toEqual([{ n: 2, estimated: 0 }]);
  });

  it("is registered in the drizzle journal after 0062", () => {
    const journal = JSON.parse(
      readFileSync(
        resolve(__dirname, "../../apps/api/drizzle/meta/_journal.json"),
        "utf8",
      ),
    ) as { entries: { idx: number; tag: string; when: number }[] };
    const last = journal.entries.at(-1);
    const previous = journal.entries.at(-2);
    expect(last?.tag).toBe("0063_task_estimated_minutes");
    // Drizzle applies by `when`: a smaller value would be skipped on prod.
    expect(last?.when).toBeGreaterThan(previous?.when ?? Infinity);
  });
});
