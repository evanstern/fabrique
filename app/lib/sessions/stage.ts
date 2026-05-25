// Session stage mutation helper for advancing the workflow state.
import { getDb } from "@db";
import { SESSIONS, type Session, type SessionStage } from "./types";

/** Move a session to the next workflow stage. */
export async function setStage(
  session_id: string,
  stage: SessionStage,
): Promise<void> {
  const db = await getDb();
  await db
    .collection<Session>(SESSIONS)
    .updateOne({ session_id }, { $set: { stage } });
}

export async function transitionStage(
  session_id: string,
  from: SessionStage,
  to: SessionStage,
): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .collection<Session>(SESSIONS)
    .updateOne({ session_id, stage: from }, { $set: { stage: to } });
  return result.modifiedCount === 1;
}
