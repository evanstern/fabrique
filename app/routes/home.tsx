import { redirect, Form, useNavigation } from "react-router";
import type { Route } from "./+types/home";
import {
  createSession,
  listSessionNavigationSummaries,
  setRawInput,
} from "@sessions";
import { requireAuth } from "@auth";
import { useThemeMode } from "~/lib/client/use-theme-mode";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "fabrique" },
    { name: "description", content: "A workshop for making web pages." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  requireAuth(request);
  const sessions = await listSessionNavigationSummaries();
  return { sessions };
}

export async function action({ request }: Route.ActionArgs) {
  requireAuth(request);
  const form = await request.formData();
  const raw_input = String(form.get("raw_input") ?? "").trim();
  if (raw_input === "") {
    return { error: "Please describe the page you want to make." };
  }

  const session = await createSession();
  await setRawInput(session.session_id, raw_input);
  const params = new URLSearchParams({ initial_brief: "1" });
  return redirect(`/s/${session.session_id}?${params.toString()}`);
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const { sessions } = loaderData;
  const { theme, toggleTheme } = useThemeMode();

  return (
    <main className="min-h-screen px-5 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <a href="/" className="font-brand text-2xl font-light tracking-tight">
            fabrique
          </a>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground transition hover:border-ring hover:text-foreground"
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <form action="/logout" method="post">
              <button
                type="submit"
                className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground transition hover:border-ring hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <section className="px-0 py-4 sm:py-6 lg:py-8">
            <header className="max-w-3xl space-y-5">
              <p className="font-display-label text-xs font-medium uppercase tracking-[0.26em] text-muted-foreground">
                page-making workspace
              </p>
              <h1 className="font-display-label text-2xl font-medium uppercase leading-snug tracking-[0.14em] sm:text-3xl">
                What page are we making today?
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Start with one thoughtful sentence about the page you want, and
                Fabrique will shape the brief from there.
              </p>
            </header>

            <Form method="post" className="mt-10 max-w-3xl space-y-4">
              <label htmlFor="raw_input" className="sr-only">
                What page are we making today?
              </label>
              <textarea
                id="raw_input"
                name="raw_input"
                rows={7}
                required
                placeholder="A launch page for my friend's Brooklyn bakery: warm, editorial, one clear catering inquiry button..."
                className="min-h-40 w-full resize-none rounded-2xl border border-input bg-input-background px-5 py-4 text-base leading-7 text-foreground shadow-soft transition placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                disabled={submitting}
              />
              {actionData?.error ? (
                <p className="px-2 text-sm text-destructive">
                  {actionData.error}
                </p>
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
          </section>

          <aside className="rounded-md border border-border bg-sidebar text-sidebar-foreground shadow-soft lg:sticky lg:top-8">
            <div className="border-b border-border px-5 py-4">
              <p className="font-display-label text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                recent sessions
              </p>
              <h2 className="mt-2 font-body text-2xl font-light tracking-tight">
                Return to a page
              </h2>
            </div>

            {sessions.length > 0 ? (
              <nav aria-label="Recent sessions" className="divide-y divide-border">
                {sessions.map((session) => {
                  const briefText =
                    session.brief.summary ||
                    session.brief.raw_input ||
                    "Untitled page-making session";
                  const preview =
                    briefText.length > 96
                      ? `${briefText.slice(0, 93)}...`
                      : briefText;

                  return (
                    <a
                      key={session.session_id}
                      href={`/s/${session.session_id}`}
                      className="block px-5 py-4 transition hover:bg-card focus:bg-card"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate font-mono text-xs text-muted-foreground">
                          {session.session_id}
                        </span>
                        <span className="shrink-0 rounded-md border border-border bg-card px-2 py-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          {session.stage}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-sidebar-foreground">
                        {preview}
                      </p>
                    </a>
                  );
                })}
              </nav>
            ) : (
              <div className="px-5 py-8 text-sm leading-6 text-muted-foreground">
                <p>No sessions yet.</p>
                <p className="mt-2">
                  Start with the brief form, and your page-making sessions will
                  appear here for quick return visits.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
