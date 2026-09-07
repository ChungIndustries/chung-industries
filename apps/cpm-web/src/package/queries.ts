import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { nextPageOffset } from "@/package/search";
import { fetchPackage, fetchReadme, fetchSearch } from "@/package/server";

export const SEARCH_PAGE_SIZE = 20;

/**
 * The package index for a query, one registry page at a time. Keyed on the
 * (debounced) URL query so every keystroke does not become a request.
 */
export const searchQueryOptions = (query: string) =>
  infiniteQueryOptions({
    queryKey: ["search", query],
    queryFn: ({ pageParam }) =>
      fetchSearch({ data: { q: query, limit: SEARCH_PAGE_SIZE, offset: pageParam } }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastOffset) =>
      nextPageOffset(lastOffset, lastPage.results.length, lastPage.total),
    staleTime: 60_000,
  });

/** The first few package names, for the landing page's "Try:" line. */
export const tryPackagesQueryOptions = queryOptions({
  queryKey: ["try-packages"],
  queryFn: () => fetchSearch({ data: { q: "", limit: 3, offset: 0 } }),
  staleTime: 60_000,
});

export const packageQueryOptions = (name: string) =>
  queryOptions({
    queryKey: ["packages", name],
    queryFn: () => fetchPackage({ data: name }),
    staleTime: 60_000,
  });

export const readmeQueryOptions = (name: string, version: string) =>
  queryOptions({
    queryKey: ["packages", name, version, "readme"],
    queryFn: () => fetchReadme({ data: { name, version } }),
    // Published versions are immutable, so their README never changes.
    staleTime: Infinity,
  });
