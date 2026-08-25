// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../resource';
import { APIPromise } from '../../api-promise';
import type { RequestOptions } from '../../internal/request-options';
import { multipartFormRequestOptions } from '../../internal/uploads';
import { path as __scalarPath } from '../../internal/utils/path';
import type { Uploadable } from '../../core/uploads';
import * as DistAPI from './dist';
import { Dist, type DistListTarballParams, type DistListBundleParams } from './dist';

export class Packages extends APIResource {
  dist: DistAPI.Dist = new DistAPI.Dist(this._client);

  /**
   * Returns all CPM packages in the registry.
   *
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<PackageListResponse>} All packages
   *
   * @example
   * ```ts
   * const response = await client.packages.list();
   * ```
   */
  list(options?: RequestOptions): APIPromise<PackageListResponse> {
    return this._client.get('/packages', options);
  }

  /**
   * Creates a package if missing, or adds a new version to an existing one. Published versions are immutable: re-publishing an existing version returns 409. Send the tarball file as `tarball` in multipart/form-data; the `cpm.json` at the tarball root is the package metadata. The tarball must be a gzipped tar of the package files at its root (no wrapping directory), with relative forward-slash paths, at most 5 MiB compressed (rejected with 413 above that) and 512 KiB extracted; the registry derives the client-facing bundle from it.
   *
   * @param {PackageCreateParams} body - The request body to send.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<PackageCreateResponse>} Published
   *
   * @example
   * ```ts
   * const response = await client.packages.create({});
   * ```
   */
  create(body: PackageCreateParams, options?: RequestOptions): APIPromise<PackageCreateResponse> {
    return this._client.post('/packages', multipartFormRequestOptions({ body, ...options }, this._client));
  }

  /**
   * Returns the CPM package entry for the given package name.
   *
   * @param {string} name
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<PackageRetrieveResponse>} The package
   *
   * @example
   * ```ts
   * const response = await client.packages.retrieve('example');
   * ```
   */
  retrieve(name: string, options?: RequestOptions): APIPromise<PackageRetrieveResponse> {
    return this._client.get(__scalarPath`/packages/${name}`, options);
  }

  /**
   * Returns the specific version entry for the given package.
   *
   * @param {string} version - Semantic version string
   * @param {PackageRetrieveVersionParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<PackageRetrieveVersionResponse>} The version
   *
   * @example
   * ```ts
   * const response = await client.packages.retrieveVersion('1.0.0', {
   *   name: 'example',
   * });
   * ```
   */
  retrieveVersion(
    version: string,
    params: PackageRetrieveVersionParams,
    options?: RequestOptions,
  ): APIPromise<PackageRetrieveVersionResponse> {
    const { name } = params;
    return this._client.get(__scalarPath`/packages/${name}/${version}`, options);
  }

  /**
   * Pins one version per package for the given root dependencies and their transitive dependencies. Each spec may be a semver range, an exact version, or a dist-tag. Every requester of a package must agree on a single version (the client installs into a flat store): the highest version satisfying all requested ranges is chosen, and unsatisfiable combinations fail. Results are ordered dependencies-first.
   *
   * @param {PackageResolveParams} body - The request body to send.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<PackageResolveResponse>} Pinned packages
   *
   * @example
   * ```ts
   * const response = await client.packages.resolve({
   *   dependencies: {},
   * });
   * ```
   */
  resolve(body: PackageResolveParams, options?: RequestOptions): APIPromise<PackageResolveResponse> {
    return this._client.post('/resolve', { body, ...options });
  }
}

export interface Package {
  /**
   * @pattern ^[a-zA-Z0-9_-]+$
   */
  name: string;
  /**
   * Distribution tags mapping tag names to versions
   */
  'dist-tags': DistTags;
  versions: Record<string, PackageVersion>;
  author?: string;
}

export interface PackageVersion {
  /**
   * @pattern ^[a-zA-Z0-9_-]+$
   */
  name: string;
  /**
   * Semantic version string
   */
  version: string;
  /**
   * Distribution artifacts, one entry per artifact kind
   */
  dist: PackageVersion.Dist;
  author?: string;
  /**
   * Dependency map of package name to semver range
   */
  dependencies?: Record<string, string>;
  /**
   * Path, relative to the package root, of a Lua file the client runs at computer startup
   * @minLength 1
   */
  startup?: string;
}

export namespace PackageVersion {
  export interface Dist {
    /**
     * The publish artifact: a gzipped tar of the package files
     */
    tarball: Dist.Tarball;
    /**
     * The derived install artifact: a length-prefixed JSON manifest plus raw file bytes
     */
    bundle: Dist.Bundle;
  }

  export namespace Dist {
    export interface Tarball {
      /**
       * Tarball path
       */
      url: string;
      /**
       * SHA-1 hex digest of the tarball
       * @pattern ^[a-f0-9]{40}$
       */
      shasum: string;
      /**
       * Subresource Integrity (SRI) sha512 digest of the tarball
       * @pattern ^sha512-[A-Za-z0-9+/]+={0,2}$
       */
      integrity: string;
    }

    export interface Bundle {
      /**
       * Bundle path: the artifact the in-game cpm client downloads
       */
      url: string;
      /**
       * Hex SHA-256 digest of the bundle bytes
       * @pattern ^[a-f0-9]{64}$
       */
      sha256: string;
      /**
       * Bundle size in bytes (before wire compression)
       * @minimum 0
       */
      size: number;
    }
  }
}

/**
 * Distribution tags mapping tag names to versions
 */
export interface DistTags {
  /**
   * Semantic version string
   */
  latest: string;
}

export interface PackageListResponse {
  status: 'success';
  data: PackageListResponse.Data;
}

export namespace PackageListResponse {
  export interface Data {
    packages: Array<Package>;
  }
}

export interface PackageCreateParams {
  /**
   * gzipped tarball bytes
   */
  tarball?: Uploadable;
}

export interface PackageCreateResponse {
  status: 'success';
  data: Package;
}

export interface PackageRetrieveResponse {
  status: 'success';
  data: Package;
}

export interface PackageRetrieveVersionParams {
  /**
   * @minLength 1
   */
  name: string;
}

export interface PackageRetrieveVersionResponse {
  status: 'success';
  data: PackageVersion;
}

export interface PackageResolveParams {
  dependencies: Record<string, string>;
}

export interface PackageResolveResponse {
  status: 'success';
  data: PackageResolveResponse.Data;
}

export namespace PackageResolveResponse {
  export interface Data {
    packages: Array<PackageVersion>;
  }
}
Packages.Dist = Dist;

export declare namespace Packages {
  export {
    type Package as Package,
    type PackageVersion as PackageVersion,
    type DistTags as DistTags,
    type PackageListResponse as PackageListResponse,
    type PackageCreateResponse as PackageCreateResponse,
    type PackageRetrieveResponse as PackageRetrieveResponse,
    type PackageRetrieveVersionResponse as PackageRetrieveVersionResponse,
    type PackageResolveResponse as PackageResolveResponse,
    type PackageCreateParams as PackageCreateParams,
    type PackageRetrieveVersionParams as PackageRetrieveVersionParams,
    type PackageResolveParams as PackageResolveParams,
  };

  export {
    Dist as Dist,
    type DistListTarballParams as DistListTarballParams,
    type DistListBundleParams as DistListBundleParams,
  };
}
