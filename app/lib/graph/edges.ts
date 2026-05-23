import { END, START, StateGraph } from "@langchain/langgraph";
import { getMongoClient } from "@db";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { applyRevision } from "./nodes/apply-revision";
import { clarifyOrConfirmBrief } from "./nodes/clarify-or-confirm-brief";
import { generatePreviews } from "./nodes/generate-previews";
import { ingestBrief } from "./nodes/ingest-brief";
import { publishSelectedPreview } from "./nodes/publish-selected-preview";
import { requestPreviewDecision } from "./nodes/request-preview-decision";
import { GraphState, type GraphStateValue } from "./state";

function clarifyDestination(
  state: GraphStateValue,
): "ingest_brief" | "generate_previews" {
  return state.ready ? "generate_previews" : "ingest_brief";
}

function reviewDestination(
  state: GraphStateValue,
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
    compiledPromise = buildGraph().catch((error) => {
      compiledPromise = null;
      throw error;
    });
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
