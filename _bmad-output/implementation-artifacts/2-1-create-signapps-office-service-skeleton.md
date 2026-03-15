# Story 2.1: Create signapps-office Service Skeleton

Status: done

## Story

As a developer,
I want a new Rust service for document conversion,
So that I can expose document export APIs on port 3010.

## Acceptance Criteria

1. **AC1**: Service runs on port 3010
2. **AC2**: Health endpoint responds at /health
3. **AC3**: Service follows existing architecture patterns
4. **AC4**: Service added to workspace Cargo.toml
5. **AC5**: TypeScript compilation passes with no errors
6. **AC6**: Clippy passes with no errors

## Tasks / Subtasks

- [x] **Task 1: Create service structure** (AC: 1, 2, 3, 4)
  - [x] 1.1 Create services/signapps-office/ directory
  - [x] 1.2 Create Cargo.toml with dependencies
  - [x] 1.3 Create src/main.rs with Axum router
  - [x] 1.4 Create src/handlers/ module
  - [x] 1.5 Add to workspace members

## Dev Notes

### Service Structure

```
services/signapps-office/
├── Cargo.toml
└── src/
    ├── main.rs
    ├── converter/
    │   ├── mod.rs
    │   ├── docx.rs
    │   ├── pdf.rs
    │   ├── html.rs
    │   ├── markdown.rs
    │   └── tiptap.rs
    └── handlers/
        ├── mod.rs
        ├── health.rs
        └── conversion.rs
```

### Dependencies

- docx-rs: DOCX generation
- printpdf: PDF generation
- comrak: Markdown parsing (GFM)
- scraper: HTML parsing

### References

- [Source: epics.md#Epic 2]
- [Source: prd.md#FR25-FR29, FR63-FR68]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Story created for Epic 2 service skeleton
- **COMPLETED 2026-03-12**: Service created and compiles
- Health endpoint at /health
- Conversion info endpoint at /api/v1/convert/info
- Conversion endpoint at /api/v1/convert (protected)
- Upload endpoint at /api/v1/convert/upload (protected)
- Clippy: PASSED (no warnings with --no-deps)
- Added to workspace members

### File List

- `services/signapps-office/Cargo.toml`
- `services/signapps-office/src/main.rs`
- `services/signapps-office/src/handlers/mod.rs`
- `services/signapps-office/src/handlers/health.rs`
- `services/signapps-office/src/handlers/conversion.rs`
- `services/signapps-office/src/converter/mod.rs`
- `services/signapps-office/src/converter/tiptap.rs`
- `services/signapps-office/src/converter/docx.rs`
- `services/signapps-office/src/converter/pdf.rs`
- `services/signapps-office/src/converter/html.rs`
- `services/signapps-office/src/converter/markdown.rs`
