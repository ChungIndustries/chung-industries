import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { PackagesHead } from "@/package/components/packages-head";
import { PackagesPending } from "@/package/components/packages-pending";
import { PackagesResults } from "@/package/components/packages-results";
import { PackagesSearch } from "@/package/components/packages-search";
import { packagesQueryOptions } from "@/package/queries";
import { searchPackages } from "@/package/search";

interface PackagesSearchParams {
  q?: string;
}

export const Route = createFileRoute("/packages/")({
  validateSearch: (search: Record<string, unknown>): PackagesSearchParams => ({
    q: typeof search.q === "string" && search.q !== "" ? search.q : undefined,
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(packagesQueryOptions),
  head: () => ({ meta: [{ title: "packages | cpm" }] }),
  pendingComponent: PackagesPending,
  component: PackagesPage,
});

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
    <div className="mx-auto max-w-5xl px-6 pt-8 pb-12">
      <PackagesHead />
      <PackagesSearch
        query={query}
        onQueryChange={(value) => {
          setQuery(value);
          syncPending.current = true;
          syncUrl(value);
        }}
      />
      <PackagesResults results={results} query={query} />
    </div>
  );
}
