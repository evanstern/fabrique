import { useEffect, useState } from "react";
import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/session";
import { Command } from "@langchain/langgraph";
import { getPublishedPreview, getSession } from "@sessions";
import {
  getGraph,
  getPendingInterrupt,
  type PendingInterrupt,
} from "@graph";
import { publishSnapshot, type SessionSnapshot } from "@stream";
import { requireAuth } from "@auth";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `fabrique — ${params.id}` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  requireAuth(request);
  const url = new URL(request.url);
  const session = await getSession(params.id);
  if (!session) {
    throw new Response("session not found", { status: 404 });
  }
  const interrupt = await getPendingInterrupt(params.id);
  const published = getPublishedPreview(session);
  return {
    session,
    interrupt,
    published,
    initialBrief: url.searchParams.get("initial_brief"),
  };
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
  records: SessionSnapshot["records"];
  interrupt: PendingInterrupt | null;
};

type ProgressState = {
  node: string;
  phase: string;
  status: "started" | "streaming" | "complete";
  tick?: number;
};

type InitialSubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "submitted" }
  | { status: "error"; message: string };

type CopyState = "idle" | "copied" | "error";

type ThemeMode = "light" | "dark";

const startedInitialSubmissions = new Set<string>();

function getSystemTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem("fabrique-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    return null;
  }
  return null;
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

function phaseLabel(phase: string | null): string {
  if (phase === "refining_brief") return "Refining your brief";
  if (phase === "checking_readiness")
    return "Checking if I can start designing";
  return "Thinking";
}

export default function SessionPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { session, interrupt: initialInterrupt, published, initialBrief } =
    loaderData;
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  const [live, setLive] = useState<LiveState>({
    stage: session.stage,
    records: session.records,
    interrupt: initialInterrupt,
  });
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [initialSubmitState, setInitialSubmitState] =
    useState<InitialSubmitState>({ status: "idle" });
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [publishedCopyState, setPublishedCopyState] =
    useState<CopyState>("idle");
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const initialTheme = getStoredTheme() ?? getSystemTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  useEffect(() => {
    const es = new EventSource(`/api/sessions/${session.session_id}/stream`);
    es.onmessage = (ev) => {
      try {
        const snap = JSON.parse(ev.data) as SessionSnapshot;
        setLive({
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

  useEffect(() => {
    if (!initialBrief) return;

    const cleanUrl = `${location.pathname}${location.hash}`;
    window.history.replaceState(null, "", cleanUrl);

    const initialSubmitKey = `${session.session_id}:${initialBrief}`;
    if (startedInitialSubmissions.has(initialSubmitKey)) return;

    startedInitialSubmissions.add(initialSubmitKey);
    setInitialSubmitState({ status: "submitting" });
    setProgress({
      node: "ingest_brief",
      phase: "refining_brief",
      status: "started",
    });

    void fetch(`/api/sessions/${session.session_id}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "submit_brief", raw_input: initialBrief }),
    }).then(async (response) => {
      if (!response.ok) {
        let message = "Could not start the brief. Please try again.";
        const body = (await response.json().catch(() => null)) as {
          error?: unknown;
        } | null;
        if (body) {
          if (typeof body.error === "string") message = body.error;
        }
        setInitialSubmitState({ status: "error", message });
        return;
      }
      setInitialSubmitState({ status: "submitted" });
    }, () => {
      setInitialSubmitState({
        status: "error",
        message: "Could not start the brief. Please try again.",
      });
    });
  }, [initialBrief, session.session_id]);

  const showingInitialProgress =
    initialSubmitState.status === "submitting" && !live.interrupt;
  const previewInterrupt =
    live.stage === "preview_ready" &&
    live.interrupt &&
    live.interrupt.kind === "review_preview"
      ? live.interrupt
      : null;
  const previewArtifactId = live.records.previews.at(-1)?.artifact_id ?? null;

  async function copyCurrentUrl() {
    if (typeof window === "undefined") return;

    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  async function copyPublishedUrl(artifactUrl: string) {
    if (typeof window === "undefined") return;

    try {
      await navigator.clipboard.writeText(artifactUrl);
      setPublishedCopyState("copied");
    } catch {
      setPublishedCopyState("error");
    }
  }

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    try {
      window.localStorage.setItem("fabrique-theme", nextTheme);
    } catch {
      return;
    }
  }

  return (
    <main className="min-h-screen text-foreground">
      <div className="sticky top-0 z-20 flex min-h-14 items-center justify-between border-b border-border bg-panel px-5 text-panel-foreground shadow-soft sm:px-6">
        <p className="font-display-label text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
          <a
            href="/"
            className="font-brand text-foreground underline decoration-border underline-offset-4 transition hover:text-accent hover:decoration-accent"
          >
            fabrique
          </a>{" "}
          session
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-ring hover:text-foreground"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-ring hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
      <div className="flex min-h-[calc(100vh-3.5rem)] w-full flex-col overflow-hidden bg-panel shadow-ambient lg:grid lg:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.35fr)]">
        <section className="flex min-h-[36rem] flex-col border-b border-border bg-sidebar text-sidebar-foreground lg:border-b-0 lg:border-r">
          <header className="flex min-h-24 items-center border-b border-border px-5 py-4 sm:px-6">
            <div className="w-full space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                <h1 className="max-w-sm truncate font-mono text-sm font-medium tracking-tight sm:text-base">
                  {session.session_id}
                </h1>
                <button
                  type="button"
                  onClick={copyCurrentUrl}
                  className="w-fit text-xs font-medium text-muted-foreground underline decoration-border underline-offset-4 transition hover:text-foreground"
                >
                  {copyState === "copied"
                    ? "Copied URL"
                    : copyState === "error"
                      ? "Copy failed"
                      : "Copy URL"}
                </button>
              </div>
              <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-accent" />
                stage: {live.stage}
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col overflow-y-auto">
            <ChatMessage eyebrow="Brief" tone="neutral" square transparent>
              <Brief session={session} />
            </ChatMessage>

            {showingInitialProgress ? (
              <ChatMessage eyebrow="Fabrique" tone="warning">
                <ClarificationSkeleton
                  progress={progress}
                  title="Starting your brief"
                />
              </ChatMessage>
            ) : null}

            {initialSubmitState.status === "error" ? (
              <ChatMessage eyebrow="Needs attention" tone="danger">
                <InitialSubmitError message={initialSubmitState.message} />
              </ChatMessage>
            ) : null}

            {live.interrupt && live.interrupt.kind === "answer_clarification" ? (
              <ChatMessage eyebrow="Clarification" tone="warning">
                {submitting ? (
                  <ClarificationSkeleton progress={progress} />
                ) : (
                  <Clarification
                    questions={live.interrupt.questions}
                    submitting={submitting}
                    error={
                      actionData && "error" in actionData ? actionData.error : null
                    }
                  />
                )}
              </ChatMessage>
            ) : null}

            {previewInterrupt ? (
              <ChatMessage eyebrow="Review" tone="info" square fill>
                <PreviewDecision
                  targetPreviewId={previewInterrupt.target_preview_id}
                  submitting={submitting}
                  error={
                    actionData && "error" in actionData ? actionData.error : null
                  }
                />
              </ChatMessage>
            ) : null}

            {live.stage === "published" && published ? (
              <ChatMessage eyebrow="Published" tone="success" square fill>
                <Published
                  sessionId={session.session_id}
                  artifactUrl={published.artifact.access.url}
                  copyState={publishedCopyState}
                  onCopy={copyPublishedUrl}
                />
              </ChatMessage>
            ) : null}

            {!showingInitialProgress && !live.interrupt && live.stage === "briefing" ? (
              <ChatMessage eyebrow="Next" tone="success">
                <ReadyForDesign />
              </ChatMessage>
            ) : null}
          </div>
        </section>

        <aside className="flex min-h-[32rem] flex-col bg-preview text-preview-foreground">
          {previewInterrupt ? (
            <PreviewPane
              sessionId={session.session_id}
              targetPreviewId={previewInterrupt.target_preview_id}
              artifactId={previewArtifactId}
            />
          ) : live.stage === "published" && published ? (
            <PublishedPreview artifactUrl={published.artifact.access.url} />
          ) : (
            <PreviewPlaceholder stage={live.stage} />
          )}
        </aside>
      </div>
    </main>
  );
}

function Published({
  sessionId,
  artifactUrl,
  copyState,
  onCopy,
}: {
  sessionId: string;
  artifactUrl: string;
  copyState: CopyState;
  onCopy: (artifactUrl: string) => void;
}) {
  return (
    <section className="flex h-full flex-col space-y-4 text-foreground">
      <div className="group flex w-full items-center gap-3 rounded-md border border-input bg-input-background px-3 py-2.5 text-sm text-foreground transition hover:border-ring focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/35">
        <input
          readOnly
          value={artifactUrl}
          className="min-w-0 flex-1 bg-transparent font-mono text-foreground outline-none"
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          onClick={() => onCopy(artifactUrl)}
          className="shrink-0 text-xs font-semibold text-muted-foreground opacity-70 transition hover:text-foreground hover:opacity-100 group-hover:text-foreground group-hover:opacity-100 focus:text-foreground focus:opacity-100 focus:outline-none"
        >
          {copyState === "copied"
            ? "Copied"
            : copyState === "error"
              ? "Copy failed"
              : "Copy"}
        </button>
      </div>
      <a
        href={artifactUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-md bg-success px-4 py-2 text-sm font-semibold text-success-foreground transition hover:bg-success/90"
      >
        View in new tab
      </a>
      <p className="text-xs text-muted-foreground">
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
    <section className="space-y-4 text-card-foreground">
      {b.summary ? (
        <p className="text-base leading-7">{b.summary}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">No summary yet.</p>
      )}
      {b.goals.length > 0 ? (
        <div>
          <h3 className="font-display-label text-xs uppercase tracking-wider text-muted-foreground mb-1">
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
          <h3 className="font-display-label text-xs uppercase tracking-wider text-muted-foreground mb-1">
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
    <section className="space-y-4 text-foreground">
      <p className="text-sm leading-6 text-muted-foreground">
        A few details would make the page brief stronger before design begins.
      </p>
      <Form method="post" className="space-y-4">
        {questions.map((q, i) => (
          <div key={i} className="space-y-2">
            <label className="block text-sm font-medium">{q}</label>
            <input
              name={q}
              type="text"
              disabled={submitting}
              placeholder="Type your answer here"
              className="w-full rounded-lg border border-input bg-input-background px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/35"
            />
          </div>
        ))}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Send answers"}
        </button>
      </Form>
    </section>
  );
}

function ClarificationSkeleton({
  progress,
  title = "Thinking about your answers",
}: {
  progress: ProgressState | null;
  title?: string;
}) {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d % 3) + 1);
    }, 400);
    return () => clearInterval(id);
  }, []);

  const label = phaseLabel(progress?.phase ?? null);
  const ellipsis = ".".repeat(dots);

  return (
    <section className="space-y-3 text-foreground">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="text-base text-foreground">
        {label}
        {ellipsis}
      </p>
      <div className="space-y-2 pt-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-warning/25" />
        <div className="h-9 w-full animate-pulse rounded bg-warning/20" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-warning/25" />
        <div className="h-9 w-full animate-pulse rounded bg-warning/20" />
      </div>
    </section>
  );
}

function InitialSubmitError({ message }: { message: string }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-destructive">Brief did not start</h2>
      <p className="text-sm text-foreground">{message}</p>
    </section>
  );
}

function PreviewDecision({
  targetPreviewId,
  submitting,
  error,
}: {
  targetPreviewId: string;
  submitting: boolean;
  error: string | null | undefined;
}) {
  return (
    <section className="flex h-full flex-col space-y-4 text-foreground">
      <p className="text-sm leading-6 text-muted-foreground">
        Preview {targetPreviewId} is ready in the preview pane. Approve it or
        leave one revision note per line.
      </p>
      <Form method="post" className="space-y-3">
        <div className="space-y-2">
          <label htmlFor="notes" className="block text-sm font-medium">
            Notes (one per line)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            disabled={submitting}
            placeholder="Increase contrast on the hero button; make the headline warmer"
            className="w-full resize-none rounded-[6px] border border-input bg-input-background p-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/35"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            name="action"
            value="revise"
            disabled={submitting}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50"
          >
            {submitting ? "Sending..." : "Revise"}
          </button>
          <button
            type="submit"
            name="action"
            value="approve"
            disabled={submitting}
            className="rounded-md bg-success px-4 py-2 text-sm font-semibold text-success-foreground transition hover:bg-success/90 disabled:opacity-50"
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
    <section className="text-foreground">
      <h2 className="text-sm font-medium">Ready to design</h2>
      <p className="text-sm mt-1">
        The brief is good enough to start designing. Preview generation arrives
        in the next slice.
      </p>
    </section>
  );
}

type MessageTone = "neutral" | "warning" | "danger" | "info" | "success";

function ChatMessage({
  eyebrow,
  tone,
  children,
  fill = false,
  square = false,
  transparent = false,
}: {
  eyebrow: string;
  tone: MessageTone;
  children: React.ReactNode;
  fill?: boolean;
  square?: boolean;
  transparent?: boolean;
}) {
  const toneClass = transparent
    ? "border-border bg-transparent shadow-none"
    : {
        neutral: "border-border bg-card",
        warning: "border-warning/35 bg-warning/10",
        danger: "border-destructive/35 bg-destructive/10",
        info: "border-info/35 bg-info/10",
        success: "border-success/35 bg-success/10",
      }[tone];
  const layoutClass = fill ? "flex flex-1 flex-col" : "";
  const radiusClass = square ? "" : "rounded-lg";

  return (
    <article className={`space-y-3 border p-4 shadow-soft ${radiusClass} ${layoutClass} ${toneClass}`}>
      <p className="font-display-label text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {eyebrow}
      </p>
      {children}
    </article>
  );
}

function PreviewPane({
  sessionId,
  targetPreviewId,
  artifactId,
}: {
  sessionId: string;
  targetPreviewId: string;
  artifactId: string | null;
}) {
  const url = artifactId ? `/artifacts/${sessionId}/${artifactId}` : null;
  return (
    <section className="flex min-h-full flex-1 flex-col">
      <div className="flex min-h-24 items-center border-b border-border px-5 py-4 sm:px-6">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="font-display-label text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
              live preview
            </p>
            <h2 className="mt-2 font-body text-2xl font-light tracking-tight">
              Preview {targetPreviewId}
            </h2>
          </div>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="w-fit rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-ring"
            >
              Open in new tab
            </a>
          ) : null}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {url ? (
          <iframe
            src={url}
            sandbox=""
            title={`preview ${targetPreviewId}`}
            className="h-full min-h-[34rem] w-full flex-1 border-none bg-card"
          />
        ) : (
          <div className="flex min-h-[28rem] flex-1 items-center justify-center text-center text-muted-foreground">
            No artifact is attached to this preview yet.
          </div>
        )}
      </div>
    </section>
  );
}

function PublishedPreview({ artifactUrl }: { artifactUrl: string }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="max-w-md space-y-4 rounded-lg border border-success/35 bg-success/10 p-8 shadow-soft">
        <p className="font-display-label text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
          published page
        </p>
        <h2 className="font-body text-4xl font-light tracking-tight">
          Your page is live.
        </h2>
        <p className="break-all font-mono text-sm text-muted-foreground">
          {artifactUrl}
        </p>
        <a
          href={artifactUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-md bg-success px-5 py-3 text-sm font-semibold text-success-foreground transition hover:bg-success/90"
        >
          View published page
        </a>
      </div>
    </section>
  );
}

function PreviewPlaceholder({ stage }: { stage: string }) {
  return (
    <section className="flex flex-1 flex-col">
      <div className="flex min-h-24 items-center border-b border-border px-5 py-4 sm:px-6">
        <div>
          <p className="font-display-label text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            preview workspace
          </p>
          <h2 className="mt-2 font-body text-2xl font-light tracking-tight">
            The canvas will appear here.
          </h2>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-xl text-center">
          <p className="font-display-label text-sm uppercase tracking-[0.2em] text-muted-foreground">
            current stage: {stage}
          </p>
          <div className="mx-auto mt-8 grid max-w-sm gap-3 text-left">
            <div className="h-5 w-3/4 rounded-md bg-muted" />
            <div className="h-24 rounded-lg bg-muted" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-20 rounded-lg bg-muted" />
              <div className="h-20 rounded-lg bg-muted" />
            </div>
          </div>
          <p className="mt-8 text-sm leading-6 text-muted-foreground">
            Keep answering on the left. Generated previews and published pages
            stay anchored here for review.
          </p>
        </div>
      </div>
    </section>
  );
}
