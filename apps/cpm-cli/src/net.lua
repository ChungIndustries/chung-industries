-- Shared HTTP helpers: response reading, JSend unwrapping, JSON requests, and binary
-- downloads. Callers pass full URLs; knowing where the registry lives is registry.lua's job.
--
-- The bootstrap installer (install.lua) deliberately does not use this module: it runs
-- before anything is installed, so it keeps its own minimal copies of readAll and the
-- JSend message lookup.

local net = {}

--- Read a response (or error response) handle to the end and close it.
function net.readAll(handle)
  local body = handle.readAll()
  handle.close()
  return body or ""
end

-- JSend: success carries data, fail carries data.message, error carries a top-level message.
local function unwrap(body)
  local doc = textutils.unserialiseJSON(body)
  if type(doc) ~= "table" then
    return nil, "server returned an unreadable response"
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
  return nil, "request failed"
end

-- On failure CC hands back the error response (when there is one) as a third value, which is
-- where the JSend message lives, so prefer that over the generic transport error string.
local function describeFailure(err, failed)
  if failed then
    local code = failed.getResponseCode()
    local _, message = unwrap(net.readAll(failed))
    return string.format("%s (HTTP %d)", message, code)
  end
  return err or "unknown HTTP error"
end

--- GET or POST `url` as JSON and return the JSend data, or nil plus a message.
function net.requestJson(method, url, body)
  local options = {
    url = url,
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
  return unwrap(net.readAll(response))
end

--- Download raw bytes from `url`. Gzip is requested explicitly because CC only decompresses
--- what it negotiated for, and decompression happens in Java, so the bytes returned are the
--- stored artifact. One retry covers the occasional dropped connection without hiding real
--- failures.
function net.getBytes(url)
  local options = {
    url = url,
    binary = true,
    headers = { ["Accept-Encoding"] = "gzip" },
  }

  local lastErr
  for _ = 1, 2 do
    local response, err, failed = http.get(options)
    if response then
      return net.readAll(response)
    end
    lastErr = describeFailure(err, failed)
  end
  return nil, lastErr
end

return net
