# Module Compliance (RGPD / GDPR) -- Functional Specification

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **OneTrust** | Privacy management platform leader (Gartner), DPIA automation, cookie consent, data mapping, vendor risk assessment, incident response, rights automation (DSAR), 200+ data source connectors, privacy impact assessment templates, regulatory intelligence |
| **TrustArc** | Privacy compliance platform, nymity accountability framework, cookie consent, privacy assessments, data flow visualization, regulatory change alerts, benchmarking, reporting dashboards |
| **Securiti** | Data intelligence + privacy automation, sensitive data discovery AI, data mapping auto, breach management, consent management, DSR orchestration, vendor management, 100+ cloud connectors |
| **BigID** | Data discovery & classification ML, privacy by design, data retention automation, DSAR fulfillment, data minimization insights, catalog integration, identity-aware scanning |
| **DataGrail** | Real-time data mapping, live integrations (500+), DSR automation, consent preference center, privacy risk scoring, deletion verification, audit-ready reporting |
| **Osano** | Consent management platform simple, vendor monitoring, data privacy ratings, cookie consent banner, regulatory tracker, no-code deployment, teacher-style compliance scoring |
| **Cookiebot (Usercentrics)** | Cookie consent management leader, auto-scanning des cookies, categorisation automatique, consentement granulaire, TCF 2.2, Google Consent Mode, multi-langue, audit reports |
| **iubenda** | Privacy policy generator multi-juridiction (RGPD, CCPA, LGPD, PIPA), cookie consent, terms generator, consent database, internal privacy management, SaaS + embedded |
| **Vanta** | Compliance automation (SOC 2, ISO 27001, HIPAA, GDPR), continuous monitoring, evidence collection, access reviews, vendor risk assessment, trust center, integrations 300+ |
| **Drata** | Compliance automation (SOC 2, ISO 27001, GDPR, HIPAA), continuous control monitoring, evidence auto-collection, risk assessment, policy templates, auditor dashboard |
| **CNIL (authority)** | PIA Software officiel open source, guides methodologiques RGPD, referentiels sectoriels, registre des traitements, formulaire DPIA structure en 9 etapes |
| **Didomi** | Consent management, preference center, privacy center, compliance analytics, A/B testing consent, cross-device consent sync, TCF/GCM, API-first |

## Principes directeurs

1. **GDPR-first, extensible** -- the module natively covers EU GDPR (processing register, DPIA, DSAR, consent, retention, breach). The architecture allows adding other regulations (CCPA, LGPD, PIPA) without redesign.
2. **Guided wizard, not empty form** -- every complex process (DPIA, DSAR, breach incident) is guided step-by-step with descriptions, examples, and contextual help. The user never has to wonder "what to put in this field".
3. **Immutable audit trail** -- every action in the Compliance module is traced in an immutable audit log: who did what, when, on which data. This log is the proof of compliance for authorities.
4. **Regulatory calendar** -- recurring obligations (annual DPIA review, register update, DPO training) are managed by an integrated calendar with automatic reminders.
5. **Maximum automation** -- retention durations trigger automatic deletion, DSAR requests follow an automated workflow, consents are tracked automatically.
6. **Exportable documentation** -- every element (DPIA, register, privacy policy) is exportable as PDF for transmission to supervisory authorities (CNIL, ICO, etc.).

---

## Category 1 -- DPIA Wizard (Data Protection Impact Assessment)

### 1.1 Six-step wizard
The DPIA process is guided by a 6-step wizard with a horizontal progress bar at the top (`bg-muted` track, `bg-primary` fill, animated width transition 300ms):
1. **Overview** -- General project information
2. **Processing** -- Description of data processing activities
3. **Risk Assessment** -- Evaluate risks on a probability x severity matrix
4. **Mitigation** -- Define mitigation measures for each risk
5. **DPO Review** -- DPO opinion and approval
6. **Report** -- Generate the final DPIA report

Navigation: "Next" and "Back" buttons at the bottom. "Save Draft" button always visible (saves current state without validation). Each step validates its own fields before allowing progression; validation errors are displayed inline with `text-destructive` under the field. The wizard state is persisted to the database on every "Next" click so progress is not lost on browser close.

### 1.2 Step 1: Overview
Form fields:
- **Project name** (text input, required, max 200 chars) -- e.g., "HR Platform Upgrade"
- **Data Controller** (text input, required) -- name of the organization responsible for processing
- **Data Controller contact** (email input, required) -- contact email
- **DPO Name** (autocomplete from organization users, required) -- Data Protection Officer
- **DPO Email** (auto-filled from selected user)
- **Assessment date** (date picker, required, defaults to today)
- **Description** (rich text editor, required, min 50 chars) -- describe the planned processing and its purposes
- **Legal basis** (select dropdown: consent, contract, legal obligation, legitimate interest, public interest, vital interests) -- GDPR Article 6
- **Categories of data subjects** (multi-select chips: employees, clients, candidates, suppliers, minors, patients, visitors, partners)
- **Is this a new processing or an update?** (radio: New / Update to existing DPIA) -- if update, select parent DPIA from dropdown

Keyboard shortcut: `Ctrl+Enter` to proceed to next step.

### 1.3 Step 2: Processing Activities
Table of processing activities (one or more rows):
For each activity:
- **Activity name** (text, required) -- e.g., "Payroll calculation"
- **Data categories** (multi-select: identity, contact, financial, health, biometric, geolocation, political opinions, criminal data, racial/ethnic origin, trade union membership, genetic, sexual orientation)
- **Data source** (text: direct collection, third party, observation, public source)
- **Recipients** (text: internal departments, subcontractors, third parties) with a "+" button to add multiple
- **Transfers outside EU** (toggle + country selector + safeguard type: standard contractual clauses, adequacy decision, BCR, explicit consent)
- **Retention period** (number + unit: days/months/years + justification text)
- **Technical measures** (checkboxes: encryption at rest, encryption in transit, pseudonymization, anonymization, access control, logging, backup)

"Add another processing activity" button at the bottom. Activities are displayed as collapsible cards. Drag handle to reorder.

### 1.4 Step 3: Risk Assessment
Risk matrix grid: X-axis = Likelihood (1-4: negligible, limited, significant, maximum), Y-axis = Severity (1-4: negligible, limited, significant, maximum). Each cell is color-coded: green (score 1-4), orange (score 5-8), red (score 9-16).

Pre-defined risks (checkboxes, user adds custom):
- Unauthorized access to personal data
- Unwanted modification of data
- Data loss or destruction
- Re-identification of pseudonymized data
- Excessive data collection
- Unauthorized disclosure to third parties
- Non-compliance with data subject rights
- Inadequate security measures

For each selected risk: click on the matrix cell to set likelihood and severity. The risk score auto-calculates (likelihood x severity). Summary table below the matrix: Risk name, Likelihood, Severity, Score, Status (assessed/mitigated). Risks with score >= 9 are flagged as "High risk -- mitigation required" with a red warning banner.

### 1.5 Step 4: Mitigation Measures
For each risk identified in Step 3, define mitigation measures:
- **Measure description** (text, required) -- e.g., "Implement AES-256 encryption for all stored personal data"
- **Measure type** (select: technical, organizational, contractual)
- **Responsible person** (autocomplete from organization users)
- **Implementation status** (select: planned, in progress, implemented, verified)
- **Target date** (date picker, required if status is "planned" or "in progress")
- **Residual risk after measure** (click on a mini risk matrix to set post-mitigation likelihood and severity)

The residual risk score is displayed next to the original score: "Risk: 12 -> 4 (reduced)". If residual risk is still >= 9, a warning appears: "Residual risk remains high. Consider additional measures." Measures are displayed as cards grouped by risk. "Add measure" button under each risk.

### 1.6 Step 5: DPO Review
- **DPO opinion** (rich text area, required) -- the DPO writes their assessment of the DPIA
- **Recommendation** (select: proceed, proceed with conditions, do not proceed)
- **Conditions** (text area, visible only if "proceed with conditions" is selected)
- **DPO signature** (checkbox: "I, [DPO name], confirm this assessment on [date]")
- **Data Controller signature** (checkbox: "I, [Controller name], acknowledge this DPIA on [date]")

Both signatures are timestamped and stored as audit trail entries. The DPIA status changes to "Reviewed" when the DPO signs and "Approved" when the Controller signs.

### 1.7 Step 6: Report Generation
Automatic generation of the DPIA report in PDF format conforming to CNIL/ICO requirements:
- Cover page: project name, data controller, DPO, assessment date, version number
- Executive summary (auto-generated from step data)
- Processing activities table
- Risk matrix visualization (before and after mitigation)
- Mitigation plan table with status and deadlines
- DPO opinion and recommendations
- Signatures with timestamps

Export options: PDF (primary), Word (DOCX), HTML. Archive in the Drive module with compliance tag. Download button and "Send to DPO by email" button. The report includes a unique reference number (e.g., "DPIA-2026-0042") for traceability.

### 1.8 DPIA versioning and history
Each DPIA is versioned. Modifications create a new version (v1, v2, v3...) with diff tracking (who changed what, when). Version comparison: side-by-side view highlighting changes in red/green. The latest approved version is the authoritative one. Admin can lock a DPIA to prevent further edits.

### 1.9 DPIA templates
Template library by sector: HR, Marketing, Health, E-commerce, Video surveillance, AI/ML, IoT, SaaS. Each template pre-fills standard fields (common risks, typical measures, suggested retention periods). Admin can create custom templates from completed DPIAs. Templates are tagged and searchable.

### 1.10 DPIA review reminders
Automatic reminder N months after approval (configurable, default: 12 months): "DPIA [project name] is due for annual review." Notification to the DPO and the responsible person. If not reviewed within 30 days of the reminder, escalation to admin.

---

## Category 2 -- Processing Register (Record of Processing Activities)

### 2.1 Register table
Table listing all data processing activities of the organization (Article 30 GDPR compliance). Columns: Name, Purpose, Legal basis, Data categories, Data subject categories, Recipients, Retention period, Security measures, Created date, Last updated, Status (active/archived/under review).

Sortable by any column. Filterable by: legal basis, data category, status. Search bar for text search across all fields. Export button (PDF/Excel/CSV). Row click opens the processing activity detail view.

### 2.2 Add a processing activity
Structured form for creating a register entry (Article 30 GDPR):
- **Name** (text, required)
- **Purpose/Finality** (text, required) -- why is this data processed?
- **Legal basis** (select from GDPR Article 6 bases, required)
- **Data categories** (multi-select, required)
- **Data subject categories** (multi-select, required)
- **Recipients** (text list)
- **Transfers outside EU** (toggle + details)
- **Retention period** (number + unit + justification)
- **Security measures** (checkboxes + free text)
- **Joint controller** (toggle + details if applicable)
- **Automated decision-making** (toggle + details if applicable, GDPR Article 22)

Required fields marked with asterisk. Contextual help icon next to each field showing the relevant GDPR article reference (e.g., "Article 30(1)(b): purposes of the processing").

### 2.3 Sub-processors (data processors)
For each processing activity, list of sub-processors involved:
- Name, Country, DPA (Data Processing Agreement) status (yes/no + date), Safeguards type (SCC, adequacy, BCR)
- "Add sub-processor" button opens a form with these fields
- Status badges: green = DPA signed, orange = DPA pending, red = no DPA
- Alert: if a sub-processor has no DPA for > 30 days, a warning appears

### 2.4 Register export
Export the complete register in:
- **PDF** (CNIL format) -- structured with table of contents, one page per processing activity
- **Excel** (XLSX) -- one row per activity, columns matching CNIL register model
- **CSV** -- machine-readable for import into other tools
Export includes a header with: organization name, DPO name, export date, register version.

### 2.5 Periodic review
Configurable reminder (quarterly, semi-annual, annual) to review and update each processing activity. The DPO receives a notification with the list of activities due for review. Each activity shows "Last reviewed: [date]" and "Next review due: [date]". Overdue reviews are flagged with a red badge.

---

## Category 3 -- Consent Management

### 3.1 Consent register
Table of collected consents: Data subject (name/ID), Consent purpose (newsletter, cookies, marketing, profiling, analytics), Collection date, Collection method (form, checkbox, double opt-in, verbal), Withdrawal date (if applicable), Proof (link to form submission or audit log entry).

Filterable by: purpose, status (active/withdrawn), date range, collection method. Exportable for audit.

### 3.2 Consent collection widget
Embeddable widget for collecting consent with:
- Clear, understandable text (plain language, no legal jargon)
- Purposes listed with individual toggle switches (not pre-checked, GDPR requirement)
- "Accept all" button (secondary style, not the most prominent)
- "Reject all" button (same visual weight as Accept)
- "Save preferences" button (primary)
- Link to the full privacy policy
- Language selector (auto-detected from browser locale)
Compliant with EDPB guidelines on valid consent: freely given, specific, informed, unambiguous.

### 3.3 Consent proof storage
Each consent is stored with immutable proof:
- Exact timestamp (millisecond precision)
- User identifier (user_id or email)
- Exact text presented to the user (versioned)
- Action taken (accepted/rejected per purpose)
- IP address
- User-Agent string
- Form/page URL where consent was collected
Append-only storage: proofs cannot be modified or deleted. Exportable as JSON for auditors.

### 3.4 Consent withdrawal
User can withdraw consent at any time via the preference center. Withdrawal is:
- Immediately effective
- Timestamped in the consent register
- Triggering: stop of all processing based on that consent (notification to relevant services via PgEventBus event `consent.withdrawn`)
- Displayed in the user's preference center with the withdrawal date
No penalty for withdrawal (GDPR Article 7(3)).

### 3.5 Preference center
Page accessible to each user at `/settings/privacy` listing their active consents with toggles:
- Each purpose: toggle on (consented) / off (withdrawn)
- History of changes (expandable per purpose: "Consented on 2026-01-15, Withdrawn on 2026-03-20, Re-consented on 2026-04-01")
- Link in every marketing email footer: "Manage your preferences"
- Accessible without full authentication (token-based link in emails)

### 3.6 Cookie consent banner
Configurable cookie consent banner for the SignApps web application:
- Banner position: bottom bar (default), top bar, center modal
- Categories: Strictly necessary (always on, no toggle), Functional, Analytics, Marketing
- Text customizable by admin
- "Accept all" / "Reject all" / "Customize" buttons
- Remembers choice for N days (configurable, default 365)
- Re-prompts if the cookie policy version changes
- Google Consent Mode integration (gtag update)
- Rendered with `bg-card border-t border-border` styling, animated slide-up (200ms)

### 3.7 Minor consent handling
If the data subject category includes "minors":
- Age verification step (date of birth input)
- If under legal age (configurable per country: 16 years GDPR default, 13 years France, 13 years US COPPA):
  - Parental consent workflow: generate a link sent to the parent/guardian's email
  - Parent must confirm consent via the link within 7 days
  - If no confirmation, consent is void and data is deleted
- Audit trail records the minor verification and parental consent

---

## Category 4 -- Data Retention and Deletion

### 4.1 Retention policies table
Table of retention policies per data type:
| Column | Content |
|---|---|
| Data type | e.g., "Employee HR records", "Marketing emails", "Application logs" |
| Module | Source module (Identity, Mail, Calendar, etc.) |
| Retention period | Duration (e.g., "5 years after employment end") |
| Legal basis | Why this duration (GDPR article, national law, contractual obligation) |
| Action at expiration | Deletion / Anonymization / Archival |
| Responsible | Person responsible for review |
| Status | Active / Under review / Archived |

Admin CRUD: create, edit, archive policies. Each policy has a unique code (e.g., "RET-HR-001").

### 4.2 Automatic enforcement
Retention policies are executed automatically:
1. Daily cron job (3am UTC) in `signapps-metrics` evaluates all active policies
2. For each policy: query the source module for data exceeding the retention period
3. Action: soft-delete (30-day grace period) then hard-delete, or anonymize (replace PII with tokens)
4. Deletion log entry: what was deleted, when, by which policy, count of records affected
5. Notification to the responsible person: "Policy RET-HR-001 deleted 42 records on 2026-04-10"

Anonymization replaces PII fields (name, email, phone, address) with irreversible tokens while preserving non-PII fields (aggregate data, timestamps) for analytics.

### 4.3 Pre-deletion alerts
Notification N days before expiration (configurable, default 30 days): "42 employee records will be deleted on 2026-05-10 under policy RET-HR-001. Review and extend if needed." The responsible person can:
- Confirm deletion (proceed as scheduled)
- Extend retention (with justification, logged in audit trail)
- Request exception (escalated to DPO for approval)

### 4.4 Secure deletion
Deletion is irreversible:
- Database records: `DELETE` with `CASCADE` on related tables. No soft-delete for retention-governed data.
- Files in storage: overwritten with zeros (via `signapps-storage` secure delete API), then removed
- Backups: marked for exclusion in the next backup cycle. Previous backups containing the data are flagged with a retention expiry metadata.
- Search index: corresponding entries removed from `search_index`
- Embeddings: removed from pgvector tables

### 4.5 Retention dashboard
Admin dashboard showing:
- Data expiring this month (count by policy)
- Data deleted this month (count by policy)
- Total data volume per policy (bar chart)
- Overdue data (data exceeding retention period without deletion -- compliance gap)
- Policy coverage: modules with/without retention policies (gap analysis)

---

## Category 5 -- DSAR Handling (Data Subject Access Requests)

### 5.1 Request submission form
Form for data subjects to submit a rights request:
- **Requester identity** (full name, email, required)
- **Identity verification** (file upload for ID document -- stored encrypted, auto-deleted after verification)
- **Right exercised** (select: access, rectification, erasure/right to be forgotten, portability, restriction, objection) -- GDPR Articles 15-21
- **Description** (text area, required) -- specific request details
- **Preferred response format** (select: email, postal mail, download portal)
- **CAPTCHA** (to prevent automated submissions)

Submission generates a reference number (e.g., "DSAR-2026-0042") and confirmation email to the requester. The form is accessible at `/privacy/request` without requiring SignApps authentication.

### 5.2 Automated workflow
Each DSAR follows a state machine workflow:
1. **Received** -- auto-assigned to DPO, timer starts (30 calendar days, GDPR Article 12(3))
2. **Identity Verification** -- DPO verifies the requester's identity. If additional info needed, status moves to "Pending Verification" and timer pauses.
3. **Data Search** -- cross-module data search (see 5.3). Status: "In Progress"
4. **Processing** -- DPO reviews found data, prepares response. Status: "Processing"
5. **Response** -- DPO sends response to requester. Status: "Responded"
6. **Closed** -- After response, the DSAR is closed. Status: "Closed"
7. **Rejected** -- If request is manifestly unfounded or excessive (GDPR Article 12(5)). Requires documented justification.

At each step: timestamp, responsible person, notes. The 30-day countdown is prominently displayed with color: green (>15 days), orange (7-15 days), red (<7 days). Alert at 7 days, 3 days, and 1 day remaining.

### 5.3 Cross-module data search
From a DSAR, button "Search all data for this person". The system queries all SignApps modules to compile a complete dossier:
- **Identity**: user account, profile, roles, permissions, login history
- **Mail**: emails sent/received by this person
- **Calendar**: events involving this person
- **Contacts**: contact entries matching this person
- **Drive**: files owned by or shared with this person
- **Docs**: documents authored by or mentioning this person
- **Chat**: messages sent by this person
- **Forms**: form submissions by this person
- **Billing**: invoices and payment records
- **Compliance**: consent records, previous DSARs

Results are compiled into a summary table: Module, Item count, Preview link. DPO reviews each module's data before including in the response.

### 5.4 Data portability export
For portability requests (GDPR Article 20):
- Automatic generation of a ZIP archive containing:
  - `profile.json` -- user profile data
  - `emails/` -- emails in EML format
  - `contacts.json` -- contacts in vCard format
  - `calendar.json` -- events in iCalendar format
  - `documents/` -- documents in original format
  - `files/` -- uploaded files
  - `forms.json` -- form submissions
  - `metadata.json` -- index file listing all included data
- Format: structured JSON + original files (machine-readable, GDPR Article 20(1))
- Download link sent to the requester (expires in 7 days, password-protected)

### 5.5 DSAR register
Table of all received requests:
| Column | Content |
|---|---|
| Reference | DSAR-2026-0042 |
| Requester | Name + email |
| Right | Access / Erasure / Portability / etc. |
| Status | Received / Verifying / In Progress / Responded / Closed / Rejected |
| Received date | Submission timestamp |
| Response date | Response timestamp (or "--") |
| Days remaining | Countdown (or "Completed") |
| Assignee | DPO or delegate |
| Deadline met | Yes (green) / No (red) |

Filterable by status, right type, date range. Exportable for reporting. Dashboard widget: "3 DSARs in progress, 1 nearing deadline."

### 5.6 Response templates
Library of response templates per right type:
- **Access response**: "Dear [name], in response to your data access request (ref: [ref]), please find attached all personal data we hold about you..."
- **Erasure confirmation**: "Dear [name], we confirm that all your personal data has been erased from our systems on [date]..."
- **Portability response**: "Dear [name], please find your data in the attached archive..."
- **Rejection (unfounded)**: "Dear [name], after review, your request has been deemed manifestly unfounded because..."
- **Extension notice**: "Dear [name], we need additional time to process your request. The new deadline is [date+60 days]..."

Templates are customizable by admin. Merge fields: `[name]`, `[ref]`, `[date]`, `[dpo_name]`, `[org_name]`. Send via the Mail module directly from the DSAR workflow.

---

## Category 6 -- Breach Notification Workflow

### 6.1 Incident declaration form
Form to declare a data breach:
- **Discovery date** (datetime picker, required) -- when was the breach discovered?
- **Breach nature** (multi-select: confidentiality, integrity, availability)
- **Data categories affected** (multi-select: identity, financial, health, biometric, etc.)
- **Number of persons affected** (number input, or "unknown" checkbox)
- **Description** (rich text, required) -- what happened?
- **Immediate measures taken** (text) -- what has been done so far?
- **Reporter** (auto-filled with current user)

Submission starts the 72-hour countdown for authority notification (GDPR Article 33).

### 6.2 Severity assessment
Matrix identical to DPIA risk assessment: likelihood of harm x severity of harm. Score determines obligation:
- Score 1-4 (low): internal record only, no notification required
- Score 5-8 (medium): notify supervisory authority (CNIL/ICO)
- Score 9-16 (high): notify supervisory authority AND notify affected persons

The assessment is guided with examples: "Unauthorized access to unencrypted health data of 10,000 patients = severity 4, likelihood 4 = score 16 (high)."

### 6.3 72-hour authority notification timer
Prominent countdown timer from the discovery date: "71h 23m remaining to notify authority". Visual states:
- Green: > 48h remaining
- Orange: 24-48h remaining
- Red: < 24h remaining
- Flashing red: < 6h remaining
- Black with red text: "OVERDUE by Xh"

At 48h, 24h, 6h, and 1h: push notification + email to DPO and admin.

### 6.4 Authority notification form
Auto-generated CNIL/ICO notification form (Article 33) pre-filled from the incident declaration:
- Nature of the breach
- Categories and approximate number of data subjects
- Categories and approximate number of data records
- Name and contact of DPO
- Likely consequences
- Measures taken or proposed
- Reason for delay (if notifying after 72h)

Export as PDF for submission. "Mark as notified" button records the notification date, authority name, and reference number in the register.

### 6.5 Person notification
If required (Article 34 -- high severity), generate notification email to affected persons:
- Nature of the breach (plain language)
- Likely consequences
- Measures taken and recommended actions for the person (e.g., "change your password")
- DPO contact information
- Link to more information

Sent via `signapps-mail` to all affected persons. Bulk send with tracking (sent/delivered/bounced). Template customizable by admin.

### 6.6 Breach register
Immutable journal of all breaches:
| Column | Content |
|---|---|
| Reference | BRE-2026-0007 |
| Discovery date | Timestamp |
| Nature | Confidentiality / Integrity / Availability |
| Severity score | Number + color badge |
| Persons affected | Count |
| Authority notified | Yes/No + date |
| Persons notified | Yes/No + date |
| Status | Open / Investigating / Closed |
| Post-mortem | Link to post-mortem document |

Retained indefinitely (no deletion). Exportable for audit. Compliance dashboard widget: "2 breaches this year, 0 notifications overdue."

### 6.7 Post-mortem
For each closed breach, structured post-mortem section:
- **Root cause** (text, required)
- **Contributing factors** (text list)
- **Corrective measures** (table: measure, responsible, deadline, status)
- **Preventive measures** (table: measure, responsible, deadline, status)
- **Lessons learned** (text)
Action items are tracked until completion. Overdue items are flagged.

---

## Category 7 -- DPO Dashboard and Compliance Score

### 7.1 Compliance score
Aggregate compliance score (0-100%) displayed as a large circular gauge on the DPO dashboard. Score computed from:
- Processing register completeness: all processing activities documented? (weight: 20%)
- DPIA coverage: all high-risk processing have approved DPIAs? (weight: 20%)
- DSAR response rate: all DSARs answered within 30 days? (weight: 15%)
- Consent coverage: all purposes have valid consent records? (weight: 15%)
- Retention enforcement: all policies active and enforced? (weight: 10%)
- Breach handling: all breaches have post-mortems? (weight: 10%)
- Audit trail integrity: hash chain valid? (weight: 10%)

Color: green (>80%), orange (50-80%), red (<50%). Trend arrow (up/down) compared to previous month.

### 7.2 DPO dashboard widgets
- **Compliance score** (gauge, see 7.1)
- **Open DSARs** (count + list with deadlines)
- **Pending DPIA reviews** (count + list)
- **Upcoming regulatory obligations** (calendar widget, next 30 days)
- **Recent audit trail entries** (last 20 actions)
- **Retention alerts** (data expiring soon)
- **Active breaches** (count + timer for 72h notification)
- **Register gaps** (modules without documented processing activities)

### 7.3 Cross-border data transfer documentation
Dedicated section for documenting data transfers outside the EU/EEA:
- Transfer record: source country, destination country, transfer mechanism (SCC, adequacy decision, BCR, derogation), data categories, recipient
- Risk assessment per transfer (required by Schrems II)
- SCC version tracking (latest version date, renewal reminders)
- Transfer impact assessment (TIA) document linked

---

## Category 8 -- Audit Trail

### 8.1 Immutable audit journal
Every action in the Compliance module is logged:
- **Timestamp** (millisecond precision, UTC)
- **User** (user_id + full name)
- **Action** (create, update, delete, view, export, approve, reject, sign)
- **Object** (DPIA, register entry, consent, DSAR, breach, policy, template)
- **Object ID** (UUID reference)
- **Before value** (JSON snapshot of the object before change, for update/delete)
- **After value** (JSON snapshot after change, for create/update)
- **IP address** and **User-Agent**

### 8.2 Search in audit trail
Filters: date range, user, action type, object type, object ID. Full-text search on the action description. Export to CSV or PDF. Pagination: 50 entries per page.

### 8.3 Hash chain integrity
The audit trail is append-only (no UPDATE, no DELETE on the table). Each entry includes a SHA-256 hash of the previous entry, forming a chain:
- `hash = SHA256(previous_hash + timestamp + user_id + action + object_id + after_value)`
- Admin can run "Verify integrity" which checks the entire chain and reports any broken links
- If a gap is detected: red alert "AUDIT TRAIL INTEGRITY COMPROMISED -- [N] entries with broken hash chain"

### 8.4 Audit reports
Auto-generated periodic reports:
- **Monthly activity report**: actions by user, actions by type, new entries by module
- **DSAR compliance report**: response times, deadline adherence, rejection rates
- **DPIA review status**: due, overdue, completed
- **Retention enforcement report**: deletions performed, exceptions granted
Format: PDF (via `@react-pdf/renderer`). Auto-emailed to DPO on the 1st of each month.

---

## Category 9 -- Regulatory Calendar

### 9.1 Calendar view of obligations
Monthly/quarterly calendar displaying recurring regulatory obligations:
- Annual DPIA review (each DPIA anniversary)
- Semi-annual register update
- Annual DPO training/certification renewal
- Annual sub-processor review
- Quarterly backup restoration test
- Annual privacy policy update
- Monthly retention enforcement review

Each obligation is an event with: title, due date, responsible person, status (scheduled/in progress/completed/overdue), recurrence rule.

### 9.2 Automatic reminders
Notifications sent N days before each deadline (configurable per obligation, default: 30, 7, 1 day). Recipients: assigned responsible person + DPO. Channels: in-app notification + email. If not completed by due date: daily reminders + escalation to admin after 7 days overdue.

### 9.3 Completion tracking
Each obligation has a completion workflow:
1. Mark as "In progress" (with start date)
2. Attach evidence (documents, screenshots, sign-off)
3. Mark as "Completed" (with completion date)
4. DPO review and approval

Dashboard widget: "Regulatory obligations: 12/15 completed this quarter (80%)". Overdue items are red-flagged.

### 9.4 Integration with SignApps Calendar
Regulatory obligations are visible in the Calendar module (port 3011) as special events with a "Compliance" badge (shield icon). They appear alongside regular events but are visually distinct (dashed border, `bg-blue-50`). No duplication: single source of truth in Compliance, read-only view in Calendar via PgEventBus event `compliance.obligation.created`.

---

## Category 10 -- Administration and Configuration

### 10.1 Compliance roles
Role-based access mapped to SignApps RBAC:
- **DPO**: full access to all compliance features, approve DPIAs, manage DSARs, view audit trail, configure policies
- **Compliance Officer**: manage register, DSARs, consents, breach reports. Cannot approve DPIAs or modify audit trail
- **Auditor**: read-only access to all modules + export capabilities. Cannot modify any data.
- **User**: submit DSARs, manage own consent preferences. No access to admin features.

### 10.2 Regulatory templates
Template library per regulation:
- **GDPR (EU)**: register fields, DPIA structure, DSAR deadlines (30 days), breach notification (72h), consent requirements
- **CCPA (California)**: "Do not sell" toggle, opt-out rights, disclosure requirements, 45-day response window
- **LGPD (Brazil)**: similar to GDPR with specific requirements for DPO appointment
- **PIPA (South Korea)**: specific consent requirements, cross-border transfer rules
- **PDPA (Singapore)**: specific breach notification thresholds

Selecting a regulation adjusts: form fields, deadlines, legal text references, export formats.

### 10.3 Workflow customization
Admin can modify workflows (steps, approvers, deadlines) for each process:
- DPIA: add/remove steps, change required fields, set approval chain
- DSAR: adjust deadlines per regulation, add verification steps
- Breach: customize severity matrix thresholds, notification triggers

Visual workflow editor: drag-and-drop steps, configure transitions, set conditions.

### 10.4 External DPO access
If the DPO is external to the organization:
- Dedicated access limited to the Compliance module (no access to other SignApps modules)
- Login via separate URL (`/compliance/external-login`)
- Email notifications with direct links to pending actions
- Activity logged in audit trail with "external-dpo" flag

### 10.5 Compliance API
REST API documented with OpenAPI (utoipa):
- Register CRUD
- Consent management
- DSAR submission and status
- DPIA read access
- Breach notification status
Auth: Bearer JWT. Role-based access control applied to all endpoints.

---

## Category 11 -- PostgreSQL Schema

### 11.1 dpias table
```sql
CREATE TABLE dpias (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    reference       TEXT NOT NULL UNIQUE,  -- 'DPIA-2026-0042'
    project_name    TEXT NOT NULL,
    data_controller TEXT NOT NULL,
    controller_email TEXT NOT NULL,
    dpo_user_id     UUID NOT NULL REFERENCES users(id),
    assessment_date DATE NOT NULL,
    description     TEXT NOT NULL,
    legal_basis     TEXT NOT NULL,
    subject_categories TEXT[] NOT NULL DEFAULT '{}',
    is_update       BOOLEAN NOT NULL DEFAULT false,
    parent_dpia_id  UUID REFERENCES dpias(id),
    version         INTEGER NOT NULL DEFAULT 1,
    status          TEXT NOT NULL DEFAULT 'draft',  -- 'draft', 'in_progress', 'reviewed', 'approved', 'archived'
    current_step    INTEGER NOT NULL DEFAULT 1,
    wizard_data     JSONB NOT NULL DEFAULT '{}',  -- stores all step data
    dpo_opinion     TEXT,
    dpo_recommendation TEXT,
    dpo_signed_at   TIMESTAMPTZ,
    controller_signed_at TIMESTAMPTZ,
    locked          BOOLEAN NOT NULL DEFAULT false,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dpias_org ON dpias (org_id, status);
CREATE INDEX idx_dpias_dpo ON dpias (dpo_user_id);
```

### 11.2 dpia_processing_activities table
```sql
CREATE TABLE dpia_processing_activities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dpia_id         UUID NOT NULL REFERENCES dpias(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    data_categories TEXT[] NOT NULL DEFAULT '{}',
    data_source     TEXT,
    recipients      TEXT[] NOT NULL DEFAULT '{}',
    transfer_outside_eu BOOLEAN NOT NULL DEFAULT false,
    transfer_countries TEXT[] DEFAULT '{}',
    transfer_safeguards TEXT,
    retention_value INTEGER,
    retention_unit  TEXT,  -- 'days', 'months', 'years'
    retention_justification TEXT,
    technical_measures TEXT[] NOT NULL DEFAULT '{}',
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dpia_activities ON dpia_processing_activities (dpia_id);
```

### 11.3 dpia_risks table
```sql
CREATE TABLE dpia_risks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dpia_id         UUID NOT NULL REFERENCES dpias(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    is_custom       BOOLEAN NOT NULL DEFAULT false,
    likelihood      SMALLINT NOT NULL CHECK (likelihood BETWEEN 1 AND 4),
    severity        SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 4),
    score           SMALLINT GENERATED ALWAYS AS (likelihood * severity) STORED,
    residual_likelihood SMALLINT CHECK (residual_likelihood BETWEEN 1 AND 4),
    residual_severity   SMALLINT CHECK (residual_severity BETWEEN 1 AND 4),
    residual_score  SMALLINT GENERATED ALWAYS AS (residual_likelihood * residual_severity) STORED,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dpia_risks ON dpia_risks (dpia_id);
```

### 11.4 dpia_mitigations table
```sql
CREATE TABLE dpia_mitigations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    risk_id         UUID NOT NULL REFERENCES dpia_risks(id) ON DELETE CASCADE,
    description     TEXT NOT NULL,
    measure_type    TEXT NOT NULL,  -- 'technical', 'organizational', 'contractual'
    responsible_id  UUID REFERENCES users(id),
    status          TEXT NOT NULL DEFAULT 'planned',  -- 'planned', 'in_progress', 'implemented', 'verified'
    target_date     DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dpia_mitigations ON dpia_mitigations (risk_id);
```

### 11.5 processing_register table
```sql
CREATE TABLE processing_register (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    name            TEXT NOT NULL,
    purpose         TEXT NOT NULL,
    legal_basis     TEXT NOT NULL,
    data_categories TEXT[] NOT NULL DEFAULT '{}',
    subject_categories TEXT[] NOT NULL DEFAULT '{}',
    recipients      TEXT[] NOT NULL DEFAULT '{}',
    transfer_outside_eu BOOLEAN NOT NULL DEFAULT false,
    transfer_details JSONB DEFAULT '{}',
    retention_period TEXT NOT NULL,
    retention_justification TEXT,
    security_measures TEXT[] NOT NULL DEFAULT '{}',
    joint_controller BOOLEAN NOT NULL DEFAULT false,
    joint_controller_details TEXT,
    automated_decisions BOOLEAN NOT NULL DEFAULT false,
    automated_decisions_details TEXT,
    sub_processors  JSONB NOT NULL DEFAULT '[]',
    status          TEXT NOT NULL DEFAULT 'active',  -- 'active', 'archived', 'under_review'
    last_reviewed_at TIMESTAMPTZ,
    next_review_at  TIMESTAMPTZ,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_processing_register_org ON processing_register (org_id, status);
```

### 11.6 consents table
```sql
CREATE TABLE consents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    user_id         UUID REFERENCES users(id),
    subject_email   TEXT NOT NULL,
    purpose         TEXT NOT NULL,  -- 'newsletter', 'cookies_analytics', 'marketing', etc.
    granted         BOOLEAN NOT NULL,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at      TIMESTAMPTZ,
    collection_method TEXT NOT NULL,  -- 'form', 'checkbox', 'double_opt_in', 'cookie_banner'
    proof           JSONB NOT NULL,  -- { text_presented, ip, user_agent, form_url }
    consent_version TEXT NOT NULL,  -- version of the consent text shown
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_consents_user ON consents (user_id, purpose);
CREATE INDEX idx_consents_subject ON consents (subject_email, purpose);
CREATE INDEX idx_consents_active ON consents (org_id, purpose) WHERE revoked_at IS NULL AND granted = true;
```

### 11.7 dsars table
```sql
CREATE TABLE dsars (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    reference       TEXT NOT NULL UNIQUE,  -- 'DSAR-2026-0042'
    requester_name  TEXT NOT NULL,
    requester_email TEXT NOT NULL,
    right_type      TEXT NOT NULL,  -- 'access', 'rectification', 'erasure', 'portability', 'restriction', 'objection'
    description     TEXT NOT NULL,
    response_format TEXT NOT NULL DEFAULT 'email',
    status          TEXT NOT NULL DEFAULT 'received',
    assignee_id     UUID REFERENCES users(id),
    identity_verified BOOLEAN NOT NULL DEFAULT false,
    identity_doc_path TEXT,  -- encrypted storage path
    data_found      JSONB DEFAULT '{}',  -- { module: item_count } summary
    response_text   TEXT,
    response_sent_at TIMESTAMPTZ,
    rejection_reason TEXT,
    deadline        TIMESTAMPTZ NOT NULL,  -- received_at + 30 days
    deadline_extended BOOLEAN NOT NULL DEFAULT false,
    extended_deadline TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dsars_org ON dsars (org_id, status);
CREATE INDEX idx_dsars_deadline ON dsars (deadline) WHERE status NOT IN ('closed', 'rejected');
```

### 11.8 breaches table
```sql
CREATE TABLE breaches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    reference       TEXT NOT NULL UNIQUE,  -- 'BRE-2026-0007'
    discovery_date  TIMESTAMPTZ NOT NULL,
    nature          TEXT[] NOT NULL,  -- ['confidentiality', 'integrity', 'availability']
    data_categories TEXT[] NOT NULL DEFAULT '{}',
    persons_affected INTEGER,
    persons_affected_unknown BOOLEAN NOT NULL DEFAULT false,
    description     TEXT NOT NULL,
    immediate_measures TEXT,
    severity_likelihood SMALLINT NOT NULL CHECK (severity_likelihood BETWEEN 1 AND 4),
    severity_impact SMALLINT NOT NULL CHECK (severity_impact BETWEEN 1 AND 4),
    severity_score  SMALLINT GENERATED ALWAYS AS (severity_likelihood * severity_impact) STORED,
    authority_notification_required BOOLEAN NOT NULL DEFAULT false,
    authority_notified_at TIMESTAMPTZ,
    authority_name  TEXT,
    authority_reference TEXT,
    persons_notification_required BOOLEAN NOT NULL DEFAULT false,
    persons_notified_at TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'open',  -- 'open', 'investigating', 'closed'
    root_cause      TEXT,
    corrective_measures JSONB DEFAULT '[]',
    preventive_measures JSONB DEFAULT '[]',
    lessons_learned TEXT,
    reporter_id     UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_breaches_org ON breaches (org_id, status);
CREATE INDEX idx_breaches_notification ON breaches (discovery_date)
    WHERE authority_notification_required = true AND authority_notified_at IS NULL;
```

### 11.9 compliance_audit_trail table
```sql
CREATE TABLE compliance_audit_trail (
    id              BIGSERIAL PRIMARY KEY,
    org_id          UUID NOT NULL REFERENCES organizations(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    action          TEXT NOT NULL,  -- 'create', 'update', 'delete', 'view', 'export', 'approve', 'sign'
    object_type     TEXT NOT NULL,  -- 'dpia', 'register', 'consent', 'dsar', 'breach', 'policy'
    object_id       UUID NOT NULL,
    before_value    JSONB,
    after_value     JSONB,
    ip_address      INET,
    user_agent      TEXT,
    hash            TEXT NOT NULL,  -- SHA-256 chain hash
    previous_hash   TEXT,           -- hash of previous entry
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No UPDATE or DELETE allowed on this table (enforce via database trigger or application logic)
CREATE INDEX idx_audit_trail_org ON compliance_audit_trail (org_id, created_at DESC);
CREATE INDEX idx_audit_trail_object ON compliance_audit_trail (object_type, object_id);
CREATE INDEX idx_audit_trail_user ON compliance_audit_trail (user_id, created_at DESC);
```

### 11.10 retention_policies table
```sql
CREATE TABLE retention_policies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    code            TEXT NOT NULL UNIQUE,  -- 'RET-HR-001'
    data_type       TEXT NOT NULL,
    module          TEXT NOT NULL,
    retention_period TEXT NOT NULL,  -- human-readable: '5 years after employment end'
    retention_days  INTEGER NOT NULL,  -- computed days for automation
    legal_basis     TEXT NOT NULL,
    action_at_expiry TEXT NOT NULL,  -- 'delete', 'anonymize', 'archive'
    responsible_id  UUID REFERENCES users(id),
    status          TEXT NOT NULL DEFAULT 'active',
    last_enforced_at TIMESTAMPTZ,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_retention_policies_org ON retention_policies (org_id, status);
```

### 11.11 regulatory_obligations table
```sql
CREATE TABLE regulatory_obligations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    title           TEXT NOT NULL,
    description     TEXT,
    due_date        DATE NOT NULL,
    recurrence      TEXT,  -- 'monthly', 'quarterly', 'semi_annual', 'annual', null for one-time
    responsible_id  UUID REFERENCES users(id),
    status          TEXT NOT NULL DEFAULT 'scheduled',  -- 'scheduled', 'in_progress', 'completed', 'overdue'
    completed_at    TIMESTAMPTZ,
    evidence_path   TEXT,
    approved_by     UUID REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_obligations_org ON regulatory_obligations (org_id, due_date);
CREATE INDEX idx_obligations_overdue ON regulatory_obligations (due_date) WHERE status NOT IN ('completed');
```

---

## Category 12 -- REST API Endpoints

### 12.1 DPIA endpoints
```
GET    /api/v1/compliance/dpias              -- list DPIAs (filters: status, dpo)
POST   /api/v1/compliance/dpias              -- create new DPIA (wizard step 1)
GET    /api/v1/compliance/dpias/:id          -- get DPIA details (all steps)
PUT    /api/v1/compliance/dpias/:id          -- update DPIA (save wizard progress)
DELETE /api/v1/compliance/dpias/:id          -- delete draft DPIA
PATCH  /api/v1/compliance/dpias/:id/sign     -- DPO or Controller sign
POST   /api/v1/compliance/dpias/:id/report   -- generate PDF report
GET    /api/v1/compliance/dpias/:id/versions -- list versions
GET    /api/v1/compliance/dpias/:id/versions/:v -- get specific version
Auth: Bearer JWT. Role: DPO/ComplianceOfficer for CUD, Auditor for read.
```

### 12.2 Processing register endpoints
```
GET    /api/v1/compliance/register           -- list entries (filters: status, legal_basis, data_category)
POST   /api/v1/compliance/register           -- create entry
GET    /api/v1/compliance/register/:id       -- get entry detail
PUT    /api/v1/compliance/register/:id       -- update entry
DELETE /api/v1/compliance/register/:id       -- archive entry (soft-delete)
POST   /api/v1/compliance/register/export    -- export register (format: pdf|xlsx|csv)
Auth: Bearer JWT. Role: DPO/ComplianceOfficer for CUD, Auditor for read.
```

### 12.3 Consent endpoints
```
GET    /api/v1/compliance/consents           -- list consents (filters: purpose, status, user)
POST   /api/v1/compliance/consents           -- record consent (from widget)
GET    /api/v1/compliance/consents/user/:id  -- get user's consents
PATCH  /api/v1/compliance/consents/:id/revoke -- revoke consent
GET    /api/v1/compliance/consents/preferences -- current user's preference center data
PUT    /api/v1/compliance/consents/preferences -- update current user's preferences
Auth: Bearer JWT for admin endpoints. Token-based auth for preference center links.
```

### 12.4 DSAR endpoints
```
POST   /api/v1/compliance/dsars              -- submit DSAR (public, with CAPTCHA)
GET    /api/v1/compliance/dsars              -- list DSARs (admin)
GET    /api/v1/compliance/dsars/:id          -- get DSAR detail
PATCH  /api/v1/compliance/dsars/:id/status   -- update status (workflow transition)
POST   /api/v1/compliance/dsars/:id/search   -- trigger cross-module data search
POST   /api/v1/compliance/dsars/:id/export   -- generate portability ZIP
POST   /api/v1/compliance/dsars/:id/respond  -- send response to requester
Auth: No auth for POST (public submission). Bearer JWT for all others. Role: DPO.
```

### 12.5 Breach endpoints
```
GET    /api/v1/compliance/breaches           -- list breaches
POST   /api/v1/compliance/breaches           -- declare breach
GET    /api/v1/compliance/breaches/:id       -- get breach detail
PUT    /api/v1/compliance/breaches/:id       -- update breach
PATCH  /api/v1/compliance/breaches/:id/notify-authority  -- mark authority notified
PATCH  /api/v1/compliance/breaches/:id/notify-persons    -- mark persons notified
PATCH  /api/v1/compliance/breaches/:id/close             -- close breach with post-mortem
Auth: Bearer JWT. Role: DPO/ComplianceOfficer.
```

### 12.6 Audit trail endpoints
```
GET    /api/v1/compliance/audit              -- search audit trail (filters: date, user, action, object_type)
POST   /api/v1/compliance/audit/verify       -- verify hash chain integrity
GET    /api/v1/compliance/audit/report       -- generate audit report PDF
Auth: Bearer JWT. Role: DPO/Auditor (read-only, no modification possible).
```

### 12.7 Retention policy endpoints
```
GET    /api/v1/compliance/retention          -- list policies
POST   /api/v1/compliance/retention          -- create policy
PUT    /api/v1/compliance/retention/:id      -- update policy
DELETE /api/v1/compliance/retention/:id      -- archive policy
GET    /api/v1/compliance/retention/dashboard -- retention dashboard data
POST   /api/v1/compliance/retention/enforce  -- trigger manual enforcement run
Auth: Bearer JWT. Role: DPO/admin.
```

### 12.8 Regulatory obligations endpoints
```
GET    /api/v1/compliance/obligations        -- list obligations
POST   /api/v1/compliance/obligations        -- create obligation
PUT    /api/v1/compliance/obligations/:id    -- update obligation
PATCH  /api/v1/compliance/obligations/:id/complete -- mark as completed
Auth: Bearer JWT. Role: DPO/ComplianceOfficer.
```

### 12.9 Compliance dashboard
```
GET    /api/v1/compliance/dashboard          -- DPO dashboard data (score, widgets, counts)
Auth: Bearer JWT. Role: DPO/ComplianceOfficer/Auditor.
```

---

## Category 13 -- PgEventBus Events

### 13.1 Events consumed by compliance
| Event | Source | Action |
|---|---|---|
| `user.deleted` | signapps-identity | Trigger consent cleanup, update DSAR data search |
| `user.data.exported` | signapps-identity | Record in audit trail for portability tracking |

### 13.2 Events emitted by compliance
| Event | Trigger | Payload |
|---|---|---|
| `compliance.consent.granted` | User grants consent | `{ user_id, purpose, granted_at }` |
| `compliance.consent.withdrawn` | User withdraws consent | `{ user_id, purpose, revoked_at }` |
| `compliance.dsar.received` | New DSAR submitted | `{ dsar_id, right_type, requester_email }` |
| `compliance.dsar.completed` | DSAR response sent | `{ dsar_id, response_date }` |
| `compliance.breach.declared` | Breach declared | `{ breach_id, severity_score, discovery_date }` |
| `compliance.breach.notification_overdue` | 72h timer expires | `{ breach_id, hours_overdue }` |
| `compliance.retention.deleted` | Retention policy deletes data | `{ policy_id, module, records_deleted }` |
| `compliance.dpia.approved` | DPIA fully approved | `{ dpia_id, project_name }` |
| `compliance.dpia.review_due` | DPIA annual review reminder | `{ dpia_id, due_date }` |
| `compliance.obligation.created` | New obligation scheduled | `{ obligation_id, title, due_date }` |
| `compliance.obligation.overdue` | Obligation past due date | `{ obligation_id, days_overdue }` |

---

## Category 14 -- Inter-Module Integration

### 14.1 Integration with signapps-identity (port 3001)
- RBAC roles (DPO, Compliance Officer, Auditor) are managed by identity
- User profiles provide DPO contact information
- User deletion events trigger consent cleanup and DSAR data updates

### 14.2 Integration with signapps-notifications (port 8095)
- DSAR deadline reminders
- Breach 72h countdown alerts
- DPIA review due notifications
- Regulatory obligation reminders
- Retention pre-deletion alerts
All dispatched via PgEventBus events consumed by notifications service.

### 14.3 Integration with signapps-calendar (port 3011)
- Regulatory obligations displayed as special events in Calendar
- DPIA review dates synced as calendar events
- DPO training deadlines visible in calendar

### 14.4 Integration with signapps-mail (port 3012)
- DSAR response emails sent via mail module
- Breach person notification emails sent via mail module
- Consent preference center links included in email footers

### 14.5 Integration with signapps-storage (port 3004)
- DPIA reports archived in Drive with compliance tag
- DSAR identity documents stored encrypted in Drive
- Portability export ZIPs stored temporarily in Drive (7-day expiry)

### 14.6 Integration with all modules (DSAR cross-search)
The DSAR data search queries all modules:
- Identity (user profiles), Mail (emails), Calendar (events), Contacts, Drive (files), Docs (documents), Chat (messages), Forms (submissions), Billing (invoices)
Each module must expose a `/api/v1/internal/privacy/search?subject_email=...` endpoint returning all data associated with the given person.

### 14.7 Integration with signapps-office (port 3018)
- DPIA report PDF generation
- Register export to XLSX
- Audit report PDF generation

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **CNIL (cnil.fr)** -- Guides RGPD, modele de registre, PIA Software, fiches pratiques, referentiels sectoriels, formulaire de notification de violation.
- **EDPB Guidelines (edpb.europa.eu)** -- Guidelines officielles sur le consentement, la DPIA, la portabilite, les droits des personnes, les transferts hors UE.
- **ICO (ico.org.uk)** -- Guides UK GDPR, DPIA templates, breach reporting tool, rights request handling guide.
- **OneTrust Trust Center** (onetrust.com/resources) -- Whitepapers sur la privacy management, DPIA automation, consent management.
- **IAPP (iapp.org)** -- International Association of Privacy Professionals. Articles, templates, certifications (CIPP/E, CIPM).
- **Vanta Documentation** (docs.vanta.com) -- Guides sur la compliance automation, evidence collection, continuous monitoring.
- **PIA Software CNIL** (github.com/LINCnil/pia) -- Outil DPIA officiel de la CNIL, methodologie en 9 etapes, reference structurelle.
- **Didomi Documentation** (developers.didomi.io) -- API de consent management, preference center, compliance analytics.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License -- ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **PIA (CNIL)** (github.com/LINCnil/pia) | **GPL-3.0** | **INTERDIT** (GPL). Ne pas utiliser ni copier. Etudier les docs publiques et la methodologie DPIA uniquement. |
| **Consent-O-Matic** (github.com/nicedayfor/consent-o-matic) | **MIT** | Browser extension pour le consentement. Pattern pour les interactions utilisateur de consentement. |
| **cookie-consent** (github.com/nicedayfor/cookie-consent) | **MIT** | Widget de consentement cookies. Pattern pour le centre de preferences. |
| **react-hook-form** (github.com/react-hook-form/react-hook-form) | **MIT** | Gestion des formulaires wizard multi-etapes. Deja utilise dans SignApps. |
| **zod** (github.com/colinhacks/zod) | **MIT** | Validation des schemas de formulaires (DPIA, DSAR). Deja utilise dans SignApps. |
| **jsPDF** (github.com/parallax/jsPDF) | **MIT** | Generation de rapports PDF (DPIA, registre, politique). |
| **@react-pdf/renderer** (github.com/diegomura/react-pdf) | **MIT** | Generation de PDF React-based. Alternative a jsPDF pour les rapports structures. |
| **react-step-wizard** (github.com/jcmcneal/react-step-wizard) | **MIT** | Composant wizard multi-etapes. Pattern pour le DPIA wizard et le DSAR workflow. |
| **date-fns** (date-fns.org) | **MIT** | Calculs de dates (delais DSAR 30j, retention, expiration). Deja utilise dans SignApps. |
| **uuid** (github.com/uuid-rs/uuid) | **MIT/Apache-2.0** | Generation d'identifiants uniques pour les fiches de traitement. Deja utilise dans SignApps. |

### Pattern d'implementation recommande
1. **DPIA Wizard** : composant React multi-etapes avec `react-hook-form` + `zod` pour la validation. State gere par Zustand. Persistance brouillon a chaque etape.
2. **Registre** : table PostgreSQL avec les champs Article 30 RGPD. Repository pattern via `signapps-db`. CRUD via handler Axum avec `utoipa::path`.
3. **Consentement** : table dediee avec `user_id`, `purpose`, `granted_at`, `revoked_at`, `proof` (JSON). Index sur `user_id + purpose`. API REST pour le centre de preferences.
4. **Retention** : cron job dans `signapps-metrics` ou worker dedie. Evalue les politiques de retention quotidiennement. Suppression via les repositories existants.
5. **DSAR** : workflow state machine (reception -> verification -> recherche -> traitement -> reponse -> cloture). Notifications via PgEventBus -> `signapps-notifications`.
6. **Audit trail** : table append-only avec hash SHA-256 chaine. Pas de `UPDATE` ni `DELETE` SQL sur cette table. Index GIN pour la recherche full-text.
7. **PDF** : `@react-pdf/renderer` (MIT) pour les rapports DPIA et le registre exportable.

---

## Assertions E2E cles (a tester)

- The DPIA wizard displays 6 steps with a horizontal progress bar
- Step 1 (Overview) accepts project name, data controller, DPO, date, and legal basis
- Step 2 (Processing) allows adding multiple processing activities with data categories
- Step 3 (Risk Assessment) displays the 4x4 risk matrix with color-coded cells
- Clicking a cell in the risk matrix sets likelihood and severity for the selected risk
- Step 4 (Mitigation) allows defining measures for each risk with status and target date
- Residual risk score updates after mitigation measures are defined
- Step 5 (DPO Review) requires DPO opinion and signature checkbox
- Step 6 (Report) generates a downloadable PDF with all DPIA information
- The DPIA reference number (DPIA-2026-NNNN) is unique and auto-generated
- "Save Draft" preserves wizard progress without requiring all fields to be valid
- The processing register lists all entries with sortable and filterable columns
- Adding a register entry creates an Article 30-compliant record
- Export of the register in PDF produces a CNIL-format document
- Export in Excel produces a structured spreadsheet with one row per activity
- The consent widget displays purposes with individual toggles (not pre-checked)
- "Accept all" and "Reject all" have equal visual weight
- Withdrawing a consent updates the register with a revocation timestamp
- The preference center shows all active consents with toggle controls
- The cookie consent banner appears on first visit and remembers the choice
- Retention policies trigger automatic deletion at expiration
- Pre-deletion alert notifies N days before data expiration
- The DSAR form allows submission without SignApps authentication
- The DSAR reference number (DSAR-2026-NNNN) is auto-generated
- The 30-day countdown is visible on each DSAR with color coding
- Cross-module data search compiles data from all modules for a given person
- The portability export generates a ZIP with JSON and original files
- DSAR response templates contain merge fields that auto-fill
- The breach declaration form starts the 72-hour countdown
- The 72h timer displays correctly with color transitions (green/orange/red)
- The severity assessment matrix determines notification requirements
- The authority notification form is pre-filled from the breach declaration
- The breach register is immutable (no edit/delete of past entries)
- The audit trail records every action with hash chain
- "Verify integrity" reports success on a valid chain and failure on a broken chain
- The compliance score gauge reflects the weighted score of all sub-components
- The DPO dashboard shows open DSARs, pending DPIAs, and upcoming obligations
- The regulatory calendar displays obligations with due dates and status
- Overdue obligations are flagged with a red badge
- Compliance roles (DPO/Officer/Auditor/User) restrict access correctly
- An Auditor can view and export but cannot modify any data
- The external DPO login provides access only to the Compliance module
