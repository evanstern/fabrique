// Canonical Mongo session document shape and workflow stage vocabulary.
import type {
  ArtifactRecord,
  ClarificationRecord,
  PreviewRecord,
  ReviewRecord,
} from "@records";

// Schema lock: gigi/wiki/decisions/v1-session-document.md
/** Session stage vocabulary for the canonical Mongo session document. */
export type SessionStage =
  | "briefing"
  | "designing"
  | "preview_ready"
  | "revising"
  | "published";

/** Canonical Mongo session document shape used across the workflow. */
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
    clarifications?: ClarificationRecord[];
  };
};

export type SessionNavigationSummary = {
  session_id: string;
  stage: SessionStage;
  brief: {
    raw_input: string;
    summary: string;
  };
};

/** Mongo collection name for session documents. */
export const SESSIONS = "sessions";

/** Patch shape for the structured brief fields inside a session. */
export type BriefPatch = {
  summary: string;
  goals: string[];
  constraints: string[];
  open_questions: string[];
};
