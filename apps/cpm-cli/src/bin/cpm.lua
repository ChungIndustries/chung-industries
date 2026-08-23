-- cpm: the Chung Package Manager client for CC:Tweaked.
-- Runs through the /cpm/bin/cpm.lua shim, which prepends /cpm/packages to package.path.

-- Every module is loaded up front so `cpm update cpm` can replace the package tree on disk
-- while this program is still running from it.
local commands = {
  install = require("cpm.commands.install"),
  remove = require("cpm.commands.remove"),
  update = require("cpm.commands.update"),
  list = require("cpm.commands.list"),
  search = require("cpm.commands.search"),
}

local function usage()
  print("Usage:")
  print("  cpm install <name>[@<version|range|tag>] ...")
  print("  cpm remove <name> ...")
  print("  cpm update [<name> ...]")
  print("  cpm list")
  print("  cpm search [<query>]")
  print("")
  print("Registry: " .. settings.get("cpm.registry", "https://registry.cpm.chungindustries.com"))
end

local args = { ... }
local name = table.remove(args, 1)

if name == nil or name == "help" or name == "--help" or name == "-h" then
  usage()
  return
end

local command = commands[name]
if not command then
  printError("Unknown command: " .. name)
  usage()
  return
end

local ok, err = pcall(command, args)
if not ok then
  printError(tostring(err))
end
