export function PackagesHead() {
  return (
    <div>
      <h1 className="font-display text-xl">Packages</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Everything in the cpm registry. Install any of these in-game with{" "}
        <code>cpm install &lt;name&gt;</code>.
      </p>
    </div>
  );
}
