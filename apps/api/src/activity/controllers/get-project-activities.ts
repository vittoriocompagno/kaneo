import { eq, or } from "drizzle-orm";
import db from "../../database";
import { projectTable } from "../../database/schema";
import getWorkspaceActivities from "./get-workspace-activities";

// The project plus its subprojects. Access and archive rules are applied by
// the shared query, so a restricted member only sees projects they hold.
async function getProjectActivities(
  projectId: string,
  workspaceId: string,
  userId: string,
) {
  const projects = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      or(
        eq(projectTable.id, projectId),
        eq(projectTable.parentProjectId, projectId),
      ),
    );
  return getWorkspaceActivities(
    workspaceId,
    userId,
    projects.map((project) => project.id),
  );
}

export default getProjectActivities;
