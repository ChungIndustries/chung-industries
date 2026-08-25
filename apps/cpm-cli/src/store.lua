-- The on-computer layout under /cpm: package trees, bin shims, staging swaps, boot helpers.

local store = {}

store.ROOT = "/cpm"
store.PACKAGES = "/cpm/packages"
store.BIN = "/cpm/bin"
store.STAGING = "/cpm/.staging"
store.STATE = "/cpm/state.json"
store.STARTUP = "/startup/50_cpm.lua"
-- The require hook ships as a file in the cpm package itself, so it updates with cpm.
store.HOOK = "/cpm/packages/cpm/hook.lua"

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

-- A shim's loadfile line names the package it runs, so ownership can be read back from disk.
local function shimOwner(program)
  local handle = fs.open(shimPath(program), "r")
  if not handle then
    return nil
  end
  local source = handle.readAll() or ""
  handle.close()
  return source:match('loadfile%("/cpm/packages/([^/"]+)/bin/')
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

--- Regenerate the shims for the package currently installed under /cpm/packages/<name>,
--- warning when a shim written by another package gets taken over.
function store.writeShims(name)
  for _, program in ipairs(binPrograms(name)) do
    local owner = shimOwner(program)
    if owner and owner ~= name then
      print(string.format("Warning: %s replaces the `%s` command from %s", name, program, owner))
    end
    store.writeFile(shimPath(program), shimSource(name, program))
  end
end

--- Remove the shims owned by the package currently installed under /cpm/packages/<name>,
--- leaving any that another package has since taken over.
function store.removeShims(name)
  for _, program in ipairs(binPrograms(name)) do
    if shimOwner(program) == name then
      fs.delete(shimPath(program))
    end
  end
end

--- Swap a fully extracted staging tree into place: the old tree is deleted only once the new
--- one is complete, so a failed download or extraction never leaves a half-written package live.
function store.commit(name)
  local staging = store.stagingDir(name)
  local target = store.packageDir(name)
  -- An empty bundle never creates the staging dir; fail before touching the installed tree
  -- so a bad bundle cannot destroy a working install.
  if not fs.exists(staging) then
    error("nothing staged for " .. name, 0)
  end
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

--- Startup drop-in: puts /cpm/bin on the shell path and runs the require hook (hook.lua in
--- the cpm package, the hook's single source), without touching the user's startup.lua.
function store.writeStartup()
  store.writeFile(
    store.STARTUP,
    table.concat({
      'if not shell.path():find(":/cpm/bin", 1, true) then',
      '  shell.setPath(shell.path() .. ":/cpm/bin")',
      "end",
      'if fs.exists("' .. store.HOOK .. '") then',
      '  dofile("' .. store.HOOK .. '")',
      "end",
      "",
    }, "\n")
  )
end

--- Add /cpm/bin to the running shell so programs work without a reboot.
function store.ensureShellPath()
  if not shell.path():find(":/cpm/bin", 1, true) then
    shell.setPath(shell.path() .. ":/cpm/bin")
  end
end

--- Activate the require hook for the running session (the startup drop-in runs the same file
--- at boot). dofile runs it against _G, which is all the hook touches; see src/hook.lua.
function store.ensureRequireHook()
  if not _G.__cpm_require_hook and fs.exists(store.HOOK) then
    dofile(store.HOOK)
  end
end

return store
