# Module Docs (éditeur collaboratif) — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Google Docs** | Collab temps réel sans friction, suggesting mode (track changes élégant), comments threads, voice typing, smart chips (@person, @date, @file, @event, @place), outline panel auto, Explore (résumé IA), translate intégré, version history fine, import/export DOCX natif, templates gallery, keyboard shortcuts exhaustifs |
| **Microsoft Word** | Track changes précis et granulaire, Styles (Normal, Titre 1-9, Emphase, etc.) avec héritage, References (bibliographie, citations Zotero/Mendeley), Mailings (publipostage), Copilot Draft/Rewrite, Macros VBA, ligatures et typographie avancée, équations LaTeX, 500+ raccourcis clavier, tables avancées |
| **Notion** | Blocks composables (texte, heading, list, toggle, callout, quote, code, image, video, embed, file, bookmark, table of contents, breadcrumb, divider, column, database, synced block), databases inline, @mentions de pages/databases, templates de pages, page tree nav, AI (continue writing, improve, summarize, translate, brainstorm, action items, tone), wiki/knowledge base |
| **Dropbox Paper** | Minimalisme extrême, focus sur l'écriture, timelines inline, @mentions riches, YouTube/Spotify/Figma embeds beaux, présentation en un clic |
| **Coda** | Doc+sheet+app hybride, formules Coda (type Excel), Packs (intégrations natives), buttons exécutables, sub-tables, Coda AI column (génère du contenu par ligne), cross-doc sync |
| **Obsidian** | Local-first, markdown natif, graph view des liens, backlinks, plugins community (4000+), thèmes, canvas mode, daily notes |
| **Craft** | Focus UX beauté pure, blocks + cards, exports beaux, Apple-feel, collab limitée mais présente |
| **Bear** | Markdown-first, minimalist, hashtags comme system d'organisation |
| **Logseq** | Outliner (bullet-list-first), backlinks, PDF annotations, Zotero integration |
| **Roam Research** | Backlinks, block-level references, daily notes, graph database |

## Principes directeurs

1. **Écriture sans friction** — taper, c'est le chemin critique. Zéro latence, zéro popup bloquant, zéro menu obligatoire. Le curseur doit toujours répondre instantanément.
2. **Hybride blocks + WYSIWYG** — on peut écrire linéairement comme dans Word, mais chaque paragraphe est aussi un block drag-and-drop-able comme dans Notion.
3. **Collaboration atomique** — chaque frappe propagée en <150ms, curseurs visibles avec nom et couleur, aucun lock, aucun modal conflict.
4. **Export fidèle** — un PDF ou DOCX exporté ressemble à l'écran à 99%, sans repagination surprenante.
5. **Markdown-compatible** — import/export MD preserve la structure. Les shortcuts markdown (`# ` `- ` `1. ` `> ` `**bold**`) fonctionnent en saisie.
6. **IA assistive, optionnelle** — le bouton IA est toujours à portée (Ctrl+J), jamais intrusif. Suggestions rejetables en 1 touche.

---

## Catégorie 1 — Édition de texte et blocks

### 1.1 Saisie linéaire (type Word)
Le corps principal est un canvas d'écriture continu, pas une liste de blocks. L'utilisateur tape comme dans Word, les paragraphes se créent avec Entrée, les titres via raccourcis ou dropdown. Le mode "block" est disponible en hover (une poignée `⋮⋮` apparaît à gauche de chaque paragraphe pour drag ou menu).

### 1.2 Titres hiérarchiques (Heading 1–6)
Six niveaux de titre, accessibles via :
- Raccourcis : `Ctrl+Alt+1` → H1, `Ctrl+Alt+2` → H2, etc.
- Markdown : taper `# ` au début d'une ligne → H1, `## ` → H2, etc.
- Menu Format ou dropdown de style dans la toolbar
Chaque titre est automatiquement indexé dans l'outline panel.

### 1.3 Paragraphes et sauts de ligne
**Entrée** crée un nouveau paragraphe. **Shift+Entrée** crée un saut de ligne dans le même paragraphe (soft break). Espacement avant/après paragraphe configurable par style. Interligne (simple, 1.15, 1.5, double, personnalisé).

### 1.4 Listes à puces et numérotées
Raccourcis : `Ctrl+Shift+8` → liste à puces, `Ctrl+Shift+7` → liste numérotée. Markdown : `- `, `* `, `+ ` pour puces, `1. ` pour numérotée. Indentation avec Tab, désindentation avec Shift+Tab. Listes imbriquées jusqu'à 9 niveaux. Styles de puce cyclés par niveau (●, ○, ■, etc.). Numérotation auto (1, 1.1, 1.1.1 ou Romains).

### 1.5 Listes de tâches (checklist)
`Ctrl+Shift+9` → todo list. Cases à cocher cliquables qui barrent le texte quand cochées. Suivi via le mode outline (liste des tâches d'un document). Peuvent être liées à des tâches du module Tasks.

### 1.6 Blockquote et aside
`Ctrl+Shift+,` ou markdown `> ` → citation avec bordure gauche et indentation. `Ctrl+Shift+A` → callout avec fond coloré, icône choisie (info, warning, tip, danger, success, note). Utilisé pour les messages d'alerte ou les notes latérales.

### 1.7 Blocs de code
Triple-backtick (` ``` `) + langage → bloc de code avec coloration syntaxique (highlight.js ou Shiki), numéros de ligne, bouton copy-to-clipboard, toggle soft-wrap. Support de 100+ langages. Inline code avec backticks simples.

### 1.8 Toggles (collapsible)
Bloc pliable type Notion. Clic sur la flèche plie/déplie le contenu. Utile pour les FAQ, les sections optionnelles, les longs documents. Raccourci : taper `> ` puis contenu.

### 1.9 Divider / Page break
`---` (Markdown) ou `Insertion > Séparateur` crée une ligne horizontale de séparation. `Insertion > Saut de page` force un changement de page à l'impression/export PDF.

### 1.10 Drag-and-drop de blocs
Survol d'un paragraphe → poignée `⋮⋮` à gauche. Drag pour déplacer le block ailleurs dans le document. Feedback visuel avec ligne d'insertion bleue. Drop sur la corbeille ou Delete-key supprime.

---

## Catégorie 2 — Formatage de texte

### 2.1 Gras, italique, souligné, barré, indices
- **Gras** : `Ctrl+B` ou bouton, rend `<strong>`
- **Italique** : `Ctrl+I` ou bouton, rend `<em>`
- **Souligné** : `Ctrl+U`, rend `<u>`
- **Barré** : `Alt+Shift+5` ou `Ctrl+Alt+X`, rend `<s>`
- **Exposant** : `Ctrl+.`, rend `<sup>`
- **Indice** : `Ctrl+,`, rend `<sub>`
Toggle on/off sur sélection existante. Les marks se cumulent (bold+italic = `<strong><em>`).

### 2.2 Couleur de texte et de surlignage
Picker de couleurs prédéfinies + custom hex. Onglet "Texte" et "Surlignage". Éviter les contrastes illisibles avec un avertissement si combo fond+texte en dessous de WCAG AA.

### 2.3 Police et taille
Dropdown de polices (Google Fonts + fontes système : Arial, Times New Roman, Courier, Georgia, Verdana, Trebuchet, Comic Sans, Impact, + 50 Google Fonts populaires). Taille en pt (8 à 72) avec boutons `A-` et `A+`.

### 2.4 Alignement horizontal
Gauche (`Ctrl+Shift+L`), centré (`Ctrl+Shift+E`), droite (`Ctrl+Shift+R`), justifié (`Ctrl+Shift+J`).

### 2.5 Retrait et interligne
Bouton `Augmenter le retrait` et `Diminuer le retrait` (Tab / Shift+Tab au début de ligne). Espacement avant/après paragraphe. Interligne configurable (1, 1.15, 1.5, 2, personnalisé).

### 2.6 Liens
Sélectionner du texte + `Ctrl+K` → dialogue avec URL, texte affiché, option `Ouvrir dans un nouvel onglet`, option `nofollow`. Raccourci markdown `[texte](url)` auto-converti.

### 2.7 Suppression du formatage
`Ctrl+\` ou bouton `Effacer la mise en forme` supprime toutes les marks de la sélection (gras, italique, couleur, lien, police custom), conservant uniquement le texte brut.

### 2.8 Format painter
Pinceau copie le format d'une sélection et l'applique à une autre. Double-clic pour coller en boucle (Escape pour sortir). Copie : toutes les marks de texte + alignement + interligne.

### 2.9 Styles nommés (Normal, Titre 1, Titre 2, Emphase, etc.)
Dropdown style dans la toolbar ou panneau `Styles`. Sélection de plusieurs styles pré-définis avec héritage (modifier `Titre 1` met à jour tous les titres du document). Création de styles custom, sauvegardés dans un thème. Import d'un thème Word/Docs.

### 2.10 Caractères spéciaux et emojis
`Insertion > Caractère spécial` ouvre un dialog avec recherche : `→`, `∑`, `π`, `©`, flèches, symboles mathématiques, grec. Emojis via `:nom:` (ex: `:smile:` → 😀) avec autocomplétion, ou via `Insertion > Emoji` avec picker visuel.

---

## Catégorie 3 — Structure et navigation

### 3.1 Outline / Table of Contents automatique
Panneau latéral gauche affiche la structure du document (liste de tous les H1–H6). Clic sur un titre scroll vers lui avec highlight transitoire. Auto-mise-à-jour au fur et à mesure de l'édition.

### 3.2 Table des matières insérable (TOC block)
`Insertion > Table des matières` insère un block dynamique qui liste tous les titres du document avec leur numéro de page (pour l'export PDF) ou leur lien (pour le web). Styles de TOC personnalisables.

### 3.3 Numérotation des pages et en-têtes/pieds
`Insertion > En-tête` et `> Pied de page` ouvrent des zones éditables séparées. Variables disponibles : `[page]`, `[total]`, `[auteur]`, `[titre]`, `[date]`. Modes : même pour tout le doc, différents pair/impair, différent sur la 1ère page.

### 3.4 Notes de bas de page et notes de fin
`Insertion > Note de bas de page` (`Ctrl+Alt+F`) crée une référence numérotée dans le texte et une zone de note en bas de la page. Notes de fin de document (`Ctrl+Alt+E`) concentrées à la fin. Numérotation automatique, renumérotation au déplacement.

### 3.5 Signets (bookmarks)
`Insertion > Signet` place un signet invisible. Liens internes vers un signet : `Insertion > Lien > Vers un signet`. Utile pour les documents longs avec renvois internes.

### 3.6 Breadcrumb navigation
En haut du document : `Espace de travail > Dossier > Sous-dossier > Document actuel`. Chaque niveau clickable pour remonter.

### 3.7 Outline mode (focus + structure)
Bouton `Mode plan` passe l'éditeur en vue hiérarchique (une ligne par titre), permettant de réorganiser rapidement par drag-and-drop. Retour au mode normal conserve les changements.

### 3.8 Colonnes multiples
`Format > Colonnes` divise la page en 1, 2, ou 3 colonnes. Espacement et ligne de séparation configurables. Saut de colonne manuel.

### 3.9 Marges, orientation, taille de page
`Fichier > Mise en page` : format (A4, A3, Letter, Legal, personnalisé), orientation (portrait/paysage), marges (haut/bas/gauche/droite en mm ou cm). Preview en live.

### 3.10 Saut de section
Permet de changer la mise en page (orientation, marges, colonnes) en cours de document. `Insertion > Saut de section > Page suivante/continu`.

---

## Catégorie 4 — Tables (tableaux dans le document)

### 4.1 Insertion de table
`Insertion > Tableau` avec grille de sélection (hover pour choisir 3×4, 5×5, etc.). Création d'une table vide avec cellules éditables.

### 4.2 Édition de cellules
Tab passe à la cellule suivante (crée une nouvelle ligne si à la fin). Shift+Tab en arrière. Enter crée un paragraphe dans la cellule (pas une nouvelle ligne de table). Redimensionnement par drag des bordures.

### 4.3 Ajout/suppression de lignes/colonnes
Menu contextuel clic droit ou boutons flottants `+` au bord de la table. Suppression avec confirmation si la ligne/colonne contient du contenu.

### 4.4 Fusion de cellules
Sélectionner plusieurs cellules + `Format > Tableau > Fusionner les cellules`. Défusion restaure les cellules individuelles. Header rows (première ligne en gras + fond), header cols (première colonne).

### 4.5 Styles de tableau
Thèmes pré-définis (bordures simples, zebra, minimaliste, moderne). Bordures configurables par cellule (couleur, épaisseur, style : plein, pointillé, tiret). Couleur de fond par cellule.

### 4.6 Tri et filtres inline
Bouton `Tri` sur l'en-tête d'une colonne → ascendant/descendant. Filtre par valeur ou condition. Persistant dans le document.

### 4.7 Formules dans les cellules (Notion-style)
Taper `=` au début d'une cellule → formule. Fonctions basiques : SUM, AVG, MIN, MAX, COUNT sur la colonne ou des cellules. Référence `A1` comme dans un tableur mais pas de dépendance cross-doc.

### 4.8 Tableaux liés à une base (embed sheet)
`Insertion > Tableau lié` sélectionne un classeur tableur du drive. Rendu read-only d'une plage ou d'une vue. Se met à jour en direct quand la source change.

---

## Catégorie 5 — Médias et embeds

### 5.1 Images
`Insertion > Image` depuis : fichier local, URL, drive, webcam, stock photos (Unsplash/Pexels intégré). Édition inline : redimensionner par poignées, rotation, alignement (inline, wrap left/right, center, behind), bordure, ombre, filtres (N&B, sépia), texte alternatif pour accessibilité.

### 5.2 Crop et annotation d'image
Double-clic sur une image → mode édition : crop, masque (rectangle, cercle, rounded), luminosité/contraste, annotation (flèches, textes, surlignage). Sauvegarde inline sans quitter le doc.

### 5.3 Galerie d'images
Insérer plusieurs images côte à côte en grille. Modes : grille uniforme, masonry, carrousel, slideshow. Cliquable pour lightbox.

### 5.4 Vidéo et audio
`Insertion > Vidéo/Audio` : upload fichier, URL YouTube/Vimeo/Loom (embed natif avec player), enregistrement webcam/micro direct. Mini-player inline avec contrôles.

### 5.5 Embeds universels (oEmbed)
Coller une URL de YouTube, Vimeo, Twitter, Figma, Miro, Loom, GitHub, CodePen, Spotify, Google Maps, Airtable, Notion → conversion automatique en embed riche avec preview et interactivité.

### 5.6 Fichiers joints
Drag-drop d'un fichier PDF, DOCX, XLSX → block "fichier" avec icône, nom, taille, bouton télécharger, et preview (si PDF/image). Double-clic ouvre dans un dialog avec viewer.

### 5.7 Diagrammes Mermaid
Block ` ```mermaid ` avec syntaxe Mermaid → rendu SVG automatique (flowchart, séquence, gantt, class, state, er, journey, pie). Éditeur split view côte à côte avec preview temps réel.

### 5.8 Formules mathématiques LaTeX
`$formule$` pour inline math, `$$formule$$` pour block. Rendu KaTeX (MIT). Éditeur visuel d'équations avec palette de symboles pour ceux qui ne connaissent pas LaTeX.

### 5.9 Dessin inline (whiteboard embedded)
`Insertion > Dessin` ouvre un mini-whiteboard (canvas de dessin libre + formes + texte). Sauvegarde en SVG dans le document.

### 5.10 Captures d'écran intégrées
Bouton `Capture d'écran` démarre un tool de capture natif (croppable) et insère l'image directement dans le doc. Utile pour la rédaction de documentation technique.

---

## Catégorie 6 — Collaboration et commentaires

### 6.1 Édition multi-utilisateurs temps réel
Curseurs de chaque collaborateur visibles avec son nom et sa couleur personnelle. Les sélections textuelles des autres utilisateurs sont surlignées avec leur teinte. Propagation sub-200ms via Yjs.

### 6.2 Liste des personnes présentes
Avatars en haut à droite des utilisateurs actuellement dans le doc. Hover montre nom, rôle (propriétaire, éditeur, etc.), et la ligne qu'ils sont en train d'éditer. Clic sur un avatar scroll jusqu'à leur curseur.

### 6.3 Commentaires ancrés à une sélection
Sélectionner du texte → bouton `Ajouter un commentaire` ou `Ctrl+Alt+M` → bulle latérale avec input. Le texte commenté est surligné en jaune. Thread de réponses. @mention d'un utilisateur envoie une notif.

### 6.4 Résolution de commentaires
Bouton `Résoudre` archive le commentaire (texte reste en place sans surlignage). Toggle `Voir les résolus` dans le panneau commentaires. Réouverture possible.

### 6.5 Panneau de tous les commentaires
Bouton `Commentaires` dans la barre ouvre un panneau latéral listant tous les threads du document avec filtres : ouverts, résolus, mes commentaires, mentions, non lus, par auteur, par section du doc.

### 6.6 Mode Suggestion (track changes)
Toggle `Mode suggestion` : chaque modification devient une suggestion (insertion en vert, suppression en rouge barré) avec l'auteur. Propriétaire peut `Accepter tout`, `Rejeter tout`, ou valider/rejeter individuellement. Historique de qui a proposé quoi.

### 6.7 Version history détaillée
`Fichier > Historique des versions` ouvre un panneau chronologique. Versions groupées par session d'édition. Diff affiché en split view (texte supprimé en rouge, ajouté en vert). Restaurer une version ou nommer une version (`v1.0 envoyée au client`).

### 6.8 @mentions avec notifications
Taper `@` suivi d'un nom → autocomplétion des utilisateurs de l'org. L'utilisateur mentionné reçoit une notif email + push + in-app avec lien direct vers la ligne. Mentions dans le corps du doc (vs commentaires) également supportées.

### 6.9 Share dialog et permissions
Bouton `Partager` ouvre dialog avec :
- Utilisateurs individuels (email + rôle)
- Lien public (lecteur/commentateur/éditeur)
- Restrictions : expiration, password, domain-only, pas d'export, pas d'impression, watermark
- Transfert de propriété

### 6.10 Chat intégré au document
Bouton `Chat` ouvre un mini-chat lié au document (différent des commentaires qui sont ancrés au texte). Discussion globale sur le doc, éphémère ou persistante. Messages avec @mentions.

### 6.11 Live cursor position broadcast
Les positions de curseur sont diffusées en temps réel aux autres utilisateurs. Optionnel (l'utilisateur peut désactiver "Afficher mon curseur aux autres"). Pour les réunions où on veut suivre où l'animateur lit.

### 6.12 Indicateur "En train de taper"
Au-dessus d'un curseur étranger, une petite bulle "John tape..." apparaît brièvement quand cet utilisateur écrit.

---

## Catégorie 7 — Smart Chips et intégrations

### 7.1 Smart chip @personne
Taper `@jean` insère une carte cliquable avec avatar, nom, email, rôle. Hover ouvre un mini-profile card. Clic ouvre le profil complet dans un side-panel.

### 7.2 Smart chip @date
Taper `@date` ou `@2026-04-15` insère une date formatée. Clic ouvre un picker pour changer la date. Affichage adaptatif : "Aujourd'hui", "Demain", "15 avril", etc.

### 7.3 Smart chip @fichier
Taper `@` + nom de fichier → autocomplétion des fichiers du drive accessibles. Insertion comme smart chip (icône + nom + chemin). Hover preview du contenu.

### 7.4 Smart chip @événement
Taper `@` + titre d'un événement calendrier → lien vers l'événement. Affichage date, heure, participants. Clic ouvre l'événement dans le module Calendar.

### 7.5 Smart chip @lieu
Taper `@` + adresse → insertion d'un chip avec mini-map, itinéraire, et lien vers Google Maps / OpenStreetMap.

### 7.6 Smart chip @tâche
Taper `@tâche` + description → crée une tâche dans le module Tasks et insère un chip lié. Cochable inline dans le doc.

### 7.7 Smart chip @e-mail
Taper `@mail:` + adresse → chip cliquable qui pré-remplit un brouillon dans le module Mail.

### 7.8 Smart chip @GPS / coordonnées
`@gps:48.8566,2.3522` → chip avec mini-map centrée sur les coordonnées.

### 7.9 Smart chip de propriétés (depuis une base)
Lien vers une ligne d'un tableur ou d'une base Airtable-like → affiche une mini carte avec les champs importants. Mise à jour automatique quand la source change.

### 7.10 Smart chip de métriques
`@metric:sales-total-q1` → affiche une valeur issue d'un dashboard ou d'une requête SQL. Actualisée en direct.

---

## Catégorie 8 — IA intégrée

### 8.1 Continue writing
`Ctrl+J` ou menu `IA` sur une sélection vide → le LLM continue le texte dans le ton et le style du document existant. Multiples suggestions alternatives. Accepter/Rejeter/Regenerate.

### 8.2 Improve writing
Sur une sélection : `IA > Améliorer`. Le LLM retourne 2-3 versions améliorées (fluidité, grammaire, concision, clarté). Preview avec diff. Accepter une version ou rejeter.

### 8.3 Reformulation par ton
`IA > Changer le ton` : Formel, Décontracté, Persuasif, Amical, Académique, Marketing, Technique. Le texte sélectionné est réécrit dans le ton choisi.

### 8.4 Résumé automatique
`IA > Résumer` sur tout le document ou une sélection. Génère 3 longueurs : courte (1 phrase), moyenne (1 paragraphe), longue (1 page). Insertion comme nouveau paragraphe ou copie dans le presse-papier.

### 8.5 Traduction
`IA > Traduire vers...` avec 30+ langues. Détection automatique de la source. Résultat peut remplacer la sélection ou s'ajouter en-dessous. Glossaire de termes non-traduisibles.

### 8.6 Correction grammaire et orthographe
Soulignement rouge pour les erreurs d'orthographe, bleu pour grammaire, vert pour style. Clic droit sur le mot souligné → suggestions de correction. Support multi-langue avec détection par langue de paragraphe.

### 8.7 Génération de plan / brainstorm
`IA > Brainstormer` ou `Créer un plan` à partir d'un titre ou d'un prompt. Le LLM génère une structure hiérarchique (titres + sous-titres + bullet points) à partir de laquelle l'utilisateur peut ensuite développer.

### 8.8 Extraction d'actions (action items)
Sur un compte-rendu de réunion : `IA > Extraire les actions`. Le LLM liste les actions (`@Jean : envoyer le devis avant vendredi`) et les crée comme tâches liées dans le module Tasks.

### 8.9 Génération de contenu structuré
Prompt : "Écrire une proposition commerciale pour un projet de refonte web, client SaaS B2B, budget 50k€". Le LLM génère un doc complet avec titres, corps, annexes, signature.

### 8.10 Q&A sur le document
Panneau `Demander à l'IA` : poser une question en langage naturel, le LLM cherche la réponse dans le contenu du doc et renvoie la réponse avec citation des passages sources.

### 8.11 Code assistant (pour les docs techniques)
Dans un bloc de code, bouton `Expliquer le code` / `Ajouter des commentaires` / `Corriger les bugs` / `Convertir en langage X`. Utilisé pour les READMEs et docs d'API.

### 8.12 Suggestions de liens internes
Analyse du texte pour suggérer des liens vers d'autres documents du workspace qui traitent du même sujet. Augmente la découvrabilité du knowledge base.

---

## Catégorie 9 — Import, export et compatibilité

### 9.1 Import DOCX
`Fichier > Importer` : upload d'un `.docx` → conversion vers le format natif. Préservation des styles, titres, listes, tables, images, commentaires, track changes, en-têtes/pieds. Alertes sur les éléments non supportés (macros VBA, OLE objects).

### 9.2 Import Markdown
Upload de `.md` → parsing des éléments markdown (titres, listes, liens, images, code, bold, italic, tables, blockquote). Smart detection des extensions GFM (task lists, strikethrough, tables, autolinks).

### 9.3 Import HTML
Paste depuis le web ou upload d'un `.html` → conversion vers le format natif en préservant titres, styles, liens, images.

### 9.4 Export DOCX
`Fichier > Télécharger > Word` exporte en `.docx` fidèle : styles, titres, listes, tables, images, commentaires, track changes. Compatible avec Word desktop et Google Docs.

### 9.5 Export PDF
`Fichier > Télécharger > PDF` : options de mise en page (A4/Letter/personnalisé), marges, en-têtes/pieds, TOC, numérotation, watermark, protection par mot de passe, métadonnées (auteur, titre, sujet). Preview avant téléchargement.

### 9.6 Export Markdown
Export en `.md` pur avec GFM. Les éléments non-supportés (smart chips, formules, embeds complexes) sont convertis en best-effort (liens + note de bas de page).

### 9.7 Export HTML
Export en `.html` standalone avec styles embedés. Utile pour publication web. Option `avec CSS externe`.

### 9.8 Export ePub (pour livres numériques)
Pour les documents longs structurés, export en `.epub` avec TOC, couverture, métadonnées. Compatible Kindle, Apple Books, Kobo.

### 9.9 Export LaTeX (pour publications scientifiques)
Documents avec équations et structure académique : export vers `.tex` pour post-traitement. Fidélité partielle (images exportées séparément).

### 9.10 Publication web (public URL)
`Fichier > Publier sur le web` génère une URL publique stable du document en HTML propre (lecture seule), indexable par les moteurs de recherche. SEO metadata configurables.

---

## Catégorie 10 — Performance et accessibilité

### 10.1 Virtualisation pour longs documents
Seules les pages visibles sont rendues dans le DOM. Un doc de 500 pages doit scroller à 60fps. La recherche globale traverse quand même tout le contenu (indexé en mémoire).

### 10.2 Auto-save et résilience
Chaque frappe sauvegardée via Yjs en <200ms. Indicateur "Enregistré" en haut. Crash du navigateur = au prochain chargement, récupération complète jusqu'à la dernière frappe. Pas de "sauvegardez avant de quitter".

### 10.3 Offline-first
Édition fonctionne hors-ligne complet. Les changements sont queuées et réconciliés au retour en ligne via CRDT. Indicateur "Hors-ligne" visible quand c'est le cas.

### 10.4 Accessibilité WCAG AA
Navigation 100% clavier. Screen reader annonce la structure (titres, listes, tables). Focus visible sur tous les éléments interactifs. Contrastes respectant AA.

### 10.5 Mode focus / zen
Bouton `Mode focus` masque toute la UI sauf le document (toolbar, sidebars, commentaires). Réduit les distractions. Toggle avec F11 ou raccourci.

### 10.6 Mode sombre
Toggle dark mode. Tous les éléments (texte, tables, code, images embed) ont un rendering adapté. Préserve les couleurs custom du document (on ne remet pas tout en dark, on adapte le chrome).

### 10.7 Mode lecture
Vue simplifiée : police plus grande, largeur limitée pour le confort de lecture, pas de toolbar d'édition, pas de commentaires. Utilisé pour consommer un doc finalisé.

### 10.8 Recherche dans le document
`Ctrl+F` ouvre une barre de recherche flottante. Résultats surlignés en jaune, navigation avec `Entrée` et `Shift+Entrée`. `Ctrl+H` ouvre le remplacement (match case, whole word, regex). Remplacer tout avec confirmation.

### 10.9 Word count / statistiques
Bouton en bas affiche : mots, caractères, paragraphes, pages. Clic ouvre un dialog détaillé avec temps de lecture estimé, densité de mots, niveau de lecture (Flesch).

### 10.10 Dictation (voice typing)
Bouton micro activate la dictée vocale. Transcription en temps réel. Commandes vocales pour ponctuation ("point", "virgule", "nouveau paragraphe"). Support 30+ langues.

---

## Catégorie 11 — Templates et gouvernance

### 11.1 Galerie de templates
Bibliothèque de templates pré-construits : CR de réunion, proposition commerciale, rapport trimestriel, CV, lettre de motivation, rapport de projet, cahier des charges, PRD, ADR (architecture decision record), policy, guide, newsletter. Templates publics + organisation + personnels.

### 11.2 Templates depuis un document existant
`Fichier > Enregistrer comme template` copie la structure et les styles (pas le contenu) comme base réutilisable. Métadonnées du template : nom, description, tags, catégorie.

### 11.3 Variables et autofill
Template avec placeholders : `{{client_name}}`, `{{project_title}}`, `{{date}}`. À l'ouverture, dialog pour remplir les variables qui sont ensuite substituées dans tout le document.

### 11.4 Templates d'organisation approuvés
Admin peut définir des templates officiels (charte graphique, marque, structure imposée) que tous les utilisateurs peuvent utiliser. Templates versionés.

### 11.5 Publipostage (mail merge)
Charger une source de données (CSV, tableur, base) → générer N documents en remplaçant les variables par les valeurs de chaque ligne. Utilisé pour contrats personnalisés, courriers de masse.

### 11.6 Classification du document
`Fichier > Classification` : Public, Interne, Confidentiel, Secret. Bandeau visuel et règles d'export/partage selon le niveau.

### 11.7 Watermark automatique
Sur les documents classifiés, watermark diagonal avec nom utilisateur + horodatage visible à l'écran et sur les PDFs exportés.

### 11.8 Audit logs
Log immuable : qui a ouvert, édité, commenté, partagé, exporté, imprimé. Exportable pour conformité.

### 11.9 Rétention et archivage
Règles automatiques de rétention : suppression après X années, archivage après X mois d'inactivité. Journal des suppressions.

### 11.10 Legal hold
Marquer un document sous séquestre → aucune modification ni suppression possible, même par le propriétaire. Utilisé pour les litiges.

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **Google Docs Help** (support.google.com/docs) — guides complets sur les features, keyboard shortcuts, collaboration, templates.
- **Microsoft Word Support** (support.microsoft.com/word) — docs par scénario, best practices, tutoriels vidéo.
- **Notion Help & Learn** (notion.so/help) — guides databases, blocks, AI, templates, "use cases" très visuels.
- **Notion Mastery** (thomasjfrank.com/notion) — guides communautaires très profonds sur les patterns avancés.
- **Dropbox Paper Help** (help.dropbox.com/create-upload/paper) — guides minimalistes sur l'édition.
- **Coda Help Center** (help.coda.io) — docs sur les Packs, formules, tables, buttons.
- **Obsidian Help** (help.obsidian.md) — docs markdown, linking, graph, plugins.
- **Craft Docs Help** (docs.craft.do) — patterns d'écriture beaux.
- **ProseMirror Guide** (prosemirror.net/docs/guide) — documentation fondatrice sur les éditeurs structurés.
- **Tiptap Docs** (tiptap.dev/docs) — guide complet de l'éditeur Tiptap (base actuelle de SignApps).
- **CommonMark Spec** (commonmark.org/help) — référence sur le markdown standard.

### Projets open source permissifs à étudier comme pattern
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **Tiptap** (tiptap.dev, github.com/ueberdorf/tiptap) | **MIT** | Base actuelle du module Docs. Éditeur headless au-dessus de ProseMirror avec extensions. |
| **ProseMirror** (prosemirror.net) | **MIT** | Fondation de Tiptap. Modèle de document structuré, schéma, transactions atomiques, collaboration. |
| **Lexical** (lexical.dev, Meta) | **MIT** | Moderne, performant, alternative à ProseMirror. Bon pattern pour les transforms et les plugins. |
| **Slate** (slatejs.org) | **MIT** | Framework d'édition React. Pattern pour les nested docs et les custom elements. |
| **Quill** (quilljs.com) | **BSD-3-Clause** | Éditeur WYSIWYG classique. Pattern pour les modules et les toolbars. |
| **CKEditor 5** | **GPL v2+** | **INTERDIT** (GPL). Commercial License required pour production. Ne pas utiliser. |
| **TinyMCE** | **MIT** (CE) / Commercial | CE MIT limitée. Référence pour les bubble menus et les dialogs. |
| **Novel.sh** (github.com/steven-tey/novel) | **Apache-2.0** | Éditeur Notion-style sur Tiptap avec IA intégrée. Excellent pattern pour Notion-like + AI. |
| **BlockNote** (blocknote.js.org) | **MPL-2.0** | **Weak copyleft** — OK comme consommateur (pas fork de fichiers MPL). Bon pattern block-based. |
| **Remirror** (remirror.io) | **MIT** | Framework au-dessus de ProseMirror. Extensions et presets. |
| **Plate** (platejs.org) | **MIT** | Plugin system de Slate avancé. Pattern pour les slash commands et les mentions. |
| **Editor.js** (editorjs.io) | **Apache-2.0** | Block-based editor avec sortie JSON propre. Pattern pour l'export machine-readable. |
| **Yjs** (github.com/yjs/yjs) | **MIT** | CRDT pour collab. Déjà intégré dans SignApps. |
| **y-prosemirror** (github.com/yjs/y-prosemirror) | **MIT** | Binding ProseMirror + Yjs. Pattern pour la collaboration temps réel sur l'éditeur. |
| **Marked** (marked.js.org) | **MIT** | Parser Markdown. Pour l'import/export MD. |
| **unified.js / remark** (unifiedjs.com) | **MIT** | Pipeline de transformation markdown. Pattern pour l'import/export sophistiqué. |
| **mammoth.js** (github.com/mwilliamson/mammoth.js) | **BSD-2-Clause** | Conversion DOCX → HTML. Pattern pour l'import Word. |
| **docx** (github.com/dolanmiu/docx) | **MIT** | Génération DOCX côté JS. Pattern pour l'export Word. |
| **KaTeX** (katex.org) | **MIT** | Rendu LaTeX rapide. Pour les équations. |
| **Mermaid** (mermaid.js.org) | **MIT** | Rendu de diagrammes. Déjà standard pour les docs techniques. |
| **Shiki** (shiki.matsu.io) | **MIT** | Syntaxe highlighting avec thèmes VSCode. Alternative à highlight.js. |
| **highlight.js** (highlightjs.org) | **BSD-3-Clause** | Syntaxe highlighting. Plus léger que Shiki pour les docs simples. |

### Pattern d'implémentation recommandé
1. **Éditeur de base** : Tiptap (MIT) déjà utilisé. Continuer à capitaliser dessus avec des extensions custom (slash commands, smart chips, embeds).
2. **Collaboration** : `y-prosemirror` (MIT) pour Yjs + ProseMirror. Awareness pour les curseurs. Déjà en place.
3. **Block-based UX inspiration** : Novel.sh (Apache-2.0) et BlockNote (MPL-2.0 consommateur) comme références pour l'UX moderne. **Ne pas copier, s'inspirer.**
4. **Slash commands** : pattern Novel.sh ou Tiptap `Suggestion` extension. Déjà en place.
5. **Markdown** : `marked` (MIT) ou `remark` (MIT) pour l'import/export. `remark` préférable pour la transformation avancée.
6. **DOCX import** : `mammoth.js` (BSD-2) pour l'import. `docx` (MIT) pour l'export.
7. **PDF export** : `pdf-lib` (MIT) ou `jsPDF` (MIT). Préférer `pdf-lib` pour les PDFs complexes.
8. **Math** : KaTeX (MIT) pour le rendu LaTeX. Plugin Tiptap existe.
9. **Mermaid** : déjà une extension Tiptap. Version MIT.
10. **Code blocks** : Shiki (MIT) pour le highlight riche, lowlight/highlight.js pour le léger.
11. **Smart chips** : pattern Tiptap `Mention` + extensions custom pour chaque type de chip.
12. **AI integration** : appels REST vers le module AI interne de SignApps. Streaming avec Server-Sent Events ou WebSocket. Pattern Novel.sh pour le "continue writing".
13. **Voice typing** : Web Speech API natif ou whisper-rs (Unlicense) côté serveur pour une meilleure qualité.

### Ce qu'il ne faut PAS faire
- **Jamais utiliser CKEditor 5** (GPL) ni forker son code.
- **Pas de copier-coller** depuis les projets ci-dessus, même MIT. S'inspirer, réécrire.
- **Pas d'utilisation de Handsontable récent** (commercial) pour les tables — utiliser l'extension Tiptap `Table` (MIT).
- **Respect strict** de la politique de licences (voir `deny.toml`, `memory/feedback_license_policy.md`).

---

## Assertions E2E clés (à tester)

- Saisie texte, création de paragraphes, soft-line-break (Shift+Entrée)
- Titres H1-H6 via raccourcis et markdown
- Listes à puces, numérotées, à tâches avec indentation
- Gras, italique, souligné, barré, exposant, indice
- Alignement gauche/centre/droite/justifié
- Couleur texte et surlignage
- Liens avec Ctrl+K et markdown `[texte](url)`
- Blockquote et callout
- Blocks de code avec syntax highlighting
- Toggles pliables
- Drag-and-drop d'un paragraphe
- Tables : insertion, tab navigation, ajout/suppression ligne/colonne, fusion
- Images : upload, redimensionnement, alignement
- Embeds : YouTube, Figma, Miro
- Mermaid et KaTeX rendent correctement
- Outline panel liste les titres et navigue au clic
- Commentaire ancré à une sélection, réponse, résolution
- Mode suggestion avec accept/reject par changement
- Version history avec restore
- @mentions de personne, date, fichier, événement, lieu
- IA : continue writing, améliorer, résumer, traduire
- Recherche Ctrl+F, remplacement Ctrl+H
- Word count visible
- Export DOCX, PDF, Markdown
- Import DOCX et Markdown avec préservation de structure
- Template depuis galerie
- Publipostage depuis une source de données
- Mode focus masque la UI
- Mode sombre et mode lecture
