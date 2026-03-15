# Story 2.2: Implement Conversion API Endpoint

Status: done

## Story

As a user,
I want to convert documents via API,
So that I can export my documents to different formats.

## Acceptance Criteria

1. **AC1**: POST /api/v1/convert accepts JSON body
2. **AC2**: POST /api/v1/convert/upload accepts multipart form
3. **AC3**: Format parameter specifies output format
4. **AC4**: Returns binary file with correct MIME type
5. **AC5**: Protected by JWT authentication

## Tasks / Subtasks

- [x] **Task 1: Create conversion handler** (AC: 1, 2, 3, 4, 5)
  - [x] 1.1 Define ConversionRequest struct
  - [x] 1.2 Define ConversionQuery params
  - [x] 1.3 Implement convert_json handler
  - [x] 1.4 Implement convert_upload handler
  - [x] 1.5 Add auth middleware to routes

## Dev Notes

### API Endpoints

```
GET  /api/v1/convert/info - Get supported formats (public)
POST /api/v1/convert - Convert JSON body (protected)
POST /api/v1/convert/upload - Convert uploaded file (protected)
```

### Request Format

```json
{
  "input_format": "tiptapjson" | "html" | "markdown",
  "content": { ... } | "string",
  "title": "optional title"
}
```

### Query Parameters

- `format`: docx | pdf | markdown | html | text
- `filename`: optional output filename

### References

- [Source: epics.md#Story 2.2]
- [Source: prd.md#FR63]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Story implemented as part of service skeleton
- **COMPLETED 2026-03-12**: API endpoints working
- JSON body conversion
- Multipart file upload conversion
- Auto-detect format from file extension
- Correct MIME types for each format

### File List

- `services/signapps-office/src/handlers/conversion.rs`
