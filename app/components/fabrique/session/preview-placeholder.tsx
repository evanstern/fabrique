export function PreviewPlaceholder({ stage }: { stage: string }) {
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
