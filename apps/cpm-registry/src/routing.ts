import type { Routing } from "express-zod-api";

import {
  getPackageEndpoint,
  getPackageVersionEndpoint,
  listPackagesEndpoint,
  upsertPackageEndpoint,
} from "./components/package/endpoints.js";

export const routing: Routing = {
  packages: {
    get: listPackagesEndpoint,
    post: upsertPackageEndpoint,
    ":name": {
      get: getPackageEndpoint,
      ":version": {
        get: getPackageVersionEndpoint,
      },
    },
  },
};
