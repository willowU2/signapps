#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const WORK_DIR = resolve(process.cwd(), ".sync-fonts-work");
const STORAGE_URL = process.env.STORAGE_URL ?? "http://localhost:3004/api/v1";
const ADMIN_TOKEN = process.env.STORAGE_ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error("STORAGE_ADMIN_TOKEN env var required");
  process.exit(1);
}

function cloneShallow(repo: string, dest: string) {
  if (existsSync(dest)) {
    console.log(`  cached: ${dest}`);
    return;
  }
  console.log(`  cloning ${repo} → ${dest}`);
  execSync(`git clone --depth 1 ${repo} ${dest}`, { stdio: "inherit" });
}

async function main() {
  await mkdir(WORK_DIR, { recursive: true });
  console.log(`Working in ${WORK_DIR}`);

  console.log("Step 1/4 — clone sources");
  cloneShallow("https://github.com/google/fonts.git", `${WORK_DIR}/google-fonts`);
  cloneShallow("https://github.com/ryanoasis/nerd-fonts.git", `${WORK_DIR}/nerd-fonts`);
  cloneShallow("https://github.com/brabadu/awesome-fonts.git", `${WORK_DIR}/awesome-fonts`);

  // TODO: parse, convert, upload
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
