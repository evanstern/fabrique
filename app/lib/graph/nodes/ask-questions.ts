import { ChatAnthropic } from "@langchain/anthropic";
import { interrupt } from "@langchain/langgraph";
import {
  ClarificationVerdictSchema,
  type ClarificationVerdict,
} from "@schemas/llm";
import { getSession, setRawInput, setReviewNotes } from "@sessions";
import {
  BRIEF_CLARIFICATION_SYSTEM,
  REVISION_CLARIFICATION_SYSTEM,
} from "../prompts";
import { withProgress } from "../runtime/progress";
import type { GraphNode } from "../state";

export const askQuestions: GraphNode = async (state) => {
  if (state.last_review_action === "revise") {
    return askRevisionQuestions(state);
  }

  return askBriefQuestions(state);
};

async function askBriefQuestions(state: Parameters<GraphNode>[0]) {
  const llm = clarificationModel();
  const verdict = (await withProgress(
    state.session_id,
    "ask_questions",
    "checking_readiness",
    () =>
      llm.invoke([
        { role: "system", content: BRIEF_CLARIFICATION_SYSTEM },
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

  const answers = interrupt({
    kind: "answer_clarification",
    questions: verdict.blocking_questions,
  }) as Record<string, string>;

  const newRaw = `${state.raw_input}\n\n${formatAnswers(answers)}`;
  await setRawInput(state.session_id, newRaw);

  return { raw_input: newRaw, ready: false };
}

async function askRevisionQuestions(state: Parameters<GraphNode>[0]) {
  const session = await getSession(state.session_id);
  if (!session) {
    throw new Error(`ask_questions: session ${state.session_id} not found`);
  }
  const latestReview = session.records.reviews.at(-1);
  if (!latestReview) {
    throw new Error(
      `ask_questions: no review record on session ${state.session_id}`,
    );
  }

  const llm = clarificationModel();
  const verdict = (await withProgress(
    state.session_id,
    "ask_questions",
    "checking_revision_readiness",
    () =>
      llm.invoke([
        { role: "system", content: REVISION_CLARIFICATION_SYSTEM },
        {
          role: "user",
          content: [
            `Brief context:`,
            ``,
            `summary: ${state.summary}`,
            `goals: ${JSON.stringify(state.goals)}`,
            `constraints: ${JSON.stringify(state.constraints)}`,
            ``,
            `Latest review notes and prior revision Q/A, if any:`,
            JSON.stringify(latestReview.notes),
          ].join("\n"),
        },
      ]),
  )) as ClarificationVerdict;

  if (verdict.ready) {
    return {};
  }

  const answers = interrupt({
    kind: "answer_clarification",
    questions: verdict.blocking_questions,
  }) as Record<string, string>;

  await setReviewNotes(state.session_id, latestReview.review_id, [
    ...latestReview.notes,
    formatAnswers(answers),
  ]);

  return {};
}

function clarificationModel() {
  return new ChatAnthropic({
    model: "claude-sonnet-4-5-20250929",
    temperature: 0,
  }).withStructuredOutput(ClarificationVerdictSchema);
}

function formatAnswers(answers: Record<string, string>): string {
  const lines: string[] = [];
  for (const [q, a] of Object.entries(answers)) {
    lines.push(`Q: ${q}`);
    lines.push(`A: ${a}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
