#!/usr/bin/env node
/**
 * Helper: identify heaviest shared chunks (used by >10 routes) from the
 * Turbopack route-bundle-stats diagnostic.  Used during the Wave V
 * bundle-trim audit.
 */
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const stats = JSON.parse(
  fs.readFileSync(".next/diagnostics/route-bundle-stats.json", "utf8"),
);
const seen = new Map();
for (const entry of stats) {
  if (!entry.firstLoadChunkPaths) continue;
  for (const f of entry.firstLoadChunkPaths) {
    if (!f.endsWith(".js")) continue;
    seen.set(f, (seen.get(f) || 0) + 1);
  }
}
const shared = [...seen.entries()].filter(([, n]) => n > 10);
let total = 0;
const results = [];
for (const [f, n] of shared) {
  const norm = f.replace(/\\/g, "/");
  const stripped = norm.replace(/^\.next\//, "");
  const abs = path.resolve(".next", stripped);
  let gz = 0,
    raw = 0;
  try {
    const data = fs.readFileSync(abs);
    raw = data.length;
    gz = zlib.gzipSync(data, { level: 9 }).length;
    total += gz;
  } catch (_) {}
  results.push({ f, n, gz, raw });
}
results.sort((a, b) => b.gz - a.gz);
console.log("Total shared gzipped:", (total / 1024).toFixed(1) + "kB");
console.log("Top 30 heaviest shared chunks:");
for (const r of results.slice(0, 30)) {
  console.log(
    String(r.n).padStart(4),
    (r.gz / 1024).toFixed(1).padStart(8) + "kB",
    "(raw " + (r.raw / 1024).toFixed(0) + "kB)",
    r.f,
  );
}
