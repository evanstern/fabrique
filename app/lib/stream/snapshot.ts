// Build the live session snapshot sent to connected clients.
import { getPendingInterrupt, type PendingInterrupt } from "@graph";
import { getSession, type Session } from "@sessions";
import { publishBuiltSnapshot } from "./hub";

/** Snapshot payload sent to the live client for one session. */
export type SessionSnapshot = {
  session_id: string;
  name?: string;
  stage: Session["stage"];
  records: Session["records"];
  interrupt: PendingInterrupt | null;
};

/** Assemble the current session view together with any pending interrupt. */
export async function buildSnapshot(
  session_id: string,
): Promise<SessionSnapshot | null> {
  const session = await getSession(session_id);
  if (!session) return null;
  const interrupt = await getPendingInterrupt(session_id);
  return {
    session_id: session.session_id,
    name: session.name,
    stage: session.stage,
    records: session.records,
    interrupt,
  };
}

/** Build and publish the current snapshot to connected subscribers. */
export async function publishSnapshot(session_id: string): Promise<void> {
  const snapshot = await buildSnapshot(session_id);
  if (!snapshot) return;
  publishBuiltSnapshot(session_id, snapshot);
}
