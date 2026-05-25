// Session read helper that hides Mongo's internal _id field.
import { getDb } from "@db";
import { ensureSessionIndexes } from "./indexes";
import { SESSIONS, type Session, type SessionNavigationSummary } from "./types";

/** Load one session document by id without exposing Mongo's internal _id. */
export async function getSession(id: string): Promise<Session | null> {
  await ensureSessionIndexes();
  const db = await getDb();
  const sessions = db.collection<Session>(SESSIONS);
  return await sessions.findOne(
    { session_id: id },
    { projection: { _id: 0 } },
  );
}

export async function listSessionNavigationSummaries(): Promise<
  SessionNavigationSummary[]
> {
  await ensureSessionIndexes();
  const db = await getDb();
  const sessions = db.collection<Session>(SESSIONS);
  const recent = await sessions
    .find<SessionNavigationSummary>(
      {},
      {
        projection: {
          _id: 0,
          session_id: 1,
          name: 1,
          stage: 1,
          "brief.raw_input": 1,
          "brief.summary": 1,
        },
      },
    )
    .sort({ _id: -1 })
    .limit(16)
    .toArray();

  return recent.map((session: SessionNavigationSummary) => ({
    session_id: session.session_id,
    name: session.name,
    stage: session.stage,
    brief: {
      raw_input: session.brief.raw_input,
      summary: session.brief.summary,
    },
  }));
}
