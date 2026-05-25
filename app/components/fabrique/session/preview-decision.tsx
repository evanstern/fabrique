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
