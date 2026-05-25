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
    default:
      return "I’m working through the next step in the page workflow.";
  }
}
