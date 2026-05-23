// Schema lock: gigi/wiki/decisions/v1-artifact-and-preview-records.md
export type ReviewRecord = {
  review_id: string;
  target_preview_id: string;
  action: "approve" | "revise";
  notes: string[];
  created_at: Date;
};
