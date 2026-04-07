# Refactor 1: Split `signapps-db` into Bounded-Context Sub-Crates

> **Status:** Design — not yet executed
> **Estimated effort:** 2–3 days (human-supervised)
> **Risk level:** Medium
> **Author:** Architecture audit, 2026-04-07

---

## Why

`signapps-db` is a god-crate. Every single service in the workspace depends on it, yet a
calendar service handler has no business importing vault encryption structs, and the PXE
boot service should not carry 45 SQL models in its compile graph. This creates three
concrete problems:

1. **Compile coupling.** Any model change forces a full recompilation of every service that
   links `signapps-db`, even if the change is unrelated to that service. With 28 services
   all depending on one crate, incremental builds degrade to full rebuilds on schema changes.

2. **Boundary erosion.** Because all models live in one namespace, a developer writing a
   new handler is one `use signapps_db::*` away from using the wrong domain's model. There
   is no compile-time enforcement of domain boundaries.

3. **Repository sprawl.** The `repositories/mod.rs` exports 43 repository types in a flat
   namespace. Adding a new repository requires editing a central file rather than the
   owning domain's crate. Cross-domain leakage happens silently.

Splitting into bounded-context sub-crates restores the microservice contract: each service
compiles only the data layer it owns. It also unblocks future work of moving services to
independent repositories.

---

## Current State

### Models (45 files in `crates/signapps-db/src/models/`)

**Identity / IAM domain (5)**
- `user.rs` — `User`, `UserStatus`, `CreateUser`, `UpdateUser`
- `group.rs` — `Group`, `GroupMember`, `GroupWithMembers`
- `ldap.rs` — `LdapConfig`, `LdapSyncJob`, `LdapAttributeMap`
- `user_preferences.rs` — `UserPreferences`, `UpdateUserPreferences`
- `audit_log.rs` — `AuditLog`, `AuditLogFilter`

**Tenant / Org platform (8)**
- `tenant.rs` — `Tenant`, `TenantSettings`, `WorkspaceSettings`
- `core_org.rs` — `OrgNode`, `OrgTree`, `Person`, `Site`, `Assignment`
- `org_groups.rs` — `OrgGroup`, `OrgGroupMember`
- `org_policies.rs` — `GpoPolicy`, `PolicyAssignment`, `PolicyInheritance`
- `org_boards.rs` — `OrgBoard`, `OrgBoardColumn`, `OrgBoardCard`
- `org_delegations.rs` — `OrgDelegation`, `DelegationRule`
- `org_audit.rs` — `OrgAuditEntry`, `OrgAuditFilter`
- `entity_reference.rs` — `EntityReference`, `EntityLink`

**Calendar / HR domain (3)**
- `calendar.rs` — `Calendar`, `Event`, `Task`, `EventAttendee`, `FloorPlan`, `Resource`
- `scheduling.rs` — `TimeItem`, `TimeItemGroup`, `RecurrenceRule`, `SchedulingResource`
- `external_sync.rs` — `ProviderConnection`, `SyncConfig`, `SyncLog`, `OAuthState`

**Mail / Comms domain (1)**
- `mailserver.rs` — `MailDomain`, `MailAccount`, `Mailbox`, `MailMessage`

**Storage domain (4)**
- `drive.rs` — `Drive`, `DriveFile`, `DriveFolder`, `DriveShare`
- `drive_acl.rs` — `DriveAuditLog`, `AuditAlertConfig`
- `storage_quota.rs` — `StorageQuota`, `QuotaUsage`
- `storage_tier2.rs` — `StorageTier2Config`, `Tier2SyncJob`
- `storage_tier3.rs` — `StorageTier3Config`, `Tier3ArchiveJob`

**Infrastructure / AD domain (5)**
- `ad_domain.rs` — `AdDomain`, `AdDomainConfig`, `DomainController`
- `ad_sync.rs` — `AdSyncQueue`, `AdSyncLog`, `AdUserAccount`, `AdOu`
- `ad_dns.rs` — `DnsZone`, `DnsRecord`, `DnsZoneStats`
- `ad_principal_keys.rs` — `KerberosKey`, `PrincipalSecret`
- `infrastructure.rs` — `InfraDomain`, `InfraCertificate`, `DhcpScope`, `DhcpLease`, `DeployProfile`

**IT Asset Management domain (3)**
- `device.rs` — `Device`, `DeviceGroup`, `DeviceSoftware`, `DevicePatch`
- `container.rs` — `Container`, `ContainerPort`, `ContainerVolume`
- `raid.rs` — `RaidArray`, `RaidDisk`

**Vault domain (1)**
- `vault.rs` — `VaultFolder`, `VaultItem`, `VaultShare`, `VaultAuditLog`

**Billing domain (1)**
- `certificate.rs` — `TlsCertificate`, `CertificateOrder` (used by proxy/billing)

**Content domain (4)**
- `form.rs` — `Form`, `FormField`, `FormSubmission`, `FormResponse`
- `signature.rs` — `SignatureTemplate`, `SignatureRequest`, `SignatureField`
- `backup.rs` — `BackupJob`, `BackupSchedule`, `DriveBackup`
- `notification.rs` — `Notification`, `NotificationTemplate`, `PushSubscription`

**AI / Analytics domain (5)**
- `conversation.rs` — `Conversation`, `ConversationMessage`
- `generated_media.rs` — `GeneratedMedia`, `MediaJob`
- `document_vector.rs` — `DocumentVector` (384-dim embeddings)
- `multimodal_vector.rs` — `MultimodalVector` (1024-dim embeddings)
- `kg.rs` — `KgNode`, `KgEdge`, `KgTriple`

**Jobs / Activity (2)**
- `job.rs` — `Job`, `JobStatus`, `JobResult`
- `activity.rs` — `ActivityEntry`, `ActivityFeed`

**Route (1)**
- `route.rs` — `ProxyRoute`, `RouteHealth` (used by signapps-proxy)

### Repositories (43, in `crates/signapps-db/src/repositories/`)

All follow the same naming pattern. Complete list:

| Repository | Domain |
|---|---|
| `UserRepository` | Identity |
| `GroupRepository` | Identity |
| `LdapRepository` | Identity |
| `UserPreferencesRepository` | Identity |
| `AuditLogRepository` | Identity |
| `TenantRepository`, `WorkspaceRepository`, `LabelRepository`, `ProjectRepository`, `ReservationRepository`, `ResourceTypeRepository`, `TemplateRepository`, `TenantCalendarRepository`, `TenantResourceRepository`, `TenantTaskRepository` | Tenant |
| `OrgNodeRepository`, `OrgTreeRepository`, `PersonRepository`, `SiteRepository`, `AssignmentRepository`, `PermissionProfileRepository` | Org |
| `CalendarRepository`, `EventRepository`, `TaskRepository`, `EventAttendeeRepository`, `FloorPlanRepository`, `ResourceRepository` | Calendar |
| `TimesheetRepository`, `LeaveBalanceRepository`, `ApprovalWorkflowRepository`, `PresenceRuleRepository`, `CategoryRepository` | Calendar HR |
| `RecurrenceRuleRepository`, `SchedulingPreferencesRepository`, `SchedulingResourceRepository`, `SchedulingTemplateRepository`, `TimeItemRepository`, `TimeItemGroupRepository`, `TimeItemDependencyRepository`, `TimeItemUserRepository` | Scheduling |
| `ExternalCalendarRepository`, `ProviderConnectionRepository`, `SyncConfigRepository`, `SyncLogRepository`, `OAuthStateRepository`, `EventMappingRepository`, `SyncConflictRepository` | External Sync |
| `AccountRepository`, `DomainRepository`, `MailboxRepository`, `MessageRepository` | Mail |
| `StorageTier2Repository`, `StorageTier3Repository`, `QuotaRepository` | Storage |
| `DriveAuditLogRepository`, `AuditAlertConfigRepository` | Storage ACL |
| `AdDomainRepository`, `AdDnsRepository`, `AdPrincipalKeysRepository`, `AdSyncQueueRepository`, `AdOuRepository`, `AdUserAccountRepository` | AD/DC |
| `InfrastructureRepository` (with sub: `InfraDomainRepository`, `InfraCertificateRepository`, `DhcpScopeRepository`, `DhcpLeaseRepository`, `DeployProfileRepository`) | Infrastructure |
| `DeviceRepository` | ITAM |
| `ContainerRepository` | Containers |
| `RaidRepository` | Storage/ITAM |
| `RouteRepository` | Proxy |
| `CertificateRepository` | TLS/Proxy |
| `VaultItemRepository`, `VaultFolderRepository`, `VaultShareRepository`, `VaultAuditRepository`, `VaultBrowseRepository`, `VaultKeysRepository`, `VaultOrgKeyRepository` | Vault |
| `FormRepository`, `FormFieldRepository`, `FormSubmissionRepository` | Forms |
| `SignatureRepository` | Docs |
| `BackupRepository`, `DriveBackupRepository` | Backup |
| `NotificationRepository`, `NotificationTemplateRepository`, `NotificationSentRepository`, `NotificationDigestRepository`, `NotificationPreferencesRepository`, `PushSubscriptionRepository` | Notifications |
| `ConversationRepository` | AI |
| `GeneratedMediaRepository` | AI |
| `VectorRepository` | AI |
| `MultimodalVectorRepository` | AI |
| `KgRepository` | AI |
| `JobRepository` | Jobs |
| `ActivityRepository` | Activity |
| `MetricsRepository` | Metrics |
| `EntityReferenceRepository` | Shared |
| `BackupRepository` | Backup |

---

## Target State

### Proposed Sub-Crates

```
crates/
  signapps-db-shared/        # PgPool wrapper, Tenant, User (minimal), EntityReference, Job, Activity
  signapps-db-identity/      # User full, Group, LDAP, UserPreferences, AuditLog, Org structs
  signapps-db-calendar/      # Calendar, Event, Task, Scheduling, ExternalSync, Timesheets
  signapps-db-mail/          # MailDomain, Account, Mailbox, Message
  signapps-db-storage/       # Drive, DriveAcl, StorageQuota, Tier2, Tier3, Backup
  signapps-db-infrastructure/ # AD, DC, DNS, LDAP infra, DHCP, PXE, Kerberos
  signapps-db-itam/          # Device, Container, RAID
  signapps-db-billing/       # Certificate (TLS), Vault audit, Route
  signapps-db-content/       # Form, Signature, Notification, Backup scheduling
  signapps-db-vault/         # VaultItem, VaultFolder, VaultShare, VaultKeys
  signapps-db-ai/            # Conversation, GeneratedMedia, DocumentVector, MultimodalVector, KgNode
  signapps-db/               # DEPRECATED — re-exports all sub-crates (transition shim)
```

### Model-to-Sub-Crate Assignment

| Sub-Crate | Models | Repositories |
|---|---|---|
| `signapps-db-shared` | `tenant`, `entity_reference`, `job`, `activity` | `TenantRepository`, `EntityReferenceRepository`, `JobRepository`, `ActivityRepository` |
| `signapps-db-identity` | `user`, `group`, `ldap`, `user_preferences`, `audit_log`, `core_org`, `org_groups`, `org_policies`, `org_boards`, `org_delegations`, `org_audit` | All identity + org repos |
| `signapps-db-calendar` | `calendar`, `scheduling`, `external_sync` | All calendar, scheduling, external sync, HR repos |
| `signapps-db-mail` | `mailserver` | `AccountRepository`, `DomainRepository`, `MailboxRepository`, `MessageRepository` |
| `signapps-db-storage` | `drive`, `drive_acl`, `storage_quota`, `storage_tier2`, `storage_tier3`, `backup` | All storage + quota + drive ACL + backup repos |
| `signapps-db-infrastructure` | `ad_domain`, `ad_sync`, `ad_dns`, `ad_principal_keys`, `infrastructure` | All AD + infra repos |
| `signapps-db-itam` | `device`, `container`, `raid` | `DeviceRepository`, `ContainerRepository`, `RaidRepository` |
| `signapps-db-billing` | `certificate`, `route` | `CertificateRepository`, `RouteRepository` |
| `signapps-db-content` | `form`, `signature`, `notification` | Form, Signature, Notification repos |
| `signapps-db-vault` | `vault` | All vault repos |
| `signapps-db-ai` | `conversation`, `generated_media`, `document_vector`, `multimodal_vector`, `kg` | `ConversationRepository`, `GeneratedMediaRepository`, `VectorRepository`, `MultimodalVectorRepository`, `KgRepository` |

### Service Dependency Changes (after migration)

| Service | Current | Target |
|---|---|---|
| `signapps-identity` | `signapps-db` | `signapps-db-shared`, `signapps-db-identity` |
| `signapps-calendar` | `signapps-db` | `signapps-db-shared`, `signapps-db-calendar` |
| `signapps-mail` | `signapps-db` | `signapps-db-shared`, `signapps-db-mail` |
| `signapps-storage` | `signapps-db` | `signapps-db-shared`, `signapps-db-storage` |
| `signapps-dc` | `signapps-db` | `signapps-db-shared`, `signapps-db-infrastructure` |
| `signapps-pxe` | `signapps-db` | `signapps-db-shared`, `signapps-db-infrastructure` |
| `signapps-it-assets` | `signapps-db` | `signapps-db-shared`, `signapps-db-itam` |
| `signapps-ai` | `signapps-db` | `signapps-db-shared`, `signapps-db-ai` |
| `signapps-forms` | `signapps-db` | `signapps-db-shared`, `signapps-db-content` |
| `signapps-proxy` | `signapps-db` | `signapps-db-shared`, `signapps-db-billing` |
| `signapps-collab` | `signapps-db` | `signapps-db-shared` |
| `signapps-docs` | `signapps-db` | `signapps-db-shared`, `signapps-db-content` |

---

## Migration Plan

### Phase 1: Extract `signapps-db-shared`

**Goal:** Create the minimal shared pool wrapper + cross-cutting models. Zero risk — these
models are already used everywhere with no mutation needed.

**Files to create:**
- `crates/signapps-db-shared/Cargo.toml`
- `crates/signapps-db-shared/src/lib.rs` — re-exports `DatabasePool`, `create_pool`
- `crates/signapps-db-shared/src/models/tenant.rs` — copy from `signapps-db`
- `crates/signapps-db-shared/src/models/entity_reference.rs`
- `crates/signapps-db-shared/src/models/job.rs`
- `crates/signapps-db-shared/src/models/activity.rs`
- `crates/signapps-db-shared/src/repositories/tenant_repository.rs`
- `crates/signapps-db-shared/src/repositories/entity_reference_repository.rs`
- `crates/signapps-db-shared/src/repositories/job_repository.rs`
- `crates/signapps-db-shared/src/repositories/activity_repository.rs`

**Steps:**
1. Copy the files above from `crates/signapps-db/src/` into the new crate.
2. Add `signapps-db-shared` to `Cargo.toml` workspace members.
3. Add `signapps-db-shared` as a dependency in `signapps-db/Cargo.toml` and re-export
   via `signapps-db/src/lib.rs` (no consumer path changes yet).
4. Run `cargo check --workspace`.

**Verification:** `cargo check --workspace` passes; no service changed.
**Commit message:** `refactor(db): extract signapps-db-shared (pool, tenant, job, activity)`
**Rollback:** `git revert <sha>` — no consumers changed paths.

---

### Phase 2: Extract `signapps-db-identity`

**Goal:** Move identity + org models. Affects `signapps-identity` only.

**Files touched:**
- `crates/signapps-db-identity/` — new crate (models: user, group, ldap, user_preferences,
  audit_log, core_org, org_groups, org_policies, org_boards, org_delegations, org_audit)
- `services/signapps-identity/Cargo.toml` — add `signapps-db-identity`, keep `signapps-db` until Phase 5

**Steps:**
1. Create `crates/signapps-db-identity/` with all identity + org models.
2. Add `signapps-db-identity` to workspace.
3. In `signapps-db/src/lib.rs`, replace inline model definitions with re-exports from
   `signapps-db-identity` (keeps existing import paths working).
4. Update `signapps-identity/Cargo.toml` to add `signapps-db-identity`.
5. Grep identity handlers for `use signapps_db::` and replace with `use signapps_db_identity::`.
6. Run `cargo test -p signapps-identity`.

**Verification:** `cargo check --workspace`; `cargo test -p signapps-identity`
**Commit message:** `refactor(db): extract signapps-db-identity (user, group, ldap, org)`
**Rollback:** `git revert <sha>` — `signapps-db` shim still exports everything.

---

### Phase 3: Extract Calendar, Mail, Storage

**Goal:** Three independent domains with no cross-dependency.

**New crates:** `signapps-db-calendar`, `signapps-db-mail`, `signapps-db-storage`

**Files touched per crate:**

*signapps-db-calendar:*
- Models: `calendar`, `scheduling`, `external_sync`
- Repos: All calendar*, scheduling*, external_sync* repositories
- Service: `signapps-calendar/Cargo.toml`

*signapps-db-mail:*
- Models: `mailserver`
- Repos: `mailserver_repo`
- Service: `signapps-mail/Cargo.toml`

*signapps-db-storage:*
- Models: `drive`, `drive_acl`, `storage_quota`, `storage_tier2`, `storage_tier3`, `backup`
- Repos: `storage_tier2_repository`, `storage_tier3_repository`, `quota_repository`,
  `drive_acl_repository`, `backup_repository`
- Services: `signapps-storage/Cargo.toml`

**Steps (repeat for each sub-crate):**
1. Create crate directory, `Cargo.toml`, `src/lib.rs` with models + repositories.
2. Add to workspace.
3. Add re-export shim in `signapps-db/src/lib.rs`.
4. Update affected service `Cargo.toml` and handler imports.
5. `cargo test -p <service>`.

**Verification:** `cargo check --workspace`; `cargo test` for affected services.
**Commit message:** `refactor(db): extract signapps-db-calendar, signapps-db-mail, signapps-db-storage`
**Rollback:** `git revert <sha>` — shim intact.

---

### Phase 4: Extract Remaining Domains

**Goal:** Infrastructure, ITAM, Billing, Content, Vault, AI.

**New crates:**
- `signapps-db-infrastructure` — AD, DC, DNS, DHCP, PXE infrastructure models
- `signapps-db-itam` — Device, Container, RAID
- `signapps-db-billing` — Certificate, Route
- `signapps-db-content` — Form, Signature, Notification
- `signapps-db-vault` — Vault entries and keys
- `signapps-db-ai` — Conversation, vectors, knowledge graph

**Affected services:** `signapps-dc`, `signapps-pxe`, `signapps-it-assets`, `signapps-proxy`,
`signapps-billing`, `signapps-forms`, `signapps-docs`, `signapps-ai`, `signapps-collab`

**Steps:** Same pattern as Phase 3, once per crate.

**Verification:** `cargo check --workspace`; `cargo nextest run`
**Commit message:** `refactor(db): extract infrastructure, itam, billing, content, vault, ai sub-crates`
**Rollback:** `git revert <sha>`.

---

### Phase 5: Deprecate and Remove `signapps-db`

**Goal:** Replace the monolith with a thin re-export facade, then remove it.

**Steps:**
1. Rename `crates/signapps-db` to `crates/signapps-db-deprecated` (or add `[package] deprecated = true`).
2. Ensure all services have been migrated to use specific sub-crates (grep `signapps_db` across services).
3. Remove `signapps-db` from workspace root `Cargo.toml`.
4. Remove any remaining `signapps-db` deps from service `Cargo.toml` files.
5. `cargo build --workspace`.

**Verification:** `cargo build --workspace` with no `signapps-db` dependency remaining.
**Commit message:** `refactor(db): remove deprecated signapps-db monolith — all services use sub-crates`
**Rollback:** `git revert <sha>` — sub-crates remain valid.

---

## Risks

- **Hidden cross-domain repository usage:** A service might import a repository from the
  wrong domain (e.g., `signapps-collab` using `VaultItemRepository`). Grep audit required
  before each phase. *Severity: Medium*
- **`pub use *` wildcard pollution:** The current `models/mod.rs` uses `pub use *` which
  hides which symbols are truly used by each service. Compile errors will surface these
  only after sub-crate split. *Severity: Medium — expected noise, not blocking*
- **`test_helpers.rs`:** Lives in `signapps-db/src/repositories/test_helpers.rs` and is
  used across service integration tests. Must be moved to `signapps-db-shared` or each
  sub-crate. *Severity: Low*
- **`calendar_repository_tests.rs`:** Separate test file in repositories — must follow
  `calendar_repository.rs` into `signapps-db-calendar`. *Severity: Low*
- **SQLX offline mode:** `sqlx-data.json` queries reference the original crate structure.
  Must regenerate `sqlx prepare` for each sub-crate. *Severity: Medium — CI impact*

---

## Success Criteria

- [ ] `cargo build --workspace` passes with no `signapps-db` in any service `Cargo.toml`
- [ ] Each service's compile graph contains only the sub-crate(s) relevant to its domain
- [ ] `cargo nextest run` passes (all tests green)
- [ ] Incremental rebuild after a calendar model change does not recompile `signapps-ai`
- [ ] `cargo deny check` still passes (license compliance)

---

## Out of Scope

- Moving SQL migrations (those stay in `migrations/` at workspace root)
- Changing the database schema
- Splitting `signapps-common`  (covered by Refactor 2)
- Moving handler logic between services (covered by Refactor 3)
