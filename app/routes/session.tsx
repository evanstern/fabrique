import { useEffect, useState } from "react";
import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/session";
import { Command } from "@langchain/langgraph";
import { getSession } from "../lib/sessions.server";
import {
  getGraph,
  getPendingInterrupt,
  type PendingInterrupt,
} from "../lib/graph.server";
import { publishSnapshot } from "../lib/sse-hub.server";
import type { SessionSnapshot } from "../lib/snapshots.server";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `fabrique — ${params.id}` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const session = await getSession(params.id);
  if (!session) {
    throw new Response("session not found", { status: 404 });
  }
  const interrupt = await getPendingInterrupt(params.id);
  return { session, interrupt };
}

export async function action({ request, params }: Route.ActionArgs) {
  const session = await getSession(params.id);
  if (!session) {
    throw new Response("session not found", { status: 404 });
  }
  const pending = await getPendingInterrupt(params.id);
  if (!pending || pending.kind !== "answer_clarification") {
    return { error: "No clarification questions are pending right now." };
  }

  const form = await request.formData();
  const answers: Record<string, string> = {};
  for (const q of pending.questions) {
    const v = String(form.get(q) ?? "").trim();
    if (v !== "") answers[q] = v;
  }
  if (Object.keys(answers).length === 0) {
    return { error: "Please answer at least one question." };
  }

  const graph = await getGraph();
  await graph.invoke(new Command({ resume: answers }), {
    configurable: { thread_id: params.id },
  });
  await publishSnapshot(params.id);
  return { ok: true };
}

type LiveState = {
  stage: string;
  interrupt: PendingInterrupt | null;
};

export default function SessionPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { session, interrupt: initialInterrupt } = loaderData;
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
          <p className="text-xs uppercase tracking-wider text-gray-500">
            fabrique session
          </p>
          <h1 className="text-2xl font-light tracking-tight">
            {session.session_id}
          </h1>
          <p className="text-sm text-gray-500">stage: {live.stage}</p>
        </header>

        <Brief session={session} />

        {live.interrupt ? (
          <Clarification
            questions={live.interrupt.questions}
            submitting={submitting}
            error={actionData && "error" in actionData ? actionData.error : null}
          />
        ) : (
          <ReadyForDesign />
        )}
      </div>
    </main>
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
