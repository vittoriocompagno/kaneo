import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SectionHeader } from "@/components/home/section-header";
import icons from "@/constants/project-icons";
import type { ProjectDashboard } from "@/fetchers/project/get-project-dashboard";
import { cn } from "@/lib/cn";
import { formatTrackedTime } from "./format-tracked-time";
import { ProjectHealthBadge } from "./project-health-badge";
import type { ProjectStatus } from "./project-status-select";

type Metrics = ProjectDashboard["summary"];

type BreakdownRow = {
  id: string;
  name: string;
  icon: string | null;
  status?: ProjectStatus;
  metrics: Metrics;
  isOwn: boolean;
};

function Row({ row, workspaceId }: { row: BreakdownRow; workspaceId: string }) {
  const { t } = useTranslation();
  const Icon = icons[row.icon as keyof typeof icons] || icons.Layout;
  const { metrics } = row;

  return (
    <li>
      <Link
        to="/dashboard/workspace/$workspaceId/project/$projectId/dashboard"
        params={{ workspaceId, projectId: row.id }}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-lg border border-border p-3.5 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_7rem_5rem_5rem_auto]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span
            className={cn(
              "min-w-0 truncate font-medium text-foreground text-sm",
              row.isOwn && "text-muted-foreground",
            )}
          >
            {row.isOwn
              ? t("workspace:projectDashboard.subprojects.thisProject")
              : row.name}
          </span>
          {row.status && (
            <span className="hidden shrink-0 text-muted-foreground text-xs md:inline">
              {t(`workspace:projectStatus.${row.status}`)}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2 max-sm:order-last max-sm:col-span-2">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-foreground/80"
              style={{ width: `${metrics.progress}%` }}
            />
          </span>
          <span className="w-9 text-right text-muted-foreground text-xs tabular-nums">
            {metrics.progress}%
          </span>
        </span>
        <span className="text-muted-foreground text-xs tabular-nums max-sm:hidden">
          {t("workspace:projectDashboard.subprojects.tasksDone", {
            done: metrics.doneTasks,
            total: metrics.totalTasks,
          })}
        </span>
        <span className="text-muted-foreground text-xs tabular-nums max-sm:hidden">
          {formatTrackedTime(metrics.trackedSeconds)}
        </span>
        <ProjectHealthBadge health={metrics.health} />
      </Link>
    </li>
  );
}

type SubprojectBreakdownProps = {
  dashboard: ProjectDashboard;
  workspaceId: string;
};

export function SubprojectBreakdown({
  dashboard,
  workspaceId,
}: SubprojectBreakdownProps) {
  const { t } = useTranslation();
  if (dashboard.subprojects.length === 0) return null;

  const rows: BreakdownRow[] = [
    {
      id: dashboard.project.id,
      name: dashboard.project.name,
      icon: dashboard.project.icon,
      metrics: dashboard.own,
      isOwn: true,
    },
    ...dashboard.subprojects.map((sub) => ({
      id: sub.id,
      name: sub.name,
      icon: sub.icon,
      status: sub.status,
      metrics: sub.metrics,
      isOwn: false,
    })),
  ];

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title={t("workspace:projectDashboard.subprojects.title")}
        detail={t("workspace:projectDashboard.subprojects.count", {
          count: dashboard.subprojects.length,
        })}
      />
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <Row key={row.id} row={row} workspaceId={workspaceId} />
        ))}
      </ul>
    </section>
  );
}
