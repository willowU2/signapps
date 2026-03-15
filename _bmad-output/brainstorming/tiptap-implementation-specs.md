# Tiptap v3 Implementation Specifications

**Generated:** 2026-03-12
**Project:** SignApps Office Suite
**Constraints:** Apache 2.0/MIT only, Rust backend, Next.js 16 + Tiptap v3 + Yjs

---

## Table of Contents

1. [Sprint 1: Foundation Polish](#sprint-1-foundation-polish)
2. [Sprint 2: Collaboration Polish](#sprint-2-collaboration-polish)
3. [Sprint 3: Professional Formatting](#sprint-3-professional-formatting)
4. [Sprint 4: Advanced Content](#sprint-4-advanced-content)
5. [Sprint 5: Export Fidelity](#sprint-5-export-fidelity)
6. [Sprint 6: Media & Advanced](#sprint-6-media--advanced)
7. [Package Dependencies](#package-dependencies)
8. [Editor Configuration](#editor-configuration)

---

## Sprint 1: Foundation Polish

**Effort:** ~2 hours | **Impact:** High UX improvement

### 1.1 Typography Extension

**Package:** `@tiptap/extension-typography`
**License:** MIT
**Purpose:** Automatic typographic improvements (smart quotes, dashes, ellipsis)

```typescript
// client/src/components/docs/editor.tsx
import Typography from '@tiptap/extension-typography'

// Add to extensions array:
Typography.configure({
  emDash: true,        // -- → —
  ellipsis: true,      // ... → …
  openDoubleQuote: '«', // French quotes
  closeDoubleQuote: '»',
  openSingleQuote: ''',
  closeSingleQuote: ''',
}),
```

**Backend:** No changes needed (text is already converted)

---

### 1.2 Dropcursor Extension

**Package:** `@tiptap/extension-dropcursor`
**License:** MIT
**Purpose:** Visual indicator when dragging content

```typescript
import Dropcursor from '@tiptap/extension-dropcursor'

Dropcursor.configure({
  color: '#3b82f6', // blue-500
  width: 2,
  class: 'drop-cursor',
}),
```

**CSS:**
```css
/* client/src/app/globals.css */
.drop-cursor {
  border-left: 2px solid #3b82f6;
}
```

**Backend:** N/A

---

### 1.3 Gapcursor Extension

**Package:** `@tiptap/extension-gapcursor`
**License:** MIT
**Purpose:** Prevents cursor from getting stuck in non-editable positions

```typescript
import Gapcursor from '@tiptap/extension-gapcursor'

// No configuration needed
Gapcursor,
```

**CSS:**
```css
.ProseMirror-gapcursor {
  position: relative;
}
.ProseMirror-gapcursor:after {
  content: '';
  display: block;
  position: absolute;
  top: -2px;
  width: 20px;
  border-top: 1px solid black;
  animation: ProseMirror-cursor-blink 1.1s steps(2, start) infinite;
}
```

**Backend:** N/A

---

### 1.4 TrailingNode Extension

**Package:** `@tiptap/extension-trailing-node`
**License:** MIT
**Purpose:** Always maintains an empty paragraph at document end

```typescript
import TrailingNode from '@tiptap/extension-trailing-node'

TrailingNode.configure({
  node: 'paragraph',
}),
```

**Backend:** N/A

---

### 1.5 Focus Extension

**Package:** `@tiptap/extension-focus`
**License:** MIT
**Purpose:** Track and style focused nodes

```typescript
import Focus from '@tiptap/extension-focus'

Focus.configure({
  className: 'has-focus',
  mode: 'all', // 'all' | 'deepest' | 'shallowest'
}),
```

**CSS:**
```css
.ProseMirror .has-focus {
  border-radius: 3px;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}
```

**Backend:** N/A

---

## Sprint 2: Collaboration Polish

**Effort:** ~1 day | **Impact:** Real-time collaboration UX

### 2.1 Collaboration Cursor Extension

**Package:** `@tiptap/extension-collaboration-cursor`
**License:** MIT
**Purpose:** Display remote user cursors and selections

```typescript
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'

// In useEditor hook:
CollaborationCursor.configure({
  provider: wsProvider, // Your y-websocket provider
  user: {
    name: currentUser.name,
    color: currentUser.color, // e.g., '#f87171'
  },
}),
```

**CSS:**
```css
/* Remote cursor styles */
.collaboration-cursor__caret {
  position: relative;
  margin-left: -1px;
  margin-right: -1px;
  border-left: 1px solid;
  border-right: 1px solid;
  word-break: normal;
  pointer-events: none;
}

.collaboration-cursor__label {
  position: absolute;
  top: -1.4em;
  left: -1px;
  font-size: 12px;
  font-weight: 600;
  line-height: normal;
  white-space: nowrap;
  color: white;
  padding: 0.1rem 0.3rem;
  border-radius: 3px 3px 3px 0;
  user-select: none;
}
```

**Integration with existing awareness:**
```typescript
// client/src/hooks/use-collaboration-awareness.ts
// Update to use CollaborationCursor instead of custom implementation
```

**Backend:** N/A

---

### 2.2 Drag Handle Extension

**Package:** `@tiptap/extension-drag-handle-react`
**License:** MIT
**Purpose:** Visual handle for dragging blocks

```typescript
import { DragHandle } from '@tiptap/extension-drag-handle-react'

// In editor component JSX:
<DragHandle editor={editor}>
  <div className="drag-handle">
    <GripVertical className="w-4 h-4 text-gray-400" />
  </div>
</DragHandle>
```

**CSS:**
```css
.drag-handle {
  position: fixed;
  opacity: 0;
  transition: opacity 0.2s;
  cursor: grab;
  padding: 0.25rem;
  border-radius: 0.25rem;
}
.drag-handle:hover {
  background: rgba(0, 0, 0, 0.05);
}
.drag-handle.show {
  opacity: 1;
}
```

**Backend:** N/A

---

### 2.3 Unique ID Extension

**Package:** `@tiptap/extension-unique-id`
**License:** MIT
**Purpose:** Assign unique IDs to each block for stable references

```typescript
import UniqueID from '@tiptap/extension-unique-id'

UniqueID.configure({
  attributeName: 'id',
  types: ['heading', 'paragraph', 'listItem', 'taskItem', 'table', 'image'],
  generateID: () => `node-${Math.random().toString(36).substr(2, 9)}`,
}),
```

**Backend Update:**
```rust
// services/signapps-office/src/converter/tiptap.rs
// Preserve node IDs in HTML output
fn node_to_html(node: &TiptapNode) -> Result<String, ConversionError> {
    let id_attr = node.attrs.as_ref()
        .and_then(|a| a.get("id"))
        .and_then(|id| id.as_str())
        .map(|id| format!(" id=\"{}\"", id))
        .unwrap_or_default();

    // Add id_attr to element tags
}
```

---

### 2.4 File Handler Extension

**Package:** `@tiptap/extension-file-handler`
**License:** MIT
**Purpose:** Handle file drag-and-drop and paste

```typescript
import FileHandler from '@tiptap/extension-file-handler'

FileHandler.configure({
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  onDrop: (currentEditor, files, pos) => {
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        currentEditor.chain().focus().setImage({
          src: reader.result as string
        }).run()
      }
      reader.readAsDataURL(file)
    })
  },
  onPaste: (currentEditor, files, htmlContent) => {
    // Same as onDrop
  },
}),
```

**Backend:** N/A (images handled as base64)

---

## Sprint 3: Professional Formatting

**Effort:** ~2 days | **Impact:** MS Word/Google Docs parity

### 3.1 Line Height Extension (Custom)

**File:** `client/src/components/docs/extensions/line-height.ts`

```typescript
import { Extension } from '@tiptap/core'

export interface LineHeightOptions {
  types: string[]
  defaultLineHeight: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (lineHeight: string) => ReturnType
      unsetLineHeight: () => ReturnType
    }
  }
}

export const LineHeight = Extension.create<LineHeightOptions>({
  name: 'lineHeight',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      defaultLineHeight: '1.5',
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: this.options.defaultLineHeight,
            parseHTML: element => element.style.lineHeight || this.options.defaultLineHeight,
            renderHTML: attributes => {
              if (!attributes.lineHeight) return {}
              return { style: `line-height: ${attributes.lineHeight}` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setLineHeight: (lineHeight: string) => ({ commands }) => {
        return this.options.types.every(type =>
          commands.updateAttributes(type, { lineHeight })
        )
      },
      unsetLineHeight: () => ({ commands }) => {
        return this.options.types.every(type =>
          commands.resetAttributes(type, 'lineHeight')
        )
      },
    }
  },
})
```

**Toolbar Integration:**
```typescript
// Line height dropdown options
const lineHeightOptions = [
  { label: 'Single', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: 'Double', value: '2' },
]
```

**Backend Update:**
```rust
// services/signapps-office/src/converter/tiptap.rs
fn get_paragraph_style(attrs: &Option<Value>) -> String {
    let mut styles = Vec::new();

    if let Some(attrs) = attrs {
        // Existing text-align handling...

        // Add line-height
        if let Some(line_height) = attrs.get("lineHeight").and_then(|l| l.as_str()) {
            styles.push(format!("line-height: {}", line_height));
        }
    }
    // ...
}

// services/signapps-office/src/converter/docx.rs
fn create_paragraph_from_element(elem: &scraper::ElementRef) -> Result<Paragraph, ConversionError> {
    let mut paragraph = Paragraph::new();

    if let Some(style) = elem.value().attr("style") {
        // Add line spacing to DOCX
        if let Some(line_height) = extract_line_height_from_style(style) {
            // DOCX line spacing: 240 twips = single line
            let spacing = (line_height * 240.0) as i32;
            paragraph = paragraph.line_spacing(
                LineSpacing::new().line(spacing)
            );
        }
    }
    // ...
}

fn extract_line_height_from_style(style: &str) -> Option<f32> {
    if let Some(start) = style.find("line-height:") {
        let rest = &style[start + 12..];
        let end = rest.find(';').unwrap_or(rest.len());
        let value = rest[..end].trim();
        value.parse::<f32>().ok()
    } else {
        None
    }
}
```

---

### 3.2 Indent Extension (Custom)

**File:** `client/src/components/docs/extensions/indent.ts`

```typescript
import { Extension } from '@tiptap/core'

export interface IndentOptions {
  types: string[]
  minLevel: number
  maxLevel: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType
      outdent: () => ReturnType
    }
  }
}

export const Indent = Extension.create<IndentOptions>({
  name: 'indent',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      minLevel: 0,
      maxLevel: 8,
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: element => {
              const marginLeft = element.style.marginLeft
              if (!marginLeft) return 0
              const px = parseInt(marginLeft, 10)
              return Math.round(px / 40) // 40px per indent level
            },
            renderHTML: attributes => {
              if (!attributes.indent || attributes.indent === 0) return {}
              return { style: `margin-left: ${attributes.indent * 40}px` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      indent: () => ({ tr, state, dispatch }) => {
        const { selection } = state
        tr = tr.setSelection(selection)

        state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
          if (this.options.types.includes(node.type.name)) {
            const currentIndent = node.attrs.indent || 0
            if (currentIndent < this.options.maxLevel) {
              tr = tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indent: currentIndent + 1,
              })
            }
          }
        })

        if (dispatch) dispatch(tr)
        return true
      },

      outdent: () => ({ tr, state, dispatch }) => {
        const { selection } = state
        tr = tr.setSelection(selection)

        state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
          if (this.options.types.includes(node.type.name)) {
            const currentIndent = node.attrs.indent || 0
            if (currentIndent > this.options.minLevel) {
              tr = tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indent: currentIndent - 1,
              })
            }
          }
        })

        if (dispatch) dispatch(tr)
        return true
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indent(),
      'Shift-Tab': () => this.editor.commands.outdent(),
    }
  },
})
```

**Backend Update:**
```rust
// services/signapps-office/src/converter/docx.rs
fn create_paragraph_from_element(elem: &scraper::ElementRef) -> Result<Paragraph, ConversionError> {
    let mut paragraph = Paragraph::new();

    if let Some(style) = elem.value().attr("style") {
        // Add indentation
        if let Some(indent_px) = extract_margin_left_from_style(style) {
            // Convert px to twips (1 inch = 1440 twips, 1 inch ≈ 96px)
            let indent_twips = (indent_px as f32 * 1440.0 / 96.0) as i32;
            paragraph = paragraph.indent(Some(indent_twips), None, None, None);
        }
    }
    // ...
}

fn extract_margin_left_from_style(style: &str) -> Option<i32> {
    if let Some(start) = style.find("margin-left:") {
        let rest = &style[start + 12..];
        let end = rest.find(';').unwrap_or(rest.len());
        let value = rest[..end].trim();
        if let Some(px) = value.strip_suffix("px") {
            return px.trim().parse::<i32>().ok();
        }
    }
    None
}
```

---

### 3.3 Page Break Extension (Custom)

**File:** `client/src/components/docs/extensions/page-break.ts`

```typescript
import { Node, mergeAttributes } from '@tiptap/core'

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,

  parseHTML() {
    return [
      { tag: 'div[data-page-break]' },
      { tag: 'hr.page-break' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-page-break': '',
      class: 'page-break',
    })]
  },

  addCommands() {
    return {
      setPageBreak: () => ({ commands }) => {
        return commands.insertContent({ type: this.name })
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.setPageBreak(),
    }
  },
})
```

**CSS:**
```css
.page-break {
  page-break-after: always;
  break-after: page;
  height: 0;
  margin: 2rem 0;
  border: none;
  border-top: 2px dashed #e5e7eb;
  position: relative;
}
.page-break::after {
  content: 'Page Break';
  position: absolute;
  top: -0.75rem;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  padding: 0 0.5rem;
  font-size: 0.75rem;
  color: #9ca3af;
}

@media print {
  .page-break {
    border: none;
    margin: 0;
  }
  .page-break::after {
    display: none;
  }
}
```

**Backend Update:**
```rust
// services/signapps-office/src/converter/tiptap.rs
"pageBreak" => {
    html.push_str("<div data-page-break class=\"page-break\"></div>");
}

// services/signapps-office/src/converter/docx.rs
"div" if elem.value().attr("data-page-break").is_some() => {
    // Insert page break
    let para = Paragraph::new().add_run(
        Run::new().add_break(BreakType::Page)
    );
    *docx = std::mem::take(docx).add_paragraph(para);
}
```

---

### 3.4 Background Color Extension (Custom)

**File:** `client/src/components/docs/extensions/background-color.ts`

```typescript
import { Extension } from '@tiptap/core'
import '@tiptap/extension-text-style'

export type BackgroundColorOptions = {
  types: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    backgroundColor: {
      setBackgroundColor: (color: string) => ReturnType
      unsetBackgroundColor: () => ReturnType
    }
  }
}

export const BackgroundColor = Extension.create<BackgroundColorOptions>({
  name: 'backgroundColor',

  addOptions() {
    return {
      types: ['textStyle'],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          backgroundColor: {
            default: null,
            parseHTML: element => element.style.backgroundColor,
            renderHTML: attributes => {
              if (!attributes.backgroundColor) return {}
              return { style: `background-color: ${attributes.backgroundColor}` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setBackgroundColor: (color: string) => ({ chain }) => {
        return chain().setMark('textStyle', { backgroundColor: color }).run()
      },
      unsetBackgroundColor: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { backgroundColor: null })
          .removeEmptyTextStyle()
          .run()
      },
    }
  },
})
```

**Backend Update:**
```rust
// services/signapps-office/src/converter/tiptap.rs
"textStyle" => {
    let mut style = String::new();
    if let Some(attrs) = &mark.attrs {
        // Existing color, fontFamily, fontSize handling...

        // Add background color
        if let Some(bg_color) = attrs.get("backgroundColor").and_then(|c| c.as_str()) {
            style.push_str(&format!("background-color: {};", bg_color));
        }
    }
    // ...
}

// services/signapps-office/src/converter/docx.rs
fn process_inline_element(...) {
    // Check for background color in style
    if let Some(style) = elem.value().attr("style") {
        if let Some(bg_color) = extract_background_color_from_style(style) {
            run = run.highlight(&bg_color);
        }
    }
}
```

---

## Sprint 4: Advanced Content

**Effort:** ~2-3 days | **Impact:** Academic/professional features

### 4.1 Mathematics Extension

**Package:** `@tiptap/extension-mathematics`
**Dependencies:** `katex`
**License:** MIT

```typescript
import Mathematics from '@tiptap/extension-mathematics'
import 'katex/dist/katex.min.css'

Mathematics.configure({
  katexOptions: {
    throwOnError: false,
    strict: false,
  },
}),
```

**Usage:** Type `$` to start inline math, `$$` for block math.

**Backend Update:**
```rust
// services/signapps-office/src/converter/tiptap.rs
"mathematics" => {
    let latex = node.attrs.as_ref()
        .and_then(|a| a.get("latex"))
        .and_then(|l| l.as_str())
        .unwrap_or("");

    // For HTML: render with KaTeX span
    html.push_str(&format!(
        "<span class=\"math-tex\" data-latex=\"{}\">{}</span>",
        escape_html(latex),
        escape_html(latex) // Fallback text
    ));
}

// services/signapps-office/src/converter/docx.rs
// For DOCX: convert LaTeX to OMML (Office Math Markup Language)
// This requires a separate crate or manual OMML generation
```

**Note:** Full DOCX math support requires OMML conversion. Consider using a LaTeX-to-OMML library or including math as images.

---

### 4.2 Details Extension (Collapsible)

**Packages:**
- `@tiptap/extension-details`
- `@tiptap/extension-details-content`
- `@tiptap/extension-details-summary`

```typescript
import Details from '@tiptap/extension-details'
import DetailsContent from '@tiptap/extension-details-content'
import DetailsSummary from '@tiptap/extension-details-summary'

// Add all three:
Details,
DetailsContent,
DetailsSummary,
```

**CSS:**
```css
details {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  margin: 1rem 0;
}
details > summary {
  cursor: pointer;
  font-weight: 600;
  margin: -0.5rem -1rem;
  padding: 0.5rem 1rem;
  background: #f9fafb;
  border-radius: 0.5rem 0.5rem 0 0;
}
details[open] > summary {
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 0.5rem;
}
```

**Backend:**
```rust
// services/signapps-office/src/converter/tiptap.rs
"details" => {
    html.push_str("<details>");
    html.push_str(&children_to_html(node)?);
    html.push_str("</details>");
}
"detailsSummary" => {
    html.push_str("<summary>");
    html.push_str(&children_to_html(node)?);
    html.push_str("</summary>");
}
"detailsContent" => {
    html.push_str(&children_to_html(node)?);
}

// For DOCX: render as styled section (no collapse)
```

---

### 4.3 Table of Contents Extension (Custom)

**File:** `client/src/components/docs/extensions/table-of-contents.ts`

```typescript
import { Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export interface TocItem {
  id: string
  level: number
  text: string
}

export const TableOfContents = Node.create({
  name: 'tableOfContents',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      items: {
        default: [],
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-toc]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-toc': '' })]
  },

  addNodeView() {
    return ({ node, editor }) => {
      const dom = document.createElement('div')
      dom.className = 'table-of-contents'

      const updateToc = () => {
        const headings: TocItem[] = []
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === 'heading') {
            headings.push({
              id: node.attrs.id || `heading-${pos}`,
              level: node.attrs.level,
              text: node.textContent,
            })
          }
        })

        dom.innerHTML = `
          <nav class="toc-nav">
            <h3>Table of Contents</h3>
            <ul>
              ${headings.map(h => `
                <li class="toc-level-${h.level}">
                  <a href="#${h.id}">${h.text}</a>
                </li>
              `).join('')}
            </ul>
          </nav>
        `
      }

      updateToc()
      editor.on('update', updateToc)

      return {
        dom,
        destroy() {
          editor.off('update', updateToc)
        },
      }
    }
  },

  addCommands() {
    return {
      insertTableOfContents: () => ({ commands }) => {
        return commands.insertContent({ type: this.name })
      },
    }
  },
})
```

**Backend:**
```rust
// services/signapps-office/src/converter/docx.rs
// Generate actual TOC field in DOCX
fn insert_table_of_contents(docx: &mut Docx) {
    // DOCX TOC uses field codes
    let toc_para = Paragraph::new()
        .add_run(Run::new().add_text("Table of Contents"))
        .bold();
    *docx = std::mem::take(docx).add_paragraph(toc_para);

    // Add TOC field: { TOC \o "1-3" \h \z \u }
    // This requires complex field handling in docx-rs
}
```

---

### 4.4 Footnote Extension (Custom)

**File:** `client/src/components/docs/extensions/footnote.ts`

```typescript
import { Node, mergeAttributes } from '@tiptap/core'

export const Footnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      number: { default: 1 },
      content: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'sup[data-footnote]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'sup',
      mergeAttributes(HTMLAttributes, {
        'data-footnote': '',
        'data-content': node.attrs.content,
        class: 'footnote-ref',
      }),
      `[${node.attrs.number}]`,
    ]
  },

  addCommands() {
    return {
      insertFootnote: (content: string) => ({ commands, state }) => {
        // Count existing footnotes
        let count = 0
        state.doc.descendants(node => {
          if (node.type.name === 'footnote') count++
        })

        return commands.insertContent({
          type: this.name,
          attrs: { number: count + 1, content },
        })
      },
    }
  },
})
```

**CSS:**
```css
.footnote-ref {
  color: #3b82f6;
  cursor: pointer;
  font-size: 0.75em;
  vertical-align: super;
}
.footnote-ref:hover {
  text-decoration: underline;
}
```

**Backend:**
```rust
// services/signapps-office/src/converter/docx.rs
// DOCX footnotes require w:footnote elements
// This is complex and requires proper OOXML structure
```

---

### 4.5 Emoji Extension

**Package:** `@tiptap/extension-emoji`
**License:** MIT

```typescript
import Emoji from '@tiptap/extension-emoji'

Emoji.configure({
  enableEmoticons: true, // Convert :) to emoji
}),
```

**Backend:** Emojis are UTF-8 text, no special handling needed.

---

## Sprint 5: Export Fidelity

**Effort:** ~3-4 days | **Impact:** Critical for professional use

### 5.1 Comments → DOCX Export

**File:** `services/signapps-office/src/converter/comments.rs`

```rust
use docx_rs::*;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct DocComment {
    pub id: String,
    pub author: String,
    pub date: String,
    pub content: String,
    pub range_start: usize,
    pub range_end: usize,
    pub replies: Vec<DocComment>,
}

/// Extract comments from Tiptap JSON and prepare for DOCX
pub fn extract_comments_for_docx(json: &serde_json::Value) -> Vec<DocComment> {
    let mut comments = Vec::new();

    // Traverse document looking for comment marks
    if let Some(content) = json.get("content").and_then(|c| c.as_array()) {
        for node in content {
            extract_comments_from_node(node, &mut comments);
        }
    }

    comments
}

fn extract_comments_from_node(node: &serde_json::Value, comments: &mut Vec<DocComment>) {
    // Look for marks with type "comment"
    if let Some(marks) = node.get("marks").and_then(|m| m.as_array()) {
        for mark in marks {
            if mark.get("type").and_then(|t| t.as_str()) == Some("comment") {
                if let Some(attrs) = mark.get("attrs") {
                    comments.push(DocComment {
                        id: attrs.get("commentId").and_then(|i| i.as_str()).unwrap_or("").to_string(),
                        author: attrs.get("author").and_then(|a| a.as_str()).unwrap_or("Unknown").to_string(),
                        date: attrs.get("createdAt").and_then(|d| d.as_str()).unwrap_or("").to_string(),
                        content: attrs.get("content").and_then(|c| c.as_str()).unwrap_or("").to_string(),
                        range_start: 0,
                        range_end: 0,
                        replies: Vec::new(),
                    });
                }
            }
        }
    }

    // Recurse into children
    if let Some(content) = node.get("content").and_then(|c| c.as_array()) {
        for child in content {
            extract_comments_from_node(child, comments);
        }
    }
}

/// Add comments to DOCX document
pub fn add_comments_to_docx(docx: Docx, comments: &[DocComment]) -> Docx {
    let mut result = docx;

    for (i, comment) in comments.iter().enumerate() {
        let doc_comment = Comment::new((i + 1) as usize)
            .author(&comment.author)
            .date(&comment.date)
            .add_paragraph(
                Paragraph::new().add_run(Run::new().add_text(&comment.content))
            );

        result = result.add_comment(doc_comment);
    }

    result
}
```

---

### 5.2 Track Changes → DOCX Export

**File:** `services/signapps-office/src/converter/track_changes.rs`

```rust
use docx_rs::*;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct TrackedChange {
    pub change_type: ChangeType,
    pub author: String,
    pub date: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub enum ChangeType {
    Insertion,
    Deletion,
}

/// Convert tracked change marks to DOCX revision marks
pub fn apply_track_changes_to_run(run: Run, change: &TrackedChange, change_id: usize) -> Run {
    match change.change_type {
        ChangeType::Insertion => {
            // Wrap in w:ins element
            run.insert(
                Insert::new(change_id)
                    .author(&change.author)
                    .date(&change.date)
            )
        }
        ChangeType::Deletion => {
            // Wrap in w:del element
            run.delete(
                Delete::new(change_id)
                    .author(&change.author)
                    .date(&change.date)
            )
        }
    }
}
```

---

### 5.3 Images → DOCX (Embedded)

**File:** `services/signapps-office/src/converter/docx.rs` (update)

```rust
use base64::{Engine as _, engine::general_purpose::STANDARD};

fn process_image_element(docx: &mut Docx, elem: &scraper::ElementRef) -> Result<(), ConversionError> {
    let src = elem.value().attr("src").unwrap_or("");
    let alt = elem.value().attr("alt").unwrap_or("Image");

    // Check if base64 data URL
    if let Some(data) = src.strip_prefix("data:image/") {
        // Parse format and data
        if let Some((format, base64_data)) = data.split_once(";base64,") {
            let image_bytes = STANDARD.decode(base64_data)
                .map_err(|e| ConversionError::InvalidInput(format!("Invalid base64: {}", e)))?;

            // Determine image type
            let pic_type = match format {
                "png" => docx_rs::PicType::Png,
                "jpeg" | "jpg" => docx_rs::PicType::Jpeg,
                "gif" => docx_rs::PicType::Gif,
                _ => docx_rs::PicType::Png,
            };

            // Create picture with embedded image
            let pic = Pic::new(&image_bytes)
                .pic_type(pic_type)
                .size(400 * 9525, 300 * 9525); // EMUs (914400 EMU = 1 inch)

            let para = Paragraph::new().add_run(Run::new().add_drawing(pic));
            *docx = std::mem::take(docx).add_paragraph(para);

            return Ok(());
        }
    }

    // Fallback: placeholder text
    let para = Paragraph::new().add_run(Run::new().add_text(format!("[{}]", alt)));
    *docx = std::mem::take(docx).add_paragraph(para);

    Ok(())
}
```

---

## Sprint 6: Media & Advanced

**Effort:** ~2-3 days | **Impact:** Feature completeness

### 6.1 YouTube Extension

**Package:** `@tiptap/extension-youtube`
**License:** MIT

```typescript
import Youtube from '@tiptap/extension-youtube'

Youtube.configure({
  controls: true,
  nocookie: true, // Privacy-enhanced mode
  allowFullscreen: true,
  width: 640,
  height: 360,
}),
```

**Commands:**
```typescript
editor.commands.setYoutubeVideo({
  src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
})
```

**Backend:** Export as link with thumbnail placeholder.

---

### 6.2 Find & Replace (Custom)

**File:** `client/src/components/docs/find-replace-dialog.tsx`

```typescript
'use client'

import { useState, useCallback, useEffect } from 'react'
import { Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'

interface FindReplaceDialogProps {
  editor: Editor
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FindReplaceDialog({ editor, open, onOpenChange }: FindReplaceDialogProps) {
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [matchCount, setMatchCount] = useState(0)
  const [currentMatch, setCurrentMatch] = useState(0)

  const findMatches = useCallback(() => {
    if (!findText) {
      setMatchCount(0)
      return []
    }

    const text = editor.state.doc.textContent
    const regex = new RegExp(
      findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      caseSensitive ? 'g' : 'gi'
    )
    const matches = [...text.matchAll(regex)]
    setMatchCount(matches.length)
    return matches
  }, [editor, findText, caseSensitive])

  const findNext = useCallback(() => {
    const matches = findMatches()
    if (matches.length === 0) return

    const nextIndex = (currentMatch + 1) % matches.length
    setCurrentMatch(nextIndex)

    // Scroll to and select match
    const match = matches[nextIndex]
    // Implementation depends on document structure
  }, [findMatches, currentMatch])

  const replaceOne = useCallback(() => {
    if (!findText) return

    editor.chain()
      .focus()
      .insertContent(replaceText)
      .run()

    findNext()
  }, [editor, findText, replaceText, findNext])

  const replaceAll = useCallback(() => {
    if (!findText) return

    const regex = new RegExp(
      findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      caseSensitive ? 'g' : 'gi'
    )

    // Get full document text, replace, and set
    const content = editor.getHTML()
    const newContent = content.replace(regex, replaceText)
    editor.commands.setContent(newContent)

    setMatchCount(0)
    setCurrentMatch(0)
  }, [editor, findText, replaceText, caseSensitive])

  useEffect(() => {
    findMatches()
  }, [findMatches])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Find and Replace</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="Find..."
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && findNext()}
            />
            <div className="text-sm text-muted-foreground">
              {matchCount > 0 ? `${currentMatch + 1} of ${matchCount} matches` : 'No matches'}
            </div>
          </div>

          <Input
            placeholder="Replace with..."
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
          />

          <div className="flex items-center space-x-2">
            <Checkbox
              id="case-sensitive"
              checked={caseSensitive}
              onCheckedChange={(checked) => setCaseSensitive(!!checked)}
            />
            <label htmlFor="case-sensitive" className="text-sm">
              Case sensitive
            </label>
          </div>

          <div className="flex space-x-2">
            <Button variant="outline" onClick={findNext}>
              Find Next
            </Button>
            <Button variant="outline" onClick={replaceOne}>
              Replace
            </Button>
            <Button onClick={replaceAll}>
              Replace All
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Keyboard Shortcut:**
```typescript
// Add to editor keyboard shortcuts
'Mod-f': () => setFindReplaceOpen(true),
'Mod-h': () => setFindReplaceOpen(true), // Replace
```

---

## Package Dependencies

Add to `client/package.json`:

```json
{
  "dependencies": {
    "@tiptap/extension-typography": "^3.20.1",
    "@tiptap/extension-dropcursor": "^3.20.1",
    "@tiptap/extension-gapcursor": "^3.20.1",
    "@tiptap/extension-trailing-node": "^3.20.1",
    "@tiptap/extension-focus": "^3.20.1",
    "@tiptap/extension-collaboration-cursor": "^3.20.1",
    "@tiptap/extension-drag-handle-react": "^3.20.1",
    "@tiptap/extension-unique-id": "^3.20.1",
    "@tiptap/extension-file-handler": "^3.20.1",
    "@tiptap/extension-mathematics": "^3.20.1",
    "@tiptap/extension-details": "^3.20.1",
    "@tiptap/extension-details-content": "^3.20.1",
    "@tiptap/extension-details-summary": "^3.20.1",
    "@tiptap/extension-emoji": "^3.20.1",
    "@tiptap/extension-youtube": "^3.20.1",
    "katex": "^0.16.9"
  }
}
```

---

## Editor Configuration

**File:** `client/src/components/docs/editor-extensions.ts`

```typescript
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Collaboration from '@tiptap/extension-collaboration'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { TextStyle } from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import CharacterCount from '@tiptap/extension-character-count'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'

// Sprint 1: Foundation
import Typography from '@tiptap/extension-typography'
import Dropcursor from '@tiptap/extension-dropcursor'
import Gapcursor from '@tiptap/extension-gapcursor'
import TrailingNode from '@tiptap/extension-trailing-node'
import Focus from '@tiptap/extension-focus'

// Sprint 2: Collaboration
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import UniqueID from '@tiptap/extension-unique-id'
import FileHandler from '@tiptap/extension-file-handler'

// Sprint 4: Advanced
import Mathematics from '@tiptap/extension-mathematics'
import Details from '@tiptap/extension-details'
import DetailsContent from '@tiptap/extension-details-content'
import DetailsSummary from '@tiptap/extension-details-summary'
import Emoji from '@tiptap/extension-emoji'
import Youtube from '@tiptap/extension-youtube'

// Custom extensions
import { FontSize } from './extensions/font-size'
import { Comment } from './extensions/comment'
import { TrackChanges } from './extensions/track-changes'
import { Mention } from './extensions/mention'
import { LineHeight } from './extensions/line-height'
import { Indent } from './extensions/indent'
import { PageBreak } from './extensions/page-break'
import { BackgroundColor } from './extensions/background-color'
import { TableOfContents } from './extensions/table-of-contents'
import { Footnote } from './extensions/footnote'

export function createEditorExtensions(options: {
  ydoc?: Y.Doc
  provider?: WebsocketProvider
  user?: { name: string; color: string }
  placeholder?: string
}) {
  const extensions = [
    // Core
    StarterKit.configure({
      codeBlock: false, // Using CodeBlockLowlight instead
    }),

    // Sprint 1: Foundation Polish
    Typography.configure({
      openDoubleQuote: '«',
      closeDoubleQuote: '»',
    }),
    Dropcursor.configure({ color: '#3b82f6', width: 2 }),
    Gapcursor,
    TrailingNode.configure({ node: 'paragraph' }),
    Focus.configure({ className: 'has-focus', mode: 'all' }),

    // Formatting
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Subscript,
    Superscript,
    TextStyle,
    FontFamily,
    FontSize,
    Color,
    Highlight.configure({ multicolor: true }),
    BackgroundColor,
    LineHeight,
    Indent,

    // Structure
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Image.configure({ allowBase64: true }),
    Link.configure({ openOnClick: false }),
    CodeBlockLowlight,
    PageBreak,
    Details,
    DetailsContent,
    DetailsSummary,

    // Advanced Content
    Mathematics,
    Emoji.configure({ enableEmoticons: true }),
    Youtube.configure({ controls: true, nocookie: true }),
    TableOfContents,
    Footnote,

    // Sprint 2: Collaboration
    UniqueID.configure({
      types: ['heading', 'paragraph', 'listItem', 'taskItem', 'table', 'image'],
    }),
    FileHandler.configure({
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
      onDrop: (editor, files) => {
        files.forEach(file => {
          const reader = new FileReader()
          reader.onload = () => {
            editor.chain().focus().setImage({ src: reader.result as string }).run()
          }
          reader.readAsDataURL(file)
        })
      },
    }),

    // Custom features
    Comment,
    TrackChanges,
    Mention,

    // Utilities
    Placeholder.configure({ placeholder: options.placeholder || 'Start writing...' }),
    CharacterCount,
  ]

  // Add collaboration if provider available
  if (options.ydoc && options.provider) {
    extensions.push(
      Collaboration.configure({ document: options.ydoc }),
      CollaborationCursor.configure({
        provider: options.provider,
        user: options.user,
      })
    )
  }

  return extensions
}
```

---

## Summary

| Sprint | Extensions | Effort | Status |
|--------|------------|--------|--------|
| 1 | Typography, Dropcursor, Gapcursor, TrailingNode, Focus | 2 hours | Ready |
| 2 | CollaborationCursor, DragHandle, UniqueID, FileHandler | 1 day | Ready |
| 3 | LineHeight, Indent, PageBreak, BackgroundColor | 2 days | Custom needed |
| 4 | Mathematics, Details, TOC, Footnote, Emoji | 2-3 days | Mixed |
| 5 | Comments→DOCX, TrackChanges→DOCX, Images→DOCX | 3-4 days | Backend |
| 6 | YouTube, FindReplace, Audio | 2 days | Ready |

**Total: 42 extensions, ~10-12 days implementation**
