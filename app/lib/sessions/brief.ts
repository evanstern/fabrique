import { getDb } from "@db";
import { SESSIONS, type BriefPatch, type Session } from "./types";

export async function setRawInput(
  session_id: string,
  raw_input: string,
): Promise<void> {
  const db = await getDb();
  await db
    .collection<Session>(SESSIONS)
    .updateOne({ session_id }, { $set: { "brief.raw_input": raw_input } });
}

export async function patchBrief(
  session_id: string,
  patch: BriefPatch,
): Promise<void> {
  const db = await getDb();
  await db.collection<Session>(SESSIONS).updateOne(
    { session_id },
    {
      $set: {
        "brief.summary": patch.summary,
        "brief.goals": patch.goals,
        "brief.constraints": patch.constraints,
        "brief.open_questions": patch.open_questions,
      },
    },
  );
}
