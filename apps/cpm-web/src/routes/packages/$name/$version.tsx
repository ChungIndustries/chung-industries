import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { PackageNotFoundError } from "@/package/api";
import { PackageDetail } from "@/package/components/package-detail";
import { PackageDetailPending, PackageNotFound } from "@/package/components/package-status";
import { packageQueryOptions, readmeQueryOptions } from "@/package/queries";

export const Route = createFileRoute("/packages/$name/$version")({
  loader: async ({ context, params }) => {
    let pkg;
    try {
      pkg = await context.queryClient.ensureQueryData(packageQueryOptions(params.name));
    } catch (error) {
      if (error instanceof PackageNotFoundError) throw notFound();
      throw error;
    }
    if (!pkg.versions[params.version]) throw notFound();
    void context.queryClient.prefetchQuery(readmeQueryOptions(pkg.name, params.version));
  },
  pendingComponent: PackageDetailPending,
  notFoundComponent: PackageNotFound,
  component: PackageVersionPage,
});

function PackageVersionPage() {
  const { name, version } = Route.useParams();
  const { data: pkg } = useSuspenseQuery(packageQueryOptions(name));
  const entry = pkg.versions[version]!;
  return <PackageDetail pkg={pkg} version={entry} pinned={true} />;
}
