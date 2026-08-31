-- cpm remove <name> ...
-- Dropping a root and re-syncing lets the registry recompute what is still reachable; state.json
-- deliberately stores no dependency graph of its own.

local sync = require("cpm.sync")
local state = require("cpm.state")

return {
  description = "Remove root packages and any dependencies left unused",
  arguments = {
    { name = "packages", hint = "<name>", required = true, repeated = true },
  },
  handler = function(args)
    local current = state.load()
    for _, name in ipairs(args.packages) do
      if not current.roots[name] then
        if current.installed[name] then
          error(name .. " is a dependency of another package, remove that package instead", 0)
        end
        error(name .. " is not installed", 0)
      end
      current.roots[name] = nil
    end

    sync.apply(current.roots)
  end,
}
