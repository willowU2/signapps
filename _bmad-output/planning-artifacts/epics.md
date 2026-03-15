---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments: ['prd.md']
validationStatus: 'passed'
totalEpics: 9
totalStories: 60
frCoverage: '100%'
---

# SignApps Office Suite - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for SignApps Office Suite, decomposing the requirements from the PRD into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Users can create rich text documents with formatting (bold, italic, underline, strikethrough)
FR2: Users can set font family from a predefined list of web-safe fonts
FR3: Users can set font size using preset values or custom input
FR4: Users can apply text colors and background highlights
FR5: Users can create and edit tables with rows and columns
FR6: Users can insert and resize images within documents
FR7: Users can create task lists with checkable items
FR8: Users can insert code blocks with syntax highlighting
FR9: Users can view real-time character and word count
FR10: Users can input and output content as Markdown
FR11: Users can undo/redo editing actions
FR12: Users can add inline comments to selected text
FR13: Users can reply to existing comments creating threads
FR14: Users can resolve/close comment threads
FR15: Users can see comments from collaborators in real-time
FR16: Users can mention other users (@username) in comments
FR17: System exports comments to DOCX comment format
FR18: Users can enable/disable Track Changes mode
FR19: System visually indicates inserted text (additions)
FR20: System visually indicates deleted text (strikethrough)
FR21: Users can accept individual changes
FR22: Users can reject individual changes
FR23: Users can accept/reject all changes at once
FR24: System preserves change author and timestamp
FR25: Users can export documents to DOCX format
FR26: Users can export documents to PDF format
FR27: Users can export documents to Markdown format
FR28: Users can export documents to HTML format
FR29: Users can export documents to plain text
FR30: Users can import DOCX files into the editor
FR31: Users can import Markdown files into the editor
FR32: Users can import HTML content into the editor
FR33: System auto-detects file format on import
FR34: Users can import XLSX files into Sheets
FR35: Users can import XLS (legacy Excel) files
FR36: Users can import CSV/TSV files
FR37: Users can import ODS (OpenDocument) files
FR38: Users can export spreadsheets to XLSX format
FR39: Users can export spreadsheets to CSV format
FR40: Users can export spreadsheets to ODS format
FR41: System preserves basic formulas on import/export
FR42: System preserves cell formatting (fonts, colors, borders)
FR43: Users can work with multiple sheets within a workbook
FR44: Users can export slides to PPTX format
FR45: Users can export individual slides to PNG
FR46: Users can export individual slides to SVG
FR47: Users can export all slides to PDF
FR48: Users can add speaker notes to slides
FR49: Users can apply master slide templates
FR50: Users can set slide themes with color schemes
FR51: Users can view PDF files in the browser
FR52: Users can extract text content from PDFs
FR53: Users can merge multiple PDF files
FR54: Users can split PDF into separate pages
FR55: Users can generate PDFs from any document type
FR56: System generates PDF thumbnails for preview
FR57: Multiple users can edit the same document simultaneously
FR58: Users can see other collaborators' cursors in real-time
FR59: Users can see presence indicators (who is viewing)
FR60: System automatically syncs changes without manual save
FR61: Users can work offline and sync when reconnected
FR62: System handles conflict resolution automatically (CRDT)
FR63: System provides API endpoint for format conversion
FR64: System supports batch conversion of multiple files
FR65: System provides progress indication for long conversions
FR66: System allows cancellation of in-progress conversions
FR67: System caches frequent conversions for performance
FR68: System streams large file responses

### NonFunctional Requirements

NFR1: Document export completes within 2 seconds for documents up to 50 pages
NFR2: Spreadsheet import processes 10,000 rows within 3 seconds
NFR3: PDF generation completes within 5 seconds for 100-page documents
NFR4: Real-time collaboration latency remains under 100ms
NFR5: Editor input latency remains under 16ms (60fps)
NFR6: Conversion API handles 50 concurrent requests
NFR7: Memory usage stays under 500MB per conversion worker
NFR8: System supports 100 concurrent document editors
NFR9: System supports 1000 simultaneous collaboration sessions
NFR10: Conversion queue handles burst of 500 requests
NFR11: System scales horizontally for conversion workers
NFR12: Database handles 10,000 documents without degradation
NFR13: All document data encrypted at rest (AES-256)
NFR14: All API communication over TLS 1.3
NFR15: JWT tokens expire within 1 hour
NFR16: Uploaded files scanned for malware signatures
NFR17: Conversion sandbox prevents code execution
NFR18: No PII logged in application logs
NFR19: Service availability target of 99.9%
NFR20: Automatic recovery from worker process crashes
NFR21: Document autosave every 30 seconds
NFR22: Export operations are idempotent
NFR23: Failed conversions provide actionable error messages
NFR24: DOCX exports open correctly in Microsoft Word 2016+
NFR25: XLSX exports open correctly in Microsoft Excel 2016+
NFR26: PDF exports comply with PDF 1.7 specification
NFR27: Editor supports Chrome, Firefox, Safari, Edge (latest 2 versions)
NFR28: Keyboard shortcuts match standard Office conventions
NFR29: Editor meets WCAG 2.1 AA compliance
NFR30: All interactive elements keyboard accessible
NFR31: Screen reader compatible with proper ARIA labels
NFR32: Color contrast ratio minimum 4.5:1

### Additional Requirements

From Architecture/PRD:
- New Rust service: signapps-office on port 3010
- REST API pattern: /api/v1/*
- Authentication via JWT from signapps-identity
- Storage integration with signapps-storage (OpenDAL)
- PostgreSQL for metadata persistence
- Libraries locked: docx-rust, rust_xlsxwriter, calamine, krilla, pdf_oxide, shiva, comrak, rbook, yrs
- Frontend: Tiptap v3, Yjs, Fabric.js, pptxgenjs
- Tiptap v2 → v3 migration required with specific breaking changes handling
- Comments system based on forked tiptap-comment-extension
- Track Changes as custom Tiptap marks
- No Docker - native execution only
- License constraint: Apache 2.0 / MIT only

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 1 | Rich text formatting |
| FR2 | Epic 1 | Font family selection |
| FR3 | Epic 1 | Font size control |
| FR4 | Epic 1 | Text colors and highlights |
| FR5 | Epic 1 | Table creation and editing |
| FR6 | Epic 1 | Image insertion and resizing |
| FR7 | Epic 1 | Task lists with checkboxes |
| FR8 | Epic 1 | Code blocks with syntax highlighting |
| FR9 | Epic 1 | Character and word count |
| FR10 | Epic 1 | Markdown input/output |
| FR11 | Epic 1 | Undo/redo actions |
| FR12 | Epic 4 | Inline comments |
| FR13 | Epic 4 | Comment replies/threads |
| FR14 | Epic 4 | Resolve/close comments |
| FR15 | Epic 4 | Real-time comment sync |
| FR16 | Epic 4 | User mentions in comments |
| FR17 | Epic 4 | DOCX comment export |
| FR18 | Epic 5 | Track Changes mode toggle |
| FR19 | Epic 5 | Visual insert indicators |
| FR20 | Epic 5 | Visual delete indicators |
| FR21 | Epic 5 | Accept individual changes |
| FR22 | Epic 5 | Reject individual changes |
| FR23 | Epic 5 | Accept/reject all changes |
| FR24 | Epic 5 | Change author/timestamp |
| FR25 | Epic 2 | DOCX export |
| FR26 | Epic 2 | PDF export |
| FR27 | Epic 2 | Markdown export |
| FR28 | Epic 2 | HTML export |
| FR29 | Epic 2 | Plain text export |
| FR30 | Epic 3 | DOCX import |
| FR31 | Epic 3 | Markdown import |
| FR32 | Epic 3 | HTML import |
| FR33 | Epic 3 | Format auto-detection |
| FR34 | Epic 6 | XLSX import |
| FR35 | Epic 6 | XLS import |
| FR36 | Epic 6 | CSV/TSV import |
| FR37 | Epic 6 | ODS import |
| FR38 | Epic 6 | XLSX export |
| FR39 | Epic 6 | CSV export |
| FR40 | Epic 6 | ODS export |
| FR41 | Epic 6 | Formula preservation |
| FR42 | Epic 6 | Cell formatting preservation |
| FR43 | Epic 6 | Multi-sheet workbooks |
| FR44 | Epic 7 | PPTX export |
| FR45 | Epic 7 | PNG slide export |
| FR46 | Epic 7 | SVG slide export |
| FR47 | Epic 7 | PDF slides export |
| FR48 | Epic 7 | Speaker notes |
| FR49 | Epic 7 | Master slide templates |
| FR50 | Epic 7 | Slide themes |
| FR51 | Epic 8 | PDF viewer |
| FR52 | Epic 8 | PDF text extraction |
| FR53 | Epic 8 | PDF merge |
| FR54 | Epic 8 | PDF split |
| FR55 | Epic 8 | PDF generation from documents |
| FR56 | Epic 8 | PDF thumbnails |
| FR57 | Epic 9 | Simultaneous multi-user editing |
| FR58 | Epic 9 | Real-time cursor visibility |
| FR59 | Epic 9 | Presence indicators |
| FR60 | Epic 9 | Automatic sync |
| FR61 | Epic 9 | Offline support with sync |
| FR62 | Epic 9 | CRDT conflict resolution |
| FR63 | Epic 2 | Conversion API endpoint |
| FR64 | Epic 2 | Batch conversion |
| FR65 | Epic 2 | Conversion progress |
| FR66 | Epic 2 | Conversion cancellation |
| FR67 | Epic 2 | Conversion caching |
| FR68 | Epic 2 | Large file streaming |

## Epic List Summary

| Epic | Title | Stories | FRs |
|------|-------|---------|-----|
| 1 | Foundation & Tiptap v3 Migration | 10 | FR1-FR11 |
| 2 | Document Export Backend | 8 | FR25-FR29, FR63-FR68 |
| 3 | Document Import Backend | 4 | FR30-FR33 |
| 4 | Comments System | 7 | FR12-FR17 |
| 5 | Track Changes System | 7 | FR18-FR24 |
| 6 | Spreadsheet Import/Export | 6 | FR34-FR43 |
| 7 | Slides Export Enhancement | 6 | FR44-FR50 |
| 8 | PDF Operations | 6 | FR51-FR56 |
| 9 | Real-time Collaboration Enhancement | 6 | FR57-FR62 |

**Total: 9 Epics, 60 Stories**

---

## Epic 1: Foundation & Tiptap v3 Migration

Enable users to create and edit rich documents with modern formatting controls, migrating from Tiptap v2 to v3 with TextStyleKit integration.

**User Outcome:** Users can create professional documents with fonts, sizes, colors, tables, images, code blocks, and task lists in a modern editor.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11

### Story 1.1: Migrate Tiptap v2 to v3 Core

As a developer,
I want to migrate the editor core from Tiptap v2 to v3,
So that users benefit from improved performance and modern extension APIs.

**Acceptance Criteria:**

**Given** the current Tiptap v2 editor implementation
**When** I install Tiptap v3 packages and update imports
**Then** the editor loads without errors
**And** existing documents render correctly
**And** SSR works with immediatelyRender: false
**And** BubbleMenu and FloatingMenu import from @tiptap/react/menus

---

### Story 1.2: Integrate TextStyleKit for Font Control

As a document author,
I want to select font families and sizes for my text,
So that I can create professionally styled documents.

**Acceptance Criteria:**

**Given** the Tiptap v3 editor is active
**When** I select text and choose a font family from the toolbar
**Then** the selected text displays in the chosen font
**And** available fonts include Arial, Times New Roman, Georgia, Verdana, Courier New
**When** I choose a font size from 8pt to 72pt
**Then** the text renders at the specified size
**And** font settings persist when saving and reopening the document

---

### Story 1.3: Implement Text Color and Highlight Controls

As a document author,
I want to apply text colors and background highlights,
So that I can emphasize important content visually.

**Acceptance Criteria:**

**Given** text is selected in the editor
**When** I open the color picker and select a text color
**Then** the selected text displays in the chosen color
**When** I select a highlight/background color
**Then** the text background changes to the chosen color
**And** colors are preserved in document JSON
**And** exported documents maintain color formatting

---

### Story 1.4: Add CharacterCount Extension

As a document author,
I want to see real-time character and word counts,
So that I can track document length for requirements.

**Acceptance Criteria:**

**Given** a document is open in the editor
**When** I type or edit content
**Then** the character count updates in real-time in the status bar
**And** the word count updates in real-time
**When** I select a portion of text
**Then** I see count for selection vs total
**And** performance remains under 16ms for updates (60fps)

---

### Story 1.5: Enable Native Markdown Input/Output

As a technical writer,
I want to type Markdown syntax and see it converted instantly,
So that I can use familiar shortcuts for formatting.

**Acceptance Criteria:**

**Given** the editor is in Markdown-enabled mode
**When** I type "# Heading" and press space
**Then** the text converts to a heading format
**When** I type **bold** or _italic_ patterns
**Then** they convert to rich formatting
**When** I export as Markdown
**Then** the output is valid CommonMark with GFM extensions
**And** code blocks preserve language identifiers

---

### Story 1.6: Table Creation and Editing

As a document author,
I want to create and edit tables with rows and columns,
So that I can organize data in structured layouts.

**Acceptance Criteria:**

**Given** the cursor is in the editor
**When** I click the table insert button
**Then** a table with configurable rows/columns is inserted
**When** I click in a cell
**Then** I can type and format content
**When** I right-click a cell
**Then** I can add/remove rows and columns
**And** tables support cell merging
**And** tables export correctly to DOCX and HTML

---

### Story 1.7: Image Insertion and Resizing

As a document author,
I want to insert and resize images in my document,
So that I can include visual content.

**Acceptance Criteria:**

**Given** the editor is active
**When** I upload an image or paste from clipboard
**Then** the image is inserted at cursor position
**When** I click on an image
**Then** resize handles appear
**When** I drag a resize handle
**Then** the image scales proportionally
**And** images are stored in signapps-storage
**And** images export with documents

---

### Story 1.8: Task Lists with Checkboxes

As a project manager,
I want to create task lists with checkable items,
So that I can track action items within documents.

**Acceptance Criteria:**

**Given** the editor is active
**When** I click the task list button
**Then** a checkbox list item is created
**When** I click a checkbox
**Then** it toggles between checked and unchecked
**And** checked items display with strikethrough text
**And** task state persists on save
**And** tasks export to DOCX as checkbox content controls

---

### Story 1.9: Code Blocks with Syntax Highlighting

As a technical writer,
I want to insert code blocks with syntax highlighting,
So that code samples are readable and professional.

**Acceptance Criteria:**

**Given** I want to insert code
**When** I type ``` and specify a language
**Then** a code block is created with that language mode
**When** I paste or type code
**Then** syntax highlighting applies automatically
**And** supported languages include JavaScript, TypeScript, Python, Rust, SQL, JSON, YAML
**And** code blocks export with formatting to HTML and Markdown

---

### Story 1.10: Undo/Redo with Keyboard Shortcuts

As a document author,
I want to undo and redo my changes,
So that I can recover from mistakes easily.

**Acceptance Criteria:**

**Given** I have made edits in the editor
**When** I press Ctrl+Z (Cmd+Z on Mac)
**Then** the last action is undone
**When** I press Ctrl+Y (Cmd+Shift+Z on Mac)
**Then** the undone action is restored
**And** undo/redo history supports at least 100 steps
**And** toolbar buttons reflect undo/redo availability

---

## Epic 2: Document Export Backend

Enable users to export documents to standard office formats through a new Rust backend service.

**User Outcome:** Users can export their documents to DOCX, PDF, Markdown, HTML, and plain text formats with high fidelity.

**FRs covered:** FR25, FR26, FR27, FR28, FR29, FR63, FR64, FR65, FR66, FR67, FR68

### Story 2.1: Create signapps-office Service Skeleton

As a system administrator,
I want the office service to be operational,
So that document conversion capabilities are available.

**Acceptance Criteria:**

**Given** the service code exists in services/signapps-office
**When** I run cargo run -p signapps-office
**Then** the service starts on port 3010
**And** GET /health returns 200 OK
**And** the service authenticates via JWT from signapps-identity
**And** Cargo.toml includes docx-rust, rust_xlsxwriter, calamine, krilla, pdf_oxide, shiva, comrak

---

### Story 2.2: Implement Conversion API Endpoint

As a frontend developer,
I want a unified conversion API,
So that I can convert documents between formats.

**Acceptance Criteria:**

**Given** the office service is running
**When** I POST to /api/v1/convert with source format, target format, and content
**Then** I receive the converted document
**And** response includes Content-Type header for the output format
**And** unsupported format combinations return 400 with clear error message
**And** input validation prevents malformed requests

---

### Story 2.3: DOCX Export from Tiptap JSON

As a document author,
I want to export my document as DOCX,
So that I can share it with Microsoft Word users.

**Acceptance Criteria:**

**Given** a Tiptap JSON document
**When** I POST to /api/v1/convert with target=docx
**Then** I receive a valid DOCX file
**And** text formatting (bold, italic, underline, fonts, sizes, colors) is preserved
**And** tables render correctly
**And** images are embedded
**And** the file opens without errors in Microsoft Word 2016+

---

### Story 2.4: PDF Export from Tiptap JSON

As a document author,
I want to export my document as PDF,
So that I can share a print-ready version.

**Acceptance Criteria:**

**Given** a Tiptap JSON document
**When** I POST to /api/v1/convert with target=pdf
**Then** I receive a valid PDF 1.7 compliant file
**And** text formatting is preserved
**And** images are embedded at original quality
**And** tables render with proper borders
**And** pagination is applied automatically
**And** export completes in <2s for 50 pages

---

### Story 2.5: Markdown and HTML Export

As a technical writer,
I want to export documents as Markdown or HTML,
So that I can use content in other systems.

**Acceptance Criteria:**

**Given** a Tiptap JSON document
**When** I export to Markdown format
**Then** I receive valid CommonMark with GFM tables and task lists
**When** I export to HTML format
**Then** I receive well-formed HTML5 with inline styles
**And** code blocks preserve language identifiers
**And** images reference valid URLs or are base64 embedded

---

### Story 2.6: Streaming Response for Large Files

As a user exporting large documents,
I want responsive feedback during export,
So that I know the process is working.

**Acceptance Criteria:**

**Given** a document larger than 5MB
**When** I request export
**Then** the response streams as it's generated
**And** Content-Length header is set when known
**And** client can display download progress
**And** memory usage stays under 500MB per worker
**And** FR68 is satisfied

---

### Story 2.7: Batch Conversion Endpoint

As a power user,
I want to convert multiple files at once,
So that I can process bulk documents efficiently.

**Acceptance Criteria:**

**Given** multiple source documents
**When** I POST to /api/v1/convert/batch with array of conversion requests
**Then** a batch job is created and job ID returned
**When** I GET /api/v1/convert/{jobId}/status
**Then** I see progress (X of Y completed)
**And** I can retrieve completed files individually
**And** failed conversions include error details

---

### Story 2.8: Conversion Cancellation and Caching

As a user managing conversions,
I want to cancel in-progress conversions and benefit from caching,
So that I have control and efficiency.

**Acceptance Criteria:**

**Given** a long-running conversion
**When** I DELETE /api/v1/convert/{id}
**Then** the conversion is cancelled
**And** partial resources are cleaned up
**Given** a previously completed conversion with same inputs
**When** I request the same conversion
**Then** the cached result is returned immediately
**And** cache respects TTL (1 hour default)

---

## Epic 3: Document Import Backend

Enable users to import existing office documents into the SignApps editor.

**User Outcome:** Users can import DOCX, Markdown, and HTML files preserving formatting and structure.

**FRs covered:** FR30, FR31, FR32, FR33

### Story 3.1: DOCX Import to Tiptap JSON

As a document author,
I want to import existing DOCX files,
So that I can edit them in SignApps.

**Acceptance Criteria:**

**Given** a DOCX file from Microsoft Word
**When** I upload it to /api/v1/import
**Then** I receive Tiptap-compatible JSON
**And** text formatting is preserved (bold, italic, fonts, colors)
**And** tables are converted to Tiptap table nodes
**And** images are extracted and stored
**And** import completes in <3s for 50 pages

---

### Story 3.2: Markdown Import to Tiptap JSON

As a technical writer,
I want to import Markdown files,
So that I can continue editing in the rich editor.

**Acceptance Criteria:**

**Given** a Markdown file (CommonMark or GFM)
**When** I upload it for import
**Then** headings, lists, code blocks, and formatting convert correctly
**And** tables (GFM) are parsed
**And** task lists convert to checkbox items
**And** code block language hints are preserved

---

### Story 3.3: HTML Import with Sanitization

As a user,
I want to import HTML content safely,
So that I can edit web content without security risks.

**Acceptance Criteria:**

**Given** HTML content
**When** I submit it for import
**Then** allowed tags convert to Tiptap nodes
**And** scripts and event handlers are stripped (XSS prevention)
**And** inline styles are converted to Tiptap marks
**And** malformed HTML is handled gracefully

---

### Story 3.4: Format Auto-Detection

As a user,
I want the system to detect file formats automatically,
So that I don't need to specify the format manually.

**Acceptance Criteria:**

**Given** an uploaded file without explicit format parameter
**When** the import endpoint receives it
**Then** format is detected by MIME type first
**And** magic bytes are used as fallback
**And** file extension is used as last resort
**And** unsupported formats return clear error message
**And** detection works for DOCX, MD, HTML, TXT

---

## Epic 4: Comments System

Enable users to add, reply to, and manage comments for document review and collaboration.

**User Outcome:** Users can add inline comments, create discussion threads, mention colleagues, and export comments to DOCX format.

**FRs covered:** FR12, FR13, FR14, FR15, FR16, FR17

### Story 4.1: Inline Comment Extension

As a document reviewer,
I want to add comments to selected text,
So that I can provide feedback without modifying content.

**Acceptance Criteria:**

**Given** text is selected in the editor
**When** I click the comment button or press Ctrl+Alt+M
**Then** a comment input appears
**When** I type and submit the comment
**Then** the selected text is highlighted
**And** a comment marker appears in the margin
**And** comment data includes author, timestamp, and selection range

---

### Story 4.2: Comment Threads and Replies

As a collaborator,
I want to reply to existing comments,
So that we can have discussions within the document.

**Acceptance Criteria:**

**Given** an existing comment
**When** I click reply
**Then** I can type a response
**When** I submit the reply
**Then** it appears nested under the original comment
**And** thread shows all replies in chronological order
**And** thread can have unlimited depth

---

### Story 4.3: Resolve and Reopen Comments

As a document owner,
I want to resolve comment threads,
So that I can track which feedback has been addressed.

**Acceptance Criteria:**

**Given** a comment thread
**When** I click resolve
**Then** the thread is marked as resolved
**And** the highlight styling changes (dimmed)
**When** I click reopen on a resolved thread
**Then** it becomes active again
**And** resolved comments can be filtered in the sidebar

---

### Story 4.4: Real-time Comment Synchronization

As a collaborator,
I want to see others' comments immediately,
So that we can collaborate effectively.

**Acceptance Criteria:**

**Given** multiple users viewing the same document
**When** one user adds a comment
**Then** all users see it within 100ms
**And** comment positions update as text changes
**And** concurrent edits don't corrupt comment data
**And** Yjs handles CRDT synchronization

---

### Story 4.5: User Mentions in Comments

As a reviewer,
I want to mention colleagues with @username,
So that they are notified of relevant comments.

**Acceptance Criteria:**

**Given** I'm typing a comment
**When** I type @ followed by letters
**Then** an autocomplete dropdown shows matching users
**When** I select a user
**Then** the mention is inserted as a styled link
**And** mentioned users receive notifications (via existing notification system)

---

### Story 4.6: Comments Sidebar UI

As a document reviewer,
I want a sidebar listing all comments,
So that I can navigate to them easily.

**Acceptance Criteria:**

**Given** a document with comments
**When** I open the comments sidebar
**Then** I see all comments listed with preview text
**When** I click a comment
**Then** the editor scrolls to that location
**And** I can filter by: All, Open, Resolved
**And** I can sort by: Date, Position

---

### Story 4.7: Export Comments to DOCX

As a document author,
I want comments included in DOCX exports,
So that Word users can see the review feedback.

**Acceptance Criteria:**

**Given** a document with comments
**When** I export to DOCX
**Then** comments appear in Word's comment panel
**And** comment author and date are preserved
**And** comment threads become Word comment replies
**And** resolved status is indicated

---

## Epic 5: Track Changes System

Enable users to track, review, and accept/reject document modifications.

**User Outcome:** Users can enable revision mode, see visual indicators for insertions/deletions, and accept or reject changes individually or in bulk.

**FRs covered:** FR18, FR19, FR20, FR21, FR22, FR23, FR24

### Story 5.1: Track Changes Mode Toggle

As a document author,
I want to enable Track Changes mode,
So that all edits are recorded for review.

**Acceptance Criteria:**

**Given** the editor is active
**When** I click the Track Changes toggle button
**Then** Track Changes mode is enabled
**And** a visual indicator shows the mode is active
**When** I toggle it off
**Then** subsequent edits are not tracked
**And** existing tracked changes remain visible

---

### Story 5.2: Visual Indicators for Insertions

As a reviewer,
I want to see inserted text clearly marked,
So that I can identify what was added.

**Acceptance Criteria:**

**Given** Track Changes is enabled
**When** I type new text
**Then** the text appears with a green underline
**And** text color indicates the author
**When** I hover over the insertion
**Then** a tooltip shows author and timestamp
**And** insertions are stored as Tiptap marks

---

### Story 5.3: Visual Indicators for Deletions

As a reviewer,
I want to see deleted text marked,
So that I can identify what was removed.

**Acceptance Criteria:**

**Given** Track Changes is enabled
**When** I delete text
**Then** the text remains visible with red strikethrough
**And** deleted text is dimmed but readable
**When** I hover over the deletion
**Then** a tooltip shows author and timestamp
**And** deletions are stored as Tiptap marks preserving original content

---

### Story 5.4: Accept Individual Changes

As a document owner,
I want to accept individual changes,
So that I can approve specific edits.

**Acceptance Criteria:**

**Given** a tracked change (insertion or deletion)
**When** I right-click and select "Accept Change"
**Then** insertions become normal text
**And** deletions are permanently removed
**And** the change mark is removed
**And** document history records the acceptance

---

### Story 5.5: Reject Individual Changes

As a document owner,
I want to reject individual changes,
So that I can revert unwanted edits.

**Acceptance Criteria:**

**Given** a tracked change
**When** I right-click and select "Reject Change"
**Then** insertions are removed
**And** deletions are restored to normal text
**And** the change mark is removed
**And** document history records the rejection

---

### Story 5.6: Accept/Reject All Changes

As a document owner,
I want to accept or reject all changes at once,
So that I can finalize reviews efficiently.

**Acceptance Criteria:**

**Given** a document with multiple tracked changes
**When** I click "Accept All Changes"
**Then** all insertions become normal text
**And** all deletions are removed
**When** I click "Reject All Changes"
**Then** all insertions are removed
**And** all deletions are restored
**And** operations complete in <2s for 100 changes

---

### Story 5.7: Track Changes Sidebar

As a reviewer,
I want a sidebar listing all changes,
So that I can navigate and manage them.

**Acceptance Criteria:**

**Given** a document with tracked changes
**When** I open the changes sidebar
**Then** I see all changes grouped by author
**And** each change shows type (insert/delete), text preview, and timestamp
**When** I click a change
**Then** the editor scrolls to that location
**And** I can accept/reject from the sidebar

---

## Epic 6: Spreadsheet Import/Export

Enable users to import and export spreadsheet data with formula and formatting preservation.

**User Outcome:** Users can import XLSX/XLS/CSV/ODS files, work with multiple sheets, and export back to standard formats preserving formulas and styling.

**FRs covered:** FR34, FR35, FR36, FR37, FR38, FR39, FR40, FR41, FR42, FR43

### Story 6.1: XLSX Import via Calamine

As a spreadsheet user,
I want to import XLSX files,
So that I can work with existing Excel data.

**Acceptance Criteria:**

**Given** an XLSX file
**When** I upload it to the import endpoint
**Then** all sheets are parsed
**And** cell values (text, numbers, dates) are extracted
**And** basic formulas (SUM, AVERAGE, COUNT) are preserved
**And** cell formatting (fonts, colors, borders) is captured
**And** import completes in <3s for 10,000 rows

---

### Story 6.2: XLS and ODS Import

As a user with legacy files,
I want to import XLS and ODS formats,
So that I can work with older spreadsheets.

**Acceptance Criteria:**

**Given** an XLS (Excel 97-2003) or ODS file
**When** I upload it for import
**Then** cell data is extracted correctly
**And** basic formatting is preserved
**And** formulas are converted where possible
**And** unsupported features return warnings, not errors

---

### Story 6.3: CSV/TSV Import

As a data analyst,
I want to import CSV and TSV files,
So that I can work with plain data exports.

**Acceptance Criteria:**

**Given** a CSV or TSV file
**When** I upload it
**Then** the delimiter is auto-detected
**And** headers are identified (first row option)
**And** data types are inferred (numbers, dates, text)
**And** encoding is handled (UTF-8, UTF-16, Latin-1)
**And** large files stream progressively

---

### Story 6.4: XLSX Export via rust_xlsxwriter

As a spreadsheet user,
I want to export my data as XLSX,
So that Excel users can work with it.

**Acceptance Criteria:**

**Given** spreadsheet data in SignApps
**When** I export to XLSX
**Then** all cell values are correct
**And** basic formulas are included
**And** cell formatting (fonts, colors, borders) is applied
**And** multiple sheets are exported
**And** file opens correctly in Excel 2016+

---

### Story 6.5: CSV and ODS Export

As a data user,
I want to export as CSV or ODS,
So that I can use data in other tools.

**Acceptance Criteria:**

**Given** spreadsheet data
**When** I export to CSV
**Then** I receive properly quoted CSV with UTF-8 encoding
**And** I can choose delimiter (comma, tab, semicolon)
**When** I export to ODS
**Then** I receive valid OpenDocument format
**And** formulas and formatting are preserved

---

### Story 6.6: Multi-Sheet Workbook Support

As a power user,
I want to work with multiple sheets,
So that I can organize complex data.

**Acceptance Criteria:**

**Given** a workbook in SignApps Sheets
**When** I add a new sheet
**Then** it appears in the sheet tabs
**When** I rename or reorder sheets
**Then** changes persist
**When** I import a multi-sheet file
**Then** all sheets are available
**And** cross-sheet references work (basic)

---

## Epic 7: Slides Export Enhancement

Enable users to export presentations to various formats with professional quality.

**User Outcome:** Users can export slides to PPTX, PNG, SVG, and PDF with speaker notes and consistent theming.

**FRs covered:** FR44, FR45, FR46, FR47, FR48, FR49, FR50

### Story 7.1: Enhanced PPTX Export

As a presenter,
I want to export my slides as PPTX,
So that I can present with PowerPoint.

**Acceptance Criteria:**

**Given** a presentation in SignApps Slides
**When** I export to PPTX
**Then** all slides are included in order
**And** text, shapes, and images are positioned correctly
**And** colors and fonts are preserved
**And** speaker notes are included
**And** file opens in PowerPoint 2016+

---

### Story 7.2: PNG and SVG Per-Slide Export

As a content creator,
I want to export individual slides as images,
So that I can use them in other media.

**Acceptance Criteria:**

**Given** a slide
**When** I export to PNG
**Then** I receive a high-resolution PNG (1920x1080 default)
**And** transparency is supported where applicable
**When** I export to SVG
**Then** vector elements remain scalable
**And** text is selectable in the SVG
**And** batch export of all slides is available

---

### Story 7.3: PDF Multi-Slide Export

As a presenter,
I want to export all slides as a PDF,
So that I can print handouts.

**Acceptance Criteria:**

**Given** a presentation
**When** I export to PDF
**Then** each slide is one page
**And** layout options include 1, 2, 4, 6 slides per page
**And** speaker notes can be included below slides
**And** PDF is valid and print-ready
**And** export uses krilla for PDF generation

---

### Story 7.4: Speaker Notes Support

As a presenter,
I want to add speaker notes to slides,
So that I have presentation guidance.

**Acceptance Criteria:**

**Given** a slide in edit mode
**When** I click the notes panel
**Then** I can type speaker notes
**And** notes support basic formatting
**And** notes are saved with the presentation
**And** notes export to PPTX and PDF

---

### Story 7.5: Master Slides and Templates

As a designer,
I want to create master slide templates,
So that I can maintain consistent branding.

**Acceptance Criteria:**

**Given** the slides editor
**When** I create a master slide
**Then** I can define placeholders for title, content, images
**When** I apply a master to a slide
**Then** the slide inherits the master layout
**And** content placeholders are editable
**And** master changes update all linked slides

---

### Story 7.6: Slide Themes and Color Schemes

As a presenter,
I want to apply color themes to my presentation,
So that it looks professional.

**Acceptance Criteria:**

**Given** a presentation
**When** I select a theme
**Then** colors for text, backgrounds, and accents update
**And** I can customize theme colors
**And** themes can be saved as custom templates
**And** theme data exports with PPTX

---

## Epic 8: PDF Operations

Enable users to view, generate, and manipulate PDF documents.

**User Outcome:** Users can view PDFs in-browser, extract text for search, merge/split documents, and generate PDFs from any document type.

**FRs covered:** FR51, FR52, FR53, FR54, FR55, FR56

### Story 8.1: PDF Viewer Component

As a user,
I want to view PDF files in my browser,
So that I don't need external software.

**Acceptance Criteria:**

**Given** a PDF file
**When** I open it in SignApps
**Then** the PDF renders page by page
**And** I can zoom in/out (25% to 400%)
**And** I can navigate between pages
**And** text is selectable and searchable
**And** the viewer uses pdf.js

---

### Story 8.2: PDF Text Extraction

As a user,
I want to extract text from PDFs,
So that I can search and copy content.

**Acceptance Criteria:**

**Given** a PDF file
**When** I call /api/v1/pdf/extract-text
**Then** I receive the text content
**And** text maintains paragraph structure
**And** extraction handles multi-column layouts
**And** embedded fonts are processed
**And** uses pdf_oxide for extraction

---

### Story 8.3: PDF Merge Operation

As a user,
I want to merge multiple PDFs into one,
So that I can combine documents.

**Acceptance Criteria:**

**Given** multiple PDF files
**When** I POST to /api/v1/pdf/merge with file IDs
**Then** I receive a single merged PDF
**And** pages appear in specified order
**And** bookmarks from originals are preserved
**And** operation completes in <5s for 100 pages total

---

### Story 8.4: PDF Split Operation

As a user,
I want to split a PDF into separate pages,
So that I can extract specific content.

**Acceptance Criteria:**

**Given** a PDF file
**When** I POST to /api/v1/pdf/split with page ranges
**Then** I receive separate PDF files per range
**And** I can specify ranges like "1-3,5,7-10"
**And** single page extraction works
**And** original file is unchanged

---

### Story 8.5: PDF Thumbnail Generation

As a user browsing documents,
I want to see PDF thumbnails,
So that I can identify files visually.

**Acceptance Criteria:**

**Given** a PDF file
**When** thumbnails are requested
**Then** first page renders as thumbnail (150x200px default)
**And** thumbnails are cached
**And** generation is non-blocking
**And** multiple sizes are available (small, medium, large)

---

### Story 8.6: PDF Generation from Any Source

As a user,
I want to generate PDFs from documents and spreadsheets,
So that I can create print-ready versions.

**Acceptance Criteria:**

**Given** a document, spreadsheet, or presentation
**When** I request PDF export
**Then** the content converts to PDF format
**And** formatting is preserved
**And** appropriate page sizing is applied
**And** PDF complies with PDF 1.7 specification
**And** krilla is used for generation

---

## Epic 9: Real-time Collaboration Enhancement

Enhance existing Yjs collaboration with presence, offline support, and improved conflict resolution.

**User Outcome:** Users can collaborate in real-time seeing others' cursors, continue working offline, and trust automatic sync and conflict resolution.

**FRs covered:** FR57, FR58, FR59, FR60, FR61, FR62

### Story 9.1: Cursor Position Synchronization

As a collaborator,
I want to see where others are typing,
So that I can avoid editing conflicts.

**Acceptance Criteria:**

**Given** multiple users in the same document
**When** a user moves their cursor
**Then** other users see the cursor position within 100ms
**And** each user has a distinct cursor color
**And** user name label appears next to cursor
**And** cursors use .collaboration-carets CSS class (Tiptap v3)

---

### Story 9.2: User Presence Indicators

As a collaborator,
I want to see who is viewing the document,
So that I know my team is engaged.

**Acceptance Criteria:**

**Given** a document with multiple viewers
**When** a user opens the document
**Then** their avatar appears in the presence bar
**When** a user closes the document
**Then** their avatar disappears within 5s
**And** clicking an avatar shows user details
**And** presence list updates in real-time

---

### Story 9.3: Automatic Change Synchronization

As a collaborator,
I want changes to sync automatically,
So that I don't have to save manually.

**Acceptance Criteria:**

**Given** a user makes edits
**When** changes are made
**Then** they sync to server within 100ms
**And** other users receive updates within 100ms
**And** no explicit save action is required
**And** last sync timestamp is visible
**And** sync uses Yjs protocol

---

### Story 9.4: Offline Support with Sync Queue

As a mobile user,
I want to edit offline and sync later,
So that I can work without internet.

**Acceptance Criteria:**

**Given** the user loses internet connection
**When** I continue editing
**Then** changes are queued locally (IndexedDB)
**And** offline indicator appears
**When** connection restores
**Then** queued changes sync automatically
**And** conflicts are resolved via CRDT (Yjs)
**And** no data is lost

---

### Story 9.5: Connection State Indicators

As a user,
I want to know my connection status,
So that I understand if sync is working.

**Acceptance Criteria:**

**Given** the editor is open
**When** connected and synced
**Then** a green indicator shows "Connected"
**When** syncing changes
**Then** indicator shows "Syncing..."
**When** offline
**Then** indicator shows "Offline - changes saved locally"
**When** error occurs
**Then** indicator shows error with retry option

---

### Story 9.6: Conflict Resolution Transparency

As a collaborator,
I want to understand how conflicts are resolved,
So that I trust the collaboration system.

**Acceptance Criteria:**

**Given** concurrent edits to the same content
**When** both users sync
**Then** CRDT algorithm merges changes deterministically
**And** no user loses their edits
**And** merge results are consistent across all clients
**And** users can see recent sync activity in a log (optional panel)

---

*Generated by BMAD Method v6.0.4 - Create Epics and Stories Workflow*
