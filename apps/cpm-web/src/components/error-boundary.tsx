import { Link, useRouter } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";

import { TerminalScript, TerminalWindow } from "@/landing-page/components/terminal";

/**
 * The error page as a CraftOS session: the site is a program that just
 * crashed with a classic Lua error, the way a CC:Tweaked program dies.
 */
export function ErrorBoundary({ error }: { error: Error }) {
  const router = useRouter();

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="font-display text-brand text-2xl [text-shadow:0.09em_0.09em_0_color-mix(in_oklab,var(--color-brand)_30%,transparent)]">
        Something went wrong
      </h1>
      <TerminalWindow
        label="A ComputerCraft terminal showing a crashed program"
        className="mt-8 w-full text-left"
      >
        <TerminalScript
          script={[
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
          <Link to="/">Go home</Link>
        </Button>
        <Button onClick={() => router.invalidate()}>Try again</Button>
      </div>
    </div>
  );
}
