import type { Route } from "./+types/api.sessions.$id.tick";
import { getSession } from "../lib/sessions.server";
import { getGraph } from "../lib/graph.server";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }

  const session = await getSession(params.id);
  if (!session) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }

  const graph = await getGraph();
  const config = { configurable: { thread_id: session.session_id } };
  const result = await graph.invoke({ session_id: session.session_id }, config);

  return Response.json({
    session_id: session.session_id,
    ticks: result.ticks,
  });
}
