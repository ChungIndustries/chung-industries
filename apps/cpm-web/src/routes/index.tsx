import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { Fragment, useState } from "react";

import { CommandBlock } from "@/cli/components/command-block";
import { CommandsTable } from "@/cli/components/commands-table";
import { Terminal } from "@/cli/components/terminal";
import { packagesQueryOptions } from "@/package/queries";
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
      className="mt-7 flex max-w-md gap-2"
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
          className="bg-card h-11 pl-10 !text-base"
        />
      </div>
      <Button type="submit" size="lg" className="h-11 px-5">
        Search
      </Button>
    </form>
  );
}

/**
 * A few real package names under the search bar. Fetched client-side so a
 * registry hiccup quietly hides the line instead of failing the landing page.
 */
function TryPackages() {
  const packages = useQuery(packagesQueryOptions);
  const names = (packages.data ?? []).slice(0, 3).map((pkg) => pkg.name);

  return (
    <p className="text-muted-foreground mt-4 h-5 text-sm">
      {names.length > 0 && (
        <>
          Try:{" "}
          {names.map((name, index) => (
            <Fragment key={name}>
              {index > 0 && <span aria-hidden="true"> · </span>}
              <Link
                to="/packages/$name"
                params={{ name }}
                className="text-brand font-mono hover:underline"
              >
                {name}
              </Link>
            </Fragment>
          ))}
        </>
      )}
    </p>
  );
}

function Step({ index, title, children }: { index: string; title: string; children: ReactNode }) {
  return (
    <div className="border-border space-y-2.5 border-t pt-5">
      <div className="text-brand font-mono text-xs">{index}</div>
      <h3 className="font-medium">{title}</h3>
      <div className="text-muted-foreground space-y-3 text-sm">{children}</div>
    </div>
  );
}

function LandingPage() {
  return (
    <>
      <section className="border-border border-b bg-[radial-gradient(50%_90%_at_75%_0%,oklch(0.82_0.145_79/0.06),transparent_70%)]">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 px-6 py-16 md:grid-cols-[1.1fr_1fr] md:py-24">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-balance md:text-[2.75rem] md:leading-[1.15]">
              The package manager for ComputerCraft
            </h1>
            <p className="text-muted-foreground mt-4 max-w-md text-lg">
              Lua packages, programs, and their dependencies on any CC:Tweaked computer, one in-game
              command away.
            </p>
            <HeroSearch />
            <TryPackages />
          </div>
          <Terminal />
        </div>
      </section>

      <section id="get-started" className="mx-auto max-w-5xl scroll-mt-20 px-6 py-16 md:py-20">
        <h2 className="text-2xl font-semibold tracking-tight">Get started</h2>
        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
          <Step index="01" title="Craft a computer">
            <p>Any computer in a world with HTTP enabled will do.</p>
          </Step>
          <Step index="02" title="Bootstrap cpm">
            <p>Run the installer straight off the registry:</p>
            <CommandBlock command={INSTALL_COMMAND} className="text-xs" />
          </Step>
          <Step index="03" title="Install packages">
            <p>
              Anything in the{" "}
              <Link to="/packages" className="text-brand font-medium hover:underline">
                package index
              </Link>
              , dependencies included:
            </p>
            <CommandBlock command="cpm install <name>" className="text-xs" />
          </Step>
        </div>
      </section>

      <section className="border-border border-t">
        <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Commands</h2>
            <a href={DOCS_URL} className="text-brand text-sm font-medium hover:underline">
              registry API docs
            </a>
          </div>
          <div className="mt-6">
            <CommandsTable />
          </div>
        </div>
      </section>
    </>
  );
}
