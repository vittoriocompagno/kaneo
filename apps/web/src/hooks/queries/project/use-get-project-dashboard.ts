import { useQuery } from "@tanstack/react-query";
import getProjectDashboard from "@/fetchers/project/get-project-dashboard";

function useGetProjectDashboard(projectId: string) {
  return useQuery({
    queryKey: ["project-dashboard", projectId],
    queryFn: () => getProjectDashboard(projectId),
    enabled: !!projectId,
    // Tasks and time entries change on other screens without touching this
    // cache, so refresh like the home page does.
    refetchOnMount: "always",
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
  });
}

export default useGetProjectDashboard;
