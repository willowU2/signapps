# Story 2.3: DOCX Export from Tiptap JSON

Status: done

## Story

As a document author,
I want to export my documents to DOCX format,
So that I can share them with Microsoft Word users.

## Acceptance Criteria

1. **AC1**: Tiptap JSON converts to DOCX
2. **AC2**: Headings preserve hierarchy (h1-h6)
3. **AC3**: Text formatting preserved (bold, italic, underline, strike)
4. **AC4**: Lists render correctly (bullet, numbered)
5. **AC5**: Tables convert to Word tables
6. **AC6**: Code blocks use monospace font

## Tasks / Subtasks

- [x] **Task 1: Implement Tiptap to HTML** (AC: 1)
  - [x] 1.1 Parse Tiptap JSON structure
  - [x] 1.2 Convert nodes to HTML elements
  - [x] 1.3 Apply marks (formatting)

- [x] **Task 2: Implement HTML to DOCX** (AC: 2, 3, 4, 5, 6)
  - [x] 2.1 Use docx-rs library
  - [x] 2.2 Process headings with sizing
  - [x] 2.3 Process inline formatting
  - [x] 2.4 Process lists with indentation
  - [x] 2.5 Process tables with TableRow/TableCell

## Dev Notes

### Tiptap Node Types Supported

- doc, paragraph, heading (1-6)
- bulletList, orderedList, listItem
- taskList, taskItem
- blockquote, codeBlock
- table, tableRow, tableHeader, tableCell
- image, horizontalRule, hardBreak
- text with marks

### Marks Supported

- bold, italic, underline, strike
- code, link, textStyle (color, fontFamily, fontSize)
- highlight, subscript, superscript

### References

- [Source: epics.md#Story 2.3]
- [Source: prd.md#FR25]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Story implemented with docx-rs library
- **COMPLETED 2026-03-12**: DOCX export working
- Full Tiptap JSON parsing
- All node types converted
- Formatting preserved
- Tables with headers/cells

### File List

- `services/signapps-office/src/converter/tiptap.rs`
- `services/signapps-office/src/converter/docx.rs`
