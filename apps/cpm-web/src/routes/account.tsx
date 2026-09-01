import { createFileRoute, redirect } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import type { ReactNode } from "react";
import { Suspense } from "react";

import { MyPackages, MyPackagesSkeleton } from "@/auth/components/my-packages";
import { TokenInventory, TokenInventorySkeleton } from "@/auth/components/token-inventory";
import { myPackagesQueryOptions, sessionQueryOptions, tokensQueryOptions } from "@/auth/queries";
import { GithubIcon } from "@/components/icons";

export const Route = createFileRoute("/account")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient
      .ensureQueryData(sessionQueryOptions)
      .catch(() => null);
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

/**
 * A settings section: pixel-display label and description in the left rail,
 * content on the right, npm-settings style.
 */
function AccountSection({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-6 py-10 md:grid-cols-[240px_1fr] md:gap-10">
      <div>
        <h2 className="font-display text-base">{title}</h2>
        <p className="text-muted-foreground mt-2 text-sm">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function AccountPage() {
  const { session } = Route.useRouteContext();
  const { user } = session;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pt-10 pb-16">
      <header className="flex items-center gap-5">
        {/* Square, like the brand tile: the site's avatars are computers. */}
        <Avatar className="size-16 rounded-md after:rounded-md">
          <AvatarImage src={user.image ?? undefined} alt="" className="rounded-md" />
          <AvatarFallback className="font-display rounded-md text-xl">
            {user.name.slice(0, 1).toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="font-display truncate text-2xl">{user.name}</h1>
          <p className="text-muted-foreground mt-1 truncate font-mono text-sm">{user.email}</p>
        </div>
        <Badge
          variant="outline"
          className="font-display ml-auto hidden gap-1.5 rounded-none text-[10px] sm:inline-flex"
        >
          <GithubIcon className="size-3" />
          GitHub account
        </Badge>
      </header>

      <div className="pixel-rule mt-8" aria-hidden="true" />

      <AccountSection
        title="Publish tokens"
        description={
          <>
            The credential machines publish with, sent as{" "}
            <code className="font-mono text-xs">Authorization: Bearer</code>. One named token per
            machine, shown once at creation, revocable here at any time.
          </>
        }
      >
        <Suspense fallback={<TokenInventorySkeleton />}>
          <TokenInventory />
        </Suspense>
      </AccountSection>

      <div className="pixel-rule" aria-hidden="true" />

      <AccountSection
        title="Your packages"
        description="Names you own or maintain on the registry. The first authenticated publish of a new name claims it."
      >
        <Suspense fallback={<MyPackagesSkeleton />}>
          <MyPackages />
        </Suspense>
      </AccountSection>
    </div>
  );
}
