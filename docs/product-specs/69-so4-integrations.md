# 69 — SO4 External Integrations

**Status:** Implémenté (2026-04-19)
**Owner:** Platform team
**Spec:** `docs/superpowers/specs/2026-04-19-so4-integrations-design.md`
**Plan:** `docs/superpowers/plans/2026-04-19-so4-integrations.md`

## Vue d'ensemble

SO4 ajoute la couche d'**intégrations externes** à la plate-forme org :

1. **AD sync diff visuel** — `POST /org/ad/sync/:tenant/preview` retourne un
   diff `{adds, removes, moves, conflicts}` cached 15 min via `run_id`,
   suivi de `POST /org/ad/sync/:tenant/approve` pour appliquer une sélection.
2. **Partage public anonymisé** — table `org_public_links` exposant un
   sous-arbre via slug URL avec 3 niveaux d'anonymisation (`full`, `anon`,
   `compact`). Endpoints non-auth `GET /public/org/:slug` (JSON) +
   `embed.html` (snapshot HTML auto-contenu, iframe-safe).
3. **Webhooks événementiels** — table `org_webhooks` + dispatcher dans
   `signapps-webhooks` qui subscribe aux events `org.*` du PgEventBus,
   fan-out HMAC-SHA256-signé avec retry 30 s / 2 min / 10 min, auto-disable
   après 5 échecs consécutifs. Audit complet dans `org_webhook_deliveries`.
4. **Photos & avatars** — colonnes `org_persons.photo_url` +
   `org_nodes.group_photo_url`, upload multipart redimensionné 512x512 via
   crate `image`, fallback frontend via `<SmartAvatar>` (img onError →
   tinted initials).

## Modèle de données (migration 503)

Trois nouvelles tables + 2 colonnes :

| Table | Rôle | Audit |
|-------|------|-------|
| `org_public_links` | Slug URL public + anonymisation | trigger générique |
| `org_webhooks` | Souscriptions sortantes par tenant | trigger générique |
| `org_webhook_deliveries` | Audit log des fan-outs | aucun (dérivé) |

Colonnes ajoutées :
- `org_persons.photo_url TEXT NULL`
- `org_nodes.group_photo_url TEXT NULL`

CHECK constraint sur `org_public_links.visibility ∈ {full, anon, compact}`.
Index conditionnels (revoked_at IS NULL) pour la fast path public lookup.

## API REST

### AD preview / approve

| Méthode | Path | Description |
|---------|------|-------------|
| POST | `/api/v1/org/ad/sync/:tenant_id/preview` | Diff cached 15 min |
| POST | `/api/v1/org/ad/sync/:tenant_id/approve` | Apply selected ops |

Réponses synthétisées (mock déterministe par tenant) tant que la dev box
n'a pas de bind LDAP. Le shape est identique pour la prod future.

### Public links (admin)

| Méthode | Path | Description |
|---------|------|-------------|
| GET | `/api/v1/org/public-links?tenant_id=…` | Liste actifs |
| POST | `/api/v1/org/public-links` | Crée (slug auto 12 chars) |
| DELETE | `/api/v1/org/public-links/:id` | Révoque |
| POST | `/api/v1/org/public-links/:id/rotate` | Régénère slug |

### Public (sans auth)

| Méthode | Path | Description |
|---------|------|-------------|
| GET | `/public/org/:slug` | JSON anonymisé |
| GET | `/public/org/:slug/embed.html` | HTML self-contained |

CSP `frame-ancestors *` sur l'embed pour autoriser l'iframe externe.

### Webhooks (org events)

| Méthode | Path | Description |
|---------|------|-------------|
| GET | `/api/v1/org/webhooks?tenant_id=…` | Liste |
| POST | `/api/v1/org/webhooks` | Crée (secret 64 chars hex retourné une fois) |
| PUT | `/api/v1/org/webhooks/:id` | Met à jour url/events/active |
| DELETE | `/api/v1/org/webhooks/:id` | Supprime (cascade deliveries) |
| POST | `/api/v1/org/webhooks/:id/test` | Publie `test.webhook` event |
| GET | `/api/v1/org/webhooks/:id/deliveries?limit=N` | Timeline 50 dernières |

### Photos

| Méthode | Path | Description |
|---------|------|-------------|
| POST | `/api/v1/org/persons/:id/photo` | Upload multipart, resize 512x512 |
| DELETE | `/api/v1/org/persons/:id/photo` | Clear `photo_url` |
| POST | `/api/v1/org/nodes/:id/group-photo` | Idem pour group photo |
| DELETE | `/api/v1/org/nodes/:id/group-photo` | Clear |

Validation : max 5 MB, MIME `image/jpeg|png|webp`. Lanczos3 resize via
crate `image`, output PNG, persisted sous
`STORAGE_FS_ROOT/org-photos/{tenant}/{kind}/{id}.png`.

## Sécurité

- **Public links** : refus si `revoked_at IS NOT NULL OR expires_at < NOW()`.
  `access_count` incrémenté à chaque GET (best-effort, jamais bloquant).
- **Webhooks** : signature `X-SignApps-Signature: sha256=<hex>` calculée
  sur le body JSON brut (HMAC-SHA256 + secret 64 chars). Auto-disable
  après `MAX_CONSECUTIVE_FAILURES = 5`.
- **Anonymisation** : `anon` = initiales + email masqué ; `compact` = juste
  `person_count` global, `persons` array vide.

## Frontend

- `/admin/active-directory/sync/preview` — page checkbox-driven 4 sections.
- `/admin/webhooks` — `OrgWebhooksPanel` ajouté sous le `WebhookManager`
  legacy. Formulaire create + table deliveries refetchée toutes les 30 s.
- `<CreatePublicLinkDialog>` + `<PublicLinksTab>` montables dans la sidebar
  org-structure (panneau "Partage").
- `<SmartAvatar>` (`client/src/components/common/smart-avatar.tsx`) :
  utilisé partout où un avatar de personne est affiché, fallback initials
  via `avatarTint` existant.

## Seeds

`signapps-seed` exécute 3 nouveaux seeders idempotents :

| Seeder | Output |
|--------|--------|
| `public_links` | 1 link `nexus-public` sur root Nexus (anon, +90j) |
| `webhooks` | 2 webhooks démo `webhook.site/demo-signapps-{1,2}` |
| `photos` | 10 persons Nexus avec URL DiceBear avataaars déterministe |

## Tests

- 8 tests unitaires (migration 503, models + repos, photos + ad_preview + dispatcher)
- 3 E2E Playwright (`so4-ad-preview.spec.ts`, `so4-public-link.spec.ts`,
  `so4-webhooks.spec.ts`) avec skip gracieux si seed/service indispo.

## Limitations connues

- L'apply réel des opérations AD est encore mock — la pipeline LDAP modify
  est planifiée pour W3-followup. Le UI flow preview/approve est complet.
- Les photos sont stockées sur le FS local ; le passage S3 réutilisera
  `signapps-storage` sans changer le contrat HTTP.
- L'ESLint `<img>` rule est suppressée localement dans `SmartAvatar` car
  `next/image` requiert un domain whitelist incompatible avec les
  DiceBear URLs externes utilisées en dev.
