import { Form } from "react-router";

export function Clarification({
  questions,
  context,
  submitting,
  error,
}: {
  questions: string[];
  context: "brief" | "revision";
  submitting: boolean;
  error: string | null | undefined;
}) {
  const intro =
    context === "revision"
      ? "A few details would help me apply this revision without guessing."
      : "A few details would make the page brief stronger before design begins.";

  return (
    <section className="space-y-4 text-foreground">
      <p className="text-sm leading-6 text-muted-foreground">{intro}</p>
      <Form method="post" className="space-y-4">
        {questions.map((q, i) => (
          <div key={i} className="space-y-2">
            <label className="block text-sm font-medium">{q}</label>
            <input
              name={q}
              type="text"
              disabled={submitting}
              placeholder="Type your answer here"
              className="w-full rounded-[6px] border border-input bg-input-background px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/35"
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
