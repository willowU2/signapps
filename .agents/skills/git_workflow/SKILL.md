---
name: git_workflow
description: Standard git workflow and commit conventions for the project
---
# Git Workflow & Commit Conventions

1. **Conventional Commits**: ALWAYS use Conventional Commits format for your commit messages:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `refactor:` for code refactoring
   - `test:` for adding or fixing tests
   - `chore:` for maintenance, dependencies, etc.
   - Example: `feat(api): add list_users endpoint`
2. **Granularity**: Keep commits small and logically separated. Do not commit unstructured chunks of changes from backend and frontend all at once if they are technically separate features.
3. **Using Tools**: Use the GitKraken MCP tools provided (e.g., `mcp_GitKraken_git_add_or_commit`) or the terminal command `git commit -m "..."`.
4. **No Destructive Operations**: Never force push (`--force`) without explicit user permission.
