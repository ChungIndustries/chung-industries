import { queryOptions } from "@tanstack/react-query";

import { fetchPackage, fetchPackages, fetchReadme } from "@/package/server";

export const packagesQueryOptions = queryOptions({
  queryKey: ["packages"],
  queryFn: () => fetchPackages(),
  staleTime: 60_000,
});

export const packageQueryOptions = (name: string) =>
  queryOptions({
    queryKey: ["packages", name],
    queryFn: () => fetchPackage({ data: name }),
    staleTime: 60_000,
  });

export const readmeQueryOptions = (name: string, version: string) =>
  queryOptions({
    queryKey: ["packages", name, version, "readme"],
    queryFn: () => fetchReadme({ data: { name, version } }),
    // Published versions are immutable, so their README never changes.
    staleTime: Infinity,
  });
