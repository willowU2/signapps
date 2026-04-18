# Polotno-Inspired Platform Enhancement — Design Spec

## Summary

Apply 5 key patterns from Polotno's design editor SDK to SignApps: template variables, brand kit, design validation, unit system, and server-side rendering. Patterns only, no code reuse.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Template variable syntax | `{{variable}}` (double braces) | Avoids conflict with single braces in JSON/code. Same pattern as Handlebars/Mustache — widely understood. |
| Brand kit scope | Per-tenant (org-wide) | One brand per org, consistent across all modules |
| Validation execution | Server-side (Rust) + client-side preview | Rules enforced on save, preview in UI before export |
| Unit system | Store in px, display in user's unit | Like Polotno — internal px, UI converts via DPI. No data migration needed. |
| Server render | Rust-native via signapps-drawing | Already have SVG/PNG/PDF renderers — reuse them, no headless browser needed |

---

## Module 1: Template Variables

### Problem
Templates are static HTML/JSON blobs. No way to create a document template with `{{client_name}}` and generate 50 personalized versions.

### Design
Variable system supporting text replacement and image replacement across Docs, Slides, and Mail.

**Variable types:**
- `{{text_var}}` — replaced with a string value
- `{{image_var}}` — replaced with an image URL
- `{{date_var}}` — replaced with formatted date
- `{{list_var}}` — replaced with comma-separated list

**Pipeline:**
```
Template JSON (with {{variables}})
    → Variable map { "client_name": "Acme Corp", "logo": "https://..." }
    → Resolved document (variables replaced)
    → Export (PDF, DOCX, email send)
```

**Database:**

```sql
CREATE TABLE IF NOT EXISTS core.template_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    template_id UUID NOT NULL,
    name TEXT NOT NULL,
    variable_type TEXT NOT NULL CHECK (variable_type IN ('text', 'image', 'date', 'list')),
    default_value TEXT,
    description TEXT,
    required BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(template_id, name)
);

CREATE TABLE IF NOT EXISTS core.template_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    template_id UUID NOT NULL,
    name TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Backend (signapps-docs):**
- `POST /api/v1/templates/:id/resolve` — resolve variables → return document JSON
- `POST /api/v1/templates/:id/batch-export` — resolve N rows of data → export N PDFs/DOCXs
- `GET /api/v1/templates/:id/variables` — list defined variables
- `POST /api/v1/templates/:id/variables` — define a variable

**Frontend:**
- `VariableInserter.tsx` — toolbar button to insert `{{var}}` in Tiptap/Slides
- `VariablePanel.tsx` — side panel listing variables with test values
- `BatchExportDialog.tsx` — upload CSV/paste data → preview → bulk export

---

## Module 2: Brand Kit

### Problem
No centralized brand management. Users manually pick colors/fonts each time. No brand consistency enforcement.

### Design
Per-tenant brand kit stored in DB, accessible from all editors via a side panel.

**Database:**

```sql
CREATE TABLE IF NOT EXISTS core.brand_kits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT 'Brand Kit',
    primary_color TEXT DEFAULT '#3b82f6',
    secondary_color TEXT DEFAULT '#64748b',
    accent_color TEXT DEFAULT '#f59e0b',
    colors JSONB DEFAULT '[]',
    fonts JSONB DEFAULT '{"heading": "Inter", "body": "Inter", "mono": "JetBrains Mono"}',
    logos JSONB DEFAULT '{"primary": null, "secondary": null, "icon": null}',
    guidelines TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Backend (signapps-identity):**
- `GET /api/v1/brand-kit` — get tenant's brand kit
- `PUT /api/v1/brand-kit` — update brand kit
- `POST /api/v1/brand-kit/logos` — upload logo (multipart)

**Frontend:**
- `BrandKitPanel.tsx` — side panel in editors showing colors, fonts, logos
- Color palette: click to apply, drag to elements
- Font picker: shows brand fonts first, then all fonts
- Logo library: quick insert branded logos
- `BrandKitAdmin.tsx` — admin page to configure org brand kit

---

## Module 3: Design Validation

### Problem
No way to enforce visual standards. Users create documents with wrong fonts, low-res images, off-brand colors, inaccessible text sizes.

### Design
Configurable validation rules evaluated on document content. Rules are per-tenant, defined by admins.

**Database:**

```sql
CREATE TABLE IF NOT EXISTS core.validation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    rule_type TEXT NOT NULL CHECK (rule_type IN (
        'min_font_size', 'max_font_size', 'allowed_fonts', 'allowed_colors',
        'min_image_dpi', 'max_text_length', 'required_element', 'bleed_safe_zone',
        'contrast_ratio', 'custom'
    )),
    config JSONB NOT NULL DEFAULT '{}',
    severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('error', 'warning', 'info')),
    is_active BOOLEAN DEFAULT true,
    applies_to TEXT[] DEFAULT '{document,spreadsheet,presentation}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Validation engine (Rust, in signapps-docs):**
```
Document JSON → ValidationEngine.validate(rules) → Vec<ValidationIssue>
```

Each rule type has a validator function:
- `min_font_size`: scan all text elements, flag if fontSize < config.min
- `allowed_fonts`: scan fonts, flag if not in whitelist
- `allowed_colors`: scan fills/text colors, flag if not in brand palette
- `min_image_dpi`: check image dimensions vs display size, compute effective DPI
- `contrast_ratio`: check text color vs background for WCAG compliance
- `max_text_length`: flag text blocks exceeding limit

**Backend:**
- `GET /api/v1/validation/rules` — list rules for tenant
- `POST /api/v1/validation/rules` — create rule
- `PUT /api/v1/validation/rules/:id` — update
- `DELETE /api/v1/validation/rules/:id` — delete
- `POST /api/v1/validation/check` — validate a document JSON, return issues

**Frontend:**
- `ValidationPanel.tsx` — side panel showing issues (errors red, warnings yellow, info blue)
- Click issue → scroll to/highlight the problematic element
- `ValidationRulesAdmin.tsx` — admin page to configure rules
- Auto-validate on export (block if errors, warn if warnings)

---

## Module 4: Unit System

### Problem
Everything is in pixels. No support for print measurements (mm, cm, inches, points). Users can't create print-ready documents with precise dimensions.

### Design
Like Polotno: store internally in px, display in user-selected unit. DPI configures the px↔physical mapping.

**Unit conversion (pure functions, no DB):**

```
1 inch = 96 px (at 96 DPI)
1 inch = 25.4 mm
1 inch = 72 pt
1 cm = 10 mm
```

**Store in user preferences:**
```json
{ "display_unit": "mm", "print_dpi": 300 }
```

Already stored in user_settings JSONB on identity.users.

**Frontend utility: `client/src/lib/units.ts`**

```typescript
export type Unit = 'px' | 'pt' | 'mm' | 'cm' | 'in';

export function pxToUnit(px: number, unit: Unit, dpi: number = 96): number { ... }
export function unitToPx(value: number, unit: Unit, dpi: number = 96): number { ... }
export function formatWithUnit(px: number, unit: Unit, dpi?: number): string { ... }
```

**Integration points:**
- Rulers in Slides editor show selected unit
- Page size dialog shows dimensions in selected unit
- Print dialog shows physical dimensions
- Element property panel shows position/size in selected unit
- No backend changes needed — pure frontend display conversion

---

## Module 5: Server-Side Render

### Problem
No server-side rendering for templates. Can't generate thumbnails, previews, or batch exports without the browser.

### Design
Expose signapps-drawing renderers as an HTTP render service. Template JSON → PNG/PDF/SVG on the server without a browser.

**Backend (signapps-docs, extends existing /api/v1/drawing/*):**
- `POST /api/v1/render/document` — render a Tiptap document to PDF/PNG
- `POST /api/v1/render/slide` — render a slide (elements JSON) to PNG/SVG
- `POST /api/v1/render/template` — resolve variables + render to PDF/PNG (combines Module 1 + 5)
- `POST /api/v1/render/thumbnail` — render a small preview (256px wide) for any document type

**Pipeline:**
```
Document/Slide JSON
    → Convert to IntermediateDocument (signapps-filters)
    → Convert to DrawPrimitive[] (signapps-drawing)
    → Render via SvgRenderer/PngRenderer/PdfRenderer
    → Return bytes
```

This reuses both crates we already built. No headless browser needed.

**Frontend:**
- Thumbnail generation for Drive file previews
- Print preview in documents
- Template preview in template library
- Batch export progress dialog

---

## Execution Order

1. Template Variables (most requested by business users)
2. Brand Kit (quick win, impacts all editors)
3. Unit System (pure frontend, no backend)
4. Design Validation (safety net for brand consistency)
5. Server-Side Render (enables batch export and thumbnails)
