import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Route } from "./+types/artifacts.$session_id.$artifact_id";

function artifactsDir(): string {
  return process.env.ARTIFACTS_DIR ?? "./artifacts";
}

const artifactCsp = [
  // V1 generated pages are self-contained HTML and may include inline scripts.
  // Keep them in a sandboxed opaque origin so script can run without inheriting
  // Fabrique's origin, cookies, storage, or authenticated API access.
  "sandbox allow-scripts",
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "font-src data:",
  "connect-src 'none'",
  "media-src data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

export async function loader({ request, params }: Route.LoaderArgs) {
  const [{ getSession }, { requireAuth }] = await Promise.all([
    import("@sessions"),
    import("@auth"),
  ]);
  requireAuth(request, { api: true });
  const { session_id, artifact_id } = params;

  const session = await getSession(session_id);
  if (!session) {
    return new Response("not found", { status: 404 });
  }

  const record = session.records.artifacts.find(
    (a) => a.artifact_id === artifact_id,
  );
  if (!record) {
    return new Response("not found", { status: 404 });
  }

  const path = join(artifactsDir(), session_id, `${artifact_id}.html`);
  let html: string;
  try {
    html = await readFile(path, "utf8");
  } catch {
    return new Response("not found", { status: 404 });
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": artifactCsp,
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
