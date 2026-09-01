import { createFileRoute, redirect } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";

import { useSignInWithGithub } from "@/auth/hooks";
import { sessionQueryOptions } from "@/auth/queries";
import { GithubIcon } from "@/components/icons";
import {
  Cursor,
  Prompt,
  TerminalScript,
  TerminalWindow,
  scriptDuration,
  type ScriptLine,
} from "@/terminal/terminal";

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

/* Signing in as the computer would do it: `cpm login` runs, then the screen
   waits on the one step only a browser can do. */
const SCRIPT: ScriptLine[] = [
  { kind: "command", text: "cpm login" },
  { kind: "output", text: "Authenticating with GitHub...", className: "text-screen-muted" },
];

const SCRIPT_END = scriptDuration(SCRIPT);

function SignInPage() {
  const { redirect: redirectTo, error } = Route.useSearch();
  const signIn = useSignInWithGithub();

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <h1 className="font-display text-2xl">Sign in</h1>

        <TerminalWindow interactive label="Sign in" className="w-full">
          <div aria-hidden="true">
            <TerminalScript script={SCRIPT} />
          </div>
          <div
            className="animate-[reveal_0s_both] py-2 motion-reduce:animate-none"
            style={{ animationDelay: `${SCRIPT_END}s` }}
          >
            <Button
              className="w-full"
              disabled={signIn.isPending}
              onClick={() => signIn.mutate(redirectTo ?? "/account")}
            >
              {signIn.isPending ? <Spinner /> : <GithubIcon className="size-4" />}
              Continue with GitHub
            </Button>
          </div>
          {(signIn.error || error) && (
            <p className="text-screen-red" role="alert">
              {signIn.error?.message ?? "GitHub sign-in did not complete. Try again."}
            </p>
          )}
          <p
            className="animate-[reveal_0s_both] motion-reduce:animate-none"
            style={{ animationDelay: `${SCRIPT_END}s` }}
            aria-hidden="true"
          >
            <Prompt>
              <Cursor />
            </Prompt>
          </p>
        </TerminalWindow>

        <p className="text-muted-foreground text-center text-xs text-balance">
          You don't need an account to browse or install packages.
        </p>
      </div>
    </div>
  );
}
