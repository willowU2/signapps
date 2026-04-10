# Module Slides (présentations) — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Google Slides** | Collab temps réel, templates gallery, master slides, speaker notes, présentation avec Q&A, captions live, import/export PPTX, embed vidéo, laser pointer, thèmes synchronisés |
| **Microsoft PowerPoint** | Design Ideas (AI), Morph transitions, Designer, SmartArt, live captions multi-language, Presenter View avancée, animations avancées, rehearse with Coach, 3D models |
| **Apple Keynote** | Magic Move animations, Cinema-quality transitions, built-in shapes, multi-presenter, Live Video feed, drag-drop from Safari/Finder, design parfait |
| **Pitch** | Collab-first, analytics, workspace, templates modernes, version history, comments, present mode web |
| **Canva Presentations** | Templates abondants, drag-drop simple, animations, brand kit, stock photos/videos/audio, AI Magic Design |
| **Tome** | AI-first, génère un deck entier depuis un prompt, responsive layout, storytelling |
| **Gamma** | AI presentation generator, auto-layout, cards, mobile-friendly |
| **Beautiful.AI** | Smart templates qui s'auto-ajustent quand on ajoute du contenu |
| **Prezi** | Zoom-based transitions, non-linear storytelling |
| **Miro Slides** | Intégration avec whiteboard Miro, collab |
| **Slidebean** | AI slide builder, templates startups, pitch decks |
| **Decktopus** | AI-generated decks, simple UX |

## Principes directeurs

1. **Design par défaut beau** — templates professionnels, typographie harmonieuse, palette cohérente sans effort.
2. **Collaboration temps réel fluide** — plusieurs utilisateurs éditent un même deck, curseurs visibles.
3. **AI pour booster, pas remplacer** — générer un premier jet depuis un prompt, améliorer le wording, suggérer la mise en page.
4. **Compatibilité PPTX** — import/export fidèle pour interopérer avec les utilisateurs PowerPoint.
5. **Mode présentation pro** — speaker notes, preview de la prochaine slide, timer, laser pointer, télécommande mobile.
6. **Responsive et léger** — slides qui s'adaptent pour mobile et web, pas de Flash ni d'énormes fichiers.

---

## Catégorie 1 — Création et structure

### 1.1 Création d'un deck vierge
`Nouveau > Présentation` ouvre un deck avec une première slide (titre) et un thème par défaut.

### 1.2 Création depuis template
Galerie de templates : pitch startup, rapport annuel, cours, portfolio, événement, cheesy, minimaliste, coloré, monochrome. Filtres par catégorie et style.

### 1.3 Création depuis un prompt IA
Champ "Décrivez votre présentation" → "Présentation de 10 slides sur l'impact de l'IA dans l'éducation, ton pédagogique" → l'IA génère un deck complet avec titres, bullet points, images suggérées.

### 1.4 Import depuis PPTX / Keynote / Google Slides
Upload ou import direct via URL. Conservation du layout, polices, couleurs, images, animations. Warning sur les éléments non supportés.

### 1.5 Import depuis un doc / PDF
Le LLM extrait la structure d'un document long (titres = slides) et génère un deck. Rapide pour convertir un article en présentation.

### 1.6 Création depuis outline
Outliner view : taper les titres (un par ligne) → génère automatiquement les slides.

### 1.7 Panel latéral de slides (navigation)
Sidebar gauche avec miniatures de toutes les slides. Drag pour réordonner. Clic pour naviguer. Duplication, suppression, hide.

### 1.8 Sections et groupements
Organiser les slides en sections (Introduction, Body, Conclusion). Pliable dans le panneau. Navigation rapide.

### 1.9 Duplication de slide
`Ctrl+D` pour dupliquer une slide avec tout son contenu.

### 1.10 Réorganisation
Drag-drop dans la sidebar. Raccourcis `Ctrl+Up/Down` pour monter/descendre.

### 1.11 Slides cachées
Option `Masquer cette slide` → elle n'apparaît pas en présentation mais reste dans le deck. Utile pour les backups ou les slides optionnelles.

### 1.12 Templates personnalisés
Sauvegarder un deck comme template personnel ou d'organisation.

---

## Catégorie 2 — Édition de slide (canvas)

### 2.1 Canvas libre
Slide = canvas rectangulaire avec aspect ratio configurable (16:9, 4:3, 1:1 square, 9:16 vertical mobile, custom). Drop zone pour placer des éléments librement.

### 2.2 Grille et guides
Grille invisible alignable. Guides de positionnement (snap to other elements, snap to grid, snap to center). Règles sur les bords. Alt pour désactiver.

### 2.3 Layouts pré-définis
Dropdown `Layout` avec options : Title, Title+Body, Title+2Column, Title+Image+Text, Full image, Blank, Comparison, Quote, Section divider. Appliquer un layout remplace les placeholders.

### 2.4 Master slide et thème
Le thème définit les polices, couleurs, logos, background, styles de titre et de body. Modifier le master propage à toutes les slides héritant. Mode `Édition du master` séparé.

### 2.5 Background par slide
Override du background hérité : couleur, gradient, image, vidéo, pattern.

### 2.6 Undo/Redo exhaustif
Ctrl+Z/Ctrl+Y avec historique profond (100+ steps).

### 2.7 Zoom du canvas
Ctrl+Scroll ou slider pour zoomer dans la slide en édition. Fit to screen, 100%, 50%, 200%.

### 2.8 Rulers et guides draggables
Tirer des guides depuis les rulers pour aligner précisément.

### 2.9 Multi-select et alignement
Sélectionner plusieurs éléments (Shift+clic, drag-select). Boutons align : gauche, centre, droite, haut, milieu, bas, distribute horizontal/vertical.

### 2.10 Group / Ungroup
Grouper plusieurs éléments pour les déplacer/resize ensemble. Ungroup pour les dissocier.

### 2.11 Lock / Unlock
Verrouiller un élément pour éviter de le bouger par erreur.

### 2.12 Layers et z-index
Amener au premier plan, envoyer à l'arrière-plan, déplacer d'un niveau. Panel Layers pour visualiser la hiérarchie.

---

## Catégorie 3 — Éléments insérables

### 3.1 Text boxes
Texte avec placeholder. Rich formatting (gras, italique, souligné, couleur, taille, police, alignement, listes). Liens cliquables.

### 3.2 Shapes
Rectangle, cercle, triangle, ligne, flèche, étoile, cloud, callout, et formes libres (polygon). Customisation complète : fill, stroke, shadow, rounded corners.

### 3.3 Images
Upload depuis le drive, URL, stock photos (Unsplash, Pexels integration), ou webcam. Resize avec poignées, crop, masque, filtres (luminosité, saturation, N&B, blur).

### 3.4 Vidéos
Upload ou embed YouTube/Vimeo. Autoplay, loop, start/end time. Mini-player inline.

### 3.5 Audio
Upload ou URL. Play en arrière-plan, par slide ou globalement.

### 3.6 Tables
Insertion de tables (comme dans Docs) avec nombre de colonnes/lignes. Édition inline, styles.

### 3.7 Charts
Insertion de graphiques. Données saisies inline ou liées à un tableur SignApps. Types : bar, line, pie, scatter, area, column, combo. Ré-apparence automatique si la source change.

### 3.8 SmartArt (diagrammes)
Diagrammes pré-définis : process, hierarchy, cycle, relationship, matrix, pyramid, list. Conversion texte → diagramme visuel.

### 3.9 Icônes et illustrations
Bibliothèque d'icônes (1000+) et illustrations style Notion/Storyset. Recherche par mot-clé. Couleurs personnalisables.

### 3.10 Equations (LaTeX)
Insertion d'équations mathématiques via LaTeX. Rendu KaTeX.

### 3.11 Code blocks
Bloc de code avec syntax highlighting. Pour les présentations techniques.

### 3.12 3D models
Import de GLB/STL/OBJ. Rotation interactive en mode présentation.

### 3.13 Embed (iframes)
Embed d'un site web, d'un doc Google, d'un Tweet, d'un Figma, etc. Interactif en présentation.

### 3.14 Sticky notes / comments (pour collab)
Post-it virtuels pour annoter pendant l'édition collaborative. Masqués en présentation.

### 3.15 GIFs
Recherche et insertion de GIFs (Giphy integration).

---

## Catégorie 4 — Animations et transitions

### 4.1 Animations d'élément
Faire apparaître un élément avec une animation : Fade in, Slide in, Zoom in, Bounce, Fly in. Timing : au clic, après X secondes, avec la slide.

### 4.2 Animations de sortie
Faire disparaître un élément : Fade out, Slide out, etc.

### 4.3 Animations d'emphasis
Mettre en avant un élément déjà visible : Pulse, Flash, Shake, Grow, Spin.

### 4.4 Animations paths
Déplacer un élément sur un chemin (ligne, courbe, arc, libre). Utilisé pour les démos visuelles.

### 4.5 Chained animations
Séquence d'animations qui s'enchaînent (ex: 1er bullet apparaît, puis 2e, puis 3e automatiquement).

### 4.6 Transitions de slide
Entre deux slides : Fade, Slide (left/right/up/down), Zoom, Flip, Cube, Push, Reveal, Dissolve, Morph (le plus sophistiqué : les éléments communs entre deux slides s'animent de l'un à l'autre).

### 4.7 Durée et timing
Chaque animation a sa durée (100ms à 5s) et son timing function (ease, linear, cubic, bounce).

### 4.8 Prévisualisation
Bouton `Jouer` pour prévisualiser les animations de la slide courante sans entrer en mode présentation.

### 4.9 Animation pane
Panel listant toutes les animations d'une slide, dans l'ordre. Drag pour réordonner. Éditer les propriétés.

### 4.10 Animations custom avec keyframes (power users)
Timeline d'animation avec keyframes pour les cas avancés. Similar to After Effects.

---

## Catégorie 5 — Mode présentation

### 5.1 Mode plein écran
`F5` démarre la présentation depuis la première slide. `Shift+F5` démarre depuis la slide courante. `Escape` pour quitter.

### 5.2 Navigation
Flèches droite/bas ou espace pour avancer. Flèche gauche/haut pour reculer. `Home` pour revenir à la 1ère. `End` pour la dernière. `Numéro + Enter` pour sauter à une slide précise.

### 5.3 Presenter view (vue présentateur)
Écran secondaire pour le présentateur : slide courante, prochaine slide en miniature, speaker notes, timer, heure, laser pointer, tools (pen, highlighter, eraser).

### 5.4 Laser pointer
Touche `L` ou clic droit → curseur transformé en laser rouge pour attirer l'attention.

### 5.5 Pen et highlighter (annotations)
Dessiner/surligner sur les slides pendant la présentation. Effaceur. Les annotations peuvent être sauvegardées en fin de présentation.

### 5.6 Zoom sur une partie de la slide
Zoomer pendant la présentation pour mettre en évidence un détail. Shortcut `Z + clic`.

### 5.7 Slide navigator
Touche `Esc` ou clic sur miniature affiche une grille de toutes les slides pour naviguer visuellement.

### 5.8 Black/White screen
Touche `B` → écran noir (pour passer à la démo). `W` → écran blanc. Re-press pour reprendre.

### 5.9 Timer et rehearsal
Timer visible pour le présentateur. Mode `Rehearse` qui enregistre le temps passé sur chaque slide pour calibrer la prochaine présentation.

### 5.10 Télécommande mobile
App mobile qui contrôle la présentation depuis le téléphone (avancer, reculer, laser, notes).

### 5.11 Live captions (auto-transcription)
Sous-titres automatiques générés en temps réel par STT pendant la présentation. Traduction live en d'autres langues.

### 5.12 Q&A live
Audience peut poser des questions via un lien partagé, visibles par le présentateur qui peut les afficher au public.

### 5.13 Polls et quiz interactifs
Slides avec polls votables en temps réel par l'audience. Résultats affichés en direct.

### 5.14 Live audience reactions
Audience peut envoyer des emojis de réaction (clapping, heart, etc.) visibles en bas de l'écran.

### 5.15 Présentation web partagée (no-install)
Lien public `signapps.com/p/abc123` où l'audience peut suivre depuis leur navigateur sans installer quoi que ce soit. Scroll/clic synchronisé avec le présentateur.

### 5.16 Self-paced (slideshow exporté)
Mode "autoplay avec timing" pour les kiosks ou les slides d'accueil automatiques.

### 5.17 Resume from break
Si la présentation est interrompue, reprise exacte où on en était.

---

## Catégorie 6 — Collaboration

### 6.1 Édition temps réel
Plusieurs utilisateurs éditent le même deck simultanément. Curseurs visibles avec nom. Sélection d'un élément par un collègue rend l'élément "locked" pour les autres.

### 6.2 Commentaires sur une slide
Panneau de commentaires attaché à une slide ou à un élément spécifique. @mentions, threads, résolution.

### 6.3 Suggestions d'édition (review mode)
Mode suggestion : les modifications deviennent des propositions à accepter/rejeter par le propriétaire.

### 6.4 Version history
Historique complet des modifications. Restaurer une version antérieure. Nommer une version ("v1 finale").

### 6.5 Partage avec niveaux de permission
Lecteur, Commentateur, Éditeur, Propriétaire. Lien public avec restrictions (expiration, password, pas de téléchargement).

### 6.6 Live co-presentation
Plusieurs présentateurs peuvent animer la présentation ensemble (tour de parole). Passing of control visible.

### 6.7 Notification de changements
Toast "Jean a modifié la slide 5" quand un collègue fait un changement.

### 6.8 Conflict resolution
Pour les éditions simultanées sur le même élément, dernière modification gagne avec diff visible.

---

## Catégorie 7 — IA intégrée

### 7.1 Générer un deck depuis un prompt
Input "Créer une présentation de 15 slides sur la transformation digitale des PMEs, ton professionnel, avec graphiques et exemples" → deck complet généré (titre, sous-titres, bullets, suggestions de visuels).

### 7.2 Design Ideas / Magic Design
Sélectionner une slide avec du contenu brut → l'IA propose 5 layouts designés. Accepter en un clic. Similaire à PowerPoint Designer.

### 7.3 Améliorer le wording
Sélectionner du texte → `IA > Améliorer` → suggestions pour rendre plus clair, concis, impactant.

### 7.4 Changer le ton
`IA > Ton` → plus formel, plus décontracté, plus persuasif, plus académique.

### 7.5 Traduction automatique
Traduire tout le deck en une autre langue. Mise en forme préservée.

### 7.6 Suggestions de visuels
Pour une slide avec du texte, l'IA suggère des images, icônes, charts qui complémentent le message.

### 7.7 Notes du présentateur
Générer automatiquement les speaker notes pour chaque slide basées sur le contenu.

### 7.8 Résumé d'un long document
Convertir un doc de 10 pages en présentation structurée de 12 slides avec les points clés.

### 7.9 Q&A anticipation
L'IA prédit les questions probables de l'audience et suggère des réponses à préparer.

### 7.10 Assistant conversationnel
Panneau `Ask AI` : "Ajoute une slide sur les risques", "Rends cette slide plus visuelle", "Change les couleurs pour être plus sobre".

### 7.11 Auto-check
L'IA vérifie la qualité : trop de texte par slide, images manquant d'alt text, polices illisibles, contrastes insuffisants. Rapport avec recommandations.

---

## Catégorie 8 — Import / Export et compatibilité

### 8.1 Import PPTX
Upload `.pptx` → conversion avec préservation de 95% du contenu (shapes, text, animations simples, images, charts).

### 8.2 Import Keynote
Upload `.key` → conversion similaire.

### 8.3 Import Google Slides
Via URL ou export `.pptx` depuis Google Slides → import.

### 8.4 Export PPTX
Télécharger en `.pptx` compatible PowerPoint. Animations exportées au mieux.

### 8.5 Export PDF
`Fichier > Exporter > PDF`. Options : mise en page (1 slide/page, 2, 4, 6 sur une page), handouts avec notes, couleur/N&B. Password protection.

### 8.6 Export images
Chaque slide exportée en PNG, JPG, ou SVG individuellement ou en ZIP.

### 8.7 Export vidéo (MP4)
Générer une vidéo de la présentation avec narration audio, durée par slide, transitions. Utile pour YouTube, tutoriels asynchrones.

### 8.8 Export GIF
Slideshow animé en GIF pour réseaux sociaux.

### 8.9 Export Markdown / HTML
Export du contenu textuel en MD pour documentation. HTML pour publication web.

### 8.10 Embed sur un site web
Code iframe à coller dans un site pour embed la présentation. Interactive avec navigation.

### 8.11 Publier sur le web
URL publique stable avec la présentation web (lecture seule). Contrôle d'accès.

### 8.12 Print handouts
Impression avec layout 1/2/4/6 slides par page, speaker notes optionnelles, numéros de page.

---

## Catégorie 9 — Mobile et accessibilité

### 9.1 Application mobile native
iOS/Android : consulter, éditer basique, présenter depuis mobile. Airplay/Chromecast pour projeter.

### 9.2 Présentation mobile
Swipe pour naviguer entre slides. Tap pour avancer. Mode présenter view sur le téléphone du présentateur + slide sur le grand écran.

### 9.3 Accessibilité WCAG AA
Alt text sur toutes les images, navigation clavier, contrastes, screen reader annonces.

### 9.4 Keyboard shortcuts
- `Ctrl+M` : nouvelle slide
- `F5` : présentation depuis la 1ère
- `Shift+F5` : présentation depuis la courante
- `Ctrl+D` : dupliquer slide
- `Ctrl+Up/Down` : réorganiser slides
- `Ctrl+Enter` : nouvelle slide après
- `Escape` : quitter présentation
- `B/W` : écran noir/blanc
- `L` : laser
- `?` : aide

### 9.5 Responsive export
Export vers slides responsive (HTML) qui s'adaptent au mobile.

### 9.6 Offline mode
Édition hors-ligne. Sync au retour.

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **Google Slides Help** (support.google.com/docs/topic/1360904) — templates, master, animations, collaboration.
- **Microsoft PowerPoint Help** (support.microsoft.com/powerpoint) — Design Ideas, Morph, Presenter Coach, animations avancées.
- **Apple Keynote User Guide** (support.apple.com/guide/keynote) — Magic Move, design parfait, multimedia.
- **Pitch Help** (help.pitch.com) — collab, templates modernes, analytics.
- **Canva Help** (canva.com/help) — templates, brand kit, Magic Design.
- **Tome Blog** (tome.app/blog) — AI-first deck generation.
- **Gamma Help** (help.gamma.app) — AI-generated slides, responsive.
- **Beautiful.AI Support** (help.beautiful.ai) — smart templates auto-adjusting.

### Projets open source permissifs
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **Reveal.js** (revealjs.com) | **MIT** | Framework de présentations HTML/JS. Transitions, markdown, syntax highlighting. Peut servir de base pour le mode présentation web. |
| **impress.js** (impress.js.org) | **MIT** | Présentations non-linéaires avec zoom (Prezi-style). |
| **Slidev** (sli.dev) | **MIT** | Présentations pour devs avec markdown et Vue. Code highlighting, export PDF. |
| **Deckset** | Commercial | Pour inspiration uniquement. |
| **Remark** (remarkjs.com) | **Apache-2.0** | Présentations markdown simples. |
| **Spectacle** (formidable.com/open-source/spectacle) | **MIT** | Library React pour créer des présentations. Excellent pattern. |
| **MDX Deck** (github.com/jxnblk/mdx-deck) | **MIT** | Présentations React avec MDX. |
| **Fabric.js** (fabricjs.com) | **MIT** | Canvas library pour éditeur de forme libre. Base pour un canvas slide. |
| **Konva.js** (konvajs.org) | **MIT** | Alternative à Fabric.js, performant pour les canvas interactifs. |
| **Excalidraw** (excalidraw.com, github.com/excalidraw/excalidraw) | **MIT** | Whiteboard collab avec formes. Bon pattern pour les diagrammes et SmartArt. |
| **tldraw** (tldraw.com, github.com/tldraw/tldraw) | **Apache-2.0** (2024) | Whiteboard avec infinite canvas, excellent UX. |
| **pptxgen.js** / **pptxgenjs** (gitbrent.github.io/PptxGenJS) | **MIT** | Génération de fichiers PPTX depuis JS. Pour l'export. |
| **officegen** (github.com/Ziv-Barber/officegen) | **MIT** | Génération docx/pptx/xlsx. |
| **JSZip** (stuk.github.io/jszip) | **MIT** | Manipulation de ZIP (format interne PPTX). |
| **PDFKit** (pdfkit.org) | **MIT** | Génération de PDFs pour l'export. |
| **pdf-lib** (pdf-lib.js.org) | **MIT** | Alternative moderne pour la génération de PDF. |
| **Chart.js** (chartjs.org) | **MIT** | Graphiques dans les slides. |
| **ECharts** (echarts.apache.org) | **Apache-2.0** | Graphiques avancés. |
| **Three.js** (threejs.org) | **MIT** | 3D models rendering. |
| **gsap** (greensock.com/gsap) | **Standard License** (no-charge commercial) | **Attention licence**. Animations web. Alternative : Framer Motion. |
| **Framer Motion** (framer.com/motion) | **MIT** | Animations React. Pour les transitions custom. |
| **Lottie** (lottiefiles.com) | **MIT** | Animations vectorielles After Effects. |

### Pattern d'implémentation recommandé
1. **Canvas éditeur** : Fabric.js (MIT) ou Konva.js (MIT) pour le canvas libre avec shapes, text, images, transform handles.
2. **Rendering des slides** : DOM/SVG hybrid pour l'édition, HTML pour la présentation web.
3. **Mode présentation web** : inspiration Reveal.js (MIT), implémentation custom avec React pour intégration.
4. **Transitions** : Framer Motion (MIT) pour les animations d'éléments et de slides.
5. **Import/Export PPTX** : JSZip (MIT) pour décompresser, parsing XML custom pour lire la structure OOXML, pptxgenjs (MIT) pour l'export.
6. **Graphiques** : Chart.js (MIT) intégré dans les slides.
7. **3D models** : Three.js (MIT) avec GLTFLoader.
8. **Collaboration** : Yjs (MIT) comme pour Docs.
9. **Export PDF** : pdf-lib (MIT) ou génération browser-side via Print API.
10. **Export vidéo (MP4)** : ffmpeg.wasm (LGPL, **attention** linkage dynamique) ou traitement serveur.
11. **AI generation** : LLM interne avec prompt templates contextuels. Output structuré (JSON schema du deck).

### Ce qu'il ne faut PAS faire
- **Pas de gsap sans licence commerciale** — preferer Framer Motion.
- **Pas de reveal.js fork entier** — s'inspirer du pattern, reecrire.
- **Attention a OOXML (PPTX)** : format complexe, ne pas reimplementer entierement — utiliser pptxgenjs et officegen.

---

## UI Behavior Details

### Editor Layout
Three-panel layout. Left sidebar (15%): slide navigator showing miniatures in vertical stack. Each miniature is numbered, shows a scaled preview of the slide content. Active slide has a blue border. Right-click a miniature: context menu with Duplicate, Delete, Hide, Move Up, Move Down, Copy to another deck. Sections appear as collapsible group headers between miniatures. Center area (65%): the slide canvas at the selected zoom level. Canvas shows the active slide with all elements. Grid overlay (toggle via View > Grid). Rulers on top and left edges. Right sidebar (20%): context-sensitive properties panel. When no element is selected: slide properties (background, layout preset, notes). When an element is selected: element properties (position x/y, size w/h, rotation, fill, stroke, shadow, opacity, font settings for text, image filters for images).

### Slide Canvas Interaction
Click on an empty area deselects all elements. Click an element to select it — 8 resize handles appear (corners + midpoints). Corner handles maintain aspect ratio by default (hold Shift to free-resize). Rotation handle above the top-center. Double-click a text box to enter text editing mode — cursor appears, toolbar switches to text formatting options. Drag an element to move it — snap guides appear (red dashed lines) when aligned with other elements or the slide center. Hold Alt to disable snapping. Copy-paste elements: Ctrl+C/V duplicates the element offset by 10px.

### Master Slide Editor
Access via View > Edit Master. The canvas switches to show the master slide template. Changes to fonts, colors, logo placement, and background propagate to all slides inheriting this master. A list of layout variants appears in the left sidebar (Title Slide, Content, Two-Column, Blank, etc.). Each layout can be customized independently. "Done Editing Master" button returns to normal editing.

### Animation Pane
Toggle via View > Animations. A timeline panel appears below the canvas. Lists all animations on the current slide in execution order. Each row shows: element name, animation type icon, trigger (on-click / with-previous / after-previous), duration bar. Drag rows to reorder. Click a row to edit properties: effect, duration, delay, easing function. Play button in the pane header previews all animations sequentially.

### Presenter View
When presenting on an external display, the presenter's screen shows: current slide (large, left), next slide (small, top-right), speaker notes (bottom-right, scrollable), elapsed time, current time, slide counter (e.g., "7/24"). Toolbar at bottom: pen tool, highlighter, eraser, laser pointer toggle, slide navigator (grid), zoom, black/white screen, end show. Notes font size adjustable with +/- buttons.

### Collaboration
Multiple users editing the same deck see colored cursors on the canvas. When user A selects an element, it shows a colored lock icon for user B. User B can still view but not edit that element until A deselects. Comments are anchored to a specific slide (pinned to coordinates). Comment thread panel slides in from the right. Real-time typing indicators in comments.

### Keyboard Shortcuts (expanded)

| Shortcut | Context | Action |
|----------|---------|--------|
| `Ctrl+M` | Editor | Insert new slide after current |
| `Ctrl+D` | Editor | Duplicate current slide |
| `Ctrl+Enter` | Editor | Insert new slide |
| `Delete` | Editor | Delete selected element(s) |
| `Ctrl+G` | Editor | Group selected elements |
| `Ctrl+Shift+G` | Editor | Ungroup |
| `Ctrl+L` | Editor | Lock/unlock selected element |
| `Ctrl+]` | Editor | Bring forward one layer |
| `Ctrl+[` | Editor | Send backward one layer |
| `Ctrl+Shift+]` | Editor | Bring to front |
| `Ctrl+Shift+[` | Editor | Send to back |
| `Ctrl+A` | Editor | Select all elements on slide |
| `Ctrl+C/V/X` | Editor | Copy/paste/cut elements |
| `Ctrl+Z/Y` | Editor | Undo/redo |
| `Ctrl+Up/Down` | Sidebar | Move slide up/down |
| `F5` | Any | Start presentation from slide 1 |
| `Shift+F5` | Any | Start from current slide |
| `Escape` | Presentation | Exit presentation |
| `B` | Presentation | Black screen toggle |
| `W` | Presentation | White screen toggle |
| `L` | Presentation | Toggle laser pointer |
| `P` | Presentation | Toggle pen tool |
| `H` | Presentation | Toggle highlighter |
| `E` | Presentation | Erase all annotations |
| `Z` + click | Presentation | Zoom into area |
| `G` | Presentation | Show slide grid navigator |
| `Right/Down/Space` | Presentation | Next slide/animation |
| `Left/Up` | Presentation | Previous slide/animation |
| `Home` | Presentation | First slide |
| `End` | Presentation | Last slide |
| `Number + Enter` | Presentation | Jump to slide N |
| `?` | Presentation | Show shortcut help overlay |

---

## Schema PostgreSQL

```sql
-- Presentation decks
CREATE TABLE slide_decks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    title VARCHAR(512) NOT NULL DEFAULT 'Untitled Presentation',
    description TEXT,
    aspect_ratio VARCHAR(10) NOT NULL DEFAULT '16:9', -- 16:9, 4:3, 1:1, 9:16, custom
    custom_width INT, -- only if aspect_ratio = custom
    custom_height INT,
    theme JSONB DEFAULT '{}', -- {font_heading, font_body, colors: {primary, secondary, bg, text}, logo_url}
    master_slides JSONB DEFAULT '[]', -- [{id, name, layout, background, elements[]}]
    slide_count INT NOT NULL DEFAULT 0,
    is_template BOOLEAN NOT NULL DEFAULT false,
    template_category VARCHAR(64),
    current_version INT NOT NULL DEFAULT 1,
    thumbnail_url TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_slide_decks_workspace ON slide_decks(workspace_id);
CREATE INDEX idx_slide_decks_template ON slide_decks(is_template) WHERE is_template = true;

-- Individual slides
CREATE TABLE slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id UUID NOT NULL REFERENCES slide_decks(id) ON DELETE CASCADE,
    sort_order INT NOT NULL,
    master_layout VARCHAR(64) DEFAULT 'blank', -- title, title_body, two_column, full_image, blank, comparison, quote, section_divider
    background JSONB DEFAULT '{}', -- {type: "color"|"gradient"|"image"|"video", value: "...", opacity: 1}
    transition JSONB DEFAULT '{}', -- {type: "fade"|"slide"|"zoom"|"morph"|"flip", duration_ms: 500, easing: "ease"}
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    section_name VARCHAR(255), -- for grouping slides into sections
    speaker_notes TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_slides_deck ON slides(deck_id, sort_order);

-- Slide elements (text, shapes, images, charts, etc.)
CREATE TABLE slide_elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slide_id UUID NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
    element_type VARCHAR(32) NOT NULL, -- text, shape, image, video, audio, table, chart, smart_art, icon, equation, code_block, embed, gif, model_3d, sticky_note
    position_x NUMERIC(10,2) NOT NULL DEFAULT 0, -- percentage of slide width
    position_y NUMERIC(10,2) NOT NULL DEFAULT 0,
    width NUMERIC(10,2) NOT NULL DEFAULT 20,
    height NUMERIC(10,2) NOT NULL DEFAULT 10,
    rotation NUMERIC(6,2) NOT NULL DEFAULT 0, -- degrees
    z_index INT NOT NULL DEFAULT 0,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    group_id UUID, -- for grouped elements
    opacity NUMERIC(3,2) NOT NULL DEFAULT 1.0,
    content JSONB NOT NULL DEFAULT '{}', -- type-specific: text: {html, font, size, color, align}, image: {url, crop, filters}, shape: {shape_type, fill, stroke, corners}
    animations JSONB DEFAULT '[]', -- [{type: "fade_in"|"slide_in"|..., trigger: "on_click"|"with_previous"|"after_previous", duration_ms, delay_ms, easing}]
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_slide_elements_slide ON slide_elements(slide_id, z_index);
CREATE INDEX idx_slide_elements_group ON slide_elements(group_id) WHERE group_id IS NOT NULL;

-- Deck versions
CREATE TABLE slide_deck_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id UUID NOT NULL REFERENCES slide_decks(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    version_name VARCHAR(255), -- e.g., "v1 finale"
    snapshot JSONB NOT NULL, -- full deck + slides + elements
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_slide_versions ON slide_deck_versions(deck_id, version_number DESC);

-- Comments on slides
CREATE TABLE slide_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id UUID NOT NULL REFERENCES slide_decks(id) ON DELETE CASCADE,
    slide_id UUID NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES slide_comments(id), -- for threaded replies
    author_id UUID NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    position_x NUMERIC(10,2), -- anchor position on slide (null = general comment)
    position_y NUMERIC(10,2),
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_slide_comments_slide ON slide_comments(slide_id);
CREATE INDEX idx_slide_comments_deck ON slide_comments(deck_id);

-- Live presentation sessions
CREATE TABLE slide_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id UUID NOT NULL REFERENCES slide_decks(id),
    presenter_id UUID NOT NULL REFERENCES users(id),
    current_slide_index INT NOT NULL DEFAULT 0,
    session_code VARCHAR(8) NOT NULL, -- short code for audience to join
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX idx_slide_sessions_code ON slide_sessions(session_code) WHERE is_active = true;

-- Q&A during presentation
CREATE TABLE slide_session_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES slide_sessions(id) ON DELETE CASCADE,
    author_name VARCHAR(255) NOT NULL,
    question TEXT NOT NULL,
    upvotes INT NOT NULL DEFAULT 0,
    is_answered BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_session_questions ON slide_session_questions(session_id, created_at DESC);

-- Live polls during presentation
CREATE TABLE slide_session_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES slide_sessions(id) ON DELETE CASCADE,
    slide_id UUID REFERENCES slides(id),
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- ["Option A", "Option B", ...]
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE slide_session_poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES slide_session_polls(id) ON DELETE CASCADE,
    voter_identifier VARCHAR(255) NOT NULL, -- session token or user ID
    selected_option INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(poll_id, voter_identifier)
);
```

---

## REST API Endpoints

All endpoints require JWT authentication. Base path: `signapps-docs` service (port 3010) handles slides alongside documents, or a dedicated slides handler.

### Decks CRUD
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/slides/decks?page=&per_page=&q=` | List decks |
| POST | `/api/v1/slides/decks` | Create deck |
| GET | `/api/v1/slides/decks/:id` | Get deck with all slides and elements |
| PATCH | `/api/v1/slides/decks/:id` | Update deck metadata (title, theme) |
| DELETE | `/api/v1/slides/decks/:id` | Delete deck |
| POST | `/api/v1/slides/decks/:id/duplicate` | Duplicate deck |
| POST | `/api/v1/slides/decks/from-template` | Create deck from template `{template_id}` |
| POST | `/api/v1/slides/decks/import` | Import PPTX/Keynote (multipart) |

### Slides
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/slides/decks/:id/slides` | List slides in order |
| POST | `/api/v1/slides/decks/:id/slides` | Add new slide |
| PATCH | `/api/v1/slides/decks/:id/slides/:sid` | Update slide (background, layout, notes, transition) |
| DELETE | `/api/v1/slides/decks/:id/slides/:sid` | Delete slide |
| POST | `/api/v1/slides/decks/:id/slides/:sid/duplicate` | Duplicate slide |
| PATCH | `/api/v1/slides/decks/:id/slides/reorder` | Reorder slides `{slide_ids: [...]}` |
| PATCH | `/api/v1/slides/decks/:id/slides/:sid/hide` | Toggle hidden state |

### Elements
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/slides/decks/:id/slides/:sid/elements` | Add element |
| PATCH | `/api/v1/slides/decks/:id/slides/:sid/elements/:eid` | Update element (position, size, content, animations) |
| DELETE | `/api/v1/slides/decks/:id/slides/:sid/elements/:eid` | Delete element |
| POST | `/api/v1/slides/decks/:id/slides/:sid/elements/group` | Group elements `{element_ids: [...]}` |
| POST | `/api/v1/slides/decks/:id/slides/:sid/elements/ungroup` | Ungroup `{group_id}` |

### Export
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/slides/decks/:id/export/pptx` | Export as PPTX |
| GET | `/api/v1/slides/decks/:id/export/pdf?layout=&notes=&color=` | Export as PDF |
| GET | `/api/v1/slides/decks/:id/export/images?format=png&dpi=` | Export slides as images (ZIP) |
| POST | `/api/v1/slides/decks/:id/export/video` | Generate MP4 video (async job) |
| GET | `/api/v1/slides/decks/:id/export/html` | Export as standalone HTML |

### Versions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/slides/decks/:id/versions` | List versions |
| POST | `/api/v1/slides/decks/:id/versions` | Save named version |
| POST | `/api/v1/slides/decks/:id/versions/:vid/restore` | Restore version |

### Comments
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/slides/decks/:id/comments?slide=&resolved=` | List comments |
| POST | `/api/v1/slides/decks/:id/comments` | Add comment |
| PATCH | `/api/v1/slides/decks/:id/comments/:cid` | Update / resolve comment |
| DELETE | `/api/v1/slides/decks/:id/comments/:cid` | Delete comment |

### Live Session
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/slides/decks/:id/sessions` | Start live session |
| PATCH | `/api/v1/slides/sessions/:session_id` | Update current slide index |
| DELETE | `/api/v1/slides/sessions/:session_id` | End session |
| GET | `/api/v1/slides/sessions/:code/join` | Join session as audience (no auth) |
| POST | `/api/v1/slides/sessions/:session_id/questions` | Submit Q&A question |
| GET | `/api/v1/slides/sessions/:session_id/questions` | List questions |
| POST | `/api/v1/slides/sessions/:session_id/polls` | Create poll |
| POST | `/api/v1/slides/sessions/:session_id/polls/:pid/vote` | Vote on poll |
| GET | `/api/v1/slides/sessions/:session_id/polls/:pid/results` | Poll results |

### Sharing
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/slides/decks/:id/share` | Generate share link `{permission, password, expires}` |
| GET | `/api/v1/slides/decks/:id/share` | Get current share settings |
| DELETE | `/api/v1/slides/decks/:id/share` | Revoke share link |
| GET | `/api/v1/slides/public/:share_token` | Access shared deck (read-only) |

### AI
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/slides/ai/generate-deck` | Generate full deck from prompt |
| POST | `/api/v1/slides/ai/design-ideas` | Get layout suggestions for a slide |
| POST | `/api/v1/slides/ai/improve-text` | Improve wording of selected text |
| POST | `/api/v1/slides/ai/change-tone` | Change tone of text |
| POST | `/api/v1/slides/ai/translate` | Translate entire deck |
| POST | `/api/v1/slides/ai/suggest-visuals` | Suggest images/icons for slide content |
| POST | `/api/v1/slides/ai/generate-notes` | Generate speaker notes for all slides |
| POST | `/api/v1/slides/ai/summarize-doc` | Convert document to slide deck |
| POST | `/api/v1/slides/ai/qa-anticipate` | Predict audience questions |
| POST | `/api/v1/slides/ai/auto-check` | Check quality issues (too much text, contrast, etc.) |

---

## PgEventBus Events

| Event | Payload | Consumers |
|-------|---------|-----------|
| `slides.deck.created` | `{deck_id, workspace_id, created_by, from_template}` | dashboard, activity |
| `slides.deck.updated` | `{deck_id, changed_fields[]}` | search-index |
| `slides.deck.shared` | `{deck_id, share_token, permission}` | notifications |
| `slides.deck.exported` | `{deck_id, format, exported_by}` | audit-log |
| `slides.session.started` | `{session_id, deck_id, presenter_id, session_code}` | notifications, meet-integration |
| `slides.session.ended` | `{session_id, deck_id, duration_seconds, audience_count}` | analytics |
| `slides.session.question_asked` | `{session_id, question_id, author_name}` | presenter notification |
| `slides.session.poll_created` | `{session_id, poll_id, question}` | audience notification |
| `slides.comment.created` | `{deck_id, slide_id, comment_id, author_id}` | notifications (mentioned users) |
| `slides.version.saved` | `{deck_id, version_number, version_name}` | activity |
| `slides.import.completed` | `{deck_id, source_format, slide_count}` | notifications |
| `slides.ai.deck_generated` | `{deck_id, prompt_summary, slide_count}` | activity |

---

## Inter-module Integration

### Slides <-> Meet (signapps-meet, port 3014)
During a video call, the presenter can share a slide deck directly via the Meet screen-sharing integration. The Meet module provides a "Present Slides" option that opens a synchronized viewer for all participants. The presenter controls navigation; participants see the same slide in real time via WebSocket. Q&A and poll features are accessible to meeting participants through the Meet chat sidebar.

### Slides <-> Docs (signapps-docs, port 3010)
A slide deck can be embedded in a document as a live widget (iframe-like block). The document shows a mini slideshow that can be expanded. The "Convert Doc to Slides" feature sends the document content to the AI for slide generation. Conversely, "Export to Doc" generates a document with slide content as sections.

### Slides <-> Drive (signapps-storage, port 3004)
All media (images, videos, audio, 3D models) referenced in slides are stored in Drive. The image picker in the editor browses Drive folders. Uploaded media during editing is automatically saved to a deck-specific Drive folder. Deck PPTX/PDF exports are stored as Drive files.

### Slides <-> AI (signapps-ai, port 3005)
All AI features (deck generation, design ideas, text improvement, translation, speaker notes, quality check, Q&A prediction) route through the AI gateway. The Slides module sends structured payloads (slide content, deck theme, context) and receives structured responses (JSON deck schema, text, suggestions).

### Slides <-> Calendar (signapps-calendar, port 3011)
When a presentation is linked to a calendar event (e.g., "Team Meeting"), the slide deck URL is attached to the event. Attendees can preview the deck before the meeting. After the meeting, the rehearsal timing data is stored in the event metadata.

### Slides <-> Chat (signapps-chat, port 3020)
Sharing a slide deck link in Chat renders a rich preview card with the deck title, thumbnail, slide count, and last modified date. Click opens the deck viewer. The live session join link can be shared in Chat for audience participation.

### Slides <-> Collab (signapps-collab, port 3013)
Real-time collaboration uses the CRDT engine (Yjs) provided by the Collab service. Cursor positions, element selections, and edit operations are broadcast through the Collab WebSocket. Conflict resolution follows last-write-wins for element properties.

---

## Assertions E2E cles (a tester)

- Create empty deck -> first slide (title layout) visible in editor
- Create from template -> all template slides copied with content
- Create from AI prompt -> deck generated with 10+ slides, titles, bullet points
- Import PPTX -> slides render with correct layout, text, images preserved
- Add new slide (Ctrl+M) -> appears after current slide in navigator
- Delete slide -> confirm -> removed from navigator
- Duplicate slide (Ctrl+D) -> copy appears below with identical content
- Reorder slides by drag in navigator -> order persists
- Hide slide -> hidden icon appears, slide skipped in presentation mode
- Edit text: double-click text box -> type, bold, italic, color -> renders correctly
- Insert image from Drive -> image appears on canvas, resizable
- Insert shape (rectangle) -> customize fill color, stroke, rounded corners
- Insert chart -> data table editor -> chart renders on slide
- Resize element via corner handle -> aspect ratio maintained
- Rotate element via rotation handle -> rotation renders in preview
- Multi-select (Shift+click) two elements -> align center -> both centered
- Group two elements (Ctrl+G) -> move group -> both elements move together
- Ungroup (Ctrl+Shift+G) -> elements independently selectable again
- Lock element (Ctrl+L) -> cannot move or resize until unlocked
- Layer order: bring to front -> element renders on top of others
- Apply master theme -> all slides update fonts and colors
- Change slide background to gradient -> renders in editor and presentation
- Add fade-in animation to text box -> preview shows animation
- Add slide transition (morph) -> preview shows smooth transition
- Animation pane: reorder animations -> execution order changes
- Presentation mode (F5): slides fill screen, navigation works
- Presenter view: current slide, next slide, notes, timer all visible
- Laser pointer (L key): red dot follows cursor
- Pen tool (P key): draw on slide -> annotations visible
- Black screen (B key): screen goes black, press again to resume
- Slide navigator in presentation (G key): grid of all slides, click to jump
- Jump to slide (type "15" + Enter) -> jumps to slide 15
- Live Q&A: audience submits question via session code -> appears in presenter panel
- Live poll: create poll -> audience votes -> results animate in real time
- Export PDF: download with correct layout, 1 slide per page
- Export PPTX: opens in PowerPoint with layout preserved
- Export images: ZIP of PNGs, one per slide
- Collaboration: two users edit different slides -> cursors visible, no conflicts
- Collaboration: user A selects element -> user B sees lock indicator
- Comments: add comment on slide 3 -> @mention colleague -> notification sent
- Comment thread: reply to comment -> resolve -> comment archived
- Version history: save "v1 finale" -> make changes -> restore v1 -> content matches
- Share link: generate read-only link -> open in incognito -> deck viewable
- AI design ideas: select slide with raw text -> get 5 layout suggestions -> apply one
- AI improve text: select bullet points -> AI rewrites more concisely
- AI speaker notes: generate for all slides -> notes appear in each slide panel
- AI auto-check: deck with too-much-text slides -> report lists issues
- Mobile: open deck on phone -> swipe to navigate slides
- Responsive export: export as HTML -> opens correctly on mobile browser
- Offline mode: edit deck offline -> reconnect -> changes synced
