import { randomBytes } from "node:crypto";
import { getDb } from "@db";
import { SESSIONS, type Session } from "./types";

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
