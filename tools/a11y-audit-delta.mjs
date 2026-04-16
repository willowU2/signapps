#!/usr/bin/env node
/**
 * Compare two @axe-core/playwright baseline JSON files and print the
 * node-level delta per rule, per impact, and the routes with the
 * largest swings.
 *
 * Usage :
 *   node tools/a11y-audit-delta.mjs <old.json> <new.json>
 *
 * Defaults : old = last committed baseline at
 *   docs/bug-sweep/a11y-axe-baseline.json
 * new      = freshly-generated run at
 *   docs/bug-sweep/a11y-axe-baseline.json (same path) — compare vs
 *   a supplied second file to avoid the "both files identical" trap.
 */
import fs from "node:fs";
import path from "node:path";

const oldPath = process.argv[2] ?? "docs/bug-sweep/a11y-axe-baseline.json";
const newPath = process.argv[3];

if (!newPath) {
  console.error("usage: node tools/a11y-audit-delta.mjs <old.json> <new.json>");
  process.exit(2);
}

const oldData = JSON.parse(fs.readFileSync(oldPath, "utf8"));
const newData = JSON.parse(fs.readFileSync(newPath, "utf8"));

function tallyByRule(data) {
  const byRule = {};
  const byImpact = {};
  const perRoute = {};
  let total = 0;
  for (const r of data.results) {
    perRoute[r.route] = 0;
    for (const v of r.violations ?? []) {
      byRule[v.id] = (byRule[v.id] ?? 0) + v.nodes;
      byImpact[v.impact] = (byImpact[v.impact] ?? 0) + v.nodes;
      perRoute[r.route] += v.nodes;
      total += v.nodes;
    }
  }
  return { byRule, byImpact, perRoute, total };
}

const oldT = tallyByRule(oldData);
const newT = tallyByRule(newData);

console.log("=== A11y axe delta ===");
console.log(`Old : ${path.basename(oldPath)}   (${oldData.total_routes} routes, ${oldT.total} violations)`);
console.log(`New : ${path.basename(newPath)}   (${newData.total_routes} routes, ${newT.total} violations)`);
console.log("");

const totalDelta = newT.total - oldT.total;
const sign = totalDelta === 0 ? "" : totalDelta > 0 ? "+" : "";
console.log(`Total delta : ${sign}${totalDelta}\n`);

// By impact
console.log("By impact:");
const impacts = new Set([...Object.keys(oldT.byImpact), ...Object.keys(newT.byImpact)]);
for (const k of ["critical", "serious", "moderate", "minor"]) {
  if (!impacts.has(k)) continue;
  const o = oldT.byImpact[k] ?? 0;
  const n = newT.byImpact[k] ?? 0;
  const d = n - o;
  console.log(`  ${k.padEnd(10)} ${o.toString().padStart(5)} → ${n.toString().padStart(5)}   ${(d === 0 ? "  0" : (d > 0 ? `+${d}` : `${d}`)).padStart(6)}`);
}
console.log("");

// By rule
console.log("By rule (sorted by absolute delta):");
const rules = new Set([...Object.keys(oldT.byRule), ...Object.keys(newT.byRule)]);
const ruleDeltas = [];
for (const r of rules) {
  const o = oldT.byRule[r] ?? 0;
  const n = newT.byRule[r] ?? 0;
  ruleDeltas.push({ rule: r, old: o, new: n, delta: n - o });
}
ruleDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.new - a.new);
for (const r of ruleDeltas) {
  const d = r.delta;
  const mark = d === 0 ? "  =" : d > 0 ? ` +${d}` : ` ${d}`;
  console.log(`  ${r.old.toString().padStart(5)} → ${r.new.toString().padStart(5)}   ${mark.padStart(6)}   ${r.rule}`);
}
console.log("");

// Routes with biggest improvements / regressions
const routeDeltas = [];
const allRoutes = new Set([...Object.keys(oldT.perRoute), ...Object.keys(newT.perRoute)]);
for (const route of allRoutes) {
  const o = oldT.perRoute[route] ?? 0;
  const n = newT.perRoute[route] ?? 0;
  if (o === n) continue;
  routeDeltas.push({ route, old: o, new: n, delta: n - o });
}
routeDeltas.sort((a, b) => a.delta - b.delta);

console.log("Top 15 improvements (biggest drops) :");
for (const r of routeDeltas.slice(0, 15)) {
  console.log(`  ${r.old.toString().padStart(4)} → ${r.new.toString().padStart(4)}   ${r.delta.toString().padStart(5)}   ${r.route}`);
}
console.log("");

const regressions = routeDeltas.filter((r) => r.delta > 0);
if (regressions.length > 0) {
  console.log(`Regressions (${regressions.length} routes) :`);
  for (const r of regressions.slice(0, 10)) {
    console.log(`  ${r.old.toString().padStart(4)} → ${r.new.toString().padStart(4)}   +${r.delta.toString().padStart(4)}   ${r.route}`);
  }
}
