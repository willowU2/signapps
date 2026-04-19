# SO2 — Gouvernance & Permissions — Design Spec

**Scope :** RBAC visualizer · RACI matrix · Boards enrichis
**Durée :** 6 jours (2 waves)
**Branche :** `feature/so2-governance`
**Dépendances :** SO1 mergée (positions + delegations + history)

---

## 1. Features

### G1 — RBAC Visualizer

- **G1.1** Endpoint `GET /org/rbac/effective?user_id=X&resource=Y` → JSON permissions + source (direct / inherited from node / from role / from delegation)
- **G1.2** Endpoint `GET /org/rbac/person/:id` → map complète "qui peut faire quoi" pour une person
- **G1.3** Simulateur `POST /org/rbac/simulate` body `{user_id, action, resource}` → returns `{allowed, reason, chain}`
- **G1.4** UI panneau latéral "Permissions effectives" sur fiche person : tree view des actions avec sources colorées
- **G1.5** UI bouton "Simuler" dans header du panel → dialog avec dropdown action/resource → result card avec chain visible

### G2 — RACI Matrix

- **G2.1** Nouvelle table `org_raci(id, tenant_id, project_id, person_id, role CHECK IN ('responsible','accountable','consulted','informed'), created_at)`
- **G2.2** "project" = node avec `attributes.axis_type='project'` (réutilise les focus nodes de SO1)
- **G2.3** API CRUD `/org/raci?project_id=X` → list + POST + DELETE (bulk assignment supporté)
- **G2.4** UI nouveau onglet "RACI" sur un focus node : matrix Projet × Personnes avec radios R/A/C/I (+ none). A est unique par projet (accountable = owner)
- **G2.5** Seed : 2 projets Nexus (Project Phoenix, Project Titan) avec RACI assigné sur 8-10 personnes chacun

### G3 — Boards enrichis

- **G3.1** Nouvelle table `org_board_decisions(id, board_id, title, description, status CHECK IN ('proposed','approved','rejected','deferred'), decided_at, decided_by_person_id, attributes JSONB)`
- **G3.2** Nouvelle table `org_board_votes(id, decision_id, person_id, vote CHECK IN ('for','against','abstain'), rationale, voted_at)`
- **G3.3** API CRUD `/org/boards/:id/decisions` + `/decisions/:id/votes`
- **G3.4** UI nouveau onglet "Décisions" sur un board node : timeline des décisions avec votes par personne + bouton "Nouvelle décision"
- **G3.5** Seed : 4 décisions démo (2 approved, 1 rejected, 1 deferred) avec 12 votes répartis

---

## 2. Modèle données (migration 501)

```sql
-- Migration 501: SO2 governance — raci, board decisions, board votes

CREATE TABLE org_raci (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    project_id UUID NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL CHECK (role IN ('responsible','accountable','consulted','informed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, person_id, role)
);
CREATE UNIQUE INDEX idx_raci_one_accountable
    ON org_raci(project_id) WHERE role = 'accountable';
CREATE INDEX idx_raci_project ON org_raci(project_id);
CREATE INDEX idx_raci_person ON org_raci(person_id);

CREATE TABLE org_board_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL REFERENCES org_boards(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'proposed'
        CHECK (status IN ('proposed','approved','rejected','deferred')),
    decided_at TIMESTAMPTZ,
    decided_by_person_id UUID REFERENCES org_persons(id),
    attributes JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_decisions_board ON org_board_decisions(board_id);
CREATE INDEX idx_decisions_status ON org_board_decisions(status);

CREATE TABLE org_board_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID NOT NULL REFERENCES org_board_decisions(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES org_persons(id),
    vote VARCHAR(8) NOT NULL CHECK (vote IN ('for','against','abstain')),
    rationale TEXT,
    voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(decision_id, person_id)
);
CREATE INDEX idx_votes_decision ON org_board_votes(decision_id);
CREATE INDEX idx_votes_person ON org_board_votes(person_id);

-- Audit triggers (3 new tables)
CREATE TRIGGER org_raci_audit AFTER INSERT OR UPDATE OR DELETE ON org_raci
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
CREATE TRIGGER org_decisions_audit AFTER INSERT OR UPDATE OR DELETE ON org_board_decisions
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
CREATE TRIGGER org_votes_audit AFTER INSERT OR UPDATE OR DELETE ON org_board_votes
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
```

---

## 3. RBAC Visualizer — algo

Pour `GET /org/rbac/person/:id` :
1. Résoudre `person.user_id` → user
2. Lister ses **direct** permissions via `user_roles` ou équivalent
3. Remonter les **node roles** : pour chaque assignment axis='structure', collecter les policies attachées au node + ancêtres
4. Appliquer les **delegations** actives (réutilise `DelegationRepository::list_active_for_delegate`)
5. Sortir JSON : `[{action, resource, source: {type: 'direct'|'node'|'role'|'delegation', ref_id, ref_name}}]`

Pour simulate : même algo + check si l'action demandée apparaît dans le résultat.

Cache moka (5 min) sur résultats par `(person_id, sigkey_des_sources)` pour éviter recalcul.

---

## 4. Waves

### Wave 1 (3j) — Backend

- W1.T1 Migration 501 + test checksum
- W1.T2 Models & repos : `Raci`, `BoardDecision`, `BoardVote` avec FromRow + rustdoc
- W1.T3 Handler `rbac.rs` : effective + simulate + cache moka
- W1.T4 Handler `raci.rs` : CRUD + bulk assign + contrainte "1 accountable par projet"
- W1.T5 Handler `decisions.rs` (extension `boards.rs`) : CRUD decisions + votes

### Wave 2 (3j) — Frontend + seed + merge

- W2.T6 Seed : 2 projets RACI × 10 persons, 4 décisions avec votes
- W2.T7 UI RBAC visualizer panel + simulateur dialog
- W2.T8 UI RACI matrix (radios dans un onglet de focus node)
- W2.T9 UI Boards decisions timeline + dialog "Nouvelle décision" + vote UI
- W2.T10 E2E Playwright (3 scénarios) + docs + merge

---

## 5. Exit criteria

- [ ] Migration 501 appliquée, 3 tables + 3 triggers
- [ ] `/org/rbac/person/:id` retourne chain complète
- [ ] RACI matrix édite R/A/C/I, 1 accountable max par projet
- [ ] Boards : 4 décisions seed visibles avec votes
- [ ] Clippy + TS clean, boot < 5s
- [ ] 3 E2E verts
- [ ] Merge main

---

**Fin spec SO2.**
