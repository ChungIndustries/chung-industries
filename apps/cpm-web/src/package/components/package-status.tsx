import { Link } from "@tanstack/react-router";
import { PackageX } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import { Skeleton } from "@workspace/ui/components/skeleton";

/** Skeleton mirroring the detail page layout while its loader runs. */
export function PackageDetailPending() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Skeleton className="mb-6 h-5 w-40" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-2 h-4 w-32" />
      <div className="mt-8 grid grid-cols-1 items-start gap-10 md:grid-cols-[minmax(0,1fr)_18rem]">
        <Skeleton className="h-80" />
        <div className="space-y-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-52" />
        </div>
      </div>
    </div>
  );
}

/** 404 for a package (or version) the registry does not have. */
export function PackageNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Empty className="border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageX />
          </EmptyMedia>
          <EmptyTitle className="font-display">404</EmptyTitle>
          <EmptyDescription>The registry has no such package or version.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to="/packages">Browse packages</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
