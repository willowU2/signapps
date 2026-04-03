#!/usr/bin/env node
// Fix missing imports from @/lib/api/core
import { readFileSync, writeFileSync } from 'fs';

// Map: constant → needs to be imported from core.ts
const ALL_CONSTANTS = [
  'IDENTITY_URL', 'CONTAINERS_URL', 'PROXY_URL', 'STORAGE_URL', 'AI_URL',
  'SECURELINK_URL', 'SCHEDULER_URL', 'METRICS_URL', 'MEDIA_URL', 'DOCS_URL',
  'CALENDAR_URL', 'MAIL_URL', 'MEET_URL', 'IT_ASSETS_URL', 'PXE_URL',
  'REMOTE_URL', 'CHAT_URL', 'OFFICE_URL', 'SOCIAL_URL', 'CONTACTS_URL',
  'FORMS_URL', 'NOTIFICATIONS_URL', 'BILLING_URL', 'API_URL', 'GATEWAY_URL',
  'COLLAB_WS_URL', 'COLLAB_URL', 'LIVEKIT_URL',
];

const files = [
  'src/app/admin/backup/page.tsx',
  'src/app/pxe/wizard/page.tsx',
  'src/components/admin/migration-wizard.tsx',
  'src/components/application/file-upload/file-upload-progress-bar.tsx',
  'src/components/containers/container-terminal.tsx',
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
  'src/components/storage/drop-zone.tsx',
  'src/hooks/use-ai-stream.ts',
  'src/hooks/use-monitoring.ts',
  'src/hooks/use-tasks.ts',
  'src/hooks/use-yjs-document.ts',
  'src/lib/api/chat.ts',
  'src/lib/api/metrics.ts',
  'src/lib/scheduling/api/scheduling-api.ts',
  'src/app/ai/page.tsx',
  'src/components/external/public-contact-form.tsx',
];

for (const filepath of files) {
  let content;
  try {
    content = readFileSync(filepath, 'utf8');
  } catch {
    console.log(`  SKIP (not found): ${filepath}`);
    continue;
  }

  const original = content;

  // Find which constants are used but NOT yet imported
  const existingCoreImportMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]@\/lib\/api\/core['"]/);
  const alreadyImported = new Set(
    existingCoreImportMatch
      ? existingCoreImportMatch[1].split(',').map(s => s.trim()).filter(Boolean)
      : []
  );

  // Find all constants used in the file (as identifiers, not in import/type context)
  const needed = new Set();
  for (const c of ALL_CONSTANTS) {
    // Match usage: the constant name as a standalone identifier (not part of a larger word)
    const usageRegex = new RegExp(`(?<![\\w.])${c}(?![\\w])`, 'g');
    if (usageRegex.test(content) && !alreadyImported.has(c)) {
      needed.add(c);
    }
  }

  if (needed.size === 0) {
    // console.log(`  unchanged: ${filepath}`);
    continue;
  }

  const sortedNeeded = [...needed].sort();

  if (existingCoreImportMatch) {
    // Merge with existing import
    const existingImports = existingCoreImportMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    const allImports = [...new Set([...existingImports, ...sortedNeeded])].sort();
    const newImportStr = `import { ${allImports.join(', ')} } from '@/lib/api/core'`;
    content = content.replace(/import\s*\{[^}]+\}\s*from\s*['"]@\/lib\/api\/core['"]/, newImportStr);
  } else {
    // Add new import after the last existing import line
    const importLines = [...content.matchAll(/^import\s+.+from\s+.+;?\s*$/mg)];
    if (importLines.length > 0) {
      const lastImport = importLines[importLines.length - 1];
      const idx = lastImport.index + lastImport[0].length;
      const importLine = `\nimport { ${sortedNeeded.join(', ')} } from '@/lib/api/core';`;
      content = content.slice(0, idx) + importLine + content.slice(idx);
    } else {
      // No existing imports, add at top (after "use client" if present)
      const useClientMatch = content.match(/^["']use client["'];?\s*\n/);
      if (useClientMatch) {
        const idx = useClientMatch.index + useClientMatch[0].length;
        const importLine = `import { ${sortedNeeded.join(', ')} } from '@/lib/api/core';\n`;
        content = content.slice(0, idx) + importLine + content.slice(idx);
      } else {
        content = `import { ${sortedNeeded.join(', ')} } from '@/lib/api/core';\n` + content;
      }
    }
  }

  if (content !== original) {
    writeFileSync(filepath, content);
    console.log(`  FIXED: ${filepath} (added: ${sortedNeeded.join(', ')})`);
  }
}

console.log('Done.');
