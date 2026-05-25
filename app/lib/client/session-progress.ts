export type ProgressState = {
  node: string;
  phase: string;
  status: "started" | "streaming" | "complete";
  tick?: number;
};

export function phaseLabel(phase: string | null): string {
  if (phase === "refining_brief") return "Refining your brief";
  if (phase === "checking_readiness") {
    return "Checking if I can start designing";
  }
  return "Thinking";
}
