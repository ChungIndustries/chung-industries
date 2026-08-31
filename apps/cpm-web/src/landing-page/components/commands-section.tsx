import { ArrowUpRight } from "lucide-react";

import { CommandsTable, type Command } from "@/landing-page/components/commands-table";
import { DOCS_URL } from "@/site";

/** The `cpm` client's commands, mirrored from apps/cpm-cli/README.md. */
const COMMANDS: Command[] = [
  ["install", "<name>[@<version|range|tag>]", "Install packages and their dependencies"],
  ["remove", "<name>", "Uninstall packages"],
  ["update", "[<name>]", "Re-resolve and update installed packages"],
  ["list", "", "Show what is installed on this computer"],
  ["search", "[<query>]", "Find packages in the registry"],
];

export function CommandsSection() {
  return (
    <section id="commands" className="scroll-mt-20">
      <div className="pixel-rule" aria-hidden="true" />
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="font-display text-xl">Commands</h2>
          <a
            href={DOCS_URL}
            className="text-brand inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            Registry API docs
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
        <div className="mt-6">
          <CommandsTable commands={COMMANDS} />
        </div>
      </div>
    </section>
  );
}
