import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Badge } from "@workspace/ui/components/badge";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { ChevronRight, Package } from "lucide-react";

import { myPackagesQueryOptions } from "@/auth/queries";

export function MyPackages() {
  const { data: packages } = useSuspenseQuery(myPackagesQueryOptions);

  if (packages.length === 0) {
    return (
      <div className="border-border flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-12 text-center">
        <span className="border-border bg-card text-muted-foreground grid size-10 place-items-center rounded-md border">
          <Package className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-medium">Nothing published yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Packages you publish will show up here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="border-border divide-border divide-y rounded-lg border">
      {packages.map((pkg) => (
        <li key={pkg.name}>
          <Link
            to="/packages/$name"
            params={{ name: pkg.name }}
            className="group flex items-center gap-3 px-4 py-3.5"
          >
            <span className="group-hover:text-brand font-mono text-sm font-medium break-all transition-colors">
              {pkg.name}
            </span>
            <Badge
              variant={pkg.role === "owner" ? "outline" : "secondary"}
              className="font-display rounded-none text-[10px]"
            >
              {pkg.role}
            </Badge>
            <ChevronRight
              className="text-muted-foreground group-hover:text-foreground ml-auto size-4 shrink-0 transition-colors"
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MyPackagesSkeleton() {
  return (
    <div className="border-border divide-border divide-y rounded-lg border">
      <div className="px-4 py-3.5">
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="px-4 py-3.5">
        <Skeleton className="h-5 w-36" />
      </div>
    </div>
  );
}
