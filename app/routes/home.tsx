import { redirect, Form, useNavigation } from "react-router";
import type { Route } from "./+types/home";
import { createSession } from "@sessions";
import { requireAuth } from "@auth";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "fabrique" },
    { name: "description", content: "A workshop for making web pages." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  requireAuth(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  requireAuth(request);
  const form = await request.formData();
  const raw_input = String(form.get("raw_input") ?? "").trim();
  if (raw_input === "") {
    return { error: "Please describe the page you want to make." };
  }

  const session = await createSession();
  const params = new URLSearchParams({ initial_brief: raw_input });
  return redirect(`/s/${session.session_id}?${params.toString()}`);
}

export default function Home({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="w-full max-w-4xl">
        <div className="mb-10 flex items-center justify-between">
          <a href="/" className="font-serif text-2xl font-light tracking-tight">
            fabrique
          </a>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground transition hover:border-ring hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>

        <header className="mx-auto max-w-3xl space-y-5 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.26em] text-muted-foreground">
            page-making workspace
          </p>
          <h1 className="font-serif text-5xl font-light leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            What page are we making today?
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Start with one thoughtful sentence about the page you want, and
            Fabrique will shape the brief from there.
          </p>
        </header>

        <Form
          method="post"
          className="mx-auto mt-10 max-w-3xl space-y-4"
        >
          <textarea
            name="raw_input"
            rows={7}
            required
            placeholder="A launch page for my friend's Brooklyn bakery: warm, editorial, one clear catering inquiry button..."
            className="min-h-40 w-full resize-none rounded-2xl border border-input bg-input-background px-5 py-4 text-base leading-7 text-foreground shadow-soft transition placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            disabled={submitting}
          />
          {actionData?.error ? (
            <p className="px-2 text-sm text-destructive">{actionData.error}</p>
          ) : null}
          <div className="flex justify-end px-1 pb-1">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "Starting..." : "Start a session"}
            </button>
          </div>
        </Form>
      </div>
    </main>
  );
}
