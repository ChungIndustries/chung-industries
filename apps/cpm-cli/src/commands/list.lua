-- cpm list

local state = require("cpm.state")

return {
  description = "List installed packages and their versions",
  handler = function()
    local current = state.load()
    local names = {}
    for name in pairs(current.installed) do
      names[#names + 1] = name
    end
    if #names == 0 then
      print("Nothing installed")
      return
    end
    table.sort(names)

    for _, name in ipairs(names) do
      local spec = current.roots[name]
      local suffix = spec and (" (" .. spec .. ")") or " (dependency)"
      print(name .. "@" .. current.installed[name] .. suffix)
    end
  end,
}
