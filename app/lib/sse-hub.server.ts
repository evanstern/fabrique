import { buildSnapshot, type SessionSnapshot } from "./snapshots.server";

type Subscriber = (snapshot: SessionSnapshot) => void;

type Hub = {
  subscribers: Map<string, Set<Subscriber>>;
};

const GLOBAL_KEY = "__fabrique_sse_hub__";

function getHub(): Hub {
  const g = globalThis as unknown as Record<string, Hub | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { subscribers: new Map() };
  }
  return g[GLOBAL_KEY]!;
}

export function subscribe(session_id: string, cb: Subscriber): () => void {
  const hub = getHub();
  let set = hub.subscribers.get(session_id);
  if (!set) {
    set = new Set();
    hub.subscribers.set(session_id, set);
  }
  set.add(cb);
  return () => {
    const s = hub.subscribers.get(session_id);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) hub.subscribers.delete(session_id);
  };
}

export async function publishSnapshot(session_id: string): Promise<void> {
  const hub = getHub();
  const set = hub.subscribers.get(session_id);
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
