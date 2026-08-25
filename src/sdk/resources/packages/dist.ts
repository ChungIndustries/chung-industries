// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../resource';
import { APIPromise } from '../../api-promise';
import type { RequestOptions } from '../../internal/request-options';
import { buildHeaders } from '../../internal/headers';
import { path as __scalarPath } from '../../internal/utils/path';

export class Dist extends APIResource {
  /**
   * Returns the gzipped tarball bytes for a specific package version.
   *
   * @param {string} version - Semantic version string
   * @param {DistListTarballParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Response>} Tarball bytes
   *
   * @example
   * ```ts
   * const response = await client.packages.dist.listTarball('1.0.0', {
   *   name: 'example',
   * });
   * ```
   */
  listTarball(
    version: string,
    params: DistListTarballParams,
    options?: RequestOptions,
  ): APIPromise<Response> {
    const { name } = params;
    return this._client.get(__scalarPath`/packages/${name}/${version}/dist/tarball`, {
      ...options,
      headers: buildHeaders([{ Accept: 'application/gzip' }, options?.headers]),
      __binaryResponse: true,
    });
  }

  /**
   * Returns the bundle for a specific package version: the artifact the in-game cpm client installs from. Format: `<manifest byte length>\n<minified manifest JSON><raw concatenated file bytes>`, where the manifest is `{ name, version, files: [{ path, offset, length }] }` with offsets relative to the first byte after the manifest. Served gzip-encoded on the wire to clients that send `Accept-Encoding: gzip`; `dist.bundle.sha256` is the SHA-256 of the decoded bytes.
   *
   * @param {string} version - Semantic version string
   * @param {DistListBundleParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Response>} Bundle bytes
   *
   * @example
   * ```ts
   * const response = await client.packages.dist.listBundle('1.0.0', {
   *   name: 'example',
   * });
   * ```
   */
  listBundle(version: string, params: DistListBundleParams, options?: RequestOptions): APIPromise<Response> {
    const { name } = params;
    return this._client.get(__scalarPath`/packages/${name}/${version}/dist/bundle`, {
      ...options,
      headers: buildHeaders([{ Accept: 'application/octet-stream' }, options?.headers]),
      __binaryResponse: true,
    });
  }
}

export interface DistListTarballParams {
  /**
   * @minLength 1
   */
  name: string;
}

export interface DistListBundleParams {
  /**
   * @minLength 1
   */
  name: string;
}
export declare namespace Dist {
  export {
    type DistListTarballParams as DistListTarballParams,
    type DistListBundleParams as DistListBundleParams,
  };
}
