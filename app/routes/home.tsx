import { redirect, Form, useNavigation } from "react-router";
import type { Route } from "./+types/home";
import { createSession } from "@sessions";
import { requireAuth } from "@auth";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "fabrique" },
    { name: "description", content: "A workshop for making web pages." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  requireAuth(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  requireAuth(request);
  const form = await request.formData();
  const raw_input = String(form.get("raw_input") ?? "").trim();
  if (raw_input === "") {
    return { error: "Please describe the page you want to make." };
  }

  const session = await createSession();
  const params = new URLSearchParams({ initial_brief: raw_input });
  return redirect(`/s/${session.session_id}?${params.toString()}`);
}

export default function Home({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="max-w-xl w-full space-y-6">
        <div className="flex justify-end">
          <form action="/logout" method="post">
            <button
              type="submit"
              className="text-xs text-gray-500 underline"
            >
              Sign out
            </button>
          </form>
        </div>
        <header className="space-y-2">
          <h1 className="text-4xl font-light tracking-tight">fabrique</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Describe the page you want to make. We&apos;ll ask if anything
            isn&apos;t clear.
          </p>
        </header>

        <Form method="post" className="space-y-4">
          <textarea
            name="raw_input"
            rows={6}
            required
            placeholder="A landing page for my friend's bakery in Brooklyn..."
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-base font-normal focus:outline-none focus:ring-2 focus:ring-gray-400"
            disabled={submitting}
          />
          {actionData?.error ? (
            <p className="text-sm text-red-600">{actionData.error}</p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Working..." : "Start"}
          </button>
        </Form>
      </div>
    </main>
  );
}
