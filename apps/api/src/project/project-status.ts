// Manual project state, set by a person. Distinct from the computed health
// indicator in ./project-health, which is derived from tasks and due dates.
export const PROJECT_STATUSES = [
  "in_corso",
  "in_attesa_cliente",
  "in_pausa",
  "chiuso",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const DEFAULT_PROJECT_STATUS: ProjectStatus = "in_corso";
