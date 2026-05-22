import { StateGraph, START, END, Annotation, interrupt } from "@langchain/langgraph";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { ChatAnthropic } from "@langchain/anthropic";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getMongoClient } from "./mongo.server";
import { BriefFieldsSchema, type BriefFields } from "./brief.server";
import {
  ClarificationVerdictSchema,
  type ClarificationVerdict,
} from "./clarification.server";
import {
  appendPreviewArtifact,
  appendReview,
  getSession,
  patchBrief,
  setRawInput,
  setStage,
} from "./sessions.server";
import {
  PreviewSchema,
  artifactUrl,
  nextSequentialId,
  type ArtifactRecord,
  type Preview,
  type PreviewRecord,
  type ReviewPreviewEvent,
  type ReviewRecord,
} from "./preview.server";

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
  last_review_action: Annotation<"approve" | "revise" | null>({
    default: () => null,
    reducer: (_, n) => n,
  }),
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

Prior Q/A history:
- The user message may include a "Prior interaction" section containing the raw brief plus "Q: ...\nA: ..." pairs from previous clarification rounds (questions you or a prior gate pass already asked, with the user's answers).
- DO NOT re-ask questions whose answers have been given, even if the answer was vague (e.g. "idk", "anything", "I don't know yet", "you choose"). Treat vague answers as "user does not want to specify; proceed" — that topic is settled, move on.
- If the prior Q/A history plus a partial answer is enough to make a first preview attempt, prefer ready=true over asking for more refinement.
- If you must ask more questions, target gaps NOT already covered by the prior Q/A history — different topics, or genuinely deeper than what was asked before. Do not paraphrase prior questions.

Return a single verdict.`;

const GENERATE_PREVIEWS_SYSTEM = `You design a single self-contained HTML page that realizes the user's brief.

Output a complete HTML document:
- Begins with <!doctype html> and includes <html>, <head>, and <body>.
- All CSS is inlined in <style> tags. All JS (if any) is inlined in <script> tags.
- No external assets, no external stylesheets, no external scripts, no <link rel="stylesheet">, no remote fonts.
- The page should be visually finished enough that the user can react to it. Make real layout, real typography, real color choices.
- Be honest about what the brief actually says. Do not invent product names, features, or claims that are not in the brief.

Also return a short title and a few design_notes explaining the choices you made so the user can review them.`;

const APPLY_REVISION_SYSTEM = `You are revising a single self-contained HTML page based on user feedback.

You will be given:
- The brief (summary, goals, constraints).
- The full HTML of the previous preview the user reviewed.
- The user's review notes describing what should change.

Output a complete revised HTML document:
- Begins with <!doctype html> and includes <html>, <head>, and <body>.
- All CSS is inlined in <style> tags. All JS (if any) is inlined in <script> tags.
- No external assets, no external stylesheets, no external scripts, no <link rel="stylesheet">, no remote fonts.
- Address the review notes directly and visibly. If the user asked for "warmer hero", the hero should look warmer.
- You may make small targeted edits OR substantially rewrite the page — whichever best serves the notes. Both are valid; don't force one strategy.
- Stay honest to the brief. Do not invent product names, features, or claims that are not in the brief.

Also return a short title and a few design_notes explaining what you changed and why.`;

function artifactsDir(): string {
  return process.env.ARTIFACTS_DIR ?? "./artifacts";
}

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
        ``,
        `Prior interaction with the user (raw input + any Q/A pairs from prior clarification rounds):`,
        ``,
        state.raw_input,
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

function clarifyDestination(
  state: typeof GraphState.State,
): "ingest_brief" | "generate_previews" {
  return state.ready ? "generate_previews" : "ingest_brief";
}

async function generatePreviews(
  state: typeof GraphState.State,
): Promise<Partial<typeof GraphState.State>> {
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

async function requestPreviewDecision(
  state: typeof GraphState.State,
): Promise<Partial<typeof GraphState.State>> {
  const session = await getSession(state.session_id);
  if (!session) {
    throw new Error(
      `request_preview_decision: session ${state.session_id} not found`,
    );
  }
  const latest = session.records.previews.at(-1);
  if (!latest) {
    throw new Error(
      `request_preview_decision: no preview to review on session ${state.session_id}`,
    );
  }

  const review = interrupt({
    kind: "review_preview",
    target_preview_id: latest.preview_id,
  }) as ReviewPreviewEvent;

  const review_id = nextSequentialId(
    "review",
    session.records.reviews.length,
  );
  const record: ReviewRecord = {
    review_id,
    target_preview_id: review.target_preview_id,
    action: review.action,
    notes: review.notes,
    created_at: new Date(),
  };
  await appendReview(state.session_id, record);

  return { last_review_action: review.action };
}

async function applyRevision(
  state: typeof GraphState.State,
): Promise<Partial<typeof GraphState.State>> {
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
  const priorHtml = await readFile(priorHtmlPath, "utf8");

  const llm = new ChatAnthropic({
    model: "claude-sonnet-4-5-20250929",
    temperature: 0,
    maxTokens: 16000,
  }).withStructuredOutput(PreviewSchema);

  const preview = (await llm.invoke([
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
  ])) as Preview;

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

async function publishSelectedPreview(
  state: typeof GraphState.State,
): Promise<Partial<typeof GraphState.State>> {
  await setStage(state.session_id, "published");
  return {};
}

function reviewDestination(
  state: typeof GraphState.State,
): "apply_revision" | "publish_selected_preview" {
  return state.last_review_action === "revise"
    ? "apply_revision"
    : "publish_selected_preview";
}

function defineWorkflow() {
  const nodes = new StateGraph(GraphState)
    .addNode("ingest_brief", ingestBrief)
    .addNode("clarify_or_confirm_brief", clarifyOrConfirmBrief)
    .addNode("generate_previews", generatePreviews)
    .addNode("request_preview_decision", requestPreviewDecision)
    .addNode("apply_revision", applyRevision)
    .addNode("publish_selected_preview", publishSelectedPreview);

  const briefingPhase = nodes
    .addEdge(START, "ingest_brief")
    .addEdge("ingest_brief", "clarify_or_confirm_brief")
    .addConditionalEdges("clarify_or_confirm_brief", clarifyDestination, [
      "ingest_brief",
      "generate_previews",
    ]);

  const previewPhase = briefingPhase.addEdge(
    "generate_previews",
    "request_preview_decision",
  );

  const reviewPhase = previewPhase.addConditionalEdges(
    "request_preview_decision",
    reviewDestination,
    ["apply_revision", "publish_selected_preview"],
  );

  const revisionPhase = reviewPhase.addEdge(
    "apply_revision",
    "request_preview_decision",
  );

  const publishPhase = revisionPhase.addEdge(
    "publish_selected_preview",
    END,
  );

  return publishPhase;
}

let compiledPromise: ReturnType<typeof buildGraph> | null = null;

async function buildGraph() {
  const client = await getMongoClient();
  const checkpointer = new MongoDBSaver({ client });
  return defineWorkflow().compile({ checkpointer });
}

export async function getGraph() {
  if (!compiledPromise) {
    compiledPromise = buildGraph();
  }
  return compiledPromise;
}

export type PendingInterrupt =
  | { kind: "answer_clarification"; questions: string[] }
  | { kind: "review_preview"; target_preview_id: string };

export async function getPendingInterrupt(
  session_id: string,
): Promise<PendingInterrupt | null> {
  const graph = await getGraph();
  const state = await graph.getState({
    configurable: { thread_id: session_id },
  });
  for (const task of state.tasks) {
    for (const intr of task.interrupts ?? []) {
      const val = intr.value as {
        kind?: string;
        questions?: unknown;
        target_preview_id?: unknown;
      };
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
      if (
        val &&
        val.kind === "review_preview" &&
        typeof val.target_preview_id === "string"
      ) {
        return {
          kind: "review_preview",
          target_preview_id: val.target_preview_id,
        };
      }
    }
  }
  return null;
}
