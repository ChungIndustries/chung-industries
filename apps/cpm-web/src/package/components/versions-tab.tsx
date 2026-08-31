import { Link } from "@tanstack/react-router";
import { Badge } from "@workspace/ui/components/badge";

import type { Package } from "@/package/schemas";
import { formatTimeAgo, sortVersionsDesc, tagsFor } from "@/package/search";

export function VersionsTab({ pkg, current }: { pkg: Package; current: string }) {
  const versions = sortVersionsDesc(Object.keys(pkg.versions));
  return (
    <ul className="divide-border divide-y">
      {versions.map((v) => {
        const createdAt = pkg.versions[v]?.createdAt;
        return (
          <li key={v} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              {v === current ? (
                <>
                  <span className="font-mono font-medium">v{v}</span>
                  <Badge variant="outline" className="font-display rounded-none text-[10px]">
                    viewing
                  </Badge>
                </>
              ) : (
                <Link
                  to="/packages/$name/$version"
                  params={{ name: pkg.name, version: v }}
                  className="text-brand font-mono font-medium hover:underline"
                >
                  v{v}
                </Link>
              )}
            </span>
            <span className="flex items-center gap-3">
              <span className="flex gap-1.5">
                {tagsFor(pkg["dist-tags"], v).map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="font-display rounded-none text-[10px]"
                  >
                    {tag}
                  </Badge>
                ))}
              </span>
              {createdAt && (
                /* Relative time drifts between server render and hydration. */
                <time
                  dateTime={createdAt}
                  className="text-muted-foreground"
                  suppressHydrationWarning
                >
                  published {formatTimeAgo(createdAt)}
                </time>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
