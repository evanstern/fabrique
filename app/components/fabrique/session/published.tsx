import type { CopyState } from "~/lib/client/use-copy-state";

export function Published({
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
