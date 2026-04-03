#!/usr/bin/env node
// Fix remaining process.env.NEXT_PUBLIC_* usages with multiline awareness
import { readFileSync, writeFileSync } from 'fs';

const fixes = [
  {
    file: 'src/app/ai/page.tsx',
    // Remove local shadowing declaration — AI_URL is now imported from core.ts
    replacements: [
      {
        from: `      const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:3005/api/v1';\n`,
        to: ``,
      },
    ],
  },
  {
    file: 'src/components/interop/EventNotesDoc.tsx',
    addImports: ['DOCS_URL'],
    replacements: [
      {
        from: `process.env.NEXT_PUBLIC_DOCS_API || "http://localhost:3012/api/v1"`,
        to: `DOCS_URL`,
      },
    ],
  },
  {
    file: 'src/components/interop/TaskNotificationHooks.tsx',
    addImports: ['MAIL_URL'],
    replacements: [
      {
        from: `process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1"`,
        to: `CALENDAR_URL`,
      },
      {
        from: `process.env.NEXT_PUBLIC_MAIL_API || "http://localhost:3010/api/v1"`,
        to: `MAIL_URL`,
      },
    ],
  },
  {
    file: 'src/components/interop/UnifiedSearch.tsx',
    addImports: ['CALENDAR_URL'],
    replacements: [
      {
        // multiline: const API =\n        process.env.NEXT_PUBLIC_CALENDAR_API || "..."
        from: `const API =\n        process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1"`,
        to: `const API = CALENDAR_URL`,
        replaceAll: true,
      },
      {
        from: `process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1"`,
        to: `CALENDAR_URL`,
        replaceAll: true,
      },
    ],
  },
  {
    file: 'src/components/mail/compose-rich-dialog.tsx',
    addImports: ['CALENDAR_URL'],
    replacements: [
      {
        from: `process.env.NEXT_PUBLIC_CALENDAR_API || 'http://localhost:3011/api/v1'`,
        to: `CALENDAR_URL`,
      },
    ],
  },
  {
    file: 'src/components/mail/mail-display.tsx',
    addImports: ['CALENDAR_URL'],
    replacements: [
      {
        from: `process.env.NEXT_PUBLIC_CALENDAR_API || 'http://localhost:3011/api/v1'`,
        to: `CALENDAR_URL`,
      },
    ],
  },
  {
    file: 'src/hooks/use-monitoring.ts',
    // METRICS_URL is already imported, remove the local shadowing declaration
    replacements: [
      {
        from: `    const METRICS_URL = process.env.NEXT_PUBLIC_METRICS_URL || 'http://localhost:3008/api/v1';\n`,
        to: ``,
      },
    ],
  },
  {
    file: 'src/lib/api/metrics.ts',
    addImports: ['METRICS_URL'],
    replacements: [
      {
        from: `    const base = process.env.NEXT_PUBLIC_METRICS_URL || 'http://localhost:3008/api/v1'`,
        to: `    const base = METRICS_URL`,
      },
    ],
  },
  {
    file: 'src/lib/scheduling/api/scheduling-api.ts',
    // SCHEDULER_URL is already imported, remove the local conflicting declaration
    replacements: [
      {
        from: `const SCHEDULER_URL = process.env.NEXT_PUBLIC_SCHEDULER_URL || 'http://localhost:3007';\n`,
        to: ``,
      },
    ],
  },
];

for (const { file, addImports = [], replacements } of fixes) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    console.log(`  SKIP (not found): ${file}`);
    continue;
  }

  const original = content;

  // Apply replacements
  for (const { from, to, replaceAll } of replacements) {
    if (replaceAll) {
      while (content.includes(from)) {
        content = content.replace(from, to);
      }
    } else {
      content = content.replace(from, to);
    }
  }

  // Add imports if needed
  if (addImports.length > 0) {
    const existingCoreMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]@\/lib\/api\/core['"]/);
    const alreadyImported = existingCoreMatch
      ? new Set(existingCoreMatch[1].split(',').map(s => s.trim()).filter(Boolean))
      : new Set();

    const missing = addImports.filter(i => !alreadyImported.has(i));
    if (missing.length > 0) {
      if (existingCoreMatch) {
        const all = [...new Set([...alreadyImported, ...missing])].sort();
        content = content.replace(
          /import\s*\{[^}]+\}\s*from\s*['"]@\/lib\/api\/core['"]/,
          `import { ${all.join(', ')} } from '@/lib/api/core'`
        );
      } else {
        const importLines = [...content.matchAll(/^import\s+.+from\s+.+;?\s*$/mg)];
        if (importLines.length > 0) {
          const lastImport = importLines[importLines.length - 1];
          const idx = lastImport.index + lastImport[0].length;
          content = content.slice(0, idx) + `\nimport { ${[...missing].sort().join(', ')} } from '@/lib/api/core';` + content.slice(idx);
        }
      }
    }
  }

  if (content !== original) {
    writeFileSync(file, content);
    console.log(`  FIXED: ${file}`);
  } else {
    console.log(`  unchanged: ${file}`);
  }
}
