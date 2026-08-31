import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { toRegistryAuthRequest } from "@/auth/proxy";

/**
 * Same-origin proxy for the registry's Better Auth routes (GitHub OAuth,
 * sessions, publish-token minting). Better Auth only speaks GET and POST.
 * Forwarding over the service binding keeps the whole flow on this origin:
 * the session cookie is first-party and the registry needs no public CORS.
 */
const proxy = async ({ request }: { request: Request }) =>
  env.REGISTRY.fetch(await toRegistryAuthRequest(request));

export const Route = createFileRoute("/auth/$")({
  server: {
    handlers: {
      GET: proxy,
      POST: proxy,
    },
  },
});
