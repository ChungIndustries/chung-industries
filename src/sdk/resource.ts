// File generated from our OpenAPI spec by Scalar. See README.md for details.

import type { CpmRegistry } from './client';

export abstract class APIResource {
  protected _client: CpmRegistry;

  constructor(client: CpmRegistry) {
    this._client = client;
  }
}
