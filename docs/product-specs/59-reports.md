# Module Constructeur de Rapports (Reports) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Metabase** | Open source, visual query builder (pas de SQL requis), dashboards interactifs, questions imbriquees, alertes, embedding, collections, scheduling, pulse reports, custom expressions, drill-down, click behavior |
| **Apache Superset** | Open source (Apache-2.0), SQL Lab interactif, 40+ types de visualisations, datasets, filtres globaux, dashboards, RBAC, caching, async queries, extensible via plugins, charting library deck.gl |
| **Redash** | Open source, multi-datasource (SQL, APIs, MongoDB, Elasticsearch), query editor, visualisations, dashboards, alertes, parametres de requete, scheduling, sharing, API REST |
| **Grafana** | Open source, 80+ datasources, dashboards operationnels, panels configurables (graph, stat, table, heatmap, gauge), templating variables, alerting, annotations, explore mode, transformations de donnees |
| **Google Data Studio / Looker Studio** | Drag-and-drop report builder, blending de sources, champs calcules, themes, filtres interactifs, partage, embedding, communaute de templates, connecteurs natifs Google, date range control |
| **Microsoft Power BI** | Desktop + Cloud, DAX formulas, Power Query (ETL), visualisations custom (marketplace), natural language Q&A, paginated reports, row-level security, dataflows, composite models, AI insights |
| **Jasper Reports** | Open source (AGPL community), generateur de rapports structure, templates JRXML, bandes (header/detail/footer), sous-rapports, parametres, export multi-format (PDF/Excel/HTML/CSV), groupes, totaux |
| **Eclipse BIRT** | Open source (Eclipse Public License), report designer, data explorer, charts, crosstabs, sub-reports, scripting, emitters (PDF, HTML, Excel), parametres, drill-through, ODA (Open Data Access) |

## Principes directeurs

1. **Self-service sans code** — l'utilisateur construit ses rapports visuellement en selectionnant une source de donnees, en ajoutant des colonnes, en appliquant des filtres et des tris. Aucune connaissance SQL ou technique n'est requise. L'interface guide l'utilisateur etape par etape.
2. **Sources de donnees internes** — les rapports tirent leurs donnees des modules SignApps existants (Activites/Taches, Calendrier, Drive, CRM, HR, Billing, Tickets, Formulaires, Analytics). Chaque source expose un schema de colonnes disponibles. Pas de connexion a des bases externes.
3. **Construction par colonnes** — le rapport est construit en ajoutant des colonnes une par une. Chaque colonne correspond a un champ de la source (ex: titre, statut, assignee, date, priorite). L'ordre des colonnes est modifiable par drag-and-drop. Suppression d'une colonne en un clic.
4. **Visualisation hybride** — le rapport peut etre affiche en mode tableau (donnees brutes), en mode graphique (bar, line, pie, area), ou en mode mixte (tableau + graphique). Le switch est instantane sans perte de configuration.
5. **Export multi-format** — les rapports sont exportables en PDF (mise en page imprimable), Excel (XLSX avec donnees et formules), CSV (donnees brutes), et image (PNG du graphique). L'export respecte les filtres et tris appliques.
6. **Rapports sauvegardes et partages** — les rapports configures peuvent etre sauvegardes (nom, description), organises en dossiers, et partages avec d'autres utilisateurs ou equipes. Les rapports partages sont en lecture seule sauf si l'editeur donne les droits d'edition.

---

## Categorie 1 — Interface principale du constructeur

### 1.1 En-tete de page
Titre `Constructeur de rapports` avec sous-titre `Creez des rapports visuels personnalises depuis vos donnees`. Breadcrumb : Accueil > Rapports.

### 1.2 Barre d'outils superieure
De gauche a droite : dropdown `Source` (selection de la source de donnees), bouton `Executer` (lance la requete et affiche les resultats), bouton `Ajouter` (ajoute une colonne au rapport), separateur, bouton `Sauvegarder`, bouton `Exporter` (dropdown : PDF, Excel, CSV, Image).

### 1.3 Zone de construction des colonnes
Zone centrale affichant les colonnes ajoutees au rapport. Etat initial : message `Ajoutez des colonnes pour construire votre rapport` avec icone indicative. Apres ajout de colonnes, chaque colonne est representee par un chip/tag deplacable avec le nom du champ, un bouton de configuration (tri, filtre, aggregation) et un bouton de suppression.

### 1.4 Zone de resultats
Sous la zone de construction, le tableau de resultats s'affiche apres execution. Colonnes = colonnes configurees. Lignes = donnees de la source filtrees. Pagination : 25, 50, 100 lignes par page. Compteur total de resultats.

### 1.5 Zone de visualisation graphique
Panneau lateral ou section inferieure affichant le graphique genere a partir des donnees. Switch entre les types de graphique : bar chart, line chart, pie chart, area chart, scatter plot. Configuration : axe X (colonne), axe Y (colonne avec aggregation), couleur (colonne de groupement).

### 1.6 Mode d'affichage
Toggle entre trois modes : `Tableau` (donnees brutes uniquement), `Graphique` (visualisation uniquement), `Mixte` (tableau + graphique cote a cote ou empiles). Le mode est persistant dans la sauvegarde du rapport.

---

## Categorie 2 — Sources de donnees

### 2.1 Dropdown de source
Le dropdown `Source` liste les sources de donnees disponibles, regroupees par module SignApps :

| Source | Module | Champs principaux exposes |
|---|---|---|
| Activites | Tasks & Projects | titre, statut, priorite, assignee, date creation, date echeance, projet, tags, temps estime, temps passe |
| Calendrier | Calendar | titre, type (event/task/leave), debut, fin, calendrier, recurrence, lieu, participants |
| Fichiers | Drive | nom, type, taille, proprietaire, date creation, date modification, dossier parent, partage |
| Contacts | CRM/Contacts | nom, email, telephone, entreprise, role, tags, date creation, derniere interaction |
| Employes | HR/Workforce | nom, departement, poste, manager, date embauche, statut (actif/inactif), site |
| Tickets | Helpdesk | titre, statut, priorite, assignee, demandeur, categorie, date creation, temps resolution |
| Factures | Billing | numero, client, montant, statut (draft/sent/paid/overdue), date emission, date echeance |
| Formulaires | Forms | titre formulaire, date soumission, repondant, champs du formulaire (dynamiques) |
| Communications | Comms | type (annonce/article/suggestion/sondage), titre, auteur, date, engagement (vues, reactions) |

### 2.2 Schema dynamique
Quand l'utilisateur selectionne une source, le systeme charge le schema de la source : liste des colonnes disponibles avec leur type (texte, nombre, date, booleen, enum). Ce schema alimente le panneau d'ajout de colonnes.

### 2.3 Sources croisees (futur)
Phase 2 : possibilite de joindre deux sources (ex: Activites + Employes pour avoir le departement de l'assignee). Interface de jointure visuelle avec selection de la cle de liaison. Non disponible en v1 — mention dans l'UI : `Croisement de sources — bientot disponible`.

---

## Categorie 3 — Construction de colonnes

### 3.1 Bouton Ajouter une colonne
Le bouton `Ajouter` ouvre un panneau lateral ou un popover listant les champs disponibles de la source courante. Chaque champ affiche : nom, type (icone), description courte. Recherche par nom de champ. Clic sur un champ l'ajoute au rapport.

### 3.2 Chip de colonne
Chaque colonne ajoutee est representee par un chip dans la zone de construction. Le chip affiche : nom du champ, icone de type, indicateur de tri (fleche haut/bas si actif), indicateur de filtre (funnel si actif). Actions au clic sur le chip : configurer (ouvre le panneau de configuration) ou supprimer (croix).

### 3.3 Reordonnancement par drag-and-drop
Les chips de colonnes sont deplacables par drag-and-drop pour changer l'ordre des colonnes dans le tableau de resultats. Feedback visuel : ombre portee pendant le drag, indicateur d'insertion entre les chips.

### 3.4 Configuration d'une colonne
Panneau de configuration d'une colonne (clic sur le chip) avec les options :
- **Libelle personnalise** : renommer l'en-tete de la colonne dans le rapport (ex: `date_creation` → `Date de creation`)
- **Tri** : aucun, croissant, decroissant. Une seule colonne de tri principale, avec tri secondaire optionnel
- **Filtre** : condition de filtrage selon le type (voir 3.5)
- **Aggregation** : aucune, count, sum, avg, min, max, count distinct (voir 3.6)
- **Format** : format d'affichage (date : JJ/MM/AAAA ou relative, nombre : decimales, devise)
- **Largeur** : auto, small, medium, large

### 3.5 Filtres par type de champ
Les filtres disponibles dependent du type de la colonne :
- **Texte** : contient, ne contient pas, commence par, est exactement, est vide, n'est pas vide
- **Nombre** : egal a, different de, superieur a, inferieur a, entre, est vide
- **Date** : avant, apres, entre, aujourd'hui, cette semaine, ce mois, ce trimestre, cette annee, les N derniers jours
- **Enum/Statut** : est (multi-select parmi les valeurs possibles), n'est pas
- **Booleen** : est vrai, est faux

### 3.6 Aggregations
Les aggregations transforment le rapport en rapport groupe. Quand une aggregation est appliquee sur une colonne numerique, les autres colonnes non aggregees deviennent les dimensions de groupement (GROUP BY). Resultats affiches avec les totaux par groupe.

| Aggregation | Type requis | Description |
|---|---|---|
| Count | tous | Nombre d'enregistrements |
| Count Distinct | tous | Nombre de valeurs uniques |
| Sum | nombre | Somme des valeurs |
| Average | nombre | Moyenne des valeurs |
| Min | nombre, date | Valeur minimale |
| Max | nombre, date | Valeur maximale |

### 3.7 Colonne calculee
Bouton `Ajouter une colonne calculee` pour creer un champ derive. Interface de formule : selection de colonnes existantes + operateurs (+, -, *, /, concat, date_diff, if/then/else). Preview du resultat sur les 5 premieres lignes. Exemples : `temps_passe / temps_estime * 100` (taux de completion), `date_echeance - aujourd'hui` (jours restants).

### 3.8 Groupement explicite
Option `Grouper par` dans la barre d'outils qui permet de selectionner une ou plusieurs colonnes de groupement. Le rapport affiche alors les groupes avec des lignes de sous-total. Collapsible : clic sur un groupe pour derouler/replier les lignes de detail.

---

## Categorie 4 — Execution et resultats

### 4.1 Bouton Executer
Le bouton `Executer` envoie la configuration du rapport (source, colonnes, filtres, tris, aggregations) a l'API backend. L'API traduit la configuration en requete SQL sur la base SignApps et retourne les resultats en JSON pagine. Spinner de chargement pendant l'execution.

### 4.2 Tableau de resultats
Tableau HTML avec : en-tetes cliquables (tri rapide par clic), cellules formatees selon le type (dates localisees, nombres avec separateur de milliers, statuts avec badges couleur, booleens avec icones check/cross). Lignes alternees pour la lisibilite. Selection de lignes (checkbox) pour actions groupees.

### 4.3 Pagination
Pagination en bas du tableau : boutons premiere/precedente/suivante/derniere page, select du nombre de lignes par page (25, 50, 100, 500), compteur `Affichage X-Y sur Z resultats`. Chargement dynamique (les pages sont chargees a la demande, pas toutes en memoire).

### 4.4 Recherche dans les resultats
Barre de recherche au-dessus du tableau pour filtrer localement les resultats affiches (recherche client-side dans les lignes chargees). Complement aux filtres de colonnes (qui sont server-side).

### 4.5 Tri interactif
Clic sur un en-tete de colonne dans le tableau bascule le tri : neutre → croissant → decroissant → neutre. Indicateur visuel (fleche) dans l'en-tete. Le tri est applique cote serveur (nouvelle requete).

### 4.6 Redimensionnement des colonnes
Les colonnes du tableau sont redimensionnables par glisser sur le bord de l'en-tete. Double-clic sur le bord auto-ajuste la largeur au contenu le plus large.

### 4.7 Total en pied de tableau
Ligne de total en pied du tableau pour les colonnes numeriques : somme, moyenne, ou count selon la colonne. Configurable par colonne.

### 4.8 Indicateurs visuels conditionnels
Mise en forme conditionnelle sur les cellules : couleur de fond ou barre de progression en arriere-plan basee sur la valeur. Configurable par colonne (ex: statut `Bloque` en rouge, priorite `Haute` en orange, montant > 10000 en gras vert).

---

## Categorie 5 — Visualisation graphique

### 5.1 Selection du type de graphique
Menu de selection avec vignettes pour chaque type : bar chart (vertical, horizontal, stacked), line chart, area chart (simple, stacked), pie chart (donut), scatter plot, treemap, radar. Le type est selectionne par clic.

### 5.2 Configuration des axes
Panneau de configuration du graphique :
- **Axe X** : colonne de dimension (texte, date, enum). Pour les dates, granularite configurable (jour, semaine, mois, trimestre, annee)
- **Axe Y** : colonne de mesure avec aggregation (sum, avg, count, min, max)
- **Couleur / Groupement** : colonne optionnelle pour le split en series (ex: statut → une serie par statut)
- **Taille** (scatter) : colonne optionnelle pour la taille des points

### 5.3 Bar Chart
Graphique a barres verticales ou horizontales. Barres groupees (side-by-side) ou empilees (stacked). Couleurs par serie. Labels de valeur optionnels sur chaque barre. Axe Y avec graduation automatique.

### 5.4 Line Chart
Graphique en courbes. Ideal pour les series temporelles (axe X = date). Lignes lisses ou angulaires. Points de donnees cliquables pour le detail. Legende interactive (clic sur une serie pour la masquer/afficher).

### 5.5 Pie / Donut Chart
Graphique circulaire avec segments proportionnels. Mode donut (trou central) avec valeur totale au centre. Labels avec pourcentage et valeur absolue. Maximum 10 segments (les suivants regroupes dans `Autres`).

### 5.6 Area Chart
Graphique a aires. Simple ou empile (stacked area). Utile pour montrer la composition d'un total sur le temps. Transparence des aires pour la lisibilite.

### 5.7 Scatter Plot
Nuage de points avec axes X et Y numeriques. Taille optionnelle des points. Couleur par groupement. Utile pour les correlations (ex: temps estime vs temps passe).

### 5.8 Treemap
Rectangles imbriques representant la hierarchie et la proportion. Utile pour les repartitions (ex: taches par projet, factures par client). Couleur par categorie, taille par valeur.

### 5.9 Interactions graphiques
- **Tooltip** : survol d'un element affiche les valeurs exactes
- **Zoom** : zoom sur une zone du graphique (brush selection)
- **Drill-down** : clic sur un segment du graphique filtre le tableau de resultats
- **Legende interactive** : clic sur un element de la legende masque/affiche la serie

### 5.10 Theme et couleurs
Les graphiques utilisent les couleurs du theme SignApps (tokens semantiques). Mode sombre automatique. Palette de couleurs personnalisable par rapport (8 couleurs distinctes par defaut).

---

## Categorie 6 — Sauvegarde et partage

### 6.1 Sauvegarder un rapport
Bouton `Sauvegarder` ouvre un dialog : nom du rapport (obligatoire), description (optionnelle), dossier (select dans la hierarchie de dossiers de rapports). Si le rapport existe deja (edition), sauvegarde directe sans dialog.

### 6.2 Liste des rapports sauvegardes
Page `/reports/saved` avec la liste des rapports de l'utilisateur et des rapports partages avec lui. Colonnes : nom, source, auteur, date de derniere modification, partage (icone). Actions : ouvrir, dupliquer, supprimer, partager.

### 6.3 Dossiers de rapports
Organisation des rapports en dossiers hierarchiques. Dossiers par defaut : `Mes rapports`, `Partages avec moi`, `Templates`. L'utilisateur peut creer des sous-dossiers. Drag-and-drop pour deplacer un rapport.

### 6.4 Partage de rapport
Bouton `Partager` ouvre un dialog : selection des destinataires (utilisateurs ou groupes), niveau d'acces (lecture, edition). Les destinataires voient le rapport dans leur dossier `Partages avec moi`. Lien de partage direct (URL stable).

### 6.5 Templates de rapports
Rapports pre-configures fournis par l'admin ou le systeme :
- **Charge de travail par equipe** : source Activites, colonnes assignee/statut/priorite, groupement par departement, bar chart stacked
- **Pipeline commercial** : source CRM, colonnes opportunite/montant/etape/commercial, funnel chart
- **Absences du mois** : source Calendrier (type=leave), colonnes employe/date debut/date fin/type conge
- **Tickets ouverts** : source Helpdesk, colonnes titre/statut/priorite/assignee, filtre statut!=clos
- **Facturation mensuelle** : source Billing, colonnes client/montant/statut, aggregation sum par mois

### 6.6 Duplication
Bouton `Dupliquer` pour creer une copie d'un rapport existant. La copie est independante de l'original. Utile pour creer des variantes (meme rapport avec des filtres differents).

### 6.7 Versionning
Chaque sauvegarde cree une version. Historique des versions accessible (date, auteur du changement). Restauration d'une version anterieure en un clic.

---

## Categorie 7 — Export et planification

### 7.1 Export PDF
Bouton `Exporter en PDF` genere un document PDF avec : titre du rapport, date de generation, filtres appliques, tableau de donnees (pagine si >50 lignes), graphique (si mode mixte ou graphique), pied de page avec numero de page. Orientation auto (paysage si >5 colonnes). Via signapps-office ou generation client (pdf-lib).

### 7.2 Export Excel (XLSX)
Export en fichier Excel avec : feuille de donnees (en-tetes en gras, types preserves, formules SUM en pied pour les colonnes numeriques), feuille de metadonnees (nom du rapport, date, filtres). Via SheetJS cote client.

### 7.3 Export CSV
Export en CSV brut avec les colonnes et filtres du rapport. Delimiteur configurable (virgule, point-virgule). Encodage UTF-8 avec BOM pour compatibilite Excel.

### 7.4 Export Image
Export du graphique en image PNG haute resolution (2x pour Retina). Telechargement direct. Utile pour l'insertion dans des presentations ou des documents.

### 7.5 Rapports programmes
Configuration d'un envoi automatique : frequence (quotidien, hebdomadaire le lundi, mensuel le 1er), heure d'envoi, format (PDF ou Excel), destinataires (emails). Le rapport est execute automatiquement avec les donnees a jour et envoye par email via signapps-mail.

### 7.6 Lien de partage externe
Generation d'un lien public (token unique) permettant a un destinataire externe de consulter le rapport en lecture seule sans compte SignApps. Le lien a une date d'expiration configurable (1 jour, 1 semaine, 1 mois). Revocable a tout moment.

### 7.7 Embedding
Les rapports sauvegardes peuvent etre embeddes dans d'autres pages SignApps (dashboard, wiki) via un composant React ou une iframe. URL d'embed stable : `/reports/embed/{report_id}?token={embed_token}`.

---

## Categorie 8 — Architecture backend

### 8.1 API Reports
Le constructeur de rapports est un module frontend qui interroge les APIs existantes des services SignApps. Pas de nouveau service backend dedie — les requetes sont routees via le gateway vers les services concernes.

### 8.2 Endpoint de requete generique
`POST /api/v1/reports/query` accepte un payload JSON :
```json
{
  "source": "activities",
  "columns": ["title", "status", "assignee", "created_at"],
  "filters": [{"column": "status", "op": "in", "value": ["todo", "in_progress"]}],
  "sort": [{"column": "created_at", "direction": "desc"}],
  "aggregations": [{"column": "status", "function": "count"}],
  "group_by": ["status"],
  "page": 1,
  "page_size": 50
}
```
Le gateway traduit cette requete en appels aux APIs des services concernes et aggrege les resultats.

### 8.3 Schema des sources
`GET /api/v1/reports/sources` retourne la liste des sources disponibles avec leurs schemas :
```json
[
  {
    "id": "activities",
    "label": "Activites",
    "columns": [
      {"name": "title", "type": "text", "label": "Titre"},
      {"name": "status", "type": "enum", "label": "Statut", "values": ["todo", "in_progress", "done", "blocked"]},
      {"name": "created_at", "type": "date", "label": "Date de creation"}
    ]
  }
]
```

### 8.4 Cache des resultats
Les resultats de requetes sont caches via signapps-cache (moka) avec un TTL de 5 minutes. Cle de cache : hash du payload de requete + user_id. Invalidation automatique quand les donnees sources changent (via PgEventBus).

### 8.5 Limites et performance
- Maximum 10 colonnes par rapport (au-dela, avertissement de lisibilite)
- Maximum 10 000 lignes par export (au-dela, suggestion de filtrer)
- Timeout de requete : 30 secondes
- Pagination obligatoire pour les affichages (pas de full scan en memoire)

### 8.6 Permissions
L'utilisateur ne voit que les donnees auxquelles il a acces dans le module source. Si un utilisateur n'a pas acces au module Billing, la source `Factures` n'est pas listee dans le dropdown. Les filtres de row-level security (departement, equipe) sont appliques automatiquement par les APIs des services.

### 8.7 PgEventBus
Evenements emis : `reports.report.created`, `reports.report.updated`, `reports.report.shared`, `reports.report.exported`, `reports.scheduled.sent`. Consommes par signapps-notifications pour alerter les destinataires de rapports partages ou programmes.

---

## References OSS

**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Apache Superset** (github.com/apache/superset) | **Apache-2.0** | Reference principale. Visual query builder, chart gallery, dashboards, filtres globaux, SQL Lab. Architecture plugin charts. |
| **Metabase** (github.com/metabase/metabase) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Pattern visual query builder sans SQL, questions, dashboards, collections. |
| **Redash** (github.com/getredash/redash) | **BSD-2-Clause** | Query editor, visualisations multiples par requete, dashboards, alertes. Pattern multi-datasource et scheduling. |
| **Recharts** (github.com/recharts/recharts) | **MIT** | Deja utilise dans SignApps. Composants React pour bar, line, pie, area, scatter, treemap, radar. Base de la visualisation des rapports. |
| **nivo** (github.com/plouc/nivo) | **MIT** | Composants de visualisation riches (heatmap, treemap, sunburst, sankey, chord). Complement a Recharts pour les types avances. |
| **TanStack Table** (github.com/TanStack/table) | **MIT** | Headless table library pour React. Tri, filtrage, pagination, groupement, colonnes redimensionnables. Base du tableau de resultats. |
| **react-grid-layout** (github.com/react-grid-layout/react-grid-layout) | **MIT** | Layout drag-and-drop pour les dashboards de rapports. Grille responsive avec redimensionnement des widgets. |
| **SheetJS** (github.com/SheetJS/sheetjs) | **Apache-2.0** | Generation de fichiers XLSX cote client pour l'export Excel des rapports. |
| **pdf-lib** (github.com/Hopding/pdf-lib) | **MIT** | Generation de PDFs cote client pour l'export PDF des rapports. |
| **dnd-kit** (github.com/clauderic/dnd-kit) | **MIT** | Drag-and-drop moderne pour React. Pattern pour le reordonnancement des colonnes et des widgets de dashboard. |

---

## Assertions E2E cles (a tester)

- Page `/reports` → le titre `Constructeur de rapports` et le sous-titre sont affiches
- Dropdown Source → les sources disponibles sont listees (Activites, Calendrier, Fichiers, Contacts, etc.)
- Selection source `Activites` → les colonnes disponibles (titre, statut, priorite, assignee) sont proposees
- Bouton `Ajouter` → le panneau de selection de colonnes s'ouvre avec les champs de la source
- Ajout de colonne → un chip apparait dans la zone de construction avec le nom du champ
- Drag-and-drop colonne → l'ordre des colonnes change dans la zone de construction et dans le tableau
- Suppression colonne → clic sur la croix du chip retire la colonne
- Bouton `Executer` → le tableau de resultats s'affiche avec les donnees correspondantes
- Pagination → navigation entre les pages de resultats, compteur `X-Y sur Z` correct
- Filtre sur colonne statut → selection de `en cours` filtre les resultats cote serveur
- Tri par clic sur en-tete → les resultats sont retries et l'indicateur fleche s'affiche
- Aggregation count sur statut → le tableau affiche les groupes avec compteurs
- Switch mode Graphique → le bar chart s'affiche avec les donnees du rapport
- Switch mode Mixte → le tableau et le graphique sont affiches simultanement
- Configuration graphique → changement de type (pie, line) met a jour la visualisation
- Bouton Sauvegarder → le dialog s'ouvre avec nom et description, sauvegarde reussie
- Page `/reports/saved` → la liste des rapports sauvegardes s'affiche
- Ouvrir un rapport sauvegarde → la configuration est restauree (source, colonnes, filtres)
- Partage de rapport → le destinataire voit le rapport dans `Partages avec moi`
- Export PDF → un fichier PDF est telecharge avec le tableau et le graphique
- Export Excel → un fichier XLSX est telecharge avec les donnees formatees
- Export CSV → un fichier CSV est telecharge avec les colonnes du rapport
- Template `Charge de travail par equipe` → ouvre un rapport pre-configure avec les bonnes colonnes
- Colonne calculee → la formule est evaluee et le resultat affiche dans le tableau
- Mise en forme conditionnelle → les cellules du statut `Bloque` sont en rouge
- Rapport programme → la configuration de planification est accessible et sauvegardable
- Utilisateur sans acces Billing → la source `Factures` n'est pas listee dans le dropdown
- Source sans resultats → message `Aucun resultat pour les filtres selectionnes`
- Service indisponible → message d'erreur gracieux `Donnees non disponibles`
