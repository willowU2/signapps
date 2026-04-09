# Module Design (Graphic Editor) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Canva** | Templates massifs (600k+), drag-drop intuitif, Brand Kit, Magic Design (AI), background remover, animations, resizing magique multi-format, marketplace d'elements, collaboration temps reel, Canva Docs/Presentations/Whiteboards, mobile-first |
| **Adobe Express** | Integration Creative Cloud, Adobe Fonts, stock Adobe, Quick Actions (remove background, resize, convert), templates pro, Brand Kit, generative AI (Firefly), export multi-format, scheduling social |
| **Figma** | Precision vectorielle, composants reutilisables, auto-layout, design tokens, plugins ecosystem, Dev Mode, collab temps reel, prototyping, FigJam whiteboard |
| **VistaCreate (Crello)** | Templates animes, video editor, brand kit, resize multi-format, stickers, objets animes, arriere-plans video, scheduling social |
| **Piktochart** | Infographies, rapports visuels, posters, presentations, data viz integre, import CSV vers graphiques, brand kit |
| **Snappa** | Ultra-simple, presets social media, stock photos HD, templates minimalistes, zero courbe d'apprentissage |
| **Stencil** | Optimise pour social media marketing, buffer/hootsuite integration, templates quote, icons, resize instantane |
| **RelayThat** | Auto-branding : un design genere automatiquement toutes les declinaisons (social, print, email), coherence visuelle forcee |
| **Desygner** | Marque blanche, templates entreprise, PDF editor integre, collaboration, integration CRM/email |
| **BeFunky** | Photo editor + graphic designer + collage maker dans un outil, filtres photo avances, batch editing, touch-up tools |
| **Fotor** | Photo editing + design + collage, HDR, beauty retouching, AI enlarger, batch processing |
| **Pixlr** | Editeur photo web avance (layers, masks, blend modes), AI tools, proche de Photoshop Web, gratuit |

## Principes directeurs

1. **Canvas-first, Fabric.js natif** — le canvas Fabric.js est le coeur de l'editeur. Chaque element est un objet Fabric manipulable (position, rotation, scale, opacity, effects). Zero abstraction qui cache le canvas.
2. **Presets de format metier** — les utilisateurs ne pensent pas en pixels mais en "Instagram Post", "A4", "Business Card". Les presets couvrent social media, print, presentation, marketing avec les dimensions exactes de chaque plateforme.
3. **Templates comme accelerateur** — galerie de templates categorises par usage (social media, business, marketing, education). Un template n'est qu'un design pre-rempli qu'on peut modifier librement.
4. **Brand Kit pour la coherence** — couleurs, logos, polices de l'organisation centralises. Appliquer le brand kit a n'importe quel design en un clic.
5. **Multi-page pour les projets complexes** — un design peut contenir plusieurs pages (ex: carousel Instagram, flyer recto-verso, kit social media complet).
6. **Export pixel-perfect** — PNG, JPG, SVG, PDF avec controle du DPI (72 web, 150 standard, 300 print). Chaque export respecte les dimensions exactes du format choisi.
7. **IA pour assister, pas remplacer** — generation d'images, suggestion de layouts, suppression d'arriere-plan, amelioration de texte. Toujours comme suggestion, jamais force.
8. **Collaboration optionnelle** — partage, duplication, organisation en dossiers. La collab temps reel est un bonus via Yjs (meme infra que Docs/Slides).

---

## Categorie 1 — Dashboard et gestion des designs

### 1.1 Page d'accueil Design
Dashboard principal avec trois sections : "Creer un design" (boutons d'action), "Galerie de templates" (raccourci), "Designs recents" (grille avec miniatures). Barre de recherche pour filtrer par nom. Navigation vers l'editeur au clic sur un design.

### 1.2 Creation d'un design vierge
Bouton "Blank" ouvre un dialog avec : nom du design, selection du format parmi les presets (grille de cartes par categorie). Clic sur "Creer" ouvre l'editeur avec un canvas vide aux dimensions choisies.

### 1.3 Creation depuis un format preset
Presets organises par categorie :
- **Social Media** : Instagram Post (1080x1080), Instagram Story (1080x1920), Facebook Cover (820x312), Facebook Post (1200x630), LinkedIn Banner (1584x396), LinkedIn Post (1200x1200), Twitter/X Post (1200x675), YouTube Thumbnail (1280x720), TikTok Video (1080x1920), Pinterest Pin (1000x1500)
- **Print** : A4 Portrait (2480x3508), A4 Landscape (3508x2480), A3 (3508x4961), Business Card (1050x600), Flyer (1240x1748), Poster (2480x3508), Carte postale (1748x1240), Menu restaurant (2480x3508)
- **Presentation** : 16:9 (1920x1080), 4:3 (1024x768), 1:1 Square (1080x1080)
- **Marketing** : Email Header (600x200), Web Banner (1200x400), Invitation (1080x1080), Newsletter (600x800), Logo (500x500), Couverture de livre (1600x2560), Infographie (800x2000)
- **Video** : YouTube Banner (2560x1440), Twitch Banner (1200x480), Video Thumbnail (1920x1080)
Chaque preset affiche ses dimensions en pixels et un apercu du ratio.

### 1.4 Creation depuis un template
Bouton "From Template" ouvre la galerie de templates. Selection d'un template le clone comme nouveau design editable. Le template original n'est jamais modifie.

### 1.5 Dimensions personnalisees
Option "Custom Size" dans le dialog de creation. Saisie libre de la largeur et hauteur en pixels (ou cm/in/mm avec conversion automatique). Min 50px, max 8000px par dimension.

### 1.6 Actions sur les designs existants
Menu contextuel (trois points) sur chaque design dans le dashboard :
- **Renommer** — dialog inline, validation non-vide
- **Dupliquer** — copie complete (pages, objets, background), suffixe " (copie)"
- **Supprimer** — confirmation avant suppression definitive
- **Partager** — generer un lien de partage (lecture ou edition)
- **Exporter** — export rapide sans ouvrir l'editeur

### 1.7 Recherche et filtrage
Barre de recherche filtre les designs par nom en temps reel. Filtres supplementaires : par format (social, print, etc.), par date de modification, par createur (multi-utilisateur).

### 1.8 Tri des designs
Tri par : date de modification (recent d'abord), date de creation, nom alphabetique, format. Persistance du tri entre les sessions.

### 1.9 Dossiers de designs
Organiser les designs en dossiers (ex: "Campagne Q1 2026", "Social Media Mars"). Drag-drop pour deplacer. Dossiers imbriques supportes.

### 1.10 Designs favoris
Etoile pour marquer un design comme favori. Vue filtree "Favoris" dans le dashboard. Acces rapide.

---

## Categorie 2 — Canvas et manipulation d'objets

### 2.1 Canvas Fabric.js
Zone centrale de l'editeur : canvas Fabric.js aux dimensions du format choisi, centre dans le viewport avec fond gris autour (pasteboard). Zoom adaptatif "fit to screen" au chargement. Pan avec clic-molette ou Espace+drag.

### 2.2 Zoom
Ctrl+Scroll pour zoomer/dezoomer (25% a 800%). Boutons `+/-` dans la toolbar. Raccourcis : `Ctrl+0` = fit to screen, `Ctrl+1` = 100%, `Ctrl+2` = 200%. Affichage du pourcentage de zoom actuel.

### 2.3 Rulers (regles)
Regles horizontale et verticale sur les bords du canvas avec graduations en pixels. Mise a jour en temps reel au scroll/zoom. Position de la souris marquee par un trait rouge sur les regles. Les guides draggables se tirent depuis les regles.

### 2.4 Grille et snap
Toggle grille visible (bouton Grid dans la toolbar). Grille par defaut 10px. Snap-to-grid : les objets s'alignent sur les intersections lors du deplacement. Snap-to-object : guides magenta apparaissent quand un objet s'aligne avec un autre (bords, centres). `Alt` maintenu desactive temporairement le snap.

### 2.5 Selection d'objets
Clic pour selectionner un objet (poignees de redimensionnement + rotation). Shift+clic pour ajouter a la selection. Drag sur le canvas vide pour selection rectangulaire (lasso). Double-clic sur un texte entre en mode edition inline.

### 2.6 Deplacement d'objets
Drag d'un objet selectionne pour le deplacer. Fleches clavier pour un deplacement de 1px. Shift+Fleches pour 10px. Coordonnees X/Y affichees dans le panneau de proprietes.

### 2.7 Redimensionnement
Poignees aux 8 points (4 coins + 4 milieux). Shift maintenu preserve le ratio. Alt maintenu redimensionne depuis le centre. Dimensions W/H affichees dans le panneau de proprietes avec saisie precise.

### 2.8 Rotation
Poignee de rotation au-dessus de l'objet. Shift maintenu contraint a 15 degres. Angle affiche dans le panneau de proprietes avec saisie precise. Reset a 0 degres en un clic.

### 2.9 Undo / Redo
`Ctrl+Z` pour annuler, `Ctrl+Y` ou `Ctrl+Shift+Z` pour refaire. Historique profond (100+ etapes). Chaque action atomique (deplacer, changer couleur, ajouter objet) est une entree. Boutons Undo/Redo dans la toolbar.

### 2.10 Copier / Coller / Couper
`Ctrl+C` copie les objets selectionnes. `Ctrl+V` colle avec offset de 10px (evite la superposition exacte). `Ctrl+X` coupe. `Ctrl+D` duplique sur place avec offset. Support du copier-coller entre pages du meme design.

### 2.11 Alignement et distribution
Quand plusieurs objets sont selectionnes, boutons d'alignement : gauche, centre horizontal, droite, haut, centre vertical, bas. Distribution : espacement egal horizontal, espacement egal vertical. Alignement par rapport au canvas (pas seulement entre objets).

### 2.12 Group / Ungroup
`Ctrl+G` groupe les objets selectionnes. Le groupe se comporte comme un seul objet (deplacement, resize, rotation). Double-clic sur un groupe entre en mode "isolation" pour editer un element interne. `Ctrl+Shift+G` degroupe.

### 2.13 Z-order (ordre des calques)
`Ctrl+]` avance d'un niveau. `Ctrl+[` recule d'un niveau. `Ctrl+Shift+]` premier plan. `Ctrl+Shift+[` arriere-plan. Reflete dans le panneau Layers.

### 2.14 Verrouillage d'objet
Icone cadenas dans le panneau Layers ou via clic droit. Un objet verrouille ne peut pas etre deplace, redimensionne ni supprime. Il reste selectionnable pour voir ses proprietes.

### 2.15 Visibilite d'objet
Icone oeil dans le panneau Layers. Un objet cache est invisible sur le canvas et dans l'export. Utile pour les variantes (texte en francais et anglais sur le meme design, cacher l'un pour exporter l'autre).

---

## Categorie 3 — Elements inserables

### 3.1 Texte avec styles predefinis
Dropdown "Text" dans la toolbar avec styles predefinis : Large Heading (64px bold), Medium Heading (48px bold), Small Heading (32px bold), Subheading (24px semibold), Body Text (18px normal), Small Text (14px normal), Caption (12px medium). Clic insere un textbox editable au centre du canvas.

### 3.2 Edition de texte riche
Double-clic sur un textbox active l'edition inline. Barre de mise en forme contextuelle : police, taille, gras, italique, souligne, barre, couleur du texte, couleur de fond du texte, alignement (gauche, centre, droite, justifie), interligne, espacement lettres, majuscules, listes a puces, listes numerotees.

### 3.3 Polices
Bibliotheque de polices systeme + polices web (Google Fonts subset precharge). Recherche par nom. Preview instantane dans le dropdown. Regroupement : Sans-serif, Serif, Display, Handwriting, Monospace. Possibilite d'uploader des polices custom (.woff2, .ttf, .otf).

### 3.4 Formes geometriques
Dropdown "Shape" dans la toolbar avec categories :
- **Basiques** : rectangle, cercle, triangle, etoile, losange, hexagone, pentagone, octogone
- **Fleches** : droite, gauche, haut, bas, double, courbe
- **Lignes** : simple, avec fleche, pointillee
- **Callouts** : bulle ronde, bulle carree, rectangle arrondi avec pointe
- **Symboles** : coeur, eclair, croix, check, plus, moins
Chaque forme est un objet Fabric customisable : fill, stroke (couleur, epaisseur, style), ombre, coins arrondis, opacite.

### 3.5 Images
Bouton "Image" pour inserer depuis :
- **Upload** (drag-drop ou file picker, formats : PNG, JPG, WEBP, SVG, GIF)
- **Drive SignApps** (parcourir les fichiers stockes)
- **Stock photos** (integration Unsplash/Pexels avec recherche par mot-cle)
- **URL** (coller un lien vers une image)
- **Webcam** (capture instantanee)
Image inseree comme objet Fabric avec poignees de resize. Ratio preserve par defaut.

### 3.6 Crop d'image
Selectionner une image → bouton "Crop" dans la toolbar. Zone de crop avec poignees. Presets de ratio : libre, 1:1, 4:3, 16:9, 3:2. Appliquer le crop decoupe l'image. Annulable.

### 3.7 Filtres photo
Panneau de filtres applicable a toute image selectionnee :
- **Presets** : Original, Vivid, Warm, Cool, Vintage, B&W, Sepia, Dramatic
- **Reglages manuels** : luminosite, contraste, saturation, flou, rotation de teinte, sepia, niveaux de gris
- **Ajustements avances** : ombre/highlight, temperature, teinte, nettete, vignette
Preview temps reel sur le canvas.

### 3.8 Arriere-plan
Dropdown "Background" dans la toolbar :
- **Couleur unie** (color picker avec champ hex/RGB)
- **Degrade** (lineaire, radial, 2+ stops de couleur, angle configurable)
- **Image** (upload ou stock photo, modes : fill, fit, tile)
- **Pattern** (motifs geometriques repetes : points, lignes, chevrons, losanges)
- **Transparent** (pour export PNG avec fond transparent)
L'arriere-plan s'applique par page.

### 3.9 Icones et illustrations
Bibliotheque d'icones searchable (Lucide icons, 1000+). Chaque icone inseree comme SVG vectoriel, recolorable. Taille et opacite ajustables. Categories : business, social, UI, nature, transport, tech, food, medical, education.

### 3.10 QR Codes et bar codes
Insertion directe : saisir une URL ou un texte → genere un QR code comme objet sur le canvas. Personnalisation : couleur du code, couleur de fond, taille du module, logo central optionnel. Codes-barres : Code 128, EAN-13, UPC-A.

### 3.11 Graphiques et charts
Insertion de mini-graphiques (bar, line, pie, donut) directement sur le canvas. Donnees saisies inline (tableau simple dans un dialog). Couleurs synchronisees avec le brand kit. Export comme partie integrante du design (pas un embed externe).

### 3.12 Emojis et stickers
Picker d'emojis natifs. Bibliotheque de stickers vectoriels par categorie (celebration, business, education, saisonnier). Inserables comme objets redimensionnables.

---

## Categorie 4 — Panneau de proprietes et styles

### 4.1 Panneau lateral droit (Property Panel)
Affiche les proprietes de l'objet selectionne. Sections dynamiques selon le type :
- **Position** : X, Y (coordonnees)
- **Taille** : largeur, hauteur, verrouillage du ratio
- **Rotation** : angle en degres
- **Opacite** : slider 0-100%
- **Fill** : couleur, degrade, pattern, transparent
- **Stroke** : couleur, epaisseur, style (plein, pointille, tirets)
- **Ombre** : couleur, decalage X/Y, flou, activation/desactivation
- **Coins arrondis** : rayon (pour rectangles et formes avec coins)
- **Texte** : police, taille, poids, couleur, alignement, espacement

### 4.2 Color picker avance
Selecteur visuel (spectre + luminosite), champ hex (#FF5733), champs RGB (255, 87, 51), champ HSL. Pipette (eyedropper) pour capturer une couleur depuis le canvas. Historique des couleurs recentes. Couleurs du brand kit accessibles en un clic.

### 4.3 Editeur de degradees
Barre de degrade avec points de couleur (stops) draggables. Ajouter un stop en cliquant sur la barre. Supprimer un stop en le tirant hors de la barre. Type : lineaire ou radial. Angle configurable pour lineaire. Centre configurable pour radial. Preview temps reel.

### 4.4 Effets de calque (Layer Effects)
Panneau d'effets empilables applicable a tout objet :
- **Ombre portee** (drop shadow) : couleur, decalage, flou, spread
- **Ombre interne** (inner shadow) : couleur, decalage, flou
- **Contour** (outline) : couleur, epaisseur, position (inside, center, outside)
- **Flou** (blur) : gaussien, sur l'objet ou sur l'arriere-plan
- **Reflection** : opacite, distance
Plusieurs effets cumulables. Toggle individuel on/off.

### 4.5 Styles de texte avances
Au-dela du basique (3.2) :
- **Espacement des lettres** (letter-spacing) : slider -5 a +20
- **Interligne** (line-height) : slider 0.8 a 3.0
- **Transformation** : uppercase, lowercase, capitalize, normal
- **Decoration** : souligne, barre, overline
- **Texte courbe** : texte suivant un arc de cercle configurable
- **Texte avec contour** (stroke text) : couleur de contour + couleur de remplissage
- **Ombre de texte** : couleur, decalage, flou

### 4.6 Styles rapides (presets)
Bouton "Styles" dans le panneau affiche des presets visuels pour l'objet selectionne. Ex pour un texte : "Neon", "Shadow bold", "Outline", "Gradient text", "Retro", "Minimal". Clic applique. Chaque preset est un ensemble de proprietes pre-configurees.

---

## Categorie 5 — Pages et multi-page

### 5.1 Panneau Pages (sidebar gauche)
Liste verticale de miniatures de toutes les pages du design. Page active surlignee. Clic pour changer de page. Les miniatures se mettent a jour en temps reel.

### 5.2 Ajout de page
Bouton `+` en bas du panneau Pages. La nouvelle page herite du format du design (memes dimensions) avec un fond blanc par defaut.

### 5.3 Duplication de page
Clic droit sur une miniature → Dupliquer. Copie complete de tous les objets et du background.

### 5.4 Suppression de page
Clic droit → Supprimer. Si c'est la derniere page, la suppression est interdite (minimum 1 page).

### 5.5 Reordonnancement des pages
Drag-drop des miniatures dans le panneau pour changer l'ordre.

### 5.6 Background par page
Chaque page a son propre arriere-plan (couleur, degrade, image, transparent). Independant des autres pages.

### 5.7 Navigation entre pages
Fleches haut/bas dans le panneau ou `Page Up`/`Page Down` pour naviguer. Affichage "Page 2/5" dans la toolbar.

### 5.8 Copier des objets entre pages
Selectionner un objet → `Ctrl+C` → changer de page → `Ctrl+V`. L'objet est colle aux memes coordonnees.

---

## Categorie 6 — Panneau Layers (calques)

### 6.1 Liste des calques
Panneau lateral gauche (onglet "Layers") avec la liste ordonnee de tous les objets de la page active. Chaque entree affiche : icone du type (T pour texte, rectangle pour shape, image pour image), nom de l'objet, icone oeil (visibilite), icone cadenas (verrouillage).

### 6.2 Renommage des calques
Double-clic sur le nom d'un calque pour le renommer. Noms par defaut : "Text 1", "Rectangle 2", "Image 3". Noms personnalises pour l'organisation.

### 6.3 Reordonnancement par drag
Glisser un calque vers le haut ou le bas de la liste change son z-order sur le canvas. Feedback visuel avec indicateur de drop.

### 6.4 Selection depuis le panneau
Clic sur un calque selectionne l'objet correspondant sur le canvas (et inversement). Multi-selection avec Shift+clic ou Ctrl+clic.

### 6.5 Toggle visibilite et verrouillage
Icone oeil : un clic cache/montre l'objet. Icone cadenas : un clic verrouille/deverrouille. Feedback instantane sur le canvas.

### 6.6 Groupes dans les layers
Les groupes apparaissent comme des calques pliables. Clic sur le chevron pour deplier et voir les sous-elements. Actions sur le groupe affectent tous les sous-elements.

---

## Categorie 7 — Brand Kit et coherence visuelle

### 7.1 Definition du Brand Kit
Interface de configuration : nom de la marque, couleurs principales (primaire, secondaire, accent, neutre), logos (variantes light/dark/default avec upload), polices (heading font, body font), guidelines textuelles.

### 7.2 Palette de couleurs de la marque
Jusqu'a 20 couleurs nommees (ex: "Bleu corporate", "Vert accent", "Gris texte"). Chaque couleur a un nom et un code hex. Accessibles dans tous les color pickers de l'editeur, section "Couleurs de la marque".

### 7.3 Logos de la marque
Upload des logos en variantes : default (couleur), light (pour fond sombre), dark (pour fond clair). Formats acceptes : SVG, PNG avec transparence. Insertion rapide depuis un bouton "Logo" dans la toolbar.

### 7.4 Polices de la marque
Selectionner ou uploader une police pour les titres et une pour le corps de texte. Quand le Brand Kit est actif, ces polices sont pre-selectionnees a la creation de nouveaux textboxes.

### 7.5 Application du Brand Kit a un design
Bouton "Appliquer le Brand Kit" remplace les couleurs generiques par celles de la marque, les polices par celles de la marque, propose l'insertion du logo. Preview avant/apres.

### 7.6 Brand Kit par organisation
Chaque organisation a son propre Brand Kit. Les utilisateurs de l'organisation voient les couleurs/polices/logos de leur org dans tous les pickers. Un admin peut verrouiller le Brand Kit pour empecher les derogations.

---

## Categorie 8 — Galerie de templates

### 8.1 Organisation par categorie et sous-categorie
Categories principales : Social Media, Business, Marketing, Education, Events, Personal, Seasonal. Sous-categories : ex. Social Media → Instagram, Facebook, LinkedIn, YouTube. Filtres par format (1080x1080, A4, etc.).

### 8.2 Preview du template
Clic sur un template ouvre un apercu plein ecran avec toutes les pages. Bouton "Utiliser ce template" pour le cloner.

### 8.3 Recherche dans les templates
Barre de recherche par mot-cle (ex: "invitation anniversaire", "vente flash", "rapport annuel"). Tags et categories indexees.

### 8.4 Templates favoris
Etoile pour sauvegarder un template en favori. Vue "Mes favoris" dans la galerie.

### 8.5 Templates d'organisation
Les admins peuvent publier des templates "officiels" pour leur organisation (papier a en-tete, cartes de visite corporate, bannieres social media aux couleurs de la boite). Ces templates apparaissent en premier dans la galerie pour les membres de l'org.

### 8.6 Sauvegarder un design comme template
Depuis l'editeur : `Fichier > Sauvegarder comme template`. Renseigner categorie, tags, description. Le design devient un template reutilisable (personnel ou organisation).

### 8.7 Templates saisonniers et tendances
Section "Trending" et "Saisonnier" en haut de la galerie : templates pour Noel, Nouvel An, rentree, Black Friday, St-Valentin, ete, etc. Rotation automatique selon la date.

---

## Categorie 9 — Export et partage

### 9.1 Export PNG
Export bitmap haute qualite. Options : DPI (72, 150, 300), pages (toutes ou selection), fond transparent (si background transparent). Nom de fichier auto-genere : `design-name-page-1.png`.

### 9.2 Export JPG
Export compresse. Quality slider (60-100%). DPI configurable. Fond blanc force (JPG ne supporte pas la transparence). Ideal pour le web et les emails.

### 9.3 Export SVG
Export vectoriel. Conserve les formes, textes et degrades comme elements SVG. Ideal pour les logos et les illustrations a taille variable. Polices converties en paths ou embedees.

### 9.4 Export PDF
Export pour l'impression ou le partage pro. Options : pages (toutes, selection), quality (web 72dpi, standard 150dpi, print 300dpi), traits de coupe (crop marks), fond perdu (bleed). Multi-page = un PDF multi-page. Protection par mot de passe optionnelle.

### 9.5 Export par page
Choix d'exporter toutes les pages ou seulement la page active. Pour les designs multi-page, option d'exporter chaque page comme fichier separe (ZIP) ou toutes dans un seul PDF.

### 9.6 Resize magique (multi-format)
Depuis un design existant : bouton "Resize" dans la toolbar. Selectionner un ou plusieurs formats cibles (ex: transformer un Instagram Post en Facebook Cover + LinkedIn Banner + Twitter Post). L'editeur genere les variantes en adaptant les positions et tailles des elements. Review et ajustement manuel possible avant export.

### 9.7 Partage par lien
Generer un lien de partage : lecture seule (preview du design), edition (acces a l'editeur en mode collaboratif). Options : expiration, mot de passe, watermark "brouillon".

### 9.8 Telecharger depuis le dashboard
Export rapide sans ouvrir l'editeur. Clic droit sur un design → Exporter → choix du format. Utilise les dernieres options d'export configurees.

### 9.9 Export pour les reseaux sociaux
Bouton "Share to Social" propose l'export optimise pour chaque plateforme avec les specs exactes (taille, format, compression). Integration avec le module Social de SignApps pour publication directe.

### 9.10 Historique des exports
Liste des exports precedents avec date, format, resolution. Re-telecharger un export sans le regenerer.

---

## Categorie 10 — IA integree

### 10.1 Generation d'image depuis un prompt
Panneau "AI" dans l'editeur. Saisir un prompt ("un bureau moderne avec des plantes, style minimaliste, couleurs pastel") → le LLM genere une image inseree directement sur le canvas. Plusieurs propositions a choisir.

### 10.2 Suppression d'arriere-plan (Background Remover)
Selectionner une image → bouton "Remove Background". L'IA detecte le sujet et supprime l'arriere-plan, laissant un PNG transparent. Pinceau de correction pour ajuster les bords.

### 10.3 Magic Resize (AI-assistee)
Lors du resize multi-format (9.6), l'IA repositionne intelligemment les elements pour chaque nouveau format au lieu de simplement les etirer. Texte reflow, images recadrees au centre d'interet.

### 10.4 Suggestion de layouts
Inserer du contenu (titre + sous-titre + image + logo) → bouton "Suggest Layout" → l'IA propose 5 mises en page differentes. Clic pour appliquer.

### 10.5 Amelioration de texte
Selectionner un textbox → "AI > Improve" → suggestions : plus concis, plus impactant, plus formel, plus decontracte. Traduction automatique dans une autre langue.

### 10.6 Palette de couleurs generee
"AI > Generate Palette" depuis un mot-cle ("professionnel finance"), une image (extraction des couleurs dominantes), ou un theme ("coucher de soleil"). Palette de 5-7 couleurs applicables au design.

### 10.7 Alt text automatique
Pour chaque image du design, generation automatique d'un alt text descriptif. Utile pour l'accessibilite des exports HTML/PDF.

### 10.8 Generation de variantes
"AI > Generate Variants" → genere 3-5 variantes du design courant en modifiant les couleurs, la disposition ou les polices. L'utilisateur choisit sa preferee.

### 10.9 Suggestions de stock photos
Pendant l'edition, l'IA analyse le contenu textuel du design et suggere des photos stock pertinentes. Ex: un design mentionnant "teamwork" → suggestions de photos d'equipe.

### 10.10 Auto-branding
"AI > Apply Brand" → l'IA adapte un design generique aux couleurs, polices et logos du Brand Kit de l'organisation. Plus intelligent que le simple remplacement : ajuste les contrastes, les tailles, les positions.

---

## Categorie 11 — Collaboration et historique

### 11.1 Partage avec niveaux de permission
Propriete, Editeur, Commentateur, Lecteur. Invitation par email ou par lien. Gestion des permissions dans le dialog de partage.

### 11.2 Edition collaborative temps reel
Via Yjs (meme infra que Docs/Slides). Curseurs des autres utilisateurs visibles sur le canvas. Selection d'un objet par un collegue affiche son avatar sur l'objet.

### 11.3 Commentaires sur le design
Clic sur un point du canvas → ajouter un commentaire. Bulle avec avatar, texte, @mentions. Threads de reponses. Resolution de commentaire. Panneau lateral listant tous les commentaires.

### 11.4 Historique des versions
Historique automatique des modifications avec snapshots horodates. Restaurer une version anterieure. Nommer une version ("Version finale CEO"). Comparaison visuelle entre deux versions.

### 11.5 Panneau d'historique (History Panel)
Liste chronologique des actions effectuees sur le design : "Ajoute Text 1", "Deplace Image 2", "Change background en #FF5733". Navigation dans l'historique pour previsualiser un etat anterieur.

### 11.6 Activite recente
Dans le dashboard, indicateur de derniere modification avec nom de l'auteur et horodatage. Notification quand un collegue modifie un design partage.

---

## Categorie 12 — Securite, accessibilite et performance

### 12.1 Classification du design
Niveaux : Public, Interne, Confidentiel. Bandeau colore visible. Restrictions d'export selon la classification.

### 12.2 Watermark sur les designs confidentiels
Watermark automatique avec nom de l'utilisateur et date sur les previews et exports des designs classifies. Dissuade les captures d'ecran non-autorisees.

### 12.3 Audit log
Journal immuable : qui a cree, ouvert, modifie, exporte, partage, supprime chaque design. Exportable pour conformite.

### 12.4 Accessibilite WCAG AA
Navigation clavier complete dans l'editeur. Contrastes suffisants sur tous les elements d'interface. Alt text sur les icones. Screen reader : annonce l'objet selectionne, ses proprietes, les actions disponibles.

### 12.5 Raccourcis clavier
| Raccourci | Action |
|---|---|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+C` / `Ctrl+V` / `Ctrl+X` | Copier / Coller / Couper |
| `Ctrl+D` | Dupliquer |
| `Ctrl+G` | Grouper |
| `Ctrl+Shift+G` | Degrouper |
| `Ctrl+]` / `Ctrl+[` | Avancer / Reculer d'un niveau |
| `Ctrl+Shift+]` / `Ctrl+Shift+[` | Premier plan / Arriere-plan |
| `Delete` / `Backspace` | Supprimer l'objet selectionne |
| `Ctrl+A` | Selectionner tous les objets |
| `Ctrl+0` | Zoom fit to screen |
| `Ctrl+1` | Zoom 100% |
| `Ctrl+S` | Sauvegarder |
| `Ctrl+Shift+E` | Exporter |
| `T` | Inserer un texte |
| `R` | Inserer un rectangle |
| `O` | Inserer un cercle |
| `L` | Inserer une ligne |
| `Espace+Drag` | Pan du canvas |
| `?` | Aide raccourcis |

### 12.6 Performance canvas
Fabric.js avec object caching active. Les objets hors viewport ne sont pas rendus (culling). Export asynchrone en Web Worker pour ne pas bloquer l'UI. Designs de 200+ objets doivent rester fluides a 60fps.

### 12.7 Sauvegarde automatique
Auto-save toutes les 30 secondes et a chaque action significative. Indicateur "Sauvegarde..." dans la toolbar. Persistance locale (localStorage) + serveur (API Docs).

### 12.8 Mode hors-ligne
Edition hors-ligne complete avec persistance locale. Synchronisation au retour en ligne via Yjs CRDT. Indicateur "Hors-ligne" dans la toolbar.

### 12.9 Mobile responsive (consultation)
Dashboard accessible sur mobile avec miniatures et actions. Editeur en mode lecture seule sur mobile (canvas trop complexe pour l'edition tactile). Export disponible.

### 12.10 Internationalisation
Interface de l'editeur et du dashboard en francais, anglais, espagnol, allemand, italien, portugais, neerlandais. Labels des presets de format et des categories de templates traduits.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Canva Help Center** (canva.com/help) — templates, brand kit, design school, Magic Design, export, collaboration, raccourcis.
- **Adobe Express Help** (helpx.adobe.com/express) — quick actions, templates, brand, generative AI, social scheduling.
- **Figma Help Center** (help.figma.com) — composants, auto-layout, styles, plugins, collaboration, prototyping.
- **VistaCreate (Crello) Help** (vistaprint.com/hub/vista-create) — templates animes, brand kit, resize, video.
- **Piktochart Academy** (piktochart.com/blog) — infographies, data viz, storytelling visuel.
- **BeFunky Support** (befunky.com/learn) — photo editor, graphic designer, collage maker.
- **Pixlr Support** (pixlr.com/learn) — layers, masks, blend modes, AI tools.

### Projets open source permissifs
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Fabric.js** (fabricjs.com) | **MIT** | Canvas library coeur de l'editeur. Objets, groupes, serialisation JSON, export image, events, animations. Deja utilise dans SignApps. |
| **Konva.js** (konvajs.org) | **MIT** | Alternative a Fabric.js, performant pour les gros canvas. Pattern d'architecture canvas. |
| **Excalidraw** (excalidraw.com) | **MIT** | Whiteboard collab avec formes. Pattern pour le selection tool, le snapping, l'undo/redo, l'export. |
| **tldraw** (tldraw.com) | **Apache-2.0** | Editeur de formes avec infinite canvas. Excellent UX. Pattern pour les interactions canvas. |
| **Polotno Studio** (polotno.com) | **MIT** | Editeur graphique React base sur Konva. Pattern pour un editeur design complet (layers, templates, export). |
| **React Design Editor** (github.com/salgum1114/react-design-editor) | **MIT** | Editeur base sur Fabric.js avec panels, layers, properties. Pattern d'architecture React+Fabric. |
| **CanvasKit** (skia.org/docs/user/modules/canvaskit) | **BSD-3-Clause** | Rendu canvas haute performance via Skia WebAssembly. Pour l'optimisation future. |
| **Yjs** (github.com/yjs/yjs) | **MIT** | CRDT pour la collaboration temps reel — deja utilise dans SignApps. |
| **pdf-lib** (pdf-lib.js.org) | **MIT** | Generation de PDF pour l'export. |
| **jsPDF** (github.com/parallax/jsPDF) | **MIT** | Alternative pour la generation de PDF cote navigateur. |
| **html-to-image** (github.com/bubkoo/html-to-image) | **MIT** | Capture d'elements DOM en image. Pattern pour les exports alternatifs. |
| **qrcode** (github.com/soldair/node-qrcode) | **MIT** | Generation de QR codes. |
| **Unsplash API** (unsplash.com/developers) | **API License** | Stock photos gratuites. Rate limits genereux. |
| **Pexels API** (pexels.com/api) | **API License** | Stock photos et videos gratuites. |
| **Lucide Icons** (lucide.dev) | **ISC** | 1000+ icones SVG. Deja utilise dans SignApps. |

### Pattern d'implementation recommande
1. **Canvas editeur** : Fabric.js (MIT) comme library canvas principale. Deja en place dans le module Design de SignApps.
2. **Serialisation** : JSON natif Fabric.js (`canvas.toJSON()` / `canvas.loadFromJSON()`) pour la persistance. Stockage via l'API Docs (port 3010).
3. **Export image** : `canvas.toDataURL('image/png')` pour PNG/JPG. SVG via `canvas.toSVG()`. PDF via pdf-lib (MIT) avec insertion du canvas rendu.
4. **Collaboration** : Yjs (MIT) + y-websocket pour la collab temps reel. Meme pattern que Docs/Slides.
5. **Stock photos** : Unsplash API + Pexels API avec cache local. Proxy via le gateway pour le rate limiting.
6. **Templates** : fichiers JSON (pages + objets Fabric serialises) stockes dans Drive. Indexation par categorie et tags dans PostgreSQL.
7. **Brand Kit** : table PostgreSQL liee a l'organisation. Synchronise avec le frontend via l'API Identity.
8. **AI generation** : via le service signapps-ai (port 3005). Stable Diffusion ou DALL-E pour la generation d'images. LLM pour les suggestions de texte et de layout.
9. **QR Codes** : qrcode (MIT) cote navigateur, insertion comme image sur le canvas.
10. **Polices** : Google Fonts subset precharge + upload custom via Drive. Font-face CSS dynamique.

### Ce qu'il ne faut PAS faire
- **Pas de copier-coller** depuis les projets ci-dessus — s'inspirer des patterns, reecrire.
- **Pas de Canva API** ni embed — tout est natif dans SignApps.
- **Pas de WebGL obligatoire** pour le canvas — Fabric.js fonctionne en Canvas 2D, suffisant pour 95% des cas. WebGL optionnel pour les filtres lourds.
- **Pas d'editeur photo complet** (style Photoshop) — on fait du design graphique, pas de la retouche photo avancee. Les filtres basiques suffisent.
- **Pas de gestion de calques de type Photoshop** (blend modes, masques de fusion, couches alpha) — on reste sur le modele Canva (simple, accessible).

---

## Assertions E2E cles (a tester)

- Affichage du dashboard avec designs recents
- Creation d'un design vierge avec format preset (Instagram Post)
- Creation d'un design avec dimensions custom
- Creation depuis un template de la galerie
- Insertion de texte (heading, body) et edition inline
- Insertion de forme (rectangle, cercle) avec personnalisation fill/stroke
- Insertion d'image (upload + depuis stock photos)
- Crop d'une image avec ratio contraint
- Application d'un filtre photo (B&W, Vivid)
- Changement de background (couleur, degrade, image, transparent)
- Selection, deplacement, redimensionnement, rotation d'objets
- Multi-selection et alignement (gauche, centre, distribuer)
- Group / Ungroup d'objets
- Undo / Redo apres modification
- Copier-coller d'objets entre pages
- Panneau Layers : renommage, reordonnancement, toggle visibilite/verrouillage
- Ajout, duplication, suppression de page
- Configuration du Brand Kit (couleurs, logos, polices)
- Application du Brand Kit a un design
- Export PNG avec fond transparent
- Export JPG avec qualite configurable
- Export PDF multi-page avec DPI print
- Export SVG d'un design vectoriel
- Resize magique d'un Instagram Post vers Facebook Cover
- Renommer, dupliquer, supprimer un design depuis le dashboard
- Recherche de designs par nom dans le dashboard
- Recherche de templates par mot-cle
- Raccourcis clavier (Ctrl+Z, Ctrl+D, Ctrl+G, Delete)
- Partage d'un design avec lien en lecture seule
- Sauvegarde automatique (verifier la persistance apres reload)
- AI : generation d'image depuis un prompt
- AI : suppression d'arriere-plan
- AI : suggestion de layout
- Navigation au clavier dans l'editeur (Tab, fleches, raccourcis)
