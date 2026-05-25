import { Command } from "@langchain/langgraph";
import type { Route } from "./+types/api.sessions.$id.events";
import { getSession, setRawInput } from "@sessions";
import { getGraph, getPendingInterrupt } from "@graph";
import { publishSnapshot } from "@stream";
import {
  ReviewPreviewEventSchema,
  type ReviewPreviewEvent,
} from "@schemas/input";
import { requireAuth } from "@auth";

export async function loader({ request }: Route.LoaderArgs) {
  requireAuth(request, { api: true });
  return Response.json({ error: "method not allowed" }, { status: 405 });
}

type SubmitBriefEvent = {
  type: "submit_brief";
  raw_input: string;
};

type AnswerClarificationEvent = {
  type: "answer_clarification";
  answers: Record<string, string>;
};

type InputEvent =
  | SubmitBriefEvent
  | AnswerClarificationEvent
  | ReviewPreviewEvent;

function isSubmitBrief(value: unknown): value is SubmitBriefEvent {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.type === "submit_brief" && typeof v.raw_input === "string";
}

function isAnswerClarification(
  value: unknown,
): value is AnswerClarificationEvent {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.type !== "answer_clarification") return false;
  if (typeof v.answers !== "object" || v.answers === null) return false;
  for (const val of Object.values(v.answers as Record<string, unknown>)) {
    if (typeof val !== "string") return false;
  }
  return true;
}

function parseEvent(value: unknown): InputEvent | null {
  if (isSubmitBrief(value)) return value;
  if (isAnswerClarification(value)) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "review_preview"
  ) {
    const parsed = ReviewPreviewEventSchema.safeParse(value);
    if (parsed.success) return parsed.data;
  }
  return null;
}

export async function action({ request, params }: Route.ActionArgs) {
  requireAuth(request, { api: true });
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

  if (session.stage === "published") {
    return Response.json(
      { error: "session is published; no further events accepted" },
      { status: 409 },
    );
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

    await publishSnapshot(session.session_id);
    return new Response(null, { status: 202 });
  }

  if (event.type === "answer_clarification") {
    if (session.stage !== "briefing" && session.stage !== "preview_ready") {
      return Response.json(
        { error: `cannot answer_clarification in stage '${session.stage}'` },
        { status: 409 },
      );
    }

    const pending = await getPendingInterrupt(session.session_id);
    if (!pending || pending.kind !== "answer_clarification") {
      return Response.json(
        { error: "no pending clarification interrupt" },
        { status: 409 },
      );
    }

    const graph = await getGraph();
    await graph.invoke(new Command({ resume: event.answers }), {
      configurable: { thread_id: session.session_id },
    });

    await publishSnapshot(session.session_id);
    return new Response(null, { status: 202 });
  }

  if (event.type === "review_preview") {
    if (session.stage !== "preview_ready") {
      return Response.json(
        { error: `cannot review_preview in stage '${session.stage}'` },
        { status: 409 },
      );
    }

    const previewExists = session.records.previews.some(
      (p) => p.preview_id === event.target_preview_id,
    );
    if (!previewExists) {
      return Response.json(
        { error: `unknown target_preview_id '${event.target_preview_id}'` },
        { status: 400 },
      );
    }

    const pending = await getPendingInterrupt(session.session_id);
    if (!pending || pending.kind !== "review_preview") {
      return Response.json(
        { error: "no pending review interrupt" },
        { status: 409 },
      );
    }
    if (pending.target_preview_id !== event.target_preview_id) {
      return Response.json(
        {
          error: `target_preview_id mismatch: interrupt is paused on '${pending.target_preview_id}'`,
        },
        { status: 400 },
      );
    }

    const graph = await getGraph();
    await graph.invoke(new Command({ resume: event }), {
      configurable: { thread_id: session.session_id },
    });

    await publishSnapshot(session.session_id);
    return new Response(null, { status: 202 });
  }

  return Response.json({ error: "unhandled event" }, { status: 400 });
}
