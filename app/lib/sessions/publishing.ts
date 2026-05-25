// Published-preview lookup derived from the approval trail.
import type { ArtifactRecord, PreviewRecord } from "@records";
import type { Session } from "./types";

// Schema lock: gigi/wiki/decisions/v1-preview-publish-semantics.md
// No `published_preview_id` field on the session document. Published state
// is derived from the latest `action === 'approve'` review record.
/** Resolve the artifact currently considered published for a session. */
export function getPublishedPreview(
  session: Session,
): { preview: PreviewRecord; artifact: ArtifactRecord } | null {
  if (session.stage !== "published") return null;

  const reviews = session.records.reviews;
  for (let i = reviews.length - 1; i >= 0; i--) {
    const review = reviews[i];
    if (review.action !== "approve") continue;
    const preview = session.records.previews.find(
      (p) => p.preview_id === review.target_preview_id,
    );
    if (!preview) return null;
    const artifact = session.records.artifacts.find(
      (a) => a.artifact_id === preview.artifact_id,
    );
    if (!artifact) return null;
    return { preview, artifact };
  }
  return null;
}
