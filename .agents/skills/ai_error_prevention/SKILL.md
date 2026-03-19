---
name: ai_error_prevention
description: Centralized Knowledge Base of common pitfalls, caveats, and resolutions encountered across the SignApps project.
---
# SignApps AI Knowledge Base (Error Prevention)

**CRITICAL DIRECTIVE**: Before starting a new feature, attempting a complex build, or writing E2E tests, the AI team MUST consult this Knowledge Base. Do NOT make the same mistake twice. When you encounter a novel issue or fix a stubborn bug, the `[QA Agent]` or the acting AI must ADD IT TO THIS FILE for the next AI session.

## Resolved Caveats & Known Issues

### 1. Next.js "webServer" Hang in Playwright 
- **Symptom**: `npx playwright test` hangs endlessly when `webServer` is defined in `playwright.config.ts`, returning `Can't resolve 'tailwindcss'`.
- **Root Cause**: Playwright's local Next.js webServer executes from the workspace root and fails to resolve local `client/node_modules/tailwindcss` paths.
- **Solution**: Do not rely on `playwright.config.ts` to boot the dev server. Next.js must be started natively (e.g., `npm run dev` in `client/`), and Playwright should just ping `http://localhost:3000`.

### 2. Next.js Turbopack / First Compilation Timeouts
- **Symptom**: Playwright tests (like `auth.setup.ts`) fail with `net::ERR_ABORTED` or timeout within 30 seconds when attempting to hit `/login`.
- **Root Cause**: The first request to Next.js triggers Turbopack, which can take over 30s to compile on slower Windows machines, causing UI test timeouts.
- **Solution**: The environment MUST be pre-warmed. Run `check_prereqs_and_test.ps1` before testing, which actively polls `Get-NetTCPConnection` to ensure Next.js has bound strictly to PORT 3000 *before* letting Playwright run.

### 3. Cargo Path Missing in WSL Background Shells
- **Symptom**: `wsl cargo` or `/bin/sh -c cargo` returns `cargo: not found`.
- **Root Cause**: The user's default WSL distro is Docker Desktop which does not have Rust installed natively.
- **Solution**: Compile via pre-existing `target/debug/*.exe` OR run using native Windows `Start-Process "cmd.exe"` (after checking prerequisites). Note that the AI Team installed `cargo` globally on Windows via `install_prereqs.ps1`.

### 4. Mock Data Prohibition
- **Symptom**: Writing tests with `page.route` or intercepting API requests.
- **Root Cause**: AI defaults to mocking for velocity.
- **Solution**: MOCK DATA IS STRICTLY BANNED. Every Playwright test must create, mutate, and delete *real* Postgres data via the frontend interface.

### 5. Frontend Role ID Mapping (API Coherence Error)
- **Symptom**: Selecting "Admin" in frontend forms (like `user-sheet.tsx`) attempts to create a user with an invalid role (e.g., `role: 0`).
- **Root Cause**: The frontend defaults to `0`-indexed array dropdowns, while the backend Rust models (`UserRole` enum) use explicit values (`1=User`, `2=Admin`, `3=SuperAdmin`).
- **Solution**: Always securely cross-reference frontend `<SelectItem value="x">` directly with the backend Rust database models in `crates/signapps-db/src/models/*.rs`. Never assume 0-indexed enums.

### 6. XSS via dangerouslySetInnerHTML in Client Components
- **Symptom**: Potential stored XSS via file previewers (`code-preview.tsx`) or custom branding CSS (`branding.tsx`).
- **Root Cause**: Relying on basic sequence-based Regex inside `dangerouslySetInnerHTML` allows unescaped `<script>` payloads to be built and executed.
- **Solution**: Avoid `dangerouslySetInnerHTML` completely if possible (render React nodes directly like `<>{line}</>`). When strictly necessary for injecting `<style>` tags via AST strings, ALWAYS sanitize closure tags (e.g. `.replace(/<\/style/gi, "<\\/style")`) to prevent breakouts.

---

### How to Contribute
If an AI agent spends more than 2 steps fixing a localized environment bug or compile conflict, use `multi_replace_file_content` to document the Symptom and Solution here.
