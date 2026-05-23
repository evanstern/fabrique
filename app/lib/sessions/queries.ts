// Session read helper that hides Mongo's internal _id field.
import { getDb } from "@db";
import { SESSIONS, type Session } from "./types";

/** Load one session document by id without exposing Mongo's internal _id. */
export async function getSession(id: string): Promise<Session | null> {
  const db = await getDb();
  const sessions = db.collection<Session>(SESSIONS);
  return await sessions.findOne(
    { session_id: id },
    { projection: { _id: 0 } },
  );
}
