# Module Monitoring — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Grafana** | Dashboards composables (graph, stat, gauge, table, heatmap, logs, traces), templating variables, alerting rules multi-canal, annotations, dashboard-as-code JSON, 150+ data source plugins, Loki pour les logs, Tempo pour les traces |
| **Prometheus** | Pull-based metrics collection, PromQL (puissant langage de requête), alerting rules avec Alertmanager, service discovery, multi-dimensional data model (labels), recording rules, federation |
| **Datadog** | APM + Infrastructure + Logs + Synthetics + RUM unified, anomaly detection ML, SLO tracking, live process monitoring, network performance monitoring, security monitoring, 700+ integrations |
| **Uptime Robot** | Monitoring HTTP/ping/port/keyword ultra-simple, status pages publiques, alertes multi-canal (email, SMS, Slack, webhook), 5-min check interval gratuit, maintenance windows |
| **Netdata** | Monitoring temps réel per-second, 2000+ metrics auto-detected, zero configuration, anomaly detection ML, composite charts, system overview dashboard, Netdata Cloud pour multi-node |
| **Zabbix** | Monitoring réseau/serveur enterprise, templates par OS/device, auto-discovery, trigger expressions complexes, escalation policies, SLA reporting, maps réseau, inventory |
| **PRTG Network Monitor** | Sensors pré-configurés (CPU, RAM, disk, bandwidth, ping, HTTP, SQL, SNMP), maps visuelles, auto-discovery, dashboards par rôle, reports PDF, mobile app |
| **Nagios** | Monitoring legacy référence (checks actifs/passifs), plugins communautaires, event handlers, flap detection, dependency modeling, status pages, downtime scheduling |
| **New Relic** | Full-stack observability (APM, infrastructure, logs, browser, mobile, synthetics), NRQL query language, AI-powered alerts, distributed tracing, error tracking, SLI/SLO |
| **Checkmk** | Auto-discovery agents, 2000+ check plugins, Business Intelligence module, event console, HW/SW inventory, agent-based + agentless, dashlets composables |
| **Better Stack (Uptime)** | Status pages modernes, heartbeat monitoring, incident management intégré, on-call scheduling, Slack/Teams/PagerDuty integration, cron job monitoring |
| **Healthchecks.io** | Cron job monitoring simple (ping-based), grace periods, alertes multi-canal, badges status, API simple, team management, integrations webhook |

## Principes directeurs

1. **Visibilité immédiate** — le dashboard monitoring affiche l'état de santé global du système en un coup d'oeil : vert = tout va bien, orange = dégradation, rouge = incident. Pas besoin de cliquer pour connaître l'état.
2. **Détection proactive AI** — les anomalies sont détectées automatiquement par l'AI avant qu'elles ne deviennent des incidents. Pas uniquement des seuils statiques, mais des patterns de déviation appris sur l'historique.
3. **Alertes actionnables** — chaque alerte contient le contexte (quelle métrique, quel seuil, depuis quand, impact estimé) et des actions suggérées. Pas d'alerte sans information pour agir.
4. **Temps réel natif** — les métriques sont rafraîchies en temps réel (WebSocket) sans polling. Le mode Live affiche les données seconde par seconde.
5. **Historique exploitable** — les données sont conservées avec une rétention configurable pour analyser les tendances, les patterns récurrents et les corrélations post-incident.
6. **Self-monitoring** — le système de monitoring se surveille lui-même. Si le service metrics tombe, une alerte est émise par un mécanisme indépendant (heartbeat externe).

---

## Catégorie 1 — Vue d'ensemble du système

### 1.1 Health status global
Bandeau en haut du dashboard avec un indicateur de santé global : `Opérationnel` (vert), `Dégradé` (orange), `Incident` (rouge). L'état est calculé à partir de l'état de chaque service et des seuils d'alerte actifs.

### 1.2 Carte des machines (inventory)
Liste des machines monitorées avec pour chacune : nom (ex: `PC-001`), OS (ex: `Windows 11 Pro`), IP, dernier heartbeat, état (en ligne/hors ligne/dégradé). Clic sur une machine ouvre sa vue détaillée.

### 1.3 KPIs système principaux
Quatre cartes KPI en haut du dashboard machine :
- **CPU** : pourcentage d'utilisation actuel (ex: 84.8%), nombre de cores (ex: 32), sparkline 1h
- **Mémoire** : pourcentage utilisé (ex: 41.8%), utilisé/total (ex: 80/191 GB), sparkline 1h
- **Disque** : pourcentage utilisé (ex: 11.7%), utilisé/total (ex: 1.71/14.55 TB), sparkline 1h
- **Uptime** : durée depuis le dernier redémarrage (ex: 14j 7h 23min), date du dernier reboot

### 1.4 État des services SignApps
Tableau listant chaque microservice avec : nom, port, statut (running/stopped/degraded), temps de réponse du health check, uptime, dernière erreur. Indicateur visuel vert/orange/rouge par service. Tri et filtre par statut.

### 1.5 Vue topologique (service map)
Diagramme montrant les relations entre les services (qui appelle qui). Les connexions sont colorées par état : vert (OK), orange (latence élevée), rouge (erreur). Utile pour identifier les dépendances impactées lors d'un incident.

---

## Catégorie 2 — Métriques détaillées et graphiques

### 2.1 Graphique CPU temps réel
Graphique en aires empilées montrant l'utilisation CPU par core ou agrégée. Axe X : temps (5 min par défaut). Axe Y : 0-100%. Ligne de seuil d'alerte en rouge pointillé. Zoom par sélection de plage. Tooltip avec valeur exacte au survol.

### 2.2 Graphique Mémoire temps réel
Graphique en aires montrant la mémoire utilisée / disponible / cache / swap. Même contrôles que le graphique CPU. Distinction entre mémoire applicative et cache système.

### 2.3 Graphique Disque I/O
Graphique double : lectures/écritures par seconde (IOPS) et débit (MB/s). Par partition si plusieurs disques. Utile pour identifier les goulots d'étranglement I/O.

### 2.4 Graphique Réseau
Graphique montrant le trafic entrant/sortant (Mbps) par interface réseau. Erreurs et drops en overlay. Utile pour détecter les saturations réseau.

### 2.5 Sélecteur de plage temporelle
Boutons prédéfinis : 5 min, 15 min, 1h, 6h, 24h, 7j, 30j. Sélection personnalisée par date picker. Les graphiques se recalculent avec l'agrégation appropriée (seconde, minute, heure, jour).

### 2.6 Mode Live (temps réel)
Toggle « Live » qui active le rafraîchissement seconde par seconde des graphiques. Les courbes scrollent horizontalement comme un oscilloscope. Désactivation automatique si l'utilisateur zoome ou sélectionne une plage passée.

### 2.7 Comparaison de périodes
Overlay d'une période de référence (ex : même jour la semaine dernière) en transparence sur le graphique actuel. Utile pour identifier les déviations par rapport au comportement normal.

### 2.8 Export des graphiques
Clic droit sur un graphique → Export PNG, SVG ou CSV (données brutes). Bouton de copie pour coller dans un rapport ou un email.

---

## Catégorie 3 — Alertes et seuils

### 3.1 Règles de seuil configurables
Interface de configuration des alertes avec les règles par défaut :
- **CPU > 90%** pendant 5 minutes → alerte critique
- **Mémoire > 85%** pendant 5 minutes → alerte critique
- **Disque > 90%** → alerte critique
- **Service down** (health check échoue 3 fois consécutives) → alerte critique
Chaque règle a un toggle on/off, un seuil configurable, une durée de déclenchement et un niveau de sévérité.

### 3.2 Niveaux de sévérité
Trois niveaux : `Info` (bleu), `Warning` (orange), `Critical` (rouge). Chaque niveau déclenche des canaux de notification différents (configurable). Les alertes critiques déclenchent un son/vibration.

### 3.3 Canaux de notification
Configuration des destinations par niveau d'alerte : notification in-app (toujours), email, webhook (Slack/Teams/Discord), SMS (si configuré). Escalation : si pas d'acquittement en N minutes, notifier le niveau supérieur.

### 3.4 Historique des alertes
Liste chronologique de toutes les alertes déclenchées avec : date/heure, règle, métrique, valeur au déclenchement, durée, état (active/acquittée/résolue), qui a acquitté. Filtres par sévérité, par machine, par période.

### 3.5 Acquittement d'alerte
Un utilisateur peut acquitter une alerte (« je m'en occupe ») avec un commentaire optionnel. L'alerte passe de « active » à « acquittée » mais reste visible jusqu'à résolution. Si la métrique repasse sous le seuil, l'alerte passe automatiquement en « résolue ».

### 3.6 Maintenance windows
Planifier une fenêtre de maintenance (date début/fin, machines/services concernés). Pendant cette fenêtre, les alertes sont supprimées pour les éléments concernés. Historique des maintenances.

### 3.7 Flap detection
Si une métrique oscille autour du seuil (déclenche/résout/déclenche en boucle), le système détecte le flapping et agrège en une seule alerte avec le contexte « oscillation entre X% et Y% depuis Z minutes ».

---

## Catégorie 4 — Détection d'anomalies AI

### 4.1 Baselines automatiques
L'AI apprend le comportement normal de chaque métrique sur 7-30 jours : patterns horaires (pic à 9h, creux la nuit), hebdomadaires (charge moindre le weekend), saisonniers. Les seuils d'anomalie sont calculés dynamiquement.

### 4.2 Détection de déviation
Si une métrique dévie significativement de sa baseline (ex : CPU à 60% un dimanche alors que la baseline est à 5%), une alerte AI est émise avec le contexte : « CPU inhabituellement élevé pour un dimanche à 3h — baseline : 5%, actuel : 60% ».

### 4.3 Prédiction de saturation
L'AI projette les tendances actuelles pour estimer quand une ressource sera saturée : « Au rythme actuel, le disque sera plein dans 12 jours ». Alerte préventive configurable (ex : alerter 7 jours avant saturation estimée).

### 4.4 Corrélation d'anomalies
Si plusieurs métriques dévient simultanément (ex : CPU + I/O + latence d'un service), l'AI corrèle ces anomalies et les présente comme un incident unique avec cause probable suggérée.

### 4.5 Feedback loop
L'utilisateur peut marquer une anomalie AI comme « faux positif » ou « pertinent ». Ce feedback améliore le modèle au fil du temps. Statistiques de précision affichées dans l'admin.

### 4.6 Résumé AI des incidents
Pour chaque incident détecté, l'AI génère un résumé en langage naturel : « Le service signapps-mail (port 3012) a connu une latence élevée entre 14h30 et 15h15 suite à un pic de CPU à 95% sur la machine PC-001. Cause probable : indexation des emails. Résolution automatique. »

---

## Catégorie 5 — Monitoring des services SignApps

### 5.1 Health checks automatiques
Chaque microservice expose un endpoint `/health` vérifié toutes les 30 secondes. Le health check retourne : status (healthy/degraded/unhealthy), version, uptime, métriques internes (connections pool, queue size, etc.).

### 5.2 Latence des endpoints
Suivi du temps de réponse par endpoint API (p50, p95, p99). Graphique de distribution des latences. Alerte si le p95 dépasse un seuil configurable.

### 5.3 Taux d'erreur par service
Compteur d'erreurs HTTP (4xx, 5xx) par service et par endpoint. Ratio erreurs/total. Graphique de tendance. Alerte si le taux d'erreur dépasse X% sur une fenêtre de N minutes.

### 5.4 Database metrics
Métriques PostgreSQL : nombre de connexions actives/idle, queries par seconde, slow queries (> 1s), taille de la base, cache hit ratio, replication lag (si applicable). Alertes sur les seuils.

### 5.5 Queue et event bus metrics
Métriques PgEventBus : nombre d'événements en attente, throughput (événements/seconde), latence de traitement, erreurs de delivery. Alerte si la queue grandit sans être consommée.

### 5.6 Logs centralisés
Intégration avec les logs structurés (tracing) de chaque service. Vue unifiée des logs avec filtres par service, niveau (debug/info/warn/error), message, span. Recherche full-text dans les logs.

---

## Catégorie 6 — Uptime et SLA

### 6.1 Uptime par service
Pourcentage de disponibilité sur 24h, 7j, 30j, 90j. Affichage façon status page avec barre de disponibilité (vert = up, rouge = down, gris = pas de données).

### 6.2 Calcul SLA
Définir un objectif SLA par service (ex : 99.9%). Le dashboard affiche le SLA actuel vs objectif, le budget d'erreur restant (en minutes), et une projection pour la fin de la période.

### 6.3 Incidents timeline
Timeline verticale des incidents passés avec : date/heure, durée, services impactés, cause, résolution. Utile pour les post-mortems et les rapports de disponibilité.

### 6.4 Status page interne
Page de statut accessible sans authentification (URL configurable) montrant l'état de chaque service. Utilisable comme page de statut pour les utilisateurs internes ou partenaires.

### 6.5 Rapports de disponibilité
Export mensuel/trimestriel : pourcentage uptime par service, nombre d'incidents, MTTR (Mean Time To Resolve), MTTD (Mean Time To Detect). Format PDF ou CSV.

---

## Catégorie 7 — Processus et ressources

### 7.1 Liste des processus
Tableau listant les processus actifs sur une machine : PID, nom, utilisateur, CPU%, mémoire%, état, durée d'exécution. Tri par consommation CPU ou mémoire. Équivalent du Task Manager.

### 7.2 Top consumers
Graphique montrant les 10 processus les plus consommateurs de CPU et de mémoire. Mise à jour en temps réel. Utile pour identifier les processus runaway.

### 7.3 Détection de processus zombie
Identification automatique des processus inactifs consommant des ressources (zombie, defunct, hung). Suggestion d'action : redémarrer le service ou kill le processus.

### 7.4 Inventaire logiciel
Liste des logiciels installés sur chaque machine monitorée : nom, version, éditeur, date d'installation. Différences entre machines (drift detection). Lien avec le module IT Assets si activé.

### 7.5 Température et hardware
Si disponible via les sensors : température CPU/GPU, vitesse des ventilateurs, état des disques (SMART). Alertes sur surchauffe. Informations hardware : modèle CPU, GPU, RAM slots, disques.

---

## Catégorie 8 — Configuration et administration

### 8.1 Agents de collecte
Configuration des agents de monitoring installés sur les machines cibles. Chaque agent rapporte ses métriques au service `signapps-metrics` (port 3008) via une API REST authentifiée.

### 8.2 Rétention des données
Configuration de la durée de conservation des métriques : données brutes (7j par défaut), données agrégées par minute (30j), par heure (1an), par jour (5ans). Purge automatique.

### 8.3 Groupes de machines
Organisation des machines en groupes logiques : « Production », « Développement », « Réseau », « Postes utilisateurs ». Filtrage du dashboard par groupe. Alertes configurables par groupe.

### 8.4 Rôles et permissions
Accès au monitoring conditionné par le rôle RBAC : `admin` (configuration complète), `operator` (acquittement des alertes, vue complète), `viewer` (lecture seule). Pas d'accès pour les utilisateurs standard sauf si explicitement accordé.

### 8.5 API d'intégration
API REST documentée (OpenAPI via utoipa) pour pousser des métriques custom, récupérer l'état des services, créer des alertes programmatiquement. Utilisable par des scripts de déploiement ou des outils tiers.

### 8.6 Webhooks sortants
Configuration de webhooks déclenchés sur les événements de monitoring (alerte créée, résolue, service down/up). Payload JSON standardisé. Utile pour l'intégration avec PagerDuty, OpsGenie, Slack.

---

## Catégorie 9 — Dashboards et visualisation

### 9.1 Dashboards pré-configurés
Dashboards par défaut : « Vue d'ensemble », « Services SignApps », « Base de données », « Réseau », « Machine [nom] ». Chaque dashboard est composé de panneaux (graphiques, tables, gauges, stats).

### 9.2 Dashboards personnalisés
L'admin peut créer des dashboards custom en ajoutant des panneaux par drag-and-drop. Chaque panneau est configurable : type de visualisation, source de données, plage temporelle, seuils visuels.

### 9.3 Panneaux de type gauge
Affichage en jauge circulaire pour les métriques bornées (CPU%, Mémoire%, Disque%). Zones de couleur : vert (0-70%), orange (70-90%), rouge (90-100%). Aiguille animée en temps réel.

### 9.4 Panneaux de type stat
Affichage d'un chiffre unique en gros avec unité, tendance (flèche haut/bas) et sparkline. Ex : « 84.8% CPU » avec flèche vers le haut et sparkline 5 min.

### 9.5 Panneaux de type table
Tableau de données avec colonnes configurables, tri, filtre, pagination. Utile pour les listes de processus, les logs, les alertes.

### 9.6 Panneaux de type heatmap
Matrice colorée pour visualiser la distribution temporelle d'une métrique (heures × jours). Utile pour identifier les patterns de charge récurrents.

### 9.7 Mode TV / kiosk
Affichage plein écran optimisé pour les écrans muraux. Rotation automatique entre dashboards toutes les N secondes. Pas de barre de navigation. Fond sombre pour les NOC (Network Operations Center).

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **Grafana Documentation** (grafana.com/docs) — documentation exhaustive sur les dashboards, panneaux, alerting, data sources, provisioning.
- **Prometheus Documentation** (prometheus.io/docs) — guides sur PromQL, alerting rules, recording rules, federation.
- **Datadog Documentation** (docs.datadoghq.com) — guides sur l'APM, l'infrastructure monitoring, les anomaly monitors, les SLOs.
- **Netdata Learn** (learn.netdata.cloud) — documentation sur le monitoring per-second, les anomaly advisors, les composite charts.
- **Zabbix Documentation** (zabbix.com/documentation) — guides sur les triggers, les templates, l'auto-discovery, les SLA reports.
- **Better Stack Blog** (betterstack.com/community) — guides sur les status pages, l'incident management, les bonnes pratiques d'alerte.
- **Healthchecks.io Documentation** (healthchecks.io/docs) — documentation sur le cron monitoring, les grace periods, les badges.
- **SRE Book (Google)** (sre.google/sre-book) — chapitres publics sur le monitoring, les SLIs/SLOs/SLAs, l'alerting, l'incident response.

### Projets open source permissifs à étudier comme pattern
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **Prometheus** (github.com/prometheus/prometheus) | **Apache-2.0** | Modèle de données métriques (labels, timestamps), PromQL, alerting rules. Référence architecturale. |
| **Netdata** (github.com/netdata/netdata) | **GPL-3.0** | **INTERDIT** (GPL). Ne pas utiliser ni copier. Étudier les docs publiques pour les patterns de métriques temps réel. |
| **Grafana** (github.com/grafana/grafana) | **AGPL-3.0** | **INTERDIT** (AGPL). Ne pas utiliser ni copier. Étudier les docs publiques pour les patterns de dashboards et panneaux. |
| **VictoriaMetrics** (github.com/VictoriaMetrics/VictoriaMetrics) | **Apache-2.0** | Time-series database performante. Pattern pour le stockage et la compression des métriques. |
| **sysinfo** (github.com/GuillaumeGomez/sysinfo) | **MIT** | Crate Rust pour récupérer les informations système (CPU, RAM, disques, processus, température). Utilisation directe possible. |
| **Chart.js** (chartjs.org) | **MIT** | Graphiques canvas pour les gauges, sparklines, graphiques de métriques. Déjà utilisé dans SignApps. |
| **Apache ECharts** (echarts.apache.org) | **Apache-2.0** | Graphiques riches : heatmaps, gauges circulaires, graphiques temps réel avec DataZoom. |
| **D3.js** (d3js.org) | **BSD-3-Clause** | Visualisations custom (topologie réseau, heatmaps, timelines). Pattern pour les panneaux avancés. |
| **Recharts** (recharts.org) | **MIT** | Graphiques React déclaratifs pour les sparklines et les charts temps réel. |
| **react-grid-layout** (github.com/react-grid-layout/react-grid-layout) | **MIT** | Grille de panneaux drag-and-drop. Pattern pour les dashboards personnalisables. |
| **date-fns** (date-fns.org) | **MIT** | Manipulation de dates/durées pour les plages temporelles et les calculs d'uptime. |

### Pattern d'implémentation recommandé
1. **Collecte** : crate `sysinfo` (MIT) dans un agent Rust embarqué dans `signapps-metrics` (port 3008). Métriques exposées via API REST + WebSocket.
2. **Stockage** : métriques en time-series dans PostgreSQL avec table partitionnée par temps. Rétention configurable avec agrégation downsampling.
3. **Alertes** : évaluation des règles de seuil dans `signapps-metrics`. Notifications via PgEventBus → `signapps-notifications` (port 8095).
4. **AI Anomaly** : baselines calculées par `signapps-ai` (port 3005) sur les séries temporelles. Modèle statistique (z-score, IQR) pour la détection.
5. **Dashboards** : `react-grid-layout` (MIT) pour le layout. Chart.js/ECharts pour les graphiques. WebSocket pour le mode Live.
6. **Health checks** : chaque service expose `/health` (déjà en place via Axum). `signapps-metrics` poll toutes les 30s et stocke les résultats.

---

## Assertions E2E clés (à tester)

- Le dashboard monitoring affiche le health status global (Opérationnel / Dégradé / Incident)
- Les 4 KPIs système (CPU, Mémoire, Disque, Uptime) affichent des valeurs cohérentes
- Le graphique CPU temps réel se met à jour en mode Live
- Le graphique Mémoire distingue mémoire utilisée / disponible / cache
- Le sélecteur de plage temporelle (5min, 1h, 24h, 7j, 30j) recalcule les graphiques
- Le tableau des services liste tous les microservices avec leur statut
- Un service arrêté apparaît en rouge dans le tableau des services
- La règle CPU > 90% déclenche une alerte quand le seuil est dépassé
- Le toggle on/off d'une règle d'alerte désactive/active le déclenchement
- L'acquittement d'une alerte change son état de « active » à « acquittée »
- L'historique des alertes affiche les alertes passées avec date, durée et résolution
- La maintenance window supprime les alertes pour les services concernés pendant la période
- La détection d'anomalie AI signale un comportement inhabituel
- La prédiction de saturation affiche une estimation de la date de saturation du disque
- Le résumé AI d'un incident est cohérent et mentionne les métriques impliquées
- L'uptime par service affiche un pourcentage sur 7j et 30j
- La status page interne est accessible sans authentification
- La liste des processus affiche les processus triés par CPU ou mémoire
- Les dashboards personnalisés permettent l'ajout et le retrait de panneaux
- Le mode TV affiche le dashboard en plein écran sans barre de navigation
- Les panneaux gauge affichent les zones de couleur (vert/orange/rouge) correctement
- Le WebSocket pousse les mises à jour temps réel sans polling visible
- L'export d'un graphique en PNG produit une image lisible
- Le filtre par groupe de machines restreint les données affichées
- Les rôles RBAC restreignent l'accès à la configuration des alertes pour les viewers
