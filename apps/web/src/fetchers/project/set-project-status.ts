import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type SetProjectStatusRequest = InferRequestType<
  (typeof client)["project"][":id"]["status"]["$put"]
>["json"] &
  InferRequestType<
    (typeof client)["project"][":id"]["status"]["$put"]
  >["param"];

async function setProjectStatus({ id, status }: SetProjectStatusRequest) {
  const response = await client.project[":id"].status.$put({
    param: { id },
    json: { status },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default setProjectStatus;
