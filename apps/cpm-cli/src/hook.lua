-- The global require hook: makes /cpm/packages requireable from every program.
--
-- Every program environment in CC:Tweaked flows through the global `load`, resolved at call
-- time (the shell's program launcher, `loadfile` and so `os.run`, and the `lua` REPL), so
-- wrapping it once lets cpm prepend its store to each fresh package.path. rawget skips a
-- `package` inherited through the env's `__index = _G` chain, and prepending only when the
-- prefix is absent keeps the wrapper idempotent for sandboxes that reuse a patched path.
--
-- This file is the hook's only source. It is dofile()d (which runs it against _G, all it
-- needs) from /startup/50_cpm.lua at boot and from store.ensureRequireHook for the running
-- session; the guard makes double activation a no-op.
if _G.__cpm_require_hook then
  return
end
_G.__cpm_require_hook = true

local prefix = "/cpm/packages/?.lua;/cpm/packages/?/init.lua;"
local native_load = _G.load

_G.load = function(chunk, name, mode, env)
  if type(env) == "table" then
    local pkg = rawget(env, "package")
    if
      type(pkg) == "table"
      and type(pkg.path) == "string"
      and not pkg.path:find(prefix, 1, true)
    then
      pkg.path = prefix .. pkg.path
    end
  end
  return native_load(chunk, name, mode, env)
end
