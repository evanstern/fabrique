export function InitialSubmitError({ message }: { message: string }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-destructive">Brief did not start</h2>
      <p className="text-sm text-foreground">{message}</p>
    </section>
  );
}
