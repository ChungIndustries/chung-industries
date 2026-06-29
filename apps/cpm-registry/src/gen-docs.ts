import fs from "node:fs";

import { Documentation } from "express-zod-api";

import config from "./config.js";
import { routing } from "./routing.js";

const specification = new Documentation({
  routing,
  config,
  version: "0.0.0-development",
  title: "CPM Registry",
  serverUrl: "https://registry.cpm.chungindustries.com",
  tags: {
    Packages: {
      description: "Endpoints for browsing and retrieving cpm packages.",
    },
  },
});

specification.addDescription(
  "API for the CPM Registry, used by the Chung Package Manager (cpm) to host and distribute ComputerCraft-focused Lua packages.",
);

const outputPath = process.argv[2] ?? process.env.API_SPEC_PATH ?? "openapi.yaml";
fs.writeFileSync(outputPath, specification.getSpecAsYaml());
