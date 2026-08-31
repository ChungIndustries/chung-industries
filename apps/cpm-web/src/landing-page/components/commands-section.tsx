import { ArrowUpRight } from "lucide-react";

import { DOCS_URL } from "@/site";

/** The `cpm` client's commands, mirrored from apps/cpm-cli/README.md. */
const COMMANDS: [subcommand: string, args: string, what: string][] = [
  ["install", "<name>[@<version|range|tag>]", "Install packages and their dependencies"],
  ["remove", "<name>", "Uninstall packages"],
  ["update", "[<name>]", "Re-resolve and update installed packages"],
  ["list", "", "Show what is installed on this computer"],
  ["search", "[<query>]", "Find packages in the registry"],
];

function CommandsTable() {
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

export function CommandsSection() {
  return (
    <section id="commands" className="border-border scroll-mt-20 border-t">
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
          <CommandsTable />
        </div>
      </div>
    </section>
  );
}
