import { z } from "zod";

export const BriefFieldsSchema = z.object({
  summary: z
    .string()
    .describe(
      "One to two plain-language sentences capturing what the user is asking for.",
    ),
  goals: z
    .array(z.string())
    .describe(
      "Specific outcomes the user wants this page to achieve. Each goal is a short phrase.",
    ),
  constraints: z
    .array(z.string())
    .describe(
      "Hard requirements or things the user explicitly does not want. Empty array if none stated.",
    ),
  open_questions: z
    .array(z.string())
    .describe(
      "Clarifying questions that block making a meaningful first preview. Only include questions whose answers would actually change the design. Empty array if the brief is already strong enough.",
    ),
});

export type BriefFields = z.infer<typeof BriefFieldsSchema>;
