-- Luacheck configuration for the cpm client (CC:Tweaked runtime, Lua 5.2 plus string.pack).
std = "lua53"

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
