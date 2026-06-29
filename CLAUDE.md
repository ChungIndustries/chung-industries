# ChungIndustries Monorepo

ChungIndustries recreates the internet inside Minecraft (ComputerCraft / CC:Tweaked), with supporting web services in TypeScript.

## Architecture

NX + pnpm monorepo.

- `apps/`: deployable apps and end-user tools
  - `cpm-registry`: TypeScript/Express registry API for the Chung Package Manager (cpm)
  - `web`: React/Supabase app (currently template boilerplate)
- `packages/`: shared TypeScript libraries (`@workspace/*`)
- `supabase/`: Supabase config, migrations, edge functions (Deno runtime, NOT a workspace package)

## Conventions

- Use `pnpm`, never `npm` or `yarn`. Run tasks through NX (`nx <target> <project>`, `nx run-many`, `nx affected`).
- Group feature code by domain (vertical slices), not by technology.
- Projects are NX projects via their `package.json` (targets inferred from scripts).

## Branching & releases

- `main` + short-lived feature branches. PRs target `main`.
- Conventional Commits (enforced by commitlint).
- Releases are independent per project via `nx release` with version plans (`.nx/version-plans/`). Add a version plan with `nx release plan` in your PR; pushing to `main` versions, changelogs, and tags only the projects with pending plans.

## Commands

See `scripts` in the root `package.json` and each project's `package.json`.
