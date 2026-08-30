import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { CommandBlock } from "@/cli/components/command-block";
import { INSTALL_COMMAND } from "@/site";

interface Step {
  title: string;
  body: ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Craft a computer",
    body: <p>Any computer in a world with HTTP enabled will do.</p>,
  },
  {
    title: "Bootstrap cpm",
    body: (
      <>
        <p>Run the installer straight off the registry:</p>
        <CommandBlock command={INSTALL_COMMAND} className="text-xs" />
      </>
    ),
  },
  {
    title: "Install packages",
    body: (
      <>
        <p>
          Anything in the{" "}
          <Link
            to="/packages"
            className="text-foreground decoration-muted-foreground/40 hover:decoration-brand underline underline-offset-4"
          >
            package index
          </Link>
          , dependencies included:
        </p>
        <CommandBlock command="cpm install <name>" className="text-xs" />
      </>
    ),
  },
];

/** The install walkthrough as a plain vertical step list. */
export function GetStarted() {
  return (
    <ol className="max-w-2xl">
      {STEPS.map((step, index) => (
        <li key={step.title} className="relative flex gap-5 pb-10 last:pb-0">
          {index < STEPS.length - 1 && (
            <span className="bg-border absolute top-10 bottom-2 left-4 w-px" aria-hidden="true" />
          )}
          <span className="border-border bg-card text-muted-foreground grid size-8 shrink-0 place-items-center rounded-full border font-mono text-sm">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1 space-y-3 pt-1">
            <h3 className="leading-6 font-medium">{step.title}</h3>
            <div className="text-muted-foreground space-y-3 text-sm">{step.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
