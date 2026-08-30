import { Link } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { useState } from "react";

import { CommandBlock } from "@/cli/components/command-block";
import { Cursor, Prompt, TerminalWindow } from "@/cli/components/terminal";
import { INSTALL_COMMAND } from "@/site";

interface Step {
  title: string;
  /** The expanded detail under the selected step's title. */
  body: ReactNode;
  /** What the computer's screen shows at this point. */
  screen: ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Craft a computer",
    body: <p>Any computer in a world with HTTP enabled will do.</p>,
    screen: (
      <>
        <p className="text-screen-yellow">CraftOS 1.9</p>
        <p>
          <Prompt>
            <Cursor />
          </Prompt>
        </p>
      </>
    ),
  },
  {
    title: "Bootstrap cpm",
    body: (
      <>
        <p>Run the installer straight off the registry:</p>
        <CommandBlock command={INSTALL_COMMAND} className="text-xs" />
      </>
    ),
    screen: (
      <>
        <p className="whitespace-nowrap">
          <Prompt>wget run registry.cpm.chungindustries.com/install</Prompt>
        </p>
        <p className="text-screen-muted">Connecting to registry...</p>
        <p className="text-screen-green">cpm installed. Run `cpm` to get started.</p>
        <p>
          <Prompt>
            <Cursor />
          </Prompt>
        </p>
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
    screen: (
      <>
        <p>
          <Prompt>cpm install mail</Prompt>
        </p>
        <p className="text-screen-muted">Resolving mail@^1.1.0...</p>
        <p className="text-screen-green">+ mail (and 2 dependencies) installed.</p>
        <p>
          <Prompt>
            <Cursor />
          </Prompt>
        </p>
      </>
    ),
  },
];

/**
 * A vertical stepper: the selected step expands on the left while the right
 * panel shows that moment on the computer's screen.
 */
export function GetStarted() {
  const [active, setActive] = useState(0);

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-2 md:gap-14">
        <ol>
          {STEPS.map((step, index) => {
            const selected = index === active;
            return (
              <li
                key={step.title}
                className={cn(
                  "border-l-2 pl-6 transition-colors",
                  selected ? "border-brand" : "border-border",
                )}
              >
                <Button
                  variant="ghost"
                  onClick={() => setActive(index)}
                  aria-expanded={selected}
                  className="block h-auto w-full justify-start p-0 py-3.5 text-left whitespace-normal hover:bg-transparent dark:hover:bg-transparent"
                >
                  <span
                    className={cn(
                      "font-mono text-xs",
                      selected ? "text-brand" : "text-muted-foreground",
                    )}
                  >
                    0{index + 1}
                  </span>
                  <span
                    className={cn(
                      "mt-1 block text-base font-medium transition-colors",
                      !selected && "text-muted-foreground",
                    )}
                  >
                    {step.title}
                  </span>
                </Button>
                <AnimatePresence initial={false}>
                  {selected && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="text-muted-foreground max-w-md space-y-3 pb-5 text-sm">
                        {step.body}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ol>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <TerminalWindow label={`The computer's screen after step ${active + 1}`}>
              <div className="min-h-28">{STEPS[active].screen}</div>
            </TerminalWindow>
          </motion.div>
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
