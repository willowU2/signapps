#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { glob } from "fast-glob";

const WORK_DIR = resolve(process.cwd(), ".sync-fonts-work");
const STORAGE_URL = process.env.STORAGE_URL ?? "http://localhost:3004/api/v1";
const ADMIN_TOKEN = process.env.STORAGE_ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error("STORAGE_ADMIN_TOKEN env var required");
  process.exit(1);
}

interface RawFamily {
  id: string;
  name: string;
  category: string;
  source: "google" | "nerd" | "awesome";
  foundry?: string;
  license: string;
  files: { weight: number; style: string; absPath: string }[];
}

function cloneShallow(repo: string, dest: string) {
  if (existsSync(dest)) {
    console.log(`  cached: ${dest}`);
    return;
  }
  console.log(`  cloning ${repo} → ${dest}`);
  execSync(`git clone --depth 1 ${repo} ${dest}`, { stdio: "inherit" });
}

function parseGoogleMetadata(metadataPath: string): RawFamily | null {
  const content = readFileSync(metadataPath, "utf8");
  const name = /name:\s*"([^"]+)"/.exec(content)?.[1];
  const category = /category:\s*"([^"]+)"/.exec(content)?.[1] ?? "SANS_SERIF";
  if (!name) return null;

  const id = name.toLowerCase().replace(/\s+/g, "-");
  const dir = dirname(metadataPath);
  const segments = dir.split(/[\\/]/);
  const license = segments.includes("ofl") ? "OFL-1.1"
                : segments.includes("apache") ? "Apache-2.0"
                : "UFL-1.0";

  const files: RawFamily["files"] = [];
  const fontRegex = /filename:\s*"([^"]+)"\s+post_script_name:\s*"[^"]+"\s+full_name:\s*"[^"]+"\s+style:\s*"([^"]+)"\s+weight:\s*(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = fontRegex.exec(content)) !== null) {
    files.push({
      weight: Number(m[3]),
      style: m[2],
      absPath: `${dir}/${m[1]}`,
    });
  }

  return {
    id,
    name,
    category: category.toLowerCase().replace("_", "-"),
    source: "google",
    foundry: "Google Fonts",
    license,
    files,
  };
}

async function scanGoogleFonts(root: string): Promise<RawFamily[]> {
  const metadataPaths = await glob(`${root.replace(/\\/g, "/")}/{ofl,apache,ufl}/*/METADATA.pb`);
  console.log(`  scanning ${metadataPaths.length} google families`);
  return metadataPaths
    .map(parseGoogleMetadata)
    .filter((f): f is RawFamily => f !== null);
}

async function main() {
  await mkdir(WORK_DIR, { recursive: true });
  console.log(`Working in ${WORK_DIR}`);

  console.log("Step 1/4 — clone sources");
  cloneShallow("https://github.com/google/fonts.git", `${WORK_DIR}/google-fonts`);
  cloneShallow("https://github.com/ryanoasis/nerd-fonts.git", `${WORK_DIR}/nerd-fonts`);
  cloneShallow("https://github.com/brabadu/awesome-fonts.git", `${WORK_DIR}/awesome-fonts`);

  console.log("Step 2/4 — scan sources");
  const googleFamilies = await scanGoogleFonts(`${WORK_DIR}/google-fonts`);
  console.log(`  google: ${googleFamilies.length} families`);

  // TODO: convert, upload
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
