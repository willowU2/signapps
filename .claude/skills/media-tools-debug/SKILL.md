---
name: media-tools-debug
description: Debug skill for the Media Tools module (image/video processing). Backend on signapps-media port 3009. Covers image editing, video conversion, thumbnails, and OCR.
---

# Media Tools — Debug Skill

## Source of truth

**`docs/product-specs/37-media-tools.md`** — read spec first.

## Code map

### Backend (Rust)
- **Service**: `services/signapps-media/` — port **3009**
- **Handlers**: `services/signapps-media/src/handlers/` (image, video, OCR endpoints)
- **Processing**: native image/video manipulation (image crate, ffmpeg bindings)
- **Storage**: processed files via `signapps-storage` (3004)

### Frontend (Next.js)
- **Pages**: `client/src/app/media/` (editor, gallery, tools)
- **Components**: `client/src/components/media/` (image editor, video player, OCR viewer)
- **API client**: `client/src/lib/api/media.ts`

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `media-tools-root` | Media tools page container |
| `image-editor` | Image editor canvas |
| `image-crop-btn` | Crop tool |
| `image-resize-btn` | Resize tool |
| `video-convert-btn` | Video conversion button |
| `ocr-result` | OCR text output |

## Key E2E journeys

1. **Image crop & resize** — upload image, crop, resize, download result
2. **Video conversion** — upload video, convert format, verify output playable
3. **Thumbnail generation** — upload image, verify thumbnail auto-generated
4. **OCR extraction** — upload scanned document, verify extracted text

## Common bug patterns

1. **Large file upload timeout** — video uploads exceed default 30s timeout
2. **FFmpeg not found** — binary missing on host; must check PATH on startup
3. **Memory spike** — processing large images/videos without streaming causes OOM

## Dependencies (license check)

- **image** crate — MIT (Rust image processing)
- **ffmpeg** — LGPL (used via CLI, dynamically linked OK)
- **tesseract** — Apache-2.0 (OCR)
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
