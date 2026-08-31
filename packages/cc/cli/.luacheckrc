-- Luacheck configuration for the cli library (CC:Tweaked runtime; the tests run
-- under plain Lua 5.3, matching the Lua CI workflow).
std = "lua53"

read_globals = {
  -- CC:Tweaked runtime globals the library reports errors through
  "printError",
}

files["tests"] = {
  -- The tests stub print/printError on _G to capture the library's output
  globals = { "_G" },
}
