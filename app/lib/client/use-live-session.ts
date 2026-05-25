import { useEffect, useState } from "react";
import type { PendingInterrupt } from "@graph";
import type { SessionSnapshot } from "@stream";
import type { Session } from "@sessions";
import { displaySessionName } from "~/lib/session-names";
import type { ProgressState } from "./session-progress";

type LiveState = {
  name: string;
  stage: string;
  records: SessionSnapshot["records"];
  interrupt: PendingInterrupt | null;
};

export function useLiveSession({
  session,
  initialInterrupt,
  submitting,
}: {
  session: Session;
  initialInterrupt: PendingInterrupt | null;
  submitting: boolean;
}) {
  const [live, setLive] = useState<LiveState>({
    name: displaySessionName(session),
    stage: session.stage,
    records: session.records,
    interrupt: initialInterrupt,
  });
  const [progress, setProgress] = useState<ProgressState | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/sessions/${session.session_id}/stream`);
    es.onmessage = (ev) => {
      try {
        const snap = JSON.parse(ev.data) as SessionSnapshot;
        setLive({
          name: displaySessionName(snap),
          stage: snap.stage,
          records: snap.records,
          interrupt: snap.interrupt,
        });
        setProgress(null);
      } catch {
        // Bad payload from server is not actionable here; ignore.
      }
    };
    es.addEventListener("progress", (ev) => {
      try {
        const p = JSON.parse((ev as MessageEvent).data) as ProgressState;
        setProgress(p);
      } catch {
        // Bad payload from server is not actionable here; ignore.
      }
    });
    es.onerror = () => {
      // Browser auto-reconnects; nothing useful to do per-message.
    };
    return () => es.close();
  }, [session.session_id]);

  useEffect(() => {
    if (!submitting) {
      setProgress(null);
    }
  }, [submitting]);

  return { live, progress, setProgress };
}
