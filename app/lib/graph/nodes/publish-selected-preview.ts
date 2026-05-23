import { setStage } from "@sessions";
import type { GraphStateValue } from "../state";

export async function publishSelectedPreview(
  state: GraphStateValue,
): Promise<Partial<GraphStateValue>> {
  await setStage(state.session_id, "published");
  return {};
}
