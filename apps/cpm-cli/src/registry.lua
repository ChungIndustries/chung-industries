-- The cpm registry client: base URL from settings, endpoints on top of cpm.net.

local net = require("cpm.net")

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

--- GET `path` and return the JSend data, or nil plus a message.
function registry.get(path)
  return net.requestJson("GET", registry.baseUrl() .. path)
end

--- POST `body` as JSON to `path` and return the JSend data, or nil plus a message.
function registry.post(path, body)
  return net.requestJson("POST", registry.baseUrl() .. path, body)
end

--- Download a bundle container by its `dist.bundle.url` path and return the raw bytes.
function registry.getBundle(path)
  return net.getBytes(registry.baseUrl() .. path)
end

return registry
