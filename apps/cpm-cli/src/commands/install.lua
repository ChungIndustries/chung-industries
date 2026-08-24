-- cpm install <name>[@<version|range|tag>] ...

local sync = require("cpm.sync")
local state = require("cpm.state")

local function parseSpec(arg)
  local name, spec = arg:match("^([^@]+)@(.+)$")
  if not name then
    name, spec = arg, "latest"
  end
  if not name:match("^[%w%-%._]+$") then
    error("invalid package name: " .. name, 0)
  end
  return name, spec
end

return function(args)
  if #args == 0 then
    error("usage: cpm install <name>[@<spec>] ...", 0)
  end

  local current = state.load()
  local roots = current.roots
  local bare = {}
  for _, arg in ipairs(args) do
    local name, spec = parseSpec(arg)
    roots[name] = spec
    if spec == "latest" and not arg:find("@", 1, true) then
      bare[name] = true
    end
  end

  local resolved = sync.apply(roots)

  -- A bare `cpm install foo` pins a caret range on whatever "latest" resolved to,
  -- so later updates stay within the same major version.
  local saved = state.load()
  for _, pkg in ipairs(resolved) do
    if bare[pkg.name] then
      saved.roots[pkg.name] = "^" .. pkg.version
    end
  end
  state.save(saved)
end
