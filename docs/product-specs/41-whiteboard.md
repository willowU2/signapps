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
Outil de dessin libre. Le trait suit le curseur avec lissage Bezier. Epaisseur configurable (1-20px). Couleur selectionnable dans la palette. Rendu SVG path. Support pression stylet (variation d'epaisseur).

### 1.2 Ligne droite
Tracer une ligne entre deux points. Clic-drag du point A au point B. Shift maintenu force l'alignement a 0/45/90 degres. Epaisseur et couleur configurables. Options de terminaison : aucune, fleche, cercle, losange.

### 1.3 Rectangle
Clic-drag pour definir le coin haut-gauche et bas-droit. Shift force un carre. Le rectangle supporte : couleur de fond (fill), couleur de bordure (stroke), epaisseur de bordure, coins arrondis (border-radius), texte centre integre editable au double-clic.

### 1.4 Cercle / Ellipse
Clic-drag pour definir le bounding box. Shift force un cercle parfait. Memes options de style que le rectangle : fill, stroke, epaisseur, texte integre.

### 1.5 Texte
Clic sur le canvas place un curseur de saisie. Taper du texte, avec police par defaut. Options : taille (12-72), gras, italique, couleur. Le bloc texte est deplacable et redimensionnable.

### 1.6 Gomme (Eraser)
Clic-drag efface les traits ou formes traverses. Deux modes : gomme de trait (efface le trait entier au contact) et gomme de zone (efface uniquement la zone survolee, decoupe les paths SVG).

### 1.7 Palette de couleurs
Palette de 8 couleurs principales visibles en permanence dans la toolbar : noir, gris, rouge, orange, jaune, vert, bleu, violet. Picker couleur custom accessible via un bouton `+`. La couleur selectionnee s'applique au prochain trait/forme.

### 1.8 Epaisseur du trait
Slider ou boutons predefinis (fin 1px, moyen 3px, epais 6px, tres epais 12px). Applique a l'outil actif (stylo, ligne, bordure de forme).

---

## Categorie 2 — Formes et objets structurels

### 2.1 Fleche (Arrow)
Forme composee d'une ligne avec une pointe de fleche. Clic-drag pour tracer. La fleche peut etre courbe (point de controle au milieu). Snap aux points d'ancrage des autres formes. Couleur et epaisseur configurables.

### 2.2 Post-it (Sticky Note)
Rectangle pre-style avec fond jaune (ou couleur choisie), ombre legere, texte editable au double-clic. Taille par defaut 120x100px, redimensionnable. Couleurs predefinies : jaune, rose, vert, bleu, orange, violet.

### 2.3 Losange (Decision)
Forme losange pour les diagrammes de flux (decision oui/non). Texte integre centre. Points d'ancrage sur les 4 sommets pour les connecteurs.

### 2.4 Connecteur (Connector)
Ligne qui se connecte entre deux formes via leurs points d'ancrage. Le connecteur suit la forme quand elle est deplacee (reactive routing). Styles : ligne droite, coude (orthogonal), courbe. Fleche optionnelle aux extremites.

### 2.5 Image
Insertion d'image par drag-drop ou bouton upload. L'image est placee sur le canvas, redimensionnable avec poignees. Export en base64 dans le JSON ou reference a un fichier Drive.

### 2.6 Cadre / Section (Frame)
Rectangle-conteneur qui groupe visuellement des elements. Les formes placees a l'interieur bougent avec le cadre. Titre editable en haut du cadre. Utile pour organiser un board en zones thematiques.

### 2.7 Groupement d'elements
Selection multiple (lasso ou Ctrl+clic) puis `Ctrl+G` pour grouper. Le groupe se deplace et se redimensionne comme un seul objet. `Ctrl+Shift+G` pour degrouper.

---

## Categorie 3 — Navigation et manipulation du canvas

### 3.1 Zoom et pan
Molette souris pour zoomer (10% a 800%). Clic molette (ou barre espace + clic-drag) pour pan. Gestes tactiles : pinch-zoom, two-finger pan. Indicateur de zoom en bas a gauche avec boutons +/- et `Fit to content`.

### 3.2 Minimap
Vue miniature en bas a droite montrant l'ensemble du canvas avec un rectangle representant le viewport actuel. Clic-drag sur la minimap pour naviguer rapidement.

### 3.3 Selection et manipulation
Outil Selection (fleche) : clic pour selectionner un element, clic-drag pour lasso multi-selection. Elements selectionnes affichent des poignees de redimensionnement (8 points) et un point de rotation. Deplacement par drag. Suppression par `Delete`.

### 3.4 Snap-to-grid et guides d'alignement
Grille optionnelle (toggle). Les formes snappent a la grille la plus proche. Guides d'alignement dynamiques apparaissent quand une forme est alignee avec une autre (centre, bord, espacement egal).

### 3.5 Undo / Redo illimite
`Ctrl+Z` undo, `Ctrl+Y` ou `Ctrl+Shift+Z` redo. Historique illimite pendant la session. Chaque action (dessin, deplacement, suppression, changement de style) est une entree dans l'historique.

### 3.6 Effacer tout (Clear)
Bouton `Effacer le tableau` dans la toolbar avec confirmation. Supprime tous les elements du canvas. L'undo peut restaurer.

---

## Categorie 4 — Collaboration temps reel

### 4.1 Connexion WebSocket (Yjs)
Le whiteboard se connecte a signapps-collab (port 3013) via WebSocket. Un document Yjs par whiteboard. Chaque forme est un element dans un Y.Array partage.

### 4.2 Curseurs distants
Chaque collaborateur connecte voit les curseurs des autres, avec nom et couleur distincts. Position mise a jour en temps reel (<100ms de latence).

### 4.3 Indicateur de connexion
Badge en haut a droite : `En ligne` (vert) avec nombre de collaborateurs, ou `Local` (gris) si pas de connexion serveur. Transition fluide entre les modes.

### 4.4 Resolution de conflits CRDT
Deux utilisateurs peuvent dessiner simultanement sans conflit grace au CRDT Yjs. Les formes sont ajoutees de maniere commutative. Pas de lock, pas de dialogue de conflit.

### 4.5 Mode hors-ligne
Si la connexion WebSocket est perdue, le canvas continue de fonctionner en local. Les modifications sont bufferisees et synchronisees au retour en ligne.

---

## Categorie 5 — Export et integration

### 5.1 Export SVG
Genere un fichier SVG vectoriel du canvas entier ou de la selection. Resolution independante, ideal pour l'impression et l'integration dans des documents.

### 5.2 Export PNG
Rasterisation du canvas en PNG avec resolution configurable (1x, 2x, 4x). Fond transparent optionnel.

### 5.3 Export PDF
Conversion du canvas en PDF multi-pages (si le contenu depasse une page) ou single-page a l'echelle.

### 5.4 Export JSON (sauvegarde/reimport)
Serialisation JSON de toutes les formes, styles, positions, connexions. Reimportable pour restaurer un whiteboard. Format ouvert et documente.

### 5.5 Integration avec les autres modules
- **Docs** : embed d'un whiteboard dans un document Docs comme bloc interactif
- **Chat** : partage d'un snapshot du whiteboard dans une conversation
- **Drive** : sauvegarde du whiteboard comme fichier dans Drive
- **Meet** : partage d'ecran du whiteboard pendant une visioconference

### 5.6 Templates pre-definis
Bibliotheque de templates : retrospective (colonnes Keep/Stop/Start), mind map, flowchart, wireframe, user story map, Kanban, org chart. Un template pre-remplit le canvas avec des formes et connecteurs.

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

- Selectionner l'outil stylo, dessiner un trait → le path SVG apparait sur le canvas
- Tracer un rectangle, double-clic pour editer le texte → le texte s'affiche dans la forme
- Tracer une ligne avec fleche entre deux formes → la fleche suit quand on deplace une forme
- Placer un post-it, changer sa couleur → le fond se met a jour immediatement
- Zoom molette, pan avec espace+drag → navigation fluide sans saccade
- Selectionner plusieurs elements, grouper (Ctrl+G) → deplacement en bloc
- Undo/Redo sur dessin, deplacement, suppression → chaque action est reversible
- Export SVG → le fichier telecharge contient toutes les formes vectorisees
- Export PNG → image rasterisee avec fond transparent si option activee
- Effacer tout → canvas vide apres confirmation, undo restaure
- Changement de couleur dans la palette → le prochain trait utilise la nouvelle couleur
- Changement d'epaisseur → le prochain trait est plus epais/fin
- Collaboration : deux utilisateurs dessinent simultanement → les deux voient les traits en temps reel
- Curseurs distants visibles avec nom et couleur differente
- Deconnexion reseau → le canvas continue de fonctionner, reconnexion synchronise
