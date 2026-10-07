import { z } from "../openapi";
import { PROJECT_STATUSES } from "./project-status";

export const projectParam = z.object({ id: z.string() });

export const workspaceIdQuery = z.object({ workspaceId: z.string() });

export const listProjectsQuery = z.object({
  workspaceId: z.string(),
  includeArchived: z.string().optional().openapi({
    description: 'Pass "true" to include archived projects in the list.',
  }),
});

export const createProjectBody = z.object({
  name: z.string(),
  workspaceId: z.string(),
  icon: z.string(),
  slug: z.string(),
  sourceProjectId: z.string().optional().openapi({
    description:
      "Copy columns, custom fields, and workflow rules from a project in this workspace.",
  }),
  includeTasks: z.boolean().optional().openapi({
    description:
      "Also copy task content, task labels, and custom field values. Defaults to false.",
  }),
  asTemplate: z.boolean().optional().openapi({
    description:
      "Save the copy as a reusable template; requires sourceProjectId.",
  }),
  parentProjectId: z.string().min(1).optional().openapi({
    description:
      "Create the project as a subproject of this top-level project in the same workspace. Not allowed together with asTemplate.",
  }),
});

export const setProjectParentBody = z.object({
  parentProjectId: z.string().min(1).nullable().openapi({
    description: "The new parent, or null to make the project top-level again.",
  }),
});

export const setProjectStatusBody = z.object({
  status: z.enum(PROJECT_STATUSES),
});

export const updateProjectBody = z.object({
  name: z.string(),
  icon: z.string(),
  slug: z.string(),
  description: z.string(),
  isPublic: z.boolean(),
});

export const reorderProjectsBody = z.object({
  // Positions express a relative order only; the controller renumbers the
  // workspace to 0..n-1, so the values just have to be sane.
  projects: z
    .array(z.object({ id: z.string(), position: z.number().int().min(0) }))
    .min(1),
});

export const uploadProjectBackgroundBody = z.object({
  contentType: z.string(),
  size: z.number(),
});

export const finalizeProjectBackgroundBody = z.object({
  key: z.string(),
  contentType: z.string(),
  version: z.string(),
  size: z.number(),
});
export const moveProjectBody = z.object({ workspaceId: z.string().min(1) });
