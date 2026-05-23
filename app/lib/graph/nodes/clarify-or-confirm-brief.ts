// Graph node that gates a brief before preview generation can start.
import { ChatAnthropic } from "@langchain/anthropic";
import { interrupt } from "@langchain/langgraph";
import {
  ClarificationVerdictSchema,
  type ClarificationVerdict,
} from "@schemas/llm";
import { setRawInput } from "@sessions";
import { CLARIFY_SYSTEM } from "../prompts";
import type { GraphStateValue } from "../state";
import { withProgress } from "../runtime/progress";

/** Decide whether the brief can move forward or needs user clarification. */
export async function clarifyOrConfirmBrief(
  state: GraphStateValue,
): Promise<Partial<GraphStateValue>> {
  const llm = new ChatAnthropic({
    model: "claude-sonnet-4-5-20250929",
    temperature: 0,
  }).withStructuredOutput(ClarificationVerdictSchema);

  const verdict = (await withProgress(
    state.session_id,
    "clarify_or_confirm_brief",
    "checking_readiness",
    () =>
      llm.invoke([
        { role: "system", content: CLARIFY_SYSTEM },
        {
          role: "user",
          content: [
            `Brief to evaluate:`,
            ``,
            `summary: ${state.summary}`,
            `goals: ${JSON.stringify(state.goals)}`,
            `constraints: ${JSON.stringify(state.constraints)}`,
            `open_questions (from ingest, advisory): ${JSON.stringify(state.open_questions)}`,
            ``,
            `Prior interaction with the user (raw input + any Q/A pairs from prior clarification rounds):`,
            ``,
            state.raw_input,
          ].join("\n"),
        },
      ]),
  )) as ClarificationVerdict;

  if (verdict.ready) {
    return { ready: true };
  }

  // Pause the graph. The Command({ resume }) value becomes the return here.
  // We expect a map of { question: answer } from the answer_clarification event.
  const answers = interrupt({
    kind: "answer_clarification",
    questions: verdict.blocking_questions,
  }) as Record<string, string>;

  // Append answers to raw_input so the next ingest pass has them as user-stated truth.
  const appended = formatAnswers(answers);
  const newRaw = `${state.raw_input}\n\n${appended}`;

  await setRawInput(state.session_id, newRaw);

  return { raw_input: newRaw, ready: false };
}

/** Turn clarification answers into the Q/A transcript format ingested later. */
function formatAnswers(answers: Record<string, string>): string {
  const lines: string[] = [];
  for (const [q, a] of Object.entries(answers)) {
    lines.push(`Q: ${q}`);
    lines.push(`A: ${a}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
