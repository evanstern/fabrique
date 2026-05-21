import { randomBytes } from "node:crypto";
import { getDb } from "./mongo.server";

// Schema lock: gigi/wiki/decisions/v1-session-document.md
export type Session = {
  session_id: string;
  stage: "briefing" | "designing" | "preview_ready" | "revising" | "published";
  brief: {
    raw_input: string;
    summary: string;
    goals: string[];
    constraints: string[];
    open_questions: string[];
  };
  records: {
    previews: unknown[];
    reviews: unknown[];
    artifacts: unknown[];
  };
};

const SESSIONS = "sessions";

function newSessionId(): string {
  // 5 bytes -> 10 hex chars; slice to 6 for a short, readable suffix.
  const suffix = randomBytes(5).toString("hex").slice(0, 6);
  return `sess_${suffix}`;
}

function emptySession(session_id: string): Session {
  return {
    session_id,
    stage: "briefing",
    brief: {
      raw_input: "",
      summary: "",
      goals: [],
      constraints: [],
      open_questions: [],
    },
    records: {
      previews: [],
      reviews: [],
      artifacts: [],
    },
  };
}

export async function createSession(): Promise<Session> {
  const db = await getDb();
  const sessions = db.collection<Session>(SESSIONS);

  for (let attempt = 0; attempt < 5; attempt++) {
    const session = emptySession(newSessionId());
    try {
      await sessions.insertOne(session);
      return session;
    } catch (err: unknown) {
      // Mongo error 11000 = duplicate key. Retry with a fresh id.
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: number }).code === 11000
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new Error("createSession: exhausted id retries");
}

export async function getSession(id: string): Promise<Session | null> {
  const db = await getDb();
  const sessions = db.collection<Session>(SESSIONS);
  return await sessions.findOne(
    { session_id: id },
    { projection: { _id: 0 } },
  );
}
