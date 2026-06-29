import { createServer } from "express-zod-api";

import config from "./config.js";
import { routing } from "./routing.js";

await createServer(config, routing);
