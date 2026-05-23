// Session brief mutation helpers: raw input and structured brief fields.
import { getDb } from "@db";
import { SESSIONS, type BriefPatch, type Session } from "./types";

/** Store the raw user brief text on the session document. */
export async function setRawInput(
  session_id: string,
  raw_input: string,
): Promise<void> {
  const db = await getDb();
  await db
    .collection<Session>(SESSIONS)
    .updateOne({ session_id }, { $set: { "brief.raw_input": raw_input } });
}

/** Replace the structured brief fields after ingest has parsed them. */
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
