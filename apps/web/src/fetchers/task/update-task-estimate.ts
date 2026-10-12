import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function updateTaskEstimate(
  taskId: string,
  estimatedMinutes: number | null,
) {
  const response = await client.task.estimate[":id"].$put({
    param: { id: taskId },
    json: { estimatedMinutes },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default updateTaskEstimate;
