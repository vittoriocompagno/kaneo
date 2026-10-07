import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";
import { assertCanNestUnder } from "../hierarchy";

async function setProjectParent(
  id: string,
  parentProjectId: string | null,
  workspaceId: string,
  userId: string,
) {
  return db.transaction(async (tx) => {
    // Same lock as create/reorder/move: it serializes every hierarchy write
    // in the workspace, which the "one level only" rule depends on.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(1524, hashtext(${workspaceId}))`,
    );

    const [existing] = await tx
      .select()
      .from(projectTable)
      .where(
        and(eq(projectTable.id, id), eq(projectTable.workspaceId, workspaceId)),
      )
      .for("update");
    if (!existing) {
      throw new HTTPException(404, {
        message:
          "Project doesn't exist or doesn't belong to the specified workspace",
      });
    }

    if (parentProjectId) {
      if (existing.isTemplate) {
        throw new HTTPException(400, {
          message: "A template cannot be a subproject",
        });
      }
      await assertCanNestUnder(tx, {
        workspaceId,
        userId,
        parentProjectId,
        projectId: id,
      });
    }

    const [updated] = await tx
      .update(projectTable)
      .set({ parentProjectId })
      .where(eq(projectTable.id, id))
      .returning();
    return updated;
  });
}

export default setProjectParent;
