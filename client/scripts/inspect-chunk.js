#!/usr/bin/env node
/**
 * Helper: scan a chunk file for known heavy package markers.
 */
const fs = require("fs");
const target = process.argv[2] || ".next/static/chunks/0-gjxec4kjcmv.js";
const c = fs.readFileSync(target, "utf8");
const packages = [
  "@tauri-apps",
  "framer-motion",
  "moment",
  "lodash",
  "recharts",
  "react-dom",
  "@radix-ui",
  "@tiptap",
  "react-pdf",
  "highlight.js",
  "date-fns",
  "luxon",
  "dayjs",
  "zod",
  "lucide-react",
  "axios",
  "socket.io",
  "yjs",
  "monaco",
  "@livekit",
  "pptxgenjs",
  "exceljs",
  "onnxruntime",
  "@ricky0123/vad",
  "chart.js",
  "plotly",
  "d3",
  "pdfjs",
  "immer",
  "zustand",
  "react-hook-form",
  "@tanstack",
  "unified",
  "remark",
  "@base-ui-components",
];
for (const p of packages) {
  const idx = c.indexOf(p);
  if (idx >= 0) {
    let count = 0;
    let i = 0;
    while ((i = c.indexOf(p, i + 1)) >= 0) count++;
    console.log(p.padEnd(25), "occurrences:", count);
  }
}
console.log("Total size (chars):", c.length);
