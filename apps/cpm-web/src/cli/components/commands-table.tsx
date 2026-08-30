/** The `cpm` client's commands, mirrored from apps/cpm-cli/README.md. */
const COMMANDS: [string, string][] = [
  ["cpm install <name>[@<version|range|tag>]", "Install packages and their dependencies"],
  ["cpm remove <name>", "Uninstall packages"],
  ["cpm update [<name>]", "Re-resolve and update installed packages"],
  ["cpm list", "Show what is installed on this computer"],
  ["cpm search [<query>]", "Find packages in the registry"],
];

export function CommandsTable() {
  return (
    <dl className="divide-border border-border divide-y border-y">
      {COMMANDS.map(([command, what]) => (
        <div key={command} className="grid gap-x-8 gap-y-1 py-3 sm:grid-cols-[minmax(0,24rem)_1fr]">
          <dt className="[scrollbar-width:thin] overflow-x-auto font-mono text-[13px] font-medium whitespace-nowrap">
            {command}
          </dt>
          <dd className="text-muted-foreground text-sm">{what}</dd>
        </div>
      ))}
    </dl>
  );
}
