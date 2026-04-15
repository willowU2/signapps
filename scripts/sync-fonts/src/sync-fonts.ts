#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import axios from "axios";
import glob from "fast-glob";
// wawoff2 has no type definitions on npm; declare a minimal shim below.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — no @types/wawoff2 package exists
import wawoff2 from "wawoff2";

const WORK_DIR = resolve(process.cwd(), ".sync-fonts-work");
const STORAGE_URL = process.env.STORAGE_URL ?? "http://localhost:3004/api/v1";
const IDENTITY_URL = process.env.IDENTITY_URL ?? "http://localhost:3001/api/v1";
const ADMIN_USERNAME = process.env.STORAGE_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.STORAGE_ADMIN_PASSWORD ?? "admin";
const SYNC_MODE = process.env.SYNC_MODE ?? "curated"; // "curated" | "full"
const UPLOAD_DELAY_MS = Number(process.env.UPLOAD_DELAY_MS ?? "50");

// Curated top 100 Google Fonts (by popularity, 2024). Names matched against
// the `name` field in METADATA.pb.
const TOP_GOOGLE_NAMES = new Set<string>([
  "Roboto", "Open Sans", "Noto Sans", "Noto Sans JP", "Montserrat", "Poppins",
  "Lato", "Inter", "Roboto Condensed", "Material Symbols Outlined",
  "Material Icons", "Oswald", "Raleway", "Nunito Sans", "Nunito", "Ubuntu",
  "Roboto Mono", "PT Sans", "Rubik", "Playfair Display", "Lora", "Merriweather",
  "Kanit", "Work Sans", "Fira Sans", "Mulish", "Roboto Slab", "Noto Sans KR",
  "Quicksand", "Barlow", "Noto Sans TC", "DM Sans", "PT Serif", "Bebas Neue",
  "Manrope", "Titillium Web", "Heebo", "Inconsolata", "Source Sans 3",
  "Noto Serif", "Hind Siliguri", "Dosis", "Libre Franklin", "Josefin Sans",
  "Mukta", "Source Code Pro", "Anton", "Cairo", "Bitter", "IBM Plex Sans",
  "Arimo", "Karla", "PT Sans Narrow", "Fjalla One", "Jost", "Noto Sans SC",
  "Libre Baskerville", "Abel", "Crimson Text", "Pacifico", "Teko", "Shadows Into Light",
  "Varela Round", "Hind", "Comfortaa", "EB Garamond", "Exo 2", "Assistant",
  "Prompt", "Archivo Narrow", "Cabin", "Dancing Script", "Slabo 27px",
  "Overpass", "Outfit", "Space Grotesk", "Yanone Kaffeesatz", "Archivo",
  "Tajawal", "Maven Pro", "Space Mono", "Figtree", "Caveat", "Barlow Condensed",
  "Questrial", "IBM Plex Mono", "Signika", "Asap", "Domine", "Saira Condensed",
  "Roboto Serif", "Noto Serif JP", "Permanent Marker", "Vollkorn", "Monda",
  "Arvo", "Abril Fatface", "Cormorant Garamond", "Fira Code", "JetBrains Mono",
  "Public Sans", "Plus Jakarta Sans", "Zilla Slab", "Satisfy", "Exo",
]);

// Curated popular Nerd Fonts (programming).
const TOP_NERD_FOLDER_NAMES = new Set<string>([
  "FiraCode", "JetBrainsMono", "Hack", "CascadiaCode", "SourceCodePro",
  "Meslo", "Iosevka", "UbuntuMono", "Inconsolata", "RobotoMono",
]);

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

// ─── Token management ──────────────────────────────────────────────────────

let currentToken: string | null = null;
let tokenFetchedAt = 0;
const TOKEN_TTL_MS = 12 * 60 * 1000; // refresh every 12 min (token lives 15 min)

async function fetchToken(): Promise<string> {
  const res = await axios.post(
    `${IDENTITY_URL}/auth/login`,
    {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
      remember_me: true,
    },
    { timeout: 10000 },
  );
  const token = res.data?.access_token;
  if (!token) throw new Error("No access_token in login response");
  return token;
}

async function getToken(): Promise<string> {
  const now = Date.now();
  if (!currentToken || now - tokenFetchedAt > TOKEN_TTL_MS) {
    currentToken = await fetchToken();
    tokenFetchedAt = now;
    console.log(`  [token] refreshed at ${new Date(now).toISOString()}`);
  }
  return currentToken;
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function uploadFont(family: string, variant: string, woff2: Buffer): Promise<void> {
  const key = `${family}/${variant}.woff2`;
  const token = await getToken();
  await axios.put(
    `${STORAGE_URL}/files/system-fonts/${encodeURIComponent(key)}`,
    woff2,
    {
      headers: {
        "Content-Type": "font/woff2",
        Authorization: `Bearer ${token}`,
        Connection: "close",
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 30000,
    },
  );
}

async function processAll(families: RawFamily[]): Promise<FontFamilyOut[]> {
  const out: FontFamilyOut[] = [];
  const total = families.length;
  let idx = 0;
  for (const fam of families) {
    idx += 1;
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
        if (UPLOAD_DELAY_MS > 0) await sleep(UPLOAD_DELAY_MS);
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
      console.log(`  [${idx}/${total}] uploaded ${fam.id} (${variants.length} variants)`);
    } else {
      console.warn(`  [${idx}/${total}] skipped ${fam.id} — no variants succeeded`);
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
  const token = await getToken();
  await axios.put(
    `${STORAGE_URL}/files/system-fonts/${encodeURIComponent("manifest.json")}`,
    body,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Connection: "close",
      },
      timeout: 30000,
    },
  );
  console.log(`Manifest uploaded — ${families.length} families`);
}

function cloneShallow(repo: string, dest: string, sparsePaths?: string[]) {
  if (existsSync(dest)) {
    console.log(`  cached: ${dest}`);
    return;
  }
  console.log(`  cloning ${repo} → ${dest}`);
  if (sparsePaths && sparsePaths.length > 0) {
    execSync(`git clone --depth 1 --filter=blob:none --no-checkout ${repo} ${dest}`, {
      stdio: "inherit",
    });
    execSync(`git -C ${dest} sparse-checkout init --cone`, { stdio: "inherit" });
    execSync(`git -C ${dest} sparse-checkout set ${sparsePaths.join(" ")}`, {
      stdio: "inherit",
    });
    execSync(`git -C ${dest} checkout`, { stdio: "inherit" });
  } else {
    execSync(`git clone --depth 1 ${repo} ${dest}`, { stdio: "inherit" });
  }
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
  console.log(`  scanning ${metadataPaths.length} google families (on disk)`);
  const all = metadataPaths
    .map(parseGoogleMetadata)
    .filter((f): f is RawFamily => f !== null);
  if (SYNC_MODE === "curated") {
    const filtered = all.filter((f) => TOP_GOOGLE_NAMES.has(f.name));
    console.log(`  curated mode: kept ${filtered.length}/${all.length}`);
    return filtered;
  }
  return all;
}

async function scanNerdFonts(root: string): Promise<RawFamily[]> {
  const dirs = await glob(`${root.replace(/\\/g, "/")}/patched-fonts/*`, { onlyDirectories: true });
  console.log(`  scanning ${dirs.length} nerd families (on disk)`);
  const families: RawFamily[] = [];
  for (const dir of dirs) {
    const folderName = basename(dir);
    if (SYNC_MODE === "curated" && !TOP_NERD_FOLDER_NAMES.has(folderName)) continue;
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
  if (SYNC_MODE === "curated") {
    console.log(`  curated mode: kept ${families.length}/${dirs.length}`);
  }
  return families;
}

async function main() {
  await mkdir(WORK_DIR, { recursive: true });
  console.log(`Working in ${WORK_DIR}`);
  console.log(`Sync mode: ${SYNC_MODE.toUpperCase()}`);

  // Fetch initial token up front so a bad auth fails fast.
  await getToken();

  console.log("Step 1/4 — clone sources");
  cloneShallow("https://github.com/google/fonts.git", `${WORK_DIR}/google-fonts`, [
    "ofl",
    "apache",
    "ufl",
  ]);
  cloneShallow("https://github.com/ryanoasis/nerd-fonts.git", `${WORK_DIR}/nerd-fonts`);
  cloneShallow("https://github.com/brabadu/awesome-fonts.git", `${WORK_DIR}/awesome-fonts`);

  console.log("Step 2/4 — scan sources");
  const googleFamilies = await scanGoogleFonts(`${WORK_DIR}/google-fonts`);
  console.log(`  google: ${googleFamilies.length} families selected`);
  const nerdFamilies = await scanNerdFonts(`${WORK_DIR}/nerd-fonts`);
  console.log(`  nerd: ${nerdFamilies.length} families selected`);

  console.log("Step 3/4 — convert + upload");
  const allFamilies = [...googleFamilies, ...nerdFamilies];
  const uploaded = await processAll(allFamilies);

  console.log("Step 4/4 — manifest");
  await uploadManifest(uploaded);
  console.log(`Done. ${uploaded.length} families uploaded.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
