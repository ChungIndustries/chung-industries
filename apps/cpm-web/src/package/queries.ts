import { queryOptions } from "@tanstack/react-query";

import { fetchPackage, fetchPackages, fetchReadme } from "@/package/api";

export const packagesQueryOptions = queryOptions({
  queryKey: ["packages"],
  queryFn: fetchPackages,
  staleTime: 60_000,
});

export const packageQueryOptions = (name: string) =>
  queryOptions({
    queryKey: ["packages", name],
    queryFn: () => fetchPackage(name),
    staleTime: 60_000,
  });

export const readmeQueryOptions = (name: string, version: string) =>
  queryOptions({
    queryKey: ["packages", name, version, "readme"],
    queryFn: () => fetchReadme(name, version),
    // Published versions are immutable, so their README never changes.
    staleTime: Infinity,
  });
