import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import getColumns from "@/fetchers/column/get-columns";
import {
  type DoneHoursTask,
  isMoveToDone,
  type StatusColumn,
} from "@/lib/done-hours";
import { useDoneHoursPromptStore } from "@/store/done-hours-prompt";

export type DoneMove = {
  task: DoneHoursTask;
  fromStatus: string | null | undefined;
  toStatus: string | null | undefined;
  // Defaults to the task's project. Set both for a move between projects.
  fromProjectId?: string;
  toProjectId?: string;
  // Skip the lookup when the caller already holds the workflow.
  fromColumns?: readonly StatusColumn[] | null;
  toColumns?: readonly StatusColumn[] | null;
};

// Asks "how many hours?" for every task that has just ended up in a final
// column. It runs after the status change has been saved and never throws:
// a failed workflow lookup only means no prompt, the move itself stands.
export function useDoneHoursPrompt() {
  const queryClient = useQueryClient();
  const enqueue = useDoneHoursPromptStore((state) => state.enqueue);

  return useCallback(
    async (moves: DoneMove[]) => {
      try {
        const columnsFor = (projectId: string) =>
          queryClient.ensureQueryData({
            queryKey: ["columns", projectId],
            queryFn: () => getColumns(projectId),
          }) as Promise<StatusColumn[]>;

        const prompts: DoneHoursTask[] = [];
        for (const move of moves) {
          if (move.fromStatus === move.toStatus && !move.fromProjectId)
            continue;
          const toColumns =
            move.toColumns ??
            (await columnsFor(move.toProjectId ?? move.task.projectId));
          const fromColumns =
            move.fromColumns ??
            (move.fromProjectId && move.fromProjectId !== move.toProjectId
              ? await columnsFor(move.fromProjectId)
              : toColumns);
          if (
            isMoveToDone({
              fromColumns,
              fromStatus: move.fromStatus,
              toColumns,
              toStatus: move.toStatus,
            })
          ) {
            prompts.push(move.task);
          }
        }
        if (prompts.length) enqueue(prompts);
      } catch (error) {
        console.error("Could not check whether to ask for hours:", error);
      }
    },
    [enqueue, queryClient],
  );
}
