import { Link, useParams } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { House, Package } from "lucide-react";

import { TerminalScript, TerminalWindow } from "@/terminal/terminal";

/** Skeleton mirroring the detail page layout while its loader runs. */
export function PackageDetailPending() {
  return (
    <div className="mx-auto max-w-5xl px-6 pt-8 pb-12">
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

/**
 * 404 for a package (or version) the registry does not have, as a CraftOS
 * session: the install command someone would run, answered with the
 * registry's real error message.
 */
export function PackageNotFound() {
  const { name = "unknown", version } = useParams({ strict: false });
  const spec = version ? `${name}@${version}` : name;
  const message = version ? "Package version not found" : `Package "${name}" not found`;

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="font-display text-6xl [text-shadow:0.09em_0.09em_0_color-mix(in_oklab,var(--color-foreground)_25%,transparent)]">
        404
      </h1>
      <TerminalWindow
        label={`A ComputerCraft terminal reporting that ${spec} is not in the registry`}
        className="mt-8 w-full text-left"
      >
        <TerminalScript
          script={[
            { kind: "command", text: `cpm install ${spec}` },
            { kind: "output", text: message, className: "text-screen-red" },
            { kind: "prompt" },
          ]}
        />
      </TerminalWindow>
      <p className="text-muted-foreground mt-6 text-sm">
        The registry has no such package or version.
      </p>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" asChild>
          <Link to="/">
            <House aria-hidden="true" />
            Go home
          </Link>
        </Button>
        <Button asChild>
          <Link to="/packages">
            <Package aria-hidden="true" />
            Browse packages
          </Link>
        </Button>
      </div>
    </div>
  );
}
