#!/usr/bin/env node
// Consolidation NEXT_PUBLIC → core.ts (version 2)
// Gère les imports manquants + remplacements robustes
import { readFileSync, writeFileSync } from 'fs';

// Mapping: env var → {constant, import}
const ENV_MAP = {
  'NEXT_PUBLIC_CALENDAR_API': 'CALENDAR_URL',
  'NEXT_PUBLIC_CALENDAR_URL': 'CALENDAR_URL',
  'NEXT_PUBLIC_TASK_API': 'CALENDAR_URL',
  'NEXT_PUBLIC_MAIL_API': 'MAIL_URL',
  'NEXT_PUBLIC_MAIL_URL': 'MAIL_URL',
  'NEXT_PUBLIC_DOCS_API': 'DOCS_URL',
  'NEXT_PUBLIC_DOCS_URL': 'DOCS_URL',
  'NEXT_PUBLIC_AI_URL': 'AI_URL',
  'NEXT_PUBLIC_STORAGE_URL': 'STORAGE_URL',
  'NEXT_PUBLIC_IDENTITY_URL': 'IDENTITY_URL',
  'NEXT_PUBLIC_CONTAINERS_URL': 'CONTAINERS_URL',
  'NEXT_PUBLIC_METRICS_URL': 'METRICS_URL',
  'NEXT_PUBLIC_SCHEDULER_URL': 'SCHEDULER_URL',
  'NEXT_PUBLIC_PXE_URL': 'PXE_URL',
  'NEXT_PUBLIC_CHAT_URL': 'CHAT_URL',
  'NEXT_PUBLIC_COLLAB_URL': 'COLLAB_URL',
  'NEXT_PUBLIC_COLLAB_WS_URL': 'COLLAB_WS_URL',
  'NEXT_PUBLIC_LIVEKIT_URL': 'LIVEKIT_URL',
  'NEXT_PUBLIC_API_URL': 'API_URL',
};

const files = [
  'src/components/interop/CalendarContactSuggestions.tsx',
  'src/components/interop/EmailThreadToProject.tsx',
  'src/components/interop/EventFollowUpSuggestion.tsx',
  'src/components/interop/EventNotesDoc.tsx',
  'src/components/interop/QuickComposeFromTask.tsx',
  'src/components/interop/RecurringEventToTask.tsx',
  'src/components/interop/TaskNotificationHooks.tsx',
  'src/components/interop/TodayView.tsx',
  'src/components/interop/UnifiedSearch.tsx',
  'src/components/mail/compose-rich-dialog.tsx',
  'src/components/mail/mail-display.tsx',
  'src/app/admin/backup/page.tsx',
  'src/app/ai/page.tsx',
  'src/app/pxe/wizard/page.tsx',
  'src/hooks/use-ai-stream.ts',
  'src/hooks/use-monitoring.ts',
  'src/hooks/use-tasks.ts',
  'src/hooks/use-yjs-document.ts',
  'src/lib/api/chat.ts',
  'src/components/admin/migration-wizard.tsx',
  'src/components/application/file-upload/file-upload-progress-bar.tsx',
  'src/components/containers/container-terminal.tsx',
  'src/components/storage/drop-zone.tsx',
  'src/lib/api/metrics.ts',
  'src/lib/scheduling/api/scheduling-api.ts',
  'src/components/external/public-contact-form.tsx',
];

for (const filepath of files) {
  let content;
  try {
    content = readFileSync(filepath, 'utf8');
  } catch (e) {
    console.log(`  SKIP (not found): ${filepath}`);
    continue;
  }

  const original = content;

  // 1. Collect which constants are needed
  const needed = new Set();
  for (const [envVar, constant] of Object.entries(ENV_MAP)) {
    if (content.includes(envVar)) {
      needed.add(constant);
    }
  }

  if (needed.size === 0) {
    // console.log(`  unchanged: ${filepath}`);
    continue;
  }

  // 2. Add missing imports
  // Find existing core import or add new one
  const existingCoreImport = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]@\/lib\/api\/core['"]/);
  if (existingCoreImport) {
    // Merge with existing import
    const existingImports = existingCoreImport[1].split(',').map(s => s.trim()).filter(Boolean);
    const allImports = [...new Set([...existingImports, ...needed])].sort();
    const newImportStr = `import { ${allImports.join(', ')} } from '@/lib/api/core'`;
    content = content.replace(/import\s*\{[^}]+\}\s*from\s*['"]@\/lib\/api\/core['"]/, newImportStr);
  } else {
    // Add new import after the last existing import
    const lastImportMatch = [...content.matchAll(/^import\s+.+from\s+.+;?\s*$/mg)].pop();
    if (lastImportMatch) {
      const idx = lastImportMatch.index + lastImportMatch[0].length;
      const importLine = `\nimport { ${[...needed].sort().join(', ')} } from '@/lib/api/core';`;
      content = content.slice(0, idx) + importLine + content.slice(idx);
    }
  }

  // 3. Replace inline env var usages
  // Pattern: process.env.NEXT_PUBLIC_X || "fallback" or process.env.NEXT_PUBLIC_X ?? "fallback"
  for (const [envVar, constant] of Object.entries(ENV_MAP)) {
    if (!content.includes(envVar)) continue;

    // Replace full inline pattern: `${process.env.NEXT_PUBLIC_X || "fallback"}/path`
    content = content.replace(
      new RegExp(`\\$\\{process\\.env\\.${envVar}\\s*(?:\\|\\||\\?\\?)\\s*['"][^'"]*['"]\\}`, 'g'),
      `\${${constant}}`
    );

    // Replace bare: process.env.NEXT_PUBLIC_X || "fallback"
    content = content.replace(
      new RegExp(`process\\.env\\.${envVar}\\s*(?:\\|\\||\\?\\?)\\s*['"][^'"]*['"]`, 'g'),
      constant
    );

    // Replace bare without fallback: process.env.NEXT_PUBLIC_X
    content = content.replace(
      new RegExp(`process\\.env\\.${envVar}(?!\\s*(?:\\|\\||\\?\\?))`, 'g'),
      constant
    );
  }

  // 4. Remove now-redundant local const declarations like:
  //    const API = CALENDAR_URL;
  //    const AI_URL = CALENDAR_URL; (when same name)
  //    const MAIL_API = MAIL_URL;
  //    const API_BASE = CALENDAR_URL;
  //    etc. - only when the var is only used as the URL itself
  // (Leave these for now — they are safe, just verbose)

  if (content !== original) {
    writeFileSync(filepath, content);
    console.log(`  FIXED: ${filepath}`);
  } else {
    console.log(`  unchanged: ${filepath}`);
  }
}
