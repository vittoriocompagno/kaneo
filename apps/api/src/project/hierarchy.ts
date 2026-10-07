import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { projectTable } from "../database/schema";
import type { DbOrTx } from "../project-access/db-or-tx";
import { projectAccessCondition } from "../project-access/project-access-condition";

type NestUnderInput = {
  workspaceId: string;
  userId: string;
  parentProjectId: string;
  // Absent while creating: the project does not exist yet.
  projectId?: string;
};

// Subprojects are one level deep and never templates. Callers hold the
// workspace ordering lock, so these checks cannot race another reparenting.
export async function assertCanNestUnder(
  database: DbOrTx,
  { workspaceId, userId, parentProjectId, projectId }: NestUnderInput,
) {
  if (projectId && parentProjectId === projectId) {
    throw new HTTPException(400, {
      message: "A project cannot be its own parent",
    });
  }

  // A restricted member must not learn that an ungranted project exists, so
  // an inaccessible parent reads as missing, like an inaccessible copy source.
  const [parent] = await database
    .select({
      isTemplate: projectTable.isTemplate,
      parentProjectId: projectTable.parentProjectId,
    })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.id, parentProjectId),
        eq(projectTable.workspaceId, workspaceId),
        projectAccessCondition(userId, projectTable.id),
      ),
    );
  if (!parent) {
    throw new HTTPException(404, { message: "Parent project not found" });
  }
  if (parent.isTemplate) {
    throw new HTTPException(400, {
      message: "A template cannot have subprojects",
    });
  }
  if (parent.parentProjectId) {
    throw new HTTPException(400, {
      message: "A subproject cannot have subprojects",
    });
  }

  if (!projectId) return;

  const [child] = await database
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(eq(projectTable.parentProjectId, projectId))
    .limit(1);
  if (child) {
    throw new HTTPException(409, {
      message:
        "This project has subprojects. Detach them before nesting it under another project.",
    });
  }
}
