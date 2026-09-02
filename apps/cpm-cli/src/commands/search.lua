-- cpm search [<query>]

local registry = require("cpm.registry")

return {
  description = "Search the registry by package name, author, or description",
  arguments = {
    { name = "query", hint = "<query>" },
  },
  handler = function(args)
    -- The registry does the matching and ranking (GET /search); an empty query
    -- lists the first page of everything.
    local data, err = registry.get("/search?q=" .. textutils.urlEncode(args.query or ""))
    if not data then
      error("search failed: " .. err, 0)
    end

    local results = data.results or {}
    if #results == 0 then
      print("No packages found")
      return
    end
    for _, pkg in ipairs(results) do
      local line = pkg.name .. "@" .. pkg.version
      if pkg.author then
        line = line .. " by " .. pkg.author
      end
      print(line)
      if pkg.description then
        print("  " .. pkg.description)
      end
    end

    local more = (data.total or #results) - #results
    if more > 0 then
      print(string.format("...and %d more, narrow the search to see them", more))
    end
  end,
}
