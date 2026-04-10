# Module Keep (Notes) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Google Keep** | Masonry grid fluide, couleurs de fond par note, checklists integrees, rappels date+lieu, labels/etiquettes, OCR sur images, partage collaboratif, quick capture depuis n'importe quelle app Google, archive et corbeille, dessin a la main libre |
| **Apple Notes** | Rich text natif, scan de documents, tableaux inline, dossiers imbriques, Smart Folders avec filtres auto, tags, mentions @, liens inter-notes, integration Siri et Spotlight, partage iCloud, verrouillage par note (Face ID/Touch ID) |
| **Notion** | Blocs modulaires (texte, image, toggle, callout, code, embed), databases inline, relations entre pages, templates, web clipper, AI integree, synced blocks, table of contents auto, breadcrumb navigation |
| **Bear** | Markdown natif, syntax highlighting pour code, tags hierarchiques (#work/project), export multi-format (PDF, HTML, DOCX, EPUB), themes visuels, focus mode, word count, liens inter-notes [[wikilinks]] |
| **Simplenote** | Ultra-leger, markdown toggle, historique version par slider, collaboration temps reel, recherche instantanee sur 100k+ notes, tags, publish to web, PIN-lock, tri par date modifiee/creee/alpha |
| **Standard Notes** | Chiffrement E2E zero-knowledge, editeurs plugins (rich text, code, spreadsheet, Kanban, tasks), extensions, export plain-text, auto-backup, 2FA, themes, note linking, nested tags |
| **Obsidian** | Graphe de liens visuels, plugins communautaires 1000+, Markdown pur, vaults locaux, Canvas (whiteboard), Daily Notes, templates, backlinks panel, outline view, publish, sync E2E |
| **Microsoft OneNote** | Carnets/sections/pages hierarchy, dessin libre, audio recording, ink-to-text, clip web, integration Teams, OCR sur images, tags (to-do, important, question), page templates |

## Principes directeurs

1. **Capture instantanee** — creer une note doit prendre moins de 2 secondes : clic sur le champ de saisie, taper, clic ailleurs = note creee. Zero friction, zero dialogue modal.
2. **Visuel et scannable** — la grille masonry avec couleurs de fond distinctes permet de retrouver une note visuellement sans lire les titres. Les notes epinglees en haut, le reste en dessous.
3. **Checklists first-class** — une note peut basculer entre texte libre et checklist en un clic. Les items coches descendent visuellement. Utile pour les courses, taches rapides, packing lists.
4. **Rappels contextuels** — chaque note peut porter un rappel date/heure qui declenche une notification push. Integration avec le calendrier SignApps.
5. **Recherche exhaustive** — recherche full-text instantanee sur titre, contenu, labels, et texte OCR extrait des images.
6. **Interoperabilite plateforme** — une note peut etre convertie en document Docs, en tache Tasks, ou partagee via Chat/Mail. Les liens entre modules sont bidirectionnels.

---

## Categorie 1 — Capture et creation de notes

### 1.1 Champ de saisie rapide (quick capture)
En haut de la vue principale, un champ input discret avec placeholder `Saisir une note...` affiche en mode replie une seule ligne avec une bordure fine `border-border`. Clic sur le champ declenche une animation expand : le champ s'agrandit en 200ms (`ease-out`) vers un formulaire deux lignes (titre + contenu) avec une toolbar d'actions en bas. La toolbar contient les boutons : checkbox (toggle checklist), palette (couleur), image (upload), rappel (cloche), et un bouton `Fermer`. Clic en dehors du formulaire ou sur `Fermer` cree automatiquement la note si du contenu existe (titre ou corps non vide). Pas de bouton "Sauvegarder" explicite. Si les deux champs sont vides, le formulaire se replie sans creer de note. Animation collapse identique (200ms ease-in). Raccourci clavier : `N` (hors focus input) ouvre le quick capture. `Escape` ferme sans sauvegarder.

### 1.2 Note texte libre
Le contenu principal est du texte brut multi-lignes. Retour a la ligne natif avec `Enter`. Pas de formatage riche par defaut (simplicite Keep-style), mais possibilite de basculer en rich-text via un toggle futur. Le textarea est auto-expanding : la hauteur s'ajuste au contenu sans scrollbar interne. Limite de contenu : 20 000 caracteres par note. Au-dela, un toast avertit `Note trop longue — envisagez de la convertir en document`. Le compteur de caracteres apparait en bas a droite quand le contenu depasse 15 000 caracteres.

### 1.3 Note checklist
Bouton checkbox dans la barre d'outils du quick capture ou dans la toolbar de la note ouverte. Active le mode checklist : chaque ligne devient un item cochable avec une checkbox ronde a gauche. Ajout d'item par `Enter` (cree une nouvelle ligne vide en dessous). Suppression par `Backspace` sur un item vide (fusionne avec la ligne precedente). Items coches descendent automatiquement dans une section `Termine` repliable separee par un trait fin. Animation de transition de 150ms quand un item descend. Le nombre d'items coches / total est affiche en badge sur la carte masonry (`3/7`). Drag-and-drop des items pour reordonner : grab handle (6 dots) a gauche de la checkbox, visible au hover. Le drop cree une animation slide de 100ms. Les items ne peuvent pas etre dragges entre la section active et la section terminee — il faut cocher/decocher.

### 1.4 Couleur de fond par note
Palette de 12 couleurs accessible via le bouton palette dans la toolbar de la note. Les couleurs sont :
- `default` — `bg-card` (blanc en light, gris fonce en dark)
- `coral` — `#FAAFA8` (light) / `#77172E` (dark)
- `peach` — `#F39F76` (light) / `#692B17` (dark)
- `sand` — `#FFF8B8` (light) / `#7C4A03` (dark)
- `mint` — `#E2F6D3` (light) / `#264D3B` (dark)
- `sage` — `#B4DDD3` (light) / `#0C625D` (dark)
- `fog` — `#D3E4EC` (light) / `#256377` (dark)
- `storm` — `#AECCDC` (light) / `#284255` (dark)
- `dusk` — `#D3BFDB` (light) / `#472E5B` (dark)
- `blossom` — `#F6E2DD` (light) / `#6C394F` (dark)
- `clay` — `#E9E3D4` (light) / `#4B443A` (dark)
- `chalk` — `#EFEFF1` (light) / `#232427` (dark)

Changement de couleur applique immediatement le fond a la carte masonry et au dialogue d'edition. Transition CSS `background-color 200ms ease`. La couleur est stockee comme enum string dans le champ `color` de la note.

### 1.5 Epinglage de notes
Bouton pin (icone thumbtack) en haut a droite de chaque carte. Clic toggle l'etat epingle. Les notes epinglees apparaissent dans une section `Epinglees` en haut de la grille, separee des `Autres` par un label discret en majuscules grises (`text-muted-foreground`, taille 11px, tracking wide). L'epinglage persiste apres rechargement (stocke en base de donnees). Animation : la carte glisse vers la section epinglees en 250ms. Si aucune note epinglee, la section et son label sont masques. Ordre dans la section epinglees : par date de modification descendante. Raccourci dans le dialogue de note : `Ctrl+Shift+P` toggle le pin.

### 1.6 Labels / etiquettes
Systeme de tags par note. Un label est un texte court (max 50 caracteres, alphanumerique + tirets + espaces). Creation de labels depuis le menu `...` de la note (`Ajouter un label`) ou depuis la sidebar (`Modifier les labels`). Le menu d'ajout affiche un champ de recherche/creation : taper un texte filtre les labels existants, et si aucun match, propose `Creer "mon-label"`. Un label peut etre assigne a plusieurs notes et une note peut avoir jusqu'a 20 labels. Les labels apparaissent comme des chips sous le contenu de la carte masonry (taille 11px, fond `bg-muted`, coins arrondis). Clic sur un chip de label filtre la vue sur ce label.

### 1.7 Label management sidebar
Dans la sidebar gauche, sous les vues principales, une section `Labels` liste tous les labels existants avec un compteur de notes. Clic sur un label filtre la grille masonry pour n'afficher que les notes portant ce label. Bouton crayon a droite de chaque label pour renommer ou supprimer. Renommer un label met a jour toutes les notes qui le portent. Supprimer un label le retire de toutes les notes (confirmation requise : `Supprimer le label "X" ? Il sera retire de Y notes.`). Bouton `+ Creer un label` en bas de la section. Ordre alphabetique. Max 200 labels par utilisateur.

### 1.8 Images et fichiers joints
Bouton image (icone montagne) dans la toolbar du quick capture et de l'edition. Upload via input file (accept `image/*,application/pdf`). Preview de l'image en miniature dans la carte masonry (max height 200px, object-fit cover, coins arrondis 8px). Plusieurs images par note (max 10, max 10 MB chacune). Les images sont stockees via signapps-storage (port 3004) et referencees par URL interne. Clic sur une image l'ouvre en plein ecran dans un lightbox avec zoom (molette) et navigation (fleches si plusieurs images). Suppression d'une image via bouton `X` au hover de la miniature.

---

## Categorie 2 — Organisation et navigation

### 2.1 Grille masonry responsive
Affichage par defaut en grille masonry (colonnes de largeur fixe 240px, hauteur variable selon le contenu). Le nombre de colonnes s'adapte au viewport :
- Desktop large (>1400px) : 4 colonnes
- Desktop (>1024px) : 3 colonnes
- Tablette (>640px) : 2 colonnes
- Mobile (<640px) : 1 colonne

Implementation CSS pure avec `column-count` et `break-inside: avoid` sur les cartes. Gap entre les cartes : 8px horizontal, 8px vertical. Animation fluide au reflow lors du redimensionnement de la fenetre (transition 300ms). Chaque carte a un `border-radius: 8px`, une bordure fine `border-border`, et une ombre au hover (`shadow-md`, transition 150ms). La hauteur maximale d'une carte dans la grille est 400px avec overflow hidden et un gradient de fade en bas pour indiquer du contenu tronque.

### 2.2 Vue liste
Toggle grille/liste en haut a droite (deux icones : grille 4 carres, liste 3 lignes). La vue liste affiche les notes en lignes horizontales full-width avec : titre (gras, tronque a 60 caracteres), apercu du contenu (1 ligne, tronque, `text-muted-foreground`), date de modification (format relatif : `il y a 2h`), labels (chips compacts), couleur de bordure gauche (4px de la couleur de fond de la note). Tri par date de modification descendante. Hauteur de ligne fixe : 56px. Hover : fond `bg-muted`. Clic ouvre le dialogue d'edition.

### 2.3 Sidebar de navigation
Sidebar gauche avec largeur 240px (desktop), repliable en mode icones 48px sur tablette, masquee en drawer sur mobile. Sections de la sidebar :
- **Notes** (icone ampoule) — vue principale avec toutes les notes actives
- **Rappels** (icone cloche) — notes ayant un rappel actif ou passe
- **Archive** (icone boite) — notes archivees
- **Corbeille** (icone poubelle) — notes supprimees

Separateur, puis section **Labels** avec la liste des labels (voir 1.7). Chaque item de la sidebar affiche un compteur a droite. L'item actif a un fond `bg-accent` et une bordure gauche `primary` de 3px. Transition de fond 150ms. La sidebar est repliable via un bouton hamburger en haut. Etat replie persiste dans localStorage.

### 2.4 Recherche instantanee
Barre de recherche en haut de la page, pleine largeur dans le header. Icone loupe a gauche, placeholder `Rechercher dans les notes...`. Filtre en temps reel (debounce 200ms) sur : titre, contenu texte, texte OCR extrait des images, noms des labels. Les termes trouves sont highlight en jaune (`bg-yellow-200/50`) dans les cartes de la grille. La recherche est active des le premier caractere. Si aucun resultat, afficher un empty state `Aucune note ne correspond a "terme"`. Raccourci clavier : `/` (hors focus input) place le focus dans la barre de recherche. `Escape` vide la recherche et restaure la vue complete.

### 2.5 Sections epinglees / autres
La vue Notes principale affiche deux sections : `Epinglees` (titre en uppercase gris, 11px, espacement large) suivie de la grille masonry des notes pinnees, puis `Autres` avec la grille des notes non epinglees. Si aucune note epinglee, la section Epinglees et son titre sont masques. Si aucune note non epinglee, la section Autres et son titre sont masques. Le tri dans chaque section est par date de modification descendante.

### 2.6 Archive
Archiver une note la retire de la vue principale sans la supprimer. Action via le menu `...` de la note ou raccourci `E` dans le dialogue ouvert. Toast de confirmation `Note archivee` avec bouton `Annuler` (5 secondes). Vue `Archives` dans la sidebar : meme grille masonry mais avec un bandeau discret en haut `Vous consultez les archives`. Desarchivage via le menu `...` de la note (`Desarchiver`) ou raccourci `E`. Les notes archivees restent cherchables depuis la barre de recherche globale (avec un badge `Archive` sur la carte dans les resultats). Les notes archivees conservent leurs labels, couleur et rappels.

### 2.7 Corbeille
Supprimer une note (menu `...` > `Supprimer` ou raccourci `Delete` dans le dialogue) l'envoie en corbeille. Toast `Note supprimee` avec bouton `Annuler` (5 secondes). Vue `Corbeille` dans la sidebar avec les notes supprimees affichees en grille. Chaque note affiche un badge `Supprimee il y a X jours`. Actions disponibles par note : `Restaurer` (remet dans Notes) et `Supprimer definitivement` (suppression irreversible avec confirmation modale). Bouton `Vider la corbeille` en haut de la vue avec confirmation modale `Supprimer definitivement X notes ? Cette action est irreversible.`. Auto-purge apres 30 jours (configurable par l'admin de 7 a 90 jours). Les notes en corbeille ne sont pas editables et ne sont pas cherchables depuis la barre de recherche globale.

### 2.8 Compteur de notes
En haut de la grille masonry, un texte discret en `text-muted-foreground` indique le nombre de notes affiches : `42 notes` (ou `12 notes sur 42` si un filtre est actif). Le compteur se met a jour en temps reel lors de la recherche, du filtrage par label, et du changement de vue (Notes, Archives, Corbeille).

### 2.9 Tri et ordre
Le tri par defaut est par date de modification descendante. Menu de tri en haut a droite avec options : `Date de modification`, `Date de creation`, `Titre (A-Z)`, `Titre (Z-A)`, `Couleur`. Le tri persiste dans localStorage par vue (Notes, Archive, Label specifique). Le tri par couleur groupe les notes de meme couleur ensemble, dans l'ordre de la palette (defaut, coral, peach, ..., chalk).

---

## Categorie 3 — Edition et enrichissement

### 3.1 Edition inline (dialogue modal)
Clic sur une carte de note ouvre un dialogue modal centre (max-width 600px, max-height 80vh, coins arrondis 12px). Le dialogue affiche : champ titre editable (input, placeholder `Titre`, police 18px bold), champ contenu editable (textarea auto-expand, placeholder `Saisir une note...`), les labels en chips en bas, la toolbar d'actions (palette, image, rappel, pin, archive, supprimer, partage, menu `...`). Fond du dialogue = couleur de la note. Overlay sombre derriere (`bg-black/50`). Fermeture par clic sur l'overlay, bouton `X` en haut a droite, ou `Escape`. Sauvegarde automatique a la fermeture (pas de bouton Sauvegarder). Pas de mode lecture vs edition — tout est toujours editable (sauf en corbeille ou les champs sont desactives). Animation d'ouverture : scale de 0.95 a 1 + fade-in en 200ms. Animation de fermeture : scale de 1 a 0.95 + fade-out en 150ms.

### 3.2 OCR sur images
Bouton `Scanner une image` dans la toolbar de la note (icone camera/scan). Upload ou capture camera (sur mobile, `capture="environment"` pour la camera arriere). L'image est envoyee a signapps-media (port 3009) via `POST /api/v1/media/ocr` avec le fichier en multipart. Le service media utilise sa capacite OCR native pour extraire le texte. Pendant le traitement, un spinner s'affiche sur l'image avec le texte `Extraction en cours...`. Le texte extrait est stocke comme metadonnee `ocr_text` de la note (champ JSONB) et est indexe pour la recherche full-text. L'image originale est conservee et affichee en miniature. Si l'OCR echoue (image floue, pas de texte), un toast `Aucun texte detecte dans l'image` s'affiche. L'utilisateur peut relancer l'OCR manuellement via le menu de l'image.

**Endpoint backend :**
```
POST /api/v1/media/ocr
Content-Type: multipart/form-data
Body: file (image/png, image/jpeg, application/pdf)
Response: { "text": "Texte extrait...", "confidence": 0.92, "language": "fr" }
```

### 3.3 Rappels date/heure
Bouton rappel (icone cloche) dans la toolbar de la note. Clic ouvre un popover avec :
- Presets rapides : `Aujourd'hui 18h`, `Demain 9h`, `Lundi prochain 9h`
- Datepicker custom avec selecteur d'heure (heures + minutes par increments de 15 min)
- Option `Creer un evenement calendrier` (checkbox, decochee par defaut)

Validation cree le rappel. Un badge cloche jaune apparait sur la carte masonry. A l'heure du rappel, une notification push est envoyee via signapps-notifications (port 8095) avec le titre de la note et un apercu du contenu. Si l'option calendrier est cochee, un evenement est cree dans signapps-calendar (port 3011) via PgEventBus event `keep.reminder.created { note_id, user_id, remind_at }`. Le calendrier ecoute cet evenement et cree un CalendarEvent de type `reminder`.

Les rappels passes sont marques avec un badge gris `Passe` au lieu de jaune. Vue `Rappels` dans la sidebar liste toutes les notes avec rappels, groupees en `A venir` et `Passes`. Supprimer un rappel via le popover (bouton `Supprimer le rappel`).

**PgEventBus events :**
- `keep.reminder.created` — payload: `{ note_id: UUID, user_id: UUID, remind_at: DateTime }`
- `keep.reminder.fired` — payload: `{ note_id: UUID, user_id: UUID }`
- `keep.reminder.deleted` — payload: `{ note_id: UUID, user_id: UUID }`

### 3.4 Partage de notes
Bouton partage (icone personne+fleche) dans la toolbar de la note. Clic ouvre un dialogue de partage avec :
- Champ email/nom pour ajouter des collaborateurs (autocomplete depuis l'annuaire SignApps via signapps-identity)
- Pour chaque collaborateur ajoute : selecteur de role `Editeur` ou `Lecteur`
- Section `Collaborateurs actuels` listant les personnes avec leur role et un bouton `X` pour retirer
- Bouton `Copier le lien interne` — copie l'URL `signapps.local/keep/notes/{id}` dans le presse-papier avec toast `Lien copie`
- Bouton `Envoyer par mail` — ouvre le compositeur Mail (signapps-mail) avec le contenu de la note pre-rempli
- Bouton `Envoyer par chat` — ouvre un picker de conversation Chat (signapps-chat) et envoie un lien enrichi

Les notes partagees affichent les avatars des collaborateurs en bas a gauche de la carte (max 3 avatars empiles, puis `+N`). Le proprietaire est toujours affiche en premier. Notification push au destinataire lors du partage (`keep.note.shared { note_id, owner_id, target_user_id, role }`).

### 3.5 Dessin a main libre (drawing)
Bouton dessin (icone crayon) dans la toolbar du quick capture et de l'edition. Active un canvas de dessin superpose au contenu de la note. L'utilisateur dessine avec la souris ou le doigt (tactile). Couleurs disponibles : noir, rouge, bleu, vert (palette compacte). Epaisseurs : fin (2px), moyen (4px), epais (8px). Le dessin est sauvegarde comme image SVG attachee a la note. Bouton `Gomme` pour effacer des traits. Bouton `Effacer tout` pour repartir de zero. Le dessin apparait en miniature dans la carte masonry. Sur mobile, le mode dessin occupe tout l'ecran avec les outils en bas.

### 3.6 Duplication de notes
Menu `...` > `Dupliquer`. Cree une copie identique de la note (titre, contenu, couleur, labels, images, checklist items). Le titre est prefixe avec `Copie de `. La note dupliquee est creee comme non epinglee et non archivee. Les rappels et le partage ne sont pas dupliques. Toast : `Note dupliquee`.

### 3.7 Collaboration en temps reel sur notes partagees
Les notes partagees en mode `Editeur` supportent l'edition concurrente via Yjs/CRDT (signapps-collab port 3013). Un document Yjs est cree par note partagee. Les modifications du titre et du contenu sont synchronisees en temps reel (<200ms de latence). Indicateur en haut du dialogue : avatars des collaborateurs connectes avec un point vert. Pas de curseur visible dans le texte (contrairement a Docs) car le contenu est du texte brut — mais un indicateur `X est en train d'editer...` s'affiche sous le titre quand un autre utilisateur tape.

### 3.6 Historique de versions
Chaque modification d'une note cree un snapshot dans l'historique (debounce de 30 secondes — les modifications rapprochees sont groupees). Menu `...` > `Historique des versions` ouvre un panneau lateral avec la chronologie des modifications : date/heure, auteur, apercu du diff (texte ajoute en vert, texte supprime en rouge). Clic sur une version affiche la note dans cet etat (lecture seule). Bouton `Restaurer cette version` remet le contenu a cette version. L'historique conserve les 100 dernieres versions par note. Au-dela, les versions les plus anciennes sont purgees (sauf les versions manuellement nommees).

### 3.9 Conversion vers d'autres modules
Menu `...` sur la note propose :
- **Convertir en document** — cree un document Docs (signapps-docs port 3010) avec le titre comme nom de document et le contenu comme corps. PgEventBus event `keep.note.converted { note_id, target_module: "docs", target_id }`. La note originale est conservee avec un badge `Converti en document` et un lien vers le document.
- **Convertir en tache** — cree une tache dans Tasks avec le titre de la note comme nom de tache et le contenu comme description. Si c'est une checklist, chaque item non coche devient une sous-tache.
- **Envoyer par chat** — partage le contenu dans une conversation Chat selectionnee via un picker de conversation
- **Envoyer par mail** — ouvre le compositeur Mail avec le contenu pre-rempli dans le corps et le titre en objet

Chaque conversion loggue un event dans l'audit trail et affiche un toast avec un lien vers l'element cree.

### 3.10 Mode presentation
Bouton `Presenter` dans le menu `...` de la note. Transforme le contenu en diapositives plein ecran (fond = couleur de la note, texte centre, police grande 32px). Chaque paragraphe (separe par une ligne vide) ou chaque item de checklist devient une diapositive. Navigation par fleches gauche/droite ou par les touches `ArrowLeft`/`ArrowRight`. Indicateur de progression en bas (`3 / 7`). `Escape` ou bouton `X` quitte le mode presentation. Transition entre diapositives : fade 200ms. Le mode presentation fonctionne aussi sur les notes partagees (tous les collaborateurs voient la meme diapositive si le mode `Follow` est actif).

---

## Categorie 4 — Import et export

### 4.0 Web clipper (futur)
Extension navigateur ou bookmarklet permettant de clipper du contenu web directement en note Keep. L'utilisateur selectionne du texte ou une image sur une page web, clique sur l'icone Keep dans la toolbar du navigateur, et la selection est creee comme nouvelle note avec le titre de la page en titre et l'URL en metadonnee. Le clipper supporte : texte brut, images (screenshot de la selection), et liens. La note creee est automatiquement taggee avec le label `Web Clip`.

### 4.1 Import de notes
Menu `...` global (en haut de la page) > `Importer des notes`. Formats supportes :
- **Google Keep export** (JSON) — import des notes avec titre, contenu, couleur, labels, checklists, images
- **Fichier texte** (.txt) — chaque fichier devient une note
- **Markdown** (.md) — le contenu Markdown est converti en texte brut (les headers deviennent le titre)
- **CSV** — colonnes `title`, `content`, `color`, `labels` (separes par `;`), `pinned` (true/false)

Dialogue d'import avec drag-drop zone, preview du nombre de notes a importer, et bouton `Importer X notes`. Toast de confirmation a la fin.

### 4.2 Export de notes
Menu `...` global > `Exporter les notes`. Options :
- **JSON** — export complet avec toutes les metadonnees (titre, contenu, couleur, labels, rappels, checklist items, dates, images en base64 ou references)
- **Markdown** (un fichier .md par note, zippees)
- **PDF** (un PDF par note ou un PDF consolide)
- **CSV** (colonnes titre, contenu, couleur, labels, date creation, date modification)

Filtres d'export : toutes les notes, notes epinglees seulement, un label specifique, un range de dates. Nom du fichier : `keep_export_{user}_{date}.{format}`. Progress bar pour les exports volumineux (>100 notes).

### 4.3 Integration avec les autres modules
Le module Keep s'integre avec les autres modules SignApps via PgEventBus :
- **Calendrier** : les rappels creent des evenements dans signapps-calendar. Les evenements de calendrier peuvent generer une note de prep (bouton `Creer une note` sur l'evenement).
- **Tasks** : conversion note → tache. Le temps passe sur une tache liee est visible dans la note via un widget compact `Temps passe : Xh`.
- **Chat** : partage rapide d'une note dans une conversation. Le message affiche un apercu riche (titre, debut du contenu, couleur).
- **Mail** : envoi du contenu d'une note par email. Le corps de l'email est formate avec le contenu brut de la note.
- **Drive** : les images attachees aux notes sont stockees dans Drive sous un dossier cache `Keep/Images/{note_id}/`.
- **Docs** : conversion note → document pour les notes qui depassent les limites de Keep (formatage riche, longueur).

---

## Categorie 5 — Synchronisation et persistance

### 5.1 API REST complete

**Base path :** `/api/v1/keep`

| Methode | Endpoint | Description |
|---|---|---|
| `GET` | `/notes` | Liste paginee des notes (cursor-based). Query params : `cursor`, `limit` (defaut 50, max 200), `label`, `color`, `pinned`, `archived`, `trashed`, `search`, `sort_by` (modified, created, title), `sort_order` (asc, desc) |
| `GET` | `/notes/:id` | Detail d'une note avec ses labels, images, rappel, collaborateurs |
| `POST` | `/notes` | Creer une note. Body : `{ title?, content?, color?, pinned?, labels?: string[], checklist_items?: [{text, checked}] }` |
| `PUT` | `/notes/:id` | Mettre a jour une note. Body partiel accepte (merge patch) |
| `DELETE` | `/notes/:id` | Soft-delete (envoie en corbeille). `?permanent=true` pour suppression definitive |
| `POST` | `/notes/:id/archive` | Archiver une note |
| `POST` | `/notes/:id/unarchive` | Desarchiver une note |
| `POST` | `/notes/:id/pin` | Epingler une note |
| `POST` | `/notes/:id/unpin` | Desepingler une note |
| `POST` | `/notes/:id/share` | Partager une note. Body : `{ user_id, role: "editor" | "reader" }` |
| `DELETE` | `/notes/:id/share/:user_id` | Retirer un collaborateur |
| `POST` | `/notes/:id/reminder` | Creer un rappel. Body : `{ remind_at: DateTime, create_calendar_event?: bool }` |
| `DELETE` | `/notes/:id/reminder` | Supprimer le rappel |
| `POST` | `/notes/:id/images` | Upload une image (multipart/form-data) |
| `DELETE` | `/notes/:id/images/:image_id` | Supprimer une image |
| `GET` | `/labels` | Liste de tous les labels de l'utilisateur |
| `POST` | `/labels` | Creer un label. Body : `{ name: string }` |
| `PUT` | `/labels/:id` | Renommer un label. Body : `{ name: string }` |
| `DELETE` | `/labels/:id` | Supprimer un label (le retire de toutes les notes) |
| `POST` | `/notes/trash/empty` | Vider la corbeille |
| `GET` | `/notes/:id/versions` | Historique des versions d'une note |
| `POST` | `/notes/:id/versions/:version_id/restore` | Restaurer une version |

Toutes les reponses suivent le format RFC 7807 pour les erreurs (`AppError`). Auth par JWT (middleware `signapps-common`). Pagination par curseur opaque (base64 encoded `modified_at + id`).

### 5.2 PostgreSQL schema

```sql
-- Table principale des notes
CREATE TABLE keep_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) DEFAULT '',
    content TEXT DEFAULT '',
    color VARCHAR(20) NOT NULL DEFAULT 'default',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    is_trashed BOOLEAN NOT NULL DEFAULT FALSE,
    trashed_at TIMESTAMPTZ,
    is_checklist BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_at TIMESTAMPTZ,
    reminder_calendar_event_id UUID,
    ocr_text TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour la recherche full-text
CREATE INDEX idx_keep_notes_search ON keep_notes
    USING GIN (to_tsvector('french', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(ocr_text, '')));
CREATE INDEX idx_keep_notes_user_id ON keep_notes(user_id);
CREATE INDEX idx_keep_notes_user_archived ON keep_notes(user_id, is_archived) WHERE is_trashed = FALSE;
CREATE INDEX idx_keep_notes_user_trashed ON keep_notes(user_id, is_trashed);
CREATE INDEX idx_keep_notes_user_pinned ON keep_notes(user_id, is_pinned) WHERE is_archived = FALSE AND is_trashed = FALSE;
CREATE INDEX idx_keep_notes_reminder ON keep_notes(reminder_at) WHERE reminder_at IS NOT NULL;

-- Items de checklist
CREATE TABLE keep_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES keep_notes(id) ON DELETE CASCADE,
    text TEXT NOT NULL DEFAULT '',
    is_checked BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_keep_checklist_items_note ON keep_checklist_items(note_id, sort_order);

-- Labels
CREATE TABLE keep_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE INDEX idx_keep_labels_user ON keep_labels(user_id);

-- Association notes <-> labels (many-to-many)
CREATE TABLE keep_note_labels (
    note_id UUID NOT NULL REFERENCES keep_notes(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES keep_labels(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, label_id)
);

CREATE INDEX idx_keep_note_labels_label ON keep_note_labels(label_id);

-- Images attachees
CREATE TABLE keep_note_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES keep_notes(id) ON DELETE CASCADE,
    storage_key VARCHAR(500) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    width INTEGER,
    height INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_keep_note_images_note ON keep_note_images(note_id, sort_order);

-- Partage de notes
CREATE TABLE keep_note_shares (
    note_id UUID NOT NULL REFERENCES keep_notes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('editor', 'reader')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (note_id, user_id)
);

CREATE INDEX idx_keep_note_shares_user ON keep_note_shares(user_id);

-- Historique de versions
CREATE TABLE keep_note_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES keep_notes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(500),
    content TEXT,
    snapshot_name VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_keep_note_versions_note ON keep_note_versions(note_id, created_at DESC);
```

### 5.3 PgEventBus events

| Event | Payload | Consumers |
|---|---|---|
| `keep.note.created` | `{ note_id, user_id }` | Metrics, Search index |
| `keep.note.updated` | `{ note_id, user_id, fields_changed: string[] }` | Search index, Collab sync |
| `keep.note.deleted` | `{ note_id, user_id, permanent: bool }` | Search index, Storage cleanup |
| `keep.note.archived` | `{ note_id, user_id }` | Search index |
| `keep.note.shared` | `{ note_id, owner_id, target_user_id, role }` | Notifications, Identity |
| `keep.note.unshared` | `{ note_id, owner_id, target_user_id }` | Notifications |
| `keep.reminder.created` | `{ note_id, user_id, remind_at }` | Calendar, Notifications scheduler |
| `keep.reminder.fired` | `{ note_id, user_id }` | Notifications push |
| `keep.reminder.deleted` | `{ note_id, user_id }` | Calendar (delete event), Notifications scheduler |
| `keep.note.converted` | `{ note_id, user_id, target_module, target_id }` | Target module (Docs, Tasks) |
| `keep.label.created` | `{ label_id, user_id, name }` | — |
| `keep.label.deleted` | `{ label_id, user_id }` | — |

### 5.4 Optimistic updates
Les mutations (creation, edition, suppression, epinglage, changement de couleur) sont appliquees immediatement en UI via React Query optimistic updates. Le store local (Zustand `keep-store.ts`) est mis a jour en premier, puis la requete API est envoyee. En cas d'echec backend (erreur reseau, 4xx, 5xx), rollback automatique de l'optimistic update avec toast d'erreur `Erreur de sauvegarde — reessayez`. Retry automatique 3 fois avec backoff exponentiel (1s, 2s, 4s).

### 5.5 Offline support
Les notes sont cachees dans IndexedDB via `idb-keyval` (MIT). Structure du cache : `{ notes: Note[], labels: Label[], lastSync: ISO8601 }`. Les modifications hors-ligne sont enfilees dans une queue persistante (`keep_offline_queue` dans IndexedDB). Au retour en ligne (event `navigator.onLine`), la queue est rejouee sequentiellement. Conflits resolus par `last-write-wins` avec timestamp. Indicateur de statut de connexion en haut a droite : point vert `En ligne`, point gris `Hors ligne`. Pendant le replay de la queue, un spinner s'affiche a cote de l'indicateur.

### 5.6 Mode collaboratif
Les notes partagees en edition supportent l'edition concurrente via Yjs/CRDT (signapps-collab port 3013). Un document Yjs par note (room name : `keep:note:{note_id}`). Le titre est un Y.Text, le contenu est un Y.Text, les checklist items sont un Y.Array de Y.Map. Les curseurs des collaborateurs ne sont pas visibles dans le texte (Keep est minimaliste), mais le `awareness` protocol de Yjs est utilise pour afficher les avatars des collaborateurs connectes.

---

## Categorie 6 — Securite et gouvernance

### 6.1 Permissions par note
Chaque note a un proprietaire (`user_id`). Le partage definit les roles : proprietaire (CRUD + share + delete), editeur (read + update content/labels/color/checklist), lecteur (read only). Seul le proprietaire peut supprimer, archiver, ou modifier le partage. Les editeurs ne peuvent pas supprimer definitivement. Les lecteurs ne peuvent pas modifier le contenu ni les metadonnees.

### 6.2 Chiffrement des notes sensibles
Option de marquer une note comme `confidentielle` via le menu `...` > `Verrouiller cette note`. La note est chiffree cote serveur avec une cle derivee du mot de passe utilisateur (AES-256-GCM). Acces protege par re-authentification (PIN de 6 chiffres ou mot de passe). Les notes verrouillees affichent une icone cadenas sur la carte masonry et ne montrent pas de preview du contenu. Le titre est visible mais le contenu est masque par `Note verrouillee — cliquez pour deverrouiller`. Apres deverrouillage (PIN valide), la note reste accessible pendant 5 minutes avant de se reverrouiller automatiquement.

### 6.3 Audit trail
Log de qui a cree, modifie, partage, archive, supprime chaque note. Chaque action est enregistree dans `keep_audit_log` avec : `action`, `note_id`, `user_id`, `timestamp`, `details` (JSONB). Visible par l'admin dans le panneau d'audit (signapps-identity). Retention des logs : 2 ans par defaut (configurable).

### 6.4 Retention policy
Politique de retention configurable par l'admin :
- Duree de conservation des notes en corbeille (defaut 30 jours, configurable 7-90)
- Archivage automatique des notes inactives depuis X mois (desactive par defaut)
- Purge des images orphelines (images dont la note a ete supprimee definitivement) : quotidienne
- Purge de l'historique de versions au-dela de 100 versions par note : hebdomadaire

---

## Categorie 7 — Raccourcis clavier et accessibilite

### 7.1 Raccourcis clavier
| Raccourci | Action |
|---|---|
| `N` | Ouvrir le quick capture (hors focus input) |
| `/` | Focus dans la barre de recherche (hors focus input) |
| `Escape` | Fermer le dialogue/quick capture, vider la recherche |
| `Ctrl+Shift+P` | Toggle pin sur la note ouverte |
| `E` | Archiver/desarchiver la note ouverte |
| `Delete` | Supprimer la note ouverte |
| `J` / `K` | Note suivante / precedente dans la grille (navigation clavier) |
| `Enter` | Ouvrir la note selectionnee |
| `Ctrl+Z` | Annuler la derniere action (undo optimistic update) |
| `G` puis `N` | Naviguer vers la vue Notes |
| `G` puis `R` | Naviguer vers la vue Rappels |
| `G` puis `A` | Naviguer vers la vue Archives |
| `G` puis `T` | Naviguer vers la vue Corbeille |

Les raccourcis sont desactives quand un input ou textarea a le focus. Un panneau `?` (touche `?`) affiche la liste des raccourcis en dialogue modal.

### 7.2 Accessibilite WCAG AA
- Navigation complete au clavier : Tab entre les cartes, Enter pour ouvrir, Escape pour fermer
- Lecteur d'ecran : chaque carte a un `aria-label` descriptif (`Note: {titre}, {nombre items checklist}, couleur {couleur}, {epinglee/non-epinglee}`)
- Contrastes AA sur toutes les couleurs de fond de note (les couleurs de la palette sont testees pour garantir un ratio >=4.5:1 avec le texte noir/blanc)
- Les boutons d'action ont des labels ARIA (`aria-label="Epingler cette note"`, `aria-label="Archiver"`)
- Les toasts sont annonces via `aria-live="polite"`
- Le focus est trap dans le dialogue modal d'edition (pas de tab-out accidentel)

### 7.3 Mobile responsive
Sur mobile (<640px) :
- Le quick capture occupe toute la largeur, toolbar en scroll horizontal
- La grille masonry passe a 1 colonne (cartes pleine largeur)
- La sidebar devient un drawer glissant depuis la gauche (swipe right depuis le bord)
- Le dialogue d'edition occupe 100% de l'ecran (pas de modal centre)
- Le bouton flottant `+` (FAB, 56px, couleur `primary`) en bas a droite remplace le quick capture en haut
- Le scan OCR ouvre directement la camera
- Les rappels proposent des presets adaptes au mobile (plus gros boutons)

### 7.4 Drag and drop
Les notes dans la grille masonry ne sont pas reordonnables par drag-and-drop (le tri est toujours automatique par date/titre/couleur). En revanche :
- Drag-and-drop d'une image depuis le bureau vers le quick capture ou un dialogue de note → l'image est uploadee et attachee
- Drag-and-drop d'un fichier texte/markdown → le contenu est importe comme nouvelle note
- Drag-and-drop d'un label depuis la sidebar sur une carte de note → le label est ajoute a la note
- Drag-and-drop d'items de checklist → reordonnement (voir 1.3)

Le feedback visuel pendant le drag est un overlay bleu semi-transparent sur la zone cible avec le texte `Deposer ici`.

### 7.5 Performance et limites
- Nombre max de notes par utilisateur : 10 000 (au-dela, warning `Vous approchez de la limite`)
- Nombre max de labels : 200 par utilisateur
- Nombre max d'images par note : 10 (max 10 MB chacune)
- Nombre max de checklist items par note : 100
- Taille max du contenu texte : 20 000 caracteres
- La grille masonry utilise la virtualisation CSS (`contain: content`) pour les listes longues (>100 notes)
- Les images dans la grille sont lazy-loaded (placeholder gris 16:9 jusqu'au chargement)
- La recherche full-text utilise l'index GIN PostgreSQL, temps de reponse cible < 100ms pour 10 000 notes

### 7.6 Notifications push
Les rappels declenchent des notifications push via signapps-notifications (port 8095) :
- **Web Push** : notification navigateur avec titre de la note, apercu du contenu (40 caracteres), et actions `Ouvrir` / `Reporter 1h`
- **Mobile Push** : notification native avec son, vibration, et deep link vers la note
- **Email** (optionnel) : email de rappel avec le contenu complet de la note

Les notifications de partage (`X a partage une note avec vous`) sont egalement push. Configurable dans `Settings > Notifications > Keep`.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Google Keep Help Center** (support.google.com/keep) — documentation officielle, guide utilisateur, raccourcis.
- **Apple Notes User Guide** (support.apple.com/guide/notes) — guide fonctionnel complet, Smart Folders, scan documents.
- **Notion Help Center** (notion.so/help) — databases, templates, blocs, partage.
- **Bear App Documentation** (bear.app/faq) — markdown, tags, export.
- **Obsidian Help** (help.obsidian.md) — vaults, plugins, graph view, templates.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Notesnook** (github.com/streetwriters/notesnook) | **GPL-3.0** | **INTERDIT** — reference pedagogique uniquement via docs publiques. |
| **Trilium** (github.com/zadam/trilium) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. |
| **Joplin** (github.com/laurent22/joplin) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. |
| **Memos** (github.com/usememos/memos) | **MIT** | Architecture Go + React pour notes rapides. Pattern quick capture, tags, archive. |
| **Flatnotes** (github.com/dullage/flatnotes) | **MIT** | Notes markdown simples. Pattern de recherche full-text, UI minimaliste. |
| **TiddlyWiki** (github.com/Jermolene/TiddlyWiki5) | **BSD-3-Clause** | Pattern de micro-contenus lies (tiddlers), tags, filtres avances. |
| **Hedgedoc** (github.com/hedgedoc/hedgedoc) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Pattern collab temps reel. |
| **react-masonry-css** (github.com/paulcollett/react-masonry-css) | **MIT** | Layout masonry CSS pur pour React. Pattern d'affichage grille responsive. |

---

## Assertions E2E cles (a tester)

- Clic sur le champ de saisie rapide → le formulaire s'expande en 200ms avec titre + contenu + toolbar
- Taper titre + contenu, clic en dehors → note creee dans la grille masonry
- Clic en dehors avec champs vides → formulaire se replie sans creer de note
- Toggle checklist : les items sont cochables, les items coches descendent dans la section Termine
- Drag-and-drop d'items de checklist → reordonnement persiste apres rechargement
- Changement de couleur d'une note → la carte se colore immediatement (transition 200ms)
- Epingler une note → elle apparait dans la section `Epinglees` avec animation de glissement
- Desepingler → elle redescend dans la section `Autres`
- Archiver une note → elle disparait de la vue principale, visible dans `Archives`
- Desarchiver → elle reapparait dans la vue principale
- Supprimer une note → elle apparait dans `Corbeille`, restauration possible
- Vider la corbeille → suppression definitive avec confirmation modale
- Recherche par titre, contenu, label → resultats filtres en temps reel avec highlight
- Toggle grille/liste → le layout change sans perte de donnees
- Ajout/suppression de label sur une note → filtre sidebar mis a jour avec compteur
- Renommer un label → mis a jour sur toutes les notes
- OCR sur image → texte extrait visible dans le dialogue et cherchable
- Rappel date/heure → notification apparait a l'heure prevue
- Partage de note en edition → le destinataire la voit dans son Keep et peut editer
- Partage en lecture → le destinataire voit la note mais ne peut pas modifier
- Conversion note → document Docs cree avec le bon contenu et lien retour
- Mode presentation → diapositives plein ecran navigables par fleches
- Responsive : 4 colonnes desktop, 3 tablette, 2 mobile, 1 tres petit ecran
- Offline : modifier une note hors connexion → synchronise au retour en ligne
- Verrouiller une note → le contenu est masque, deverrouillage par PIN
- Historique des versions → restauration d'une version anterieure
- Quick capture raccourci `N` → le formulaire s'ouvre
- Recherche raccourci `/` → focus dans la barre de recherche
