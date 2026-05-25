import type { Route } from "./+types/api.sessions.$id";

export async function loader({ request, params }: Route.LoaderArgs) {
  const [{ getSession }, { getPendingInterrupt }, { requireAuth }] =
    await Promise.all([import("@sessions"), import("@graph"), import("@auth")]);
  requireAuth(request, { api: true });
  const session = await getSession(params.id);
  if (!session) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }
  const interrupt = await getPendingInterrupt(params.id);
  return Response.json({ ...session, interrupt });
}
