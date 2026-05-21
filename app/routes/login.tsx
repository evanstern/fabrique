import { redirect } from "react-router";
import type { Route } from "./+types/login";
import {
  buildAuthCookieHeader,
  checkLoginRateLimit,
  constantTimePasswordMatch,
  getClientIp,
  sanitizeNext,
  signAuthCookie,
} from "../lib/auth.server";

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
    <main className="login-main">
      <div className="login-card">
        <h1>fabrique</h1>
        <p>Sign in to continue.</p>
        <form method="post">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
          />
          {error ? <p className="login-error">Wrong password.</p> : null}
          <button type="submit">Sign in</button>
        </form>
      </div>
    </main>
  );
}
