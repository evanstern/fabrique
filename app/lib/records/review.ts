// Review record shape that captures one preview decision.
// Schema lock: gigi/wiki/decisions/v1-artifact-and-preview-records.md
/** Review record stored in the session history after a preview decision. */
export type ReviewRecord = {
  review_id: string;
  target_preview_id: string;
  action: "approve" | "revise";
  notes: string[];
  created_at: Date;
};
