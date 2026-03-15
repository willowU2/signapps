# Story 1.3: Implement Text Color and Highlight Controls

Status: done

## Story

As a document author,
I want to change text colors and apply highlights,
So that I can emphasize important content visually.

## Acceptance Criteria

1. **AC1**: Users can select text color from a color palette
2. **AC2**: Users can apply background highlight color to text
3. **AC3**: Color changes apply to selected text immediately
4. **AC4**: Color settings persist when saving and reopening documents
5. **AC5**: Toolbar displays color picker buttons with current color indicator
6. **AC6**: TypeScript compilation passes with no errors
7. **AC7**: ESLint passes with no errors

## Tasks / Subtasks

- [ ] **Task 1: Configure Color and Highlight extensions** (AC: 1, 2)
  - [ ] 1.1 Verify @tiptap/extension-color is installed
  - [ ] 1.2 Verify @tiptap/extension-highlight is installed
  - [ ] 1.3 Confirm extensions are configured in editor.tsx

- [ ] **Task 2: Add color picker UI to toolbar** (AC: 3, 5)
  - [ ] 2.1 Create text color picker component with palette
  - [ ] 2.2 Create highlight color picker component with palette
  - [ ] 2.3 Display current color indicator on buttons

- [ ] **Task 3: Verify and test** (AC: 6, 7)
  - [ ] 3.1 Run TypeScript compilation
  - [ ] 3.2 Run ESLint
  - [ ] 3.3 Run production build

## Dev Notes

### Color Extension Usage

```typescript
// Set text color
editor.chain().focus().setColor('#FF0000').run()

// Unset text color
editor.chain().focus().unsetColor().run()

// Set highlight
editor.chain().focus().toggleHighlight({ color: '#FFFF00' }).run()
```

### Recommended Color Palette

Text colors:
- Black (#000000)
- Dark Gray (#444444)
- Red (#EA4335)
- Orange (#FF9900)
- Yellow (#FBBC04)
- Green (#34A853)
- Blue (#4285F4)
- Purple (#9334E6)

Highlight colors:
- Yellow (#FFFF00)
- Green (#00FF00)
- Cyan (#00FFFF)
- Pink (#FF00FF)
- Orange (#FFA500)

### References

- [Source: epics.md#Story 1.3]
- [Source: prd.md#FR4-FR5]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Story created for Epic 1 text color implementation
- Extensions already installed from Tiptap migration
- **COMPLETED 2026-03-12**: All tasks successfully implemented
- Added TEXT_COLORS constant with 8 colors (noir, gris, rouge, orange, jaune, vert, bleu, violet)
- Added HIGHLIGHT_COLORS constant with 6 colors (jaune, vert, cyan, rose, orange, lavande)
- Created text color popover with color palette grid
- Created highlight color popover with palette and remove option
- Current color indicators displayed on buttons
- TypeScript compilation: PASSED
- ESLint: PASSED
- Production build: PASSED

### File List

Files modified:
- `client/src/components/docs/editor/editor-toolbar.tsx` - Added color picker popovers with palettes
