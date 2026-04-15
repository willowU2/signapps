#!/usr/bin/env tsx
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const WORK_DIR = resolve(process.cwd(), ".sync-fonts-work");
const STORAGE_URL = process.env.STORAGE_URL ?? "http://localhost:3004/api/v1";
const ADMIN_TOKEN = process.env.STORAGE_ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error("STORAGE_ADMIN_TOKEN env var required");
  process.exit(1);
}

async function main() {
  await mkdir(WORK_DIR, { recursive: true });
  console.log(`Working in ${WORK_DIR}`);
  // TODO: clone, parse, convert, upload
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
