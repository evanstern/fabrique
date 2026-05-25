import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Route } from "./+types/artifacts.$session_id.$artifact_id";
import { getSession } from "@sessions";
import { requireAuth } from "@auth";

function artifactsDir(): string {
  return process.env.ARTIFACTS_DIR ?? "./artifacts";
}

export async function loader({ request, params }: Route.LoaderArgs) {
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
      "Content-Security-Policy": [
        "sandbox",
        "default-src 'none'",
        "style-src 'unsafe-inline'",
        "img-src data: https:",
        "font-src data: https:",
        "base-uri 'none'",
        "form-action 'none'",
      ].join("; "),
    },
  });
}
