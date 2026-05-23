// Schema lock: gigi/wiki/decisions/v1-artifact-and-preview-records.md
export type ArtifactRecord = {
  artifact_id: string;
  type: "html_preview";
  access: {
    url: string;
  };
};

export function artifactUrl(session_id: string, artifact_id: string): string {
  return `/artifacts/${session_id}/${artifact_id}`;
}
