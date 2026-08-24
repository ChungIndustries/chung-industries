-- Luacheck configuration for the cpm client (CC:Tweaked runtime, Lua 5.2 plus string.pack).
std = "lua53"

-- store.ensureRequireHook deliberately patches the global loader (_G.load) so
-- require finds cpm packages in every program environment.
globals = { "_G" }

read_globals = {
  -- CC:Tweaked runtime globals
  "bit32",
  "fs",
  "http",
  "shell",
  "textutils",
  "settings",
  "os",
  "term",
  "colors",
  "colours",
  "parallel",
  "read",
  "print",
  "printError",
  "write",
  "sleep",
}
