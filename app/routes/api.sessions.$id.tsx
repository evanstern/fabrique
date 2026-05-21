import type { Route } from "./+types/api.sessions.$id";
import { getSession } from "../lib/sessions.server";
import { getPendingInterrupt } from "../lib/graph.server";

export async function loader({ params }: Route.LoaderArgs) {
  const session = await getSession(params.id);
  if (!session) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }
  const interrupt = await getPendingInterrupt(params.id);
  return Response.json({ ...session, interrupt });
}
