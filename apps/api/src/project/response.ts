import { HTTPException } from "hono/http-exception";
import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";
import { boardColumnSchema, boardTaskSchema } from "../task/response";
import { PROJECT_HEALTH } from "./project-health";
import { PROJECT_STATUSES } from "./project-status";

export const projectStatusSchema = z.enum(PROJECT_STATUSES).openapi({
  description:
    "Manual project state: in_corso (in progress), in_attesa_cliente (waiting on the client), in_pausa (paused), chiuso (closed).",
});

export const projectHealthSchema = z.enum(PROJECT_HEALTH).openapi({
  description:
    "Computed indicator: not_started (no tasks), complete (no open tasks), late (a quarter or more of the open tasks are overdue), at_risk (some overdue, or work due within 7 days with under half done), on_track.",
});

export const projectSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    backgroundVersion: z.string().nullable(),
    slug: z.string().openapi({
      description: "Short prefix used in task identifiers, e.g. KAN-12.",
    }),
    icon: z.string().nullable(),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: responseTimestamp,
    isPublic: z.boolean().nullable().openapi({
      description:
        "When true the project's board is readable without signing in, via /api/public-project/{id}.",
    }),
    isTemplate: z.boolean().openapi({
      description:
        "When true the project is a reusable template, omitted from ordinary project lists.",
    }),
    parentProjectId: z.string().nullable().openapi({
      description:
        "The parent project's id when this is a subproject. Subprojects nest one level only and share the parent's workspace. A restricted member may see a parent id they cannot open.",
    }),
    status: projectStatusSchema,
    archivedAt: nullableResponseTimestamp.openapi({
      description:
        "Non-null once archived; archived projects are hidden by default.",
    }),
    position: z.number().openapi({ description: "Sidebar order, ascending." }),
    lastTaskNumber: z.number().openapi({
      description:
        "Highest task number issued in this project; the next task gets this plus one.",
    }),
  })
  .openapi("Project");

export const projectTemplateListSchema = z
  .array(projectSchema)
  .openapi("ProjectTemplateList");

export const projectStatisticsSchema = z
  .object({
    completionPercentage: z.number(),
    totalTasks: z.number(),
    dueDate: nullableResponseTimestamp.openapi({
      description: "The soonest due date among the project's open tasks.",
    }),
    overdueTasks: z.number().openapi({
      description:
        "Open tasks more than a day past their due date. This project only, subprojects excluded.",
    }),
    health: projectHealthSchema,
  })
  .openapi("ProjectStatistics");

export const projectListItemSchema = projectSchema
  .extend({
    statistics: projectStatisticsSchema,
    // Legacy, always empty. Fetch the board via GET /task/tasks/{id}.
    archivedTasks: z
      .array(boardTaskSchema)
      .openapi({ description: "Always empty." }),
    plannedTasks: z
      .array(boardTaskSchema)
      .openapi({ description: "Always empty." }),
    columns: z
      .array(boardColumnSchema)
      .openapi({ description: "Always empty." }),
  })
  .openapi("ProjectListItem");

export const projectListSchema = z.array(projectListItemSchema);

export const projectBackgroundUploadSchema = z
  .object({
    key: z.string(),
    uploadUrl: z.string(),
    version: z.string(),
    headers: z.record(z.string(), z.string()),
  })
  .openapi("ProjectBackgroundUpload");

export const projectBackgroundFinalizeSchema = z
  .object({ url: z.string() })
  .openapi("ProjectBackgroundFinalize");
export const movedProjectSchema = projectSchema
  .extend({ unassignedTaskCount: z.number() })
  .openapi("MovedProject");

// Storage coordinates are private implementation details, even on mutations
// that return a full database row. Preserve each endpoint's other fields.
export function toPublicProject<
  T extends {
    backgroundObjectKey: string | null;
    backgroundMimeType: string | null;
  },
>(project: T | undefined) {
  if (!project)
    throw new HTTPException(500, {
      message: "Project mutation returned no result",
    });
  const {
    backgroundObjectKey: _key,
    backgroundMimeType: _mime,
    ...publicProject
  } = project;
  return publicProject;
}

export const projectMetricsSchema = z
  .object({
    totalTasks: z.number(),
    doneTasks: z.number(),
    remainingTasks: z.number(),
    progress: z.number().openapi({ description: "Percent done, 0 to 100." }),
    overdueTasks: z.number(),
    dueSoonTasks: z.number().openapi({
      description: "Open tasks due within the next 7 days.",
    }),
    nextDueDate: nullableResponseTimestamp.openapi({
      description: "The soonest due date among open tasks.",
    }),
    trackedSeconds: z.number().openapi({
      description:
        "Sum of the finished time entries on the project's tasks, in seconds. Running timers count once stopped.",
    }),
    health: projectHealthSchema,
  })
  .openapi("ProjectMetrics");

export const projectDashboardSchema = z
  .object({
    project: projectSchema,
    parent: z
      .object({ id: z.string(), name: z.string(), icon: z.string().nullable() })
      .nullable()
      .openapi({
        description:
          "The parent project, when this is a subproject the caller can open.",
      }),
    summary: projectMetricsSchema.openapi({
      description:
        "This project plus every subproject the caller can open. Equals own for a project without subprojects.",
    }),
    own: projectMetricsSchema.openapi({
      description: "This project alone, subprojects excluded.",
    }),
    subprojects: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        icon: z.string().nullable(),
        status: projectStatusSchema,
        metrics: projectMetricsSchema,
      }),
    ),
  })
  .openapi("ProjectDashboard");

export const subprojectListSchema = z
  .array(projectListItemSchema)
  .openapi("SubprojectList");
