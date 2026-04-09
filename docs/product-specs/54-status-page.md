# Module Status Page — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Atlassian Statuspage** | Status pages publiques/privees, composants groupes par categorie, incidents avec timeline (investigating/identified/monitoring/resolved), maintenance planifiee, metriques systeme (uptime/latence), abonnements email/SMS/webhook, templates d'incidents, API REST, integrations PagerDuty/OpsGenie, historique 90 jours, design personnalisable (CSS/branding) |
| **UptimeRobot** | Monitoring HTTP/ping/port/keyword, status pages publiques gratuites, alertes multi-canal (email, SMS, Slack, webhook, Telegram), interval de check 5min (gratuit) a 1min (pro), maintenance windows, badges embed, API REST, logos/branding custom sur la page, 50+ moniteurs gratuits |
| **Better Stack (ex Better Uptime)** | Status pages modernes et elegantes, incident management integre avec on-call scheduling, heartbeat monitoring (cron jobs), multi-step monitors (assertions HTTP), screenshots sur erreur, Slack/Teams/PagerDuty integration, postmortem templates, SLA tracking, regions de check mondiales |
| **Cachet** | Open source (BSD-3), self-hosted, composants avec statuts (operational/degraded/partial/major), incidents avec templates, metriques custom (graphiques), abonnements email, API REST, multi-langue, personnalisation CSS, maintenance schedulee, dashboard admin separe |
| **Instatus** | Status pages rapides (statiques/JAMstack), composants groupables, incidents avec updates chronologiques, metriques third-party (Datadog, Pingdom), monitoring integre, abonnements email/RSS/webhook, branding complet, domaine custom, uptime badges, templates d'incidents predefinis |
| **Pingdom** | Monitoring synthetique (HTTP, transaction, DNS, TCP, UDP), Real User Monitoring (RUM), alertes escalation, rapports PDF automatiques, SLA reporting, root cause analysis, page speed monitoring, status pages publiques, historique uptime detaille, API REST complete |
| **Datadog Status Page** | Integration native avec Datadog monitoring/APM, status pages auto-alimentees par les monitors, composants mappes aux services, incidents auto-detectes, metriques live sur la page, personnalisation avancee, SSO, alertes intelligentes (anomaly detection), historique illimite |
| **Oh Dear** | Monitoring uptime + certificat SSL + broken links + mixed content + performance, status pages avec composants, notifications multi-canal, check toutes les minutes depuis 7 regions, API REST, maintenance windows, badge embed, domain expiry monitoring, cron job monitoring |

## Principes directeurs

1. **Verite temps reel** — la page de statut reflete l'etat reel des services SignApps tel que mesure par les health checks. Pas de mise a jour manuelle requise pour les etats automatiques. Le rafraichissement est continu (polling 10s ou WebSocket) pour que l'information affichee ne soit jamais perimee.
2. **Acces sans authentification** — la route `/status` est publique par defaut (configurable). Les utilisateurs, administrateurs et partenaires peuvent consulter l'etat des services sans se connecter. Cela reduit la charge sur le support en cas d'incident visible.
3. **Granularite par service** — chaque microservice SignApps est un composant independant avec son propre statut, sa latence mesuree et son historique d'uptime. L'etat global est calcule a partir de l'etat de chaque composant (pire etat = etat global).
4. **Historique exploitable** — les donnees d'uptime et de latence sont conservees pour permettre l'analyse de tendances, les rapports SLA et les post-mortems. L'historique est visible directement sur la page sous forme de barres de disponibilite.
5. **Incidents documentes** — les incidents sont enregistres avec une timeline (detection, investigation, identification, resolution). Chaque update est horodatee. L'historique des incidents est consultable pour comprendre les patterns de defaillance.
6. **Performances de la page** — la page de statut elle-meme doit etre ultra-rapide (< 200ms TTFB) et resiliente. Si le service principal est down, la page de statut doit rester accessible (architecture decouplees, cache agressif, rendu statique possible).

---

## Categorie 1 — Vue d'ensemble du statut

### 1.1 Bandeau d'etat global
En haut de la page, un bandeau pleine largeur affiche l'etat synthetique de la plateforme :
- **Tous les services sont en ligne** (vert, icone check) — tous les composants sont operationnels
- **Degradation partielle** (orange, icone warning) — un ou plusieurs composants sont degrades
- **Incident majeur** (rouge, icone alerte) — un ou plusieurs composants sont hors service
- **Maintenance en cours** (bleu, icone outil) — une maintenance planifiee est active

Le texte et la couleur du bandeau se mettent a jour automatiquement en fonction de l'etat reel des composants. Le titre affiche "SignApps Platform Status" avec le logo.

### 1.2 KPI Uptime global
Carte KPI affichant le pourcentage d'uptime global de la plateforme : ex. "100% Uptime global". Le calcul prend en compte tous les services monitores sur la periode selectionnee (defaut : 30 derniers jours). Formule : `(temps_total - temps_down_cumule) / temps_total * 100`. Precision a 3 decimales (ex: 99.982%).

### 1.3 Indicateur de derniere verification
Affichage du timestamp de la derniere verification des health checks : "Derniere verification : il y a 3s". Compteur qui s'incremente en temps reel entre deux checks. Bouton "Rafraichir" pour forcer une verification immediate (declenche un health check synchrone sur tous les services).

### 1.4 Compteur de rafraichissement automatique
Le rafraichissement automatique est configure a 10 secondes par defaut. Un indicateur visuel (barre de progression circulaire ou lineaire) montre le temps restant avant le prochain refresh. L'intervalle est configurable par l'administrateur : 5s, 10s, 30s, 60s. Le rafraichissement se fait par polling HTTP GET `/api/v1/status` ou par WebSocket si disponible.

### 1.5 Selecteur de periode
Boutons pour changer la periode d'affichage de l'historique : 24h, 7j, 30j, 90j. Le changement de periode recalcule l'uptime global et les barres d'historique par service. Defaut : 30 jours.

---

## Categorie 2 — Cartes de services individuels

### 2.1 Grille des services
Les services sont affiches sous forme de cartes dans une grille responsive (3 colonnes desktop, 2 tablette, 1 mobile). Chaque carte represente un microservice SignApps. L'ordre par defaut suit la numerotation des ports. Le nombre total de services monitores est affiche au-dessus de la grille.

### 2.2 Contenu d'une carte service
Chaque carte contient :
- **Nom du service** (ex: "Identity") et **port** (ex: ":3001")
- **Pastille de statut** : verte (operationnel), orange (degrade), rouge (hors service), grise (inconnu/maintenance)
- **Latence moyenne** : temps de reponse moyen du health check sur les 5 dernieres minutes (ex: "40ms")
- **Delta de latence** : variation par rapport a la moyenne des 24 dernieres heures (ex: "+5ms" en orange si hausse, "-2ms" en vert si baisse)
- **Derniere verification** : horodatage du dernier health check reussi (ex: "il y a 3s")

### 2.3 Services monitores
Liste des services exposes sur la page de statut, correspondant aux microservices actifs :
- Identity (port 3001) — authentification, sessions, RBAC
- Containers (port 3002) — gestion Docker
- Proxy (port 3003) — reverse proxy, TLS
- Storage (port 3004) — stockage fichiers
- AI (port 3005) — gateway IA
- SecureLink (port 3006) — tunnels securises
- Scheduler (port 3007) — planificateur CRON
- Metrics (port 3008) — monitoring
- Media (port 3009) — STT/TTS/OCR
- Docs (port 3010) — edition collaborative
- Calendar (port 3011) — calendrier
- Mail (port 3012) — email
- Collab (port 3013) — CRDT temps reel
- Meet (port 3014) — videoconference
- Forms (port 3015) — formulaires
- PXE (port 3016) — boot reseau
- Remote (port 3017) — bureau a distance
- Office (port 3018) — import/export bureautique
- Social (port 3019) — reseau social
- Chat (port 3020) — messagerie
- Gateway (port 3099) — API aggregator

L'administrateur peut choisir quels services apparaissent sur la page publique (toggle par service dans les parametres).

### 2.4 Calcul de la latence
La latence affichee est la moyenne arithmetique des 30 derniers health checks (5 minutes a raison d'un check toutes les 10s). Le delta compare cette moyenne a la moyenne glissante des 24h precedentes. Si un service ne repond pas dans les 5 secondes, le health check est considere comme echoue (timeout).

### 2.5 Etats d'un service
Quatre etats possibles :
- **Operationnel** (vert) : le health check repond HTTP 200 avec `status: healthy` et la latence est sous le seuil (defaut 2000ms)
- **Degrade** (orange) : le health check repond HTTP 200 mais la latence depasse le seuil configurable, ou le service retourne `status: degraded`
- **Hors service** (rouge) : le health check echoue (timeout, erreur HTTP, connexion refusee) 3 fois consecutives
- **Maintenance** (gris/bleu) : une maintenance planifiee est en cours pour ce service

### 2.6 Groupement par categorie
Les services peuvent etre groupes par categorie pour faciliter la lecture : "Infrastructure" (Proxy, Gateway, Metrics, PXE), "Communication" (Mail, Chat, Meet, Collab, Notifications), "Productivite" (Docs, Calendar, Forms, Office, Spreadsheet), "Stockage & Media" (Storage, Media, Drive), "IA & Securite" (AI, SecureLink, Remote, Identity). Chaque groupe a un titre et un indicateur de sante agrege.

---

## Categorie 3 — Graphique de trafic et metriques visuelles

### 3.1 Graphique de trafic global
Sous les cartes de services, un graphique en courbe affiche le trafic agrege de la plateforme sur la periode selectionnee. Axe X : timestamps (horodatage). Axe Y : nombre de requetes par seconde ou par minute. La courbe montre les pics et creux de charge. Tooltip au survol avec la valeur exacte et l'horodatage.

### 3.2 Graphique de latence par service
Graphique multi-courbes (une courbe par service) montrant l'evolution de la latence dans le temps. Legende interactive : clic sur un service pour le masquer/afficher. Utile pour identifier les correlations entre les latences de differents services.

### 3.3 Barres d'uptime historique
Pour chaque service, une barre horizontale segmentee affiche l'historique d'uptime jour par jour sur 90 jours. Chaque segment represente un jour : vert (100% up), orange (degradation), rouge (incident), gris (pas de donnees). Au survol d'un segment : date, pourcentage d'uptime, nombre d'incidents. Format inspire d'Atlassian Statuspage et GitHub Status.

### 3.4 Sparklines par service
Dans chaque carte de service, une mini-courbe (sparkline) affiche la tendance de latence sur les 60 dernieres minutes. Pas d'axes ni de labels — juste la forme de la courbe pour donner une indication visuelle rapide de la stabilite ou de la volatilite.

### 3.5 Metriques de temps de reponse (percentiles)
Section optionnelle (expandable) affichant les percentiles de latence par service : p50 (mediane), p95, p99. Tableau ou graphique en barres horizontales. Utile pour distinguer la latence typique de la latence en cas de charge.

---

## Categorie 4 — Incidents et historique

### 4.1 Timeline des incidents
Section "Incidents recents" sous les metriques. Liste chronologique inverse des incidents :
- **Titre** : resume de l'incident (ex: "Latence elevee sur le service AI")
- **Statut** : Investigating / Identified / Monitoring / Resolved
- **Date de debut** et **duree** (ou "en cours" si actif)
- **Services impactes** : liste des services concernes
- **Severite** : Mineure (orange), Majeure (rouge), Critique (rouge clignotant)

### 4.2 Detail d'un incident
Clic sur un incident ouvre la timeline detaillee avec les updates chronologiques :
- `14:30 — Investigating` : "Nous avons detecte une latence elevee sur le service AI (port 3005). Investigation en cours."
- `14:45 — Identified` : "Cause identifiee : charge excessive sur le modele LLM. Scaling en cours."
- `15:00 — Monitoring` : "Le scaling a ete applique. Nous monitorons la stabilite."
- `15:30 — Resolved` : "La latence est revenue a la normale. L'incident est clos."

Chaque update est horodatee et signee (auteur ou "systeme" si automatique).

### 4.3 Creation d'incident manuel
L'administrateur peut creer un incident manuellement depuis le dashboard admin : titre, description, services impactes, severite. Le systeme peut aussi creer des incidents automatiquement lorsqu'un service passe en etat "hors service" pendant plus de N minutes (configurable, defaut 5 min).

### 4.4 Notification d'incident
Lorsqu'un incident est cree ou mis a jour, les utilisateurs abonnes recoivent une notification :
- Notification in-app (toujours)
- Email (si configure)
- Webhook (Slack, Teams, Discord — si configure)
Les abonnements sont geres par l'utilisateur depuis la page de statut (bouton "S'abonner aux notifications").

### 4.5 Post-mortem
Apres la resolution d'un incident majeur, l'administrateur peut rediger un post-mortem attache a l'incident : cause racine, impact, timeline, actions correctives, mesures preventives. Le post-mortem est visible sur la page de statut pour les incidents publics.

### 4.6 Historique des incidents
Archive consultable de tous les incidents passes avec filtres : par periode, par service, par severite, par statut. Pagination. Export CSV. Utile pour les rapports SLA et les audits de fiabilite.

---

## Categorie 5 — Maintenance planifiee

### 5.1 Planification de maintenance
L'administrateur peut creer une maintenance planifiee :
- **Titre** (ex: "Mise a jour PostgreSQL")
- **Description** (details de l'intervention)
- **Date/heure de debut** et **date/heure de fin estimee**
- **Services impactes** (multi-selection)
- **Impact attendu** : aucun (maintenance transparente), degradation partielle, interruption complete

### 5.2 Affichage sur la page de statut
Les maintenances planifiees a venir sont affichees dans une section dedicee "Maintenances planifiees" :
- Titre, date/heure, duree estimee, services concernes
- Compte a rebours si la maintenance est dans moins de 24h
- Pendant la maintenance, les services concernes affichent l'etat "Maintenance" (bleu/gris)

### 5.3 Notification de maintenance
Les utilisateurs abonnes recoivent une notification 24h avant et 1h avant la maintenance. Notification supplementaire au debut et a la fin de la maintenance. Canaux : in-app, email, webhook (configurables).

### 5.4 Suppression des alertes pendant la maintenance
Pendant une fenetre de maintenance, les alertes automatiques sont supprimees pour les services concernes. Les health checks continuent mais les passages en "hors service" ne declenchent pas d'incident automatique ni de notification d'alerte. L'etat "Maintenance" est prioritaire sur les autres etats.

---

## Categorie 6 — Configuration et administration

### 6.1 Configuration des health checks
Dans le panneau d'administration, chaque service a sa configuration de health check :
- **URL du endpoint** : defaut `/health` (personnalisable)
- **Intervalle** : frequence des checks (defaut 10s, min 5s, max 300s)
- **Timeout** : duree avant echec (defaut 5000ms)
- **Seuil de degradation** : latence au-dela de laquelle le service est marque "degrade" (defaut 2000ms)
- **Echecs consecutifs avant down** : nombre de checks echoues avant de passer en "hors service" (defaut 3)

### 6.2 Visibilite des services
Toggle par service pour le rendre visible ou invisible sur la page de statut publique. Les services internes (Metrics, PXE, Gateway) peuvent etre masques pour les utilisateurs non-admin. L'admin voit tous les services, les utilisateurs publics ne voient que les services actives.

### 6.3 Personnalisation de la page
Options de personnalisation dans l'admin :
- **Logo** : upload du logo affiche en haut de la page
- **Titre** : texte affiche (defaut "SignApps Platform Status")
- **Couleurs** : palette personnalisable ou theme par defaut
- **URL** : sous-domaine ou chemin (defaut `/status`)
- **Acces** : publique (sans auth) ou restreint (auth requise)
- **Langue** : francais (defaut), anglais, multilingue

### 6.4 API de statut
Endpoint REST `GET /api/v1/status` retournant le statut de tous les services en JSON :
```json
{
  "status": "operational",
  "updated_at": "2026-04-09T14:30:00Z",
  "services": [
    {
      "name": "Identity",
      "port": 3001,
      "status": "operational",
      "latency_ms": 40,
      "latency_delta_ms": 5,
      "last_check": "2026-04-09T14:29:57Z",
      "uptime_30d": 99.998
    }
  ]
}
```
L'API est utilisee par la page de statut frontend et peut etre consommee par des outils tiers (monitoring externe, dashboards custom).

### 6.5 Webhook entrant pour statut externe
Endpoint `POST /api/v1/status/webhook` permettant a des services externes de reporter leur statut. Payload JSON avec le nom du service, le statut et des metriques optionnelles. Authentification par token API. Utile pour les services non-SignApps inclus dans la page de statut.

### 6.6 Export et rapports
Export du rapport de disponibilite :
- **PDF** : rapport mensuel avec uptime par service, incidents, metriques cles
- **CSV** : donnees brutes d'uptime et de latence par service et par jour
- **JSON** : memes donnees en format machine-readable
Generation automatique mensuelle envoyee par email aux administrateurs (configurable).

---

## Categorie 7 — Abonnements et notifications

### 7.1 Bouton d'abonnement
Sur la page de statut publique, un bouton "S'abonner aux mises a jour" ouvre un formulaire :
- **Email** : adresse pour recevoir les notifications
- **Services** : selection des services a surveiller (tous par defaut)
- **Types** : incidents, maintenances, resolutions (tous par defaut)
Confirmation par email. Lien de desabonnement dans chaque notification.

### 7.2 Flux RSS/Atom
Flux RSS disponible sur `/status/feed.xml` avec les derniers incidents et maintenances. Compatible avec tous les lecteurs RSS. Mis a jour en temps reel.

### 7.3 Badge embed
Widget embedable pour les sites externes : `<iframe>` ou image SVG dynamique affichant l'etat actuel ("All systems operational" vert ou "Incident in progress" rouge). URL : `/status/badge.svg`. Parametres : taille, style (flat, plastic, for-the-badge).

### 7.4 Integration Slack/Teams/Discord
Configuration de webhooks sortants pour les canaux de communication :
- **Slack** : message formate avec blocs (couleur, titre, description, services, lien)
- **Teams** : carte adaptive avec les memes informations
- **Discord** : embed riche avec couleur et champs
Configurable par type d'evenement (incident cree, update, resolu, maintenance).

---

## Categorie 8 — Architecture backend

### 8.1 Health check engine
Le moteur de health check tourne dans le service `signapps-metrics` (port 3008). Il execute un `GET /health` sur chaque service a l'intervalle configure. Le resultat (statut HTTP, body JSON, latence, timestamp) est stocke dans PostgreSQL (`service_health_checks` table). Le moteur utilise `reqwest` (MIT/Apache-2.0) avec un timeout configurable.

### 8.2 Calcul d'etat
L'etat de chaque service est calcule a partir des N derniers health checks :
- Si les 3 derniers checks sont OK → Operationnel
- Si le dernier check est OK mais la latence depasse le seuil → Degrade
- Si les 3 derniers checks echouent → Hors service
L'etat global est le pire etat parmi tous les services visibles.

### 8.3 Stockage des metriques
Table `service_health_checks` :
- `id` (UUID), `service_name` (VARCHAR), `port` (INT), `status` (ENUM: ok, degraded, down, timeout), `latency_ms` (INT), `response_code` (INT NULL), `error_message` (TEXT NULL), `checked_at` (TIMESTAMPTZ)
Index sur `(service_name, checked_at)`. Retention configurable (defaut 90 jours). Purge automatique via le scheduler.

### 8.4 Incidents automatiques
Lorsqu'un service passe en etat "hors service" et y reste pendant plus de 5 minutes (configurable), un incident est cree automatiquement avec :
- Titre : "Service {name} hors service"
- Description : "Le service {name} (port {port}) ne repond plus depuis {duration}"
- Services impactes : [{name}]
- Severite : Majeure (auto-escalade en Critique apres 30 min)
L'incident est automatiquement resolu lorsque le service repasse en etat operationnel.

### 8.5 Cache et resilience
La page de statut utilise un cache agressif (moka, TTL 10s) pour eviter de surcharger la base de donnees. Si le service `signapps-metrics` est indisponible, le frontend affiche le dernier etat connu avec un bandeau "Donnees potentiellement obsoletes". La page est pre-rendue statiquement (ISR Next.js) pour garantir la disponibilite meme en cas de panne backend.

---

## References OSS

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Cachet** (github.com/cachethq/cachet) | **BSD-3-Clause** | Architecture de status page self-hosted : composants, incidents avec timeline, metriques, abonnements. Modele de donnees de reference. |
| **cstate** (github.com/cstate/cstate) | **MIT** | Status page statique (Hugo). Pattern pour les pages ultra-rapides et resilientes. Incidents en fichiers Markdown. |
| **Gatus** (github.com/TwiN/gatus) | **Apache-2.0** | Health check engine en Go. Pattern pour le monitoring d'endpoints avec conditions configurables (status code, response time, body content). |
| **Vigil** (github.com/valeriansaliou/vigil) | **MPL-2.0** | Status page en Rust. Pattern pour le monitoring de microservices avec probe HTTP/TCP. Architecture proche de notre stack. |
| **upptime** (github.com/upptime/upptime) | **MIT** | Status page alimentee par GitHub Actions. Pattern pour l'historique d'uptime et les graphiques de disponibilite. |
| **Statusfy** (github.com/juliomrqz/statusfy) | **Apache-2.0** | Status page avec incidents, maintenance, notifications. Pattern pour l'UX de la timeline d'incidents. |
| **reqwest** (github.com/seanmonstar/reqwest) | **MIT/Apache-2.0** | Client HTTP Rust async. Deja utilise dans l'ecosysteme. Base pour les health checks HTTP. |
| **moka** (github.com/moka-rs/moka) | **MIT/Apache-2.0** | Cache concurrent Rust avec TTL. Deja utilise dans signapps-cache. Pour le cache des resultats de health check. |
| **Recharts** (github.com/recharts/recharts) | **MIT** | Graphiques React declaratifs. Pour les courbes de latence, sparklines et barres d'uptime. |
| **Chart.js** (github.com/chartjs/Chart.js) | **MIT** | Graphiques canvas. Pour le graphique de trafic et les sparklines. |

---

## Assertions E2E cles (a tester)

- La page `/status` est accessible sans authentification
- Le bandeau affiche "Tous les services sont en ligne" quand tous les services repondent
- Le KPI "100% Uptime global" affiche un pourcentage coherent
- Le rafraichissement automatique met a jour les donnees toutes les 10 secondes
- Le bouton "Rafraichir" force une mise a jour immediate des health checks
- Chaque carte de service affiche le nom, le port, la latence et le statut
- Le service Identity (port 3001) affiche une latence coherente (ex: ~40ms)
- Le service AI (port 3005) affiche une latence plus elevee (ex: ~979ms) refletant le traitement IA
- Le delta de latence affiche une fleche verte (baisse) ou orange (hausse)
- La pastille de statut est verte pour un service operationnel
- La pastille de statut passe a rouge quand un service est arrete
- L'etat global passe a "Degradation partielle" quand un service est degrade
- L'etat global passe a "Incident majeur" quand un service est hors service
- Le graphique de trafic affiche des courbes avec des timestamps corrects
- Les barres d'uptime historique affichent 90 jours de segments colores
- La section incidents affiche les incidents recents avec titre, statut et duree
- Un incident automatique est cree quand un service reste down plus de 5 minutes
- L'incident automatique est resolu quand le service revient en ligne
- La maintenance planifiee apparait dans la section "Maintenances planifiees"
- Les services en maintenance affichent l'etat bleu/gris "Maintenance"
- Le selecteur de periode (24h, 7j, 30j, 90j) recalcule les metriques
- Le formulaire d'abonnement accepte un email et envoie une confirmation
- L'API `/api/v1/status` retourne un JSON avec le statut de tous les services
- Le badge embed `/status/badge.svg` affiche l'etat correct
- L'admin peut masquer un service de la page publique via le toggle de visibilite
- L'admin peut creer un incident manuel avec titre, description et services impactes
- Le post-mortem est visible sur la page de statut apres resolution d'un incident
- Le flux RSS `/status/feed.xml` contient les derniers incidents
- La page reste accessible (dernier etat connu) si le backend est temporairement indisponible
- Le mode responsive affiche 1 colonne sur mobile, 2 sur tablette, 3 sur desktop
