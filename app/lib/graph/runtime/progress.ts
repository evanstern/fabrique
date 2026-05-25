// Wrap node execution with coarse progress events for the SSE stream.
import { publishProgress } from "@stream/hub";

const PROGRESS_TICK_MS = 150;

/** Wrap a node call with coarse progress events for the SSE stream. */
export async function withProgress<T>(
  session_id: string,
  node: string,
  phase: string,
  fn: () => Promise<T>,
): Promise<T> {
  publishProgress(session_id, { node, phase, status: "started", tick: 0 });
  let tick = 1;
  const interval = setInterval(() => {
    publishProgress(session_id, {
      node,
      phase,
      status: "streaming",
      tick: tick++,
    });
  }, PROGRESS_TICK_MS);
  try {
    return await fn();
  } finally {
    clearInterval(interval);
    publishProgress(session_id, { node, phase, status: "complete", tick });
  }
}
