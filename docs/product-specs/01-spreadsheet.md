# Module Tableur (Spreadsheet) — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Google Sheets** | Collab temps réel sans friction, Smart Fill (détection de pattern AI), Explore panel (insights auto), smart chips (personne, fichier, date, lieu), named functions, Connected Sheets (BigQuery), 400+ fonctions, importrange cross-sheet |
| **Microsoft Excel** | LAMBDA/LET/MAP/REDUCE/SCAN, Power Query (M language pour ETL), Power Pivot, Copilot, pivot tables avec slicers, data validation avancée (dropdowns en cascade, regex), 470+ fonctions, graphiques combinés, sparklines inline |
| **Airtable** | Database-first (rich field types : attachment, barcode, rating, duration, formula, rollup, lookup, link to record, single/multi-select, user, created time), vues multiples (grid/gallery/kanban/calendar/gantt/timeline/form), automations, interfaces, Sync (agrège plusieurs bases), AI field |
| **Notion databases** | Blocks embed sheet dans doc, formulas 2.0, relations/rollups, synced views, templates par base, page as row, views inline |
| **Coda** | Doc+sheet+app hybride, Coda packs (intégrations), boutons exécutables, sub-tables, Coda AI pour générer des tables |
| **Rowzero** | Performance milliards de lignes, intégration Python first-class, connexion DB directe |
| **Grist** | Open source, Python inline formulas, access control par ligne/colonne, rules conditionnelles, trigger formulas |
| **Smartsheet** | Gantt et timeline first, dépendances de tâches, critical path, proof workflows |

## Principes directeurs

1. **Excel-familier par défaut** — tout utilisateur venant d'Excel ou de Sheets doit retrouver ses raccourcis, sa poignée de recopie, son menu contextuel et ses formules standards sans apprentissage.
2. **Database-native en option** — un tableur peut être promu en base de données (rich fields, vues multiples, relations) sans migration de données.
3. **AI-assistée, jamais imposée** — le Smart Fill, les formules générées et les insights sont des suggestions, toujours rejetables.
4. **Collaboration atomique** — chaque frappe est propagée en <200ms aux collaborateurs, les curseurs et sélections visibles, aucun "lock" ni "conflict dialog".
5. **Offline résilient** — l'éditeur fonctionne en mode déconnecté complet avec réconciliation Yjs au retour en ligne.
6. **Performant sur gros volumes** — 100k lignes × 50 colonnes doivent scroller à 60fps, 1M lignes doivent être navigables avec virtualisation + chunking.

---

## Catégorie 1 — Manipulations de grille et sélection

### 1.1 Sélection simple et plage rectangulaire
Cliquer sur une cellule pour la rendre active. Cliquer+glisser pour sélectionner une plage `A1:C5` avec bordure bleue épaisse et fond translucide. Shift+clic sur une autre cellule étend la plage depuis l'ancre. Ctrl+clic sur une deuxième cellule crée une sélection disjointe (multiple rectangles).

### 1.2 Sélection de lignes/colonnes entières
Clic sur l'en-tête de colonne (`A`) sélectionne toute la colonne (`A1:A∞`). Clic sur l'en-tête de ligne (`3`) sélectionne toute la ligne. Shift+clic sur un autre en-tête étend la sélection (ex: A à D). Le coin haut-gauche (`sheet-select-all`) sélectionne tout le tableau.

### 1.3 Poignée de recopie (Autofill) avec détection de pattern
Sélectionner une ou plusieurs cellules, attraper le petit carré bleu en bas à droite, glisser vers le bas ou la droite. L'engine détecte :
- **Nombre unique** → incrément +1 (ex: 5 → 5,6,7,8,9)
- **Suite linéaire** → conserve le step (ex: 2,4 → 6,8,10)
- **Dates** → +1 jour (ex: 01/01 → 02/01, 03/01)
- **Jours de la semaine** → cycle (lundi,mardi → mercredi,jeudi)
- **Mois** → cycle (janvier → février, mars)
- **Formules relatives** → décale les références (=A1*2 → =A2*2)
- **Formules absolues** → préserve les `$` ($A$1 ne bouge pas)
- **Pattern texte** (Ex1, Ex2 → Ex3, Ex4) via regex simple

### 1.4 Smart Fill (Google Sheets style, AI)
Après avoir tapé 2-3 lignes d'un motif dans une colonne dérivée (ex: extraction d'email depuis un nom complet), une suggestion flottante `Ctrl+Entrée pour accepter` apparaît avec la prédiction sur le reste de la colonne. Refus = Escape. Basé sur le pattern détecté (regex, substring, concat) ou un LLM local.

### 1.5 Navigation clavier complète
- Flèches : bouge d'une cellule
- Ctrl+Flèches : saute au bord de la région (bloc de cellules remplies)
- Shift+Flèches : étend la sélection
- Ctrl+Shift+Flèches : étend jusqu'au bord
- Home/End : début/fin de ligne
- Ctrl+Home : cellule A1
- Ctrl+End : dernière cellule avec données
- PageUp/PageDown : une page verticale
- Tab : cellule suivante (droite)
- Enter : cellule suivante (bas)
- Shift+Tab : gauche
- Shift+Enter : haut
- F2 : entrer en édition
- Escape : annuler l'édition
- Delete : vider les cellules sélectionnées (garde le style)
- Ctrl+Delete : vider le contenu ET le style

### 1.6 Figer les volets (freeze panes)
Menu `Affichage > Figer` propose : `1ère ligne`, `1ère colonne`, `X lignes`, `X colonnes`, `Jusqu'à la sélection`. Les lignes/colonnes figées restent visibles au scroll avec une bordure bleue de démarcation. Désactivation via `Affichage > Libérer`.

### 1.7 Masquage de lignes/colonnes
Clic droit sur un en-tête → `Masquer la colonne`. La colonne disparaît, remplacée par deux flèches entre les voisines. Clic sur les flèches ou sélection + clic droit → `Afficher` les restaure.

### 1.8 Groupement de lignes/colonnes (outline)
Sélectionner plusieurs lignes → `Données > Grouper` crée un niveau d'indentation avec bouton `+/-` à gauche pour plier/déplier. Plusieurs niveaux imbriqués supportés. Utilisé pour les budgets avec totaux par catégorie.

### 1.9 Redimensionnement colonnes/lignes
Glisser la bordure entre deux en-têtes modifie la largeur/hauteur. Double-clic sur la bordure fait un `auto-fit` sur le contenu le plus large. Sélectionner plusieurs colonnes et glisser applique la même largeur à toutes.

### 1.10 Sélection de cellules non-adjacentes
Ctrl+clic (Cmd+clic sur Mac) ajoute une cellule ou une plage à la sélection existante. Utile pour formater plusieurs blocs en même temps ou copier des cellules disjointes vers une seule plage de destination.

---

## Catégorie 2 — Formules et calcul

### 2.1 Barre de formule active
Zone en haut qui affiche la référence de la cellule active (`B3`) et sa formule ou valeur. Clic dans la barre place le focus dedans et active le mode édition de la cellule. La saisie dans la barre ou dans la cellule elle-même sont synchronisées en temps réel.

### 2.2 Autocomplétion des fonctions
Taper `=SU` affiche un dropdown avec `SUM`, `SUMIF`, `SUMIFS`, `SUMPRODUCT`, chacune avec sa signature et une mini-description. `Tab` insère la fonction avec un template d'arguments (`SUM(plage)`) et curseur positionné sur le premier. `↑/↓` pour naviguer, `Entrée` pour choisir, `Escape` pour fermer.

### 2.3 Aide inline des arguments
Pendant qu'on tape dans `SUMIF(`, une bulle flottante montre la signature `SUMIF(plage, critère, [plage_somme])` avec l'argument en cours en gras. Clic sur un nom d'argument ouvre une doc contextuelle.

### 2.4 Références absolues et relatives avec F4
Appuyer sur F4 pendant l'édition d'une référence cellule cycle entre les 4 modes : `A1` (relatif) → `$A$1` (absolu) → `A$1` (colonne libre, ligne fixe) → `$A1` (colonne fixe, ligne libre) → `A1`. Respect par l'autofill.

### 2.5 Références cross-sheet et cross-workbook
`=Sheet2!A1` référence une cellule d'une autre feuille du même classeur. `=IMPORTRANGE("URL_OR_ID", "Sheet1!A1:B10")` importe depuis un autre classeur partagé. Permissions validées en amont, erreur `#REF!` si refus.

### 2.6 Plages nommées (named ranges)
`Données > Plages nommées` ouvre un panneau listant les noms existants (`TaxRate`, `BudgetTotal`). Crée une plage nommée en saisissant nom + référence. Utilisation : `=PRIX*TaxRate` au lieu de `=PRIX*Sheet1!$B$5`. Suggestions d'autocomplétion dans les formules.

### 2.7 Named functions (Sheets) / LAMBDA (Excel)
Définir `=LAMBDA(x, y, (x+y)*TVA)` comme fonction nommée `TOTAL_TTC`, puis `=TOTAL_TTC(A1, B1)` partout dans le classeur. Paramètres typés (number, text, range, any). Partage au niveau du classeur ou du domaine organisation.

### 2.8 Fonctions dynamic array (Excel 365 / Sheets)
`=FILTER(A1:C100, A1:A100>1000)` retourne un tableau dynamique qui spill vers les cellules adjacentes. Pareil pour `SORT`, `UNIQUE`, `SEQUENCE`, `ARRAYFORMULA`. Marque les cellules spillées avec une bordure bleue, erreur `#SPILL!` si collision.

### 2.9 Gestion exhaustive des erreurs
Codes d'erreur affichés en rouge : `#DIV/0!`, `#REF!`, `#NAME?`, `#VALUE!`, `#N/A`, `#CYCLE!`, `#NULL!`, `#NUM!`, `#SPILL!`, `#CALC!`. Tooltip explique la cause. `IFERROR(formula, fallback)` et `IFNA` pour masquer proprement.

### 2.10 Calcul itératif et références circulaires contrôlées
`Fichier > Paramètres du classeur > Calcul` active le calcul itératif avec limite d'itérations et seuil de convergence. Permet les modèles de type "taux de commission qui dépend du total qui dépend de la commission".

### 2.11 Fonctions par catégorie (400+)
**Math** : SUM, AVERAGE, COUNT, MIN, MAX, PRODUCT, POWER, SQRT, ROUND, CEILING, FLOOR, ABS, MOD, PI, RAND, RANDBETWEEN, GCD, LCM
**Statistique** : STDEV, VAR, MEDIAN, MODE, PERCENTILE, QUARTILE, RANK, CORREL, FORECAST, TREND, GROWTH
**Logique** : IF, IFS, SWITCH, AND, OR, NOT, XOR, IFERROR, IFNA, TRUE, FALSE
**Texte** : CONCAT, TEXTJOIN, LEFT, RIGHT, MID, LEN, UPPER, LOWER, PROPER, TRIM, SUBSTITUTE, REPLACE, FIND, SEARCH, REGEXEXTRACT, REGEXMATCH, SPLIT
**Date/Heure** : TODAY, NOW, DATE, DATEDIF, EDATE, EOMONTH, NETWORKDAYS, WORKDAY, YEAR, MONTH, DAY, HOUR, MINUTE, WEEKDAY, WEEKNUM
**Financier** : PMT, IPMT, PPMT, PV, FV, NPV, IRR, XIRR, XNPV, RATE
**Recherche** : VLOOKUP, HLOOKUP, XLOOKUP, INDEX, MATCH, OFFSET, INDIRECT, CHOOSE, LOOKUP
**Tableau dynamique** : FILTER, SORT, SORTBY, UNIQUE, SEQUENCE, RANDARRAY
**Ingénierie** : BIN2DEC, HEX2DEC, CONVERT, BITAND, BITOR
**Web** : IMPORTHTML, IMPORTXML, IMPORTDATA, IMPORTFEED, IMPORTRANGE

### 2.12 Recalcul sur dépendance changée
Modifier `A1` déclenche le recalcul instantané de toutes les cellules qui en dépendent (graphe de dépendances topologique). Les graphiques liés se re-rendent. Indicateur "Calcul en cours..." dans le status bar pour les gros modèles.

---

## Catégorie 3 — Formats, styles et structure

### 3.1 Formatage de texte
Gras, italique, souligné, barré, taille (8-72), police (liste Google Fonts + système), couleur texte, couleur fond, alignement horizontal (gauche/centre/droite/justifié), alignement vertical (haut/milieu/bas), retour automatique à la ligne, rotation (0-90°), indentation, bordures (haut/bas/gauche/droite/contour/interne/diagonale) avec couleur et épaisseur.

### 3.2 Formats de nombre (numberFormat)
Auto, Nombre (décimales configurables), Monnaie (devise choisie avec position du symbole), Comptabilité (monnaie alignée à gauche du chiffre), Pourcentage, Scientifique, Fraction, Date (formats courts/longs/ISO), Heure, Date+Heure, Durée, Texte (force la conservation du texte brut). Format personnalisé avec codes `#,##0.00` `[Red]-#,##0`.

### 3.3 Fusion de cellules
Sélectionner une plage → `Format > Fusionner` avec trois modes : `Tout fusionner` (une seule cellule avec la valeur haut-gauche), `Fusionner horizontalement` (fusion ligne par ligne), `Fusionner verticalement` (fusion colonne par colonne). Défusionner retourne les cellules individuelles avec valeur préservée dans la haut-gauche, vides ailleurs.

### 3.4 Formatage conditionnel (règles)
`Format > Formatage conditionnel` ouvre un panneau pour créer des règles :
- **Cellule contient/ne contient pas/commence par/finit par/est égale à** (texte)
- **Entre/est supérieur/inférieur/égal** (nombre, date)
- **Vide/non vide**
- **Formule personnalisée** (`=$B1>1000`)
- **Échelle de couleur** (dégradé min-milieu-max)
- **Barres de données** (remplissage proportionnel)
- **Set d'icônes** (flèches, feux tricolores, ratings)
Ordre de priorité des règles, préview temps réel, arrêt si vrai.

### 3.5 Mise en forme automatique pour les données
Détection automatique du type saisi : `42%` → format pourcentage, `15/03/2026` → format date, `€ 1 500,00` → format devise, `=SUM(...)` → formule, `https://...` → lien cliquable. Override possible en passant par `Format > Plus de formats`.

### 3.6 Styles nommés et thèmes
Bibliothèque de styles pré-définis (`Titre`, `Sous-titre`, `Total`, `Entête`, `Négatif`). Appliquer un thème de classeur (`Moderne`, `Classique`, `Monochrome`) qui remplace les couleurs de fond, de texte et de police par défaut. Création de styles custom réutilisables.

### 3.7 Reproduction de mise en forme (format painter)
Bouton pinceau dans la toolbar. Clic sur le bouton après avoir sélectionné une cellule source, puis clic sur la cellule/plage cible pour appliquer tous les styles (polices, couleurs, bordures, format numérique). Double-clic sur le pinceau active le mode verrouillé pour coller sur plusieurs zones successivement (Escape désactive).

### 3.8 Validation de données
`Données > Validation` sur une plage :
- **Liste déroulante** (valeurs manuelles ou plage)
- **Liste dépendante** (ex: pays → villes)
- **Nombre** (entre, supérieur, inférieur, égal)
- **Date** (avant, après, entre)
- **Texte** (contient, commence par, regex, longueur)
- **Checkbox** (valeur booléenne avec rendu case à cocher)
Message d'aide au survol, message d'erreur en cas de saisie invalide, rejet strict ou avertissement souple.

### 3.9 Filtres et tris
**Tri** : `Données > Trier par colonne A (A-Z)`, tri multi-colonnes avec priorités, options `ne pas trier les entêtes`. **Filtre** : bouton filtre sur une plage → chevrons dans chaque entête, panneau de filtre par colonne (valeurs uniques à cocher, recherche, condition textuelle/numérique/date). Vues filtrées nommées qui peuvent être sauvegardées et partagées sans affecter les autres utilisateurs.

### 3.10 Bandes de lignes / Colonnes (zebra rows)
`Format > Bandes alternées` applique automatiquement deux couleurs de fond alternant ligne par ligne avec entête et pied distincts. Thèmes pré-définis (Bleu, Vert, Rouge, Gris, Noir). Se recalcule automatiquement lors du tri/filtre.

---

## Catégorie 4 — Feuilles, onglets et structure du classeur

### 4.1 Onglets de feuilles en bas
Barre horizontale en bas de l'écran avec tous les onglets. Onglet actif en fond clair, inactifs gris. Bouton `+` à gauche pour ajouter une feuille. Clic pour activer, double-clic pour renommer, clic droit pour menu contextuel.

### 4.2 Menu contextuel sur onglet
- **Renommer**
- **Dupliquer** (copie tout le contenu et la mise en forme)
- **Copier vers** (autre classeur)
- **Déplacer** (ordonner la position)
- **Changer de couleur** (onglet avec liseré)
- **Protéger** (lock l'édition)
- **Masquer** (invisible pour les consommateurs)
- **Afficher** (menu avec les feuilles cachées)
- **Supprimer** (avec confirmation)
- **Voir les commentaires sur cette feuille**
- **Exporter cette feuille uniquement**

### 4.3 Réorganisation par drag
Glisser un onglet horizontalement pour changer l'ordre. Feedback visuel : ombre, indicateur bleu entre les onglets, animation de réarrangement.

### 4.4 Feuilles protégées avec granularité
Protéger une feuille en entier ou une plage spécifique. Définir qui peut éditer (moi uniquement, liste de personnes, personne). Message d'erreur personnalisable quand un utilisateur non autorisé tente de modifier. Exception de cellules déverrouillées dans une feuille protégée.

### 4.5 Feuilles liées (cross-sheet references)
Une formule `=Sheet2!A1` est un lien dynamique, `Sheet2!A1:B10` une plage. Modifier la source met à jour la destination. Renommer la feuille source met à jour toutes les références. Supprimer la source → `#REF!`.

### 4.6 Version history (historique des versions)
`Fichier > Historique des versions > Voir l'historique des versions` ouvre un panneau latéral avec la chronologie des modifications (groupées par auteur et période). Clic sur une version affiche le diff en highlight. Boutons `Restaurer cette version` et `Nommer cette version` (pour créer des jalons).

### 4.7 Snapshots nommés
Bouton `Nommer la version courante` pour figer un état important (`Fin Q1 2026`, `Version envoyée au CEO`). Les snapshots nommés apparaissent distinctement dans l'historique, jamais auto-supprimés.

### 4.8 Import / Export
**Import** : drag-and-drop d'un fichier `.xlsx/.xls/.ods/.csv/.tsv/.json` sur la grille ou menu `Fichier > Importer`. Options : remplacer le classeur, ajouter une nouvelle feuille, insérer à la cellule active. Préview avec détection auto des entêtes et du séparateur.
**Export** : `Fichier > Télécharger` propose XLSX, ODS, CSV (feuille active), TSV, PDF (mise en page configurable), HTML, JSON.

---

## Catégorie 5 — Collaboration temps réel

### 5.1 Curseurs collaborateurs visibles
Chaque utilisateur connecté apparaît avec son avatar en haut à droite. Son curseur (bordure colorée) est visible sur la cellule qu'il édite, avec son nom en étiquette flottante. Les sélections des autres utilisateurs sont affichées avec une teinte de leur couleur personnelle.

### 5.2 Édition concurrente sans conflit
Deux utilisateurs peuvent taper dans des cellules différentes simultanément, leurs changements se propagent en <200ms. Si deux utilisateurs tapent dans la même cellule au même moment, le dernier commit gagne mais un toast notifie l'autre du conflit avec option d'annuler.

### 5.3 Commentaires ancrés aux cellules
Clic droit → `Insérer un commentaire`. Bulle jaune dans le coin supérieur droit de la cellule. Menu de commentaire avec : texte markdown, @mention d'un utilisateur (qui reçoit une notif), réponses en thread, marquer comme résolu (archive), émojis. Un panneau latéral `Tous les commentaires` liste les threads avec filtres (ouverts, résolus, par auteur, par feuille).

### 5.4 Suggestions d'édition (track changes)
Mode `Suggérer` (vs `Édition`) : chaque modification devient une suggestion en surbrillance avec l'auteur et la raison. Propriétaire peut `Accepter` ou `Rejeter` individuellement ou en bulk. Historique complet des suggestions dans le panneau dédié.

### 5.5 Verrouillage et permissions granulaires
Partage avec rôles : `Propriétaire`, `Éditeur`, `Commentateur`, `Lecteur`. Sur une feuille protégée : `peut-tout-éditer` vs `peut-éditer-certaines-plages`. Définir des plages déverrouillées dans une feuille par ailleurs verrouillée. Transfert de propriété avec confirmation email.

### 5.6 Activité récente
Panneau `Activité` dans la barre latérale droite avec liste chronologique : qui a ouvert, édité, commenté, partagé le classeur, avec horodatage. Permet de retracer "qui a changé quoi quand".

### 5.7 Chat intégré
Bouton chat dans la barre du haut ouvre un mini-chat side-panel lié au classeur. Messages éphémères ou persistants. @mention d'un collaborateur. Indicateur "X est en train d'écrire...". Utile pour les revues collaboratives.

### 5.8 Partage par lien avec restrictions
Générer un lien public (lecteur), public (commentateur), public (éditeur), ou privé (emails listés). Options : expiration date, password, watermark "brouillon", interdiction d'export/imprimer/copier.

### 5.9 Apercu en direct depuis d'autres apps
Un lien `signapps.com/sheets/XYZ` inséré dans Docs/Mail/Chat affiche un smart chip avec titre, auteur, dernier modifié. Clic = navigation. Survol = mini-preview du classeur dans une popup.

### 5.10 Mode présentateur (follow the host)
Un utilisateur active `Suivre la vue de [nom]`. Son viewport (cellule active, scroll, feuille active) suit automatiquement celui du host. Utile pour les réunions où on projette un classeur et où les participants suivent depuis leur écran.

---

## Catégorie 6 — Graphiques et visualisations

### 6.1 Insertion de graphique
`Insertion > Graphique` ou bouton toolbar. Sélection préalable d'une plage → le graphique est pré-rempli avec ces données. Dialog de configuration avec types : Colonnes, Barres, Lignes, Aires, Combinés, Circulaires, Anneaux, Radar, Dispersion (scatter), Bulles, Cascade, Hiérarchiques (sunburst, treemap), Entonnoir, Jauges, Cartes géographiques, Histogramme, Diagramme en boîte (boxplot), Sparklines inline.

### 6.2 Plage de données dynamique
La plage liée au graphique utilise les références de la feuille. Ajouter une ligne ou modifier des valeurs met à jour le graphique automatiquement. Possibilité d'étendre automatiquement la plage (`A2:A` = toute la colonne A à partir de la ligne 2).

### 6.3 Personnalisation complète
Panneau latéral droit avec onglets `Configuration` et `Personnalisation`. Configuration : type, plage, axes, titres, légende. Personnalisation : titre et couleur, axes (min/max, format, grille), séries (couleur, épaisseur, marqueurs), légende (position, police), grille majeur/mineur, annotations. Preview temps réel.

### 6.4 Graphiques combinés
Superposition de plusieurs types sur un même graphique (ex: colonnes de chiffre d'affaires + ligne de marge). Deux axes Y (gauche et droit) avec échelles différentes. Utile pour les dashboards financiers.

### 6.5 Sparklines inline (Excel-style)
`=SPARKLINE(A1:A12)` dans une cellule affiche un mini-graphique (ligne, colonnes ou win/loss) dans cette cellule. Options de couleur, min/max forcés, couleur de la valeur négative, marqueur de la valeur maximum/minimum.

### 6.6 Tableaux croisés dynamiques (Pivot Tables)
`Insertion > Tableau croisé dynamique` ouvre une feuille dédiée. Glisser-déposer des colonnes dans : `Lignes`, `Colonnes`, `Valeurs` (avec agrégation : somme, moyenne, count, min, max, médiane, variance, écart-type), `Filtres`. Calcul automatique, tri et filtre intégrés, rafraîchissement quand la source change.

### 6.7 Slicers (filtres visuels)
Boutons de filtre graphiques (un slicer = un filtre sur une colonne) affichés comme un panneau de boutons. Clic pour filtrer le pivot ou le tableau filtré. Multi-sélection avec Ctrl+clic. Utilisé pour les dashboards interactifs.

### 6.8 Graphiques dans la cellule (in-cell charts)
Au-delà des sparklines : barres horizontales dans une cellule via `=REPT("█", A1/10)` ou via un format conditionnel `Barre de données`. Utilisé pour les heatmaps et les tableaux de bord compacts.

### 6.9 Cartes et visualisations géographiques
Colonne avec codes pays ou coordonnées → `Insertion > Carte`. Rendu Mapbox ou OSM avec échelle de couleur par valeur. Bubble sizing. Zoom et pan.

### 6.10 Explore panel (AI insights)
Bouton `Explorer` en bas à droite ouvre un panneau avec :
- **Résumé statistique** de la sélection (sum, avg, count, min, max)
- **Suggestions de graphiques** générées automatiquement en fonction de la structure des données
- **Questions en langage naturel** : "Quel est le total par mois ?" → génère une formule ou un graphique
- **Insights proactifs** : "Les ventes de février ont baissé de 15% par rapport à janvier"

---

## Catégorie 7 — Import de données, API et intégrations

### 7.1 Import CSV/TSV avec détection automatique
Drag-drop d'un fichier `.csv` → dialogue avec détection du séparateur (`,` `;` `\t` `|`), encoding (UTF-8, ISO-8859-1, Windows-1252), présence d'entêtes, format des dates. Aperçu des 10 premières lignes. Boutons `Remplacer la feuille`, `Nouvelle feuille`, `Insérer à la cellule active`.

### 7.2 Import Excel avec multi-feuilles
Fichier `.xlsx` importé → dialogue listant toutes les feuilles avec une case à cocher pour chacune. Import des formules, styles, bordures, formats numériques, fusion de cellules, graphiques (converti en image si type non supporté), images, graphiques pivot, commentaires, freeze panes.

### 7.3 Connected Sheets (BigQuery, PostgreSQL, MySQL)
`Données > Connecteurs > BigQuery/PostgreSQL/MySQL/Snowflake`. Éditeur SQL avec autocomplétion sur les tables et colonnes. Résultat rendu comme une feuille virtuelle qui se rafraîchit périodiquement (ou sur demande). Possible de formuler sur ce résultat comme sur une feuille normale. Support des paramètres (ex: `:start_date` lié à une cellule).

### 7.4 Formule IMPORTRANGE cross-workbook
`=IMPORTRANGE("URL", "Feuille1!A1:B10")` importe une plage d'un autre classeur. Premier import demande une autorisation (validation du propriétaire). Rafraîchissement automatique périodique.

### 7.5 Scraping web (IMPORTHTML, IMPORTXML)
`=IMPORTHTML("https://...", "table", 2)` extrait la 2e table HTML d'une page. `=IMPORTXML(url, xpath)` pour XPath arbitraire. `=IMPORTDATA(url)` pour CSV/TSV publics. `=IMPORTFEED(rss_url)` pour les flux RSS. Limite de fréquence pour éviter le scraping abusif.

### 7.6 API REST en source
`Données > Sources externes > REST API`. Configurer URL, headers (auth), méthode (GET/POST), body, mapping JSON path → colonnes. Rafraîchissement programmé (toutes les X minutes/heures). Clé API stockée chiffrée dans le vault.

### 7.7 Webhook d'arrivée de données
Générer une URL webhook qui, quand elle reçoit un POST JSON, ajoute une nouvelle ligne à la fin de la feuille. Utile pour les formulaires externes, les logs d'application, les alertes monitoring.

### 7.8 Apps Script / scripting inline
Éditeur de code JavaScript (type Google Apps Script) ou TypeScript pour écrire des fonctions personnalisées, des triggers (onEdit, onOpen, onChange, time-based), ou des menus custom. Accès à l'API SpreadsheetApp (getRange, setValue, getFormula, etc.) et à l'API UI (créer des dialogs, des toasts). Sandbox V8 avec timeouts.

### 7.9 Macros enregistrées
Bouton `Enregistrer une macro` dans la toolbar. Toutes les actions (clic, saisie, formatage) sont enregistrées comme code Apps Script. Rejouable avec un raccourci clavier ou un bouton personnalisé. Édition du code pour ajustements.

### 7.10 Export vers BI (Looker, PowerBI, Tableau)
`Fichier > Exporter vers Looker Studio` push le classeur comme source de données dans Looker (ou PowerBI, Tableau). Rafraîchissement en direct. Schéma des colonnes mappé automatiquement.

---

## Catégorie 8 — Vues multiples et bases de données (Airtable-style)

### 8.1 Types de champs riches
Au-delà du texte/nombre/date, types spéciaux par colonne :
- **Attachement** (fichier ou image dans la cellule)
- **Single-select** (liste fermée avec couleurs)
- **Multi-select** (plusieurs tags colorés)
- **Utilisateur** (avatar + nom, lié à l'annuaire)
- **Évaluation** (étoiles)
- **Durée** (hh:mm:ss)
- **Devise** (avec symbole)
- **Téléphone** (format international, clic pour appeler)
- **Email** (clic pour envoyer un mail)
- **URL** (rendu comme lien)
- **Code-barre** (scanner mobile)
- **Checkbox** (booléen)
- **Créé le / Modifié le** (auto)
- **Créé par / Modifié par** (auto)
- **Auto-numéro** (séquentiel)
- **Lien vers un autre classeur** (relation)
- **Lookup** (va chercher la valeur d'un champ dans la table liée)
- **Rollup** (agrège les valeurs d'un champ lié : SUM, AVG, COUNT)
- **Formule** (formule sur les autres champs de la ligne)

### 8.2 Vue en grille (par défaut)
Le rendu classique spreadsheet. Entête fixe, lignes scrollables, en-têtes figées.

### 8.3 Vue Kanban
Groupement par une colonne de type `single-select`. Chaque valeur devient une colonne de cartes. Chaque ligne devient une carte qu'on peut glisser d'une colonne à l'autre (change la valeur du champ). Utile pour suivre un pipeline.

### 8.4 Vue Calendrier
Utilise une colonne de type date pour placer les lignes sur un calendrier mensuel/hebdomadaire. Clic sur une date crée une nouvelle ligne. Drag sur une date déplace la ligne.

### 8.5 Vue Galerie
Chaque ligne devient une carte visuelle avec une image en tête (depuis un champ attachement) et les champs sélectionnés en dessous. Configurable : quels champs montrer, taille de la carte, ordre.

### 8.6 Vue Gantt / Timeline
Nécessite deux colonnes date (début, fin). Chaque ligne devient une barre sur un axe temporel. Drag des bords pour resize, drag du milieu pour déplacer. Lignes hiérarchiques avec parent/enfant (sub-tasks). Dépendances : flèches reliant deux barres.

### 8.7 Vue Form
Génère automatiquement un formulaire Web à partir des colonnes de la table (labels = noms des colonnes, types de champs selon le type de colonne). Partageable par URL, réponses ajoutées comme nouvelles lignes. Thèmes, logique conditionnelle (masquer un champ si une condition sur un autre), champs requis, redirection après soumission.

### 8.8 Filtres et tris par vue
Chaque vue a ses propres filtres et tris sans affecter les autres. Ex: une vue `Mes tâches` filtre `Assigné = Moi`, une vue `En retard` filtre `Statut != Fait AND Deadline < Aujourd'hui`.

### 8.9 Relations entre tables
Lier une colonne à une autre table. Ex: table `Tâches` avec colonne `Projet` liée à la table `Projets`. Clic sur une cellule ouvre un picker montrant les lignes disponibles dans `Projets`. Changement dans la table liée se propage.

### 8.10 Lookup et Rollup
**Lookup** : dans `Tâches`, afficher le `Client` du projet lié (pas besoin de le dupliquer). **Rollup** : dans `Projets`, afficher `SUM(Tâches.estimation_heures)` pour avoir le total du projet. Recalcul automatique quand une tâche est ajoutée/modifiée.

---

## Catégorie 9 — IA intégrée

### 9.1 Formule depuis langage naturel
Barre de formule ou panneau AI dédié : taper `"somme des ventes de janvier où la région est Nord"` → le LLM génère `=SUMIFS(D:D, B:B, "Nord", MONTH(A:A), 1)`. Preview avec explication + bouton `Insérer`.

### 9.2 Explication de formule
Sélectionner une formule complexe → bouton `Expliquer` → description en français : "Cette formule calcule la somme des valeurs en D pour les lignes où B = 'Nord' et le mois de la colonne A est 1 (janvier)".

### 9.3 Nettoyage de données (data cleanup)
Panneau `Nettoyer les données` détecte automatiquement : duplicates, espaces en trop, formats de date incohérents, casse mixte, cellules vides, erreurs de formule. Propose des actions one-click pour corriger.

### 9.4 Dédoublonnage intelligent
`Données > Supprimer les doublons` avec détection fuzzy : `Jean DUPONT` et `jean dupont` sont considérés comme identiques, options pour ignorer les espaces, la casse, les accents, les caractères spéciaux.

### 9.5 Catégorisation automatique
Sélectionner une colonne de texte libre, choisir `Catégoriser avec IA` → le LLM classe chaque ligne dans une catégorie (fournie ou détectée). Ex: descriptions produit → catégories `Électronique/Textile/Alimentation`. Ajoute une nouvelle colonne avec les catégories.

### 9.6 Sentiment analysis
Colonne de commentaires client → `Analyser le sentiment` → ajoute une colonne `Positif/Neutre/Négatif` avec score de confiance. Utile pour les dashboards de satisfaction.

### 9.7 Traduction automatique
`=GOOGLETRANSLATE(A1, "en", "fr")` ou menu `Traduire la sélection vers...`. Langue source détectée automatiquement si `"auto"`.

### 9.8 Résumé d'un onglet
Bouton `Résumer cette feuille` → génère un paragraphe décrivant les données : "Cette feuille contient 342 lignes de ventes entre janvier et mars 2026, avec un total de 1.2M€, dominé par la région Nord (45%)..."

### 9.9 Génération de données de test
Bouton `Générer des données d'exemple` avec prompt : "100 clients fictifs avec nom, email, pays, date d'inscription, total dépensé". Remplit la feuille instantanément pour le prototyping.

### 9.10 Suggestions de graphiques contextuelles
Sélectionner une plage → une suggestion apparaît en bas : "Cette plage ressemble à des ventes mensuelles — visualiser comme graphique en lignes ?". Accepter en un clic.

---

## Catégorie 10 — Performance, accessibilité, mobile

### 10.1 Virtualisation de grille
Seules les cellules visibles sont rendues dans le DOM (~200 lignes × 30 colonnes pour un viewport standard). Scroll fluide à 60fps sur classeurs de 100k lignes × 50 colonnes.

### 10.2 Lazy loading des feuilles
Seule la feuille active est chargée en mémoire. Les autres sont paginées depuis Yjs/backend à la demande (clic sur l'onglet).

### 10.3 Calcul incrémental
Modifier une cellule ne recalcule que les cellules qui en dépendent (pas tout le classeur). Graphe de dépendances maintenu incrémentalement. Invalidation partielle sur changement structurel (insertion de ligne/colonne).

### 10.4 Worker thread pour formules lourdes
Les fonctions coûteuses (VLOOKUP sur grandes plages, FILTER, IMPORT*) s'exécutent dans un Web Worker pour ne pas bloquer le UI. Indicateur `Calcul en cours...` avec % d'avancement.

### 10.5 Accessibilité WCAG AA
Navigation complète au clavier (Tab, flèches, raccourcis). Lecteur d'écran annonce la cellule active et son contenu. Contrastes AA sur toutes les couleurs. Sélection claire et visible (pas juste du fond bleu pâle). Labels ARIA sur tous les boutons et menus.

### 10.6 Mode haute visibilité
Toggle `Affichage > Mode haute visibilité` : polices plus grandes, contrastes augmentés, curseurs épaissis, zones de clic élargies. Utile pour la projection en réunion et l'accessibilité visuelle.

### 10.7 Mobile responsive
Version mobile du tableur avec UI repensée : toolbar compacte avec menus roll-up, clavier numérique pour la saisie de chiffres, gestures tactiles (pinch-zoom, swipe pour changer de feuille, long-press pour menu contextuel). Édition de formule avec helpers visuels (boutons + - * /).

### 10.8 Mode hors-ligne complet
Ouvrir un classeur en cache local et éditer sans connexion. Les changements sont enfilés dans une queue et propagés au serveur au retour en ligne. Réconciliation Yjs CRDT sans perte ni conflit.

### 10.9 Chunking sur très grands datasets
Classeurs de millions de lignes paginés par chunks de 10k. Navigation par ancres (`Aller à la ligne...`). Recherche indexée côté serveur.

### 10.10 Export des graphiques en image / SVG
Clic droit sur un graphique → `Télécharger en PNG/SVG/PDF`. Dimensions et DPI configurables. Utile pour les rapports et présentations.

---

## Catégorie 11 — Sécurité et gouvernance

### 11.1 Classification du document
`Fichier > Classification` : `Public`, `Interne`, `Confidentiel`, `Secret`. Bandeau coloré en haut de la fenêtre. Règles d'export/partage selon la classification (ex: `Secret` ne peut pas être partagé externalement).

### 11.2 Watermark sur l'affichage et l'export
Watermark automatique avec nom de l'utilisateur + horodatage sur les documents classifiés (visible à l'écran et sur les PDFs exportés). Dissuade les captures d'écran non-autorisées.

### 11.3 DLP (Data Loss Prevention)
Détection automatique de données sensibles : numéros de carte bancaire, IBAN, numéros de sécurité sociale, secrets API, emails clients. Avertissement au partage externe avec ces données. Masquage automatique optionnel.

### 11.4 Audit logs complet
`Fichier > Audit` : log immuable de qui a ouvert, édité, partagé, exporté, imprimé, commenté, restauré le document. Exportable pour conformité (RGPD, SOC2, ISO 27001).

### 11.5 Chiffrement côté client (E2E)
Pour les classeurs marqués `Secret`, option de chiffrement côté client (clé détenue par l'utilisateur, pas le serveur). Le backend ne voit que des données chiffrées. Perte de clé = perte du document.

### 11.6 Révocation d'accès à distance
Si un utilisateur quitte l'organisation ou un appareil est volé, l'admin peut révoquer l'accès au document. La prochaine ouverture échoue avec un message d'erreur. Les copies locales sont supprimées au prochain sync.

### 11.7 Export contrôlé
Bouton `Télécharger` peut être désactivé par rôle ou par classification. L'utilisateur peut voir et éditer mais pas exporter. Captures d'écran tracées (si le device le permet).

### 11.8 Séquestre légal (legal hold)
Marquer un classeur comme sous séquestre : aucune modification ni suppression possible, même par le propriétaire, jusqu'à levée par l'admin. Préservation légale pour les litiges.

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **Google Sheets Help Center** (support.google.com/docs) — documentation officielle exhaustive, tutoriels, raccourcis, guide des formules, bonnes pratiques.
- **Microsoft 365 Learn / Excel Training** (support.microsoft.com/excel) — guides par scénario, vidéos 2-min, best practices, listes de fonctions par version.
- **Airtable Academy** (airtable.com/academy) — cours vidéo sur les rich fields, vues, automations, interfaces. Templates galerie publique.
- **Airtable Guides** (support.airtable.com) — docs détaillées sur chaque type de champ et chaque vue, exemples concrets.
- **Notion Help & Learn** (notion.so/help) — docs sur les databases, formulas, templates. Guides "use cases" très visuels.
- **Coda Doc Gallery** (coda.io/gallery) — exemples publics interactifs montrant des patterns (trackers, dashboards, CRMs).
- **ExcelJet** (exceljet.net) — 500+ recettes de formules, shortcuts, explications pédagogiques.
- **Ablebits Blog** — tutoriels avancés sur les formules array, pivots, Power Query.
- **MrExcel / Chandoo.org** — forums et tutoriels profonds sur les techniques expertes.
- **Airtable Universe** (airtable.com/universe) — bases publiques partagées par la communauté.

### Projets open source permissifs à étudier comme pattern
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **Univer** (univer.ai, github.com/dream-num/univer) | **Apache-2.0** | Architecture moderne d'un tableur collaboratif full-stack (formules, styles, collab, plugins). Référence principale. |
| **Fortune-Sheet** (github.com/ruilisi/fortune-sheet) | **MIT** | Fork React de Luckysheet. Pattern Redux pour la grille, formules, pivot, collaboration. |
| **Luckysheet** (github.com/mengshukeji/Luckysheet) | **MIT** | Canvas-based rendering, grosse perf. Pattern pour millions de cellules. |
| **x-spreadsheet** (github.com/myliang/x-spreadsheet) | **MIT** | Tableur vanilla JS minimaliste. Pattern simple pour rendu canvas et gestion des events. |
| **Jspreadsheet CE** (github.com/jspreadsheet/ce) | **MIT** (CE) | Composants standalones pour intégration. Utilisé pour le data entry léger. |
| **GC.Spread.Sheets** | Commercial | À ne PAS utiliser — référence pédagogique uniquement via leurs docs publiques. |
| **SheetJS / xlsx** (github.com/SheetJS/sheetjs) | **Apache-2.0** | Référence pour l'import/export XLSX/ODS/CSV. Gestion des types et styles. |
| **hyperformula** (github.com/handsontable/hyperformula) | **GPL v3** | **INTERDIT** (GPL). Ne pas utiliser ni copier. |
| **formula.js** (github.com/formulajs/formulajs) | **MIT** | Library de fonctions Excel en JS pur. Base pour étendre notre moteur de formules. |
| **fast-formula-parser** (github.com/LesterLyu/fast-formula-parser) | **MIT** | Parser de formules Excel rapide. Pattern pour le tokenizer et l'AST. |
| **ExcelJS** (github.com/exceljs/exceljs) | **MIT** | Lecture/écriture XLSX côté Node. Pattern pour les styles, formats numériques, graphiques. |
| **d3.js** (d3js.org) | **BSD-3-Clause** | Rendering de graphiques (déjà base de Chart.js, Recharts). Pattern pour les axes, les échelles, les courbes. |
| **Chart.js** (chartjs.org) | **MIT** | Graphiques canvas simples. Intégration directe possible. |
| **Apache ECharts** (echarts.apache.org) | **Apache-2.0** | Graphiques riches (sankey, treemap, heatmap, radar, gauges). Référence pour les charts avancés. |
| **AG Grid Community** (ag-grid.com) | **MIT** (Community) | Pattern pour la virtualisation, les filters, le group/pivot. Enterprise est commercial — ne pas utiliser. |
| **Handsontable CE** | **MIT** jusqu'à v6, **commercial** depuis | Ne pas utiliser les versions récentes. Studier v6 comme pattern historique uniquement. |
| **Yjs** (github.com/yjs/yjs) | **MIT** | CRDT pour la collaboration temps réel — déjà utilisé dans SignApps. |
| **Fast-check** (github.com/dubzzz/fast-check) | **MIT** | Property-based testing pour les formules et le moteur de recalcul. |

### Pattern d'implémentation recommandé
1. **Engine de formules** : base sur `formula.js` (MIT) et `fast-formula-parser` (MIT) pour le tokenizer et l'évaluateur. Étendre avec nos propres fonctions. Ne JAMAIS copier du code de `hyperformula` (GPL).
2. **Collaboration** : Yjs + y-websocket (MIT) comme déjà en place. Voir Univer pour le pattern cursor/selection broadcast.
3. **Graphiques** : Chart.js (MIT) pour les basiques, ECharts (Apache-2.0) pour les avancés (sankey, treemap, radar).
4. **Import/Export XLSX** : SheetJS (Apache-2.0) ou ExcelJS (MIT). Privilégier ExcelJS pour l'export car plus simple à contrôler côté style.
5. **Parsing CSV** : Papa Parse (MIT) — déjà industry-standard.
6. **Virtualisation** : pattern custom léger (~200 lignes) ou `react-virtual` (MIT) / `@tanstack/react-virtual` (MIT).
7. **Date handling** : `date-fns` (MIT) ou `dayjs` (MIT). **Pas** Moment.js (MIT mais en fin de maintenance).
8. **Regex engine pour RegEx functions** : RE2-js (BSD-3) pour éviter le ReDoS.

### Ce qu'il ne faut PAS faire
- **Pas de copier-coller** depuis les projets ci-dessus, même MIT. On s'inspire des patterns, on réécrit.
- **Pas d'ajout de `hyperformula`** ni aucun fork GPL — même comme dépendance transitive (cargo deny bloque).
- **Pas de scraping des docs Google/Microsoft** — on lit, on s'inspire, on reformule.
- **Pas de reverse-engineering** de produits commerciaux (Excel, Sheets) au sens du dump de code.
- **Respect strict** de la politique de licences (voir `deny.toml` et `memory/feedback_license_policy.md`).

---

## Assertions E2E clés (à tester)

- Sélection simple, plage, multi-plage, ligne entière, colonne entière, select-all
- Autofill avec série numérique, date, texte, formule relative, formule absolue
- Smart Fill détecte un pattern et propose la complétion
- Navigation clavier complète (flèches, tab, enter, ctrl+flèches, ctrl+home/end, page up/down)
- Freeze row/col/selection + scroll maintient les zones figées visibles
- Fonction simple (`=SUM`), multi-args (`=IF`), nested (`=IF(AND(...))`)
- Référence cross-sheet `=Sheet2!A1`
- Erreurs `#DIV/0!`, `#REF!`, `#NAME?`, `#CYCLE!`, `#N/A`, `#VALUE!`
- Format numérique change le rendu d'une cellule sans modifier la valeur
- Bordures et couleurs s'appliquent à une plage
- Fusion et défusion préservent/restaurent les données
- Formatage conditionnel applique visuellement la règle
- Tri ascendant/descendant, multi-colonnes, sans affecter les autres vues
- Filtres cachent/montrent les lignes correspondantes
- Ajout/duplication/renommage/suppression de feuille
- Version history restore une version antérieure
- Collab : 2 utilisateurs éditent sans conflit, curseurs visibles
- Commentaire ancré à une cellule, thread avec réponses, résolution
- Partage avec différents niveaux de permission (lecture, commentaire, édition)
- Insertion de graphique (barres, lignes, secteurs) avec plage dynamique
- Pivot table avec lignes/colonnes/valeurs, agrégation
- Import XLSX multi-feuilles avec formules et styles préservés
- Export CSV/XLSX/PDF downloadable
- Apps Script : fonction custom exposée dans le classeur
- AI : génération de formule depuis langage naturel
- Vue Kanban : drag d'une carte change la valeur du champ groupé
- Vue Calendar : nouvelle ligne = événement à une date
