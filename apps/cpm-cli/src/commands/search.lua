-- cpm search [<query>]
-- The registry has no search endpoint yet, so this filters GET /packages by name substring.

local registry = require("cpm.registry")

return function(args)
  local query = (args[1] or ""):lower()

  local data, err = registry.get("/packages")
  if not data then
    error("search failed: " .. err, 0)
  end

  local matches = {}
  for _, pkg in ipairs(data.packages or {}) do
    if query == "" or pkg.name:lower():find(query, 1, true) then
      matches[#matches + 1] = pkg
    end
  end
  table.sort(matches, function(a, b)
    return a.name < b.name
  end)

  if #matches == 0 then
    print("No packages found")
    return
  end
  for _, pkg in ipairs(matches) do
    local latest = pkg["dist-tags"] and pkg["dist-tags"].latest
    local line = pkg.name .. (latest and ("@" .. latest) or "")
    if pkg.author then
      line = line .. " by " .. pkg.author
    end
    print(line)
  end
end
