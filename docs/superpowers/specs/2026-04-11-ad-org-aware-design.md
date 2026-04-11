# Active Directory Org-Aware — Design Spec

## Summary

Enhance the internal Active Directory module to auto-provision AD accounts when employees join the org, delegate AD management to managers based on their org position, and implement hierarchical GPO resolution (tenant → domain → node).

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Provisioning | **Auto-provisioning complet** — AD account created on employee affiliation | Zero admin intervention for standard onboarding |
| Delegation | **Administration deleguee + auto-provisioning** — managers manage their subtree | Reduces IT workload, empowers team leads |
| GPO model | **3-level hierarchy** — tenant → domain → node with no_inherit | Mirrors Windows AD (Site→Domain→OU) model |
| Portal access | **None** — portals use JWT only, no AD accounts | AD is internal infra, portals are web-only |

## Auto-Provisioning Engine

### Trigger: PgEventBus `affiliation.created` (same as mail provisioning)

When `core.person_companies` is created with `role_in_company = 'employee'`:

```
1. Get person record (first_name, last_name, email) from core.persons
2. Get assignment node_id from core.assignments
3. Find the AD domain for this org tree:
   - Walk up org_closure to find infrastructure.domains WHERE ad_enabled = true
4. Find the OU for this node:
   - Query ad_ous WHERE node_id = $assignment_node_id AND domain_id = $domain_id
   - If no OU exists, create one automatically from the org node
5. Generate AD account:
   - SAM: {first_name}.{last_name} (use mail naming_rule if available)
   - UPN: {sam}@{domain_name}
   - DN: CN={display_name},OU={ou_name},DC={domain_parts}
   - Generate random password (user resets on first login)
6. INSERT into ad_user_accounts:
   - person_id, domain_id, sam_account_name, user_principal_name, distinguished_name
   - title, department from assignment
   - sync_status = 'pending'
7. Apply GPO resolution for the node (cache effective policies)
8. If node has a site (core.person_sites):
   - Find DHCP scope for the site
   - Pre-reserve an IP if DHCP reservation is configured
9. If domain has cert_mode enabled:
   - Generate client certificate request
10. Emit PgEventBus: ad.account.provisioned {person_id, sam, domain_id}
```

### Trigger: PgEventBus `assignment.changed`

When a person moves to a different org node:
```
1. Find new OU for the new node
2. Update ad_user_accounts: ou_id, distinguished_name (move in tree)
3. Recalculate effective GPO
4. Update DHCP reservation if site changed
5. Set sync_status = 'pending' for re-sync
6. Emit ad.account.moved {person_id, old_ou, new_ou}
```

### Trigger: PgEventBus `affiliation.removed`

When employee leaves:
```
1. Set ad_user_accounts.sync_status = 'disabled'
2. Set ad_user_accounts.uac_flags |= ACCOUNTDISABLE (0x0002)
3. Do NOT delete — keep for audit trail
4. Emit ad.account.disabled {person_id, sam, domain_id}
```

## Delegated Administration

### Scope resolution

A manager's visible AD objects are determined by their position in org_closure:

```sql
-- Get all AD user accounts visible to manager
SELECT aua.*
FROM ad_user_accounts aua
JOIN core.assignments a ON a.person_id = aua.person_id
JOIN core.org_closure oc ON oc.descendant_id = a.node_id
WHERE oc.ancestor_id = $manager_node_id
  AND a.end_date IS NULL
  AND aua.sync_status != 'deleted'
```

Same pattern for computers and OUs.

### Manager permissions (default)

| Action | Allowed | Notes |
|--------|---------|-------|
| View AD accounts of N-1 | Yes | Read-only by default |
| Enable/disable account | Yes | Toggle UAC flag |
| Reset password | Yes | Generates temp password |
| Move user between child OUs | Yes | Within their subtree only |
| View computers in subtree | Yes | Read-only |
| View effective GPO | Yes | Read-only |
| Create/modify GPO | No | Admin only |
| Manage DNS/DHCP | No | Admin only |
| Manage certificates | No | Admin only |
| Promote/demote DC | No | Admin only |

### OrgPolicy override

Admins can customize delegation via `workforce_org_policies` with `domain = 'ad_delegation'`:

```json
{
  "name": "IT Managers Full AD Access",
  "domain": "ad_delegation",
  "settings": {
    "can_create_accounts": true,
    "can_delete_accounts": false,
    "can_manage_computers": true,
    "can_edit_gpo": true,
    "can_manage_dns": false,
    "can_manage_dhcp": false,
    "max_depth": 3
  }
}
```

## GPO Hierarchical Resolution

### 3-level model

```
Level 1: TENANT (global)
  └── workforce_org_policies WHERE node_id IS NULL AND domain = 'governance'

Level 2: DOMAIN (per AD domain)
  └── workforce_org_policies WHERE domain_id = $domain AND domain = 'governance'

Level 3: NODE (per OU/org node)
  └── workforce_org_policies WHERE node_id = $node AND domain = 'governance'
```

### Resolution algorithm

```
1. Collect all policies at the 3 levels
2. Sort by: level ASC (tenant first), then priority DESC
3. For each policy setting key:
   - Node-level wins over domain-level wins over tenant-level
   - UNLESS parent node has is_enforced = true → enforced policy cannot be overridden
4. If node has no_inherit = true → skip parent policies (but enforced still apply)
5. Cache result as effective_gpo for the node
```

### New field on org_nodes

```sql
ALTER TABLE workforce_org_nodes ADD COLUMN IF NOT EXISTS gpo_no_inherit BOOLEAN DEFAULT false;
```

## API Endpoints

### Auto-provisioning

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/workforce/ad/provision/:person_id | Trigger AD provisioning for a person |
| GET | /api/v1/workforce/ad/provision/:person_id/preview | Preview what AD account would be created |
| POST | /api/v1/workforce/ad/provision/bulk | Provision all employees without AD accounts |

### Delegated administration

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/workforce/ad/my-team/accounts | AD accounts for manager's N-1 |
| GET | /api/v1/workforce/ad/my-team/computers | Computers in manager's subtree |
| GET | /api/v1/workforce/ad/my-team/gpo | Effective GPO for manager's node |
| POST | /api/v1/workforce/ad/my-team/accounts/:id/disable | Disable account (manager action) |
| POST | /api/v1/workforce/ad/my-team/accounts/:id/enable | Enable account (manager action) |
| POST | /api/v1/workforce/ad/my-team/accounts/:id/reset-password | Reset password (manager action) |
| PUT | /api/v1/workforce/ad/my-team/accounts/:id/move | Move account to different OU in subtree |

### GPO resolution

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/workforce/ad/gpo/effective/:node_id | Get effective GPO for a node (merged) |
| GET | /api/v1/workforce/ad/gpo/hierarchy/:node_id | Get full GPO inheritance chain |
| PUT | /api/v1/workforce/ad/gpo/no-inherit/:node_id | Toggle no_inherit flag |

### Existing endpoints (unchanged)

All 38+ existing AD endpoints remain. The new endpoints add self-service and delegation on top.

## UI Integration

### /my-team hub: new "Infrastructure" tab

For managers with N-1 in AD-enabled domains:
- **AD Accounts table**: name, SAM, status (active/disabled/pending), last login, password expiry
- **Quick actions**: disable/enable toggle, reset password button
- **Computers**: list of machines in the subtree (hostname, OS, last seen)
- **Effective GPO**: collapsible list showing merged policies for the node

### Admin AD pages (enhanced)

**Existing `/admin/active-directory/sync` page enhanced:**
- New "Auto-provision" section with:
  - "Provisionner tous" button → bulk provision
  - Preview table showing unprovisioned employees with expected SAM/UPN
  - Status badge per person (provisioned/pending/error)

**Existing GPO page enhanced:**
- Visual inheritance chain: tenant → domain → node
- "Bloquer l'heritage" toggle per node
- Effective GPO preview per node (merged result)

### Sidebar

No new sidebar items — infrastructure stays under `/admin/active-directory/*`. The manager delegation is in `/my-team` tab "Infrastructure".

## Migration

```sql
-- 285_ad_org_aware.sql

-- Add no_inherit flag for GPO blocking
ALTER TABLE workforce_org_nodes ADD COLUMN IF NOT EXISTS gpo_no_inherit BOOLEAN DEFAULT false;

-- Add provisioning tracking to ad_user_accounts
ALTER TABLE ad_user_accounts ADD COLUMN IF NOT EXISTS is_auto_provisioned BOOLEAN DEFAULT false;
ALTER TABLE ad_user_accounts ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ;
ALTER TABLE ad_user_accounts ADD COLUMN IF NOT EXISTS provisioned_by UUID;
-- provisioned_by: NULL = auto-provisioned, UUID = manually provisioned by admin
```

## PgEventBus Events

| Event | Payload | Consumers |
|-------|---------|-----------|
| `ad.account.provisioned` | `{person_id, sam, upn, domain_id, ou_id}` | Notifications, Audit, DC sync |
| `ad.account.disabled` | `{person_id, sam, domain_id}` | Notifications, Audit |
| `ad.account.moved` | `{person_id, old_ou, new_ou}` | Audit, GPO recalculation |
| `ad.gpo.changed` | `{node_id, policy_id, action}` | GPO cache invalidation |
| `ad.ou.created` | `{ou_id, node_id, domain_id}` | DC sync |

## E2E Assertions

- Employee affiliation triggers automatic AD account creation
- AD account SAM follows mail naming rule
- AD account placed in correct OU based on org node
- Manager sees AD accounts of N-1 in /my-team Infrastructure tab
- Manager can disable/enable account
- Manager can reset password
- Manager cannot see accounts outside their subtree
- GPO effective view shows merged tenant→domain→node policies
- GPO no_inherit blocks parent policies
- Bulk provision finds all unprovisioned employees
- Account disabled on affiliation removal (not deleted)
- Portal users have no AD account
