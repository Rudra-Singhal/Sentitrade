const crypto = require("crypto");

const tokenHash = (token) => crypto.createHash("sha1").update(token).digest().readBigUInt64BE(0);

const tokenize = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

/** 64-bit SimHash of the text's tokens, returned as a 16-char hex string. */
const simhash = (text) => {
  const tokens = tokenize(text);
  if (!tokens.length) return "0000000000000000";

  const bits = new Array(64).fill(0);
  for (const t of tokens) {
    const h = tokenHash(t);
    for (let i = 0; i < 64; i += 1) bits[i] += (h >> BigInt(i)) & 1n ? 1 : -1;
  }

  let out = 0n;
  for (let i = 0; i < 64; i += 1) if (bits[i] > 0) out |= 1n << BigInt(i);
  return out.toString(16).padStart(16, "0");
};

const hamming = (hexA, hexB) => {
  let x = BigInt(`0x${hexA}`) ^ BigInt(`0x${hexB}`);
  let count = 0;
  while (x) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
};

// distance <= 3 over 64 bits ≈ near-identical text
const isNearDuplicate = (hexA, hexB, threshold = 3) => hamming(hexA, hexB) <= threshold;

module.exports = { simhash, hamming, isNearDuplicate, tokenize };
