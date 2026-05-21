import type { Route } from "./+types/api.sessions.$id.events";
import { getSession, setRawInput } from "../lib/sessions.server";
import { getGraph } from "../lib/graph.server";

export async function loader() {
  return Response.json({ error: "method not allowed" }, { status: 405 });
}

type SubmitBriefEvent = {
  type: "submit_brief";
  raw_input: string;
};

type InputEvent = SubmitBriefEvent;

function isSubmitBrief(value: unknown): value is SubmitBriefEvent {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.type === "submit_brief" && typeof v.raw_input === "string";
}

function parseEvent(value: unknown): InputEvent | null {
  if (isSubmitBrief(value)) return value;
  return null;
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const event = parseEvent(body);
  if (!event) {
    return Response.json({ error: "unknown event" }, { status: 400 });
  }

  const session = await getSession(params.id);
  if (!session) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }

  if (event.type === "submit_brief") {
    if (session.stage !== "briefing") {
      return Response.json(
        { error: `cannot submit_brief in stage '${session.stage}'` },
        { status: 409 },
      );
    }
    if (session.brief.raw_input !== "") {
      return Response.json(
        { error: "brief already submitted" },
        { status: 409 },
      );
    }
    if (event.raw_input.trim() === "") {
      return Response.json(
        { error: "raw_input must not be empty" },
        { status: 400 },
      );
    }

    await setRawInput(session.session_id, event.raw_input);

    const graph = await getGraph();
    await graph.invoke(
      { session_id: session.session_id, raw_input: event.raw_input },
      { configurable: { thread_id: session.session_id } },
    );

    return new Response(null, { status: 202 });
  }

  return Response.json({ error: "unhandled event" }, { status: 400 });
}
