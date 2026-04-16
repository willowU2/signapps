#!/usr/bin/env node
/**
 * Scan src/ for <Button size="icon..."> JSX elements that have no
 * aria-label, no aria-labelledby, and no sr-only child — the
 * axe button-name trap. Emits a markdown table with file:line so the
 * next migration wave can grind through them.
 *
 * Heuristic parser, not an AST — fast-and-cheap.
 */
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src/app", "src/components"];

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(p);
  }
  return acc;
}

const files = ROOTS.flatMap((r) => walk(r, []));

const OPEN = /<Button\b([^>]*?)>/g;
const hits = [];

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split("\n");
  let m;
  OPEN.lastIndex = 0;
  while ((m = OPEN.exec(src)) !== null) {
    const opening = m[0];
    if (!/size=["']icon/.test(opening)) continue;
    if (/aria-label\s*=/.test(opening)) continue;
    if (/aria-labelledby\s*=/.test(opening)) continue;
    // Check the first 400 chars after the opening for sr-only or text
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + 400);
    if (/sr-only/.test(after)) continue;

    // Compute line number
    const lineIdx = src.slice(0, m.index).split("\n").length;
    hits.push({
      file: file.replace(/\\/g, "/"),
      line: lineIdx,
      preview: lines[lineIdx - 1]?.trim().slice(0, 80) ?? "",
    });
  }
}

// Group by file
const byFile = new Map();
for (const h of hits) {
  const arr = byFile.get(h.file) ?? [];
  arr.push(h);
  byFile.set(h.file, arr);
}

const entries = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);

console.log("# Icon-only Button sites without aria-label");
console.log("");
console.log("Total : " + hits.length + " sites across " + entries.length + " files.");
console.log("");
console.log("## By file (top 30)");
console.log("");
console.log("| Count | File |");
console.log("|---:|---|");
for (const [file, arr] of entries.slice(0, 30)) {
  console.log("| " + arr.length + " | `" + file + "` |");
}
console.log("");
console.log("## Full list");
console.log("");
for (const [file, arr] of entries) {
  console.log("### `" + file + "`");
  for (const h of arr) console.log("- L" + h.line + ": `" + h.preview + "`");
  console.log("");
}
