import { z } from "zod";

export const ReviewPreviewEventSchema = z.object({
  type: z.literal("review_preview"),
  target_preview_id: z.string().min(1),
  action: z.enum(["approve", "revise"]),
  notes: z.array(z.string()),
});

export type ReviewPreviewEvent = z.infer<typeof ReviewPreviewEventSchema>;

// Schema lock: gigi/wiki/decisions/v1-artifact-and-preview-records.md
export type ReviewRecord = {
  review_id: string;
  target_preview_id: string;
  action: "approve" | "revise";
  notes: string[];
  created_at: Date;
};

export const PreviewSchema = z.object({
  html: z
    .string()
    .describe(
      "Complete self-contained HTML document. Includes <!doctype html>, <head> with inlined <style>, and <body>. Any JavaScript is inlined in <script> tags. No external assets, no external stylesheets, no external scripts.",
    ),
  title: z
    .string()
    .describe("Short human-readable title for this preview."),
  design_notes: z
    .array(z.string())
    .describe(
      "What design choices were made and why. Each note is a short phrase a reviewer could react to.",
    ),
});

export type Preview = z.infer<typeof PreviewSchema>;

// Schema lock: gigi/wiki/decisions/v1-artifact-and-preview-records.md
export type ArtifactRecord = {
  artifact_id: string;
  type: "html_preview";
  access: {
    url: string;
  };
};

export type PreviewRecord = {
  preview_id: string;
  artifact_id: string;
};

export function artifactUrl(session_id: string, artifact_id: string): string {
  return `/artifacts/${session_id}/${artifact_id}`;
}

export function nextSequentialId(prefix: string, existing: number): string {
  const n = existing + 1;
  return `${prefix}-${String(n).padStart(3, "0")}`;
}
