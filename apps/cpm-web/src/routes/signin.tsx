import { createFileRoute, redirect } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Spinner } from "@workspace/ui/components/spinner";

import { useSignInWithGithub } from "@/auth/hooks";
import { sessionQueryOptions } from "@/auth/queries";
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
    <div className="mx-auto flex w-full max-w-5xl justify-center px-6 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display text-lg">Sign in</CardTitle>
          <CardDescription>
            cpm accounts are GitHub accounts. Sign in to see your packages and mint the publish
            tokens your machines authenticate with.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            className="w-full"
            disabled={signIn.isPending}
            onClick={() => signIn.mutate(redirectTo ?? "/account")}
          >
            {signIn.isPending ? <Spinner /> : <GithubIcon className="size-4" />}
            Continue with GitHub
          </Button>
          {(signIn.error || error) && (
            <p className="text-destructive text-sm">
              {signIn.error?.message ?? "GitHub sign-in did not complete. Try again."}
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            Browsing and installing packages never needs an account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
