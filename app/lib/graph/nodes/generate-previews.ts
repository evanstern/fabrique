// Graph node that turns the brief into the first self-contained HTML preview.
import { ChatAnthropic } from "@langchain/anthropic";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  artifactUrl,
  nextSequentialId,
  type ArtifactRecord,
  type PreviewRecord,
} from "@records";
import { PreviewSchema, type Preview } from "@schemas/llm";
import { appendPreviewArtifact, getSession, transitionStage } from "@sessions";
import { GENERATE_PREVIEWS_SYSTEM } from "../prompts";
import { artifactsDir } from "../runtime/artifacts-dir";
import type { GraphNode } from "../state";

/** Generate and persist the first preview HTML artifact for a session. */
export const generatePreviews: GraphNode = async (state) => {
  const started = await transitionStage(state.session_id, "briefing", "designing");
  if (!started) {
    const current = await getSession(state.session_id);
    if (current?.stage !== "designing") {
      throw new Error(
        `generate_previews: session ${state.session_id} is not ready to start designing`,
      );
    }
  }

  const llm = new ChatAnthropic({
    model: "claude-sonnet-4-5-20250929",
    temperature: 0,
    maxTokens: 16000,
  }).withStructuredOutput(PreviewSchema);

  const preview = (await llm.invoke([
    { role: "system", content: GENERATE_PREVIEWS_SYSTEM },
    {
      role: "user",
      content: [
        `Brief to realize as a page:`,
        ``,
        `summary: ${state.summary}`,
        `goals: ${JSON.stringify(state.goals)}`,
        `constraints: ${JSON.stringify(state.constraints)}`,
      ].join("\n"),
    },
  ])) as Preview;

  const session = await getSession(state.session_id);
  if (!session) {
    throw new Error(`generate_previews: session ${state.session_id} not found`);
  }

  const artifact_id = nextSequentialId(
    "artifact",
    session.records.artifacts.length,
  );
  const preview_id = nextSequentialId(
    "preview",
    session.records.previews.length,
  );

  const dir = join(artifactsDir(), state.session_id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${artifact_id}.html`), preview.html, "utf8");

  const artifactRecord: ArtifactRecord = {
    artifact_id,
    type: "html_preview",
    access: { url: artifactUrl(state.session_id, artifact_id) },
  };
  const previewRecord: PreviewRecord = {
    preview_id,
    artifact_id,
  };

  await appendPreviewArtifact(
    state.session_id,
    artifactRecord,
    previewRecord,
    "preview_ready",
  );

  return {};
}
