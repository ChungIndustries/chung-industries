import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import { Input } from "@workspace/ui/components/input";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { PackageSearch, Search } from "lucide-react";
import { useMemo } from "react";

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
  const results = useMemo(() => searchPackages(packages, q), [packages, q]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <PageHead />

      <search className="relative block">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={q}
          placeholder="Search packages"
          aria-label="Search packages"
          className="bg-card dark:bg-card h-10 pl-9"
          onChange={(event) =>
            void navigate({
              search: event.target.value ? { q: event.target.value } : {},
              replace: true,
            })
          }
        />
      </search>

      <p className="text-muted-foreground text-sm" role="status">
        <span className="text-foreground font-semibold">{results.length}</span>{" "}
        {results.length === 1 ? "package" : "packages"}
        {q && ` matching "${q}"`}
      </p>

      {results.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageSearch />
            </EmptyMedia>
            <EmptyTitle>{q ? "Nothing found" : "Nothing here yet"}</EmptyTitle>
            <EmptyDescription>
              {q ? `No package matches "${q}".` : "Be the first to publish!"}
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
