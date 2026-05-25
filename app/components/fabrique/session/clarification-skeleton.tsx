import { useEffect, useState } from "react";
import { phaseLabel, type ProgressState } from "~/lib/client/session-progress";

export function ClarificationSkeleton({
  progress,
  title = "Thinking about your answers",
}: {
  progress: ProgressState | null;
  title?: string;
}) {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d % 3) + 1);
    }, 400);
    return () => clearInterval(id);
  }, []);

  const label = phaseLabel(progress?.phase ?? null);
  const ellipsis = ".".repeat(dots);

  return (
    <section className="space-y-3 text-foreground">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="text-base text-foreground">
        {label}
        {ellipsis}
      </p>
      <div className="space-y-2 pt-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-warning/25" />
        <div className="h-9 w-full animate-pulse rounded bg-warning/20" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-warning/25" />
        <div className="h-9 w-full animate-pulse rounded bg-warning/20" />
      </div>
    </section>
  );
}
