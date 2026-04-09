# Module Outils (Tools) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Zamzar** | Conversion de fichiers en ligne, 1200+ formats supportes, API REST, batch conversion, email delivery, cloud storage integration, OCR sur images, conversion video/audio/ebook |
| **CloudConvert** | API-first file conversion, 200+ formats, webhooks, S3/Azure/GCS integration, task pipelines (convert + optimize + merge), sandbox mode, haute fidelite, batch processing |
| **Stirling PDF** | Open source (GPL mais reference), PDF self-hosted, merge, split, rotate, compress, OCR, watermark, signature, metadata, conversion (PDF ↔ images/Word/HTML), pipeline d'operations chainee |
| **SmallPDF** | PDF complet en ligne : compress, merge, split, convert (PDF ↔ Word/Excel/PPT/images), e-sign, edit, protect, unlock, batch, UI/UX exemplaire, desktop app |
| **LibreOffice headless** | Conversion de documents en ligne de commande, formats office (ODS/ODT/ODP ↔ XLSX/DOCX/PPTX ↔ PDF), macros, filtres custom, self-hosted, zero licence |
| **Pandoc** | Convertisseur universel de documents texte : Markdown ↔ HTML ↔ LaTeX ↔ DOCX ↔ EPUB ↔ PDF (via LaTeX/wkhtmltopdf), templates, filtres Lua, citations, 40+ formats |
| **pdf-lib** | Librairie JavaScript (MIT) pour creer et modifier des PDFs programmatiquement : merge, split, add pages, embed fonts/images, form filling, metadata, encryption |
| **SheetJS** | Librairie JavaScript (Apache-2.0 Community Edition) pour lire/ecrire des fichiers tableur : XLSX, CSV, ODS, Numbers, parsing avance, streaming, formulas, styles, hyperlinks |

## Principes directeurs

1. **Interface a onglets** — la page `/tools` presente trois onglets : `Spreadsheets`, `PDF Tools`, `Presentations`. Chaque onglet est une mini-application autonome avec ses propres zones d'import, d'options et d'export. Navigation horizontale par tabs.
2. **Drag-and-drop universel** — toutes les zones d'import acceptent le drag-and-drop de fichiers depuis le systeme de fichiers local ou depuis le Drive SignApps. Feedback visuel clair (zone en surbrillance, validation du format). Fallback : bouton de selection de fichier classique.
3. **Traitement cote serveur** — les conversions lourdes (XLSX → PDF, ODS → XLSX, PDF merge/split/OCR, ODP → PPTX) sont executees par signapps-office (port 3018) qui utilise LibreOffice headless. Le frontend upload le fichier, attend le resultat, et propose le telechargement.
4. **Traitement cote client quand possible** — les operations legeres (parsing CSV, preview des donnees, generation de petits PDFs) sont traitees cote client avec SheetJS et pdf-lib pour minimiser la latence et la charge serveur.
5. **Fidelite de conversion** — la conversion doit preserver au maximum le formatage source : styles de cellules, formules (converties en valeurs si le format cible ne les supporte pas), images embarquees, mise en page. Un rapport de conversion signale les elements non supportes.
6. **Securite des fichiers** — les fichiers uploades sont stockes temporairement (TTL 1 heure) dans le storage temporaire de signapps-storage, puis supprimes. Aucun fichier utilisateur n'est conserve apres la conversion. Transit chiffre (TLS). Pas d'envoi a des services tiers.

---

## Categorie 1 — Page principale et navigation

### 1.1 En-tete de page
Titre `Tools` avec sous-titre `Spreadsheet import/export, PDF utilities, and presentation export`. Breadcrumb : Accueil > Tools.

### 1.2 Barre d'onglets
Trois onglets horizontaux : `Spreadsheets`, `PDF Tools`, `Presentations`. L'onglet actif est souligne avec la couleur primaire. Le contenu change dynamiquement sans rechargement de page (client-side routing ou tabs state).

### 1.3 Etat par defaut
Au chargement, l'onglet `Spreadsheets` est selectionne par defaut. Chaque onglet conserve son etat interne (fichier charge, options selectionnees) lors de la navigation entre onglets.

### 1.4 Responsive layout
Sur mobile, les onglets passent en mode scrollable horizontal ou en accordion. Les zones de drag-and-drop s'adaptent a la largeur de l'ecran.

---

## Categorie 2 — Spreadsheets (Import/Export tableur)

### 2.1 Zone d'import
Section `Import` avec zone de drag-and-drop affichant le message `Drop CSV or ODS file here`. Formats acceptes : CSV (.csv), ODS (.ods), XLSX (.xlsx), XLS (.xls), TSV (.tsv), Numbers (.numbers). Validation du type MIME et de l'extension a l'upload. Message d'erreur si format non supporte.

### 2.2 Textarea CSV Data
Zone de texte multiligne (`textarea`) labelisee `CSV Data` ou l'utilisateur peut coller directement des donnees CSV brutes (copier-coller depuis un tableur ou un fichier texte). Delimiteur auto-detecte (virgule, point-virgule, tabulation). Bouton `Clear` pour vider la zone.

### 2.3 Preview des donnees
Apres import (fichier ou paste), un tableau HTML affiche un apercu des 50 premieres lignes avec les colonnes detectees. En-tetes auto-detectees (premiere ligne si elle contient du texte non numerique). Compteur : `N lignes x M colonnes detectees`.

### 2.4 Options d'import
- **Delimiteur** : auto-detect, virgule, point-virgule, tabulation, pipe, custom
- **Encodage** : UTF-8 (defaut), UTF-16, ISO-8859-1, Windows-1252
- **Premiere ligne = en-tetes** : toggle (defaut : auto-detect)
- **Feuille a importer** : select (pour les fichiers multi-feuilles ODS/XLSX, affiche la liste des feuilles)

### 2.5 Export Format dropdown
Menu deroulant `Export Format` avec les options : XLSX, CSV, ODS, TSV, JSON, PDF (tableau). Le format par defaut est XLSX.

### 2.6 Bouton Export
Bouton `Exporter` qui declenche la conversion du fichier importe vers le format cible selectionne. Pour CSV → XLSX : traitement cote client via SheetJS. Pour XLSX → PDF : envoi a signapps-office pour conversion via LibreOffice. Telechargement automatique du fichier resultat.

### 2.7 Conversion CSV → XLSX
Parsing du CSV cote client (SheetJS). Generation du fichier XLSX avec : en-tetes en gras, largeurs de colonnes auto-ajustees, types de donnees detectes (nombre, date, texte). Telechargement immediat.

### 2.8 Conversion ODS ↔ XLSX
Upload vers signapps-office qui utilise LibreOffice headless pour la conversion bidirectionnelle. Preservation des formules (converties en valeurs si incompatibles), styles de cellules, feuilles multiples, graphiques embarques.

### 2.9 Conversion vers PDF
Generation d'un PDF tabulaire a partir des donnees importees. Mise en page : orientation paysage si >5 colonnes, en-tetes sur chaque page, pagination, numero de page en pied. Via signapps-office (LibreOffice) pour les fichiers ODS/XLSX, ou via generation cote client (pdf-lib) pour les CSV simples.

### 2.10 Conversion vers JSON
Export des donnees en JSON avec deux modes : array d'objets (chaque ligne = objet avec cles = en-tetes) ou array d'arrays (chaque ligne = array de valeurs). Indentation formatee. Telechargement du fichier `.json`.

### 2.11 Multi-feuilles
Pour les fichiers ODS/XLSX avec plusieurs feuilles : select de la feuille a previsuaiser. Option d'export : feuille courante uniquement ou toutes les feuilles (pour les formats qui le supportent).

### 2.12 Validation des donnees
Apres import, detection des anomalies : lignes vides, colonnes vides, types mixtes dans une colonne, caracteres speciaux. Avertissements non bloquants affiches sous le preview.

---

## Categorie 3 — PDF Tools

### 3.1 Vue d'ensemble PDF Tools
L'onglet `PDF Tools` affiche une grille d'outils PDF disponibles. Chaque outil est une carte avec icone, titre et description. L'utilisateur clique sur un outil pour acceder a son interface dediee.

### 3.2 Merge PDF
Outil pour fusionner plusieurs fichiers PDF en un seul. Zone de drag-and-drop acceptant plusieurs fichiers. Liste ordonnee des fichiers ajoutes avec drag-and-drop pour reordonner. Bouton `Fusionner`. Traitement via signapps-office. Telechargement du PDF resultat.

### 3.3 Split PDF
Outil pour separer un PDF en plusieurs fichiers. Upload d'un PDF unique. Options : split par page (chaque page = un fichier), split par plage (ex: 1-3, 4-7, 8-12), extraction de pages specifiques (ex: 1,3,5,8). Resultat : archive ZIP contenant les fichiers PDF separes.

### 3.4 Compress PDF
Outil pour reduire la taille d'un fichier PDF. Upload d'un PDF. Options de qualite : haute (peu de compression), moyenne (equilibre), basse (compression maximale, perte de qualite images). Affichage : taille originale → taille comprimee (% de reduction). Telechargement du PDF comprime.

### 3.5 Rotate PDF
Outil pour pivoter les pages d'un PDF. Upload d'un PDF. Preview des vignettes de chaque page. Selection des pages a pivoter (toutes, paires, impaires, selection individuelle). Angle : 90, 180, 270 degres. Telechargement du PDF modifie.

### 3.6 PDF to Images
Conversion d'un PDF en images. Upload d'un PDF. Options : format de sortie (PNG, JPEG, WebP), resolution (72, 150, 300 DPI), pages a convertir (toutes ou selection). Resultat : archive ZIP avec une image par page.

### 3.7 Images to PDF
Conversion d'images en PDF. Upload de plusieurs images (JPEG, PNG, WebP, TIFF). Reordonnancement par drag-and-drop. Options : orientation (portrait/paysage), marge (aucune, fine, standard), qualite d'image. Telechargement du PDF genere.

### 3.8 PDF Watermark
Ajout d'un filigrane textuel ou image sur un PDF. Upload du PDF source. Options : texte du filigrane (ou upload image), position (centre, diagonale, en-tete, pied), opacite (slider 0-100%), couleur du texte, taille de police, pages a filigraner (toutes ou selection).

### 3.9 PDF Protect / Unlock
- **Protect** : ajouter un mot de passe a un PDF. Upload du PDF. Saisie du mot de passe. Options : interdire l'impression, interdire la copie, interdire l'edition.
- **Unlock** : retirer le mot de passe d'un PDF (si l'utilisateur connait le mot de passe). Upload du PDF protege. Saisie du mot de passe actuel. Telechargement du PDF deverrouille.

### 3.10 PDF OCR
Reconnaissance optique de caracteres sur un PDF scan. Upload d'un PDF contenant des images de texte. Selection de la langue (francais, anglais, allemand, espagnol, etc.). Traitement via Tesseract (signapps-media OCR). Resultat : PDF searchable avec couche de texte invisible.

### 3.11 PDF Metadata
Afficher et modifier les metadonnees d'un PDF : titre, auteur, sujet, mots-cles, date de creation, date de modification, producteur. Upload du PDF, edition des champs, telechargement du PDF mis a jour.

### 3.12 PDF to Word/Excel
Conversion de PDF vers des formats editables. Upload d'un PDF. Format cible : DOCX ou XLSX. Traitement via signapps-office (LibreOffice). Avertissement : la fidelite depend de la complexite du PDF source. Telechargement du fichier converti.

### 3.13 Word/HTML to PDF
Conversion de documents Word (.docx) ou pages HTML en PDF. Upload du fichier source. Options : format de page (A4, Letter, Legal), orientation, marges. Traitement via signapps-office. Telechargement du PDF.

### 3.14 Pipeline d'operations
Mode avance : chainer plusieurs operations sur un meme PDF (ex: merge → compress → watermark → protect). Interface en etapes sequentielles. Chaque etape recoit le resultat de la precedente. Execution en une seule requete serveur.

---

## Categorie 4 — Presentations

### 4.1 Vue d'ensemble Presentations
L'onglet `Presentations` affiche les outils de conversion et d'export pour les fichiers de presentation (ODP, PPTX, Google Slides).

### 4.2 Zone d'import presentation
Zone de drag-and-drop acceptant : ODP (.odp), PPTX (.pptx), PPT (.ppt). Message : `Drop presentation file here`. Validation du format a l'upload.

### 4.3 Preview des slides
Apres import, affichage d'une grille de vignettes des slides. Chaque vignette montre un apercu reduit de la slide avec son numero. Clic sur une vignette affiche la slide en plus grand dans un panneau lateral.

### 4.4 Export vers PDF
Conversion de la presentation en PDF. Options : slides par page (1, 2, 4, 6, 9), inclusion des notes du presentateur (en bas de chaque slide), en-tete/pied personnalise. Traitement via signapps-office (LibreOffice headless). Telechargement du PDF.

### 4.5 Export ODP ↔ PPTX
Conversion bidirectionnelle entre les formats OpenDocument Presentation et PowerPoint. Preservation des : animations (simplifiees si incompatibles), transitions, images, formes, tableaux, graphiques. Rapport de conversion listant les elements modifies.

### 4.6 Export vers images
Conversion de chaque slide en image individuelle. Options : format (PNG, JPEG, WebP, SVG), resolution (standard 1920x1080, haute 3840x2160, custom), slides a exporter (toutes ou selection). Resultat : archive ZIP.

### 4.7 Extraction de texte
Extraction de tout le texte d'une presentation en fichier texte brut ou Markdown. Utile pour la recherche, l'indexation, ou la reutilisation du contenu. Structure preservee : titre de slide, puces, notes.

### 4.8 Extraction d'images
Extraction de toutes les images embarquees dans la presentation en fichiers individuels. Nommage : `slide-N-image-M.ext`. Archive ZIP telechargeable.

### 4.9 Template application
Upload d'une presentation existante et d'un template ODP/PPTX. Application du theme du template (couleurs, polices, arriere-plans) sur le contenu de la presentation source. Preview avant application.

### 4.10 Merge presentations
Fusionner plusieurs fichiers de presentation en un seul. Upload de N fichiers. Reordonnancement par drag-and-drop. Option : appliquer le theme du premier fichier a tous les slides. Resultat : un fichier unique.

---

## Categorie 5 — Integration Drive et stockage

### 5.1 Import depuis le Drive SignApps
Bouton `Importer depuis le Drive` sur chaque zone d'import. Ouvre un file picker modal affichant l'arborescence du Drive de l'utilisateur. Selection d'un fichier compatible. Le fichier est charge directement sans passer par le telechargement local.

### 5.2 Export vers le Drive SignApps
Apres conversion, option `Sauvegarder dans le Drive` en plus du telechargement local. L'utilisateur choisit le dossier de destination dans son Drive. Le fichier converti est stocke de maniere permanente.

### 5.3 Historique des conversions
Page `/tools/history` accessible depuis un lien dans l'en-tete. Liste des conversions recentes de l'utilisateur : fichier source, format cible, date, taille, statut (reussi/echoue), lien de re-telechargement (si TTL non expire). Retention : 24 heures.

### 5.4 Stockage temporaire
Les fichiers uploades et les fichiers convertis sont stockes dans le storage temporaire de signapps-storage avec un TTL de 1 heure. Un job de nettoyage periodique supprime les fichiers expires. L'utilisateur est informe : `Ce fichier sera supprime dans 1 heure`.

### 5.5 Limites de taille
Taille maximale par fichier : 100 Mo (configurable par l'admin). Au-dela, message d'erreur clair avec la limite. Pour les operations batch (merge), taille maximale cumulee : 500 Mo.

---

## Categorie 6 — Architecture backend

### 6.1 Service signapps-office
Le service signapps-office (port 3018) gere toutes les conversions de documents. API REST : `POST /api/v1/office/convert` avec le fichier en multipart et les parametres de conversion en JSON. Reponse : le fichier converti en stream binaire.

### 6.2 LibreOffice headless
signapps-office utilise LibreOffice en mode headless (`soffice --headless --convert-to`) pour les conversions complexes. Un pool de processus LibreOffice est maintenu pour eviter le cold start a chaque requete. Timeout par conversion : 60 secondes.

### 6.3 Endpoints API

| Methode | Route | Description |
|---|---|---|
| `POST` | `/api/v1/office/convert` | Conversion generique (format source → format cible) |
| `POST` | `/api/v1/office/pdf/merge` | Fusionner N PDFs |
| `POST` | `/api/v1/office/pdf/split` | Decouper un PDF |
| `POST` | `/api/v1/office/pdf/compress` | Compresser un PDF |
| `POST` | `/api/v1/office/pdf/rotate` | Pivoter les pages d'un PDF |
| `POST` | `/api/v1/office/pdf/watermark` | Ajouter un filigrane |
| `POST` | `/api/v1/office/pdf/protect` | Proteger un PDF par mot de passe |
| `POST` | `/api/v1/office/pdf/unlock` | Retirer la protection d'un PDF |
| `POST` | `/api/v1/office/pdf/ocr` | OCR sur un PDF scan |
| `GET` | `/api/v1/office/pdf/metadata` | Lire les metadonnees d'un PDF |
| `PUT` | `/api/v1/office/pdf/metadata` | Modifier les metadonnees d'un PDF |
| `POST` | `/api/v1/office/presentation/extract-text` | Extraire le texte d'une presentation |
| `POST` | `/api/v1/office/presentation/extract-images` | Extraire les images d'une presentation |

### 6.4 Traitement asynchrone
Pour les fichiers volumineux (>10 Mo) ou les operations longues (OCR, merge de N PDFs), le traitement est asynchrone : le frontend recoit un `job_id`, puis poll le statut via `GET /api/v1/office/jobs/{job_id}` (statuts : queued, processing, completed, failed). A la completion, le fichier resultat est telecharge.

### 6.5 Quotas et rate limiting
Rate limiting par utilisateur : 20 conversions par minute, 200 par heure. Configurable via signapps-cache. Au-dela, reponse HTTP 429 avec header `Retry-After`. Les admins peuvent augmenter les quotas par role.

### 6.6 Formats supportes — matrice de conversion

| Format source | Formats cibles supportes |
|---|---|
| CSV | XLSX, ODS, TSV, JSON, PDF (tableau) |
| ODS | XLSX, CSV, PDF |
| XLSX | ODS, CSV, PDF, JSON |
| XLS | XLSX, ODS, CSV, PDF |
| TSV | XLSX, CSV, JSON |
| PDF | Images (PNG/JPEG/WebP), DOCX, XLSX (tableaux), PDF (merge/split/compress/rotate/watermark/protect) |
| DOCX | PDF, HTML |
| HTML | PDF |
| ODP | PPTX, PDF, Images (PNG/JPEG/WebP/SVG) |
| PPTX | ODP, PDF, Images |
| PPT | PPTX, ODP, PDF |
| Images (JPEG/PNG/WebP/TIFF) | PDF |

### 6.7 Gestion des erreurs de conversion
Les erreurs de conversion sont classees en trois niveaux :
- **Erreur bloquante** : fichier corrompu, format non reconnu, mot de passe incorrect → message d'erreur rouge avec detail technique, pas de fichier resultat
- **Avertissement** : elements non convertis (macros ignorees, polices substituees, formules converties en valeurs) → fichier resultat genere + bandeau d'avertissement jaune listant les elements affectes
- **Information** : conversion reussie avec optimisations mineures (compression d'images, normalisation des encodages) → message de succes vert avec details optionnels

---

## Categorie 7 — Batch operations et automatisation

### 7.1 Mode batch
Bouton `Mode batch` dans la barre d'outils de chaque onglet. Permet d'uploader plusieurs fichiers simultanement et d'appliquer la meme operation a tous. Upload multiple via drag-and-drop ou selection multi-fichiers. Liste des fichiers avec progression individuelle.

### 7.2 Progression batch
Barre de progression globale (N/M fichiers traites) et barres individuelles par fichier. Statut par fichier : en attente, en cours, reussi, echoue. Les fichiers echoues sont identifies avec le message d'erreur. L'utilisateur peut relancer les fichiers echoues ou telecharger uniquement les resultats reussis.

### 7.3 Telechargement batch
Les resultats d'une operation batch sont proposes en archive ZIP (un fichier converti par fichier source). Nommage : `nom-original.format-cible`. Telechargement unique du ZIP.

### 7.4 Favoris d'operation
L'utilisateur peut marquer une combinaison d'operation + options en favori (ex: `PDF → JPEG 300 DPI` ou `CSV → XLSX avec en-tetes`). Les favoris apparaissent en raccourcis sur la page principale pour un acces en un clic.

### 7.5 Raccourcis clavier
- `Ctrl+O` : ouvrir le file picker pour importer
- `Ctrl+S` : sauvegarder dans le Drive
- `Ctrl+Enter` : lancer la conversion
- `Ctrl+D` : telecharger le resultat
- `Tab` : naviguer entre les onglets

### 7.6 Accessibilite
Toutes les zones de drag-and-drop ont un label ARIA et un bouton de fallback pour la selection de fichier classique. Les barres de progression utilisent `role="progressbar"` avec `aria-valuenow`. Les messages d'erreur et de succes sont annonces via `aria-live="polite"`. Navigation au clavier complete entre les onglets, les outils et les boutons.

### 7.7 Permissions
Roles : `tools:user` (acces standard, toutes les operations sauf admin), `tools:admin` (configuration des quotas, acces aux logs de conversion, gestion des templates). Par defaut, tous les utilisateurs authentifies ont le role `tools:user`.

### 7.8 Audit et logs
Chaque conversion est journalisee : utilisateur, fichier source (nom + taille + format), operation, format cible, resultat (succes/echec), duree, taille du resultat. Les logs sont accessibles aux admins via `/admin/tools/logs`. Retention : 30 jours.

### 7.9 PgEventBus
Evenements emis : `tools.conversion.started`, `tools.conversion.completed`, `tools.conversion.failed`, `tools.batch.completed`. Payload : user_id, operation, format_source, format_cible, file_size, duration_ms. Consommes par signapps-analytics pour les metriques d'utilisation.

---

## References OSS

**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **SheetJS (Community Edition)** (github.com/SheetJS/sheetjs) | **Apache-2.0** | Parsing et generation de fichiers tableur (XLSX, CSV, ODS) cote client. Deja utilise ou candidat principal pour l'onglet Spreadsheets. |
| **pdf-lib** (github.com/Hopding/pdf-lib) | **MIT** | Creation et modification de PDFs en JavaScript. Merge, split, ajout de pages, embed fonts/images, form filling. Ideal pour le traitement cote client. |
| **PDF.js** (github.com/niclasp/pdfjs) | **Apache-2.0** | Rendu de PDFs dans le navigateur. Preview des fichiers PDF avant/apres conversion. Vignettes de pages. |
| **Tesseract.js** (github.com/naptha/tesseract.js) | **Apache-2.0** | OCR en JavaScript (port de Tesseract). Alternative cote client pour l'OCR de petits documents. 100+ langues. |
| **Pandoc** (github.com/jgm/pandoc) | **GPL-2.0** | **INTERDIT** — reference pedagogique uniquement. Pattern pour les conversions de documents texte (Markdown, HTML, DOCX). |
| **LibreOffice** (libreoffice.org) | **MPL-2.0** | Usage comme outil externe (headless conversion). Licence permissive pour la consommation. Pas d'integration code source. |
| **react-dropzone** (github.com/react-dropzone/react-dropzone) | **MIT** | Composant React pour le drag-and-drop de fichiers. Pattern pour les zones d'upload. |
| **file-saver** (github.com/niclasp/FileSaver.js) | **MIT** | Declenchement de telechargement de fichiers generes cote client. Utilise avec SheetJS et pdf-lib. |
| **Mammoth** (github.com/mwilliamson/mammoth.js) | **BSD-2-Clause** | Conversion DOCX → HTML fidele. Pattern pour la preview de documents Word avant conversion PDF. |
| **pdfcpu** (github.com/pdfcpu/pdfcpu) | **Apache-2.0** | Outil Go pour manipuler des PDFs (merge, split, watermark, encrypt). Reference pour l'implementation backend en Rust. |

---

## Assertions E2E cles (a tester)

- Page `/tools` → le titre `Tools` et le sous-titre sont affiches
- Onglet `Spreadsheets` → affiche par defaut avec la zone d'import et la textarea CSV
- Onglet `PDF Tools` → clic affiche la grille des outils PDF
- Onglet `Presentations` → clic affiche la zone d'import de presentations
- Drag-and-drop CSV → le fichier est parse et le preview tableau s'affiche avec colonnes detectees
- Paste CSV dans textarea → les donnees sont parsees et le preview s'affiche
- Export Format dropdown → les options XLSX, CSV, ODS, TSV, JSON, PDF sont listees
- Conversion CSV → XLSX → le fichier XLSX est telecharge avec les donnees correctes
- Conversion ODS → XLSX → upload reussi, fichier XLSX telecharge
- Merge PDF → upload de 2+ PDFs, bouton fusionner, telechargement du PDF fusionne
- Split PDF → upload d'un PDF, selection de plages, telechargement du ZIP avec les parties
- Compress PDF → upload d'un PDF, selection qualite, telechargement du PDF comprime avec taille reduite
- PDF OCR → upload d'un PDF scan, selection langue, telechargement du PDF searchable
- PDF Watermark → upload d'un PDF, saisie texte filigrane, telechargement du PDF filigrane
- Import presentation ODP → les vignettes des slides s'affichent en grille
- Export presentation PDF → le PDF est genere avec les slides en pages
- Import depuis Drive → le file picker s'ouvre et le fichier selectionne est charge
- Export vers Drive → le fichier converti est enregistre dans le dossier selectionne
- Fichier trop volumineux (>100 Mo) → message d'erreur avec la limite affichee
- Format non supporte → message d'erreur clair lors du drag-and-drop
- Service signapps-office indisponible → message d'erreur gracieux `Service de conversion indisponible`
