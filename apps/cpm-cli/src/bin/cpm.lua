-- cpm: the Chung Package Manager client for CC:Tweaked.
-- Runs through the /cpm/bin/cpm.lua shim, which prepends /cpm/packages to package.path.
-- The app itself lives in cpm.app, shared with startup.lua's tab-completion registration.

local app = require("cpm.app")

app:run(...)
