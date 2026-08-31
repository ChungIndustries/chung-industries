import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@workspace/ui/components/skeleton";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { readmeQueryOptions } from "@/package/queries";
import type { PackageVersion } from "@/package/schemas";

export function ReadmeTab({ version }: { version: PackageVersion }) {
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
