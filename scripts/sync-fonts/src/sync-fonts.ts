#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import axios from "axios";
import { glob } from "fast-glob";
// wawoff2 has no type definitions on npm; declare a minimal shim below.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — no @types/wawoff2 package exists
import wawoff2 from "wawoff2";

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

interface FontVariantOut {
  weight: number;
  style: string;
  file: string;
  size_bytes: number;
}

interface FontFamilyOut {
  id: string;
  name: string;
  category: string;
  source: "google" | "nerd" | "awesome";
  foundry?: string;
  license: string;
  variants: FontVariantOut[];
  popularity?: number;
  subsets?: string[];
}

interface FontsManifestOut {
  generated_at: string;
  version: string;
  total: number;
  families: FontFamilyOut[];
}

async function compressTtfToWoff2(ttfPath: string): Promise<Buffer> {
  const ttf = readFileSync(ttfPath);
  const woff2 = await wawoff2.compress(ttf);
  return Buffer.from(woff2);
}

function variantSlug(weight: number, style: string): string {
  const w = weight === 400 ? "regular"
          : weight === 700 ? "bold"
          : `w${weight}`;
  return style === "italic" ? `${w}-italic` : w;
}

async function uploadFont(family: string, variant: string, woff2: Buffer): Promise<void> {
  const key = `${family}/${variant}.woff2`;
  await axios.put(
    `${STORAGE_URL}/files/system-fonts/${encodeURIComponent(key)}`,
    woff2,
    {
      headers: {
        "Content-Type": "font/woff2",
        Authorization: `Bearer ${ADMIN_TOKEN}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    },
  );
}

async function processAll(families: RawFamily[]): Promise<FontFamilyOut[]> {
  const out: FontFamilyOut[] = [];
  for (const fam of families) {
    const variants: FontVariantOut[] = [];
    for (const f of fam.files) {
      const slug = variantSlug(f.weight, f.style);
      try {
        const woff2 = await compressTtfToWoff2(f.absPath);
        await uploadFont(fam.id, slug, woff2);
        variants.push({
          weight: f.weight,
          style: f.style,
          file: `${fam.id}/${slug}.woff2`,
          size_bytes: woff2.length,
        });
      } catch (err) {
        console.warn(`  ⚠ skipped ${fam.id}/${slug}:`, (err as Error).message);
      }
    }
    if (variants.length > 0) {
      out.push({
        id: fam.id,
        name: fam.name,
        category: fam.category,
        source: fam.source,
        foundry: fam.foundry,
        license: fam.license,
        variants,
      });
      console.log(`  uploaded ${fam.id} (${variants.length} variants)`);
    } else {
      console.warn(`  skipped ${fam.id} — no variants succeeded`);
    }
  }
  return out;
}

async function uploadManifest(families: FontFamilyOut[]): Promise<void> {
  const manifest: FontsManifestOut = {
    generated_at: new Date().toISOString(),
    version: `1.0.${Date.now()}`,
    total: families.length,
    families,
  };
  const body = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");
  await axios.put(
    `${STORAGE_URL}/files/system-fonts/${encodeURIComponent("manifest.json")}`,
    body,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ADMIN_TOKEN}`,
      },
    },
  );
  console.log(`Manifest uploaded — ${families.length} families`);
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

async function scanNerdFonts(root: string): Promise<RawFamily[]> {
  const dirs = await glob(`${root.replace(/\\/g, "/")}/patched-fonts/*`, { onlyDirectories: true });
  console.log(`  scanning ${dirs.length} nerd families`);
  const families: RawFamily[] = [];
  for (const dir of dirs) {
    const folderName = basename(dir);
    const displayName = folderName.replace(/([A-Z])/g, " $1").trim();
    const ttfs = await glob(`${dir}/**/*.ttf`);
    const files: RawFamily["files"] = ttfs.map((f) => {
      const filename = basename(f).toLowerCase();
      const weight = filename.includes("bold") ? 700 : 400;
      const style = filename.includes("italic") ? "italic" : "normal";
      return { weight, style, absPath: f };
    });
    families.push({
      id: folderName.toLowerCase().replace(/\s+/g, "-") + "-nerd-font",
      name: `${displayName} Nerd Font`,
      category: "programming",
      source: "nerd",
      foundry: "Ryanoasis Nerd Fonts",
      license: "MIT",
      files,
    });
  }
  return families;
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
  const nerdFamilies = await scanNerdFonts(`${WORK_DIR}/nerd-fonts`);
  console.log(`  nerd: ${nerdFamilies.length} families`);

  console.log("Step 3/4 — convert + upload (this is the long one)");
  const allFamilies = [...googleFamilies, ...nerdFamilies];
  const uploaded = await processAll(allFamilies);

  console.log("Step 4/4 — manifest");
  await uploadManifest(uploaded);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
