import { cn } from "@workspace/ui/lib/utils";
import type { CSSProperties, ReactNode } from "react";

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

/** A terminal window dressed as a CC:Tweaked computer screen. */
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
      className={cn("bg-card border-border max-w-full rounded-lg border", className)}
      role="img"
      aria-label={label}
    >
      <div
        className="border-border flex items-center gap-1.5 border-b px-4 py-2.5"
        aria-hidden="true"
      >
        <span className="size-2 bg-[#ff5f57]" />
        <span className="size-2 bg-[#febc2e]" />
        <span className="size-2 bg-[#28c840]" />
        <span className="text-screen-muted font-display ml-2 text-[10px]">CraftOS 1.9</span>
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

/** Seconds per typed character, and the idle-cursor beat before typing. */
const TYPE_SPEED = 0.045;
const PROMPT_PAUSE = 0.35;

export type ScriptLine =
  | { kind: "command"; text: string }
  | { kind: "output"; text: string; className?: string; pause?: number }
  | { kind: "prompt" };

/* The bootstrap story: commands are typed, responses pop in like in-game. */
const SCRIPT: ScriptLine[] = [
  { kind: "command", text: "wget run registry.cpm.chungindustries.com/install" },
  { kind: "output", text: "Connecting to registry...", className: "text-screen-muted", pause: 0.9 },
  {
    kind: "output",
    text: "cpm installed. Run `cpm` to get started.",
    className: "text-screen-green",
    pause: 0.7,
  },
  { kind: "command", text: "cpm install mail" },
  {
    kind: "output",
    text: "+ mail (and 2 dependencies) installed.",
    className: "text-screen-green",
    pause: 0.5,
  },
  { kind: "prompt" },
];

/* Lay a script out on a timeline: a command line holds an idle cursor for
   PROMPT_PAUSE, types for length * TYPE_SPEED, then yields; an output line
   holds for its pause before the next line lands. */
function toTimeline(script: ScriptLine[]) {
  let clock = 0.5;
  return script.map((line) => {
    const at = clock;
    let duration = 0;
    if (line.kind === "command") {
      duration = line.text.length * TYPE_SPEED;
      clock = at + PROMPT_PAUSE + duration + 0.4;
    } else if (line.kind === "output") {
      clock = at + (line.pause ?? 0.4);
    }
    return { line, at, duration };
  });
}

function TypedCommand({ text, at, duration }: { text: string; at: number; duration: number }) {
  return (
    <>
      <span
        className="terminal-typed inline-block overflow-hidden align-bottom whitespace-nowrap"
        style={
          {
            "--typed-width": `${text.length}ch`,
            animation: `typing ${duration}s steps(${text.length}, end) ${at + PROMPT_PAUSE}s both`,
          } as CSSProperties
        }
      >
        {text}
      </span>
      <span
        className="bg-screen-foreground -mb-0.5 inline-block h-4 w-2 motion-reduce:hidden"
        style={{ animation: `caret-hide ${PROMPT_PAUSE + duration}s step-end ${at}s both` }}
      />
    </>
  );
}

/** A script played inside a TerminalWindow: typed commands, popped output. */
export function TerminalScript({ script }: { script: ScriptLine[] }) {
  return toTimeline(script).map(({ line, at, duration }, index) => (
    <p
      key={index}
      className={cn(
        "m-0 animate-[reveal_0s_both] whitespace-nowrap motion-reduce:animate-none",
        line.kind === "output" && line.className,
      )}
      style={{ animationDelay: `${at}s` }}
    >
      {line.kind === "command" && (
        <Prompt>
          <TypedCommand text={line.text} at={at} duration={duration} />
        </Prompt>
      )}
      {line.kind === "output" && line.text}
      {line.kind === "prompt" && (
        <Prompt>
          <Cursor />
        </Prompt>
      )}
    </p>
  ));
}

/** The hero terminal: a CC:Tweaked computer running the cpm bootstrap. */
export function Terminal() {
  return (
    <TerminalWindow label="A ComputerCraft terminal installing cpm">
      <TerminalScript script={SCRIPT} />
    </TerminalWindow>
  );
}
