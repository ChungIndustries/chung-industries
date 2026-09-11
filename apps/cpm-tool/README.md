# cpm-tool

The `cpm` command for real computers: it logs in to the [cpm registry](../cpm-registry), packs a package, and publishes it, from a terminal or from CI. It is the authoring-side counterpart of the in-game client ([apps/cpm-cli](../cpm-cli)), which installs packages on CC:Tweaked computers.

Written in Go with [Cobra](https://github.com/spf13/cobra). Standalone binaries and an install script are the next step; today it runs from source.

## Commands

```
cpm login              save a publish token for a registry (prompted, piped, or --token)
cpm logout             forget the saved token
cpm whoami             show the account, token, and scopes behind the current credential
cpm pack               build dist/<name>-<version>.tgz from the package's cpm.json
cpm publish            pack and upload to the registry
```

Every command takes `--registry <url>`; `pack` and `publish` take `--dir <package directory>` (default: the current directory).

Publish tokens are created on the registry website's account page (`https://cpm.chungindustries.com/account` for the official registry). `login` verifies the token with the registry before saving it, and warns if it cannot publish.

`publish` treats a version the registry already has (HTTP 409) as success, so a re-run of a release is a no-op rather than a failure.

### Credential and registry precedence

| Setting  | Order                                                                                  |
| -------- | -------------------------------------------------------------------------------------- |
| Registry | `--registry`, then `CPM_REGISTRY_URL`, then `https://registry.cpm.chungindustries.com` |
| Token    | `--token`, then `CPM_REGISTRY_TOKEN`, then the saved login for that registry           |

Saved logins live in `cpm/config.json` under the OS user config directory (`~/.config` on Linux, `~/Library/Application Support` on macOS, `%AppData%` on Windows), keyed by registry URL and readable by you only. `CPM_CONFIG` overrides the path. CI sets the two environment variables and never logs in.

## The package manifest: `cpm.json`

A package is a directory with a `cpm.json`:

```json
{
  "name": "greet",
  "version": "1.2.0",
  "description": "Greeting utilities",
  "author": "someone",
  "startup": "startup.lua",
  "dependencies": { "cli": "^0.0.3" },
  "root": "src"
}
```

- `name` (required): letters, digits, hyphens, and underscores. Dots are reserved.
- `version` (required): a semantic version.
- `description`, `author`, `startup`, `dependencies`: as the registry defines them. `startup` must exist in the package root; dependency ranges are semver ranges.
- `root`: the directory whose contents are the package files (default: the directory holding `cpm.json`). Tooling-only; it is not part of the manifest the registry sees. `.git`, `node_modules`, and `dist` are never packed.

`pack` writes the resolved manifest as `cpm.json` at the tarball root, which the registry treats as the metadata source of truth. Tarballs are reproducible: sorted entries, fixed zero mtime, fixed owner and mode.

### Bridging to a Node workspace

Two conveniences keep `nx release` the single source of truth for the packages in this repo, and cost nothing outside it:

- `version`, `description`, and `author` may be omitted from `cpm.json` when a `package.json` beside it supplies them.
- A dependency range of `workspace:^`, `workspace:~`, or `workspace:*` is resolved the way pnpm does on publish: against the current version of the workspace package with that name (found by its own `cpm.json` under the nearest `pnpm-workspace.yaml`). This is how the `cpm` package's range on `cli` tracks the cli it was built against.

## In this repo

The Lua packages' `build` and `publish:registry` nx targets run the tool from source (`go run ./cmd/cpm ...` in this directory), so `nx build cli` packs and `nx publish:registry cpm-cli` publishes with no install step. Release publishes go through `.github/workflows/publish-package.yml`, which is the same command with `CPM_REGISTRY_URL` and `CPM_REGISTRY_TOKEN` from repository settings.

To use it by hand from a checkout:

```bash
go run ./cmd/cpm login
go run ./cmd/cpm publish --dir ../../packages/cc/cli
```

## Development

| Task                                  | Command                                                                                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Build `dist/cpm`                      | `nx build cpm-tool`                                                                                                              |
| Test (includes a gofmt check)         | `nx test cpm-tool`                                                                                                               |
| Lint                                  | `nx lint cpm-tool` (`go vet`)                                                                                                    |
| Regenerate the registry types         | `nx gen-types cpm-tool` (from `apps/cpm-registry/openapi.yaml` via [oapi-codegen](https://github.com/oapi-codegen/oapi-codegen)) |
| Check the generated types are current | `nx verify-generated cpm-tool` (CI runs this whenever the registry or the tool changes)                                          |

`internal/registry/types.gen.go` is generated from the registry's committed OpenAPI spec, so the `cpm.json` shape the tool writes is the one the registry validates. Constraints the spec cannot express (semver validity) are checked with the [Masterminds semver](https://github.com/Masterminds/semver) library, mirroring the registry's use of the npm `semver` package. The version reported by `cpm --version` is read from `package.json`, which `nx release` bumps.
