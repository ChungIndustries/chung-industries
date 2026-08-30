import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

const LINES: { text: ReactNode; className?: string }[] = [
  {
    text: (
      <>
        <span className="text-primary">&gt;</span> wget run registry.cpm.chungindustries.com/install
      </>
    ),
  },
  { text: "Connecting to registry...", className: "text-muted-foreground" },
  { text: "cpm installed. Run `cpm` to get started.", className: "text-lime" },
  {
    text: (
      <>
        <span className="text-primary">&gt;</span> cpm install mail
      </>
    ),
  },
  { text: "+ mail (and 2 dependencies) installed.", className: "text-lime" },
  {
    text: (
      <>
        <span className="text-primary">&gt;</span>{" "}
        <span className="animate-blink bg-foreground -mb-0.5 inline-block h-4 w-2 motion-reduce:animate-none" />
      </>
    ),
  },
];

/** Per-line reveal delays in seconds, staged like real terminal output. */
const DELAYS = [0.3, 1.5, 2.1, 3.2, 4.2, 4.8];

/** A CC:Tweaked advanced computer running the cpm bootstrap, line by line. */
export function Terminal() {
  return (
    <div
      className="border-border bg-screen border shadow-[0_0_0_6px_#1a1508,0_0_0_7px_#4a3b15,0_0_60px_rgb(242_178_51/0.14),0_24px_60px_rgb(0_0_0/0.55)]"
      role="img"
      aria-label="A ComputerCraft terminal installing cpm"
    >
      <div className="border-border text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-xs">
        <span>CraftOS 1.9</span>
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="bg-destructive/70 size-2" />
          <span className="bg-primary/70 size-2" />
          <span className="bg-lime/70 size-2" />
        </span>
      </div>
      <div
        className="min-h-52 px-4 py-4 text-[13.5px] leading-loose shadow-[inset_0_0_48px_rgb(127_204_25/0.05)]"
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
