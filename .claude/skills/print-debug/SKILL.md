---
name: print-debug
description: Debug skill for the Print module. Client-side only (intentional — no backend service). Covers print preview, PDF generation, print templates, and batch printing.
---

# Print — Debug Skill

## Source of truth

**`docs/product-specs/38-print.md`** — read spec first.

**Status**: Client-side only — this is intentional, not a gap.

## Code map

### Backend
- **No backend service** — print is entirely client-side
- PDF generation may optionally use `signapps-office` (3018) for server-side rendering

### Frontend (Next.js)
- **Pages**: `client/src/app/print/` or integrated into other module pages
- **Components**: `client/src/components/print/` (preview, templates, settings)
- **Print logic**: `window.print()`, CSS `@media print`, or jsPDF/html2canvas
- **API client**: none (client-side only)

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `print-preview-root` | Print preview container |
| `print-btn` | Print button |
| `print-template-{name}` | Print template selector |
| `print-settings` | Print settings panel |
| `print-pdf-download` | Download as PDF |
| `print-page-break` | Page break indicator |

## Key E2E journeys

1. **Print preview** — open print preview, verify layout matches expected template
2. **PDF download** — click PDF export, verify file downloaded and non-empty
3. **Template selection** — switch template, verify preview updates
4. **Multi-page print** — print long content, verify page breaks correct

## Common bug patterns

1. **CSS @media print mismatch** — screen styles leak into print; missing `@media print` overrides
2. **Dark theme in print** — dark background printed; must force white background in print CSS
3. **Chart/canvas not printing** — canvas elements render blank; must convert to image before print

## Dependencies (license check)

- **jsPDF** — MIT (client-side PDF)
- **html2canvas** — MIT (DOM to canvas)
- Verify: `cd client && npm run license-check:strict`
