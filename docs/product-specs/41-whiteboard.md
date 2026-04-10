# Module Whiteboard (Tableau blanc) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Excalidraw** | Open source, rendu hand-drawn (sketchy), collaboration temps reel, export SVG/PNG/JSON, bibliotheque de formes communautaire, chiffrement E2E, infinite canvas, dark mode, keyboard shortcuts, libraries importables |
| **tldraw** | Open source, SDK embeddable, rendu vectoriel net, multiplayer CRDT, infinite canvas, snap-to-grid, smart arrows (se reconnectent auto), groupes, pages multiples, gestes tactiles, export SVG/PNG/JSON, bindings entre formes |
| **Miro** | Templates pre-faits (retrospective, mind map, user story map, Kanban), voting dots, timer, video chat integre, presentation mode, Smart Frameworks, apps marketplace, infinite canvas avec minimap, comments, version history |
| **FigJam** | Stamps et reactions emoji, curseurs nommes, audio chat, stickers, widgets interactifs, connections auto entre formes, sections, templates, integration Figma, voting, timer, spotlight |
| **Whimsical** | Flowcharts avec auto-layout, wireframes, mind maps, docs, templates curated, AI mind map generation, neat snap connections, clean minimal UI, export PDF/PNG/SVG |
| **Lucidchart** | Diagrammes techniques (UML, BPMN, ERD, AWS, Azure), auto-layout intelligent, data linking, conditional formatting, layers, master pages, import Visio, export multi-format |
| **draw.io (diagrams.net)** | Open source, 100+ bibliotheques de formes (AWS, UML, flowchart, network), integration GitHub/GitLab/Confluence, export XML/SVG/PNG/PDF, themes, scratchpad, freeform drawing |
| **Microsoft Whiteboard** | Integration Teams, Ink-to-shape, sticky notes avec reactions, templates, insertion d'images/documents, Follow mode presentation, Copilot AI suggestions |

## Principes directeurs

1. **Canvas infini et fluide** — zoom/pan illimite avec rendu 60fps. Le canvas ne doit jamais "finir" — l'utilisateur dessine ou il veut, a n'importe quelle echelle.
2. **Dessin naturel** — le mode stylo doit offrir un rendu fluide avec lissage de courbe et sensibilite a la pression (si tablette graphique/stylet). Le trait doit suivre le doigt ou la souris sans latence perceptible (<16ms).
3. **Formes intelligentes** — les formes geometriques (rectangle, cercle, losange) supportent le texte integre, le redimensionnement proportionnel, et les connecteurs auto-attaches aux points d'ancrage.
4. **Collaboration en direct** — chaque participant voit les curseurs, selections et dessins des autres en temps reel via Yjs/CRDT (signapps-collab port 3013). Pas de lock, pas de conflit.
5. **Export universel** — le tableau peut etre exporte en SVG, PNG, PDF ou JSON (pour reimport). Le JSON preserve toute la structure pour la serialisation.
6. **Accessible hors-ligne** — le canvas fonctionne en mode local deconnecte. Les modifications sont synchronisees au retour en ligne.

---

## Categorie 1 — Outils de dessin

### 1.1 Stylo (Pen)
Outil de dessin libre. Le trait suit le curseur avec lissage Bezier cubique (algorithme perfect-freehand). Epaisseur configurable (1-20px) via slider dans le panneau de proprietes ou raccourcis `[` (reduire) et `]` (agrandir). Couleur selectionnable dans la palette. Rendu en SVG `<path>` avec attributs `d` generes depuis les points echantillonnes. Support pression stylet via Pointer Events API (`pressure` property) : epaisseur varie de 0.5x (toucher leger) a 1.5x (appui fort). Le trait est finalise au relachement du bouton souris/stylet et devient un element selectionnable. Raccourci clavier : `P` active l'outil stylo.

### 1.2 Ligne droite
Tracer une ligne entre deux points. Clic-drag du point A au point B. Pendant le drag, un preview de la ligne en pointille s'affiche. `Shift` maintenu force l'alignement aux angles 0/45/90/135/180/225/270/315 degres (snap angulaire par increments de 45). Epaisseur configurable (1-20px). Couleur configurable. Options de terminaison sur chaque extremite : aucune, fleche ouverte, fleche fermee, cercle, losange, barre. Raccourci : `L` active l'outil ligne.

### 1.3 Rectangle
Clic-drag pour definir le coin haut-gauche et bas-droit. Preview en pointille pendant le drag. `Shift` maintenu force un carre parfait. Le rectangle supporte :
- Couleur de fond (fill) — transparent par defaut, selectionnable dans la palette + picker custom
- Couleur de bordure (stroke) — noir par defaut
- Epaisseur de bordure (1-10px)
- Coins arrondis (border-radius 0-50px) — slider dans le panneau de proprietes
- Style de bordure : solide, pointille, tirets
- Texte centre integre : double-clic sur le rectangle active l'edition de texte avec curseur clignotant. Le texte est centre horizontalement et verticalement. Retour a la ligne automatique si le texte depasse la largeur. Police, taille (8-72), gras, italique, couleur configurables.
Raccourci : `R` active l'outil rectangle.

### 1.4 Cercle / Ellipse
Clic-drag pour definir le bounding box. Preview en pointille pendant le drag. `Shift` maintenu force un cercle parfait. Memes options de style que le rectangle : fill, stroke, epaisseur, style de bordure, texte integre. Points d'ancrage pour les connecteurs sur les 4 points cardinaux (haut, bas, gauche, droite) + 4 points intermediaires. Raccourci : `O` active l'outil ellipse.

### 1.5 Texte
Clic sur le canvas place un curseur de saisie clignotant. Taper du texte directement. Le bloc texte est cree avec les dimensions auto-ajustees au contenu. Options dans le panneau de proprietes : taille (12-72px), gras (`Ctrl+B`), italique (`Ctrl+I`), souligne (`Ctrl+U`), couleur, police (Inter par defaut, selection parmi 10 polices web). Alignement : gauche, centre, droite. Le bloc texte est deplacable et redimensionnable (le redimensionnement ajuste le retour a la ligne mais pas la taille de police). Double-clic sur un texte existant entre en mode edition. Raccourci : `T` active l'outil texte.

### 1.6 Gomme (Eraser)
Clic-drag efface les traits ou formes traverses. Deux modes accessibles via le panneau de proprietes :
- **Gomme de trait** (defaut) — efface l'element entier au premier contact (le trait/forme disparait completement)
- **Gomme de zone** — efface uniquement la zone survolee (rayon configurable 5-50px), decoupe les paths SVG en sous-paths

Feedback visuel : un cercle semi-transparent rouge suit le curseur pour indiquer la zone d'effacement. Les elements qui seront effaces sont highlight en rouge avant le relachement. Raccourci : `E` active la gomme. Undo (`Ctrl+Z`) restaure les elements effaces.

### 1.7 Palette de couleurs
Palette permanente dans la toolbar laterale gauche avec 8 couleurs principales : noir (`#1E1E1E`), gris (`#8B8B8B`), rouge (`#E03131`), orange (`#E8590C`), jaune (`#FCC419`), vert (`#2F9E44`), bleu (`#1971C2`), violet (`#7048E8`). Bouton `+` ouvre un color picker complet (HSL wheel + hex input + opacite slider). La couleur selectionnee s'affiche comme un cercle plein dans la toolbar, indiquant la couleur active. Double-clic sur une couleur de la palette ouvre le picker pour la remplacer par une couleur custom. La couleur selectionnee s'applique au prochain trait/forme. Pour changer la couleur d'un element existant, le selectionner puis choisir la nouvelle couleur.

### 1.8 Epaisseur du trait
Panneau dans la toolbar avec 4 presets visuels (traits d'epaisseur croissante) :
- Fin : 1px
- Moyen : 3px
- Epais : 6px
- Tres epais : 12px

Clic sur un preset l'active pour l'outil courant (stylo, ligne, bordure de forme). Un slider supplementaire (1-20px) est disponible dans le panneau de proprietes detaille pour une valeur precise. L'epaisseur selectionnee est indiquee visuellement dans la toolbar.

### 1.9 Style de trait
Options de style de trait dans le panneau de proprietes :
- **Solide** — trait continu (defaut)
- **Pointille** — `stroke-dasharray: 4,4`
- **Tirets** — `stroke-dasharray: 12,4`
- **Point-tiret** — `stroke-dasharray: 12,4,2,4`

Applicable aux lignes, bordures de formes, et connecteurs. Preview en temps reel dans le panneau.

---

## Categorie 2 — Formes et objets structurels

### 2.1 Fleche (Arrow)
Forme composee d'une ligne avec une pointe de fleche a une ou deux extremites. Clic-drag pour tracer du point de depart au point d'arrivee. La fleche peut etre courbe : un point de controle (handle rond bleu) au milieu du trait permet de courber la fleche en Bezier quadratique. Drag du handle pour ajuster la courbure. Double-clic sur le handle le remet au centre (fleche droite). La fleche snappe aux points d'ancrage des autres formes (8 points par forme rectangulaire, 8 par ellipse, 4 par losange). Quand snappee, la fleche suit la forme si elle est deplacee (reactive routing). Couleur et epaisseur configurables. Raccourci : `A` active l'outil fleche.

### 2.2 Post-it (Sticky Note)
Rectangle pre-style avec fond jaune (`#FFF9B1`) par defaut, ombre legere (`shadow-sm`), coins arrondis (4px), texte editable au double-clic. Taille par defaut 150x150px, redimensionnable par les poignees mais avec maintien du ratio carre. Couleurs predefinies : jaune (`#FFF9B1`), rose (`#FFD1DC`), vert (`#D5F5E3`), bleu (`#D6EAF8`), orange (`#FDEBD0`), violet (`#E8DAEF`). Le texte est centre avec retour a la ligne automatique. Police : 14px, semi-bold. Max 500 caracteres. Clic simple selectionne le post-it, double-clic entre en mode edition. Raccourci : `S` cree un post-it au centre du viewport.

### 2.3 Losange (Decision)
Forme losange pour les diagrammes de flux (decision oui/non). Clic-drag pour dimensionner. Le losange est un carre rotate de 45 degres, avec `Shift` pour forcer un losange parfait (meme largeur/hauteur). Texte integre centre editable au double-clic (meme comportement que le rectangle). Points d'ancrage sur les 4 sommets (haut, droite, bas, gauche) pour les connecteurs. Couleur de fond et de bordure configurables. Raccourci : `D` active l'outil losange.

### 2.4 Connecteur (Connector)
Ligne intelligente qui se connecte entre deux formes via leurs points d'ancrage. Clic sur un point d'ancrage d'une forme (cercle bleu visible au hover de la forme) puis drag vers un point d'ancrage d'une autre forme. Le connecteur suit les formes quand elles sont deplacees (reactive routing). Styles disponibles :
- **Ligne droite** — trait direct entre les deux points
- **Coude (orthogonal)** — suit des angles de 90 degres avec un ou plusieurs segments horizontaux/verticaux. L'algorithme de routing evite les chevauchements avec les autres formes.
- **Courbe** — Bezier avec point de controle draggable

Fleche optionnelle a chaque extremite (aucune, fleche, cercle, losange). Texte optionnel sur le connecteur (label centre sur le milieu du trait, editable au double-clic). Le connecteur affiche les points d'ancrage disponibles en bleu quand l'utilisateur drag une extremite pres d'une forme. Raccourci : `C` active l'outil connecteur.

### 2.5 Image
Insertion d'image par drag-drop depuis le bureau ou bouton upload dans la toolbar (icone montagne). L'image est placee sur le canvas a la position de drop ou au centre du viewport. Redimensionnable avec poignees (8 points + rotation). `Shift` maintenu pour conserver le ratio. L'image est stockee via signapps-storage (port 3004) et referencee par URL dans le JSON du whiteboard. Formats supportes : PNG, JPEG, SVG, WebP, GIF. Taille max : 10 MB. Double-clic sur l'image ouvre un dialogue de crop. Export en JSON : reference URL. Export en PNG/SVG : image inlinee en base64.

### 2.6 Cadre / Section (Frame)
Rectangle-conteneur qui groupe visuellement des elements. Clic-drag pour definir le cadre. Les formes dont le centre est a l'interieur du cadre au moment de sa creation (ou qui sont deplacees dedans) deviennent enfants du cadre. Deplacement du cadre deplace tous ses enfants ensemble. Redimensionnement du cadre ne redimensionne pas les enfants (ils peuvent deborder). Titre editable en haut a gauche du cadre (police 14px, semi-bold, couleur `text-muted-foreground`). Fond semi-transparent (`bg-muted/30`). Bordure en tirets fins. Utile pour organiser un board en zones thematiques (ex: `Sprint 1`, `Backlog`, `Done`). En mode presentation, chaque frame devient une "slide" navigable. Raccourci : `F` active l'outil frame.

### 2.7 Groupement d'elements
Selection multiple (lasso avec outil selection ou `Ctrl+clic` pour ajouter a la selection) puis `Ctrl+G` pour grouper. Le groupe se comporte comme un seul objet : deplacement, redimensionnement (proportionnel), rotation s'appliquent a tout le groupe. Les poignees de selection entourent le bounding box du groupe. `Ctrl+Shift+G` pour degrouper et retrouver les elements individuels. Le groupement est recursif : un groupe peut contenir des groupes. Double-clic sur un groupe entre dans le contexte du groupe (les elements hors-groupe sont attenues visuellement) pour editer les elements internes sans degrouper.

### 2.8 Bibliotheque de formes additionnelles
Panneau `Formes` dans la toolbar avec des formes pre-definies additionnelles :
- **Fleche large** (block arrow) — fleche rectangulaire avec pointe
- **Etoile** (5 branches, configurable 3-8)
- **Bulle de dialogue** (rectangle avec pointe triangulaire en bas a gauche)
- **Parallelogramme** — pour les diagrammes de flux (entrees/sorties)
- **Cylindre** — pour les bases de donnees dans les diagrammes d'architecture
- **Nuage** — forme amorphe pour le cloud computing
- **Hexagone** — pour les architectures microservices

Chaque forme supporte les memes options de style (fill, stroke, texte integre, points d'ancrage).

---

## Categorie 3 — Navigation et manipulation du canvas

### 3.1 Zoom et pan
**Zoom** : molette souris pour zoomer (increment de 10%, range 10% a 800%). `Ctrl+molette` pour zoom plus fin (5%). Zoom centre sur la position du curseur. Gestes tactiles : pinch-zoom a deux doigts.
**Pan** : clic molette + drag, ou `Espace` + clic-drag (outil main temporaire). Gestes tactiles : two-finger drag. Le curseur se transforme en main ouverte quand Espace est maintenu, main fermee pendant le drag.
**Controles dans l'UI** : indicateur de zoom en bas a gauche affichant le pourcentage actuel (ex: `100%`). Boutons `+` et `-` de chaque cote. Menu dropdown au clic sur le pourcentage avec presets : `50%`, `100%`, `150%`, `200%`, `Fit to content` (zoom pour voir tous les elements), `Fit to selection` (zoom sur les elements selectionnes). Raccourcis : `Ctrl+=` zoom in, `Ctrl+-` zoom out, `Ctrl+0` reset 100%, `Ctrl+1` fit to content.

### 3.2 Minimap
Vue miniature en bas a droite du canvas (160x100px, fond `bg-card`, bordure fine, coins arrondis 8px). Affiche tous les elements du canvas en version simplifiee (rectangles de couleur pour les formes, traits pour les lignes). Un rectangle bleu semi-transparent represente le viewport actuel. Clic-drag sur la minimap pour naviguer rapidement (le viewport suit en temps reel). La minimap est masquable via un toggle en bas a droite (icone carte). Masquee par defaut sur mobile. La minimap se met a jour en temps reel quand les elements sont ajoutes/deplaces.

### 3.3 Selection et manipulation
Outil Selection (fleche, raccourci `V` ou `1`) : clic pour selectionner un element, clic-drag sur le canvas vide pour lasso multi-selection (rectangle en pointille bleu). Elements selectionnes affichent :
- 8 poignees de redimensionnement (coins + milieux des cotes) en carres bleus pleins (6x6px)
- Un point de rotation en haut au centre (cercle bleu avec icone rotation) a 20px au-dessus du bounding box
- Bordure bleue autour du bounding box

Deplacement par drag de l'element selectionne. Redimensionnement par drag des poignees (`Shift` pour ratio, `Alt` pour redimensionner depuis le centre). Rotation par drag du point de rotation (`Shift` pour snap 15 degres). Suppression par `Delete` ou `Backspace`. Duplication par `Ctrl+D` (place la copie decalee de 20px en x et y). `Ctrl+A` selectionne tous les elements visibles.

### 3.4 Snap-to-grid et guides d'alignement
**Grille** : toggle via `Ctrl+G` ou bouton grille dans la toolbar du bas. Grille de points fins (espacement 20px par defaut, configurable 10/20/40px). Les formes snappent a la grille la plus proche lors du deplacement et du redimensionnement (snap distance : 8px). La grille est rendue en points gris clairs, pas en lignes (style Figma).
**Guides d'alignement** : apparaissent dynamiquement comme des lignes rouges pointillees quand une forme est alignee avec une autre sur :
- Centre horizontal
- Centre vertical
- Bord haut/bas/gauche/droite
- Espacement egal entre 3+ elements (guide d'espacement violet avec la distance affichee)

Les guides disparaissent au relachement du drag. Snap aux guides : 4px de tolerance.

### 3.5 Ruler guides
Regles optionnelles le long du bord haut et gauche du canvas (activables via `View > Rulers` ou raccourci `Ctrl+R`). Graduation en pixels avec marqueurs tous les 100px. Clic-drag depuis la regle vers le canvas cree un guide permanent (ligne horizontale ou verticale en bleu fin). Les elements snappent aux guides (tolerance 4px). Double-clic sur un guide ouvre un input pour saisir la position exacte en pixels. `Delete` sur un guide selectionne le supprime. Les guides sont sauvegardes avec le whiteboard.

### 3.6 Undo / Redo illimite
`Ctrl+Z` undo, `Ctrl+Y` ou `Ctrl+Shift+Z` redo. Historique illimite pendant la session (stocke en memoire). Chaque action atomique est une entree dans la pile d'undo : dessin d'un trait, deplacement, suppression, changement de style, ajout de texte, groupement, etc. Les actions groupees (ex: deplacement de plusieurs elements selectionnes) comptent comme une seule entree. L'historique est local a l'utilisateur (pas partage via CRDT). Au rechargement de la page, l'historique est perdu mais l'etat du canvas est preserve via le document Yjs.

### 3.7 Copier / Coller
`Ctrl+C` copie les elements selectionnes dans un clipboard interne (pas le presse-papier systeme — les formes sont trop complexes pour le presse-papier texte). `Ctrl+V` colle les elements copies au centre du viewport, decales de 20px par rapport a l'original. `Ctrl+X` coupe (copie + supprime). Coller entre deux whiteboards differents est supporte si les deux sont ouverts dans le meme navigateur (clipboard en localStorage). Coller une image depuis le presse-papier systeme (`Ctrl+V` apres screenshot) insere l'image sur le canvas.

### 3.8 Layers (couches)
Chaque element a un z-index dans la pile de rendu. Actions de z-ordering :
- `Ctrl+]` — monter d'un niveau (bring forward)
- `Ctrl+[` — descendre d'un niveau (send backward)
- `Ctrl+Shift+]` — mettre au premier plan (bring to front)
- `Ctrl+Shift+[` — mettre a l'arriere-plan (send to back)

Panneau `Layers` optionnel dans la sidebar droite listant tous les elements par z-index (du plus haut au plus bas). Chaque entree affiche : icone du type (forme, texte, image, groupe), nom de l'element (auto-genere ou personnalise), icone oeil pour masquer/afficher, icone cadenas pour verrouiller (empeche la selection et le deplacement). Drag des entrees dans le panneau pour reordonner.

### 3.9 Effacer tout (Clear)
Bouton `Effacer le tableau` dans le menu `...` en haut a droite. Dialogue de confirmation : `Effacer tous les elements du tableau ? Cette action peut etre annulee avec Ctrl+Z.`. Supprime tous les elements du canvas. L'undo restaure l'etat precedent en une seule action.

---

## Categorie 4 — Collaboration temps reel

### 4.1 Connexion WebSocket (Yjs)
Le whiteboard se connecte a signapps-collab (port 3013) via WebSocket (protocol `y-websocket`). Un document Yjs par whiteboard (room name: `whiteboard:{whiteboard_id}`). Le document contient :
- `Y.Array<Y.Map>` pour les elements (chaque element est un Y.Map avec id, type, position, dimensions, style, etc.)
- `Y.Map` pour les metadonnees (nom, grid settings, background color)

Chaque modification (ajout, deplacement, suppression, style) est une transaction Yjs atomique. La synchronisation est incrementale : seuls les deltas sont transmis. Latence cible : <100ms.

### 4.2 Curseurs distants
Chaque collaborateur connecte a un curseur visible sur le canvas des autres. Le curseur est une fleche de la couleur assignee au collaborateur (couleurs attribuees cycliquement : bleu, vert, orange, rose, violet, cyan). Le nom du collaborateur est affiche dans un badge colore a cote de son curseur (taille 11px, fond de sa couleur, texte blanc, coins arrondis 4px). Position mise a jour en temps reel via le protocol `awareness` de Yjs. Les curseurs des utilisateurs inactifs depuis >30 secondes deviennent semi-transparents. Les curseurs d'utilisateurs deconnectes disparaissent apres 5 secondes.

### 4.3 Indicateur de connexion et presence
Badge en haut a droite de la toolbar affichant les avatars des collaborateurs connectes (cercles empiles, max 5 affiches, puis `+N`). Chaque avatar a un contour de la couleur assignee. Hover sur un avatar affiche le nom en tooltip. En dessous des avatars : badge textuel `En ligne` (vert) si connecte au serveur, `Local` (gris) si hors-ligne. Le nombre de collaborateurs est affiche a cote du badge (`3 en ligne`).

### 4.4 Selections distantes
Quand un collaborateur selectionne un element, les autres voient une bordure fine de la couleur du collaborateur autour de l'element selectionne, avec le nom en petit badge au-dessus. Cela evite les modifications conflictuelles : si un utilisateur voit qu'un element est selectionne par un autre, il sait que cet element est en cours d'edition. Pas de lock automatique (l'edition concurrente du meme element est geree par le CRDT).

### 4.5 Resolution de conflits CRDT
Deux utilisateurs peuvent dessiner simultanement sans conflit grace au CRDT Yjs. Les formes sont ajoutees de maniere commutative au Y.Array. Les modifications de proprietes d'un meme element sont resolues par last-write-wins au niveau de chaque propriete individuelle (position, couleur, taille sont des champs independants dans le Y.Map). Deplacement concurrent du meme element : le dernier deplacement gagne avec convergence garantie.

### 4.6 Mode hors-ligne
Si la connexion WebSocket est perdue, le canvas continue de fonctionner en local. Un banner discret en haut indique `Mode hors-ligne — les modifications seront synchronisees au retour en ligne`. Toutes les modifications sont enregistrees dans le document Yjs local (IndexedDB via `y-indexeddb`). Au retour en ligne (reconnexion WebSocket), le CRDT Yjs merge automatiquement les modifications locales et distantes sans intervention utilisateur. Le banner disparait et un toast confirme `Synchronisation terminee`.

---

## Categorie 5 — Export et integration

### 5.1 Export SVG
`Fichier > Exporter > SVG` ou raccourci `Ctrl+Shift+S`. Genere un fichier SVG vectoriel du canvas entier ou de la selection seulement (option dans le dialogue). Le SVG inclut toutes les formes, textes, fleches, connecteurs avec leurs styles preserves. Resolution independante, ideal pour l'impression et l'integration dans des documents. Options : inclure le fond (blanc ou transparent), inclure la grille (non par defaut), echelle (1x, 2x). Nom de fichier : `{nom-du-whiteboard}.svg`.

### 5.2 Export PNG
`Fichier > Exporter > PNG` ou raccourci `Ctrl+Shift+P`. Rasterisation du canvas via `canvas.toBlob()`. Resolution configurable : 1x (72dpi), 2x (144dpi), 4x (288dpi). Fond transparent optionnel (checkbox). Export de la selection ou du canvas entier. Padding de 20px autour du contenu. Nom de fichier : `{nom-du-whiteboard}.png`.

### 5.3 Export PDF
`Fichier > Exporter > PDF`. Conversion du canvas en PDF via librairie `jspdf` (MIT). Options :
- Format : A4, A3, Letter, Custom
- Orientation : Portrait, Paysage
- Echelle : Fit to page, 100%, Custom
- Multi-pages : si le contenu depasse une page, decoupage automatique avec frames comme separateurs de pages

### 5.4 Export JSON (sauvegarde/reimport)
`Fichier > Exporter > JSON`. Serialisation JSON de toutes les formes, styles, positions, connexions, metadonnees du whiteboard. Format :
```json
{
  "version": "1.0",
  "name": "Mon whiteboard",
  "elements": [
    { "id": "...", "type": "rectangle", "x": 100, "y": 200, "width": 150, "height": 80, "fill": "#E03131", "stroke": "#1E1E1E", "strokeWidth": 2, "text": "Hello", ... }
  ],
  "metadata": { "gridEnabled": true, "gridSize": 20, "background": "#FFFFFF" }
}
```
Reimportable via `Fichier > Importer > JSON` pour restaurer un whiteboard complet.

### 5.5 Integration avec les autres modules
- **Docs** : embed d'un whiteboard dans un document Docs comme bloc interactif. Le bloc affiche une preview statique du whiteboard. Clic ouvre le whiteboard en mode edition dans un dialogue modal. Les modifications se propagent en temps reel dans le document. Commande slash `/whiteboard` dans l'editeur Docs pour inserer.
- **Chat** : partage d'un snapshot PNG du whiteboard dans une conversation. Le snapshot inclut un lien vers le whiteboard interactif. PgEventBus event `whiteboard.shared { whiteboard_id, channel_id }`.
- **Drive** : le whiteboard est sauvegarde comme fichier dans Drive (extension `.signboard`). CRUD via Drive API.
- **Meet** : partage d'ecran du whiteboard pendant une visioconference. Mode collaboratif : les participants de la reunion peuvent dessiner directement sur le whiteboard partage.
- **Wiki** : embed dans une page wiki comme bloc interactif (meme mecanisme que Docs).

### 5.6 Templates pre-definis
Bibliotheque de templates accessible via `Fichier > Nouveau depuis template` ou bouton `Templates` sur l'ecran de selection/creation. Templates disponibles :
- **Retrospective** — 3 colonnes (Keep / Stop / Start) avec post-its colores
- **Mind Map** — noeud central avec branches
- **Flowchart** — formes de base pre-disposees (start, process, decision, end)
- **Wireframe mobile** — cadre iPhone avec zones cliquables
- **Wireframe desktop** — cadre navigateur avec header, sidebar, content
- **User Story Map** — grille epics x releases
- **Kanban** — colonnes To Do / In Progress / Done avec post-its
- **Org Chart** — arbre hierarchique avec rectangles connectes
- **SWOT Analysis** — matrice 2x2 (Strengths, Weaknesses, Opportunities, Threats)
- **Business Model Canvas** — 9 zones standard

Un template pre-remplit le canvas avec des formes, connecteurs et textes de placeholder. L'utilisateur modifie le contenu sans repartir de zero.

### 5.7 Presentation mode
Bouton `Presenter` en haut a droite. Le mode presentation utilise les Frames (voir 2.6) comme slides. L'interface entre en mode plein ecran avec fond sombre. Navigation : fleches gauche/droite, ou barre d'espace pour avancer. Indicateur de slide en bas (`3 / 7`). Chaque frame est affichee en zoom `Fit to frame` avec transition fade (200ms). Si aucun frame n'existe, le mode presentation fait un panoramique lineaire de gauche a droite sur le contenu. `Escape` quitte le mode presentation.

Mode **Follow** : quand le presentateur active le mode presentation, les autres collaborateurs connectes voient une notification `X a demarre une presentation — Suivre ?`. Clic sur `Suivre` synchronise leur viewport sur celui du presentateur.

---

## Categorie 6 — Persistance et API

### 6.1 API REST

**Base path :** `/api/v1/whiteboard`

| Methode | Endpoint | Description |
|---|---|---|
| `GET` | `/boards` | Liste paginee des whiteboards de l'utilisateur. Query params : `cursor`, `limit`, `search`, `sort_by` (modified, created, name) |
| `GET` | `/boards/:id` | Detail d'un whiteboard (metadonnees, pas le contenu canvas — celui-ci est via Yjs WebSocket) |
| `POST` | `/boards` | Creer un whiteboard. Body : `{ name, template_id? }` |
| `PUT` | `/boards/:id` | Mettre a jour les metadonnees (nom, grille, fond) |
| `DELETE` | `/boards/:id` | Supprimer un whiteboard (soft-delete) |
| `POST` | `/boards/:id/duplicate` | Dupliquer un whiteboard |
| `POST` | `/boards/:id/share` | Partager. Body : `{ user_id, role: "editor" | "viewer" }` |
| `DELETE` | `/boards/:id/share/:user_id` | Retirer un collaborateur |
| `GET` | `/boards/:id/export/:format` | Export (format: svg, png, pdf, json). Query params : `scale`, `transparent`, `selection_only` |
| `POST` | `/boards/:id/snapshot` | Creer un snapshot nomme. Body : `{ name }` |
| `GET` | `/boards/:id/snapshots` | Liste des snapshots |
| `GET` | `/templates` | Liste des templates disponibles |

### 6.2 PostgreSQL schema

```sql
-- Whiteboard principal
CREATE TABLE whiteboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Sans titre',
    thumbnail_url VARCHAR(500),
    grid_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    grid_size INTEGER NOT NULL DEFAULT 20,
    background_color VARCHAR(9) NOT NULL DEFAULT '#FFFFFF',
    is_trashed BOOLEAN NOT NULL DEFAULT FALSE,
    trashed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whiteboards_user ON whiteboards(user_id, is_trashed, updated_at DESC);

-- Le contenu du canvas est stocke dans le document Yjs (y-websocket server + y-indexeddb)
-- La table ne contient que les metadonnees

-- Partage de whiteboards
CREATE TABLE whiteboard_shares (
    whiteboard_id UUID NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('editor', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (whiteboard_id, user_id)
);

CREATE INDEX idx_whiteboard_shares_user ON whiteboard_shares(user_id);

-- Snapshots (versions nommees)
CREATE TABLE whiteboard_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whiteboard_id UUID NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    yjs_state BYTEA NOT NULL,
    thumbnail_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whiteboard_snapshots_board ON whiteboard_snapshots(whiteboard_id, created_at DESC);

-- Templates
CREATE TABLE whiteboard_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    thumbnail_url VARCHAR(500),
    yjs_state BYTEA NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whiteboard_templates_category ON whiteboard_templates(category);
```

### 6.3 PgEventBus events

| Event | Payload | Consumers |
|---|---|---|
| `whiteboard.created` | `{ whiteboard_id, user_id, name }` | Metrics, Drive |
| `whiteboard.updated` | `{ whiteboard_id, user_id }` | Drive (update modified date) |
| `whiteboard.deleted` | `{ whiteboard_id, user_id }` | Drive, Search index |
| `whiteboard.shared` | `{ whiteboard_id, owner_id, target_user_id, role }` | Notifications |
| `whiteboard.snapshot.created` | `{ whiteboard_id, snapshot_id, user_id, name }` | — |
| `whiteboard.exported` | `{ whiteboard_id, user_id, format }` | Audit |
| `whiteboard.embedded` | `{ whiteboard_id, target_module, target_id }` | Docs, Wiki |

---

## Categorie 7 — Securite et gouvernance

### 7.1 Permissions
Chaque whiteboard a un proprietaire. Roles : proprietaire (CRUD + share + delete + export), editeur (draw + edit + move + delete elements), viewer (read-only, zoom/pan seulement). Les viewers ne voient pas les poignees de manipulation ni les outils de dessin (toolbar en lecture seule). Les editeurs ne peuvent pas supprimer le whiteboard ni modifier le partage.

### 7.2 Audit trail
Log de toutes les actions : creation, edition (nombre d'elements modifies), partage, export, suppression. Chaque entree : `whiteboard_id`, `user_id`, `action`, `details` (JSONB), `created_at`. Visible par l'admin dans le panneau d'audit. Retention : 1 an.

### 7.3 Limite de taille
Un whiteboard est limite a 5000 elements maximum pour des raisons de performance. Au-dela de 4000 elements, un avertissement s'affiche `Ce tableau contient beaucoup d'elements — les performances peuvent etre impactees`. A 5000, l'ajout de nouveaux elements est bloque avec un message `Limite de 5000 elements atteinte. Archivez ou supprimez des elements.`.

---

## Categorie 8 — Raccourcis clavier et accessibilite

### 8.1 Raccourcis clavier complets
| Raccourci | Action |
|---|---|
| `V` ou `1` | Outil selection (fleche) |
| `P` | Outil stylo |
| `L` | Outil ligne |
| `R` | Outil rectangle |
| `O` | Outil ellipse |
| `T` | Outil texte |
| `A` | Outil fleche |
| `C` | Outil connecteur |
| `E` | Outil gomme |
| `S` | Creer un post-it au centre |
| `D` | Outil losange |
| `F` | Outil frame |
| `H` ou `Espace` (maintenu) | Outil main (pan) |
| `Ctrl+G` | Grouper la selection |
| `Ctrl+Shift+G` | Degrouper |
| `Ctrl+D` | Dupliquer la selection |
| `Ctrl+A` | Selectionner tout |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | Copier / Couper / Coller |
| `Ctrl+=` / `Ctrl+-` | Zoom in / out |
| `Ctrl+0` | Reset zoom 100% |
| `Ctrl+1` | Fit to content |
| `Ctrl+R` | Toggle rulers |
| `Ctrl+G` (pas de selection) | Toggle grille |
| `Ctrl+]` / `Ctrl+[` | Monter / Descendre d'un niveau |
| `Ctrl+Shift+]` / `Ctrl+Shift+[` | Premier plan / Arriere-plan |
| `Delete` / `Backspace` | Supprimer la selection |
| `[` / `]` | Reduire / Agrandir l'epaisseur du trait |
| `Escape` | Desselectionner, quitter mode presentation |
| `?` | Afficher le panneau des raccourcis |

### 8.2 Accessibilite
- Contraste AA garanti sur toutes les couleurs de la palette (texte noir sur fond colore)
- Labels ARIA sur tous les boutons de la toolbar (`aria-label="Outil stylo"`, `aria-label="Zoom avant"`)
- Navigation au clavier dans la toolbar : Tab entre les outils, Enter pour activer
- Le canvas est focusable (`tabindex="0"`) et annonce le nombre d'elements via `aria-label`
- Les toasts et alertes sont annonces via `aria-live`

### 8.3 Mobile et tactile
Sur tablette et mobile :
- La toolbar se transforme en barre flottante en bas de l'ecran (dock style), scrollable horizontalement
- Les gestes tactiles : tap = clic, long-press = menu contextuel, two-finger pinch = zoom, two-finger drag = pan
- Le stylet (Apple Pencil, S Pen) est detecte via Pointer Events API : pression → variation d'epaisseur, palm rejection
- La barre de proprietes (couleur, epaisseur) apparait en popup flottante au-dessus de la selection
- Le bouton `Plein ecran` masque la barre d'adresse du navigateur pour maximiser la surface de dessin
- Les poignees de redimensionnement sont agrandies (12px au lieu de 6px) pour faciliter le touch

### 8.4 Securite et permissions
- Chaque whiteboard a un proprietaire. Roles : proprietaire (CRUD + share + delete + export), editeur (draw + edit + move + delete elements), viewer (read-only, zoom/pan seulement)
- Les viewers ne voient pas les poignees de manipulation ni les outils de dessin (toolbar en lecture seule)
- Les editeurs ne peuvent pas supprimer le whiteboard ni modifier le partage
- Audit trail : log de toutes les actions (creation, edition, partage, export, suppression)
- Un whiteboard est limite a 5000 elements maximum pour la performance

### 8.5 Limites de taille et quotas
- Elements max par whiteboard : 5000 (avertissement a 4000, blocage a 5000)
- Taille max d'une image inseree : 10 MB
- Nombre max d'images par whiteboard : 50
- Taille max du document Yjs : 50 MB (au-dela, les modifications les plus anciennes sont purgees du CRDT)
- Nombre max de whiteboards par utilisateur : 500
- Nombre max de collaborateurs simultanes : 20 par whiteboard
- Nombre max de snapshots par whiteboard : 50

### 8.6 Dark mode
Le whiteboard supporte le dark mode de SignApps :
- Le canvas passe d'un fond blanc (`#FFFFFF`) a un fond gris fonce (`#1E1E1E`)
- La grille de points passe de gris clair a gris fonce (`#3A3A3A`)
- Les formes conservent leurs couleurs de fill et stroke (pas d'inversion)
- Le texte par defaut passe de noir a blanc
- La toolbar et les panneaux utilisent les tokens semantiques (`bg-card`, `text-foreground`, `border-border`)
- Le minimap adapte son fond au mode
- L'export PNG/SVG conserve le fond du mode actif (option `Fond blanc` dans le dialogue d'export pour forcer le blanc meme en dark mode)

### 8.7 Historique et versions
Menu `Fichier > Historique des versions`. Panneau lateral listant les versions du whiteboard :
- Les snapshots nommes (crees manuellement via `Fichier > Nommer cette version`)
- Les versions automatiques (creees toutes les 10 minutes d'activite)
Clic sur une version affiche une preview en lecture seule du canvas a cet instant. Bouton `Restaurer` remplace le contenu actuel par cette version. L'historique conserve les 50 dernieres versions automatiques et tous les snapshots nommes (jamais purges).

### 8.8 Import de fichiers
Le whiteboard supporte l'import de fichiers externes :
- **SVG** : les elements SVG sont convertis en formes editables sur le canvas
- **PNG/JPEG** : inseres comme images (voir 2.5)
- **JSON SignApps** : reimport d'un export JSON d'un autre whiteboard
- **draw.io XML** : import des fichiers `.drawio` avec conversion des formes basiques (rectangles, ellipses, lignes, textes, connecteurs). Les formes specifiques draw.io non supportees sont converties en rectangles generiques avec le texte preserve.

Drag-and-drop d'un fichier sur le canvas ou `Fichier > Importer`. Dialogue de confirmation avec preview du nombre d'elements a importer.

### 8.9 Performance
- Le canvas utilise le rendu `OffscreenCanvas` quand disponible pour decharger le thread principal
- Le rendu est optimise par dirty-rectangle : seules les zones modifiees sont re-rendues
- Les whiteboards de plus de 1000 elements activent le viewport culling (seuls les elements visibles sont rendus)
- Les images sont chargees en lazy loading (placeholder gris jusqu'au chargement)
- Le document Yjs est compresse avec `y-indexeddb` pour minimiser le stockage local
- Cible : 60fps pour le zoom/pan et le dessin sur un whiteboard de 2000 elements

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Excalidraw Blog** (blog.excalidraw.com) — architecture, collaboration, performance, decisions de design.
- **tldraw Documentation** (tldraw.dev) — SDK, API, shapes, tools, collaboration.
- **Miro Academy** (academy.miro.com) — tutoriels, templates, bonnes pratiques de facilitation visuelle.
- **FigJam Help Center** (help.figma.com/hc/en-us/categories/360002051613-FigJam) — widgets, templates, collaboration.
- **Whimsical Guide** (whimsical.com/guide) — flowcharts, mind maps, wireframes, documentation.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Excalidraw** (github.com/excalidraw/excalidraw) | **MIT** | Architecture React + canvas, rendu SVG, collaboration Yjs, export multi-format. Reference principale. |
| **tldraw** (github.com/tldraw/tldraw) | **Apache-2.0** | SDK composant embeddable, shapes system, smart arrows, bindings, CRDT multiplayer. |
| **draw.io / diagrams.net** (github.com/jgraph/drawio) | **Apache-2.0** | Bibliotheques de formes exhaustives, export XML/SVG, integration Git. |
| **react-flow** (github.com/xyflow/xyflow) | **MIT** | Graphe de noeuds connectes. Pattern pour les connecteurs, le zoom/pan, le snap. |
| **Konva.js** (github.com/konvajs/konva) | **MIT** | Canvas 2D performant pour React (react-konva). Pattern pour le rendering, le hit detection, les transformations. |
| **Fabric.js** (github.com/fabricjs/fabric.js) | **MIT** | Canvas HTML5 interactif. Pattern pour les objets, la selection, le groupement, la serialisation JSON. |
| **perfect-freehand** (github.com/steveruizok/perfect-freehand) | **MIT** | Algorithme de lissage de traits pour le dessin a main levee. Sensibilite pression. |
| **rough.js** (github.com/rough-stuff/rough) | **MIT** | Rendu hand-drawn (sketchy) pour les formes geometriques. |

---

## Assertions E2E cles (a tester)

- Selectionner l'outil stylo (`P`), dessiner un trait → le path SVG apparait sur le canvas
- Tracer un rectangle (`R`), double-clic pour editer le texte → le texte s'affiche dans la forme
- Tracer une ligne avec fleche entre deux formes → la fleche suit quand on deplace une forme
- Placer un post-it (`S`), changer sa couleur → le fond se met a jour immediatement
- Zoom molette, pan avec espace+drag → navigation fluide sans saccade a 60fps
- Selectionner plusieurs elements, grouper (`Ctrl+G`) → deplacement en bloc
- Degrouper (`Ctrl+Shift+G`) → elements individuels de nouveau selectionnables
- Undo/Redo sur dessin, deplacement, suppression → chaque action est reversible
- Export SVG → le fichier telecharge contient toutes les formes vectorisees
- Export PNG → image rasterisee avec fond transparent si option activee
- Export JSON → reimport cree un whiteboard identique
- Effacer tout → canvas vide apres confirmation, undo restaure
- Changement de couleur dans la palette → le prochain trait utilise la nouvelle couleur
- Changement d'epaisseur → le prochain trait est plus epais/fin
- Collaboration : deux utilisateurs dessinent simultanement → les deux voient les traits en temps reel
- Curseurs distants visibles avec nom et couleur differente
- Selections distantes visibles avec bordure coloree et nom
- Deconnexion reseau → le canvas continue de fonctionner, banner hors-ligne affiche
- Reconnexion → synchronisation automatique, banner disparait
- Minimap → rectangle de viewport suit la navigation
- Snap-to-grid actif → les formes snappent aux points de grille
- Guides d'alignement → lignes rouges apparaissent quand deux formes sont alignees
- Layers panneau → reordonnement modifie le z-index visuellement
- Presentation mode → frames navigables en plein ecran avec fleches
- Template → nouveau whiteboard pre-rempli avec les formes du template
- Frame → deplacement du frame deplace les enfants
- Connecteur coude → routing orthogonal evite les chevauchements
