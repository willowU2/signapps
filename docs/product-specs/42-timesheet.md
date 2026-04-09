# Module Timesheet (Pointage) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Toggl Track** | One-click timer, detection d'inactivite, tracking automatique par app/site, rapports visuels (barres, camemberts), projet/client/tag, Pomodoro, integrations 100+, extension navigateur, app mobile, export detaille |
| **Clockify** | 100% gratuit pour equipes, timesheet hebdomadaire grid, approbation manager, tarifs horaires par projet/membre, rappels de saisie, kiosk mode (pointeuse physique), Gantt depuis les entrees, facturation integree |
| **Harvest** | Timer + saisie manuelle, integration facturation (invoices depuis les heures), budgets par projet avec alertes %, rapports par client/projet/tache, integration QuickBooks/Xero, approbation, forecast |
| **TimeCamp** | Tracking automatique par app (capture les apps/sites utilises), timesheet approbation workflow, budgets, attendance (presences), productivite par categorie, GPS tracking mobile, integrations PM |
| **Hubstaff** | Screenshots periodiques, activity levels (clavier/souris), GPS tracking, geofencing (pointage auto par lieu), timesheet approbation, paie automatisee, budgets, rapports d'equipe, integrations PM |
| **Paymo** | Timer + timesheet + facturation + gestion de projet en un, Kanban, Gantt, rapports financiers, multi-devise, clients, depenses, milestones, roles et permissions par projet |
| **RescueTime** | Tracking 100% automatique en arriere-plan (apps, sites, fichiers), score de productivite, objectifs, FocusTime (bloque les distractions), rapports automatiques quotidiens/hebdomadaires, pas de saisie manuelle |
| **Kimai** | Open source (MIT), self-hosted, multi-utilisateur, projets/activites/tags, export CSV/PDF/XLSX, API REST, plugins (approbation, factures, budgets, depenses), theme sombre, permissions granulaires |

## Principes directeurs

1. **Chronometre en un clic** — demarrer le suivi du temps doit etre aussi simple que cliquer Play. Le nom de la tache, le toggle facturable et le timer sont sur une seule ligne, toujours visible.
2. **Saisie manuelle complementaire** — pour les oublis ou les entrees retrospectives, un formulaire compact permet d'ajouter une entree avec date, duree, tache et billable en 5 secondes.
3. **KPIs hebdomadaires en haut de page** — trois metriques toujours visibles : total travaille cette semaine, total facturable, nombre d'entrees. Permettent un coup d'oeil sur l'avancement.
4. **Export vers facturation** — un bouton exporte les entrees facturables vers le module Billing (signapps-billing port 8096) via un custom event inter-modules. Zero double saisie.
5. **Historique complet et auditable** — chaque entree conserve sa source (timer vs manuelle), sa date, sa duree, son statut facturable. L'historique est filtrable et exportable.
6. **Integration calendrier** — les entrees de timesheet apparaissent optionnellement dans le calendrier SignApps et inversement : un evenement calendrier peut generer une entree de temps.

---

## Categorie 1 — Chronometre et saisie de temps

### 1.1 Chronometre (timer)
Widget chronometre toujours visible en haut de la page. Affiche le temps ecoule en format `HH:MM:SS` ou `MMm SSs`. Boutons Play/Pause et Stop. Play demarre le compteur, Pause le suspend, Stop arrete et enregistre l'entree dans l'historique.

### 1.2 Nom de la tache
Champ texte `Nom de la tache...` a gauche du chronometre. Obligatoire avant de demarrer (toast d'erreur si vide). Autocomplete sur les noms de taches recents pour accelerer la saisie.

### 1.3 Toggle facturable
Checkbox `Facturable` a cote du nom de tache. Par defaut coche. Les entrees facturables sont distinguees visuellement (badge vert) et exportables vers Billing.

### 1.4 Saisie manuelle
Bouton `+ Saisie manuelle` ouvre un formulaire compact : nom de tache, date (datepicker), heures + minutes (inputs numeriques), toggle facturable. Validation et ajout a l'historique.

### 1.5 Entree par projet
Chaque entree peut etre associee a un projet (select optionnel). Les projets sont recuperes depuis le module Tasks/Projects. Permet le regroupement et le reporting par projet.

### 1.6 Tags sur les entrees
Systeme de tags libres par entree (ex: `dev`, `meeting`, `admin`, `support`). Utiles pour le filtrage et les rapports de productivite.

---

## Categorie 2 — KPIs et tableau de bord

### 2.1 Total travaille cette semaine
Carte KPI affichant la somme des durees de toutes les entrees de la semaine en cours (lundi a dimanche). Format `XXh YYm`.

### 2.2 Total facturable
Carte KPI affichant la somme des durees des entrees marquees facturables cette semaine. Couleur verte pour differencier.

### 2.3 Heures supplementaires
Carte KPI affichant le depassement par rapport aux heures contractuelles (configurable, par defaut 35h ou 40h). Negatif si sous-utilise, positif si overtime. Couleur rouge si overtime.

### 2.4 Nombre d'entrees
Carte KPI affichant le nombre total d'entrees cette semaine. Indicateur de la granularite du suivi.

### 2.5 Graphique de la semaine
Bar chart horizontal avec les jours de la semaine (lun-dim) et les heures par jour. Couleur differenciee facturable vs non-facturable. Ligne de reference a 7h ou 8h (journee standard).

### 2.6 Repartition par projet
Pie chart ou bar chart montrant la repartition du temps par projet pour la semaine ou le mois. Aide a visualiser ou va le temps.

---

## Categorie 3 — Historique et gestion des entrees

### 3.1 Liste des entrees
Table chronologique inverse (plus recent en haut) avec colonnes : Date, Tache, Projet, Duree, Facturable, Source (timer/manuelle), Actions. Scrollable avec pagination.

### 3.2 Filtres sur l'historique
Filtres combinables : par date (range), par projet, par tag, par facturable (oui/non), par source (timer/manuelle). Persistance du filtre dans l'URL.

### 3.3 Edition d'une entree
Clic sur une entree ouvre un formulaire d'edition inline ou modal. Modification du nom, de la duree, de la date, du statut facturable, du projet, des tags. Sauvegarde automatique.

### 3.4 Suppression d'une entree
Bouton supprimer sur chaque entree avec confirmation. Soft-delete avec possibilite de restauration dans les 30 jours.

### 3.5 Timesheet hebdomadaire (grid view)
Vue grille alternative : lignes = projets/taches, colonnes = jours de la semaine. Cellules editables pour saisir directement les heures. Total par ligne et par colonne. Pattern Clockify/Harvest.

### 3.6 Groupement par jour
Dans la vue liste, les entrees sont groupees par date avec un sous-total de duree par jour. Sections repliables.

---

## Categorie 4 — Export et integration

### 4.1 Export vers Billing
Bouton `Exporter vers Billing` en haut de page. Selectionne les entrees facturables de la semaine/periode et les envoie au module signapps-billing via custom event `billing:import-time-entries`. Toast de confirmation avec le nombre d'entrees exportees.

### 4.2 Export CSV/Excel
Bouton `Exporter` avec options CSV et XLSX. Inclut toutes les colonnes : date, tache, projet, duree, facturable, source, tags.

### 4.3 Export PDF
Rapport formaté avec en-tete (periode, utilisateur, total heures), tableau detaille, et resume par projet. Utile pour les rapports clients.

### 4.4 Integration calendrier
Les entrees de timesheet peuvent creer des blocs dans le calendrier SignApps (signapps-calendar port 3011). Inversement, un evenement calendrier peut pre-remplir une entree de temps.

### 4.5 API REST
Endpoints : `GET /api/v1/timesheet/entries` (liste paginee), `POST` (creation), `PUT/:id` (mise a jour), `DELETE/:id` (suppression). Filtres query params : date_from, date_to, project_id, billable.

### 4.6 Rappels de saisie
Notification quotidienne (configurable) si l'utilisateur n'a pas saisi de temps pour la journee. Via signapps-notifications.

---

## Categorie 5 — Approbation et rapports manager

### 5.1 Soumission pour approbation
L'employe soumet sa feuille de temps hebdomadaire pour validation. Statuts : brouillon → soumis → approuve / rejete. Le manager recoit une notification.

### 5.2 Vue manager
Le manager voit les feuilles de temps de son equipe. Vue par personne ou par projet. Boutons Approuver / Rejeter avec commentaire optionnel.

### 5.3 Rapports d'equipe
Tableau de bord manager avec : heures totales par personne, taux de facturation, overtime, comparaison semaine/semaine, entrees en retard.

### 5.4 Verrouillage apres approbation
Une feuille de temps approuvee ne peut plus etre modifiee par l'employe. Seul le manager ou l'admin peut la deverrouiller.

### 5.5 Audit trail
Log de qui a cree, modifie, soumis, approuve, rejete chaque entree. Horodatage et auteur de chaque action.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Toggl Track Knowledge Base** (support.toggl.com) — guides timer, rapports, integrations.
- **Clockify Help** (clockify.me/help) — timesheet, approbation, kiosk, rapports.
- **Harvest Support** (support.getharvest.com) — time tracking, budgets, invoicing.
- **Kimai Documentation** (www.kimai.org/documentation) — open source, API, configuration, plugins.
- **TimeCamp Blog** (www.timecamp.com/blog) — productivite, time tracking best practices.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Kimai** (github.com/kimai/kimai) | **MIT** | Reference principale. Architecture PHP/Symfony pour le time tracking. Pattern pour les timesheets, approbation, export, API REST. |
| **Traggo** (github.com/traggo/server) | **GPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Tags-based time tracking. |
| **ActivityWatch** (github.com/ActivityWatch/activitywatch) | **MPL-2.0** | Tracking automatique. Pattern pour la detection d'activite et les rapports. Consommation OK (MPL-2.0). |
| **Wakapi** (github.com/muety/wakapi) | **MIT** | Time tracking pour developpeurs. Pattern pour les rapports visuels, l'API REST, les statistiques. |
| **Super Productivity** (github.com/johannesjo/super-productivity) | **MIT** | Time tracking + taches. Pattern pour le timer, la saisie, l'integration projet, les rapports. |
| **Cattr** (github.com/cattr-app/server-application) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Approbation, screenshots. |
| **recharts** (github.com/recharts/recharts) | **MIT** | Graphiques React. Deja utilise dans SignApps pour les bar/pie charts. |

---

## Assertions E2E cles (a tester)

- Saisir un nom de tache, cliquer Play → le chronometre demarre et affiche le temps ecoule
- Cliquer Pause → le chronometre se fige, Play reprend
- Cliquer Stop → l'entree est creee dans l'historique avec la bonne duree
- Demarrer sans nom de tache → toast d'erreur, timer ne demarre pas
- Saisie manuelle : remplir le formulaire, valider → entree ajoutee a l'historique
- KPI `Total semaine` → la somme est correcte apres ajout d'une entree
- KPI `Facturable` → n'inclut que les entrees marquees facturables
- Toggle facturable sur une entree → le badge change et le KPI se met a jour
- Supprimer une entree → elle disparait de la liste, les KPIs se recalculent
- Export vers Billing → toast confirme le nombre d'entrees exportees
- Filtrer par projet → seules les entrees du projet apparaissent
- Vue timesheet grid → saisie directe dans les cellules, totaux recalcules
- Export CSV → fichier telecharge avec toutes les colonnes
- Persistance localStorage → les entrees survivent a un rechargement de page
