import { getDb } from "@db";
import { SESSIONS, type Session, type SessionStage } from "./types";

export async function setStage(
  session_id: string,
  stage: SessionStage,
): Promise<void> {
  const db = await getDb();
  await db
    .collection<Session>(SESSIONS)
    .updateOne({ session_id }, { $set: { stage } });
}
