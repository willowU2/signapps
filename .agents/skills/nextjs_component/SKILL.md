---
name: nextjs_component
description: Strictly CRUD "Data Table & Sheet" Frontend Component Pattern
---
# Strictly CRUD Frontend UI Pattern

The global UI/UX standard for SignApps is **Option A: "Data Table & Slide-out Sheet"**. Every entity in the system MUST be presented using this pattern to ensure 100% cohesion.

## The Standard Architecture per Entity

When creating the UI for a new entity, you MUST generate the following structure:

### 1. State & Fetching (The Hook)
Location: `client/src/hooks/use-[entity].ts`
- Must use `react-query` to interact with Axios.
- Provide `use[Entity]List()`, `use[Entity]()`, `useCreate[Entity]()`, `useUpdate[Entity]()`, and `useDelete[Entity]()`.
- Mutations MUST invalidate the list query on success.

### 2. The Main View (Data Table)
Location: `client/src/app/[feature]/page.tsx`
- Must use `shadcn/ui` Data Table.
- Displays the list of entities with pagination.
- Contains the "Add [Entity]" button.
- Each row has an "Edit" and "Delete" action.

### 3. The Slide-out Form (Sheet)
Location: `client/src/components/[feature]/[entity]-sheet.tsx`
- Must use `shadcn/ui` `<Sheet>` component.
- Opens from the right side.
- Used for BOTH "Create" and "Update" operations (differentiated by whether an `id` or `initialData` is passed).
- Uses `react-hook-form` and `zod` for strict validation matching the Rust Backend DTOs.

### 4. The Delete Confirmation (AlertDialog)
Location: `client/src/components/[feature]/[entity]-delete-dialog.tsx`
- Must use `shadcn/ui` `<AlertDialog>`.
- Prevents accidental deletions.

## Directives
- **Zero Gaps**: Never skip error handling. If a mutation fails, show a toast (`sonner`). If it succeeds, show a success toast and close the Sheet.
- **Use Client**: Only add `'use client';` to the Data Table, Sheet, and Dialog components.
- **Imports**: Rely purely on internal `@/components/ui/` primitive shadcn components. Do not invent new UI paradigms.
