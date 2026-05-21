import { useEffect, useState } from "react";
import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/session";
import { Command } from "@langchain/langgraph";
import { getPublishedPreview, getSession } from "../lib/sessions.server";
import {
  getGraph,
  getPendingInterrupt,
  type PendingInterrupt,
} from "../lib/graph.server";
import { publishSnapshot } from "../lib/sse-hub.server";
import type { SessionSnapshot } from "../lib/snapshots.server";
import { requireAuth } from "../lib/auth.server";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `fabrique — ${params.id}` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  requireAuth(request);
  const session = await getSession(params.id);
  if (!session) {
    throw new Response("session not found", { status: 404 });
  }
  const interrupt = await getPendingInterrupt(params.id);
  const published = getPublishedPreview(session);
  return { session, interrupt, published };
}

export async function action({ request, params }: Route.ActionArgs) {
  requireAuth(request);
  const session = await getSession(params.id);
  if (!session) {
    throw new Response("session not found", { status: 404 });
  }
  const pending = await getPendingInterrupt(params.id);
  if (!pending) {
    return { error: "Nothing is pending input right now." };
  }

  const form = await request.formData();
  const graph = await getGraph();

  if (pending.kind === "answer_clarification") {
    const answers: Record<string, string> = {};
    for (const q of pending.questions) {
      const v = String(form.get(q) ?? "").trim();
      if (v !== "") answers[q] = v;
    }
    if (Object.keys(answers).length === 0) {
      return { error: "Please answer at least one question." };
    }
    await graph.invoke(new Command({ resume: answers }), {
      configurable: { thread_id: params.id },
    });
    await publishSnapshot(params.id);
    return { ok: true };
  }

  if (pending.kind === "review_preview") {
    const action = String(form.get("action") ?? "");
    if (action !== "approve" && action !== "revise") {
      return { error: "Pick Approve or Revise." };
    }
    const notes = String(form.get("notes") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s !== "");

    await graph.invoke(
      new Command({
        resume: {
          type: "review_preview",
          target_preview_id: pending.target_preview_id,
          action,
          notes,
        },
      }),
      { configurable: { thread_id: params.id } },
    );
    await publishSnapshot(params.id);
    return { ok: true };
  }

  return { error: "Unhandled pending interrupt." };
}

type LiveState = {
  stage: string;
  interrupt: PendingInterrupt | null;
};

export default function SessionPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { session, interrupt: initialInterrupt, published } = loaderData;
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  const [live, setLive] = useState<LiveState>({
    stage: session.stage,
    interrupt: initialInterrupt,
  });

  useEffect(() => {
    const es = new EventSource(`/api/sessions/${session.session_id}/stream`);
    es.onmessage = (ev) => {
      try {
        const snap = JSON.parse(ev.data) as SessionSnapshot;
        setLive({ stage: snap.stage, interrupt: snap.interrupt });
      } catch {
        // Bad payload from server is not actionable here; ignore.
      }
    };
    es.onerror = () => {
      // Browser auto-reconnects; nothing useful to do per-message.
    };
    return () => es.close();
  }, [session.session_id]);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-1">
          <div className="flex items-start justify-between">
            <p className="text-xs uppercase tracking-wider text-gray-500">
              fabrique session
            </p>
            <form action="/logout" method="post">
              <button
                type="submit"
                className="text-xs text-gray-500 underline"
              >
                Sign out
              </button>
            </form>
          </div>
          <h1 className="text-2xl font-light tracking-tight">
            {session.session_id}
          </h1>
          <p className="text-sm text-gray-500">stage: {live.stage}</p>
        </header>

        <Brief session={session} />

        {live.interrupt && live.interrupt.kind === "answer_clarification" ? (
          <Clarification
            questions={live.interrupt.questions}
            submitting={submitting}
            error={actionData && "error" in actionData ? actionData.error : null}
          />
        ) : null}

        {live.stage === "published" && published ? (
          <Published
            sessionId={session.session_id}
            artifactUrl={published.artifact.access.url}
          />
        ) : null}

        {live.stage !== "published" &&
        live.stage === "preview_ready" &&
        live.interrupt &&
        live.interrupt.kind === "review_preview" ? (
          <PreviewReview
            sessionId={session.session_id}
            targetPreviewId={live.interrupt.target_preview_id}
            artifactId={
              session.records.previews.at(-1)?.artifact_id ?? null
            }
            submitting={submitting}
            error={actionData && "error" in actionData ? actionData.error : null}
          />
        ) : null}

        {!live.interrupt && live.stage === "briefing" ? (
          <ReadyForDesign />
        ) : null}
      </div>
    </main>
  );
}

function Published({
  sessionId,
  artifactUrl,
}: {
  sessionId: string;
  artifactUrl: string;
}) {
  return (
    <section className="space-y-3 rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 p-4">
      <h2 className="text-sm uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
        Published
      </h2>
      <p className="text-base break-all font-mono">{artifactUrl}</p>
      <a
        href={artifactUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-md bg-emerald-700 text-white px-4 py-2 text-sm font-medium"
      >
        View in new tab
      </a>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        The artifact URL above is the shareable page. This{" "}
        <span className="font-mono">/s/{sessionId}</span> URL shows the workflow
        that produced it.
      </p>
    </section>
  );
}

function Brief({ session }: { session: Route.ComponentProps["loaderData"]["session"] }) {
  const b = session.brief;
  return (
    <section className="space-y-4 rounded-md border border-gray-200 dark:border-gray-800 p-4">
      <h2 className="text-sm uppercase tracking-wider text-gray-500">Brief</h2>
      {b.summary ? (
        <p className="text-base">{b.summary}</p>
      ) : (
        <p className="text-sm text-gray-500 italic">No summary yet.</p>
      )}
      {b.goals.length > 0 ? (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-1">
            Goals
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            {b.goals.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {b.constraints.length > 0 ? (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-1">
            Constraints
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            {b.constraints.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Clarification({
  questions,
  submitting,
  error,
}: {
  questions: string[];
  submitting: boolean;
  error: string | null | undefined;
}) {
  return (
    <section className="space-y-4 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
      <h2 className="text-sm uppercase tracking-wider text-amber-800 dark:text-amber-300">
        A few questions
      </h2>
      <Form method="post" className="space-y-4">
        {questions.map((q, i) => (
          <div key={i} className="space-y-1">
            <label className="block text-sm font-medium">{q}</label>
            <input
              name={q}
              type="text"
              disabled={submitting}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        ))}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-amber-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Send answers"}
        </button>
      </Form>
    </section>
  );
}

function PreviewReview({
  sessionId,
  targetPreviewId,
  artifactId,
  submitting,
  error,
}: {
  sessionId: string;
  targetPreviewId: string;
  artifactId: string | null;
  submitting: boolean;
  error: string | null | undefined;
}) {
  const url = artifactId ? `/artifacts/${sessionId}/${artifactId}` : null;
  return (
    <section className="space-y-4 rounded-md border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/30 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm uppercase tracking-wider text-sky-800 dark:text-sky-300">
          Review preview {targetPreviewId}
        </h2>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline text-sky-800 dark:text-sky-300"
          >
            Open in new tab
          </a>
        ) : null}
      </div>
      {url ? (
        <iframe
          src={url}
          sandbox=""
          title={`preview ${targetPreviewId}`}
          className="w-full h-[600px] rounded border border-gray-300 dark:border-gray-700 bg-white"
        />
      ) : (
        <p className="text-sm text-gray-500 italic">No artifact attached.</p>
      )}
      <Form method="post" className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="notes" className="block text-sm font-medium">
            Notes (one per line)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            disabled={submitting}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="submit"
            name="action"
            value="revise"
            disabled={submitting}
            className="rounded-md bg-amber-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Sending..." : "Revise"}
          </button>
          <button
            type="submit"
            name="action"
            value="approve"
            disabled={submitting}
            className="rounded-md bg-emerald-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Sending..." : "Approve"}
          </button>
        </div>
      </Form>
    </section>
  );
}

function ReadyForDesign() {
  return (
    <section className="rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 p-4">
      <h2 className="text-sm uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
        Ready to design
      </h2>
      <p className="text-sm mt-1">
        The brief is good enough to start designing. Preview generation arrives
        in the next slice.
      </p>
    </section>
  );
}
