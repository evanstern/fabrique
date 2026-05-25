import { redirect } from "react-router";
import type { Route } from "./+types/login";
import {
  buildAuthCookieHeader,
  checkLoginRateLimit,
  constantTimePasswordMatch,
  getClientIp,
  sanitizeNext,
  signAuthCookie,
} from "@auth";

export function meta() {
  return [{ title: "fabrique — sign in" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error") === "1";
  const next = sanitizeNext(url.searchParams.get("next"));
  return { error, next };
}

export async function action({ request }: Route.ActionArgs) {
  const ip = getClientIp(request);
  if (!checkLoginRateLimit(ip)) {
    return new Response("too many attempts; try again in a minute", {
      status: 429,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = sanitizeNext(String(form.get("next") ?? "/"));

  if (!constantTimePasswordMatch(password)) {
    return redirect("/login?error=1");
  }

  return redirect(next, {
    headers: { "Set-Cookie": buildAuthCookieHeader(signAuthCookie()) },
  });
}

export default function Login({ loaderData }: Route.ComponentProps) {
  const { error, next } = loaderData;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12 text-foreground">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-panel">
        <div className="border-b border-border bg-panel px-8 py-7 text-panel-foreground">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            private workshop
          </p>
          <h1 className="mt-3 font-serif text-5xl font-light tracking-tight">
            fabrique
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Sign in to continue shaping pages from brief to preview.
          </p>
        </div>
        <form method="post" className="space-y-5 p-8">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              placeholder="Enter the workshop password"
              className="w-full rounded-lg border border-input bg-input-background px-4 py-3 text-base text-foreground shadow-soft placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/35"
            />
          </div>
          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Wrong password.
            </p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
