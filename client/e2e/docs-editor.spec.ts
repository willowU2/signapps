import { test, expect } from "./fixtures";
import { DocsEditorPage } from "./pages/DocsEditorPage";

/**
 * Docs Editor — deep E2E tests for the Tiptap-based document editor.
 *
 * Covers:
 *   1. Basic text input and clearing
 *   2. Inline formatting (bold, italic, underline) via keyboard shortcuts
 *   3. Inline formatting via toolbar buttons (title-based selectors)
 *   4. Headings via markdown shortcut (# Heading)
 *   5. Bullet and numbered lists via markdown shortcuts
 *   6. Undo / redo
 *   7. Multi-format composition (bold + italic on same selection)
 *   8. Editor persists typing across paragraphs
 *
 * This spec is in addition to the existing `docs.spec.ts` which uses
 * defensive `isVisible().catch(() => false)` assertions. This file
 * replaces those with strict assertions that fail fast when the
 * feature is broken.
 *
 * Entry: `/docs/editor?id=<uuid>&name=<name>` — opens a fresh document.
 * Uses Tiptap's standard HTML schema for assertions (.ProseMirror root,
 * <strong>, <em>, <u>, <h1..h6>, <ul>, <ol>, <li>).
 */

test.describe.configure({ mode: "serial" });

test.describe("Docs Editor", () => {
  let docs: DocsEditorPage;

  test.beforeEach(async ({ page }) => {
    docs = new DocsEditorPage(page);
    await docs.gotoNew("DocsEditorTest");
  });

  // ───────────────────────────── Basic input ────────────────────────────

  test("typing into the editor appends text", async () => {
    await docs.typeText("Hello, world!");
    await docs.expectContent("Hello, world!");
  });

  test("Enter creates a new paragraph", async () => {
    await docs.typeText("First paragraph");
    await docs.editor.page().keyboard.press("Enter");
    await docs.editor.page().keyboard.type("Second paragraph");

    // Both paragraphs are present.
    await docs.expectContent("First paragraph");
    await docs.expectContent("Second paragraph");
    // The editor has two <p> nodes now.
    await expect(docs.editor.locator("p")).toHaveCount(2);
  });

  // ───────────────────────────── Formatting via shortcuts ──────────────

  test("Ctrl+B wraps selected text in <strong>", async () => {
    await docs.typeText("bold me");
    await docs.selectAll();
    await docs.applyBold();
    await docs.expectBold("bold me");
  });

  test("Ctrl+I wraps selected text in <em>", async () => {
    await docs.typeText("italic me");
    await docs.selectAll();
    await docs.applyItalic();
    await docs.expectItalic("italic me");
  });

  test("Ctrl+U wraps selected text in <u>", async () => {
    await docs.typeText("underline me");
    await docs.selectAll();
    await docs.applyUnderline();
    await docs.expectUnderlined("underline me");
  });

  test("bold + italic on the same selection produces nested tags", async () => {
    await docs.typeText("both");
    await docs.selectAll();
    await docs.applyBold();
    await docs.applyItalic();
    // Tiptap nests them as <strong><em>both</em></strong> or <em><strong>
    // depending on order. We assert that both marks exist somewhere
    // on the text.
    const html = await docs.innerHTML();
    expect(html).toMatch(
      /<strong>.*<em>both<\/em>.*<\/strong>|<em>.*<strong>both<\/strong>.*<\/em>/,
    );
  });

  test("toggling bold twice removes the <strong> tag", async () => {
    await docs.typeText("flipflop");
    await docs.selectAll();
    await docs.applyBold();
    await docs.expectBold("flipflop");

    await docs.selectAll();
    await docs.applyBold(); // toggle off
    // No <strong> should remain.
    await expect(docs.editor.locator("strong")).toHaveCount(0);
  });

  // ───────────────────────────── Formatting via toolbar ────────────────

  test("clicking the Bold toolbar button toggles bold", async () => {
    await docs.typeText("toolbar-bold");
    await docs.selectAll();
    await docs.toolbarButton("Bold").click();
    await docs.expectBold("toolbar-bold");
  });

  test("clicking the Italic toolbar button toggles italic", async () => {
    await docs.typeText("toolbar-italic");
    await docs.selectAll();
    await docs.toolbarButton("Italic").click();
    await docs.expectItalic("toolbar-italic");
  });

  test("clicking the Underline toolbar button toggles underline", async () => {
    await docs.typeText("toolbar-underline");
    await docs.selectAll();
    await docs.toolbarButton("Underline").click();
    await docs.expectUnderlined("toolbar-underline");
  });

  // ───────────────────────────── Markdown shortcuts ────────────────────

  test('"# Heading" markdown shortcut produces an <h1>', async () => {
    // Type "# " then the heading text — Tiptap's markdown shortcut
    // rule converts the line into a heading node.
    await docs.editor.click();
    await docs.editor.page().keyboard.type("# Main title");
    // Give Tiptap a moment to transform the node after the space.
    await docs.expectHeading(1, "Main title");
  });

  test('"## Subheading" markdown shortcut produces an <h2>', async () => {
    await docs.editor.click();
    await docs.editor.page().keyboard.type("## Subtitle");
    await docs.expectHeading(2, "Subtitle");
  });

  test('"- item" markdown shortcut produces a <ul>', async () => {
    await docs.editor.click();
    await docs.editor.page().keyboard.type("- First");
    await docs.editor.page().keyboard.press("Enter");
    await docs.editor.page().keyboard.type("Second");
    // Tiptap converts the "- " prefix into a bullet list automatically.
    await docs.expectBulletListItem("First");
    await docs.expectBulletListItem("Second");
  });

  test('"1. item" markdown shortcut produces an <ol>', async () => {
    await docs.editor.click();
    await docs.editor.page().keyboard.type("1. One");
    await docs.editor.page().keyboard.press("Enter");
    await docs.editor.page().keyboard.type("Two");
    await docs.expectNumberedListItem("One");
    await docs.expectNumberedListItem("Two");
  });

  // ───────────────────────────── Undo / Redo ───────────────────────────

  test("Ctrl+Z undoes the last transaction", async () => {
    // Tiptap groups continuous keystrokes into a single undoable
    // transaction within a ~500ms window. We wait 800ms between the
    // two insertions so they become distinct undo entries.
    await docs.typeText("first");
    await docs.expectContent("first");
    await docs.editor.page().waitForTimeout(800);
    await docs.editor.page().keyboard.type(" second");
    await docs.expectContent("first second");
    // Undo removes only the most recent transaction (" second").
    await docs.undo();
    const text = await docs.textContent();
    expect(text).toContain("first");
    expect(text).not.toContain("second");
  });

  test("Ctrl+Shift+Z redoes an undone action", async () => {
    await docs.typeText("original");
    // Create a transaction boundary via the 500ms grouping window.
    await docs.editor.page().waitForTimeout(800);
    await docs.editor.page().keyboard.type(" extra");
    await docs.expectContent("original extra");
    await docs.undo();
    // After one undo, " extra" is gone but "original" remains.
    let text = await docs.textContent();
    expect(text).toContain("original");
    expect(text).not.toContain("extra");
    // Redo restores " extra".
    await docs.redo();
    text = await docs.textContent();
    expect(text).toContain("original");
    expect(text).toContain("extra");
  });

  // ───────────────────────────── Clearing ──────────────────────────────

  test("clearAll empties the editor", async () => {
    await docs.typeText("will be wiped");
    await docs.expectContent("will be wiped");
    await docs.clearAll();
    const text = (await docs.textContent()).trim();
    expect(text).toBe("");
  });

  // ───────────────────────────── Multi-paragraph persistence ───────────

  test("multiple paragraphs with formatting survive re-selections", async () => {
    await docs.typeText("para one");
    await docs.editor.page().keyboard.press("Enter");
    await docs.editor.page().keyboard.type("para two");
    await docs.editor.page().keyboard.press("Enter");
    await docs.editor.page().keyboard.type("para three");

    // Select only "para two" via triple-click on its paragraph.
    const paraTwo = docs.editor.locator("p").nth(1);
    await paraTwo.click({ clickCount: 3 });
    await docs.applyBold();

    // Assert only "para two" is bold.
    await docs.expectBold("para two");
    // And "para one" / "para three" are not bold.
    await expect(
      docs.editor.locator("strong").filter({ hasText: "para one" }),
    ).toHaveCount(0);
    await expect(
      docs.editor.locator("strong").filter({ hasText: "para three" }),
    ).toHaveCount(0);
  });
});
