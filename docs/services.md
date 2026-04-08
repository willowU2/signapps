# Service Directory

Quick reference for all SignApps Platform services. State as of 2026-04-08 (post-refactoring session).

For full architecture details see `docs/ARCHITECTURE.md`. For build and run commands see the root `CLAUDE.md`.

---

## Backend Services

| Service | Port | Purpose | Key routes |
|---------|------|---------|-----------|
| signapps-identity | 3001 | IAM core: authentication, LDAP/AD sync, MFA TOTP, RBAC, sessions, API keys, JWKS | `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `GET /api/v1/auth/me`, `POST /api/v1/auth/mfa/*`, `GET /api/v1/users`, `GET /api/v1/groups`, `GET /api/v1/roles`, `GET /api/v1/tenants`, `GET /.well-known/jwks.json`, `GET /api/v1/workspaces/*` |
| signapps-containers | 3002 | Docker container lifecycle, app store, networks | `GET /api/v1/containers`, `POST /api/v1/containers`, `DELETE /api/v1/containers/:id`, `GET /api/v1/containers/:id/logs`, `GET /api/v1/images`, `GET /api/v1/networks` |
| signapps-proxy | 3003 | Reverse proxy, TLS/ACME, SmartShield rate-limit | `GET /api/v1/proxy/rules`, `POST /api/v1/proxy/rules`, `GET /api/v1/proxy/certificates`, `GET /api/v1/proxy/stats` |
| signapps-storage | 3004 | File storage (OpenDAL: FS or S3), RAID, quotas, WebDAV | `GET /files/:bucket`, `POST /files/:bucket`, `GET /files/:bucket/info/*key`, `DELETE /files/:bucket/batch`, `POST /files/copy`, `POST /files/move`, `GET /api/v1/drive/*` |
| signapps-ai | 3005 | AI Gateway: RAG, LLM chat, Vision, ImageGen, Audio | `POST /chat`, `POST /chat/stream` (SSE), `GET /search`, `POST /index`, `DELETE /index/:document_id`, `POST /api/v1/ai/vision`, `POST /api/v1/ai/imagegen`, `POST /api/v1/ai/audiogen` |
| signapps-securelink | 3006 | Web tunnels, DNS ad-blocking, DHCP UDP listener | `GET /api/v1/tunnels`, `POST /api/v1/tunnels`, `GET /api/v1/dns/blocklists`, `POST /api/v1/dns/blocklists` |
| signapps-scheduler | 3007 | CRON job management | `GET /api/v1/cron/jobs`, `POST /api/v1/cron/jobs`, `PUT /api/v1/cron/jobs/:id`, `DELETE /api/v1/cron/jobs/:id` |
| signapps-metrics | 3008 | System monitoring, Prometheus scrape, threshold alerts | `GET /api/v1/metrics/system`, `GET /api/v1/metrics/services`, `GET /metrics` (Prometheus), `GET /api/v1/alerts`, `POST /api/v1/alerts` |
| signapps-media | 3009 | Native STT/TTS/OCR (whisper-rs, piper-rs, ocrs), voice WebSocket | `POST /api/v1/media/transcribe`, `POST /api/v1/media/synthesize`, `POST /api/v1/media/ocr`, `WS /api/v1/media/voice` |
| signapps-docs | 3010 | Collaborative document editing (Tiptap/CRDT), real-time collab, office import/export | `GET /api/v1/documents`, `POST /api/v1/documents`, `GET /api/v1/documents/:id`, `WS /api/v1/documents/:id/ws`, `POST /api/v1/documents/:id/export` |
| signapps-calendar | 3011 | Unified calendar: events, tasks, leaves, shifts, bookings, CRON, timesheets | `GET /api/v1/calendars`, `POST /api/v1/calendars`, `GET /api/v1/events`, `POST /api/v1/events`, `GET /api/v1/tasks`, `GET /api/v1/timezones`, `/caldav/*` (CalDAV compat) |
| signapps-mail | 3012 | Email service: IMAP/SMTP sync, FTS, mailboxes | `GET /api/v1/mailboxes`, `GET /api/v1/messages`, `POST /api/v1/messages/send`, `GET /api/v1/messages/:id`, `POST /api/v1/messages/:id/reply` |
| signapps-meet | 3014 | Video conferencing (LiveKit) + remote desktop | `POST /api/v1/meet/rooms`, `GET /api/v1/meet/rooms/:id`, `GET /api/v1/meet/rooms/:id/token`, `POST /api/v1/remote/sessions` |
| signapps-forms | 3015 | Form builder, submissions, analytics | `GET /api/v1/forms`, `POST /api/v1/forms`, `GET /api/v1/forms/:id`, `POST /api/v1/forms/:id/submit`, `GET /api/v1/forms/:id/submissions` |
| signapps-pxe | 3016 | PXE network boot, image deployment, DC network services | `GET /api/v1/pxe/images`, `POST /api/v1/pxe/images`, `GET /api/v1/pxe/clients`, `POST /api/v1/pxe/boot-profiles` |
| signapps-social | 3019 | Social media management (accounts, posts, campaigns) | `GET /api/v1/social/accounts`, `POST /api/v1/social/posts`, `GET /api/v1/social/posts`, `POST /api/v1/social/campaigns` |
| signapps-chat | 3020 | Team messaging and channels | `GET /api/v1/channels`, `POST /api/v1/channels`, `GET /api/v1/channels/:id/messages`, `POST /api/v1/channels/:id/messages`, `WS /api/v1/channels/:id/ws` |
| signapps-contacts | 3021 | Contact management (CRM persons, organizations) | `GET /api/v1/contacts`, `POST /api/v1/contacts`, `GET /api/v1/contacts/:id`, `PUT /api/v1/contacts/:id`, `GET /api/v1/contacts/organizations` |
| signapps-it-assets | 3022 | IT asset management, sites, resources | `GET /api/v1/assets`, `POST /api/v1/assets`, `GET /api/v1/assets/:id`, `GET /api/v1/sites`, `GET /api/v1/resources` |
| signapps-workforce | 3024 | HR, workforce management, LMS courses, supply chain | `GET /api/v1/employees`, `POST /api/v1/employees`, `GET /api/v1/departments`, `GET /api/v1/lms/courses`, `GET /api/v1/supply-chain` |
| signapps-vault | 3025 | Password vault and credential store | `POST /api/v1/vault/keys`, `GET /api/v1/vault/keys`, `PUT /api/v1/vault/keys`, `GET /api/v1/vault/items`, `POST /api/v1/vault/items`, `GET /api/v1/vault/items/:id` |
| signapps-org | 3026 | Organizational structure: nodes, trees, assignments | `GET /api/v1/org/nodes`, `POST /api/v1/org/nodes`, `GET /api/v1/org/nodes/:id`, `PUT /api/v1/org/nodes/:id`, `GET /api/v1/org/trees` |
| signapps-webhooks | 3027 | Outbound webhook management and incoming webhook receiver | `GET /api/v1/webhooks`, `POST /api/v1/webhooks`, `GET /api/v1/webhooks/:id`, `DELETE /api/v1/webhooks/:id`, `POST /webhooks/incoming/:slug` |
| signapps-signatures | 3028 | Electronic signature workflows, user stamps | `GET /api/v1/signatures`, `POST /api/v1/signatures`, `GET /api/v1/signatures/:id`, `POST /api/v1/signatures/:id/sign`, `GET /api/v1/stamps` |
| signapps-tenant-config | 3029 | Tenant branding and CSS customization | `GET /api/v1/tenants/:id/config`, `PUT /api/v1/tenants/:id/config`, `GET /api/v1/tenants/:id/css`, `PUT /api/v1/tenants/:id/css` |
| signapps-integrations | 3030 | External integrations (Slack, Teams, Discord) | `GET /api/v1/integrations/slack/config`, `POST /api/v1/integrations/slack/send`, `POST /integrations/slack/events` (Slack event receiver), `GET /api/v1/integrations` |
| signapps-backup | 3031 | Database and file backup management | `POST /api/v1/admin/backup`, `GET /api/v1/admin/backups`, `GET /api/v1/admin/backups/:id`, `POST /api/v1/admin/backups/:id/restore` |
| signapps-compliance | 3032 | GDPR compliance, data export, retention policies, audit logs | `GET /api/v1/audit-logs`, `GET /api/v1/audit-logs/:id`, `GET /api/v1/audit-logs/export`, `POST /api/v1/audit`, `GET /api/v1/compliance/data-export`, `GET /api/v1/compliance/retention-policies` |
| signapps-notifications | 8095 | Push notifications (Web Push, FCM) | `POST /api/notifications/subscribe`, `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all` |
| signapps-billing | 8096 | Billing, subscriptions, invoices, FEC accounting | `GET /api/v1/billing/plans`, `POST /api/v1/billing/subscriptions`, `GET /api/v1/billing/invoices`, `GET /api/v1/billing/usage` |
| signapps-gateway | 3099 | API gateway aggregator — all frontend traffic goes here | `GET /gateway/health`, `GET /api/v1/apps/discover`, `POST /api/v1/graphql`, `GET /api/v1/graphql/schema`, then proxies all `/api/v1/*` to the appropriate service |

---

## Frontend

| Component | Port | Description |
|-----------|------|-------------|
| client (Next.js 16) | 3000 | Full UI — App Router, React 19, Zustand, shadcn/ui, Tailwind CSS 4 |

Dev login bypass: `http://localhost:3000/login?auto=admin`

---

## Shared Crate Routes (integrated in-service)

These are not standalone services but crate-level routers merged into service instances:

| Crate | Route pattern (per resource type) | Merged into |
|-------|----------------------------------|-------------|
| signapps-sharing | `GET/POST /api/v1/{prefix}/:id/grants`, `DELETE /api/v1/{prefix}/:id/grants/:grant_id`, `GET /api/v1/{prefix}/:id/permissions`, `GET/POST /api/v1/sharing/templates`, `GET /api/v1/sharing/audit`, `POST /api/v1/sharing/bulk-grant`, `GET /api/v1/shared-with-me` | signapps-storage, signapps-calendar, signapps-docs |

---

## Protocol-Level Services (crates, not HTTP services)

These crates implement native network protocols, embedded in signapps-identity or signapps-pxe:

| Crate | Protocol | Port/Usage |
|-------|----------|-----------|
| signapps-ldap-server | RFC 4511 LDAP + StartTLS | 389/636 (via identity) |
| signapps-kerberos-kdc | Kerberos AS/TGS (AES-CTS + RC4) | 88 TCP/UDP |
| signapps-dns-server | DNS authoritative + AXFR | 53 UDP/TCP |
| signapps-smb-sysvol | SMB2 SYSVOL share | 445 |
| signapps-imap | IMAP4rev1 | 143/993 (via mail) |
| signapps-smtp | SMTP MSA/MTA | 25/587/465 (via mail) |
| signapps-dav | WebDAV/CalDAV/CardDAV | embedded in calendar/contacts |

---

## Health Checks

Every service exposes `GET /health` returning `200 OK` with `{"status": "ok"}`.

The gateway's `GET /gateway/health` aggregates health across all services.

---

## OpenAPI / Swagger UI

Every service exposes:
- `GET /swagger-ui/` — Swagger UI
- `GET /api-docs/openapi.json` — raw OpenAPI 3.x schema
