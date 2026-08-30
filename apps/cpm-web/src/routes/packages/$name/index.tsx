import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { PackageNotFoundError } from "@/package/api";
import { PackageDetail } from "@/package/components/package-detail";
import { PackageDetailPending, PackageNotFound } from "@/package/components/package-status";
import { packageQueryOptions, readmeQueryOptions } from "@/package/queries";

export const Route = createFileRoute("/packages/$name/")({
  loader: async ({ context, params }) => {
    let pkg;
    try {
      pkg = await context.queryClient.ensureQueryData(packageQueryOptions(params.name));
    } catch (error) {
      if (error instanceof PackageNotFoundError) throw notFound();
      throw error;
    }
    // Warm the README while the page renders; the component handles its absence.
    void context.queryClient.prefetchQuery(
      readmeQueryOptions(pkg.name, pkg["dist-tags"].latest),
    );
  },
  pendingComponent: PackageDetailPending,
  notFoundComponent: PackageNotFound,
  component: PackagePage,
});

function PackagePage() {
  const { name } = Route.useParams();
  const { data: pkg } = useSuspenseQuery(packageQueryOptions(name));
  const latest = pkg.versions[pkg["dist-tags"].latest]!;
  return <PackageDetail pkg={pkg} version={latest} pinned={false} />;
}
