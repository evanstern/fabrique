import { getDb } from "@db";
import { SESSIONS, type Session } from "./types";

let indexPromise: Promise<void> | null = null;

export function ensureSessionIndexes(): Promise<void> {
  if (!indexPromise) {
    indexPromise = getDb()
      .then((db) =>
        db.collection<Session>(SESSIONS).createIndex(
          { session_id: 1 },
          { unique: true, name: "sessions_session_id_unique" },
        ),
      )
      .then(() => undefined)
      .catch((error) => {
        indexPromise = null;
        throw error;
      });
  }

  return indexPromise;
}
