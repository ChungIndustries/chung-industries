import { Badge } from "@workspace/ui/components/badge";

/** The badge marking a deprecated version wherever versions are listed. */
export function DeprecatedBadge() {
  return (
    <Badge variant="destructive" className="font-display rounded-none text-[10px]">
      deprecated
    </Badge>
  );
}
