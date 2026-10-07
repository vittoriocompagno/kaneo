import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";
import type { ProjectStatus } from "../project-status";

async function setProjectStatus(
  id: string,
  status: ProjectStatus,
  workspaceId: string,
) {
  const [updated] = await db
    .update(projectTable)
    .set({ status })
    .where(
      and(eq(projectTable.id, id), eq(projectTable.workspaceId, workspaceId)),
    )
    .returning();
  if (!updated) {
    throw new HTTPException(404, { message: "Project not found" });
  }
  return updated;
}

export default setProjectStatus;
