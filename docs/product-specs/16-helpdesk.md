# Module Helpdesk / Support — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Zendesk** | Leader support, multi-channel (email, chat, phone, social, messaging), Guide (knowledge base), Answer Bot, Sell (CRM), Explore (analytics), workflows powerful, SLAs, macros, satisfaction ratings, apps marketplace |
| **Intercom** | Messenger-first, Product Tours, Inbox, Articles, Bots (Fin AI), Customer Data Platform, sequences, knowledge base native, resolution bot |
| **Freshdesk** | Multi-channel, SLAs, custom workflows, gamification, satisfaction surveys, self-service portal, omnichannel |
| **HelpScout** | Beau design, beam interne, Docs, Beacon widget, mailbox, conversations, tags, saved replies |
| **Front** | Collaborative inbox, assignments, internal comments, rules, SLAs, analytics, multi-channel |
| **Help Scout** | Inbox partagée simple, knowledge base, beacon, customer profiles, workflows |
| **Jira Service Management** (Atlassian) | ITSM, incidents, changes, problems, ITIL, SLA, asset management |
| **ServiceNow** | Enterprise ITSM leader, workflows, CMDB, incidents/changes/problems |
| **HubSpot Service** | CRM integration, tickets, knowledge base, customer feedback |
| **Zoho Desk** | Multi-channel, AI Zia, workflows, mobile |
| **Kayako** | Traditional, self-hosted option |
| **Groove** | Simple, SMB focused, shared inbox |
| **Crisp** | Chat-first, MagicType, knowledge base, CRM |
| **Chatwoot** | Open source, multi-channel, self-hosted |

## Principes directeurs

1. **Inbox unifiée** — tous les canaux (email, chat, social, forms, calls) dans une seule interface.
2. **Réponses rapides** — macros, templates, AI-generated replies pour réduire le temps de première réponse.
3. **SLAs tenus** — tracking du temps de réponse et de résolution, alertes avant dépassement.
4. **Self-service first** — knowledge base pour que les utilisateurs trouvent les réponses seuls avant d'ouvrir un ticket.
5. **Collaboration transparente** — internal notes, assignment, handoffs fluides entre agents.
6. **Analytics actionables** — dashboard avec les métriques qui comptent : volume, temps de réponse, satisfaction, escalades.

---

## Catégorie 1 — Tickets et inbox

### 1.1 Inbox unifiée
Une seule vue pour tous les tickets quel que soit le canal (email, chat, formulaire, phone, social). Filtres par canal, statut, priorité, assignee.

### 1.2 Statuts de ticket
- **Nouveau** : pas encore traité
- **En cours** : assigné et en traitement
- **En attente client** : réponse attendue du client
- **En attente interne** : bloqué côté équipe
- **Résolu** : solution proposée, en attente de confirmation
- **Fermé** : définitif

### 1.3 Priorités
Low / Normal / High / Urgent. Avec couleur distincte. SLAs différents par priorité.

### 1.4 Types de tickets (catégories)
- Question
- Bug
- Feature request
- Incident
- Change request
- Facturation
- Account
- Custom (définissable)

### 1.5 Assignment
Assigner à un agent ou une équipe. Round-robin, par skills, par load. Réassignation facile.

### 1.6 Vue ticket
Fiche complète avec :
- Sujet et numéro
- Requester (client) avec son historique
- Agent assigné
- Statut, priorité, type
- Thread de messages
- Internal notes (non visibles par le client)
- Tags et propriétés custom
- SLA countdown
- Attachments

### 1.7 Threaded conversation
Tous les messages sur un ticket (email, replies, notes) dans un thread chronologique. Messages clients à gauche, agents à droite.

### 1.8 Rich text replies
Éditeur rich text pour les réponses (gras, listes, liens, images inline). Signature automatique.

### 1.9 Macros / saved replies
Bibliothèque de réponses pré-écrites pour les questions fréquentes. Variables : `{{name}}`, `{{order_id}}`, etc.

### 1.10 Internal notes
Notes internes visibles uniquement par l'équipe. Pour coordonner la résolution sans exposer au client. @mention pour notifier.

### 1.11 Ticket history
Timeline de toutes les actions sur le ticket : créé, assigné, statut changé, commenté, escaladé. Audit complet.

### 1.12 Attachments et files
Upload de fichiers dans les messages. Preview inline pour images et PDFs.

### 1.13 Ticket linking
Lier des tickets entre eux : `duplicate`, `related`, `blocks`, `follow-up`. Navigation entre tickets liés.

### 1.14 Merge tickets
Fusionner deux tickets en un (quand un client ouvre plusieurs tickets sur le même sujet).

### 1.15 Split ticket
Diviser un ticket en plusieurs (si plusieurs problèmes distincts sont remontés dans un seul).

### 1.16 Spam / Junk
Marquer un ticket comme spam → bloquer l'expéditeur.

### 1.17 Ticket templates
Templates pour créer des tickets récurrents avec des champs pré-remplis (ex: demandes de changement standard).

---

## Catégorie 2 — Canaux d'entrée (omnichannel)

### 2.1 Email
Address `support@mydomain.com` réceptionne les emails → créés comme tickets. Reply à un ticket → renvoie un email au client. Threading par Message-ID.

### 2.2 Formulaire web
Formulaire sur le site du client (Forms module) → crée un ticket. Champs structurés.

### 2.3 Chat live (widget)
Widget de chat sur le site du client. Messages deviennent des tickets en temps réel. Chat en live avec un agent.

### 2.4 Téléphone
Intégration VoIP pour recevoir les appels. Auto-creation d'un ticket avec durée, enregistrement (si autorisé), transcription.

### 2.5 Réseaux sociaux
Intégration Twitter/X, Facebook, Instagram, LinkedIn : mentions et DMs deviennent des tickets.

### 2.6 WhatsApp Business
Support WhatsApp Business API pour recevoir/envoyer des messages comme tickets.

### 2.7 SMS
Recevoir des SMS sur un numéro dédié. Convertis en tickets.

### 2.8 API
API pour créer des tickets programmatiquement depuis des apps externes (ex: une app mobile client qui a un bouton "Contacter le support").

### 2.9 Webhooks entrants
Recevoir des événements externes (ex: monitoring alert) et créer des tickets.

### 2.10 Portal self-service
Portail client où les utilisateurs peuvent ouvrir des tickets, voir leur historique, chercher dans la knowledge base.

---

## Catégorie 3 — SLAs et gestion du temps

### 3.1 Définition des SLAs
Règles : "Pour les tickets urgents, première réponse dans 1h, résolution dans 4h". Configurables par priorité, type, client, plan.

### 3.2 Countdown visible
Sur chaque ticket, countdown jusqu'à l'échéance SLA. Couleurs : vert (ok), orange (proche), rouge (dépassé).

### 3.3 Alertes SLA
Notification aux agents/managers quand un SLA approche de l'échéance ou est dépassé.

### 3.4 Business hours
SLAs calculés selon les heures ouvrées de l'équipe (pas pendant la nuit/weekend). Configurables par timezone.

### 3.5 Holidays
Jours fériés exclus du calcul SLA.

### 3.6 Escalation rules
Si un SLA est dépassé, escalation automatique : notification manager, réassignment, upgrade de priorité.

### 3.7 Pause SLA
Possibilité de mettre un SLA en pause ("En attente client" n'incrémente pas le timer).

### 3.8 SLA targets par plan
Clients premium ont des SLAs plus stricts que les gratuits. Logique automatique.

### 3.9 Reporting SLA
Dashboard des SLAs : respect, dépassements, par équipe, par agent, par client.

---

## Catégorie 4 — Knowledge Base (FAQ)

### 4.1 Articles de KB
Structure similaire au module Wiki mais dédiée aux articles de support client. Titre, catégorie, contenu, attachments.

### 4.2 Catégories et sections
Organisation hiérarchique : `Getting Started`, `Features`, `Billing`, `Troubleshooting`. Sous-catégories.

### 4.3 Public vs interne
Articles publics accessibles par les clients, articles internes pour les agents seulement.

### 4.4 Recherche
Recherche full-text dans les articles. Autocomplete avec suggestions.

### 4.5 Articles featured
Mettre en avant les articles les plus utiles sur la page d'accueil de la KB.

### 4.6 Vues et feedback
Track du nombre de vues par article. Bouton "Helpful / Not helpful" pour feedback.

### 4.7 Articles connexes
Sur chaque article, liste des articles similaires (ML-based).

### 4.8 Templates d'article
Structure recommandée : Problem → Solution → Steps → Related articles.

### 4.9 Multi-language
Articles traduits en plusieurs langues. Détection de la langue du visiteur.

### 4.10 Status d'article
Draft, Published, Outdated, Archived. Workflow éditorial.

### 4.11 Suggest article during chat
Quand un agent/bot détecte un sujet dans un chat, suggestion d'un article KB à envoyer au client.

### 4.12 Deflection
Avant d'ouvrir un ticket, le client est invité à chercher dans la KB. Suggestion d'articles basés sur leur question. Réduit le volume de tickets.

### 4.13 Contributions
Les agents peuvent contribuer à la KB : créer/éditer des articles depuis un ticket résolu.

### 4.14 Versioning
Historique des versions d'un article. Restore.

---

## Catégorie 5 — Automations et workflows

### 5.1 Triggers
- Nouveau ticket créé
- Statut changé
- Priorité changée
- SLA approchant
- SLA dépassé
- Tag ajouté
- Client premium
- Champ custom changé
- Nouveau message du client
- Nouveau message de l'agent

### 5.2 Conditions
- Ticket type = X
- Priorité = Y
- Client segment = Z
- Canal = email
- Heure ouvrée / non ouvrée
- Champ custom = Z

### 5.3 Actions
- Assigner à
- Changer statut
- Ajouter un tag
- Changer priorité
- Envoyer un email
- Créer une tâche
- Notifier un groupe
- Appliquer un template
- Webhook sortant

### 5.4 Exemples de workflows
- Nouveau ticket urgent → assigné automatiquement au lead support + Slack notification
- Ticket non traité depuis 1h → escalade au manager
- Ticket résolu → email de satisfaction envoyé automatiquement après 24h
- Mention du mot "bug" → tag "bug" + assigne à l'équipe dev
- Client premium → prioritisation automatique et assignment au support dédié

### 5.5 Business hours routing
En dehors des heures ouvrées, auto-reply "Nous vous répondrons demain matin". Tickets mis en file d'attente.

### 5.6 Round-robin assignment
Distribution automatique des tickets aux agents disponibles à tour de rôle.

### 5.7 Skill-based routing
Assignment basé sur les skills de l'agent (ex: tickets techniques → agents tech).

### 5.8 Load balancing
Distribution basée sur la charge actuelle de chaque agent (ne pas surcharger).

### 5.9 Scheduled workflows
Workflows à déclencher à heure fixe (ex: digest hebdomadaire, cleanup des vieux tickets).

### 5.10 Approval workflows
Pour certains types de tickets (demandes de changement), workflow d'approbation multi-niveaux avant action.

---

## Catégorie 6 — Collaboration équipe

### 6.1 Assignment à une équipe
Plutôt qu'un individu, assigner à une équipe → le premier dispo prend.

### 6.2 Internal @mentions
Mentionner un collègue dans les notes internes. Notification.

### 6.3 Handoff entre agents
Passer un ticket à un autre agent avec contexte (notes internes expliquant où on en est).

### 6.4 Shadowing
Un agent senior peut "shadower" un junior : suit le ticket et peut prendre la main si besoin.

### 6.5 Merge replies
Si deux agents répondent simultanément, détection et warning.

### 6.6 Presence
Savoir qui d'autre est sur le même ticket à l'instant T.

### 6.7 Watch ticket
Suivre un ticket sans en être assignee. Recevoir les notifications.

### 6.8 Chat interne sur un ticket
Discussion privée entre agents sur un ticket (pas visible par le client).

### 6.9 Consultation
Demander l'avis d'un expert (interne ou externe) sur un ticket sans le lui assigner.

### 6.10 Shared queues
Files de tickets partagées entre plusieurs agents. Pick-up à tour de rôle.

---

## Catégorie 7 — Clients et segments

### 7.1 Fiche client
Informations sur le client (issue du CRM ou du module Contacts) : nom, email, entreprise, plan, historique complet de tickets.

### 7.2 Plan / Subscription
Rattachement au plan d'abonnement : Free, Pro, Enterprise. Priorités et SLAs différents.

### 7.3 Segments clients
Grouper les clients (ex: "Beta testers", "Premium", "Strategic accounts") avec des règles spécifiques.

### 7.4 Historique de tickets
Liste de tous les tickets passés et présents du client. Utile pour le contexte.

### 7.5 Customer health score
Score basé sur : nombre de tickets récents, satisfaction, durée de résolution, escalades. Couleur (green, yellow, red).

### 7.6 CSAT / satisfaction
Sondages envoyés après résolution : "Êtes-vous satisfait de cette interaction ?" avec notation 1-5 ou emoji. Suivi global et par agent.

### 7.7 NPS
Net Promoter Score pour mesurer la satisfaction globale. Survey trimestriel.

### 7.8 Customer effort score (CES)
"Combien d'effort vous a demandé la résolution ?" sur 5. Plus bas = meilleur.

### 7.9 Commentaire client post-resolution
Zone de commentaire libre pour que le client s'exprime. Lu par le manager.

### 7.10 Customer notes (internes)
Notes internes sur un client : préférences, historique, points d'attention. Visibles par tous les agents.

---

## Catégorie 8 — Reporting et analytics

### 8.1 Dashboard support
Vue globale avec :
- Volume de tickets (créés, résolus aujourd'hui/cette semaine/ce mois)
- Temps de première réponse (moyen, médian)
- Temps de résolution (moyen, médian)
- SLA compliance rate
- CSAT score
- Backlog (tickets ouverts)
- Agents disponibles
- Distribution par priorité/statut/canal

### 8.2 Rapports standards
- Tickets par canal (évolution)
- Tickets par priorité
- Agents performance (tickets traités, temps de réponse, CSAT)
- Types de tickets les plus fréquents
- Heures de pic d'activité
- Distribution par client
- Trends sur 30/90/365 jours

### 8.3 Custom reports
Builder visuel : sélectionner des métriques, filtres, groupements, chart type.

### 8.4 Agent performance
Dashboard par agent : tickets traités, temps de réponse, CSAT, macros utilisées, SLAs respectés.

### 8.5 Team comparison
Comparaison entre équipes sur les KPIs.

### 8.6 SLA compliance
Rapport détaillé sur le respect des SLAs. Dépassements et causes.

### 8.7 Resolution trends
Évolution du temps moyen de résolution dans le temps. Amélioration ou dégradation ?

### 8.8 Deflection rate
Pourcentage de visiteurs qui ont trouvé leur réponse dans la KB sans ouvrir de ticket.

### 8.9 KB analytics
Articles les plus vus, les plus helpful, les moins helpful. Identification des gaps.

### 8.10 Export CSV / PDF
Exporter n'importe quel rapport.

### 8.11 Scheduled reports
Rapports envoyés par email chaque semaine/mois automatiquement.

### 8.12 Goals
Définir des objectifs (ex: CSAT > 4.5, SLA compliance > 95%). Tracking.

---

## Catégorie 9 — IA intégrée

### 9.1 AI suggested replies
Pour chaque ticket, l'IA propose 2-3 réponses basées sur le contexte et la KB. L'agent peut éditer avant envoi.

### 9.2 AI summary
Résumer un long thread en un paragraphe. Utile pour les handoffs.

### 9.3 Sentiment analysis
Détection du sentiment du client (positif/neutre/négatif). Alerte si tension monte.

### 9.4 Intent classification
Classifier automatiquement le sujet d'un ticket (question, bug, demande de fonctionnalité, facturation) → routing automatique.

### 9.5 Language detection
Détection de la langue du client → assignment aux agents parlant cette langue.

### 9.6 Translation
Traduction automatique des messages clients dans la langue de l'agent (et vice versa). Conversations bilingues fluides.

### 9.7 AI chatbot (Tier 1)
Bot qui gère les questions simples (FAQ, statut de commande) avant d'escalader à un humain. Trained sur la KB.

### 9.8 Ticket similarity
Détection des tickets similaires dans l'historique → proposition de la résolution précédente.

### 9.9 Automatic tagging
L'IA propose des tags basés sur le contenu du ticket.

### 9.10 Priority suggestion
Suggestion automatique de la priorité basée sur le contenu et le client.

### 9.11 KB article suggestion
Pour chaque ticket, suggestion des articles KB pertinents à envoyer au client.

### 9.12 Q&A sur l'historique
"Combien de tickets sur ce bug ?", "Quel agent a le meilleur CSAT ?", "Quels clients ont le plus de tickets en ce moment ?".

### 9.13 Automatic resolution for simple cases
Pour les tickets très simples (ex: réinitialisation de mot de passe), l'IA peut résoudre automatiquement avec un workflow.

### 9.14 Summarize customer history
Avant d'ouvrir un ticket, résumé du client : "Abonné Pro depuis 2 ans, 5 tickets dans les 6 derniers mois, tous résolus rapidement. Satisfaction moyenne 4.8/5."

---

## Catégorie 10 — Intégrations

### 10.1 Mail
Tickets créés depuis les emails reçus sur `support@`. Réponses envoyées comme emails avec threading préservé.

### 10.2 CRM
Fiche client dans le helpdesk est la même que dans le CRM. Historique des deals visible.

### 10.3 Chat
Widget chat du site intégré. Conversations deviennent des tickets.

### 10.4 Knowledge Base
KB intégrée nativement avec les tickets pour suggestions et deflection.

### 10.5 Calendar
Planifier des rendez-vous avec un client depuis le ticket.

### 10.6 Meet
Lancer une visio avec le client depuis le ticket pour résolution live.

### 10.7 Drive
Attacher des fichiers du drive, partager avec le client via le ticket.

### 10.8 Tasks
Créer des tâches depuis un ticket (pour des follow-ups ou des bugs à transmettre à l'équipe produit).

### 10.9 Forms
Formulaires web qui créent directement des tickets.

### 10.10 Mobile app
App mobile pour les agents : consulter, répondre, assigner en mobilité.

### 10.11 Webhooks
Webhooks sortants à chaque event : ticket créé, résolu, escaladé, etc.

### 10.12 API
API REST complète pour intégrations custom.

### 10.13 Slack / Teams
Notifications dans les channels. Créer des tickets depuis Slack.

### 10.14 Jira / Linear
Escalader un ticket vers un issue technique. Lien bidirectionnel.

### 10.15 Status page
Intégration avec une status page publique (ex: Statuspage, custom). Incidents majeurs visibles par les clients.

### 10.16 Monitoring
Alertes de monitoring (Datadog, PagerDuty) créent automatiquement des tickets.

---

## Catégorie 11 — Self-service portal

### 11.1 Page d'accueil
Page dédiée aux clients avec : search box, articles featured, catégories, bouton "Créer un ticket", lien vers "Mes tickets".

### 11.2 Recherche avant ouverture de ticket
Quand un utilisateur commence à taper sa question, suggestion d'articles KB et de tickets similaires déjà résolus.

### 11.3 Mes tickets
Liste de tous les tickets ouverts et passés par le client. Consultation de leur historique.

### 11.4 Création de ticket
Formulaire guidé : type de problème, description, attachments, priorité. Validation et confirmation.

### 11.5 Thread de réponses
Le client peut voir toutes les réponses de l'agent et répondre directement sur le portal.

### 11.6 Marquer comme résolu
Le client peut confirmer la résolution ou rouvrir si le problème persiste.

### 11.7 Satisfaction rating
Après résolution, sondage de satisfaction intégré.

### 11.8 Knowledge base publique
Accessible sans login. Custom domain possible.

### 11.9 Community forum (optionnel)
Forum où les clients s'entraident. Modéré par le support.

### 11.10 Custom branding
Logo, couleurs, domaine custom. Look cohérent avec le reste du site du client.

---

## Catégorie 12 — Mobile et accessibilité

### 12.1 Application mobile native
Agents peuvent traiter des tickets depuis mobile. Push notifications.

### 12.2 Quick actions mobile
Actions rapides par swipe : assigner, résoudre, marquer urgent.

### 12.3 Voice-to-text
Dicter des réponses ou des notes internes.

### 12.4 Offline mode
Consultation et rédaction hors-ligne. Envoi au retour.

### 12.5 Keyboard shortcuts
- `c` : nouveau ticket
- `a` : assigner
- `r` : reply
- `i` : internal note
- `s` : resolve
- `/` : search
- `?` : aide

### 12.6 Accessibilité WCAG AA
Screen reader, clavier, contrastes, focus.

---

## Sources d'inspiration

### Aides utilisateur publiques
- **Zendesk Help Center** (support.zendesk.com) — omnichannel, workflows, Guide.
- **Intercom Help** (intercom.com/help) — messenger, bots, articles, product tours.
- **Freshdesk Support** (support.freshdesk.com) — multi-channel, SLAs, portal.
- **Help Scout Docs** (docs.helpscout.com) — shared inbox, docs, beacon.
- **Front Help Center** (help.front.com) — collaborative inbox, rules.
- **HubSpot Service Hub** (knowledge.hubspot.com/service-hub) — tickets, KB, surveys.
- **Jira Service Management** (support.atlassian.com/jira-service-management-cloud) — ITSM, ITIL, incidents.
- **Chatwoot Docs** (chatwoot.com/docs) — open source multi-channel.
- **ITIL Foundation** (axelos.com/itil) — best practices ITSM.

### Projets open source permissifs
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL**

| Projet | Licence | Ce qu'on peut étudier |
|---|---|---|
| **Chatwoot** (chatwoot.com) | **MIT** | Alternative open source à Intercom. Multi-channel. **À étudier en profondeur**. |
| **Zammad** (zammad.org) | **AGPL v3** | **INTERDIT**. Alternative OTRS. |
| **OsTicket** (osticket.com) | **GPL v2** | **INTERDIT**. |
| **FreeScout** (freescout.net) | **AGPL v3** | **INTERDIT**. Help Scout clone. |
| **UVdesk** (uvdesk.com) | **MIT** | Helpdesk multi-channel. Framework Symfony. **À étudier**. |
| **Faveo Helpdesk** (faveohelpdesk.com) | **OSL v3** | **Attention licence non-standard**. |
| **Liberate Desk** | Various | Simple helpdesk. |
| **Kayako API** (kayako.com) | API propriétaire | Pattern de l'API. |
| **Nylas** | Apache-2.0 (community) | Email sync for helpdesk. |
| **JMAP** (jmap.io) | RFC / Apache | Protocole email moderne. |

### Pattern d'implémentation recommandé
1. **Schéma** : signapps-db avec tables `tickets`, `messages`, `agents`, `customers`, `knowledge_articles`, `sla_policies`, `workflows`.
2. **Email sync** : JMAP ou IMAP pour recevoir, SMTP pour envoyer. Déjà couvert par le module Mail de SignApps.
3. **Widget chat** : composant JS embeddable sur le site client. WebSocket vers le backend.
4. **Workflow engine** : triggers + conditions + actions, similar au module Workflows.
5. **Knowledge base** : module Wiki réutilisé avec flag "public" et customisation du layout.
6. **Rich text** : Tiptap (MIT) pour la cohérence.
7. **IA** : LLM interne avec RAG sur la KB et l'historique de tickets.
8. **Analytics** : queries custom avec Chart.js ou ECharts.
9. **SLA calculator** : library custom avec business hours et holidays.
10. **Real-time** : WebSocket pour les updates en direct sur les tickets.

### Ce qu'il ne faut PAS faire
- **Pas de fork** de Zammad, osTicket, FreeScout (AGPL/GPL).
- **Attention** à UVdesk (MIT mais Symfony-heavy, complexe à intégrer).

---

## Assertions E2E clés (à tester)

- Création d'un ticket depuis email
- Création d'un ticket depuis formulaire
- Création d'un ticket depuis chat widget
- Inbox unifiée avec filtres
- Assignation à un agent
- Changement de statut
- Reply à un ticket (email envoyé au client)
- Internal note (@mention collègue)
- Macro insérée
- SLA countdown visible
- Escalation automatique sur SLA dépassé
- Merge de deux tickets
- Ticket linking
- KB article créé et publié
- Recherche dans la KB
- Article suggéré au client pendant création ticket
- Workflow automation déclenché
- Assignment round-robin
- CSAT survey envoyé après résolution
- Dashboard avec KPIs
- Filtre par priorité/statut/canal
- Portal self-service : client voit ses tickets
- Custom domain pour portal
- Mobile : agent répond à un ticket
- AI : suggestion de réponse
- AI : classification automatique
- Translation automatique
- Intégration CRM : fiche client visible
- Multi-language support
- Offline mode pour agents
