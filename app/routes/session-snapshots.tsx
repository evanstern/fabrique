import { useState } from "react";
import type { Route } from "./+types/session-snapshots";
import { requireAuth } from "@auth";
import { getPendingInterrupt } from "@graph";
import { getPublishedPreview, getSession, type Session } from "@sessions";

type PointKind =
  | "session"
  | "preview"
  | "review"
  | "published"
  | "current";

type SnapshotPoint = {
  id: string;
  kind: PointKind;
  title: string;
  stage: Session["stage"];
  timestamp: string | null;
  sequence: number;
  summary: string;
  metadata: { label: string; value: string }[];
  details: unknown;
};

type SnapshotSummary = {
  artifacts: number;
  previews: number;
  reviews: number;
  hasInterrupt: boolean;
  hasPublishedPreview: boolean;
};

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `fabrique — ${params.id} state` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  requireAuth(request);
  const session = await getSession(params.id);
  if (!session) {
    throw new Response("session not found", { status: 404 });
  }

  const interrupt = await getPendingInterrupt(params.id);
  const published = getPublishedPreview(session);
  const points = buildSnapshotPoints(session, interrupt, published);
  const summary: SnapshotSummary = {
    artifacts: session.records.artifacts.length,
    previews: session.records.previews.length,
    reviews: session.records.reviews.length,
    hasInterrupt: interrupt !== null,
    hasPublishedPreview: published !== null,
  };

  return { session, interrupt, published, points, summary };
}

function buildSnapshotPoints(
  session: Session,
  interrupt: Awaited<ReturnType<typeof getPendingInterrupt>>,
  published: ReturnType<typeof getPublishedPreview>,
): SnapshotPoint[] {
  const artifactsById = new Map(
    session.records.artifacts.map((artifact) => [artifact.artifact_id, artifact]),
  );
  const points: SnapshotPoint[] = [
    {
      id: `${session.session_id}:session`,
      kind: "session",
      title: "Session document",
      stage: session.stage,
      timestamp: null,
      sequence: 0,
      summary: session.brief.summary
        ? session.brief.summary
        : session.brief.raw_input
          ? session.brief.raw_input
          : "Session exists, but no brief summary has been recorded yet.",
      metadata: [
        { label: "session", value: session.session_id },
        { label: "goals", value: String(session.brief.goals.length) },
        {
          label: "constraints",
          value: String(session.brief.constraints.length),
        },
        {
          label: "open questions",
          value: String(session.brief.open_questions.length),
        },
      ],
      details: {
        brief: session.brief,
        record_counts: recordCounts(session),
      },
    },
  ];

  session.records.previews.forEach((preview, index) => {
    const artifact = artifactsById.get(preview.artifact_id);
    points.push({
      id: `${session.session_id}:preview:${preview.preview_id}`,
      kind: "preview",
      title: `Preview ${preview.preview_id}`,
      stage: "preview_ready",
      timestamp: null,
      sequence: 100 + index,
      summary: artifact
        ? `Preview ${preview.preview_id} is linked to artifact ${artifact.artifact_id}.`
        : `Preview ${preview.preview_id} does not have a matching artifact record.`,
      metadata: [
        { label: "preview", value: preview.preview_id },
        { label: "artifact", value: preview.artifact_id },
        { label: "record order", value: String(index + 1) },
      ],
      details: { preview, artifact: artifact ?? null },
    });
  });

  session.records.reviews.forEach((review, index) => {
    const timestamp = normalizeTimestamp(review.created_at);
    points.push({
      id: `${session.session_id}:review:${review.review_id}`,
      kind: "review",
      title: `Review ${review.review_id}`,
      stage: review.action === "approve" ? "published" : "revising",
      timestamp,
      sequence: 200 + index,
      summary:
        review.action === "approve"
          ? `Approved preview ${review.target_preview_id}.`
          : `Requested revisions for preview ${review.target_preview_id}.`,
      metadata: [
        { label: "review", value: review.review_id },
        { label: "action", value: review.action },
        { label: "target", value: review.target_preview_id },
        { label: "notes", value: String(review.notes.length) },
      ],
      details: { review },
    });
  });

  if (published) {
    points.push({
      id: `${session.session_id}:published:${published.preview.preview_id}`,
      kind: "published",
      title: "Published preview",
      stage: "published",
      timestamp: null,
      sequence: 300,
      summary: `Published artifact ${published.artifact.artifact_id} from preview ${published.preview.preview_id}.`,
      metadata: [
        { label: "preview", value: published.preview.preview_id },
        { label: "artifact", value: published.artifact.artifact_id },
        { label: "url", value: published.artifact.access.url },
      ],
      details: published,
    });
  }

  points.push({
    id: `${session.session_id}:current`,
    kind: "current",
    title: "Current live state",
    stage: session.stage,
    timestamp: null,
    sequence: 400,
    summary: interrupt
      ? `Current stage is ${session.stage} with a pending ${interrupt.kind} interrupt.`
      : `Current stage is ${session.stage} with no pending interrupt.`,
    metadata: [
      { label: "stage", value: session.stage },
      { label: "interrupt", value: interrupt ? interrupt.kind : "none" },
      { label: "artifacts", value: String(session.records.artifacts.length) },
      { label: "previews", value: String(session.records.previews.length) },
      { label: "reviews", value: String(session.records.reviews.length) },
    ],
    details: {
      session_id: session.session_id,
      stage: session.stage,
      records: session.records,
      interrupt,
    },
  });

  return points.sort(compareSnapshotPoints);
}

function compareSnapshotPoints(a: SnapshotPoint, b: SnapshotPoint): number {
  if (a.timestamp && b.timestamp) {
    const byTime = Date.parse(a.timestamp) - Date.parse(b.timestamp);
    if (byTime !== 0) return byTime;
  }
  return a.sequence - b.sequence;
}

function normalizeTimestamp(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function recordCounts(session: Session) {
  return {
    artifacts: session.records.artifacts.length,
    previews: session.records.previews.length,
    reviews: session.records.reviews.length,
  };
}

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return "timestamp unavailable";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString();
}

function pointTone(kind: PointKind): string {
  return {
    session: "border-border bg-card",
    preview: "border-info/35 bg-info/10",
    review: "border-warning/35 bg-warning/10",
    published: "border-success/35 bg-success/10",
    current: "border-accent/35 bg-accent/10",
  }[kind];
}

function jsonDetails(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export default function SessionSnapshotsPage({
  loaderData,
}: Route.ComponentProps) {
  const { session, points, summary } = loaderData;

  return (
    <main className="min-h-screen bg-background px-5 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-border bg-panel p-5 shadow-soft sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-3">
              <p className="font-display-label text-xs font-medium uppercase tracking-[0.26em] text-muted-foreground">
                session state viewer
              </p>
              <h1 className="break-all font-mono text-xl font-medium tracking-tight sm:text-2xl">
                {session.session_id}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                Read-only timeline derived from durable session records plus the
                current pending interrupt. Historical arbitrary snapshots are not
                persisted yet, so preview records without timestamps keep their
                record order.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <a
                href={`/s/${session.session_id}`}
                className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-ring hover:text-foreground"
              >
                Back to session
              </a>
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
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard label="Current stage" value={session.stage} />
          <SummaryCard label="Artifacts" value={String(summary.artifacts)} />
          <SummaryCard label="Previews" value={String(summary.previews)} />
          <SummaryCard label="Reviews" value={String(summary.reviews)} />
          <SummaryCard
            label="Interrupt"
            value={summary.hasInterrupt ? "pending" : "none"}
          />
        </section>

        {points.length > 0 ? (
          <section className="space-y-4">
            {points.map((point, index) => (
              <SnapshotCard key={point.id} point={point} index={index} />
            ))}
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
            <h2 className="font-body text-2xl font-light tracking-tight">
              No state points yet.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This session has no durable records and no current snapshot details
              available to show.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <p className="font-display-label text-[0.68rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 break-all font-mono text-sm text-foreground">{value}</p>
    </article>
  );
}

function SnapshotCard({ point, index }: { point: SnapshotPoint; index: number }) {
  const [detailsJson, setDetailsJson] = useState<string | null>(null);

  return (
    <article className={`rounded-2xl border p-5 shadow-soft ${pointTone(point.kind)}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-background/70 px-2.5 py-1 font-mono text-xs text-muted-foreground">
              #{index + 1}
            </span>
            <span className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {point.kind}
            </span>
            <span className="rounded-full border border-border bg-background/70 px-2.5 py-1 font-mono text-xs text-muted-foreground">
              stage: {point.stage}
            </span>
          </div>
          <div>
            <h2 className="font-body text-2xl font-light tracking-tight">
              {point.title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {point.summary}
            </p>
          </div>
        </div>
        <time className="shrink-0 rounded-md border border-border bg-background/70 px-3 py-2 font-mono text-xs text-muted-foreground">
          {formatTimestamp(point.timestamp)}
        </time>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {point.metadata.map((item) => (
          <div
            key={`${point.id}:${item.label}`}
            className="rounded-lg border border-border bg-background/65 p-3"
          >
            <dt className="font-display-label text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {item.label}
            </dt>
            <dd className="mt-1 break-all font-mono text-xs text-foreground">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      <details
        className="mt-5 rounded-lg border border-border bg-background/75"
        onToggle={(event) => {
          if (event.currentTarget.open && detailsJson === null) {
            setDetailsJson(jsonDetails(point.details));
          }
        }}
      >
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground transition hover:text-foreground">
          Raw JSON details
        </summary>
        <pre className="overflow-x-auto border-t border-border p-4 text-xs leading-5 text-foreground">
          {detailsJson}
        </pre>
      </details>
    </article>
  );
}
