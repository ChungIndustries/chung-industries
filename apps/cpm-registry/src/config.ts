import dotenvExtended from "dotenv-extended";
import dotenvParseVariables from "dotenv-parse-variables";
import { createConfig } from "express-zod-api";

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.prod"
    : process.env.NODE_ENV === "test"
      ? ".env.test"
      : ".env.dev";

const rawEnv = dotenvExtended.load({
  path: envFile,
  schema: ".env.schema",
  defaults: ".env.defaults",
  includeProcessEnv: true,
  silent: false,
  errorOnMissing: true,
  errorOnExtra: true,
});

const parsedEnv = dotenvParseVariables(rawEnv);

export const env = {
  hostname: parsedEnv.HOSTNAME as string,
  port: parsedEnv.PORT as number,

  storageDir: parsedEnv.STORAGE_DIR as string,
};

const config = createConfig({
  http: {
    listen: {
      port: env.port,
      host: env.hostname,
    },
  },
  cors: false,
  upload: true,
});

export default config;
