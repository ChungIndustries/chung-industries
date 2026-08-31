-- cpm bootstrap installer. Served by the registry at GET /install and run with:
--   wget run https://registry.cpm.chungindustries.com/install
--
-- Nothing is installed yet, so up to extraction this file is self-contained: it duplicates
-- the minimal container parsing and path validation from cpm.bundle instead of requiring it.
-- It also skips sha256 verification, trusting HTTPS for this first hop; the installed client
-- verifies every bundle from then on, including its own updates via `cpm update cpm`. The
-- whole resolved closure is installed, not just cpm: the client requires its dependencies
-- up front, so a partial bootstrap could not even print help. Once the packages are on
-- disk, setup is delegated to the cpm package's own store.lua so shims, the startup
-- drop-in, and the require hook each have a single source.

local DEFAULT_URL = "https://registry.cpm.chungindustries.com"
local PACKAGES_DIR = "/cpm/packages"
local STAGING_DIR = "/cpm/.staging"

if not http then
  printError("The http API is disabled on this computer; cpm needs it to reach the registry")
  return
end

local baseUrl = (settings.get("cpm.registry", DEFAULT_URL)):gsub("/+$", "")

local function readAll(handle)
  local body = handle.readAll()
  handle.close()
  return body or ""
end

local function fail(message)
  printError("cpm install failed: " .. message)
end

local function jsendMessage(body)
  local doc = textutils.unserialiseJSON(body)
  if type(doc) == "table" then
    if type(doc.data) == "table" and doc.data.message then
      return doc.data.message
    end
    return doc.message
  end
end

local function writeFile(path, content, mode)
  local parent = fs.getDir(path)
  if parent ~= "" and not fs.exists(parent) then
    fs.makeDir(parent)
  end
  local handle, err = fs.open(path, mode or "w")
  if not handle then
    error("cannot write " .. path .. ": " .. tostring(err), 0)
  end
  handle.write(content)
  handle.close()
end

local function validPath(path)
  if type(path) ~= "string" or path == "" or path:sub(1, 1) == "/" or path:find("\\", 1, true) then
    return false
  end
  for segment in (path .. "/"):gmatch("([^/]*)/") do
    if segment == "" or segment == "." or segment == ".." then
      return false
    end
  end
  return true
end

-- Ask the registry which cpm version "latest" is and for its fully pinned dependency closure.
local function resolveClosure()
  local response, err, failed = http.post({
    url = baseUrl .. "/resolve",
    body = textutils.serialiseJSON({ dependencies = { cpm = "latest" } }),
    headers = { ["Content-Type"] = "application/json", Accept = "application/json" },
  })
  if not response then
    return nil, (failed and jsendMessage(readAll(failed))) or err or "resolve request failed"
  end
  local resolved = textutils.unserialiseJSON(readAll(response))
  if
    type(resolved) == "table"
    and resolved.status == "success"
    and type(resolved.data) == "table"
    and type(resolved.data.packages) == "table"
  then
    return resolved.data.packages
  end
  return nil, "registry did not resolve the cpm package"
end

-- Download and extract one package: staged first, swapped into place only once complete,
-- so a failed write (full disk, bad bundle) never destroys a working install.
local function install(pkg)
  local response, err, failed = http.get({
    url = baseUrl .. pkg.dist.bundle.url,
    binary = true,
    headers = { ["Accept-Encoding"] = "gzip" },
  })
  if not response then
    return nil, (failed and jsendMessage(readAll(failed))) or err or "bundle download failed"
  end
  local bytes = readAll(response)

  -- Container: "<manifest length>\n<manifest JSON><blob>", offsets relative to the blob start.
  local newline = bytes:find("\n", 1, true)
  local manifestLength = newline and tonumber(bytes:sub(1, newline - 1))
  if not manifestLength then
    return nil, "bundle has no manifest length line"
  end
  local blobStart = newline + manifestLength + 1
  local manifest = textutils.unserialiseJSON(bytes:sub(newline + 1, newline + manifestLength))
  if type(manifest) ~= "table" or type(manifest.files) ~= "table" then
    return nil, "bundle manifest is not valid JSON"
  end
  for _, file in ipairs(manifest.files) do
    if not validPath(file.path) then
      return nil, "bundle contains an invalid path: " .. tostring(file.path)
    end
    if
      type(file.offset) ~= "number"
      or type(file.length) ~= "number"
      or blobStart + file.offset + file.length - 1 > #bytes
    then
      return nil, "bundle entry points outside the blob: " .. file.path
    end
  end

  local staging = STAGING_DIR .. "/" .. pkg.name
  if fs.exists(staging) then
    fs.delete(staging)
  end
  for index, file in ipairs(manifest.files) do
    local first = blobStart + file.offset
    writeFile(fs.combine(staging, file.path), bytes:sub(first, first + file.length - 1), "wb")
    if index % 4 == 0 then
      os.queueEvent("cpm_yield")
      os.pullEvent("cpm_yield")
    end
  end
  if not fs.exists(staging) then
    return nil, "bundle contained no files"
  end
  local target = PACKAGES_DIR .. "/" .. pkg.name
  if fs.exists(target) then
    fs.delete(target)
  end
  if not fs.exists(PACKAGES_DIR) then
    fs.makeDir(PACKAGES_DIR)
  end
  fs.move(staging, target)
  return true
end

print("Resolving cpm...")
local packages, resolveErr = resolveClosure()
if not packages then
  return fail(resolveErr)
end
-- Package names become install paths, so re-validate them even though the registry
-- enforces the same shape at publish (defense in depth, matching the path checks).
local cpmVersion
for _, pkg in ipairs(packages) do
  if type(pkg.name) ~= "string" or not pkg.name:match("^[%w%-%._]+$") then
    return fail("registry returned an invalid package name: " .. tostring(pkg.name))
  end
  if pkg.name == "cpm" then
    cpmVersion = pkg.version
  end
end
if not cpmVersion then
  return fail("registry did not resolve the cpm package")
end

-- Install dependencies-first, the order the registry resolves in. A failure between
-- packages leaves no live package half-written; re-running the bootstrap finishes the job.
for _, pkg in ipairs(packages) do
  print("Downloading " .. pkg.name .. "@" .. pkg.version .. "...")
  local ok, message = install(pkg)
  if not ok then
    return fail(message)
  end
end

-- The packages are on disk now; cpm's own store.lua (which requires nothing) does the rest:
-- shims, the startup drop-in, and both live activations, from their single source.
local store = assert(loadfile(PACKAGES_DIR .. "/cpm/store.lua", nil, _ENV))()
local startupHooks = {}
for _, pkg in ipairs(packages) do
  store.writeShims(pkg.name)
  startupHooks[#startupHooks + 1] = store.syncStartupHook(pkg.name)
end
store.writeStartup()
-- Merged into any existing state so re-running the bootstrap never untracks other packages.
local prior = {}
local stateHandle = fs.open(store.STATE, "r")
if stateHandle then
  local existing = textutils.unserialiseJSON(stateHandle.readAll() or "")
  stateHandle.close()
  if type(existing) == "table" then
    prior = existing
  end
end
local roots = type(prior.roots) == "table" and prior.roots or {}
local installed = type(prior.installed) == "table" and prior.installed or {}
-- cpm tracks "latest" rather than a caret range so `cpm update` always picks up new
-- releases, including the 0.x ones a caret would exclude.
roots.cpm = "latest"
for _, pkg in ipairs(packages) do
  installed[pkg.name] = pkg.version
end
store.writeFile(store.STATE, textutils.serialiseJSON({ roots = roots, installed = installed }))
store.ensureShellPath()
store.ensureRequireHook()

-- Boot runs the startup hooks written above; run them now as well so boot-time behavior
-- (cpm's shell tab-completion) works in this session too. A failing hook is a warning,
-- not a failed install: everything is on disk and the next boot retries it.
for _, hook in ipairs(startupHooks) do
  local fn, loadErr = loadfile(hook, nil, _ENV)
  local ok, runErr
  if fn then
    ok, runErr = pcall(fn)
  else
    ok, runErr = false, loadErr
  end
  if not ok then
    printError("Warning: " .. hook .. " failed: " .. tostring(runErr))
  end
end

print("Installed cpm@" .. cpmVersion .. ". Run `cpm help` to get started.")
