import { type Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";
import { randomUUID } from "crypto";

/**
 * Page Object for the Tiptap-based document editor at `/docs/editor`.
 *
 * The editor is built on Tiptap (ProseMirror) and mounts the content
 * into a div with class `.ProseMirror`. Rather than adding custom
 * data-testids to every toolbar button, this page object uses:
 *   - `.ProseMirror` — the contenteditable root
 *   - `getByTitle("Bold (Ctrl+B)")` etc. — existing `title` attrs
 *   - Keyboard shortcuts (Ctrl+B/I/U/Z/Y) — always available
 *
 * Tiptap produces a standard HTML schema which makes assertions
 * natural: `.ProseMirror strong` for bold, `.ProseMirror em` for
 * italic, `.ProseMirror h1` for headings, etc.
 */
export class DocsEditorPage extends BasePage {
  get path(): string {
    return "/docs/editor";
  }

  get readyIndicator(): Locator {
    // The ProseMirror div is rendered once Tiptap hydrates client-side.
    return this.page.locator(".ProseMirror");
  }

  // ───────────────────────────── Navigation ──────────────────────────────

  async gotoNew(name = "E2E Doc"): Promise<string> {
    const id = randomUUID();
    const query = `id=${id}&name=${encodeURIComponent(name)}`;
    await this.goto(query);
    await expect(this.editor).toBeVisible({ timeout: 15_000 });
    return id;
  }

  // ───────────────────────────── Root locators ───────────────────────────

  /** The contenteditable ProseMirror root. */
  get editor(): Locator {
    return this.page.locator(".ProseMirror").first();
  }

  /** Toolbar button by its HTML `title` attribute. */
  toolbarButton(title: string): Locator {
    // Many toolbar buttons use title="Label (Shortcut)" — match the
    // label prefix to tolerate shortcut text variations.
    return this.page.locator(`button[title^="${title}"]`).first();
  }

  // ───────────────────────────── Content interactions ───────────────────

  /**
   * Focus the editor and type text at the current cursor position.
   *
   * Tiptap initializes with either a placeholder or an empty paragraph;
   * clicking the editor places the caret and types append there.
   */
  async typeText(text: string): Promise<void> {
    await this.editor.click();
    await this.page.keyboard.type(text);
  }

  /** Clear the editor content by selecting all and deleting. */
  async clearAll(): Promise<void> {
    await this.editor.click();
    await this.page.keyboard.press("Control+a");
    await this.page.keyboard.press("Delete");
  }

  /** Select all text in the editor. */
  async selectAll(): Promise<void> {
    await this.editor.click();
    await this.page.keyboard.press("Control+a");
  }

  // ───────────────────────────── Formatting shortcuts ───────────────────

  /** Apply bold to the current selection (Ctrl+B). */
  async applyBold(): Promise<void> {
    await this.page.keyboard.press("Control+b");
  }

  /** Apply italic to the current selection (Ctrl+I). */
  async applyItalic(): Promise<void> {
    await this.page.keyboard.press("Control+i");
  }

  /** Apply underline to the current selection (Ctrl+U). */
  async applyUnderline(): Promise<void> {
    await this.page.keyboard.press("Control+u");
  }

  /** Undo the last action (Ctrl+Z). */
  async undo(): Promise<void> {
    await this.page.keyboard.press("Control+z");
  }

  /** Redo the last undone action (Ctrl+Shift+Z). */
  async redo(): Promise<void> {
    await this.page.keyboard.press("Control+Shift+z");
  }

  // ───────────────────────────── Content assertions ─────────────────────

  /** Assert the editor contains some text. */
  async expectContent(substring: string): Promise<void> {
    await expect(this.editor).toContainText(substring);
  }

  /** Assert the editor has a `<strong>` element containing the given text. */
  async expectBold(text: string): Promise<void> {
    await expect(
      this.editor.locator("strong").filter({ hasText: text }),
    ).toBeVisible();
  }

  /** Assert the editor has an `<em>` element containing the given text. */
  async expectItalic(text: string): Promise<void> {
    await expect(
      this.editor.locator("em").filter({ hasText: text }),
    ).toBeVisible();
  }

  /** Assert the editor has a `<u>` element containing the given text. */
  async expectUnderlined(text: string): Promise<void> {
    // Tiptap underline renders as <u> (default).
    await expect(
      this.editor.locator("u").filter({ hasText: text }),
    ).toBeVisible();
  }

  /** Assert the editor has a heading at the given level (1–6). */
  async expectHeading(
    level: 1 | 2 | 3 | 4 | 5 | 6,
    text: string,
  ): Promise<void> {
    await expect(
      this.editor.locator(`h${level}`).filter({ hasText: text }),
    ).toBeVisible();
  }

  /** Assert the editor has a bullet list with an item containing the text. */
  async expectBulletListItem(text: string): Promise<void> {
    await expect(
      this.editor.locator("ul li").filter({ hasText: text }),
    ).toBeVisible();
  }

  /** Assert the editor has an ordered list with an item containing the text. */
  async expectNumberedListItem(text: string): Promise<void> {
    await expect(
      this.editor.locator("ol li").filter({ hasText: text }),
    ).toBeVisible();
  }

  /** Read the raw textContent of the editor (stripping formatting). */
  async textContent(): Promise<string> {
    return (await this.editor.textContent()) ?? "";
  }

  /** Read the full innerHTML of the editor for deep assertions. */
  async innerHTML(): Promise<string> {
    return await this.editor.innerHTML();
  }
}
