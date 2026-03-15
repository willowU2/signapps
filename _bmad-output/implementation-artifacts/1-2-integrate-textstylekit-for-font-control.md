# Story 1.2: Integrate TextStyleKit for Font Control

Status: done

## Story

As a document author,
I want to select font families and sizes for my text,
So that I can create professionally styled documents.

## Acceptance Criteria

1. **AC1**: Users can select font family from a predefined list (Arial, Times New Roman, Georgia, Verdana, Courier New)
2. **AC2**: Users can set font size from 8pt to 72pt (presets and custom input)
3. **AC3**: Font settings apply to selected text immediately
4. **AC4**: Font settings persist when saving and reopening documents
5. **AC5**: Toolbar displays current font family and size for selection
6. **AC6**: TypeScript compilation passes with no errors
7. **AC7**: ESLint passes with no errors

## Tasks / Subtasks

- [ ] **Task 1: Install and configure Tiptap extensions** (AC: 1, 2)
  - [ ] 1.1 Add @tiptap/extension-font-family to package.json
  - [ ] 1.2 Add @tiptap/extension-font-size to package.json (if available) or use TextStyle marks
  - [ ] 1.3 Run npm install

- [ ] **Task 2: Configure extensions in editor.tsx** (AC: 1, 2)
  - [ ] 2.1 Import FontFamily extension
  - [ ] 2.2 Add FontFamily to extensions array with font list
  - [ ] 2.3 Add FontSize or configure TextStyle for size control

- [ ] **Task 3: Add font controls to toolbar** (AC: 3, 5)
  - [ ] 3.1 Add font family dropdown to editor-toolbar.tsx
  - [ ] 3.2 Add font size selector with presets (8, 10, 11, 12, 14, 18, 24, 36, 48, 72)
  - [ ] 3.3 Show current font in dropdown when text selected

- [ ] **Task 4: Test persistence** (AC: 4)
  - [ ] 4.1 Verify font settings save to Yjs document
  - [ ] 4.2 Verify font settings load correctly on document open

- [ ] **Task 5: Verify and test** (AC: 6, 7)
  - [ ] 5.1 Run TypeScript compilation
  - [ ] 5.2 Run ESLint
  - [ ] 5.3 Run production build

## Dev Notes

### Tiptap v3 Font Extensions

FontFamily extension in v3:
```typescript
import { FontFamily } from '@tiptap/extension-font-family'

FontFamily.configure({
  types: ['textStyle'],
})
```

For font size, Tiptap v3 doesn't have a dedicated extension. Use CSS with TextStyle:
```typescript
import { TextStyle } from '@tiptap/extension-text-style'

// Set font size using CSS
editor.chain().focus().setMark('textStyle', { fontSize: '14pt' }).run()
```

Or create a custom extension based on TextStyle.

### Web-Safe Fonts List

- Arial (sans-serif)
- Times New Roman (serif)
- Georgia (serif)
- Verdana (sans-serif)
- Courier New (monospace)
- Trebuchet MS (sans-serif)
- Palatino Linotype (serif)

### References

- [Source: epics.md#Story 1.2]
- [Source: prd.md#FR2-FR3]
- [Tiptap FontFamily Extension](https://tiptap.dev/api/extensions/font-family)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Story created for Epic 1 font control implementation
- Depends on Story 1.1 (Tiptap v3 migration) - COMPLETED
- **COMPLETED 2026-03-12**: All tasks successfully implemented
- Installed @tiptap/extension-font-family v3.20.1
- Created custom FontSize extension (Tiptap v3 has no native fontSize extension)
- Configured FontFamily and FontSize extensions in editor.tsx and collaborative-editor.tsx
- Updated editor-toolbar.tsx with functional font family dropdown (7 fonts)
- Updated editor-toolbar.tsx with functional font size selector (presets: 8-72pt)
- Added +/- buttons to adjust font size incrementally
- TypeScript compilation: PASSED
- ESLint: PASSED
- Production build: PASSED

### File List

Files modified:
- `client/package.json` - Added @tiptap/extension-font-family v3.20.1
- `client/src/components/docs/extensions/font-size.ts` - NEW: Custom FontSize extension
- `client/src/components/docs/editor.tsx` - Added FontFamily and FontSize extensions
- `client/src/components/ai/collaborative-editor.tsx` - Added FontFamily and FontSize extensions
- `client/src/components/docs/editor/editor-toolbar.tsx` - Functional font controls with current selection display
