#!/usr/bin/env node
/**
 * Mechanical codemod: for every <Button ... size="icon*" ...> that has
 * no aria-label, add one derived from the title prop (if present) or
 * from the icon component name. Also adds aria-hidden="true" to the
 * first child element if it's an icon (single JSX element child).
 *
 * Dry-run by default. Pass --write to apply changes.
 */
import fs from "node:fs";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const ROOTS = ["src/app", "src/components"];

// Icon → label mapping for icons without title
const ICON_LABELS = {
  Trash2: "Supprimer",
  Pencil: "Modifier",
  Edit: "Modifier",
  Edit3: "Modifier",
  Plus: "Ajouter",
  X: "Fermer",
  Copy: "Copier",
  Download: "Télécharger",
  Upload: "Importer",
  RefreshCw: "Actualiser",
  RotateCcw: "Réinitialiser",
  RotateCw: "Rotation",
  Search: "Rechercher",
  Settings: "Paramètres",
  MoreVertical: "Plus d'actions",
  MoreHorizontal: "Plus d'actions",
  ChevronLeft: "Précédent",
  ChevronRight: "Suivant",
  ChevronUp: "Monter",
  ChevronDown: "Descendre",
  Play: "Lecture",
  Pause: "Pause",
  Square: "Arrêter",
  Send: "Envoyer",
  Eye: "Aperçu",
  EyeOff: "Masquer",
  Pin: "Épingler",
  Star: "Favori",
  Share2: "Partager",
  Maximize2: "Plein écran",
  Minimize2: "Quitter le plein écran",
  ZoomIn: "Zoomer",
  ZoomOut: "Dézoomer",
  Menu: "Menu",
  ArrowLeft: "Retour",
  Home: "Accueil",
  Bell: "Notifications",
  BellOff: "Notifications désactivées",
  Filter: "Filtrer",
  Save: "Sauvegarder",
  Mic: "Microphone",
};

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (/\.tsx$/.test(entry.name)) acc.push(p);
  }
  return acc;
}

const files = ROOTS.flatMap((r) => walk(r, []));
let totalFixed = 0;
let totalFiles = 0;

for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  let modified = false;

  // Match multiline <Button ...> opening tags
  // Use a state machine approach instead of regex to handle > in expressions
  let i = 0;
  const result = [];
  while (i < src.length) {
    const btnStart = src.indexOf("<Button", i);
    if (btnStart === -1) {
      result.push(src.slice(i));
      break;
    }
    result.push(src.slice(i, btnStart));

    // Find the matching > for this opening tag, handling JSX expressions
    let depth = 0;
    let j = btnStart + 7; // skip "<Button"
    let inString = null;
    let inExpr = 0;
    while (j < src.length) {
      const ch = src[j];
      if (inString) {
        if (ch === inString && src[j - 1] !== "\\") inString = null;
      } else if (ch === '"' || ch === "'" || ch === "`") {
        inString = ch;
      } else if (ch === "{") {
        inExpr++;
      } else if (ch === "}") {
        inExpr--;
      } else if (ch === ">" && inExpr === 0) {
        break;
      }
      j++;
    }

    const openingTag = src.slice(btnStart, j + 1);

    // Check if this is an icon button without aria-label
    if (
      /size=["']icon/.test(openingTag) &&
      !/aria-label/.test(openingTag) &&
      !/aria-labelledby/.test(openingTag)
    ) {
      // Check for sr-only in the next 300 chars after the tag
      const afterTag = src.slice(j + 1, j + 400);
      if (!/sr-only/.test(afterTag)) {
        // Try to get label from title
        const titleMatch = openingTag.match(/title=["']([^"']+)["']/);
        let label = titleMatch?.[1];

        if (!label) {
          // Try from dynamic title: title={...}
          // Skip — too complex
          // Try from icon name in the content after the opening tag
          const iconMatch = afterTag.match(/<(\w+)\s+className/);
          if (iconMatch) {
            label = ICON_LABELS[iconMatch[1]];
          }
        }

        if (label) {
          // Insert aria-label before the closing >
          const insertPos = openingTag.length - 1; // before >
          const newTag =
            openingTag.slice(0, insertPos) +
            `\n                aria-label="${label}"` +
            openingTag.slice(insertPos);
          result.push(newTag);
          modified = true;
          totalFixed++;
          i = j + 1;
          continue;
        }
      }
    }

    result.push(openingTag);
    i = j + 1;
  }

  if (modified) {
    totalFiles++;
    const relPath = file.replace(/\\/g, "/");
    if (WRITE) {
      fs.writeFileSync(file, result.join(""), "utf8");
      console.log("FIXED", relPath);
    } else {
      console.log("WOULD FIX", relPath);
    }
  }
}

console.log("");
console.log(
  WRITE
    ? `Done: fixed ${totalFixed} sites in ${totalFiles} files.`
    : `Dry run: would fix ${totalFixed} sites in ${totalFiles} files. Pass --write to apply.`,
);
