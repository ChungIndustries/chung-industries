/** The `cpm` client's commands, mirrored from apps/cpm-cli/README.md. */
const COMMANDS: [subcommand: string, args: string, what: string][] = [
  ["install", "<name>[@<version|range|tag>]", "Install packages and their dependencies"],
  ["remove", "<name>", "Uninstall packages"],
  ["update", "[<name>]", "Re-resolve and update installed packages"],
  ["list", "", "Show what is installed on this computer"],
  ["search", "[<query>]", "Find packages in the registry"],
];

export function CommandsTable() {
  return (
    <dl className="divide-border border-border divide-y border-y">
      {COMMANDS.map(([subcommand, args, what]) => (
        <div
          key={subcommand}
          className="grid gap-x-8 gap-y-1 py-3 sm:grid-cols-[minmax(0,24rem)_1fr]"
        >
          <dt className="[scrollbar-width:thin] overflow-x-auto font-mono text-[13px] font-medium whitespace-nowrap">
            <span className="text-brand">cpm</span> {subcommand}
            {args && <span className="text-muted-foreground"> {args}</span>}
          </dt>
          <dd className="text-muted-foreground text-sm">{what}</dd>
        </div>
      ))}
    </dl>
  );
}
