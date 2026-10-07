import { useMutation, useQueryClient } from "@tanstack/react-query";
import setProjectStatus from "@/fetchers/project/set-project-status";

function useSetProjectStatus(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setProjectStatus,
    onSuccess: (_project, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["project-dashboard", id] }),
      ]),
  });
}

export default useSetProjectStatus;
