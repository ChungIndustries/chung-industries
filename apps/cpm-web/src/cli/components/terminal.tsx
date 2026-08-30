import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

function Prompt({ children }: { children?: ReactNode }) {
  return (
    <>
      <span className="text-screen-yellow">&gt; </span>
      {children}
    </>
  );
}

/* CraftOS greets with its version line, then prompts in yellow. */
const LINES: { text: ReactNode; className?: string }[] = [
  { text: "CraftOS 1.9", className: "text-screen-yellow" },
  { text: <Prompt>wget run registry.cpm.chungindustries.com/install</Prompt> },
  { text: "Connecting to registry...", className: "text-screen-muted" },
  { text: "cpm installed. Run `cpm` to get started.", className: "text-screen-green" },
  { text: <Prompt>cpm install mail</Prompt> },
  { text: "+ mail (and 2 dependencies) installed.", className: "text-screen-green" },
  {
    text: (
      <Prompt>
        <span className="bg-screen-foreground animate-blink -mb-0.5 inline-block h-4 w-2 motion-reduce:animate-none" />
      </Prompt>
    ),
  },
];

/** Per-line reveal delays in seconds, staged like real terminal output. */
const DELAYS = [0, 0.7, 1.8, 2.4, 3.4, 4.4, 5];

/**
 * A CC:Tweaked computer running the cpm bootstrap. The frame stays quiet;
 * the CraftOS colours are the identity.
 */
export function Terminal() {
  return (
    <div
      className="bg-screen border-border max-w-full rounded-lg border shadow-[0_0_70px_-12px_oklch(0.82_0.145_79/0.2)]"
      role="img"
      aria-label="A ComputerCraft terminal installing cpm"
    >
      <div
        className="text-screen-foreground [scrollbar-width:thin] overflow-x-auto px-4 py-3.5 font-mono text-[13px] leading-7"
        aria-hidden="true"
      >
        {LINES.map((line, index) => (
          <p
            key={index}
            className={cn(
              "m-0 animate-[reveal_0s_both] whitespace-nowrap motion-reduce:animate-none",
              line.className,
            )}
            style={{ animationDelay: `${DELAYS[index]}s` }}
          >
            {line.text}
          </p>
        ))}
      </div>
    </div>
  );
}
