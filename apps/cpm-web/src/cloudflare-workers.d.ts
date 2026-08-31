/**
 * Structural typing for the `cloudflare:workers` env import used by server
 * functions. Kept minimal and DOM-compatible on purpose: pulling in
 * @cloudflare/workers-types would clash with the DOM lib this app compiles
 * against. Must mirror the bindings declared in wrangler.toml.
 */
declare module "cloudflare:workers" {
  export const env: {
    /** Service binding to the cpm-registry Worker. */
    REGISTRY: {
      fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
    };
  };
}
