-- HTTP client for the cpm registry: base URL from settings, JSend unwrapping, bundle download.

local DEFAULT_URL = "https://registry.cpm.chungindustries.com"

settings.define("cpm.registry", {
  description = "Base URL of the cpm registry",
  default = DEFAULT_URL,
  type = "string",
})

local registry = {}

function registry.baseUrl()
  local url = settings.get("cpm.registry", DEFAULT_URL)
  return (url:gsub("/+$", ""))
end

local function readAll(handle)
  local body = handle.readAll()
  handle.close()
  return body or ""
end

-- JSend: success carries data, fail carries data.message, error carries a top-level message.
local function unwrap(body)
  local doc = textutils.unserialiseJSON(body)
  if type(doc) ~= "table" then
    return nil, "registry returned an unreadable response"
  end
  if doc.status == "success" then
    return doc.data
  end
  if type(doc.data) == "table" and type(doc.data.message) == "string" then
    return nil, doc.data.message
  end
  if type(doc.message) == "string" then
    return nil, doc.message
  end
  return nil, "registry request failed"
end

-- On failure CC hands back the error response (when there is one) as a third value, which is
-- where the JSend message lives, so prefer that over the generic transport error string.
local function describeFailure(err, failed)
  if failed then
    local code = failed.getResponseCode()
    local _, message = unwrap(readAll(failed))
    return string.format("%s (HTTP %d)", message, code)
  end
  return err or "unknown HTTP error"
end

local function requestJson(method, path, body)
  local options = {
    url = registry.baseUrl() .. path,
    headers = { Accept = "application/json" },
  }
  if body ~= nil then
    options.body = textutils.serialiseJSON(body)
    options.headers["Content-Type"] = "application/json"
  end

  local response, err, failed = (method == "POST" and http.post or http.get)(options)
  if not response then
    return nil, describeFailure(err, failed)
  end
  return unwrap(readAll(response))
end

--- GET `path` and return the JSend data, or nil plus a message.
function registry.get(path)
  return requestJson("GET", path)
end

--- POST `body` as JSON to `path` and return the JSend data, or nil plus a message.
function registry.post(path, body)
  return requestJson("POST", path, body)
end

--- Download a bundle container by its `dist.bundle` path and return the raw bytes.
--- Gzip is requested explicitly because CC only decompresses what it negotiated for, and
--- decompression happens in Java so the bytes seen here are the stored artifact.
function registry.getBundle(path)
  local options = {
    url = registry.baseUrl() .. path,
    binary = true,
    headers = { ["Accept-Encoding"] = "gzip" },
  }

  -- One retry covers the occasional dropped connection without hiding real failures.
  local lastErr
  for _ = 1, 2 do
    local response, err, failed = http.get(options)
    if response then
      return readAll(response)
    end
    lastErr = describeFailure(err, failed)
  end
  return nil, lastErr
end

return registry
