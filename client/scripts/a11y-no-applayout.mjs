#!/usr/bin/env node
// Disposable: lists client/src/app/**/page.tsx that lack AppLayout or <main>.
import fs from "node:fs";
import path from "node:path";

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.name === "page.tsx") acc.push(p);
  }
  return acc;
}

const pages = walk("src/app", []);
const missing = [];
for (const p of pages) {
  const content = fs.readFileSync(p, "utf8");
  if (!content.includes("AppLayout") && !content.includes("<main")) {
    missing.push(p.split(path.sep).join("/"));
  }
}
console.log(`Pages without AppLayout/main (${missing.length}):`);
missing.slice(0, 60).forEach((p) => console.log(" ", p));
if (missing.length > 60) console.log(`  ... and ${missing.length - 60} more`);
