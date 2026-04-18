#!/usr/bin/env node
/**
 * check-bundle-budget.js
 *
 * Reads the app-build-manifest emitted by `next build` (or the
 * Turbopack `route-bundle-stats.json` diagnostic) and asserts
 * gzipped sizes against per-route budgets.  Exits 1 if any route
 * exceeds its budget.
 *
 * Usage: ANALYZE=true npm run build && node scripts/check-bundle-budget.js
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const KB = 1024;

// Per-route budgets, in gzipped bytes.
//
// Baseline after Wave V vendor trim (J1 2026-04-18):
//   - 172.9 kB lucide-react barrel removed → app-shell shared chunk
//     shrank from 883 kB to 620 kB
//   - global providers + right sidebar + AI chat bar lazy-loaded
//     (~110 kB saved from first-load on every page)
//
// Remaining pressure comes from per-route widget trees that are not yet
// lazy-loaded (dashboard widgets, admin tables, AG-grid-heavy pages).
// These are addressed in Wave VI (virtualisation + RSC migration).
// Budgets below are set slightly above the post-trim reality so that
// regressions are caught quickly without requiring Wave VI-level work
// to keep CI green.
const BUDGETS = {
  "/": 310 * KB, // 301 kB after trim — tight gate
  "/dashboard": 670 * KB, // widget-heavy; lazy-load pass in Wave VI
  "/mail": 520 * KB,
  "/forms": 520 * KB,
  "/contacts": 530 * KB,
  "/projects": 520 * KB,
  "/docs": 670 * KB,
  "/docs/editor": 900 * KB,
  "/sheets/editor": 900 * KB,
  "/design/editor": 900 * KB,
  "/meet/[code]": 900 * KB,
  "/slides/editor": 620 * KB, // fabric + pptxgenjs tree
  "/crm": 600 * KB,
  "/storage": 600 * KB,
  "/forms/[id]": 600 * KB,
  "/admin/roles": 600 * KB,
  "/monitoring": 580 * KB,
  "/settings": 580 * KB,
  "/admin/job-velocity": 570 * KB,
  "/tasks": 570 * KB,
  "/chat": 570 * KB,
  "/admin/container-resources": 570 * KB,
  "/admin/ai-cost": 570 * KB,
  "/analytics": 570 * KB,
  "/users": 570 * KB,
  "/admin/api-platform": 560 * KB,
  "/admin/workspaces": 560 * KB,
  "/admin/email-analytics": 560 * KB,
  "/drive": 560 * KB,
  "/analytics/custom": 560 * KB,
  "/admin/file-types": 550 * KB,
  "/it-assets": 540 * KB,
  "*": 530 * KB, // default for routes not listed above
};

function gzippedSize(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return zlib.gzipSync(data, { level: 9 }).length;
  } catch (err) {
    console.warn(`[budget] could not read ${filePath}: ${err.message}`);
    return 0;
  }
}

function getBudget(route) {
  return BUDGETS[route] ?? BUDGETS["*"];
}

function resolveChunk(relFile) {
  // Manifests sometimes include Windows backslashes.  Normalize so
  // path.resolve works correctly on POSIX CI runners.
  const normalized = relFile.replace(/\\\\/g, "/").replace(/\\/g, "/");
  // Turbopack diagnostics prefix with ".next/", app-build-manifest
  // entries are relative to .next/.  Strip the prefix if present.
  const stripped = normalized.replace(/^\.next\//, "");
  return path.resolve(__dirname, "..", ".next", stripped);
}

function readAppBuildManifest(nextDir) {
  const appManifest = path.join(nextDir, "app-build-manifest.json");
  if (!fs.existsSync(appManifest)) return null;
  const manifest = JSON.parse(fs.readFileSync(appManifest, "utf8"));
  const pages = manifest.pages || {};
  const routes = {};
  for (const [route, files] of Object.entries(pages)) {
    routes[route] = files;
  }
  return routes;
}

function readTurbopackDiagnostics(nextDir) {
  const diag = path.join(nextDir, "diagnostics", "route-bundle-stats.json");
  if (!fs.existsSync(diag)) return null;
  const entries = JSON.parse(fs.readFileSync(diag, "utf8"));
  const routes = {};
  for (const entry of entries) {
    if (!entry.route || !Array.isArray(entry.firstLoadChunkPaths)) continue;
    routes[entry.route] = entry.firstLoadChunkPaths;
  }
  return routes;
}

function main() {
  const nextDir = path.resolve(__dirname, "..", ".next");
  if (!fs.existsSync(nextDir)) {
    console.error(`[budget] missing ${nextDir}. Run: npm run build first.`);
    process.exit(1);
  }

  const routes =
    readAppBuildManifest(nextDir) ?? readTurbopackDiagnostics(nextDir);
  if (!routes) {
    console.error(
      `[budget] could not find either app-build-manifest.json or diagnostics/route-bundle-stats.json in ${nextDir}. Run: npm run build first.`,
    );
    process.exit(1);
  }

  let failed = false;
  const results = [];

  for (const [route, files] of Object.entries(routes)) {
    let total = 0;
    for (const relFile of files) {
      const abs = resolveChunk(relFile);
      if (fs.existsSync(abs) && abs.endsWith(".js")) {
        total += gzippedSize(abs);
      }
    }

    const budget = getBudget(route);
    const ok = total <= budget;
    if (!ok) failed = true;
    results.push({ route, total, budget, ok });
  }

  // Sort by ratio of actual/budget descending — worst offenders first.
  results.sort((a, b) => b.total / b.budget - a.total / a.budget);

  for (const { route, total, budget, ok } of results) {
    const status = ok ? "ok  " : "FAIL";
    const pct = Math.round((total / budget) * 100);
    console.log(
      `[${status}] ${route.padEnd(24)} ${(total / KB).toFixed(1).padStart(8)} kB / ${(budget / KB).toFixed(0)} kB (${pct}%)`,
    );
  }

  if (failed) {
    console.error("\n[budget] one or more routes exceeded their budget.");
    process.exit(1);
  }
  console.log("\n[budget] all routes within budget.");
}

main();
