import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { PackageDetail } from "@/package/components/package-detail";
import { PackageDetailPending, PackageNotFound } from "@/package/components/package-status";
import { packageQueryOptions, readmeQueryOptions } from "@/package/queries";

export const Route = createFileRoute("/packages/$name/$version")({
  loader: async ({ context, params }) => {
    const pkg = await context.queryClient.ensureQueryData(packageQueryOptions(params.name));
    if (!pkg?.versions[params.version]) throw notFound();
    // Awaited, not just warmed: see the sibling route's loader comment.
    await context.queryClient.ensureQueryData(readmeQueryOptions(pkg.name, params.version));
  },
  head: ({ params }) => ({ meta: [{ title: `${params.name}@${params.version} | cpm` }] }),
  pendingComponent: PackageDetailPending,
  notFoundComponent: PackageNotFound,
  component: PackageVersionPage,
});

function PackageVersionPage() {
  const { name, version } = Route.useParams();
  const { data: pkg } = useSuspenseQuery(packageQueryOptions(name));
  // The loader 404s on a missing package or version, so both are present here.
  const entry = pkg!.versions[version]!;
  return <PackageDetail pkg={pkg!} version={entry} pinned={true} />;
}
