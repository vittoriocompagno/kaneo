import { useQuery } from "@tanstack/react-query";
import getProjectActivities from "@/fetchers/activity/get-project-activities";

function useGetProjectActivities(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-activity", projectId],
    queryFn: () => getProjectActivities(projectId ?? ""),
    enabled: Boolean(projectId),
    refetchOnMount: "always",
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
  });
}

export default useGetProjectActivities;
