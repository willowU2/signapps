/**
 * Manifest regression test — SO5 adds a Directory shortcut.
 *
 * Parses `public/manifest.json` and asserts the shortcut entry points at the
 * expected `/directory` URL with both 192×192 and 512×512 icons. The PWA
 * install flow fails silently when a shortcut's icon is missing, so this
 * test guards against accidentally removing the asset or the manifest entry.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface ManifestShortcut {
  name?: string;
  url?: string;
  icons?: Array<{ src: string; sizes?: string }>;
}

interface Manifest {
  name?: string;
  shortcuts?: ManifestShortcut[];
}

function readManifest(): Manifest {
  const path = resolve(__dirname, "..", "..", "public", "manifest.json");
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as Manifest;
}

describe("public/manifest.json", () => {
  const manifest = readManifest();

  it("exposes the Directory shortcut", () => {
    const shortcuts = manifest.shortcuts ?? [];
    const directory = shortcuts.find((s) => s.url === "/directory");
    expect(directory).toBeDefined();
  });

  it("Directory shortcut has 192 and 512 icons", () => {
    const shortcut = (manifest.shortcuts ?? []).find(
      (s) => s.url === "/directory",
    );
    const sizes = (shortcut?.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });
});
