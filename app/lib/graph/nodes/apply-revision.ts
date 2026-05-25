// Graph node that rewrites the latest preview in response to review notes.
import { ChatAnthropic } from "@langchain/anthropic";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  artifactUrl,
  nextSequentialId,
  type ArtifactRecord,
  type PreviewRecord,
} from "@records";
import { PreviewSchema, type Preview } from "@schemas/llm";
import { appendPreviewArtifact, getSession } from "@sessions";
import { APPLY_REVISION_SYSTEM } from "../prompts";
import { artifactsDir } from "../runtime/artifacts-dir";
import { withProgress } from "../runtime/progress";
import type { GraphNode } from "../state";

/** Rewrite the latest preview HTML in response to the stored review notes. */
export const applyRevision: GraphNode = async (state) => {
  const session = await getSession(state.session_id);
  if (!session) {
    throw new Error(`apply_revision: session ${state.session_id} not found`);
  }

  const latestPreview = session.records.previews.at(-1);
  if (!latestPreview) {
    throw new Error(
      `apply_revision: no preview to revise on session ${state.session_id}`,
    );
  }
  const priorArtifact = session.records.artifacts.find(
    (a) => a.artifact_id === latestPreview.artifact_id,
  );
  if (!priorArtifact) {
    throw new Error(
      `apply_revision: artifact ${latestPreview.artifact_id} not found on session ${state.session_id}`,
    );
  }
  const latestReview = session.records.reviews.at(-1);
  if (!latestReview) {
    throw new Error(
      `apply_revision: no review record on session ${state.session_id}`,
    );
  }

  const priorHtmlPath = join(
    artifactsDir(),
    state.session_id,
    `${priorArtifact.artifact_id}.html`,
  );
  const priorHtml = await withProgress(
    state.session_id,
    "apply_revision",
    "loading_current_preview",
    () => readFile(priorHtmlPath, "utf8"),
  );

  const llm = new ChatAnthropic({
    model: "claude-sonnet-4-5-20250929",
    temperature: 0,
    maxTokens: 16000,
  }).withStructuredOutput(PreviewSchema);

  const preview = (await withProgress(
    state.session_id,
    "apply_revision",
    "applying_revision",
    () =>
      llm.invoke([
        { role: "system", content: APPLY_REVISION_SYSTEM },
        {
          role: "user",
          content: [
            `Brief:`,
            ``,
            `summary: ${state.summary}`,
            `goals: ${JSON.stringify(state.goals)}`,
            `constraints: ${JSON.stringify(state.constraints)}`,
            ``,
            `Review notes from the user on the previous preview:`,
            JSON.stringify(latestReview.notes),
            ``,
            `Previous preview HTML (the one the user just reviewed):`,
            priorHtml,
          ].join("\n"),
        },
      ]),
  )) as Preview;

  const artifact_id = nextSequentialId(
    "artifact",
    session.records.artifacts.length,
  );
  const preview_id = nextSequentialId(
    "preview",
    session.records.previews.length,
  );

  const artifactRecord: ArtifactRecord = {
    artifact_id,
    type: "html_preview",
    access: { url: artifactUrl(state.session_id, artifact_id) },
  };
  const previewRecord: PreviewRecord = {
    preview_id,
    artifact_id,
  };

  await withProgress(
    state.session_id,
    "apply_revision",
    "preparing_updated_preview",
    async () => {
      const dir = join(artifactsDir(), state.session_id);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${artifact_id}.html`), preview.html, "utf8");

      await appendPreviewArtifact(
        state.session_id,
        artifactRecord,
        previewRecord,
        "preview_ready",
      );
    },
  );

  return {};
}
