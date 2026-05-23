// Graph node that marks a session published after approval.
import { setStage } from "@sessions";
import type { GraphStateValue } from "../state";

/** Mark the session as published once a preview has been approved. */
export async function publishSelectedPreview(
  state: GraphStateValue,
): Promise<Partial<GraphStateValue>> {
  await setStage(state.session_id, "published");
  return {};
}
