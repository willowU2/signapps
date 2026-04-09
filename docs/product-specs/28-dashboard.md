# Module Dashboard — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Google Workspace Home** | Priorités intelligentes (emails, invitations, fichiers récents), suggestions AI proactives (Smart Compose, Smart Reply), intégration cross-app fluide (Drive, Calendar, Gmail, Tasks dans une seule vue), chips contextuels |
| **Microsoft Viva Insights / M365 Home** | Focus time recommandé, wellbeing metrics, meeting insights, digest email quotidien, intégration Teams/Outlook/OneDrive, Copilot daily briefing, suggested tasks |
| **Notion Dashboard** | Blocks composables (databases inline, embeds, toggles, callouts), templates communautaires, relations cross-database, formulas 2.0, synced blocks, AI summary |
| **Monday.com Dashboard** | Widgets drag-and-drop (chart, battery, numbers, timeline, table), dashboard multi-boards, filtres globaux, benchmarks KPI avec objectifs, partage public |
| **ClickUp Dashboard** | 50+ widget types (time tracking, sprint burndown, chat, embed, portfolio, goals), custom calculations, filtres par espace/projet/liste, mode TV |
| **Asana Home** | My Tasks triées par priorité, goals tracking, inbox notifications centralisées, reporting portfolios, status updates, recommended tasks |
| **Salesforce Home** | Assistant AI Einstein, KPI cards configurable, recent records, pinned lists, news feed, performance chart, quarterly pipeline, customizable compact layout |
| **Todoist Home** | Productivity trends, weekly review, karma score, daily goals, tâches overdue mises en avant, intégration calendrier |
| **Geckoboard** | Dashboards TV-optimized, data sources multiples, live wallboard, alertes seuil, branding custom, spreadsheet integration |
| **Klipfolio PowerMetrics** | Metrics catalog, data modelling layer, automated insights, drill-down, scheduled snapshots, unified metrics definitions |
| **Databox** | Scorecards, goals tracking, daily/weekly digests, 70+ integrations, mobile-first dashboard, annotations timeline |
| **Grafana** | Panels composables (graph, stat, gauge, table, heatmap, logs), templating variables, alerting rules, annotations, dashboard-as-code JSON |

## Principes directeurs

1. **Vue unifiée cross-modules** — le dashboard agrège les données de tous les modules SignApps (Mail, Calendar, Drive, Tasks, Contacts, Chat) dans une seule interface sans navigation aller-retour.
2. **AI proactive, pas intrusive** — le résumé quotidien AI est généré automatiquement mais reste un widget optionnel. L'utilisateur choisit quels insights recevoir.
3. **Personnalisation par drag-and-drop** — chaque utilisateur compose son dashboard en ajoutant, retirant, redimensionnant et réordonnant des widgets sans intervention admin.
4. **Temps réel sans refresh** — les KPIs, notifications et listes se mettent à jour via WebSocket. Le bouton Actualiser force un rechargement complet mais le flux normal est push.
5. **Performance au premier rendu** — le dashboard doit s'afficher en < 1 seconde avec les données essentielles ; les widgets secondaires se chargent progressivement (skeleton loading).
6. **Responsive et imprimable** — la grille de widgets s'adapte du mobile (1 colonne) au desktop (3-4 colonnes) et le mode impression restitue un rapport PDF propre.

---

## Catégorie 1 — Résumé quotidien AI

### 1.1 Génération automatique du briefing matinal
Au premier accès de la journée, le dashboard affiche un résumé AI généré à partir des emails non lus, événements du jour, tâches en retard, fichiers récemment partagés et mentions dans le chat. Le résumé est un paragraphe structuré (3-5 phrases) avec des liens cliquables vers chaque élément mentionné.

### 1.2 Priorités suggérées
L'AI identifie les 3-5 actions prioritaires de la journée en fonction de l'urgence (deadlines, emails de managers, réunions imminentes) et les présente sous forme de checklist actionnable. Chaque suggestion peut être validée (marquer comme fait), reportée ou ignorée.

### 1.3 Insights proactifs
Détection automatique de patterns inhabituels : pic d'emails non lus, réunion sans agenda, tâche bloquée depuis 3+ jours, fichier partagé non ouvert. Affichage sous forme de cartes d'alerte avec icône contextuelle et action suggérée.

### 1.4 Résumé configurable
L'utilisateur choisit les sources du résumé AI (Mail, Calendar, Tasks, Drive, Chat) et le niveau de détail (concis / détaillé). Option de recevoir le briefing par email ou notification push en plus de l'affichage dashboard.

### 1.5 Historique des résumés
Accès aux résumés des jours précédents via un sélecteur de date. Utile pour retrouver un contexte après une absence ou des congés.

---

## Catégorie 2 — KPIs et métriques

### 2.1 Cartes KPI principales
Trois cartes en haut du dashboard : `Documents` (nombre total de documents récents avec tendance), `Emails non lus` (compteur temps réel avec badge), `Événements` (nombre d'événements aujourd'hui/cette semaine). Chaque carte est cliquable et redirige vers le module correspondant.

### 2.2 Tendances et sparklines
Chaque KPI affiche une sparkline sur 7 jours pour visualiser la tendance (hausse/baisse). Couleur verte si amélioration, rouge si dégradation, gris si stable.

### 2.3 KPIs personnalisables
L'utilisateur peut ajouter des KPIs supplémentaires : Tâches terminées cette semaine, Contacts ajoutés ce mois, Réunions cette semaine, Fichiers partagés, Messages Chat. Configuration via le panneau de personnalisation.

### 2.4 Objectifs et seuils
Définir un objectif par KPI (ex : « répondre à tous les emails avant 18h »). Barre de progression et notification quand l'objectif est atteint ou en danger.

### 2.5 KPIs d'équipe (managers)
Les managers voient des KPIs agrégés pour leur équipe : tâches complétées par l'équipe, temps moyen de réponse email, taux de présence aux réunions. Accès conditionné au rôle RBAC.

---

## Catégorie 3 — Widgets de contenu

### 3.1 Tâches récentes
Liste des 5-10 dernières tâches assignées à l'utilisateur, triées par deadline. Affichage : titre, projet, priorité (badge couleur), deadline, statut (à faire / en cours / fait). Clic ouvre la tâche dans le module Tasks. Checkbox pour marquer comme terminé directement depuis le dashboard.

### 3.2 Agenda du jour
Timeline verticale des événements de la journée avec heure de début, durée, titre, participants (avatars). Les créneaux libres sont visibles. Clic sur un événement ouvre le détail dans Calendar. Bouton rapide « Ajouter un événement » en bas.

### 3.3 Emails récents
Liste des 5-10 derniers emails reçus avec : expéditeur (avatar + nom), objet, aperçu du body (1 ligne), date/heure, badge « non lu ». Clic ouvre l'email dans Mail. Actions rapides : marquer comme lu, archiver, répondre.

### 3.4 Fichiers récents
Grille ou liste des 5-10 derniers fichiers ouverts/modifiés/partagés. Affichage : icône du type (doc, sheet, pdf, image), nom, dernier modifié, propriétaire. Clic ouvre le fichier. Actions rapides : partager, télécharger, renommer.

### 3.5 Activité récente (flux d'activité)
Timeline chronologique des actions de l'utilisateur et de son équipe : « Alice a partagé Budget Q2.xlsx », « Bob vous a mentionné dans #projet-alpha », « Réunion 'Sprint Review' dans 30 min ». Filtrable par type d'activité et par personne.

### 3.6 Widget notes rapides
Bloc de texte libre (type sticky note) persistant entre les sessions. L'utilisateur y note des rappels, des idées, des numéros de téléphone. Markdown basique supporté (gras, listes, liens).

### 3.7 Widget favoris / raccourcis
Grille d'icônes de raccourcis vers les pages les plus visitées ou les documents épinglés. L'utilisateur ajoute des raccourcis par drag-drop ou menu contextuel depuis n'importe quel module.

---

## Catégorie 4 — Personnalisation et layout

### 4.1 Grille drag-and-drop
Le dashboard est une grille responsive où chaque widget occupe un rectangle (1x1, 2x1, 1x2, 2x2, 3x1, etc.). L'utilisateur déplace les widgets par drag-and-drop, les redimensionne en tirant les bords, et l'arrangement est sauvegardé automatiquement.

### 4.2 Catalogue de widgets
Bouton « Personnaliser » ouvre un panneau latéral listant tous les widgets disponibles par catégorie (AI, KPIs, Contenu, Équipe, Système). Chaque widget a un aperçu visuel et une description. Ajout en un clic ou par drag dans la grille.

### 4.3 Dashboards multiples
Possibilité de créer plusieurs dashboards nommés (« Mon bureau », « Vue projet Alpha », « Réunion hebdo »). Navigation par onglets en haut. Un dashboard par défaut est affiché à la connexion.

### 4.4 Templates de dashboard
Bibliothèque de templates pré-configurés par rôle : « Manager », « Développeur », « Commercial », « RH », « Direction ». Application en un clic, personnalisable ensuite.

### 4.5 Dashboards partagés (équipe)
Un manager peut créer un dashboard et le partager en lecture avec son équipe. Les widgets affichent les données agrégées de l'équipe. Permission : lecture seule ou édition collaborative.

### 4.6 Mode sombre / clair
Le dashboard respecte le thème global SignApps (dark/light). Les widgets utilisent les tokens sémantiques (`bg-card`, `text-foreground`, `border-border`).

---

## Catégorie 5 — Actions et interactions

### 5.1 Bouton Actualiser
Force le rechargement de tous les widgets. Animation de rotation sur l'icône pendant le chargement. Raccourci clavier `Ctrl+R` (intercepté avant le refresh navigateur).

### 5.2 Bouton Imprimer
Génère une version imprimable du dashboard (mise en page optimisée pour A4/Letter). Les widgets sont disposés en colonnes avec pagination automatique. Export PDF via `Ctrl+P`.

### 5.3 Actions rapides globales
Barre d'actions en haut du dashboard : « Nouveau document », « Nouvel email », « Nouvel événement », « Nouvelle tâche ». Chaque bouton ouvre un dialog modal rapide sans quitter le dashboard.

### 5.4 Recherche contextuelle
Barre de recherche intégrée au dashboard qui filtre les widgets affichés (ex : taper « budget » filtre les tâches, fichiers et emails contenant « budget »).

### 5.5 Notifications inline
Les widgets affichent des badges de notification (compteur non lu, deadline imminente). Un panneau latéral « Notifications » regroupe toutes les alertes avec actions (marquer lu, ouvrir, reporter).

---

## Catégorie 6 — Widgets avancés

### 6.1 Widget météo / horloge
Horloge temps réel avec fuseau horaire configurable. Météo locale via API publique. Utile pour les équipes distribuées (afficher plusieurs fuseaux).

### 6.2 Widget objectifs OKR
Affichage des objectifs trimestriels avec barre de progression. Lié au module Tasks/Projects si configuré. Mise à jour manuelle ou automatique selon les tâches complétées.

### 6.3 Widget graphique custom
Widget graphique configurable : l'utilisateur choisit une source de données (tâches par statut, emails par jour, événements par semaine) et un type de graphique (barres, lignes, donut). Rendu via Chart.js.

### 6.4 Widget embed iframe
Intégrer une page externe (URL) dans un widget. Utile pour les dashboards BI, les tableaux Grafana, les pages intranet. Restrictions CSP configurables par l'admin.

### 6.5 Widget calendrier compact
Mini-calendrier mensuel avec les jours ayant des événements marqués par un point coloré. Clic sur un jour affiche la liste des événements dans un popover. Navigation mois par mois.

### 6.6 Widget chat récent
Affiche les 5 dernières conversations Chat avec aperçu du dernier message. Clic ouvre la conversation dans le module Chat. Badge compteur de messages non lus.

### 6.7 Widget compteurs équipe
Pour les managers : nombre de membres présents aujourd'hui, en congé, en télétravail, en réunion. Lié aux modules Calendar et HR/Workforce.

---

## Catégorie 7 — Performance et technique

### 7.1 Chargement progressif (skeleton)
Au premier rendu, chaque widget affiche un skeleton loader (rectangles gris animés) pendant que les données chargent. Les widgets se remplissent indépendamment dès que leur API répond, sans attendre les autres.

### 7.2 Cache local et stale-while-revalidate
Les données du dashboard sont mises en cache localement (IndexedDB). Au prochain chargement, les données en cache sont affichées immédiatement pendant que les données fraîches sont récupérées en arrière-plan.

### 7.3 WebSocket pour les mises à jour temps réel
Les KPIs (emails non lus, tâches) sont mis à jour via WebSocket PgEventBus. Pas de polling. Le dashboard souscrit aux événements pertinents pour l'utilisateur connecté.

### 7.4 Agrégation côté gateway
Le backend Gateway (`signapps-gateway`, port 3099) agrège les données de tous les services en un seul appel API `/api/v1/dashboard/summary` pour éviter les appels multiples depuis le frontend.

### 7.5 Responsive mobile
Sur mobile, les widgets passent en colonne unique. Les widgets peu utiles sur petit écran (graphiques, embed) sont masqués par défaut. Gestures : pull-to-refresh, swipe entre dashboards.

### 7.6 Accessibilité WCAG AA
Navigation complète au clavier entre les widgets (Tab / Shift+Tab). Chaque widget a un `role="region"` avec `aria-label`. Les KPIs sont annoncés par les lecteurs d'écran. Contrastes AA respectés.

---

## Catégorie 8 — Données et intégrations backend

### 8.1 API agrégée Gateway
Le endpoint `/api/v1/dashboard/summary` du gateway (port 3099) agrège en un seul appel : nombre d'emails non lus (Mail, port 3012), nombre d'événements du jour (Calendar, port 3011), tâches assignées (Tasks), fichiers récents (Drive/Storage, port 3004). Le frontend fait un seul appel au chargement.

### 8.2 Événements PgEventBus
Les mises à jour incrémentales (nouvel email, tâche terminée, événement ajouté) sont poussées via PgEventBus. Le frontend souscrit aux topics pertinents pour l'utilisateur connecté. Pas de polling.

### 8.3 Préférences utilisateur persistantes
Le layout du dashboard, les widgets sélectionnés, les dashboards nommés et les préférences (thème, mode d'affichage) sont stockés dans la table `user_preferences` via l'API Identity (port 3001). Synchronisation cross-device.

### 8.4 Rate limiting des widgets
Chaque widget a un TTL de rafraîchissement minimum (ex : KPIs 30s, emails 60s, fichiers 120s) pour éviter de surcharger les services backend. Le bouton Actualiser force le rechargement en ignorant le TTL.

### 8.5 Fallback gracieux
Si un service backend est indisponible, le widget correspondant affiche un message « Service temporairement indisponible » au lieu de crasher tout le dashboard. Les autres widgets restent fonctionnels.

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **Google Workspace Home** (workspace.google.com) — documentation sur la page d'accueil unifiée, priorités intelligentes, intégration cross-app.
- **Microsoft Viva Insights** (learn.microsoft.com/viva) — guides sur les wellbeing metrics, focus time, daily briefings.
- **Notion Templates Gallery** (notion.so/templates) — templates de dashboards personnels et d'équipe, patterns de databases inline.
- **Monday.com Help Center** (support.monday.com) — documentation sur les dashboard widgets, filtres globaux, benchmarks KPI.
- **ClickUp University** (university.clickup.com) — cours sur la création de dashboards, 50+ types de widgets, custom calculations.
- **Asana Guide** (asana.com/guide) — documentation sur Home, My Tasks, Portfolios, Status Updates.
- **Geckoboard Blog** (geckoboard.com/blog) — bonnes pratiques pour les dashboards TV, choix de métriques, design de KPIs.
- **Databox Blog** (databox.com/blog) — guides sur les scorecards, goals tracking, dashboard design patterns.

### Projets open source permissifs à étudier comme pattern
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **react-grid-layout** (github.com/react-grid-layout/react-grid-layout) | **MIT** | Grille drag-and-drop responsive. Pattern de référence pour le layout de widgets. |
| **gridstack.js** (github.com/gridstack/gridstack.js) | **MIT** | Grille de widgets avec resize, drag, serialization. Alternative à react-grid-layout. |
| **dnd-kit** (github.com/clauderic/dnd-kit) | **MIT** | Drag-and-drop accessible et performant pour React. Pattern pour les interactions widget. |
| **Chart.js** (chartjs.org) | **MIT** | Graphiques canvas pour les widgets KPI (barres, lignes, donut). Déjà utilisé dans SignApps. |
| **Apache ECharts** (echarts.apache.org) | **Apache-2.0** | Graphiques riches pour les widgets avancés (gauge, heatmap, treemap). |
| **Recharts** (recharts.org) | **MIT** | Graphiques React déclaratifs. Pattern pour les sparklines et mini-charts dans les KPIs. |
| **@tanstack/react-query** (tanstack.com/query) | **MIT** | Stale-while-revalidate, cache, refetch. Pattern pour le chargement des données widgets. |
| **date-fns** (date-fns.org) | **MIT** | Manipulation de dates pour l'agenda, les deadlines, les tendances KPI. |
| **Zustand** (github.com/pmndrs/zustand) | **MIT** | State management léger. Déjà utilisé dans SignApps pour les stores. |
| **Framer Motion** (framer.com/motion) | **MIT** | Animations fluides pour les transitions de widgets, skeleton loading, drag feedback. |

### Pattern d'implémentation recommandé
1. **Layout** : `react-grid-layout` (MIT) pour la grille drag-and-drop. Persistance du layout dans le store utilisateur (Zustand + API backend).
2. **Data fetching** : `@tanstack/react-query` (MIT) avec stale-while-revalidate pour chaque widget indépendamment.
3. **Temps réel** : WebSocket via PgEventBus pour les compteurs (emails, notifications, tâches).
4. **Graphiques** : Chart.js (MIT) pour les sparklines et widgets chart. ECharts (Apache-2.0) pour les graphiques complexes.
5. **AI Summary** : appel au service `signapps-ai` (port 3005) via le gateway. Résumé généré par le LLM configuré.
6. **Impression** : CSS `@media print` avec layout optimisé. Export PDF via `html2canvas` (MIT) + `jsPDF` (MIT).

---

## Assertions E2E clés (à tester)

- Le dashboard affiche les 3 KPIs principaux (Documents, Emails non lus, Événements) au chargement
- Le résumé AI quotidien se génère et affiche un texte cohérent avec des liens cliquables
- Clic sur un KPI redirige vers le module correspondant
- Le widget Tâches récentes affiche les tâches assignées à l'utilisateur connecté
- Le widget Agenda du jour affiche les événements de la date courante
- Le widget Emails récents affiche les derniers emails avec badge non lu
- Le widget Fichiers récents affiche les fichiers modifiés récemment
- Le bouton Personnaliser ouvre le panneau de catalogue de widgets
- Drag-and-drop d'un widget le repositionne dans la grille
- Redimensionnement d'un widget change ses dimensions visuelles
- Ajout d'un widget depuis le catalogue l'insère dans la grille
- Suppression d'un widget le retire de la grille
- Le layout personnalisé persiste après rechargement de la page
- Le bouton Actualiser recharge les données de tous les widgets
- Le bouton Imprimer génère un rendu PDF cohérent
- Les actions rapides (Nouveau document, Nouvel email, etc.) ouvrent les dialogs modaux
- La checkbox sur une tâche la marque comme terminée sans quitter le dashboard
- Le widget notes rapides sauvegarde le texte entre les sessions
- Le dashboard s'adapte en colonne unique sur mobile (viewport < 768px)
- Les skeleton loaders s'affichent pendant le chargement des widgets
- Les KPIs d'équipe ne sont visibles que pour les utilisateurs avec le rôle manager
- Le mode sombre applique les bonnes couleurs sur tous les widgets
- Navigation clavier complète entre les widgets (Tab / Shift+Tab)
