import { queryOptions } from "@tanstack/react-query";

import { fetchMyPackages, fetchSession, fetchTokens } from "@/auth/server";

export const authKeys = {
  all: ["auth"] as const,
  session: ["auth", "session"] as const,
  tokens: ["auth", "tokens"] as const,
  packages: ["auth", "packages"] as const,
};

export const sessionQueryOptions = queryOptions({
  queryKey: authKeys.session,
  queryFn: () => fetchSession(),
  staleTime: 60_000,
  retry: false,
});

export const tokensQueryOptions = queryOptions({
  queryKey: authKeys.tokens,
  queryFn: () => fetchTokens(),
  staleTime: 15_000,
});

export const myPackagesQueryOptions = queryOptions({
  queryKey: authKeys.packages,
  queryFn: () => fetchMyPackages(),
  staleTime: 60_000,
});
