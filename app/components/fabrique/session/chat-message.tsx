import type { ReactNode } from "react";

type MessageTone = "neutral" | "warning" | "danger" | "info" | "success";

export function ChatMessage({
  eyebrow,
  tone,
  children,
  fill = false,
  square = false,
  transparent = false,
}: {
  eyebrow: string;
  tone: MessageTone;
  children: ReactNode;
  fill?: boolean;
  square?: boolean;
  transparent?: boolean;
}) {
  const toneClass = transparent
    ? "border-border bg-transparent shadow-none"
    : {
        neutral: "border-border bg-card",
        warning: "border-warning/35 bg-warning/10",
        danger: "border-destructive/35 bg-destructive/10",
        info: "border-info/35 bg-info/10",
        success: "border-success/35 bg-success/10",
      }[tone];
  const layoutClass = fill ? "flex flex-1 flex-col" : "";
  const radiusClass = square ? "" : "rounded-lg";

  return (
    <article
      className={`space-y-3 border p-4 shadow-soft ${radiusClass} ${layoutClass} ${toneClass}`}
    >
      <p className="font-display-label text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {eyebrow}
      </p>
      {children}
    </article>
  );
}
