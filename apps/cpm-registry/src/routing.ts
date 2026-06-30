import type { Routing } from "express-zod-api";

import {
  downloadTarballEndpoint,
  getPackageEndpoint,
  getPackageVersionEndpoint,
  listPackagesEndpoint,
  publishPackageEndpoint,
} from "./components/package/endpoints.js";

export const routing: Routing = {
  packages: {
    get: listPackagesEndpoint,
    post: publishPackageEndpoint,
    ":name": {
      get: getPackageEndpoint,
      ":version": {
        get: getPackageVersionEndpoint,
        dist: {
          tarball: {
            get: downloadTarballEndpoint,
          },
        },
      },
    },
  },
};
