# Module Contacts — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Google Contacts** | Sync multi-device, import depuis Gmail auto, labels, merge duplicates, restore trash, contact groups, Google Account integration |
| **Apple Contacts** | iCloud sync, VCard support, Siri integration, nickname shortcut, contact poster |
| **HubSpot Contacts** (CRM) | Auto-enrichment (photo, company, titre), activity timeline, relations, custom properties, segments |
| **Outlook People** | Office 365 integration, shared directory, photos, social profiles |
| **Folk** | Relationship-first, auto-import from Gmail/LinkedIn, groups (kind of segments), messages tracked |
| **Clay** | Personal CRM, relationship strength, auto-update from LinkedIn, reminders to stay in touch |
| **Monica** | Personal CRM open source, life events, journal, family tree |
| **Dex** | Personal CRM pour networking, LinkedIn sync, reminders |
| **UpHabit** | Relationship manager avec rappels |
| **Contacts+** | Cross-platform, cloud sync, business card scanner |

## Principes directeurs

1. **Source unique** — un seul endroit pour les contacts de tous les outils SignApps (Mail, Calendar, CRM, Chat).
2. **Sync transparent** — depuis Gmail, Outlook, LinkedIn, avec déduplication intelligente.
3. **Enrichissement automatique** — photos, titres, entreprises récupérés sans action manuelle.
4. **Recherche instantanée** — trouver un contact par nom, email, entreprise, téléphone en <200ms.
5. **Relations visibles** — qui connaît qui, historique des interactions.
6. **Privacy-first** — contacts personnels privés par défaut, partage opt-in.

---

## Catégorie 1 — Gestion des contacts

### 1.1 Création manuelle
Bouton `Nouveau contact` → formulaire avec champs essentiels : nom complet, email, téléphone, entreprise, titre. Sauvegarde instantanée.

### 1.2 Création rapide inline
Dans Mail, Calendar, CRM : taper un nom/email inconnu → bouton `Ajouter aux contacts`. Création en arrière-plan.

### 1.3 Import CSV
Upload d'un fichier CSV → mapping des colonnes vers les champs. Détection de doublons par email. Preview avant import.

### 1.4 Import vCard
Upload d'un ou plusieurs fichiers `.vcf`. Parse complet des champs standard et custom.

### 1.5 Import depuis Google / Outlook / iCloud
OAuth avec le provider → import automatique de tous les contacts. Sync continue (modifications reflétées).

### 1.6 Import depuis LinkedIn
Connecteur pour importer ses connections LinkedIn. Photo, titre, entreprise, emails publics. Respect de l'API LinkedIn.

### 1.7 Import depuis Gmail (auto-detection)
Tous les expéditeurs/destinataires d'emails qu'on a échangés sont proposés à l'ajout (opt-in). Fréquence configurable.

### 1.8 Business card scanner (mobile)
Scan d'une carte de visite avec la caméra → OCR → création du contact avec champs pré-remplis. Vérification avant sauvegarde.

### 1.9 QR code scan
Scanner un QR code vCard (sur badge, carte) pour ajouter un contact.

### 1.10 Création depuis signature email
Dans Mail, détection automatique des signatures (nom, titre, société, téléphone). Bouton `Extraire vers contact`.

### 1.11 Duplication
Clic droit `Dupliquer` pour créer une variante (ex: même personne, compte pro + compte perso).

### 1.12 Suppression (corbeille)
Supprimer un contact → corbeille avec 30 jours de rétention. Restauration possible.

---

## Catégorie 2 — Fiche contact

### 2.1 Layout de la fiche
Page dédiée avec :
- Photo / avatar en haut
- Nom complet et titre (grand)
- Entreprise et rôle
- Onglets : Overview / Activity / Notes / Files
- Sidebar droite : deals, tâches, groupes

### 2.2 Champs de base
- **Nom** : prénom, nom de famille, suffixe, nickname
- **Emails** (multiples : perso, pro, autre) avec label
- **Téléphones** (multiples : mobile, bureau, maison, fax) avec label
- **Adresses** (multiples : domicile, bureau, expedition)
- **Réseaux sociaux** : LinkedIn, Twitter/X, Facebook, Instagram, GitHub, personal website
- **Date de naissance**
- **Date d'anniversaire de rencontre**

### 2.3 Champs professionnels
- **Entreprise**
- **Titre/poste**
- **Département**
- **Manager**
- **Direct reports**
- **Langue préférée**
- **Timezone**

### 2.4 Champs personnels
- **Conjoint(e)**
- **Enfants**
- **Hobbies**
- **Préférences alimentaires**
- **Cadeaux précédents** (pour ne pas répéter)

### 2.5 Notes libres
Zone de texte rich pour des notes contextuelles : contexte de rencontre, points d'intérêt, choses à se souvenir.

### 2.6 Champs custom
Admin peut ajouter des champs custom au schéma de contact (text, number, date, select, multi-select, checkbox, URL). Visibles sur la fiche.

### 2.7 Tags
Multi-tags par contact : `VIP`, `Prospect`, `Client`, `Freelance`, `Réseau`. Couleurs personnalisables.

### 2.8 Photo
Upload d'une photo, crop, alignement. Fetch automatique depuis Gravatar (basé sur email) ou LinkedIn. Avatar par défaut avec initiales + couleur.

### 2.9 Anniversaires et dates importantes
Champs de dates avec rappels automatiques (jour J, 1 semaine avant). Intégration calendar.

### 2.10 Emoji flag / pays
Pays associé au contact (via téléphone ou adresse). Emoji drapeau affiché à côté du nom.

---

## Catégorie 3 — Groupes et segments

### 3.1 Groupes statiques
Créer un groupe (`Famille`, `Équipe A`, `Fournisseurs`). Ajouter des contacts manuellement. Un contact peut être dans plusieurs groupes.

### 3.2 Segments dynamiques (smart lists)
Créer une règle (`Pays = France AND Tag = VIP`) → liste dynamique qui se met à jour quand les contacts changent.

### 3.3 Hiérarchie de groupes
Groupes imbriqués : `Clients > Entreprise A > Équipe projet`.

### 3.4 Actions de masse sur un groupe
Sur un groupe sélectionné : envoyer un email à tous, créer un événement avec tous, exporter en CSV, appliquer un tag, supprimer.

### 3.5 Partage de groupes
Partager un groupe avec un collègue (lecture ou édition collaborative).

### 3.6 Import d'un groupe depuis un filtre
Sauvegarder une recherche/filtre comme groupe dynamique.

---

## Catégorie 4 — Recherche et filtres

### 4.1 Recherche rapide
Barre de recherche globale. Autocomplétion instantanée sur nom, email, téléphone, entreprise.

### 4.2 Syntaxe avancée
```
company:acme          → dans une entreprise
title:director        → titre contient
email:@exemple.com    → email dans un domaine
phone:+33             → numéro commence par
tag:vip               → avec ce tag
group:familie         → dans ce groupe
country:FR            → par pays
lastcontact:>30d      → dernier contact > 30 jours
```

### 4.3 Filtres facettés
Sidebar avec filtres : tag, groupe, pays, entreprise, dernier contact. Combinables.

### 4.4 Recherche fuzzy
Tolérance aux fautes de frappe. "Jean Dupond" match "Jean Dupont".

### 4.5 Recherche dans tous les champs
Pas juste nom/email : cherche aussi dans les notes, adresses, titres, etc.

### 4.6 Recherches sauvegardées
Transformer une recherche en groupe dynamique.

### 4.7 Recherches récentes
Liste des 10 dernières recherches.

### 4.8 Tri
Par nom (A-Z / Z-A), date de création, date de dernier contact, entreprise.

---

## Catégorie 5 — Activité et historique

### 5.1 Timeline
Timeline de toutes les interactions avec un contact :
- Emails envoyés / reçus
- Appels (passés / reçus / manqués)
- Meetings
- Messages chat
- Tâches créées
- Notes ajoutées
- Fichiers partagés
- Deals (si CRM)

### 5.2 Dernier contact
Badge sur la fiche indiquant "Contacté il y a 3 jours" ou "Jamais contacté". Aide à la priorisation.

### 5.3 Fréquence de contact
Graphique de la fréquence d'interaction (nombre d'emails/calls par mois sur les 12 derniers mois).

### 5.4 Réception d'emails auto
Tous les emails de/vers le contact sont automatiquement associés à sa fiche (via intégration Mail).

### 5.5 Calls logs
Appels passés / reçus loggés (si intégration VoIP) avec durée et résultat.

### 5.6 Meetings
Événements calendar avec ce contact comme participant, listés chronologiquement.

### 5.7 Attachments
Fichiers du drive partagés avec ce contact.

### 5.8 Filtres de timeline
Filtrer par type (emails, calls, meetings, notes, fichiers, tâches).

---

## Catégorie 6 — Enrichissement et relations

### 6.1 Enrichissement automatique
Quand un nouveau contact est créé, l'IA (via APIs tierces optionnelles) va chercher :
- Photo de profil
- Titre et entreprise actuels
- LinkedIn profile URL
- Twitter handle
- Site web personnel
- Localisation

### 6.2 Sync avec LinkedIn
Mise à jour automatique des champs quand le contact change de poste sur LinkedIn (via leur API ou scraping éthique).

### 6.3 Détection de doublons
Suggestion de merge quand deux contacts semblent être la même personne (fuzzy match).

### 6.4 Merge contacts
Fusionner deux fiches en une. Conservation de toutes les infos : emails multiples, téléphones multiples, notes concatenées, activity log combiné.

### 6.5 Relations entre contacts
Lier des contacts : `Jean est le manager de Sarah`, `Paul est le collègue de Marc`. Relations typées et visualisables en graph.

### 6.6 Hiérarchie d'entreprise
Visualisation de l'organigramme basé sur les contacts d'une même entreprise avec leurs managers.

### 6.7 Contact strength score
Score de proximité basé sur la fréquence et le type d'interactions. Fort = contact régulier. Faible = à relancer.

### 6.8 Rappels de relance
Pour les contacts importants non contactés depuis X mois, notification "Il est temps de reprendre contact avec Jean".

### 6.9 Family tree
Pour les contacts personnels, visualisation de l'arbre familial (parents, enfants, conjoint).

### 6.10 Introduction request
Demander à un contact de vous introduire à un de ses contacts. Template email généré.

---

## Catégorie 7 — Intégrations

### 7.1 Mail
Contacts auto-utilisés dans l'autocomplétion de destinataires. Emails logués automatiquement.

### 7.2 Calendar
Contacts auto-suggérés comme invités. Événements apparaissent dans l'activité.

### 7.3 CRM
Les contacts sont le backbone du CRM. Même entité, vue différente (fiche CRM avec deals + notes + activités).

### 7.4 Chat
Auto-complétion pour DMs. Contacts de l'annuaire disponibles pour inviter.

### 7.5 Drive
Partage de fichiers avec un contact → apparaît dans son activité.

### 7.6 Meet
Inviter un contact à un meeting directement depuis sa fiche.

### 7.7 Tasks
Créer une tâche liée à un contact ("Appeler Jean").

### 7.8 Phone integration (VoIP)
Lancer un appel depuis la fiche contact (via intégration Twilio/Aircall/autre).

### 7.9 Mail merge
Campagne email à plusieurs contacts avec personnalisation (nom, entreprise, etc.).

### 7.10 Zapier / Make
Triggers : nouveau contact, contact mis à jour, contact supprimé. Actions : créer un contact, mettre à jour, fusionner.

### 7.11 API REST
Endpoints CRUD sur les contacts. Webhooks pour les events.

### 7.12 Export CSV / vCard
Export d'une sélection ou de tous les contacts au format CSV ou vCard.

---

## Catégorie 8 — Synchronisation multi-device

### 8.1 Sync cloud automatique
Contacts syncés entre desktop, web, mobile. Temps réel.

### 8.2 Sync avec Google Contacts
Bidirectionnelle : modifications sur SignApps reflétées dans Google, et vice versa.

### 8.3 Sync avec Outlook / Exchange
Bidirectionnelle via CardDAV ou Exchange API.

### 8.4 Sync avec iCloud
Via CardDAV pour les utilisateurs Apple.

### 8.5 CardDAV support
Serveur CardDAV pour sync avec les clients natifs (macOS Contacts, iOS Contacts, Thunderbird).

### 8.6 Conflit de sync
Résolution automatique LWW (last write wins) ou dialog de choix pour les champs conflictuels.

### 8.7 Offline mode
Consultation et édition hors-ligne. Sync au retour.

### 8.8 Apple Watch / Wear OS
Carnet d'adresses accessible depuis la montre.

### 8.9 Android Contacts Provider
Intégration avec le provider Android natif : les contacts SignApps apparaissent dans l'app téléphone par défaut.

### 8.10 iOS Contacts Provider
Même intégration sur iOS.

---

## Catégorie 9 — IA et intelligence

### 9.1 Suggestions de contacts à ajouter
L'IA suggère d'ajouter des contacts basés sur les emails échangés mais pas encore enregistrés.

### 9.2 Détection de changements de poste
Analyse des signatures d'email pour détecter quand un contact change de titre/entreprise.

### 9.3 Catégorisation automatique
L'IA propose des tags/groupes pour un nouveau contact basé sur son profil (VIP, prospect, fournisseur, etc.).

### 9.4 Nettoyage de doublons
Scan périodique pour détecter les doublons. Batch merge avec confirmation.

### 9.5 Complétion de champs
Si un contact a un email pro mais pas d'entreprise, l'IA suggère l'entreprise basée sur le domaine.

### 9.6 Relation strength prediction
Modèle ML prédit qui sont vos contacts les plus importants basé sur l'activité.

### 9.7 Anniversaire et rappels proactifs
Notifications proactives : "C'est l'anniversaire de Sarah dans 3 jours", "Tu n'as pas parlé à Jean depuis 60 jours".

### 9.8 Contact insights
Sur une fiche, insights IA : "Vous avez échangé 50 emails ce mois avec cette personne", "Cette personne est dans 3 de vos meetings cette semaine".

### 9.9 Email suggestion quand on rencontre quelqu'un
Après une réunion avec une nouvelle personne, suggestion d'envoyer un email de suivi avec template.

### 9.10 Q&A sur l'annuaire
"Qui travaille chez Acme ?", "Combien de contacts j'ai aux USA ?", "Montre-moi les VIP que je n'ai pas contactés depuis 3 mois".

---

## Catégorie 10 — Partage et permissions

### 10.1 Contacts personnels vs partagés
- **Personnels** : visibles seulement par le propriétaire
- **Partagés d'équipe** : visibles par tous les membres de l'équipe
- **Directory d'organisation** : visibles par tous les employés (infos pro uniquement)

### 10.2 Partage d'un contact
Partager une fiche contact avec un collègue (lecture ou édition).

### 10.3 Permissions granulaires
Par groupe ou par contact : qui peut voir, éditer, supprimer.

### 10.4 Privacy personnel
Les notes personnelles sur un contact (ex: "fragile émotionnellement") sont privées et ne sont pas partagées même si le contact est partagé.

### 10.5 Audit log
Log : qui a consulté/modifié/supprimé quels contacts. Pour conformité.

### 10.6 RGPD compliance
- **Export** : un utilisateur peut demander tous ses contacts stockés
- **Suppression** : demande de suppression honorée
- **Consentement** : pour l'enrichissement avec données tierces
- **Anonymisation** : option de garder les stats sans les PII

### 10.7 Data retention policy
Règles de rétention par admin : supprimer les contacts inactifs après X années.

### 10.8 Do Not Contact list
Blacklist de contacts à ne pas inclure dans les mailings, sequences, rappels.

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **Google Contacts Help** (support.google.com/contacts) — import, labels, merge, sync.
- **Apple Contacts User Guide** (support.apple.com/guide/contacts) — iCloud, groupes, vCard.
- **HubSpot Contacts** (knowledge.hubspot.com/contacts) — enrichment, segments, automation.
- **Folk Help** (folk.app/help) — relationship management patterns.
- **Clay App** (clay.earth/help) — personal CRM.
- **vCard RFC 6350** (tools.ietf.org/html/rfc6350) — spec officielle vCard 4.0.
- **CardDAV RFC 6352** (tools.ietf.org/html/rfc6352) — spec officielle CardDAV.

### Projets open source permissifs
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **Monica** (monicahq.com) | **AGPL v3** | **INTERDIT**. Personal CRM open source. |
| **Snipe-IT Contacts** | **AGPL v3** | **INTERDIT**. |
| **EspoCRM** | **GPL v3** | **INTERDIT**. |
| **Nextcloud Contacts** | **AGPL v3** | **INTERDIT**. |
| **Radicale** (radicale.org) | **GPL v3** | **INTERDIT pour copie**. CalDAV/CardDAV server. |
| **Baikal** (sabre.io/baikal) | **GPL v2** | **INTERDIT**. |
| **SabreDAV** (sabre.io) | **BSD-3-Clause** | Library PHP pour CalDAV/CardDAV. **OK**. |
| **vcard-parser** (github.com/nextapps-de/vcard-parser) | **MIT** | Parser vCard en JS. |
| **vcard-generator** | **MIT** | Générateur vCard. |
| **libphonenumber-js** (github.com/catamphetamine/libphonenumber-js) | **MIT** | Normalisation téléphones. |
| **email-validator** | **MIT** | Validation email. |
| **country-telephone-data** | **MIT** | Codes téléphone par pays. |
| **country-flag-emoji** | **MIT** | Emojis drapeaux. |
| **i18n-iso-countries** (michaelwittig.github.io/node-i18n-iso-countries) | **MIT** | Codes pays traduits. |
| **jsPDF** (github.com/parallax/jsPDF) | **MIT** | Génération PDF pour l'export fiches. |
| **Tantivy** (quickwit.io) | **MIT** | Full-text search. |
| **fuse.js** (fusejs.io) | **Apache-2.0** | Fuzzy search côté client. |
| **Gravatar API** | Service libre | Photos par email. |
| **faker.js** (faker.js.fr) | **MIT** | Génération de données de test (contacts fictifs). |

### Pattern d'implémentation recommandé
1. **Schéma des contacts** : signapps-db avec table `contacts` et colonnes JSONB pour les champs flexibles (emails multiples, téléphones, custom fields).
2. **Téléphone validation/formatting** : libphonenumber-js (MIT) pour E.164.
3. **Email validation** : RFC 5322 parser (plusieurs libs MIT).
4. **vCard import/export** : vcard-parser (MIT) pour l'import, generation custom pour l'export.
5. **CardDAV server** : SabreDAV (BSD-3) en PHP, ou réécriture Rust avec les specs RFC 6352.
6. **Sync Google/Outlook** : OAuth + API calls (Google People API, Microsoft Graph).
7. **Avatar** : Gravatar API (service libre), fallback initiales colorées.
8. **Search** : Tantivy (MIT) avec index sur nom, email, entreprise, notes.
9. **Dedup** : algorithme fuzzy matching (Levenshtein, Jaro-Winkler) sur nom + email.
10. **Enrichment** : connecteurs vers Clearbit, Apollo, Hunter.io (tous commerciaux), ou implementation custom avec LinkedIn API publique.
11. **Android/iOS sync** : Contacts Provider (Android) et Contacts Framework (iOS) pour l'intégration native.

### Ce qu'il ne faut PAS faire
- **Pas de fork** de Monica, Nextcloud Contacts, EspoCRM, Radicale, Baikal.
- **Pas de scraping LinkedIn** agressif — respecter l'API et les ToS.
- **Pas de partage automatique** de contacts personnels sans consentement.

---

## UI Behavior Details

### Contact List View
Default view is a three-column layout. Left sidebar (20%): navigation with sections — All Contacts, Frequently Contacted, Groups (expandable tree with group names), Labels/Tags (color-coded chips). Center area (55%): contact list displayed as rows. Each row shows avatar (circle, 36px), full name, primary email, company, last contacted date. Row hover shows quick-action icons: email, call, edit. Row click loads the contact detail in the right panel. Checkbox on each row for bulk actions. Toolbar above list: search bar (instant search, debounced 200ms), sort dropdown (Name A-Z, Name Z-A, Last Contacted, Recently Added, Company), filter button, "New Contact" button. When no contacts: empty state with illustration and "Import or add your first contact" with buttons for manual creation, CSV import, and Google sync.

### Contact Detail Panel
Right panel (25%) slides in when a contact is selected. Full-height, scrollable. Top section: large avatar (80px circle, click to change), full name (editable on double-click), title and company below, flag emoji + country. Below: collapsible sections. "Contact Info" section: emails (each with label badge "Work"/"Personal", click to compose), phones (each with label, click to call), addresses (formatted multi-line), website (link), social profiles (icon links to LinkedIn, Twitter, GitHub). "Tags" section: colored chips with "+" button. "Groups" section: chips showing group memberships. "Notes" section: rich text area, auto-save on blur. "Custom Fields" section: key-value pairs based on admin-defined schema.

### Contact Detail Full Page
Click "Open full page" icon on the detail panel header expands to a full-width page. Layout matches the CRM contact page: left column (info), center column (tabbed activity timeline), right column (groups, related contacts, upcoming events). Tabs in center: Overview (recent activity summary), Emails (all email threads), Meetings (calendar events), Tasks, Notes, Files.

### Group Management
Click a group in the sidebar to filter the contact list. Right-click a group: Rename, Delete, Share, Edit Rules (for smart groups). "New Group" button at bottom of groups section opens a dialog: group name, type (Static / Smart). For Smart groups: rule builder with rows of conditions (field + operator + value), combined with AND/OR logic. Preview shows matching contacts count. Groups can be nested: drag a group under another to create hierarchy.

### Merge Duplicates Flow
Menu action "Find Duplicates" runs a scan and presents results in a dedicated view. Each duplicate pair shows both contacts side by side with highlighted differences. For each field, radio buttons let the user choose which value to keep. "Merge" button combines the two contacts. "Not a Duplicate" button dismisses the pair. Batch merge: select multiple pairs and "Merge All Selected". After merge, all activity history from both contacts is combined chronologically.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open global search |
| `Ctrl+N` | New contact |
| `Ctrl+I` | Import contacts |
| `Ctrl+E` | Edit selected contact |
| `Ctrl+Enter` | Save current form |
| `Escape` | Close panel / cancel edit |
| `J` / `K` | Navigate down / up in contact list |
| `Enter` | Open selected contact detail |
| `Ctrl+Shift+G` | New group |
| `Ctrl+D` | Duplicate selected contact |
| `Ctrl+M` | Merge selected contacts (when 2 selected) |
| `Ctrl+Shift+E` | Export selected contacts |
| `/` | Focus search bar |
| `Ctrl+/` | Show keyboard shortcut help |

---

## Schema PostgreSQL

```sql
-- Core contacts table
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    owner_id UUID NOT NULL REFERENCES users(id),
    visibility VARCHAR(16) NOT NULL DEFAULT 'private', -- private, team, organization
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL DEFAULT '',
    nickname VARCHAR(128),
    prefix VARCHAR(16), -- Mr, Mrs, Dr, etc.
    suffix VARCHAR(16), -- Jr, Sr, III, etc.
    company VARCHAR(255),
    title VARCHAR(255),
    department VARCHAR(255),
    avatar_url TEXT,
    avatar_source VARCHAR(16), -- upload, gravatar, linkedin, generated
    date_of_birth DATE,
    anniversary DATE,
    language VARCHAR(5), -- preferred language ISO 639-1
    timezone VARCHAR(64), -- IANA timezone
    country VARCHAR(2), -- ISO 3166-1 alpha-2
    source VARCHAR(32), -- manual, csv_import, vcard_import, google, outlook, icloud, linkedin, email_signature, form
    merged_into UUID REFERENCES contacts(id), -- null unless merged (soft pointer)
    custom_fields JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    last_contacted_at TIMESTAMPTZ,
    contact_frequency_score INT DEFAULT 0, -- auto-calculated from interactions
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contacts_workspace ON contacts(workspace_id);
CREATE INDEX idx_contacts_owner ON contacts(owner_id);
CREATE INDEX idx_contacts_company ON contacts(company);
CREATE INDEX idx_contacts_tags ON contacts USING gin(tags);
CREATE INDEX idx_contacts_last_contacted ON contacts(workspace_id, last_contacted_at DESC NULLS LAST);
CREATE INDEX idx_contacts_search ON contacts USING gin(
    to_tsvector('simple', coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(company,'') || ' ' || coalesce(nickname,''))
);

-- Contact emails (multiple per contact)
CREATE TABLE contact_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    label VARCHAR(32) DEFAULT 'work', -- work, personal, other
    is_primary BOOLEAN NOT NULL DEFAULT false,
    verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_contact_emails_unique ON contact_emails(contact_id, email);
CREATE INDEX idx_contact_emails_lookup ON contact_emails(email);

-- Contact phones (multiple per contact)
CREATE TABLE contact_phones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    phone VARCHAR(50) NOT NULL,
    phone_e164 VARCHAR(20), -- normalized E.164 format
    label VARCHAR(32) DEFAULT 'mobile', -- mobile, work, home, fax, other
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contact_phones_contact ON contact_phones(contact_id);
CREATE INDEX idx_contact_phones_lookup ON contact_phones(phone_e164);

-- Contact addresses
CREATE TABLE contact_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    label VARCHAR(32) DEFAULT 'home', -- home, work, shipping, other
    street VARCHAR(512),
    city VARCHAR(255),
    state VARCHAR(128),
    postal_code VARCHAR(20),
    country VARCHAR(2), -- ISO 3166-1 alpha-2
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contact_addresses_contact ON contact_addresses(contact_id);

-- Contact social profiles
CREATE TABLE contact_socials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    platform VARCHAR(32) NOT NULL, -- linkedin, twitter, github, facebook, instagram, website
    url TEXT NOT NULL,
    username VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(contact_id, platform)
);

-- Contact groups
CREATE TABLE contact_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    owner_id UUID NOT NULL REFERENCES users(id),
    parent_id UUID REFERENCES contact_groups(id), -- for nested groups
    name VARCHAR(255) NOT NULL,
    group_type VARCHAR(16) NOT NULL DEFAULT 'static', -- static, smart
    smart_rules JSONB, -- for smart groups: {conditions: [{field, operator, value}], logic: "and"|"or"}
    color VARCHAR(7) DEFAULT '#6366f1',
    is_shared BOOLEAN NOT NULL DEFAULT false,
    member_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contact_groups_workspace ON contact_groups(workspace_id);
CREATE INDEX idx_contact_groups_parent ON contact_groups(parent_id);

-- Group membership (for static groups)
CREATE TABLE contact_group_members (
    group_id UUID NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, contact_id)
);

-- Contact relations
CREATE TABLE contact_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    related_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    relation_type VARCHAR(32) NOT NULL, -- manager, direct_report, colleague, spouse, parent, child, sibling, referrer, friend
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(contact_id, related_contact_id, relation_type)
);
CREATE INDEX idx_contact_relations ON contact_relations(contact_id);

-- Contact activity log (aggregated from all modules)
CREATE TABLE contact_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    activity_type VARCHAR(32) NOT NULL, -- email_sent, email_received, call_made, call_received, meeting, task, note, file_shared, chat_message
    source_module VARCHAR(32) NOT NULL, -- mail, calendar, tasks, chat, crm, drive
    source_id UUID, -- ID in the source module (email_id, event_id, etc.)
    actor_id UUID REFERENCES users(id),
    summary TEXT,
    metadata JSONB DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contact_activities ON contact_activities(contact_id, occurred_at DESC);
CREATE INDEX idx_contact_activities_type ON contact_activities(contact_id, activity_type);

-- Sync state for external providers
CREATE TABLE contact_sync_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    provider VARCHAR(32) NOT NULL, -- google, outlook, icloud, linkedin
    provider_account_id VARCHAR(255),
    access_token_encrypted BYTEA NOT NULL,
    refresh_token_encrypted BYTEA,
    token_expires_at TIMESTAMPTZ,
    sync_cursor TEXT, -- provider-specific sync token
    last_synced_at TIMESTAMPTZ,
    status VARCHAR(16) NOT NULL DEFAULT 'active', -- active, expired, error
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, provider, provider_account_id)
);

-- Custom field definitions for contacts
CREATE TABLE contact_custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    field_name VARCHAR(128) NOT NULL,
    field_label VARCHAR(255) NOT NULL,
    field_type VARCHAR(32) NOT NULL, -- text, number, date, select, multi_select, checkbox, url
    options JSONB, -- for select/multi_select
    is_required BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, field_name)
);

-- Duplicate detection pairs
CREATE TABLE contact_duplicate_pairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    contact_a_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    contact_b_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    match_score NUMERIC(5,2) NOT NULL, -- 0-100 confidence
    match_fields TEXT[] NOT NULL, -- which fields matched: email, name, phone
    status VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending, merged, dismissed
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_duplicate_pairs ON contact_duplicate_pairs(workspace_id, status);
```

---

## REST API Endpoints

All endpoints require JWT authentication. Base path: contacts handlers in `signapps-contacts` service or integrated in gateway.

### Contacts CRUD
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/contacts?q=&tag=&group=&company=&country=&sort=&page=&per_page=` | List contacts with filters |
| POST | `/api/v1/contacts` | Create contact |
| GET | `/api/v1/contacts/:id` | Get contact detail |
| PATCH | `/api/v1/contacts/:id` | Update contact fields |
| DELETE | `/api/v1/contacts/:id` | Soft-delete (move to trash, 30-day retention) |
| POST | `/api/v1/contacts/:id/restore` | Restore from trash |
| POST | `/api/v1/contacts/:id/duplicate` | Duplicate contact |
| GET | `/api/v1/contacts/trash` | List deleted contacts |

### Contact Sub-resources
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/contacts/:id/emails` | List contact emails |
| POST | `/api/v1/contacts/:id/emails` | Add email |
| DELETE | `/api/v1/contacts/:id/emails/:eid` | Remove email |
| GET | `/api/v1/contacts/:id/phones` | List phones |
| POST | `/api/v1/contacts/:id/phones` | Add phone |
| DELETE | `/api/v1/contacts/:id/phones/:pid` | Remove phone |
| GET | `/api/v1/contacts/:id/addresses` | List addresses |
| POST | `/api/v1/contacts/:id/addresses` | Add address |
| DELETE | `/api/v1/contacts/:id/addresses/:aid` | Remove address |
| GET | `/api/v1/contacts/:id/socials` | List social profiles |
| POST | `/api/v1/contacts/:id/socials` | Add social profile |
| DELETE | `/api/v1/contacts/:id/socials/:sid` | Remove social profile |

### Activity & Timeline
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/contacts/:id/activity?type=&from=&to=&page=` | Activity timeline |
| GET | `/api/v1/contacts/:id/stats` | Contact stats (email count, meeting count, last contacted) |

### Notes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/contacts/:id/notes` | List notes |
| POST | `/api/v1/contacts/:id/notes` | Add note |
| PATCH | `/api/v1/contacts/:id/notes/:nid` | Update note |
| DELETE | `/api/v1/contacts/:id/notes/:nid` | Delete note |

### Tags
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/contacts/tags` | List all tags in workspace |
| POST | `/api/v1/contacts/:id/tags` | Add tag(s) to contact |
| DELETE | `/api/v1/contacts/:id/tags/:tag` | Remove tag |
| POST | `/api/v1/contacts/bulk-tag` | Bulk tag multiple contacts |

### Groups
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/contacts/groups` | List groups |
| POST | `/api/v1/contacts/groups` | Create group |
| PATCH | `/api/v1/contacts/groups/:gid` | Update group (name, rules, color) |
| DELETE | `/api/v1/contacts/groups/:gid` | Delete group |
| GET | `/api/v1/contacts/groups/:gid/members` | List members |
| POST | `/api/v1/contacts/groups/:gid/members` | Add contacts to group |
| DELETE | `/api/v1/contacts/groups/:gid/members/:cid` | Remove contact from group |
| POST | `/api/v1/contacts/groups/:gid/share` | Share group with user |

### Relations
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/contacts/:id/relations` | List relations |
| POST | `/api/v1/contacts/:id/relations` | Add relation `{related_contact_id, relation_type}` |
| DELETE | `/api/v1/contacts/:id/relations/:rid` | Remove relation |
| GET | `/api/v1/contacts/:id/org-chart` | Company org chart from relations |

### Import / Export
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/contacts/import/csv` | Import from CSV (multipart) |
| POST | `/api/v1/contacts/import/vcard` | Import from vCard file |
| POST | `/api/v1/contacts/import/google` | Start Google Contacts OAuth sync |
| POST | `/api/v1/contacts/import/outlook` | Start Outlook sync |
| POST | `/api/v1/contacts/import/linkedin` | Start LinkedIn import |
| GET | `/api/v1/contacts/export?format=csv&group=&tag=` | Export contacts |
| GET | `/api/v1/contacts/export/vcard?ids=` | Export as vCard |

### Duplicates
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/contacts/duplicates?status=pending&page=` | List duplicate pairs |
| POST | `/api/v1/contacts/duplicates/:pair_id/merge` | Merge duplicate pair `{keep_values: {...}}` |
| POST | `/api/v1/contacts/duplicates/:pair_id/dismiss` | Dismiss duplicate pair |
| POST | `/api/v1/contacts/duplicates/scan` | Trigger full duplicate scan |

### Sync
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/contacts/sync/accounts` | List sync accounts |
| POST | `/api/v1/contacts/sync/accounts/:id/resync` | Force resync |
| DELETE | `/api/v1/contacts/sync/accounts/:id` | Disconnect sync provider |

### Custom Fields
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/contacts/custom-fields` | List custom field definitions |
| POST | `/api/v1/contacts/custom-fields` | Create custom field |
| PATCH | `/api/v1/contacts/custom-fields/:id` | Update custom field |
| DELETE | `/api/v1/contacts/custom-fields/:id` | Delete custom field |

### AI
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/contacts/ai/suggestions` | Contacts to add (from email patterns) |
| POST | `/api/v1/contacts/ai/enrich/:id` | Trigger AI enrichment for a contact |
| POST | `/api/v1/contacts/ai/categorize` | Auto-tag/group suggestions |
| POST | `/api/v1/contacts/ai/ask` | Natural language Q&A on contacts |
| GET | `/api/v1/contacts/ai/stale?days=` | Contacts not contacted in N days |
| GET | `/api/v1/contacts/ai/relationship-strength` | Top contacts by interaction score |

---

## PgEventBus Events

| Event | Payload | Consumers |
|-------|---------|-----------|
| `contacts.contact.created` | `{contact_id, workspace_id, owner_id, source, email}` | crm, search-index, ai-enrichment |
| `contacts.contact.updated` | `{contact_id, changed_fields[]}` | crm, search-index |
| `contacts.contact.deleted` | `{contact_id, workspace_id}` | crm, search-index |
| `contacts.contact.restored` | `{contact_id}` | crm, search-index |
| `contacts.contact.merged` | `{source_id, target_id, workspace_id}` | crm, search-index, all modules |
| `contacts.group.created` | `{group_id, workspace_id, name, type}` | dashboard |
| `contacts.group.member_added` | `{group_id, contact_id}` | notifications (if shared group) |
| `contacts.import.completed` | `{workspace_id, source, imported_count, duplicate_count, error_count}` | notifications |
| `contacts.sync.completed` | `{user_id, provider, synced_count, new_count, updated_count}` | notifications |
| `contacts.sync.failed` | `{user_id, provider, error}` | notifications |
| `contacts.duplicate.detected` | `{pair_id, contact_a_id, contact_b_id, match_score}` | notifications |
| `contacts.enrichment.completed` | `{contact_id, enriched_fields[]}` | notifications |
| `contacts.birthday.upcoming` | `{contact_id, date, days_until}` | notifications, calendar |
| `contacts.stale.detected` | `{contact_id, last_contacted_at, days_since}` | notifications |

---

## Inter-module Integration

### Contacts <-> Mail (signapps-mail, port 3012)
The Mail module uses contacts for autocomplete in the To/Cc/Bcc fields. When an email is sent to or received from a known contact, a `contact_activities` entry is created with `activity_type = 'email_sent'` or `'email_received'`. The Mail module emits `mail.message.sent` and `mail.message.received` events; the Contacts module consumes them and matches by email address. Unknown senders can be proposed for addition via the AI suggestions endpoint.

### Contacts <-> Calendar (signapps-calendar, port 3011)
Calendar events with participants matching contact emails automatically appear in the contact activity timeline. The Calendar autocomplete for invitees uses the Contacts search API. When a meeting occurs, the Contacts module logs it as a `meeting` activity.

### Contacts <-> CRM (signapps-crm)
The CRM extends the base contact with sales-specific fields (score, lifecycle stage, deals). Both modules share the core contact identity. When a CRM contact is created, a base contact is also created (or linked if it already exists by email). The CRM module reads from and writes to the contacts store through the contacts API.

### Contacts <-> Chat (signapps-chat, port 3020)
Chat DM recipient autocomplete uses the Contacts search. Chat messages with contacts can be logged as `chat_message` activities if the user enables the integration.

### Contacts <-> Drive (signapps-storage, port 3004)
Files shared with a contact appear in the contact activity timeline as `file_shared` entries. The Drive sharing autocomplete uses the Contacts API.

### Contacts <-> Tasks (signapps-gateway tasks)
Tasks linked to a contact (e.g., "Call Jean") appear in the contact activity timeline. Creating a task from the contact detail page sets the `related_entity_type = 'contact'` and `related_entity_id = contact_id`.

### Contacts <-> Meet (signapps-meet, port 3014)
Meeting invitations sent via Meet use the Contacts autocomplete. After a meeting, the participant list is cross-referenced with contacts to log activities.

### Contacts <-> AI (signapps-ai, port 3005)
Enrichment requests send the contact's name and email to the AI gateway, which queries external data sources and returns structured enrichment data (avatar, title, company, social links). The AI also powers duplicate detection (fuzzy matching), categorization suggestions, and natural language Q&A on the contacts database.

### Contacts <-> Notifications (signapps-notifications, port 8095)
Birthday reminders, stale contact alerts, duplicate detection results, and import completion notices are all delivered through the notification system. The Contacts module emits events; the notification service routes them to the appropriate channels (push, email, in-app).

---

## Assertions E2E cles (a tester)

- Create contact manually: fill name, email, phone -> appears in contact list
- Contact detail panel: shows all fields, avatar, tags, groups correctly
- Inline edit: double-click name -> type new name -> saves on blur
- Add second email with "Personal" label -> both emails shown on contact
- Add phone number -> formatted with country flag
- Add address -> renders as formatted multi-line text
- Add LinkedIn profile -> icon link opens LinkedIn in new tab
- Import CSV: upload file -> column mapping (Name -> first_name, Email -> email) -> preview -> import
- Import CSV with duplicates: 3 contacts, 1 existing by email -> "Update existing" merges, "Skip" ignores
- Import vCard: upload .vcf -> contact created with all vCard fields
- Import from Google: OAuth flow -> contacts imported -> sync status shows "Active"
- Import from Google: modify contact in Google -> wait for sync -> change reflected in SignApps
- Duplicate detection: two contacts "Jean Dupont" and "jean dupond" -> detected as potential duplicate
- Merge duplicates: side-by-side view -> pick values -> merge -> single contact with all data
- Merge preserves: both email addresses, all activity history, all notes combined
- Search: type "acm" in search -> contacts at Acme company appear instantly
- Search operators: type "company:acme tag:vip" -> filtered results
- Fuzzy search: type "Dupond" -> matches "Dupont" with tolerance
- Search in notes: type keyword from a note -> contact with that note appears
- Faceted filters: click tag "VIP" in sidebar -> list filtered
- Sort by last contacted -> most recently contacted at top
- Create static group "Team A" -> add 5 contacts -> group shows count 5
- Smart group: rule "Country = FR AND Tag = Client" -> matching contacts auto-listed
- Smart group updates: add "Client" tag to new FR contact -> appears in smart group
- Nested groups: drag "Project X" under "Clients" -> hierarchy visible
- Group bulk action: select group -> "Send email to all" -> Mail compose opens with all emails
- Contact activity timeline: send email to contact -> "Email sent" appears in timeline
- Activity filter: filter timeline to show only "Meetings" -> only meetings shown
- Enrichment: create contact with email only -> AI fetches avatar, title, company -> fields populated
- Tags: add "VIP" tag -> colored chip appears on contact card
- Bulk tag: select 10 contacts -> apply "Prospect" tag -> all 10 updated
- Relations: set "Jean is manager of Sarah" -> both contacts show relation
- Org chart: view company contacts -> hierarchy diagram rendered
- Contact strength score: contact with 50 emails this month -> high score
- Reminder: contact not contacted in 60 days -> notification "Time to reconnect with Jean"
- Birthday: set birthday 3 days from now -> reminder notification appears
- Export CSV: select 20 contacts -> export -> CSV file with correct columns
- Export vCard: select 5 contacts -> .vcf file generated with all fields
- Sharing: share a group with colleague -> colleague sees the group in their sidebar
- Privacy: private notes on a shared contact -> colleague cannot see them
- Audit log: admin views who accessed a contact record
- RGPD export: user requests data export -> all contact data in JSON
- Deletion: delete contact -> moves to trash -> restore within 30 days
- Custom fields: admin adds "Preferred Language" dropdown -> appears on all contact forms
- Offline: open contacts while offline -> browse and edit -> reconnect -> changes synced
- Mobile: create contact on mobile -> search works with autocomplete
- Business card scanner: take photo -> OCR extracts name, email, phone -> review -> create contact
- QR code scan: scan vCard QR -> contact created
- Do Not Contact: mark contact -> excluded from mailings and sequences
- AI Q&A: "Who works at Acme?" -> list of contacts at Acme returned
- AI suggestions: "jean@newcorp.com" sent 10 emails but not in contacts -> AI suggests adding
- CardDAV: sync with macOS Contacts app -> contacts appear in native app
