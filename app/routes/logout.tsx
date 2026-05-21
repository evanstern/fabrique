import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { buildClearAuthCookieHeader } from "../lib/auth.server";

export async function loader() {
  return new Response("method not allowed", { status: 405 });
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  return redirect("/login", {
    headers: { "Set-Cookie": buildClearAuthCookieHeader() },
  });
}
