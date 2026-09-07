import { Link } from "@tanstack/react-router";
import { Separator } from "@workspace/ui/components/separator";

import type { PackageSummary } from "@/package/schemas";
import { formatTimeAgo } from "@/package/search";

/** One search result in the index, rendered as a full-width row. */
export function PackageRow({ pkg }: { pkg: PackageSummary }) {
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
          {pkg.description && (
            <span className="text-muted-foreground mt-1 line-clamp-2 text-sm">
              {pkg.description}
            </span>
          )}
        </span>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span className="text-foreground">v{pkg.version}</span>
          <Separator orientation="vertical" className="my-1" />
          <span>
            {pkg.versionCount} {pkg.versionCount === 1 ? "version" : "versions"}
          </span>
          <Separator orientation="vertical" className="my-1" />
          {/* Relative time drifts between server render and hydration. */}
          <time dateTime={pkg.publishedAt} suppressHydrationWarning>
            published {formatTimeAgo(pkg.publishedAt)}
          </time>
        </div>
      </Link>
    </li>
  );
}
