import { InstallCard } from "@/package/components/install-card";
import { MetadataCard } from "@/package/components/metadata-card";
import { PackageBreadcrumb } from "@/package/components/package-breadcrumb";
import { PackageHeader } from "@/package/components/package-header";
import { PackageTabs } from "@/package/components/package-tabs";
import type { Package, PackageVersion } from "@/package/schemas";

export interface PackageDetailProps {
  pkg: Package;
  /** The version this page is showing. */
  version: PackageVersion;
  /** True when the URL pins a specific version rather than following latest. */
  pinned: boolean;
}

export function PackageDetail({ pkg, version, pinned }: PackageDetailProps) {
  const install = pinned ? `cpm install ${pkg.name}@${version.version}` : `cpm install ${pkg.name}`;

  return (
    <div className="mx-auto max-w-5xl px-6 pt-6 pb-12">
      <PackageBreadcrumb pkg={pkg} version={version} pinned={pinned} />
      <PackageHeader pkg={pkg} version={version} />
      <div className="mt-6 grid grid-cols-1 items-start gap-10 md:grid-cols-[minmax(0,1fr)_18rem]">
        <PackageTabs pkg={pkg} version={version} />
        <aside className="space-y-4">
          <InstallCard command={install} />
          <MetadataCard version={version} />
        </aside>
      </div>
    </div>
  );
}
