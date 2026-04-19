# SO1 — Fondations data org avancée — Design Spec

**Date :** 2026-04-19
**Scope :** Multi-axes enrichis · Positions & incumbents · Historique / time-travel · Délégations temporaires
**Durée estimée :** 8 jours (3 waves)
**Branche :** `feature/so1-foundations-data`
**Dépendances :** S1+S2+S3 mergés (org canonique + RBAC + seed Nexus Industries)

---

## 1. Contexte

L'org Nexus est en place (14 nodes, 81 persons, 83 assignments axis='structure'). 4 manques structurels pour les features avancées à venir (gouvernance, scale, mobile) :

1. **Multi-axes sous-utilisés** — la colonne `org_assignments.axis` accepte `structure | focus | group` mais seul `structure` est peuplé. Impossible aujourd'hui de modéliser un projet cross-team (focus) ou une commission (group).
2. **Pas de positions / postes** — une personne est directement rattachée à un node. Impossible de modéliser "3 Senior Dev, 1 poste ouvert" ni de séparer le siège de l'occupant.
3. **Zéro historique** — une fois une modification écrasée, elle est perdue. Pas de piste d'audit, pas de "rollback à la semaine dernière".
4. **Pas de délégations** — remplacer temporairement un manager (congés, sabbat) demande un swap manuel + risque d'oubli au retour.

SO1 pose les fondations data pour ces 4 axes. SO2-5 s'empilent dessus.

---

## 2. Objectifs mesurables

### F1 — Multi-axes

- **F1.1** Seed Nexus enrichi : 3 assignments `axis='focus'` (projets) et 2 `axis='group'` (committees), liés à des nodes "virtuels" (type `unit` avec slug `project-*` ou `committee-*`).
- **F1.2** API `GET /org/assignments` accepte `?axis=structure|focus|group` pour filtrer.
- **F1.3** UI `/admin/org-structure` : chip de filtre axe en toolbar. Les avatars sur les nodes ont un liseré coloré par axe (bleu=structure, violet=focus, ambre=group).
- **F1.4** Les 4 nodes "projet" et "committee" sont affichés en section dédiée de la sidebar (onglet "Focus & Comités") — pas dans l'arbre hiérarchique.

### F2 — Positions & incumbents

- **F2.1** Nouvelle table `org_positions(id, tenant_id, node_id, title, head_count, attributes, active)` — un poste typé par node, avec un nombre de sièges.
- **F2.2** Nouvelle table `org_position_incumbents(id, position_id, person_id, start_date, end_date, active)` — qui occupe quel siège.
- **F2.3** API CRUD : `/org/positions`, `/org/positions/:id/incumbents`.
- **F2.4** UI : nouvel onglet "Postes" sur le panneau droit d'un node → liste positions avec "N/M pourvus · K ouvert(s)". Bouton "Pourvoir" = créer incumbent depuis une person.
- **F2.5** Seed : 8 positions ouvertes (1 par OU top-level), dont 3 vacantes (head_count > incumbents).

### F3 — Historique / time-travel

- **F3.1** Nouvelle table `org_audit_log(id, tenant_id, actor_user_id, entity_type, entity_id, action, diff_json, at)`.
- **F3.2** Triggers SQL automatiques sur `org_nodes`, `org_persons`, `org_assignments`, `org_positions`, `org_position_incumbents` — chaque INSERT/UPDATE/DELETE écrit un row audit.
- **F3.3** API `GET /org/history?entity_type=X&entity_id=Y` → historique pour une entité.
- **F3.4** API `GET /org/nodes?tenant_id=X&at=2026-03-01T00:00Z` → vue de l'org à une date. Implémentation : requête jointe avec `org_audit_log` replay.
- **F3.5** UI : slider date dans la toolbar. Mode read-only quand date ≠ maintenant (toolbar grisée, badge "Vue 2026-03-01"). "Retour à aujourd'hui" bouton.

### F4 — Délégations temporaires

- **F4.1** Nouvelle table `org_delegations(id, tenant_id, delegator_person_id, delegate_person_id, node_id, scope, start_at, end_at, reason, active)`. Scope = `manager` (reprend responsabilités is_primary) ou `rbac` (copie permissions).
- **F4.2** API CRUD `/org/delegations` + action `/org/delegations/:id/revoke`.
- **F4.3** Cron auto-expire : scheduler tick 1h → marque active=false quand end_at < NOW.
- **F4.4** UI : bouton "Déléguer" sur la fiche personne. Dialog : choisir délégataire, période, scope, raison. Badge orange "Délégation en cours" sur l'avatar du delegator.
- **F4.5** RBAC middleware : quand une délégation active existe pour scope=rbac, l'OrgClient résolveur étend les permissions au delegate pendant la période.

---

## 3. Architecture

### 3.1 Modèle de données (migration 500)

```sql
-- Migration 500: SO1 foundations — positions, audit log, delegations, focus nodes

-- Positions
CREATE TABLE org_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    head_count INTEGER NOT NULL DEFAULT 1 CHECK (head_count >= 0),
    attributes JSONB NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_org_positions_node ON org_positions(node_id);
CREATE INDEX idx_org_positions_tenant ON org_positions(tenant_id);

CREATE TABLE org_position_incumbents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_id UUID NOT NULL REFERENCES org_positions(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(position_id, person_id, start_date)
);
CREATE INDEX idx_org_pos_incumbents_position ON org_position_incumbents(position_id);
CREATE INDEX idx_org_pos_incumbents_person ON org_position_incumbents(person_id);

-- Audit log
CREATE TABLE org_audit_log (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    actor_user_id UUID,
    entity_type VARCHAR(32) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(16) NOT NULL CHECK (action IN ('insert','update','delete')),
    diff_json JSONB NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_org_audit_entity ON org_audit_log(entity_type, entity_id, at DESC);
CREATE INDEX idx_org_audit_tenant_at ON org_audit_log(tenant_id, at DESC);

-- Generic audit trigger (fires on 5 tables)
CREATE OR REPLACE FUNCTION org_audit_trigger() RETURNS TRIGGER AS $$
DECLARE
    v_entity_type VARCHAR := TG_TABLE_NAME;
    v_entity_id UUID;
    v_tenant UUID;
    v_diff JSONB;
    v_action VARCHAR := LOWER(TG_OP);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_entity_id := OLD.id;
        v_tenant := OLD.tenant_id;
        v_diff := to_jsonb(OLD);
    ELSE
        v_entity_id := NEW.id;
        v_tenant := NEW.tenant_id;
        IF TG_OP = 'UPDATE' THEN
            v_diff := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
        ELSE
            v_diff := to_jsonb(NEW);
        END IF;
    END IF;

    INSERT INTO org_audit_log (tenant_id, entity_type, entity_id, action, diff_json)
    VALUES (v_tenant, v_entity_type, v_entity_id, v_action, v_diff);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER org_nodes_audit AFTER INSERT OR UPDATE OR DELETE ON org_nodes
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
CREATE TRIGGER org_persons_audit AFTER INSERT OR UPDATE OR DELETE ON org_persons
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
CREATE TRIGGER org_assignments_audit AFTER INSERT OR UPDATE OR DELETE ON org_assignments
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
CREATE TRIGGER org_positions_audit AFTER INSERT OR UPDATE OR DELETE ON org_positions
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
CREATE TRIGGER org_pos_incumbents_audit AFTER INSERT OR UPDATE OR DELETE ON org_position_incumbents
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();

-- Delegations
CREATE TABLE org_delegations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    delegator_person_id UUID NOT NULL REFERENCES org_persons(id),
    delegate_person_id UUID NOT NULL REFERENCES org_persons(id),
    node_id UUID REFERENCES org_nodes(id),
    scope VARCHAR(16) NOT NULL CHECK (scope IN ('manager','rbac','all')),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    reason TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (start_at < end_at),
    CHECK (delegator_person_id <> delegate_person_id)
);
CREATE INDEX idx_org_delegations_active ON org_delegations(delegator_person_id, active) WHERE active;
CREATE INDEX idx_org_delegations_delegate ON org_delegations(delegate_person_id, active) WHERE active;
CREATE INDEX idx_org_delegations_tenant_end ON org_delegations(tenant_id, end_at) WHERE active;
```

### 3.2 Repository layer (Rust)

3 nouveaux modules dans `crates/signapps-db/src/models/org/` :
- `position.rs` + `position_incumbent.rs` — avec structs + sqlx::FromRow
- `audit.rs` — model `AuditLogEntry` + `AuditRepository` avec méthodes `list_for_entity(type, id)`, `snapshot_at(tenant, at)` pour le time-travel
- `delegation.rs` — `DelegationRepository` avec `active_for_person(person_id)`, `expire_due(now)`, `create/revoke`

### 3.3 Service layer (signapps-org)

3 nouveaux handlers dans `services/signapps-org/src/handlers/` :
- `positions.rs` — CRUD positions + incumbents (POST body = {title, head_count, node_id})
- `history.rs` — `GET /org/history?entity_type=X&entity_id=Y` + overload sur `/org/nodes?at=...` via middleware qui intercepte le param
- `delegations.rs` — CRUD + `/revoke/:id` + cron setup

### 3.4 Time-travel implementation

**Approche retenue : snapshot reconstruit au runtime**, pas de table snapshot séparée.

Pour une requête `?at=YYYY-MM-DD` :
1. Récupérer l'état courant de chaque entité filtré par tenant.
2. Pour chaque row, si row.updated_at > at, chercher dans `org_audit_log` le diff précédent et reverse-apply.
3. Si row n'existait pas encore (created_at > at), l'exclure.
4. Résolver les entités soft-deletées en les ré-incluant depuis l'audit.

Coût acceptable pour un admin dashboard (lecture ponctuelle, pas hot path). Cache 5min par `(tenant, at)` via moka.

### 3.5 Cron scheduler

Utilise le `scheduler` existant (port 3007). Nouveau job `so1_expire_delegations` :
- Fréquence : toutes les 15 minutes
- Query : `UPDATE org_delegations SET active=false WHERE active AND end_at < NOW()`
- Écrit un event `org.delegation.expired` sur le PgEventBus pour consumers (notifications).

### 3.6 RBAC extension

`OrgClient::resolve(user_id, action, resource)` dans `signapps-org/src/rbac_client.rs` est étendu :
- Avant check permissions classique, vérifier `org_delegations WHERE delegate_person_id = (SELECT person_id FROM identity.users WHERE id=user_id) AND active AND NOW() BETWEEN start_at AND end_at AND scope IN ('rbac','all')`.
- Si délégation active : ajouter les permissions du `delegator_person_id` à l'union.

---

## 4. Waves & découpage

### Wave 1 (3 jours) — Modèle + repos + positions

- W1.T1 Migration 500 + tests checksum
- W1.T2 Models Rust : `Position`, `PositionIncumbent`, `AuditLogEntry`, `Delegation` + repos + tests unitaires
- W1.T3 Seed enrichi : 3 focus nodes (projets), 2 group nodes (committees), 8 positions, 5 delegations démo (dont 2 actives, 3 expirées)
- W1.T4 Handlers `positions.rs` : CRUD + incumbents + utoipa + tests intégration

### Wave 2 (3 jours) — History + delegations + multi-axes

- W2.T5 Handler `history.rs` + middleware `?at=` sur `/org/nodes` + `/org/persons`
- W2.T6 Handler `delegations.rs` + cron job expire
- W2.T7 RBAC extension : `OrgClient::resolve` lit les délégations actives + test RBAC
- W2.T8 Multi-axes : API filter `?axis=`, seed focus/group nodes, visualisation axe sur nodes tree

### Wave 3 (2 jours) — Frontend + polish + merge

- W3.T9 Frontend : toolbar chip axe + slider date time-travel + badge "Vue passée"
- W3.T10 Frontend : onglet "Postes" sur detail panel + dialog "Créer position/Pourvoir"
- W3.T11 Frontend : dialog "Déléguer" sur fiche personne + badge "Délégation en cours" + liste délégations actives dans sidebar
- W3.T12 E2E Playwright (3 scénarios) + docs product-spec + debug skill + merge

---

## 5. Tests & validation

**Rust :**
- `cargo test -p signapps-db` — tests repositories (positions, incumbents, audit, delegations)
- `cargo test -p signapps-org` — tests handlers + time-travel snapshot
- `cargo test -p signapps-integration-tests --test delegation_rbac` — nouveau test RBAC avec délégation

**Playwright :**
- `so1-positions.spec.ts` — créer position, pourvoir incumbent, voir "N/M pourvus"
- `so1-time-travel.spec.ts` — modifier un node, slider date vers passé, voir l'ancien état
- `so1-delegations.spec.ts` — déléguer de Marie vers Jean, vérifier badge + accès RBAC étendu

**Boot + budget** : test `boot.rs` stay < 5s. Audit triggers ajoutent ~50ms au seed mais restent dans le budget.

---

## 6. Risques & mitigations

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| Audit triggers ralentissent les writes org | Moyen | Index sur audit_log limités, diff_json compressé, partitionnement par mois en phase 2 |
| Time-travel reverse-apply buggy sur cascades | Haut | Tests avec scénarios multi-updates, cache 5min, "preview only" mode |
| Délégation avec scope='rbac' crée escalade privilège | Critique | Check que delegate n'a pas déjà des permissions > delegator, log systématique, UI warning |
| Seed casse si table positions absente | Faible | Best-effort par seeder (pattern déjà établi), logs warning |
| Migration 500 trop grosse | Moyen | Splitter en 500a/b/c si >200 lignes — acceptable ici ~180 lignes |

---

## 7. Critères de sortie

- [ ] Migration 500 appliquée, 3 nouvelles tables
- [ ] 5 entités auditées automatiquement
- [ ] Time-travel `/org/nodes?at=YYYY-MM-DD` retourne état passé
- [ ] 8 positions seed + 5 délégations démo
- [ ] Playwright 3 scénarios verts
- [ ] Boot < 5s maintenu
- [ ] Doc `docs/product-specs/NN-so1-foundations.md` + debug skill
- [ ] Merge sur main

---

## 8. Livrables

**Code :**
- `migrations/500_so1_foundations.sql`
- `crates/signapps-db/src/models/org/{position,position_incumbent,audit,delegation}.rs` + `src/repositories/org/*.rs`
- `services/signapps-org/src/handlers/{positions,history,delegations}.rs`
- `services/signapps-org/src/rbac_client.rs` (extension delegation resolve)
- `services/signapps-seed/src/seeders/{positions,delegations,focus_nodes}.rs`
- `client/src/lib/api/org.ts` (extensions positions/history/delegations)
- `client/src/app/admin/org-structure/components/{positions-tab,time-travel-slider,delegation-dialog}.tsx`
- `client/e2e/so1-*.spec.ts` (3 spécifications)

**Docs :**
- `docs/product-specs/56-so1-foundations.md`
- `.claude/skills/org-foundations-debug/SKILL.md`
- CHANGELOG

**Fin spec SO1.**
