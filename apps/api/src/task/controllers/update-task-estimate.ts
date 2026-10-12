import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { withLockedTask } from "./with-locked-task";
import { taskTable } from "../../database/schema";

async function updateTaskEstimate({
  id,
  estimatedMinutes,
}: {
  id: string;
  estimatedMinutes: number | null;
}) {
  const { after: updatedTask } = await withLockedTask(id, async (tx) => {
    const [updatedTask] = await tx
      .update(taskTable)
      .set({ estimatedMinutes })
      .where(eq(taskTable.id, id))
      .returning();

    if (!updatedTask) {
      throw new HTTPException(500, {
        message: "Failed to update task estimate",
      });
    }

    return updatedTask;
  });

  return updatedTask;
}

export default updateTaskEstimate;
