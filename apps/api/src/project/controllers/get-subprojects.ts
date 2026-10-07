import getProjects from "./get-projects";

// Children the caller can open, in sidebar order. Goes through getProjects so
// archive, template and per-project access rules cannot drift from the list.
async function getSubprojects(
  parentProjectId: string,
  workspaceId: string,
  userId: string,
) {
  const projects = await getProjects(workspaceId, userId);
  return projects.filter(
    (project) => project.parentProjectId === parentProjectId,
  );
}

export default getSubprojects;
