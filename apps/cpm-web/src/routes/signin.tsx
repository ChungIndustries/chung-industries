import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";

import { useSignInWithGithub } from "@/auth/hooks";
import { sessionQueryOptions } from "@/auth/queries";
import { BrandMark } from "@/components/brand-mark";
import { GithubIcon } from "@/components/icons";

interface SignInSearchParams {
  /** Where to land after signing in. Same-site paths only, or it is dropped. */
  redirect?: string;
  /** Set by Better Auth when the OAuth dance fails or is cancelled. */
  error?: string;
}

function safeRedirect(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : undefined;
}

export const Route = createFileRoute("/signin")({
  validateSearch: (search: Record<string, unknown>): SignInSearchParams => ({
    redirect: safeRedirect(search.redirect),
    error: typeof search.error === "string" && search.error !== "" ? search.error : undefined,
  }),
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient
      .ensureQueryData(sessionQueryOptions)
      .catch(() => null);
    if (session) throw redirect({ href: search.redirect ?? "/account" });
  },
  head: () => ({ meta: [{ title: "sign in | cpm" }] }),
  component: SignInPage,
});

function SignInPage() {
  const { redirect: redirectTo, error } = Route.useSearch();
  const signIn = useSignInWithGithub();

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <Link to="/" aria-label="cpm home">
            <BrandMark className="px-2.5 pt-1.5 pb-1 text-xl" />
          </Link>
          <div>
            <h1 className="font-display text-2xl">
              Sign in
              <span
                className="bg-brand animate-blink ml-2 inline-block h-[0.75em] w-[0.45em]"
                aria-hidden="true"
              />
            </h1>
            <p className="text-muted-foreground mt-3 text-sm text-balance">
              One GitHub account is your cpm account — the first sign-in creates it.
            </p>
          </div>
        </div>

        <div className="border-border bg-card overflow-hidden rounded-lg border">
          <div className="pixel-rule" aria-hidden="true" />
          <div className="flex flex-col gap-4 p-6">
            <Button
              size="lg"
              className="w-full"
              disabled={signIn.isPending}
              onClick={() => signIn.mutate(redirectTo ?? "/account")}
            >
              {signIn.isPending ? <Spinner /> : <GithubIcon className="size-4" />}
              Continue with GitHub
            </Button>
            {(signIn.error || error) && (
              <p className="text-destructive text-center text-sm" role="alert">
                {signIn.error?.message ?? "GitHub sign-in did not complete. Try again."}
              </p>
            )}
            <p className="text-muted-foreground text-center text-xs text-balance">
              cpm reads only your public profile and email address, and never posts as you.
            </p>
          </div>
        </div>

        <p className="text-muted-foreground text-center text-xs">
          Browsing and installing packages never needs an account.
        </p>
      </div>
    </div>
  );
}
