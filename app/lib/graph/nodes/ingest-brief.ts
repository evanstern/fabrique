// Graph node that normalizes raw brief text into structured session fields.
import { ChatAnthropic } from "@langchain/anthropic";
import { BriefFieldsSchema, type BriefFields } from "@schemas/llm";
import { patchBrief } from "@sessions";
import { INGEST_SYSTEM } from "../prompts";
import type { GraphNode } from "../state";
import { withProgress } from "../runtime/progress";

/** Parse raw brief text into the structured fields stored on the session. */
export const ingestBrief: GraphNode = async (state) => {
  const llm = new ChatAnthropic({
    model: "claude-sonnet-4-5-20250929",
    temperature: 0,
  }).withStructuredOutput(BriefFieldsSchema);

  const fields = (await withProgress(
    state.session_id,
    "ingest_brief",
    "refining_brief",
    () =>
      llm.invoke([
        { role: "system", content: INGEST_SYSTEM },
        {
          role: "user",
          content: `Raw brief from the user:\n\n${state.raw_input}`,
        },
      ]),
  )) as BriefFields;

  await patchBrief(state.session_id, fields);

  return {
    summary: fields.summary,
    goals: fields.goals,
    constraints: fields.constraints,
    open_questions: fields.open_questions,
  };
}
