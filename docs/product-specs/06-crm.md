# Module CRM — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **HubSpot CRM** | Tout-en-un (CRM + Marketing + Sales + Service + CMS), free tier généreux, contacts unifiés, pipeline drag-drop, sequences automatiques, email tracking, meeting booking, reporting, AI Breeze, mobile app excellente |
| **Salesforce** | Leader enterprise, Lightning platform, customization infinie (objects, fields, workflows, triggers via Apex), Einstein AI, Chatter, reports & dashboards puissants, AppExchange, multi-org support |
| **Pipedrive** | Visual pipeline first, activity tracking, workflow automation, email integration, smart docs, mobile, AI sales assistant, marketplace |
| **Copper** | Natif Google Workspace, sync automatique Gmail/Calendar, relationship intelligence, pipeline simple |
| **Attio** | Moderne, data-first, objects customisables comme Airtable, realtime collab, synced contacts, pattern matching |
| **Folk** | Relationship CRM, contacts depuis Gmail/LinkedIn/Twitter, pipelines simples, messages trackés, smart fields |
| **Zoho CRM** | Abordable, features nombreuses, AI Zia, automations, blueprint workflows, suite Zoho |
| **Monday CRM** | Builder de workflow visuel, customization via boards, dashboards, automations, integration avec reste Monday |
| **Close** | Pour inside sales, built-in calling/SMS/email, power dialer, predictive dialer, call recording, scripts |
| **Freshsales** | Auto-capture contacts/deals from emails, visual pipeline, lead scoring, workflows, AI Freddy |
| **Capsule** | Simple, affordable, activity history, pipeline, cases (tickets), calendar, projects |
| **Affinity** | Network intelligence (VC/finance), auto-capture from email/calendar, relationship strength scoring |
| **Insightly** | Projects + CRM, pipeline + gantt, integrations |

## Principes directeurs

1. **Le contact est au centre** — toutes les interactions (emails, meetings, calls, notes, deals, tasks) doivent être attachables et visibles depuis la fiche du contact.
2. **Auto-capture** — pas de saisie manuelle répétitive. Un email reçu crée/enrichit un contact, un meeting calendar l'ajoute à l'historique, une tâche liée au deal apparaît dans son activité.
3. **Pipeline visuel et actionnable** — le kanban est le cœur de l'expérience vente : voir où sont les deals, les faire avancer d'un glissement.
4. **Customisation sans code** — ajouter des champs, des étapes, des automations sans développeur.
5. **Insights automatiques** — l'AI identifie les deals à risque, les contacts froids, les opportunités de relance.
6. **Multi-pipeline** — différents produits/business units ont différents pipelines, avec leurs étapes et KPIs.

---

## Catégorie 1 — Contacts (personnes)

### 1.1 Fiche contact
Page complète avec : photo/avatar, nom complet, titre, entreprise, emails multiples, téléphones multiples, adresses, réseaux sociaux (LinkedIn, Twitter, GitHub), tags, score, owner, champs custom. Layout en colonnes : info à gauche, activité au centre, side-panel à droite (deals, tâches, notes).

### 1.2 Création manuelle
Bouton `Nouveau contact` ouvre dialog avec champs essentiels (nom, email, entreprise). Suggestions d'auto-complétion depuis les emails reçus, Mail, contacts existants.

### 1.3 Import depuis CSV
Upload CSV → mapping des colonnes vers les champs du CRM, preview de 5 lignes, détection des doublons (par email), options `Créer nouveau` / `Mettre à jour existant` / `Skip`. Rollback possible en cas d'erreur.

### 1.4 Import depuis Google Contacts / Outlook / LinkedIn
Connecteur OAuth qui importe et synchronise les contacts du provider. Conflict resolution automatique (keep newest, keep local, merge).

### 1.5 Enrichissement automatique
Pour chaque nouveau contact, l'AI va chercher (via API tierces optionnelles) : photo de profil, entreprise actuelle, titre, réseaux sociaux, localisation. Populate les champs vides.

### 1.6 Dédoublonnage (merge)
Détection automatique des doublons (même email, ou fuzzy match sur nom + entreprise). Bouton `Merger` combine les deux fiches sans perte : emails de l'un, téléphones de l'autre, activité concaténée, etc.

### 1.7 Tags et segments
Appliquer plusieurs tags à un contact (`VIP`, `Prospect chaud`, `Lost 2024`). Créer des segments dynamiques basés sur des filtres (`Tous les contacts avec tag "VIP" et localisation Paris`).

### 1.8 Score de contact
Lead scoring automatique ou manuel. L'AI pondère selon les signaux (site visité, email ouvert, meeting pris, deal créé). Score de 0-100 avec tendance (↗/→/↘).

### 1.9 Historique d'activité
Timeline chronologique de toutes les interactions avec ce contact : emails envoyés/reçus, meetings, calls, notes, deals créés/modifiés, tâches, pièces jointes, changements de champ. Filtrable par type.

### 1.10 Relations et hiérarchie
Un contact peut être lié à d'autres contacts : manager, direct reports, client d'un autre, référent. Visualisation en graph.

### 1.11 Champs custom
Ajouter des champs par l'admin : texte, nombre, date, dropdown, multi-select, checkbox, url, formula. Visible sur la fiche et filtrable.

### 1.12 Notes enrichies
Ajouter des notes libres (texte rich) sur un contact. Timestamped, auteur visible. @mention pour notifier un collègue. Attachements possibles.

### 1.13 Derniers contacts
Widget "contactés récemment" sur le dashboard, pour relancer ceux qui deviennent froids.

### 1.14 Contacts inactifs (froid)
Filtre automatique sur les contacts sans interaction depuis X jours. Suggestion de relance.

### 1.15 Opt-out et RGPD
Cases à cocher : "Consent marketing", "Consent sales outreach", "Do not contact". Respect automatique par les workflows.

---

## Catégorie 2 — Entreprises (companies)

### 2.1 Fiche entreprise
Page complète : logo, nom, industrie, taille, chiffre d'affaires, site web, adresse, description, tags, owner. Contacts liés, deals liés, notes, activité.

### 2.2 Contacts liés à une entreprise
Liste des personnes travaillant (ou ayant travaillé) dans cette entreprise. Ajouter/retirer un contact.

### 2.3 Auto-association email domain
Quand un contact a un email `jean@acme.com`, il est automatiquement lié à l'entreprise `Acme` (créée si elle n'existe pas).

### 2.4 Hiérarchie d'entreprises
Parent / filiale / subsidiaries. Visualisation en arbre pour les groupes.

### 2.5 Enrichissement automatique
L'AI enrichit avec les données publiques (LinkedIn Company, Crunchbase, OpenCorporates) : industrie, taille, CA, localisation, fondateurs.

### 2.6 Champs custom
Comme pour les contacts.

### 2.7 Activité aggregée
Timeline de toutes les interactions avec tous les contacts de l'entreprise. Vue globale du compte.

### 2.8 Account score
Score de l'entreprise basé sur le nombre de contacts engagés, les deals ouverts, la valeur totale du pipeline.

---

## Catégorie 3 — Deals et pipeline

### 3.1 Pipeline Kanban visuel
Vue principale : colonnes = étapes du pipeline (`Nouveau`, `Qualifié`, `Proposal`, `Négociation`, `Gagné`, `Perdu`). Cartes = deals avec titre, montant, contact, date close attendue. Drag entre colonnes pour faire avancer.

### 3.2 Création de deal
Bouton `Nouveau deal` → dialog avec titre, montant, devise, probabilité, étape, contact(s), entreprise, date de clôture attendue, owner. Peut être créé depuis un contact ou une entreprise (pré-rempli).

### 3.3 Multiple pipelines
Définir plusieurs pipelines (ex: `Vente SaaS`, `Consulting`, `Formation`) chacun avec leurs étapes et leurs règles. Switcher de pipeline dans la vue.

### 3.4 Champs custom et étapes custom
Par pipeline, définir les étapes (nom, ordre, probabilité par défaut, couleur). Ajouter des champs custom (durée engagement, segment produit, source lead).

### 3.5 Drag-drop entre étapes
Glisser un deal d'une colonne à l'autre change son étape. Confirmation si l'étape cible est `Gagné` ou `Perdu` (avec raison de perte).

### 3.6 Vue liste (grid view)
Alternative au kanban : liste des deals avec colonnes triables et filtrables. Inline edit des champs.

### 3.7 Vue timeline (gantt)
Deals placés sur une timeline par date de clôture attendue. Visualiser la distribution temporelle du pipeline.

### 3.8 Calcul automatique du montant pondéré
Pour chaque deal : `montant × probabilité = montant pondéré`. Agrégation par étape, par owner, par mois.

### 3.9 Forecast
Prévisions sur N prochains mois basées sur les deals en cours, les taux de conversion historiques, les cycles de vente moyens. Confiance visible (optimiste, réaliste, pessimiste).

### 3.10 Close date
Date prévue de clôture. Alertes si dépassée (deal en retard). Graphique d'évolution dans le temps.

### 3.11 Historique d'un deal
Timeline du deal : créé par X le Y, passé à `Qualifié` le Z, montant changé, contact ajouté, etc.

### 3.12 Tâches et activités liées au deal
Liste des tâches, rendez-vous, emails et notes liés au deal. Ajouter une tâche en un clic.

### 3.13 Produits / line items
Ajouter des produits ou services à un deal avec quantité, prix unitaire, remise, total. Calcul automatique du total du deal. Catalogue de produits.

### 3.14 Deal lost reasons
Quand un deal est marqué perdu, dropdown obligatoire : prix, fonctionnalités manquantes, concurrent, timing, pas de décision, etc. Analytics sur les raisons.

### 3.15 Reopen deal
Un deal perdu peut être ré-ouvert (ex: le prospect revient). Historique préservé.

---

## Catégorie 4 — Activités et communications

### 4.1 Log d'email (inbound + outbound)
Chaque email envoyé/reçu avec un contact est automatiquement loggé sur sa fiche (intégration avec le module Mail). Vue du thread complet.

### 4.2 Email tracking (opens et clicks)
Pixel invisible dans les emails envoyés. Notification quand le destinataire ouvre l'email (avec heure et nombre de fois). Tracking des clics sur les liens.

### 4.3 Templates d'emails
Bibliothèque de templates pour différents scénarios : premier contact, follow-up, demo, proposal, win-back. Variables `{{first_name}}`, `{{company}}`, `{{deal_title}}` etc.

### 4.4 Sequences (cadences automatiques)
Séquence d'emails + tâches + calls espacés dans le temps : `Day 1: email froid`, `Day 3: LinkedIn request`, `Day 7: follow-up email`, `Day 14: call`. Automatiquement enqueued quand un contact est ajouté à la séquence.

### 4.5 Sequence stop rules
Arrêt automatique de la séquence si : reply reçu, meeting booké, deal créé. Plus de spam pour les leads engagés.

### 4.6 Calls (téléphonie)
Bouton `Call` sur une fiche contact → passe l'appel via intégration VoIP (Aircall, Twilio, etc.). Call loggé avec durée, enregistrement (si activé), notes.

### 4.7 Meeting booking
Lien de booking (Calendly-style) intégré. Le contact reçoit le lien dans un email template, réserve un créneau, l'événement apparaît dans le calendrier et dans l'activité du deal.

### 4.8 Notes rapides
Input "Note rapide" sur une fiche pour ajouter un commentaire contextuel. Markdown supporté.

### 4.9 Tâches liées
Créer une tâche (`Rappeler Jean dans 3 jours`) liée à un contact ou deal. Apparaît dans le module Tasks + dans l'activité du CRM.

### 4.10 File attachments
Joindre des fichiers (contrats, devis, specs) à un deal ou contact. Stockés dans Drive, liés dans le CRM.

### 4.11 Internal comments
Commentaires internes (non visibles par le contact) sur un deal ou une activité. @mention un collègue pour collaboration.

### 4.12 Logs des appels (call logs)
Historique des appels passés/reçus avec durée, résultat (joint/pas de réponse/voicemail), notes.

---

## Catégorie 5 — Workflows et automations

### 5.1 Triggers
Déclencheurs : nouveau contact créé, email reçu, deal changé d'étape, date atteinte, formulaire soumis, webhook reçu, deal créé, champ modifié, tâche marquée terminée.

### 5.2 Actions
- Envoyer un email
- Créer une tâche
- Assigner un owner
- Changer une étape de deal
- Appliquer un tag
- Ajouter à une séquence
- Créer une opportunity
- Webhook sortant
- Notification Slack/Chat
- Update d'un champ

### 5.3 Conditions
`If montant > 10000 AND pipeline = "SaaS" THEN notify sales director`. Conditions multiples avec AND/OR.

### 5.4 Workflows visuels
Drag-drop builder pour créer des workflows complexes : triggers → conditions → actions avec branches. Preview et test avant activation.

### 5.5 Exemples de workflows
- Nouveau lead de formulaire → enrichir → assigner au commercial en round-robin → envoyer email de welcome
- Deal inactif depuis 7 jours → notif owner + tâche de relance
- Deal à `Proposal` depuis 5 jours → envoyer template proposal si pas encore fait
- Deal marqué `Gagné` → créer tâche onboarding + notifier Customer Success

### 5.6 Scheduled workflows
Déclenchement à date fixe (tous les lundis, 1er du mois) pour les digests, les rapports, les nettoyages automatiques.

### 5.7 Rules engine
Règles simples sans builder : `Si champ X = Y alors champ Z = W`. Pour les cas simples sans workflow complet.

### 5.8 Lead routing (round-robin, rules)
Attribution automatique des nouveaux leads aux commerciaux : round-robin, par territoire géographique, par secteur, par taille d'entreprise, par langue.

### 5.9 Lead scoring automatique
Règles de scoring : `+10 points si visite 3+ pages du site`, `+20 si email opened`, `+50 si demo request`, `-10 si opt-out`. Seuils pour catégoriser (cold/warm/hot).

### 5.10 SLA tracking
Définir des SLAs : `Tout nouveau lead doit avoir une première action dans les 2h`. Alertes et escalation automatiques.

---

## Catégorie 6 — Reporting et analytics

### 6.1 Dashboard personnalisable
Homepage du CRM : KPIs (deals créés cette semaine, valeur pipeline, taux conversion), graphique d'évolution, top deals, activités récentes. Widgets configurables.

### 6.2 Rapports standards
- **Pipeline par étape** (bar chart ou funnel)
- **Pipeline par owner** (comparaison commerciaux)
- **Deals créés par période** (line chart)
- **Deals gagnés par période**
- **Taux de conversion par étape** (funnel)
- **Cycle de vente moyen**
- **Montant moyen par deal**
- **Revenus clôturés par mois**
- **Sources de leads**
- **Deals perdus par raison**
- **Activités par commercial** (emails, calls, meetings)

### 6.3 Rapports custom
Builder de rapports visuels : choisir entité (contact/deal/activity), champs, filtres, regroupements, agrégations, type de visualisation.

### 6.4 Sauvegarde et partage
Enregistrer un rapport custom, le partager avec des collègues, recevoir par email périodiquement (digest hebdo).

### 6.5 Filtres globaux
Filtres : date, owner, pipeline, segment, etc. appliqués à tous les widgets du dashboard simultanément.

### 6.6 Export CSV / PDF
Exporter n'importe quel rapport au format CSV pour Excel, ou PDF pour partage externe.

### 6.7 Goals et quotas
Définir des objectifs par commercial ou par équipe (X deals gagnés par mois, Y€ de revenus). Progression visible en direct.

### 6.8 Leaderboard
Classement des commerciaux par KPI choisi (deals, revenus, activités). Gamification.

### 6.9 Forecasting avancé
Prévision basée sur le pipeline actuel + taux de conversion historiques + saisonnalité. Scénarios optimiste/réaliste/pessimiste.

### 6.10 Attribution models
Pour le marketing attribution : first-touch, last-touch, multi-touch, time-decay, W-shaped. Utilisé pour savoir quels canaux génèrent le plus de revenus.

---

## Catégorie 7 — IA intégrée

### 7.1 AI deal coach
Sur chaque deal, insights de l'AI : "Ce deal n'a pas eu d'activité depuis 10 jours, relancez", "Le contact principal n'a pas ouvert vos 3 derniers emails, essayez LinkedIn", "Deals similaires ont mis 30 jours à clôturer, prévoyez en conséquence".

### 7.2 Email draft assistant
Bouton `Écrire avec IA` dans le compose : prompt "follow-up poli après meeting avec Jean sur projet refonte site". L'IA génère un brouillon contextualisé (historique du contact, détails du deal).

### 7.3 Meeting summary
Après une réunion enregistrée (visio interne), l'AI génère un résumé des points clés, des décisions, et extrait les action items qui sont automatiquement créés comme tâches.

### 7.4 Lead scoring IA
Au-delà des règles manuelles, un modèle ML apprend des deals passés (gagnés vs perdus) pour prédire la probabilité de conversion d'un lead. Score avec explication.

### 7.5 Next best action
Pour chaque contact/deal, l'AI suggère la prochaine action optimale : "Envoyer démo", "Demander feedback", "Proposer meeting", "Relance directe par call".

### 7.6 Sentiment analysis sur les emails
Analyse des emails reçus du contact : sentiment positif/négatif/neutre. Alerte si un ton devient hostile.

### 7.7 Deal risk prediction
Identification des deals à risque (stagnation, silence, objections non résolues). Dashboard dédié.

### 7.8 Customer churn prediction
Pour les clients existants, probabilité de churn basée sur l'engagement (utilisation du produit, tickets support, derniers meetings).

### 7.9 Auto-categorisation des activités
L'AI classe les emails/notes en catégories (discovery, demo, négociation, objection, closing) pour mesurer le temps passé à chaque étape.

### 7.10 Suggestion de contacts similaires
"Les contacts comme Jean (industrie, taille, pain point) ont été convertis avec ces approches". Aide à la priorisation.

### 7.11 Q&A sur le CRM
Panneau `Ask AI` : "Combien de deals ont été gagnés en mars ?", "Quel est mon taux de conversion ?", "Montre-moi les deals bloqués depuis plus de 2 semaines".

---

## Catégorie 8 — Intégrations

### 8.1 Intégration Mail
Sync bidirectionnelle avec le module Mail : emails automatiquement loggés sur les fiches, templates envoyés depuis Mail ou CRM, tracking.

### 8.2 Intégration Calendar
Meetings du calendrier apparaissent sur l'activité du contact. Création d'un meeting depuis le CRM crée l'événement calendar.

### 8.3 Intégration Tasks
Tâches CRM sont visibles dans le module Tasks. Synchronisation bidirectionnelle.

### 8.4 Intégration Chat / Meet
Notification Chat quand un deal important est gagné. Lien vers meeting enregistré depuis l'activité.

### 8.5 Intégration Billing
Créer une facture depuis un deal gagné. Les factures sont liées au deal.

### 8.6 Intégration Forms
Formulaires web avec soumissions qui créent automatiquement des leads dans le CRM.

### 8.7 API REST
Endpoints pour toutes les entités (contacts, companies, deals, activities). CRUD complet. Webhooks pour les events.

### 8.8 Webhooks
Configurer des webhooks sortants : deal changé → POST vers Zapier/Slack/custom.

### 8.9 LinkedIn Sales Navigator
Intégration pour importer contacts et messages LinkedIn.

### 8.10 Téléphonie (VoIP)
Aircall, Twilio, JustCall, RingCentral — passe des appels depuis le CRM, loggés automatiquement.

### 8.11 Email marketing (Mailchimp, SendGrid)
Sync des contacts pour campagnes marketing. Status d'envoi et opens reflétés dans le CRM.

### 8.12 Zapier / Make
Publier des actions CRM comme triggers Zapier. Pour les intégrations tierces.

---

## Catégorie 9 — Mobilité et collaboration

### 9.1 Application mobile native
iOS et Android avec toutes les fonctions essentielles : consulter contacts, logger calls/notes, voir pipeline, modifier deals. Mode offline.

### 9.2 Call from mobile
Tap sur un numéro dans la fiche pour appeler via le téléphone. Auto-log du call.

### 9.3 Business card scanner
Scan d'une carte de visite avec la caméra → OCR + création automatique du contact dans le CRM.

### 9.4 Quick capture
Bouton flottant pour ajouter rapidement une note, un contact, un deal depuis n'importe quel écran.

### 9.5 Voice notes
Enregistrer une note vocale après un meeting. Transcription automatique + résumé IA.

### 9.6 Collaborative ownership
Plusieurs commerciaux peuvent partager un deal (lead + SDR + AE). Rôles distincts.

### 9.7 @mention pour alerter
Dans une note ou un commentaire, `@jean` envoie une notification à Jean pour qu'il consulte.

### 9.8 Permissions granulaires
Par rôle : commercial junior voit ses deals seulement, manager voit toute l'équipe, admin voit tout. Configurable par entité et par champ.

### 9.9 Team activity feed
Feed d'équipe montrant les deals fermés, les nouveaux contacts importants, les meetings bookés. Partage des success.

### 9.10 Shared views et filtres
Vues personnelles et partagées avec l'équipe (`Mes deals`, `Deals de l'équipe`, `Deals à haute valeur`).

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **HubSpot Academy** (academy.hubspot.com) — certifications gratuites sur inbound marketing, sales, service.
- **HubSpot Knowledge Base** (knowledge.hubspot.com) — docs exhaustives par feature.
- **Salesforce Trailhead** (trailhead.salesforce.com) — apprentissage gamifié.
- **Pipedrive Help** (support.pipedrive.com) — guides pipeline, automations.
- **Copper Guides** (support.copper.com) — Google Workspace integration patterns.
- **Attio Docs** (docs.attio.com) — objets customisables, database patterns.
- **Folk Help** (folk.app/help) — relationship management.
- **Zoho CRM Help** (help.zoho.com/portal/en/kb/crm) — features avancées.
- **Close Blog** (close.com/blog) — pratiques inside sales.

### Projets open source permissifs
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **SuiteCRM** | **AGPL v3** | **INTERDIT**. Étudier uniquement via démos publiques. |
| **EspoCRM Community** | **AGPL v3** | **INTERDIT**. |
| **Vtiger CRM Open Source** | **MPL** / SRC License | **Attention licence custom**, valider avant tout usage. |
| **Mautic** (marketing automation) | **GPL v3** | **INTERDIT**. |
| **Frappe CRM** (github.com/frappe/crm) | **AGPL v3** | **INTERDIT**. |
| **Twenty CRM** (github.com/twentyhq/twenty) | **AGPL v3** | **INTERDIT**. |
| **Krayin CRM** (github.com/krayin/laravel-crm) | **MIT** | Pattern Laravel pour un CRM léger. Référence de structure. |
| **HubSpot API** (developers.hubspot.com) | API propriétaire | Étudier le schéma et les endpoints pour inspiration. |
| **Salesforce API** (developer.salesforce.com) | API propriétaire | Idem. |
| **Papa Parse** (papaparse.com) | **MIT** | Parser CSV pour les imports. |
| **CountryFlag** (countryflags.svg) | **CC0-1.0** | Drapeaux pour les contacts internationaux. |
| **libphonenumber-js** (github.com/catamphetamine/libphonenumber-js) | **MIT** | Validation et formatage des numéros de téléphone. |
| **VCF / vCard parser** (github.com/nextapps-de/vcard-parser) | **MIT** | Import vCard. |

### Pattern d'implémentation recommandé
1. **Schéma flexible** : SignApps-db avec entités `Contact`, `Company`, `Deal`, `Activity` + custom fields via JSONB. Pattern Airtable-like pour la flexibilité.
2. **Pipeline builder** : drag-drop avec `@dnd-kit/core` (MIT), déjà utilisé.
3. **Email tracking** : pixel 1x1 invisible + webhook de click tracking. Attention à ne pas l'activer par défaut (privacy).
4. **Phone number validation** : libphonenumber-js (MIT) pour normalisation E.164.
5. **Enrichissement** : connecteurs vers APIs tierces (Clearbit alternatives open : Apollo, Hunter.io, Lusha) via workflows. Pas de copie du code commercial.
6. **AI coach** : LLM interne avec context window contenant l'historique du deal + contacts + activités. Prompts templates fine-tunés.
7. **Reporting** : moteur de requête custom sur signapps-db, rendu avec Chart.js ou ECharts (Apache-2.0).
8. **Sequences** : workflow engine avec scheduler (cron-like + event-driven).
9. **Sync mail/calendar** : via les APIs du module Mail/Calendar de SignApps, pas de connecteurs externes directs.
10. **VoIP** : connecteurs vers Twilio API (commercial mais SDK MIT) ou Aircall API.

### Ce qu'il ne faut PAS faire
- **Pas de fork** de SuiteCRM, EspoCRM, Frappe CRM, Twenty, Mautic (tous AGPL/GPL).
- **Pas d'email tracking sans consentement** — opt-in explicite et visible.
- **Pas d'enrichissement sans respect RGPD** — consent du contact requis.

---

## UI Behavior Details

### Contact List View
Default view is a paginated table with columns: Name, Email, Company, Phone, Tags, Score, Owner, Last Contact. Row click opens the contact detail page. Checkbox on each row enables bulk actions (tag, assign, delete, export). Toolbar above the table: search bar (debounced 300ms, triggers on 2+ chars), filter button (opens facet panel on the left), sort dropdown, column visibility toggle, view switch (table / card grid). Empty state shows illustration with "Add your first contact" CTA.

### Contact Detail Page
Full-width page split into three columns. Left column (25%): avatar with upload overlay on hover, name (editable inline on double-click), title, company (link to company page), emails (click to compose in Mail), phones (click to call via VoIP), social links (open in new tab), tags (click "+" to add). Center column (50%): tab bar with Activity / Emails / Meetings / Tasks / Notes / Files. Activity tab is the default — reverse-chronological timeline with icons per type (envelope for email, calendar for meeting, check for task, pencil for note). Each timeline entry shows actor, action, timestamp, and excerpt. Scroll loads more entries (infinite scroll, 50 per page). Right column (25%): Deals panel (mini kanban cards with stage color dot, amount, close date), Tasks panel (checklist with due dates), Groups panel (chips).

### Pipeline Kanban
Full-screen kanban board. Each column header shows stage name, deal count, and total value. Cards show deal title, company, amount, close date, owner avatar. Drag a card between columns — on drop, the stage updates optimistically. If the target stage is "Won" or "Lost", a confirmation dialog appears: "Won" asks for revenue and close date; "Lost" asks for a mandatory loss reason (dropdown) and optional comment. Column widths are equal and horizontally scrollable if >6 stages. Collapsed columns show only the header with a "+" expand icon.

### Deal Detail Page
Similar layout to contact but center column tabs are: Activity / Contacts / Products / Files / Notes. Top banner shows deal title (editable), stage badge (colored), amount, probability, weighted amount (auto-calculated), close date (date picker), owner (avatar dropdown). Progress bar under the banner shows the stage position in the pipeline. "Convert to Won" and "Mark Lost" buttons in the top-right corner.

### Reports Dashboard
Grid of widget cards (2x3 default). Each widget has a title, chart, and "..." menu (edit, duplicate, remove, fullscreen). Filter bar at top with date range picker, owner multi-select, pipeline selector. Widgets auto-refresh every 60 seconds. Click on a chart segment opens a drill-down list of the underlying deals. "Add Widget" button opens a catalog of available report types.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open global search (contacts, companies, deals) |
| `Ctrl+N` | New contact |
| `Ctrl+Shift+N` | New deal |
| `Ctrl+Shift+C` | New company |
| `Ctrl+E` | Edit selected record |
| `Ctrl+Enter` | Save current form |
| `Escape` | Close dialog / cancel edit |
| `J` / `K` | Navigate up / down in list |
| `Enter` | Open selected record |
| `Ctrl+Shift+T` | New task on current record |
| `Ctrl+Shift+M` | New note on current record |
| `Ctrl+/` | Show keyboard shortcut help |

---

## Schema PostgreSQL

```sql
-- CRM contacts (extends the shared contacts table with CRM-specific fields)
CREATE TABLE crm_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL DEFAULT '',
    email VARCHAR(255),
    phone VARCHAR(50),
    company_id UUID REFERENCES crm_companies(id),
    title VARCHAR(255),
    avatar_url TEXT,
    score INT NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
    score_trend VARCHAR(10) DEFAULT 'stable', -- rising, stable, falling
    owner_id UUID REFERENCES users(id),
    lifecycle_stage VARCHAR(32) DEFAULT 'lead', -- lead, mql, sql, opportunity, customer, evangelist
    source VARCHAR(64), -- web_form, import, manual, email, linkedin, referral
    consent_marketing BOOLEAN NOT NULL DEFAULT false,
    consent_sales BOOLEAN NOT NULL DEFAULT false,
    do_not_contact BOOLEAN NOT NULL DEFAULT false,
    social_linkedin TEXT,
    social_twitter TEXT,
    social_github TEXT,
    website TEXT,
    addresses JSONB DEFAULT '[]',
    phones JSONB DEFAULT '[]', -- [{type: "mobile", number: "+33..."}]
    emails JSONB DEFAULT '[]', -- [{type: "work", address: "..."}]
    custom_fields JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    last_contacted_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_contacts_workspace ON crm_contacts(workspace_id);
CREATE INDEX idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX idx_crm_contacts_company ON crm_contacts(company_id);
CREATE INDEX idx_crm_contacts_owner ON crm_contacts(owner_id);
CREATE INDEX idx_crm_contacts_score ON crm_contacts(workspace_id, score DESC);
CREATE INDEX idx_crm_contacts_tags ON crm_contacts USING gin(tags);
CREATE INDEX idx_crm_contacts_search ON crm_contacts USING gin(
    to_tsvector('simple', coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(email,''))
);

-- CRM companies
CREATE TABLE crm_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255), -- e.g. acme.com for auto-association
    industry VARCHAR(128),
    size_range VARCHAR(32), -- 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+
    annual_revenue BIGINT,
    website TEXT,
    logo_url TEXT,
    description TEXT,
    address JSONB,
    parent_id UUID REFERENCES crm_companies(id),
    owner_id UUID REFERENCES users(id),
    account_score INT NOT NULL DEFAULT 0 CHECK (account_score BETWEEN 0 AND 100),
    custom_fields JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_crm_companies_domain ON crm_companies(workspace_id, domain) WHERE domain IS NOT NULL;
CREATE INDEX idx_crm_companies_workspace ON crm_companies(workspace_id);
CREATE INDEX idx_crm_companies_parent ON crm_companies(parent_id);

-- CRM pipelines
CREATE TABLE crm_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pipeline stages
CREATE TABLE crm_pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    default_probability INT NOT NULL DEFAULT 50 CHECK (default_probability BETWEEN 0 AND 100),
    color VARCHAR(7) DEFAULT '#6366f1',
    is_won BOOLEAN NOT NULL DEFAULT false,
    is_lost BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_stages_pipeline ON crm_pipeline_stages(pipeline_id, sort_order);

-- CRM deals
CREATE TABLE crm_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    pipeline_id UUID NOT NULL REFERENCES crm_pipelines(id),
    stage_id UUID NOT NULL REFERENCES crm_pipeline_stages(id),
    title VARCHAR(255) NOT NULL,
    amount BIGINT, -- in cents
    currency VARCHAR(3) DEFAULT 'EUR',
    probability INT NOT NULL DEFAULT 50 CHECK (probability BETWEEN 0 AND 100),
    weighted_amount BIGINT GENERATED ALWAYS AS (amount * probability / 100) STORED,
    expected_close_date DATE,
    actual_close_date DATE,
    owner_id UUID REFERENCES users(id),
    company_id UUID REFERENCES crm_companies(id),
    lost_reason VARCHAR(64), -- price, features, competitor, timing, no_decision, other
    lost_comment TEXT,
    custom_fields JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_deals_workspace_pipeline ON crm_deals(workspace_id, pipeline_id);
CREATE INDEX idx_crm_deals_stage ON crm_deals(stage_id);
CREATE INDEX idx_crm_deals_owner ON crm_deals(owner_id);
CREATE INDEX idx_crm_deals_close_date ON crm_deals(expected_close_date);

-- Deal-contact association (many-to-many)
CREATE TABLE crm_deal_contacts (
    deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    role VARCHAR(64) DEFAULT 'participant', -- decision_maker, champion, influencer, participant
    PRIMARY KEY (deal_id, contact_id)
);

-- CRM activities (unified timeline)
CREATE TABLE crm_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    activity_type VARCHAR(32) NOT NULL, -- email, call, meeting, note, task, stage_change, field_change, deal_created, file_attached
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
    actor_id UUID NOT NULL REFERENCES users(id),
    subject VARCHAR(512),
    body TEXT,
    metadata JSONB DEFAULT '{}', -- type-specific data: {duration_seconds, call_result, old_stage, new_stage, ...}
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_activities_contact ON crm_activities(contact_id, occurred_at DESC);
CREATE INDEX idx_crm_activities_deal ON crm_activities(deal_id, occurred_at DESC);
CREATE INDEX idx_crm_activities_company ON crm_activities(company_id, occurred_at DESC);
CREATE INDEX idx_crm_activities_type ON crm_activities(workspace_id, activity_type);

-- Deal products / line items
CREATE TABLE crm_deal_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price BIGINT NOT NULL, -- in cents
    discount_percent NUMERIC(5,2) DEFAULT 0,
    total BIGINT GENERATED ALWAYS AS (quantity * unit_price * (100 - discount_percent) / 100) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CRM email templates
CREATE TABLE crm_email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(512) NOT NULL,
    body_html TEXT NOT NULL,
    variables TEXT[] DEFAULT '{}', -- {{first_name}}, {{company}}, {{deal_title}}
    category VARCHAR(64), -- first_contact, follow_up, demo, proposal, win_back
    usage_count INT NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CRM sequences (automated cadences)
CREATE TABLE crm_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    stop_on_reply BOOLEAN NOT NULL DEFAULT true,
    stop_on_meeting BOOLEAN NOT NULL DEFAULT true,
    stop_on_deal BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE crm_sequence_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id UUID NOT NULL REFERENCES crm_sequences(id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    step_type VARCHAR(32) NOT NULL, -- email, task, call, linkedin, wait
    delay_days INT NOT NULL DEFAULT 0,
    template_id UUID REFERENCES crm_email_templates(id),
    task_description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE crm_sequence_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id UUID NOT NULL REFERENCES crm_sequences(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    current_step INT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'active', -- active, paused, completed, stopped
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    stopped_at TIMESTAMPTZ,
    stop_reason VARCHAR(64), -- reply, meeting, deal, manual, completed
    UNIQUE(sequence_id, contact_id)
);

-- CRM custom fields definition
CREATE TABLE crm_custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    entity_type VARCHAR(32) NOT NULL, -- contact, company, deal
    field_name VARCHAR(128) NOT NULL,
    field_label VARCHAR(255) NOT NULL,
    field_type VARCHAR(32) NOT NULL, -- text, number, date, select, multi_select, checkbox, url, formula
    options JSONB, -- for select/multi_select: ["Option A", "Option B"]
    is_required BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, entity_type, field_name)
);

-- CRM lead routing rules
CREATE TABLE crm_lead_routing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    name VARCHAR(255) NOT NULL,
    strategy VARCHAR(32) NOT NULL, -- round_robin, territory, industry, language, size
    conditions JSONB DEFAULT '{}', -- filter conditions
    assignees UUID[] NOT NULL, -- user IDs in rotation
    current_index INT NOT NULL DEFAULT 0, -- for round_robin
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## REST API Endpoints

All endpoints require JWT authentication. Base path: `signapps-gateway` routes to the CRM handlers. Service is embedded in `signapps-gateway` or a dedicated `signapps-crm` service.

### Contacts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/crm/contacts?q=&tag=&owner=&score_min=&page=&per_page=` | List contacts with filters |
| POST | `/api/v1/crm/contacts` | Create contact |
| GET | `/api/v1/crm/contacts/:id` | Get contact detail with activity summary |
| PATCH | `/api/v1/crm/contacts/:id` | Update contact fields |
| DELETE | `/api/v1/crm/contacts/:id` | Soft-delete contact |
| POST | `/api/v1/crm/contacts/import` | Import from CSV (multipart) |
| POST | `/api/v1/crm/contacts/merge` | Merge two contacts `{source_id, target_id}` |
| GET | `/api/v1/crm/contacts/:id/activity?type=&page=` | Contact activity timeline |
| GET | `/api/v1/crm/contacts/:id/deals` | Deals linked to contact |
| POST | `/api/v1/crm/contacts/:id/tags` | Add tags to contact |
| DELETE | `/api/v1/crm/contacts/:id/tags/:tag` | Remove tag |
| POST | `/api/v1/crm/contacts/:id/notes` | Add note to contact |
| GET | `/api/v1/crm/contacts/duplicates` | List detected duplicates |
| POST | `/api/v1/crm/contacts/bulk` | Bulk update (tag, assign, delete) |
| GET | `/api/v1/crm/contacts/export?format=csv&filter=` | Export contacts |

### Companies
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/crm/companies?q=&industry=&page=` | List companies |
| POST | `/api/v1/crm/companies` | Create company |
| GET | `/api/v1/crm/companies/:id` | Get company detail |
| PATCH | `/api/v1/crm/companies/:id` | Update company |
| DELETE | `/api/v1/crm/companies/:id` | Soft-delete company |
| GET | `/api/v1/crm/companies/:id/contacts` | Contacts in this company |
| GET | `/api/v1/crm/companies/:id/deals` | Deals for this company |
| GET | `/api/v1/crm/companies/:id/activity?page=` | Aggregated activity |
| GET | `/api/v1/crm/companies/:id/hierarchy` | Parent/subsidiary tree |

### Pipelines
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/crm/pipelines` | List all pipelines |
| POST | `/api/v1/crm/pipelines` | Create pipeline |
| PATCH | `/api/v1/crm/pipelines/:id` | Update pipeline |
| DELETE | `/api/v1/crm/pipelines/:id` | Delete pipeline |
| GET | `/api/v1/crm/pipelines/:id/stages` | List stages of a pipeline |
| POST | `/api/v1/crm/pipelines/:id/stages` | Add stage |
| PATCH | `/api/v1/crm/pipelines/:id/stages/:stage_id` | Update stage |
| DELETE | `/api/v1/crm/pipelines/:id/stages/:stage_id` | Delete stage |
| PATCH | `/api/v1/crm/pipelines/:id/stages/reorder` | Reorder stages `{stage_ids: [...]}` |

### Deals
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/crm/deals?pipeline=&stage=&owner=&page=` | List deals |
| POST | `/api/v1/crm/deals` | Create deal |
| GET | `/api/v1/crm/deals/:id` | Get deal detail |
| PATCH | `/api/v1/crm/deals/:id` | Update deal (including stage change) |
| DELETE | `/api/v1/crm/deals/:id` | Soft-delete deal |
| POST | `/api/v1/crm/deals/:id/contacts` | Link contact to deal |
| DELETE | `/api/v1/crm/deals/:id/contacts/:contact_id` | Unlink contact |
| POST | `/api/v1/crm/deals/:id/products` | Add line item |
| DELETE | `/api/v1/crm/deals/:id/products/:product_id` | Remove line item |
| GET | `/api/v1/crm/deals/:id/activity?page=` | Deal activity timeline |
| POST | `/api/v1/crm/deals/:id/won` | Mark deal as won |
| POST | `/api/v1/crm/deals/:id/lost` | Mark deal as lost `{reason, comment}` |
| POST | `/api/v1/crm/deals/:id/reopen` | Reopen a closed deal |

### Activities & Notes
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/crm/activities` | Log an activity (call, meeting, note) |
| GET | `/api/v1/crm/activities?contact=&deal=&type=&page=` | List activities |
| DELETE | `/api/v1/crm/activities/:id` | Delete activity |

### Email Templates
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/crm/templates` | List email templates |
| POST | `/api/v1/crm/templates` | Create template |
| PATCH | `/api/v1/crm/templates/:id` | Update template |
| DELETE | `/api/v1/crm/templates/:id` | Delete template |
| POST | `/api/v1/crm/templates/:id/render` | Render template with variables |

### Sequences
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/crm/sequences` | List sequences |
| POST | `/api/v1/crm/sequences` | Create sequence |
| PATCH | `/api/v1/crm/sequences/:id` | Update sequence |
| DELETE | `/api/v1/crm/sequences/:id` | Delete sequence |
| POST | `/api/v1/crm/sequences/:id/enroll` | Enroll contact `{contact_id}` |
| POST | `/api/v1/crm/sequences/:id/stop` | Stop enrollment `{contact_id}` |
| GET | `/api/v1/crm/sequences/:id/enrollments` | List enrollments |

### Reporting
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/crm/reports/pipeline?pipeline=&from=&to=` | Pipeline report (by stage, value) |
| GET | `/api/v1/crm/reports/forecast?months=` | Revenue forecast |
| GET | `/api/v1/crm/reports/conversion?pipeline=&from=&to=` | Conversion funnel |
| GET | `/api/v1/crm/reports/activities?owner=&from=&to=` | Activity report per owner |
| GET | `/api/v1/crm/reports/lost-reasons?pipeline=&from=&to=` | Lost deal reasons breakdown |
| GET | `/api/v1/crm/reports/leaderboard?metric=&from=&to=` | Sales leaderboard |
| GET | `/api/v1/crm/reports/cycle-time?pipeline=` | Average sales cycle |
| POST | `/api/v1/crm/reports/custom` | Run custom report query |
| GET | `/api/v1/crm/reports/export?report=&format=csv` | Export report |

### Custom Fields
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/crm/custom-fields?entity_type=` | List custom field definitions |
| POST | `/api/v1/crm/custom-fields` | Create custom field |
| PATCH | `/api/v1/crm/custom-fields/:id` | Update custom field |
| DELETE | `/api/v1/crm/custom-fields/:id` | Delete custom field |

### Lead Routing
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/crm/routing-rules` | List routing rules |
| POST | `/api/v1/crm/routing-rules` | Create routing rule |
| PATCH | `/api/v1/crm/routing-rules/:id` | Update routing rule |
| DELETE | `/api/v1/crm/routing-rules/:id` | Delete routing rule |

### AI
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/crm/ai/deal-coach` | Get AI insights for a deal |
| POST | `/api/v1/crm/ai/email-draft` | Generate email draft for context |
| POST | `/api/v1/crm/ai/next-action` | Suggest next best action |
| POST | `/api/v1/crm/ai/lead-score` | AI-computed lead score |
| POST | `/api/v1/crm/ai/sentiment` | Analyze email sentiment |
| POST | `/api/v1/crm/ai/ask` | Natural language Q&A on CRM data |

---

## PgEventBus Events

| Event | Payload | Consumers |
|-------|---------|-----------|
| `crm.contact.created` | `{contact_id, workspace_id, email, source}` | notifications, contacts-module, ai-enrichment |
| `crm.contact.updated` | `{contact_id, changed_fields[]}` | contacts-module, search-index |
| `crm.contact.merged` | `{source_id, target_id, workspace_id}` | contacts-module, search-index |
| `crm.contact.scored` | `{contact_id, old_score, new_score, trend}` | notifications (if threshold crossed) |
| `crm.company.created` | `{company_id, workspace_id, domain}` | contacts-module, ai-enrichment |
| `crm.deal.created` | `{deal_id, pipeline_id, amount, owner_id}` | notifications, dashboard, calendar |
| `crm.deal.stage_changed` | `{deal_id, old_stage_id, new_stage_id, pipeline_id}` | notifications, dashboard, workflows |
| `crm.deal.won` | `{deal_id, amount, contact_ids[], company_id}` | notifications, billing, dashboard, chat (celebration) |
| `crm.deal.lost` | `{deal_id, reason, comment}` | notifications, dashboard, analytics |
| `crm.deal.reopened` | `{deal_id, reopened_by}` | notifications, dashboard |
| `crm.activity.logged` | `{activity_id, type, contact_id, deal_id}` | search-index, dashboard |
| `crm.sequence.enrolled` | `{sequence_id, contact_id, step_count}` | scheduler (queue first step) |
| `crm.sequence.step_executed` | `{enrollment_id, step_order, step_type}` | notifications, activity-log |
| `crm.sequence.stopped` | `{enrollment_id, reason}` | notifications |
| `crm.lead.routed` | `{contact_id, assigned_to, rule_id}` | notifications |
| `crm.import.completed` | `{workspace_id, imported_count, duplicate_count, error_count}` | notifications |

---

## Inter-module Integration

### CRM <-> Mail (signapps-mail, port 3012)
Every email sent to or received from a known CRM contact is automatically logged as a `crm_activity` with `activity_type = 'email'`. The Mail module emits `mail.message.received` and `mail.message.sent` events; the CRM consumes them and matches the sender/recipient email against `crm_contacts.email`. Email templates defined in the CRM use the Mail module SMTP pipeline for delivery. Email tracking (open/click) data flows back via `mail.tracking.opened` and `mail.tracking.clicked` events.

### CRM <-> Calendar (signapps-calendar, port 3011)
When a meeting is created in the CRM, a `calendar.event.create` request is issued to the Calendar service. Conversely, when a calendar event includes a CRM contact as attendee, the Calendar emits `calendar.event.created` and the CRM logs it as a meeting activity. Meeting booking links generated in CRM route through the Calendar module booking system.

### CRM <-> Tasks (signapps-gateway tasks)
Tasks created from a CRM contact or deal page are stored in the shared tasks system. The CRM writes the `related_entity_type` ("crm_contact" or "crm_deal") and `related_entity_id` fields. Tasks appear in both the CRM activity timeline and the Tasks module.

### CRM <-> Billing (signapps-billing, port 8096)
When a deal is marked as "Won", the CRM emits `crm.deal.won`. The Billing module can consume this event to auto-generate an invoice draft with the deal amount and linked company. Conversely, `billing.invoice.paid` can update the deal status metadata.

### CRM <-> Forms (signapps-forms, port 3015)
Form submissions with CRM integration enabled trigger `forms.submission.created` with the `crm_integration: true` flag. The CRM consumes this, creates a new contact (or updates existing by email match), creates a deal if the form includes deal fields, and applies lead routing rules.

### CRM <-> Chat (signapps-chat, port 3020)
When a high-value deal is won, a notification is posted to the configured Chat channel via `chat.message.post`. Internal comments on deals with @mentions generate Chat DM notifications.

### CRM <-> Contacts (signapps-contacts)
The Contacts module is the canonical contact store. CRM contacts extend the base contact with CRM-specific fields (score, lifecycle stage, deals). When a contact is created in CRM, it also creates a base contact record. Merge operations synchronize both stores.

### CRM <-> AI (signapps-ai, port 3005)
AI features (deal coaching, email drafting, lead scoring, sentiment analysis, Q&A) route through the AI gateway. The CRM sends context payloads (deal history, contact activity, email threads) and receives structured responses (scores, text, suggestions).

### CRM <-> Drive (signapps-storage, port 3004)
File attachments on deals and contacts are stored in Drive under a CRM-specific folder. The CRM stores `file_id` references and the Drive handles storage/retrieval.

---

## Assertions E2E cles (a tester)

- Creation d'un contact with first name, last name, email, phone -> appears in list
- Contact detail page shows all fields, tabs load correctly
- Edit contact inline (double-click name) -> saves on blur
- Import CSV: upload file -> column mapping -> preview -> confirm -> contacts created
- Import detects duplicates by email, offers merge/skip/create
- Deduplication: two contacts with same email -> merge dialog -> merged contact has both phone numbers
- Create company -> auto-associates contacts by email domain
- Company hierarchy: set parent company -> tree view shows relationship
- Pipeline Kanban: create pipeline with 5 stages -> stages render as columns
- Create deal in pipeline -> card appears in correct stage column
- Drag deal card from "Qualified" to "Proposal" -> stage updates, activity logged
- Drag deal to "Won" column -> confirmation dialog -> asks for close date -> deal marked won
- Drag deal to "Lost" column -> mandatory reason dropdown -> deal marked lost with reason
- Deal detail: add line items (product, qty, price) -> total auto-calculated
- Deal detail: link multiple contacts -> contacts panel shows them with roles
- Email log: send email to CRM contact via Mail -> activity appears in contact timeline
- Email template: create with variables -> render preview shows replaced values
- Sequence: create 3-step sequence -> enroll contact -> first email sent after delay
- Sequence auto-stop: contact replies -> enrollment stopped with reason "reply"
- Task created from contact page -> appears in Tasks module and CRM activity
- Note added to deal -> appears in deal activity timeline with Markdown rendering
- Report: pipeline by stage -> bar chart shows deal count and value per stage
- Report: forecast -> shows optimistic/realistic/pessimistic revenue for next 3 months
- Report: lost reasons -> pie chart breakdown
- Leaderboard: ranks sales reps by deals won this month
- Custom field: admin adds "Industry Segment" dropdown to contacts -> appears on forms
- Tags: apply "VIP" tag to 5 contacts via bulk action -> filter by tag shows 5
- Lead routing: configure round-robin rule -> new form submission -> contact assigned to next rep
- AI deal coach: open deal with no activity for 10 days -> AI suggests "Send follow-up"
- AI email draft: click "Write with AI" -> prompt -> generated email uses contact name and deal context
- AI Q&A: ask "How many deals did we close this month?" -> correct answer returned
- Search: type partial name in Ctrl+K -> results show contacts, companies, deals
- Filter: faceted filter by tag + owner -> list updates
- Export contacts to CSV -> file downloads with correct columns
- Keyboard: Ctrl+N opens new contact dialog, Escape closes it
- Meeting booking: send booking link -> contact books slot -> calendar event created -> CRM activity logged
- Multi-pipeline: switch between "SaaS" and "Consulting" pipelines -> different stages shown
- Workflow: new lead from form -> auto-assigned + welcome email sent + notification to owner
- Mobile: tap phone number on contact card -> VoIP call initiated
- Business card scanner: capture photo -> OCR extracts name, email, phone -> contact created
