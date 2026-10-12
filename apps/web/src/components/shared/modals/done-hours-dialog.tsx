import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatTrackedTime } from "@/components/project-dashboard/format-tracked-time";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import useCreateTimeEntry from "@/hooks/mutations/time-entry/use-create-time-entry";
import { hoursToRange, parseHours } from "@/lib/parse-hours";
import { toast } from "@/lib/toast";
import { useDoneHoursPromptStore } from "@/store/done-hours-prompt";

// "Ore impiegate" prompt shown after a task lands in a final column. The
// status change is already saved, so every way out (Salta, Esc, a failed save
// the user gives up on) leaves the move in place.
export default function DoneHoursDialog() {
  const { t } = useTranslation();
  const queue = useDoneHoursPromptStore((state) => state.queue);
  const next = useDoneHoursPromptStore((state) => state.next);
  const clear = useDoneHoursPromptStore((state) => state.clear);
  const { mutateAsync: createTimeEntry, isPending } = useCreateTimeEntry();
  const task = queue[0];
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [showInvalid, setShowInvalid] = useState(false);
  const taskIdRef = useRef<string | undefined>(undefined);

  // A fresh task starts with empty fields, not the previous task's answer.
  useEffect(() => {
    if (taskIdRef.current === task?.id) return;
    taskIdRef.current = task?.id;
    setHours("");
    setNote("");
    setShowInvalid(false);
  }, [task?.id]);

  if (!task) return null;

  const parsed = parseHours(hours);
  const invalid = parsed.status === "invalid";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return;
    if (parsed.status === "invalid") {
      setShowInvalid(true);
      return;
    }
    if (parsed.status === "empty") {
      next();
      return;
    }
    try {
      await createTimeEntry({
        taskId: task.id,
        description: note.trim(),
        ...hoursToRange(parsed.hours),
      });
      next();
    } catch (error) {
      console.error("Failed to create time entry:", error);
      toast.error(t("tasks:doneHours.saveError"));
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isPending) next();
      }}
    >
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("tasks:doneHours.title")}</DialogTitle>
          <DialogDescription>
            {t("tasks:doneHours.description", { title: task.title })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 px-6">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="done-hours-input"
                className="text-xs font-medium text-muted-foreground"
              >
                {t("tasks:doneHours.hoursLabel")}
              </label>
              <input
                id="done-hours-input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                // biome-ignore lint/a11y/noAutofocus: the dialog exists to type this value
                autoFocus
                value={hours}
                onChange={(e) => {
                  setHours(e.target.value);
                  setShowInvalid(false);
                }}
                placeholder={t("tasks:doneHours.hoursPlaceholder")}
                aria-invalid={invalid && showInvalid}
                className="h-9 rounded-md border border-border bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring aria-[invalid=true]:border-destructive"
              />
              {task.estimatedMinutes != null && (
                <span className="text-xs text-muted-foreground">
                  {t("tasks:doneHours.estimatedHint", {
                    value: formatTrackedTime(task.estimatedMinutes * 60),
                  })}
                </span>
              )}
              {invalid && showInvalid && (
                <span role="alert" className="text-xs text-destructive">
                  {t("tasks:doneHours.invalid")}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="done-hours-note"
                className="text-xs font-medium text-muted-foreground"
              >
                {t("tasks:doneHours.noteLabel")}
              </label>
              <input
                id="done-hours-note"
                type="text"
                autoComplete="off"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("tasks:doneHours.notePlaceholder")}
                className="h-9 rounded-md border border-border bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter className="px-6 pb-4">
            {queue.length > 1 && (
              <>
                <span className="mr-auto text-xs text-muted-foreground">
                  {t("tasks:doneHours.moreWaiting", {
                    waiting: queue.length - 1,
                  })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={clear}
                >
                  {t("tasks:doneHours.skipAll")}
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={next}
            >
              {t("tasks:doneHours.skip")}
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {t("tasks:doneHours.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
