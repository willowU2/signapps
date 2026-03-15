---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
inputDocuments: ['brainstorming-session-2026-03-11-2200.md', 'project-context.md']
workflowType: 'prd'
classification:
  projectType: 'web-application'
  domain: 'productivity-suite'
  complexity: 'high'
  projectContext: 'brownfield'
constraints:
  license: 'Apache 2.0 or MIT only'
  backend: 'Rust only'
  stack: 'Next.js 16 + Tiptap v3 + Yjs + Fabric.js'
  optimization: 'Performance, memory, response time'
---

# Product Requirements Document - SignApps Office Suite

**Author:** Etienne
**Date:** 2026-03-15
**Version:** 1.1
**Status:** Complete

**Changelog v1.1:**
- Added UX Design Principles section (NFR33-38)
- Introduced "NO DEAD ENDS" rule for UI consistency

---

## Executive Summary

### Product Vision

SignApps Office Suite transforms the existing SignApps platform into a comprehensive, self-hosted productivity suite that rivals commercial offerings like Microsoft Office and Google Workspace. By leveraging a pure Rust backend for document processing and maintaining the modern Next.js frontend with Tiptap v3 collaboration, the suite delivers enterprise-grade document creation, editing, and collaboration while remaining fully open-source under Apache 2.0/MIT licensing.

### Problem Statement

Organizations seeking self-hosted productivity suites face a critical gap: existing solutions either lack professional-grade document format compatibility (DOCX, XLSX, PPTX) or require expensive commercial licenses. Current alternatives force compromises between:
- Full Office format compatibility vs. open-source licensing
- Native performance vs. cross-platform availability
- Real-time collaboration vs. offline capabilities
- Enterprise features vs. self-hosted deployment

### Solution Overview

SignApps Office Suite addresses these challenges through:

1. **Native Rust Document Engine** - A new `signapps-office` service providing high-performance document conversion, generation, and parsing without external dependencies
2. **Tiptap v3 Migration** - Upgrading to the latest Tiptap with native Markdown support, content migrations, and modern extension APIs
3. **Pro Features Without Pro Pricing** - Custom implementations of comments, track changes, and collaborative editing using open-source alternatives
4. **Universal Format Support** - Import/export for DOCX, XLSX, PPTX, PDF, ODT, ODS, ODP, Markdown, HTML, RTF, CSV, and EPUB

### Target Users

| Persona | Description | Primary Needs |
|---------|-------------|---------------|
| **Enterprise IT Admin** | Manages self-hosted infrastructure | Data sovereignty, SSO integration, compliance |
| **Knowledge Worker** | Creates and edits documents daily | Office format compatibility, familiar UX |
| **Collaborative Team** | Works on shared documents | Real-time sync, comments, track changes |
| **Power User** | Advanced document workflows | Templates, mail merge, batch processing |

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Format Fidelity | 95% visual accuracy | Round-trip testing suite |
| Conversion Speed | <2s for 10-page document | Performance benchmarks |
| Collaboration Latency | <100ms cursor sync | Real-time monitoring |
| User Adoption | 80% feature utilization | Analytics tracking |

---

## Product Scope

### In Scope (MVP)

#### Documents Module (Tiptap v3)
- Migration from Tiptap v2 to v3
- TextStyleKit integration (FontFamily, FontSize, Color, LineHeight)
- CharacterCount extension
- Native Markdown input/output
- Comments system (DIY implementation)
- Track Changes / Suggestion mode
- DOCX import/export via Rust backend
- PDF export via Rust backend
- Real-time collaboration (Yjs existing)

#### Sheets Module
- XLSX import via Rust backend (calamine)
- XLSX export via Rust backend (rust_xlsxwriter)
- CSV/TSV import/export
- ODS format support
- Formula preservation (basic)
- Cell styling export

#### Slides Module (Fabric.js)
- Enhanced PPTX export
- PNG/SVG per-slide export
- PDF multi-slide export
- Speaker notes
- Master slides / templates

#### PDF Module
- PDF Viewer component
- PDF text extraction
- PDF generation from documents
- PDF merge/split operations

#### Backend Service (signapps-office)
- New Rust service on port 3010
- Format-agnostic conversion API
- Streaming responses for large files
- Batch conversion endpoint
- Format auto-detection

### Out of Scope (Future Phases)

- PPTX import (Phase 2)
- Pivot tables in Sheets (Phase 2)
- PDF annotations/forms (Phase 2)
- EPUB import/export (Phase 3)
- SmartArt / diagrams (Phase 3)
- Video embedding (Phase 3)
- LaTeX export (Phase 3)

---

## User Journeys

### Journey 1: Document Creation with Office Export

**Persona:** Knowledge Worker
**Goal:** Create a professional document and share it as DOCX

```
1. User opens Documents module
2. Creates new document with Tiptap editor
3. Applies formatting (fonts, sizes, colors)
4. Adds comments for team review
5. Clicks Export → DOCX
6. Backend converts Tiptap JSON → DOCX via docx-rust
7. User downloads native Word file
```

**Success Criteria:**
- Formatting preserved in DOCX
- Comments exported to Word comment format
- File opens without errors in Microsoft Word

### Journey 2: Spreadsheet Import and Edit

**Persona:** Collaborative Team
**Goal:** Import existing Excel file and collaborate

```
1. User uploads XLSX file
2. Backend parses via calamine
3. Data populates SignApps Sheets grid
4. Team members join for real-time editing
5. User exports back to XLSX
6. Formulas and styling preserved
```

**Success Criteria:**
- All cell values imported correctly
- Basic formulas functional
- Styling retained on export

### Journey 3: Presentation Creation and PDF Export

**Persona:** Power User
**Goal:** Create slides and generate PDF handouts

```
1. User opens Slides module
2. Creates slides with text, images, shapes
3. Applies theme/template
4. Adds speaker notes
5. Exports to PDF (one slide per page)
6. Optionally exports each slide as PNG
```

**Success Criteria:**
- High-fidelity PDF output
- Speaker notes in PDF (optional)
- PNG exports match canvas exactly

### Journey 4: Track Changes Review Workflow

**Persona:** Enterprise IT Admin reviewing policy document
**Goal:** Review and approve document changes

```
1. Author enables Track Changes mode
2. Makes edits (insertions/deletions tracked)
3. Reviewer opens document
4. Sees changes with visual indicators
5. Accepts/rejects individual changes
6. Final document exported as PDF for archive
```

**Success Criteria:**
- All changes visually distinct
- Accept/reject operations atomic
- Change history preserved

---

## Functional Requirements

### Document Editing (Tiptap v3)

- FR1: Users can create rich text documents with formatting (bold, italic, underline, strikethrough)
- FR2: Users can set font family from a predefined list of web-safe fonts
- FR3: Users can set font size using preset values or custom input
- FR4: Users can apply text colors and background highlights
- FR5: Users can create and edit tables with rows and columns
- FR6: Users can insert and resize images within documents
- FR7: Users can create task lists with checkable items
- FR8: Users can insert code blocks with syntax highlighting
- FR9: Users can view real-time character and word count
- FR10: Users can input and output content as Markdown
- FR11: Users can undo/redo editing actions

### Comments System

- FR12: Users can add inline comments to selected text
- FR13: Users can reply to existing comments creating threads
- FR14: Users can resolve/close comment threads
- FR15: Users can see comments from collaborators in real-time
- FR16: Users can mention other users (@username) in comments
- FR17: System exports comments to DOCX comment format

### Track Changes

- FR18: Users can enable/disable Track Changes mode
- FR19: System visually indicates inserted text (additions)
- FR20: System visually indicates deleted text (strikethrough)
- FR21: Users can accept individual changes
- FR22: Users can reject individual changes
- FR23: Users can accept/reject all changes at once
- FR24: System preserves change author and timestamp

### Document Import/Export

- FR25: Users can export documents to DOCX format
- FR26: Users can export documents to PDF format
- FR27: Users can export documents to Markdown format
- FR28: Users can export documents to HTML format
- FR29: Users can export documents to plain text
- FR30: Users can import DOCX files into the editor
- FR31: Users can import Markdown files into the editor
- FR32: Users can import HTML content into the editor
- FR33: System auto-detects file format on import

### Spreadsheet Operations

- FR34: Users can import XLSX files into Sheets
- FR35: Users can import XLS (legacy Excel) files
- FR36: Users can import CSV/TSV files
- FR37: Users can import ODS (OpenDocument) files
- FR38: Users can export spreadsheets to XLSX format
- FR39: Users can export spreadsheets to CSV format
- FR40: Users can export spreadsheets to ODS format
- FR41: System preserves basic formulas on import/export
- FR42: System preserves cell formatting (fonts, colors, borders)
- FR43: Users can work with multiple sheets within a workbook

### Slide Operations

- FR44: Users can export slides to PPTX format
- FR45: Users can export individual slides to PNG
- FR46: Users can export individual slides to SVG
- FR47: Users can export all slides to PDF
- FR48: Users can add speaker notes to slides
- FR49: Users can apply master slide templates
- FR50: Users can set slide themes with color schemes

### PDF Operations

- FR51: Users can view PDF files in the browser
- FR52: Users can extract text content from PDFs
- FR53: Users can merge multiple PDF files
- FR54: Users can split PDF into separate pages
- FR55: Users can generate PDFs from any document type
- FR56: System generates PDF thumbnails for preview

### Collaboration

- FR57: Multiple users can edit the same document simultaneously
- FR58: Users can see other collaborators' cursors in real-time
- FR59: Users can see presence indicators (who is viewing)
- FR60: System automatically syncs changes without manual save
- FR61: Users can work offline and sync when reconnected
- FR62: System handles conflict resolution automatically (CRDT)

### Conversion Service

- FR63: System provides API endpoint for format conversion
- FR64: System supports batch conversion of multiple files
- FR65: System provides progress indication for long conversions
- FR66: System allows cancellation of in-progress conversions
- FR67: System caches frequent conversions for performance
- FR68: System streams large file responses

---

## Non-Functional Requirements

### Performance

- NFR1: Document export completes within 2 seconds for documents up to 50 pages
- NFR2: Spreadsheet import processes 10,000 rows within 3 seconds
- NFR3: PDF generation completes within 5 seconds for 100-page documents
- NFR4: Real-time collaboration latency remains under 100ms
- NFR5: Editor input latency remains under 16ms (60fps)
- NFR6: Conversion API handles 50 concurrent requests
- NFR7: Memory usage stays under 500MB per conversion worker

### Scalability

- NFR8: System supports 100 concurrent document editors
- NFR9: System supports 1000 simultaneous collaboration sessions
- NFR10: Conversion queue handles burst of 500 requests
- NFR11: System scales horizontally for conversion workers
- NFR12: Database handles 10,000 documents without degradation

### Security

- NFR13: All document data encrypted at rest (AES-256)
- NFR14: All API communication over TLS 1.3
- NFR15: JWT tokens expire within 1 hour
- NFR16: Uploaded files scanned for malware signatures
- NFR17: Conversion sandbox prevents code execution
- NFR18: No PII logged in application logs

### Reliability

- NFR19: Service availability target of 99.9%
- NFR20: Automatic recovery from worker process crashes
- NFR21: Document autosave every 30 seconds
- NFR22: Export operations are idempotent
- NFR23: Failed conversions provide actionable error messages

### Compatibility

- NFR24: DOCX exports open correctly in Microsoft Word 2016+
- NFR25: XLSX exports open correctly in Microsoft Excel 2016+
- NFR26: PDF exports comply with PDF 1.7 specification
- NFR27: Editor supports Chrome, Firefox, Safari, Edge (latest 2 versions)
- NFR28: Keyboard shortcuts match standard Office conventions

### Accessibility

- NFR29: Editor meets WCAG 2.1 AA compliance
- NFR30: All interactive elements keyboard accessible
- NFR31: Screen reader compatible with proper ARIA labels
- NFR32: Color contrast ratio minimum 4.5:1

### UX Design Principles

- NFR33: **NO DEAD ENDS RULE** - If a feature is not functional, it must not be displayed to users
- NFR34: All visible buttons and menu items must have working functionality
- NFR35: No "Coming soon", "Under development", or placeholder UI elements
- NFR36: Feature flags must control visibility of incomplete features
- NFR37: Code review must reject merges where UI points to non-functional code
- NFR38: Every interactive element must provide meaningful feedback on interaction

---

## Technical Constraints

### Mandatory Constraints (Non-Negotiable)

| Constraint | Requirement | Rationale |
|------------|-------------|-----------|
| **License** | Apache 2.0 or MIT only | Open-source commitment |
| **Backend** | Rust only | Performance, memory safety, existing stack |
| **Frontend** | Next.js 16 + React 19 | Existing architecture |
| **Editor** | Tiptap v3 | Migration required for modern features |
| **Collaboration** | Yjs (frontend) + Yrs (backend) | Already integrated, CRDT proven |
| **Canvas** | Fabric.js | Existing Slides implementation |
| **No Docker** | Native execution only | Project policy |

### Technology Stack (Locked)

#### Backend Libraries (Rust)

| Crate | Purpose | License | Version |
|-------|---------|---------|---------|
| docx-rust | DOCX read/write | MIT | 0.5+ |
| rust_xlsxwriter | XLSX write | MIT/Apache 2.0 | 0.79+ |
| calamine | XLSX/XLS/ODS read | MIT | 0.26+ |
| krilla | PDF generation | MIT/Apache 2.0 | 0.4+ |
| pdf_oxide | PDF extraction | MIT/Apache 2.0 | 0.3+ |
| shiva | Multi-format fallback | MIT/Apache 2.0 | 1.4+ |
| comrak | Markdown CommonMark+GFM | MIT | 0.31+ |
| rbook | EPUB read | Apache 2.0 | 0.5+ |
| yrs | Yjs Rust CRDT | MIT | 0.17+ |

#### Frontend Libraries

| Package | Purpose | Version |
|---------|---------|---------|
| @tiptap/core | Editor core | 3.x |
| @tiptap/extension-text-style | TextStyleKit | 3.x |
| @tiptap/extension-character-count | Character counting | 3.x |
| tiptap-comment-extension | Comments (forked) | custom |
| yjs | CRDT client | 13.6+ |
| fabric | Canvas rendering | 7.x |
| pptxgenjs | PPTX generation (client) | 4.x |

### Integration Constraints

- Service port: 3010 (signapps-office)
- API pattern: REST `/api/v1/*`
- Auth: JWT via signapps-identity
- Storage: signapps-storage (OpenDAL)
- Database: PostgreSQL (existing)

### Tiptap v3 Migration Requirements

Based on [official migration guide](https://tiptap.dev/docs/guides/upgrade-tiptap-v2):

1. Uninstall all Tiptap v2 packages
2. Update imports: `BubbleMenu`, `FloatingMenu` from `@tiptap/react/menus`
3. Set `immediatelyRender: false` for SSR (Next.js)
4. Set `shouldRerenderOnTransaction: true` in useEditor
5. Rename `history: false` to `undoRedo: false` in StarterKit
6. Update cursor CSS class `.collaboration-cursor` to `.collaboration-carets`
7. Test `setContent(content, options)` signature change

---

## Architecture Overview

### Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 16)                     │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│   Docs      │   Sheets    │   Slides    │   PDF Viewer      │
│  (Tiptap v3)│  (Custom)   │ (Fabric.js) │   (pdf.js)        │
└──────┬──────┴──────┬──────┴──────┬──────┴────────┬──────────┘
       │             │             │               │
       ▼             ▼             ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                 signapps-collab (Port varies)               │
│              Real-time collaboration WebSocket               │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│              signapps-office (Port 3010) [NEW]              │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐   │
│  │  DOCX    │  XLSX    │  PPTX    │   PDF    │  Others  │   │
│  │docx-rust │xlsxwriter│  custom  │  krilla  │  shiva   │   │
│  │          │ calamine │          │pdf_oxide │  comrak  │   │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘   │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                   signapps-storage (3004)                    │
│                 (OpenDAL: FS or S3)                          │
└─────────────────────────────────────────────────────────────┘
```

### API Endpoints (signapps-office)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/convert` | Convert between formats |
| POST | `/api/v1/convert/batch` | Batch conversion |
| GET | `/api/v1/convert/{id}/status` | Conversion status |
| DELETE | `/api/v1/convert/{id}` | Cancel conversion |
| POST | `/api/v1/pdf/merge` | Merge PDF files |
| POST | `/api/v1/pdf/split` | Split PDF pages |
| POST | `/api/v1/pdf/extract-text` | Extract PDF text |
| GET | `/api/v1/formats` | List supported formats |

---

## Implementation Phases

### Phase 1: Foundation (Sprint 1-2)

**Focus:** Core infrastructure and Tiptap migration

| Item | Priority | Effort |
|------|----------|--------|
| Tiptap v2 → v3 migration | P0 | M |
| Create signapps-office service skeleton | P0 | M |
| TextStyleKit integration | P0 | S |
| CharacterCount extension | P1 | S |
| Basic API structure | P0 | M |

**Exit Criteria:**
- Tiptap v3 running without regressions
- Service responds to health checks
- FontFamily/FontSize working

### Phase 2: Export Core (Sprint 3-4)

**Focus:** Backend export capabilities

| Item | Priority | Effort |
|------|----------|--------|
| DOCX export (docx-rust) | P0 | L |
| XLSX export (rust_xlsxwriter) | P0 | L |
| PDF export (krilla) | P0 | L |
| Conversion API endpoints | P0 | M |
| Streaming responses | P1 | M |

**Exit Criteria:**
- Documents export to DOCX with formatting
- Spreadsheets export to XLSX with data
- PDF generation working

### Phase 3: Import Core (Sprint 5-6)

**Focus:** File import and parsing

| Item | Priority | Effort |
|------|----------|--------|
| DOCX import → Tiptap JSON | P0 | L |
| XLSX import (calamine) | P0 | M |
| PDF text extraction | P1 | M |
| Format auto-detection | P1 | S |
| Import validation | P1 | M |

**Exit Criteria:**
- DOCX files import with formatting
- XLSX data populates grid
- PDF text extractable

### Phase 4: Pro Features (Sprint 7-9)

**Focus:** Comments and Track Changes

| Item | Priority | Effort |
|------|----------|--------|
| Comments extension (fork) | P1 | L |
| Comments Yjs sync | P1 | L |
| Comments sidebar UI | P1 | M |
| Track Changes marks | P1 | XL |
| Accept/reject UI | P1 | L |
| DOCX comments export | P2 | L |

**Exit Criteria:**
- Comments functional and synced
- Track Changes visible
- Changes accept/reject working

### Phase 5: Secondary Formats (Sprint 10-11)

**Focus:** Additional format support

| Item | Priority | Effort |
|------|----------|--------|
| Markdown import/export | P1 | M |
| HTML import/export | P1 | M |
| RTF via shiva | P2 | M |
| ODT/ODS via shiva | P2 | M |
| CSV/TSV | P1 | S |

**Exit Criteria:**
- All secondary formats functional
- Round-trip tests passing

### Phase 6: PDF Advanced (Sprint 12-13)

**Focus:** PDF viewer and operations

| Item | Priority | Effort |
|------|----------|--------|
| PDF Viewer component | P1 | L |
| PDF merge/split | P2 | M |
| PDF thumbnails | P2 | S |
| OCR integration (optional) | P3 | L |

**Exit Criteria:**
- PDF viewable in browser
- Merge/split operations working

### Phase 7: Polish (Sprint 14-15)

**Focus:** Quality and performance

| Item | Priority | Effort |
|------|----------|--------|
| Performance optimization | P1 | L |
| Test suite completion | P0 | L |
| Documentation | P1 | M |
| Keyboard shortcuts | P2 | M |
| Accessibility audit | P2 | M |

**Exit Criteria:**
- All NFRs met
- 90%+ test coverage
- Documentation complete

---

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Tiptap v3 migration breaks features | High | Medium | Comprehensive test suite, incremental migration |
| Rust libraries immature | Medium | Medium | Fallback to shiva, contribute upstream |
| Office format compatibility issues | High | High | Round-trip testing with real Office files |
| Performance under load | Medium | Low | Streaming, caching, worker pools |
| Memory leaks with large docs | Medium | Medium | Streaming parsing, lazy loading |

---

## Success Criteria Summary

| Criterion | Metric | Target |
|-----------|--------|--------|
| Format Fidelity | Visual accuracy score | >95% |
| Performance | Export time (50 pages) | <2s |
| Collaboration | Sync latency | <100ms |
| Reliability | Service uptime | 99.9% |
| Compatibility | Office version support | 2016+ |
| Security | Vulnerability scan | Zero critical |

---

## Appendix

### Related Documents

- [Brainstorming Session](../brainstorming/brainstorming-session-2026-03-11-2200.md)
- [Project Context](../project-context.md)

### External References

- [Tiptap v3 Migration Guide](https://tiptap.dev/docs/guides/upgrade-tiptap-v2)
- [tiptap-comment-extension](https://github.com/sereneinserenade/tiptap-comment-extension)
- [rust_xlsxwriter](https://github.com/jmcnamara/rust_xlsxwriter)
- [calamine](https://github.com/tafia/calamine)
- [krilla](https://github.com/LaurenzV/krilla)
- [docx-rust](https://crates.io/crates/docx-rust)
- [shiva](https://docs.rs/shiva)
- [comrak](https://github.com/kivikakk/comrak)

---

*Generated by BMAD Method v6.0.4 - PRD Create Workflow*
