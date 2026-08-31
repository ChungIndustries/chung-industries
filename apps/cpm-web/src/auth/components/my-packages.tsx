import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Badge } from "@workspace/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";

import { myPackagesQueryOptions } from "@/auth/queries";

export function MyPackages() {
  const { data: packages } = useSuspenseQuery(myPackagesQueryOptions);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">Your packages</CardTitle>
        <CardDescription>Packages you own or maintain on the registry.</CardDescription>
      </CardHeader>
      <CardContent>
        {packages.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nothing yet — the first authenticated publish of a new name claims it for you.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {packages.map((pkg) => (
              <li key={pkg.name} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link
                  to="/packages/$name"
                  params={{ name: pkg.name }}
                  className="text-brand font-mono font-medium hover:underline"
                >
                  {pkg.name}
                </Link>
                <Badge variant="secondary" className="font-display rounded-none text-[10px]">
                  {pkg.role}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function MyPackagesSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">Your packages</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}
