---
stepsCompleted: [1, 2]
inputDocuments: []
session_topic: 'Workforce Planning System - Organizational Structure, Scheduling Rules, Validation Engine'
session_goals: 'Customizable hierarchy, Employee/User separation, Coverage rules (trames), Validation engine, TimeSpan management'
selected_approach: 'AI-Recommended + User Spec'
techniques_used: ['Six Thinking Hats', 'SCAMPER', 'Microservices Analysis']
ideas_generated: []
context_file: ''
design_references: ['When I Work', 'Deputy', 'Factorial HR']
pain_points: ['Rigid org structures', 'No coverage validation', 'Missing leave simulation']
user_personas: ['HR Managers', 'Team Leads', 'Schedulers', 'Employees']
---

# Brainstorming Session: Workforce Planning System

**Facilitator:** AI Team
**Date:** 2026-03-19

---

## Session Overview

**Topic:** Workforce Planning System - Structure Organisationnelle, Trames de Planification, Validation

**Goals:**
- Structure organisationnelle personnalisable (TreeList dynamique)
- Distinction claire Employé vs Utilisateur
- Règles de couverture (trames) avec effectifs minimums
- Moteur de validation pour congés/simulation
- TimeSpan comme type de données central

**Design References:** When I Work, Deputy, Factorial HR

**Pain Points to Address:**
- Structures organisationnelles rigides
- Pas de validation de couverture
- Simulation de congés absente

**Target Users:** RH Managers, Team Leads, Planificateurs, Employés

---

## Phase 1: Internal Team Debate

### Lead Architect Analysis

**Database Model Considerations:**

1. **Hierarchie organisationnelle (TreeList)**
   - Pattern: Adjacency List vs Nested Sets vs Closure Table
   - Recommandation: **Closure Table** pour performance requêtes ancêtres/descendants
   - PostgreSQL: Table `org_nodes` + `org_closure` pour chemins
   - Types de noeuds dynamiques via JSONB `node_config`

2. **Employee vs User Separation**
   - `employees` table: données RH (contrat, fonction, taux occupation)
   - `users` table: authentication (existe déjà dans identity service)
   - Relation: `employees.user_id` nullable (employé peut ne pas avoir de compte)

3. **Trames de couverture**
   - `coverage_templates` (modèles réutilisables)
   - `coverage_rules` (instances par noeud org + période)
   - `coverage_requirements` (slots horaires + effectifs minimums)
   - Validation: trigger PostgreSQL ou service-side

4. **TimeSpan Implementation**
   ```rust
   struct TimeSpan {
       start: DateTime<Utc>,
       end: DateTime<Utc>,
   }
   // ou PostgreSQL tstzrange natif
   ```

### Frontend Lead Analysis

**Component Architecture:**

1. **TreeList Component**
   - React Tree avec drag-drop (react-arborist ou @tanstack/react-tree)
   - Chaque noeud: expandable, actions contextuelles, badges effectifs
   - Virtualization obligatoire pour grandes orgs (>1000 noeuds)

2. **Coverage Rules Editor**
   - Week grid avec slots horaires
   - Min/Max par slot + alertes visuelles
   - Preview des violations en temps réel

3. **Validation Engine UI**
   - Simulation mode: "What if employee X prend congé?"
   - Visual diff avant/après
   - Conflict resolution wizard

4. **State Management**
   - Zustand store `workforce-store.ts`
   - Separate slices: `org`, `employees`, `coverage`, `validation`

### SecOps Lead Analysis

**Security Concerns:**

1. **RBAC sur hiérarchie**
   - Permission par noeud organisationnel
   - Héritage descendant configurable
   - Audit trail modifications structure

2. **Données sensibles employés**
   - Chiffrement colonnes sensibles (salaire si présent)
   - Accès basé sur position hiérarchique
   - GDPR: droit à l'effacement

3. **Validation rules**
   - Prévenir règles contradictoires (deadlock)
   - Rate limiting sur simulations (CPU intensive)

### QA Lead Analysis

**Testing Strategy:**

1. **Unit Tests**
   - Closure table: insertions, moves, deletions
   - TimeSpan: overlaps, contains, adjacent
   - Coverage calculation: edge cases

2. **Integration Tests**
   - Validation engine avec données réelles
   - Performance avec org de 500+ noeuds

3. **E2E Playwright**
   - TreeList drag-drop
   - Coverage editor interactions
   - Simulation workflow complet

---

## Phase 2: Architecture Options

### Option A: Monolithic Workforce Module

**Description:** Tout dans un nouveau service Rust `signapps-workforce`

```
services/signapps-workforce/
├── handlers/
│   ├── org_tree.rs
│   ├── employees.rs
│   ├── coverage.rs
│   └── validation.rs
├── models/
│   ├── org_node.rs
│   ├── employee.rs
│   ├── coverage_rule.rs
│   └── time_span.rs
└── services/
    ├── tree_service.rs
    ├── coverage_service.rs
    └── validation_engine.rs
```

| Aspect | Evaluation |
|--------|------------|
| **Pros** | Isolation complète, déploiement indépendant, ownership clair |
| **Cons** | Nouveau port (3010), duplication potentielle avec identity |
| **Effort** | Élevé (nouveau service from scratch) |
| **Complexity** | Moyenne |

### Option B: Extension du Service Scheduling

**Description:** Ajouter au service `signapps-scheduler` (3007)

```
services/signapps-scheduler/
├── handlers/
│   ├── jobs.rs (existant)
│   ├── workforce/
│   │   ├── org.rs
│   │   ├── employees.rs
│   │   └── coverage.rs
└── services/
    ├── job_service.rs (existant)
    └── workforce/
        ├── tree_service.rs
        ├── coverage_service.rs
        └── validation_engine.rs
```

| Aspect | Evaluation |
|--------|------------|
| **Pros** | Pas de nouveau port, réutilise scheduling context |
| **Cons** | Couple workforce au CRON, service plus gros |
| **Effort** | Moyen |
| **Complexity** | Moyenne-haute (refactor) |

### Option C: Frontend-First avec API Générique

**Description:** TreeList/Coverage dans frontend, backend minimal

- Utiliser `signapps-storage` pour persister les configs (JSON)
- Validation engine en TypeScript côté client
- Backend: simple CRUD via storage API

| Aspect | Evaluation |
|--------|------------|
| **Pros** | Développement rapide, itération facile |
| **Cons** | Pas de validation server-side, performance limitée, sécurité faible |
| **Effort** | Faible initialement |
| **Complexity** | Basse (mais tech debt) |

---

## Phase 3: Recommendation

### Approche Recommandée: Option A (Monolithic Workforce Module)

**Justification:**
1. Le domaine "workforce" est suffisamment distinct pour mériter son service
2. Validation engine nécessite calculs server-side (performance, sécurité)
3. Données sensibles (employés) doivent être isolées
4. Évolutivité: roster planning, absence management, etc.

### Schema Database Proposé

```sql
-- Organizational Structure (Closure Table pattern)
CREATE TABLE org_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES org_nodes(id),
    node_type VARCHAR(50) NOT NULL, -- 'company', 'region', 'department', 'team', 'position'
    name VARCHAR(255) NOT NULL,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE org_closure (
    ancestor_id UUID REFERENCES org_nodes(id),
    descendant_id UUID REFERENCES org_nodes(id),
    depth INTEGER NOT NULL,
    PRIMARY KEY (ancestor_id, descendant_id)
);

-- Employees (distinct from Users)
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id), -- nullable
    org_node_id UUID REFERENCES org_nodes(id) NOT NULL,
    employee_number VARCHAR(50) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    functions JSONB DEFAULT '[]', -- array of function codes
    contract_type VARCHAR(50), -- 'full-time', 'part-time', 'contractor'
    fte_ratio DECIMAL(3,2) DEFAULT 1.00, -- 0.00 to 1.00
    hire_date DATE,
    termination_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coverage Templates
CREATE TABLE coverage_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- Weekly pattern stored as JSONB
    -- { "monday": [...slots], "tuesday": [...slots], ... }
    weekly_pattern JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coverage Rules (applied to org nodes)
CREATE TABLE coverage_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_node_id UUID REFERENCES org_nodes(id) NOT NULL,
    template_id UUID REFERENCES coverage_templates(id),
    valid_from DATE NOT NULL,
    valid_to DATE,
    -- Override slots if template is customized
    custom_slots JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coverage Slots (denormalized for query performance)
CREATE TABLE coverage_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES coverage_rules(id) NOT NULL,
    day_of_week SMALLINT NOT NULL, -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    min_employees INTEGER DEFAULT 1,
    max_employees INTEGER,
    required_functions JSONB DEFAULT '[]', -- function codes needed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TimeSpan type for validation
CREATE TYPE time_span AS (
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ
);
```

### API Endpoints Proposés

```
POST   /api/v1/workforce/org/nodes
GET    /api/v1/workforce/org/tree
PUT    /api/v1/workforce/org/nodes/{id}
DELETE /api/v1/workforce/org/nodes/{id}
POST   /api/v1/workforce/org/nodes/{id}/move

POST   /api/v1/workforce/employees
GET    /api/v1/workforce/employees
GET    /api/v1/workforce/employees/{id}
PUT    /api/v1/workforce/employees/{id}

POST   /api/v1/workforce/coverage/templates
GET    /api/v1/workforce/coverage/templates
POST   /api/v1/workforce/coverage/rules
GET    /api/v1/workforce/org/{nodeId}/coverage

POST   /api/v1/workforce/validate/coverage
POST   /api/v1/workforce/validate/leave-simulation
GET    /api/v1/workforce/validate/gaps?from=&to=
```

### Frontend Components

```
client/src/
├── components/workforce/
│   ├── org-tree/
│   │   ├── OrgTreeList.tsx
│   │   ├── OrgNodeItem.tsx
│   │   ├── OrgNodeEditor.tsx
│   │   └── OrgNodeTypeBadge.tsx
│   ├── employees/
│   │   ├── EmployeeList.tsx
│   │   ├── EmployeeForm.tsx
│   │   └── EmployeeCard.tsx
│   ├── coverage/
│   │   ├── CoverageEditor.tsx
│   │   ├── CoverageGrid.tsx
│   │   ├── CoverageSlotCell.tsx
│   │   └── CoverageTemplateSelector.tsx
│   └── validation/
│       ├── ValidationPanel.tsx
│       ├── GapAnalysis.tsx
│       ├── LeaveSimulator.tsx
│       └── CoverageHeatmap.tsx
├── lib/workforce/
│   ├── types/
│   │   ├── org-node.ts
│   │   ├── employee.ts
│   │   ├── coverage.ts
│   │   └── time-span.ts
│   └── api/
│       ├── org.ts
│       ├── employees.ts
│       └── coverage.ts
└── stores/
    └── workforce-store.ts
```

---

## Phase 4: Delegation Plan

### Batch 1: Database & Core Types (Backend)

| Task | Agent | Fichiers |
|------|-------|----------|
| Create workforce service skeleton | Backend | `services/signapps-workforce/*` |
| Implement org_nodes + closure table | Backend | `crates/signapps-db/src/models/workforce/*` |
| Add employee model | Backend | `crates/signapps-db/src/models/employee.rs` |
| Create TimeSpan value object | Backend | `crates/signapps-common/src/types/time_span.rs` |
| Database migrations | Backend | `migrations/20260319_*_workforce.sql` |

### Batch 2: API Endpoints (Backend)

| Task | Agent | Fichiers |
|------|-------|----------|
| Org tree CRUD handlers | Backend | `handlers/org.rs` |
| Employee CRUD handlers | Backend | `handlers/employees.rs` |
| Coverage templates/rules handlers | Backend | `handlers/coverage.rs` |
| Tree service (closure table ops) | Backend | `services/tree_service.rs` |

### Batch 3: Validation Engine (Backend)

| Task | Agent | Fichiers |
|------|-------|----------|
| Coverage validation logic | Backend | `services/validation_engine.rs` |
| Gap analysis algorithm | Backend | `services/gap_analyzer.rs` |
| Leave simulation service | Backend | `services/leave_simulator.rs` |

### Batch 4: Frontend Foundation

| Task | Agent | Fichiers |
|------|-------|----------|
| TypeScript types | Frontend | `lib/workforce/types/*` |
| API client | Frontend | `lib/workforce/api/*` |
| Zustand store | Frontend | `stores/workforce-store.ts` |
| App routing | Frontend | `app/workforce/*` |

### Batch 5: Frontend Components

| Task | Agent | Fichiers |
|------|-------|----------|
| OrgTreeList component | Frontend | `components/workforce/org-tree/*` |
| EmployeeList + Form | Frontend | `components/workforce/employees/*` |
| CoverageEditor | Frontend | `components/workforce/coverage/*` |
| ValidationPanel | Frontend | `components/workforce/validation/*` |

### Batch 6: Testing & Integration

| Task | Agent | Fichiers |
|------|-------|----------|
| Unit tests closure table | QA | `tests/org_tree_tests.rs` |
| Integration tests | QA | `tests/workforce_integration.rs` |
| E2E Playwright | QA | `client/e2e/workforce.spec.ts` |

---

## Next Steps

1. **Valider l'Option A** avec le Director
2. **Créer le service skeleton** `signapps-workforce`
3. **Implémenter les migrations** database
4. **Développer les composants** frontend en parallèle

---

## Questions en Suspens

1. Les fonctions employés sont-elles prédéfinies (enum) ou dynamiques (configurable par client)?
2. La hiérarchie doit-elle supporter des noeuds multi-parents (matrice)?
3. Les trames de couverture sont-elles héritées automatiquement des noeuds parents?
4. Faut-il intégrer avec le module scheduling existant (events, tasks)?
