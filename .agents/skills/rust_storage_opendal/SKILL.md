---
name: rust_storage_opendal
description: Interacting with the OpenDAL storage abstraction layer
---
# Storage Integration via OpenDAL

1. **Abstraction**: Do NOT directly use `std::fs` for file management (uploads, downloads, resource storage) in the APIs. Use the `opendal` crate wrapper provided by the `signapps-storage` service.
2. **Modes**: The application is configured to run on simple local Filesystem mode or S3-compatible mode (Minio/AWS). OpenDAL guarantees this behavior remains identical mathematically.
3. **Binary Data**: Use streaming responses (`axum::body::Body` or similar streams) when serving large files from OpenDAL to avoid memory exhaustion on the server node.
4. **Paths**: OpenDAL paths should be cross-platform (using `/` as separator regardless of OS) and relative to the operator's root context.
