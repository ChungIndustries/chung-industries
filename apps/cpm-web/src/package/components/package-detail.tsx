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
import type { ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CommandBlock } from "@/cli/components/command-block";
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

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-4 text-lg font-semibold tracking-tight">{children}</h2>;
}

function ReadmeSection({ version }: { version: PackageVersion }) {
  const readme = useQuery(readmeQueryOptions(version.name, version.version));
  if (readme.isPending) {
    return (
      <section>
        <SectionTitle>README</SectionTitle>
        <Skeleton className="h-40 w-full" />
      </section>
    );
  }
  // Errors are treated like a missing README: the section just disappears.
  if (!readme.data) return null;
  return (
    <section>
      <SectionTitle>README</SectionTitle>
      {/* Package content is untrusted; react-markdown never injects raw HTML
          from the source, so markdown is safe to render. */}
      <div className="border-border bg-card prose prose-sm prose-invert prose-a:text-brand prose-pre:bg-background prose-pre:border-border prose-pre:border max-h-160 max-w-none overflow-y-auto rounded-lg border p-6">
        <Markdown remarkPlugins={[remarkGfm]}>{readme.data}</Markdown>
      </div>
    </section>
  );
}

export function PackageDetail({ pkg, version, pinned }: PackageDetailProps) {
  const dependencies = Object.entries(version.dependencies ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const versions = sortVersionsDesc(Object.keys(pkg.versions));
  const install = pinned ? `cpm install ${pkg.name}@${version.version}` : `cpm install ${pkg.name}`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Breadcrumb className="mb-6">
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

      <div className="mt-8 grid grid-cols-1 items-start gap-10 md:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-9">
          <ReadmeSection version={version} />

          <section>
            <SectionTitle>Dependencies</SectionTitle>
            {dependencies.length === 0 ? (
              <p className="text-muted-foreground text-sm">None: this package stands alone.</p>
            ) : (
              <ul>
                {dependencies.map(([dep, range]) => (
                  <li
                    key={dep}
                    className="border-border flex justify-between gap-3 border-b py-2 text-sm first:border-t"
                  >
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
            )}
          </section>

          <section>
            <SectionTitle>Versions</SectionTitle>
            <ul>
              {versions.map((v) => (
                <li
                  key={v}
                  className="border-border flex justify-between gap-3 border-b py-2 text-sm first:border-t"
                >
                  {v === version.version ? (
                    <span className="font-mono">v{v}</span>
                  ) : (
                    <Link
                      to="/packages/$name/$version"
                      params={{ name: pkg.name, version: v }}
                      className="text-brand font-mono font-medium hover:underline"
                    >
                      v{v}
                    </Link>
                  )}
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
          </section>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Install</CardTitle>
            </CardHeader>
            <CardContent>
              <CommandBlock command={install} className="text-xs" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Metadata</CardTitle>
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
              <Separator className="my-3" />
              <div className="flex items-center gap-2 text-sm">
                <a
                  href={`${REGISTRY_ORIGIN}${version.dist.tarball.url}`}
                  className="text-brand font-medium hover:underline"
                >
                  tarball
                </a>
                <Separator orientation="vertical" className="h-3.5 self-center" />
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
    <div className="border-border flex justify-between gap-3 border-b py-1.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right break-all">{children}</dd>
    </div>
  );
}
