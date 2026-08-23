-- Brings /cpm/packages in line with a set of roots: resolve on the registry, diff against the
-- installed set, download and verify bundles, swap them in, and garbage-collect orphans.
-- install, update, and remove are all thin wrappers around this one flow.

local registry = require("cpm.registry")
local bundle = require("cpm.bundle")
local store = require("cpm.store")
local state = require("cpm.state")

local MAX_CONCURRENT_DOWNLOADS = 4

local sync = {}

local function formatSize(bytes)
  if bytes >= 1024 then
    return string.format("%.1f KB", bytes / 1024)
  end
  return string.format("%d B", bytes)
end

local function resolve(roots)
  local data, err = registry.post("/resolve", { dependencies = roots })
  if not data then
    error("resolve failed: " .. err, 0)
  end
  if type(data.packages) ~= "table" then
    error("resolve failed: registry returned no package list", 0)
  end
  return data.packages
end

-- Disk is the scarce resource on CC (1 MB by default), so refuse up front rather than fail
-- halfway through extraction with a full drive.
local function checkFreeSpace(toInstall)
  local needed = 0
  for _, pkg in ipairs(toInstall) do
    needed = needed + (pkg.dist.bundle.size or 0)
  end
  local free = fs.getFreeSpace("/")
  if needed > free then
    local message = "not enough disk space: %s needed, %s free"
    error(string.format(message, formatSize(needed), formatSize(free)), 0)
  end
end

-- Bundles are small, so they are held in memory and fetched a few at a time. Each task records
-- its own outcome so one failed download can be reported by name instead of as a raw error.
local function downloadAll(toInstall)
  local bytesByName = {}
  local failures = {}

  local function downloader(pkg)
    return function()
      local bytes, err = registry.getBundle(pkg.dist.bundle.url)
      if bytes then
        bytesByName[pkg.name] = bytes
      else
        failures[#failures + 1] = string.format("%s@%s: %s", pkg.name, pkg.version, err)
      end
    end
  end

  for first = 1, #toInstall, MAX_CONCURRENT_DOWNLOADS do
    local tasks = {}
    for i = first, math.min(first + MAX_CONCURRENT_DOWNLOADS - 1, #toInstall) do
      tasks[#tasks + 1] = downloader(toInstall[i])
    end
    parallel.waitForAll(table.unpack(tasks))
  end

  if #failures > 0 then
    error("download failed for " .. table.concat(failures, "; "), 0)
  end
  return bytesByName
end

local function installPackage(pkg, bytes)
  local ok, err = bundle.verify(bytes, pkg.dist.bundle.sha256)
  if not ok then
    error(string.format("%s@%s: %s", pkg.name, pkg.version, err), 0)
  end

  store.clearStaging(pkg.name)
  ok, err = bundle.extract(bytes, store.stagingDir(pkg.name))
  if not ok then
    store.clearStaging(pkg.name)
    error(string.format("%s@%s: %s", pkg.name, pkg.version, err), 0)
  end
  store.commit(pkg.name)
end

--- Resolve `roots` and make the installed set match. Returns the resolved package list.
function sync.apply(roots)
  local current = state.load()
  current.roots = roots

  local resolved = {}
  if next(roots) ~= nil then
    print("Resolving...")
    resolved = resolve(roots)
  end

  local resolvedByName = {}
  local toInstall = {}
  for _, pkg in ipairs(resolved) do
    resolvedByName[pkg.name] = pkg
    if current.installed[pkg.name] ~= pkg.version then
      toInstall[#toInstall + 1] = pkg
    end
  end

  local orphans = {}
  for name in pairs(current.installed) do
    if not resolvedByName[name] then
      orphans[#orphans + 1] = name
    end
  end
  table.sort(orphans)

  if #toInstall > 0 then
    checkFreeSpace(toInstall)
    for _, pkg in ipairs(toInstall) do
      print(
        string.format(
          "Downloading %s@%s (%s)",
          pkg.name,
          pkg.version,
          formatSize(pkg.dist.bundle.size)
        )
      )
    end
    local bytesByName = downloadAll(toInstall)

    -- Resolve order puts dependencies first; state is saved after every swap so an abort
    -- midway never records a package that is not actually on disk.
    for _, pkg in ipairs(toInstall) do
      installPackage(pkg, bytesByName[pkg.name])
      bytesByName[pkg.name] = nil
      current.installed[pkg.name] = pkg.version
      state.save(current)
      print(string.format("Installed %s@%s", pkg.name, pkg.version))
    end
  end

  for _, name in ipairs(orphans) do
    store.removePackage(name)
    current.installed[name] = nil
    print("Removed " .. name)
  end

  state.save(current)

  if #toInstall == 0 and #orphans == 0 then
    print("Already up to date")
  end
  return resolved
end

return sync
