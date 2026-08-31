import { Link, useLocation } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { House, Package } from "lucide-react";

import { TerminalScript, TerminalWindow } from "@/terminal/terminal";

/**
 * The 404 as a CraftOS session: the missing path is typed at the prompt and
 * the shell answers the way CC:Tweaked answers an unknown command.
 */
export function NotFound() {
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="font-display text-6xl [text-shadow:0.09em_0.09em_0_color-mix(in_oklab,var(--color-foreground)_25%,transparent)]">
        404
      </h1>
      <TerminalWindow
        label={`A ComputerCraft terminal reporting that ${pathname} does not exist`}
        className="mt-8 w-full text-left"
      >
        <TerminalScript
          script={[
            { kind: "command", text: pathname },
            { kind: "output", text: "No such program", className: "text-screen-red" },
            { kind: "prompt" },
          ]}
        />
      </TerminalWindow>
      <p className="text-muted-foreground mt-6 text-sm">
        This page does not exist. Perhaps it was uninstalled.
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
