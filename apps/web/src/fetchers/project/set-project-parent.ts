import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export type SetProjectParentRequest = {
  id: string;
  parentProjectId: string | null;
};

async function setProjectParent({
  id,
  parentProjectId,
}: SetProjectParentRequest) {
  const response = await client.project[":id"].parent.$put({
    param: { id },
    json: { parentProjectId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default setProjectParent;
