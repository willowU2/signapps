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
6. **Performances de la page** — la page de statut elle-meme doit etre ultra-rapide (< 200ms TTFB) et resiliente. Si le service principal est down, la page de statut doit rester accessible (architecture decouplee, cache agressif, rendu statique possible).

---

## Categorie 1 — Vue d'ensemble du statut

### 1.1 Bandeau d'etat global
En haut de la page, un bandeau pleine largeur affiche l'etat synthetique de la plateforme :
- **Tous les services sont en ligne** (vert, icone check) — tous les composants sont operationnels
- **Degradation partielle** (orange, icone warning) — un ou plusieurs composants sont degrades
- **Incident majeur** (rouge, icone alerte) — un ou plusieurs composants sont hors service
- **Maintenance en cours** (bleu, icone outil) — une maintenance planifiee est active

Le texte et la couleur du bandeau se mettent a jour automatiquement en fonction de l'etat reel des composants. Le titre affiche "SignApps Platform Status" avec le logo. Transition animee (fade 300ms) lors du changement d'etat pour eviter un flash visuel brutal. Le bandeau utilise les tokens semantiques Tailwind : `bg-green-500` (operationnel), `bg-amber-500` (degrade), `bg-red-500` (incident), `bg-blue-500` (maintenance).

### 1.2 KPI Uptime global
Carte KPI affichant le pourcentage d'uptime global de la plateforme : ex. "100% Uptime global". Le calcul prend en compte tous les services monitores sur la periode selectionnee (defaut : 30 derniers jours). Formule : `(temps_total - temps_down_cumule) / temps_total * 100`. Precision a 3 decimales (ex: 99.982%). Si l'uptime est inferieur a 99.9%, la couleur passe de verte a orange. Inferieur a 99.0%, elle passe a rouge. Le KPI affiche aussi le delta par rapport a la periode precedente (ex: "+0.003% vs mois precedent").

### 1.3 Indicateur de derniere verification
Affichage du timestamp de la derniere verification des health checks : "Derniere verification : il y a 3s". Compteur qui s'incremente en temps reel entre deux checks avec `setInterval(1000)`. Le texte passe en orange si le dernier check date de plus de 30s (signe que le polling est bloque). Bouton "Rafraichir" pour forcer une verification immediate (declenche un `POST /api/v1/status/refresh` qui execute un health check synchrone sur tous les services et retourne le resultat en une seule reponse). Le bouton affiche un spinner pendant l'appel et est desactive pour eviter le spam (cooldown 5s).

### 1.4 Compteur de rafraichissement automatique
Le rafraichissement automatique est configure a 10 secondes par defaut. Un indicateur visuel (barre de progression lineaire fine sous le bandeau) montre le temps restant avant le prochain refresh. Quand la barre atteint 100%, un `GET /api/v1/status` est appele et les donnees sont mises a jour sans rechargement de page (React state update). L'intervalle est configurable par l'administrateur : 5s, 10s, 30s, 60s dans `/admin/monitoring/settings`. Si le navigateur perd le focus (tab inactive), le polling passe a 60s pour economiser les ressources. Au retour du focus, un refresh immediat est execute et le polling reprend a l'intervalle normal.

### 1.5 Selecteur de periode
Boutons pour changer la periode d'affichage de l'historique : 24h, 7j, 30j, 90j, 365j. Le changement de periode recalcule l'uptime global et les barres d'historique par service. Defaut : 30 jours. Le bouton selectionne a un style `bg-primary text-primary-foreground`, les autres `bg-muted text-muted-foreground`. Le changement de periode ajoute un query param `?period=30d` dans l'URL pour permettre le partage de liens. Le recalcul est instantane cote backend car les donnees sont pre-agregees par jour dans la table `metrics.service_uptime_daily`.

### 1.6 Mode public vs prive
La page de statut existe en deux modes :
- **Mode public** (`/status`) : accessible sans authentification. Affiche les services visibles, l'uptime, les incidents publics et les maintenances. Aucune donnee sensible (pas d'IP, pas de logs d'erreur, pas de noms d'utilisateurs). Le footer affiche "Powered by SignApps".
- **Mode prive** (`/admin/monitoring`) : accessible uniquement aux administrateurs authentifies. Affiche tous les services (meme masques), les logs d'erreur detailles de chaque health check, le bouton de creation d'incident, la configuration des seuils, les metriques avancees (p50/p95/p99, trafic, CPU/RAM). Lien "Voir la page publique" pour basculer.

L'administrateur configure le mode dans `/admin/monitoring/settings` : toggle "Page de statut publique" (defaut : active). Si desactivee, `/status` retourne un 404.

---

## Categorie 2 — Cartes de services individuels

### 2.1 Grille des services
Les services sont affiches sous forme de cartes dans une grille responsive (3 colonnes desktop, 2 tablette, 1 mobile). Chaque carte represente un microservice SignApps. L'ordre par defaut suit la numerotation des ports. Le nombre total de services monitores est affiche au-dessus de la grille : "21 services monitores". La grille utilise `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`. Chaque carte a un effet `hover:shadow-md transition-shadow duration-200` pour le feedback visuel. Clic sur une carte ouvre un panneau lateral (sheet) avec les details avances du service.

### 2.2 Contenu d'une carte service
Chaque carte contient :
- **Nom du service** (ex: "Identity") en `text-lg font-semibold` et **port** (ex: ":3001") en `text-muted-foreground text-sm`
- **Pastille de statut** : cercle 12px avec couleur — verte `bg-green-500` (operationnel), orange `bg-amber-500` (degrade), rouge `bg-red-500` (hors service), grise `bg-muted` (inconnu/maintenance). Animation `animate-pulse` sur la pastille quand le statut est "hors service" pour attirer l'attention.
- **Latence moyenne** : temps de reponse moyen du health check sur les 5 dernieres minutes (ex: "40ms"). Affiche en `font-mono text-sm`. Couleur verte si < 500ms, orange si 500-2000ms, rouge si > 2000ms.
- **Delta de latence** : variation par rapport a la moyenne des 24 dernieres heures (ex: "+5ms" en orange si hausse > 20%, "-2ms" en vert si baisse). Icone fleche vers le haut (hausse) ou vers le bas (baisse). Pas d'affichage si delta < 5%.
- **Sparkline** : mini-courbe de latence sur les 60 derniers points de donnees (10 minutes a 1 check/10s). Hauteur 24px, largeur 100%. Couleur du trait : meme que la pastille de statut. Pas d'axes, pas de labels. Rendu via SVG inline (pas de librairie externe pour la performance).
- **Percentiles de latence** : ligne sous la sparkline affichant `p50: 38ms | p95: 120ms | p99: 450ms` en `text-xs text-muted-foreground font-mono`. Calcules sur les 30 derniers checks.
- **Derniere verification** : horodatage du dernier health check reussi (ex: "il y a 3s") en `text-xs text-muted-foreground`. Format relatif pour les checks < 5min, absolu au-dela (ex: "14:30:07").
- **Uptime** : pourcentage d'uptime sur la periode selectionnee (ex: "99.98%") affiche en gras. Couleur verte si >= 99.9%, orange si >= 99.0%, rouge si < 99.0%.

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

L'administrateur peut choisir quels services apparaissent sur la page publique (toggle par service dans `/admin/monitoring/settings`). Par defaut, les services internes (Metrics, PXE, Gateway) sont masques sur la page publique mais visibles sur le dashboard admin.

### 2.4 Health check polling mechanism
Le service `signapps-metrics` (port 3008) est responsable du polling de tous les health checks. Le mecanisme fonctionne comme suit :
1. Au demarrage, le service charge la liste des services depuis la table `metrics.monitored_services`.
2. Un `tokio::spawn` lance une boucle infinie qui, toutes les 10 secondes (configurable), execute un health check sur chaque service en parallele (`tokio::join_all`).
3. Pour chaque service, un `GET http://localhost:{port}/health` est execute via `reqwest` avec un timeout de 5000ms.
4. La reponse attendue est un JSON `{ "status": "healthy" }` avec HTTP 200. Le service peut aussi retourner `{ "status": "degraded", "details": "high memory usage" }` pour signaler une degradation sans panne.
5. Le resultat (status HTTP, body, latence en ms, timestamp) est insere dans `metrics.service_health_checks`.
6. Si la connexion est refusee, le check echoue avec `status = 'connection_refused'`. Si le timeout est atteint, `status = 'timeout'`.
7. Apres chaque cycle de checks, l'etat de chaque service est recalcule et mis en cache dans `signapps-cache` (moka, TTL 10s) pour les requetes API.

### 2.5 Calcul de la latence
La latence affichee est la moyenne arithmetique des 30 derniers health checks (5 minutes a raison d'un check toutes les 10s). Le delta compare cette moyenne a la moyenne glissante des 24h precedentes. Si un service ne repond pas dans les 5 secondes, le health check est considere comme echoue (timeout). Les percentiles (p50, p95, p99) sont calcules sur les memes 30 derniers checks avec l'algorithme de tri partiel (select Nth). La sparkline affiche les 60 derniers points de latence (10 minutes). Les points d'echec (timeout ou erreur) sont representes par un gap dans la sparkline (pas de point trace) pour signaler visuellement l'interruption.

### 2.6 Etats d'un service
Quatre etats possibles :
- **Operationnel** (vert) : le health check repond HTTP 200 avec `status: healthy` et la latence est sous le seuil (defaut 2000ms)
- **Degrade** (orange) : le health check repond HTTP 200 mais la latence depasse le seuil configurable, ou le service retourne `status: degraded`
- **Hors service** (rouge) : le health check echoue (timeout, erreur HTTP, connexion refusee) 3 fois consecutives
- **Maintenance** (gris/bleu) : une maintenance planifiee est en cours pour ce service

La transition entre etats suit une machine a etats stricte : un service ne passe en "hors service" qu'apres 3 echecs consecutifs (evite les faux positifs sur un check isole). Il repasse en "operationnel" des le premier check reussi apres une panne. La transition "degrade" -> "operationnel" necessite aussi 3 checks consecutifs sous le seuil de latence (evite le yoyo).

### 2.7 Groupement par categorie
Les services peuvent etre groupes par categorie pour faciliter la lecture :
- **Infrastructure** : Proxy, Gateway, Metrics, PXE, Containers
- **Communication** : Mail, Chat, Meet, Collab, Social
- **Productivite** : Docs, Calendar, Forms, Office
- **Stockage & Media** : Storage, Media
- **IA & Securite** : AI, SecureLink, Remote, Identity, Scheduler

Chaque groupe a un titre en `text-sm font-medium text-muted-foreground uppercase tracking-wide` et un indicateur de sante agrege (pastille du pire etat du groupe). L'administrateur peut reorganiser les groupes et les assignations dans `/admin/monitoring/settings`. Le groupement est desactive par defaut sur la page publique (liste plate) et active sur le dashboard admin.

### 2.8 Detail lateral d'un service
Clic sur une carte ouvre un panneau lateral (`Sheet` shadcn/ui, ouverture depuis la droite, largeur 480px) avec les details avances :
- Nom complet et port
- Statut actuel avec historique des 10 dernieres transitions d'etat (horodatees)
- Graphique de latence sur 24h (courbe avec axe Y en ms, axe X en heures)
- Percentiles p50/p95/p99 sur 24h, 7j, 30j
- Barre d'uptime 90 jours (voir section 3.3)
- Derniers 5 incidents associes a ce service (avec lien vers le detail)
- Bouton "Voir les logs" (admin uniquement) : affiche les 20 derniers resultats de health check bruts (JSON)
- Bouton "Desactiver le monitoring" (admin uniquement)

Raccourci clavier : `Escape` ferme le panneau.

---

## Categorie 3 — Graphique de trafic et metriques visuelles

### 3.1 Graphique de trafic global
Sous les cartes de services, un graphique en courbe affiche le trafic agrege de la plateforme sur la periode selectionnee. Axe X : timestamps (horodatage). Axe Y : nombre de requetes par seconde ou par minute (auto-adaptatif selon la periode : requetes/seconde pour 24h, requetes/minute pour 7j+). La courbe montre les pics et creux de charge. Tooltip au survol avec la valeur exacte et l'horodatage. Rendu avec Recharts (`AreaChart` avec gradient fill sous la courbe). Couleur : `hsl(var(--primary))`. Les donnees proviennent de `metrics.request_counts_aggregated` pre-calcule par le scheduler toutes les heures.

### 3.2 Graphique de latence par service
Graphique multi-courbes (une courbe par service) montrant l'evolution de la latence dans le temps. Legende interactive : clic sur un service dans la legende pour le masquer/afficher. Tooltip multi-valeur au survol (affiche la latence de chaque service a ce timestamp). Utile pour identifier les correlations entre les latences de differents services (ex: degradation AI entraine degradation Gateway). Par defaut, seuls les 5 services les plus lents sont affiches (les autres masques). Rendu avec Recharts `LineChart`. Chaque courbe a une couleur distincte generee a partir d'une palette categorielle de 21 couleurs.

### 3.3 Barres d'uptime historique
Pour chaque service, une barre horizontale segmentee affiche l'historique d'uptime jour par jour sur la periode selectionnee (defaut 90 jours). Chaque segment represente un jour : vert `bg-green-500` (100% up), jaune `bg-amber-400` (99-99.99% — degradation mineure), orange `bg-amber-500` (95-99% — degradation significative), rouge `bg-red-500` (< 95% — incident majeur), gris `bg-muted` (pas de donnees). Au survol d'un segment : tooltip avec date, pourcentage d'uptime, nombre d'incidents, duree de downtime cumule. Format inspire d'Atlassian Statuspage et GitHub Status. Les barres sont rendues comme une serie de `<div>` de 2px de large avec `gap-px` entre chaque segment. Pour la periode 365j, les segments sont groupes par semaine.

### 3.4 Sparklines par service
Dans chaque carte de service, une mini-courbe (sparkline) affiche la tendance de latence sur les 60 derniers points de donnees (10 minutes). Pas d'axes ni de labels — juste la forme de la courbe pour donner une indication visuelle rapide de la stabilite ou de la volatilite. Rendu en SVG inline : un `<polyline>` de 60 points sur une viewBox de `0 0 120 24`. Couleur du trait identique a la pastille de statut du service. Epaisseur du trait : 1.5px. Les points manquants (echecs) sont representes par un gap (pas de segment trace a ce point).

### 3.5 Metriques de temps de reponse (percentiles)
Section optionnelle (expandable via un chevron) affichant les percentiles de latence par service dans un tableau :
| Service | p50 | p95 | p99 | Avg | Max |
|---------|-----|-----|-----|-----|-----|
| Identity | 38ms | 120ms | 450ms | 42ms | 512ms |
| AI | 340ms | 1200ms | 2100ms | 480ms | 3200ms |

Le tableau est triable par colonne. Les cellules sont colorees : vert < 200ms, orange 200-1000ms, rouge > 1000ms. Les percentiles sont calcules sur la periode selectionnee. Sur la page publique, cette section est masquee par defaut (clic "Afficher les metriques detaillees" pour reveler).

### 3.6 Graphiques d'uptime historique longue duree
Trois graphiques d'uptime pre-configures :
- **30 derniers jours** : barre quotidienne de disponibilite (comme section 3.3 mais en grand format, une barre par service empilee verticalement)
- **90 derniers jours** : meme format, echelle hebdomadaire
- **365 derniers jours** : meme format, echelle mensuelle

Chaque graphique affiche le SLA atteint pour la periode : "99.98% SLA sur 30 jours". Si un SLA cible est configure par l'admin (ex: 99.95%), un indicateur vert "SLA atteint" ou rouge "SLA non atteint" est affiche. Les donnees sont stockees dans `metrics.service_uptime_daily` et agregees a la volee pour les periodes hebdomadaires et mensuelles.

---

## Categorie 4 — Incidents et historique

### 4.1 Timeline des incidents
Section "Incidents recents" sous les metriques. Liste chronologique inverse des incidents :
- **Titre** : resume de l'incident (ex: "Latence elevee sur le service AI")
- **Statut** : Investigating / Identified / Monitoring / Resolved — affiche dans un badge colore (rouge / orange / bleu / vert)
- **Date de debut** et **duree** (ou "en cours" si actif avec un compteur en temps reel)
- **Services impactes** : liste des services concernes sous forme de chips avec leur pastille de statut
- **Severite** : Mineure (badge orange), Majeure (badge rouge), Critique (badge rouge avec icone alerte)
- **Derniere mise a jour** : horodatage et resume du dernier update

Par defaut, les 10 derniers incidents sont affiches. Bouton "Voir tous les incidents" pour acceder a l'historique complet. Les incidents en cours sont toujours affiches en premier, avec un bandeau "Incident en cours" orange/rouge.

### 4.2 Detail d'un incident
Clic sur un incident ouvre une page dediee `/status/incidents/{id}` avec la timeline detaillee des updates chronologiques :
- `14:30 — Investigating` : "Nous avons detecte une latence elevee sur le service AI (port 3005). Investigation en cours."
- `14:45 — Identified` : "Cause identifiee : charge excessive sur le modele LLM. Scaling en cours."
- `15:00 — Monitoring` : "Le scaling a ete applique. Nous monitorons la stabilite."
- `15:30 — Resolved` : "La latence est revenue a la normale. L'incident est clos."

Chaque update est horodatee et signee (auteur "admin@signapps" ou "systeme" si automatique). La timeline est rendue avec une ligne verticale a gauche et des points colores a chaque etape (Investigating = rouge, Identified = orange, Monitoring = bleu, Resolved = vert). Le titre de l'incident, la severite, les services impactes et la duree totale sont affiches en en-tete. Un lien "Revenir a la page de statut" en haut.

### 4.3 Creation d'incident manuel
L'administrateur peut creer un incident manuellement depuis le dashboard admin (`/admin/monitoring`) via le bouton "Declarer un incident" :
- **Titre** (requis) : resume court de l'incident (max 200 caracteres)
- **Description** (requis) : details de l'impact et de la situation (rich text, max 5000 caracteres)
- **Severite** : Mineure / Majeure / Critique (radio buttons)
- **Services impactes** : multi-select parmi les services monitores
- **Statut initial** : Investigating (defaut) / Identified / Monitoring
- **Notifier les abonnes** : checkbox (defaut : coche)

A la soumission, l'incident est cree dans `metrics.incidents` et un premier update est insere dans `metrics.incident_updates`. Les notifications sont envoyees aux abonnes si la checkbox est cochee.

Le systeme peut aussi creer des incidents automatiquement lorsqu'un service passe en etat "hors service" pendant plus de N minutes (configurable, defaut 5 min). L'incident automatique a un titre genere ("Service {name} hors service depuis {duration}"), une severite Majeure (auto-escalade en Critique apres 30 min), et un update initial automatique.

### 4.4 Mise a jour d'un incident
L'administrateur peut ajouter des updates a un incident en cours via le bouton "Ajouter une mise a jour" sur la page de detail :
- **Statut** : dropdown Investigating / Identified / Monitoring / Resolved
- **Message** : texte de la mise a jour (requis, max 5000 caracteres)
- **Notifier les abonnes** : checkbox (defaut : coche)

Chaque update est insere dans `metrics.incident_updates` avec le timestamp et l'auteur. Passer le statut a "Resolved" ferme l'incident : la duree totale est calculee, les services impactes repassent a leur etat de health check actuel, et un lien "Rediger le post-mortem" est propose.

### 4.5 Notification d'incident
Lorsqu'un incident est cree ou mis a jour, les utilisateurs abonnes recoivent une notification :
- **Notification in-app** (toujours) : toast + badge sur l'icone monitoring
- **Email** : objet "[SignApps Status] {severite} — {titre}". Corps : description, services impactes, lien vers la page de statut. Template HTML responsive (react-email).
- **Webhook** : payload JSON envoye aux URLs configurees (Slack, Teams, Discord). Le payload contient `incident_id`, `title`, `severity`, `status`, `services`, `message`, `timestamp`, `url`. Pour Slack : format Block Kit avec couleur de la barre laterale selon la severite. Pour Teams : carte adaptative. Pour Discord : embed riche.

Les abonnements sont geres par l'utilisateur depuis la page de statut (bouton "S'abonner aux notifications"). Chaque email contient un lien de desabonnement en un clic.

### 4.6 Post-mortem
Apres la resolution d'un incident majeur ou critique, l'administrateur peut rediger un post-mortem attache a l'incident via le bouton "Rediger le post-mortem" :
- **Cause racine** : texte libre (requis)
- **Impact** : description de l'impact sur les utilisateurs (requis)
- **Timeline detaillee** : pre-remplie depuis les updates de l'incident (editable)
- **Actions correctives** : liste des actions prises pour resoudre (requis)
- **Mesures preventives** : liste des mesures pour eviter la recurrence (requis)

Le post-mortem est stocke dans `metrics.incident_postmortems`. Il est visible sur la page de detail de l'incident pour les incidents publics. Le post-mortem peut etre publie immediatement ou en brouillon (relecture avant publication). Il est aussi inclus dans le flux RSS.

### 4.7 Historique des incidents
Archive consultable de tous les incidents passes a `/status/incidents` :
- Filtres : par periode (date debut/fin), par service, par severite, par statut (tous, resolus, non resolus)
- Tri : par date de debut (defaut, decroissant), par duree, par severite
- Pagination : 20 incidents par page
- Export CSV : toutes les colonnes (id, titre, severite, services, debut, fin, duree, nombre d'updates, a_postmortem)
- Recherche textuelle sur le titre et la description

Utile pour les rapports SLA, les audits de fiabilite et l'identification de patterns recurrents.

---

## Categorie 5 — Maintenance planifiee

### 5.1 Planification de maintenance
L'administrateur peut creer une maintenance planifiee depuis `/admin/monitoring` via le bouton "Planifier une maintenance" :
- **Titre** (requis, ex: "Mise a jour PostgreSQL v16.3")
- **Description** (requis, details de l'intervention : operations prevues, impact attendu, contacts)
- **Date/heure de debut** et **date/heure de fin estimee** (date pickers avec selecteur d'heure par paliers de 15 min)
- **Services impactes** (multi-selection parmi les services monitores)
- **Impact attendu** : radio buttons — aucun (maintenance transparente), degradation partielle, interruption complete
- **Recurrence** (optionnel) : pour les maintenances regulieres (ex: "chaque dimanche de 2h a 4h")
- **Notifier les abonnes** : checkbox avec options de timing (24h avant, 1h avant, au debut, a la fin)

Validation : la date de debut doit etre dans le futur. La date de fin doit etre apres la date de debut. Duree maximale : 72h. Le formulaire refuse la creation si un incident est en cours sur les memes services.

### 5.2 Affichage sur la page de statut
Les maintenances planifiees a venir sont affichees dans une section dedicee "Maintenances planifiees" sous les incidents :
- Titre, date/heure de debut et fin, duree estimee, services concernes (chips)
- Impact attendu (badge : "Aucun impact" vert, "Degradation partielle" orange, "Interruption complete" rouge)
- Compte a rebours si la maintenance est dans moins de 24h (ex: "Dans 3h 42min")
- Pendant la maintenance active, un bandeau bleu s'affiche en haut de la page : "Maintenance en cours — {titre} — Fin estimee : {heure}". Les services concernes affichent l'etat "Maintenance" (pastille bleue/grise) dans la grille.
- Apres la fin de la maintenance (date de fin depassee), le bandeau disparait automatiquement et les services reprennent leur etat de health check.
- L'administrateur peut prolonger (modifier la date de fin) ou terminer anticipativement la maintenance via un bouton "Terminer la maintenance".

### 5.3 Notification de maintenance
Les utilisateurs abonnes recoivent des notifications automatiques :
- **24h avant** : email + in-app — "Maintenance planifiee demain : {titre}. Services impactes : {liste}. Debut : {date/heure}."
- **1h avant** : email + in-app — "Maintenance imminente dans 1 heure : {titre}."
- **Au debut** : email + in-app + webhook — "Maintenance en cours : {titre}. Fin estimee : {heure}."
- **A la fin** : email + in-app + webhook — "Maintenance terminee : {titre}. Tous les services sont restaures."

Les webhooks utilisent le meme format que les notifications d'incident (voir section 4.5).

### 5.4 Suppression des alertes pendant la maintenance
Pendant une fenetre de maintenance, les alertes automatiques sont supprimees pour les services concernes :
- Les health checks continuent de s'executer et d'etre enregistres dans `metrics.service_health_checks` (pour l'historique).
- Les passages en "hors service" ne declenchent PAS d'incident automatique pour ces services.
- Les notifications d'alerte ne sont PAS envoyees pour ces services.
- L'etat "Maintenance" est prioritaire sur les etats calcules par les health checks.
- Les health checks des services NON concernes par la maintenance continuent de declencher les alertes normalement.
- A la fin de la maintenance, l'etat des services concernes est re-evalue immediatement a partir du prochain health check.

---

## Categorie 6 — Configuration et administration

### 6.1 Configuration des health checks
Dans le panneau d'administration `/admin/monitoring/settings`, chaque service a sa configuration de health check :
- **URL du endpoint** : defaut `/health` (personnalisable, ex: `/api/v1/ready`)
- **Intervalle** : frequence des checks (defaut 10s, min 5s, max 300s)
- **Timeout** : duree avant echec (defaut 5000ms, min 1000ms, max 30000ms)
- **Seuil de degradation** : latence au-dela de laquelle le service est marque "degrade" (defaut 2000ms, configurable par service)
- **Echecs consecutifs avant down** : nombre de checks echoues avant de passer en "hors service" (defaut 3, min 1, max 10)
- **Succes consecutifs avant recovery** : nombre de checks reussis avant de repasser "operationnel" (defaut 1, min 1, max 5)
- **Assertions** : conditions supplementaires sur le body de la reponse (ex: le champ `status` doit etre `healthy`, le champ `db` doit etre `connected`). Format JSONPath.
- **Alerte sur degradation** : toggle pour envoyer une notification quand le service passe en etat degrade (defaut : non, seuls les passages hors service alertent)

### 6.2 Visibilite des services
Toggle par service pour le rendre visible ou invisible sur la page de statut publique. Les services internes (Metrics, PXE, Gateway) peuvent etre masques pour les utilisateurs non-admin. L'admin voit tous les services dans le dashboard prive. La visibilite est stockee dans `metrics.monitored_services.is_public` (boolean). La modification prend effet immediatement (pas de cache sur ce champ).

### 6.3 Personnalisation de la page
Options de personnalisation dans `/admin/monitoring/settings` :
- **Logo** : upload du logo affiche en haut de la page (max 2MB, formats PNG/SVG/WebP). Stocke via `signapps-storage`.
- **Titre** : texte affiche (defaut "SignApps Platform Status", max 100 caracteres)
- **Description** : sous-titre sous le logo (ex: "Statut en temps reel de la plateforme SignApps")
- **Couleurs** : palette personnalisable ou theme par defaut (utilise les tokens CSS du theme SignApps)
- **URL** : chemin personnalise (defaut `/status`, modifiable ex: `/system-status`)
- **Acces** : publique (sans auth) ou restreint (auth requise pour voir la page)
- **Langue** : francais (defaut), anglais. La langue de la page publique est independante de la langue de l'admin.
- **Favicon** : upload d'un favicon specifique pour la page de statut (apparait quand ouverte dans un onglet separe)

### 6.4 API de statut

**`GET /api/v1/status`** — Statut de tous les services (public si page publique activee) :
```json
{
  "status": "operational",
  "updated_at": "2026-04-09T14:30:00Z",
  "uptime_30d": 99.998,
  "services": [
    {
      "name": "Identity",
      "port": 3001,
      "status": "operational",
      "latency_ms": 40,
      "latency_delta_ms": 5,
      "latency_p50_ms": 38,
      "latency_p95_ms": 120,
      "latency_p99_ms": 450,
      "last_check": "2026-04-09T14:29:57Z",
      "uptime_30d": 99.998,
      "sparkline": [40, 42, 38, 41, 39, 40, 43, 38, 37, 41]
    }
  ],
  "active_incidents": [],
  "upcoming_maintenances": []
}
```

**`POST /api/v1/status/refresh`** — Force un health check immediat (admin uniquement, bearer token requis). Retourne le meme format que `GET /api/v1/status` avec les donnees fraichement collectees.

**`GET /api/v1/status/history?period=30d`** — Historique d'uptime par service et par jour pour la periode demandee.

**`GET /api/v1/status/incidents`** — Liste des incidents avec pagination (`?page=1&per_page=20`), filtres (`?severity=major&status=resolved&service=identity`).

**`GET /api/v1/status/incidents/{id}`** — Detail d'un incident avec ses updates et son post-mortem.

**`POST /api/v1/status/incidents`** — Creer un incident (admin uniquement). Body : `{ "title", "description", "severity", "services": [], "status" }`.

**`POST /api/v1/status/incidents/{id}/updates`** — Ajouter une mise a jour (admin uniquement). Body : `{ "status", "message" }`.

**`GET /api/v1/status/maintenances`** — Liste des maintenances planifiees.

**`POST /api/v1/status/maintenances`** — Creer une maintenance (admin uniquement). Body : `{ "title", "description", "start_at", "end_at", "services": [], "impact" }`.

**`POST /api/v1/status/subscribe`** — S'abonner aux notifications. Body : `{ "email", "services": [], "types": ["incidents", "maintenances"] }`.

**`DELETE /api/v1/status/subscribe/{token}`** — Se desabonner via le token unique.

L'API est utilisee par la page de statut frontend et peut etre consommee par des outils tiers (monitoring externe, dashboards custom). Les endpoints publics n'exigent pas d'authentification. Les endpoints admin exigent un bearer token avec le role `monitoring.admin`.

### 6.5 Webhook entrant pour statut externe
Endpoint `POST /api/v1/status/webhook` permettant a des services externes de reporter leur statut. Payload JSON :
```json
{
  "service_name": "External CRM",
  "status": "operational",
  "latency_ms": 120,
  "message": "All checks passing"
}
```
Authentification par token API (header `X-Status-Token`). Utile pour inclure des services non-SignApps dans la page de statut (ex: CRM, ERP, services cloud tiers). Le service externe est ajoute dans `metrics.monitored_services` avec `source = 'webhook'` au lieu de `source = 'health_check'`. Si aucun webhook n'est recu depuis 5 minutes, le service passe en "Inconnu" (gris).

### 6.6 Export et rapports
Export du rapport de disponibilite :
- **PDF** : rapport mensuel avec uptime par service, incidents, metriques cles, graphiques de latence. Genere via le service signapps-office (port 3018). Template professionnel avec le logo configure.
- **CSV** : donnees brutes d'uptime et de latence par service et par jour. Colonnes : date, service_name, port, uptime_pct, avg_latency_ms, p50_ms, p95_ms, p99_ms, checks_total, checks_failed, incidents_count.
- **JSON** : memes donnees en format machine-readable.

Generation automatique mensuelle envoyee par email aux administrateurs (configurable dans `/admin/monitoring/settings`, toggle "Rapport mensuel automatique", multi-select des destinataires). Le rapport est genere le 1er de chaque mois a 8h00 via une tache systeme du scheduler.

---

## Categorie 7 — Abonnements et notifications

### 7.1 Bouton d'abonnement
Sur la page de statut publique, un bouton "S'abonner aux mises a jour" en haut a droite ouvre un dialog (shadcn/ui `Dialog`) avec le formulaire :
- **Email** (requis) : adresse pour recevoir les notifications. Validation format email cote client (zod) et cote serveur.
- **Services** : multi-select avec checkboxes (tous par defaut). Option "Tous les services" qui coche/decoche tout.
- **Types** : checkboxes — Incidents (defaut : coche), Maintenances (defaut : coche), Resolutions (defaut : coche).
- **Webhooks** (optionnel, section expandable) : URL d'un webhook pour recevoir les notifications en JSON. Test du webhook possible via un bouton "Tester" qui envoie un payload de test.

A la soumission, un email de confirmation est envoye avec un lien de validation (double opt-in). Le lien expire apres 24h. Tant que l'email n'est pas confirme, aucune notification n'est envoyee. Chaque notification envoyee contient un lien de desabonnement en un clic dans le footer.

### 7.2 Flux RSS/Atom
Flux RSS disponible sur `/status/feed.xml` avec les derniers incidents et maintenances. Chaque item contient :
- `<title>` : titre de l'incident ou de la maintenance
- `<description>` : dernier message de mise a jour
- `<pubDate>` : date de creation ou de derniere mise a jour
- `<link>` : URL vers la page de detail de l'incident
- `<category>` : "incident" ou "maintenance"
- `<dc:creator>` : auteur de la mise a jour

Compatible avec tous les lecteurs RSS (Feedly, Inoreader, etc.). Mis a jour en temps reel a chaque creation ou mise a jour d'un incident/maintenance. Le flux contient les 50 derniers items. Header HTTP `Content-Type: application/rss+xml`.

### 7.3 Badge embed
Widget embedable pour les sites externes et documentations :
- **SVG dynamique** : `GET /status/badge.svg` retourne une image SVG avec l'etat actuel. Texte : "SignApps: All Systems Operational" (vert) ou "SignApps: Incident in Progress" (rouge) ou "SignApps: Partial Degradation" (orange). Parametres query : `?style=flat` (defaut), `?style=plastic`, `?style=for-the-badge`. Le badge est cache 60s (header `Cache-Control: max-age=60`).
- **Markdown embed** : `![Status](https://your-domain.com/status/badge.svg)` — a copier dans les README.
- **HTML iframe** : `<iframe src="/status/embed" width="300" height="50" frameborder="0"></iframe>` — mini-widget avec le bandeau d'etat et le nombre de services operationnels.

Le badge et l'iframe sont accessibles sans authentification, meme si la page de statut complete est privee.

### 7.4 Integration Slack/Teams/Discord
Configuration de webhooks sortants dans `/admin/monitoring/settings` :
- **Slack** : URL de webhook Slack Incoming Webhook. Message formate avec Block Kit : barre laterale coloree (vert/orange/rouge), titre, description, services impactes, lien vers la page de statut.
- **Teams** : URL de webhook Microsoft Teams. Carte adaptative avec les memes informations, formatee avec le schema Adaptive Cards.
- **Discord** : URL de webhook Discord. Embed riche avec couleur, titre, description, champs (services, severite, statut), lien.

Configurable par type d'evenement : incident cree, incident mis a jour, incident resolu, maintenance planifiee, maintenance commencee, maintenance terminee. L'administrateur peut tester chaque webhook via un bouton "Envoyer un test" qui poste un message de test dans le canal.

---

## Categorie 8 — Architecture backend

### 8.1 Health check engine
Le moteur de health check tourne dans le service `signapps-metrics` (port 3008). Il execute un `GET /health` sur chaque service a l'intervalle configure. Le resultat (statut HTTP, body JSON, latence, timestamp) est stocke dans PostgreSQL (`metrics.service_health_checks` table). Le moteur utilise `reqwest` (MIT/Apache-2.0) avec un client partage (connection pooling) et un timeout configurable par service. Le moteur est lance dans un `tokio::spawn` dedie au demarrage du service et tourne en boucle infinie avec `tokio::time::interval(Duration::from_secs(10))`. Chaque cycle de checks est execute en parallele avec `futures::future::join_all` pour minimiser le temps de cycle.

### 8.2 Calcul d'etat
L'etat de chaque service est calcule a partir des N derniers health checks :
- Si les 3 derniers checks sont OK et la latence est sous le seuil -> Operationnel
- Si le dernier check est OK mais la latence depasse le seuil -> Degrade
- Si les 3 derniers checks echouent -> Hors service
- Si une maintenance est en cours pour ce service -> Maintenance (prioritaire)
L'etat global est le pire etat parmi tous les services visibles (hors maintenance). L'etat est recalcule apres chaque cycle de health checks et mis en cache (moka, TTL 10s).

### 8.3 Schema PostgreSQL

```sql
-- Schema dedie pour les metriques
CREATE SCHEMA IF NOT EXISTS metrics;

-- Table des services monitores
CREATE TABLE metrics.monitored_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    port INT NOT NULL,
    health_endpoint VARCHAR(255) NOT NULL DEFAULT '/health',
    check_interval_seconds INT NOT NULL DEFAULT 10,
    timeout_ms INT NOT NULL DEFAULT 5000,
    degradation_threshold_ms INT NOT NULL DEFAULT 2000,
    failures_before_down INT NOT NULL DEFAULT 3,
    successes_before_recovery INT NOT NULL DEFAULT 1,
    is_public BOOLEAN NOT NULL DEFAULT true,
    is_system BOOLEAN NOT NULL DEFAULT true,
    source VARCHAR(20) NOT NULL DEFAULT 'health_check',
    category VARCHAR(50),
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table des resultats de health check
CREATE TABLE metrics.service_health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(100) NOT NULL,
    port INT NOT NULL,
    status VARCHAR(20) NOT NULL, -- ok, degraded, down, timeout, connection_refused
    latency_ms INT,
    response_code INT,
    response_body TEXT,
    error_message TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_health_checks_service_time
    ON metrics.service_health_checks (service_name, checked_at DESC);

-- Table d'uptime pre-agrege par jour (remplie par le scheduler)
CREATE TABLE metrics.service_uptime_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    uptime_pct NUMERIC(7, 4) NOT NULL,
    avg_latency_ms INT,
    p50_latency_ms INT,
    p95_latency_ms INT,
    p99_latency_ms INT,
    checks_total INT NOT NULL DEFAULT 0,
    checks_failed INT NOT NULL DEFAULT 0,
    incidents_count INT NOT NULL DEFAULT 0,
    UNIQUE (service_name, date)
);

-- Table des incidents
CREATE TABLE metrics.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL, -- minor, major, critical
    status VARCHAR(20) NOT NULL DEFAULT 'investigating',
    services TEXT[] NOT NULL DEFAULT '{}',
    is_auto BOOLEAN NOT NULL DEFAULT false,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_incidents_status ON metrics.incidents (status);
CREATE INDEX idx_incidents_started ON metrics.incidents (started_at DESC);

-- Table des mises a jour d'incidents
CREATE TABLE metrics.incident_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES metrics.incidents(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_incident_updates_incident
    ON metrics.incident_updates (incident_id, created_at);

-- Table des post-mortems
CREATE TABLE metrics.incident_postmortems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL UNIQUE REFERENCES metrics.incidents(id) ON DELETE CASCADE,
    root_cause TEXT NOT NULL,
    impact TEXT NOT NULL,
    timeline TEXT,
    corrective_actions TEXT NOT NULL,
    preventive_measures TEXT NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table des maintenances planifiees
CREATE TABLE metrics.maintenances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    services TEXT[] NOT NULL DEFAULT '{}',
    impact VARCHAR(20) NOT NULL DEFAULT 'none', -- none, degradation, interruption
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- scheduled, active, completed, cancelled
    recurrence_rule TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_window CHECK (end_at > start_at)
);
CREATE INDEX idx_maintenances_schedule
    ON metrics.maintenances (start_at, end_at);

-- Table des abonnements aux notifications
CREATE TABLE metrics.status_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    services TEXT[] NOT NULL DEFAULT '{}',
    types TEXT[] NOT NULL DEFAULT '{incidents,maintenances,resolutions}',
    webhook_url TEXT,
    confirmation_token VARCHAR(64) NOT NULL UNIQUE,
    confirmed_at TIMESTAMPTZ,
    unsubscribe_token VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_subscriptions_email
    ON metrics.status_subscriptions (email) WHERE confirmed_at IS NOT NULL;
```

Retention configurable (defaut 90 jours pour `service_health_checks`, illimitee pour les incidents et maintenances). Purge automatique via le scheduler task `cleanup-health-checks`.

### 8.4 Incidents automatiques
Lorsqu'un service passe en etat "hors service" et y reste pendant plus de 5 minutes (configurable), un incident est cree automatiquement avec :
- Titre : "Service {name} hors service"
- Description : "Le service {name} (port {port}) ne repond plus depuis {duration}. Derniere erreur : {error_message}"
- Services impactes : [{name}]
- Severite : Majeure (auto-escalade en Critique apres 30 min de downtime continu)
- `is_auto = true` pour distinguer des incidents manuels

L'incident automatique est automatiquement resolu lorsque le service repasse en etat operationnel. Un update "Resolved" est ajoute avec le message "Le service {name} est de nouveau operationnel. Duree de l'interruption : {duration}."

Le mecanisme est implemente dans le health check engine : apres chaque cycle, si un service est "hors service" depuis plus du seuil configure et qu'aucun incident automatique n'est ouvert pour ce service, un incident est cree. Le flag `is_auto` empeche la creation de doublons.

### 8.5 Cache et resilience
La page de statut utilise un cache agressif (moka, TTL 10s) pour eviter de surcharger la base de donnees. Le cache est partage entre tous les handlers du service `signapps-metrics`. Si le service `signapps-metrics` est indisponible, le frontend affiche le dernier etat connu (stocke dans `localStorage`) avec un bandeau jaune "Donnees potentiellement obsoletes — Derniere mise a jour il y a {duration}". La page est pre-rendue statiquement (ISR Next.js, revalidation 10s) pour garantir la disponibilite meme en cas de panne backend. Le `GET /api/v1/status` inclut un header `ETag` pour le cache conditionnel (304 Not Modified si rien n'a change).

### 8.6 PgEventBus integration
Le service `signapps-metrics` emet des evenements sur le PgEventBus pour les changements d'etat :
- `status.service.down` — un service passe en etat "hors service" (payload : service_name, port, since, error)
- `status.service.degraded` — un service passe en etat "degrade" (payload : service_name, port, latency_ms)
- `status.service.recovered` — un service repasse en etat "operationnel" (payload : service_name, port, downtime_duration_seconds)
- `status.incident.created` — un incident est cree (payload : incident_id, title, severity, services)
- `status.incident.updated` — un incident est mis a jour (payload : incident_id, new_status, message)
- `status.incident.resolved` — un incident est resolu (payload : incident_id, duration_seconds)
- `status.maintenance.started` — une maintenance commence (payload : maintenance_id, services)
- `status.maintenance.ended` — une maintenance se termine (payload : maintenance_id)

Ces evenements sont consommes par `signapps-notifications` pour envoyer les notifications aux abonnes et par `signapps-gateway` pour ajouter des headers d'etat aux reponses API.

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
- Le bandeau passe a "Degradation partielle" (orange) quand un service est degrade
- Le bandeau passe a "Incident majeur" (rouge) quand un service est hors service
- Le bandeau passe a "Maintenance en cours" (bleu) quand une maintenance est active
- La transition du bandeau s'anime en fade 300ms
- Le KPI "100% Uptime global" affiche un pourcentage coherent avec 3 decimales
- Le KPI passe en orange si l'uptime est inferieur a 99.9%
- Le rafraichissement automatique met a jour les donnees toutes les 10 secondes
- La barre de progression de rafraichissement se remplit progressivement sur 10 secondes
- Le bouton "Rafraichir" force une mise a jour immediate et affiche un spinner
- Le bouton "Rafraichir" est desactive pendant 5s apres un clic (cooldown)
- Chaque carte de service affiche le nom, le port, la latence, le statut et l'uptime
- La sparkline affiche 60 points de donnees de latence dans chaque carte
- Les percentiles p50/p95/p99 sont affiches sous la sparkline
- Le service Identity (port 3001) affiche une latence coherente (ex: ~40ms)
- Le service AI (port 3005) affiche une latence plus elevee (ex: ~979ms)
- Le delta de latence affiche une fleche verte (baisse) ou orange (hausse)
- La pastille de statut est verte pour un service operationnel
- La pastille de statut pulse en rouge quand un service est hors service
- Le clic sur une carte ouvre le panneau lateral avec les details avances
- Le panneau lateral affiche le graphique de latence 24h et la barre d'uptime 90 jours
- Escape ferme le panneau lateral
- Le selecteur de periode (24h, 7j, 30j, 90j, 365j) recalcule les metriques
- Le selecteur de periode ajoute un query param dans l'URL
- Le graphique de trafic affiche des courbes avec des timestamps corrects
- Le graphique multi-courbes de latence permet de masquer/afficher les services
- Les barres d'uptime historique affichent 90 jours de segments colores
- Au survol d'un segment d'uptime, le tooltip affiche la date et le pourcentage
- La section incidents affiche les incidents recents avec titre, statut et duree
- Les incidents en cours sont affiches en premier avec un bandeau colore
- Un incident automatique est cree quand un service reste down plus de 5 minutes
- L'incident automatique est resolu quand le service revient en ligne
- L'admin peut creer un incident manuel via le bouton "Declarer un incident"
- L'admin peut ajouter une mise a jour a un incident en cours
- Passer un incident a "Resolved" ferme l'incident et propose le post-mortem
- Le post-mortem est visible sur la page de detail de l'incident
- La maintenance planifiee apparait dans la section "Maintenances planifiees"
- Le compte a rebours s'affiche si la maintenance est dans moins de 24h
- Les services en maintenance affichent la pastille bleue/grise
- Les alertes automatiques sont supprimees pendant la fenetre de maintenance
- Le formulaire d'abonnement valide l'email et envoie une confirmation double opt-in
- Le lien de desabonnement dans chaque notification fonctionne en un clic
- L'API `GET /api/v1/status` retourne un JSON avec le statut de tous les services
- L'API `POST /api/v1/status/incidents` cree un incident (admin uniquement)
- L'API retourne 401 pour les endpoints admin sans bearer token
- Le badge embed `/status/badge.svg` affiche l'etat correct avec le style demande
- L'iframe embed `/status/embed` affiche le mini-widget d'etat
- Le flux RSS `/status/feed.xml` contient les derniers incidents et maintenances
- Le webhook Slack recoit un message formate avec Block Kit lors d'un incident
- La page reste accessible (dernier etat connu + bandeau "obsolete") si le backend est indisponible
- Le mode responsive affiche 1 colonne sur mobile, 2 sur tablette, 3 sur desktop
- La page publique ne divulgue aucune donnee sensible (pas d'IP, pas de logs d'erreur)
- Le dashboard admin affiche tous les services, meme ceux masques de la page publique
