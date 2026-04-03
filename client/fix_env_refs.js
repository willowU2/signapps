#!/usr/bin/env node
// Script to replace process.env.NEXT_PUBLIC_* with core.ts constants
const fs = require("fs");

function fix(filepath, replacements) {
  let content = fs.readFileSync(filepath, "utf8");
  let changed = false;
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filepath, content);
    return true;
  }
  return false;
}

const results = [];

// 1. CalendarContactSuggestions.tsx (CALENDAR_URL already imported)
results.push([
  "CalendarContactSuggestions.tsx",
  fix("src/components/interop/CalendarContactSuggestions.tsx", [
    [
      'const API = process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1";\n        const start',
      "const start",
    ],
    ["`${API}/freebusy", "`${CALENDAR_URL}/freebusy"],
  ]),
]);

// 2. EmailThreadToProject.tsx (CALENDAR_URL already imported)
results.push([
  "EmailThreadToProject.tsx",
  fix("src/components/interop/EmailThreadToProject.tsx", [
    [
      'const API = process.env.NEXT_PUBLIC_TASK_API || process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1";',
      "const API = CALENDAR_URL;",
    ],
  ]),
]);

// 3. EventFollowUpSuggestion.tsx (CALENDAR_URL already imported)
results.push([
  "EventFollowUpSuggestion.tsx",
  fix("src/components/interop/EventFollowUpSuggestion.tsx", [
    [
      '`${process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1"}/calendars/${calendars[0].id}/tasks`',
      "`${CALENDAR_URL}/calendars/${calendars[0].id}/tasks`",
    ],
  ]),
]);

// 4. EventNotesDoc.tsx (DOCS_URL already imported)
results.push([
  "EventNotesDoc.tsx",
  fix("src/components/interop/EventNotesDoc.tsx", [
    [
      'const API = process.env.NEXT_PUBLIC_DOCS_API || "http://localhost:3012/api/v1";\n        const res = await fetch(`${API}/documents`',
      "const res = await fetch(`${DOCS_URL}/documents`",
    ],
  ]),
]);

// 5. QuickComposeFromTask.tsx (MAIL_URL already imported)
results.push([
  "QuickComposeFromTask.tsx",
  fix("src/components/interop/QuickComposeFromTask.tsx", [
    [
      'const MAIL_API = process.env.NEXT_PUBLIC_MAIL_API || "http://localhost:3010/api/v1";\n      let mailId',
      "let mailId",
    ],
    ["`${MAIL_API}/messages/send`", "`${MAIL_URL}/messages/send`"],
  ]),
]);

// 6. RecurringEventToTask.tsx (CALENDAR_URL already imported)
results.push([
  "RecurringEventToTask.tsx",
  fix("src/components/interop/RecurringEventToTask.tsx", [
    [
      'const API = process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1";\n      const calsRes = await fetch(`${API}/calendars`',
      "const calsRes = await fetch(`${CALENDAR_URL}/calendars`",
    ],
    [
      "`${API}/calendars/${calId}/tasks`",
      "`${CALENDAR_URL}/calendars/${calId}/tasks`",
    ],
  ]),
]);

// 7. TaskNotificationHooks.tsx (CALENDAR_URL, MAIL_URL already imported)
results.push([
  "TaskNotificationHooks.tsx",
  fix("src/components/interop/TaskNotificationHooks.tsx", [
    [
      'const API = process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1";\n      const calsRes = await fetch(`${API}/calendars`',
      "const calsRes = await fetch(`${CALENDAR_URL}/calendars`",
    ],
    [
      "`${API}/calendars/${calId}/tasks?status=open,in_progress&due_before=${today}`",
      "`${CALENDAR_URL}/calendars/${calId}/tasks?status=open,in_progress&due_before=${today}`",
    ],
    [
      'const MAIL_API = process.env.NEXT_PUBLIC_MAIL_API || "http://localhost:3010/api/v1";\n    await fetch(`${MAIL_API}/messages/send`',
      "await fetch(`${MAIL_URL}/messages/send`",
    ],
  ]),
]);

// 8. TodayView.tsx (CALENDAR_URL already imported)
results.push([
  "TodayView.tsx",
  fix("src/components/interop/TodayView.tsx", [
    [
      'const API =\n        process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1";\n      const calsRes = await fetch(`${API}/calendars`',
      "const calsRes = await fetch(`${CALENDAR_URL}/calendars`",
    ],
    [
      "`${API}/calendars/${calId}/tasks?due_date=${today}&status=open,in_progress&limit=10`",
      "`${CALENDAR_URL}/calendars/${calId}/tasks?due_date=${today}&status=open,in_progress&limit=10`",
    ],
  ]),
]);

// 9. UnifiedSearch.tsx (CALENDAR_URL already imported) - 3 occurrences
const unifiedContent = fs.readFileSync(
  "src/components/interop/UnifiedSearch.tsx",
  "utf8",
);
const taskBlock =
  'const API =\n        process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1";\n      const calsRes = await fetch(`${API}/calendars`, {\n        credentials: "include",\n      });\n      if (!calsRes.ok) return;\n      const cals = await calsRes.json();\n      const calId = (cals.data ?? cals)?.[0]?.id;\n      if (!calId) return;\n      const res = await fetch(\n        `${API}/calendars/${calId}/tasks?q=';
const taskBlockReplacement =
  'const calsRes = await fetch(`${CALENDAR_URL}/calendars`, {\n        credentials: "include",\n      });\n      if (!calsRes.ok) return;\n      const cals = await calsRes.json();\n      const calId = (cals.data ?? cals)?.[0]?.id;\n      if (!calId) return;\n      const res = await fetch(\n        `${CALENDAR_URL}/calendars/${calId}/tasks?q=';
const eventsBlock =
  'const API =\n        process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1";\n      const calsRes = await fetch(`${API}/calendars`, {\n        credentials: "include",\n      });\n      if (!calsRes.ok) return;\n      const cals = await calsRes.json();\n      const calId = (cals.data ?? cals)?.[0]?.id;\n      if (!calId) return;\n      const res = await fetch(\n        `${API}/calendars/${calId}/events?q=';
const eventsBlockReplacement =
  'const calsRes = await fetch(`${CALENDAR_URL}/calendars`, {\n        credentials: "include",\n      });\n      if (!calsRes.ok) return;\n      const cals = await calsRes.json();\n      const calId = (cals.data ?? cals)?.[0]?.id;\n      if (!calId) return;\n      const res = await fetch(\n        `${CALENDAR_URL}/calendars/${calId}/events?q=';
const extractBlock =
  '`${process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1"}/calendars/${calendarId}/tasks`';
const extractReplacement = "`${CALENDAR_URL}/calendars/${calendarId}/tasks`";

results.push([
  "UnifiedSearch.tsx",
  fix("src/components/interop/UnifiedSearch.tsx", [
    [taskBlock, taskBlockReplacement],
    [eventsBlock, eventsBlockReplacement],
    [extractBlock, extractReplacement],
  ]),
]);

// 10. compose-rich-dialog.tsx (CALENDAR_URL already imported)
results.push([
  "compose-rich-dialog.tsx",
  fix("src/components/mail/compose-rich-dialog.tsx", [
    [
      "const API = process.env.NEXT_PUBLIC_CALENDAR_API || 'http://localhost:3011/api/v1'\n            const calsRes = await fetch(`${API}/calendars`",
      "const calsRes = await fetch(`${CALENDAR_URL}/calendars`",
    ],
  ]),
]);

// 11. mail-display.tsx (CALENDAR_URL already imported)
results.push([
  "mail-display.tsx",
  fix("src/components/mail/mail-display.tsx", [
    [
      "const API = process.env.NEXT_PUBLIC_CALENDAR_API || 'http://localhost:3011/api/v1'\n            const calsRes = await fetch(`${API}/calendars`",
      "const calsRes = await fetch(`${CALENDAR_URL}/calendars`",
    ],
  ]),
]);

// 12. backup/page.tsx (IDENTITY_URL already imported)
results.push([
  "backup/page.tsx",
  fix("src/app/admin/backup/page.tsx", [
    [
      "const apiBase = process.env.NEXT_PUBLIC_IDENTITY_URL || 'http://localhost:3001/api/v1';",
      "const apiBase = IDENTITY_URL;",
    ],
  ]),
]);

// 13. ai/page.tsx - add import if needed, remove local const
let f13 = fs.readFileSync("src/app/ai/page.tsx", "utf8");
let changed13 = false;
if (f13.includes("process.env.NEXT_PUBLIC_AI_URL")) {
  if (
    !f13.includes("from '@/lib/api/core'") &&
    !f13.includes('from "@/lib/api/core"')
  ) {
    f13 = f13.replace(
      "import { AiGenerateDoc } from '@/components/interop/AiGenerateDoc';",
      "import { AiGenerateDoc } from '@/components/interop/AiGenerateDoc';\nimport { AI_URL } from '@/lib/api/core';",
    );
  }
  f13 = f13
    .split(
      "const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:3005/api/v1';\n",
    )
    .join("");
  f13 = f13
    .split(
      "const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:3005/api/v1';",
    )
    .join("");
  fs.writeFileSync("src/app/ai/page.tsx", f13);
  changed13 = true;
}
results.push(["ai/page.tsx", changed13]);

// 14. pxe/wizard/page.tsx (PXE_URL already imported)
results.push([
  "pxe/wizard/page.tsx",
  fix("src/app/pxe/wizard/page.tsx", [
    [
      '`${process.env.NEXT_PUBLIC_PXE_URL ?? "http://localhost:3016"}/api/v1/pxe/images`',
      "`${PXE_URL}/pxe/images`",
    ],
  ]),
]);

// 15. use-ai-stream.ts - add import, remove local const
let f15 = fs.readFileSync("src/hooks/use-ai-stream.ts", "utf8");
let changed15 = false;
if (f15.includes("process.env.NEXT_PUBLIC_AI_URL")) {
  if (!f15.includes("from '@/lib/api/core'")) {
    f15 = f15.replace(
      "import { useState, useCallback, useRef } from 'react';",
      "import { useState, useCallback, useRef } from 'react';\nimport { AI_URL } from '@/lib/api/core';",
    );
  }
  f15 = f15
    .split(
      "const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:3005/api/v1';\n",
    )
    .join("");
  f15 = f15
    .split(
      "const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:3005/api/v1';",
    )
    .join("");
  fs.writeFileSync("src/hooks/use-ai-stream.ts", f15);
  changed15 = true;
}
results.push(["use-ai-stream.ts", changed15]);

// 16. use-monitoring.ts (METRICS_URL already imported)
results.push([
  "use-monitoring.ts",
  fix("src/hooks/use-monitoring.ts", [
    [
      "const METRICS_URL = process.env.NEXT_PUBLIC_METRICS_URL || 'http://localhost:3008/api/v1';\n    const eventSource",
      "const eventSource",
    ],
  ]),
]);

// 17. use-tasks.ts (CALENDAR_URL already imported)
results.push([
  "use-tasks.ts",
  fix("src/hooks/use-tasks.ts", [
    [
      'const API_BASE = process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1";',
      "const API_BASE = CALENDAR_URL;",
    ],
  ]),
]);

// 18. use-yjs-document.ts (COLLAB_URL already imported)
results.push([
  "use-yjs-document.ts",
  fix("src/hooks/use-yjs-document.ts", [
    [
      'wsUrl = process.env.NEXT_PUBLIC_COLLAB_URL || "ws://localhost:3010"',
      "wsUrl = COLLAB_URL",
    ],
  ]),
]);

// 19. chat.ts (CHAT_URL already imported)
results.push([
  "chat.ts",
  fix("src/lib/api/chat.ts", [
    [
      "const base = process.env.NEXT_PUBLIC_CHAT_URL || 'http://localhost:3020/api/v1';",
      "const base = CHAT_URL;",
    ],
    [
      "const baseUrl = process.env.NEXT_PUBLIC_CHAT_URL || 'http://localhost:3020/api/v1';",
      "const baseUrl = CHAT_URL;",
    ],
  ]),
]);

// 20. migration-wizard.tsx (IDENTITY_URL already imported)
results.push([
  "migration-wizard.tsx",
  fix("src/components/admin/migration-wizard.tsx", [
    [
      'const IDENTITY_API = process.env.NEXT_PUBLIC_IDENTITY_URL ?? "http://localhost:3001";',
      "const IDENTITY_API = IDENTITY_URL;",
    ],
  ]),
]);

// 21. file-upload-progress-bar.tsx (STORAGE_URL already imported)
results.push([
  "file-upload-progress-bar.tsx",
  fix("src/components/application/file-upload/file-upload-progress-bar.tsx", [
    [
      "`${process.env.NEXT_PUBLIC_STORAGE_URL || 'http://localhost:3004/api/v1'}/files/${bucket}`",
      "`${STORAGE_URL}/files/${bucket}`",
    ],
  ]),
]);

// 22. container-terminal.tsx (CONTAINERS_URL already imported)
results.push([
  "container-terminal.tsx",
  fix("src/components/containers/container-terminal.tsx", [
    [
      "const containersUrl = process.env.NEXT_PUBLIC_CONTAINERS_URL || 'http://localhost:3002/api/v1';",
      "const containersUrl = CONTAINERS_URL;",
    ],
  ]),
]);

// 23. ai-chat-bar.tsx - add import, remove local const
let f24 = fs.readFileSync("src/components/layout/ai-chat-bar.tsx", "utf8");
let changed24 = false;
if (f24.includes("process.env.NEXT_PUBLIC_AI_URL")) {
  if (
    !f24.includes("from '@/lib/api/core'") &&
    !f24.includes('from "@/lib/api/core"')
  ) {
    f24 = f24.replace(
      "from 'sonner';",
      "from 'sonner';\nimport { AI_URL } from '@/lib/api/core';",
    );
  }
  f24 = f24
    .split(
      "const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:3005/api/v1';\n",
    )
    .join("");
  f24 = f24
    .split(
      "const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:3005/api/v1';",
    )
    .join("");
  fs.writeFileSync("src/components/layout/ai-chat-bar.tsx", f24);
  changed24 = true;
}
results.push(["ai-chat-bar.tsx", changed24]);

// 24. drop-zone.tsx (STORAGE_URL already imported)
results.push([
  "drop-zone.tsx",
  fix("src/components/storage/drop-zone.tsx", [
    [
      "`${process.env.NEXT_PUBLIC_STORAGE_URL || 'http://localhost:3004/api/v1'}/files/${bucket}`",
      "`${STORAGE_URL}/files/${bucket}`",
    ],
  ]),
]);

console.log("Results:");
for (const [name, changed] of results) {
  console.log(`  ${changed ? "FIXED" : "unchanged"}: ${name}`);
}
