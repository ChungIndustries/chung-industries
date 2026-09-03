# ChungIndustries Monorepo

ChungIndustries recreates the internet inside Minecraft (ComputerCraft / CC:Tweaked), with supporting web services in TypeScript.

## Architecture

NX + pnpm monorepo.

- `apps/`: deployable apps and end-user tools
  - `cpm-registry`: TypeScript/Hono Cloudflare Worker, the registry API for the Chung Package Manager (cpm)
  - `cpm-web`: the registry website (sign-in, account, publish tokens)
  - `cpm-cli`: the in-game cpm client, Lua, published to the registry as the `cpm` package
  - `cpm-tool`: Go/Cobra CLI for real computers (`cpm login|logout|whoami|pack|publish`); its registry types are generated from `cpm-registry`'s `openapi.yaml`
  - `docs`: API docs site
  - `web`: React/Supabase app (currently template boilerplate)
- `packages/`: shared libraries: TypeScript (`@workspace/*`), and ComputerCraft packages published to the cpm registry under `packages/cc/*` (`cli`)
- `supabase/`: Supabase config, migrations, edge functions (Deno runtime, NOT a workspace package)

## Conventions

- Use `pnpm`, never `npm` or `yarn`. Run tasks through NX (`nx <target> <project>`, `nx run-many`, `nx affected`).
- Group feature code by domain (vertical slices), not by technology.
- Projects are NX projects via their `package.json` (targets inferred from scripts, or declared under `nx.targets` for non-Node projects such as the Lua packages and the Go tool).
- Lua packages carry a committed `cpm.json` (name, root, startup, dependencies); version and description come from `package.json` so `nx release` stays the single source of truth. Their `build` and `publish:registry` targets run the Go tool from source.

## Environment & secrets

- Each deployable validates its env once in an `env.ts` (zod handles defaults, coercion, validation) and exports a typed `env`. Nothing else reads `process.env` / `Deno.env` / `import.meta.env`.
- Multiple environments use the standard `.env` cascade (`.env` committed defaults → `.env.<mode>` → `.env.local` gitignored secrets); real process env wins. Loaded by Vite (web), `dotenv-flow` (cpm-registry), and the edge runtime (supabase functions).
- Supabase `config.toml` secrets use `env(VAR)`; mirror them as `secrets.*` in `deploy-supabase.yml`.

## Branching & releases

- `main` + short-lived feature branches. PRs target `main`.
- Conventional Commits (enforced by commitlint).
- Releases are independent per project via `nx release` with version plans (`.nx/version-plans/`). Add a version plan with `nx release plan` in your PR; pushing to `main` versions, changelogs, and tags only the projects with pending plans.

## Commands

See `scripts` in the root `package.json` and each project's `package.json`.
