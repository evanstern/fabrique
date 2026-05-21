import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "fabrique" },
    { name: "description", content: "A workshop for making web pages." },
  ];
}

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-4xl font-light tracking-tight">fabrique</h1>
        <p className="text-gray-600 dark:text-gray-400">
          A workshop for making web pages. Coming soon.
        </p>
      </div>
    </main>
  );
}
