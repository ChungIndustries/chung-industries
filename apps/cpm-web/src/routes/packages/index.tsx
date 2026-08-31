import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { PackageSearch, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { PackageRow } from "@/package/components/package-row";
import { packagesQueryOptions } from "@/package/queries";
import { searchPackages } from "@/package/search";

interface PackagesSearch {
  q?: string;
}

export const Route = createFileRoute("/packages/")({
  validateSearch: (search: Record<string, unknown>): PackagesSearch => ({
    q: typeof search.q === "string" && search.q !== "" ? search.q : undefined,
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(packagesQueryOptions),
  head: () => ({ meta: [{ title: "packages | cpm" }] }),
  pendingComponent: PackagesPending,
  component: PackagesPage,
});

function PageHead() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Packages</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Everything in the cpm registry. Install any of these in-game with{" "}
        <code>cpm install &lt;name&gt;</code>.
      </p>
    </div>
  );
}

function PackagesPending() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <PageHead />
      <Skeleton className="h-10 w-full" />
      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

function PackagesPage() {
  const { q = "" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: packages } = useSuspenseQuery(packagesQueryOptions);

  // The list filters instantly from local state; only the URL sync is
  // debounced, so typing does not hammer history.replaceState (and, once
  // search moves to the registry, does not hammer the API either).
  const [query, setQuery] = useState(q);
  const syncPending = useRef(false);
  const syncUrl = useDebouncedCallback(
    (value: string) => {
      syncPending.current = false;
      void navigate({ search: value ? { q: value } : {}, replace: true });
    },
    { wait: 300 },
  );

  // Adopt external URL changes (back/forward navigation), but never clobber
  // input typed while a sync is still pending.
  useEffect(() => {
    if (!syncPending.current) setQuery(q);
  }, [q]);

  const results = useMemo(() => searchPackages(packages, query), [packages, query]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <PageHead />

      <search>
        <InputGroup className="bg-card dark:bg-card h-10">
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={query}
            placeholder="Search packages"
            aria-label="Search packages"
            onChange={(event) => {
              setQuery(event.target.value);
              syncPending.current = true;
              syncUrl(event.target.value);
            }}
          />
        </InputGroup>
      </search>

      <p className="text-muted-foreground text-sm" role="status">
        <span className="text-foreground font-semibold">{results.length}</span>{" "}
        {results.length === 1 ? "package" : "packages"}
        {query && ` matching "${query}"`}
      </p>

      {results.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageSearch />
            </EmptyMedia>
            <EmptyTitle>{query ? "Nothing found" : "Nothing here yet"}</EmptyTitle>
            <EmptyDescription>
              {query ? `No package matches "${query}".` : "Be the first to publish!"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-border border-border divide-y border-y">
          {results.map((pkg) => (
            <PackageRow key={pkg.name} pkg={pkg} />
          ))}
        </ul>
      )}
    </div>
  );
}
