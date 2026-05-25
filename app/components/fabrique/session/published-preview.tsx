export function PublishedPreview({ artifactUrl }: { artifactUrl: string }) {
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
