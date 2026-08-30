import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";

import { CommandBlock } from "@/cli/components/command-block";
import { CommandsTable } from "@/cli/components/commands-table";
import { Terminal } from "@/cli/components/terminal";
import { DOCS_URL, INSTALL_COMMAND } from "@/site";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="font-display mb-5 text-lg">
      <span className="text-primary select-none">&gt; </span>
      {children}
    </h2>
  );
}

function LandingPage() {
  return (
    <>
      <section className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
        <div>
          <h1 className="font-display text-primary text-6xl font-bold [text-shadow:0_0_28px_rgb(242_178_51/0.35)]">
            cpm
          </h1>
          <p className="font-display mt-2 text-base">The ComputerCraft package manager</p>
          <p className="text-muted-foreground mt-4 max-w-prose">
            Lua packages for CC:Tweaked computers. One command in-game installs a program, its
            dependencies, and its startup hooks: published, versioned, and resolved by the registry.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/packages">Browse packages</Link>
            </Button>
            <Button variant="outline" asChild>
              <a href={DOCS_URL}>API docs</a>
            </Button>
          </div>
        </div>
        <Terminal />
      </section>

      <section className="border-border border-t">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <SectionTitle>get started</SectionTitle>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-primary text-sm font-normal">
                  01 / craft a computer
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                Any CC:Tweaked computer in an HTTP-enabled world works; advanced computers
                recommended for the colours.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-primary text-sm font-normal">
                  02 / bootstrap cpm
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground space-y-3 text-sm">
                <p>Run the installer straight off the registry:</p>
                <CommandBlock command={INSTALL_COMMAND} className="text-xs" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-primary text-sm font-normal">
                  03 / install things
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground space-y-3 text-sm">
                <p>
                  Grab anything from the{" "}
                  <Link to="/packages" className="text-primary hover:underline">
                    package index
                  </Link>
                  :
                </p>
                <CommandBlock command="cpm install <name>" className="text-xs" />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-border border-t">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <SectionTitle>commands</SectionTitle>
          <CommandsTable />
        </div>
      </section>
    </>
  );
}
