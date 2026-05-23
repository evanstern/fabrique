import { getPendingInterrupt, type PendingInterrupt } from "@graph";
import { getSession, type Session } from "@sessions";
import { publishBuiltSnapshot } from "./hub";

export type SessionSnapshot = {
  session_id: string;
  stage: Session["stage"];
  records: Session["records"];
  interrupt: PendingInterrupt | null;
};

export async function buildSnapshot(
  session_id: string,
): Promise<SessionSnapshot | null> {
  const session = await getSession(session_id);
  if (!session) return null;
  const interrupt = await getPendingInterrupt(session_id);
  return {
    session_id: session.session_id,
    stage: session.stage,
    records: session.records,
    interrupt,
  };
}

export async function publishSnapshot(session_id: string): Promise<void> {
  const snapshot = await buildSnapshot(session_id);
  if (!snapshot) return;
  publishBuiltSnapshot(session_id, snapshot);
}
