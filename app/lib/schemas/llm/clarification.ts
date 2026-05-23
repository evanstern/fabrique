// Readiness verdict schema used by the clarification gate.
import { z } from "zod";

/** Readiness verdict returned by the clarification gate. */
export const ClarificationVerdictSchema = z.object({
  ready: z
    .boolean()
    .describe(
      "True if the brief is good enough to start designing a first preview. False if a meaningful preview cannot be made yet without more input.",
    ),
  blocking_questions: z
    .array(z.string())
    .describe(
      "If ready is false, the specific questions whose answers are required before designing. Empty array when ready is true. Each question is a single short sentence the user can answer.",
    ),
  rationale: z
    .string()
    .describe(
      "One short sentence explaining the decision. Used for logs and PR descriptions, not shown to the user.",
    ),
});

/** Inferred TypeScript shape for the clarification verdict. */
export type ClarificationVerdict = z.infer<typeof ClarificationVerdictSchema>;
