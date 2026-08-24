-- cpm update [<name> ...]
-- The store holds one version per package, so an update is always a full re-resolve of every
-- root; named packages only assert that the user is updating something they explicitly installed.

local sync = require("cpm.sync")
local state = require("cpm.state")

return function(args)
  local current = state.load()
  if next(current.roots) == nil then
    print("Nothing installed")
    return
  end

  for _, name in ipairs(args) do
    if not current.roots[name] then
      error(name .. " is not an installed root package", 0)
    end
  end

  sync.apply(current.roots)
end
