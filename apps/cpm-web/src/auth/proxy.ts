/**
 * Request rewriting for the same-origin `/auth/*` proxy (see routes/auth.$.ts).
 *
 * The registry Worker runs Better Auth with this site's origin as its base
 * URL, so every auth cookie and OAuth redirect lives on cpm.chungindustries.com
 * and the browser never talks to the registry origin directly. This module is
 * pure (no Cloudflare imports) so it stays unit-testable.
 */

// The hostname is arbitrary; service bindings route by binding, not DNS.
const REGISTRY = "https://cpm-registry";

/**
 * Rebuilds an incoming `/auth/*` request against the registry origin, keeping
 * the path, query, method, headers, and body intact.
 *
 * The body is buffered rather than streamed: auth payloads are tiny JSON, and
 * a buffered body avoids the runtime-specific rules around streaming request
 * bodies. `redirect: "manual"` is load-bearing: OAuth responses are 302s to
 * GitHub, and they must pass through to the browser rather than be followed
 * by the Worker.
 */
export async function toRegistryAuthRequest(request: Request): Promise<Request> {
  const url = new URL(request.url);
  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  return new Request(`${REGISTRY}${url.pathname}${url.search}`, {
    method: request.method,
    headers: request.headers,
    body,
    redirect: "manual",
  });
}
