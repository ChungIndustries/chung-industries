// File generated from our OpenAPI spec by Scalar. See README.md for details.

import type { Command } from 'commander';
import SDK from '../sdk/index';
import { createProgram, type CliClientOptionDefinition, type CliCommandDefinition } from '../cli/runtime';
import { completions } from '../cli/completions';

const clientOptions = [] as const satisfies readonly CliClientOptionDefinition[];

const commands = [
  {
    resourcePath: ['packages'],
    commandPath: ['packages', 'list'],
    methodName: 'list',
    summary: 'List packages',
    description: 'Returns all CPM packages in the registry.',
    transport: 'http',
    iterable: false,
    callShape: 'options',
    positional: [],
    flags: [],
  },
  {
    resourcePath: ['packages'],
    commandPath: ['packages', 'create'],
    methodName: 'create',
    summary: 'Publish package version',
    description:
      'Creates a package if missing, or adds a new version to an existing one. Published versions are immutable: re-publishing an existing version returns 409. Send the tarball file as `tarball` in multipart/form-data; the `cpm.json` at the tarball root is the package metadata. The tarball must be a gzipped tar of the package files at its root (no wrapping directory), with relative forward-slash paths, at most 5 MiB compressed (rejected with 413 above that) and 512 KiB extracted; the registry derives the client-facing bundle from it.',
    transport: 'http',
    iterable: false,
    callShape: 'body',
    positional: [],
    flags: [
      {
        name: 'tarball',
        optionKey: 'tarball',
        paramKey: 'tarball',
        location: 'body',
        required: false,
        description: 'gzipped tarball bytes',
        valueKind: 'string',
      },
    ],
  },
  {
    resourcePath: ['packages'],
    commandPath: ['packages', 'retrieve'],
    methodName: 'retrieve',
    summary: 'Get package',
    description: 'Returns the CPM package entry for the given package name.',
    transport: 'http',
    iterable: false,
    callShape: 'options',
    positional: [
      {
        name: 'name',
        optionKey: 'name',
        paramKey: 'name',
        location: 'path',
        required: true,
        valueKind: 'string',
      },
    ],
    flags: [],
  },
  {
    resourcePath: ['packages'],
    commandPath: ['packages', 'retrieve-version'],
    methodName: 'retrieveVersion',
    summary: 'Get package version',
    description: 'Returns the specific version entry for the given package.',
    transport: 'http',
    iterable: false,
    callShape: 'params',
    positional: [
      {
        name: 'version-command',
        optionKey: 'versionCommand',
        paramKey: 'version',
        location: 'path',
        required: true,
        description: 'Semantic version string',
        valueKind: 'string',
      },
    ],
    flags: [
      {
        name: 'name',
        optionKey: 'name',
        paramKey: 'name',
        location: 'path',
        required: true,
        valueKind: 'string',
      },
    ],
  },
  {
    resourcePath: ['packages'],
    commandPath: ['packages', 'resolve'],
    methodName: 'resolve',
    summary: 'Resolve dependencies',
    description:
      'Pins one version per package for the given root dependencies and their transitive dependencies. Each spec may be a semver range, an exact version, or a dist-tag. Every requester of a package must agree on a single version (the client installs into a flat store): the highest version satisfying all requested ranges is chosen, and unsatisfiable combinations fail. Results are ordered dependencies-first.',
    transport: 'http',
    iterable: false,
    callShape: 'body',
    positional: [],
    flags: [
      {
        name: 'dependencies',
        optionKey: 'dependencies',
        paramKey: 'dependencies',
        location: 'body',
        required: true,
        valueKind: 'object',
      },
    ],
  },
  {
    resourcePath: ['packages', 'dist'],
    commandPath: ['packages:dist', 'list-tarball'],
    methodName: 'listTarball',
    summary: 'Download tarball',
    description: 'Returns the gzipped tarball bytes for a specific package version.',
    transport: 'http',
    iterable: false,
    callShape: 'params',
    positional: [
      {
        name: 'version-command',
        optionKey: 'versionCommand',
        paramKey: 'version',
        location: 'path',
        required: true,
        description: 'Semantic version string',
        valueKind: 'string',
      },
    ],
    flags: [
      {
        name: 'name',
        optionKey: 'name',
        paramKey: 'name',
        location: 'path',
        required: true,
        valueKind: 'string',
      },
    ],
  },
  {
    resourcePath: ['packages', 'dist'],
    commandPath: ['packages:dist', 'list-bundle'],
    methodName: 'listBundle',
    summary: 'Download bundle',
    description:
      'Returns the bundle for a specific package version: the artifact the in-game cpm client installs from. Format: `<manifest byte length>\\n<minified manifest JSON><raw concatenated file bytes>`, where the manifest is `{ name, version, files: [{ path, offset, length }] }` with offsets relative to the first byte after the manifest. Served gzip-encoded on the wire to clients that send `Accept-Encoding: gzip`; `dist.bundle.sha256` is the SHA-256 of the decoded bytes.',
    transport: 'http',
    iterable: false,
    callShape: 'params',
    positional: [
      {
        name: 'version-command',
        optionKey: 'versionCommand',
        paramKey: 'version',
        location: 'path',
        required: true,
        description: 'Semantic version string',
        valueKind: 'string',
      },
    ],
    flags: [
      {
        name: 'name',
        optionKey: 'name',
        paramKey: 'name',
        location: 'path',
        required: true,
        valueKind: 'string',
      },
    ],
  },
  {
    resourcePath: ['bootstrap'],
    commandPath: ['bootstrap', 'list-install'],
    methodName: 'listInstall',
    summary: 'Bootstrap installer',
    description:
      'Serves the cpm bootstrap installer as plain Lua, taken from the latest published `cpm` package. On a fresh CC:Tweaked computer run: `wget run https://registry.cpm.chungindustries.com/install`.',
    transport: 'http',
    iterable: false,
    callShape: 'options',
    positional: [],
    flags: [],
  },
] as const satisfies readonly CliCommandDefinition[];

export const getProgram = (): Command =>
  createProgram({
    SDK,
    binaryName: 'cpmregistry',
    version: '0.1.0', // x-release-please-version
    description: 'CLI for CPM Registry',
    defaultFormat: 'auto',
    defaultErrorFormat: 'auto',
    clientOptions,
    commands,
    completions,
  });
