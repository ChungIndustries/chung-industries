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
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/utils";
import { KeyRound } from "lucide-react";

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

const SOON_MS = 14 * 24 * 60 * 60 * 1000;

type ExpiryStatus = "ok" | "soon" | "expired";

function expiryStatus(expiresAt: string | null): ExpiryStatus {
  if (expiresAt === null) return "ok";
  const remaining = Date.parse(expiresAt) - Date.now();
  if (remaining <= 0) return "expired";
  return remaining < SOON_MS ? "soon" : "ok";
}

/** A square pixel of CraftOS terminal colour: the token's health at a glance. */
function StatusPixel({ status }: { status: ExpiryStatus }) {
  return (
    <span
      className={cn("size-2 shrink-0", {
        "bg-screen-green": status === "ok",
        "bg-screen-yellow": status === "soon",
        "bg-screen-red": status === "expired",
      })}
      aria-hidden="true"
    />
  );
}

export function TokenInventory() {
  const { data: tokens } = useSuspenseQuery(tokensQueryOptions);

  if (tokens.length === 0) {
    return (
      <div className="border-border flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-12 text-center">
        <span className="border-border bg-card text-muted-foreground grid size-10 place-items-center rounded-md border">
          <KeyRound className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-medium">No tokens yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Mint one to publish your first package.
          </p>
        </div>
        <CreateTokenDialog />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm" suppressHydrationWarning>
          {tokens.length} {tokens.length === 1 ? "token" : "tokens"}
        </p>
        <CreateTokenDialog />
      </div>
      <ul className="border-border divide-border divide-y rounded-lg border">
        {tokens.map((token) => (
          <TokenRow key={token.id} token={token} />
        ))}
      </ul>
    </div>
  );
}

function TokenRow({ token }: { token: PublishToken }) {
  const status = expiryStatus(token.expiresAt);
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0" suppressHydrationWarning>
        <div className="flex items-center gap-2.5">
          <StatusPixel status={status} />
          <span className="truncate font-medium">{token.name ?? "unnamed"}</span>
          {token.start && (
            <code className="text-muted-foreground shrink-0 font-mono text-xs">{token.start}…</code>
          )}
        </div>
        <p className="text-muted-foreground mt-1 pl-[18px] text-xs">
          Created <time dateTime={token.createdAt}>{formatTimeAgo(token.createdAt)}</time>
          <span className="mx-1.5" aria-hidden="true">
            ·
          </span>
          {token.expiresAt === null ? (
            "Never expires"
          ) : status === "expired" ? (
            <span className="text-screen-red">
              Expired {EXPIRY_DATE.format(new Date(token.expiresAt))}
            </span>
          ) : (
            <span className={status === "soon" ? "text-screen-yellow" : undefined}>
              Expires {EXPIRY_DATE.format(new Date(token.expiresAt))}
            </span>
          )}
          <span className="mx-1.5" aria-hidden="true">
            ·
          </span>
          {token.lastRequest ? (
            <>
              Last used <time dateTime={token.lastRequest}>{formatTimeAgo(token.lastRequest)}</time>
            </>
          ) : (
            "Never used"
          )}
        </p>
      </div>
      <RevokeTokenButton token={token} />
    </li>
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="border-border divide-border divide-y rounded-lg border">
        <div className="px-4 py-3.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-3.5 w-72 max-w-full" />
        </div>
        <div className="px-4 py-3.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-2 h-3.5 w-64 max-w-full" />
        </div>
      </div>
    </div>
  );
}
