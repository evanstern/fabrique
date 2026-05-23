import { interrupt } from "@langchain/langgraph";
import { nextSequentialId, type ReviewRecord } from "@records";
import type { ReviewPreviewEvent } from "@schemas/input";
import { appendReview, getSession } from "@sessions";
import type { GraphStateValue } from "../state";

export async function requestPreviewDecision(
  state: GraphStateValue,
): Promise<Partial<GraphStateValue>> {
  const session = await getSession(state.session_id);
  if (!session) {
    throw new Error(
      `request_preview_decision: session ${state.session_id} not found`,
    );
  }
  const latest = session.records.previews.at(-1);
  if (!latest) {
    throw new Error(
      `request_preview_decision: no preview to review on session ${state.session_id}`,
    );
  }

  const review = interrupt({
    kind: "review_preview",
    target_preview_id: latest.preview_id,
  }) as ReviewPreviewEvent;

  const review_id = nextSequentialId(
    "review",
    session.records.reviews.length,
  );
  const record: ReviewRecord = {
    review_id,
    target_preview_id: review.target_preview_id,
    action: review.action,
    notes: review.notes,
    created_at: new Date(),
  };
  await appendReview(state.session_id, record);

  return { last_review_action: review.action };
}
