import { Hourglass } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatTrackedTime } from "@/components/project-dashboard/format-tracked-time";
import { useUpdateTaskEstimate } from "@/hooks/mutations/task/use-update-task-estimate";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import {
  hoursToMinutes,
  minutesToHoursInput,
  parseHours,
} from "@/lib/parse-hours";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskEstimatePopoverProps = {
  task: Task;
  className?: string;
};

export default function TaskEstimatePopover({
  task,
  className,
}: TaskEstimatePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const { mutateAsync: updateEstimate, isPending } = useUpdateTaskEstimate();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const estimated = task.estimatedMinutes ?? null;
  const parsed = parseHours(value);

  const label = (
    <Button
      variant="ghost"
      size="sm"
      className={cn("justify-start h-7 px-1.5 gap-1.5", className)}
    >
      <Hourglass className="w-3.5 h-3.5 text-muted-foreground" />
      <span
        className={cn(
          "text-xs font-semibold",
          estimated === null && "text-muted-foreground",
        )}
      >
        {estimated === null
          ? t("tasks:properties.estimate")
          : t("tasks:properties.estimateValue", {
              value: formatTrackedTime(estimated * 60),
            })}
      </span>
    </Button>
  );

  if (!canEdit) {
    return estimated === null ? null : (
      <div className={cn("flex h-7 items-center px-1.5", className)}>
        {label}
      </div>
    );
  }

  const save = async (minutes: number | null) => {
    try {
      await updateEstimate({ taskId: task.id, estimatedMinutes: minutes });
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.estimate.updateError"),
      );
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (parsed.status === "invalid") return;
    void save(parsed.status === "ok" ? hoursToMinutes(parsed.hours) : null);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next)
          setValue(estimated === null ? "" : minutesToHoursInput(estimated));
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>{label}</PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <label
            htmlFor={`estimate-${task.id}`}
            className="text-xs font-medium text-muted-foreground"
          >
            {t("tasks:popover.estimate.label")}
          </label>
          <input
            id={`estimate-${task.id}`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            // biome-ignore lint/a11y/noAutofocus: the popover exists to type this value
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("tasks:popover.estimate.placeholder")}
            aria-invalid={parsed.status === "invalid"}
            className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring aria-[invalid=true]:border-destructive"
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={isPending || parsed.status === "invalid"}
            >
              {t("tasks:popover.estimate.save")}
            </Button>
            {estimated !== null && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => void save(null)}
              >
                {t("tasks:popover.estimate.clear")}
              </Button>
            )}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
