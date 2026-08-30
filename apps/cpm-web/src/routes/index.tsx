import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { CommandBlock } from "@/cli/components/command-block";
import { CommandsTable } from "@/cli/components/commands-table";
import { Terminal } from "@/cli/components/terminal";
import { DOCS_URL, INSTALL_COMMAND } from "@/site";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function HeroSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  return (
    <form
      action="/packages"
      className="mx-auto mt-8 flex max-w-xl gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void navigate({ to: "/packages", search: query ? { q: query } : {} });
      }}
    >
      <div className="relative flex-1">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search packages"
          aria-label="Search packages"
          className="bg-card h-12 pl-10 !text-base"
        />
      </div>
      <Button type="submit" size="lg" className="h-12 px-6">
        Search
      </Button>
    </form>
  );
}

function Step({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="bg-brand/15 text-brand font-display grid size-8 shrink-0 place-items-center rounded-md pt-0.5 text-sm">
        {number}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <h3 className="pt-1 font-medium">{title}</h3>
        {children}
      </div>
    </li>
  );
}

function LandingPage() {
  return (
    <>
      <section className="border-border border-b bg-[radial-gradient(65%_90%_at_50%_0%,oklch(0.82_0.145_79/0.09),transparent_70%)]">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center md:py-28">
          <h1 className="text-4xl font-bold tracking-tight text-balance md:text-5xl">
            The ComputerCraft package manager
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg text-balance">
            Lua packages, programs, and their dependencies for CC:Tweaked computers, one in-game
            command away.
          </p>
          <HeroSearch />
          <p className="text-muted-foreground mt-5 text-sm">
            New computer?{" "}
            <a href="#get-started" className="text-brand font-medium hover:underline">
              Install cpm in one command
            </a>
          </p>
        </div>
      </section>

      <section id="get-started" className="mx-auto max-w-5xl scroll-mt-20 px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Get started</h2>
            <ol className="mt-6 space-y-6">
              <Step number="1" title="Craft a computer">
                <p className="text-muted-foreground text-sm">
                  Any CC:Tweaked computer in an HTTP-enabled world works; advanced computers
                  recommended for the colours.
                </p>
              </Step>
              <Step number="2" title="Bootstrap cpm">
                <p className="text-muted-foreground text-sm">
                  Run the installer straight off the registry:
                </p>
                <CommandBlock command={INSTALL_COMMAND} className="text-xs" />
              </Step>
              <Step number="3" title="Install packages">
                <p className="text-muted-foreground text-sm">
                  Grab anything from the{" "}
                  <Link to="/packages" className="text-brand font-medium hover:underline">
                    package index
                  </Link>
                  :
                </p>
                <CommandBlock command="cpm install <name>" className="text-xs" />
              </Step>
            </ol>
          </div>
          <Terminal />
        </div>
      </section>

      <section className="border-border border-t">
        <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">Commands</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Everything the in-game client can do; the{" "}
            <a href={DOCS_URL} className="text-brand font-medium hover:underline">
              registry API docs
            </a>{" "}
            cover the rest.
          </p>
          <div className="mt-6">
            <CommandsTable />
          </div>
        </div>
      </section>
    </>
  );
}
