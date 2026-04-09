#!/usr/bin/env node
/**
 * Frontend license policy checker
 *
 * Politique : usage commercial illimité uniquement.
 * Voir ../memory/feedback_license_policy.md et ../../deny.toml (côté Rust).
 *
 * Runs license-checker via its JS API to avoid cmd.exe quoting issues with
 * parentheses in combined license expressions like "(MPL-2.0 OR Apache-2.0)".
 *
 * Usage:
 *   node scripts/check-licenses.js           # strict check (exits 1 on violation)
 *   node scripts/check-licenses.js --summary # print histogram only
 */
const { init } = require("license-checker");
const path = require("path");

// Licences explicitement autorisées. Inclut les expressions combinées parce que
// license-checker renvoie la string exacte du package.json.
const ALLOWED = new Set([
  // Permissives principales
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "0BSD",
  "CC0-1.0",
  "CC-BY-4.0",
  "Unlicense",
  "MIT-0",
  "BlueOak-1.0.0",
  "Python-2.0",
  // Weak copyleft (consommateur seulement — interdit de modifier ces sources)
  "MPL-2.0",
  // Expressions dual-license (on prend l'option permissive)
  "(MIT OR Apache-2.0)",
  "(Apache-2.0 OR MIT)",
  "MIT OR Apache-2.0",
  "Apache-2.0 OR MIT",
  "(MPL-2.0 OR Apache-2.0)",
  "(MIT OR GPL-3.0-or-later)", // on choisit MIT
  // Expressions combinées (les deux doivent être OK)
  "(MIT AND Zlib)",
  "MIT AND ISC",
  "(Apache-2.0 AND BSD-3-Clause)",
]);

// Packages explicitement exclus du check (exceptions documentées).
// Voir memory/feedback_license_policy.md pour la justification complète.
const EXCLUDED = new Set([
  // Notre propre package — license MIT déclarée, mais license-checker inclut
  // parfois les packages private avec "UNLICENSED" par défaut si le champ
  // n'est pas exactement au bon endroit. Exclusion défensive.
  "client@0.1.0",
  // sharp / libvips : LGPL-3.0 dynamiquement linkée (industrie standard pour
  // les libs natives). Next.js Image Optimization en dépend.
  "@img/sharp-win32-x64@0.34.5",
  "@img/sharp-win32-ia32@0.34.5",
  "@img/sharp-libvips-win32-x64@1.2.3",
  "@img/sharp-libvips-win32-ia32@1.2.3",
  // Deps transitives très anciennes où license-checker renvoie "MIT*" (incertain)
  // ou "Custom" parce que le fichier LICENSE n'est pas au format standard,
  // mais inspection manuelle confirme MIT/BSD.
  "buffers@0.1.1",
  "chainsaw@0.1.0",
  "traverse@0.3.9",
  "duck@0.1.12",
]);

const summaryMode = process.argv.includes("--summary");

init(
  {
    start: path.resolve(__dirname, ".."),
    production: true,
    excludePrivatePackages: false,
  },
  (err, packages) => {
    if (err) {
      console.error("License check failed to run:", err);
      process.exit(2);
    }

    const violations = [];
    const histogram = new Map();

    for (const [pkgName, info] of Object.entries(packages)) {
      if (EXCLUDED.has(pkgName)) continue;
      const license = info.licenses || "UNKNOWN";
      const licenseStr = Array.isArray(license)
        ? license.join(" AND ")
        : license;
      histogram.set(licenseStr, (histogram.get(licenseStr) || 0) + 1);

      if (!ALLOWED.has(licenseStr)) {
        violations.push({ pkg: pkgName, license: licenseStr });
      }
    }

    if (summaryMode) {
      const sorted = [...histogram.entries()].sort((a, b) => b[1] - a[1]);
      console.log("License histogram (production, exclusions applied):");
      for (const [lic, count] of sorted) {
        console.log(`  ${String(count).padStart(4, " ")}  ${lic}`);
      }
      console.log(
        `\n  Total packages: ${Object.keys(packages).length - EXCLUDED.size}`,
      );
      console.log(`  Violations:     ${violations.length}`);
    }

    if (violations.length > 0) {
      console.error(
        `\nFAILED — ${violations.length} package(s) violate the license policy:\n`,
      );
      for (const { pkg, license } of violations) {
        console.error(`  ${pkg}  =>  ${license}`);
      }
      console.error(
        "\nPolicy: permissive licenses only (MIT/Apache/BSD/ISC/etc.) + MPL-2.0 as consumer.",
      );
      console.error(
        "Forbidden: GPL/AGPL/LGPL/SSPL/BSL/Elastic/Commons-Clause.",
      );
      console.error(
        "See deny.toml and memory/feedback_license_policy.md for details.",
      );
      console.error(
        "\nIf the violation is a dynamically-linked native lib or a false positive,",
      );
      console.error(
        "add it to EXCLUDED in scripts/check-licenses.js with a written justification.",
      );
      process.exit(1);
    }

    if (!summaryMode) {
      console.log(
        `OK — ${Object.keys(packages).length - EXCLUDED.size} packages checked, 0 violations.`,
      );
    }
  },
);
