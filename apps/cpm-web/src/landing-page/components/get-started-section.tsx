import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { CommandBlock } from "@/components/command-block";
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
          <Link to="/packages" className="text-brand font-medium hover:underline">
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
function Steps() {
  return (
    <ol className="max-w-2xl">
      {STEPS.map((step, index) => (
        <li key={step.title} className="relative flex gap-5 pb-10 last:pb-0">
          {index < STEPS.length - 1 && (
            <span
              className="pixel-line-y absolute top-10 bottom-2 left-[15px] w-0.5"
              aria-hidden="true"
            />
          )}
          <span className="border-border bg-card text-muted-foreground font-display grid size-8 shrink-0 place-items-center rounded-full border text-xs">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1 space-y-3 pt-1">
            <h3 className="font-display text-sm leading-6">{step.title}</h3>
            <div className="text-muted-foreground space-y-3 text-sm">{step.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function GetStartedSection() {
  return (
    <section id="get-started" className="mx-auto max-w-5xl scroll-mt-20 px-6 py-16 md:py-20">
      <h2 className="font-display text-xl">Get started</h2>
      <div className="mt-8">
        <Steps />
      </div>
    </section>
  );
}
