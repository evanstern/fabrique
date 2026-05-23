// Artifact record and browser URL helpers for generated previews.
// Schema lock: gigi/wiki/decisions/v1-artifact-and-preview-records.md
/** Artifact record stored inside a session document. */
export type ArtifactRecord = {
  artifact_id: string;
  type: "html_preview";
  access: {
    url: string;
  };
};

/** Build the browser path used to fetch a generated preview artifact. */
export function artifactUrl(session_id: string, artifact_id: string): string {
  return `/artifacts/${session_id}/${artifact_id}`;
}
