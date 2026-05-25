export type ProgressState = {
  node: string;
  phase: string;
  status: "started" | "streaming" | "complete";
  tick?: number;
};

export function phaseLabel(phase: string | null): string {
  switch (phase) {
    case "refining_brief":
      return "I’m reading your brief and turning it into a clearer page direction.";
    case "checking_readiness":
      return "I’m checking whether there is enough detail to start designing.";
    case "reading_review_notes":
      return "I’m reading your review notes and comparing them with the current preview.";
    case "applying_revision":
      return "I’m applying your changes to the preview.";
    case "preparing_updated_preview":
      return "I’m preparing the updated preview for review.";
    default:
      return "I’m working through the next step in the page workflow.";
  }
}
