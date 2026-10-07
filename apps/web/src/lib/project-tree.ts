type TreeProject = { id: string; parentProjectId: string | null };

export type ProjectNode<T extends TreeProject> = {
  project: T;
  children: T[];
};

// One level of nesting. A project is shown under its parent only when that
// parent is in the list and is itself top-level; otherwise (the caller lacks
// access to the parent, it is archived, or the data is not one level deep) it
// stays top-level instead of vanishing. Input order is kept for roots and for
// each parent's children.
export function buildProjectTree<T extends TreeProject>(
  projects: readonly T[],
): ProjectNode<T>[] {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const childrenByParent = new Map<string, T[]>();
  const roots: T[] = [];

  for (const project of projects) {
    const parent = project.parentProjectId
      ? byId.get(project.parentProjectId)
      : undefined;
    if (parent && parent.id !== project.id && !parent.parentProjectId) {
      const siblings = childrenByParent.get(parent.id) ?? [];
      siblings.push(project);
      childrenByParent.set(parent.id, siblings);
    } else {
      roots.push(project);
    }
  }

  return roots.map((root) => ({
    project: root,
    children: childrenByParent.get(root.id) ?? [],
  }));
}

// Parents followed by their children, the order the reorder endpoint expects
// when the sidebar only lets top-level projects move.
export function flattenProjectTree<T extends TreeProject>(
  nodes: readonly ProjectNode<T>[],
): T[] {
  return nodes.flatMap((node) => [node.project, ...node.children]);
}

type FamilyProject = TreeProject & { id: string };

// The parent (when the caller can see it) and visible children of a project.
export function getProjectFamily<T extends FamilyProject>(
  projects: readonly T[],
  projectId: string,
): { parent: T | null; children: T[] } {
  const current = projects.find((project) => project.id === projectId);
  const parent =
    current?.parentProjectId && current.parentProjectId !== projectId
      ? (projects.find((project) => project.id === current.parentProjectId) ??
        null)
      : null;
  const children = projects.filter(
    (project) => project.parentProjectId === projectId,
  );
  return { parent, children };
}

// Pickers show the hierarchy as one indented list: depth 1 marks a subproject.
export function listProjectsWithDepth<T extends TreeProject>(
  projects: readonly T[],
): Array<{ project: T; depth: 0 | 1 }> {
  return buildProjectTree(projects).flatMap((node) => [
    { project: node.project, depth: 0 as const },
    ...node.children.map((project) => ({ project, depth: 1 as const })),
  ]);
}
