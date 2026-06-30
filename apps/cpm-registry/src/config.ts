import { createConfig } from "express-zod-api";

import { env } from "./env.js";

const config = createConfig({
  http: {
    listen: {
      port: env.PORT,
      host: env.HOST,
    },
  },
  cors: false,
  upload: true,
});

export default config;
