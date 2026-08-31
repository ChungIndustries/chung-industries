import { createFileRoute, redirect } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Suspense } from "react";

import { MyPackages, MyPackagesSkeleton } from "@/auth/components/my-packages";
import { TokenInventory, TokenInventorySkeleton } from "@/auth/components/token-inventory";
import { myPackagesQueryOptions, sessionQueryOptions, tokensQueryOptions } from "@/auth/queries";

export const Route = createFileRoute("/account")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions).catch(() => null);
    if (!session) {
      throw redirect({ to: "/signin", search: { redirect: location.pathname } });
    }
    return { session };
  },
  // Awaited: both reads are one cheap service-binding call, and blocking the
  // loader on them means the page arrives complete instead of as skeletons.
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(tokensQueryOptions),
      context.queryClient.ensureQueryData(myPackagesQueryOptions),
    ]),
  head: () => ({ meta: [{ title: "account | cpm" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { session } = Route.useRouteContext();
  const { user } = session;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pt-8 pb-12">
      <div className="flex items-center gap-4">
        <Avatar className="size-14">
          <AvatarImage src={user.image ?? undefined} alt="" />
          <AvatarFallback className="text-lg">
            {user.name.slice(0, 1).toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="font-display truncate text-xl">{user.name}</h1>
          <p className="text-muted-foreground truncate text-sm">{user.email}</p>
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-6">
        <Suspense fallback={<TokenInventorySkeleton />}>
          <TokenInventory />
        </Suspense>
        <Suspense fallback={<MyPackagesSkeleton />}>
          <MyPackages />
        </Suspense>
      </div>
    </div>
  );
}
