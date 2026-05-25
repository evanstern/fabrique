export function PreviewPane({
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
              sandboxed preview
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
              Open exact artifact
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
