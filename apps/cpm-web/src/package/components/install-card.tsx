import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";

import { CommandBlock } from "@/components/command-block";

export function InstallCard({ command }: { command: string }) {
  return (
    <Card size="sm" className="gap-3">
      <CardHeader>
        <CardTitle className="font-display text-xs">Install</CardTitle>
      </CardHeader>
      <CardContent>
        <CommandBlock command={command} className="text-xs" />
      </CardContent>
    </Card>
  );
}
