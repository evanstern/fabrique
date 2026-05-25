// Graph node that normalizes raw brief text into structured session fields.
import { ChatAnthropic } from "@langchain/anthropic";
import {
  BriefFieldsSchema,
  SessionNameSchema,
  type BriefFields,
  type SessionName,
} from "@schemas/llm";
import { getSession, patchBrief, setSessionName } from "@sessions";
import { INGEST_SYSTEM, NAME_SESSION_SYSTEM } from "../prompts";
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

  const session = await getSession(state.session_id);
  const existingName = session?.name?.trim() ?? "";
  let name = existingName;
  if (name === "") {
    const nameLlm = new ChatAnthropic({
      model: "claude-sonnet-4-5-20250929",
      temperature: 0,
    }).withStructuredOutput(SessionNameSchema);

    const generated = (await withProgress(
      state.session_id,
      "name_session",
      "naming_session",
      () =>
        nameLlm.invoke([
          { role: "system", content: NAME_SESSION_SYSTEM },
          {
            role: "user",
            content: [
              `Raw brief from the user:`,
              state.raw_input,
              ``,
              `Structured brief:`,
              `summary: ${fields.summary}`,
              `goals: ${JSON.stringify(fields.goals)}`,
              `constraints: ${JSON.stringify(fields.constraints)}`,
            ].join("\n"),
          },
        ]),
    )) as SessionName;

    name = generated.name.trim();
    await setSessionName(state.session_id, name);
  }

  return {
    name,
    summary: fields.summary,
    goals: fields.goals,
    constraints: fields.constraints,
    open_questions: fields.open_questions,
  };
}
