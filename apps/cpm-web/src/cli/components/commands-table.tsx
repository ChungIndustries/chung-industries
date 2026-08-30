import { Table, TableBody, TableCell, TableRow } from "@workspace/ui/components/table";

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
    <div className="border-border bg-card overflow-x-auto rounded-lg border">
      <Table>
        <TableBody>
          {COMMANDS.map(([command, what]) => (
            <TableRow key={command}>
              <TableCell className="px-4 py-3 font-mono text-[13px] whitespace-nowrap">
                {command}
              </TableCell>
              <TableCell className="text-muted-foreground px-4 py-3">{what}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
