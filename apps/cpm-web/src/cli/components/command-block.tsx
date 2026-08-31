import { useCopyToClipboard } from "@workspace/hooks/use-copy-to-clipboard";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { Check, Copy } from "lucide-react";

/** A copyable shell command, rendered as a terminal prompt line. */
export function CommandBlock({ command, className }: { command: string; className?: string }) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div
      className={cn(
        "border-border bg-card flex items-center gap-2 rounded-md border py-1 pr-1 pl-3 font-mono text-sm",
        className,
      )}
    >
      <span className="text-brand select-none">&gt;</span>
      <code className="flex-1 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-x-auto py-1 whitespace-nowrap">
        {command}
      </code>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => copy(command)}
        aria-label={copied ? "Copied" : `Copy ${command}`}
      >
        {copied ? <Check className="text-green-500" /> : <Copy />}
      </Button>
    </div>
  );
}
