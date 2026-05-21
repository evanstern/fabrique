import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { ChatAnthropic } from "@langchain/anthropic";
import { getMongoClient } from "./mongo.server";
import { BriefFieldsSchema, type BriefFields } from "./brief.server";
import { patchBrief } from "./sessions.server";

const GraphState = Annotation.Root({
  session_id: Annotation<string>(),
  raw_input: Annotation<string>(),
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
});

const INGEST_SYSTEM = `You translate a user's raw page-making brief into structured fields.

Be honest about what the user has told you. Do NOT invent goals or constraints the user did not state. If a question would meaningfully change the design, list it under open_questions; otherwise leave open_questions empty.

The user is describing a single web page they want to make. Keep the summary plain and short.`;

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

let compiledPromise: ReturnType<typeof buildGraph> | null = null;

async function buildGraph() {
  const client = await getMongoClient();
  const checkpointer = new MongoDBSaver({ client });

  const workflow = new StateGraph(GraphState)
    .addNode("ingest_brief", ingestBrief)
    .addEdge(START, "ingest_brief")
    .addEdge("ingest_brief", END);

  return workflow.compile({ checkpointer });
}

export async function getGraph() {
  if (!compiledPromise) {
    compiledPromise = buildGraph();
  }
  return compiledPromise;
}
