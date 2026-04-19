# SO3 — Scale & Power tools — Design Spec

**Scope :** Templates d'org · Headcount planning · Skills & compétences · Recherche globale + bulk ops
**Durée :** 7 jours (3 waves)
**Branche :** `feature/so3-scale-power`
**Dépendances :** SO1 (positions, history) + SO2 (raci) mergés

---

## 1. Features

### SP1 — Templates d'org

- **SP1.1** Nouvelle table `org_templates(id, slug UNIQUE, name, description, industry, size_range, spec_json JSONB, is_public, created_by_tenant_id)`. `spec_json` contient la hiérarchie {nodes, positions, raci_patterns}.
- **SP1.2** 4 templates built-in seedés au boot : `startup-20`, `scale-up-saas-80`, `eti-industrielle-300`, `agency-50`.
- **SP1.3** API `GET /org/templates` + `GET /org/templates/:slug` + `POST /org/templates/:slug/clone?target_node_id=X` (crée l'arbo à partir du template).
- **SP1.4** UI : modal "Créer depuis template" accessible depuis `/admin/org-structure` bouton header. Picker template + preview + target parent + go.

### SP2 — Headcount planning

- **SP2.1** Nouvelle table `org_headcount_plan(id, tenant_id, node_id, target_head_count, target_date, notes, created_at)`. Un plan par node et par trimestre/année (pas de PK unique, on supporte plusieurs plans à horizons différents).
- **SP2.2** Computation : comparer `SUM(positions.head_count)` vs `COUNT(incumbents active)` vs `target_head_count` → status = `on_track | understaffed | over_plan`.
- **SP2.3** API `GET /org/headcount?tenant_id=X` → rollup par node avec current/target/gap. `POST /org/headcount` pour créer plan. `PUT /org/headcount/:id`.
- **SP2.4** UI : nouvel onglet "Effectifs" sur detail panel → vue tableau : filled/head_count, target trimestriel, gap coloré. Bouton "Éditer plan" ouvre dialog.
- **SP2.5** Dashboard Admin `/admin/headcount` : vue synthétique tenant-wide, bar chart par OU, liste "postes ouverts" globale.

### SP3 — Skills & compétences

- **SP3.1** Nouvelle table `org_skills(id, tenant_id, slug UNIQUE, name, category, description)`.
- **SP3.2** Nouvelle table `org_person_skills(person_id, skill_id, level CHECK IN (1,2,3,4,5), endorsed_by_person_id NULL, created_at, PRIMARY KEY (person_id, skill_id))`.
- **SP3.3** 40 skills seedés : tech (Python, Rust, React, AWS, Docker…), soft (Leadership, Communication, Mentoring…), languages (English, German, Spanish…), domains (SaaS, Healthcare, FinTech…).
- **SP3.4** API `GET /org/skills` + `POST /org/persons/:id/skills` body `{skill_id, level}` + `DELETE`.
- **SP3.5** UI : section "Compétences" sur fiche person (éditable) + panneau "Skill gaps" par node (écart à cible par skill si définie au niveau OU).

### SP4 — Recherche globale + bulk ops

- **SP4.1** Endpoint `GET /org/search?q=<query>&tenant_id=X&limit=20` → full-text sur persons (name/email/title), nodes (name/slug), skills. Priorisation exact > prefix > fuzzy.
- **SP4.2** UI omnibox `⌘K` (Cmd+K) accessible partout → dialog de recherche rapide avec ranking. Clic sur result = navigate vers page détail.
- **SP4.3** Bulk select sur la page `/admin/persons` : checkboxes row + footer sticky "N sélectionné(s)" avec boutons "Déplacer vers OU…", "Assigner rôle…", "Exporter CSV", "Mailer le lot".
- **SP4.4** API `POST /org/bulk/move` body `{person_ids: [], target_node_id, axis='structure'}` → crée assignments en batch.

---

## 2. Modèle données (migration 502)

```sql
-- Migration 502: SO3 scale & power — templates, headcount, skills

CREATE TABLE org_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    industry VARCHAR(64),
    size_range VARCHAR(32),
    spec_json JSONB NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_tenant_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_templates_industry ON org_templates(industry);

CREATE TABLE org_headcount_plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    node_id UUID NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE,
    target_head_count INTEGER NOT NULL CHECK (target_head_count >= 0),
    target_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_headcount_tenant_node ON org_headcount_plan(tenant_id, node_id, target_date);

CREATE TABLE org_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    slug VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(32) NOT NULL CHECK (category IN ('tech','soft','language','domain')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, slug)
);
CREATE INDEX idx_skills_category ON org_skills(category);

CREATE TABLE org_person_skills (
    person_id UUID NOT NULL REFERENCES org_persons(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES org_skills(id) ON DELETE CASCADE,
    level SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 5),
    endorsed_by_person_id UUID REFERENCES org_persons(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (person_id, skill_id)
);

-- Audit triggers
CREATE TRIGGER org_templates_audit AFTER INSERT OR UPDATE OR DELETE ON org_templates
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
CREATE TRIGGER org_headcount_audit AFTER INSERT OR UPDATE OR DELETE ON org_headcount_plan
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
CREATE TRIGGER org_person_skills_audit AFTER INSERT OR UPDATE OR DELETE ON org_person_skills
    FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();

-- Full-text search prep
CREATE INDEX idx_persons_fts ON org_persons USING gin (
    to_tsvector('simple', coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(email,''))
);
CREATE INDEX idx_nodes_fts ON org_nodes USING gin (
    to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(slug,''))
);
```

---

## 3. Waves

### Wave 1 (3j) — Backend fondations

- W1.T1 Migration 502 + test checksum + indexes FTS
- W1.T2 Models + repos : `Template`, `HeadcountPlan`, `Skill`, `PersonSkill`
- W1.T3 Handlers `templates.rs` + `headcount.rs` (CRUD)
- W1.T4 Handlers `skills.rs` (skills CRUD + person skills) + `search.rs` (FTS omnibox)

### Wave 2 (3j) — Seeds + bulk + frontend data-layer

- W2.T5 Seed 4 templates built-in + 40 skills catalogue + tagger 30 persons Nexus avec 3-5 skills chacune
- W2.T6 Seed headcount plans : 8 plans (1 par OU top) à +90j
- W2.T7 Handler `bulk.rs` (move + export CSV) + extensions orgApi client
- W2.T8 UI omnibox ⌘K + hook `useGlobalSearch`

### Wave 3 (1j) — Frontend + merge

- W3.T9 UI onglet "Compétences" sur person card + onglet "Effectifs" sur node card + dialog template cloner
- W3.T10 UI bulk select sur `/admin/persons` + dashboard `/admin/headcount`
- W3.T11 E2E Playwright (4 scénarios) + docs + merge

---

## 4. Exit criteria

- [ ] Migration 502 appliquée, 4 tables + FTS indexes
- [ ] 4 templates + 40 skills + 30 persons tagged + 8 headcount plans seedés
- [ ] ⌘K search retourne persons+nodes+skills en <100ms
- [ ] Bulk move 5 persons fonctionne
- [ ] Clippy + TS clean, boot < 5s
- [ ] 4 E2E verts
- [ ] Merge main

---

**Fin spec SO3.**
