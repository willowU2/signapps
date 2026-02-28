---
description: Comprehensive quality assurance and code review checklist
---
# Automated Code Review Workflow

When asked to "review code", "clean up", or "run QA", execute these steps sequentially. Do not skip any steps unless explicitly requested by the user.

1. **Diff Analysis**: 
   - Analyze the `git status` and use `git diff` to understand the scope of the recent changes. 
   - Ensure the changes are grouped logically.

2. **Backend Checks (Rust)**:
// turbo-all
   - Run `cargo fmt --all -- --check` to verify formatting.
   - Run `cargo clippy --workspace --all-features -- -D warnings` to catch linting errors. 
   - Search for leftover `dbg!()`, `println!()` or `eprintln!()` in the modified Rust files (we MUST use `tracing`).

3. **Frontend Checks (Next.js)**:
// turbo-all
   - Change directory to `client/`.
   - Run `npm run lint` to catch ESLint warnings.
   - Run `npm run type-check` (or equivalent `tsc --noEmit`) to verify strict TypeScript adherence.
   - Search for leftover `console.log()` statements in the modified TypeScript files.

4. **Architectural Review**:
   - Check if the modified code violates `CONVENTIONS.md` (e.g. using `unwrap()` instead of `?`, or Redux instead of Zustand).
   - If large blocks of code are duplicated, propose a refactoring strategy.

5. **Reporting**:
   - Generate a concise report for the user summarizing the issues found and offering to fix them automatically.
