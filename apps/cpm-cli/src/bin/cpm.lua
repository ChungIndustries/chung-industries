-- cpm: the Chung Package Manager client for CC:Tweaked.
-- Runs through the /cpm/bin/cpm.lua shim, which prepends /cpm/packages to package.path.

local cli = require("cli")
local registry = require("cpm.registry")

local app = cli.new({
  name = "cpm",
  description = "cpm, the Chung Package Manager",
  footer = function()
    return "Registry: " .. registry.baseUrl()
  end,
})

-- Every command module is loaded up front so `cpm update cpm` can replace the package
-- tree on disk while this program is still running from it (the cli library is a single
-- file for the same reason). Each module declares its interface next to its handler.
for _, name in ipairs({ "install", "remove", "update", "list", "search" }) do
  app:command(name, require("cpm.commands." .. name))
end

app:run(...)
