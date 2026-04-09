# Module Notifications — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **OneSignal** | Push multi-plateforme (web, iOS, Android, email, SMS, in-app), segmentation avancée, journeys (automations séquentielles), A/B testing, analytics temps réel, templates, in-app messages riches, frequency capping, intelligent delivery (envoi au moment optimal) |
| **Novu** | Open source (MIT), notification infrastructure as code, multi-channel orchestration (in-app, email, SMS, push, chat), digest/batching, subscriber preferences API, content management, workflows visuels, self-hostable |
| **Knock** | API-first, feeds in-app, cross-channel orchestration, batch notifications, preferences per-topic, schedules, conditions, workflows, SDK React/JS, real-time WebSocket feed |
| **Courier** | Multi-provider routing (Twilio, SendGrid, FCM, APNs, Slack), template designer, automation rules, audience management, brand management, delivery intelligence |
| **Pushwoosh** | Push notifications multi-plateforme, in-app messaging, customer journey builder, segmentation RFM, geo-targeting, A/B testing, deep linking |
| **Firebase Cloud Messaging (FCM)** | Push gratuit et fiable, topic messaging, condition targeting, analytics intégré, upstream messaging, data-only messages, background/foreground handling |
| **Slack notifications** | Threading, reactions, mentions (@user, @channel, @here), DND schedule, notification preferences per-channel, keyword highlights, badge counts, snooze |
| **GitHub notifications** | Inbox triable, filtres par raison (review requested, assigned, mention, subscribed), mark as done, save for later, grouping by repo, notification settings par repo |
| **Linear notifications** | Inbox minimaliste, grouping par projet, snooze, archivage, inbox zero workflow, notifications contextuelles (changement de statut, commentaire, assignation) |
| **Notion notifications** | Inbox avec updates groupées par page, mentions, commentaires, property changes, page follows, settings granulaires par workspace |

## Principes directeurs

1. **Inbox zero atteignable** — l'utilisateur doit pouvoir traiter toutes ses notifications en quelques minutes grâce au tri, au groupement et aux actions rapides. Pas de bruit, pas de spam interne.
2. **Multi-canal orchestré** — une même notification peut être délivrée par plusieurs canaux (in-app, push navigateur, email digest, mobile) selon les préférences de l'utilisateur et la priorité.
3. **Respect du focus** — heures silencieuses, mode Ne Pas Déranger, snooze et frequency capping empêchent la surcharge cognitive. Les notifications non-urgentes attendent.
4. **Granularité totale** — l'utilisateur contrôle chaque type de notification, par module, par projet, par canal. Aucune notification ne devrait être subie.
5. **Contextuel et actionnable** — chaque notification contient assez de contexte pour comprendre sans cliquer, et des actions rapides pour traiter sans naviguer (marquer comme lu, archiver, répondre, approuver).
6. **Temps réel fiable** — les notifications in-app arrivent en <1 seconde via WebSocket. Les push arrivent en <5 secondes. Les emails digest sont envoyés à l'heure configurée.

---

## Catégorie 1 — Centre de notifications (Inbox)

### 1.1 Liste des notifications
Page `/notifications` affichant toutes les notifications de l'utilisateur dans un flux chronologique inversé (les plus récentes en haut). Chaque notification affiche : icône type, titre, corps (preview), source (module), priorité, timestamp relatif ("Il y a 5 min"), indicateur lu/non lu.

### 1.2 Onglets de filtrage
Tabs en haut de la liste : `Toutes` (avec compteur total), `Non lues` (avec badge compteur). Onglets dynamiques par service détecté (Mail, Calendar, CRM, Tasks, Docs, Drive, HR, Billing) qui n'apparaissent que si des notifications de ce service existent.

### 1.3 Groupement par date
Les notifications sont regroupées sous des en-têtes : `Aujourd'hui`, `Hier`, `Cette semaine`, `Plus ancien`. Chaque groupe est pliable/dépliable.

### 1.4 Marquer comme lu
Clic sur le point bleu à droite d'une notification pour la marquer comme lue (changement visuel instantané : fond passe de accent à background, titre passe en opacité réduite). Optimistic update avec rollback en cas d'erreur.

### 1.5 Marquer tout comme lu
Bouton `Tout marquer comme lu` dans le header. Confirmation par toast. Affecte toutes les notifications de l'onglet actif (pas seulement celles visibles).

### 1.6 Supprimer les anciennes
Bouton `Supprimer les anciennes` qui retire les notifications du groupe "Plus ancien". Confirmation modale pour les suppressions bulk (>10 éléments).

### 1.7 Recherche dans les notifications
Barre de recherche en haut de la page pour filtrer par texte (titre, corps, source). Recherche instantanée côté client sur les notifications chargées, avec fallback côté serveur pour l'historique complet.

### 1.8 Filtres avancés
Panneau de filtres (dropdown ou sidebar) : filtrer par type (info, warning, alert, success), par priorité (haute, moyenne, basse), par source/module, par plage de dates. Combinaison de filtres possible.

### 1.9 Tri
Options de tri : par date (défaut), par priorité (haute d'abord), par source. Persistance de la préférence de tri.

### 1.10 Actions contextuelles sur une notification
Menu contextuel (clic droit ou bouton "...") sur chaque notification :
- Marquer comme lu / non lu
- Archiver (retire de l'inbox sans supprimer)
- Snooze (réapparaît dans 1h, 3h, demain, lundi prochain, date custom)
- Ouvrir dans le module source (navigation directe)
- Désactiver ce type de notification (raccourci vers les préférences)

### 1.11 Notification détaillée
Clic sur une notification ouvre un panneau latéral ou navigue vers l'élément source (selon la configuration). Le panneau latéral affiche le contenu complet, les métadonnées, l'historique d'actions associées, et des boutons d'action contextuel.

### 1.12 Pagination et infinite scroll
Les 100 premières notifications sont chargées initialement. Scroll vers le bas déclenche le chargement des suivantes (infinite scroll). Indicateur de chargement. Total des notifications affiché.

---

## Catégorie 2 — Popover et badge (notification rapide)

### 2.1 Badge de notification dans la navbar
Icône cloche dans la barre de navigation principale avec badge rouge indiquant le nombre de notifications non lues. Badge caché si 0. Badge "99+" si >99.

### 2.2 Popover au clic sur la cloche
Clic sur l'icône cloche ouvre un popover (300px de large) avec les 10 dernières notifications. Chaque item est cliquable (navigue vers la source). Bouton "Voir tout" en bas qui navigue vers `/notifications`.

### 2.3 Preview compacte dans le popover
Chaque notification dans le popover affiche : icône colorée (type), titre (1 ligne, tronqué), timestamp relatif, point bleu si non lu. Pas de corps pour garder le popover compact.

### 2.4 Actions rapides dans le popover
Au survol d'une notification dans le popover : bouton pour marquer comme lu et bouton pour archiver. Raccourci au maximum 2 actions pour ne pas encombrer.

### 2.5 Mise à jour temps réel du badge
Le compteur du badge se met à jour en temps réel via WebSocket. Quand une nouvelle notification arrive, le badge incrémente sans rechargement de page.

### 2.6 Animation de nouvelle notification
Quand une nouvelle notification arrive, l'icône cloche fait une micro-animation (shake ou bounce) pour attirer l'attention sans être intrusive.

### 2.7 Toast de notification
Les notifications de priorité haute affichent aussi un toast en bas à droite de l'écran (composant Sonner) avec titre, corps court et bouton d'action. Auto-dismiss après 5 secondes (configurable). Clic sur le toast navigue vers la source.

### 2.8 Stacking des toasts
Si plusieurs notifications arrivent simultanément, les toasts se stackent (max 3 visibles, les suivants en queue). Chaque toast a son propre timer de dismiss.

---

## Catégorie 3 — Push notifications (navigateur et mobile)

### 3.1 Demande de permission push
Au premier login (ou quand l'utilisateur active les push dans les préférences), un dialogue natif du navigateur demande la permission. Explication préalable dans une modale SignApps expliquant pourquoi les push sont utiles.

### 3.2 Inscription au service push
Après acceptation, le navigateur génère un PushSubscription (endpoint + clés) qui est envoyé au backend. Le backend stocke la subscription par utilisateur et par device.

### 3.3 Envoi de push notification
Le backend envoie les push via le protocole Web Push (RFC 8030) avec les clés VAPID. Le navigateur affiche la notification même si SignApps n'est pas ouvert.

### 3.4 Contenu de la push
Chaque push contient : titre, corps (preview tronquée), icône (logo SignApps ou icône du module source), badge (compteur non lu), action click (URL vers l'élément source), tag (pour regrouper/remplacer les notifications du même type).

### 3.5 Actions dans la push
Les push notifications peuvent inclure jusqu'à 2 boutons d'action (ex: "Voir" et "Marquer comme lu" ou "Approuver" et "Rejeter"). Les actions sont traitées par le service worker.

### 3.6 Remplacement de push (tag-based)
Si une nouvelle notification du même type arrive (ex: 3e commentaire sur le même document), la push précédente est remplacée (pas empilée) grâce au tag. Le corps est mis à jour ("Jean et 2 autres ont commenté...").

### 3.7 Multi-device
Un utilisateur peut avoir plusieurs subscriptions push (laptop, smartphone, tablette). Chaque device reçoit la push. Si la notification est lue sur un device, les autres devices la marquent aussi comme lue (sync via WebSocket).

### 3.8 Push silencieuse
Option pour les notifications de basse priorité : push silencieuse (pas de son, pas de vibration) qui apparaît dans le centre de notifications du système sans interrompre.

### 3.9 Service Worker
Le service worker gère : réception des push en arrière-plan, affichage de la notification, gestion des clics sur les actions, mise en cache des données de notification, badge update.

### 3.10 Fallback email
Si le push échoue (subscription expirée, navigateur fermé depuis longtemps), la notification est envoyée par email après un délai configurable (15 min par défaut). Pas de double notification si le push a réussi.

---

## Catégorie 4 — Email digest et canaux alternatifs

### 4.1 Digest quotidien
Email récapitulatif envoyé à l'heure configurée (défaut 8h00) avec toutes les notifications non lues de la veille. Format : section par module, liste des notifications avec lien direct. Désactivable.

### 4.2 Digest hebdomadaire
Email récapitulatif envoyé le lundi matin avec les statistiques de la semaine : nombre de notifications par type, notifications non traitées, action items en attente.

### 4.3 Notifications critiques par email immédiat
Certaines notifications sont envoyées par email immédiatement (pas en digest) : mention directe, assignation, approbation requise, alerte sécurité. Configurable par type.

### 4.4 Format email responsive
Les emails de notification utilisent un template HTML responsive avec le branding SignApps. Affichage correct sur desktop et mobile. Boutons d'action dans l'email (qui redirigent vers la plateforme).

### 4.5 Unsubscribe conforme
Chaque email contient un lien "Se désabonner" conforme CAN-SPAM et RGPD. Le lien mène aux préférences de notification de l'utilisateur. Header `List-Unsubscribe` présent.

### 4.6 Webhook de notification
Endpoint webhook configurable par l'admin : chaque notification est aussi envoyée en POST JSON vers une URL externe. Utile pour l'intégration avec des outils tiers (Slack, Teams, PagerDuty).

### 4.7 Notification via Chat
Les notifications peuvent être envoyées dans un canal Chat dédié ("bot notifications") en plus des autres canaux. L'utilisateur peut répondre dans le chat pour interagir.

### 4.8 Intégration mobile (PWA)
En mode PWA, les push notifications utilisent l'API native du système mobile. Badge sur l'icône de l'app. Vibration configurable.

---

## Catégorie 5 — Préférences et personnalisation

### 5.1 Préférences globales de canal
Page `/notifications/preferences` avec toggles pour activer/désactiver chaque canal :
- Notifications in-app (toujours actif, non désactivable)
- Notifications push navigateur
- Notifications par email
Chaque canal est indépendant.

### 5.2 Heures silencieuses (Do Not Disturb)
Configurer une plage horaire pendant laquelle aucune notification push ou email n'est envoyée (ex: 22h00 - 07h00). Les notifications sont mises en queue et délivrées à la fin de la période silencieuse.

### 5.3 Mode DND manuel
Bouton "Ne pas déranger" activable manuellement dans la navbar. Durée : 1h, 2h, 4h, jusqu'à demain, personnalisé. Badge DND visible sur l'icône cloche. Seules les notifications "urgentes" passent.

### 5.4 Préférences par service
Toggle par service (Mail, Calendar, CRM, Tasks, Docs, Drive, HR, Billing, Chat, Meet, etc.) pour activer/désactiver les notifications de chaque module. Désactiver un service bloque tous ses types de notifications.

### 5.5 Préférences granulaires par type d'événement
Pour chaque service, liste des types d'événements avec toggle individuel :
- **Mail** : nouveau message, réponse à un thread, mention
- **Calendar** : rappel d'événement, invitation, modification, annulation
- **Tasks** : assignation, changement de statut, deadline approchante, commentaire
- **Docs** : mention, commentaire, suggestion, partage
- **CRM** : nouveau lead, deal changé de phase, tâche CRM due
- **HR** : demande de congé, approbation, rappel d'entretien
- **Chat** : message direct, mention dans un channel, réaction

### 5.6 Préférences par projet/espace
Au-delà du service, l'utilisateur peut ajuster les notifications par projet Tasks, par channel Chat, par dossier Drive. Ex: "Muter les notifications du projet X" ou "Notifications urgentes seulement pour le channel #general".

### 5.7 Snooze récurrent
Configurer un snooze récurrent : toutes les notifications d'un type donné sont snooze pendant les weekends, ou pendant les vacances. Lié au statut de l'utilisateur (absent, en congé).

### 5.8 Niveau de priorité par canal
Configurer le seuil de priorité par canal : "Push uniquement pour priorité haute", "Email pour haute et moyenne", "In-app pour tout". Matrice canal x priorité.

### 5.9 Sons personnalisés
Choisir un son de notification par type (nouveau message, mention, alerte). Bibliothèque de sons pré-définis. Upload de sons custom (max 5s, WAV/MP3). Préview avant de sauvegarder.

### 5.10 Sauvegarde des préférences
Les préférences sont stockées côté serveur (table `notification_preferences`) et synchronisées entre devices. Modification depuis n'importe quel device, effet immédiat sur tous.

---

## Catégorie 6 — Groupement, batching et intelligence

### 6.1 Groupement par source
Les notifications du même module et du même objet sont groupées : "3 commentaires sur le document Budget Q2" au lieu de 3 notifications séparées. Expansion pour voir le détail.

### 6.2 Digest en temps réel (batching)
Si plusieurs notifications arrivent en rafale (ex: 5 likes en 10 secondes), elles sont agrégées en une seule notification après un délai de 30 secondes : "Jean, Marie et 3 autres ont réagi à votre message".

### 6.3 Fréquence capping
Limite le nombre maximum de notifications par heure pour un même type. Ex: pas plus de 5 notifications de commentaire par heure. Les suivantes sont groupées dans un digest.

### 6.4 Intelligent delivery
Le système apprend le comportement de l'utilisateur (quand il ouvre la plateforme, quand il traite ses notifications) et ajuste l'heure d'envoi des digests et des push non-urgentes pour maximiser le taux de lecture.

### 6.5 Désabonnement intelligent
Si un utilisateur ignore systématiquement un type de notification (10 non lues consécutives), le système suggère : "Vous ne lisez jamais les notifications de [type]. Voulez-vous les désactiver ?"

### 6.6 Priorité dynamique
Le backend peut ajuster la priorité d'une notification en fonction du contexte : une deadline de tâche à J-1 passe de "medium" à "high". Une mention dans un thread actif passe de "low" à "medium".

### 6.7 Déduplication
Si la même notification est générée deux fois (race condition, retry), le système détecte le doublon et ne l'affiche qu'une fois. Basé sur un hash (type + source + object_id + window temporelle).

### 6.8 Notification de résumé quotidien
En plus du digest email, une notification in-app le matin : "Vous avez 12 notifications non lues dont 3 de priorité haute". Clic pour ouvrir l'inbox filtré sur les non lues.

---

## Catégorie 7 — Administration et monitoring

### 7.1 Dashboard admin des notifications
Page admin affichant les métriques : nombre de notifications envoyées par jour/semaine, par canal, par service. Taux de lecture. Taux de clic. Temps moyen avant lecture.

### 7.2 Création de notifications admin
L'admin peut créer une notification broadcast à tous les utilisateurs ou à un groupe : annonce de maintenance, mise à jour de fonctionnalité, message important. Canaux : in-app + push + email.

### 7.3 Templates de notifications
Bibliothèque de templates pour les notifications système. Chaque template définit : titre (avec variables `{{user_name}}`, `{{object_title}}`), corps, icône, priorité, canaux de diffusion. Éditable par l'admin.

### 7.4 Politique de rétention
L'admin configure la durée de rétention des notifications en base : 30 jours, 90 jours, 1 an, illimité. Les notifications expirées sont purgées automatiquement. Les notifications archivées suivent une rétention séparée.

### 7.5 Rate limiting
Protection contre le spam de notifications : limite le nombre de notifications qu'un service peut créer par minute (configurable). Les notifications au-delà de la limite sont mises en queue ou rejetées.

### 7.6 Health check des canaux
Monitoring de la santé de chaque canal : push subscriptions actives vs expirées, emails bounced, WebSocket connections actives. Alertes si un canal tombe en dessous d'un seuil.

### 7.7 Audit log
Log de toutes les notifications envoyées avec : destinataire, canal, timestamp d'envoi, timestamp de lecture, actions effectuées. Exportable pour conformité.

### 7.8 Notification de test
Bouton dans l'admin pour envoyer une notification de test à soi-même sur tous les canaux configurés. Vérifie que push, email et in-app fonctionnent.

### 7.9 Suppression bulk
L'admin peut supprimer toutes les notifications d'un type, d'une source, ou d'une période. Utile après un bug qui a généré des notifications parasites.

### 7.10 Configuration VAPID
Page admin pour configurer les clés VAPID (Voluntary Application Server Identification) nécessaires au Web Push. Génération automatique des clés ou import de clés existantes.

---

## Catégorie 8 — Sécurité, conformité et architecture

### 8.1 Chiffrement en transit
Toutes les notifications transitent via HTTPS (REST) et WSS (WebSocket). Les push notifications sont chiffrées de bout en bout via le protocole Web Push (RFC 8291).

### 8.2 Pas de données sensibles dans les push
Les push notifications ne contiennent jamais de données sensibles en clair (mot de passe, solde, données médicales). Seul un titre générique est envoyé, le détail est visible uniquement dans l'app après authentification.

### 8.3 Authentification requise
Toutes les routes de l'API notifications nécessitent un JWT valide. Les notifications sont filtrées par `user_id` du token. Un utilisateur ne peut jamais voir les notifications d'un autre.

### 8.4 PgEventBus pour les événements inter-services
Les services émettent des `PlatformEvent` via le PgEventBus (PostgreSQL LISTEN/NOTIFY). Le service notifications écoute ces événements et génère les notifications appropriées. Aucun appel HTTP direct entre services.

### 8.5 Idempotence
Chaque notification a un ID unique (UUID v4). La création est idempotente : un retry avec le même ID ne crée pas de doublon.

### 8.6 RGPD et export des données
L'utilisateur peut exporter toutes ses notifications (historique complet) au format JSON. Inclus dans la fonctionnalité "Exporter mes données" du module Admin. Suppression possible dans le cadre du droit à l'oubli.

### 8.7 Scalabilité
Le service notifications est stateless et horizontalement scalable. Les WebSocket connections sont gérées par un load balancer sticky-session ou un broker pub/sub (PostgreSQL LISTEN/NOTIFY). Cible : 10 000 notifications/seconde.

### 8.8 Retry et dead letter
Si l'envoi d'une notification échoue (push expired, email bounce), le système retry 3 fois avec backoff exponentiel. Après 3 échecs, la notification est placée dans une dead letter queue pour inspection admin.

### 8.9 Métriques Prometheus
Le service expose des métriques : `notifications_sent_total` (par canal, par type), `notifications_read_total`, `notifications_latency_seconds`, `push_subscriptions_active`, `websocket_connections_active`. Scrappable par le module Metrics.

### 8.10 API REST documentée
Endpoints documentés via OpenAPI (Swagger UI sur `/swagger-ui/`) :
- `GET /api/notifications` — liste des notifications (avec filtres)
- `POST /api/notifications` — créer une notification (inter-service)
- `PATCH /api/notifications/:id/read` — marquer comme lu
- `POST /api/notifications/read-all` — marquer toutes comme lues
- `DELETE /api/notifications/:id` — supprimer une notification
- `GET /api/notifications/preferences` — préférences utilisateur
- `PATCH /api/notifications/preferences` — mettre à jour les préférences
- `GET /api/notifications/count` — compteur de non lues
- `WS /api/notifications/ws` — flux temps réel WebSocket

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **Novu Documentation** (docs.novu.co) — architecture notification infrastructure, workflows, digest, préférences subscribers, self-hosting guide.
- **Knock Documentation** (docs.knock.app) — patterns de notification feeds, batching, preferences API, SDK React, workflows.
- **OneSignal Documentation** (documentation.onesignal.com) — Web Push setup, segmentation, journeys, in-app messaging, frequency capping.
- **Firebase Cloud Messaging Docs** (firebase.google.com/docs/cloud-messaging) — Web Push protocol, service worker setup, topic messaging, analytics.
- **Web Push Protocol RFC 8030** (tools.ietf.org/html/rfc8030) — spécification du protocole HTTP/2 push pour les notifications web.
- **VAPID RFC 8292** (tools.ietf.org/html/rfc8292) — authentification du serveur d'application pour Web Push.
- **Notification API MDN** (developer.mozilla.org/en-US/docs/Web/API/Notification) — API standard W3C pour les notifications navigateur.
- **GitHub Notifications Docs** (docs.github.com/en/account-and-profile/managing-subscriptions-and-notifications) — patterns d'inbox, filtrage et gestion des notifications.
