import { Link } from "@tanstack/react-router";
import { Card, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";

import type { Package } from "@/package/schemas";

export function PackageCard({ pkg }: { pkg: Package }) {
  const versionCount = Object.keys(pkg.versions).length;
  return (
    <Link
      to="/packages/$name"
      params={{ name: pkg.name }}
      className="group focus-visible:ring-ring block h-full rounded-lg focus-visible:ring-2 focus-visible:outline-none"
    >
      <Card className="group-hover:border-brand/60 h-full transition-[border-color,box-shadow] group-hover:shadow-sm">
        <CardHeader>
          <CardTitle className="group-hover:text-brand font-mono text-base break-all">
            {pkg.name}
          </CardTitle>
          <CardDescription className="flex flex-wrap gap-x-4">
            <span className="text-foreground">v{pkg["dist-tags"].latest}</span>
            <span>
              {versionCount} {versionCount === 1 ? "version" : "versions"}
            </span>
            {pkg.author && <span>by {pkg.author}</span>}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
