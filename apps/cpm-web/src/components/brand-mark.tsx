import { cn } from "@workspace/ui/lib/utils";

/** The gold advanced-computer tile carrying the site's wordmark. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-brand text-background font-display rounded-sm px-1.5 pt-1 pb-0.5 text-sm leading-none",
        className,
      )}
    >
      cpm
    </span>
  );
}
