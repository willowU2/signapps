# Module Notifications — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **OneSignal** | Push multi-plateforme (web, iOS, Android, email, SMS, in-app), segmentation avancee, journeys (automations sequentielles), A/B testing, analytics temps reel, templates, in-app messages riches, frequency capping, intelligent delivery (envoi au moment optimal) |
| **Novu** | Open source (MIT), notification infrastructure as code, multi-channel orchestration (in-app, email, SMS, push, chat), digest/batching, subscriber preferences API, content management, workflows visuels, self-hostable |
| **Knock** | API-first, feeds in-app, cross-channel orchestration, batch notifications, preferences per-topic, schedules, conditions, workflows, SDK React/JS, real-time WebSocket feed |
| **Courier** | Multi-provider routing (Twilio, SendGrid, FCM, APNs, Slack), template designer, automation rules, audience management, brand management, delivery intelligence |
| **Pushwoosh** | Push notifications multi-plateforme, in-app messaging, customer journey builder, segmentation RFM, geo-targeting, A/B testing, deep linking |
| **Firebase Cloud Messaging (FCM)** | Push gratuit et fiable, topic messaging, condition targeting, analytics integre, upstream messaging, data-only messages, background/foreground handling |
| **Slack notifications** | Threading, reactions, mentions (@user, @channel, @here), DND schedule, notification preferences per-channel, keyword highlights, badge counts, snooze |
| **GitHub notifications** | Inbox triable, filtres par raison (review requested, assigned, mention, subscribed), mark as done, save for later, grouping by repo, notification settings par repo |
| **Linear notifications** | Inbox minimaliste, grouping par projet, snooze, archivage, inbox zero workflow, notifications contextuelles (changement de statut, commentaire, assignation) |
| **Notion notifications** | Inbox avec updates groupees par page, mentions, commentaires, property changes, page follows, settings granulaires par workspace |

## Principes directeurs

1. **Inbox zero atteignable** — l'utilisateur doit pouvoir traiter toutes ses notifications en quelques minutes grace au tri, au groupement et aux actions rapides. Pas de bruit, pas de spam interne.
2. **Multi-canal orchestre** — une meme notification peut etre delivree par plusieurs canaux (in-app, push navigateur, email digest, mobile) selon les preferences de l'utilisateur et la priorite.
3. **Respect du focus** — heures silencieuses, mode Ne Pas Deranger, snooze et frequency capping empechent la surcharge cognitive. Les notifications non-urgentes attendent.
4. **Granularite totale** — l'utilisateur controle chaque type de notification, par module, par projet, par canal. Aucune notification ne devrait etre subie.
5. **Contextuel et actionnable** — chaque notification contient assez de contexte pour comprendre sans cliquer, et des actions rapides pour traiter sans naviguer (marquer comme lu, archiver, repondre, approuver).
6. **Temps reel fiable** — les notifications in-app arrivent en <1 seconde via WebSocket. Les push arrivent en <5 secondes. Les emails digest sont envoyes a l'heure configuree.

---

## Categorie 1 — Centre de notifications (Inbox)

### 1.1 Liste des notifications
Page `/notifications` affichant toutes les notifications de l'utilisateur dans un flux chronologique inverse (les plus recentes en haut). Chaque notification affiche : icone type (cercle colore avec icone du module source — mail bleu, calendar vert, tasks orange, docs violet, chat cyan, drive gris, hr rose, billing jaune), titre (texte principal, 1 ligne, bold si non lu), corps (preview 2 lignes max, opacite 70%), source (badge module), priorite (barre laterale coloree : rouge haute, orange moyenne, invisible basse), timestamp relatif ("Il y a 5 min", tooltip avec date/heure exacte), indicateur lu/non lu (point bleu 8px a gauche). Fond de la notification : `bg-muted` si non lu, `bg-card` si lu. Transition de couleur 200ms au changement de statut. Clic sur la notification navigue vers la deep link (element source). API : `GET /api/notifications?page=1&per_page=50&status=all&type=all&service=all`.

### 1.2 Onglets de filtrage
Tabs en haut de la liste : **Toutes** (avec compteur total entre parentheses), **Non lues** (avec badge compteur rouge). Onglets dynamiques par service detecte : Mail, Calendar, Tasks, Docs, Drive, Chat, HR, Billing, Social, Meet, Forms — chaque onglet n'apparait que si des notifications de ce service existent. Compteur par onglet. Le tab actif est souligne en bleu. Clic sur un onglet filtre instantanement (pas de rechargement page). Le filtre est reflete dans l'URL : `/notifications?tab=tasks`. Raccourci clavier : `1` pour Toutes, `2` pour Non lues, `3-9` pour les onglets de service.

### 1.3 Groupement par date
Les notifications sont regroupees sous des en-tetes : **Aujourd'hui**, **Hier**, **Cette semaine** (lundi-dimanche courant), **La semaine derniere**, **Ce mois**, **Plus ancien**. Chaque groupe est pliable/depliable par clic sur l'en-tete (icone chevron). Etat persiste dans localStorage. Compteur de non lues par groupe affiche a cote du titre du groupe. L'en-tete affiche egalement un bouton "Marquer ce groupe comme lu" au survol.

### 1.4 Marquer comme lu
Clic sur le point bleu a droite d'une notification pour la marquer comme lue. Changement visuel instantane (optimistic update) : fond passe de `bg-muted` a `bg-card`, titre passe de bold a normal, point bleu disparait avec animation fade-out 200ms. Si l'API echoue, rollback visuel avec toast d'erreur "Impossible de marquer comme lu, reessayez". Un second clic sur la zone du point (maintenant invisible) remarque comme non lu (toggle). API : `PATCH /api/notifications/:id/read` avec body `{is_read: true}`. Le compteur du badge dans la navbar se decremente immediatement.

### 1.5 Marquer tout comme lu
Bouton "Tout marquer comme lu" dans le header de la page (icone double-check + texte). Confirmation par toast Sonner "42 notifications marquees comme lues" avec bouton "Annuler" (undo pendant 5 secondes). Affecte toutes les notifications de l'onglet actif (pas seulement celles visibles a l'ecran). En mode filtre "Non lues", la liste se vide apres l'action (avec message "Vous etes a jour !" et illustration). API : `POST /api/notifications/read-all` avec body optionnel `{service: "mail"}` pour filtrer par service.

### 1.6 Supprimer les anciennes
Bouton "Nettoyer" (icone balai) dans le header. Dropdown avec options : "Supprimer les plus de 7 jours", "Supprimer les plus de 30 jours", "Supprimer toutes les lues". Confirmation modale pour les suppressions bulk (>10 elements) : "Supprimer 87 notifications lues ? Cette action est irreversible." Bouton "Supprimer" rouge et "Annuler" gris. Barre de progression si >100 notifications a supprimer. API : `DELETE /api/notifications/bulk?older_than=30d` ou `DELETE /api/notifications/bulk?status=read`.

### 1.7 Recherche dans les notifications
Barre de recherche en haut de la page (icone loupe + champ texte, placeholder "Rechercher dans les notifications..."). Recherche instantanee cote client sur les notifications chargees (filtre en <100ms). Si l'utilisateur tape plus de 3 caracteres et que les resultats locaux sont insuffisants, requete cote serveur pour l'historique complet. Les termes recherches sont surliges en jaune dans les resultats. Raccourci clavier : `/` pour focus le champ de recherche. API : `GET /api/notifications/search?q=budget`.

### 1.8 Filtres avances
Panneau de filtres (sidebar repliable a gauche ou dropdown) avec : type de notification (dropdown multi-select : system, mention, assignment, reminder, approval, share, comment, reaction), priorite (checkboxes : haute, moyenne, basse), source/module (memes que les onglets), plage de dates (date picker from/to). Combinaison de filtres avec AND. Bouton "Reinitialiser les filtres". Compteur de resultats. Les filtres actifs sont affiches en chips sous la barre de recherche (supprimables par clic sur X). Les filtres sont persistants dans l'URL query params.

### 1.9 Tri
Options de tri accessibles via dropdown "Trier par" : date decroissante (defaut), date croissante, priorite (haute d'abord), source/module (groupe alphabetique). La preference de tri est persistee dans les preferences utilisateur (localStorage + serveur). Icone de tri dans le header change selon l'option active.

### 1.10 Actions contextuelles sur une notification
Menu contextuel (clic droit ou bouton "..." au survol a droite) sur chaque notification :
- **Marquer comme lu / non lu** — toggle du statut
- **Archiver** — retire de l'inbox sans supprimer (deplacee vers l'onglet "Archive" accessible via un lien en bas de page)
- **Snooze** — sous-menu : "Dans 1h", "Dans 3h", "Demain matin (9h)", "Lundi prochain (9h)", "Date personnalisee..." (date+time picker). La notification disparait de l'inbox et reapparait a l'heure choisie avec un badge "Snoozee" et un indicateur de l'heure originale.
- **Ouvrir dans le module source** — navigation directe vers l'element concerne (deep link)
- **Desactiver ce type** — raccourci vers la page de preferences avec le type pre-selectionne et un toggle highlight
Raccourcis clavier sur la notification selectionnee : `R` marquer lu, `A` archiver, `S` snooze, `Enter` ouvrir, `Delete` supprimer.

### 1.11 Notification detaillee
Clic sur une notification ouvre un panneau lateral droit (slide-in, 400px de large, animation slide-left 300ms) OU navigue vers l'element source selon la preference utilisateur (configurable dans les parametres : "Ouvrir dans un panneau" vs "Ouvrir dans le module"). Le panneau lateral affiche : contenu complet de la notification, metadonnees (type, source, priorite, date exacte, expediteur), historique d'actions associees (ex: pour une approbation : qui a demande, quand, deadline), et des boutons d'action contextuels (Approuver/Rejeter pour une approbation, Repondre pour un commentaire, Voir le fichier pour un partage). Fermeture par clic exterieur, touche `Escape`, ou bouton X.

### 1.12 Pagination et infinite scroll
Les 50 premieres notifications sont chargees initialement. Scroll vers le bas declenche le chargement des 50 suivantes (infinite scroll avec IntersectionObserver). Indicateur de chargement (spinner) en bas de la liste pendant le fetch. Total des notifications affiche dans le header ("142 notifications"). Si toutes les notifications sont chargees, message "Fin de la liste" en bas. API : pagination par cursor (`after_id`) pour des performances optimales sur les grands volumes. Cache local des pages deja chargees via react-query.

### 1.13 Deep link navigation
Chaque notification contient un champ `deep_link` qui pointe vers l'element source dans la plateforme. Format : `{module}/{entity_type}/{entity_id}` (ex: `/mail/message/uuid`, `/tasks/task/uuid`, `/docs/document/uuid`, `/calendar/event/uuid`). Clic sur la notification navigue vers cette URL. Si le module n'est pas accessible (permissions insuffisantes), affichage d'un message "Vous n'avez pas acces a cet element" avec option de demander l'acces.

### 1.14 Notification types
Le systeme gere les types de notification suivants, chacun avec une icone et un comportement distincts :
- **system** (icone engrenage, gris) : maintenance, mise a jour, annonce admin
- **mention** (icone @, bleu) : mention dans un commentaire, chat, ou document
- **assignment** (icone personne+fleche, orange) : tache assignee, ticket assigne
- **reminder** (icone horloge, violet) : rappel de reunion, deadline approchante
- **approval** (icone checkmark-circle, vert) : demande d'approbation, approbation recue
- **share** (icone partage, cyan) : fichier partage, document partage, acces accorde
- **comment** (icone bulle, bleu clair) : commentaire sur un document, une tache, un post
- **reaction** (icone coeur, rose) : reaction/like sur un message ou commentaire
- **alert** (icone triangle-exclamation, rouge) : erreur, echec, alerte securite
- **digest** (icone pile, gris fonce) : resume groupe de plusieurs notifications

---

## Categorie 2 — Popover et badge (notification rapide)

### 2.1 Badge de notification dans la navbar
Icone cloche (outline, 24px) dans la barre de navigation principale, position droite, a gauche de l'avatar utilisateur. Badge rouge (cercle 18px, bold blanc) affichant le nombre de notifications non lues. Badge masque (display: none) si le compteur est 0. Badge "99+" si >99. Animation pulse (scale 1.0 -> 1.2 -> 1.0, 300ms) quand le compteur incremente. Le badge est mis a jour en temps reel via WebSocket (channel `notifications.count`). Couleur du badge : rouge (`bg-destructive`) pour les notifications normales, orange clignotant si une notification de priorite haute est non lue.

### 2.2 Popover au clic sur la cloche
Clic sur l'icone cloche ouvre un popover (Radix Popover, 360px de large, max-height 480px, overflow-y scroll). Le popover affiche les 10 dernieres notifications dans un flux compact. Header du popover : titre "Notifications" a gauche, bouton "Tout marquer comme lu" (icone seulement) a droite. Footer du popover : bouton "Voir tout" qui navigue vers `/notifications`. Animation d'ouverture : fade-in + scale 0.95->1.0, 200ms ease-out. Fermeture : clic exterieur, touche `Escape`, ou clic sur la cloche a nouveau. Le popover ne s'ouvre pas en mode DND (affiche un tooltip "Mode Ne Pas Deranger actif").

### 2.3 Preview compacte dans le popover
Chaque notification dans le popover occupe une ligne de 64px de haut avec : icone coloree du type (cercle 32px a gauche), titre (1 ligne, tronque avec ellipsis, font-medium si non lu), timestamp relatif (a droite, font-xs, muted), point bleu (8px) si non lu. Pas de corps/preview pour garder le popover compact. Hover : fond `bg-muted` + curseur pointer. L'icone du module source est affichee dans un badge discret sur l'icone type (overlay 12px bottom-right).

### 2.4 Actions rapides dans le popover
Au survol d'une notification dans le popover, deux boutons icones apparaissent a droite (animation fade-in) : bouton "Marquer comme lu" (icone check, tooltip) et bouton "Archiver" (icone archive, tooltip). Les boutons sont de 24px, espaces de 8px. Clic sur un bouton execute l'action sans fermer le popover. Animation de disparition (slide-left, 200ms) de la notification traitee, les suivantes remontent pour combler le vide.

### 2.5 Mise a jour temps reel du badge
Le compteur du badge se met a jour en temps reel via WebSocket PgEventBus. Le frontend souscrit au channel `notifications:{user_id}`. Quand une nouvelle notification arrive, le badge incremente sans rechargement de page. Quand une notification est lue (sur n'importe quel device), le badge decremente. La synchronisation cross-device est assuree : marquer une notification comme lue sur le telephone met a jour le badge sur le laptop instantanement. Si le WebSocket est deconnecte, fallback polling toutes les 30 secondes. Indicateur de connexion WebSocket dans la console dev (pas visible en UI).

### 2.6 Animation de nouvelle notification
Quand une nouvelle notification arrive (WebSocket event), l'icone cloche fait une micro-animation shake (rotation -15deg -> 15deg -> 0deg, 400ms, ease-in-out) pour attirer l'attention sans etre intrusive. L'animation ne se joue qu'une fois par batch de nouvelles notifications (pas de shake en boucle si 10 notifs arrivent en meme temps). Si le popover est ouvert, la nouvelle notification apparait en haut avec une animation slide-down et un fond highlight jaune pale pendant 2 secondes. Son optionnel (desactive par defaut, activable dans les preferences).

### 2.7 Toast de notification
Les notifications de priorite haute et certains types critiques (mention directe, approbation requise, alerte securite) affichent aussi un toast en bas a droite de l'ecran (composant Sonner). Le toast contient : titre (bold), corps court (1 ligne), bouton d'action principal (texte selon le type : "Voir", "Approuver", "Repondre"). Auto-dismiss apres 5 secondes (configurable dans les preferences : 3s, 5s, 10s, jamais). Clic sur le toast navigue vers la deep link. Bouton X pour dismiss immediat. Les toasts de priorite basse ne s'affichent PAS en toast (uniquement in-app et badge).

### 2.8 Stacking des toasts
Si plusieurs notifications de priorite haute arrivent simultanement, les toasts se stackent verticalement (max 3 visibles, les suivants en queue). Chaque toast a son propre timer de dismiss. Le toast le plus recent est en bas (dernier arrive en bas). Un compteur "+5 autres notifications" apparait si plus de 3 sont en queue. Clic sur le compteur ouvre le popover. Les toasts sont positionnes en `fixed` bottom-right avec un z-index de 9999. Espacement de 8px entre les toasts.

---

## Categorie 3 — Push notifications (navigateur et mobile)

### 3.1 Demande de permission push
Au premier login (ou quand l'utilisateur active les push dans `/notifications/preferences`), une modale SignApps explique : "Activez les notifications push pour etre averti meme quand SignApps n'est pas ouvert. Vous pouvez les desactiver a tout moment." Bouton "Activer les push" (primary) et "Plus tard" (secondary). Si l'utilisateur clique "Activer", le dialogue natif du navigateur `Notification.requestPermission()` s'affiche. Si l'utilisateur refuse, un toast explique comment reactiver via les parametres du navigateur. La modale ne s'affiche qu'une seule fois (flag `push_prompt_shown` dans localStorage).

### 3.2 Inscription au service push
Apres acceptation, le Service Worker enregistre un `PushSubscription` via `serviceWorkerRegistration.pushManager.subscribe()` avec les cles VAPID du serveur. Le `PushSubscription` (endpoint + clés p256dh + auth) est envoye au backend via `POST /api/notifications/push/subscribe`. Le backend stocke la subscription dans la table `push_subscriptions` avec : user_id, device_name (user-agent parse), endpoint, keys, created_at, last_used_at. Chaque device/navigateur a sa propre subscription.

### 3.3 Envoi de push notification
Le backend envoie les push via le protocole Web Push (RFC 8030) avec les cles VAPID (RFC 8292). La payload est chiffree (RFC 8291). Le navigateur affiche la notification meme si SignApps n'est pas ouvert (grace au Service Worker). Le service de notification (port 8095) maintient un pool de connexions HTTP/2 vers les push services (FCM, Mozilla, Apple). Retry en cas d'echec : 3 tentatives avec backoff exponentiel (1s, 5s, 30s). Si la subscription est expiree (410 Gone), elle est supprimee de la base.

### 3.4 Contenu de la push
Chaque push notification contient : `title` (titre de la notification, max 50 caracteres), `body` (preview tronquee, max 100 caracteres), `icon` (logo SignApps 192x192 ou icone du module source), `badge` (icone monochrome 96x96 pour la barre de statut mobile), `data.url` (deep link vers l'element source), `tag` (pour regrouper/remplacer les notifications du meme type, ex: "mail:inbox"), `renotify: true` si la notification doit jouer un son meme si elle remplace une autre du meme tag. Aucune donnee sensible dans la push (pas de contenu email, pas de montants).

### 3.5 Actions dans la push
Les push notifications incluent jusqu'a 2 boutons d'action (limites de la spec W3C) selon le type :
- **Approbation** : "Approuver" (action: approve) + "Rejeter" (action: reject)
- **Message** : "Voir" (action: open) + "Marquer comme lu" (action: read)
- **Partage** : "Ouvrir" (action: open)
- **Alerte** : "Voir le detail" (action: open)
Les actions sont traitees par le Service Worker (`self.addEventListener('notificationclick')`) qui envoie un POST au backend et ouvre l'URL correspondante. Si l'app est deja ouverte, le focus est mis sur l'onglet existant au lieu d'en ouvrir un nouveau.

### 3.6 Remplacement de push (tag-based)
Si une nouvelle notification du meme type et du meme objet arrive (ex: 3e commentaire sur le meme document), la push precedente est remplacee (pas empilee) grace au tag identique. Le corps est mis a jour : "Jean a commente" -> "Jean et Marie ont commente" -> "Jean, Marie et 1 autre ont commente votre document". Le compteur dans le badge incrementé. La push remplacee joue a nouveau le son si `renotify: true`. Tag format : `{module}:{entity_type}:{entity_id}` (ex: `docs:comment:uuid-123`).

### 3.7 Multi-device
Un utilisateur peut avoir plusieurs subscriptions push (laptop Chrome, laptop Firefox, smartphone Android, tablette). Chaque device recoit la push independamment. Si la notification est lue sur un device (via l'app web), les autres devices la marquent aussi comme lue via la synchronisation WebSocket. La push n'est pas annulee retroactivement (les push deja affichees sur d'autres devices restent visibles dans le centre de notifications OS). Liste des devices dans `/notifications/preferences` avec possibilite de supprimer un device.

### 3.8 Push silencieuse
Option par type de notification : "Push silencieuse" (pas de son, pas de vibration, `silent: true`). La notification apparait dans le centre de notifications du systeme sans interrompre l'utilisateur. Utile pour les notifications de basse priorite (reaction, activite d'equipe). Configure dans la matrice de preferences (voir 5.8).

### 3.9 Service Worker
Le Service Worker (`/sw.js`) gere :
- **Reception** : `self.addEventListener('push')` decode la payload et affiche la notification via `self.registration.showNotification()`
- **Clic** : `self.addEventListener('notificationclick')` gere le clic sur la notification et sur les boutons d'action
- **Fermeture** : `self.addEventListener('notificationclose')` optionnel, pour analytics
- **Cache** : les icones et badges sont pre-caches pour affichage instantane
- **Badge update** : `navigator.setAppBadge(count)` pour le badge sur l'icone de l'app PWA
Le Service Worker est versionne et mis a jour automatiquement (strategie stale-while-revalidate).

### 3.10 Fallback email
Si le push echoue (subscription expiree, navigateur ferme depuis longtemps, endpoint invalide), la notification est envoyee par email apres un delai configurable (defaut 15 minutes). Le delai permet d'eviter la double notification si l'utilisateur ouvre l'app entre-temps. Si la notification est lue dans l'app avant l'expiration du delai, l'email n'est pas envoye. L'email est envoye via le service Mail (port 3012) avec le template de notification. Header `List-Unsubscribe` inclus.

---

## Categorie 4 — Email digest et canaux alternatifs

### 4.1 Digest quotidien
Email recapitulatif envoye a l'heure configuree par l'utilisateur (defaut 8h00, fuseau horaire local). Contenu : toutes les notifications non lues depuis le dernier digest. Format HTML responsive : section par module avec icone et couleur, liste des notifications avec titre, preview, timestamp, et lien direct "Voir dans SignApps". En-tete : "Vous avez 12 notifications non lues dont 3 de priorite haute". Desactivable dans les preferences. N'est pas envoye si aucune notification non lue. API de planification : job cron par utilisateur, heure stockee dans `notification_preferences.digest_time`.

### 4.2 Digest hebdomadaire
Email recapitulatif envoye le lundi matin (heure configurable, defaut 8h00) avec les statistiques de la semaine : nombre total de notifications (par type), notifications non traitees (en attente), action items en attente (via integration Tasks), reunions de la semaine a venir (via Calendar). Format infographique : KPIs en haut, liste detaillee en dessous. Desactivable separement du digest quotidien.

### 4.3 Notifications critiques par email immediat
Certaines notifications declenchent un email immediat (pas en digest) : mention directe dans un document ou chat, assignation de tache, demande d'approbation, alerte securite, erreur critique (publication social echouee, backup echoue). La liste des types "email immediat" est configurable par l'utilisateur dans les preferences. Chaque email immediat contient un bouton d'action principal ("Voir", "Approuver", "Repondre") qui redirige vers la deep link. Deduplication : si la notification a deja ete lue dans l'app, l'email n'est pas envoye.

### 4.4 Format email responsive
Les emails de notification utilisent un template HTML responsive avec le branding SignApps. Header : logo + nom du module source. Corps : titre, preview du contenu, metadata (auteur, date). Footer : boutons d'action, lien vers les preferences, lien de desinscription. Affichage correct sur desktop (max-width 600px centre) et mobile (full-width). Images optimisees. Mode texte alternatif pour les clients email sans HTML. Le template est genere par le service notifications (port 8095) et envoye via le service Mail (port 3012).

### 4.5 Unsubscribe conforme
Chaque email contient un lien "Se desabonner de ce type de notification" en footer, conforme CAN-SPAM et RGPD. Le lien mene a la page de preferences de notification de l'utilisateur (`/notifications/preferences`) avec le type concerne pre-selectionne. Header `List-Unsubscribe` present dans les headers SMTP (RFC 8058) avec lien mailto et URL HTTPS. Le backend traite les demandes de desinscription automatiquement (update de la table `notification_preferences`).

### 4.6 Webhook de notification
Endpoint webhook configurable par l'admin dans `/admin/notifications/webhooks`. Chaque notification peut etre envoyee en POST JSON vers une URL externe. Payload : `{event_type, notification, user, timestamp}`. Secret partage pour signature HMAC-SHA256 dans le header `X-SignApps-Signature`. Utile pour integration avec Slack, Teams, PagerDuty. Retry 3 fois avec backoff si le webhook retourne une erreur. Configuration par type de notification (envoyer uniquement les alertes, ou toutes). API admin : `POST /api/notifications/admin/webhooks`.

### 4.7 Notification via Chat
Les notifications peuvent etre envoyees dans un canal Chat dedie (canal auto-cree "#notifications" ou canal choisi par l'utilisateur). Le bot "SignApps" poste un message formate avec le contenu de la notification. L'utilisateur peut repondre dans le chat pour interagir (ex: "Approuve" en reponse a une demande d'approbation -> le bot traite la reponse). Configuration dans les preferences : canal cible, types de notifications a envoyer dans le chat. PgEventBus event `notification.created` ecoute par le service Chat.

### 4.8 Integration mobile (PWA)
En mode PWA (application installee sur le homescreen), les push notifications utilisent l'API native du systeme mobile. Badge sur l'icone de l'app via `navigator.setAppBadge(unreadCount)`. Vibration configurable (patron de vibration : [200, 100, 200] pour les notifications hautes priorite). L'application PWA s'ouvre directement sur la deep link quand l'utilisateur clique la notification. Support Android (Chrome) et iOS (Safari 16.4+, avec limitations).

---

## Categorie 5 — Preferences et personnalisation

### 5.1 Preferences globales de canal
Page `/notifications/preferences` avec une section "Canaux de notification". Trois toggles avec description :
- **In-app** (toujours actif, non desactivable, badge gris) — les notifications apparaissent dans le centre et le popover
- **Push navigateur** (toggle bleu) — notifications push meme quand SignApps n'est pas ouvert. Si les permissions ne sont pas accordees, bouton "Activer" qui relance la demande
- **Email** (toggle bleu) — notifications par email (digest et immediat). Si desactive, aucun email de notification n'est envoye
Chaque canal a un indicateur de statut : "Actif" (vert), "Permission requise" (orange), "Desactive" (gris).

### 5.2 Heures silencieuses (Do Not Disturb automatique)
Configurer une plage horaire pendant laquelle aucune notification push ou email n'est envoyee. Interface : deux time pickers (debut et fin, ex: 22h00 - 07h00). Selection du fuseau horaire. Les notifications sont mises en queue pendant la periode silencieuse et delivrees d'un coup a la fin (ou integrees dans le digest du matin). Les notifications in-app continuent d'arriver silencieusement (pas de toast, pas de son, mais visibles dans l'inbox). Toggle pour les weekends (samedi-dimanche entiers). Les heures silencieuses se combinent avec le mode DND manuel.

### 5.3 Mode DND manuel
Bouton "Ne pas deranger" activable manuellement dans la navbar (clic sur l'icone cloche -> option "Ne pas deranger" dans le popover, ou clic long sur la cloche). Duree : 1h, 2h, 4h, "Jusqu'a demain matin (9h)", "Personnalise..." (date+time picker). Badge DND visible sur l'icone cloche (icone de lune superposee). Pendant le mode DND : aucun toast, aucun son, aucune push, aucune animation de la cloche. Seules les notifications de type "urgent" (configurables par l'admin) passent. Indicateur "DND actif jusqu'a 14h" dans le popover. Le mode DND est synchronise entre les devices via les preferences serveur.

### 5.4 Preferences par service
Section "Notifications par module" dans la page de preferences. Toggle par service : Mail, Calendar, Tasks, Docs, Drive, Chat, Meet, Social, HR, Billing, Forms, Contacts. Desactiver un service bloque TOUTES les notifications de ce service (in-app, push, email). Chaque service affiche un compteur de types de notifications configurables (ex: "Mail — 3 types"). Clic sur le nom du service deplie la section des types detailles (voir 5.5).

### 5.5 Preferences granulaires par type d'evenement
Pour chaque service, liste des types d'evenements avec matrice canal x toggle :

**Mail :**
- Nouveau message : [in-app] [push] [email]
- Reponse a un thread : [in-app] [push] [email]
- Mention dans un email : [in-app] [push] [email]

**Calendar :**
- Rappel d'evenement : [in-app] [push] [email] + delai configurable (5min, 15min, 30min, 1h, 1j)
- Invitation recue : [in-app] [push] [email]
- Modification d'evenement : [in-app] [push] [email]
- Annulation d'evenement : [in-app] [push] [email]

**Tasks :**
- Tache assignee : [in-app] [push] [email]
- Changement de statut : [in-app] [push] [email]
- Deadline approchante (<24h) : [in-app] [push] [email]
- Commentaire sur une tache : [in-app] [push] [email]

**Docs :**
- Mention dans un document : [in-app] [push] [email]
- Commentaire : [in-app] [push] [email]
- Suggestion d'edition : [in-app] [push] [email]
- Document partage : [in-app] [push] [email]

**Chat :**
- Message direct : [in-app] [push] [email]
- Mention dans un channel : [in-app] [push] [email]
- Reaction a un message : [in-app] [push] [email]

**HR :**
- Demande de conge soumise/approuvee/rejetee : [in-app] [push] [email]
- Rappel d'entretien : [in-app] [push] [email]

Chaque cellule de la matrice est un toggle individuel. Un bouton "Tout activer" et "Tout desactiver" par service. Les preferences sont sauvegardees automatiquement a chaque changement (debounce 500ms).

### 5.6 Preferences par projet/espace
Au-dela du service, l'utilisateur peut ajuster les notifications par projet Tasks, par channel Chat, par dossier Drive. Interface : bouton "Gerer par projet" dans la section du service concerne. Liste des projets/channels avec toggle par canal. Ex: "Muter les notifications du projet X" (desactive tous les canaux pour ce projet). "Notifications urgentes seulement pour le channel #general" (push uniquement pour les mentions directes). API : `PATCH /api/notifications/preferences/scoped` avec `{scope_type: "project", scope_id: "uuid", settings: {in_app: true, push: false, email: false}}`.

### 5.7 Snooze recurrent
Configurer un snooze recurrent pour un type de notification : toutes les notifications d'un type donne sont snooze pendant les weekends (samedi-dimanche), ou pendant les vacances (lie au statut de l'utilisateur dans le module HR : absent, en conge). Interface : checkbox "Snooze pendant les weekends" et "Snooze pendant mes absences" par type de notification. Quand le snooze est actif, les notifications sont mises en queue et delivrees le premier jour ouvrable suivant.

### 5.8 Niveau de priorite par canal
Configurer le seuil de priorite par canal dans une matrice visuelle :
- **In-app** : toutes les priorites (non configurable)
- **Push** : haute seulement / haute et moyenne / toutes
- **Email immediat** : haute seulement / haute et moyenne / toutes
- **Email digest** : toutes les priorites (non configurable, le digest inclut tout)
La matrice est presentee comme un tableau interactif avec des radio buttons par ligne (canal) et colonne (seuil).

### 5.9 Sons personnalises
Section "Sons" dans les preferences. Choisir un son de notification par priorite : haute (defaut : alerte courte), moyenne (defaut : notification douce), basse (defaut : silencieux). Bibliotheque de 10 sons pre-definis avec bouton preview (icone play). Upload de sons custom (max 5 secondes, formats WAV/MP3, max 500 Ko). Preview avant de sauvegarder. Toggle global "Desactiver tous les sons". Les sons ne jouent pas en mode DND. API : `PATCH /api/notifications/preferences` avec `{sounds: {high: "alert-1", medium: "custom-uuid", low: "none"}}`.

### 5.10 Sauvegarde des preferences
Les preferences sont stockees cote serveur (table `notification_preferences`) et synchronisees entre devices. Modification depuis n'importe quel device prend effet immediatement sur tous les devices via WebSocket event `preferences.updated`. L'UI affiche "Preferences sauvegardees" (toast) apres chaque modification. API : `GET /api/notifications/preferences`, `PATCH /api/notifications/preferences`.

---

## Categorie 6 — Groupement, batching et intelligence

### 6.1 Groupement par source
Les notifications du meme module et du meme objet sont groupees dans l'inbox : "3 commentaires sur le document Budget Q2" au lieu de 3 notifications separees. La notification groupee affiche : compteur ("3"), icone du type, titre agrege, avatars empiles des auteurs (max 3 + "+N"), timestamp du plus recent. Clic sur la notification groupee deplie la liste des notifications individuelles (expand/collapse avec animation accordion 200ms). Le groupement s'applique retroactivement (les anciennes notifications sont regroupees a l'affichage). Cle de groupement : `{notification_type}:{entity_type}:{entity_id}`.

### 6.2 Digest en temps reel (batching)
Si plusieurs notifications arrivent en rafale (ex: 5 likes en 10 secondes), elles sont agregees en une seule notification apres un delai de batching de 30 secondes : "Jean, Marie et 3 autres ont reagi a votre message". Le batching est gere cote serveur par le service notifications : les notifications sont mises dans un buffer de 30 secondes. Si aucune nouvelle notification du meme type n'arrive pendant 30 secondes, le batch est emit. Le seuil de batching est configurable par l'admin (10s a 120s).

### 6.3 Frequency capping
Limite le nombre maximum de notifications par heure pour un meme type et un meme objet. Defaut : 5 notifications/heure par type. Les notifications au-dela de la limite sont groupees dans un digest in-app : "12 nouveaux commentaires sur [objet]" (affiche une seule fois par heure). Configuration par l'admin dans `/admin/notifications/settings`. Les notifications de priorite haute ne sont jamais cappees.

### 6.4 Intelligent delivery
Le systeme analyse le comportement de l'utilisateur : quand il ouvre la plateforme (heures d'activite), quand il traite ses notifications (temps moyen entre reception et lecture), quels types il traite en priorite. A partir de ces donnees, ajustement de l'heure d'envoi des digests email (envoyer quand l'utilisateur est le plus susceptible de lire) et regroupement des push non-urgentes pendant les periodes d'inactivite. Apprentissage progressif sur 30 jours de donnees. Desactivable dans les preferences ("Envoi immediat systematique").

### 6.5 Desabonnement intelligent
Si un utilisateur ignore systematiquement un type de notification (10 non lues consecutives sans ouverture), le systeme affiche un bandeau discret dans l'inbox : "Vous ne lisez jamais les notifications de [type]. Voulez-vous les desactiver ?" Boutons : "Desactiver" (met a jour les preferences), "Garder" (masque le bandeau pour 30 jours), "Reduire" (passe en digest hebdomadaire). Pas de desactivation automatique — toujours un choix explicite de l'utilisateur.

### 6.6 Priorite dynamique
Le backend ajuste la priorite d'une notification en fonction du contexte :
- Deadline de tache a J-1 : medium -> high
- Deadline de tache a J-7 : low -> medium
- Mention dans un thread actif (>3 messages en 10 min) : low -> medium
- Demande d'approbation non traitee depuis 24h : medium -> high
- Commentaire sur un document que l'utilisateur a ouvert aujourd'hui : low -> medium
Les regles d'escalade sont configurables par l'admin. Le changement de priorite est transparent pour l'utilisateur (pas de notification "votre notification a change de priorite").

### 6.7 Deduplication
Si la meme notification est generee deux fois (race condition, retry, bug dans le service emetteur), le systeme detecte le doublon et ne l'affiche qu'une fois. Detection basee sur un hash composite : `SHA256(type + source_service + entity_id + user_id + 5min_window)`. Les doublons dans la fenetre de 5 minutes sont rejetes silencieusement. Log de deduplication accessible par l'admin pour diagnostiquer les services problematiques.

### 6.8 Notification de resume quotidien
En plus du digest email, une notification in-app est generee le matin (a l'heure du digest) : "Bonjour ! Vous avez 12 notifications non lues dont 3 de priorite haute." Clic sur la notification ouvre l'inbox filtre sur les non lues de priorite haute. La notification de resume est de type "digest" et n'est pas comptee dans le badge (pour eviter la recursion). Desactivable dans les preferences.

---

## Categorie 7 — Administration et monitoring

### 7.1 Dashboard admin des notifications
Page admin `/admin/notifications/dashboard` affichant les metriques en temps reel : notifications envoyees par jour (graphique en barres, 30 jours), repartition par canal (camembert : in-app, push, email), repartition par service (barres horizontales), taux de lecture (% de notifications lues dans les 24h), taux de clic (% de notifications ayant declenche une navigation), temps moyen avant lecture (en minutes). Filtres par periode, service, type. Donnees issues de la table `notification_metrics`. API : `GET /api/notifications/admin/dashboard`.

### 7.2 Creation de notifications admin (broadcast)
L'admin peut creer une notification broadcast a tous les utilisateurs ou a un groupe : annonce de maintenance, mise a jour de fonctionnalite, message important. Formulaire : titre, corps (Markdown), priorite, canaux de diffusion (in-app + push + email), audience (tous / role / equipe / liste d'utilisateurs). Preview avant envoi. Planification optionnelle (envoyer maintenant ou programmer). Historique des broadcasts envoyes. API : `POST /api/notifications/admin/broadcast`.

### 7.3 Templates de notifications
Bibliotheque de templates pour les notifications systeme. Chaque template definit : titre (avec variables `{{user_name}}`, `{{object_title}}`, `{{action}}`), corps (avec variables), icone, priorite par defaut, canaux de diffusion par defaut. Templates editables par l'admin dans `/admin/notifications/templates`. Preview en temps reel avec des valeurs d'exemple. Les templates sont utilises par les services emetteurs via l'API. Versionnement des templates (historique des modifications). API : `GET /api/notifications/admin/templates`, `PATCH /api/notifications/admin/templates/:id`.

### 7.4 Politique de retention
L'admin configure la duree de retention des notifications dans `/admin/notifications/settings` : 30 jours (defaut), 90 jours, 1 an, illimite. Les notifications expirees sont purgees automatiquement par un job cron quotidien. Les notifications archivees suivent une retention separee (defaut : 1 an). Les notifications de type "system" et "security" ont une retention minimum de 1 an (non configurable). Indicateur : espace occupe par les notifications en base.

### 7.5 Rate limiting
Protection contre le spam de notifications : limite le nombre de notifications qu'un service peut creer par minute (configurable par service). Defaut : 100/minute. Les notifications au-dela de la limite sont mises en queue (pas rejetees). Si la queue depasse 1000 elements, les nouvelles notifications de basse priorite sont rejetees avec un log d'avertissement. Dashboard admin montrant le taux de creation par service et les rejets.

### 7.6 Health check des canaux
Monitoring de la sante de chaque canal dans `/admin/notifications/health` :
- **Push** : nombre de subscriptions actives vs expirees, taux de succes d'envoi (last 24h), nombre de 410 Gone recus
- **Email** : taux de delivrabilite, bounces (hard et soft), plaintes spam
- **WebSocket** : nombre de connections actives, reconnexions/heure
- **In-app** : temps moyen de rendu, erreurs d'affichage
Alertes si un canal tombe en dessous d'un seuil (ex: push success rate <90%).

### 7.7 Audit log
Log de toutes les notifications envoyees avec : notification_id, destinataire, canal (in-app/push/email), timestamp d'envoi, timestamp de lecture (null si non lu), timestamp de clic (null si pas de clic), actions effectuees (approuve/rejete/archive). Filtrable par destinataire, canal, date, type. Exportable en CSV pour conformite. Retention du log : 2 ans. API : `GET /api/notifications/admin/audit-log?from=&to=&user=&channel=`.

### 7.8 Notification de test
Bouton "Envoyer une notification de test" dans la page admin. Envoie une notification de test a soi-meme sur tous les canaux configures (in-app, push, email). Chaque canal affiche le resultat : succes (vert), echec (rouge avec message d'erreur). Utile pour verifier que la configuration VAPID, le service email et le WebSocket fonctionnent. API : `POST /api/notifications/admin/test`.

### 7.9 Suppression bulk
L'admin peut supprimer toutes les notifications d'un type, d'une source, ou d'une periode. Interface : filtres (type, source, date range) + preview du nombre de notifications affectees + bouton "Supprimer". Confirmation modale obligatoire. Utile apres un bug qui a genere des notifications parasites (ex: boucle infinie dans un service). API : `DELETE /api/notifications/admin/bulk?type=&source=&before=`.

### 7.10 Configuration VAPID
Page admin `/admin/notifications/push-config` pour configurer les cles VAPID (Voluntary Application Server Identification) necessaires au Web Push. Deux options : "Generer automatiquement" (cree une paire de cles ECDSA P-256 stockee dans la base) ou "Importer des cles existantes" (coller la cle publique et privee). La cle publique VAPID est servie au frontend via `GET /api/notifications/vapid-key`. Warning si aucune cle n'est configuree.

---

## Categorie 8 — Securite, conformite et architecture

### 8.1 Chiffrement en transit
Toutes les notifications transitent via HTTPS (REST API) et WSS (WebSocket). Les push notifications sont chiffrees de bout en bout via le protocole Web Push (RFC 8291, AES-128-GCM). Les payloads push ne sont dechiffrables que par le navigateur destinataire (cle p256dh du PushSubscription). Les emails sont envoyes via SMTP avec TLS obligatoire (STARTTLS ou connexion directe TLS).

### 8.2 Pas de donnees sensibles dans les push
Les push notifications ne contiennent jamais de donnees sensibles en clair : pas de contenu email, pas de montants, pas de donnees medicales, pas de mots de passe. Seul un titre generique est envoye ("Nouveau message", "Tache assignee"). Le detail est visible uniquement dans l'app apres authentification JWT. Regle appliquee au niveau du template : les champs sensibles sont remplaces par des placeholders generiques dans le canal push.

### 8.3 Authentification requise
Toutes les routes de l'API notifications necessitent un JWT valide (middleware `auth` de `signapps-common`). Les notifications sont filtrees par `user_id` extrait du token. Un utilisateur ne peut jamais voir les notifications d'un autre utilisateur. Les routes admin necessitent le role `admin` ou `notification_admin`. Rate limiting par utilisateur : 60 requetes/minute sur les endpoints de lecture, 30/minute sur les endpoints d'ecriture.

### 8.4 PgEventBus pour les evenements inter-services
Les services emettent des `PlatformEvent` via le PgEventBus (PostgreSQL LISTEN/NOTIFY). Le service notifications (port 8095) ecoute TOUS les evenements et genere les notifications appropriees selon les templates et les preferences utilisateur. Aucun appel HTTP direct entre les services et le service notifications. Events ecoutes : `mail.received`, `calendar.event.reminder`, `tasks.assigned`, `docs.commented`, `drive.shared`, `chat.mentioned`, `hr.leave.approved`, `social.post.published`, `meet.recording.ready`, `forms.response.submitted`, `billing.invoice.created`.

### 8.5 Idempotence
Chaque notification a un ID unique (UUID v4) genere par le service emetteur. La creation est idempotente : un retry avec le meme ID ne cree pas de doublon (constraint UNIQUE sur le champ `idempotency_key`). Le service notifications retourne 200 OK pour les duplicates (au lieu de 409 Conflict) pour simplifier les retries. Le champ `idempotency_key` est compose de `{source_service}:{event_type}:{entity_id}:{user_id}`.

### 8.6 RGPD et export des donnees
L'utilisateur peut exporter toutes ses notifications (historique complet) au format JSON via `/settings/privacy/export`. Le fichier inclut : toutes les notifications recues (titre, corps, type, source, date, statut lu/non lu), les preferences de notification, les subscriptions push (metadata sans cles). Inclus dans la fonctionnalite "Exporter mes donnees" du module Identity. Suppression possible dans le cadre du droit a l'oubli : `POST /api/notifications/gdpr/delete` supprime toutes les notifications et preferences de l'utilisateur.

### 8.7 Scalabilite
Le service notifications (port 8095) est stateless et horizontalement scalable. Les WebSocket connections sont gerees par un load balancer sticky-session (basé sur le `user_id` dans le cookie ou le header). Le PgEventBus (PostgreSQL LISTEN/NOTIFY) est le broker de messages : tous les instances du service ecoutent les memes channels. Cible : 10 000 notifications/seconde en creation, 50 000 WebSocket connections simultanees. Les notifications sont ecrites en batch (INSERT ... VALUES (...), (...), ...) pour les performances.

### 8.8 Retry et dead letter
Si l'envoi d'une notification echoue (push expired, email bounce, WebSocket disconnected), le systeme retry 3 fois avec backoff exponentiel (1s, 10s, 60s). Apres 3 echecs, la notification est placee dans la table `notification_dead_letter` pour inspection admin. L'admin peut : retenter manuellement, supprimer, ou reclassifier. Dashboard des dead letters dans `/admin/notifications/dead-letters` avec compteur et age moyen.

### 8.9 Metriques Prometheus
Le service expose des metriques sur `/metrics` (format Prometheus) :
- `notifications_sent_total{channel, type, service}` — compteur par canal, type, service
- `notifications_read_total{type}` — compteur de lectures
- `notifications_click_total{type}` — compteur de clics (deep link)
- `notifications_latency_seconds{channel}` — histogramme de latence par canal
- `push_subscriptions_active` — gauge des subscriptions push valides
- `push_send_errors_total{error_code}` — compteur d'erreurs push par code
- `websocket_connections_active` — gauge des connexions WebSocket
- `email_digest_sent_total` — compteur des digests envoyes
- `notification_dead_letter_count` — gauge des dead letters en attente
Scrappable par le module Metrics (port 3008). Alertes configurables sur les seuils.

### 8.10 API REST documentee
Endpoints documentes via OpenAPI (Swagger UI sur `/swagger-ui/` du service `signapps-notifications`, port 8095).

---

## Schema PostgreSQL

```sql
-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    idempotency_key VARCHAR(512) UNIQUE,
    notification_type VARCHAR(32) NOT NULL, -- system, mention, assignment, reminder, approval, share, comment, reaction, alert, digest
    title VARCHAR(512) NOT NULL,
    body TEXT,
    icon VARCHAR(64), -- icon identifier
    priority VARCHAR(16) NOT NULL DEFAULT 'medium', -- high, medium, low
    source_service VARCHAR(64) NOT NULL, -- mail, calendar, tasks, docs, drive, chat, meet, social, hr, billing, forms, admin
    source_entity_type VARCHAR(64), -- message, event, task, document, file, channel, post, leave_request, invoice
    source_entity_id UUID,
    deep_link VARCHAR(512), -- /mail/message/uuid, /tasks/task/uuid, etc.
    action_data JSONB DEFAULT '{}', -- {approve_url, reject_url, reply_url}
    group_key VARCHAR(255), -- for grouping: type:entity_type:entity_id
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    snoozed_until TIMESTAMPTZ,
    channels_sent TEXT[] DEFAULT '{}', -- in_app, push, email
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ -- for retention policy
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE is_read = FALSE AND is_archived = FALSE;
CREATE INDEX idx_notifications_user_all ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_group ON notifications(user_id, group_key);
CREATE INDEX idx_notifications_snoozed ON notifications(snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX idx_notifications_search ON notifications USING gin(to_tsvector('simple', title || ' ' || COALESCE(body, '')));

-- Preferences utilisateur pour les notifications
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
    -- Global channel toggles
    push_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT TRUE,
    -- DND
    dnd_enabled BOOLEAN DEFAULT FALSE,
    dnd_until TIMESTAMPTZ,
    quiet_hours_start TIME, -- e.g., 22:00
    quiet_hours_end TIME, -- e.g., 07:00
    quiet_hours_timezone VARCHAR(64) DEFAULT 'UTC',
    quiet_weekends BOOLEAN DEFAULT FALSE,
    -- Digest
    digest_daily_enabled BOOLEAN DEFAULT TRUE,
    digest_daily_time TIME DEFAULT '08:00',
    digest_weekly_enabled BOOLEAN DEFAULT TRUE,
    -- Sounds
    sound_high VARCHAR(64) DEFAULT 'alert-1',
    sound_medium VARCHAR(64) DEFAULT 'notification-soft',
    sound_low VARCHAR(64) DEFAULT 'none',
    -- Channel priority thresholds
    push_min_priority VARCHAR(16) DEFAULT 'medium', -- high, medium, low
    email_immediate_min_priority VARCHAR(16) DEFAULT 'high',
    -- Per-service settings (JSONB for flexibility)
    service_settings JSONB DEFAULT '{}', -- {mail: {enabled: true, types: {new_message: {in_app: true, push: true, email: false}}}, ...}
    -- Per-scope overrides
    scope_overrides JSONB DEFAULT '{}', -- [{scope_type: "project", scope_id: "uuid", settings: {in_app: true, push: false}}]
    -- Misc
    toast_duration_seconds INT DEFAULT 5,
    panel_mode VARCHAR(16) DEFAULT 'panel', -- panel (slide-in) or navigate
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Push subscriptions
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    device_name VARCHAR(255), -- parsed from user-agent
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);

-- VAPID configuration
CREATE TABLE notification_vapid_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_key TEXT NOT NULL,
    private_key_encrypted BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notification templates
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    title_template TEXT NOT NULL, -- "{{user_name}} a commente {{object_title}}"
    body_template TEXT,
    icon VARCHAR(64),
    default_priority VARCHAR(16) DEFAULT 'medium',
    default_channels TEXT[] DEFAULT '{in_app}',
    variables TEXT[] DEFAULT '{}', -- detected variables
    is_active BOOLEAN DEFAULT TRUE,
    version INT DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin broadcast notifications
CREATE TABLE notification_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(512) NOT NULL,
    body TEXT NOT NULL,
    priority VARCHAR(16) DEFAULT 'medium',
    channels TEXT[] DEFAULT '{in_app,push,email}',
    audience_type VARCHAR(32) NOT NULL, -- all, role, team, users
    audience_filter JSONB, -- {role: "manager"} or {team_id: "uuid"} or {user_ids: [...]}
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    recipient_count INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dead letter queue
CREATE TABLE notification_dead_letter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id),
    channel VARCHAR(32) NOT NULL, -- push, email
    error_message TEXT NOT NULL,
    retry_count INT DEFAULT 3,
    last_retry_at TIMESTAMPTZ,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dead_letter_unresolved ON notification_dead_letter(created_at) WHERE resolved = FALSE;

-- Metriques de delivery (pour analytics admin)
CREATE TABLE notification_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id),
    channel VARCHAR(32) NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    action_taken VARCHAR(64), -- approved, rejected, archived, replied
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_metrics_date ON notification_metrics(sent_at);

-- Webhooks sortants configures par l'admin
CREATE TABLE notification_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    secret VARCHAR(255) NOT NULL,
    event_types TEXT[] DEFAULT '{}', -- empty = all
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMPTZ,
    failure_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Custom notification sounds
CREATE TABLE notification_sounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    storage_key TEXT NOT NULL,
    duration_seconds FLOAT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Snooze history (for analytics and DND recurrence)
CREATE TABLE notification_snooze_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id),
    user_id UUID NOT NULL REFERENCES users(id),
    snoozed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    wake_at TIMESTAMPTZ NOT NULL
);
```

---

## REST API Endpoints

All endpoints require JWT authentication. Base path: `signapps-notifications` service, port 8095.

### User-facing endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | List notifications (paginated, filterable) |
| GET | `/api/notifications/:id` | Get notification detail |
| PATCH | `/api/notifications/:id/read` | Mark as read/unread |
| POST | `/api/notifications/read-all` | Mark all as read (with optional service filter) |
| PATCH | `/api/notifications/:id/archive` | Archive notification |
| PATCH | `/api/notifications/:id/snooze` | Snooze notification (with wake_at) |
| DELETE | `/api/notifications/:id` | Delete notification |
| DELETE | `/api/notifications/bulk` | Bulk delete (by age, status, type) |
| GET | `/api/notifications/search?q=` | Search notifications |
| GET | `/api/notifications/count` | Unread count (for badge) |
| WS | `/api/notifications/ws` | Real-time WebSocket stream |

### Preferences
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications/preferences` | Get user preferences |
| PATCH | `/api/notifications/preferences` | Update preferences |
| PATCH | `/api/notifications/preferences/scoped` | Update per-project/channel prefs |
| GET | `/api/notifications/vapid-key` | Get VAPID public key |

### Push subscriptions
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/notifications/push/subscribe` | Register push subscription |
| DELETE | `/api/notifications/push/subscribe/:id` | Remove push subscription |
| GET | `/api/notifications/push/devices` | List user devices |

### GDPR
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/notifications/gdpr/export` | Export all notifications (JSON) |
| POST | `/api/notifications/gdpr/delete` | Delete all notification data |

### Inter-service (internal)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/notifications` | Create notification (from other services) |
| POST | `/api/notifications/batch` | Create batch notifications |

### Admin endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications/admin/dashboard` | Admin analytics dashboard |
| POST | `/api/notifications/admin/broadcast` | Send broadcast notification |
| GET | `/api/notifications/admin/templates` | List templates |
| PATCH | `/api/notifications/admin/templates/:id` | Update template |
| GET | `/api/notifications/admin/audit-log` | Audit log |
| POST | `/api/notifications/admin/test` | Send test notification |
| DELETE | `/api/notifications/admin/bulk` | Admin bulk delete |
| GET | `/api/notifications/admin/dead-letters` | Dead letter queue |
| POST | `/api/notifications/admin/dead-letters/:id/retry` | Retry dead letter |
| POST | `/api/notifications/admin/webhooks` | Create outbound webhook |
| GET | `/api/notifications/admin/webhooks` | List webhooks |
| DELETE | `/api/notifications/admin/webhooks/:id` | Delete webhook |
| GET | `/api/notifications/admin/health` | Channel health status |
| GET | `/api/notifications/admin/settings` | Get admin settings |
| PATCH | `/api/notifications/admin/settings` | Update settings (retention, rate limits) |
| GET | `/api/notifications/admin/vapid` | Get VAPID config |
| POST | `/api/notifications/admin/vapid` | Set VAPID keys |

---

## PgEventBus Events

### Events consumed (listened by notifications service)
| Event | Payload | Generated notification |
|-------|---------|----------------------|
| `mail.received` | `{user_id, message_id, from, subject}` | "Nouveau message de [from]: [subject]" |
| `mail.mentioned` | `{user_id, message_id, mentioned_by}` | "[mentioned_by] vous a mentionne dans un email" |
| `calendar.event.reminder` | `{user_id, event_id, title, starts_at, minutes_before}` | "Rappel : [title] dans [minutes] minutes" |
| `calendar.event.invited` | `{user_id, event_id, title, organizer}` | "[organizer] vous invite a [title]" |
| `calendar.event.updated` | `{user_id, event_id, title, changes}` | "[title] a ete modifie : [changes]" |
| `calendar.event.cancelled` | `{user_id, event_id, title}` | "[title] a ete annule" |
| `tasks.assigned` | `{user_id, task_id, title, assigned_by}` | "[assigned_by] vous a assigne [title]" |
| `tasks.status_changed` | `{user_id, task_id, title, old_status, new_status}` | "[title] passe de [old] a [new]" |
| `tasks.deadline_approaching` | `{user_id, task_id, title, deadline}` | "Deadline : [title] est due dans 24h" |
| `tasks.commented` | `{user_id, task_id, title, commenter}` | "[commenter] a commente [title]" |
| `docs.commented` | `{user_id, doc_id, title, commenter}` | "[commenter] a commente [title]" |
| `docs.mentioned` | `{user_id, doc_id, title, mentioned_by}` | "[mentioned_by] vous a mentionne dans [title]" |
| `docs.shared` | `{user_id, doc_id, title, shared_by}` | "[shared_by] a partage [title] avec vous" |
| `drive.shared` | `{user_id, file_id, filename, shared_by}` | "[shared_by] a partage [filename]" |
| `chat.direct_message` | `{user_id, channel_id, sender, preview}` | "[sender] : [preview]" |
| `chat.mentioned` | `{user_id, channel_id, channel_name, sender}` | "[sender] vous a mentionne dans #[channel]" |
| `hr.leave.approved` | `{user_id, leave_id, approver}` | "Conge approuve par [approver]" |
| `hr.leave.rejected` | `{user_id, leave_id, approver, reason}` | "Conge refuse par [approver]" |
| `social.post.published` | `{user_id, post_id, platform}` | "Post publie sur [platform]" |
| `social.post.failed` | `{user_id, post_id, platform, error}` | "Echec publication sur [platform]" |
| `billing.invoice.created` | `{user_id, invoice_id, amount}` | "Nouvelle facture : [amount]" |
| `forms.response.submitted` | `{user_id, form_id, form_title, respondent}` | "Nouvelle reponse a [form_title]" |
| `meet.recording.ready` | `{user_id, meeting_id, title}` | "Enregistrement de [title] disponible" |
| `voice.transcription.completed` | `{user_id, transcription_id}` | "Transcription terminee" |

### Events emitted (by notifications service)
| Event | Payload | Description |
|-------|---------|-------------|
| `notification.created` | `{notification_id, user_id, type, title}` | New notification created |
| `notification.read` | `{notification_id, user_id}` | Notification marked as read |
| `notification.push.sent` | `{notification_id, user_id, device_count}` | Push sent |
| `notification.push.failed` | `{notification_id, user_id, error}` | Push failed |
| `notification.email.sent` | `{notification_id, user_id}` | Email sent |
| `preferences.updated` | `{user_id}` | Preferences changed (for cross-device sync) |

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Novu Documentation** (docs.novu.co) — architecture notification infrastructure, workflows, digest, preferences subscribers, self-hosting guide.
- **Knock Documentation** (docs.knock.app) — patterns de notification feeds, batching, preferences API, SDK React, workflows.
- **OneSignal Documentation** (documentation.onesignal.com) — Web Push setup, segmentation, journeys, in-app messaging, frequency capping.
- **Firebase Cloud Messaging Docs** (firebase.google.com/docs/cloud-messaging) — Web Push protocol, service worker setup, topic messaging, analytics.
- **Web Push Protocol RFC 8030** (tools.ietf.org/html/rfc8030) — specification du protocole HTTP/2 push pour les notifications web.
- **VAPID RFC 8292** (tools.ietf.org/html/rfc8292) — authentification du serveur d'application pour Web Push.
- **Notification API MDN** (developer.mozilla.org/en-US/docs/Web/API/Notification) — API standard W3C pour les notifications navigateur.
- **GitHub Notifications Docs** (docs.github.com/en/account-and-profile/managing-subscriptions-and-notifications) — patterns d'inbox, filtrage et gestion des notifications.

---

## Assertions E2E cles (a tester)

- La page /notifications affiche les notifications dans l'ordre chronologique inverse
- Le badge sur la cloche affiche le compteur exact de non lues
- Le badge se met a jour en temps reel quand une nouvelle notification arrive (WebSocket)
- Clic sur la cloche ouvre le popover avec les 10 dernieres notifications
- Clic sur "Voir tout" navigue vers /notifications
- Marquer une notification comme lue : le point bleu disparait, le fond change
- "Tout marquer comme lu" met a jour toutes les notifications de l'onglet actif
- Filtrer par onglet de service affiche uniquement les notifications du service
- Recherche dans les notifications filtre par texte
- Snooze une notification : elle disparait et reapparait a l'heure prevue
- Archiver une notification : elle disparait de l'inbox
- Toast de notification pour les priorites hautes avec bouton d'action
- Push notification recue quand l'app n'est pas ouverte (navigateur ferme)
- Push notification avec bouton d'action (Approuver/Rejeter)
- Remplacement de push (tag-based) : la nouvelle push remplace l'ancienne
- Email digest quotidien recu a l'heure configuree
- Email immediat pour les mentions directes
- Mode DND : aucun toast ni son pendant la periode
- Preferences : desactiver un type de notification par canal
- Preferences par projet : muter un projet specifique
- Heures silencieuses : pas de push entre 22h et 7h
- Groupement : 3 commentaires sur le meme document groupes en 1 notification
- Deep link : clic sur la notification navigue vers l'element source correct
- Infinite scroll : charger plus de notifications en scrollant
- Panneau lateral : clic sur une notification ouvre le detail a droite
- Actions contextuelles : menu contextuel avec marquer lu, archiver, snooze
- Admin broadcast : envoyer une notification a tous les utilisateurs
- Admin : le dashboard affiche les metriques de delivery
- WebSocket reconnexion automatique apres deconnexion
- Multi-device : marquer comme lu sur un device met a jour l'autre
- Accessibilite : navigation complete au clavier (Tab, Enter, Escape)
- Mode sombre : les couleurs des notifications respectent le theme

---

## Historique

| Date | Modification |
|---|---|
| 2026-04-09 | Creation de la specification initiale — 8 categories, benchmark 10 concurrents |
| 2026-04-10 | Enrichissement P0 : notification types detail, deep links, WebSocket protocol, toast stacking, PostgreSQL schema (12 tables), REST API (40+ endpoints), PgEventBus consumed/emitted events, admin dashboard, DND modes, preference matrix per type per channel |
