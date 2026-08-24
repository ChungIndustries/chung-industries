-- The on-computer layout under /cpm: package trees, bin shims, staging swaps, boot helpers.

local store = {}

store.ROOT = "/cpm"
store.PACKAGES = "/cpm/packages"
store.BIN = "/cpm/bin"
store.STAGING = "/cpm/.staging"
store.STATE = "/cpm/state.json"
store.BOOT = "/cpm/boot.lua"
store.STARTUP = "/startup/50_cpm.lua"

local PATH_PREFIX = "/cpm/packages/?.lua;/cpm/packages/?/init.lua;"
local PATH_PREPEND = 'package.path = "' .. PATH_PREFIX .. '" .. package.path'

function store.packageDir(name)
  return fs.combine(store.PACKAGES, name)
end

function store.stagingDir(name)
  return fs.combine(store.STAGING, name)
end

function store.writeFile(path, content)
  local parent = fs.getDir(path)
  if parent ~= "" and not fs.exists(parent) then
    fs.makeDir(parent)
  end
  local handle, err = fs.open(path, "w")
  if not handle then
    error("cannot write " .. path .. ": " .. tostring(err), 0)
  end
  handle.write(content)
  handle.close()
end

-- Every file under a package's bin/ becomes a program on the shell path, named by basename.
local function binPrograms(name)
  local binDir = fs.combine(store.packageDir(name), "bin")
  local programs = {}
  if not fs.isDir(binDir) then
    return programs
  end
  for _, file in ipairs(fs.list(binDir)) do
    local base = file:match("^(.+)%.lua$")
    if base and not fs.isDir(fs.combine(binDir, file)) then
      programs[#programs + 1] = base
    end
  end
  return programs
end

local function shimPath(program)
  return fs.combine(store.BIN, program .. ".lua")
end

-- The shim runs the real file in the caller's globals after prepending the package path, which
-- is what lets packages require their dependencies without any boilerplate of their own.
local function shimSource(name, program)
  return table.concat({
    PATH_PREPEND,
    string.format(
      'local fn = assert(loadfile("/cpm/packages/%s/bin/%s.lua", nil, _ENV))',
      name,
      program
    ),
    "return fn(...)",
    "",
  }, "\n")
end

local function startupHookPath(name)
  return "/startup/60_cpm_" .. name .. ".lua"
end

-- Every bundle ships the package's own cpm.json, so the installed tree is self-describing.
local function readManifest(name)
  local path = fs.combine(store.packageDir(name), "cpm.json")
  if not fs.exists(path) then
    return nil
  end
  local handle = fs.open(path, "r")
  if not handle then
    return nil
  end
  local content = handle.readAll()
  handle.close()
  local manifest = textutils.unserialiseJSON(content or "")
  if type(manifest) == "table" then
    return manifest
  end
  return nil
end

-- A package declaring `startup` in its cpm.json gets a numbered drop-in that runs that file at
-- boot. It sorts after 50_cpm.lua, so /cpm/bin is already on the shell path when it runs. The
-- hook is regenerated on every install and deleted when the field (or the package) goes away.
local function syncStartupHook(name)
  local manifest = readManifest(name)
  local startup = manifest and manifest.startup
  local hook = startupHookPath(name)
  if type(startup) ~= "string" or startup == "" then
    if fs.exists(hook) then
      fs.delete(hook)
    end
    return
  end
  store.writeFile(
    hook,
    table.concat({
      PATH_PREPEND,
      string.format('local fn = assert(loadfile("/cpm/packages/%s/%s", nil, _ENV))', name, startup),
      "return fn()",
      "",
    }, "\n")
  )
end

--- Regenerate the shims for the package currently installed under /cpm/packages/<name>.
function store.writeShims(name)
  for _, program in ipairs(binPrograms(name)) do
    store.writeFile(shimPath(program), shimSource(name, program))
  end
end

--- Remove the shims that point at the package currently installed under /cpm/packages/<name>.
function store.removeShims(name)
  for _, program in ipairs(binPrograms(name)) do
    local path = shimPath(program)
    if fs.exists(path) then
      fs.delete(path)
    end
  end
end

--- Swap a fully extracted staging tree into place: the old tree is deleted only once the new
--- one is complete, so a failed download or extraction never leaves a half-written package live.
function store.commit(name)
  local staging = store.stagingDir(name)
  local target = store.packageDir(name)
  store.removeShims(name)
  if fs.exists(target) then
    fs.delete(target)
  end
  if not fs.exists(store.PACKAGES) then
    fs.makeDir(store.PACKAGES)
  end
  fs.move(staging, target)
  store.writeShims(name)
  syncStartupHook(name)
end

function store.clearStaging(name)
  local staging = store.stagingDir(name)
  if fs.exists(staging) then
    fs.delete(staging)
  end
end

function store.removePackage(name)
  store.removeShims(name)
  local hook = startupHookPath(name)
  if fs.exists(hook) then
    fs.delete(hook)
  end
  local target = store.packageDir(name)
  if fs.exists(target) then
    fs.delete(target)
  end
end

--- Fallback for environments where the require hook is not active (an old drop-in, or a
--- future CC version restructuring its loaders): dofile("/cpm/boot.lua") runs the chunk with
--- the caller's globals, so assigning package.path here mutates the caller's package table.
function store.writeBoot()
  store.writeFile(store.BOOT, PATH_PREPEND .. "\n")
end

-- Keep this text in sync with ensureRequireHook below and with the self-contained bootstrap
-- installer (src/install.lua), which embeds the same two blocks.
local STARTUP_SOURCE = [[
if not shell.path():find(":/cpm/bin", 1, true) then
  shell.setPath(shell.path() .. ":/cpm/bin")
end
if not _G.__cpm_require_hook then
  _G.__cpm_require_hook = true
  local prefix = "/cpm/packages/?.lua;/cpm/packages/?/init.lua;"
  local native_load = load
  _G.load = function(chunk, name, mode, env)
    if type(env) == "table" then
      local pkg = rawget(env, "package")
      if type(pkg) == "table" and type(pkg.path) == "string" and not pkg.path:find(prefix, 1, true) then
        pkg.path = prefix .. pkg.path
      end
    end
    return native_load(chunk, name, mode, env)
  end
end
]]

--- Startup drop-in: puts /cpm/bin on the shell path and installs the require hook, without
--- touching the user's startup.lua.
function store.writeStartup()
  store.writeFile(store.STARTUP, STARTUP_SOURCE)
end

--- Add /cpm/bin to the running shell so programs work without a reboot.
function store.ensureShellPath()
  if not shell.path():find(":/cpm/bin", 1, true) then
    shell.setPath(shell.path() .. ":/cpm/bin")
  end
end

--- Make installed packages requireable from every program with no boilerplate. Every program
--- environment in CC:Tweaked flows through the global `load`, resolved at call time (the
--- shell's program launcher, `loadfile` and so `os.run`, and the `lua` REPL), so wrapping it
--- lets cpm prepend its store to each fresh package.path. rawget skips a `package` inherited
--- through the env's `__index = _G` chain, and prepending only when our prefix is absent keeps
--- the wrapper idempotent for sandboxes that reuse an already-patched path.
function store.ensureRequireHook()
  if _G.__cpm_require_hook then
    return
  end
  _G.__cpm_require_hook = true
  local native_load = _G.load
  _G.load = function(chunk, name, mode, env)
    if type(env) == "table" then
      local pkg = rawget(env, "package")
      if
        type(pkg) == "table"
        and type(pkg.path) == "string"
        and not pkg.path:find(PATH_PREFIX, 1, true)
      then
        pkg.path = PATH_PREFIX .. pkg.path
      end
    end
    return native_load(chunk, name, mode, env)
  end
end

return store
