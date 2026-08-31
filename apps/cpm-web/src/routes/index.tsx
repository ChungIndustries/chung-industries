import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";
import { Separator } from "@workspace/ui/components/separator";
import { ArrowUpRight, Search } from "lucide-react";
import { Fragment, useState } from "react";

import { CommandsTable } from "@/cli/components/commands-table";
import { GetStarted } from "@/cli/components/get-started";
import { Terminal } from "@/cli/components/terminal";
import { packagesQueryOptions } from "@/package/queries";
import { DOCS_URL } from "@/site";

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
      <InputGroup className="bg-card dark:bg-card h-11 flex-1">
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search packages"
          aria-label="Search packages"
          className="!text-base"
        />
      </InputGroup>
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
    <div className="text-muted-foreground mt-4 flex h-5 items-center gap-2 text-sm">
      {names.length > 0 && (
        <>
          <span>Try:</span>
          {names.map((name, index) => (
            <Fragment key={name}>
              {index > 0 && <Separator orientation="vertical" className="h-3 self-center" />}
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
    </div>
  );
}

function LandingPage() {
  return (
    <>
      <section className="border-border border-b">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 px-6 py-16 md:grid-cols-[1.1fr_1fr] md:py-24">
          <div>
            <h1 className="text-[2.5rem] leading-[1.08] font-semibold tracking-[-0.025em] text-balance md:text-[3.25rem]">
              The package manager for ComputerCraft
            </h1>
            <p className="text-muted-foreground mt-5 max-w-md text-base">
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
        <div className="mt-8">
          <GetStarted />
        </div>
      </section>

      <section id="commands" className="border-border scroll-mt-20 border-t">
        <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Commands</h2>
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
    </>
  );
}
