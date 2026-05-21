import type { Route } from "./+types/api.sessions.$id.thread";
import { getSession } from "../lib/sessions.server";
import { getGraph } from "../lib/graph.server";

export async function loader({ params }: Route.LoaderArgs) {
  const session = await getSession(params.id);
  if (!session) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }

  const graph = await getGraph();
  const config = { configurable: { thread_id: session.session_id } };
  const state = await graph.getState(config);

  return Response.json({
    session_id: session.session_id,
    values: state.values,
    next: state.next,
    checkpoint_id: state.config.configurable?.checkpoint_id ?? null,
  });
}
