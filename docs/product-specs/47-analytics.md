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
Carte KPI (premiere position, 1/4 de largeur desktop). Fond `bg-card`, bordure fine, coins arrondis 12px. Contenu :
- Icone cible (couleur `primary`, 32px) en haut a gauche
- Label `Taches Totales` en `text-muted-foreground`, 12px
- Valeur numerique (police 28px, bold, `text-foreground`) — nombre total de taches actives sur la plateforme
- Sous-texte comparatif : variation vs mois precedent (fleche haut verte `+12%` ou fleche bas rouge `-5%`)

Donnees via `GET /api/v1/metrics/workload { total_tasks, delta_percent }`. Rafraichissement toutes les 60 secondes.

### 1.2 KPI Taches Terminees
Carte KPI (deuxieme position). Icone check-circle (vert). Label `Terminees`. Valeur = nombre de taches completees. Barre de progression horizontale sous la valeur (largeur proportionnelle au ratio termine/total). Couleur de la barre : vert si >70%, orange si 50-70%, rouge si <50%. Sous-texte : `X% acheve sur Y total`.

### 1.3 KPI Reservations
Carte KPI (troisieme position). Icone calendrier (bleu). Label `Reservations`. Valeur = nombre total de reservations actives (salles, equipements) du mois. Sous-texte : `X heures cumulees`.

### 1.4 KPI Points de Blocage
Carte KPI (quatrieme position). Icone alerte-triangle (rouge `destructive`). Label `Points de Blocage`. Valeur = nombre de taches avec statut `blocked`. Couleur de la valeur : rouge si >0, vert si 0. Sous-texte : `Necessitent une action`. Clic sur la carte filtre la liste des taches par statut `blocked` (navigation vers le module Tasks).

### 1.5 Distribution de la Charge
Bar chart vertical sous les KPIs (hauteur 280px, 60% de la largeur). 4 barres pour les 4 statuts :
- `En attente` : couleur `#94A3B8` (gris bleu)
- `En cours` : couleur `#3B82F6` (bleu)
- `Termine` : couleur `#22C55E` (vert)
- `Bloque` : couleur `#EF4444` (rouge)

Axe Y : nombre de taches. Chaque barre affiche la valeur au-dessus. Tooltip au hover avec valeur exacte et pourcentage. Animation d'apparition : barres qui montent de 0 a leur valeur en 500ms (ease-out).

### 1.6 Repartition des Statuts
Donut chart a droite du bar chart (40% de la largeur, 280px). Memes 4 statuts avec memes couleurs. Centre du donut : nombre total de taches. Legende sous le donut avec : pastille couleur, label, valeur, pourcentage. Hover sur un segment : le segment se decale de 5px vers l'exterieur avec la valeur affichee en bold. Animation de rendu : segments qui apparaissent en rotation horaire sur 800ms.

### 1.7 Filtres globaux
Barre de filtres en haut de la page, applicable a tous les widgets :
- **Periode** : datepicker range avec presets (Aujourd'hui, 7 jours, 30 jours, 90 jours, Cette annee, Personnalise). Defaut : 30 jours.
- **Departement** : multi-select (liste des departements depuis signapps-identity)
- **Projet** : multi-select
- **Utilisateur** : select (admin/manager seulement — un utilisateur normal ne voit que ses propres metriques)

Changement de filtre declenche le refetch de tous les widgets simultanement. Les filtres actifs sont affiches comme chips sous la barre. URL query params synchronises pour le bookmarking.

---

## Categorie 2 — Analyses de conversion et retention

### 2.1 Funnel Chart
Onglet `Funnel` dans la barre de navigation des onglets. Visualisation en entonnoir vertical (largeur proportionnelle au nombre d'utilisateurs a chaque etape). Configuration :
- **Etapes** : l'utilisateur configure les etapes du funnel en selectionnant des evenements (ex: Inscription → Activation → Premier usage → Usage recurrent → Paiement). Chaque etape est un evenement de la plateforme.
- **Periode** : inherited from global filter
- **Fenetre de conversion** : temps maximum entre deux etapes (1h, 1j, 7j, 30j)

Affichage :
- Chaque etape est un rectangle horizontal dont la largeur est proportionnelle au nombre d'utilisateurs (la premiere etape = 100%)
- Label a gauche : nom de l'etape
- Nombre d'utilisateurs a droite
- Entre deux etapes : taux de conversion (ex: `72%`) et nombre de drop-off (ex: `-28 utilisateurs`)
- Couleur : gradient du bleu (premiere etape) au vert (derniere etape). Les drop-off sont en rouge pale.

Interactions : clic sur un taux de conversion ouvre un detail des utilisateurs qui ont abandonne a cette etape (table avec user_id, date, derniere action). Export CSV de la cohorte.

### 2.2 Cohort Heatmap
Onglet `Cohort`. Matrice retention :
- **Lignes** = cohortes definies par la semaine ou le mois d'inscription des utilisateurs
- **Colonnes** = periodes suivantes (S+1, S+2, ..., S+12 pour les semaines, M+1, ..., M+12 pour les mois)
- **Cellules** = taux de retention (pourcentage d'utilisateurs de la cohorte encore actifs a la periode N)

Colorimotrie : gradient du vert fonce (haute retention, >80%) au rouge (faible retention, <20%) en passant par jaune (50%). Les cellules affichent le pourcentage. Hover affiche le nombre absolu d'utilisateurs. La diagonale (periode 0) est toujours 100% (vert fonce).

Configuration : granularite (semaine/mois), definition de "actif" (select : au moins 1 login, au moins 1 action, au moins X actions), nombre de periodes (4, 8, 12, 24).

### 2.3 A/B Test Viewer
Onglet `A/B Test`. Dashboard pour visualiser les resultats d'un test :
- **Selection du test** : dropdown listant les tests actifs et termines
- **Variantes** : cartes cote a cote (A et B, ou plus) avec :
  - Nom de la variante
  - Nombre de participants
  - Taux de conversion (pourcentage, gras)
  - Intervalle de confiance a 95% (barre d'erreur)
  - Bar chart comparatif des taux
- **Significativite statistique** : badge `Significatif` (vert, p < 0.05) ou `Non significatif` (gris, p >= 0.05). Valeur p affichee.
- **Verdict** : texte en gras — `Variante B gagne (+15.2%, p=0.003)`, `Pas de difference significative (p=0.32)`, ou `Donnees insuffisantes (N < 100 par variante)`
- **Timeline** : line chart de l'evolution du taux de conversion par variante au fil du temps

### 2.4 Click Heatmap
Onglet `Heatmap`. Visualisation de type heatmap montrant ou les utilisateurs cliquent sur une page de l'application :
- **Selection de page** : dropdown avec les pages/routes de l'application
- **Overlay** : screenshot de la page avec une couche de couleur superposee. Les zones les plus cliquees sont en rouge, les zones moderees en jaune, les zones peu cliquees en bleu. Echelle d'intensite a droite.
- **Filtres** : periode, device (desktop/mobile/tablette), segment utilisateur
- **Compteurs** : nombre total de clics, zones les plus cliquees (top 5 avec pourcentage)

Les donnees de clic sont collectees via un event tracker leger (attribut `data-track` sur les elements). Pas de tracking de mouvement souris (privacy-first). Seuls les clics intentionnels sont enregistres.

### 2.5 User Journey Map
Onglet `User Journey`. Graphe de flux (Sankey diagram) montrant les parcours utilisateurs :
- **Noeuds** = pages/routes de l'application (rectangles verticaux, hauteur proportionnelle au volume)
- **Arcs** = transitions entre les pages (courbes, epaisseur proportionnelle au nombre d'utilisateurs)
- **Couleurs** : les arcs sont colores selon la page de depart

Configuration : page d'entree (defaut : page d'accueil), profondeur (nombre d'etapes a afficher, 3-7), seuil (ne montrer que les transitions avec > X% du trafic).

Hover sur un noeud : highlight de toutes les transitions entrantes et sortantes, affichage du nombre de visiteurs. Hover sur un arc : affiche le nombre d'utilisateurs et le pourcentage de transition.

Export PNG du diagramme Sankey pour les presentations.

---

## Categorie 3 — Analyses financieres

### 3.1 Revenue Analytics
Onglet `Revenue`. Dashboard financier avec 4 metriques principales en cartes KPI :
- **MRR** (Monthly Recurring Revenue) : montant mensuel recurrent. Graphique mini-line a droite (sparkline des 6 derniers mois)
- **ARR** (Annual Recurring Revenue) : MRR x 12
- **Churn Rate** : taux d'attrition mensuel en pourcentage. Couleur rouge si > 5%, orange si 3-5%, vert si < 3%
- **ARPU** (Average Revenue Per User) : revenu moyen par utilisateur actif. Sous-texte : variation vs mois precedent

### 3.2 Revenue par periode
Line chart principal (hauteur 300px, pleine largeur). Axe X : mois (ou semaine/trimestre selon le filtre). Axe Y : montant en EUR. Deux courbes :
- **Revenu total** (ligne pleine, couleur `primary`)
- **Revenu periode N-1** (ligne pointillee, couleur `muted-foreground/50`)

Remplissage (area) sous la courbe principale. Tooltip : `Avril 2026 : 45 230 EUR (+12% vs mars)`. Indicateurs de tendance : fleche haut/bas avec pourcentage de variation.

### 3.3 Repartition par plan/produit
Stacked bar chart a droite du line chart (40% largeur, 300px). Barres empilees par plan/produit commercial. Chaque segment a une couleur distincte. Legende : nom du plan, montant, pourcentage. Toggle entre `Montant` et `Nombre d'abonnes` (axe Y). Hover sur un segment : detail avec nombre d'abonnes, montant total, ARPU specifique au plan.

### 3.4 Churn analysis
Sous le graphique principal, section dediee au churn :
- **Line chart churn mensuel** : taux d'attrition par mois sur 12 mois. Ligne rouge si au-dessus du seuil cible (3%), verte en dessous.
- **Decomposition** : stacked area chart avec deux segments — churn volontaire (annulation active) et churn involontaire (echec de paiement). Couleurs distinctes.
- **Cohorte de churn** : heatmap (meme format que 2.2) montrant le taux de churn par cohorte d'inscription

### 3.5 LTV (Lifetime Value)
Carte KPI supplementaire : LTV moyenne. Calcul : ARPU / Churn Rate. Sous-texte : `Basee sur un churn de X% et un ARPU de Y EUR`. Graphique d'evolution du LTV sur 12 mois.

---

## Categorie 4 — Dashboard builder (Custom KPIs)

### 4.1 Page Custom Dashboard
Page `/analytics/custom` pour creer des dashboards sur mesure. L'utilisateur peut creer plusieurs dashboards (liste dans une sidebar ou un dropdown). Chaque dashboard a un nom editable et une grille de widgets.

### 4.2 Ajout de widgets
Bouton `+ Ajouter un widget` ouvre un dialogue de selection. Types de widgets :
- **Compteur** (stat card) : une valeur unique avec label, icone, variation. Taille : 1x1 dans la grille.
- **Bar chart** : barres verticales ou horizontales. Taille : 2x1 ou 2x2.
- **Line chart** : courbes temporelles. Taille : 2x1 ou 2x2.
- **Pie / Donut chart** : repartition en segments. Taille : 1x1 ou 2x2.
- **Area chart** : courbes avec remplissage. Taille : 2x1.
- **Scatter plot** : nuage de points (2 dimensions). Taille : 2x2.
- **Heatmap** : matrice coloree. Taille : 2x2 ou 3x2.
- **Funnel** : entonnoir de conversion. Taille : 1x2 ou 2x2.
- **Gauge** : jauge circulaire (0-100%). Taille : 1x1.
- **Table** : tableau de donnees. Taille : 2x1 ou 3x2.
- **Texte** : bloc de texte libre (markdown). Taille : 1x1 ou 2x1.

Chaque type affiche une preview miniature dans le dialogue de selection.

### 4.3 Configuration d'un widget
Apres selection du type, dialogue de configuration en 3 onglets :

**Onglet Data :**
- **Source de donnees** : select parmi les sources disponibles :
  - API metrics SignApps (endpoints predicts : workload, resources, revenue, users, etc.)
  - Requete SQL directe (textarea avec autocompletion sur les tables/colonnes — admin uniquement, lecture seule, timeout 30s)
  - Fichier CSV importe (upload, stocke localement)
  - Autre widget (formule calculee sur un autre widget du dashboard)
- **Champs** : mapping des colonnes de la source vers les axes du graphique (X, Y, couleur, taille)
- **Aggregation** : select (somme, moyenne, count, min, max, mediane) sur les valeurs numeriques
- **Filtre** : conditions sur les champs (ex: `status = 'active'`, `date >= '2026-01-01'`)

**Onglet Style :**
- Titre du widget (texte)
- Couleurs (palette pour les series, ou couleur unique)
- Afficher/masquer la legende, les axes, le titre
- Format des nombres (entier, decimal, pourcentage, devise)

**Onglet Taille :**
- Selection visuelle de la taille dans la grille (1x1, 2x1, 2x2, 3x1, 3x2, 4x2)

### 4.4 Layout drag-and-drop
Les widgets sont disposables par drag-and-drop sur une grille responsive. La grille a 4 colonnes sur desktop, 2 sur tablette, 1 sur mobile. Chaque cellule de grille a une taille de base (250px x 200px approx). Drag des widgets par leur barre de titre. Redimensionnement par une poignee en bas a droite. Les widgets s'adaptent (reflow) quand un widget est deplace ou redimensionne. Animation fluide de 200ms sur les transitions. Implémentation via `react-grid-layout` (MIT). Le layout est sauvegarde automatiquement en base (debounce 1 seconde apres le dernier changement).

### 4.5 Calculated metrics (formules)
Un widget de type `Compteur` ou `Line chart` peut utiliser une formule calculee au lieu d'une source directe. Syntaxe : `{widget_A} / {widget_B} * 100` ou `{widget_A} - {widget_B}`. Les references a d'autres widgets sont resolues au rendu. L'editeur de formule affiche la liste des widgets disponibles avec autocompletion. Operateurs supportes : `+`, `-`, `*`, `/`, `%`, `round()`, `floor()`, `ceil()`, `abs()`, `min()`, `max()`.

### 4.6 Filtres globaux du dashboard
Chaque dashboard custom a ses propres filtres globaux. L'admin du dashboard configure les filtres disponibles :
- **Periode** (datepicker range — toujours present)
- **Departement** (multi-select, optionnel)
- **Utilisateur** (select, optionnel)
- **Champ custom** (select sur une colonne de la source de donnees)

Changement de filtre global = recalcul de tous les widgets du dashboard qui referencent ce filtre. Les filtres sont affiches dans une barre en haut du dashboard.

### 4.7 Partage de dashboard
Un dashboard custom peut etre :
- **Prive** (defaut) : visible uniquement par le createur
- **Partage en lecture** : d'autres utilisateurs peuvent le voir mais pas le modifier. Bouton `Partager` → dialogue avec selection d'utilisateurs ou de groupes.
- **Partage en edition** : d'autres utilisateurs peuvent modifier le layout et les widgets
- **Public** (lien) : accessible via une URL stable sans authentification (optionnel, desactive par defaut). Un token d'acces est genere. Utile pour l'affichage sur un ecran TV.

L'URL du dashboard est stable : `/analytics/custom/{dashboard_id}`. Bookmarkable et embeddable.

### 4.8 Alertes sur metriques
Bouton `Alertes` dans le header du dashboard. Configuration d'alertes conditionnelles :
- **Metrique** : select parmi les widgets du dashboard (types compteur, line chart)
- **Condition** : `>`, `<`, `>=`, `<=`, `==` + valeur seuil
- **Frequence de verification** : toutes les 5 min, 15 min, 1h, 1 jour
- **Notification** : push (via signapps-notifications), email, ou les deux
- **Destinataires** : l'utilisateur ou une liste d'utilisateurs

Exemple : `Si "Taches bloquees" > 10, notifier le manager toutes les heures`. PgEventBus event `analytics.alert.triggered { alert_id, dashboard_id, metric_name, current_value, threshold }`.

---

## Categorie 5 — Rapports programmes et export

### 5.1 Scheduled Reports
Onglet `Rapports` dans la barre de navigation. Configuration de rapports automatiques :
- **Nom** du rapport (texte)
- **Contenu** : selection des onglets/dashboards a inclure (checkboxes)
- **Frequence** : select `Quotidien` (chaque matin a 8h), `Hebdomadaire` (lundi matin), `Mensuel` (1er du mois), `Trimestriel`
- **Heure d'envoi** : time input (defaut 08:00)
- **Destinataires** : multi-select d'utilisateurs + champ email externe (pour les stakeholders non-SignApps)
- **Format** : PDF (defaut), XLSX (avec les donnees brutes des widgets)

Generation automatique par un job CRON cote serveur (signapps-calendar ou un worker dedie). Le rapport PDF est genere via headless rendering des widgets (screenshot serveur-side des charts). Envoi par email via signapps-mail (port 3012). PgEventBus event `analytics.report.sent { report_id, recipients, format }`.

Liste des rapports programmes dans une table avec : nom, frequence, prochain envoi, dernier envoi, statut (actif/pause), actions (editer, pause, supprimer, envoyer maintenant).

### 5.2 Export PDF
Bouton `Exporter en PDF` dans le header de chaque onglet/dashboard. Le systeme :
1. Injecte un stylesheet d'impression (`@media print`)
2. Masque la navigation, sidebar, filtres interactifs
3. Optimise les graphiques pour l'impression (fond blanc, couleurs saturees, police noire)
4. Ouvre la boite de dialogue d'impression du navigateur (`window.print()`)

Le rapport inclut : titre de la page, date de generation, filtres actifs, tous les KPIs et graphiques visibles. Pagination automatique pour les contenus longs. Header et footer sur chaque page (logo, titre, date, numero de page).

### 5.3 Export CSV des donnees
Bouton export (icone download) sur chaque widget/tableau individuel. Telecharge les donnees brutes du widget en CSV. Colonnes correspondant aux champs de la source de donnees. Les filtres actifs sont appliques. Nom du fichier : `{nom_widget}_{date}.csv`.

### 5.4 Export PNG des graphiques
Bouton export sur chaque widget graphique (bar, line, pie, etc.). Options : PNG (rasterise, 2x resolution pour la qualite), SVG (vectoriel). Le graphique est exporte avec son titre et sa legende. Fond blanc par defaut (option fond transparent pour PNG). Utile pour inserer dans des presentations ou documents.

### 5.5 Embedding
Les dashboards custom peuvent etre embeddes dans d'autres pages SignApps :
- **Dans Docs** : commande slash `/analytics-dashboard {id}` insere un bloc interactif
- **Dans Wiki** : meme mecanisme
- **En iframe** : l'URL `/analytics/custom/{id}/embed?token={access_token}` affiche le dashboard sans header ni navigation. Le token est genere dans les parametres de partage du dashboard.

L'embed est interactif (les filtres fonctionnent, les tooltips s'affichent) mais ne permet pas la modification du layout.

### 5.6 API Metrics
Les metriques sont exposees via l'API signapps-metrics (port 3008) :

| Endpoint | Description |
|---|---|
| `GET /api/v1/metrics/workload` | Taches : total, par statut, par assignee, par projet |
| `GET /api/v1/metrics/resources` | Reservations : salles, equipements, heures |
| `GET /api/v1/metrics/revenue` | MRR, ARR, churn, ARPU, LTV, par plan |
| `GET /api/v1/metrics/users` | Actifs, nouveaux, churn, par cohorte |
| `GET /api/v1/metrics/funnel` | Taux de conversion par etape |
| `GET /api/v1/metrics/cohort` | Matrice de retention |
| `GET /api/v1/metrics/heatmap` | Donnees de clics par page |
| `GET /api/v1/metrics/journey` | Transitions entre pages |
| `GET /api/v1/metrics/custom/:query_id` | Resultat d'une requete SQL custom |

Query params communs : `period` (7d, 30d, 90d, 1y, custom), `date_from`, `date_to`, `department_id`, `project_id`, `user_id`. Format JSON standardise : `{ data: [...], meta: { total, period, generated_at } }`.

---

## Categorie 6 — Persistance et API

### 6.1 API REST complete

**Base path :** `/api/v1/analytics`

| Methode | Endpoint | Description |
|---|---|---|
| `GET` | `/dashboards` | Liste des dashboards custom de l'utilisateur |
| `GET` | `/dashboards/:id` | Detail d'un dashboard avec layout et widgets |
| `POST` | `/dashboards` | Creer un dashboard. Body : `{ name, filters? }` |
| `PUT` | `/dashboards/:id` | Modifier (nom, filtres) |
| `DELETE` | `/dashboards/:id` | Supprimer |
| `PUT` | `/dashboards/:id/layout` | Sauvegarder le layout (positions et tailles des widgets) |
| `POST` | `/dashboards/:id/share` | Partager. Body : `{ user_id, role }` |
| `POST` | `/dashboards/:id/public-link` | Generer un lien public. Response : `{ url, token }` |
| `DELETE` | `/dashboards/:id/public-link` | Revoquer le lien public |
| `GET` | `/dashboards/:id/widgets` | Liste des widgets d'un dashboard |
| `POST` | `/dashboards/:id/widgets` | Ajouter un widget. Body : `{ type, config, position, size }` |
| `PUT` | `/widgets/:id` | Modifier un widget |
| `DELETE` | `/widgets/:id` | Supprimer un widget |
| `GET` | `/widgets/:id/data` | Donnees calculees du widget (avec filtres appliques) |
| `GET` | `/reports` | Liste des rapports programmes |
| `POST` | `/reports` | Creer un rapport programme |
| `PUT` | `/reports/:id` | Modifier |
| `DELETE` | `/reports/:id` | Supprimer |
| `POST` | `/reports/:id/send-now` | Envoyer immediatement |
| `GET` | `/alerts` | Liste des alertes configurees |
| `POST` | `/alerts` | Creer une alerte. Body : `{ widget_id, condition, threshold, frequency, recipients }` |
| `PUT` | `/alerts/:id` | Modifier |
| `DELETE` | `/alerts/:id` | Supprimer |
| `POST` | `/queries` | Creer une requete SQL custom (admin). Body : `{ name, sql, params? }` |
| `GET` | `/queries/:id/run` | Executer une requete avec params |
| `GET` | `/data-sources` | Liste des sources de donnees disponibles |
| `POST` | `/export/pdf` | Generer un PDF d'un dashboard. Body : `{ dashboard_id, filters }` |

### 6.2 PostgreSQL schema

```sql
-- Dashboards custom
CREATE TABLE analytics_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL DEFAULT 'Mon dashboard',
    description TEXT DEFAULT '',
    filters_config JSONB DEFAULT '[]'::jsonb,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    public_token VARCHAR(64) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_dashboards_user ON analytics_dashboards(user_id);
CREATE INDEX idx_analytics_dashboards_public ON analytics_dashboards(public_token) WHERE is_public = TRUE;

-- Partage de dashboards
CREATE TABLE analytics_dashboard_shares (
    dashboard_id UUID NOT NULL REFERENCES analytics_dashboards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('viewer', 'editor')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (dashboard_id, user_id)
);

-- Widgets
CREATE TABLE analytics_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES analytics_dashboards(id) ON DELETE CASCADE,
    widget_type VARCHAR(20) NOT NULL CHECK (widget_type IN (
        'counter', 'bar', 'line', 'pie', 'donut', 'area', 'scatter',
        'heatmap', 'funnel', 'gauge', 'table', 'text'
    )),
    title VARCHAR(200) NOT NULL DEFAULT '',
    data_source_type VARCHAR(20) NOT NULL CHECK (data_source_type IN ('api', 'sql', 'csv', 'formula')),
    data_source_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    style_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    position_x INTEGER NOT NULL DEFAULT 0,
    position_y INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 2,
    height INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_widgets_dashboard ON analytics_widgets(dashboard_id, sort_order);

-- Requetes SQL custom (admin)
CREATE TABLE analytics_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(200) NOT NULL,
    sql_text TEXT NOT NULL,
    params_schema JSONB DEFAULT '[]'::jsonb,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_queries_user ON analytics_queries(user_id);

-- Rapports programmes
CREATE TABLE analytics_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    dashboard_ids UUID[] NOT NULL DEFAULT '{}',
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly')),
    send_time TIME NOT NULL DEFAULT '08:00:00',
    recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
    format VARCHAR(10) NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf', 'xlsx')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_sent_at TIMESTAMPTZ,
    next_send_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_reports_user ON analytics_reports(user_id);
CREATE INDEX idx_analytics_reports_next ON analytics_reports(next_send_at) WHERE is_active = TRUE;

-- Alertes sur metriques
CREATE TABLE analytics_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    widget_id UUID NOT NULL REFERENCES analytics_widgets(id) ON DELETE CASCADE,
    condition_operator VARCHAR(5) NOT NULL CHECK (condition_operator IN ('>', '<', '>=', '<=', '==')),
    threshold NUMERIC NOT NULL,
    check_frequency_minutes INTEGER NOT NULL DEFAULT 60,
    notification_channels JSONB NOT NULL DEFAULT '["push"]'::jsonb,
    recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_checked_at TIMESTAMPTZ,
    last_triggered_at TIMESTAMPTZ,
    consecutive_triggers INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_alerts_widget ON analytics_alerts(widget_id);
CREATE INDEX idx_analytics_alerts_next ON analytics_alerts(last_checked_at) WHERE is_active = TRUE;

-- Donnees de clics (heatmap)
CREATE TABLE analytics_click_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    page_path VARCHAR(500) NOT NULL,
    element_selector VARCHAR(500),
    element_text VARCHAR(200),
    x_percent NUMERIC(5, 2) NOT NULL,
    y_percent NUMERIC(5, 2) NOT NULL,
    viewport_width INTEGER,
    viewport_height INTEGER,
    device_type VARCHAR(10) CHECK (device_type IN ('desktop', 'tablet', 'mobile')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_clicks_page ON analytics_click_events(page_path, created_at DESC);
CREATE INDEX idx_analytics_clicks_created ON analytics_click_events(created_at DESC);

-- Evenements de parcours utilisateur (journey)
CREATE TABLE analytics_page_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    user_id UUID,
    page_path VARCHAR(500) NOT NULL,
    referrer_path VARCHAR(500),
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_pageviews_session ON analytics_page_views(session_id, created_at);
CREATE INDEX idx_analytics_pageviews_page ON analytics_page_views(page_path, created_at DESC);

-- CSV importes comme source de donnees
CREATE TABLE analytics_csv_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    columns JSONB NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6.3 PgEventBus events

| Event | Payload | Consumers |
|---|---|---|
| `analytics.dashboard.created` | `{ dashboard_id, user_id, name }` | — |
| `analytics.dashboard.shared` | `{ dashboard_id, owner_id, target_user_id, role }` | Notifications |
| `analytics.report.sent` | `{ report_id, recipients, format }` | Mail |
| `analytics.report.failed` | `{ report_id, error }` | Notifications (admin) |
| `analytics.alert.triggered` | `{ alert_id, dashboard_id, widget_id, metric_name, current_value, threshold }` | Notifications |
| `analytics.query.executed` | `{ query_id, user_id, duration_ms, row_count }` | Audit |

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

- Page Analytics → l'onglet Overview s'affiche avec les 4 KPIs (Taches Totales, Terminees, Reservations, Blocages)
- KPI Taches Totales → le nombre correspond aux donnees de l'API metrics
- KPI Terminees → la barre de progression est proportionnelle au ratio termine/total
- KPI Points de Blocage → clic navigue vers la liste des taches bloquees
- Bar chart Distribution de la Charge → les 4 barres sont visibles avec couleurs correctes et animation
- Pie chart Repartition → le donut se rend avec les segments proportionnels, hover decale le segment
- Filtres globaux : changer la periode → tous les widgets se rafraichissent
- Filtres globaux : selectionner un departement → les KPIs se recalculent pour ce departement
- Onglet Funnel → l'entonnoir de conversion s'affiche avec taux par etape et drop-off
- Funnel : configurer les etapes → le funnel se re-rend avec les nouvelles etapes
- Onglet Cohort → la heatmap retention se rend avec couleurs par cellule (vert=haute, rouge=faible)
- Cohort : changer la granularite semaine/mois → la matrice se recalcule
- Onglet A/B Test → les variantes et la significativite statistique sont visibles
- A/B Test : test significatif → badge vert `Significatif`, verdict affiche
- Onglet Heatmap → la visualisation de clics s'affiche sur un screenshot de page
- Heatmap : changer de page → les donnees de clics se mettent a jour
- Onglet User Journey → le graphe Sankey des parcours est visible et interactif
- Journey : hover sur un noeud → transitions highlight
- Onglet Revenue → MRR, ARR, churn rate, ARPU sont affiches avec graphiques
- Revenue : line chart avec courbe N et N-1 affichees
- Churn analysis → decomposition volontaire/involontaire visible
- Custom Dashboard : creer un dashboard → il apparait dans la liste
- Custom Dashboard : ajouter un widget compteur → le widget s'affiche avec la valeur
- Custom Dashboard : ajouter un widget bar chart → le graphique se rend
- Custom Dashboard : drag-and-drop un widget → le layout se met a jour
- Custom Dashboard : redimensionner un widget → le graphique s'adapte
- Custom Dashboard : formule calculee → le resultat est correct
- Custom Dashboard : partager en lecture → l'autre utilisateur voit le dashboard
- Custom Dashboard : lien public → le dashboard est accessible sans login
- Scheduled Report : creer un rapport hebdomadaire → il apparait dans la liste avec prochain envoi
- Scheduled Report : `Envoyer maintenant` → email recu avec PDF en piece jointe
- Alerte : configurer `Taches bloquees > 10` → notification recue quand le seuil est depasse
- Export PDF → la boite de dialogue d'impression s'ouvre avec le contenu formate
- Export CSV d'un widget → fichier telecharge avec les donnees du widget
- Export PNG d'un graphique → image telechargee en haute resolution
- Embed dans Docs → le dashboard s'affiche en bloc interactif
- SQL query (admin) → les resultats s'affichent dans un tableau, timeout a 30s
- Service metrics indisponible → message d'erreur gracieux `Donnees non disponibles` sur chaque widget
- Bouton `Dashboard BI` → navigation vers /analytics/custom
