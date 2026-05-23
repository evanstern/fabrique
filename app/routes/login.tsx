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
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-white dark:bg-gray-950">
      <div className="w-full max-w-sm space-y-6 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8">
        <div className="space-y-1 text-center">
          <h1 className="text-4xl font-light tracking-tight">fabrique</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sign in to continue.
          </p>
        </div>
        <form method="post" className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-xs uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-600">Wrong password.</p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 font-medium disabled:opacity-50"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
