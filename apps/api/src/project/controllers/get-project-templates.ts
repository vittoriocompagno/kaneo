import { and, asc, eq } from "drizzle-orm";
import db from "../../database";
import { projectTable } from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";

// Templates follow the same per-project grants as ordinary projects, so a
// member restricted to selected projects only sees templates granted to them.
async function getProjectTemplates(workspaceId: string, userId: string) {
  return db.query.projectTable.findMany({
    where: and(
      eq(projectTable.workspaceId, workspaceId),
      eq(projectTable.isTemplate, true),
      projectAccessCondition(userId, projectTable.id),
    ),
    orderBy: [
      asc(projectTable.position),
      asc(projectTable.createdAt),
      asc(projectTable.id),
    ],
  });
}

export default getProjectTemplates;
