# Story 2.5: Markdown and HTML Export

Status: done

## Story

As a document author,
I want to export my documents to Markdown and HTML,
So that I can use them in web contexts or documentation systems.

## Acceptance Criteria

1. **AC1**: Tiptap JSON exports to Markdown
2. **AC2**: Tiptap JSON exports to HTML
3. **AC3**: Markdown uses GFM (GitHub Flavored Markdown)
4. **AC4**: HTML is well-formed
5. **AC5**: Plain text export strips all formatting

## Tasks / Subtasks

- [x] **Task 1: Implement HTML output** (AC: 2, 4)
  - [x] 1.1 Tiptap JSON → HTML conversion
  - [x] 1.2 DOCTYPE and meta charset

- [x] **Task 2: Implement Markdown output** (AC: 1, 3)
  - [x] 2.1 HTML → Markdown conversion
  - [x] 2.2 GFM tables support
  - [x] 2.3 Task lists support

- [x] **Task 3: Implement plain text** (AC: 5)
  - [x] 3.1 Strip all HTML tags
  - [x] 3.2 Preserve text content only

## Dev Notes

### Markdown Features (GFM)

- Headings: # to ######
- Bold: **text**
- Italic: *text*
- Strikethrough: ~~text~~
- Code: \`inline\` and \`\`\`blocks\`\`\`
- Links: [text](url)
- Images: ![alt](src)
- Lists: - and 1.
- Tables: | col1 | col2 |
- Blockquotes: > text

### Libraries Used

- comrak: Markdown parsing (GFM)
- scraper: HTML parsing/manipulation

### References

- [Source: epics.md#Story 2.5]
- [Source: prd.md#FR27, FR28, FR29]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Story implemented with comrak and scraper
- **COMPLETED 2026-03-12**: All text exports working
- HTML output with DOCTYPE
- Markdown with GFM features
- Plain text extraction
- Bidirectional: Markdown ↔ HTML

### File List

- `services/signapps-office/src/converter/html.rs`
- `services/signapps-office/src/converter/markdown.rs`
