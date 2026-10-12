import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskEstimate from "@/fetchers/task/update-task-estimate";

export function useUpdateTaskEstimate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      estimatedMinutes,
    }: {
      taskId: string;
      estimatedMinutes: number | null;
    }) => updateTaskEstimate(taskId, estimatedMinutes),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["task", variables.taskId],
      });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      // The project dashboard sums estimates next to tracked hours.
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
