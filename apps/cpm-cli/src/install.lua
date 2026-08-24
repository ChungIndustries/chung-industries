-- cpm bootstrap installer. Served by the registry at GET /install and run with:
--   wget run https://registry.cpm.chungindustries.com/install
--
-- Nothing is installed yet, so this file is self-contained: it duplicates the minimal container
-- parsing and path validation from cpm.bundle instead of requiring it. It also skips sha256
-- verification, trusting HTTPS for this first hop; the installed client verifies every bundle
-- from then on, including its own updates via `cpm update cpm`.

local DEFAULT_URL = "https://registry.cpm.chungindustries.com"
local PACKAGE_DIR = "/cpm/packages/cpm"
local PATH_PREPEND = 'package.path = "/cpm/packages/?.lua;/cpm/packages/?/init.lua;"'
  .. " .. package.path"

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

-- Ask the registry which cpm version "latest" is and where its bundle lives.
print("Resolving cpm...")
local response, err, failed = http.post({
  url = baseUrl .. "/resolve",
  body = textutils.serialiseJSON({ dependencies = { cpm = "latest" } }),
  headers = { ["Content-Type"] = "application/json", Accept = "application/json" },
})
if not response then
  return fail((failed and jsendMessage(readAll(failed))) or err or "resolve request failed")
end
local resolved = textutils.unserialiseJSON(readAll(response))
local pkg = type(resolved) == "table"
  and resolved.status == "success"
  and type(resolved.data) == "table"
  and type(resolved.data.packages) == "table"
  and resolved.data.packages[1]
if not pkg or pkg.name ~= "cpm" then
  return fail("registry did not resolve the cpm package")
end

print("Downloading cpm@" .. pkg.version .. "...")
response, err, failed = http.get({
  url = baseUrl .. pkg.dist.bundle.url,
  binary = true,
  headers = { ["Accept-Encoding"] = "gzip" },
})
if not response then
  return fail((failed and jsendMessage(readAll(failed))) or err or "bundle download failed")
end
local bytes = readAll(response)

-- Container: "<manifest length>\n<manifest JSON><blob>", offsets relative to the blob start.
local newline = bytes:find("\n", 1, true)
local manifestLength = newline and tonumber(bytes:sub(1, newline - 1))
if not manifestLength then
  return fail("bundle has no manifest length line")
end
local blobStart = newline + manifestLength + 1
local manifest = textutils.unserialiseJSON(bytes:sub(newline + 1, newline + manifestLength))
if type(manifest) ~= "table" or type(manifest.files) ~= "table" then
  return fail("bundle manifest is not valid JSON")
end
for _, file in ipairs(manifest.files) do
  if not validPath(file.path) then
    return fail("bundle contains an invalid path: " .. tostring(file.path))
  end
  if
    type(file.offset) ~= "number"
    or type(file.length) ~= "number"
    or blobStart + file.offset + file.length - 1 > #bytes
  then
    return fail("bundle entry points outside the blob: " .. file.path)
  end
end

if fs.exists(PACKAGE_DIR) then
  fs.delete(PACKAGE_DIR)
end
for index, file in ipairs(manifest.files) do
  local first = blobStart + file.offset
  writeFile(fs.combine(PACKAGE_DIR, file.path), bytes:sub(first, first + file.length - 1), "wb")
  if index % 4 == 0 then
    os.queueEvent("cpm_yield")
    os.pullEvent("cpm_yield")
  end
end

-- Shims put every bin/ program on the shell path with the package path already set.
local binDir = fs.combine(PACKAGE_DIR, "bin")
if fs.isDir(binDir) then
  for _, file in ipairs(fs.list(binDir)) do
    local program = file:match("^(.+)%.lua$")
    if program then
      writeFile(
        fs.combine("/cpm/bin", file),
        PATH_PREPEND
          .. "\n"
          .. string.format(
            'local fn = assert(loadfile("%s/bin/%s", nil, _ENV))\n',
            PACKAGE_DIR,
            file
          )
          .. "return fn(...)\n"
      )
    end
  end
end

writeFile("/cpm/boot.lua", PATH_PREPEND .. "\n")
-- Kept in sync with store.lua (STARTUP_SOURCE / ensureRequireHook): shell path plus the
-- global `load` wrapper that makes require find cpm packages in every program environment.
writeFile(
  "/startup/50_cpm.lua",
  [[
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
)
writeFile(
  "/cpm/state.json",
  textutils.serialiseJSON({
    -- cpm tracks "latest" rather than a caret range so `cpm update` always picks up new
    -- releases, including the 0.x ones a caret would exclude.
    roots = { cpm = "latest" },
    installed = { cpm = pkg.version },
  })
)

if not shell.path():find(":/cpm/bin", 1, true) then
  shell.setPath(shell.path() .. ":/cpm/bin")
end
-- Activate the require hook for this session too, so no reboot is needed.
if not _G.__cpm_require_hook then
  _G.__cpm_require_hook = true
  local hookPrefix = "/cpm/packages/?.lua;/cpm/packages/?/init.lua;"
  local native_load = _G.load
  _G.load = function(chunk, name, mode, env)
    if type(env) == "table" then
      local envPackage = rawget(env, "package")
      if
        type(envPackage) == "table"
        and type(envPackage.path) == "string"
        and not envPackage.path:find(hookPrefix, 1, true)
      then
        envPackage.path = hookPrefix .. envPackage.path
      end
    end
    return native_load(chunk, name, mode, env)
  end
end

print("Installed cpm@" .. pkg.version .. ". Run `cpm help` to get started.")
