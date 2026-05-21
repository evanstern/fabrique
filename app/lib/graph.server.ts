import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { getMongoClient } from "./mongo.server";

const GraphState = Annotation.Root({
  session_id: Annotation<string>(),
  ticks: Annotation<number>({
    reducer: (a, b) => (b ?? 0) + (a ?? 0),
    default: () => 0,
  }),
});

function noop(state: typeof GraphState.State) {
  return { ticks: 1 };
}

let compiledPromise: ReturnType<typeof buildGraph> | null = null;

async function buildGraph() {
  const client = await getMongoClient();
  const checkpointer = new MongoDBSaver({ client });

  const workflow = new StateGraph(GraphState)
    .addNode("noop", noop)
    .addEdge(START, "noop")
    .addEdge("noop", END);

  return workflow.compile({ checkpointer });
}

export async function getGraph() {
  if (!compiledPromise) {
    compiledPromise = buildGraph();
  }
  return compiledPromise;
}
