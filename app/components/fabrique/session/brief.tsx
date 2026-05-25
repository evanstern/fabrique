import type { Session } from "@sessions";

export function Brief({ session }: { session: Session }) {
  const b = session.brief;
  return (
    <section className="space-y-4 text-card-foreground">
      {b.summary ? (
        <p className="text-base leading-7">{b.summary}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">No summary yet.</p>
      )}
      {b.goals.length > 0 ? (
        <div>
          <h3 className="font-display-label text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Goals
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            {b.goals.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {b.constraints.length > 0 ? (
        <div>
          <h3 className="font-display-label text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Constraints
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            {b.constraints.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
