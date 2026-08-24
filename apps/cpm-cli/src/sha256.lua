-- SHA-256 (FIPS 180-4) on bit32, for verifying bundle digests on CC:Tweaked.
--
-- The compression function is adapted from ccryptolib's sha256.lua by Miguel Oliveira
-- (https://github.com/migeyel/ccryptolib), MIT License, Copyright (c) 2023 Miguel Oliveira.
-- ccryptolib's generated packing helpers are replaced with string.pack/unpack, which
-- CC:Tweaked's Cobalt runtime provides, so this file is dependency free.

local band, bnot, bxor = bit32.band, bit32.bnot, bit32.bxor
local rrotate, rshift = bit32.rrotate, bit32.rshift
local unpack = table.unpack

local BLOCK_FORMAT = ">" .. ("I4"):rep(16)

-- Round constants: first 32 bits of the fractional parts of the cube roots of the first 64 primes.
-- stylua: ignore
local K = {
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
}

-- Initial hash: first 32 bits of the fractional parts of the square roots of the first 8 primes.
-- stylua: ignore
local H0 = {
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
}

-- Sums are allowed to exceed 2^32 inside a round because bit32 reduces its arguments modulo 2^32;
-- only the chaining values are reduced explicitly so they stay representable for string.format.
local function compress(h, w)
  for j = 17, 64 do
    local w15 = w[j - 15]
    local w2 = w[j - 2]
    local s0 = bxor(rrotate(w15, 7), rrotate(w15, 18), rshift(w15, 3))
    local s1 = bxor(rrotate(w2, 17), rrotate(w2, 19), rshift(w2, 10))
    w[j] = (w[j - 16] + s0 + w[j - 7] + s1) % 2 ^ 32
  end

  local a, b, c, d, e, f, g, hh = unpack(h)
  for j = 1, 64 do
    local S1 = bxor(rrotate(e, 6), rrotate(e, 11), rrotate(e, 25))
    local ch = bxor(band(e, f), band(bnot(e), g))
    local temp1 = hh + S1 + ch + K[j] + w[j]
    local S0 = bxor(rrotate(a, 2), rrotate(a, 13), rrotate(a, 22))
    local maj = bxor(band(a, b), band(a, c), band(b, c))
    local temp2 = S0 + maj

    hh = g
    g = f
    f = e
    e = (d + temp1) % 2 ^ 32
    d = c
    c = b
    b = a
    a = (temp1 + temp2) % 2 ^ 32
  end

  h[1] = (h[1] + a) % 2 ^ 32
  h[2] = (h[2] + b) % 2 ^ 32
  h[3] = (h[3] + c) % 2 ^ 32
  h[4] = (h[4] + d) % 2 ^ 32
  h[5] = (h[5] + e) % 2 ^ 32
  h[6] = (h[6] + f) % 2 ^ 32
  h[7] = (h[7] + g) % 2 ^ 32
  h[8] = (h[8] + hh) % 2 ^ 32
end

-- Hands control back to the CC scheduler so long hashes do not trip the yield watchdog.
local function yield()
  os.queueEvent("cpm_yield")
  os.pullEvent("cpm_yield")
end

local sha256 = {}

--- Returns the lowercase hex SHA-256 digest of `data`, yielding every `yieldEvery` bytes
--- (default 8 KB) of processed input.
function sha256.hex(data, yieldEvery)
  yieldEvery = yieldEvery or 8192

  -- Pad to a multiple of 64 bytes: 0x80, zeros, then the bit length as a 64-bit big-endian
  -- integer split into two 32-bit halves (no reliance on 64-bit integer support).
  local bitlen = #data * 8
  local padlen = -(#data + 9) % 64
  local lengthHigh = math.floor(bitlen / 2 ^ 32)
  local lengthLow = bitlen % 2 ^ 32
  data = data .. "\128" .. ("\0"):rep(padlen) .. string.pack(">I4I4", lengthHigh, lengthLow)

  local h = { unpack(H0) }
  local sinceYield = 0
  for i = 1, #data, 64 do
    compress(h, { string.unpack(BLOCK_FORMAT, data, i) })
    sinceYield = sinceYield + 64
    if sinceYield >= yieldEvery then
      sinceYield = 0
      yield()
    end
  end

  return string.format("%08x%08x%08x%08x%08x%08x%08x%08x", unpack(h))
end

return sha256
