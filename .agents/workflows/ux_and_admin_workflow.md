---
description: User Experience (UX) and User Administration review
---
# UX & Administration Workflow

When asked to "improve UX", "check the interface", or "review admin features", focus on the human element of the application.

1. **Design System & Aesthetics**:
   - Verify that new components use `shadcn/ui` and `Tailwind CSS`.
   - Check if hardcoded colors are used (e.g., `text-red-500`). They should be replaced with semantic CSS variables (e.g., `text-destructive`).
   - Ensure the design supports both Dark and Light mode seamlessly.
   - Are there loading states (spinners/skeletons) for async operations?

2. **Error Handling (User Facing)**:
   - Do forms show clear validation errors (via `zod` and `react-hook-form`)?
   - Do API failures trigger a polite, localized toast notification (via `sonner`), or do they fail silently?
   - Instead of "Internal Server Error", is the user given actionable feedback if possible?

3. **Platform Administration**:
   - Is it clear in the UI which users have which roles? 
   - Are destructive actions (Delete User, Reset DB) protected by confirmation dialogs (`AlertDialog`)?

4. **Action**:
   - Present a UX improvement plan to the user.
