import { useQuery } from "@tanstack/react-query";
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
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import type { ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CommandBlock } from "@/components/command-block";
import { readmeQueryOptions } from "@/package/queries";
import type { Package, PackageVersion } from "@/package/schemas";
import { formatBytes, sortVersionsDesc, tagsFor } from "@/package/search";
import { REGISTRY_ORIGIN } from "@/site";

export interface PackageDetailProps {
  pkg: Package;
  /** The version this page is showing. */
  version: PackageVersion;
  /** True when the URL pins a specific version rather than following latest. */
  pinned: boolean;
}

function ReadmeTab({ version }: { version: PackageVersion }) {
  const readme = useQuery(readmeQueryOptions(version.name, version.version));
  if (readme.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  // Errors are treated like a missing README.
  if (!readme.data) {
    return <p className="text-muted-foreground text-sm">This version does not ship a README.</p>;
  }
  return (
    // Package content is untrusted; react-markdown never injects raw HTML
    // from the source, so markdown is safe to render.
    <div className="prose prose-sm prose-invert prose-a:text-brand prose-pre:bg-card prose-pre:border-border prose-pre:border max-w-none">
      <Markdown remarkPlugins={[remarkGfm]}>{readme.data}</Markdown>
    </div>
  );
}

function DependenciesTab({ dependencies }: { dependencies: [string, string][] }) {
  if (dependencies.length === 0) {
    return <p className="text-muted-foreground text-sm">None: this package stands alone.</p>;
  }
  return (
    <ul className="divide-border divide-y">
      {dependencies.map(([dep, range]) => (
        <li key={dep} className="flex justify-between gap-3 py-2 text-sm">
          <Link
            to="/packages/$name"
            params={{ name: dep }}
            className="text-brand font-mono font-medium hover:underline"
          >
            {dep}
          </Link>
          <span className="text-muted-foreground font-mono">{range}</span>
        </li>
      ))}
    </ul>
  );
}

function VersionsTab({ pkg, current }: { pkg: Package; current: string }) {
  const versions = sortVersionsDesc(Object.keys(pkg.versions));
  return (
    <ul className="divide-border divide-y">
      {versions.map((v) => (
        <li key={v} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            {v === current ? (
              <>
                <span className="font-mono font-medium">v{v}</span>
                <Badge variant="outline">viewing</Badge>
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
          <span className="flex gap-1.5">
            {tagsFor(pkg["dist-tags"], v).map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TabCount({ count }: { count: number }) {
  return <span className="text-muted-foreground font-normal">{count}</span>;
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
        <BreadcrumbList>
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
        <span className="text-muted-foreground text-lg">v{version.version}</span>
        {tagsFor(pkg["dist-tags"], version.version).map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
      </div>
      {version.author && <p className="text-muted-foreground mt-1 text-sm">by {version.author}</p>}

      <div className="mt-6 grid grid-cols-1 items-start gap-10 md:grid-cols-[minmax(0,1fr)_18rem]">
        <Tabs defaultValue="readme">
          <TabsList
            variant="line"
            className="border-border w-full justify-start gap-4 border-b p-0"
          >
            <TabsTrigger value="readme" className="flex-none px-0">
              Readme
            </TabsTrigger>
            <TabsTrigger value="dependencies" className="flex-none gap-2 px-0">
              Dependencies <TabCount count={dependencies.length} />
            </TabsTrigger>
            <TabsTrigger value="versions" className="flex-none gap-2 px-0">
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
              <CardTitle>Install</CardTitle>
            </CardHeader>
            <CardContent>
              <CommandBlock command={install} className="text-xs" />
            </CardContent>
          </Card>
          <Card size="sm" className="gap-3">
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
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
