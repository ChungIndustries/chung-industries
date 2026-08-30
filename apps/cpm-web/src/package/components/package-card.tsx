import { Link } from "@tanstack/react-router";

import { Card, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";

import type { Package } from "@/package/types";

export function PackageCard({ pkg }: { pkg: Package }) {
  const versionCount = Object.keys(pkg.versions).length;
  return (
    <Link
      to="/packages/$name"
      params={{ name: pkg.name }}
      className="group block focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:border-primary group-hover:shadow-[0_0_22px_rgb(242_178_51/0.12)] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        <CardHeader>
          <CardTitle className="font-display font-normal break-all text-primary">
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
