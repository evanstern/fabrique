import { useNavigation } from "react-router";
import type { Route } from "./+types/session";
import { Command } from "@langchain/langgraph";
import {
  appendClarification,
  getPublishedPreview,
  getSession,
  setRawInput,
} from "@sessions";
import { getGraph, getPendingInterrupt } from "@graph";
import { nextSequentialId } from "@records";
import { publishSnapshot } from "@stream";
import { requireAuth } from "@auth";
import { Brief } from "~/components/fabrique/session/brief";
import { ChatMessage } from "~/components/fabrique/session/chat-message";
import { Clarification } from "~/components/fabrique/session/clarification";
import { ClarificationSkeleton } from "~/components/fabrique/session/clarification-skeleton";
import { InitialSubmitError } from "~/components/fabrique/session/initial-submit-error";
import { PreviewDecision } from "~/components/fabrique/session/preview-decision";
import { PreviewPane } from "~/components/fabrique/session/preview-pane";
import { PreviewPlaceholder } from "~/components/fabrique/session/preview-placeholder";
import { Published } from "~/components/fabrique/session/published";
import { PublishedPreview } from "~/components/fabrique/session/published-preview";
import { ReadyForDesign } from "~/components/fabrique/session/ready-for-design";
import { useCopyState } from "~/lib/client/use-copy-state";
import { useInitialBriefSubmit } from "~/lib/client/use-initial-brief-submit";
import { useLiveSession } from "~/lib/client/use-live-session";
import { useThemeMode } from "~/lib/client/use-theme-mode";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `fabrique — ${params.id}` }];
}

function formatClarificationAnswers(answers: Record<string, string>): string {
  return Object.entries(answers)
    .flatMap(([question, answer]) => [`Q: ${question}`, `A: ${answer}`, ``])
    .join("\n")
    .trimEnd();
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
    shouldStartInitialBrief: url.searchParams.has("initial_brief"),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  requireAuth(request);
  const session = await getSession(params.id);
  if (!session) {
    throw new Response("session not found", { status: 404 });
  }
  const pending = await getPendingInterrupt(params.id);
  const form = await request.formData();
  const graph = await getGraph();

  const action = String(form.get("action") ?? "");
  if (action === "retry_brief") {
    const raw_input = session.brief.raw_input.trim();
    if (session.stage !== "briefing") {
      return { error: `cannot retry brief in stage '${session.stage}'` };
    }
    if (raw_input === "") {
      return { error: "There is no brief to retry." };
    }
    await graph.invoke(
      { session_id: session.session_id, raw_input },
      { configurable: { thread_id: session.session_id } },
    );
    await publishSnapshot(params.id);
    return { ok: true };
  }

  if (
    session.stage === "briefing" &&
    session.brief.open_questions.length > 0 &&
    !pending
  ) {
    const answers: Record<string, string> = {};
    for (const question of session.brief.open_questions) {
      const value = String(form.get(question) ?? "").trim();
      if (value !== "") answers[question] = value;
    }
    if (Object.keys(answers).length === 0) {
      return { error: "Please answer at least one question." };
    }

    const raw_input = `${session.brief.raw_input}\n\n${formatClarificationAnswers(answers)}`;
    await appendClarification(session.session_id, {
      clarification_id: nextSequentialId(
        "clarification",
        session.records.clarifications?.length ?? 0,
      ),
      context: "brief",
      questions: session.brief.open_questions,
      answers,
      created_at: new Date(),
    });
    await setRawInput(session.session_id, raw_input);
    await graph.invoke(
      { session_id: session.session_id, raw_input },
      { configurable: { thread_id: session.session_id } },
    );
    await publishSnapshot(params.id);
    return { ok: true };
  }

  if (!pending) {
    return { error: "Nothing is pending input right now." };
  }

  if (pending.kind === "answer_clarification") {
    const answers: Record<string, string> = {};
    for (const q of pending.questions) {
      const v = String(form.get(q) ?? "").trim();
      if (v !== "") answers[q] = v;
    }
    if (Object.keys(answers).length === 0) {
      return { error: "Please answer at least one question." };
    }
    await appendClarification(session.session_id, {
      clarification_id: nextSequentialId(
        "clarification",
        session.records.clarifications?.length ?? 0,
      ),
      context: liveStageForPending(session.stage, pending.kind),
      questions: pending.questions,
      answers,
      created_at: new Date(),
    });
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

function liveStageForPending(
  stage: string,
  kind: "answer_clarification" | "review_preview",
): "brief" | "revision" {
  return stage === "preview_ready" && kind === "answer_clarification"
    ? "revision"
    : "brief";
}


export default function SessionPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { session, interrupt: initialInterrupt, published, shouldStartInitialBrief } =
    loaderData;
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const reviewAction = navigation.formData?.get("action");

  const { live, progress, setProgress } = useLiveSession({
    session,
    initialInterrupt,
    submitting,
  });
  const initialSubmitState = useInitialBriefSubmit({
    shouldStartInitialBrief,
    sessionId: session.session_id,
    setProgress,
  });
  const { copyState, copyText: copyTextToClipboard } = useCopyState();
  const { copyState: publishedCopyState, copyText: copyPublishedToClipboard } =
    useCopyState();
  const { theme, toggleTheme } = useThemeMode();

  const showingInitialProgress =
    initialSubmitState.status === "submitting" && !live.interrupt;
  const previewInterrupt =
    live.stage === "preview_ready" &&
    live.interrupt &&
    live.interrupt.kind === "review_preview"
      ? live.interrupt
      : null;
  const latestPreview = live.records.previews.at(-1) ?? null;
  const previewArtifactId = latestPreview?.artifact_id ?? null;
  const activePreviewId = previewInterrupt?.target_preview_id ?? latestPreview?.preview_id ?? null;
  const liveSession = {
    ...session,
    name: live.name,
    stage: live.stage,
    brief: live.brief,
    records: live.records,
  };
  const hasStructuredBrief =
    live.brief.summary.trim() !== "" ||
    live.brief.goals.length > 0 ||
    live.brief.constraints.length > 0 ||
    live.brief.open_questions.length > 0;
  const waitingForBriefProcessing =
    live.stage === "briefing" &&
    live.brief.raw_input.trim() !== "" &&
    !hasStructuredBrief &&
    !live.interrupt &&
    initialSubmitState.status !== "error";
  const showBriefStartRecovery =
    waitingForBriefProcessing && initialSubmitState.status !== "submitting";
  const fallbackQuestions =
    live.stage === "briefing" &&
    !live.interrupt &&
    live.brief.open_questions.length > 0
      ? live.brief.open_questions
      : null;
  const submittingRevision =
    submitting && previewInterrupt !== null && reviewAction === "revise";

  function copyCurrentUrl() {
    if (typeof window === "undefined") return;
    void copyTextToClipboard(window.location.href);
  }

  function copyPublishedUrl(artifactUrl: string) {
    void copyPublishedToClipboard(artifactUrl);
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
          <a
            href={`/s/${session.session_id}/snapshots`}
            className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-ring hover:text-foreground"
          >
            State
          </a>
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
                  {live.name}
                </h1>
                {live.name !== session.session_id ? (
                  <p className="max-w-sm truncate font-mono text-xs text-muted-foreground">
                    {session.session_id}
                  </p>
                ) : null}
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
              <Brief session={liveSession} />
            </ChatMessage>

            {showingInitialProgress ? (
              <ChatMessage eyebrow="Fabrique" tone="warning" square>
                <ClarificationSkeleton
                  progress={progress}
                  title="Starting your brief"
                />
              </ChatMessage>
            ) : null}

            {showBriefStartRecovery ? (
              <ChatMessage eyebrow="Needs attention" tone="danger">
                <section className="space-y-3">
                  <h2 className="text-sm font-medium text-destructive">
                    Brief did not finish starting
                  </h2>
                  <p className="text-sm leading-6 text-foreground">
                    The brief text was saved, but no workflow checkpoint was
                    created. The model call may have failed or the server may
                    have reloaded while it was starting.
                  </p>
                  <form method="post">
                    <button
                      type="submit"
                      name="action"
                      value="retry_brief"
                      className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90"
                    >
                      Retry brief processing
                    </button>
                  </form>
                </section>
              </ChatMessage>
            ) : null}

            {initialSubmitState.status === "error" ? (
              <ChatMessage eyebrow="Needs attention" tone="danger">
                <InitialSubmitError message={initialSubmitState.message} />
              </ChatMessage>
            ) : null}

            {live.interrupt && live.interrupt.kind === "answer_clarification" ? (
              <ChatMessage eyebrow="Clarification" tone="warning" square>
                {submitting ? (
                  <ClarificationSkeleton progress={progress} />
                ) : (
                  <Clarification
                    questions={live.interrupt.questions}
                    context={
                      live.stage === "preview_ready" ? "revision" : "brief"
                    }
                    submitting={submitting}
                    error={
                      actionData && "error" in actionData ? actionData.error : null
                    }
                  />
                )}
              </ChatMessage>
            ) : null}

            {fallbackQuestions ? (
              <ChatMessage eyebrow="Clarification" tone="warning" square>
                {submitting ? (
                  <ClarificationSkeleton progress={progress} />
                ) : (
                  <Clarification
                    questions={fallbackQuestions}
                    context="brief"
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
                {submittingRevision ? (
                  <ClarificationSkeleton
                    progress={progress}
                    title="Revising your preview"
                  />
                ) : (
                  <PreviewDecision
                    targetPreviewId={previewInterrupt.target_preview_id}
                    submitting={submitting}
                    error={
                      actionData && "error" in actionData ? actionData.error : null
                    }
                  />
                )}
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

            {!showingInitialProgress &&
            !waitingForBriefProcessing &&
            !live.interrupt &&
            !fallbackQuestions &&
            live.stage === "briefing" ? (
              <ChatMessage eyebrow="Next" tone="success">
                <ReadyForDesign />
              </ChatMessage>
            ) : null}
          </div>
        </section>

        <aside className="flex min-h-[32rem] flex-col bg-preview text-preview-foreground">
          {live.stage === "preview_ready" && activePreviewId ? (
            <PreviewPane
              sessionId={session.session_id}
              targetPreviewId={activePreviewId}
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
