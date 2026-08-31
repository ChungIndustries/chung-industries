import { Link } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";

import type { Package, PackageVersion } from "@/package/schemas";

export function PackageBreadcrumb({
  pkg,
  version,
  pinned,
}: {
  pkg: Package;
  version: PackageVersion;
  pinned: boolean;
}) {
  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList className="gap-1 sm:gap-1.5">
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/packages">packages</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        {pinned ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/packages/$name" params={{ name: pkg.name }}>
                  {pkg.name}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{version.version}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : (
          <BreadcrumbItem>
            <BreadcrumbPage>{pkg.name}</BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
