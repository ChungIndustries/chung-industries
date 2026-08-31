-- cpm install <name>[@<version|range|tag>] ...

local sync = require("cpm.sync")
local state = require("cpm.state")

local function parseSpec(request)
  local name, spec = request:match("^([^@]+)@(.+)$")
  if not name then
    name, spec = request, "latest"
  end
  if not name:match("^[%w%-%._]+$") then
    error("invalid package name: " .. name, 0)
  end
  return name, spec
end

return {
  description = "Install packages, recording each as a root",
  arguments = {
    { name = "packages", hint = "<name>[@<version|range|tag>]", required = true, repeated = true },
  },
  handler = function(args)
    local current = state.load()
    local roots = current.roots
    local bare = {}
    for _, request in ipairs(args.packages) do
      local name, spec = parseSpec(request)
      roots[name] = spec
      if spec == "latest" and not request:find("@", 1, true) then
        bare[name] = true
      end
    end

    -- A bare `cpm install foo` pins a caret range on whatever "latest" resolves to, so later
    -- updates stay within the same major version. Pinned before the sync so an interrupted
    -- sync never records "latest" as the root spec.
    if next(bare) ~= nil then
      for _, pkg in ipairs(sync.resolve(roots)) do
        if bare[pkg.name] then
          roots[pkg.name] = "^" .. pkg.version
        end
      end
    end

    sync.apply(roots)
  end,
}
