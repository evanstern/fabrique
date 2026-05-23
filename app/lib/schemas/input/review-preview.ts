// UI event schema for a user's preview review decision.
import { z } from "zod";

/** Input event sent from the review UI back into the graph. */
export const ReviewPreviewEventSchema = z.object({
  type: z.literal("review_preview"),
  target_preview_id: z.string().min(1),
  action: z.enum(["approve", "revise"]),
  notes: z.array(z.string()),
});

/** Inferred TypeScript shape for a review event. */
export type ReviewPreviewEvent = z.infer<typeof ReviewPreviewEventSchema>;
