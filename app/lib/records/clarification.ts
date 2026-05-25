export type ClarificationRecord = {
  clarification_id: string;
  context: "brief" | "revision";
  questions: string[];
  answers: Record<string, string>;
  created_at: Date;
};
