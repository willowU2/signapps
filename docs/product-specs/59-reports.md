# Module Constructeur de Rapports (Reports) -- Specification fonctionnelle

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

1. **Self-service sans code** -- l'utilisateur construit ses rapports visuellement en selectionnant une source de donnees, en ajoutant des colonnes, en appliquant des filtres et des tris. Aucune connaissance SQL ou technique n'est requise. L'interface guide l'utilisateur etape par etape.
2. **Sources de donnees internes** -- les rapports tirent leurs donnees des modules SignApps existants (Activites/Taches, Calendrier, Drive, CRM, HR, Billing, Tickets, Formulaires, Communications). Chaque source expose un schema de colonnes disponibles. Pas de connexion a des bases externes.
3. **Construction par colonnes** -- le rapport est construit en ajoutant des colonnes une par une depuis un panneau source. Chaque colonne correspond a un champ de la source (ex: titre, statut, assignee, date, priorite). L'ordre des colonnes est modifiable par drag-and-drop. Suppression d'une colonne en un clic.
4. **Visualisation hybride** -- le rapport peut etre affiche en mode tableau (donnees brutes), en mode graphique (8 types de charts), ou en mode mixte (tableau + graphique). Le switch est instantane sans perte de configuration.
5. **Export multi-format** -- les rapports sont exportables en PDF (mise en page imprimable avec graphiques rendus en images), Excel (XLSX avec donnees et formules), CSV (donnees brutes), et image (PNG du graphique). L'export respecte les filtres et tris appliques.
6. **Rapports sauvegardes et partages** -- les rapports configures peuvent etre sauvegardes (nom, description), organises en dossiers, et partages avec d'autres utilisateurs ou equipes. Les rapports partages sont en lecture seule sauf si l'editeur donne les droits d'edition.

---

## Categorie 1 -- Interface principale du constructeur

### 1.1 En-tete de page
Titre `Constructeur de rapports` avec sous-titre `Creez des rapports visuels personnalises depuis vos donnees`. Breadcrumb : Accueil > Rapports. Fond `bg-card` avec bordure inferieure `border-border`.

### 1.2 Barre d'outils superieure
Layout horizontal avec gap de 8px entre les elements. De gauche a droite :
- **Dropdown `Source`** : selection de la source de donnees (voir categorie 2). Largeur 200px. Icone base de donnees a gauche du texte.
- **Bouton `Executer`** : icone play + texte. Couleur primaire. Desactive tant qu'aucune colonne n'est ajoutee. Raccourci clavier : `Ctrl+Enter`.
- **Bouton `Ajouter`** : icone `+` + texte `Colonne`. Ouvre le panneau de selection de colonnes. Desactive tant qu'aucune source n'est selectionnee.
- **Separateur vertical** (1px, `border-border`)
- **Bouton `Sauvegarder`** : icone disquette. Raccourci : `Ctrl+S`. Desactive si le rapport n'a pas change.
- **Dropdown `Exporter`** : icone download + fleche. Options : PDF, Excel (XLSX), CSV, Image (PNG).
- **Bouton `Partager`** : icone partage. Visible uniquement si le rapport est sauvegarde.

### 1.3 Zone de construction des colonnes
Zone horizontale sous la barre d'outils (hauteur 60px, fond `bg-muted`, bordure `border-border`, border-radius). Etat initial : message centre `Ajoutez des colonnes pour construire votre rapport` avec icone indicative (fleche vers le bouton Ajouter). Apres ajout de colonnes : les colonnes sont representees par des chips/tags deplacables alignes horizontalement. Chaque chip affiche :
- Icone de type (texte = `Aa`, nombre = `#`, date = calendrier, enum = liste, booleen = check)
- Nom du champ (tronque a 15 caracteres avec ellipsis)
- Indicateur de tri : fleche haut (croissant) ou bas (decroissant) si tri actif
- Indicateur de filtre : icone funnel si filtre actif
- Indicateur d'aggregation : icone sigma si aggregation active
- Bouton `x` pour supprimer la colonne (apparait au hover)
Clic sur un chip ouvre le panneau de configuration de la colonne (voir 3.4). Les chips sont deplacables par drag-and-drop pour changer l'ordre.

### 1.4 Panneau source (colonnes disponibles)
Panneau lateral gauche (largeur 280px, `bg-card`, `border-r border-border`) qui s'ouvre quand on clique sur `Ajouter`. Affiche la liste des colonnes disponibles de la source courante, groupees par categorie. Chaque colonne affiche :
- Icone de type
- Nom du champ
- Description courte (tooltip au survol, ex: `Date a laquelle la tache a ete creee`)
Barre de recherche en haut avec filtre instantane (debounce 200ms). Clic sur une colonne l'ajoute au rapport (animation : le chip apparait dans la zone de construction avec un effet slide-in). Double-clic ajoute ET ouvre le panneau de configuration. Les colonnes deja ajoutees sont marquees avec un check gris.

### 1.5 Zone de resultats
Sous la zone de construction, le tableau de resultats s'affiche apres execution. Colonnes = colonnes configurees dans l'ordre du drag-and-drop. Lignes = donnees de la source filtrees et triees. En-tetes cliquables pour le tri rapide. Cellules formatees selon le type. Fond alterne `bg-card` / `bg-muted` pour la lisibilite (zebra rows). Selection de lignes via checkbox a gauche pour actions groupees futures. Hauteur : occupe tout l'espace restant du viewport (min-height 300px).

### 1.6 Zone de visualisation graphique
Panneau sous le tableau (en mode mixte) ou a la place du tableau (en mode graphique). Hauteur : 400px (redimensionnable par glissement de la bordure superieure). Le graphique est genere par Recharts. Fond blanc. Bordure `border-border`. Titre du graphique en haut a gauche (editable au clic). Legende en bas. Toolbar du graphique en haut a droite : dropdown type de chart, bouton fullscreen, bouton export PNG.

### 1.7 Mode d'affichage
Toggle a trois boutons dans la barre d'outils secondaire (sous la barre principale) : `Tableau` (icone grille), `Graphique` (icone chart), `Mixte` (icone split). Le mode actif est surligne en couleur primaire. Le switch est instantane (pas de rechargement de donnees, seulement un changement de layout). Le mode est persistant dans la sauvegarde du rapport. Raccourcis : `Ctrl+1` = Tableau, `Ctrl+2` = Graphique, `Ctrl+3` = Mixte.

---

## Categorie 2 -- Sources de donnees

### 2.1 Dropdown de source
Le dropdown `Source` liste les 9 sources de donnees disponibles, chacune avec une icone distinctive :

| Source | Icone | Module | Colonnes disponibles |
|---|---|---|---|
| Activites | Check-circle | Tasks & Projects | titre (text), statut (enum: todo/in_progress/done/blocked), priorite (enum: low/medium/high/critical), assignee (user), date_creation (date), date_echeance (date), projet (text), tags (text[]), temps_estime_heures (number), temps_passe_heures (number), description (text), createur (user) |
| Utilisateurs | Users | Identity | nom (text), email (text), departement (text), poste (text), manager (user), date_embauche (date), statut (enum: active/inactive/suspended), site (text), role (text), derniere_connexion (date) |
| Fichiers | Folder | Drive | nom (text), type_mime (text), extension (text), taille_octets (number), proprietaire (user), date_creation (date), date_modification (date), dossier_parent (text), partage (boolean), chemin (text) |
| Evenements calendrier | Calendar | Calendar | titre (text), type (enum: event/task/leave/shift/booking/milestone), debut (date), fin (date), calendrier (text), recurrence (text), lieu (text), participants_count (number), all_day (boolean), createur (user) |
| Taches | List-todo | Tasks | titre (text), statut (enum: todo/in_progress/review/done/blocked), priorite (enum: low/medium/high/critical), assignee (user), date_echeance (date), projet (text), sprint (text), story_points (number), temps_estime (number), temps_passe (number) |
| Emails | Mail | Mail | sujet (text), expediteur (text), destinataires (text), date (date), dossier (enum: inbox/sent/drafts/trash), lu (boolean), taille (number), pieces_jointes_count (number), labels (text[]) |
| Reponses formulaires | Form | Forms | formulaire (text), repondant (user), date_soumission (date), + colonnes dynamiques generees depuis les champs du formulaire selectionne (texte, nombre, date, choix unique, choix multiple) |
| Deals CRM | Handshake | CRM/Contacts | nom (text), entreprise (text), montant (number), devise (text), etape (enum: lead/qualified/proposal/negotiation/won/lost), commercial (user), date_creation (date), date_cloture_prevue (date), probabilite (number), source (text) |
| Tickets helpdesk | Ticket | Helpdesk | titre (text), statut (enum: open/in_progress/waiting/resolved/closed), priorite (enum: low/medium/high/critical), assignee (user), demandeur (user), categorie (text), date_creation (date), date_resolution (date), temps_resolution_heures (number), satisfaction (number) |

### 2.2 Schema dynamique
Quand l'utilisateur selectionne une source, le systeme charge le schema via `GET /api/v1/reports/sources/{source_id}/schema`. Le schema contient pour chaque colonne : `name` (identifiant technique), `label` (nom affiche en francais), `type` (text/number/date/boolean/enum/user), `description` (aide contextuelle), `values` (pour les enums : liste des valeurs possibles). Ce schema alimente le panneau de selection de colonnes (1.4).

### 2.3 Colonnes de jointure
Certaines sources exposent des colonnes de jointure permettant d'enrichir les donnees :
- **Activites + Utilisateurs** : la colonne `assignee` permet de joindre sur les colonnes `departement`, `poste`, `site` de l'utilisateur assigne. Dans le panneau source, ces colonnes enrichies sont affichees dans un groupe `Assignee (Utilisateur)` avec indentation.
- **Deals CRM + Utilisateurs** : la colonne `commercial` permet de joindre sur les infos du commercial.
- **Tickets + Utilisateurs** : les colonnes `assignee` et `demandeur` permettent chacune une jointure.
- **Evenements + Utilisateurs** : la colonne `createur` permet la jointure.
Les jointures sont effectuees cote serveur (SQL JOIN) de maniere transparente pour l'utilisateur.

### 2.4 Source Formulaires (colonnes dynamiques)
Quand la source `Reponses formulaires` est selectionnee, un sous-dropdown apparait pour choisir le formulaire specifique. Apres selection, les colonnes sont generees dynamiquement depuis la definition du formulaire : chaque champ du formulaire devient une colonne avec son type (texte, nombre, date, choix unique -> enum, choix multiple -> text[], etc.). Les colonnes systeme (repondant, date_soumission) sont toujours presentes.

---

## Categorie 3 -- Construction de colonnes et filtres

### 3.1 Ajout de colonnes (drag from source)
L'utilisateur peut ajouter des colonnes de deux manieres :
1. **Clic** dans le panneau source : la colonne est ajoutee a la fin de la zone de construction.
2. **Drag-and-drop** depuis le panneau source vers la zone de construction : l'utilisateur peut placer la colonne a une position specifique (indicateur d'insertion bleu entre les chips existants).
Maximum 15 colonnes par rapport (au-dela, message d'avertissement : `Trop de colonnes peuvent reduire la lisibilite. Maximum 15.`). Minimum 1 colonne pour executer.

### 3.2 Chip de colonne -- interactions
Chaque chip dans la zone de construction supporte :
- **Clic simple** : ouvre le panneau de configuration (3.4) en slide-in depuis la droite
- **Clic sur `x`** : supprime la colonne (avec confirmation si c'est la derniere colonne du rapport)
- **Drag-and-drop** : deplace le chip pour reordonner les colonnes. Feedback visuel : ombre portee pendant le drag, indicateur d'insertion bleu entre les chips. Animation 200ms de reorganisation.
- **Clic droit** : menu contextuel avec `Configurer`, `Trier croissant`, `Trier decroissant`, `Supprimer le tri`, `Supprimer`

### 3.3 Configuration d'une colonne
Panneau lateral droit (largeur 320px, `bg-card`, `border-l border-border`) avec les sections :

**Libelle personnalise** : champ texte pour renommer l'en-tete de la colonne dans le rapport (ex: `date_creation` -> `Date de creation`). Par defaut : le `label` du schema. Max 50 caracteres.

**Tri** : radio buttons `Aucun` (defaut), `Croissant`, `Decroissant`. Une seule colonne de tri principal. Section depliable `Tri secondaire` avec un dropdown pour selectionner une deuxieme colonne de tri.

**Filtre** : interface de filtre contextuelle selon le type (voir 3.5). Les filtres actifs sont affiches comme des descriptions sous le chip dans la zone de construction.

**Aggregation** : dropdown `Aucune` (defaut), puis les aggregations disponibles selon le type (voir 3.6). Quand une aggregation est selectionnee, l'icone sigma apparait sur le chip.

**Format d'affichage** :
- Dates : `JJ/MM/AAAA`, `AAAA-MM-JJ`, `Relatif` (il y a 3 jours), `Court` (15 mars)
- Nombres : decimales (0, 1, 2), separateur de milliers (oui/non), prefixe/suffixe (ex: `EUR`, `%`, `h`)
- Texte : troncature a N caracteres (defaut 50)

**Largeur** : `Auto` (defaut, ajuste au contenu), `Etroite` (100px), `Moyenne` (200px), `Large` (400px)

### 3.4 Builder de filtres (AND/OR groups)
Interface de construction de filtres avancee avec groupes AND/OR :
- Chaque filtre est une ligne avec : colonne (dropdown), operateur (dropdown contextuel), valeur(s) (input contextuel)
- Bouton `+ Ajouter un filtre` ajoute une ligne dans le groupe courant (AND implicite entre les lignes d'un meme groupe)
- Bouton `+ Ajouter un groupe OR` cree un nouveau groupe de conditions (les groupes sont lies par OR)
- Chaque ligne a un bouton `x` pour la supprimer
- Preview textuelle du filtre en bas : ex: `(statut = "en cours" ET priorite = "haute") OU (date_echeance < aujourd'hui)`
- Les filtres sont appliques cote serveur (clause WHERE SQL)

### 3.5 Operateurs par type de champ
Les operateurs disponibles dependent du type de la colonne :

**Texte** : `contient`, `ne contient pas`, `commence par`, `finit par`, `est exactement`, `n'est pas`, `est vide`, `n'est pas vide`. Valeur : champ texte libre. Case insensitive par defaut.

**Nombre** : `egal a`, `different de`, `superieur a`, `superieur ou egal`, `inferieur a`, `inferieur ou egal`, `entre` (deux champs : min et max), `est vide`. Valeur : champ numerique avec validation (rejet des non-nombres).

**Date** : `avant`, `apres`, `entre` (deux date pickers : debut et fin), `est exactement`, `aujourd'hui`, `hier`, `cette semaine`, `ce mois`, `ce trimestre`, `cette annee`, `les N derniers jours` (champ numerique pour N), `est vide`. Les dates sont evaluees dans le fuseau horaire de l'utilisateur.

**Enum/Statut** : `est` (multi-select parmi les valeurs possibles avec checkboxes), `n'est pas` (meme multi-select). Les valeurs sont affichees avec leurs badges de couleur habituels (ex: statut "blocked" en rouge).

**Booleen** : `est vrai`, `est faux`. Toggle ou radio buttons.

**User** : `est` (user picker avec recherche), `n'est pas`, `est moi` (raccourci pour l'utilisateur courant), `est dans le departement` (dropdown de departements), `est vide`.

### 3.6 Aggregations
Les aggregations transforment le rapport en rapport groupe. Quand une aggregation est appliquee sur une colonne, les autres colonnes non aggregees deviennent les dimensions de groupement (GROUP BY SQL). Le tableau affiche les lignes de groupe avec les valeurs agregees.

| Aggregation | Types compatibles | Description | Affichage |
|---|---|---|---|
| Count | tous | Nombre d'enregistrements | `42` |
| Count Distinct | tous | Nombre de valeurs uniques | `12` |
| Sum | nombre | Somme des valeurs | `1,234.56` |
| Average | nombre | Moyenne (arrondie a 2 decimales) | `45.23` |
| Min | nombre, date | Valeur minimale | Valeur formatee |
| Max | nombre, date | Valeur maximale | Valeur formatee |

### 3.7 Colonne calculee
Bouton `+ Colonne calculee` dans la barre d'outils (a cote de `Ajouter`). Ouvre un dialog de formule :
- **Nom** : champ texte pour le libelle de la colonne (obligatoire)
- **Formule** : editeur de formule avec :
  - Dropdown pour inserer une colonne existante (insere `{nom_colonne}`)
  - Operateurs : `+`, `-`, `*`, `/`, `%` (modulo)
  - Fonctions : `concat({a}, " ", {b})`, `date_diff({date1}, {date2}, "days")`, `if({condition}, {then}, {else})`, `coalesce({a}, {b})`, `upper({text})`, `lower({text})`, `round({number}, decimals)`
  - Autocompletion des noms de colonnes avec `{` comme trigger
- **Preview** : les 5 premieres lignes de resultat sont affichees en bas du dialog pour validation
- **Type de resultat** : detecte automatiquement (nombre si formule arithmetique, texte si concat, date si date_diff)

Exemples :
- `{temps_passe_heures} / {temps_estime_heures} * 100` -> Taux de completion (%)
- `date_diff({date_echeance}, today(), "days")` -> Jours restants
- `if({montant} > 10000, "Grand compte", "Standard")` -> Segment client
- `concat({nom}, " (", {departement}, ")")` -> Nom complet avec departement

### 3.8 Groupement explicite
Bouton `Grouper par` dans la barre d'outils secondaire. Dropdown listant les colonnes de type texte, enum, date, user actuellement dans le rapport. Selection d'une ou plusieurs colonnes de groupement. Le rapport affiche alors :
- Lignes de groupe avec fond `bg-muted` et police bold, affichant la valeur du groupe et les sous-totaux
- Sous chaque groupe : les lignes de detail (repliables par clic sur le chevron a gauche du groupe)
- Boutons `Tout deplier` / `Tout replier` dans la barre d'outils
- Pour les dates : granularite configurable (jour, semaine, mois, trimestre, annee) via un sous-dropdown

---

## Categorie 4 -- Execution et resultats

### 4.1 Bouton Executer
Le bouton `Executer` envoie la configuration du rapport (source, colonnes, filtres, tris, aggregations, groupement) au endpoint `POST /api/v1/reports/query`. Le payload est un JSON structure (voir 8.2). L'API traduit la configuration en requete SQL sur la base SignApps et retourne les resultats en JSON pagine. Pendant l'execution : le bouton affiche un spinner et le texte `Execution...`. Le bouton est desactive pendant le traitement. Timeout : 30 secondes. Si le timeout est depasse : message d'erreur `La requete a pris trop de temps. Essayez d'ajouter des filtres pour reduire le volume de donnees.`

### 4.2 Tableau de resultats
Tableau HTML rendu avec TanStack Table. Features :
- **En-tetes** : cliquables pour le tri rapide (clic = neutre -> croissant -> decroissant -> neutre). Indicateur visuel : fleche haut/bas dans l'en-tete actif.
- **Cellules formatees** : dates localisees (JJ/MM/AAAA par defaut), nombres avec separateur de milliers, statuts avec badges couleur (todo = gris, in_progress = bleu, done = vert, blocked = rouge), booleens avec icones (check vert / cross rouge), users avec avatar miniature + nom.
- **Zebra rows** : lignes alternees `bg-card` / `bg-muted` pour la lisibilite.
- **Redimensionnement** : colonnes redimensionnables par glissement du bord de l'en-tete. Double-clic auto-ajuste la largeur au contenu le plus large.
- **Selection** : checkbox a gauche de chaque ligne pour selection (non utilise en v1, prepare pour les actions groupees futures).

### 4.3 Pagination
Barre de pagination en bas du tableau :
- Boutons : premiere page (`<<`), precedente (`<`), suivante (`>`), derniere (`>>`)
- Numeros de pages cliquables (affiche max 7 numeros avec ellipsis)
- Select du nombre de lignes par page : `25` (defaut), `50`, `100`, `500`
- Compteur : `Affichage 1-25 sur 1,234 resultats`
- Chargement dynamique : les pages sont chargees a la demande (pas toutes en memoire). Chaque changement de page envoie une nouvelle requete avec `page` et `page_size`.

### 4.4 Recherche dans les resultats
Barre de recherche au-dessus du tableau (icone loupe, placeholder `Rechercher dans les resultats...`). Filtre client-side dans les lignes de la page courante. Debounce 300ms. Les cellules contenant le terme sont surlignees en jaune. Complement aux filtres de colonnes (qui sont server-side). Raccourci : `Ctrl+F` focus la barre.

### 4.5 Tri interactif
Clic sur un en-tete de colonne dans le tableau bascule le tri : neutre -> croissant (fleche haut) -> decroissant (fleche bas) -> neutre. Le tri est applique cote serveur (nouvelle requete API avec `sort`). Animation de transition 200ms sur les lignes qui changent de position. Multi-tri : Shift+clic sur un second en-tete ajoute un tri secondaire (indicateur : chiffre 1/2 a cote de la fleche).

### 4.6 Total en pied de tableau
Ligne de total figee en bas du tableau (fond `bg-muted`, police bold) pour les colonnes numeriques. Affiche selon le type :
- Colonnes `number` avec aggregation `sum` ou aucune : somme totale (sur toutes les pages, pas seulement la page courante)
- Colonnes `number` avec aggregation `avg` : moyenne globale
- Colonnes `count` : total global
Le calcul des totaux est effectue cote serveur et retourne dans la reponse API (champ `totals`).

### 4.7 Mise en forme conditionnelle
Bouton `Mise en forme` dans le menu contextuel d'une colonne (clic droit sur l'en-tete). Dialog de configuration :
- **Condition** : meme operateurs que les filtres (voir 3.5)
- **Style** : couleur de fond (color picker), couleur de texte, gras (toggle), icone (select parmi check, warning, cross, star)
Exemples preconfigures :
- Statut `blocked` -> fond rouge clair, texte rouge
- Priorite `critical` -> fond orange, texte blanc, gras
- Montant > 10000 -> texte vert, gras
- Date < aujourd'hui -> texte rouge (en retard)
Plusieurs regles empilables par colonne (evaluees dans l'ordre, premiere correspondance gagne). Barre de donnees optionnelle : remplissage proportionnel de la cellule (comme Excel) pour les colonnes numeriques.

---

## Categorie 5 -- Visualisation graphique (8 types de charts)

### 5.1 Selection du type de graphique
Menu de selection avec vignettes pour chaque type. Chaque vignette montre un mini-apercu du type de chart avec son nom en dessous. Le type selectionne a une bordure bleue. Les 8 types :

1. **Table** (icone grille) -- vue tabulaire standard (meme rendu que le mode Tableau)
2. **Bar chart** (icone barres) -- barres verticales ou horizontales, groupees ou empilees
3. **Line chart** (icone courbe) -- courbes lisses ou angulaires, ideal pour les series temporelles
4. **Pie chart** (icone camembert) -- segments proportionnels, max 10 segments
5. **Donut chart** (icone anneau) -- variante du pie avec trou central et valeur totale
6. **Area chart** (icone aire) -- courbe avec remplissage, simple ou empile
7. **Scatter plot** (icone nuage de points) -- axes X/Y numeriques avec points
8. **Heatmap** (icone grille coloree) -- grille de cellules colorees selon la valeur

### 5.2 Configuration des axes
Panneau de configuration du graphique (sidebar droite ou popover) :

- **Axe X (Dimension)** : dropdown listant les colonnes de type texte, date, enum. Pour les dates, sous-dropdown de granularite : `Jour`, `Semaine`, `Mois`, `Trimestre`, `Annee`. Label d'axe personnalisable (champ texte).
- **Axe Y (Mesure)** : dropdown listant les colonnes de type nombre. Aggregation obligatoire si pas deja definie : `Sum`, `Avg`, `Count`, `Min`, `Max`. Label d'axe personnalisable. Echelle : `Lineaire` (defaut), `Logarithmique`.
- **Couleur / Groupement (Serie)** : colonne optionnelle de type enum ou texte pour le split en series. Ex: statut -> une serie par statut. Max 10 series (au-dela, les suivantes sont regroupees dans `Autres`).
- **Taille** (scatter uniquement) : colonne optionnelle de type nombre pour la taille des points.

### 5.3 Bar Chart
Graphique a barres Recharts (`<BarChart>`). Options :
- **Orientation** : `Vertical` (defaut) ou `Horizontal`
- **Mode** : `Groupe` (barres cote a cote) ou `Empile` (barres empilees)
- **Labels de valeur** : toggle pour afficher le nombre au-dessus de chaque barre
- **Espacement** : slider pour l'espace entre les barres (defaut 20%)
Couleurs par serie : palette de 8 couleurs distinctes du theme SignApps. Axe Y avec graduation automatique (arrondie a des valeurs lisibles). Tooltip au survol : nom de la dimension + valeur exacte + pourcentage si empile.

### 5.4 Line Chart
Graphique en courbes Recharts (`<LineChart>`). Options :
- **Style de ligne** : `Lisse` (courbe bezier) ou `Angulaire` (lineaire)
- **Marqueurs** : toggle pour afficher les points de donnees (cercles) sur les lignes
- **Epaisseur** : dropdown `Fine` (1px), `Standard` (2px), `Epaisse` (3px)
Ideal pour les series temporelles (axe X = date). Points de donnees cliquables : clic ouvre un tooltip fixe avec le detail. Legende interactive : clic sur un element de la legende masque/affiche la serie correspondante (animation fade 300ms). Zone de survol : ligne verticale grise suivant le curseur avec tooltip multi-series.

### 5.5 Pie / Donut Chart
Graphique circulaire Recharts (`<PieChart>`). Options :
- **Mode** : `Pie` (cercle plein) ou `Donut` (trou central, ratio configurable 40-80%)
- **Labels** : `Pourcentage` (defaut), `Valeur absolue`, `Nom + pourcentage`, `Aucun`
- **Position des labels** : `Externe` (lignes de rappel) ou `Interne` (dans le segment)
En mode donut, le centre affiche la valeur totale en grand (text-2xl) avec le label en dessous (text-sm text-muted-foreground). Maximum 10 segments : si plus de 10 valeurs distinctes, les dernieres sont regroupees dans un segment `Autres` (gris). Tooltip au survol d'un segment : nom, valeur, pourcentage. Animation d'entree : les segments apparaissent un par un avec rotation.

### 5.6 Area Chart
Graphique a aires Recharts (`<AreaChart>`). Options :
- **Mode** : `Simple` (une seule aire) ou `Empile` (stacked area, utile pour la composition d'un total)
- **Opacite** : slider 10-80% (defaut 30%) pour la zone remplie
- **Courbe** : `Lisse` ou `Angulaire`
Memes interactions que le Line Chart (legende interactive, tooltip multi-series, zone de survol).

### 5.7 Scatter Plot
Nuage de points Recharts (`<ScatterChart>`). Configuration specifique :
- **Axe X** : colonne numerique
- **Axe Y** : colonne numerique
- **Taille** : colonne numerique optionnelle (min 5px, max 30px, proportionnel)
- **Couleur** : colonne enum optionnelle pour colorer les points par categorie
Tooltip au survol d'un point : toutes les valeurs des colonnes du rapport pour cette ligne. Zoom rectangulaire (brush selection) : cliquer-glisser pour zoomer sur une zone. Bouton `Reset zoom` pour revenir a la vue complete.

### 5.8 Heatmap
Grille de cellules colorees. Configuration :
- **Axe X** : colonne de dimension (texte/enum/date)
- **Axe Y** : colonne de dimension (texte/enum/date)
- **Valeur** : colonne numerique avec aggregation
- **Echelle de couleur** : `Bleu` (defaut, bleu clair -> bleu fonce), `Rouge-Vert` (rouge -> jaune -> vert), `Gris` (blanc -> noir)
Chaque cellule affiche la valeur numerique et est coloree selon l'echelle. Tooltip au survol : coordonnees X/Y + valeur. Utile pour les matrices de correlation, les heatmaps temporelles (ex: tickets par jour de la semaine et heure).

### 5.9 Interactions graphiques communes
Tous les types de charts supportent :
- **Tooltip** : survol d'un element affiche les valeurs exactes dans un popover `bg-card shadow-md`
- **Legende interactive** : clic sur un element de la legende masque/affiche la serie (animation 300ms)
- **Export image** : bouton camera en haut a droite du graphique. Genere un PNG 2x (retina) du graphique. Telechargement direct.
- **Fullscreen** : bouton expand en haut a droite. Le graphique passe en plein ecran (modal) avec une hauteur de 80vh.
- **Drill-down** : clic sur un segment/barre/point du graphique filtre le tableau de resultats sur cette valeur (ajoute un filtre temporaire visible comme chip au-dessus du tableau avec bouton `x` pour le retirer).

### 5.10 Theme et couleurs
Les graphiques utilisent les couleurs du theme SignApps (tokens semantiques). Mode sombre automatique (les graphiques s'adaptent). Palette de couleurs par defaut : 8 couleurs distinctes et accessibles (contraste WCAG AA). Personnalisation par rapport : dans les options du graphique, section `Couleurs` avec 8 color pickers pour personnaliser chaque serie. Reset a la palette par defaut en un clic.

---

## Categorie 6 -- Dashboard mode

### 6.1 Activer le mode dashboard
Bouton `Dashboard` dans la barre d'outils d'un rapport sauvegarde. Ouvre un editeur de dashboard ou le rapport courant est le premier widget. Le dashboard est une page dediee (`/reports/dashboards/{id}`) avec un layout en grille.

### 6.2 Grille de widgets
Layout en grille 12 colonnes (react-grid-layout). Chaque widget est un rapport sauvegarde affiche en version compacte (titre + graphique ou titre + tableau mini). Taille minimale : 3 colonnes x 2 lignes. Taille par defaut : 6 colonnes x 4 lignes. Drag-and-drop pour deplacer les widgets. Resize par les coins/bords. Snap to grid. Les widgets ne se chevauchent pas (poussent les voisins).

### 6.3 Ajout de widgets
Bouton `+ Ajouter un widget` ouvre un drawer avec la liste des rapports sauvegardes de l'utilisateur et des rapports partages avec lui. Recherche par nom. Clic ajoute le rapport comme widget dans le premier espace disponible de la grille.

### 6.4 Configuration d'un widget
Clic sur l'icone engrenage d'un widget ouvre les options :
- **Titre** : personnalisable (par defaut : nom du rapport)
- **Mode d'affichage** : `Graphique seul`, `Tableau seul`, `KPI` (valeur unique en grand)
- **Rafraichissement** : `Manuel` (defaut), `Auto 1 min`, `Auto 5 min`, `Auto 15 min`, `Auto 1h`
- **Filtres supplementaires** : possibilite de surcharger les filtres du rapport pour ce widget specifique

### 6.5 Auto-rafraichissement
Chaque widget avec un intervalle auto-refresh execute sa requete periodiquement. Un indicateur discret (icone horloge + derniere mise a jour) est affiche en bas a droite du widget. Le rafraichissement est decale entre les widgets (pas tous en meme temps) pour eviter la surcharge.

### 6.6 Sauvegarde et partage du dashboard
Le dashboard est sauvegarde comme une entite distincte (pas un rapport). Champs : nom, description, layout (positions et tailles des widgets). Partage avec les memes mecanismes que les rapports (utilisateurs, groupes, lecture/edition). URL stable pour bookmarker.

---

## Categorie 7 -- Sauvegarde, partage et export

### 7.1 Sauvegarder un rapport
Bouton `Sauvegarder` (ou `Ctrl+S`) ouvre un dialog si premiere sauvegarde :
- **Nom** : champ texte obligatoire (max 100 caracteres)
- **Description** : textarea optionnelle (max 500 caracteres)
- **Dossier** : select dans la hierarchie de dossiers de rapports (arborescence depliable)
Si le rapport existe deja (edition), sauvegarde directe sans dialog (toast : `Rapport sauvegarde`). Bouton `Sauvegarder sous...` pour creer une copie.

### 7.2 Liste des rapports sauvegardes
Page `/reports/saved` avec la liste des rapports de l'utilisateur et des rapports partages avec lui. Vue en tableau avec colonnes : nom (lien cliquable), source (badge), auteur (avatar + nom), derniere modification (date relative), partage (icone si partage). Actions par ligne : `Ouvrir`, `Dupliquer`, `Supprimer` (confirmation dialog), `Partager`. Filtres : `Mes rapports`, `Partages avec moi`, `Templates`. Recherche par nom. Tri par nom ou date.

### 7.3 Dossiers de rapports
Organisation des rapports en dossiers hierarchiques. Dossiers par defaut (non supprimables) : `Mes rapports`, `Partages avec moi`, `Templates`. L'utilisateur peut creer des sous-dossiers (max 3 niveaux). Drag-and-drop pour deplacer un rapport d'un dossier a un autre. Clic droit sur un dossier : `Renommer`, `Supprimer` (seulement si vide).

### 7.4 Partage de rapport
Bouton `Partager` ouvre un dialog :
- **Recherche de destinataires** : champ avec autocompletion sur les utilisateurs et les groupes. Les destinataires selectionnes sont affiches comme des chips avec leur niveau d'acces.
- **Niveau d'acces** : dropdown par destinataire : `Lecture seule` (defaut), `Edition`
- **Lien de partage** : URL stable copiable. Toggle `Activer le lien` / `Desactiver le lien`.
Les destinataires voient le rapport dans leur dossier `Partages avec moi`. Notification push envoyee aux destinataires.

### 7.5 Templates de rapports
Rapports pre-configures fournis par l'admin ou le systeme. Affiches dans le dossier `Templates` avec un badge `Template`. Templates par defaut :
- **Charge de travail par equipe** : source Activites, colonnes assignee/statut/priorite, groupement par departement, bar chart stacked par statut
- **Pipeline commercial** : source Deals CRM, colonnes nom/montant/etape/commercial, bar chart horizontal par etape, colonne calculee total par etape
- **Absences du mois** : source Evenements (filtre type=leave), colonnes employe/date debut/date fin/type conge, table view
- **Tickets ouverts** : source Tickets helpdesk, colonnes titre/statut/priorite/assignee, filtre statut != closed, tri par priorite desc
- **Facturation mensuelle** : source Deals CRM (filtre etape=won), colonnes client/montant/date_cloture, aggregation sum par mois, line chart
L'utilisateur peut `Utiliser ce template` pour creer un nouveau rapport pre-rempli (copie editable).

### 7.6 Duplication
Bouton `Dupliquer` dans la liste des rapports ou dans le menu du rapport ouvert. La copie est independante de l'original. Nom par defaut : `[Nom original] (copie)`. Utile pour creer des variantes (meme rapport avec des filtres differents).

### 7.7 Versioning
Chaque sauvegarde cree une version. `Menu > Historique des versions` ouvre un panneau avec la liste des versions : date, auteur du changement, description auto (ex: `Ajout de la colonne "Departement"`, `Filtre modifie`). Clic sur une version affiche un diff visuel (colonnes ajoutees/supprimees, filtres modifies). Bouton `Restaurer cette version` revient a l'etat precedent. Maximum 50 versions conservees (les plus anciennes sont supprimees).

### 7.8 Export PDF
Bouton `Exporter > PDF` genere un document PDF via signapps-office ou pdf-lib (client-side pour les petits rapports) :
- Page de titre : nom du rapport, date de generation, auteur, filtres appliques (liste)
- Tableau de donnees : pagine si >50 lignes, en-tetes repetes, largeurs de colonnes preservees
- Graphique : rendu comme image PNG haute resolution (inseree dans le PDF)
- Pied de page : numero de page, `Genere par SignApps Reports`
- Orientation auto : paysage si >5 colonnes, portrait sinon

### 7.9 Export Excel (XLSX)
Export via SheetJS cote client :
- **Feuille 1 `Donnees`** : en-tetes en gras (`font-weight: bold`), types preserves (nombres, dates, texte), formules SUM en derniere ligne pour les colonnes numeriques, largeurs de colonnes auto-ajustees
- **Feuille 2 `Metadonnees`** : nom du rapport, source, date de generation, filtres appliques, auteur
Si le rapport contient un graphique, une troisieme feuille `Graphique` contient une image du graphique.

### 7.10 Export CSV
Export en CSV brut avec les colonnes et filtres du rapport. Dialog d'options :
- Delimiteur : `Virgule` (defaut), `Point-virgule`, `Tabulation`
- Encodage : `UTF-8 avec BOM` (defaut, compatible Excel), `UTF-8 sans BOM`
- En-tetes : `Oui` (defaut), `Non`
Telechargement du fichier `.csv`.

### 7.11 Export Image (PNG)
Export du graphique uniquement en image PNG haute resolution (2x pour Retina). Dimensions : largeur du graphique tel qu'affiche x2. Fond blanc (pas transparent). Titre du rapport inclus en haut. Telechargement direct.

### 7.12 Rapports programmes (schedule email delivery)
Accessible depuis le menu du rapport sauvegarde : `Programmer un envoi`. Dialog de configuration :
- **Frequence** : `Quotidien` (tous les jours ouvrables), `Hebdomadaire` (select jour : Lundi par defaut), `Mensuel` (select jour du mois : 1er par defaut)
- **Heure d'envoi** : time picker (defaut 8h00, fuseau horaire de l'utilisateur)
- **Format** : `PDF` (defaut) ou `Excel (XLSX)`
- **Destinataires** : liste d'emails (champ multi-input avec validation email). Les destinataires n'ont pas besoin d'un compte SignApps.
- **Objet de l'email** : pre-rempli `[SignApps] Rapport: {nom_du_rapport} - {date}`. Editable.
Le rapport est execute automatiquement avec les donnees a jour et envoye par email via signapps-mail. L'historique des envois est consultable dans le detail du rapport.

---

## Categorie 8 -- Architecture backend et API

### 8.1 Architecture
Le constructeur de rapports est un module frontend qui interroge un endpoint generique du gateway. Le gateway traduit les requetes en appels SQL (via signapps-db) ou en appels aux APIs des services concernes. Les resultats sont caches via signapps-cache (moka) avec un TTL configurable.

### 8.2 Endpoint de requete generique
`POST /api/v1/reports/query` accepte un payload JSON :
```json
{
  "source": "activities",
  "columns": [
    {"name": "title"},
    {"name": "status"},
    {"name": "assignee", "join_columns": ["departement"]},
    {"name": "created_at", "format": "YYYY-MM"}
  ],
  "filters": {
    "operator": "AND",
    "conditions": [
      {"column": "status", "op": "in", "value": ["todo", "in_progress"]},
      {"column": "created_at", "op": "after", "value": "2026-01-01"}
    ],
    "groups": [
      {
        "operator": "OR",
        "conditions": [
          {"column": "priority", "op": "eq", "value": "critical"},
          {"column": "assignee.departement", "op": "eq", "value": "Engineering"}
        ]
      }
    ]
  },
  "sort": [
    {"column": "created_at", "direction": "desc"},
    {"column": "priority", "direction": "asc"}
  ],
  "aggregations": [
    {"column": "status", "function": "count"}
  ],
  "group_by": ["status"],
  "calculated_fields": [
    {"name": "completion_rate", "formula": "{temps_passe_heures} / {temps_estime_heures} * 100"}
  ],
  "page": 1,
  "page_size": 50
}
```
Reponse :
```json
{
  "data": [
    {"status": "todo", "count": 42},
    {"status": "in_progress", "count": 18}
  ],
  "total_count": 2,
  "page": 1,
  "page_size": 50,
  "totals": {"count": 60},
  "execution_time_ms": 145
}
```

### 8.3 Schema des sources
`GET /api/v1/reports/sources` retourne la liste des sources disponibles avec leurs schemas :
```json
[
  {
    "id": "activities",
    "label": "Activites",
    "icon": "check-circle",
    "columns": [
      {"name": "title", "type": "text", "label": "Titre", "description": "Titre de la tache"},
      {"name": "status", "type": "enum", "label": "Statut", "values": ["todo", "in_progress", "done", "blocked"]},
      {"name": "assignee", "type": "user", "label": "Assigne a", "joinable": true, "join_source": "users"},
      {"name": "created_at", "type": "date", "label": "Date de creation", "description": "Date de creation de la tache"}
    ],
    "join_columns": {
      "assignee": [
        {"name": "departement", "type": "text", "label": "Departement (assigne)"},
        {"name": "site", "type": "text", "label": "Site (assigne)"}
      ]
    }
  }
]
```

### 8.4 Cache des resultats
Les resultats de requetes sont caches via signapps-cache (moka) avec un TTL configurable (defaut 5 minutes). Cle de cache : hash SHA-256 du payload de requete + user_id (pour respecter les permissions row-level). Invalidation automatique quand les donnees sources changent (via PgEventBus : les events `activities.task.updated`, `crm.deal.updated`, etc. invalident les caches des sources correspondantes). Header de reponse `X-Cache: HIT` ou `X-Cache: MISS` pour le debug.

### 8.5 Limites et performance
- Maximum 15 colonnes par rapport (au-dela, erreur 422)
- Maximum 10,000 lignes par export (au-dela, suggestion de filtrer, message : `Le rapport contient plus de 10,000 lignes. Ajoutez des filtres pour reduire le volume.`)
- Timeout de requete : 30 secondes (configurable par l'admin)
- Pagination obligatoire pour les affichages (pas de full scan en memoire)
- Rate limiting : 60 requetes de rapport par minute par utilisateur (via signapps-cache)

### 8.6 Permissions et row-level security
L'utilisateur ne voit que les donnees auxquelles il a acces dans le module source. Le gateway verifie les permissions avant d'executer la requete :
- Si un utilisateur n'a pas le role `billing:reader`, la source `Deals CRM` n'est pas listee dans le dropdown.
- Les filtres de row-level security sont appliques automatiquement par les APIs des services (ex: un manager voit les taches de son equipe, un commercial voit ses propres deals).
- La liste des sources disponibles est filtree en fonction des roles de l'utilisateur au chargement de la page.

### 8.7 PostgreSQL Schema

```sql
CREATE TABLE saved_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    folder_id UUID REFERENCES report_folders(id),
    source VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    display_mode VARCHAR(20) NOT NULL DEFAULT 'table' CHECK (display_mode IN ('table', 'chart', 'mixed')),
    chart_config JSONB DEFAULT '{}',
    conditional_formatting JSONB DEFAULT '[]',
    owner_id UUID NOT NULL REFERENCES users(id),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_reports_owner ON saved_reports(owner_id);
CREATE INDEX idx_saved_reports_folder ON saved_reports(folder_id);

CREATE TABLE report_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES report_folders(id),
    owner_id UUID NOT NULL REFERENCES users(id),
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE report_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES saved_reports(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    config JSONB NOT NULL,
    chart_config JSONB,
    change_description TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(report_id, version)
);

CREATE INDEX idx_report_versions_report ON report_versions(report_id, version DESC);

CREATE TABLE report_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES saved_reports(id) ON DELETE CASCADE,
    shared_with_user_id UUID REFERENCES users(id),
    shared_with_group_id UUID,
    access_level VARCHAR(20) NOT NULL DEFAULT 'read' CHECK (access_level IN ('read', 'edit')),
    link_token VARCHAR(64) UNIQUE,
    link_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_share_target CHECK (
        (shared_with_user_id IS NOT NULL AND shared_with_group_id IS NULL) OR
        (shared_with_user_id IS NULL AND shared_with_group_id IS NOT NULL) OR
        (shared_with_user_id IS NULL AND shared_with_group_id IS NULL AND link_token IS NOT NULL)
    )
);

CREATE INDEX idx_report_shares_user ON report_shares(shared_with_user_id);
CREATE INDEX idx_report_shares_group ON report_shares(shared_with_group_id);
CREATE INDEX idx_report_shares_link ON report_shares(link_token) WHERE link_token IS NOT NULL;

CREATE TABLE report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES saved_reports(id) ON DELETE CASCADE,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 28),
    send_time TIME NOT NULL DEFAULT '08:00',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Paris',
    format VARCHAR(10) NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf', 'xlsx')),
    recipients JSONB NOT NULL DEFAULT '[]',
    email_subject VARCHAR(200),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    last_sent_at TIMESTAMPTZ,
    next_send_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_schedules_next ON report_schedules(next_send_at) WHERE active = TRUE;

CREATE TABLE report_schedule_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES report_schedules(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recipient_count INTEGER NOT NULL,
    format VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed')),
    error_message TEXT
);

CREATE TABLE report_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    layout JSONB NOT NULL DEFAULT '[]',
    owner_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE report_dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES report_dashboards(id) ON DELETE CASCADE,
    report_id UUID NOT NULL REFERENCES saved_reports(id) ON DELETE CASCADE,
    display_mode VARCHAR(20) NOT NULL DEFAULT 'chart',
    title_override VARCHAR(100),
    filter_overrides JSONB DEFAULT '{}',
    refresh_interval_seconds INTEGER DEFAULT 0,
    grid_x INTEGER NOT NULL DEFAULT 0,
    grid_y INTEGER NOT NULL DEFAULT 0,
    grid_w INTEGER NOT NULL DEFAULT 6,
    grid_h INTEGER NOT NULL DEFAULT 4,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dashboard_widgets ON report_dashboard_widgets(dashboard_id);
```

### 8.8 REST API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/reports/sources` | List available data sources with schemas |
| `GET` | `/api/v1/reports/sources/{id}/schema` | Get detailed schema for a source |
| `POST` | `/api/v1/reports/query` | Execute a report query (paginated results) |
| `GET` | `/api/v1/reports/saved` | List saved reports (owned + shared) |
| `GET` | `/api/v1/reports/saved/{id}` | Get saved report config |
| `POST` | `/api/v1/reports/saved` | Create saved report |
| `PUT` | `/api/v1/reports/saved/{id}` | Update saved report |
| `DELETE` | `/api/v1/reports/saved/{id}` | Delete saved report |
| `POST` | `/api/v1/reports/saved/{id}/duplicate` | Duplicate report |
| `GET` | `/api/v1/reports/saved/{id}/versions` | List report versions |
| `POST` | `/api/v1/reports/saved/{id}/versions/{version}/restore` | Restore a version |
| `POST` | `/api/v1/reports/saved/{id}/share` | Share report |
| `DELETE` | `/api/v1/reports/saved/{id}/share/{share_id}` | Revoke share |
| `POST` | `/api/v1/reports/saved/{id}/export/pdf` | Export as PDF |
| `POST` | `/api/v1/reports/saved/{id}/export/xlsx` | Export as XLSX |
| `POST` | `/api/v1/reports/saved/{id}/export/csv` | Export as CSV |
| `POST` | `/api/v1/reports/saved/{id}/export/png` | Export chart as PNG |
| `GET` | `/api/v1/reports/folders` | List report folders |
| `POST` | `/api/v1/reports/folders` | Create folder |
| `PUT` | `/api/v1/reports/folders/{id}` | Rename folder |
| `DELETE` | `/api/v1/reports/folders/{id}` | Delete folder (must be empty) |
| `POST` | `/api/v1/reports/saved/{id}/schedule` | Create scheduled delivery |
| `PUT` | `/api/v1/reports/saved/{id}/schedule/{schedule_id}` | Update schedule |
| `DELETE` | `/api/v1/reports/saved/{id}/schedule/{schedule_id}` | Delete schedule |
| `GET` | `/api/v1/reports/saved/{id}/schedule/{schedule_id}/history` | Schedule send history |
| `GET` | `/api/v1/reports/dashboards` | List dashboards |
| `POST` | `/api/v1/reports/dashboards` | Create dashboard |
| `PUT` | `/api/v1/reports/dashboards/{id}` | Update dashboard layout |
| `DELETE` | `/api/v1/reports/dashboards/{id}` | Delete dashboard |
| `POST` | `/api/v1/reports/dashboards/{id}/widgets` | Add widget |
| `PUT` | `/api/v1/reports/dashboards/{id}/widgets/{widget_id}` | Update widget |
| `DELETE` | `/api/v1/reports/dashboards/{id}/widgets/{widget_id}` | Remove widget |
| `GET` | `/api/v1/reports/embed/{report_id}` | Embeddable report view |

### 8.9 PgEventBus Events

| Event | Payload | Consumers |
|---|---|---|
| `reports.report.created` | `{id, name, source, owner_id}` | signapps-metrics (usage tracking) |
| `reports.report.updated` | `{id, name, owner_id, changes}` | Invalidate cache for this report |
| `reports.report.shared` | `{report_id, shared_with, access_level}` | signapps-notifications (push to recipient) |
| `reports.report.exported` | `{report_id, format, user_id}` | signapps-metrics (usage tracking) |
| `reports.scheduled.sent` | `{schedule_id, report_id, recipient_count, format}` | signapps-metrics, signapps-notifications (confirm to owner) |
| `reports.scheduled.failed` | `{schedule_id, report_id, error}` | signapps-notifications (alert owner) |
| `reports.dashboard.created` | `{id, name, owner_id}` | signapps-metrics |

### 8.10 Cache invalidation
Les events PgEventBus des modules sources declenchent l'invalidation des caches de rapports :
- `activities.task.*` -> invalide les caches des rapports source `activities` et `tasks`
- `calendar.event.*` -> invalide les caches source `events`
- `drive.file.*` -> invalide les caches source `files`
- `crm.deal.*` -> invalide les caches source `deals`
- `helpdesk.ticket.*` -> invalide les caches source `tickets`
- `forms.response.*` -> invalide les caches source `form_responses`
L'invalidation est selective : seuls les caches des rapports utilisant la source concernee sont effaces.

---

## Categorie 9 -- Permissions et securite

### 9.1 Roles
- `reports:reader` : consulter les rapports partages avec soi, executer des requetes sur les sources auxquelles on a acces
- `reports:creator` : reader + creer, sauvegarder, exporter des rapports, creer des dashboards
- `reports:admin` : creator + acceder a tous les rapports de l'organisation, gerer les templates, configurer les limites

Par defaut, tous les utilisateurs authentifies ont `reports:reader`. Le role `reports:creator` est attribue par l'admin dans signapps-identity.

### 9.2 Row-level security
Les donnees retournees par l'API sont filtrees selon les permissions de l'utilisateur dans le module source :
- Un utilisateur standard voit ses propres taches et celles partagees avec lui
- Un manager voit les taches de son equipe
- Un admin voit toutes les taches
Cette logique est geree par les services sources (pas par le module reports) via les claims JWT et les policies RBAC.

### 9.3 Audit
Chaque action est journalisee : creation de rapport, execution de requete (source + filtres), export (format), partage (destinataire + niveau), programmation d'envoi. Les logs sont accessibles aux admins via `/admin/reports/audit`. Retention : 90 jours.

---

## References OSS

**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License -- ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Apache Superset** (github.com/apache/superset) | **Apache-2.0** | Reference principale. Visual query builder, chart gallery, dashboards, filtres globaux, SQL Lab. Architecture plugin charts. |
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

- Page `/reports` -> le titre `Constructeur de rapports` et le sous-titre sont affiches
- Dropdown Source -> les 9 sources disponibles sont listees avec icones (Activites, Utilisateurs, Fichiers, etc.)
- Selection source `Activites` -> les colonnes disponibles (titre, statut, priorite, assignee, dates) sont proposees dans le panneau source
- Colonnes de jointure -> selectionner `assignee` rend disponible `Departement (assigne)` dans le panneau source
- Source Formulaires -> un sous-dropdown de formulaires apparait, les colonnes dynamiques sont generees
- Bouton `Ajouter` -> le panneau de selection de colonnes s'ouvre avec les champs de la source
- Recherche colonne -> taper "date" filtre les colonnes contenant "date" dans le panneau source
- Ajout de colonne par clic -> un chip apparait dans la zone de construction avec le nom du champ et l'icone de type
- Ajout de colonne par drag -> le chip est place a la position de drop
- Drag-and-drop colonne -> l'ordre des colonnes change dans la zone de construction et dans le tableau
- Suppression colonne -> clic sur la croix du chip retire la colonne
- Configuration colonne -> clic sur un chip ouvre le panneau lateral avec libelle, tri, filtre, aggregation
- Filtre texte -> operateur `contient` avec valeur filtre les resultats cote serveur
- Filtre date -> operateur `ce mois` retourne uniquement les enregistrements du mois courant
- Filtre enum -> operateur `est` avec multi-select filtre par les valeurs selectionnees
- Filtre AND/OR -> construction de groupes de filtres avec preview textuelle correcte
- Bouton `Executer` -> le tableau de resultats s'affiche avec les donnees correspondantes
- Pagination -> navigation entre les pages de resultats, compteur `1-25 sur 1,234` correct
- Tri par clic sur en-tete -> les resultats sont retries et l'indicateur fleche s'affiche
- Multi-tri -> Shift+clic sur un second en-tete ajoute un tri secondaire (chiffres 1/2 visibles)
- Aggregation count sur statut -> le tableau affiche les groupes avec compteurs
- Groupement explicite -> les lignes sont groupees avec sous-totaux, depliables/repliables
- Colonne calculee -> la formule `{temps_passe} / {temps_estime} * 100` est evaluee et affichee
- Mise en forme conditionnelle -> les cellules du statut `blocked` sont en fond rouge
- Ligne de total -> la somme des colonnes numeriques est affichee en pied de tableau
- Recherche dans resultats -> `Ctrl+F` focus la barre, les termes trouves sont surlignees en jaune
- Redimensionnement colonnes -> glisser le bord d'un en-tete change la largeur
- Switch mode Graphique -> le bar chart s'affiche avec les donnees du rapport
- Switch mode Mixte -> le tableau et le graphique sont affiches simultanement
- Raccourcis mode -> `Ctrl+1` = Tableau, `Ctrl+2` = Graphique, `Ctrl+3` = Mixte
- Selection type chart -> changer vers pie chart met a jour la visualisation
- Configuration axes -> changer l'axe X/Y met a jour le graphique
- Legende interactive -> clic sur un element de la legende masque la serie
- Drill-down -> clic sur une barre du chart filtre le tableau
- Export PNG -> l'image du graphique est telechargee en haute resolution
- Fullscreen chart -> le graphique passe en plein ecran
- Heatmap -> la grille de cellules colorees s'affiche avec les valeurs
- Scatter plot -> les points s'affichent avec taille et couleur si configures
- Bouton Sauvegarder -> le dialog s'ouvre avec nom et description, sauvegarde reussie
- `Ctrl+S` -> sauvegarde rapide (toast de confirmation)
- Page `/reports/saved` -> la liste des rapports sauvegardes s'affiche avec colonnes et actions
- Ouvrir un rapport sauvegarde -> la configuration est restauree (source, colonnes, filtres, chart)
- Dupliquer -> une copie est creee avec le nom `[original] (copie)`
- Versioning -> l'historique des versions est accessible, restauration fonctionne
- Partage de rapport -> le destinataire voit le rapport dans `Partages avec moi`
- Template `Charge de travail par equipe` -> ouvre un rapport pre-configure avec les bonnes colonnes et le chart
- Dashboard mode -> ajout de widgets, drag-and-drop pour positionner, resize fonctionne
- Auto-refresh dashboard -> un widget rafraichi affiche la derniere mise a jour
- Export PDF -> un fichier PDF est telecharge avec le tableau et le graphique
- Export Excel -> un fichier XLSX est telecharge avec les donnees, formules SUM, et metadonnees
- Export CSV -> un fichier CSV est telecharge avec les colonnes du rapport et l'encodage correct
- Rapport programme -> la configuration de planification est accessible et sauvegardable
- Envoi programme -> le rapport est envoye par email au format PDF a l'heure configuree
- Utilisateur sans acces Billing -> la source `Deals CRM` n'est pas listee dans le dropdown
- Row-level security -> un utilisateur standard ne voit que ses propres taches
- Max colonnes -> ajout d'une 16e colonne affiche un avertissement
- Source sans resultats -> message `Aucun resultat pour les filtres selectionnes`
- Timeout requete -> message `La requete a pris trop de temps. Ajoutez des filtres.`
- Service indisponible -> message d'erreur gracieux `Donnees non disponibles`
