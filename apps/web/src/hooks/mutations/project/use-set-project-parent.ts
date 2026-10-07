import { useMutation, useQueryClient } from "@tanstack/react-query";
import setProjectParent from "@/fetchers/project/set-project-parent";

function useSetProjectParent(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setProjectParent,
    // The dashboards of the old and new parent both change, so drop them all.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["project-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["project-activity"] }),
      ]),
  });
}

export default useSetProjectParent;
