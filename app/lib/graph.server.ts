import { StateGraph, START, END, Annotation, interrupt } from "@langchain/langgraph";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { ChatAnthropic } from "@langchain/anthropic";
import { getMongoClient } from "./mongo.server";
import { BriefFieldsSchema, type BriefFields } from "./brief.server";
import {
  ClarificationVerdictSchema,
  type ClarificationVerdict,
} from "./clarification.server";
import { patchBrief, setRawInput } from "./sessions.server";

const GraphState = Annotation.Root({
  session_id: Annotation<string>(),
  raw_input: Annotation<string>({ reducer: (_, n) => n }),
  summary: Annotation<string>({ default: () => "", reducer: (_, n) => n }),
  goals: Annotation<string[]>({ default: () => [], reducer: (_, n) => n }),
  constraints: Annotation<string[]>({
    default: () => [],
    reducer: (_, n) => n,
  }),
  open_questions: Annotation<string[]>({
    default: () => [],
    reducer: (_, n) => n,
  }),
  ready: Annotation<boolean>({ default: () => false, reducer: (_, n) => n }),
});

const INGEST_SYSTEM = `You translate a user's raw page-making brief into structured fields.

Be honest about what the user has told you. Do NOT invent goals or constraints the user did not state. If a question would meaningfully change the design, list it under open_questions; otherwise leave open_questions empty.

The user is describing a single web page they want to make. Keep the summary plain and short.

The raw brief may contain follow-up clarifications appended as "Q: ...\nA: ..." pairs. Treat those answers as authoritative input from the user and incorporate them into summary, goals, and constraints as appropriate.`;

const CLARIFY_SYSTEM = `You are a readiness gate for a page-making workflow.

Given a structured brief (summary, goals, constraints, open_questions), decide whether the brief is good enough to generate a meaningful first preview of the page.

Rules:
- "Ready" does NOT mean every question is answered. It means enough is known to make a first honest attempt at a preview that the user could then react to.
- "Not ready" means a preview attempt would be a guess in the dark — the design choices would be invented rather than informed.
- If not ready, list the SPECIFIC questions whose answers would unblock a first preview. Be concrete (a designer could act on the answer). Avoid generic prompts like "tell me more".
- Prefer ready over not-ready when the call is close. Iteration is cheap; the user can refine on preview review.

Return a single verdict.`;

async function ingestBrief(
  state: typeof GraphState.State,
): Promise<Partial<typeof GraphState.State>> {
  const llm = new ChatAnthropic({
    model: "claude-sonnet-4-5-20250929",
    temperature: 0,
  }).withStructuredOutput(BriefFieldsSchema);

  const fields = (await llm.invoke([
    { role: "system", content: INGEST_SYSTEM },
    {
      role: "user",
      content: `Raw brief from the user:\n\n${state.raw_input}`,
    },
  ])) as BriefFields;

  await patchBrief(state.session_id, fields);

  return {
    summary: fields.summary,
    goals: fields.goals,
    constraints: fields.constraints,
    open_questions: fields.open_questions,
  };
}

async function clarifyOrConfirmBrief(
  state: typeof GraphState.State,
): Promise<Partial<typeof GraphState.State>> {
  const llm = new ChatAnthropic({
    model: "claude-sonnet-4-5-20250929",
    temperature: 0,
  }).withStructuredOutput(ClarificationVerdictSchema);

  const verdict = (await llm.invoke([
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
      ].join("\n"),
    },
  ])) as ClarificationVerdict;

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

function formatAnswers(answers: Record<string, string>): string {
  const lines: string[] = [];
  for (const [q, a] of Object.entries(answers)) {
    lines.push(`Q: ${q}`);
    lines.push(`A: ${a}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function routeAfterClarify(state: typeof GraphState.State): "ingest_brief" | typeof END {
  return state.ready ? END : "ingest_brief";
}

let compiledPromise: ReturnType<typeof buildGraph> | null = null;

async function buildGraph() {
  const client = await getMongoClient();
  const checkpointer = new MongoDBSaver({ client });

  const workflow = new StateGraph(GraphState)
    .addNode("ingest_brief", ingestBrief)
    .addNode("clarify_or_confirm_brief", clarifyOrConfirmBrief)
    .addEdge(START, "ingest_brief")
    .addEdge("ingest_brief", "clarify_or_confirm_brief")
    .addConditionalEdges("clarify_or_confirm_brief", routeAfterClarify, [
      "ingest_brief",
      END,
    ]);

  return workflow.compile({ checkpointer });
}

export async function getGraph() {
  if (!compiledPromise) {
    compiledPromise = buildGraph();
  }
  return compiledPromise;
}

export type PendingInterrupt = {
  kind: "answer_clarification";
  questions: string[];
};

export async function getPendingInterrupt(
  session_id: string,
): Promise<PendingInterrupt | null> {
  const graph = await getGraph();
  const state = await graph.getState({
    configurable: { thread_id: session_id },
  });
  for (const task of state.tasks) {
    for (const intr of task.interrupts ?? []) {
      const val = intr.value as { kind?: string; questions?: unknown };
      if (
        val &&
        val.kind === "answer_clarification" &&
        Array.isArray(val.questions)
      ) {
        return {
          kind: "answer_clarification",
          questions: val.questions.filter(
            (q): q is string => typeof q === "string",
          ),
        };
      }
    }
  }
  return null;
}
