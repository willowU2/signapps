# SO4 — Intégrations externes — Plan

> Spec : `docs/superpowers/specs/2026-04-19-so4-integrations-design.md`. Branche `feature/so4-integrations`.

---

## T1 — Migration 503

**Files :** `migrations/503_so4_integrations.sql` + `crates/signapps-db/tests/test_migration_503.rs`
- [ ] 3 nouvelles tables + 2 colonnes (`org_persons.photo_url`, `org_nodes.group_photo_url`) + 2 triggers
- [ ] Test : tables existent, colonnes ajoutées, triggers attachés
- [ ] Commit `feat(org): migration 503 public links + webhooks + photos`

## T2 — Models + repos

**Files :** `crates/signapps-db/src/models/org/{public_link,webhook,webhook_delivery}.rs` + `repositories/org/{public_link,webhook}_repository.rs`
- [ ] Enums `Visibility` (Full/Anon/Compact)
- [ ] PublicLinkRepository : create (génère slug random 12 chars), list_active_by_tenant, revoke, increment_access
- [ ] WebhookRepository : create (génère secret random 32 chars), list_active_subscribed_to(tenant, event_type), record_delivery
- [ ] Tests unitaires
- [ ] Commit `feat(org): models + repos public-links + webhooks`

## T3 — Handler AD preview

**Files :** `services/signapps-org/src/handlers/ad_preview.rs`

Endpoints :
- `POST /org/ad/sync/:tenant_id/preview` body `{mode?: 'bidirectional'|'import'|'export'}` → returns `{run_id, adds, removes, moves, conflicts, stats}`
- `POST /org/ad/sync/:tenant_id/approve` body `{run_id, selected_op_ids: []}` → applique + retourne `{applied, skipped, errors}`

- [ ] Réutilise `ad::sync` existant (dépend de `services/signapps-org/src/ad/mod.rs`) mais avec flag `preview: true` qui shortcut l'application
- [ ] Les `run_id` sont des UUIDs stockés en cache moka 15min (réutilisable dans approve)
- [ ] Si AD unbound (seed dev), mock response : retourne une liste d'opérations synthétiques pour permettre l'UI preview sans LDAP réel
- [ ] Tests
- [ ] Commit `feat(org): AD sync preview + approve API`

## T4 — Handler public links

**Files :** `services/signapps-org/src/handlers/public_links.rs`

Endpoints protégés (admin) :
- `GET /org/public-links?tenant_id=X` → list actives
- `POST /org/public-links` body `{root_node_id, visibility, allowed_origins?, expires_at?}` → create
- `DELETE /org/public-links/:id` → revoke
- `POST /org/public-links/:id/rotate` → generate new slug

Endpoints publics (pas d'auth middleware sur `/public/*`) :
- `GET /public/org/:slug` → JSON nodes+persons avec anonymisation selon visibility
- `GET /public/org/:slug/embed.html` → page HTML auto-contenue avec orgchart SVG minimal (pas de React, template Rust via `maud` ou format!)

- [ ] Route `/public/*` exempt auth middleware (voir comment c'est fait pour `/g/:token` grants en SO1)
- [ ] Anonymisation helper `apply_visibility(nodes, persons, visibility)` → filtered data
- [ ] Embed : HTML <svg> arbre vertical simple, style inline, CSP-safe
- [ ] Tests : 3 scénarios (full/anon/compact)
- [ ] Commit `feat(org): public links + anonymized embed API`

## T5 — Handler + service webhooks

**Files :** `services/signapps-org/src/handlers/webhooks.rs` + `services/signapps-webhooks/src/org_dispatcher.rs` (new)

Endpoints :
- `GET /org/webhooks?tenant_id=X` → list
- `POST /org/webhooks` body `{url, events: [], allowed_origins?}` → create
- `PUT /org/webhooks/:id` → update
- `DELETE /org/webhooks/:id` → remove
- `POST /org/webhooks/:id/test` → envoie payload test

Dispatcher (service signapps-webhooks) :
- Subscribe aux events PgEventBus `org.*` au boot
- Pour chaque event : fetch webhooks abonnés via WebhookRepository, fan-out HTTP POST avec HMAC-SHA256 body-signed, async
- Retry exponentiel : 30s, 2min, 10min. Après 5 échecs consécutifs → `active=false` + écrit `failure_count`
- Record chaque delivery dans `org_webhook_deliveries`

- [ ] HMAC signature : `hmac_sha256(secret, body_bytes)` → hex → header `X-SignApps-Signature: sha256=<hex>`
- [ ] Test endpoint envoie `{event_type: "test.webhook", timestamp, tenant_id, data: {message: "Hello from SignApps"}}`
- [ ] Tests unit (signature calc) + integration (mock HTTP server reçoit le POST signé)
- [ ] Commit `feat(webhooks): org.* fan-out dispatcher with HMAC signing`

## T6 — Handler photos

**Files :** `services/signapps-org/src/handlers/photos.rs`

Endpoints :
- `POST /org/persons/:id/photo` multipart/form-data `file=` → upload via `signapps-storage` bucket `org-photos`, retourne URL, update `org_persons.photo_url`
- `DELETE /org/persons/:id/photo` → retire photo
- `POST /org/nodes/:id/group-photo` → similaire pour group photo

- [ ] Validation : max 5 MB, types `image/jpeg|png|webp`, redimensionnement à 512x512 via `image` crate
- [ ] Stockage via `StorageClient::upload(bucket, key, bytes)` (pattern existant dans `signapps-storage`)
- [ ] Tests
- [ ] Commit `feat(org): photo upload for persons + group nodes`

## T7 — Seeds

**Files :** `services/signapps-seed/src/seeders/{public_links,webhooks,photos}.rs`

- [ ] PublicLinksSeeder : 1 link `nexus-public` sur root node Nexus, visibility='anon', expires_at +90j
- [ ] WebhooksSeeder : 2 webhooks demo pointant vers `https://webhook.site/demo-signapps-1` et `https://webhook.site/demo-signapps-2`, subscribing to `org.person.*`
- [ ] PhotosSeeder : pour 10 persons Nexus, set `photo_url = https://api.dicebear.com/7.x/avataaars/svg?seed=<username>` (générateur gratuit, déterministe)
- [ ] Test idempotence
- [ ] Commit `feat(seed): 1 public link + 2 webhooks + 10 person photos`

## T8 — Frontend

**Files :**
- `client/src/app/admin/active-directory/sync/preview/page.tsx` (new)
- `client/src/app/admin/org-structure/components/dialogs/create-public-link-dialog.tsx`
- `client/src/app/admin/org-structure/components/public-links-tab.tsx`
- `client/src/app/admin/webhooks/page.tsx` (enrich existing stub)
- Extension `people-tab.tsx` edit dialog : input file photo + preview
- `client/src/components/common/smart-avatar.tsx` (new) : priorise `photo_url` > initiales

- [ ] AD preview page : bouton "Aperçu" → table 4 colonnes checkboxes par op, footer "Appliquer N"
- [ ] Public links tab : liste cards {slug, visibility, expires_at, access_count, actions}, bouton "Créer" → dialog
- [ ] Webhooks page enrich : form create + table deliveries avec filtres event_type + bouton test
- [ ] SmartAvatar : `<img src={photo_url} alt="..." onError={fallback}>` sinon fallback vers avatar tint initiales
- [ ] Remplacer tous les `<Avatar>` existants dans org-structure par `<SmartAvatar>` via grep/replace
- [ ] Commit `feat(ui): AD preview + public links + webhooks enrich + smart avatar`

## T9 — E2E + docs + merge

**Files :**
- `client/e2e/so4-ad-preview.spec.ts` (bouton preview, approve avec sélection)
- `client/e2e/so4-public-link.spec.ts` (créer link, ouvrir en incognito, vérifier anonymisation)
- `client/e2e/so4-webhooks.spec.ts` (créer webhook, test, vérifier delivery)
- `docs/product-specs/69-so4-integrations.md`
- `.claude/skills/org-integrations-debug/SKILL.md`

- [ ] 3 E2E avec skip si env incomplet
- [ ] Product spec + debug skill
- [ ] Clippy + tsc + build OK
- [ ] Merge `feature/so4-integrations → main --no-ff` (local, pas push)
- [ ] Commit `docs(so4): product spec + debug skill + E2E`

---

**Fin plan SO4.**
