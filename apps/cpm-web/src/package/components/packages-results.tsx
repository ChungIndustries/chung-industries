import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import { PackageSearch } from "lucide-react";

import { PackageRow } from "@/package/components/package-row";
import type { Package } from "@/package/schemas";

export function PackagesResults({ results, query }: { results: Package[]; query: string }) {
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
