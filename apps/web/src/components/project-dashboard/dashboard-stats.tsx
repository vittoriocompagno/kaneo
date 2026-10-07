import { useTranslation } from "react-i18next";
import { ProjectProgress } from "@/components/project-progress";
import type { ProjectDashboard } from "@/fetchers/project/get-project-dashboard";
import { cn } from "@/lib/cn";
import { formatTrackedTime } from "./format-tracked-time";

type Metrics = ProjectDashboard["summary"];

type StatProps = {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "danger";
  icon?: React.ReactNode;
};

function Stat({ label, value, detail, tone = "default", icon }: StatProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border p-3.5">
      <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon}
        {label}
      </span>
      <span
        className={cn(
          "font-semibold text-2xl tabular-nums tracking-tight",
          tone === "danger" ? "text-destructive-foreground" : "text-foreground",
        )}
      >
        {value}
      </span>
      {detail && (
        <span className="text-muted-foreground text-xs">{detail}</span>
      )}
    </div>
  );
}

export function DashboardStats({ metrics }: { metrics: Metrics }) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <Stat
        label={t("workspace:projectDashboard.stats.hours")}
        value={formatTrackedTime(metrics.trackedSeconds)}
      />
      <Stat
        label={t("workspace:projectDashboard.stats.done")}
        value={String(metrics.doneTasks)}
        detail={t("workspace:projectDashboard.stats.ofTotal", {
          count: metrics.totalTasks,
        })}
      />
      <Stat
        label={t("workspace:projectDashboard.stats.remaining")}
        value={String(metrics.remainingTasks)}
      />
      <Stat
        label={t("workspace:projectDashboard.stats.progress")}
        value={`${metrics.progress}%`}
        icon={
          <ProjectProgress
            percentage={metrics.progress}
            className="text-muted-foreground"
          />
        }
      />
      <Stat
        label={t("workspace:projectDashboard.stats.overdue")}
        value={String(metrics.overdueTasks)}
        tone={metrics.overdueTasks > 0 ? "danger" : "default"}
        detail={
          metrics.dueSoonTasks > 0
            ? t("workspace:projectDashboard.stats.dueSoon", {
                count: metrics.dueSoonTasks,
              })
            : undefined
        }
      />
    </div>
  );
}
