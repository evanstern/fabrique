import { z } from "zod";

export const ReviewPreviewEventSchema = z.object({
  type: z.literal("review_preview"),
  target_preview_id: z.string().min(1),
  action: z.enum(["approve", "revise"]),
  notes: z.array(z.string()),
});

export type ReviewPreviewEvent = z.infer<typeof ReviewPreviewEventSchema>;
