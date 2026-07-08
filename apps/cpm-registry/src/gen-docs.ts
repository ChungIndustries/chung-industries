import { writeFileSync } from "node:fs";
import process from "node:process";

import { stringify } from "yaml";

import { app, openApiBase } from "./index.js";

// The committed openapi.yaml is the source of truth for the hosted Scalar docs;
// CI fails if it drifts from the code (see .github/workflows/generate-docs.yml).
const document = app.getOpenAPIDocument(openApiBase);
const outputPath = process.argv[2] ?? process.env.API_SPEC_PATH ?? "openapi.yaml";
writeFileSync(outputPath, stringify(document));
