import { Form } from "react-router";

export function PreviewDecision({
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
        Preview {targetPreviewId} is ready in the preview pane. Leave one
        revision note per line, then send it back for another pass.
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
        <div>
          <button
            type="submit"
            name="action"
            value="revise"
            disabled={submitting}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50 sm:w-auto"
          >
            {submitting ? "Sending..." : "Revise"}
          </button>
        </div>
      </Form>

      <div className="mt-auto border-t border-border pt-4">
        <p className="text-xs leading-5 text-muted-foreground">
          Only approve when this preview is ready to publish. This skips another
          revision pass.
        </p>
        <Form method="post" className="mt-3">
          <button
            type="submit"
            name="action"
            value="approve"
            disabled={submitting}
            className="rounded-md border border-success/40 bg-transparent px-3 py-1.5 text-xs font-medium text-success transition hover:bg-success/10 disabled:opacity-50"
          >
            Approve and publish
          </button>
        </Form>
      </div>
    </section>
  );
}
