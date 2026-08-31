import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";
import { Separator } from "@workspace/ui/components/separator";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Search } from "lucide-react";
import { Fragment, useState } from "react";

import { Terminal } from "@/landing-page/components/terminal";
import { packagesQueryOptions } from "@/package/queries";

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
 * registry hiccup quietly leaves the line empty instead of failing the
 * landing page; the static "Try:" label always shows, with skeletons in
 * place of the names while they load.
 */
function TryPackages() {
  const packages = useQuery(packagesQueryOptions);
  const names = (packages.data ?? []).slice(0, 3).map((pkg) => pkg.name);

  return (
    <div className="text-muted-foreground mt-4 flex h-5 items-center gap-2 text-sm">
      <span>Try:</span>
      {packages.isPending
        ? Array.from({ length: 3 }, (_, index) => (
            <Fragment key={index}>
              {index > 0 && <Separator orientation="vertical" className="my-1" />}
              <Skeleton className="h-4 w-12" />
            </Fragment>
          ))
        : names.map((name, index) => (
            <Fragment key={name}>
              {index > 0 && <Separator orientation="vertical" className="my-1" />}
              <Link
                to="/packages/$name"
                params={{ name }}
                className="text-brand font-mono leading-none hover:underline"
              >
                {name}
              </Link>
            </Fragment>
          ))}
    </div>
  );
}

export function Hero() {
  return (
    <section>
      <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 px-6 py-16 md:grid-cols-[1.1fr_minmax(0,1fr)] md:py-24">
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
      <div className="pixel-rule" aria-hidden="true" />
    </section>
  );
}
