---
name: rust_debugging_workflow
description: Best practices for debugging Rust errors in the project
---
# Rust Debugging Workflow

When writing backend code and encountering compilation or linting errors, use the following workflow to remain fast and avoid context-limit issues:

1. **Checking**: Use `cargo c` (alias for `cargo check`) to quickly check if the code compiles without generating binaries.
2. **Linting**: Use `cargo lint` (alias for `cargo clippy --workspace --all-features -- -D warnings`) to ensure code matches the project's strict guidelines.
3. **Handling Huge Logs**: If a command produces a massive amount of error output, DO NOT print it directly to the chat context. Instead:
   - Run the command and redirect the output to a file: `cargo check > compile_output.txt 2>&1`
   - Use `view_file` or `grep_search` to read specific errors from `compile_output.txt`.
4. **Fixing Errors**: Fix errors systematically starting from the *first* error in the file, as Rust compiler errors tend to cascade.
5. **Testing**: Use `cargo t` (alias for `cargo test`) to run unit and integration tests.
