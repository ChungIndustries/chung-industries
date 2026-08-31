import { Link } from "@tanstack/react-router";
import { Badge } from "@workspace/ui/components/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import type { ReactNode } from "react";

import { CommandBlock } from "@/components/command-block";
import { DependenciesTab } from "@/package/components/dependencies-tab";
import { ReadmeTab } from "@/package/components/readme-tab";
import { VersionsTab } from "@/package/components/versions-tab";
import type { Package, PackageVersion } from "@/package/schemas";
import { formatBytes, tagsFor } from "@/package/search";
import { REGISTRY_ORIGIN } from "@/site";

export interface PackageDetailProps {
  pkg: Package;
  /** The version this page is showing. */
  version: PackageVersion;
  /** True when the URL pins a specific version rather than following latest. */
  pinned: boolean;
}

function TabCount({ count }: { count: number }) {
  return <span className="text-muted-foreground font-sans text-sm font-normal">{count}</span>;
}

export function PackageDetail({ pkg, version, pinned }: PackageDetailProps) {
  const dependencies = Object.entries(version.dependencies ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const versionCount = Object.keys(pkg.versions).length;
  const install = pinned ? `cpm install ${pkg.name}@${version.version}` : `cpm install ${pkg.name}`;

  return (
    <div className="mx-auto max-w-5xl px-6 pt-6 pb-12">
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

      <div className="mt-6 grid grid-cols-1 items-start gap-10 md:grid-cols-[minmax(0,1fr)_18rem]">
        <Tabs defaultValue="readme">
          <TabsList
            variant="line"
            className="border-border w-full justify-start gap-4 border-b p-0"
          >
            <TabsTrigger value="readme" className="font-display flex-none px-0 text-xs">
              Readme
            </TabsTrigger>
            <TabsTrigger value="dependencies" className="font-display flex-none gap-2 px-0 text-xs">
              Dependencies <TabCount count={dependencies.length} />
            </TabsTrigger>
            <TabsTrigger value="versions" className="font-display flex-none gap-2 px-0 text-xs">
              Versions <TabCount count={versionCount} />
            </TabsTrigger>
          </TabsList>
          <TabsContent value="readme" className="pt-4">
            <ReadmeTab version={version} />
          </TabsContent>
          <TabsContent value="dependencies" className="pt-4">
            <DependenciesTab dependencies={dependencies} />
          </TabsContent>
          <TabsContent value="versions" className="pt-4">
            <VersionsTab pkg={pkg} current={version.version} />
          </TabsContent>
        </Tabs>

        <aside className="space-y-4">
          <Card size="sm" className="gap-3">
            <CardHeader>
              <CardTitle className="font-display text-xs">Install</CardTitle>
            </CardHeader>
            <CardContent>
              <CommandBlock command={install} className="text-xs" />
            </CardContent>
          </Card>
          <Card size="sm" className="gap-3">
            <CardHeader>
              <CardTitle className="font-display text-xs">Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="text-sm">
                <MetaRow label="version">{version.version}</MetaRow>
                {version.author && <MetaRow label="author">{version.author}</MetaRow>}
                <MetaRow label="install size">{formatBytes(version.dist.bundle.size)}</MetaRow>
                <MetaRow label="dependencies">{String(dependencies.length)}</MetaRow>
                {version.startup && <MetaRow label="runs at boot">{version.startup}</MetaRow>}
                <MetaRow label="sha-256">
                  <span className="font-mono text-xs" title={version.dist.bundle.sha256}>
                    {version.dist.bundle.sha256.slice(0, 16)}…
                  </span>
                </MetaRow>
              </dl>
              <div className="border-border mt-2.5 flex items-center gap-2 border-t pt-2.5 text-sm">
                <a
                  href={`${REGISTRY_ORIGIN}${version.dist.tarball.url}`}
                  className="text-brand font-medium hover:underline"
                >
                  tarball
                </a>
                <Separator orientation="vertical" className="my-1" />
                <a
                  href={`${REGISTRY_ORIGIN}${version.dist.bundle.url}`}
                  className="text-brand font-medium hover:underline"
                >
                  bundle
                </a>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-border flex justify-between gap-3 border-b py-1.5 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right break-all">{children}</dd>
    </div>
  );
}
