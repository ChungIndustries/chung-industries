import { Link } from "@tanstack/react-router";

export function DependenciesTab({ dependencies }: { dependencies: [string, string][] }) {
  if (dependencies.length === 0) {
    return <p className="text-muted-foreground text-sm">None: this package stands alone.</p>;
  }
  return (
    <ul className="divide-border divide-y">
      {dependencies.map(([dep, range]) => (
        <li key={dep} className="flex justify-between gap-3 py-2 text-sm">
          <Link
            to="/packages/$name"
            params={{ name: dep }}
            className="text-brand font-mono font-medium hover:underline"
          >
            {dep}
          </Link>
          <span className="text-muted-foreground font-mono">{range}</span>
        </li>
      ))}
    </ul>
  );
}
