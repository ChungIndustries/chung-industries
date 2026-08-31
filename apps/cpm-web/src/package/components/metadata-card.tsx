import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import type { ReactNode } from "react";

import type { PackageVersion } from "@/package/schemas";
import { formatBytes } from "@/package/search";
import { REGISTRY_ORIGIN } from "@/site";

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-border flex justify-between gap-3 border-b py-1.5 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right break-all">{children}</dd>
    </div>
  );
}

export function MetadataCard({ version }: { version: PackageVersion }) {
  const dependencyCount = Object.keys(version.dependencies ?? {}).length;

  return (
    <Card size="sm" className="gap-3">
      <CardHeader>
        <CardTitle className="font-display text-xs">Metadata</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="text-sm">
          <MetaRow label="version">{version.version}</MetaRow>
          {version.author && <MetaRow label="author">{version.author}</MetaRow>}
          <MetaRow label="install size">{formatBytes(version.dist.bundle.size)}</MetaRow>
          <MetaRow label="dependencies">{String(dependencyCount)}</MetaRow>
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
  );
}
