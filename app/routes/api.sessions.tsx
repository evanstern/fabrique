import type { Route } from "./+types/api.sessions";
import { createSession } from "@sessions";
import { requireAuth } from "@auth";

export async function action({ request }: Route.ActionArgs) {
  requireAuth(request, { api: true });
  if (request.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }
  const session = await createSession();
  return Response.json({ session_id: session.session_id }, { status: 201 });
}
