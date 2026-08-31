import { useDebouncedCallback } from "@tanstack/react-pacer";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect, useRef, useState } from "react";

import { PackagesResults, PackagesResultsSkeleton } from "@/package/components/packages-results";
import { PackagesSearch } from "@/package/components/packages-search";
import { packagesQueryOptions } from "@/package/queries";

interface PackagesSearchParams {
  q?: string;
}

export const Route = createFileRoute("/packages/")({
  validateSearch: (search: Record<string, unknown>): PackagesSearchParams => ({
    q: typeof search.q === "string" && search.q !== "" ? search.q : undefined,
  }),
  // Deliberately not awaited: the page shell renders (and streams) right away
  // while only the results area suspends on this query.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(packagesQueryOptions);
  },
  head: () => ({ meta: [{ title: "packages | cpm" }] }),
  component: PackagesPage,
});

function PackagesPage() {
  const { q = "" } = Route.useSearch();
  const navigate = Route.useNavigate();

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

  return (
    <div className="mx-auto max-w-5xl px-6 pt-8 pb-12">
      <h1 className="font-display text-xl">Packages</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Everything in the cpm registry. Install any of these in-game with{" "}
        <code>cpm install &lt;name&gt;</code>.
      </p>
      <PackagesSearch
        query={query}
        onQueryChange={(value) => {
          setQuery(value);
          syncPending.current = true;
          syncUrl(value);
        }}
      />
      <Suspense fallback={<PackagesResultsSkeleton />}>
        <PackagesResults query={query} />
      </Suspense>
    </div>
  );
}
