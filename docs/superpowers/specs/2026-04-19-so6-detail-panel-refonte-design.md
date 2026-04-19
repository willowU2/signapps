# SO6 — Refonte DetailPanel org-structure (UI/UX + configurable) — Design Spec

**Scope :** Refonte complète du panneau droit `/admin/org-structure` : unifié Node/Person · Hero + 5 tabs + overflow · Configurable par rôle avec widgets custom · Intégration complète SO1-SO5
**Durée :** 6 jours (3 waves)
**Branche :** `feature/so6-detail-panel-refonte`
**Dépendances :** SO1-SO5 mergés

---

## 1. Problème

Le `DetailPanel` actuel (`client/src/app/admin/org-structure/components/detail-panel.tsx`, 462 lignes) a :
- ~20 tabs en 3 catégories — dense, hiérarchie peu claire
- Plusieurs tabs stub (Groups, Sites, DNS, DHCP, Kerberos, Certificates, NTP, Deployment) polluent la liste
- Pas de mode Person — quand on clique sur un avatar, aucun contexte ne s'ouvre
- Les features SO2-SO5 sont dispersées : Skills sur fiche perso ailleurs, RBAC viz séparé, Positions tab OK mais Decisions noyé, Photos uniquement dans edit dialog
- Zéro configurabilité : tous les users voient la même soupe, même un CEO qui n'a pas besoin de voir GPO/Kerberos

## 2. Vision cible

**Un panneau unifié, contextuel, configurable, avec intégration complète SO1-SO5.**

- **Hero card** toujours visible : 25% de la hauteur, contient l'essentiel (avatar/icône + nom + sous-titre + 3-4 quick actions + 2-3 KPI cards)
- **5 tabs principaux** sous le hero : icône + label, le reste va dans un "…" overflow menu
- **Tabs contextuels** : le set change selon l'entité sélectionnée (Node vs Person)
- **Personnalisation admin** : page `/admin/settings/panel-layout` où l'admin définit, **par rôle**, quels tabs sont visibles + leur ordre + widgets custom
- **Widgets custom** : en plus des tabs standard, l'admin peut ajouter des cards KPI, embeds iframe, liens externes

## 3. Features

### P1 — Hero card

**Mode Node :**
- Icône kind (couleur du config) + Nom (H2) + Kind badge
- Sous-titre : ancestor breadcrumb (`Nexus › Engineering › Platform Team`)
- KPI cards (3) : Effectif (N/target), Postes ouverts, Nb projets RACI
- Quick actions : `+ Ajouter enfant`, `Déplacer`, `Éditer`, `Supprimer`

**Mode Person :**
- Avatar 96x96 (photo ou initiales tint) + Nom (H2) + Titre (H3)
- Sous-titre : node principal + email
- KPI cards (3) : Skills top 3 (badges), Assignments actifs (N), Permissions level
- Quick actions : `Tel`, `Mail`, `Chat`, `Meet`, `Éditer`

### P2 — 5 tabs principaux (par rôle)

**Default Admin / Node :**
1. Personnes (PeopleTab enrichi avec photo, drag-drop)
2. Postes (PositionsTab SO1)
3. Gouvernance (Board + Decisions + RACI fusionnés en 3 sections collapsibles)
4. Effectifs (HeadcountTab + skill gaps)
5. Audit (timeline org_audit_log)

**Default Admin / Person :**
1. Profil (edit + photo upload)
2. Affectations (nodes + axes tableau)
3. Compétences (SO3 skills avec level)
4. Permissions (RBAC viz SO2)
5. Délégations (actives + historique)

**Default Manager** : réduit à Personnes+Postes+Effectifs | Profil+Affectations+Compétences
**Default Viewer** : read-only, juste Personnes | Profil+Compétences

### P3 — Overflow "…" menu

Accueille le reste : GPO, Ordinateurs, DNS, DHCP, Kerberos, Certificats, NTP, Déploiement, Politiques, Groupes, Sites, Délégations (en mode Node seulement sous admin), Boards standalone, Audit personne, Public links.

Comportement : clic sur "…" → dropdown scrollable → clic sur un item = bascule l'onglet actif sur cet item (hors du set principal). Les tabs cachés en overflow apparaissent en tête de liste si utilisés récemment.

### P4 — Configuration par rôle (admin)

- Nouvelle table `org_panel_layouts(id, tenant_id, role VARCHAR CHECK IN ('admin','manager','viewer'), entity_type VARCHAR CHECK IN ('node','person'), config JSONB, updated_by_user_id, updated_at)`. `config` schéma :
  ```json
  {
    "main_tabs": [
      {"type": "builtin", "id": "people", "position": 0},
      {"type": "widget", "widget_type": "kpi_card", "config": {"metric": "headcount", "label": "Effectif"}, "position": 1},
      {"type": "builtin", "id": "positions", "position": 2}
    ],
    "hidden_tabs": ["gpo", "kerberos", "dns"],
    "hero_quick_actions": ["add_child", "edit"],
    "hero_kpis": [{"type": "builtin", "id": "headcount"}, {"type": "custom", "expression": "SELECT ..."}]
  }
  ```
- Page admin `/admin/settings/panel-layout` : interface drag-drop des tabs entre "Main (max 5)" / "Overflow" / "Hidden", sélecteur widgets custom, preview live du rendu.
- Widgets custom disponibles (V1) :
  - `kpi_card` : compteur (metric = headcount | positions_open | delegations_active | audit_events_week)
  - `iframe_embed` : URL externe (docs interne, dashboard Grafana)
  - `link_list` : liste de liens custom (onboarding, wiki, policies)
  - `markdown_note` : texte markdown admin-friendly

### P5 — Nettoyage tabs stubs

- Les tabs stubs retournent `[]` et affichent "Cette fonctionnalité n'est pas encore disponible" au lieu du contenu vide.
- **Visibility rules** : tabs hérités legacy (GPO, Kerberos, DNS, DHCP, NTP) **cachés par défaut** dans les 3 rôles seed. L'admin peut les activer pour admin role si besoin.
- Supprime les tabs Groups/Sites si stub vide (orgApi retourne `[]` par design).

---

## 4. Architecture

### 4.1 Composants frontend (refacto du DetailPanel)

```
client/src/app/admin/org-structure/components/detail-panel/
  index.tsx              # container top-level, lit config layout, switch Node/Person
  hero-card.tsx          # hero contextuel (props: entity, kpis, actions)
  main-tabs.tsx          # 5 tabs principaux + overflow menu (shadcn Tabs + DropdownMenu)
  person-hero.tsx        # variant Hero pour Person (avatar + quick-call buttons)
  node-hero.tsx          # variant Hero pour Node (icon + metrics)
  tab-renderer.tsx       # dispatch {builtin | widget} -> component
  widgets/
    kpi-card-widget.tsx
    iframe-widget.tsx
    link-list-widget.tsx
    markdown-note-widget.tsx
  hooks/
    usePanelLayout.ts    # fetch config selon role + entityType, cache moka-style côté client
```

Le fichier `detail-panel.tsx` actuel est découpé en ces sous-composants (< 200 lignes chacun).

### 4.2 Page admin layout

```
client/src/app/admin/settings/panel-layout/
  page.tsx               # landing, role + entityType selector
  layout-editor.tsx      # drag-drop principal (dnd-kit déjà dans deps)
  widget-picker.tsx      # dialog ajout widget
  widget-config-form.tsx # form dynamique par widget type
  live-preview.tsx       # mini DetailPanel rendu à droite
```

### 4.3 Backend

Migration 504 + handlers simples :

```sql
CREATE TABLE org_panel_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('admin','manager','viewer')),
  entity_type VARCHAR(16) NOT NULL CHECK (entity_type IN ('node','person')),
  config JSONB NOT NULL,
  updated_by_user_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, role, entity_type)
);
CREATE INDEX idx_panel_layouts_tenant ON org_panel_layouts(tenant_id);

-- Audit trigger (réutilise org_audit_trigger existant)
CREATE TRIGGER org_panel_layouts_audit AFTER INSERT OR UPDATE OR DELETE ON org_panel_layouts
  FOR EACH ROW EXECUTE FUNCTION org_audit_trigger();
```

**Handlers** :
- `GET /org/panel-layouts?role=X&entity_type=Y` → config ou default
- `PUT /org/panel-layouts/:role/:entity_type` → upsert (admin only via RBAC)
- `POST /org/panel-layouts/:role/:entity_type/reset` → supprime pour revenir au default

**Defaults hardcoded** côté Rust (pas en DB) : 6 layouts de base (3 rôles × 2 entity_types), renvoyés si aucune row custom.

### 4.4 Widgets runtime

Chaque widget custom est un composant React auto-contenu. Le renderer dispatche sur `widget_type` :

```tsx
function TabRenderer({ item, ctx }: Props) {
  if (item.type === 'builtin') return <BuiltinTab id={item.id} ctx={ctx} />;
  switch (item.widget_type) {
    case 'kpi_card': return <KpiCardWidget config={item.config} ctx={ctx} />;
    case 'iframe_embed': return <IframeWidget config={item.config} />;
    case 'link_list': return <LinkListWidget config={item.config} />;
    case 'markdown_note': return <MarkdownNoteWidget config={item.config} />;
    default: return <UnknownWidget type={item.widget_type} />;
  }
}
```

Les widgets KPI interrogent une API `GET /org/panel-layouts/metrics?metric=X&entity_id=Y` qui renvoie `{value, label, trend?}`.

### 4.5 Résolution de rôle utilisateur

Le rôle effectif d'un user = `identity.users.role` (0=viewer, 1=editor/manager, 2=admin, 3=superadmin). Mapping :
- superadmin → layouts `admin`
- admin → layouts `admin`
- editor/manager → layouts `manager`
- viewer → layouts `viewer`

---

## 5. Waves

### Wave 1 (2j) — Backend + migration + refacto base

- W1.T1 Migration 504 + test
- W1.T2 Model + repo `PanelLayout`, default layouts hardcoded (6 combinaisons)
- W1.T3 Handler `panel_layouts.rs` (get + upsert + reset) + handler métriques KPI
- W1.T4 Découpe `detail-panel.tsx` en sous-composants (`index.tsx`, `hero-card.tsx`, `main-tabs.tsx`, `node-hero.tsx`, `person-hero.tsx`, `tab-renderer.tsx`) sans changer le rendu (refactor safe)

### Wave 2 (2j) — Hero + unified mode Node/Person + widgets

- W2.T5 Hero card Node + KPIs live (headcount, positions open, RACI count)
- W2.T6 Hero card Person + quick actions tel/mail/chat/meet, support photo
- W2.T7 Mode Person : sélection d'un avatar dans tree/orgchart ouvre le panel en mode Person (sidebar gauche reste Node tree)
- W2.T8 Widgets : KpiCard, Iframe, LinkList, MarkdownNote
- W2.T9 Hook `usePanelLayout` + résolution rôle + fetch layout + cache 2min

### Wave 3 (2j) — Admin page + polish + merge

- W3.T10 Seed 6 layouts defaults + démo tenant Nexus (admin/node minimal, manager/person custom avec kpi widget)
- W3.T11 Page `/admin/settings/panel-layout` : layout-editor dnd-kit + widget-picker + live-preview
- W3.T12 Nettoyage tabs stubs : masquer par défaut GPO/Kerberos/DNS/DHCP/NTP/Certificates/Deployment (dans layouts admin hardcoded). Afficher "Pas encore disponible" dans tab stub plutôt que vide.
- W3.T13 E2E Playwright (3 scénarios) + docs + merge

---

## 6. Exit criteria

- [ ] Panel unifié Node↔Person fonctionnel
- [ ] Hero card avec 3 KPIs + quick actions contextuelles
- [ ] 5 tabs principaux + overflow "…" menu
- [ ] Page `/admin/settings/panel-layout` drag-drop fonctionnelle
- [ ] 4 types de widgets custom disponibles
- [ ] Tabs stubs masqués par défaut (visible via overflow admin only)
- [ ] Migration 504 appliquée, 6 layouts seedés
- [ ] Clippy + TS clean, build OK, boot < 5s
- [ ] 3 E2E verts
- [ ] Merge main

---

## 7. Fichiers touchés (résumé)

**Backend :**
- `migrations/504_so6_panel_layouts.sql`
- `crates/signapps-db/src/models/org/panel_layout.rs`
- `crates/signapps-db/src/repositories/org/panel_layout_repository.rs`
- `services/signapps-org/src/handlers/panel_layouts.rs`
- `services/signapps-seed/src/seeders/panel_layouts.rs`

**Frontend :**
- `client/src/app/admin/org-structure/components/detail-panel/` (nouveau dossier, 7+ fichiers)
- `client/src/app/admin/org-structure/components/detail-panel.tsx` → re-export (compat)
- `client/src/app/admin/settings/panel-layout/` (nouveau, 4 fichiers)
- `client/src/lib/api/org.ts` extension (panelLayouts section)

**Docs :**
- `docs/product-specs/71-so6-panel-refonte.md`
- `.claude/skills/panel-layout-debug/SKILL.md`

---

**Fin spec SO6.**
