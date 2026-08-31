-- cpm's startup hook, declared in cpm.json and run at boot by /startup/60_cpm_cpm.lua:
-- registers shell tab-completion for the cpm program, generated from the same command
-- declarations bin/cpm.lua runs. Completion must exist before the user types, which is
-- why this runs at boot rather than in the program itself. The shell keys completers
-- by resolved program path without the leading slash, so the target is the /cpm/bin
-- shim as shell.resolveProgram returns it.

local app = require("cpm.app")

shell.setCompletionFunction("cpm/bin/cpm.lua", app:completionFunction())
