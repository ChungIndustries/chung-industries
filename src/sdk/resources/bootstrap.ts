// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../resource';
import { APIPromise } from '../api-promise';
import type { RequestOptions } from '../internal/request-options';
import { buildHeaders } from '../internal/headers';

export class Bootstrap extends APIResource {
  /**
   * Serves the cpm bootstrap installer as plain Lua, taken from the latest published `cpm` package. On a fresh CC:Tweaked computer run: `wget run https://registry.cpm.chungindustries.com/install`.
   *
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<BootstrapListInstallResponse>} Installer Lua source
   *
   * @example
   * ```ts
   * const response = await client.bootstrap.listInstall();
   * ```
   */
  listInstall(options?: RequestOptions): APIPromise<BootstrapListInstallResponse> {
    return this._client.get('/install', {
      ...options,
      headers: buildHeaders([{ Accept: 'text/plain' }, options?.headers]),
    });
  }
}

export type BootstrapListInstallResponse = string;
export declare namespace Bootstrap {
  export { type BootstrapListInstallResponse as BootstrapListInstallResponse };
}
