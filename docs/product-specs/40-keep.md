# Module Keep (Notes) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Google Keep** | Masonry grid fluide, couleurs de fond par note, checklists integrees, rappels date+lieu, labels/etiquettes, OCR sur images, partage collaboratif, quick capture depuis n'importe quelle app Google, archive et corbeille, dessin a la main libre |
| **Apple Notes** | Rich text natif, scan de documents, tableaux inline, dossiers imbriques, Smart Folders avec filtres auto, tags, mentions @, liens inter-notes, integration Siri et Spotlight, partage iCloud, verrouillage par note (Face ID/Touch ID) |
| **Notion** | Blocs modulaires (texte, image, toggle, callout, code, embed), databases inline, relations entre pages, templates, web clipper, AI integrée, synced blocks, table of contents auto, breadcrumb navigation |
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
En haut de la vue principale, un champ input discret avec placeholder `Saisir une note...`. Clic dessus = expansion avec champs titre + contenu. Clic en dehors ou bouton `Fermer` = creation automatique si du contenu existe. Pas de bouton "Sauvegarder" explicite.

### 1.2 Note texte libre
Le contenu principal est du texte brut multi-lignes. Retour a la ligne natif. Pas de formatage riche par defaut (simplicite Keep-style), mais possibilite de basculer en rich-text via un toggle futur.

### 1.3 Note checklist
Bouton checkbox dans la barre d'outils du quick capture. Active le mode checklist : chaque ligne devient un item cochable. Ajout d'item par `Enter`. Suppression par backspace sur un item vide. Items coches descendent dans une section `Terminé` repliable.

### 1.4 Couleur de fond par note
Palette de 12 couleurs (corail, peche, sable, menthe, sauge, brume, orage, crepuscule, fleur, argile, craie, defaut). Changement via bouton palette dans la toolbar de la note. La couleur colore toute la carte dans la grille masonry.

### 1.5 Epinglage de notes
Bouton pin sur chaque note. Les notes epinglees apparaissent dans une section `Epinglees` en haut, le reste dans `Autres`. L'epinglage persiste apres rechargement.

### 1.6 Labels / etiquettes
Systeme de tags par note. Creation de labels depuis le menu de la note ou depuis la sidebar. Filtre rapide par label dans la sidebar. Un label peut etre assigne a plusieurs notes et une note peut avoir plusieurs labels.

---

## Categorie 2 — Organisation et navigation

### 2.1 Grille masonry responsive
Affichage par defaut en grille masonry (colonnes de largeur fixe, hauteur variable selon le contenu). Responsive : 4 colonnes desktop, 3 tablette, 2 mobile, 1 tres petit ecran. Animation fluide au reflow.

### 2.2 Vue liste
Toggle grille/liste en haut a droite. La vue liste affiche les notes en lignes horizontales avec titre, apercu du contenu, date, labels, couleur de bordure gauche. Tri par date de modification.

### 2.3 Sidebar de navigation
Sidebar gauche avec les vues : Notes, Rappels, Archive, Corbeille. Chaque vue filtre la liste de notes. Les labels apparaissent dans la sidebar comme sous-items cliquables. Sidebar repliable en mode icones.

### 2.4 Recherche instantanee
Barre de recherche en haut. Filtre en temps reel sur titre, contenu, texte OCR, labels. Highlight des termes trouves dans les cartes. Recherche active des le premier caractere.

### 2.5 Sections epinglees / autres
La vue Notes principale affiche deux sections : `Epinglees` (notes avec pin, triees par date modifiee) et `Autres` (notes non epinglees, triees par date modifiee). Si aucune note epinglee, la section est masquee.

### 2.6 Archive
Archiver une note la retire de la vue principale sans la supprimer. Vue `Archives` dans la sidebar. Desarchivage en un clic. Les notes archivees restent cherchables.

### 2.7 Corbeille
Supprimer une note l'envoie en corbeille. Vue `Corbeille` avec options : restaurer ou supprimer definitivement. Bouton `Vider la corbeille` avec confirmation. Auto-purge apres 30 jours (configurable).

---

## Categorie 3 — Edition et enrichissement

### 3.1 Edition inline
Clic sur une note ouvre un dialogue modal avec le titre et le contenu editables. Sauvegarde automatique a la fermeture. Pas de mode lecture vs edition — tout est toujours editable (sauf en corbeille).

### 3.2 OCR sur images
Bouton `Scanner une image` dans la toolbar de la note. Upload ou capture camera. L'IA extrait le texte de l'image (via signapps-ai OCR capability). Le texte extrait est stocke comme metadonnee cherchable. L'image originale est conservee.

### 3.3 Rappels date/heure
Bouton rappel sur chaque note. Picker date + heure. Le rappel cree une notification push (via signapps-notifications) et optionnellement un evenement dans le calendrier. Rappels visibles dans la vue `Rappels` de la sidebar.

### 3.4 Partage de notes
Bouton partage sur chaque note. Options : partager avec des utilisateurs SignApps (lecture ou edition), copier le lien interne, envoyer par mail. Les notes partagees affichent les avatars des collaborateurs.

### 3.5 Conversion vers d'autres modules
Menu `...` sur la note propose :
- **Convertir en document** — cree un document Docs avec le contenu de la note
- **Convertir en tache** — cree une tache dans Tasks avec le titre de la note
- **Envoyer par chat** — partage le contenu dans une conversation Chat
- **Envoyer par mail** — ouvre le compositeur Mail avec le contenu pre-rempli

### 3.6 Mode presentation
Bouton `Presenter` transforme le contenu de la note en diapositives plein ecran (chaque paragraphe ou item de checklist = une diapositive). Navigation par fleches. Utile pour les brainstormings rapides.

---

## Categorie 4 — Synchronisation et persistance

### 4.1 Persistance backend (API REST)
CRUD complet via l'API keep : `GET/POST/PUT/DELETE /api/v1/notes`. Donnees stockees en PostgreSQL. Index full-text sur titre + contenu + texte OCR. Pagination par curseur.

### 4.2 Optimistic updates
Les mutations (creation, edition, suppression, epinglage, changement de couleur) sont appliquees immediatement en UI via React Query optimistic updates. Rollback automatique en cas d'echec backend.

### 4.3 Offline support
Les notes sont cachees localement (localStorage ou IndexedDB). Les modifications hors-ligne sont enfilees et synchronisees au retour en ligne. Indicateur de statut de connexion.

### 4.4 Mode collaboratif
Les notes partagees en edition supportent l'edition concurrente via Yjs/CRDT (signapps-collab). Curseurs des collaborateurs visibles en temps reel.

---

## Categorie 5 — Securite et gouvernance

### 5.1 Permissions par note
Chaque note a un proprietaire. Le partage definit les roles : proprietaire, editeur, lecteur. Seul le proprietaire peut supprimer ou archiver.

### 5.2 Chiffrement des notes sensibles
Option de marquer une note comme `confidentielle` — chiffrement cote serveur avec cle utilisateur. Acces protege par re-authentification (PIN ou biometrie).

### 5.3 Audit trail
Log de qui a cree, modifie, partage, archive, supprime chaque note. Visible par l'admin dans le panneau d'audit.

### 5.4 Retention policy
Politique de retention configurable par l'admin : durée de conservation des notes supprimees, archivage automatique des notes inactives depuis X mois.

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

- Clic sur le champ de saisie rapide, taper titre + contenu, clic en dehors → note creee dans la grille
- Toggle checklist : les items sont cochables, les items coches descendent
- Changement de couleur d'une note → la carte se colore immediatement
- Epingler une note → elle apparait dans la section `Epinglees`
- Archiver une note → elle disparait de la vue principale, visible dans `Archives`
- Supprimer une note → elle apparait dans `Corbeille`, restauration possible
- Vider la corbeille → suppression definitive avec confirmation
- Recherche par titre, contenu, label → resultats filtres en temps reel
- Toggle grille/liste → le layout change sans perte de donnees
- Ajout/suppression de label sur une note → filtre sidebar mis a jour
- OCR sur image → texte extrait visible et cherchable
- Rappel date/heure → notification apparait a l'heure prevue
- Partage de note → le destinataire la voit dans son Keep
- Conversion note → document Docs cree avec le bon contenu
- Mode presentation → diapositives plein ecran navigables par fleches
