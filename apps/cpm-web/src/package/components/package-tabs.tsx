import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";

import { DependenciesTab } from "@/package/components/dependencies-tab";
import { ReadmeTab } from "@/package/components/readme-tab";
import { VersionsTab } from "@/package/components/versions-tab";
import type { Package, PackageVersion } from "@/package/schemas";

function TabCount({ count }: { count: number }) {
  return <span className="text-muted-foreground font-sans text-sm font-normal">{count}</span>;
}

export function PackageTabs({ pkg, version }: { pkg: Package; version: PackageVersion }) {
  const dependencies = Object.entries(version.dependencies ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const versionCount = Object.keys(pkg.versions).length;

  return (
    <Tabs defaultValue="readme">
      <TabsList variant="line" className="border-border w-full justify-start gap-4 border-b p-0">
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
  );
}
