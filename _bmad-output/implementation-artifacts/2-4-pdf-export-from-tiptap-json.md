# Story 2.4: PDF Export from Tiptap JSON

Status: done

## Story

As a document author,
I want to export my documents to PDF format,
So that I can share finalized versions that look the same everywhere.

## Acceptance Criteria

1. **AC1**: Tiptap JSON converts to PDF
2. **AC2**: A4 page size with margins
3. **AC3**: Headings use appropriate font sizes
4. **AC4**: Text wraps correctly
5. **AC5**: Multiple pages supported
6. **AC6**: PDF magic bytes (%PDF) present

## Tasks / Subtasks

- [x] **Task 1: Implement PDF generation** (AC: 1, 2, 3, 4, 5, 6)
  - [x] 1.1 Use printpdf library
  - [x] 1.2 Configure A4 page size (210x297mm)
  - [x] 1.3 Set 25mm margins
  - [x] 1.4 Use Helvetica built-in fonts
  - [x] 1.5 Implement text wrapping
  - [x] 1.6 Add page breaks when needed

## Dev Notes

### Page Configuration

- Width: 210mm (A4)
- Height: 297mm (A4)
- Margins: 25mm all sides
- Line height: 5mm

### Font Sizes (points)

- H1: 24pt
- H2: 18pt
- H3: 14pt
- Normal: 11pt
- Code: 10pt

### Built-in Fonts

- Helvetica (normal)
- Helvetica-Bold
- Helvetica-Oblique (italic)
- Courier (monospace)

### References

- [Source: epics.md#Story 2.4]
- [Source: prd.md#FR26]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Story implemented with printpdf library
- **COMPLETED 2026-03-12**: PDF export working
- A4 page size with 25mm margins
- Auto page breaks
- Text wrapping at ~80 chars
- All element types supported
- Unit tests pass (%PDF magic bytes)

### File List

- `services/signapps-office/src/converter/pdf.rs`
