# Module Analytics (Analytique) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Google Analytics 4** | Event-based tracking, funnel exploration, path analysis, cohort analysis, user lifetime, predictive metrics (churn probability, revenue prediction), audiences, BigQuery export, real-time, custom dimensions |
| **Mixpanel** | Product analytics, funnel analysis, retention curves, A/B testing, user flows, cohorts, formulas, signal (anomaly detection), engagement scoring, warehouse connectors |
| **Amplitude** | Behavioral analytics, event segmentation, funnel conversion, retention analysis, revenue analysis, user journeys (Journeys), experiment (A/B), cohorts, data taxonomy, governance |
| **PostHog** | Open source, product analytics, session replay, feature flags, A/B testing, heatmaps, surveys, data pipeline, event autocapture, group analytics, SQL access |
| **Plausible Analytics** | Open source, privacy-first (pas de cookies), lightweight (<1KB script), dashboard simple et clair, UTM tracking, goals/conversions, real-time, self-hosted, GDPR compliant |
| **Metabase** | Open source, BI self-hosted, requetes SQL ou visual query builder, dashboards, alertes, embedding, collections, sharing, scheduling, database connectors, custom expressions |
| **Apache Superset** | Open source (Apache-2.0), BI enterprise, dashboards interactifs, 40+ types de visualisations, SQL Lab, dataset management, RBAC, caching, async queries, extensible |
| **Grafana** | Open source, dashboards operationnels, alerting, 80+ datasources, panels (graph, stat, table, heatmap, gauge), templating, annotations, explore mode, Loki/Prometheus/InfluxDB integration |
| **Looker Studio** | Dashboards Google, connectors (Sheets, BigQuery, SQL, APIs), blending, calculated fields, themes, partage, embedding, communaute de templates |
| **Tableau** | Visualisations drag-drop avancees, LOD expressions, dashboards interactifs, Prep (ETL visuel), Server/Online, embedding, R/Python integration, spatial analytics |

## Principes directeurs

1. **Vue d'ensemble operationnelle** — l'onglet Overview fournit en un coup d'oeil les metriques cles de la plateforme : taches totales, taches terminees (avec progress bar), reservations, points de blocage. Charts distribution et repartition.
2. **Analyses avancees en onglets** — chaque type d'analyse (Funnel, Cohort, A/B Test, Heatmap, User Journey, Revenue, Custom KPIs, Scheduled Reports) est un onglet dedie. L'utilisateur navigue horizontalement entre les perspectives.
3. **Self-service BI** — les utilisateurs avances peuvent creer des dashboards custom (Custom KPIs) avec des metriques combinables, des filtres dynamiques, et des formules calculees. Pas besoin d'un data analyst.
4. **Export PDF pour le reporting** — un bouton `Exporter en PDF` genere un rapport imprimable avec tous les graphiques et metriques visibles. Utile pour les comites de direction.
5. **Donnees temps reel** — les metriques sont recuperees via l'API metrics (signapps-metrics port 3008) et rafraichies en temps reel via React Query. Pas de cache stale.
6. **Respect de la vie privee** — les analytics portent sur les metriques agregees (taches, reservations, performances) et non sur le tracking individuel des utilisateurs. Pas de cookies tiers, pas de fingerprinting.

---

## Categorie 1 — Overview (Tableau de bord principal)

### 1.1 KPI Taches Totales
Carte avec nombre total de taches actives sur la plateforme. Icone cible. Sous-texte contextuel.

### 1.2 KPI Taches Terminees
Carte avec nombre de taches completees et barre de progression (% acheve sur le total). Couleur verte. Indicateur de productivite.

### 1.3 KPI Reservations
Carte avec nombre total de reservations (salles, equipements) et heures cumulees. Icone calendrier.

### 1.4 KPI Points de Blocage
Carte avec nombre de taches bloquees. Couleur rouge/destructive. Sous-texte `Necessitent une action`. Lien vers la liste filtree des taches bloquees.

### 1.5 Distribution de la Charge
Bar chart vertical avec les 4 statuts (En attente, En cours, Termine, Bloque). Chaque barre coloree selon le statut. Tooltip avec valeur exacte.

### 1.6 Repartition des Statuts
Pie chart (donut) avec les memes 4 statuts. Vue complementaire au bar chart pour les proportions relatives.

---

## Categorie 2 — Analyses de conversion et retention

### 2.1 Funnel Chart
Visualisation en entonnoir des etapes d'un processus (ex: Inscription → Activation → Premier usage → Usage recurrent → Paiement). Chaque etape montre le nombre d'utilisateurs et le taux de conversion par rapport a l'etape precedente. Configurable : choix des evenements, periode.

### 2.2 Cohort Heatmap
Matrice retention : lignes = cohortes (semaine/mois d'inscription), colonnes = periodes suivantes (S+1, S+2, ..., S+12). Cellules colorees par taux de retention (vert fonce = haute retention, rouge = faible). Survol affiche le chiffre exact.

### 2.3 A/B Test Viewer
Dashboard pour visualiser les resultats d'un test A/B : variantes, nombre de participants, taux de conversion par variante, intervalle de confiance, significativite statistique. Verdict : `A gagne`, `B gagne`, `Pas de difference significative`.

### 2.4 Click Heatmap
Visualisation de type heatmap montrant ou les utilisateurs cliquent sur une page. Overlay colore (bleu → rouge) superpose a un screenshot de la page. Filtre par page, par periode. Utile pour l'UX.

### 2.5 User Journey Map
Graphe de flux (Sankey ou flowchart) montrant les parcours utilisateurs : depuis quelle page ils arrivent, vers quelle page ils navigent, ou ils quittent. Noeud = page, arc = transition. Epaisseur proportionnelle au volume.

---

## Categorie 3 — Analyses financieres

### 3.1 Revenue Analytics
Dashboard revenus avec : MRR (Monthly Recurring Revenue), ARR, churn rate, ARPU (Average Revenue Per User), LTV (Lifetime Value). Graphiques d'evolution temporelle. Decomposition par plan/produit.

### 3.2 Revenue par periode
Line chart de l'evolution du revenu mensuel (ou hebdomadaire/trimestriel). Comparaison periode N vs N-1. Indicateurs de tendance (fleche haut/bas avec %).

### 3.3 Repartition par plan/produit
Pie chart ou stacked bar chart montrant la ventilation du revenu par offre commerciale. Permet d'identifier les plans les plus rentables.

### 3.4 Churn analysis
Graphique du taux d'attrition mensuel. Decomposition : churn volontaire (annulation) vs involontaire (echec de paiement). Cohorte de churn par mois d'inscription.

---

## Categorie 4 — Custom KPIs et dashboards

### 4.1 Dashboard BI personnalise
Page `/analytics/custom` pour creer un dashboard sur mesure. Ajout de widgets : compteur, graphique (bar, line, pie, area), tableau, jauge. Chaque widget est configure avec une source de donnees et des filtres.

### 4.2 Sources de donnees
Les widgets peuvent tirer leurs donnees de : API metrics SignApps, requetes SQL directes (via l'admin), fichiers CSV importes, metriques calculees (formules sur d'autres metriques).

### 4.3 Filtres globaux
Filtres partages par tous les widgets d'un dashboard : periode (datepicker range), departement, utilisateur, projet. Changement de filtre = recalcul de tous les widgets.

### 4.4 Layout drag-and-drop
Les widgets sont disposables par drag-and-drop sur une grille responsive. Redimensionnement par poignees. Sauvegarde du layout par utilisateur.

### 4.5 Partage de dashboard
Un dashboard custom peut etre partage avec d'autres utilisateurs (lecture ou edition). URL stable pour l'embedding.

### 4.6 Alertes sur metriques
Configurer des seuils d'alerte sur n'importe quel KPI : si le nombre de taches bloquees depasse 10, envoyer une notification au manager. Via signapps-notifications.

---

## Categorie 5 — Rapports programmes et export

### 5.1 Scheduled Reports
Configuration de rapports automatiques : frequence (quotidien, hebdomadaire, mensuel), destinataires (email), contenu (onglets du dashboard a inclure). Generation PDF automatique et envoi par email.

### 5.2 Export PDF
Bouton `Exporter en PDF` sur la page principale. Injecte un stylesheet d'impression, masque la navigation, ouvre la boite de dialogue du navigateur. Le rapport inclut tous les graphiques et KPIs visibles.

### 5.3 Export CSV des donnees
Bouton export sur chaque widget/tableau pour telecharger les donnees brutes en CSV. Utile pour l'analyse dans un tableur externe.

### 5.4 Embedding
Les dashboards (surtout custom) peuvent etre embeddes dans d'autres pages SignApps via iframe ou composant React. URL stable avec token d'acces.

### 5.5 API Metrics
Les metriques sont exposees via l'API signapps-metrics (port 3008) : `GET /api/v1/metrics/workload`, `GET /api/v1/metrics/resources`, `GET /api/v1/metrics/revenue`, etc. Format JSON standardise.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Google Analytics 4 Help** (support.google.com/analytics) — event tracking, explorations, rapports.
- **Mixpanel Documentation** (docs.mixpanel.com) — funnels, retention, flows, experiments.
- **PostHog Documentation** (posthog.com/docs) — product analytics, session replay, experiments, heatmaps.
- **Metabase Documentation** (www.metabase.com/docs) — dashboards, questions, SQL, sharing.
- **Apache Superset Documentation** (superset.apache.org/docs) — dashboards, charts, SQL Lab, datasets.
- **Grafana Documentation** (grafana.com/docs) — dashboards, panels, alerting, datasources.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Apache Superset** (github.com/apache/superset) | **Apache-2.0** | Reference principale. BI self-hosted, 40+ chart types, SQL Lab, datasets, RBAC. |
| **Metabase** (github.com/metabase/metabase) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Pattern dashboards, visual query builder. |
| **PostHog** (github.com/PostHog/posthog) | **MIT** (avec modules AGPL) | Product analytics. Pattern pour les funnels, retention, heatmaps. Attention aux modules non-MIT. |
| **Plausible** (github.com/plausible/analytics) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Dashboard analytics simple et privacy-first. |
| **Grafana** (github.com/grafana/grafana) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Pattern dashboards, panels, alerting. |
| **Recharts** (github.com/recharts/recharts) | **MIT** | Deja utilise dans SignApps. Graphiques React (Bar, Line, Pie, Area, Radar, Scatter, Funnel). |
| **visx** (github.com/airbnb/visx) | **MIT** | Low-level visualization primitives de Airbnb (D3 + React). Pattern pour les heatmaps, Sankey, treemaps. |
| **nivo** (github.com/plouc/nivo) | **MIT** | Rich visualization components (heatmap, sunburst, sankey, calendar, choropleth). |
| **react-grid-layout** (github.com/react-grid-layout/react-grid-layout) | **MIT** | Layout drag-and-drop pour les dashboards custom. Grille responsive avec redimensionnement. |
| **D3.js** (github.com/d3/d3) | **BSD-3-Clause** | Visualisation data-driven. Base de nombreuses librairies de graphiques. |

---

## Assertions E2E cles (a tester)

- Page Analytics → l'onglet Overview s'affiche avec les 4 KPIs
- KPI Taches Totales → le nombre correspond aux donnees de l'API metrics
- Bar chart Distribution de la Charge → les 4 barres sont visibles avec couleurs correctes
- Pie chart Repartition → le donut se rend avec les segments proportionnels
- Onglet Funnel → l'entonnoir de conversion s'affiche avec taux par etape
- Onglet Cohort → la heatmap retention se rend avec couleurs par cellule
- Onglet A/B Test → les variantes et la significativite statistique sont visibles
- Onglet Heatmap → la visualisation de clics s'affiche sur un screenshot de page
- Onglet User Journey → le graphe Sankey des parcours est visible et interactif
- Onglet Revenue → MRR, ARR, churn rate, ARPU sont affiches avec graphiques
- Onglet Custom KPIs → la page custom dashboard est accessible
- Onglet Scheduled Reports → la configuration de rapports est accessible
- Export PDF → la boite de dialogue d'impression s'ouvre avec le contenu formate
- Bouton `Dashboard BI` → navigation vers /analytics/custom
- Service metrics indisponible → message d'erreur gracieux `Donnees non disponibles`
