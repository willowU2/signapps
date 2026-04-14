# Module Calendar — Specification fonctionnelle P0

Port 3011. Route frontend `/cal`. 11 views, 60+ backend routes, CalDAV RFC 4791, iCalendar RFC 5545, Google/Outlook sync, WebSocket real-time, PgEventBus cross-service events.

---

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Google Calendar** | Natural language quick add, appointment schedules (booking links integres), focus time avec auto-decline, working hours par jour, goals (habit tracking), out-of-office, speedy meetings (50/25min), tasks integrees, working location (office/home), smart suggestions, Google Meet auto-generate |
| **Microsoft Outlook Calendar** | Meeting rooms & resources, FindTime (propose slots), Scheduler, Categories colorees, delegation, integration Teams, Search complet, rules, Time Zone display |
| **Fantastical (Flexibits)** | Natural language a l'excellence, widgets splendides, weather display, templates d'evenements, openings (booking), interesting calendars (sports, holidays), multi-device sync, Cards (full details visible inline) |
| **Notion Calendar (ex-Cron)** | Keyboard-first, multi-account (Google+Outlook), menu bar app, hover previews, timezone overlay, quick book via DMs, Notion integration native |
| **Motion** | AI scheduling (re-organise auto selon priorite et deadline), task-aware (calendrier = tasks + events), auto-decline conflicting meetings, focus blocks auto-places |
| **Reclaim.ai** | Smart schedule pour habits et tasks recurrentes, buffer time auto, travel time, 1:1 scheduling, habit protection |
| **Calendly** | Booking links, types de rendez-vous, disponibilites, buffer time, round-robin, collective scheduling, payment integration, reminders, questions custom |

## Principes directeurs

1. **Rapide et clavier-first** -- creer un evenement en 2 secondes avec `c`, le trouver en 1 seconde avec `/`, l'editer sans lever les mains du clavier.
2. **Unifie multi-source** -- un seul calendrier qui agrege Google, Outlook, ICS externes, calendriers partages equipe, sans duplication visuelle.
3. **Time zone aware** -- les utilisateurs en collaborations internationales voient automatiquement leurs heures et celles des invites cote a cote.
4. **AI pour la resolution de conflits** -- proposition automatique de creneaux libres pour les invites, detection des doublons, reschedule en un clic.
5. **Beau et scannable** -- la grille hebdomadaire/mensuelle doit donner une idee immediate de la charge et des priorites.
6. **11 vues specialisees** -- chaque workflow (planification, presence, taches, disponibilite) a sa propre vue optimisee.

---

## Categorie 1 — Vue Jour (day)

### 1.1 Layout

Grille verticale de 00:00 a 23:59. Axe horaire a gauche avec echelle configurable : 15 min (4 lignes/h, 60px/slot), 30 min (2 lignes/h, 30px/slot), 60 min (1 ligne/h, 15px/slot). Defaut 30 min. Le conteneur principal occupe toute la hauteur disponible sous le header. Scroll vertical si la grille depasse le viewport, scroll initial positionne sur 08:00.

### 1.2 Colonnes de timezone

Deux colonnes de timezone a gauche de la grille. Par defaut, la primary timezone de l'utilisateur (stockee dans `identity.users.timezone`, defaut `Europe/Paris`) est la colonne de gauche. La secondary timezone est optionnelle (defaut `UTC`). Chaque colonne affiche les heures dans sa timezone. Un clic sur un label de timezone ouvre le `TimezoneSelector` qui appelle `PUT /api/v1/timezones/me` pour persister le choix.

### 1.3 Evenements dans la grille

Chaque evenement est une carte coloree (couleur heritee du calendrier `calendar.calendars.color` ou override par `event.category_id -> categories.color`). La carte affiche : titre (tronque si < 30min), heure debut-fin, icone lieu si present, avatar rond (24px) du createur. Les evenements all-day apparaissent dans une barre horizontale au-dessus de la grille, empiles verticalement s'il y en a plusieurs.

### 1.4 Current time indicator

Ligne rouge horizontale de 2px sur toute la largeur de la grille. Position calculee en pourcentage de la journee. Mise a jour toutes les 60 secondes via `setInterval`. Le triangle rouge de 8px a gauche de la ligne sert de marqueur visuel. Visible uniquement quand la date affichee est aujourd'hui.

### 1.5 Clic pour creer

Clic sur un slot horaire vide ouvre le popover `EventForm` pre-rempli avec `start_time` = slot clique, `end_time` = start + 30min. Le champ titre recoit le focus immediatement. `Enter` cree l'evenement via `POST /api/v1/calendars/:calendar_id/events`. `Escape` ferme sans creer.

### 1.6 Drag pour creer

Cliquer et glisser verticalement sur la grille dessine un rectangle bleu translucide entre l'heure de debut (mouse down) et l'heure de fin (mouse up). Le snap est a 15 min (arrondi au quart d'heure le plus proche). Au relachement, le popover `EventForm` s'ouvre pre-rempli avec la plage selectionnee. Implementation via `drag-create-event.tsx` avec `@dnd-kit/core`.

### 1.7 Drag pour deplacer

Attraper un evenement existant (cursor `grab`) et le glisser a un autre slot change `start_time` et `end_time` tout en preservant la duree. La carte fantome (ghost) suit la souris avec `opacity: 0.6`. Au drop, `PUT /api/v1/events/:id` est appele. Un toast `Evenement deplace` avec bouton `Annuler` (undo) apparait pendant 5 secondes. Si l'evenement a des participants, un dialog demande `Mettre a jour pour tous les participants ?` avant l'appel API.

### 1.8 Resize pour changer la duree

Attraper le bord inferieur (ou superieur) d'une carte evenement affiche un cursor `ns-resize`. Glisser modifie `end_time` (ou `start_time`). Snap a 15 min. Implementation via `resize-event.tsx`. Appel `PUT /api/v1/events/:id` au relachement. Duree minimale : 15 min.

### 1.9 Multi-day events en barre

Les evenements qui couvrent plusieurs jours apparaissent dans la zone all-day en haut. La barre est coloree avec le titre tronque. Si plus de 3 all-day events, un chip `+N autres` est affiche ; clic dessus ouvre un popover listant tous les all-day events du jour.

### 1.10 Keyboard shortcuts (vue jour)

| Touche | Action |
|--------|--------|
| `c` | Ouvrir EventForm vide (creer) |
| `t` | Revenir a aujourd'hui |
| `j` ou `Left` | Jour precedent |
| `k` ou `Right` | Jour suivant |
| `Enter` sur un evenement selectionne | Ouvrir EventForm en edition |
| `Delete` sur un evenement selectionne | Supprimer avec confirmation |
| `Ctrl+Z` | Undo derniere action |
| `Ctrl+D` | Dupliquer l'evenement selectionne |
| `/` | Focus sur la barre de recherche |

---

## Categorie 2 — Vue Semaine (week)

### 2.1 Layout

7 colonnes (lundi a dimanche, `weekStartsOn: 1` configure dans `date-fns`). Header de colonne : nom du jour abrege + numero. La colonne d'aujourd'hui a un fond legerement teinte (`bg-primary/5`). Le numero d'aujourd'hui est entoure d'un cercle bleu (`bg-primary text-primary-foreground rounded-full`).

### 2.2 Grille horaire

Identique a la vue jour : lignes horaires de 00:00 a 23:59, echelle 15/30/60 min configurable. Scroll initial sur 08:00. Current time indicator sur la colonne d'aujourd'hui uniquement.

### 2.3 Zone all-day

Barre horizontale au-dessus de la grille. Les evenements all-day ou multi-day apparaissent comme des barres colorees qui s'etendent sur les colonnes correspondantes. Implementation via `multi-day-events.tsx`. Un evenement du lundi au mercredi occupe 3 colonnes. Stack vertical si plusieurs chevauchent.

### 2.4 Evenements superposes

Quand deux evenements se chevauchent dans le meme slot horaire, ils se partagent la largeur de la colonne. 2 evenements = 50% chacun. 3 = 33%. Maximum 4 colonnes paralleles ; au-dela, les evenements debordent avec un scroll horizontal.

### 2.5 Drag-and-drop entre jours

Attraper un evenement et le deplacer horizontalement change le jour tout en preservant l'heure. Deplacer verticalement change l'heure. Deplacer en diagonale change les deux. `DndContext` du `CalendarHub` gere le `DragEndEvent`.

### 2.6 Mini-calendar coordination

Un clic sur un jour dans le `MiniCalendar` (sidebar gauche) navigue la vue semaine vers la semaine contenant ce jour. Le jour clique est mis en surbrillance dans la grille.

### 2.7 Keyboard shortcuts (vue semaine)

| Touche | Action |
|--------|--------|
| `j` ou `Left` | Semaine precedente |
| `k` ou `Right` | Semaine suivante |
| `1-7` | Selectionner lundi (1) a dimanche (7) |

---

## Categorie 3 — Vue Mois (month)

### 3.1 Layout

Grille de 6 rangees x 7 colonnes (42 cellules). Les jours hors du mois courant sont affiches en gris (`text-muted-foreground`). Le header affiche les noms de jours abreges (Lun, Mar, Mer, Jeu, Ven, Sam, Dim).

### 3.2 Event chips

Chaque jour affiche jusqu'a 3 event chips (barre horizontale coloree avec titre tronque, 18px de haut). Un chip montre : pastille de couleur (6px rond) + titre. Les evenements all-day apparaissent en premier. Les evenements temporises sont tries par `start_time`.

### 3.3 Overflow "+N autres"

Si un jour a plus de 3 evenements, le 4eme slot affiche un chip gris `+N autres`. Clic dessus ouvre un popover listant tous les evenements du jour avec titre, heure, couleur. Clic sur un evenement dans le popover ouvre l'`EventForm` en mode edition.

### 3.4 Drag-and-drop

Attraper un event chip et le glisser sur un autre jour change la `start_time` et `end_time` (preserve la duree). Le jour cible affiche un fond bleu translucide au survol (`bg-primary/10`). Implementation via `DndContext` dans `CalendarHub`.

### 3.5 Clic pour creer

Clic sur un jour vide ouvre `EventForm` pre-rempli avec `is_all_day: true` et la date du jour clique.

### 3.6 Double-clic pour naviguer

Double-clic sur un numero de jour bascule vers la vue `day` pour ce jour specifique via `setView("day")` + `setDate(clickedDate)`.

### 3.7 Keyboard shortcuts (vue mois)

| Touche | Action |
|--------|--------|
| `j` ou `Left` | Mois precedent |
| `k` ou `Right` | Mois suivant |

---

## Categorie 4 — Vue Agenda (agenda)

### 4.1 Layout

Liste chronologique verticale des evenements groupes par date. Chaque groupe commence par un header sticky avec la date formatee (`Lundi 15 avril 2026`). Header d'aujourd'hui affiche `Aujourd'hui` en bleu.

### 4.2 Event cards

Chaque evenement est une ligne avec : heure debut-fin (ou `Toute la journee`), pastille de couleur, titre, lieu (icone MapPin), nombre de participants (icone Users + count). Hover : fond `bg-muted`. Clic : ouvre `EventForm` en edition.

### 4.3 Infinite scroll

Les evenements sont charges par pages de 50. Quand le scroll atteint 80% du bas, la page suivante est chargee via `GET /api/v1/calendars/:calendar_id/events?after=<cursor>&limit=50`. Les evenements passes sont accessibles en scrollant vers le haut (chargement bidirectionnel).

### 4.4 Filtres

Barre de filtres au-dessus de la liste : par calendrier (multi-select checkboxes), par type d'evenement (event/task/leave/shift/booking/milestone/blocker/cron), par participant, par projet. Les filtres sont passes comme query params a l'API.

### 4.5 Search

Le champ de recherche (`/` pour focus) filtre en temps reel par titre, description et lieu. Recherche client-side sur les evenements deja charges, puis server-side pour les evenements non charges. Debounce 300ms.

### 4.6 Print-friendly

Bouton imprimante dans le header de la vue. Ouvre `printable-agenda.tsx` dans une fenetre d'impression avec mise en page optimisee (pas de sidebar, police serif, marges).

---

## Categorie 5 — Vue Frise / Timeline (timeline)

### 5.1 Layout

Axe horizontal = temps (colonnes de 7 jours, chaque colonne = 1 jour). Axe vertical = rangees, une par evenement/tache. Chaque rangee affiche une barre horizontale coloree dont la largeur represente la duree de l'evenement. Implementation via `TimelineView.tsx`.

### 5.2 Echelle de temps

Toggle entre : jour, semaine, mois. En mode semaine (defaut), chaque colonne = 1 jour. En mode mois, chaque colonne = 1 semaine. Scroll horizontal pour naviguer dans le temps. Le label du header affiche `MMMM yyyy` via `getDateTitle`.

### 5.3 Barres d'evenements

Chaque barre affiche : titre (dans la barre si assez large, sinon en tooltip au survol), couleur du calendrier/categorie. Barres empilees verticalement sans chevauchement. Hauteur de barre = 28px, espacement = 4px.

### 5.4 Drag pour deplacer

Glisser horizontalement une barre change les dates. Glisser les bords gauche/droit change la date de debut/fin (resize). Snap a 1 jour.

### 5.5 Dependencies (future)

Fleches entre les barres pour representer les dependances entre taches. Non implemente dans la v1 — les barres sont independantes.

### 5.6 Swimlanes

Regroupement optionnel par : calendrier, projet, assignee, type d'evenement. Chaque groupe a un header collapsible. Defaut : pas de groupement (liste plate).

### 5.7 Today marker

Ligne verticale rouge de 2px sur la position d'aujourd'hui dans l'axe horizontal.

---

## Categorie 6 — Vue Kanban (kanban)

### 6.1 Layout

Colonnes verticales representant les statuts : `A faire` (draft), `En cours` (pending), `Termine` (completed), `Annule` (rejected). Implementation via `KanbanView.tsx`. Chaque colonne a un header avec le nom du statut, un count badge et un bouton `+ Ajouter` en bas.

### 6.2 Cartes

Chaque carte affiche : titre, pastille de priorite (vert=low, jaune=medium, orange=high, rouge=urgent), avatar de l'assigne, date d'echeance, tags colores. Hover : elevation shadow augmentee. Clic : ouvre `EventForm` en edition.

### 6.3 Drag-and-drop entre colonnes

Glisser une carte d'une colonne a une autre change `status` via `PUT /api/v1/events/:id` (body: `{ status: "completed" }`). Animation de transition 200ms ease-out. La colonne cible affiche un indicateur bleu au survol.

### 6.4 Bouton "+ Ajouter"

En bas de chaque colonne, le bouton `+ Ajouter` ouvre un input inline (comme Trello). Taper un titre + `Enter` cree un evenement de type `task` avec le statut de la colonne via `POST /api/v1/calendars/:calendar_id/events` (body: `{ title, event_type: "task", status }`).

### 6.5 Filtres kanban

Barre de filtres au-dessus : par assignee, par priorite, par projet, par tags. Les colonnes sont mises a jour en temps reel.

### 6.6 WIP limits (future)

Limite configurable du nombre de cartes par colonne. Non implemente v1.

---

## Categorie 7 — Vue Disponibilite Heatmap (heatmap)

### 7.1 Layout

Grille avec : axe horizontal = jours de la semaine (lundi a dimanche), axe vertical = creneaux horaires (8:00 a 18:00 par defaut, configurable). Chaque cellule represente un creneau de 1 heure pour un jour donne. Implementation via `HeatmapView.tsx`.

### 7.2 Code couleur

Chaque cellule est coloree selon le niveau de charge :
- **Libre** (0 evenement) : vert (`bg-green-100 dark:bg-green-900/30`)
- **Leger** (1 evenement) : jaune (`bg-yellow-100 dark:bg-yellow-900/30`)
- **Modere** (2-3 evenements) : orange (`bg-orange-100 dark:bg-orange-900/30`)
- **Charge** (4+ evenements) : rouge (`bg-red-100 dark:bg-red-900/30`)

### 7.3 Legende

Barre de legende en bas : Libre | Leger | Modere | Charge avec les couleurs correspondantes.

### 7.4 Tooltip au survol

Survol d'une cellule affiche un tooltip avec : date, heure, nombre d'evenements, et la liste des titres des evenements dans ce creneau.

### 7.5 Clic pour creer

Clic sur une cellule verte (libre) ouvre `EventForm` pre-rempli avec la date et l'heure du creneau.

### 7.6 Scope utilisateur

Par defaut, la heatmap affiche les evenements de l'utilisateur connecte. Un dropdown permet de selectionner un autre membre de l'equipe (si le calendrier est partage et la permission le permet). Les donnees proviennent de `GET /api/v1/calendars/:calendar_id/events?start=<week_start>&end=<week_end>`.

---

## Categorie 8 — Vue Planning / Roster (roster)

### 8.1 Layout

Grille avec : axe vertical = employes (lignes), axe horizontal = jours de la semaine courante (7 colonnes). Chaque cellule montre le shift assigne. Implementation via `RosterView.tsx`.

### 8.2 Types de shift

Les shifts disponibles sont : **Matin** (M, 6:00-14:00), **Apres-midi** (A, 14:00-22:00), **Nuit** (N, 22:00-6:00), **Journee** (J, 8:00-17:00), **Repos** (R). Chaque type a une couleur distincte et une lettre abregee. Les shifts sont stockes comme des evenements de type `shift` (`event_type = 'shift'`).

### 8.3 Cellule de shift

Chaque cellule affiche : lettre du shift (M/A/N/J/R) avec fond colore. Clic pour changer : ouvre un dropdown avec les options de shift. Selection d'un shift cree ou met a jour un evenement via `POST /PUT /api/v1/calendars/:calendar_id/events`.

### 8.4 Ligne "employe"

La premiere colonne (frozen) affiche le nom de l'employe, son avatar et son departement. Les employes sont charges via l'annuaire (call interne a l'identity service) et filtres par equipe.

### 8.5 Drag-and-drop

Glisser un shift d'une cellule a une autre (meme employe, jour different) deplace le shift. Glisser entre employes reassigne le shift.

### 8.6 Export

Bouton d'export en PDF/CSV. Le `TimesheetExportDialog` genere le rapport de planning.

### 8.7 Regles de couverture

Les `calendar.presence_rules` definissent les regles : couverture minimale (min_coverage), jours obligatoires (mandatory_days). L'endpoint `POST /api/v1/presence/validate` verifie si une action respecte les regles. Les violations sont affichees en rouge avec un warning icon.

---

## Categorie 9 — Vue Taches (tasks)

### 9.1 Layout

Kanban specialise pour les taches (pas les evenements). Colonnes : **Backlog**, **Aujourd'hui**, **En cours**, **Termine**, plus des colonnes custom. Implementation via `TasksView.tsx`.

### 9.2 Cartes de taches

Chaque carte affiche : titre, checkbox de completion, priorite (pastille coloree), avatar de l'assigne, date due, sous-taches count (`2/5`), tags. La checkbox appelle `POST /api/v1/tasks/:id/complete`.

### 9.3 Hierarchie

Les taches supportent la hierarchie parent/enfant via `parent_task_id`. L'endpoint `GET /api/v1/calendars/:calendar_id/tasks/tree` retourne l'arbre complet. En vue kanban, les sous-taches sont affichees comme un compteur sur la carte parente. Clic sur le compteur expand la liste inline.

### 9.4 Drag-and-drop

Glisser entre colonnes change le `status`. Glisser dans la meme colonne change l'`order/position`. L'endpoint `PUT /api/v1/tasks/:id/move` met a jour la position et le statut.

### 9.5 Quick-add inline

Bouton `+ Ajouter` en haut de chaque colonne. Input inline, `Enter` cree via `POST /api/v1/calendars/:calendar_id/tasks`.

### 9.6 Filtres

Par assignee, par priorite, par projet, par date due (overdue, today, this week, no date).

---

## Categorie 10 — Vue Disponibilite Multi-entite (availability)

### 10.1 Layout

Grille avec : axe vertical = membres de l'equipe (lignes), axe horizontal = creneaux horaires (colonnes de 30 min sur la journee ou la semaine). Implementation via `AvailabilityView.tsx`.

### 10.2 Code couleur

- **Vert** (libre) : pas d'evenement dans ce creneau
- **Rouge** (conflit) : un ou plusieurs evenements dans ce creneau
- **Gris** (hors working hours) : en dehors des heures de travail definies

### 10.3 Overlay multi-personne

Quand plusieurs lignes sont affichees, les colonnes ou tout le monde est libre sont surlignees en vert vif (`bg-green-500/20`). Les colonnes avec au moins un conflit sont rouges. Permet de trouver visuellement un creneau commun.

### 10.4 Find-a-time integration

Le bouton `Trouver un creneau` ouvre le composant `FindSlot` qui appelle `POST /api/v1/calendar/meeting-suggestions` avec la liste des participants et la duree souhaitee. L'API retourne les 5 meilleurs creneaux tries par score de compatibilite.

### 10.5 Clic pour reserver

Clic sur un creneau vert commun ouvre `EventForm` pre-rempli avec les participants selectionnes et le creneau horaire.

---

## Categorie 11 — Vue Presence (presence)

### 11.1 Layout

Table avec : axe vertical = employes (lignes), axe horizontal = jours de la semaine ou du mois (colonnes). Chaque cellule affiche le mode de presence. Implementation via `PresenceTableView.tsx`.

### 11.2 Modes de presence

- **Bureau** : icone Building, fond bleu clair
- **Remote** : icone Home, fond violet clair
- **Conge** : icone Palmtree, fond vert clair
- **Absent** : icone X, fond rouge clair

Les modes sont stockes comme des evenements de type correspondant. `presence_mode = 'office' | 'remote' | 'absent'`. Les conges sont des evenements `event_type = 'leave'`.

### 11.3 Edition rapide

Clic sur une cellule ouvre un dropdown avec les 4 modes. Selection met a jour ou cree un evenement all-day via l'API events. Un raccourci rapide : `Shift+clic` cycle entre Bureau > Remote > Absent.

### 11.4 Headcount chart

En-dessous du tableau, un graphique a barres empilees (`HeadcountChart.tsx`) affiche par jour : nombre en Bureau (bleu), nombre en Remote (violet), nombre en Conge (vert), nombre Absent (rouge). L'endpoint `GET /api/v1/presence/headcount` fournit les donnees agregees.

### 11.5 Regles de presence

Les regles configurees via `POST /api/v1/presence/rules` imposent des contraintes :
- `min_onsite` : nombre minimum de jours au bureau par semaine
- `mandatory_days` : jours ou la presence au bureau est obligatoire
- `max_remote_same_day` : nombre max de personnes en remote le meme jour
- `min_coverage` : nombre minimum de personnes au bureau chaque jour

L'endpoint `POST /api/v1/presence/validate` verifie si un changement respecte les regles. Si une violation `hard` est detectee, le changement est bloque. Si `soft`, un warning est affiche mais le changement est autorise.

### 11.6 Team status endpoint

`GET /api/v1/presence/team-status` retourne l'etat de presence de toute l'equipe pour la semaine courante. Utilise pour alimenter la vue presence et le headcount chart.

---

## Categorie 12 — Navigation et layout global

### 12.1 CalendarHub

Composant principal (`CalendarHub.tsx`). Contient :
- Header avec titre de date, boutons prev/next/today, selecteur de vue (11 onglets), bouton `+ Nouveau`, boutons Import/Export/Share/FindSlot
- Sidebar gauche (collapsible) avec MiniCalendar, LayerPanel, liste des calendriers
- Zone principale avec la vue active (lazy-loaded via `Suspense`)

### 12.2 View tabs

Les 11 vues sont affichees comme des onglets dans le header. Chaque onglet a : icone, label court, shortcut clavier. L'onglet actif est surligne en bleu. Configuration :

| ID | Label | Short | Icon | Shortcut |
|---|---|---|---|---|
| `day` | Jour | Jour | Calendar | `j` |
| `week` | Semaine | Sem | CalendarRange | `s` |
| `month` | Mois | Mois | Grid3X3 | `m` |
| `agenda` | Agenda | Agenda | List | `a` |
| `timeline` | Frise | Frise | Clock | `t` |
| `kanban` | Kanban | Kanban | Columns3 | `k` |
| `heatmap` | Dispo | Dispo | Activity | `d` |
| `roster` | Planning | Plan. | Users | `p` |
| `tasks` | Taches | Taches | CheckSquare | `x` |
| `availability` | Disponibilite | Dispos | UserCheck | `v` |
| `presence` | Presence | Pres. | Table2 | `r` |

### 12.3 Navigation par date

Boutons `<` et `>` deplacent la date courante d'une unite de vue (1 jour en day, 1 semaine en week, 1 mois en month). Bouton `Aujourd'hui` (ou `t`) remet `currentDate` a `new Date()`. La date affichee est formatee par `getDateTitle(view, date)` en utilisant `date-fns/locale/fr`.

### 12.4 Mini-calendar

Composant `MiniCalendar` dans la sidebar gauche. Calendrier compact d'un mois. Les jours avec des evenements ont un point colore sous le numero. Clic sur un jour navigue la vue courante vers ce jour. Le mois affiche suit la date courante.

### 12.5 Layer panel

Composant `LayerPanel`. Toggle d'activation/desactivation des couches (layers) :
- `my-events` (mes evenements) - actif par defaut
- `my-tasks` (mes taches) - actif par defaut
- `team-leaves` (conges equipe)
- `rooms` (salles de reunion)
- `equipment` (equipements)
- `vehicles` (vehicules)
- `projects` (projets)
- `team-shifts` (shifts equipe)
- `external` (calendriers externes)

Chaque layer a un toggle on/off, un slider d'opacite (0-100%), et un color override optionnel. La configuration est persistee via `GET/PUT /api/v1/layers/config`.

### 12.6 Sidebar collapse

Bouton `PanelLeft` dans le header toggle la visibilite de la sidebar gauche. L'etat est persiste dans le store Zustand (`persist` middleware avec localStorage).

### 12.7 Search

Champ de recherche avec raccourci `/`. Recherche sur titre, description, lieu. Resultats affiches dans un dropdown avec groupement par date. Clic sur un resultat navigue vers l'evenement dans la vue appropriee.

### 12.8 Command palette

`Ctrl+K` ouvre le `CommandPalette.tsx`. Actions disponibles : creer un evenement, naviguer a une date, changer de vue, ouvrir les parametres, rechercher un evenement. Implementation via `CommandList`, `CommandItem`, `QuickCreate`.

---

## Categorie 13 — Creation et edition d'evenements

### 13.1 EventForm

Dialog modal (`EventForm.tsx`) pour creer/editer un evenement. Deux modes :
- **Quick create** : popover compact avec titre, date debut/fin, calendrier. `Enter` pour creer.
- **Full edit** : dialog complet avec tous les champs.

### 13.2 Champs du formulaire

| Champ | Type | API field | Obligatoire |
|---|---|---|---|
| Titre | text input | `title` | oui |
| Description | textarea (markdown) | `description` | non |
| Date/heure debut | datetime picker | `start_time` (ISO 8601) | oui |
| Date/heure fin | datetime picker | `end_time` (ISO 8601) | oui |
| Toute la journee | checkbox | `is_all_day` | non |
| Lieu | text input | `location` | non |
| Timezone | select (TimezoneSelector) | `timezone` | non (defaut: user tz) |
| Calendrier | select | `calendar_id` (URL param) | oui |
| Type | select | `event_type` | non (defaut: `event`) |
| Scope | select | `scope` | non (defaut: `personal`) |
| Status | select | `status` | non |
| Priorite | select | `priority` | non |
| Categorie | select + couleur | `category_id` | non |
| Recurrence | RecurrenceEditor | `rrule` | non |
| Participants | multi-select + email | via `/events/:id/attendees` | non |
| Ressource | ResourceSelector | `resource_id` | non |
| Projet | select | `project_id` | non |
| Tags | tag input | `tags[]` | non |
| Rappels | multi-select | via `/reminders` | non |
| Type de conge | select | `leave_type` | si event_type=leave |
| Mode de presence | select | `presence_mode` | si event_type=shift |
| Expression CRON | text input | `cron_expression` | si event_type=cron |
| Cible CRON | text input | `cron_target` | si event_type=cron |
| Assigne a | user select | `assigned_to` | non |
| Energie | select | `energy_level` | non |
| Evenement parent | select | `parent_event_id` | non |

### 13.3 RecurrenceEditor

Composant `RecurrenceEditor.tsx`. Interface pour construire une RRULE (RFC 5545) :
- **Frequence** : Quotidienne, Hebdomadaire, Mensuelle, Annuelle
- **Intervalle** : tous les N jours/semaines/mois/annees
- **Jours de la semaine** (hebdo) : checkboxes Lun-Dim
- **Jour du mois** (mensuel) : dropdown (le 15 du mois, le 3e lundi, le dernier jour)
- **Fin** : Jamais, Apres N occurrences, Jusqu'au (date picker)
- **Exceptions** (exdates) : liste de dates a exclure
- **Preview** : affiche les 5 prochaines occurrences generees

La RRULE generee est validee cote serveur via `POST /api/v1/rrule/validate`.

### 13.4 AttendeeList

Composant `AttendeeList.tsx`. Input avec autocompletion sur l'annuaire interne. Pour les externes, saisir un email et `Enter`. Chaque participant affiche : avatar, nom, email, badge RSVP (pending/accepted/declined/tentative). Ajout via `POST /api/v1/events/:event_id/attendees`. Suppression via `DELETE /api/v1/attendees/:attendee_id`.

### 13.5 ResourceSelector

Composant `ResourceSelector.tsx`. Dropdown qui charge les ressources via `GET /api/v1/resources`. Filtre par type (room/equipment/vehicle/desk). Verifie la disponibilite via `POST /api/v1/resources/availability` avant de permettre la selection.

### 13.6 Event templates

`event-templates.tsx` : templates pre-configures (Stand-up, 1:1, Workshop, etc.). Appliquer un template pre-remplit les champs du formulaire. Les templates sont stockes dans `calendar.templates` avec `template_type = 'event'`.

### 13.7 Duplication

`Ctrl+D` duplique l'evenement selectionne. Copie tous les champs sauf `id` et `created_at`. Le titre est prefixe par `Copie de`. L'utilisateur peut modifier avant de confirmer.

### 13.8 Suppression

Bouton corbeille ou `Delete`. Si evenement recurrent, dialog : `Cet evenement uniquement`, `Cet evenement et les suivants`, `Tous les evenements de la serie`. Si participants externes, dialog : `Annuler pour tous` vs `Retirer juste moi`. Appel `DELETE /api/v1/events/:id`. Toast `Evenement supprime` avec `Annuler` (undo 5s). Les evenements supprimes passent `is_deleted = TRUE` (soft delete).

### 13.9 Undo

Toute action (creer, deplacer, supprimer, modifier) est reversible via le toast `Annuler`. Le store Zustand maintient un historique des 10 dernieres actions. `Ctrl+Z` undo la derniere action.

---

## Categorie 14 — Recurrence (RRULE RFC 5545)

### 14.1 Generation d'instances

L'endpoint `GET /api/v1/events/:event_id/instances?start=<ISO>&end=<ISO>` genere les occurrences d'un evenement recurrent dans la plage demandee. Le service `recurrence.rs` parse la RRULE et genere les dates via l'algorithme RFC 5545. Les instances ne sont pas stockees en base — elles sont calculees a la volee.

### 14.2 Exceptions

`POST /api/v1/events/:event_id/exceptions` cree une exception (modification d'une occurrence unique). Le body contient les champs modifies + `original_start_time` de l'occurrence. L'exception est stockee comme un nouvel evenement avec `parent_event_id` pointant vers l'evenement recurrent.

### 14.3 EXDATE

Les dates exclues sont stockees dans `rrule_exceptions[]` (array d'UUIDs des instances annulees). L'algorithme de generation skip ces dates.

### 14.4 Validation

`POST /api/v1/rrule/validate` prend une RRULE en texte et retourne : `valid: bool`, `next_occurrences: DateTime[]`, `error: Option<String>`. Utilise pour le preview dans le RecurrenceEditor.

### 14.5 Modification de serie

Modifier un evenement recurrent propose 3 options :
1. **Cet evenement uniquement** : cree une exception
2. **Cet evenement et les suivants** : split la serie en deux (ancienne serie avec UNTIL, nouvelle serie a partir de cette date)
3. **Tous les evenements** : modifie l'evenement maitre

---

## Categorie 15 — Participants et RSVP

### 15.1 Ajout de participants

`POST /api/v1/events/:event_id/attendees` avec body `{ user_id?: UUID, email?: string }`. L'un ou l'autre est requis (contrainte `chk_attendee_identifier`). Un participant interne (user_id) et un externe (email) peuvent coexister. L'unique index `(event_id, user_id)` empeche les doublons internes. L'index partiel `(event_id, email) WHERE user_id IS NULL` empeche les doublons externes.

### 15.2 RSVP

`PUT /api/v1/attendees/:attendee_id/rsvp` avec body `{ rsvp_status: "accepted"|"declined"|"tentative" }`. Met a jour `rsvp_status` et `response_date = NOW()`.

### 15.3 Liste des participants

`GET /api/v1/events/:event_id/attendees` retourne la liste avec RSVP status. Le frontend affiche les avatars empiles (max 5 visibles + `+N`) avec tooltip detaille au survol.

### 15.4 Meeting suggestions

`POST /api/v1/calendar/meeting-suggestions` avec body `{ participant_ids: UUID[], duration_minutes: u32, date_range: { start: DateTime, end: DateTime } }`. Le service `meeting_suggestions.rs` analyse les calendriers des participants et retourne les 5 meilleurs creneaux.

---

## Categorie 16 — Leave management (conges)

### 16.1 Demande de conge

Creer un evenement avec `event_type = 'leave'`, `leave_type` = cp|rtt|sick|unpaid|other, `status = 'pending'`. Le systeme de workflow d'approbation detecte la creation et notifie le manager.

### 16.2 Approbation

`PUT /api/v1/events/:id/approve` et `PUT /api/v1/events/:id/reject` (avec `approval_comment` optionnel). Met a jour `status` a `approved` ou `rejected`, `approval_by` = UUID du manager. PgEventBus emet `leave.approved` ou `leave.rejected`.

### 16.3 Soldes de conges

`GET /api/v1/leave/balances` retourne les soldes par type de conge pour l'annee en cours : `total_days`, `used_days`, `pending_days`, `remaining_days` (calcule). Table `calendar.leave_balances` avec contrainte unique `(user_id, leave_type, year)`.

### 16.4 Prediction de solde

`GET /api/v1/leave/balances/predict?date=<ISO>` calcule le solde projete a une date future en tenant compte des conges approuves et en attente.

### 16.5 Conflits d'equipe

`GET /api/v1/leave/team-conflicts?start=<ISO>&end=<ISO>` detecte les periodes ou trop de membres de l'equipe sont absents simultanement.

### 16.6 Delegation

`POST /api/v1/leave/delegate` avec body `{ leave_event_id: UUID, delegate_to: UUID, tasks: UUID[] }`. Permet de reassigner les taches a un collegue pendant l'absence. Le composant `LeaveDelegationDialog.tsx` affiche les taches a deleguer.

### 16.7 Approval panel

`LeaveApprovalPanel.tsx` : panneau lateral listant les demandes de conge en attente pour le manager. Boutons Approuver/Rejeter avec commentaire optionnel.

---

## Categorie 17 — Booking et ressources

### 17.1 CRUD ressources

| Endpoint | Methode | Description |
|---|---|---|
| `/api/v1/resources` | POST | Creer une ressource |
| `/api/v1/resources` | GET | Lister les ressources |
| `/api/v1/resources/:id` | GET | Detail d'une ressource |
| `/api/v1/resources/:id` | PUT | Modifier une ressource |
| `/api/v1/resources/:id` | DELETE | Supprimer une ressource |
| `/api/v1/resources/type/:resource_type` | GET | Filtrer par type (room/equipment/vehicle/desk) |
| `/api/v1/resources/availability` | POST | Verifier la disponibilite |
| `/api/v1/resources/:resource_id/book` | POST | Reserver une ressource |

### 17.2 Types de ressources

Configures par tenant dans `calendar.resource_types` : room, equipment, vehicle, desk. Chaque type a un icone, une couleur et un flag `requires_approval`. Les types par defaut sont crees automatiquement par le trigger `calendar.on_tenant_created()`.

### 17.3 Reservation

`POST /api/v1/resources/:resource_id/book` cree un evenement de type `booking` lie a la ressource. Si la ressource `requires_approval = true`, la reservation passe en `status = 'pending'` et attend l'approbation d'un utilisateur dans `approver_ids`.

### 17.4 Floor plans

| Endpoint | Methode | Description |
|---|---|---|
| `/api/v1/floorplans` | POST | Creer un plan d'etage |
| `/api/v1/floorplans` | GET | Lister les plans |
| `/api/v1/floorplans/:id` | GET | Detail d'un plan |
| `/api/v1/floorplans/:id` | PUT | Modifier |
| `/api/v1/floorplans/:id` | DELETE | Supprimer |

Le composant `FloorPlan.tsx` affiche une vue interactive du plan d'etage avec les salles cliquables pour reserver.

### 17.5 Room booking dialog

`room-booking.tsx` : dialog de reservation de salle avec selecteur de date/heure, verifieur de disponibilite en temps reel, liste des equipements disponibles dans la salle.

---

## Categorie 18 — External sync (Google, Outlook, Apple, CalDAV)

### 18.1 OAuth flow

1. `POST /api/v1/external-sync/oauth/init` avec `{ provider: "google"|"microsoft"|"apple"|"caldav" }` retourne l'URL de redirection OAuth.
2. L'utilisateur s'authentifie chez le provider.
3. `POST /api/v1/external-sync/oauth/callback` avec le code OAuth. Stocke les tokens dans `calendar.provider_connections` (chiffres en couche applicative).

### 18.2 Gestion des connexions

| Endpoint | Methode | Description |
|---|---|---|
| `/api/v1/external-sync/connections` | GET | Lister les connexions actives |
| `/api/v1/external-sync/connections/:id` | GET | Detail d'une connexion |
| `/api/v1/external-sync/connections/:id/refresh` | POST | Rafraichir les tokens |
| `/api/v1/external-sync/connections/:id` | DELETE | Deconnecter le provider |

### 18.3 Decouverte de calendriers

`POST /api/v1/external-sync/connections/:connection_id/discover` interroge le provider pour lister les calendriers disponibles. Stockes dans `calendar.external_calendars`.

### 18.4 Configuration de sync

`POST /api/v1/external-sync/configs` cree une configuration de synchronisation entre un calendrier local et un calendrier externe :
- `sync_direction` : import_only | export_only | bidirectional
- `conflict_resolution` : local_wins | remote_wins | newest | ask
- `auto_sync_interval_minutes` : defaut 15

### 18.5 Declenchement de sync

`POST /api/v1/external-sync/configs/:id/sync` declenche une synchronisation manuelle. Les logs sont stockes dans `calendar.sync_logs`. Les conflits non resolus dans `calendar.sync_conflicts`.

### 18.6 Resolution de conflits

`PUT /api/v1/external-sync/configs/:config_id/conflicts/:conflict_id` avec `{ resolution: "local"|"remote"|"merged"|"skipped" }`. `POST .../conflicts/resolve-all` resout tous les conflits avec la strategie par defaut.

### 18.7 Frontend components

- `provider-connector.tsx` : UI de connexion OAuth avec logos des providers
- `sync-config-panel.tsx` : panneau de configuration de la sync

---

## Categorie 19 — CalDAV (RFC 4791)

### 19.1 Endpoints

| Endpoint | Methode | Description |
|---|---|---|
| `/.well-known/caldav` | ANY | Decouverte CalDAV (public) |
| `/caldav/principals/:user_id` | PROPFIND | Proprietes du principal |
| `/caldav/calendars/:calendar_id` | PROPFIND | Proprietes du calendrier |
| `/caldav/calendars/:calendar_id/report` | POST | REPORT (calendar-query, calendar-multiget) |
| `/caldav/calendars/:calendar_id/events/:event_id.ics` | GET | Recuperer un evenement en ICS |
| `/caldav/calendars/:calendar_id/events/:event_id.ics` | PUT | Creer/modifier un evenement via ICS |
| `/caldav/calendars/:calendar_id/events/:event_id.ics` | DELETE | Supprimer un evenement |

### 19.2 Compatibilite

Le service CalDAV (`caldav.rs`) implemente un sous-ensemble de RFC 4791 suffisant pour la compatibilite avec Thunderbird, macOS Calendar, iOS Calendar, DAVx5, et GNOME Calendar.

---

## Categorie 20 — iCalendar import/export

### 20.1 Export

`GET /api/v1/calendars/:calendar_id/export` retourne le calendrier complet au format ICS (RFC 5545). Content-Type: `text/calendar`. Chaque evenement est un VEVENT avec DTSTART, DTEND, SUMMARY, DESCRIPTION, LOCATION, RRULE (si recurrent), ATTENDEE, VALARM (rappels).

### 20.2 Feed ICS

`GET /api/v1/calendars/:calendar_id/feed.ics` retourne un flux ICS subscribable (URL stable). Les clients ICS (Google Calendar, Outlook) peuvent s'abonner a cette URL pour recevoir les mises a jour.

### 20.3 Import

`POST /api/v1/calendars/:calendar_id/import` avec le fichier ICS en body. Le service `icalendar.rs` parse le fichier et cree les evenements. Gestion des VEVENT, VTODO, RRULE, EXDATE.

### 20.4 Validation

`POST /api/v1/icalendar/validate` parse un ICS et retourne les erreurs sans creer d'evenements.

### 20.5 Frontend

- `ImportDialog.tsx` : drag-drop de fichier ICS, preview des evenements avant import
- `ExportDialog.tsx` : selection des calendriers a exporter, format ICS ou CSV

---

## Categorie 21 — Notifications et rappels

### 21.1 Preferences

`GET /api/v1/notifications/preferences` et `PUT /api/v1/notifications/preferences` gerent les preferences globales : types de notification actives (email, push, in-app, SMS), horaires silencieux, rappels par defaut.

### 21.2 Push subscriptions

| Endpoint | Methode | Description |
|---|---|---|
| `/api/v1/notifications/subscriptions/push` | POST | S'abonner aux push (Web Push API) |
| `/api/v1/notifications/subscriptions/push` | GET | Lister les abonnements |
| `/api/v1/notifications/subscriptions/push/:id` | DELETE | Se desabonner |

### 21.3 VAPID key

`GET /api/v1/notifications/push/vapid-key` (public, pas d'auth) retourne la cle publique VAPID pour le Web Push.

### 21.4 Notification scheduler

Le `NotificationScheduler` (spawne au demarrage du service) poll la table `calendar.reminders` toutes les 60 secondes. Pour chaque reminder ou `is_sent = FALSE` et `event.start_time - minutes_before <= NOW()`, il envoie la notification et met `is_sent = TRUE`.

### 21.5 Historique

`GET /api/v1/notifications/history` retourne les notifications envoyees avec pagination. `GET /api/v1/notifications/unread-count` retourne le nombre de non-lues. `POST /api/v1/notifications/:notification_id/resend` renvoie une notification.

### 21.6 Cross-service events

Le PgEventBus ecoute les evenements d'autres services. Quand `mail.received` est detecte avec `has_ics = true`, le service calendar loggue la detection d'une piece jointe ICS (import automatique a venir).

---

## Categorie 22 — Scheduling polls

### 22.1 CRUD

| Endpoint | Methode | Description |
|---|---|---|
| `/api/v1/polls` | GET | Lister mes polls |
| `/api/v1/polls` | POST | Creer un poll |
| `/api/v1/polls/:id` | GET | Detail d'un poll |
| `/api/v1/polls/:id/vote` | POST | Voter sur un slot |
| `/api/v1/polls/:id/confirm` | POST | Confirmer le slot choisi |

### 22.2 Schema

Le poll (`calendar.schedule_polls`) a un organisateur, un titre, un statut (open/closed/confirmed). Les slots proposes (`calendar.poll_slots`) ont date, heure debut, heure fin. Les votes (`calendar.poll_votes`) ont voter_name, voter_email, vote (yes/maybe/no).

### 22.3 Frontend

`scheduling-poll.tsx` : interface Doodle-like avec une grille date x participant, cases a cocher yes/maybe/no. Le slot avec le plus de "yes" est mis en surbrillance. L'organisateur peut confirmer le slot et creer automatiquement l'evenement.

---

## Categorie 23 — Out-of-office

### 23.1 Endpoints

| Endpoint | Methode | Description |
|---|---|---|
| `/api/v1/ooo` | GET | Recuperer mes parametres OOO |
| `/api/v1/ooo` | PUT | Activer/modifier OOO |
| `/api/v1/ooo` | DELETE | Desactiver OOO |

### 23.2 Schema

`calendar.out_of_office` : un enregistrement unique par utilisateur avec `enabled`, `ooo_start`, `ooo_end`, `message`. Quand active, le message apparait dans les invitations et le profil.

### 23.3 Frontend

`out-of-office.tsx` : toggle activation, date debut/fin, message auto-reply.

---

## Categorie 24 — CRON jobs

### 24.1 Endpoints

| Endpoint | Methode | Description |
|---|---|---|
| `/api/v1/cron-jobs` | GET | Lister les jobs |
| `/api/v1/cron-jobs` | POST | Creer un job |
| `/api/v1/cron-jobs/:id` | PUT | Modifier un job |
| `/api/v1/cron-jobs/:id` | DELETE | Supprimer un job |
| `/api/v1/cron-jobs/:id/run` | POST | Executer manuellement |

### 24.2 Integration calendar

Les CRON jobs sont representes comme des evenements de type `cron` dans le calendrier. Champs specifiques : `cron_expression` (format CRON standard), `cron_target` (URL ou commande a executer). Visible dans la vue timeline et month.

---

## Categorie 25 — Timesheets

### 25.1 Endpoints

| Endpoint | Methode | Description |
|---|---|---|
| `/api/v1/timesheets` | GET | Lister les entrees |
| `/api/v1/timesheets/:id` | PUT | Modifier une entree |
| `/api/v1/timesheets/validate` | POST | Valider une semaine |
| `/api/v1/timesheets/export` | POST | Exporter (CSV/PDF) |
| `/api/v1/timesheets/generate` | POST | Generer les entrees depuis le calendrier |

### 25.2 Schema

`calendar.timesheet_entries` : une entree par jour par utilisateur. Champs : `user_id`, `event_id` (optionnel, lien vers l'evenement source), `date`, `hours`, `category_id`, `auto_generated` (true si genere depuis le calendrier), `validated`, `validated_at`, `exported_at`.

### 25.3 Frontend

- `TimesheetView.tsx` : tableau semaine avec heures par jour, total par semaine
- `TimesheetExportDialog.tsx` : selection de la periode et du format d'export

---

## Categorie 26 — Approval workflows

### 26.1 Endpoints

| Endpoint | Methode | Description |
|---|---|---|
| `/api/v1/approval-workflows` | GET | Lister les workflows |
| `/api/v1/approval-workflows` | POST | Creer un workflow |
| `/api/v1/approval-workflows/:id` | PUT | Modifier |
| `/api/v1/approval-workflows/:id` | DELETE | Supprimer |

### 26.2 Schema

`calendar.approval_workflows` : `org_id`, `trigger_type` (ex: `leave_request`, `resource_booking`), `trigger_config` (JSONB avec conditions), `approvers` (JSONB array d'UUIDs ou roles), `active`.

### 26.3 Fonctionnement

Quand un evenement matching le `trigger_type` est cree avec `status = 'pending'`, le workflow envoie une notification aux approbateurs. L'approbation/rejet met a jour le `status` de l'evenement.

---

## Categorie 27 — Categories

### 27.1 Endpoints

| Endpoint | Methode | Description |
|---|---|---|
| `/api/v1/categories` | GET | Lister les categories |
| `/api/v1/categories` | POST | Creer une categorie |
| `/api/v1/categories/:id` | PUT | Modifier |
| `/api/v1/categories/:id` | DELETE | Supprimer |

### 27.2 Schema

`calendar.categories` : `name`, `color`, `icon`, `owner_id`, `org_id`, `rules` (JSONB). Les categories servent a colorer et grouper les evenements. Un evenement pointe vers une categorie via `category_id`.

### 27.3 Frontend

`category-colors.tsx` : panneau de gestion des categories avec color picker et icone selector.

---

## Categorie 28 — WebSocket real-time

### 28.1 Endpoint

`GET /api/v1/calendars/:calendar_id/ws` etablit une connexion WebSocket. Le serveur (`websocket.rs`) gere le canal broadcast par calendrier via `calendar_broadcasts: Arc<DashMap<String, Sender<Vec<u8>>>>`.

### 28.2 Messages

| Type | Direction | Payload |
|---|---|---|
| `PresenceMessage` | Server -> Client | `{ user_id, username, action, editing_item_id, timestamp }` |
| `SyncRequest` | Client -> Server | `{ state_vector, request_id }` |
| `SyncResponse` | Server -> Client | `{ update, request_id }` |
| Event update | Server -> Client | Serialized event JSON |

### 28.3 Presence actions

Enum `PresenceAction` : `Join`, `Leave`, `StartEditing`, `StopEditing`, `Idle`. Le `PresenceManager` (in-memory, `DashMap`) track les utilisateurs actifs par calendrier.

### 28.4 CRDT sync

Les calendriers utilisent Yrs (Yjs Rust binding) pour la synchronisation CRDT des operations concurrentes. Chaque calendrier a un `yrs::Doc` stocke dans `calendar_docs: Arc<DashMap<String, Arc<Doc>>>`.

---

## Categorie 29 — Timezones

### 29.1 Endpoints

| Endpoint | Methode | Description |
|---|---|---|
| `/api/v1/timezones` | GET | Lister toutes les timezones IANA (public) |
| `/api/v1/timezones/validate` | POST | Valider un nom de timezone |
| `/api/v1/timezones/convert` | POST | Convertir une date entre deux timezones |
| `/api/v1/timezones/me` | GET | Recuperer ma timezone |
| `/api/v1/timezones/me` | PUT | Mettre a jour ma timezone |

### 29.2 Frontend

`TimezoneSelector.tsx` : dropdown filtrable avec les timezones IANA groupees par region. Affiche l'offset UTC actuel.

---

## Categorie 30 — Sharing et permissions

### 30.1 Calendar sharing endpoints

| Endpoint | Methode | Description |
|---|---|---|
| `/api/v1/calendars/:id/members` | GET | Lister les membres |
| `/api/v1/calendars/:id/members` | POST | Ajouter un membre |
| `/api/v1/calendars/:id/members/:user_id` | PUT | Modifier le role |
| `/api/v1/calendars/:id/members/:user_id` | DELETE | Retirer un membre |
| `/api/v1/calendars/:calendar_id/shares` | POST | Partager un calendrier |
| `/api/v1/calendars/:calendar_id/shares/:user_id` | PUT | Modifier la permission |
| `/api/v1/calendars/:calendar_id/shares/:user_id` | DELETE | Revoquer le partage |
| `/api/v1/calendars/:calendar_id/shares/:user_id/check` | GET | Verifier la permission |

### 30.2 Roles

3 roles de membre : `owner` (tous droits), `editor` (creer/modifier/supprimer des evenements), `viewer` (lecture seule). Le schema `calendar.calendar_members` stocke le role par couple (calendar_id, user_id).

### 30.3 Unified sharing engine

Le service utilise `SharingEngine` de `signapps-sharing` pour les grants universels. Routes additionnelles sous `/api/v1/calendars/sharing/...` et `/api/v1/events/sharing/...` via `sharing_routes()`.

### 30.4 Frontend

`ShareDialog.tsx` : dialog de partage avec :
- Input de recherche d'utilisateurs
- Liste des membres actuels avec role en dropdown
- Toggle calendrier public
- Bouton "Copier le lien"

---

## Categorie 31 — PostgreSQL schema complet

### 31.1 Schema `calendar`

| Table | Colonnes cles | Description |
|---|---|---|
| `calendars` | id, owner_id, tenant_id, workspace_id, name, color, timezone, calendar_type, is_shared, is_public, is_default | Conteneur de calendrier |
| `calendar_members` | calendar_id, user_id, role | Permissions de membre |
| `events` | id, calendar_id, tenant_id, title, start_time, end_time, rrule, timezone, event_type, scope, status, priority, leave_type, presence_mode, cron_expression, assigned_to, project_id, tags | Evenement unifie (8 types) |
| `event_attendees` | event_id, user_id, email, rsvp_status | Participants avec RSVP |
| `event_metadata` | event_id, key, value | Metadata extensible |
| `event_resources` | event_id, resource_id | Liaison evenement-ressource |
| `resources` | id, tenant_id, name, resource_type, capacity, location, amenities, booking_rules, requires_approval | Salles, equipements, vehicules |
| `resource_types` | tenant_id, name, icon, color, requires_approval | Types configurables par tenant |
| `reservations` | resource_id, event_id, requested_by, status, approved_by | Reservations de ressources |
| `tasks` | id, calendar_id, parent_task_id, title, status, priority, due_date, assigned_to, project_id, position | Taches hierarchiques |
| `task_attachments` | task_id, file_url, file_name | Pieces jointes |
| `reminders` | event_id, task_id, user_id, reminder_type, minutes_before, is_sent | Rappels (event XOR task) |
| `activity_log` | calendar_id, entity_type, entity_id, action, user_id, changes | Journal d'activite |
| `categories` | name, color, icon, owner_id, org_id, rules | Categories colorees |
| `out_of_office` | user_id, enabled, ooo_start, ooo_end, message | Parametres OOO |
| `schedule_polls` | organizer_id, title, status, confirmed_slot_id | Polls de planification |
| `poll_slots` | poll_id, slot_date, start_time, end_time | Creneaux proposes |
| `poll_votes` | slot_id, voter_name, voter_email, vote | Votes |
| `presence_rules` | org_id, team_id, rule_type, rule_config, enforcement | Regles de presence |
| `leave_balances` | user_id, leave_type, year, total_days, used_days, pending_days | Soldes de conges |
| `timesheet_entries` | user_id, event_id, date, hours, validated, exported_at | Entrees de feuille de temps |
| `approval_workflows` | org_id, trigger_type, approvers, active | Workflows d'approbation |
| `provider_connections` | user_id, provider, access_token, refresh_token, sync_status | Connexions OAuth |
| `external_calendars` | connection_id, external_id, name, sync_enabled | Calendriers externes |
| `sync_configs` | local_calendar_id, external_calendar_id, sync_direction, conflict_resolution | Config de sync |
| `sync_logs` | sync_config_id, direction, status, events_imported/exported | Journaux de sync |
| `sync_conflicts` | local_event_id, external_event_id, conflict_type, resolution | Conflits de sync |
| `event_mappings` | local_event_id, external_event_id, local_etag, external_etag | Mapping local/externe |
| `oauth_states` | user_id, state, provider, expires_at | Protection CSRF OAuth |
| `projects` | tenant_id, name, status, start_date, due_date, owner_id | Projets |
| `project_members` | project_id, user_id, role | Membres de projet |
| `templates` | tenant_id, name, template_type, content | Templates reutilisables |
| `labels` | tenant_id, name, color | Labels colores |
| `entity_labels` | label_id, entity_type, entity_id | Labels polymorphiques |
| `floor_plans` | (managed by floor_plans handler) | Plans d'etage |

### 31.2 Enums PostgreSQL

| Enum | Valeurs |
|---|---|
| `calendar.event_type` | event, task, leave, shift, booking, milestone, blocker, cron |
| `calendar.event_scope` | personal, team, org |
| `calendar.event_status` | draft, pending, approved, rejected, completed |
| `calendar.event_priority` | low, medium, high, urgent |
| `calendar.leave_type` | cp, rtt, sick, unpaid, other |
| `calendar.presence_mode` | office, remote, absent |
| `calendar.energy_level` | low, medium, high |
| `calendar.calendar_type` | personal, group, enterprise, resource_room, resource_equipment |
| `calendar.project_status` | planning, active, on_hold, completed, archived |
| `calendar.task_status` | todo, in_progress, done, cancelled |
| `calendar.task_priority` | none, low, medium, high, urgent |
| `calendar.template_type` | project, task, event, checklist |
| `calendar.rule_type` | min_onsite, mandatory_days, max_remote_same_day, min_coverage |
| `calendar.enforcement_level` | soft, hard |

### 31.3 Row Level Security

RLS est active sur toutes les tables tenant-scoped. La politique `tenant_isolation_*` verifie `tenant_id = current_setting('app.current_tenant_id')::uuid`. Les templates publics (`is_public = TRUE`) sont accessibles cross-tenant.

### 31.4 Indexes critiques

- `idx_events_tenant_calendar_date ON events(tenant_id, calendar_id, start_time, end_time)` — requete principale de chargement des evenements
- `idx_events_event_type ON events(event_type)` — filtre par type
- `idx_events_leave_type ON events(leave_type) WHERE event_type = 'leave'` — partial index conges
- `idx_events_assigned_to ON events(assigned_to) WHERE assigned_to IS NOT NULL` — partial index assignation
- `idx_timesheet_user_date ON timesheet_entries(user_id, date)` — requete timesheet
- `idx_leave_balances_user_year ON leave_balances(user_id, year)` — lookup solde

---

## Categorie 32 — PgEventBus events

### 32.1 Events emis par calendar

| Event type | Payload | Quand |
|---|---|---|
| `calendar.event.created` | `{ event_id, calendar_id, title, event_type, start_time }` | Creation d'un evenement |
| `calendar.event.updated` | `{ event_id, changes }` | Modification |
| `calendar.event.deleted` | `{ event_id }` | Suppression |
| `leave.requested` | `{ event_id, user_id, leave_type, start, end }` | Demande de conge |
| `leave.approved` | `{ event_id, approved_by }` | Approbation |
| `leave.rejected` | `{ event_id, rejected_by, reason }` | Rejet |
| `presence.changed` | `{ user_id, date, mode }` | Changement de presence |
| `booking.created` | `{ reservation_id, resource_id }` | Reservation de ressource |

### 32.2 Events consommes par calendar

| Event type | Source | Action |
|---|---|---|
| `mail.received` | signapps-mail | Detection de pieces jointes ICS pour auto-import |

---

## Categorie 33 — Keyboard shortcuts exhaustifs

### 33.1 Global shortcuts

| Touche | Action |
|--------|--------|
| `c` | Creer un evenement (ouvre EventForm) |
| `t` | Naviguer a aujourd'hui |
| `/` | Focus sur la barre de recherche |
| `Ctrl+K` | Ouvrir le command palette |
| `Ctrl+Z` | Undo la derniere action |
| `Ctrl+D` | Dupliquer l'evenement selectionne |
| `Delete` | Supprimer l'evenement selectionne |
| `Enter` | Ouvrir l'evenement selectionne en edition |
| `Escape` | Fermer tout dialog/popover ouvert |
| `?` | Afficher l'aide des raccourcis |

### 33.2 Navigation shortcuts

| Touche | Action |
|--------|--------|
| `j` | Vue day : jour precedent. Vue week : semaine precedente. Vue month : mois precedent |
| `k` | Vue day : jour suivant. Vue week : semaine suivante. Vue month : mois suivant |
| `Left` | Synonyme de `j` |
| `Right` | Synonyme de `k` |

### 33.3 View switching shortcuts

| Touche | Vue |
|--------|-----|
| `j` (view tab context) | Jour |
| `s` | Semaine |
| `m` | Mois |
| `a` | Agenda |
| `t` (view tab context) | Frise/Timeline |
| `k` (view tab context) | Kanban |
| `d` | Dispo (heatmap) |
| `p` | Planning (roster) |
| `x` | Taches |
| `v` | Disponibilite |
| `r` | Presence |

Note : les touches `j`, `k`, `t` ont un double role (navigation et switch de vue). Le contexte est determine par : si un evenement est selectionne, la touche navigue ; sinon, elle switch la vue.

---

## Categorie 34 — Performance et technique

### 34.1 Lazy loading des vues

Les 11 vues sont importees via `React.lazy()` dans `VIEW_MAP`. Un `Suspense` avec `ViewSkeleton` (spinner) entoure le rendu. Seule la vue active est chargee en memoire.

### 34.2 Virtualisation

Les vues avec de longues listes (Agenda, Timeline) utilisent `@tanstack/react-virtual` pour ne rendre que les elements visibles dans le viewport.

### 34.3 Zustand store

Le `calendar-store.ts` utilise `zustand/persist` pour conserver l'etat entre les sessions (vue selectionnee, layers, sidebar collapsed). Les selecteurs granulaires (`useShallow`) evitent les re-renders inutiles.

### 34.4 DndContext

Un seul `DndContext` de `@dnd-kit/core` entoure toute la zone principale dans `CalendarHub`. Le handler `onDragEnd` determine l'action en fonction du type de drop (deplacer dans la grille, changer de jour, changer de colonne kanban).

### 34.5 Date handling

`date-fns` (MIT) avec locale `fr` pour le formatage. `weekStartsOn: 1` (lundi). Format ISO 8601 pour toutes les communications API.

### 34.6 WebSocket reconnection

Le client WebSocket se reconnecte automatiquement avec backoff exponentiel (1s, 2s, 4s, 8s, max 30s). Le `PresenceManager` nettoie les utilisateurs deconnectes apres 60 secondes d'inactivite.

### 34.7 Body limit

Le router est configure avec `DefaultBodyLimit::max(100 * 1024 * 1024)` (100MB) pour supporter l'import de gros fichiers ICS.

---

## Categorie 35 — Composants frontend additionnels

| Composant | Fichier | Role |
|---|---|---|
| `MeetingScheduler` | `meeting-scheduler/MeetingScheduler.tsx` | Assistant de planification de reunion |
| `AvailabilityCalendar` | `meeting-scheduler/AvailabilityCalendar.tsx` | Calendrier de disponibilite dans le scheduler |
| `SlotSelector` | `meeting-scheduler/SlotSelector.tsx` | Selection de creneaux dans le scheduler |
| `NLPInput` | `productivity/NLPInput.tsx` | Input en langage naturel pour creer des evenements |
| `PomodoroTimer` | `productivity/PomodoroTimer.tsx` | Timer Pomodoro integre |
| `CommandPalette` | `command-palette/CommandPalette.tsx` | Palette de commandes (Ctrl+K) |
| `QuickCreate` | `command-palette/QuickCreate.tsx` | Creation rapide dans le command palette |
| `WorkloadDashboard` | `WorkloadDashboard.tsx` | Dashboard de charge de travail |
| `AnalyticsDashboard` | `analytics/AnalyticsDashboard.tsx` | Dashboard analytique du calendrier |
| `TeamOverlay` | `team-overlay.tsx` | Overlay des calendriers d'equipe |
| `MeetingPrep` | `meeting-prep.tsx` | Preparation de reunion (agenda, docs) |
| `MeetingCheckin` | `meeting-checkin.tsx` | Check-in de presence a une reunion |
| `PresenceIndicator` | `presence-indicator.tsx` | Indicateur de presence des collaborateurs |
| `PublicCalendarLink` | `public-calendar-link.tsx` | Generation de lien de calendrier public |
| `CalendarWidget` | `calendar-widget.tsx` | Widget calendrier embarquable |
| `ResourcesView` | `ResourcesView.tsx` | Vue des ressources (salles, equipements) |

---

## Categorie 36 — API routes complete reference

### 36.1 Public routes (no auth)

| Methode | Route | Handler |
|---|---|---|
| GET | `/health` | health_check |
| GET | `/api/v1/notifications/push/vapid-key` | push::get_vapid_key |
| GET | `/api/v1/timezones` | timezones::list_timezones |
| ANY | `/.well-known/caldav` | caldav::options_handler |

### 36.2 Calendar CRUD

| Methode | Route | Handler |
|---|---|---|
| POST | `/api/v1/calendars` | calendars::create_calendar |
| GET | `/api/v1/calendars` | calendars::list_calendars |
| GET | `/api/v1/calendars/:id` | calendars::get_calendar |
| PUT | `/api/v1/calendars/:id` | calendars::update_calendar |
| DELETE | `/api/v1/calendars/:id` | calendars::delete_calendar |

### 36.3 Calendar members

| Methode | Route | Handler |
|---|---|---|
| GET | `/api/v1/calendars/:id/members` | calendars::list_members |
| POST | `/api/v1/calendars/:id/members` | calendars::add_member |
| PUT | `/api/v1/calendars/:id/members/:user_id` | calendars::update_member_role |
| DELETE | `/api/v1/calendars/:id/members/:user_id` | calendars::remove_member |

### 36.4 Calendar shares

| Methode | Route | Handler |
|---|---|---|
| POST | `/api/v1/calendars/:calendar_id/shares` | shares::share_calendar |
| GET | `/api/v1/calendars/:calendar_id/shares` | shares::get_members |
| PUT | `/api/v1/calendars/:calendar_id/shares/:user_id` | shares::update_permission |
| DELETE | `/api/v1/calendars/:calendar_id/shares/:user_id` | shares::unshare_calendar |
| GET | `/api/v1/calendars/:calendar_id/shares/:user_id/check` | shares::check_permission |

### 36.5 Events

| Methode | Route | Handler |
|---|---|---|
| POST | `/api/v1/calendars/:calendar_id/events` | events::create_event |
| GET | `/api/v1/calendars/:calendar_id/events` | events::list_events |
| GET | `/api/v1/events/:id` | events::get_event |
| PUT | `/api/v1/events/:id` | events::update_event |
| DELETE | `/api/v1/events/:id` | events::delete_event |

### 36.6 Attendees

| Methode | Route | Handler |
|---|---|---|
| POST | `/api/v1/events/:event_id/attendees` | events::add_attendee |
| GET | `/api/v1/events/:event_id/attendees` | events::list_attendees |
| PUT | `/api/v1/attendees/:attendee_id/rsvp` | events::update_rsvp |
| DELETE | `/api/v1/attendees/:attendee_id` | events::remove_attendee |

### 36.7 Recurrence

| Methode | Route | Handler |
|---|---|---|
| GET | `/api/v1/events/:event_id/instances` | recurrence::get_event_instances |
| POST | `/api/v1/events/:event_id/exceptions` | recurrence::create_exception |
| POST | `/api/v1/rrule/validate` | recurrence::validate_rrule |

### 36.8 Tasks

| Methode | Route | Handler |
|---|---|---|
| POST | `/api/v1/calendars/:calendar_id/tasks` | tasks::create_task |
| GET | `/api/v1/calendars/:calendar_id/tasks` | tasks::list_root_tasks |
| GET | `/api/v1/tasks/:id` | tasks::get_task |
| PUT | `/api/v1/tasks/:id` | tasks::update_task |
| PUT | `/api/v1/tasks/:id/move` | tasks::move_task |
| POST | `/api/v1/tasks/:id/complete` | tasks::complete_task |
| DELETE | `/api/v1/tasks/:id` | tasks::delete_task |
| GET | `/api/v1/tasks/:task_id/children` | tasks::list_children |
| GET | `/api/v1/calendars/:calendar_id/tasks/tree` | tasks::get_task_tree |
| GET | `/api/v1/calendars/:calendar_id/tasks/info` | tasks::get_task_tree_info |

### 36.9 Resources

| Methode | Route | Handler |
|---|---|---|
| POST | `/api/v1/resources` | resources::create_resource |
| GET | `/api/v1/resources` | resources::list_resources |
| GET | `/api/v1/resources/:id` | resources::get_resource |
| PUT | `/api/v1/resources/:id` | resources::update_resource |
| DELETE | `/api/v1/resources/:id` | resources::delete_resource |
| GET | `/api/v1/resources/type/:resource_type` | resources::list_resources_by_type |
| POST | `/api/v1/resources/availability` | resources::check_availability |
| POST | `/api/v1/resources/:resource_id/book` | resources::book_resources |

### 36.10 Floor plans

| Methode | Route | Handler |
|---|---|---|
| POST | `/api/v1/floorplans` | floor_plans::create_floor_plan |
| GET | `/api/v1/floorplans` | floor_plans::list_floor_plans |
| GET | `/api/v1/floorplans/:id` | floor_plans::get_floor_plan |
| PUT | `/api/v1/floorplans/:id` | floor_plans::update_floor_plan |
| DELETE | `/api/v1/floorplans/:id` | floor_plans::delete_floor_plan |

### 36.11 iCalendar

| Methode | Route | Handler |
|---|---|---|
| GET | `/api/v1/calendars/:calendar_id/export` | icalendar::export_calendar |
| GET | `/api/v1/calendars/:calendar_id/feed.ics` | icalendar::get_calendar_feed |
| POST | `/api/v1/calendars/:calendar_id/import` | icalendar::import_calendar |
| POST | `/api/v1/icalendar/validate` | icalendar::validate_icalendar |

### 36.12 CalDAV

| Methode | Route | Handler |
|---|---|---|
| ANY | `/caldav/principals/:user_id` | caldav::propfind_principal |
| ANY | `/caldav/calendars/:calendar_id` | caldav::propfind_calendar |
| POST | `/caldav/calendars/:calendar_id/report` | caldav::report_calendar |
| GET | `/caldav/calendars/:calendar_id/events/:event_id.ics` | caldav::get_event_ics |
| PUT | `/caldav/calendars/:calendar_id/events/:event_id.ics` | caldav::put_event_ics |
| DELETE | `/caldav/calendars/:calendar_id/events/:event_id.ics` | caldav::delete_event_ics |

### 36.13 External sync

| Methode | Route | Handler |
|---|---|---|
| GET | `/api/v1/external-sync/connections` | external_sync::list_connections |
| GET | `/api/v1/external-sync/connections/:id` | external_sync::get_connection |
| POST | `/api/v1/external-sync/oauth/init` | external_sync::init_oauth |
| POST | `/api/v1/external-sync/oauth/callback` | external_sync::handle_oauth_callback |
| POST | `/api/v1/external-sync/connections/:id/refresh` | external_sync::refresh_connection |
| DELETE | `/api/v1/external-sync/connections/:id` | external_sync::disconnect_provider |
| GET | `/api/v1/external-sync/connections/:connection_id/calendars` | external_sync::list_external_calendars |
| POST | `/api/v1/external-sync/connections/:connection_id/discover` | external_sync::discover_calendars |
| GET | `/api/v1/external-sync/configs` | external_sync::list_sync_configs |
| POST | `/api/v1/external-sync/configs` | external_sync::create_sync_config |
| PUT | `/api/v1/external-sync/configs/:id` | external_sync::update_sync_config |
| DELETE | `/api/v1/external-sync/configs/:id` | external_sync::delete_sync_config |
| POST | `/api/v1/external-sync/configs/:id/sync` | external_sync::trigger_sync |
| GET | `/api/v1/external-sync/configs/:config_id/logs` | external_sync::list_sync_logs |
| GET | `/api/v1/external-sync/configs/:config_id/conflicts` | external_sync::list_conflicts |
| PUT | `/api/v1/external-sync/configs/:config_id/conflicts/:conflict_id` | external_sync::resolve_conflict |
| POST | `/api/v1/external-sync/configs/:config_id/conflicts/resolve-all` | external_sync::resolve_all_conflicts |

### 36.14 Notifications

| Methode | Route | Handler |
|---|---|---|
| GET | `/api/v1/notifications/preferences` | notifications::get_preferences |
| PUT | `/api/v1/notifications/preferences` | notifications::update_preferences |
| POST | `/api/v1/notifications/subscriptions/push` | notifications::subscribe_push |
| GET | `/api/v1/notifications/subscriptions/push` | notifications::list_push_subscriptions |
| DELETE | `/api/v1/notifications/subscriptions/push/:id` | notifications::unsubscribe_push |
| GET | `/api/v1/notifications/history` | notifications::get_notification_history |
| POST | `/api/v1/notifications/:notification_id/resend` | notifications::resend_notification |
| GET | `/api/v1/notifications/unread-count` | notifications::get_unread_count |
| POST | `/api/v1/notifications/push/send` | push::send_push |

### 36.15 Other

| Methode | Route | Handler |
|---|---|---|
| GET | `/api/v1/timezones/validate` | POST timezones::validate_timezone |
| POST | `/api/v1/timezones/convert` | timezones::convert_timezone |
| GET/PUT | `/api/v1/timezones/me` | timezones::get/set_user_timezone |
| POST | `/api/v1/calendar/meeting-suggestions` | meeting_suggestions::suggest_meeting_times |
| GET/PUT | `/api/v1/ooo` | ooo::get/set_ooo |
| DELETE | `/api/v1/ooo` | ooo::delete_ooo |
| GET/POST | `/api/v1/polls` | polls::list/create |
| GET | `/api/v1/polls/:id` | polls::get_poll |
| POST | `/api/v1/polls/:id/vote` | polls::vote_poll |
| POST | `/api/v1/polls/:id/confirm` | polls::confirm_poll |
| GET/POST | `/api/v1/categories` | categories::list/create |
| PUT/DELETE | `/api/v1/categories/:id` | categories::update/delete |
| PUT | `/api/v1/events/:id/approve` | leave::approve_leave |
| PUT | `/api/v1/events/:id/reject` | leave::reject_leave |
| GET | `/api/v1/leave/balances` | leave::get_balances |
| GET | `/api/v1/leave/balances/predict` | leave::predict_balance |
| GET | `/api/v1/leave/team-conflicts` | leave::team_conflicts |
| POST | `/api/v1/leave/delegate` | leave::delegate_tasks |
| GET/POST | `/api/v1/presence/rules` | presence::list/create_rule |
| PUT/DELETE | `/api/v1/presence/rules/:id` | presence::update/delete_rule |
| POST | `/api/v1/presence/validate` | presence::validate_action |
| GET | `/api/v1/presence/team-status` | presence::team_status |
| GET | `/api/v1/presence/headcount` | presence::headcount |
| GET | `/api/v1/timesheets` | timesheets::list_timesheets |
| PUT | `/api/v1/timesheets/:id` | timesheets::update_timesheet |
| POST | `/api/v1/timesheets/validate` | timesheets::validate_week |
| POST | `/api/v1/timesheets/export` | timesheets::export_timesheets |
| POST | `/api/v1/timesheets/generate` | timesheets::generate_timesheets |
| GET/POST | `/api/v1/approval-workflows` | approval::list/create |
| PUT/DELETE | `/api/v1/approval-workflows/:id` | approval::update/delete |
| GET/PUT | `/api/v1/layers/config` | layers::get/save_layer_config |
| GET/POST | `/api/v1/cron-jobs` | cron_jobs::list/create |
| PUT/DELETE | `/api/v1/cron-jobs/:id` | cron_jobs::update/delete |
| POST | `/api/v1/cron-jobs/:id/run` | cron_jobs::run_cron_job |
| GET | `/api/v1/calendars/:calendar_id/ws` | websocket::websocket_handler |

---

## Assertions E2E cles (a tester)

### Views
- [ ] Vue jour affiche la grille 00-23h, current time indicator, colonnes timezone
- [ ] Vue semaine affiche 7 colonnes, all-day bar, evenements superposes
- [ ] Vue mois affiche la grille 6x7, event chips, "+N autres" overflow
- [ ] Vue agenda affiche la liste chronologique groupee par date, infinite scroll
- [ ] Vue frise affiche les barres horizontales, echelle jour/semaine/mois, today marker
- [ ] Vue kanban affiche 4 colonnes de statut, drag-drop entre colonnes change le status
- [ ] Vue heatmap affiche la grille coloree (vert/jaune/orange/rouge), tooltip au survol
- [ ] Vue roster affiche employes x jours, shifts M/A/N/J/R, edition par clic
- [ ] Vue taches affiche le kanban specialise, checkbox de completion, hierarchie
- [ ] Vue disponibilite affiche le multi-entity overlay, zones vertes/rouges
- [ ] Vue presence affiche le tableau employes x jours, headcount chart en dessous

### Navigation
- [ ] Boutons prev/next changent la date d'une unite de vue
- [ ] Bouton aujourd'hui remet a la date courante
- [ ] Mini-calendar navigue la vue vers le jour clique
- [ ] Shortcuts j/k naviguent, s/m/a/t/k/d/p/x/v/r switchent la vue
- [ ] Ctrl+K ouvre le command palette

### CRUD evenements
- [ ] `c` ouvre EventForm vide, Enter cree, Escape annule
- [ ] Clic sur un slot ouvre EventForm pre-rempli
- [ ] Drag sur la grille dessine la duree, ouvre EventForm au relachement
- [ ] Drag d'un evenement existant le deplace (update start/end)
- [ ] Resize d'un evenement change la duree (update end)
- [ ] Delete avec confirmation supprime (soft delete)
- [ ] Toast undo restaure l'action pendant 5 secondes

### Recurrence
- [ ] RecurrenceEditor genere une RRULE valide
- [ ] GET instances retourne les occurrences dans la plage
- [ ] Exception sur une occurrence unique preserve les autres
- [ ] Suppression propose 3 options (cette, suivants, tous)

### Participants
- [ ] Ajout d'un participant interne (user_id)
- [ ] Ajout d'un participant externe (email)
- [ ] RSVP update change le badge (pending -> accepted)
- [ ] Meeting suggestions retourne des creneaux libres communs

### Leave management
- [ ] Creation d'un conge (event_type=leave, status=pending)
- [ ] Approbation par manager change status a approved
- [ ] Soldes de conges refletent les jours utilises/pending
- [ ] Delegation de taches pendant l'absence

### External sync
- [ ] OAuth flow Google fonctionne (init -> callback -> connected)
- [ ] Decouverte de calendriers externes
- [ ] Sync bidirectionnelle cree les evenements localement
- [ ] Conflits sont detectes et resolus

### CalDAV
- [ ] PROPFIND sur principal retourne les calendriers
- [ ] GET event.ics retourne un VEVENT valide
- [ ] PUT event.ics cree/modifie un evenement

### iCalendar
- [ ] Export genere un fichier ICS valide
- [ ] Import parse un ICS et cree les evenements
- [ ] Feed ICS est subscribable par un client externe

### Presence et roster
- [ ] Changement de mode de presence se reflete dans le tableau
- [ ] Headcount chart affiche les bons totaux
- [ ] Regles de presence bloquent les violations hard
- [ ] Shifts M/A/N/J/R sont assignables et modifiables

### Keyboard shortcuts
- [ ] `c` cree, `t` aujourd'hui, `/` recherche, `Ctrl+K` command palette
- [ ] `Ctrl+Z` undo, `Ctrl+D` duplique, `Delete` supprime
- [ ] `Enter` ouvre en edition, `Escape` ferme

### Real-time
- [ ] WebSocket envoie les presence messages (join/leave/editing)
- [ ] Modifications par un utilisateur apparaissent chez l'autre en < 500ms

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Google Calendar Help** (support.google.com/calendar) -- docs completes : creation, partage, recurrences, booking, goals, working hours.
- **Outlook Calendar Support** (support.microsoft.com/outlook) -- docs sur Scheduler, FindTime, delegation, ressources.
- **Fantastical Help** (flexibits.com/fantastical) -- guides natural language, templates, widgets.
- **Notion Calendar Guide** (notion.so/help/guides/notion-calendar) -- keyboard shortcuts, quick book, timezone overlay.
- **iCalendar RFC 5545** (tools.ietf.org/html/rfc5545) -- specification officielle d'ICS, RRULE, EXDATE.
- **CalDAV RFC 4791** (tools.ietf.org/html/rfc4791) -- specification officielle CalDAV.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **FullCalendar** (fullcalendar.io) | **MIT** | Reference absolue pour les calendriers web. Vues jour/semaine/mois/timeline, drag-drop, recurrence, ressources. |
| **React Big Calendar** (github.com/jquense/react-big-calendar) | **MIT** | Alternative React a FullCalendar. API simple. |
| **Schedule-X** (schedule-x.dev) | **MIT** | Moderne, React/Vue/Svelte, inspire de Google Calendar. |
| **rrule.js** (github.com/jakubroztocil/rrule) | **BSD-3-Clause** | Parser et generateur RRULE (RFC 5545). |
| **ical.js** (github.com/mozilla-comm/ical.js) | **MPL-2.0** | Weak copyleft. OK comme consommateur. Parser/writer ICS complet. |
| **ics.js** (github.com/adrianlee44/ics.js) | **MIT** | Generateur ICS leger. |
| **Luxon** (moment.github.io/luxon) | **MIT** | Library moderne date/time avec IANA timezones. |
| **date-fns** (date-fns.org) | **MIT** | Alternative Luxon, tree-shakable. |
| **@dnd-kit/core** | **MIT** | Drag-and-drop deja utilise dans SignApps. |
| **@tanstack/react-virtual** | **MIT** | Virtualisation des listes longues. |
| **Cal.com** | **AGPL v3** | **INTERDIT**. Ne pas utiliser ni copier. |

### Ce qu'il ne faut PAS faire
- **Jamais utiliser Cal.com** (AGPL) ni ses composants.
- **Pas de moment.js** -- remplacer par date-fns (deja utilise).
- **Pas de copie de code** depuis FullCalendar Premium (commercial).

## Historique

- **2026-04-14** : Vague d'amélioration UX/interactions souris niveau Google Calendar / Outlook
  - Form ouvre désormais à la bonne date/heure du slot cliqué (passage de `endTime` + `useEffect` reset)
  - Drag-drop d'événements fluide avec `PointerSensor` (8px) + `TouchSensor` (200ms) — clicks distincts du drag
  - DragOverlay avec preview visuelle du titre pendant le drag
  - Drop zones dans Week/Day (en plus de Month) — drag entre slots horaires
  - Resize bord BAS (changer fin) — handle 8px hit zone, `data-no-dnd` pour bloquer @dnd-kit
  - Resize bord HAUT (changer début) — nouveau, snap 15min, clamp à end-15min
  - Click sur slot vide → crée événement 1h à l'heure cliquée
  - Right-click → menu Modifier/Dupliquer/Partager/Supprimer
  - Hover → tooltip avec titre, date FR, heures, lieu, description
  - Curseur grab → grabbing pendant drag
  - Now line (barre rouge à l'heure actuelle, refresh 60s)
  - Today highlight (colonne mise en valeur)
  - Escape annule drag/resize en cours
  - Drag-drop ajouté dans AgendaView, KanbanView, TimelineView
  - Drag entre calendrier (sidebar A → sidebar B) fonctionnel
  - Recurring edit dialog "Cet événement / Et les suivants / Toute la série"
  - Ctrl+C / Ctrl+X / Ctrl+V sur événements (clipboard interne)
  - Search filter wired (input dans header filtre les events sur title/description/location)
  - Raccourcis clavier internes : ←/→ navigation, T (today), N (new), D/W/M (vue), A (agenda)
  - Suppression demande confirmation
  - Vue mois corrigée : semaine commence lundi, événements multi-jours visibles sur tous les jours
  - Drag-drop préserve l'heure d'origine (TZ local au lieu de UTC)
  - Timezone événement = TZ utilisateur (au lieu d'UTC hardcodé)
  - Optimistic updates avec rollback sur erreur
  - Locale française dans tous les headers
- **2026-04-13** : Spec initial créé.
- **Pas d'OAuth tokens en clair** -- stocker chiffres, rafraichis automatiquement.
