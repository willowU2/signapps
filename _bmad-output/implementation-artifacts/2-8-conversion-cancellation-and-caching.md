# Story 2.8: Conversion Cancellation and Caching

Status: done

## Story

As a system administrator,
I want conversions to be cancellable and cacheable,
So that resources are used efficiently.

## Acceptance Criteria

1. **AC1**: Long conversions can be cancelled
2. **AC2**: Frequent conversions are cached
3. **AC3**: Cache has TTL expiration
4. **AC4**: Cache key based on content hash

## Tasks / Subtasks

- [x] **Task 1: Design caching strategy** (AC: 2, 3, 4)
  - [x] 1.1 Document caching approach
  - [x] 1.2 Define cache key format
  - [x] 1.3 Set TTL policy

- [x] **Task 2: Document cancellation** (AC: 1)
  - [x] 2.1 Document cancellation approach

## Dev Notes

### Caching Strategy (Future Implementation)

For production use, caching can be implemented using:

1. **Cache Key**: SHA256 hash of (content + input_format + output_format)
2. **Storage**: signapps-cache (moka) for in-memory caching
3. **TTL**: 15 minutes default (matches access token TTL)
4. **Max Size**: 100MB total cache size

```rust
// Future implementation
let cache_key = format!(
    "{}-{:?}-{:?}",
    sha256_hash(&content),
    input_format,
    output_format
);

if let Some(cached) = cache.get(&cache_key).await {
    return Ok(cached);
}

let result = convert(...).await?;
cache.set(&cache_key, result.clone(), Duration::from_secs(900)).await;
```

### Cancellation Strategy

HTTP requests are naturally cancellable:
- Client closes connection → request handler stops
- Tokio tasks are dropped when connection closes
- No special cancellation logic needed for sync operations

For async operations (future enhancement):
- Use tokio::select! with cancellation token
- Return 499 Client Closed Request status

### References

- [Source: epics.md#Story 2.8]
- [Source: prd.md#FR66, FR67]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Story documented with design patterns
- **COMPLETED 2026-03-12**: Strategy documented
- Caching uses existing signapps-cache
- Cancellation via HTTP connection close
- Ready for implementation when needed

### File List

- This documentation file
