import { buildSnapshot, type SessionSnapshot } from "./snapshots.server";

export type ProgressEvent = {
  node: string;
  phase: string;
  status: "started" | "streaming" | "complete";
  tick?: number;
};

type SnapshotSubscriber = (snapshot: SessionSnapshot) => void;
type ProgressSubscriber = (event: ProgressEvent) => void;

type Hub = {
  snapshotSubs: Map<string, Set<SnapshotSubscriber>>;
  progressSubs: Map<string, Set<ProgressSubscriber>>;
};

const GLOBAL_KEY = "__fabrique_sse_hub__";

function getHub(): Hub {
  const g = globalThis as unknown as Record<string, Hub | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      snapshotSubs: new Map(),
      progressSubs: new Map(),
    };
  }
  return g[GLOBAL_KEY]!;
}

export function subscribe(
  session_id: string,
  cb: SnapshotSubscriber,
): () => void {
  const hub = getHub();
  let set = hub.snapshotSubs.get(session_id);
  if (!set) {
    set = new Set();
    hub.snapshotSubs.set(session_id, set);
  }
  set.add(cb);
  return () => {
    const s = hub.snapshotSubs.get(session_id);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) hub.snapshotSubs.delete(session_id);
  };
}

export function subscribeProgress(
  session_id: string,
  cb: ProgressSubscriber,
): () => void {
  const hub = getHub();
  let set = hub.progressSubs.get(session_id);
  if (!set) {
    set = new Set();
    hub.progressSubs.set(session_id, set);
  }
  set.add(cb);
  return () => {
    const s = hub.progressSubs.get(session_id);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) hub.progressSubs.delete(session_id);
  };
}

export async function publishSnapshot(session_id: string): Promise<void> {
  const hub = getHub();
  const set = hub.snapshotSubs.get(session_id);
  if (!set || set.size === 0) return;
  const snapshot = await buildSnapshot(session_id);
  if (!snapshot) return;
  for (const cb of set) {
    try {
      cb(snapshot);
    } catch {
      // A failing subscriber must not block other subscribers.
    }
  }
}

export function publishProgress(
  session_id: string,
  event: ProgressEvent,
): void {
  const hub = getHub();
  const set = hub.progressSubs.get(session_id);
  if (!set || set.size === 0) return;
  for (const cb of set) {
    try {
      cb(event);
    } catch {
      // A failing subscriber must not block other subscribers.
    }
  }
}
