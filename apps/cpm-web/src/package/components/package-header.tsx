import { Badge } from "@workspace/ui/components/badge";

import type { Package, PackageVersion } from "@/package/schemas";
import { tagsFor } from "@/package/search";

export function PackageHeader({ pkg, version }: { pkg: Package; version: PackageVersion }) {
  return (
    <header>
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-mono text-3xl font-semibold break-all">{pkg.name}</h1>
        {/* Baseline-aligns with the title via its first child, while the
            badges center against the version text's box, not the h1's. */}
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-lg">v{version.version}</span>
          {tagsFor(pkg["dist-tags"], version.version).map((tag) => (
            <Badge key={tag} variant="secondary" className="font-display rounded-none text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
      {version.author && <p className="text-muted-foreground mt-1 text-sm">by {version.author}</p>}
    </header>
  );
}
