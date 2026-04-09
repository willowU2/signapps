# SignApps Platform — Specs produit (Index)

Ce dossier contient les **spécifications fonctionnelles détaillées** de tous les modules de SignApps Platform, inspirées par le meilleur des concurrents du marché et référençant des projets open source permissifs utilisables comme pattern d'implémentation.

## Objectif

Transformer SignApps en suite bureautique et professionnelle complète **au niveau des meilleures solutions du marché**, en s'inspirant sans copier de :
- **Google Workspace** (Docs, Sheets, Slides, Drive, Calendar, Mail, Meet)
- **Microsoft 365** (Word, Excel, PowerPoint, OneDrive, Outlook, Teams)
- **Notion, Airtable, Coda** (docs/bases hybrides)
- **HubSpot, Salesforce, Pipedrive** (CRM)
- **Asana, Monday, Linear, ClickUp** (tasks/projects)
- **Zoom, Loom, Around** (visioconférence)
- **Slack, Discord, Teams** (messagerie)
- **Zendesk, Intercom, Freshdesk** (helpdesk)
- **1Password, Bitwarden** (vault)
- **Stripe, Chargebee, Quickbooks** (billing)
- **Zapier, Make, n8n** (workflows)
- **DocuSign, PandaDoc** (signatures)
- **Okta, Auth0, Keycloak** (IAM)
- **BambooHR, Rippling, Personio** (HR)
- **Lansweeper, ServiceNow** (IT Assets)
- **Moodle, Canvas, Docebo** (LMS)
- **ChatGPT, Claude, Gemini** (AI)

## Principes directeurs transverses

### 1. Respect strict de la politique de licences
**Apache 2.0, MIT, BSD-2/3, ISC, 0BSD** et permissives équivalentes **uniquement**.
**Interdits** : GPL, AGPL, LGPL (sauf linkage dynamique documenté), BSL, SSPL, Elastic License, licences sources-available restrictives.

→ Chaque spec liste explicitement :
- Les projets open source permissifs à étudier comme pattern
- Les projets interdits (à ne JAMAIS forker, seulement consulter les démos publiques)
- La licence de chaque dépendance recommandée

### 2. S'inspirer, pas copier
- Lire les docs publiques, les démos, les vidéos tuto des concurrents
- Comprendre les patterns UX qui fonctionnent
- Réécrire de zéro dans notre stack (Rust + TypeScript/React + Tiptap + Yjs + PostgreSQL)
- Citer les inspirations dans les commentaires de code

### 3. Cohérence cross-module
- Un seul éditeur rich text (Tiptap) dans Docs, Mail, Wiki, Chat, Forms
- Un seul système de collab temps réel (Yjs CRDT)
- Un seul système de permissions (signapps-sharing crate)
- Un seul moteur de drag-drop (@dnd-kit/core)
- Un seul système de recherche full-text (Tantivy ou MeiliSearch)
- Un seul module AI utilisé partout (Claude/GPT/Gemini/local via abstraction)

### 4. Data liberation
Tous les modules exportent leurs données dans des formats standards (CSV, JSON, Markdown, XLSX, DOCX, PDF, ICS, vCard, PEPPOL). Aucun vendor lock-in.

### 5. Offline-first
Tous les modules doivent fonctionner hors-ligne pour les fonctions de lecture et édition basiques, avec sync CRDT au retour en ligne.

### 6. Accessibilité WCAG AA
Non négociable sur tous les modules.

### 7. Multi-language (i18n)
UI et contenus dans au moins : français, anglais, espagnol, allemand, italien, portugais, néerlandais.

---

## Liste des specs

### P0 — Modules critiques (expérience utilisateur principale)

| # | Module | Fichier | Statut |
|---|---|---|---|
| 01 | **Tableur (Spreadsheet)** — grille de calcul + database hybride | [01-spreadsheet.md](01-spreadsheet.md) | ✅ |
| 02 | **Docs (éditeur collaboratif)** — Tiptap + Notion-style blocks + AI | [02-docs.md](02-docs.md) | ✅ |
| 03 | **Calendar** — events + AI scheduling + booking + team presence | [03-calendar.md](03-calendar.md) | ✅ |
| 04 | **Mail** — IMAP/JMAP + smart inbox + AI + team inbox | [04-mail.md](04-mail.md) | ✅ |
| 05 | **Drive** — files + sync desktop + preview universel + recherche sémantique | [05-drive.md](05-drive.md) | ✅ |
| 06 | **CRM** — contacts/companies/deals + pipelines + AI + automations | [06-crm.md](06-crm.md) | ✅ |
| 07 | **Tasks / Projects** — kanban + gantt + sprints + dependencies + AI | [07-tasks-projects.md](07-tasks-projects.md) | ✅ |
| 08 | **Forms (builder)** — drag-drop + logic + analytics + payments | [08-forms.md](08-forms.md) | ✅ |
| 09 | **Slides (présentations)** — WYSIWYG + animations + AI generation | [09-slides.md](09-slides.md) | ✅ |

### P1 — Modules fonctionnels (enterprise productivity)

| # | Module | Fichier | Statut |
|---|---|---|---|
| 10 | **Vault (coffre secrets)** — passwords, TOTP, E2E, compliance | [10-vault.md](10-vault.md) | ✅ |
| 11 | **Chat (messagerie)** — channels, threads, huddles, AI | [11-chat.md](11-chat.md) | ✅ |
| 12 | **Meet (vidéoconférence)** — WebRTC + SFU + AI transcription + recording | [12-meet.md](12-meet.md) | ✅ |
| 13 | **Wiki / Knowledge Base** — pages hiérarchiques + AI Q&A + versioning | [13-wiki.md](13-wiki.md) | ✅ |
| 14 | **Contacts** — annuaire unifié multi-source + relations + AI | [14-contacts.md](14-contacts.md) | ✅ |
| 15 | **HR / Workforce** — employés + congés + paye + performance + ATS | [15-hr-workforce.md](15-hr-workforce.md) | ✅ |
| 16 | **Helpdesk / Support** — tickets omnichannel + KB + SLA + AI | [16-helpdesk.md](16-helpdesk.md) | ✅ |
| 17 | **Billing / Invoicing** — devis + factures + abonnements + taxes multi-pays | [17-billing.md](17-billing.md) | ✅ |
| 18 | **Workflows / Automation** — no-code/pro-code + triggers/actions + AI | [18-workflows.md](18-workflows.md) | ✅ |
| 19 | **AI (Chat + Tools)** — multi-model + tools + agents + RAG + local models | [19-ai.md](19-ai.md) | ✅ |
| 20 | **Signatures électroniques** — eIDAS + audit trail + templates | [20-signatures.md](20-signatures.md) | ✅ |
| 21 | **IT Assets** — inventaire + discovery + licenses + MDM + patch management | [21-it-assets.md](21-it-assets.md) | ✅ |
| 22 | **LMS (formation)** — cours + quiz + certifications + gamification | [22-lms.md](22-lms.md) | ✅ |
| 23 | **Admin + Settings** — users/roles/permissions + SSO + audit + compliance | [23-admin-settings.md](23-admin-settings.md) | ✅ |

### P2 — Modules secondaires

| # | Module | Fichier | Statut |
|---|---|---|---|
| 25 | **Design (Graphic Editor)** — Canva-like, Fabric.js canvas, templates, brand kit, AI | [25-design.md](25-design.md) | ✅ |
| 26 | **Voice & Audio** — transcription meetings, dictée, notes vocales, podcasts, commandes vocales, TTS | [26-voice-audio.md](26-voice-audio.md) | ✅ |
| 27 | **Notifications** — centre de notifications, push, email digest, préférences granulaires, batching | [27-notifications.md](27-notifications.md) | ✅ |
| 28 | **Dashboard** — vue d'accueil unifiée, AI daily summary, KPIs, widgets personnalisables | [28-dashboard.md](28-dashboard.md) | ✅ |
| 29 | **Search** — recherche globale standard + sémantique, filtres, facettes, recherches sauvegardées | [29-search.md](29-search.md) | ✅ |
| 30 | **Monitoring** — métriques système, alertes seuils, anomaly detection AI, dashboards temps réel | [30-monitoring.md](30-monitoring.md) | ✅ |
| 31 | **Compliance (RGPD)** — DPIA wizard, registre traitements, consentement, rétention, DSAR, audit | [31-compliance.md](31-compliance.md) | ✅ |
| 32 | **Collaboration Visuelle** — mind map, kanban, brainstorm, meeting board, canvas infini | [32-collaboration.md](32-collaboration.md) | ✅ |
| 33 | **Gamification** — XP, niveaux, badges, streaks, leaderboard, quêtes onboarding | [33-gamification.md](33-gamification.md) | ✅ |

### P2 — Modules restants (à spécifier ultérieurement)

Ces modules existent déjà dans SignApps mais ont des specs plus légères. À prioriser selon les besoins business :

- **Accounting** (comptabilité complète, au-delà du Billing)
- **Backups** (stratégie de sauvegarde inter-modules)
- **Bookmarks** (favoris partagés)
- **Collaboration** (espaces de travail partagés inter-modules — voir aussi [32-collaboration.md](32-collaboration.md))
- **Containers** (Docker management intégré)
- **Data Management** (ETL, data pipelines, quality)
- **Gamification** (leaderboards, achievements organisationnels — voir [33-gamification.md](33-gamification.md))
- **Integrations** (marketplace d'intégrations tierces)
- **Keep** (notes rapides, Google Keep-style)
- **Media** (bibliothèque multimédia unifiée)
- **Monitoring** (APM, logs, metrics — voir [30-monitoring.md](30-monitoring.md))
- **Print** (impression unifiée, print management)
- **Proxy** (reverse proxy, ACME, WAF léger)
- **Remote** (accès remote desktop, VPN)
- **Reports** (BI/Reporting transverse)
- **Scheduler** (cron jobs, scheduled tasks)
- **Scheduling** (booking complexe multi-resources)
- **SecureLink** (tunnels sécurisés pour exposition de services internes)
- **Social** (publication sociale unifiée, alternative Buffer/Hootsuite)
- **Status** (status page publique)
- **Supply Chain** (SCM léger, inventory + logistics)
- **Team** (collaboration outils transverses)
- **Timesheet** (dédié si au-delà du Tasks module)
- **Tools** (boîte à outils divers)
- **Trash** (corbeille globale cross-module)
- **VPN** (VPN d'entreprise intégré)
- **Whiteboard** (tableau blanc collaboratif — Miro/Excalidraw-like)
- **Resources** (gestion de ressources partagées)
- **Global Drive** (drive fédéré)
- **App Store** (catalogue d'apps internes)
- **Expenses** (notes de frais — déjà partiellement dans HR)

---

## Dépendances inter-modules

```
        ┌────────────┐
        │  Admin/IAM │ ← SSO, permissions, users
        └─────┬──────┘
              │
     ┌────────┴────────┐
     │                 │
┌────▼────┐      ┌─────▼──────┐
│ Contacts│      │    Drive   │ ← stockage centralisé
└────┬────┘      └─────┬──────┘
     │                 │
     └─────┬───────────┴────────────┐
           │                        │
    ┌──────▼──────┐          ┌──────▼──────┐
    │     Mail    │          │     Docs    │
    └─────────────┘          └─────┬───────┘
                                   │
                     ┌─────────────┼─────────────┐
                     │             │             │
              ┌──────▼─────┐ ┌─────▼────┐ ┌──────▼──────┐
              │   Sheets   │ │  Slides  │ │    Forms    │
              └────────────┘ └──────────┘ └─────────────┘

┌────────────┐    ┌──────────┐    ┌──────────────┐
│  Calendar  │────│   Tasks  │────│  Workflows   │
└────────────┘    └──────────┘    └──────────────┘

┌────────────┐    ┌──────────┐    ┌──────────────┐
│   CRM      │────│    Mail  │────│   Helpdesk   │
└────────────┘    └──────────┘    └──────────────┘

┌────────────┐    ┌──────────┐    ┌──────────────┐
│    HR      │────│   Vault  │────│ Signatures   │
└────────────┘    └──────────┘    └──────────────┘

┌────────────┐    ┌──────────┐
│   Chat     │────│   Meet   │
└────────────┘    └──────────┘

       ┌──────┐
       │  AI  │ ← Tool available dans TOUS les modules
       └──────┘
```

**Principes de l'architecture inter-modules** :
- Le module **Admin/IAM** est le socle : gère users, groupes, permissions pour tous.
- Le module **Drive** est le stockage unique : Docs, Sheets, Slides, Mail attachments, etc. utilisent Drive.
- Le module **Contacts** est l'annuaire unique : utilisé par Mail, Calendar, CRM, Chat, Helpdesk.
- Le module **AI** est un service transverse appelé par tous les modules.
- Le module **Workflows** orchestre les actions entre tous les modules.
- Les modules peuvent communiquer via :
  - **PgEventBus** (events async)
  - **Direct DB access** (via signapps-db crates partagés)
  - **API REST interne** (gateway intercepte)
- **Pas de HTTP direct** entre services (sauf via gateway).

---

## Ordre suggéré d'implémentation (roadmap)

### Phase 1 — Base (déjà en place, à consolider)
1. **Admin/IAM** (23) — socle obligatoire
2. **Drive** (05) — stockage commun
3. **Contacts** (14) — annuaire commun
4. **AI** (19) — service transverse

### Phase 2 — Productivité personnelle (P0)
5. **Docs** (02) — déjà bien avancé dans SignApps
6. **Spreadsheet** (01) — déjà bien avancé, à enrichir avec les specs
7. **Mail** (04) — déjà en place
8. **Calendar** (03) — déjà en place
9. **Tasks/Projects** (07)
10. **Slides** (09)

### Phase 3 — Collaboration (P0/P1)
11. **Chat** (11)
12. **Meet** (12)
13. **Wiki** (13)
14. **Forms** (08)

### Phase 4 — Business (P1)
15. **CRM** (06)
16. **Helpdesk** (16)
17. **Billing** (17)
18. **Signatures** (20)

### Phase 5 — Enterprise (P1)
19. **Vault** (10)
20. **HR/Workforce** (15)
21. **IT Assets** (21)
22. **Workflows** (18)
23. **LMS** (22)

### Phase 6 — Secondaires (P2)
24+. Autres modules selon priorité business.

---

## Technologies et patterns recommandés

### Stack (déjà en place dans SignApps)
- **Backend** : Rust + Axum + Tokio + SQLx + PostgreSQL + pgvector
- **Frontend** : Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Real-time collab** : Yjs (MIT) + WebSocket
- **Rich text editor** : Tiptap (MIT) — unifié cross-module
- **Drag-drop** : @dnd-kit/core (MIT)
- **Forms** : React Hook Form (MIT) + Zod (MIT)
- **Date handling** : date-fns (MIT)
- **AI** : abstraction multi-provider (Claude, GPT, Gemini, local)
- **Storage** : OpenDAL (Apache-2.0)
- **Search** : Tantivy (MIT) ou MeiliSearch (MIT)
- **Auth** : Keycloak (Apache-2.0) ou ZITADEL (Apache-2.0)

### Licences strictement respectées
Voir `/memory/feedback_license_policy.md` et `deny.toml` pour les règles exactes.

### Confidentialité et sécurité
Voir `/docs/architecture/` et `CLAUDE.md` pour les patterns de sécurité.

---

## Usage des specs

### Pour un nouvel implémenteur
1. Lire le spec du module concerné
2. Identifier les features prioritaires (marquées ou sélectionnées avec le product manager)
3. Étudier les projets open source permissifs listés pour comprendre les patterns
4. Écrire les tests E2E d'abord selon les "Assertions E2E clés" listées dans le spec
5. Implémenter en Rust/React en respectant les principes directeurs

### Pour un product manager
1. Les specs sont exhaustives pour couvrir le maximum de cas d'usage
2. Choisir les features prioritaires selon la roadmap business
3. Adapter les features au contexte spécifique de votre organisation
4. Les specs peuvent être forkées par module pour les rendre spécifiques

### Pour un designer
1. Les specs détaillent le comportement fonctionnel, pas le visuel
2. S'inspirer des concurrents listés en "Benchmark" pour les patterns UX éprouvés
3. Respecter les principes directeurs pour la cohérence cross-module
4. Prototyper avec Figma puis valider avec les utilisateurs

### Pour un security officer
1. Chaque spec a une section "Sécurité et conformité" à réviser
2. Valider les dépendances listées contre les politiques de licences
3. Prioriser les features de gouvernance (audit, DLP, retention, legal hold)

---

## Évolution des specs

Les specs sont **vivantes** et doivent évoluer avec :
- Les retours utilisateurs
- Les évolutions des concurrents
- Les nouvelles lois (compliance, RGPD, AI Act)
- Les nouveautés technologiques (nouveaux LLMs, nouveaux protocoles)

**Processus de mise à jour** :
1. Ouvrir une issue ou discussion sur le doc concerné
2. Proposer les changements via PR sur le fichier Markdown
3. Review par le product manager et tech lead
4. Merge et notification équipe

---

## Références externes permanentes

- **Licences permissives OSI** : [opensource.org/licenses](https://opensource.org/licenses)
- **ChooseALicense** : [choosealicense.com](https://choosealicense.com)
- **SPDX License List** : [spdx.org/licenses](https://spdx.org/licenses)
- **WCAG 2.1** : [w3.org/WAI/WCAG21](https://www.w3.org/WAI/WCAG21/quickref)
- **RGPD Article-by-Article** : [gdpr-info.eu](https://gdpr-info.eu)
- **eIDAS Regulation** : [eur-lex.europa.eu](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=uriserv:OJ.L_.2014.257.01.0073.01.ENG)
- **OWASP Top 10** : [owasp.org/www-project-top-ten](https://owasp.org/www-project-top-ten)
- **Awesome Open Source Alternatives** : [github.com/AwsmAlts](https://github.com/AwsmAlts/awesome-alternatives)

---

## Historique

| Date | Action |
|---|---|
| 2026-04-09 | Création initiale des 23 specs principales (P0 + P1) + index |
