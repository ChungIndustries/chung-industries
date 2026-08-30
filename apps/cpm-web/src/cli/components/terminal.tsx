import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

export function Prompt({ children }: { children?: ReactNode }) {
  return (
    <>
      <span className="text-screen-yellow">&gt; </span>
      {children}
    </>
  );
}

export function Cursor() {
  return (
    <span className="bg-screen-foreground animate-blink -mb-0.5 inline-block h-4 w-2 motion-reduce:animate-none" />
  );
}

/** A Mac-style terminal window dressed as a CC:Tweaked computer screen. */
export function TerminalWindow({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-screen border-border max-w-full rounded-lg border shadow-[0_0_70px_-12px_oklch(0.82_0.145_79/0.2)]",
        className,
      )}
      role="img"
      aria-label={label}
    >
      <div
        className="border-border flex items-center gap-1.5 border-b px-4 py-2.5"
        aria-hidden="true"
      >
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="text-screen-muted ml-2 font-mono text-xs">CraftOS 1.9</span>
      </div>
      <div
        className="text-screen-foreground [scrollbar-width:thin] overflow-x-auto px-4 py-3.5 font-mono text-[13px] leading-7"
        aria-hidden="true"
      >
        {children}
      </div>
    </div>
  );
}

/* The bootstrap story, told line by line. */
const LINES: { text: ReactNode; className?: string }[] = [
  { text: <Prompt>wget run registry.cpm.chungindustries.com/install</Prompt> },
  { text: "Connecting to registry...", className: "text-screen-muted" },
  { text: "cpm installed. Run `cpm` to get started.", className: "text-screen-green" },
  { text: <Prompt>cpm install mail</Prompt> },
  { text: "+ mail (and 2 dependencies) installed.", className: "text-screen-green" },
  {
    text: (
      <Prompt>
        <Cursor />
      </Prompt>
    ),
  },
];

/** Per-line reveal delays in seconds, staged like real terminal output. */
const DELAYS = [0.3, 1.4, 2, 3, 4, 4.6];

/** The hero terminal: a CC:Tweaked computer running the cpm bootstrap. */
export function Terminal() {
  return (
    <TerminalWindow label="A ComputerCraft terminal installing cpm">
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
    </TerminalWindow>
  );
}
