import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { PackageSearch } from "lucide-react";

import { PackageRow } from "@/package/components/package-row";
import { SEARCH_PAGE_SIZE, searchQueryOptions } from "@/package/queries";

/**
 * Reads the search results itself (suspending until the first page arrives),
 * so the rest of the page renders and streams without waiting on the registry.
 * Later pages append below the ones already shown.
 */
export function PackagesResults({ query }: { query: string }) {
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useSuspenseInfiniteQuery(
    searchQueryOptions(query),
  );
  const results = data.pages.flatMap((page) => page.results);
  const total = data.pages[0]?.total ?? 0;
  const remaining = total - results.length;

  return (
    <div className="mt-4">
      <p className="text-muted-foreground border-border border-b pb-2.5 text-sm" role="status">
        <span className="text-foreground font-semibold">{total}</span>{" "}
        {total === 1 ? "package" : "packages"}
        {query && ` matching "${query}"`}
      </p>

      {results.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageSearch />
            </EmptyMedia>
            <EmptyTitle className="font-display text-base">
              {query ? "Nothing found" : "Nothing here yet"}
            </EmptyTitle>
            <EmptyDescription>
              {query ? `No package matches "${query}".` : "Be the first to publish!"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-border border-border divide-y border-b">
          {results.map((pkg) => (
            <PackageRow key={pkg.name} pkg={pkg} />
          ))}
        </ul>
      )}

      {hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage
              ? "Loading..."
              : `Show ${Math.min(SEARCH_PAGE_SIZE, remaining)} more`}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Suspense fallback mirroring the results layout. */
export function PackagesResultsSkeleton() {
  return (
    <div className="mt-4">
      <div className="border-border border-b pb-2.5">
        <Skeleton className="h-5 w-28" />
      </div>
      <div className="mt-3 space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
