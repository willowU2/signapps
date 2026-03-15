# Story 2.7: Batch Conversion Endpoint

Status: done

## Story

As a user with multiple documents,
I want to convert them in a single API call,
So that I can efficiently process many documents at once.

## Acceptance Criteria

1. **AC1**: POST /api/v1/convert/batch accepts array of items
2. **AC2**: Each item has id, input_format, content, output_format
3. **AC3**: Response includes success/failure for each item
4. **AC4**: Failed items don't stop processing others
5. **AC5**: Results include base64-encoded data

## Tasks / Subtasks

- [x] **Task 1: Implement batch endpoint** (AC: 1, 2, 3, 4, 5)
  - [x] 1.1 Define BatchConversionItem struct
  - [x] 1.2 Define BatchConversionRequest struct
  - [x] 1.3 Define BatchConversionResultItem struct
  - [x] 1.4 Process items sequentially
  - [x] 1.5 Return base64-encoded results

## Dev Notes

### Request Format

```json
{
  "items": [
    {
      "id": "doc1",
      "input_format": "tiptapjson",
      "content": { ... },
      "output_format": "docx"
    },
    {
      "id": "doc2",
      "input_format": "markdown",
      "content": "# Title\n...",
      "output_format": "pdf"
    }
  ]
}
```

### Response Format

```json
{
  "total": 2,
  "successful": 2,
  "failed": 0,
  "results": [
    {
      "id": "doc1",
      "success": true,
      "data_base64": "UEsDBBQA...",
      "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "extension": "docx"
    },
    {
      "id": "doc2",
      "success": true,
      "data_base64": "JVBERi0x...",
      "mime_type": "application/pdf",
      "extension": "pdf"
    }
  ]
}
```

### References

- [Source: epics.md#Story 2.7]
- [Source: prd.md#FR64]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Story implemented with batch endpoint
- **COMPLETED 2026-03-12**: Batch conversion working
- Sequential processing (could be parallelized later)
- Base64-encoded results
- Error handling per item

### File List

- `services/signapps-office/src/handlers/conversion.rs`
- `services/signapps-office/src/main.rs`
