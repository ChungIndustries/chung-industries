# CPM Registry CLI API

Complete reference of every operation, grouped by resource. See [the README](./README.md) for usage and configuration.

## Contents

- [`Packages`](#packages)
  - [List packages](#list-packages)
  - [Publish package version](#publish-package-version)
  - [Get package](#get-package)
  - [Get package version](#get-package-version)
  - [Resolve dependencies](#resolve-dependencies)
  - [`Packages Dist`](#packages-dist)
    - [Download tarball](#download-tarball)
    - [Download bundle](#download-bundle)
- [`Bootstrap`](#bootstrap)
  - [Bootstrap installer](#bootstrap-installer)

## `Packages`

Endpoints for browsing and retrieving cpm packages.

### List packages

Returns all CPM packages in the registry.

```sh
cpmregistry packages list
```

### Publish package version

Creates a package if missing, or adds a new version to an existing one. Published versions are immutable: re-publishing an existing version returns 409. Send the tarball file as `tarball` in multipart/form-data; the `cpm.json` at the tarball root is the package metadata. The tarball must be a gzipped tar of the package files at its root (no wrapping directory), with relative forward-slash paths, at most 5 MiB compressed (rejected with 413 above that) and 512 KiB extracted; the registry derives the client-facing bundle from it.

```sh
cpmregistry packages create
```

### Get package

Returns the CPM package entry for the given package name.

```sh
cpmregistry packages retrieve 'example'
```

### Get package version

Returns the specific version entry for the given package.

```sh
cpmregistry packages retrieve-version '1.0.0' --name 'example'
```

### Resolve dependencies

Pins one version per package for the given root dependencies and their transitive dependencies. Each spec may be a semver range, an exact version, or a dist-tag. Every requester of a package must agree on a single version (the client installs into a flat store): the highest version satisfying all requested ranges is chosen, and unsatisfiable combinations fail. Results are ordered dependencies-first.

```sh
cpmregistry packages resolve --dependencies '{}'
```

### `Packages Dist`

Endpoints for browsing and retrieving cpm packages.

#### Download tarball

Returns the gzipped tarball bytes for a specific package version.

```sh
cpmregistry packages:dist list-tarball '1.0.0' --name 'example'
```

#### Download bundle

Returns the bundle for a specific package version: the artifact the in-game cpm client installs from. Format: `<manifest byte length>\n<minified manifest JSON><raw concatenated file bytes>`, where the manifest is `{ name, version, files: [{ path, offset, length }] }` with offsets relative to the first byte after the manifest. Served gzip-encoded on the wire to clients that send `Accept-Encoding: gzip`; `dist.bundle.sha256` is the SHA-256 of the decoded bytes.

```sh
cpmregistry packages:dist list-bundle '1.0.0' --name 'example'
```

## `Bootstrap`

Getting cpm onto a fresh computer.

### Bootstrap installer

Serves the cpm bootstrap installer as plain Lua, taken from the latest published `cpm` package. On a fresh CC:Tweaked computer run: `wget run https://registry.cpm.chungindustries.com/install`.

```sh
cpmregistry bootstrap list-install
```
