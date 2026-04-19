---
name: org-integrations-debug
description: Use when SO4 external integrations misbehave — AD preview returning empty operations, public link 404 on existing slug, webhook deliveries stuck in pending, HMAC signature mismatch on the consumer side, photo upload returning 400 on a valid image, or DiceBear avatars not rendering. Covers `org_public_links`, `org_webhooks`, `org_webhook_deliveries`, photo storage layout, the moka 15-min preview cache, and the PgEventBus org dispatcher subscription cursor.
---

# org-integrations-debug

Use this skill when SO4 surfaces break — AD preview/approve, public link / embed, webhook fan-out, photo upload, or SmartAvatar fallback.

## Architecture recap

| Table | Purpose | Seed count |
|---|---|---|
| `org_public_links` | Slug URL exposing a sub-tree, anonymized | 1 (`nexus-public`, anon) |
| `org_webhooks` | Outbound HMAC-signed subscription per tenant | 2 (webhook.site demos) |
| `org_webhook_deliveries` | Audit log of every fan-out attempt (BIGSERIAL) | 0 (filled at runtime) |
| `org_persons.photo_url` | Person avatar URL | 10 Nexus persons → DiceBear |
| `org_nodes.group_photo_url` | Node group photo URL | 0 (no seed) |

Cache & async paths:
- `PREVIEW_CACHE` (moka, TTL 15 min, max 256 entries) holds preview bundles by `run_id`. After expiry, the approve endpoint returns 404.
- `org_dispatcher::spawn` registers a `org-webhooks-dispatcher` consumer on `platform.events`. The cursor lives in `platform.event_consumers`. To replay everything for one tenant, `UPDATE platform.event_consumers SET last_event_id = 0 WHERE consumer_name = 'org-webhooks-dispatcher'`.
- The dispatcher runs deliveries in detached `tokio::spawn` per webhook, with backoff `[30 s, 2 min, 10 min]`. Inflight deliveries do **not** survive a restart — they are restarted from scratch (new `attempt = 1`, possibly creating duplicate POSTs).

## Common issues

- **`POST /org/ad/sync/:tenant/preview` returns 200 with empty arrays** — the synthesizer always returns 1 op of each kind. Empty arrays mean the response was wrapped or filtered upstream. Check that the gateway didn't strip the JSON body.
- **`POST /org/ad/sync/:tenant/approve` returns 404 "preview run expired or unknown"** — the moka cache evicts after 15 min OR the service was restarted (cache is in-memory). Re-run the preview.
- **Approve says all ops `skipped`** — the `selected_op_ids` UUIDs don't match any cached op id. Make sure the UI sends the exact `id` field, not the row index.
- **`GET /public/org/:slug` returns 404 on a fresh seed** — the route is mounted at the org service root (`/public/org/...`), NOT under `/api/v1/public/...`. Use `http://localhost:3026/public/org/nexus-public`. The gateway might also need an explicit pass-through if you front it.
- **Embed page doesn't render in iframe** — the response sets `Content-Security-Policy: frame-ancestors *` but **does not** strip `X-Frame-Options`. Some downstream proxies inject DENY. Curl the response and check headers.
- **Anon visibility leaks emails** — only the JSON path with `visibility = anon` masks emails. If you see emails, the link's visibility is probably `full`. Check the row:
  ```bash
  docker exec signapps-postgres psql -U signapps -d signapps -c \
      "SELECT slug, visibility FROM org_public_links WHERE slug = 'nexus-public'"
  ```
- **Webhook test returns 202 but no delivery row appears** — the dispatcher is not running. Check the platform logs for `"org-webhooks dispatcher started"`. If absent, `event_bus` is None in the AppState (test mode). Verify `services/signapps-webhooks/src/lib.rs::build_state` injects `Some(shared.event_bus.clone())`.
- **Webhook delivery stuck in pending / no row at all** — the consumer cursor may be ahead. Inspect:
  ```bash
  docker exec signapps-postgres psql -U signapps -d signapps -c \
      "SELECT consumer_name, last_event_id FROM platform.event_consumers"
  ```
  Compare with `SELECT MAX(id) FROM platform.events`. If the cursor matches max, no new event has fired.
- **Webhook auto-disabled (`active = false`) after 5 attempts** — that's the safety valve. Reset with `UPDATE org_webhooks SET active = true, failure_count = 0 WHERE id = '…'`.
- **HMAC signature mismatch on consumer side** — verify with `openssl`:
  ```bash
  echo -n '{"event_type":"test.webhook"…}' | \
      openssl dgst -sha256 -hmac "$SECRET" -hex
  ```
  Must match the `X-SignApps-Signature: sha256=<hex>` header. Body must be the byte-for-byte JSON sent (no re-serialization).
- **`POST /org/persons/:id/photo` returns 400 "unsupported content_type"** — only `image/jpeg`, `image/png`, `image/webp` are accepted. WebP browsers sometimes upload as `image/webp;codecs=…` — the matcher is exact. Strip the codecs param client-side.
- **Photo upload OK but UI still shows initials** — the `photo_url` column was updated but the person query is cached upstream. Invalidate `["org", "persons"]` query keys after upload.
- **DiceBear avatars don't render** — `api.dicebear.com/7.x/avataaars/svg?seed=…` is an external HTTP call. Browsers block on a strict CSP. The `next.config.js` `images.remotePatterns` does not apply because we use `<img>` (not `next/image`). Verify `connect-src` / `img-src` in your CSP allows `api.dicebear.com`.

## Debug commands

```bash
# Verify migration 503 is applied.
docker exec signapps-postgres psql -U signapps -d signapps -c \
    "SELECT table_name FROM information_schema.tables
     WHERE table_name IN ('org_public_links','org_webhooks','org_webhook_deliveries')"

# Counts.
docker exec signapps-postgres psql -U signapps -d signapps -c \
    "SELECT 'public_links', count(*) FROM org_public_links
     UNION ALL SELECT 'webhooks', count(*) FROM org_webhooks
     UNION ALL SELECT 'deliveries', count(*) FROM org_webhook_deliveries
     UNION ALL SELECT 'persons_with_photo', count(*) FROM org_persons WHERE photo_url IS NOT NULL"

# Hit the seeded public link directly (no auth).
curl -s http://localhost:3026/public/org/nexus-public | jq .

# Probe a webhook test fire (auth required).
curl -X POST http://localhost:3026/api/v1/org/webhooks/<UUID>/test \
    -H "Authorization: Bearer $TOKEN"

# Inspect the dispatcher cursor.
docker exec signapps-postgres psql -U signapps -d signapps -c \
    "SELECT * FROM platform.event_consumers WHERE consumer_name = 'org-webhooks-dispatcher'"

# Re-seed only the SO4 entries (idempotent).
DATABASE_URL=postgres://signapps:signapps_dev@localhost:5432/signapps \
  cargo run -p signapps-seed --bin signapps-seed -- --only public_links
DATABASE_URL=… cargo run -p signapps-seed --bin signapps-seed -- --only webhooks
DATABASE_URL=… cargo run -p signapps-seed --bin signapps-seed -- --only photos

# Compute HMAC manually.
echo -n '{"event_type":"test.webhook","data":{}}' | \
    openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex
```

## Files of interest

- `migrations/503_so4_integrations.sql` — schema
- `crates/signapps-db/src/models/org/{public_link,webhook,webhook_delivery}.rs`
- `crates/signapps-db/src/repositories/org/{public_link,webhook}_repository.rs`
- `services/signapps-org/src/handlers/{ad_preview,public_links,webhooks,photos}.rs`
- `services/signapps-webhooks/src/org_dispatcher.rs`
- `services/signapps-seed/src/seeders/{public_links,webhooks,photos}.rs`
- `client/src/lib/api/org-integrations.ts`
- `client/src/components/common/smart-avatar.tsx`
- `client/src/components/admin/org-webhooks-panel.tsx`
- `client/e2e/so4-{ad-preview,public-link,webhooks}.spec.ts`
