# Story 1.10: Undo/Redo with Keyboard Shortcuts

Status: done

## Story

As a document author,
I want to undo and redo editing actions with keyboard shortcuts,
So that I can easily correct mistakes and restore changes.

## Acceptance Criteria

1. **AC1**: Users can undo actions via Ctrl+Z
2. **AC2**: Users can redo actions via Ctrl+Y
3. **AC3**: Undo/redo buttons available in toolbar
4. **AC4**: Undo/redo works correctly with Yjs collaboration
5. **AC5**: TypeScript compilation passes with no errors
6. **AC6**: ESLint passes with no errors

## Tasks / Subtasks

- [x] **Task 1: Configure Undo/Redo** (AC: 1, 2, 3, 4)
  - [x] 1.1 StarterKit provides default undo/redo (disabled when using Yjs)
  - [x] 1.2 Yjs handles undo/redo for collaborative editing
  - [x] 1.3 Toolbar buttons call undo()/redo() commands

## Dev Notes

### Undo/Redo Configuration

In editor.tsx:
```typescript
StarterKit.configure({
    undoRedo: false, // Yjs handles undo/redo
}),
```

Yjs provides its own undo manager that properly handles collaborative edits.

### Toolbar Implementation

In editor-toolbar.tsx:
```typescript
onClick={() => editor.chain().focus().undo().run()}
disabled={!editor.can().undo()}
title="Annuler (Ctrl+Z)"
```

### References

- [Source: epics.md#Story 1.10]
- [Source: prd.md#FR11]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Story created for Epic 1 undo/redo support
- **COMPLETED 2026-03-12**: Already implemented as part of Tiptap v3 migration
- StarterKit undoRedo disabled, Yjs handles it for collaboration
- Toolbar buttons for undo/redo with keyboard shortcut hints
- Standard keyboard shortcuts work out of the box
- TypeScript compilation: PASSED
- ESLint: PASSED
- Production build: PASSED

### File List

Files already contain undo/redo support:
- `client/src/components/docs/editor.tsx` - StarterKit with undoRedo: false
- `client/src/components/docs/editor/editor-toolbar.tsx` - Undo/Redo buttons
