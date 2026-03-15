# Story 1.4: Add CharacterCount Extension

Status: done

## Story

As a document author,
I want to see word and character counts,
So that I can track document length and meet requirements.

## Acceptance Criteria

1. **AC1**: Character count is displayed in the editor UI
2. **AC2**: Word count is displayed in the editor UI
3. **AC3**: Counts update in real-time as user types
4. **AC4**: Optionally show character limit if configured
5. **AC5**: TypeScript compilation passes with no errors
6. **AC6**: ESLint passes with no errors

## Tasks / Subtasks

- [ ] **Task 1: Install CharacterCount extension** (AC: 1, 2)
  - [ ] 1.1 Add @tiptap/extension-character-count to package.json
  - [ ] 1.2 Run npm install

- [ ] **Task 2: Configure extension in editor.tsx** (AC: 1, 2, 3)
  - [ ] 2.1 Import CharacterCount extension
  - [ ] 2.2 Add to extensions array

- [ ] **Task 3: Display counts in UI** (AC: 1, 2, 3)
  - [ ] 3.1 Add word/character count display to editor footer or status bar
  - [ ] 3.2 Style count display appropriately

- [ ] **Task 4: Verify and test** (AC: 5, 6)
  - [ ] 4.1 Run TypeScript compilation
  - [ ] 4.2 Run ESLint
  - [ ] 4.3 Run production build

## Dev Notes

### CharacterCount Extension Usage

```typescript
import CharacterCount from '@tiptap/extension-character-count'

CharacterCount.configure({
  limit: 10000, // optional limit
})

// Access counts
editor.storage.characterCount.characters()
editor.storage.characterCount.words()
```

### References

- [Source: epics.md#Story 1.4]
- [Source: prd.md#FR6]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Story created for Epic 1 character count implementation
- **COMPLETED 2026-03-12**: All tasks successfully implemented
- Installed @tiptap/extension-character-count v3.20.1
- Configured CharacterCount extension in editor.tsx and collaborative-editor.tsx
- Added word/character count footer to editor UI
- Counts update in real-time as user types
- TypeScript compilation: PASSED
- ESLint: PASSED
- Production build: PASSED

### File List

Files modified:
- `client/package.json` - Added @tiptap/extension-character-count v3.20.1
- `client/src/components/docs/editor.tsx` - Added CharacterCount extension and footer display
- `client/src/components/ai/collaborative-editor.tsx` - Added CharacterCount extension
