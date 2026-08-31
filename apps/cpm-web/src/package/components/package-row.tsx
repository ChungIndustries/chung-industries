import { Link } from "@tanstack/react-router";
import { Separator } from "@workspace/ui/components/separator";

import type { Package } from "@/package/schemas";

/** One package in the index: a full-width row, npm style. */
export function PackageRow({ pkg }: { pkg: Package }) {
  const versionCount = Object.keys(pkg.versions).length;
  return (
    <li>
      <Link
        to="/packages/$name"
        params={{ name: pkg.name }}
        className="group focus-visible:ring-ring flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4 focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="min-w-0">
          <span className="group-hover:text-brand font-mono text-base font-medium break-all">
            {pkg.name}
          </span>
          {pkg.author && (
            <span className="text-muted-foreground ml-3 text-sm">by {pkg.author}</span>
          )}
        </span>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span className="text-foreground">v{pkg["dist-tags"].latest}</span>
          <Separator orientation="vertical" className="my-1" />
          <span>
            {versionCount} {versionCount === 1 ? "version" : "versions"}
          </span>
        </div>
      </Link>
    </li>
  );
}
