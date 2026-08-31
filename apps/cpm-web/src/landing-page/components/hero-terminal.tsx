import { TerminalScript, TerminalWindow, type ScriptLine } from "@/terminal/terminal";

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

/** The hero terminal: a CC:Tweaked computer running the cpm bootstrap. */
export function HeroTerminal() {
  return (
    <TerminalWindow label="A ComputerCraft terminal installing cpm">
      <TerminalScript script={SCRIPT} />
    </TerminalWindow>
  );
}
