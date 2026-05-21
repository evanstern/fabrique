import type { Route } from "./+types/api.sessions.$id";
import { getSession } from "../lib/sessions.server";

export async function loader({ params }: Route.LoaderArgs) {
  const session = await getSession(params.id);
  if (!session) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }
  return Response.json(session);
}
