import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { PackageDetail } from "@/package/components/package-detail";
import { PackageDetailPending, PackageNotFound } from "@/package/components/package-status";
import { packageQueryOptions, readmeQueryOptions } from "@/package/queries";

export const Route = createFileRoute("/packages/$name/")({
  loader: async ({ context, params }) => {
    const pkg = await context.queryClient.ensureQueryData(packageQueryOptions(params.name));
    if (!pkg) throw notFound();
    // Deliberately not awaited: the README streams into a Suspense boundary
    // in the readme tab, so the rest of the page renders without it.
    void context.queryClient.prefetchQuery(readmeQueryOptions(pkg.name, pkg["dist-tags"].latest));
  },
  head: ({ params }) => ({ meta: [{ title: `${params.name} | cpm` }] }),
  pendingComponent: PackageDetailPending,
  notFoundComponent: PackageNotFound,
  component: PackagePage,
});

function PackagePage() {
  const { name } = Route.useParams();
  const { data: pkg } = useSuspenseQuery(packageQueryOptions(name));
  // The loader 404s on a missing package, so pkg is present here.
  const latest = pkg!.versions[pkg!["dist-tags"].latest]!;
  return <PackageDetail pkg={pkg!} version={latest} pinned={false} />;
}
