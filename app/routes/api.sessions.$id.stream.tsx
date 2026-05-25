import type { Route } from "./+types/api.sessions.$id.stream";
import type { ProgressEvent, SessionSnapshot } from "@stream";

const HEARTBEAT_MS = 20_000;
const PROGRESS_THROTTLE_MS = 150;

function encodeSnapshot(snapshot: SessionSnapshot): string {
  return `data: ${JSON.stringify(snapshot)}\n\n`;
}

function encodeProgress(event: ProgressEvent): string {
  return `event: progress\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const [{ buildSnapshot, subscribe, subscribeProgress }, { requireAuth }] =
    await Promise.all([import("@stream"), import("@auth")]);
  requireAuth(request, { api: true });
  const initial = await buildSnapshot(params.id);
  if (!initial) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      safeEnqueue(encodeSnapshot(initial));

      const unsubscribe = subscribe(params.id, (snapshot) => {
        safeEnqueue(encodeSnapshot(snapshot));
      });

      let lastProgressAt = 0;
      const unsubscribeProgress = subscribeProgress(params.id, (event) => {
        const now = Date.now();
        if (
          event.status === "streaming" &&
          now - lastProgressAt < PROGRESS_THROTTLE_MS
        ) {
          return;
        }
        lastProgressAt = now;
        safeEnqueue(encodeProgress(event));
      });

      const heartbeat = setInterval(() => {
        safeEnqueue(`: heartbeat\n\n`);
      }, HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        unsubscribeProgress();
        try {
          controller.close();
        } catch {
          // controller may already be closed; ignore.
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
