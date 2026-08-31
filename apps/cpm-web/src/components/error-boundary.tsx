import { Link, useRouter } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { House, RotateCcw } from "lucide-react";
import { useState } from "react";

import { TerminalScript, TerminalWindow } from "@/landing-page/components/terminal";

/**
 * The error page as a CraftOS session: the site is a program that just
 * crashed with a classic Lua error, the way a CC:Tweaked program dies.
 * Rebooting retries the route, and restarts the terminal to match.
 */
export function ErrorBoundary({ error }: { error: Error }) {
  const router = useRouter();
  const [bootCount, setBootCount] = useState(0);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="font-display text-2xl [text-shadow:0.09em_0.09em_0_color-mix(in_oklab,var(--color-foreground)_25%,transparent)]">
        Something went wrong
      </h1>
      <TerminalWindow
        label="A ComputerCraft terminal showing a crashed program"
        className="mt-8 w-full text-left"
      >
        <TerminalScript
          key={bootCount}
          script={[
            { kind: "output", text: "CraftOS 1.9", className: "text-screen-yellow", pause: 0.6 },
            { kind: "command", text: "cpm web" },
            {
              kind: "output",
              text: "web.lua:1: attempt to index a nil value",
              className: "text-screen-red",
            },
            { kind: "prompt" },
          ]}
        />
      </TerminalWindow>
      <p className="text-muted-foreground mt-6 text-sm">
        {import.meta.env.DEV ? error.message : "The registry is not answering right now."}
      </p>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" asChild>
          <Link to="/">
            <House aria-hidden="true" />
            Go home
          </Link>
        </Button>
        <Button
          onClick={() => {
            setBootCount((count) => count + 1);
            void router.invalidate();
          }}
        >
          <RotateCcw aria-hidden="true" />
          Reboot
        </Button>
      </div>
    </div>
  );
}
