<div align="center">

# ChungIndustries

**Recreating the Internet in Minecraft.**

[![Nx](https://img.shields.io/badge/Nx-23-143055?style=for-the-badge&logo=nx&logoColor=white)](https://nx.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?style=for-the-badge&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

ChungIndustries rebuilds real internet infrastructure inside Minecraft using ComputerCraft / CC:Tweaked (Lua), with supporting web services in TypeScript. This is the NX + pnpm monorepo for the ecosystem.

## Projects

| Project                             | Stack                   | Description                                                                     |
| ----------------------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| [`cpm-registry`](apps/cpm-registry) | TypeScript · Express    | Registry API for the Chung Package Manager; hosts package metadata and tarballs |
| [`web`](apps/web)                   | React · Vite · Supabase | Web app (currently template boilerplate)                                        |
| [`packages/*`](packages)            | TypeScript              | `@workspace/*` shared configuration and libraries                               |

See each project's own README for how to run and configure it.

## Stack & tooling

- [**NX**](https://nx.dev): task running, caching, affected graph, and releases
- [**pnpm**](https://pnpm.io) workspaces
- [**TypeScript**](https://www.typescriptlang.org/)
- [**oxlint**](https://oxc.rs) + [**oxfmt**](https://oxc.rs) for linting and formatting
- [**Supabase**](https://supabase.com/) for the web app's backend
- [**Commitlint**](https://commitlint.js.org/) + [**Husky**](https://typicode.github.io/husky/) for Conventional Commits

## Prerequisites

- [Node.js](https://nodejs.org/) >= 24, [pnpm](https://pnpm.io/) >= 10
- [Docker](https://www.docker.com/) for the web app's local Supabase

## Getting started

```bash
pnpm install
```

NX runs each project's targets (inferred from its `package.json` scripts):

```bash
nx <target> <project>    # e.g. nx build cpm-registry
nx run-many -t <target>  # across all projects
nx affected -t <target>  # only projects affected by your changes
nx graph                 # visualize the project graph
```

| Command                                              | Description                    |
| ---------------------------------------------------- | ------------------------------ |
| `pnpm dev` / `build` / `lint` / `typecheck` / `test` | Run the target across projects |
| `pnpm format` / `format:check`                       | Format with oxfmt              |
| `pnpm release`                                       | Run `nx release` (see below)   |
| `pnpm db:start` / `db:reset` / `db:gen-types`        | Local Supabase (web app)       |

## Branching & releases

- **`main` + short-lived feature branches.** PRs target `main`.
- **Conventional Commits**, enforced by commitlint.
- **Releases are independent per project.** To schedule one, add a version plan in your PR:

  ```bash
  nx release plan
  ```

  This records the intended version bump for each affected project. On push to `main`, the `Release` workflow versions, changelogs, and tags only the projects with pending plans (tags follow `{projectName}@{version}`).

## CI

| Workflow                                     | Trigger             | What                                                        |
| -------------------------------------------- | ------------------- | ----------------------------------------------------------- |
| `ci.yml`                                     | PR / push to `main` | `nx affected` typecheck / lint / test / build + oxfmt check |
| `commitlint.yml`                             | PR                  | Conventional commit validation                              |
| `release.yml`                                | push to `main`      | `nx release` when version plans are present                 |
| `generate-types.yml` / `deploy-supabase.yml` | supabase changes    | Supabase types check / deploy                               |

## License

MIT where applicable. See individual `LICENSE` files.
