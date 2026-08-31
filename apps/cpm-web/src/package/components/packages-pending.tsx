import { Skeleton } from "@workspace/ui/components/skeleton";

import { PackagesHead } from "@/package/components/packages-head";

/** Skeleton mirroring the packages page layout while its loader runs. */
export function PackagesPending() {
  return (
    <div className="mx-auto max-w-5xl px-6 pt-8 pb-12">
      <PackagesHead />
      <Skeleton className="mt-6 h-10 w-full" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
