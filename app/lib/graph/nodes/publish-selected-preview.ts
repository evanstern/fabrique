// Graph node that marks a session published after approval.
import { setStage } from "@sessions";
import type { GraphNode } from "../state";

/** Mark the session as published once a preview has been approved. */
export const publishSelectedPreview: GraphNode = async (state) => {
  await setStage(state.session_id, "published");
  return {};
}
