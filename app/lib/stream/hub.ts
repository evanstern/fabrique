// In-memory subscriber hub for session snapshots and graph progress.
import type { SessionSnapshot } from "./snapshot";

/** Progress events emitted by the graph into the live stream layer. */
export type ProgressEvent = {
  node: string;
  phase: string;
  status: "started" | "streaming" | "complete";
  tick?: number;
};

/** Snapshot listeners receive the latest assembled session snapshot. */
type SnapshotSubscriber = (snapshot: SessionSnapshot) => void;
/** Progress listeners receive heartbeat events from running graph nodes. */
type ProgressSubscriber = (event: ProgressEvent) => void;

/** In-memory subscriber registry shared across requests in the same process. */
type Hub = {
  snapshotSubs: Map<string, Set<SnapshotSubscriber>>;
  progressSubs: Map<string, Set<ProgressSubscriber>>;
};

const GLOBAL_KEY = "__fabrique_sse_hub__";

/** Store the hub on globalThis so the SSE layer can span module reloads. */
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

/** Subscribe to snapshot updates for one session. */
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

/** Subscribe to graph progress events for one session. */
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

/** Publish a built snapshot to all current session subscribers. */
export function publishBuiltSnapshot(
  session_id: string,
  snapshot: SessionSnapshot,
): void {
  const hub = getHub();
  const set = hub.snapshotSubs.get(session_id);
  if (!set || set.size === 0) return;
  for (const cb of set) {
    try {
      cb(snapshot);
    } catch {
      // A failing subscriber must not block other subscribers.
    }
  }
}

/** Publish a progress event to all current session subscribers. */
export function publishProgress(session_id: string, event: ProgressEvent): void {
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
