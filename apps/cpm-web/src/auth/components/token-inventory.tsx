import { useSuspenseQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { CreateTokenDialog } from "@/auth/components/create-token-dialog";
import { useRevokeToken } from "@/auth/hooks";
import { tokensQueryOptions } from "@/auth/queries";
import type { PublishToken } from "@/auth/schemas";
import { formatTimeAgo } from "@/package/search";

/** Deterministic across server and client: fixed locale, fixed time zone. */
const EXPIRY_DATE = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export function TokenInventory() {
  const { data: tokens } = useSuspenseQuery(tokensQueryOptions);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">Publish tokens</CardTitle>
        <CardDescription>
          Tokens authenticate <code>cpm</code> publishes from real machines and CI. Each one is
          shown once at creation and can be revoked here at any time.
        </CardDescription>
        <CardAction>
          <CreateTokenDialog />
        </CardAction>
      </CardHeader>
      <CardContent>
        {tokens.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No tokens yet. Mint one to publish your first package.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((token) => (
                <TokenRow key={token.id} token={token} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function TokenRow({ token }: { token: PublishToken }) {
  const expired = token.expiresAt !== null && Date.parse(token.expiresAt) <= Date.now();
  return (
    <TableRow>
      <TableCell className="font-medium">{token.name ?? "unnamed"}</TableCell>
      <TableCell className="text-muted-foreground font-mono">
        {token.start ? `${token.start}…` : "—"}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {/* Relative time drifts between server render and hydration. */}
        <time dateTime={token.createdAt} suppressHydrationWarning>
          {formatTimeAgo(token.createdAt)}
        </time>
      </TableCell>
      <TableCell className={expired ? "text-destructive" : "text-muted-foreground"}>
        {token.expiresAt === null
          ? "never"
          : expired
            ? "expired"
            : EXPIRY_DATE.format(new Date(token.expiresAt))}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {token.lastRequest ? (
          <time dateTime={token.lastRequest} suppressHydrationWarning>
            {formatTimeAgo(token.lastRequest)}
          </time>
        ) : (
          "never"
        )}
      </TableCell>
      <TableCell className="text-right">
        <RevokeTokenButton token={token} />
      </TableCell>
    </TableRow>
  );
}

function RevokeTokenButton({ token }: { token: PublishToken }) {
  const revoke = useRevokeToken();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          Revoke
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke {token.name ?? "this token"}?</AlertDialogTitle>
          <AlertDialogDescription>
            Any machine still using it loses publish access immediately. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={revoke.isPending}
            onClick={() => revoke.mutate(token.id)}
          >
            Revoke token
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function TokenInventorySkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">Publish tokens</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}
