# SO4 — Intégrations externes — Design Spec

**Scope :** AD sync diff visuel · Partage public / embed · Webhooks & notifications · Photos & avatars riches
**Durée :** 5 jours (2 waves)
**Branche :** `feature/so4-integrations`
**Dépendances :** SO1+SO2+SO3 mergés

---

## 1. Features

### IN1 — AD sync diff visuel

- **IN1.1** Endpoint `POST /org/ad/sync/:tenant_id/preview` → dry-run enrichi retournant `{adds: [...], removes: [...], moves: [...], conflicts: [...], sync_run_id}`. Différent de `/dry-run` existant : ne touche PAS `org_ad_sync_log`, calcule le diff en mémoire.
- **IN1.2** Endpoint `POST /org/ad/sync/:tenant_id/approve` body `{sync_run_id, selected_ops: [op_id]}` → applique UNIQUEMENT les opérations approuvées.
- **IN1.3** UI `/admin/active-directory/sync/preview` : nouveau bouton "Aperçu" → tableau 4 colonnes (Type, DN, Opération, Selected checkbox) groupé par section (ajouts/suppressions/moves/conflits). Footer "Appliquer N opérations" avec confirmation.
- **IN1.4** Conflits visualisés en rouge : case ambiguë (ex: node renommé ET déplacé) avec prompt de résolution (OrgWins/AdWins/Manual).

### IN2 — Partage public / embed

- **IN2.1** Nouvelle table `org_public_links(id, tenant_id, root_node_id, slug UNIQUE, visibility CHECK IN ('full','anon','compact'), allowed_origins TEXT[], expires_at, created_by_user_id, access_count INT DEFAULT 0, created_at)`.
- **IN2.2** Endpoint public non-authentifié `GET /public/org/:slug` → retourne JSON {nodes, persons} avec anonymisation selon visibility :
  - `full` : noms complets, emails, titres
  - `anon` : initiales uniquement, pas d'email, titres conservés
  - `compact` : juste nom du node + count persons, aucune donnée person
- **IN2.3** Endpoint `GET /public/org/:slug/embed.html` → page HTML autonome embeddable (orgchart responsive, style simple) + iframe-safe headers (CORS, `X-Frame-Options: ALLOWALL`).
- **IN2.4** CRUD `/org/public-links` pour admins : create/list/revoke + rotation slug.
- **IN2.5** UI `/admin/org-structure` onglet "Partage" : liste des liens actifs, bouton "Créer un lien public", dialog configure (racine + visibilité + expiration), copy-to-clipboard de l'URL + snippet `<iframe>`.

### IN3 — Webhooks & notifications org

- **IN3.1** Nouvelle table `org_webhooks(id, tenant_id, url, secret, events TEXT[], active, last_delivery_at, last_status INT, failure_count, created_at)`.
- **IN3.2** Events souscriptibles : `org.person.created|updated|deleted|moved|assigned`, `org.node.created|updated|deleted`, `org.delegation.created|expired`, `org.board.decision.created|approved`. Suit le pattern PgEventBus existant.
- **IN3.3** Dispatcher dans `services/signapps-webhooks` : à chaque event bus notif, fan-out HMAC-SHA256 signé vers les webhooks abonnés, retry exp 3 fois, dead-letter queue après 5 échecs consécutifs.
- **IN3.4** CRUD `/org/webhooks` + endpoint test `POST /org/webhooks/:id/test` qui envoie un payload factice.
- **IN3.5** UI `/admin/webhooks` : gestion liste + stats delivery + test button + log des 50 dernières deliveries. Cette page existe déjà (stub) — l'enrichir.

### IN4 — Photos & avatars riches

- **IN4.1** Extension person : colonne `photo_url TEXT NULL` sur `org_persons` (ou via `attributes.photo_url` existant). Décision : colonne dédiée + index.
- **IN4.2** Endpoint `POST /org/persons/:id/photo` multipart/form-data → upload vers storage FS/S3 (réutilise `signapps-storage`), retourne URL, met à jour `photo_url`.
- **IN4.3** Fallback : si pas de photo, générer avatar SVG côté frontend avec initiales + couleur (déjà fait via `avatarTint`). Utiliser `photo_url` quand présent.
- **IN4.4** Groupe photos : endpoint `POST /org/nodes/:id/group-photo` upload photo d'équipe, affichée dans detail panel.
- **IN4.5** UI : bouton "Upload photo" dans `people-tab.tsx` edit dialog + preview. `<Avatar>` component mis à jour pour prioriser `photo_url` > initiales.

---

## 2. Modèle données (migration 503)

```sql
-- Migration 503: SO4 integrations — public links, webhooks, photos

-- Public links
CREATE TABLE org_public_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    root_node_id UUID NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE,
    slug VARCHAR(64) UNIQUE NOT NULL,
    visibility VARCHAR(16) NOT NULL CHECK (visibility IN ('full','anon','compact')),
    allowed_origins TEXT[] NOT NULL DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    access_count INTEGER NOT NULL DEFAULT 0,
    created_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);
CREATE INDEX idx_public_links_tenant ON org_public_links(tenant_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_public_links_slug_active ON org_public_links(slug) WHERE revoked_at IS NULL;

-- Webhooks
CREATE TABLE org_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    url TEXT NOT NULL,
    secret VARCHAR(64) NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    last_delivery_at TIMESTAMPTZ,
    last_status INTEGER,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_webhooks_tenant_active ON org_webhooks(tenant_id, active);

CREATE TABLE org_webhook_deliveries (
    id BIGSERIAL PRIMARY KEY,
    webhook_id UUID NOT NULL REFERENCES org_webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    payload_json JSONB NOT NULL,
    status_code INTEGER,
    response_body TEXT,
    error_message TEXT,
    attempt INTEGER NOT NULL DEFAULT 1,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_webhook_deliveries_webhook ON org_webhook_deliveries(webhook_id, delivered_at DESC);

-- Photos
ALTER TABLE org_persons ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE org_nodes ADD COLUMN IF NOT EXISTS group_photo_url TEXT;

-- Audit
CREATE TRIGGER org_public_links_audit AFTER INSERT OR UPDATE OR DELETE ON org_public_links
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
CREATE TRIGGER org_webhooks_audit AFTER INSERT OR UPDATE OR DELETE ON org_webhooks
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
```

---

## 3. Waves

### Wave 1 (3j) — Backend AD preview + public + webhooks

- W1.T1 Migration 503 + tests
- W1.T2 Models + repos : `PublicLink`, `Webhook`, `WebhookDelivery`
- W1.T3 Handler `ad_preview.rs` (preview + approve endpoints)
- W1.T4 Handler `public_links.rs` + public endpoints (non-auth) + anonymisation renderer
- W1.T5 Handler `webhooks.rs` + dispatcher dans `signapps-webhooks` service (fan-out PgEventBus → HTTP POST avec HMAC)

### Wave 2 (2j) — Photos + frontend + merge

- W2.T6 Handler `photos.rs` (upload via storage service) + multipart
- W2.T7 Seeds : 2 webhooks demo + 1 public link actif + 10 persons Nexus avec photos URLs DiceBear (generated avatar service)
- W2.T8 Frontend AD preview page + public link dialog + webhooks admin page enrichie + photo upload dans edit dialog
- W2.T9 E2E Playwright (3 scénarios) + docs + merge

---

## 4. Sécurité

- **Public links** : refus si `revoked_at IS NOT NULL OR (expires_at IS NOT NULL AND expires_at < NOW())`. Log de chaque accès via `access_count++`.
- **Webhooks** : signature HMAC-SHA256 dans header `X-SignApps-Signature: sha256=<hex>`. Body = JSON payload + tenant_id + event_type + timestamp. Secret rotatable.
- **Anonymisation** : le niveau `anon` masque emails/phones et remplace noms par initiales. `compact` ne retourne QUE counts — aucune donnée PII.
- **Embed** : CORS `Access-Control-Allow-Origin: *` autorisé uniquement quand `allowed_origins = []` OU origin match. Sinon 403.

---

## 5. Exit criteria

- [ ] Migration 503, 3 nouvelles tables + 2 colonnes
- [ ] AD preview/approve fonctionnel (mock AD car dev box n'a pas de LDAP bindé)
- [ ] Public link `/public/org/:slug` non-authentifié retourne JSON filtré
- [ ] Embed HTML auto-contenu iframe-able
- [ ] Webhooks dispatch → test.webhook.site (ou mock) reçoit les events
- [ ] Photos upload + fallback avatar
- [ ] Clippy + TS clean, boot < 5s
- [ ] 3 E2E verts (ou skip propre)
- [ ] Merge main

---

**Fin spec SO4.**
