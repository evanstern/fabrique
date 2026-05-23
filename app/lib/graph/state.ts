import { Annotation } from "@langchain/langgraph";

export const GraphState = Annotation.Root({
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

export type GraphStateValue = typeof GraphState.State;
