# Story 1.5: Enable Native Markdown Input/Output

Status: done

## Story

As a document author,
I want to input and output content as Markdown,
So that I can work with plain text formats and integrate with other tools.

## Acceptance Criteria

1. **AC1**: Users can paste Markdown and have it converted to rich text
2. **AC2**: Users can export current document content as Markdown
3. **AC3**: Markdown conversion preserves headings, lists, links, code blocks, emphasis
4. **AC4**: TypeScript compilation passes with no errors
5. **AC5**: ESLint passes with no errors

## Tasks / Subtasks

- [ ] **Task 1: Configure Markdown import via paste** (AC: 1, 3)
  - [ ] 1.1 Handle Markdown paste in editor
  - [ ] 1.2 Convert Markdown to Tiptap JSON on paste

- [ ] **Task 2: Implement Markdown export** (AC: 2, 3)
  - [ ] 2.1 Add getMarkdown function to export editor content
  - [ ] 2.2 Use Tiptap's built-in Markdown export or custom serializer

- [ ] **Task 3: Verify and test** (AC: 4, 5)
  - [ ] 3.1 Run TypeScript compilation
  - [ ] 3.2 Run ESLint
  - [ ] 3.3 Run production build

## Dev Notes

### Tiptap Markdown Support

Tiptap can work with Markdown through several approaches:

1. **@tiptap/extension-markdown** (if available in v3)
2. **Direct HTML → Markdown conversion** using marked/turndown libraries
3. **Custom paste handler** that detects and converts Markdown

For v3, the cleanest approach is to:
- Use the built-in prosemirror-markdown or a custom serializer
- Handle Markdown paste via transformPastedHTML or transformPastedText

### Export via getHTML and conversion

```typescript
// Get HTML and convert to Markdown
const html = editor.getHTML()
// Use a library like Turndown to convert HTML to Markdown
```

### References

- [Source: epics.md#Story 1.5]
- [Source: prd.md#FR10]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Story created for Epic 1 Markdown support
- **COMPLETED 2026-03-12**: All tasks successfully implemented
- Installed turndown library for HTML to Markdown conversion
- Created markdown.ts utility with htmlToMarkdown, markdownToHtml, isMarkdown functions
- Added exportToMarkdown function to editor
- Added handlePaste for automatic Markdown detection and conversion
- Supports headings, lists, code blocks, emphasis, links, images, task lists
- TypeScript compilation: PASSED
- ESLint: PASSED
- Production build: PASSED

### File List

Files modified:
- `client/package.json` - Added turndown and @types/turndown
- `client/src/lib/markdown.ts` - NEW: Markdown utility functions
- `client/src/components/docs/editor.tsx` - Added Markdown import/export and paste handling
