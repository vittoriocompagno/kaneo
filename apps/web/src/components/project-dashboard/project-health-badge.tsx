import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { ProjectDashboard } from "@/fetchers/project/get-project-dashboard";

export type ProjectHealth = ProjectDashboard["summary"]["health"];

const VARIANTS = {
  not_started: "secondary",
  on_track: "success",
  at_risk: "warning",
  late: "error",
  complete: "info",
} as const satisfies Record<ProjectHealth, string>;

export function ProjectHealthBadge({ health }: { health: ProjectHealth }) {
  const { t } = useTranslation();

  return (
    <Badge variant={VARIANTS[health]} size="lg">
      {t(`workspace:projectDashboard.health.${health}`)}
    </Badge>
  );
}
