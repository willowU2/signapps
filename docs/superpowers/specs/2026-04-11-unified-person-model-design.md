# Unified Person Model & Contextual Portals — Design Spec

## Summary

Refactor the SignApps identity layer to treat every human entity (employee, client, supplier, partner, freelancer) as a single `core.persons` record with multiple company affiliations and role-based portal access. Users with multiple roles see a context picker after login and can switch contexts in-session.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Source of truth | **Hybrid** — internals from LDAP/admin, externals from CRM/import/forms, reconciled into `core.persons` | Matches real-world data flows |
| Multi-role access | **Separate spaces** — employee gets full workspace, client/supplier get dedicated portals | Security isolation by default |
| Content ownership | **Per-module defaults** — email private, team docs shared in dept, calendar visible (busy/free), admin-configurable | Natural expectations per module |
| Cross-context content | **Cloisonne with explicit sharing** — content locked to context, cross-context sharing via `sharing.grants` | Security by default, collaboration by choice |
| External portals | **Collaborative (B) by default, modular (C) optional** — tickets, uploads, comments, forms; admin can unlock full modules | Covers 90% needs, extensible |
| Context picker | **All 3 behaviors** — skip if single role, remember last choice, switch in-session via header | Maximum fluidity |

## Data Model Changes

### New table: `core.companies`

```sql
CREATE TABLE IF NOT EXISTS core.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id),
    name TEXT NOT NULL,
    company_type TEXT NOT NULL, -- 'internal', 'client', 'supplier', 'partner'
    legal_name TEXT,
    siren TEXT,
    siret TEXT,
    vat_number TEXT,
    registration_number TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'FR',
    website TEXT,
    logo_url TEXT,
    industry TEXT,
    employee_count_range TEXT, -- '1-10', '11-50', '51-200', '201-500', '500+'
    annual_revenue_range TEXT,
    default_currency TEXT DEFAULT 'EUR',
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_companies_tenant ON core.companies(tenant_id);
CREATE INDEX idx_companies_type ON core.companies(tenant_id, company_type);
CREATE UNIQUE INDEX idx_companies_siren ON core.companies(tenant_id, siren) WHERE siren IS NOT NULL;
```

### New table: `core.person_companies`

```sql
CREATE TABLE IF NOT EXISTS core.person_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES core.persons(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES core.companies(id) ON DELETE CASCADE,
    role_in_company TEXT NOT NULL, -- 'employee', 'client_contact', 'supplier_contact', 'partner', 'board_member', 'freelancer'
    job_title TEXT,
    department TEXT,
    is_primary BOOLEAN DEFAULT false,
    start_date DATE,
    end_date DATE,
    portal_access BOOLEAN DEFAULT false, -- whether this affiliation grants portal login
    portal_modules TEXT[] DEFAULT '{}', -- optional: which extra modules are unlocked (empty = default B)
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(person_id, company_id, role_in_company)
);
CREATE INDEX idx_person_companies_person ON core.person_companies(person_id);
CREATE INDEX idx_person_companies_company ON core.person_companies(company_id);
CREATE INDEX idx_person_companies_role ON core.person_companies(role_in_company);
```

### Alter `core.persons`

```sql
ALTER TABLE core.persons ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
-- source: 'ldap', 'crm', 'import', 'manual', 'form', 'email', 'api'
ALTER TABLE core.persons ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE core.persons ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE core.persons ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'fr';
ALTER TABLE core.persons ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES core.persons(id);
-- merged_into: if this person was deduplicated into another record, points to the surviving record
```

### Alter `sharing.grants`

```sql
-- Add 'company' as a grantee_type
-- The existing CHECK constraint on grantee_type needs updating:
ALTER TABLE sharing.grants DROP CONSTRAINT IF EXISTS grants_grantee_type_check;
ALTER TABLE sharing.grants ADD CONSTRAINT grants_grantee_type_check
    CHECK (grantee_type IN ('user', 'group', 'org_node', 'company', 'everyone'));
```

### New table: `identity.login_contexts`

```sql
CREATE TABLE IF NOT EXISTS identity.login_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    person_company_id UUID NOT NULL REFERENCES core.person_companies(id) ON DELETE CASCADE,
    context_type TEXT NOT NULL, -- 'employee', 'client', 'supplier', 'partner'
    company_id UUID NOT NULL REFERENCES core.companies(id),
    label TEXT NOT NULL, -- display name: "SignApps Corp — Employe"
    icon TEXT, -- emoji or icon identifier
    color TEXT, -- hex color for the context card
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, person_company_id)
);
CREATE INDEX idx_login_contexts_user ON identity.login_contexts(user_id);
```

## Authentication Flow

### Login sequence

```
1. User submits credentials (username/password or SSO)
2. Identity service validates credentials → gets user_id
3. Query login_contexts for user_id WHERE is_active = true
4. If count = 0 → error "No active context"
5. If count = 1 → auto-select, generate JWT with context
6. If count >= 2 → return contexts list to frontend
7. Frontend shows context picker
8. User selects context → POST /api/v1/auth/select-context
9. Server generates JWT with context claims
```

### JWT claims (enriched)

```json
{
  "sub": "user-uuid",
  "person_id": "person-uuid",
  "tenant_id": "tenant-uuid",
  "context_id": "login-context-uuid",
  "context_type": "employee",
  "company_id": "company-uuid",
  "company_name": "SignApps Corp",
  "role": 2,
  "permissions": ["..."],
  "exp": 1234567890
}
```

### Context switch in-session

```
1. User clicks context switcher in header
2. Frontend calls GET /api/v1/auth/contexts (cached)
3. Shows dropdown with available contexts
4. User selects different context
5. Frontend calls POST /api/v1/auth/switch-context { context_id }
6. Server validates, generates new JWT
7. Frontend stores new JWT, reloads current page with new context
8. All API calls now include new context in JWT
```

### New API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/auth/contexts | List available contexts for current user |
| POST | /api/v1/auth/select-context | Select context after login (returns JWT) |
| POST | /api/v1/auth/switch-context | Switch context in-session (returns new JWT) |
| GET | /api/v1/auth/current-context | Get current context details |

## Company Management

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/companies | List companies (filter by type) |
| POST | /api/v1/companies | Create company |
| GET | /api/v1/companies/:id | Get company detail |
| PUT | /api/v1/companies/:id | Update company |
| DELETE | /api/v1/companies/:id | Deactivate company |
| GET | /api/v1/companies/:id/persons | List persons affiliated with company |
| POST | /api/v1/companies/:id/persons | Add person affiliation |
| DELETE | /api/v1/companies/:id/persons/:person_id | Remove affiliation |

### Person affiliation management

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/persons/:id/companies | List companies for a person |
| POST | /api/v1/persons/:id/companies | Add company affiliation |
| PUT | /api/v1/person-companies/:id | Update affiliation (title, portal_access, modules) |
| DELETE | /api/v1/person-companies/:id | Remove affiliation |

## Portal Architecture

### Routing

- `/app/*` — Full workspace (employee context, all modules)
- `/portal/client/*` — Client portal (scoped to company_id from JWT)
- `/portal/supplier/*` — Supplier portal (scoped to company_id from JWT)

### Client portal modules (default B)

| Module | Access | Description |
|--------|--------|-------------|
| Dashboard | Read | KPIs: open tickets, pending invoices, shared documents |
| Invoices | Read + Download | View and download invoices from billing module |
| Tickets | Read + Create | Create and track helpdesk tickets |
| Documents | Read + Upload | View shared documents, upload requested files |
| Forms | Read + Submit | Fill out forms shared by the internal team |
| Chat | Read + Write | Messaging channel with account manager (if enabled) |
| Comments | Write | Comment on shared documents and invoices |

### Supplier portal modules (default B)

| Module | Access | Description |
|--------|--------|-------------|
| Dashboard | Read | KPIs: open orders, pending payments, delivery schedule |
| Orders | Read + Update | View purchase orders, confirm/reject, update status |
| Invoices | Read + Upload | Submit invoices, view payment status |
| Catalog | Read + Write | Manage product catalog (prices, availability) |
| Documents | Read + Upload | Shared specs, contracts, certifications |
| Deliveries | Read + Update | Track and update delivery status |

### Admin-unlockable modules (option C)

When `portal_modules` is non-empty in `person_companies`, additional modules become available:
- `docs` — Full document editor (Tiptap)
- `drive` — File storage with folder management
- `chat` — Team messaging channels
- `calendar` — Shared calendar view
- `meet` — Video conferencing
- `forms` — Form builder (not just filling)
- `wiki` — Knowledge base access

## Cross-Context Sharing

### How it works

1. Employee Jean is in context "SignApps Corp — Employee"
2. Jean creates a document in his Drive
3. Jean opens Share dialog → sees new option "Partager avec une entreprise"
4. Jean selects "Acme Industries" (client company)
5. System creates `sharing.grants` with `grantee_type='company'`, `grantee_id=acme_company_id`
6. When client Marie (affiliated with Acme) logs into the client portal, she sees the shared document in her "Documents partages" section

### Permission resolution order

```
1. Check explicit person grant (grantee_type='user')
2. Check group grant (grantee_type='group')
3. Check org_node grant (grantee_type='org_node')
4. Check company grant (grantee_type='company')
5. Check everyone grant (grantee_type='everyone')
6. Check container policy inheritance
7. Default: no access
```

### Cross-context validation

- Sharing from employee context to external company: allowed (normal collaboration)
- Sharing from client portal to employee workspace: blocked (portal users can only share within their portal scope)
- Sharing between two external portals: blocked (client A cannot share with supplier B directly)
- Admin override: admin can configure exceptions via `sharing.policies`

## UI Integration

### Header context switcher

- Shows current context: company logo + name + role badge
- Click opens dropdown with other available contexts
- Each context shows: company name, role, unread notification count
- "Se deconnecter" link at bottom
- Keyboard shortcut: `Ctrl+Shift+W` to open switcher

### Sidebar adaptation

- **Employee context**: full sidebar (all modules as today)
- **Client portal**: reduced sidebar (Dashboard, Factures, Tickets, Documents, Formulaires, Messages)
- **Supplier portal**: reduced sidebar (Dashboard, Commandes, Factures, Catalogue, Documents, Livraisons)
- Sidebar content is driven by `context_type` + `portal_modules` from JWT

### Contact/Person integration

- CRM module shows `core.persons` filtered by `person_roles` containing 'client_contact'
- HR module shows `core.persons` filtered by `person_companies.role_in_company = 'employee'`
- Contacts module shows all `core.persons` the current user has access to
- Person detail page shows all affiliations (companies + roles) with tabs
- Deduplication engine: when creating a contact via CRM, check existing `core.persons` by email/phone before creating new

### Sharing dialog enrichment

- Existing: "Ajouter des personnes ou des groupes"
- New section: "Partager avec une entreprise"
- Autocomplete searches `core.companies` by name
- Shows company type badge (client/fournisseur/partenaire)
- Permission level: viewer/editor (same as person grants)
- Optional: set expiration date

## PgEventBus Events

| Event | Payload | Consumers |
|-------|---------|-----------|
| `person.created` | `{person_id, source, tenant_id}` | CRM, Contacts, Search |
| `person.merged` | `{surviving_id, merged_id, tenant_id}` | All modules (update FKs) |
| `company.created` | `{company_id, type, tenant_id}` | CRM, Billing, Supply Chain |
| `affiliation.created` | `{person_id, company_id, role}` | Identity (create login_context), Notifications |
| `affiliation.removed` | `{person_id, company_id, role}` | Identity (deactivate login_context) |
| `context.switched` | `{user_id, from_context, to_context}` | Audit, Analytics |
| `portal.module_unlocked` | `{company_id, module, admin_id}` | Portal, Notifications |

## Migration Strategy

1. Create `core.companies` table
2. Create `core.person_companies` table
3. Alter `core.persons` (add source, date_of_birth, merged_into)
4. Alter `sharing.grants` (add 'company' grantee_type)
5. Create `identity.login_contexts` table
6. Migrate existing `workforce_employees` data → create company affiliations
7. Migrate existing `core.person_roles` data → map to person_companies where applicable
8. Seed internal company from tenant config

## E2E Assertions

- Login with multi-role user shows context picker
- Login with single-role user skips context picker
- Context switch via header changes JWT and reloads
- Employee workspace shows full sidebar
- Client portal shows reduced sidebar (6 modules)
- Supplier portal shows reduced sidebar (6 modules)
- Document shared with company appears in client portal
- Client portal user cannot access employee-only routes
- Admin can unlock additional modules for a company
- Person detail shows all company affiliations
- Sharing dialog includes "Partager avec une entreprise"
- Deduplication detects existing person by email on CRM create
- Context switcher shows unread counts per context
- "Connexion rapide" remembers last used context
