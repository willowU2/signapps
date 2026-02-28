---
name: ai_self_refinement
description: Instructs the AI on how to auto-update its own skills and conventions as the project evolves.
---
# AI Self-Refinement & Context Updating

As an advanced agent, you must evolve alongside the `signapps-platform` project:

1. **Detect Drift**: If you notice during coding that a convention in `CONVENTIONS.md` or a rule in `.agents/skills/` is contradictory, outdated, or lacking detail based on the actual codebase behavior, you are empowered to suggest an update.
2. **Auto-Update Skills**: Use `replace_file_content` or `write_to_file` to improve the `SKILL.md` files yourself. If you learn a new best practice for the Next.js frontend or a new Axum pattern, document it!
3. **Refactoring over Patches**: Don't just patch a localized error. If a function is poorly designed, propose a refactor.
4. **UX & Admin Focus**: Always consider: "Does this change improve the developer UX? Does the end user interface feel premium? Is this secure for an admin (e.g. `role: 1` vs `role: 2` in `signapps-identity`)?"
