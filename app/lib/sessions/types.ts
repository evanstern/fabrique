import type { ArtifactRecord, PreviewRecord, ReviewRecord } from "@records";

// Schema lock: gigi/wiki/decisions/v1-session-document.md
export type SessionStage =
  | "briefing"
  | "designing"
  | "preview_ready"
  | "revising"
  | "published";

export type Session = {
  session_id: string;
  stage: SessionStage;
  brief: {
    raw_input: string;
    summary: string;
    goals: string[];
    constraints: string[];
    open_questions: string[];
  };
  records: {
    previews: PreviewRecord[];
    reviews: ReviewRecord[];
    artifacts: ArtifactRecord[];
  };
};

export const SESSIONS = "sessions";

export type BriefPatch = {
  summary: string;
  goals: string[];
  constraints: string[];
  open_questions: string[];
};
