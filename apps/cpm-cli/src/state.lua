-- /cpm/state.json: the roots the user asked for and the pinned set currently on disk.

local store = require("cpm.store")

local state = {}

local function readFile(path)
  local handle = fs.open(path, "r")
  if not handle then
    return nil
  end
  local content = handle.readAll()
  handle.close()
  return content
end

--- Load the state file, falling back to empty roots and installed maps.
function state.load()
  local loaded = {}
  local content = readFile(store.STATE)
  if content then
    local parsed = textutils.unserialiseJSON(content)
    if type(parsed) == "table" then
      loaded = parsed
    end
  end
  return {
    roots = type(loaded.roots) == "table" and loaded.roots or {},
    installed = type(loaded.installed) == "table" and loaded.installed or {},
  }
end

--- Persist the state file. Written last during installs so it never claims more than is on disk.
function state.save(current)
  store.writeFile(store.STATE, textutils.serialiseJSON(current))
end

return state
