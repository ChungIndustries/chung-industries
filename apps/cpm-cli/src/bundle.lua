-- The bundle container: "<manifest length>\n<manifest JSON><raw file bytes>".
-- Files are located by manifest offsets (relative to the first blob byte) and sliced out with
-- string.sub, so the only parsing is a few hundred bytes of JSON regardless of package size.

local sha256 = require("cpm.sha256")

local FILES_PER_YIELD = 4

local bundle = {}

local function yield()
  os.queueEvent("cpm_yield")
  os.pullEvent("cpm_yield")
end

--- Paths come from the registry, which validates them at publish, but the client re-checks
--- before writing so a misbehaving registry cannot escape the package directory.
function bundle.validatePath(path)
  if type(path) ~= "string" or path == "" then
    return false, "empty path"
  end
  if path:find("\\", 1, true) then
    return false, "backslash in path"
  end
  if path:sub(1, 1) == "/" then
    return false, "absolute path"
  end
  for segment in (path .. "/"):gmatch("([^/]*)/") do
    if segment == "" or segment == "." or segment == ".." then
      return false, "invalid path segment"
    end
  end
  return true
end

--- Parse the container into a list of { path, offset, length } plus the 1-based blob start.
function bundle.parse(bytes)
  local newline = bytes:find("\n", 1, true)
  if not newline then
    return nil, "bundle is missing the manifest length line"
  end
  local header = bytes:sub(1, newline - 1)
  if not header:match("^%d+$") then
    return nil, "bundle manifest length is not a number"
  end
  local manifestLength = tonumber(header)
  local blobStart = newline + manifestLength + 1
  if blobStart > #bytes + 1 then
    return nil, "bundle manifest is truncated"
  end

  local manifest = textutils.unserialiseJSON(bytes:sub(newline + 1, newline + manifestLength))
  if type(manifest) ~= "table" or type(manifest.files) ~= "table" then
    return nil, "bundle manifest is not valid JSON"
  end

  local blobLength = #bytes - blobStart + 1
  for _, file in ipairs(manifest.files) do
    local ok, reason = bundle.validatePath(file.path)
    if not ok then
      return nil, string.format("rejected path %s: %s", tostring(file.path), reason)
    end
    if
      type(file.offset) ~= "number"
      or type(file.length) ~= "number"
      or file.offset < 0
      or file.length < 0
      or file.offset + file.length > blobLength
    then
      return nil, "bundle entry " .. file.path .. " points outside the blob"
    end
  end

  return manifest.files, blobStart
end

--- Compare the digest of the entire response body against the registry's recorded hex digest.
function bundle.verify(bytes, expectedHex)
  if type(expectedHex) ~= "string" or not expectedHex:match("^%x+$") then
    return false, "registry metadata has no usable bundleSha256"
  end
  local actual = sha256.hex(bytes)
  if actual ~= expectedHex:lower() then
    return false, string.format("sha256 mismatch (expected %s, got %s)", expectedHex, actual)
  end
  return true
end

local function writeBinary(path, content)
  local parent = fs.getDir(path)
  if parent ~= "" and not fs.exists(parent) then
    fs.makeDir(parent)
  end
  local handle, err = fs.open(path, "wb")
  if not handle then
    return false, err or ("cannot open " .. path)
  end
  handle.write(content)
  handle.close()
  return true
end

--- Write every file in the container under `dir`. Paths are validated by parse, so the caller
--- should point `dir` at a staging directory and swap it in only after this succeeds.
function bundle.extract(bytes, dir)
  local files, blobStart = bundle.parse(bytes)
  if not files then
    return false, blobStart
  end

  for index, file in ipairs(files) do
    local first = blobStart + file.offset
    local content = bytes:sub(first, first + file.length - 1)
    local ok, err = writeBinary(fs.combine(dir, file.path), content)
    if not ok then
      return false, err
    end
    if index % FILES_PER_YIELD == 0 then
      yield()
    end
  end
  return true
end

return bundle
