# Module Collaboration Visuelle — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Miro** | Infinite canvas, 250+ templates, sticky notes, mind maps, flowcharts, wireframes, Talktrack async video, voting, timer, presentation mode, 100+ integrations, real-time collaboration, clusters, tags, comments, frames |
| **FigJam** | Whiteboard collaboratif intégré Figma, stamps/reactions inline, AI-generated templates, widgets (voting, countdown, music), sections, connectors, audio chat intégré, Dev Mode bridge |
| **Lucidspark** | Brainstorming visuel, freehand drawing, sticky notes, voting, timer, breakout boards, emoji reactions, action items, integrations (Lucidchart, Jira, Slack), templates collaboratifs |
| **Whimsical** | Mind maps élégants, flowcharts, wireframes, docs — le tout dans un seul outil. Auto-layout intelligent, shortcuts clavier rapides, templates, nested boards, AI mind map generation |
| **MindMeister** | Mind mapping leader, collaboration temps réel, modes (mind map, org chart, outline), export PDF/PNG, intégration MeisterTask, themes, focus mode, history playback, presentations |
| **XMind** | Mind mapping professionnel, structures multiples (logic chart, org chart, tree, fishbone, matrix, timeline, brace), themes, markers, labels, export multi-format, pitch mode |
| **Coggle** | Mind maps collaboratifs simples, branches colorées drag-and-drop, loops (liens cross-branches), images inline, history playback, export PDF/PNG/text, real-time multi-user |
| **Mural** | Facilitation visuelle, templates design thinking, icebreakers, voting, timer, private mode, facilitator superpowers, rooms, integrations enterprise, accessibility features |
| **Excalidraw** | Whiteboard open source (MIT), hand-drawn style, real-time collab, library d'éléments, end-to-end encryption, embeddable, offline-first, export SVG/PNG |
| **Notion AI / Notion Boards** | Bases de données en vue Kanban, mind maps via intégrations, AI brainstorming, linked databases, toggle blocks pour l'arborescence, templates |
| **Trello** | Kanban référence, cards drag-and-drop, power-ups, Butler automation, checklists, due dates, labels, members, attachments, calendar view, timeline view |
| **Jira Board** | Kanban/Scrum boards, sprint planning, backlog grooming, swimlanes, WIP limits, quick filters, board configuration, automation rules, release tracking |

## Principes directeurs

1. **Canvas infini, pas de page** — l'espace de travail est un canvas zoomable et pannable sans bordure. L'utilisateur ne manque jamais de place. Les éléments sont positionnés librement.
2. **Multi-mode, un seul workspace** — Mind Map, Kanban, Brainstorm et Meeting Board sont des vues du même espace collaboratif. Les éléments créés dans un mode sont visibles dans les autres si pertinent.
3. **Collaboration temps réel native** — chaque action (création de noeud, déplacement de carte, ajout de sticky note) est propagée en < 200ms aux participants via CRDT (Yjs).
4. **AI comme co-créateur** — l'AI peut générer des mind maps à partir d'un sujet, suggérer des idées pendant un brainstorm, résumer les résultats d'une session, structurer un meeting board.
5. **Accessibilité au clavier** — toutes les actions sont réalisables au clavier. Navigation entre les noeuds par Tab/flèches. Ajout de noeud par Entrée. Les lecteurs d'écran annoncent la structure.
6. **Export et intégration** — les artefacts visuels (mind maps, boards) s'exportent en PNG/SVG/PDF et s'intègrent dans les modules Docs, Mail et Slides comme images ou embeds interactifs.

---

## Catégorie 1 — Mind Map Editor

### 1.1 Création de noeud racine
Un mind map commence par un noeud central (sujet principal). Texte éditable par double-clic. Le noeud racine est centré sur le canvas et ne peut pas être supprimé (seulement renommé).

### 1.2 Ajout de noeuds enfants
Sélectionner un noeud → Tab ou bouton `+` crée un noeud enfant connecté par une branche. Entrée crée un noeud frère (même niveau). Les branches se déploient automatiquement avec auto-layout (direction configurable : droite, gauche, radial, haut, bas).

### 1.3 Édition de texte inline
Double-clic sur un noeud active l'édition. Texte multi-ligne supporté. Markdown basique (gras, italique, lien). Escape valide. La taille du noeud s'adapte au contenu.

### 1.4 Styles de noeuds
Chaque noeud est personnalisable : couleur de fond, couleur de bordure, forme (rectangle, ellipse, losange, nuage, hexagone), icône (emoji ou bibliothèque d'icônes), image de fond. Héritage automatique du style parent pour les enfants.

### 1.5 Branches et connecteurs
Les branches connectant parent et enfant sont stylisables : couleur (par branche ou héritée du parent), épaisseur, style (droite, courbe, coudée). L'auto-layout ajuste les positions pour éviter les chevauchements.

### 1.6 Drag-and-drop de noeuds
Glisser un noeud pour le déplacer. Si glissé sur un autre noeud, il devient son enfant (reparenting). Si glissé dans le vide, il se détache (devient un noeud flottant). Feedback visuel : zone de drop highlight.

### 1.7 Fold/Unfold (plier/déplier)
Clic sur l'icône `-` d'un noeud pour replier ses enfants (masquer la sous-branche). Icône `+` pour déplier. Utile pour naviguer dans de grands mind maps. Raccourci clavier : `Space` sur un noeud sélectionné.

### 1.8 Mode Lite
Toggle « Mode Lite » qui simplifie l'affichage : masque les icônes, réduit les couleurs, affiche uniquement le texte. Utile pour l'impression ou la lecture concentrée.

### 1.9 Auto-layout et layouts multiples
Bouton « Réorganiser » applique un layout automatique. Choix du layout : `Droite` (classique), `Gauche`, `Radial` (centré), `Haut-Bas` (org chart), `Fishbone` (arêtes de poisson), `Timeline` (horizontal chronologique).

### 1.10 Liens cross-branches
Créer un lien visuel (flèche pointillée) entre deux noeuds de branches différentes. Utile pour montrer les relations transversales. Label optionnel sur le lien.

### 1.11 Notes et commentaires sur un noeud
Clic droit → `Ajouter une note` ouvre un panneau de texte riche lié au noeud. La note n'est pas affichée directement sur le canvas (icône indicateur). Les commentaires (avec @mentions) sont en thread.

### 1.12 Settings du mind map
Panneau de configuration : couleur de fond du canvas, thème global (Classique, Sombre, Pastel, Monochrome), direction par défaut, espacement entre noeuds, police par défaut.

---

## Catégorie 2 — Kanban Board

### 2.1 Colonnes configurables
Le Kanban a des colonnes nommées par l'utilisateur (ex : À faire, En cours, En revue, Fait). Ajout/suppression/renommage de colonnes. Réorganisation par drag-and-drop des colonnes.

### 2.2 Cartes Kanban
Chaque carte contient : titre, description (markdown), assigné(s) (avatars), labels (tags colorés), date d'échéance, priorité (badge), checklist, pièces jointes. Ajout rapide via un champ en bas de chaque colonne.

### 2.3 Drag-and-drop des cartes
Glisser une carte d'une colonne à l'autre change son statut. Glisser verticalement dans une colonne change l'ordre/priorité. Feedback visuel : ombre portée, zone de drop, animation.

### 2.4 WIP limits (limites de travail en cours)
Configurer une limite par colonne (ex : max 5 cartes en « En cours »). Si la limite est atteinte, la colonne affiche un warning visuel et l'ajout est bloqué (ou averti, selon la config).

### 2.5 Filtres et recherche
Barre de filtre au-dessus du board : par assigné, par label, par priorité, par date d'échéance, par texte libre. Les cartes non correspondantes sont grisées ou masquées.

### 2.6 Swimlanes (lignes horizontales)
Division horizontale du board par catégorie (ex : par projet, par équipe, par type). Chaque swimlane a son propre jeu de colonnes avec les mêmes statuts.

### 2.7 Vue compacte / détaillée
Toggle entre vue compacte (titre + assigné uniquement) et vue détaillée (tous les champs). Utile quand le board a beaucoup de cartes.

### 2.8 Automatisations basiques
Règles simples : « Quand une carte arrive dans Fait, notifier le créateur », « Quand la date d'échéance est dépassée, ajouter le label Rouge », « Quand toutes les checklist items sont cochées, déplacer vers En revue ».

---

## Catégorie 3 — Brainstorm et Idéation

### 3.1 Sticky notes sur canvas
Canvas infini avec des sticky notes (post-it virtuels) de couleurs variées. Ajout rapide par double-clic sur le canvas. Texte éditable. Redimensionnement libre. Empilement autorisé.

### 3.2 Catégorisation par couleur
Chaque couleur de sticky note représente une catégorie (configurable : idées, problèmes, solutions, questions, actions). Légende de couleurs affichée en haut du canvas.

### 3.3 Regroupement (clustering)
Glisser plusieurs sticky notes les unes sur les autres crée un cluster avec un titre. Utile pour l'affinity mapping. Les clusters sont pliables/dépliables.

### 3.4 Voting (dot voting)
Mode vote : chaque participant dispose de N votes (configurable). Clic sur une sticky note pour voter. Compteur de votes affiché sur chaque note. Le facilitateur peut révéler les résultats et trier par votes.

### 3.5 Timer de session
Timer visible par tous les participants : configurable (5min, 10min, 15min, custom). Alerte visuelle et sonore à la fin. Utile pour les phases de brainstorm timeboxées.

### 3.6 Mode privé (private mode)
Chaque participant écrit ses idées sans voir celles des autres. Le facilitateur active « Révéler » pour afficher toutes les idées simultanément. Évite l'ancrage cognitif.

### 3.7 AI ideation
Bouton « Générer des idées AI » avec prompt contextualisé (sujet du brainstorm). L'AI génère 5-10 sticky notes avec des idées créatives. L'utilisateur peut accepter, rejeter ou modifier chaque idée.

### 3.8 Conversion en actions
Sélectionner des sticky notes → « Convertir en tâches » crée des tâches dans le module Tasks/Projects avec le texte de la note. Lien retour vers la session de brainstorm.

### 3.9 Résumé de session
Bouton « Résumer la session » : l'AI génère un compte-rendu structuré (thèmes identifiés, top idées votées, actions décidées, participants). Export en PDF ou envoi par email.

---

## Catégorie 4 — Meeting Board

### 4.1 Template de réunion
Board pré-structuré avec les sections : Agenda, Notes, Décisions, Actions, Parking Lot. Chaque section est une zone du canvas avec un titre et une couleur distinctive.

### 4.2 Agenda interactif
Liste des points à l'ordre du jour avec durée estimée, responsable et timer par point. Le facilitateur avance de point en point. La durée totale est affichée. Alerte si un point dépasse son temps alloué.

### 4.3 Notes collaboratives
Zone de prise de notes en temps réel avec texte riche (markdown). Tous les participants peuvent écrire simultanément. Curseurs colorés visibles. Historique des contributions.

### 4.4 Décisions
Section dédiée aux décisions prises. Chaque décision a : texte, date, participants qui approuvent. Les décisions sont exportables et référençables dans d'autres modules.

### 4.5 Actions (action items)
Section dédiée aux actions décidées. Chaque action a : description, assigné, deadline. Bouton « Créer comme tâche » pousse l'action dans le module Tasks. Suivi de réalisation depuis le board.

### 4.6 Parking Lot
Section pour les sujets hors-scope remontés pendant la réunion. Non traités immédiatement mais conservés pour une future réunion. Chaque item peut être promu en point d'agenda d'une prochaine réunion.

### 4.7 Participants et présence
Liste des participants avec avatar, nom et indicateur de présence (en ligne / hors ligne). Intégration avec le module Calendar (participants de l'événement) et Meet (si la réunion est en cours).

### 4.8 Historique des réunions
Accès aux meeting boards passés par date. Chaque board est archivé avec ses notes, décisions et actions. Recherche full-text dans l'historique.

---

## Catégorie 5 — Canvas partagé et outils de dessin

### 5.1 Canvas infini
Zoom (molette, pinch) de 10% à 400%. Pan (clic central ou Space+clic). Minimap en bas à droite montrant la position dans le canvas global. Bouton « Fit to screen » pour cadrer tous les éléments.

### 5.2 Formes géométriques
Toolbar d'insertion : rectangle, ellipse, losange, triangle, étoile, flèche, ligne, courbe, texte libre, image. Chaque forme est redimensionnable, rotatable, colorable (fond + bordure).

### 5.3 Dessin libre (freehand)
Mode crayon pour dessiner à main levée sur le canvas. Couleur et épaisseur configurables. Gomme pour effacer des traits. Utile pour annoter, souligner, entourer.

### 5.4 Connecteurs intelligents
Créer une flèche entre deux éléments : la flèche suit les déplacements (connecteur ancré aux points d'accroche des formes). Types : flèche simple, double flèche, ligne sans flèche. Label sur le connecteur.

### 5.5 Frames (cadres)
Créer un cadre rectangulaire pour grouper des éléments. Le cadre a un titre et une couleur. Déplacer le cadre déplace tous les éléments à l'intérieur. Utile pour organiser le canvas en sections.

### 5.6 Images et médias
Insérer des images (upload, URL, clipboard), des vidéos embed (YouTube, SignApps Meet recording), des fichiers PDF (preview inline). Drag-and-drop depuis Drive.

### 5.7 Templates de canvas
Bibliothèque de templates : Business Model Canvas, SWOT, Lean Canvas, User Journey Map, Retrospective (Start/Stop/Continue), Sprint Planning, Design Thinking (Empathize/Define/Ideate/Prototype/Test).

---

## Catégorie 6 — Collaboration et partage

### 6.1 Curseurs temps réel
Chaque participant a un curseur coloré avec son nom visible par les autres. Les sélections et les zones de travail de chaque participant sont visibles.

### 6.2 Commentaires ancrés
Clic droit sur un élément → « Commenter ». Bulle de commentaire avec thread de réponses, @mentions, résolution. Panneau latéral listant tous les commentaires.

### 6.3 Reactions / Stamps
Bibliothèque de stamps (emoji, checkmark, question, exclamation, coeur) à placer sur le canvas ou sur des éléments spécifiques. Visibles par tous. Utiles pour le feedback asynchrone.

### 6.4 Partage et permissions
Partage du board avec rôles : Propriétaire, Éditeur, Commentateur, Lecteur. Partage par lien (avec ou sans mot de passe). Intégration avec le système de permissions SignApps.

### 6.5 Export multi-format
Export du canvas ou d'un frame sélectionné en : PNG (haute résolution), SVG (vectoriel), PDF. Export des cartes Kanban en CSV. Export du meeting board en Markdown.

### 6.6 Embed dans les autres modules
Un board collaboratif peut être inséré dans un document (Docs), un email (Mail) ou une présentation (Slides) comme widget interactif ou comme image statique.

### 6.7 Mode présentation
Naviguer dans le canvas frame par frame comme un diaporama. Chaque frame = une slide. Transitions fluides (zoom/pan). Laser pointer virtuel. Mode plein écran.

### 6.8 Historique et versionning
Timeline des modifications avec possibilité de restaurer un état antérieur. Playback mode : rejouer la construction du board comme une animation.

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **Miro Academy** (miro.com/academy) — guides sur le brainstorming, l'affinity mapping, le design thinking, les templates.
- **FigJam Help** (help.figma.com/figjam) — documentation sur les widgets, stamps, connectors, audio chat, templates.
- **Whimsical Help** (whimsical.com/help) — documentation sur les mind maps, flowcharts, wireframes, raccourcis clavier.
- **MindMeister Help** (support.mindmeister.com) — guides sur le mind mapping collaboratif, les structures, les modes de présentation.
- **XMind Blog** (xmind.app/blog) — tutoriels sur les structures de mind map, les use cases, les bonnes pratiques.
- **Excalidraw Blog** (blog.excalidraw.com) — articles sur l'architecture CRDT, le rendering canvas, la collaboration temps réel.
- **Mural Blog** (mural.co/blog) — guides sur la facilitation visuelle, les icebreakers, le design thinking.
- **Trello Guide** (trello.com/guide) — documentation sur les boards Kanban, les power-ups, les automatisations Butler.

### Projets open source permissifs à étudier comme pattern
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **Excalidraw** (github.com/excalidraw/excalidraw) | **MIT** | Whiteboard collaboratif canvas. Référence architecturale pour le canvas infini, les éléments, la collaboration CRDT. |
| **tldraw** (github.com/tldraw/tldraw) | **Apache-2.0** | Canvas collaboratif avec dessin libre, formes, connecteurs. Pattern pour le rendering et les interactions. |
| **reactflow** (github.com/xyflow/xyflow) | **MIT** | Diagrammes de flux interactifs React. Pattern pour les connecteurs, les noeuds drag-and-drop, le zoom/pan. |
| **markmap** (github.com/markmap/markmap) | **MIT** | Mind map depuis Markdown. Pattern pour le rendu SVG de mind maps et l'auto-layout. |
| **jsmind** (github.com/hizzgdev/jsmind) | **BSD-2-Clause** | Mind map library JS légère. Pattern pour les opérations de noeuds (add, move, fold). |
| **Yjs** (github.com/yjs/yjs) | **MIT** | CRDT pour la collaboration temps réel. Déjà utilisé dans SignApps. |
| **dnd-kit** (github.com/clauderic/dnd-kit) | **MIT** | Drag-and-drop accessible React. Pattern pour le Kanban et le réarrangement d'éléments. |
| **react-beautiful-dnd** (github.com/atlassian/react-beautiful-dnd) | **Apache-2.0** | Drag-and-drop pour les listes (Kanban). Pattern pour les colonnes et les cartes. |
| **Rough.js** (github.com/rough-stuff/rough) | **MIT** | Rendering hand-drawn style. Pattern pour un style visuel distinctive « croquis ». |
| **Konva.js** (github.com/konvajs/konva) | **MIT** | Canvas 2D HTML5 avec event system. Pattern pour les formes, les transformations, le hit detection. |
| **Fabric.js** (github.com/fabricjs/fabric.js) | **MIT** | Canvas interactif (objets, groupes, events, serialization JSON). Pattern pour le canvas partagé. |

### Pattern d'implémentation recommandé
1. **Canvas** : `tldraw` (Apache-2.0) ou `Excalidraw` (MIT) comme base canvas. Rendering via HTML5 Canvas ou SVG selon la complexité.
2. **Mind Map** : `markmap` (MIT) pour le rendu SVG + layout D3 custom. Données en arbre JSON synchronisé via Yjs.
3. **Kanban** : `dnd-kit` (MIT) pour le drag-and-drop. State Zustand. Colonnes et cartes stockées en base (repository pattern).
4. **Collaboration** : Yjs (MIT) + y-websocket pour la synchronisation temps réel de tous les modes. Un document Yjs par board.
5. **Brainstorm** : sticky notes comme éléments canvas avec propriétés (couleur, texte, position, votes). Voting via compteurs Yjs partagés.
6. **Meeting Board** : template structuré avec zones (agenda, notes, décisions, actions). Notes via Yjs shared text. Actions convertibles en tâches via API Tasks.
7. **Export** : `html2canvas` (MIT) pour le PNG. SVG export natif. PDF via `jsPDF` (MIT).

---

## Assertions E2E clés (à tester)

- Le mind map affiche un noeud racine éditable au centre du canvas
- Tab sur un noeud sélectionné crée un noeud enfant connecté
- Entrée sur un noeud sélectionné crée un noeud frère
- Double-clic sur un noeud active l'édition de texte inline
- Drag-and-drop d'un noeud sur un autre le reparente
- Fold/Unfold masque/affiche les enfants d'un noeud
- Le mode Lite simplifie l'affichage (texte seul)
- L'auto-layout réorganise proprement le mind map
- Le Kanban affiche les colonnes avec les cartes correspondantes
- Drag d'une carte d'une colonne à l'autre change son statut
- L'ajout rapide crée une carte en bas de la colonne
- Les WIP limits affichent un warning quand la limite est atteinte
- Les filtres par assigné/label masquent les cartes non correspondantes
- Les sticky notes de brainstorm sont créées par double-clic sur le canvas
- Le mode vote permet de voter et affiche les compteurs
- Le mode privé masque les notes des autres participants
- Le timer de session affiche le décompte visible par tous
- L'AI ideation génère des sticky notes avec des idées pertinentes
- Le meeting board affiche les sections Agenda, Notes, Décisions, Actions
- Le timer par point d'agenda alerte quand le temps est dépassé
- Les actions créées dans le meeting board se retrouvent dans le module Tasks
- Le canvas supporte zoom (10%-400%) et pan fluides
- Les connecteurs entre formes suivent les déplacements
- Le mode présentation navigue frame par frame
- L'export PNG produit une image haute résolution du canvas
- La collaboration temps réel affiche les curseurs des autres participants
- Les commentaires ancrés sur un élément sont visibles dans le panneau latéral
