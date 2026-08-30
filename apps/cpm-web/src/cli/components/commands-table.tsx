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
    <Table>
      <TableBody>
        {COMMANDS.map(([command, what]) => (
          <TableRow key={command}>
            <TableCell className="font-semibold whitespace-nowrap">
              <span className="text-primary select-none">&gt; </span>
              {command}
            </TableCell>
            <TableCell className="text-muted-foreground">{what}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
