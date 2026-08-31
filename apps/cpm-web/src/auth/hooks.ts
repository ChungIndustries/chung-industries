import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { authClient } from "@/auth/client";
import { authKeys } from "@/auth/queries";
import type { CreateTokenInput } from "@/auth/schemas";

const DAY_S = 24 * 60 * 60;

/**
 * Starts the GitHub OAuth dance; Better Auth's client navigates the browser
 * to GitHub itself, so a successful mutation never "completes" here. Failures
 * (before the redirect) surface as mutation errors.
 */
export function useSignInWithGithub() {
  return useMutation({
    mutationFn: async (callbackURL: string) => {
      const { error } = await authClient.signIn.social({
        provider: "github",
        callbackURL,
        errorCallbackURL: "/signin",
      });
      if (error) throw new Error(error.message ?? "Sign-in failed");
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signOut();
      if (error) throw new Error(error.message ?? "Sign-out failed");
    },
    onSuccess: async () => {
      // Leave any session-guarded page before the session query empties, so
      // the guard never races the sign-out.
      await router.navigate({ to: "/" });
      await queryClient.invalidateQueries({ queryKey: authKeys.all });
      await router.invalidate();
    },
  });
}

/** Mints a publish token. The result's `key` is the raw secret, shown once. */
export function useCreateToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, expiresInDays }: CreateTokenInput) => {
      const { data, error } = await authClient.apiKey.create({
        name,
        expiresIn: expiresInDays * DAY_S,
      });
      if (error || !data) throw new Error(error?.message ?? "The token could not be created");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.tokens }),
  });
}

export function useRevokeToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await authClient.apiKey.delete({ keyId });
      if (error) throw new Error(error.message ?? "The token could not be revoked");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.tokens }),
  });
}
