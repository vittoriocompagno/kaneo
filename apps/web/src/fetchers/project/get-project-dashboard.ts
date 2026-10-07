import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type ProjectDashboard = InferResponseType<
  (typeof client)["project"][":id"]["dashboard"]["$get"],
  200
>;

async function getProjectDashboard(id: string) {
  const response = await client.project[":id"].dashboard.$get({
    param: { id },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getProjectDashboard;
