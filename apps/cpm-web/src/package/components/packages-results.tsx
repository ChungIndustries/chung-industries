import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { PackageSearch } from "lucide-react";
import { useMemo } from "react";

import { PackageRow } from "@/package/components/package-row";
import { packagesQueryOptions } from "@/package/queries";
import { searchPackages } from "@/package/search";

/**
 * Reads the package list itself (suspending until it arrives), so the rest of
 * the page renders and streams without waiting on the registry.
 */
export function PackagesResults({ query }: { query: string }) {
  const { data: packages } = useSuspenseQuery(packagesQueryOptions);
  const results = useMemo(() => searchPackages(packages, query), [packages, query]);

  return (
    <div className="mt-4">
      <p className="text-muted-foreground border-border border-b pb-2.5 text-sm" role="status">
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
