# Module Outils (Tools) -- Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Zamzar** | Conversion de fichiers en ligne, 1200+ formats supportes, API REST, batch conversion, email delivery, cloud storage integration, OCR sur images, conversion video/audio/ebook |
| **CloudConvert** | API-first file conversion, 200+ formats, webhooks, S3/Azure/GCS integration, task pipelines (convert + optimize + merge), sandbox mode, haute fidelite, batch processing |
| **Stirling PDF** | Open source (GPL mais reference), PDF self-hosted, merge, split, rotate, compress, OCR, watermark, signature, metadata, conversion (PDF <-> images/Word/HTML), pipeline d'operations chainee |
| **SmallPDF** | PDF complet en ligne : compress, merge, split, convert (PDF <-> Word/Excel/PPT/images), e-sign, edit, protect, unlock, batch, UI/UX exemplaire, desktop app |
| **LibreOffice headless** | Conversion de documents en ligne de commande, formats office (ODS/ODT/ODP <-> XLSX/DOCX/PPTX <-> PDF), macros, filtres custom, self-hosted, zero licence |
| **Pandoc** | Convertisseur universel de documents texte : Markdown <-> HTML <-> LaTeX <-> DOCX <-> EPUB <-> PDF (via LaTeX/wkhtmltopdf), templates, filtres Lua, citations, 40+ formats |
| **pdf-lib** | Librairie JavaScript (MIT) pour creer et modifier des PDFs programmatiquement : merge, split, add pages, embed fonts/images, form filling, metadata, encryption |
| **SheetJS** | Librairie JavaScript (Apache-2.0 Community Edition) pour lire/ecrire des fichiers tableur : XLSX, CSV, ODS, Numbers, parsing avance, streaming, formulas, styles, hyperlinks |

## Principes directeurs

1. **Interface a onglets** -- la page `/tools` presente trois onglets : `Spreadsheets`, `PDF Tools`, `Presentations`. Chaque onglet est une mini-application autonome avec ses propres zones d'import, d'options et d'export. Navigation horizontale par tabs.
2. **Drag-and-drop universel** -- toutes les zones d'import acceptent le drag-and-drop de fichiers depuis le systeme de fichiers local ou depuis le Drive SignApps. Feedback visuel clair (zone en surbrillance avec bordure tirets bleue, validation du format). Fallback : bouton de selection de fichier classique.
3. **Traitement cote serveur** -- les conversions lourdes (XLSX -> PDF, ODS -> XLSX, PDF merge/split/OCR, ODP -> PPTX) sont executees par signapps-office (port 3018) qui utilise LibreOffice headless et le crate calamine (Rust) pour le parsing. Le frontend upload le fichier, attend le resultat, et propose le telechargement.
4. **Traitement cote client quand possible** -- les operations legeres (parsing CSV, preview des donnees, generation de petits PDFs) sont traitees cote client avec SheetJS et pdf-lib pour minimiser la latence et la charge serveur.
5. **Fidelite de conversion** -- la conversion doit preserver au maximum le formatage source : styles de cellules, formules (converties en valeurs si le format cible ne les supporte pas), images embarquees, mise en page. Un rapport de conversion signale les elements non supportes.
6. **Securite des fichiers** -- les fichiers uploades sont stockes temporairement (TTL 1 heure) dans le storage temporaire de signapps-storage, puis supprimes. Aucun fichier utilisateur n'est conserve apres la conversion. Transit chiffre (TLS). Pas d'envoi a des services tiers.

---

## Categorie 1 -- Page principale et navigation

### 1.1 En-tete de page
Titre `Tools` avec sous-titre `Spreadsheet import/export, PDF utilities, and presentation export`. Breadcrumb : Accueil > Tools. Fond `bg-card` avec bordure inferieure `border-border`.

### 1.2 Barre d'onglets
Trois onglets horizontaux : `Spreadsheets`, `PDF Tools`, `Presentations`. L'onglet actif est souligne avec la couleur primaire (`border-b-2 border-primary`). Le contenu change dynamiquement sans rechargement de page (client-side tabs state). Chaque onglet affiche une icone a gauche du label : tableur = icone grille, PDF = icone document rouge, Presentations = icone diapositives.

### 1.3 Etat par defaut
Au chargement, l'onglet `Spreadsheets` est selectionne par defaut. Chaque onglet conserve son etat interne (fichier charge, options selectionnees) lors de la navigation entre onglets. Le state est stocke en memoire (pas en URL) pour eviter les rechargements.

### 1.4 Responsive layout
Sur mobile (<768px), les onglets passent en mode scrollable horizontal avec indicateur de scroll (ombre laterale). Les zones de drag-and-drop s'adaptent a la largeur de l'ecran. Les options d'import/export passent en layout vertical (empile).

### 1.5 Raccourcis clavier globaux
- `Ctrl+O` : ouvrir le file picker pour importer un fichier
- `Ctrl+S` : sauvegarder le resultat dans le Drive SignApps
- `Ctrl+Enter` : lancer la conversion/export
- `Ctrl+D` : telecharger le resultat
- `Tab` / `Shift+Tab` : naviguer entre les onglets (focus sur la barre)
- `Escape` : annuler l'operation en cours ou fermer un dialog

---

## Categorie 2 -- Spreadsheets (Import/Export tableur)

### 2.1 Zone d'import fichier
Section `Import` avec zone de drag-and-drop rectangulaire (hauteur 120px, bordure tirets `border-dashed border-2 border-muted-foreground`) affichant le message `Drop CSV, ODS, XLSX or XLS file here` avec une icone upload. Formats acceptes : CSV (.csv), ODS (.ods), XLSX (.xlsx), XLS (.xls), TSV (.tsv), Numbers (.numbers). Validation du type MIME et de l'extension a l'upload. Si format non supporte, la zone affiche un message d'erreur rouge : `Format non supporte. Formats acceptes : CSV, ODS, XLSX, XLS, TSV, Numbers`. Taille max : 100 Mo. Au-dela, message : `Fichier trop volumineux (max 100 Mo)`. Pendant l'upload : barre de progression avec pourcentage et vitesse (ex: `45% - 2.3 Mo/s`).

### 2.2 Textarea CSV Data
Zone de texte multiligne (`textarea`, hauteur 200px, police monospace) labelisee `CSV Data` ou l'utilisateur peut coller directement des donnees CSV brutes (copier-coller depuis un tableur ou un fichier texte). Delimiteur auto-detecte par analyse des 10 premieres lignes : virgule (`,`), point-virgule (`;`), tabulation (`\t`), pipe (`|`). Heuristique : le delimiteur qui produit le plus grand nombre de colonnes consistantes entre les lignes gagne. Bouton `Clear` pour vider la zone (icone poubelle). Compteur en bas : `N lignes detectees`.

### 2.3 Detection du delimiteur et de l'encodage
Panneau d'options d'import (replitable, ouvert par defaut a la premiere utilisation) :
- **Delimiteur** : dropdown avec options `Auto-detect` (defaut), `Virgule (,)`, `Point-virgule (;)`, `Tabulation`, `Pipe (|)`, `Custom` (champ texte pour saisir un caractere). L'auto-detection analyse les 10 premieres lignes et selectionne le delimiteur le plus consistent.
- **Encodage** : dropdown avec options `UTF-8` (defaut), `UTF-8 with BOM`, `ISO-8859-1 (Latin-1)`, `Windows-1252`, `Shift-JIS`, `UTF-16 LE`, `UTF-16 BE`. Detection automatique : le backend tente UTF-8 en premier, puis detecte via heuristique BOM et byte patterns. Si la detection echoue, l'utilisateur selectionne manuellement et la preview se met a jour.
- **Premiere ligne = en-tetes** : toggle (defaut : auto-detect -- premiere ligne consideree comme en-tetes si elle contient principalement du texte non numerique).
- **Feuille a importer** : select (pour les fichiers multi-feuilles ODS/XLSX, affiche la liste des noms de feuilles apres upload. Defaut : premiere feuille).

### 2.4 Preview des donnees
Apres import (fichier ou paste), un tableau HTML (`<table>`) affiche un apercu des 50 premieres lignes avec les colonnes detectees. En-tetes affiches en gras (`font-semibold bg-muted`). Chaque colonne affiche un badge de type detecte sous le nom : `Texte`, `Nombre`, `Date`, `Booleen`, `Vide`. Detection de type : analyse des 100 premieres valeurs de chaque colonne; le type majoritaire est retenu. Compteur en haut : `N lignes x M colonnes detectees`. Scroll horizontal si >5 colonnes. Scroll vertical avec hauteur max 400px.

### 2.5 Detection des anomalies
Apres import, detection des anomalies affichees sous le preview dans un bandeau jaune `bg-yellow-50` :
- Lignes vides (nombre et numeros de lignes)
- Colonnes entierement vides (noms de colonnes)
- Types mixtes dans une colonne (ex: `Colonne C contient 80% Nombre et 20% Texte`)
- Caracteres speciaux non imprimables detectes
- Encodage suspect (caracteres garbles detectes, suggestion de changer l'encodage)
Les avertissements sont non bloquants : l'utilisateur peut proceder a l'export malgre les anomalies.

### 2.6 Export Format dropdown
Menu deroulant `Export Format` avec les options : XLSX, CSV, ODS, TSV, JSON, PDF (tableau). Chaque option affiche une icone et une description courte au survol (tooltip) : `XLSX - Microsoft Excel`, `CSV - Valeurs separees par des virgules`, `ODS - OpenDocument Spreadsheet`, `TSV - Valeurs separees par des tabulations`, `JSON - JavaScript Object Notation`, `PDF - Document imprimable`. Le format par defaut est XLSX.

### 2.7 Bouton Export
Bouton primaire `Exporter` (desactive tant qu'aucune donnee n'est importee). Au clic, le traitement demarre :
- **CSV -> XLSX** : traitement cote client via SheetJS. Generation du fichier XLSX avec : en-tetes en gras, largeurs de colonnes auto-ajustees au contenu, types de donnees detectes (nombre formate, date formatee JJ/MM/AAAA, texte). Telechargement immediat (<1s pour <10k lignes).
- **CSV -> ODS/TSV/JSON** : traitement cote client via SheetJS.
- **CSV -> PDF** : generation cote client via pdf-lib pour les petits fichiers (<1000 lignes), sinon envoi a signapps-office.
- **ODS/XLSX -> tout autre format** : upload vers signapps-office qui utilise le crate calamine pour le parsing Rust-natif (lecture des cellules, formules, styles) et LibreOffice headless pour la conversion finale. Preservation des formules (converties en valeurs si le format cible ne les supporte pas), styles de cellules, feuilles multiples, graphiques embarques.
Pendant le traitement : spinner sur le bouton avec texte `Conversion en cours...`. Apres la conversion : telechargement automatique du fichier resultat + toast de succes vert `Conversion reussie`.

### 2.8 Conversion vers PDF
Generation d'un PDF tabulaire a partir des donnees importees. Mise en page : orientation paysage automatique si >5 colonnes, portrait sinon. En-tetes repetes sur chaque page. Bordures fines sur toutes les cellules. Pagination avec numero de page en pied (`Page X/Y`). Titre du fichier source en en-tete. Date de generation en pied de page. Pour les fichiers ODS/XLSX : traitement via signapps-office (LibreOffice). Pour les CSV simples : generation cote client via pdf-lib (rendu tableau avec wrapping automatique des cellules longues).

### 2.9 Conversion vers JSON
Export des donnees en JSON. Dialog d'options avant export :
- **Mode objet** : array d'objets (chaque ligne = objet avec cles = en-tetes). Ex: `[{"Nom": "Dupont", "Age": 42}]`
- **Mode tableau** : array d'arrays (chaque ligne = array de valeurs). Ex: `[["Nom", "Age"], ["Dupont", 42]]`
- **Indentation** : `Compacte` (pas d'indentation), `Formatee` (2 espaces), `Large` (4 espaces)
Telechargement du fichier `.json`. Encodage UTF-8.

### 2.10 Column type detection detail
Le systeme analyse les 100 premieres valeurs non vides de chaque colonne pour determiner le type. Heuristique par priorite :
- **Booleen** : si toutes les valeurs sont `true`/`false`, `oui`/`non`, `yes`/`no`, `1`/`0`, `vrai`/`faux`
- **Nombre entier** : si toutes les valeurs matchent `/^-?\d+$/` (apres suppression des separateurs de milliers)
- **Nombre decimal** : si toutes les valeurs matchent `/^-?\d+[.,]\d+$/` (detecte virgule ou point comme separateur decimal)
- **Date** : tentative de parsing avec les formats courants : `YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`, `YYYY/MM/DD`. Si >80% des valeurs sont parsees, le type est date.
- **Email** : si >80% des valeurs matchent un pattern email basique
- **URL** : si >80% des valeurs commencent par `http://` ou `https://`
- **Texte** : defaut si aucun autre type ne correspond

Le type detecte est affiche sous chaque en-tete de colonne dans le preview comme un badge colore. L'utilisateur peut forcer le type via un dropdown sur le badge (utile si la detection est incorrecte, ex: codes postaux detectes comme nombres).

### 2.11 Multi-feuilles
Pour les fichiers ODS/XLSX avec plusieurs feuilles : dropdown `Feuille` au-dessus du preview listant toutes les feuilles avec leur nombre de lignes entre parentheses (ex: `Ventes (1532 lignes)`, `Employes (45 lignes)`). Clic sur une feuille charge sa preview. Options d'export : `Feuille courante uniquement` (defaut) ou `Toutes les feuilles` (pour les formats qui le supportent : XLSX, ODS). Pour CSV/JSON, si plusieurs feuilles, un ZIP est genere avec un fichier par feuille.

### 2.12 Server-side ODS/XLSX parsing with calamine
Le crate Rust `calamine` est utilise cote serveur pour lire les fichiers XLSX, XLS, ODS et XLSB sans LibreOffice. Avantages : parsing 10x plus rapide que LibreOffice pour la lecture seule, consommation memoire reduite, pas de processus externe. Le parsing retourne : liste des feuilles (noms), dimensions (lignes x colonnes), types de cellules (vide, texte, nombre, date, booleen, erreur), valeurs, formules (en tant que texte, pas evaluees). Pour la conversion (ex: ODS -> XLSX), LibreOffice headless est utilise car calamine ne fait que de la lecture. Le choix calamine vs LibreOffice est transparent pour l'utilisateur : le backend decide automatiquement.

---

## Categorie 3 -- PDF Tools

### 3.1 Vue d'ensemble PDF Tools
L'onglet `PDF Tools` affiche une grille de cartes (3 colonnes desktop, 2 tablette, 1 mobile) representant les outils PDF disponibles. Chaque carte affiche : icone distinctive (coloree), titre, description en une ligne. Les cartes sont cliquables. Effet hover : ombre + translation verticale. L'utilisateur clique sur un outil pour acceder a son interface dediee (panneau qui remplace la grille avec un bouton retour en haut a gauche).

### 3.2 Merge PDF (Fusionner)
Zone de drag-and-drop acceptant plusieurs fichiers PDF (`Deposez vos fichiers PDF ici`). Bouton `+ Ajouter des fichiers` en fallback. Liste ordonnee des fichiers ajoutes affichee sous la zone : nom du fichier, taille, nombre de pages (detecte a l'upload), bouton `x` pour retirer, handle de drag-and-drop a gauche pour reordonner. Nombre minimum : 2 fichiers. Taille cumulee max : 500 Mo. Au-dela, message d'erreur. Bouton primaire `Fusionner` en bas. Traitement via signapps-office. Progression : barre avec pourcentage. Resultat : telechargement automatique du PDF fusionne nomme `merged-YYYYMMDD-HHMMSS.pdf`.

### 3.3 Split PDF (Decouper)
Upload d'un PDF unique. Apres upload, affichage des vignettes de chaque page en grille (4 colonnes, max hauteur 150px par vignette) avec numero de page. Options de decoupe :
- **Par page** : chaque page devient un fichier individuel (radio button)
- **Par plage** : champ texte pour saisir des plages (ex: `1-3, 4-7, 8-12`). Validation : les numeros doivent etre dans l'intervalle [1, N]. Les plages ne doivent pas se chevaucher. Erreur rouge si format invalide.
- **Pages specifiques** : clic sur les vignettes pour selectionner/deselectionner des pages (highlight bleu sur les selectionnees). Compteur : `X pages selectionnees`.
Bouton primaire `Decouper`. Resultat : archive ZIP contenant les fichiers PDF separes, nommes `page-1.pdf`, `page-2-4.pdf`, etc. Telechargement automatique.

### 3.4 Compress PDF (Compresser)
Upload d'un PDF unique. Affichage de la taille originale en gros (`15.2 Mo`). Trois options de qualite (radio buttons avec description) :
- **Haute qualite** : compression minimale, images a 150 DPI. Tooltip : `Ideal pour l'impression`.
- **Qualite moyenne** : compression equilibree, images a 100 DPI. Tooltip : `Bon compromis taille/qualite`. (defaut)
- **Compression maximale** : images a 72 DPI, suppression des metadonnees, linearisation. Tooltip : `Taille minimale, perte de qualite sur les images`.
Slider additionnel pour le DPI des images (72-300, pas de 10). Bouton `Compresser`. Apres traitement, affichage : taille originale -> taille comprimee avec pourcentage de reduction en vert (`15.2 Mo -> 3.4 Mo (-78%)`). Preview cote a cote optionnel (avant/apres sur une page) pour verifier la qualite. Telechargement du PDF comprime.

### 3.5 Rotate PDF (Pivoter)
Upload d'un PDF unique. Preview des vignettes de chaque page en grille. Selection des pages a pivoter :
- `Toutes les pages` (radio, defaut)
- `Pages paires uniquement`
- `Pages impaires uniquement`
- `Selection individuelle` (clic sur les vignettes, meme comportement que le split)
Angle de rotation : boutons `90 CW` (sens horaire), `180`, `90 CCW` (sens anti-horaire). Preview en temps reel : les vignettes selectionnees tournent visuellement avec une animation de rotation 300ms. Bouton `Appliquer`. Telechargement du PDF modifie.

### 3.6 PDF to Images
Upload d'un PDF unique. Apres upload, preview des vignettes. Options :
- **Format de sortie** : dropdown `PNG` (defaut), `JPEG`, `WebP`
- **Resolution** : dropdown `72 DPI` (web), `150 DPI` (standard), `300 DPI` (impression)
- **Pages a convertir** : `Toutes` (defaut), `Selection` (meme picker que split)
- **Qualite JPEG** : slider 50-100% (affiche uniquement si format = JPEG)
Bouton `Convertir`. Progression par page (`Page 3/15...`). Resultat : archive ZIP avec une image par page, nommee `page-001.png`, `page-002.png`, etc. Taille estimee affichee avant le lancement.

### 3.7 Images to PDF
Zone de drag-and-drop acceptant plusieurs images (JPEG, PNG, WebP, TIFF, BMP). Bouton `+ Ajouter des images` en fallback. Liste des images ajoutees avec vignettes (100x100px), nom, taille. Reordonnancement par drag-and-drop. Options :
- **Orientation** : `Portrait` (defaut), `Paysage`, `Auto` (selon l'orientation de chaque image)
- **Marge** : `Aucune`, `Fine (5mm)`, `Standard (10mm)`
- **Qualite d'image** : slider 50-100%
- **Format de page** : `A4` (defaut), `Letter`, `Legal`, `Ajuste a l'image`
Bouton `Creer le PDF`. Telechargement du PDF genere.

### 3.8 PDF Watermark (Filigrane)
Upload du PDF source. Options de filigrane :
- **Type** : `Texte` (defaut) ou `Image`
- Si texte : champ de saisie (max 100 caracteres), couleur (color picker, defaut gris), taille de police (slider 12-120pt, defaut 48pt), police (dropdown : Arial, Helvetica, Times New Roman, Courier)
- Si image : upload d'une image (PNG/JPEG, max 5 Mo), redimensionnement automatique
- **Position** : dropdown `Centre` (defaut), `Diagonale (45 degres)`, `En-tete`, `Pied de page`
- **Opacite** : slider 5-100% (defaut 30%)
- **Pages** : `Toutes` (defaut), `Paires`, `Impaires`, `Selection` (champ texte : `1,3,5-8`)
Preview en temps reel : la premiere page du PDF est affichee avec le filigrane applique. Chaque changement d'option met a jour la preview en <500ms. Bouton `Appliquer`. Telechargement du PDF filigrane.

### 3.9 PDF Protect / Unlock
Deux sous-onglets : `Proteger` et `Deverrouiller`.

**Proteger** : Upload du PDF. Champ mot de passe (avec toggle visibilite, validation min 4 caracteres). Champ confirmation du mot de passe. Options avancees (section repliable) :
- `Interdire l'impression` (checkbox)
- `Interdire la copie de texte` (checkbox)
- `Interdire l'edition` (checkbox)
- Algorithme de chiffrement : `AES-128` (defaut), `AES-256` (recommande)
Bouton `Proteger`. Telechargement du PDF protege. Avertissement : `Conservez votre mot de passe. Il est impossible de le recuperer.`

**Deverrouiller** : Upload du PDF protege. Le systeme detecte automatiquement si le PDF est protege par mot de passe. Champ de saisie du mot de passe actuel. Bouton `Deverrouiller`. Si mot de passe incorrect : message d'erreur rouge `Mot de passe incorrect`. Si correct : telechargement du PDF deverrouille.

### 3.10 PDF OCR
Upload d'un PDF contenant des images de texte (scans). Detection automatique : si le PDF ne contient pas de couche texte extractible, un bandeau bleu indique `Ce PDF semble etre un scan. L'OCR peut extraire le texte.` Selection de la langue principale : dropdown avec les langues supportees (Francais, Anglais, Allemand, Espagnol, Italien, Portugais, Neerlandais, etc. -- 20 langues). Option multi-langue : checkbox `Detecter plusieurs langues` (plus lent mais plus precis pour les documents multilingues). Traitement via signapps-media (Tesseract OCR, port 3009). Progression : barre avec pourcentage et page en cours. Resultat : PDF searchable avec couche de texte invisible superposee aux images. Le texte est selectionnable et cherchable. Telechargement automatique.

### 3.11 PDF Form Filling
Upload d'un PDF contenant des champs de formulaire. Detection automatique des champs : texte, checkbox, radio, dropdown, signature. Affichage du PDF avec les champs editables directement dans le viewer. Chaque champ est mis en surbrillance en bleu clair. Clic sur un champ ouvre un input adapte au type. Bouton `Enregistrer` genere un nouveau PDF avec les valeurs remplies (les champs ne sont plus editables dans le resultat = flatten). Bouton `Enregistrer comme brouillon` conserve les champs editables.

### 3.12 PDF/A Conversion (Archivage)
Upload d'un PDF standard. Conversion vers le format PDF/A (ISO 19005) pour l'archivage a long terme. Options :
- **Niveau** : `PDF/A-1b` (conformite basique), `PDF/A-2b` (recommande, supporte JPEG2000 et transparence), `PDF/A-3b` (supporte les fichiers embarques)
Traitement via signapps-office. Rapport de conformite genere : liste des elements non conformes corriges (polices embarquees, profils couleur ajoutes, metadonnees XMP ajoutees). Telechargement du PDF/A conforme.

### 3.13 PDF to Word/Excel
Upload d'un PDF. Format cible : `DOCX` ou `XLSX` (radio buttons). Avertissement en bandeau jaune : `La fidelite de la conversion depend de la complexite du PDF source. Les tableaux complexes et les mises en page multi-colonnes peuvent ne pas etre parfaitement preserves.` Traitement via signapps-office (LibreOffice). Progression avec spinner. Rapport de conversion : liste des elements modifies ou perdus (images redimensionnees, polices substituees, tableaux reorganises). Telechargement du fichier converti.

### 3.14 Word/HTML to PDF
Upload d'un fichier source : DOCX (.docx) ou HTML (.html, .htm). Options de mise en page :
- **Format de page** : `A4` (defaut), `Letter`, `Legal`
- **Orientation** : `Portrait` (defaut), `Paysage`
- **Marges** : `Standard (25mm)`, `Etroites (12mm)`, `Larges (35mm)`, `Personnalisees` (4 champs : haut, bas, gauche, droite en mm)
Traitement via signapps-office. Telechargement du PDF.

### 3.15 PDF Metadata (Afficher/Modifier)
Upload d'un PDF. Affichage des metadonnees actuelles en formulaire editable :
- **Titre** : champ texte (souvent vide dans les PDFs)
- **Auteur** : champ texte
- **Sujet** : champ texte
- **Mots-cles** : champ texte (separes par des virgules)
- **Date de creation** : affichage en lecture seule (non modifiable)
- **Date de modification** : affichage en lecture seule
- **Producteur** : affichage en lecture seule (ex: `LibreOffice 7.5`)
- **Version PDF** : affichage en lecture seule (ex: `1.7`)
- **Nombre de pages** : affichage en lecture seule
- **Taille du fichier** : affichage en lecture seule
Bouton `Enregistrer les modifications`. Telechargement du PDF mis a jour avec les nouvelles metadonnees.

### 3.16 Pipeline d'operations
Mode avance accessible via un bouton `Mode Pipeline` dans la barre d'outils de l'onglet PDF. Interface en etapes sequentielles : l'utilisateur ajoute des operations une par une dans un pipeline visuel (representation en barre horizontale avec des cercles connectes par des fleches, chaque cercle = une operation avec icone et nom). Operations chainables : merge -> compress -> watermark -> protect (par exemple). Chaque etape est cliquable pour configurer ses options dans un panneau lateral. Bouton `+ Ajouter une etape` pour inserer une operation supplementaire. Bouton `x` sur une etape pour la retirer. Reordonnement par drag-and-drop des etapes. Bouton `Executer le pipeline` envoie le fichier source a signapps-office qui execute toutes les operations en sequence dans un seul appel serveur (pas de fichiers intermediaires downloades). Progression par etape : `Etape 2/4 : Compression...`. Resultat : un seul fichier final. Limite : max 5 operations dans un pipeline.

### 3.17 Page counts and file info
Apres upload de tout fichier PDF, un bandeau d'information est affiche sous la zone d'upload : nom du fichier, taille (en Mo), nombre de pages, version PDF, protection (oui/non), contient des formulaires (oui/non), contient du texte extractible (oui/non -- utile pour determiner si l'OCR est necessaire). Ces informations sont obtenues par un appel leger au backend (`GET /api/v1/office/pdf/info`) qui parse uniquement les metadonnees sans charger le contenu complet.

---

## Categorie 4 -- Presentations

### 4.1 Vue d'ensemble Presentations
L'onglet `Presentations` affiche les outils de conversion et d'export pour les fichiers de presentation. Layout en deux zones : zone d'import en haut, outils en grille en bas (meme pattern que PDF Tools).

### 4.2 Zone d'import presentation
Zone de drag-and-drop acceptant : ODP (.odp), PPTX (.pptx), PPT (.ppt). Message : `Drop presentation file here (ODP, PPTX, PPT)`. Validation du format et de la taille (max 100 Mo) a l'upload. Apres upload, le nom du fichier et sa taille sont affiches avec un bouton `Changer de fichier`.

### 4.3 Preview des slides
Apres import, affichage d'une grille de vignettes des slides (4 colonnes desktop, 2 mobile). Chaque vignette montre un apercu reduit de la slide avec son numero en overlay (`Slide 1`, `Slide 2`...). Vignettes generees cote serveur par signapps-office (conversion slide -> PNG 400px de large). Clic sur une vignette ouvre un panneau lateral avec la slide en plus grand (800px de large) et les informations : titre de la slide (si detecte), notes du presentateur (si presentes, affichees sous la preview dans un bloc `bg-muted`). Navigation dans le panneau : fleches gauche/droite ou touches clavier fleche gauche/droite.

### 4.4 Export vers PDF
Bouton `Exporter en PDF` (ou carte dans la grille d'outils). Options dans un dialog :
- **Slides par page** : `1` (defaut, pleine page), `2` (2 slides empiles), `4` (grille 2x2), `6` (grille 2x3), `9` (grille 3x3)
- **Inclusion des notes** : checkbox `Inclure les notes du presentateur` (si active, les notes sont affichees sous chaque slide dans une zone texte)
- **En-tete personnalise** : champ texte optionnel (imprime en haut de chaque page)
- **Pied de page personnalise** : champ texte optionnel (imprime en bas de chaque page, avec placeholders `{page}` et `{total}`)
- **Slides a exporter** : `Toutes` (defaut), `Selection` (champ texte : `1-5, 8, 10-15`)
Traitement via signapps-office (LibreOffice headless). Telechargement du PDF.

### 4.5 Export ODP <-> PPTX
Conversion bidirectionnelle entre les formats OpenDocument Presentation et PowerPoint. Bouton `Convertir en PPTX` (si le fichier source est ODP) ou `Convertir en ODP` (si PPTX). Traitement via signapps-office. Rapport de conversion listant les elements modifies : animations simplifiees ou supprimees (liste des slides affectees), transitions converties (type d'origine -> type de remplacement), polices substituees (police manquante -> police de fallback), formes non supportees converties en images. Le rapport est affiche dans un dialog avant le telechargement. Bouton `Telecharger quand meme` si le rapport contient des avertissements.

### 4.6 Export vers images
Bouton `Exporter en images`. Options :
- **Format** : `PNG` (defaut), `JPEG`, `WebP`, `SVG` (vectoriel, si supporte par le contenu)
- **Resolution** : `Standard (1920x1080)`, `Haute (3840x2160)`, `Personnalisee` (champs largeur x hauteur en pixels)
- **Slides a exporter** : `Toutes` (defaut), `Selection` (champ texte ou clic sur vignettes)
Traitement via signapps-office. Resultat : archive ZIP avec une image par slide, nommee `slide-01.png`, `slide-02.png`, etc. Telechargement automatique.

### 4.7 Extraction de texte
Bouton `Extraire le texte`. Format de sortie : `Texte brut (.txt)` ou `Markdown (.md)`. Structure preservee : chaque slide est separee par un header (`## Slide N : [Titre]`), le contenu est extrait dans l'ordre de lecture (titre, puces, texte libre), les notes du presentateur sont ajoutees sous un sous-header `### Notes`. Traitement via signapps-office endpoint `/api/v1/office/presentation/extract-text`. Telechargement du fichier texte.

### 4.8 Extraction d'images
Bouton `Extraire les images`. Extraction de toutes les images embarquees dans la presentation en fichiers individuels. Nommage : `slide-N-image-M.ext` (ex: `slide-3-image-1.png`). Formats preserves (PNG, JPEG, EMF -> converti en PNG). Archive ZIP telechargeable. Nombre et taille totale des images affichees avant extraction.

### 4.9 Merge presentations
Bouton `Fusionner des presentations`. Upload de N fichiers de presentation (meme zone multi-fichier que le merge PDF). Reordonnancement par drag-and-drop. Option : `Appliquer le theme du premier fichier a toutes les slides` (checkbox). Traitement via signapps-office. Resultat : un fichier unique au format du premier fichier uploade (PPTX si le premier est PPTX, ODP si ODP).

### 4.10 Template application
Bouton `Appliquer un theme`. Upload de deux fichiers : la presentation source (contenu) et le template (theme). Le template fournit les couleurs, polices, arriere-plans de slides, et styles de texte. Le contenu de la presentation source est conserve. Preview avant application : vignettes des 3 premieres slides avec le nouveau theme applique (generees cote serveur). Bouton `Appliquer`. Telechargement de la presentation avec le nouveau theme.

### 4.11 Slide count and presentation info
Apres upload, un bandeau d'information est affiche : nom du fichier, taille, nombre de slides, format (ODP/PPTX/PPT), contient des notes (oui/non avec compteur de slides avec notes), contient des videos embarquees (oui/non), contient des animations (oui/non). Ces informations aident l'utilisateur a choisir les bonnes options d'export.

### 4.12 Presentation to images for sharing
Workflow optimise pour le partage de slides sous forme d'images sur le chat ou les reseaux sociaux. Bouton `Partager comme images`. Selectionner les slides (clic sur les vignettes). Options : format `PNG` (defaut), resolution `1920x1080`. Les images sont generees et une galerie s'affiche avec : preview de chaque image, bouton `Copier dans le presse-papier` (pour coller directement dans le chat), bouton `Telecharger tout (ZIP)`, bouton `Sauvegarder dans le Drive`.

---

## Categorie 5 -- Integration Drive et stockage

### 5.1 Import depuis le Drive SignApps
Bouton `Importer depuis le Drive` (icone dossier + fleche) sur chaque zone d'import. Ouvre un file picker modal affichant l'arborescence du Drive de l'utilisateur. Filtrage automatique par format compatible (seuls les fichiers du bon type sont selectionnables, les autres sont grises). Selection d'un fichier compatible. Le fichier est charge directement depuis le storage sans passer par le telechargement local. Progression d'import affichee.

### 5.2 Export vers le Drive SignApps
Apres conversion, bouton `Sauvegarder dans le Drive` (icone disquette + dossier) affiche a cote du bouton `Telecharger`. Ouvre un file picker modal pour choisir le dossier de destination. Champ de nom de fichier pre-rempli (nom source + extension cible). Le fichier converti est stocke de maniere permanente dans le Drive. Toast de confirmation : `Fichier sauvegarde dans /Dossier/nom.ext`.

### 5.3 Historique des conversions
Page `/tools/history` accessible depuis un lien `Historique` dans l'en-tete. Tableau des conversions recentes de l'utilisateur : fichier source (nom + icone format), operation (ex: `CSV -> XLSX`, `PDF Merge`), date/heure, duree de traitement, taille du resultat, statut (icone check verte = reussi, croix rouge = echoue avec message d'erreur au survol), lien de re-telechargement (si TTL non expire -- indication du temps restant : `Expire dans 45 min`). Retention : 24 heures. Pagination : 20 entrees par page.

### 5.4 Stockage temporaire et nettoyage
Les fichiers uploades et les fichiers convertis sont stockes dans le storage temporaire de signapps-storage avec un TTL de 1 heure. Un job de nettoyage periodique (interval 5 minutes) supprime les fichiers expires. L'utilisateur est informe par un bandeau au-dessus du bouton de telechargement : `Ce fichier sera supprime dans N minutes. Telechargez-le ou sauvegardez-le dans le Drive.` Quand le TTL expire et que l'utilisateur tente de retelecharger : message d'erreur `Ce fichier a expire. Veuillez relancer la conversion.`

### 5.5 Limites de taille
Taille maximale par fichier : 100 Mo (configurable par l'admin dans les parametres). Au-dela, message d'erreur clair : `Le fichier depasse la taille maximale autorisee (100 Mo)`. Pour les operations batch (merge PDF, merge presentations), taille maximale cumulee : 500 Mo. Au-dela : `La taille cumulee des fichiers depasse 500 Mo.` Les limites sont affichees dans les tooltips des zones d'upload.

---

## Categorie 6 -- Batch operations

### 6.1 Mode batch
Bouton `Mode batch` (icone multi-fichiers) dans la barre d'outils de chaque onglet. Active le mode multi-fichiers : la zone d'import accepte plusieurs fichiers simultanement. Upload multiple via drag-and-drop ou selection multi-fichiers (Ctrl+clic dans le file picker). Chaque fichier apparait dans une liste avec : nom, taille, format, statut (en attente/en cours/reussi/echoue).

### 6.2 Configuration batch
Tous les fichiers du batch partagent les memes options de conversion (format cible, qualite, etc.). Les options sont configurees une seule fois avant le lancement. Bouton `Demarrer la conversion` lance le traitement de tous les fichiers en sequence.

### 6.3 Progression batch
Barre de progression globale en haut : `N/M fichiers traites` avec pourcentage. Barres individuelles par fichier dans la liste : `en attente` (gris), `en cours` (bleu avec animation), `reussi` (vert avec check), `echoue` (rouge avec croix et message d'erreur au survol). L'utilisateur peut annuler le batch en cours (bouton `Annuler`). Les fichiers deja convertis restent disponibles.

### 6.4 Telechargement batch
Les resultats d'une operation batch sont proposes en archive ZIP. Nommage des fichiers dans le ZIP : `nom-original.format-cible` (ex: `rapport-2026.xlsx` si source = `rapport-2026.csv`). Bouton `Telecharger tout (ZIP)` apparait apres la completion. Option `Telecharger les reussis uniquement` si certains fichiers ont echoue. Bouton `Relancer les echoues` pour retenter les fichiers en erreur. Le ZIP est genere cote serveur si les fichiers sont volumineux (>50 Mo total), cote client sinon (via JSZip).

### 6.5 Favoris d'operation
L'utilisateur peut marquer une combinaison d'operation + options en favori via un bouton etoile dans la barre d'options (ex: `PDF -> JPEG 300 DPI` ou `CSV -> XLSX avec en-tetes`). Les favoris apparaissent en raccourcis sur la page principale de l'onglet sous un header `Favoris` pour un acces en un clic. Stockes en base de donnees (table `tool_favorites`). Maximum 5 favoris par onglet. Suppression d'un favori : clic sur l'etoile pleine pour la vider.

### 6.6 Error states detail
Les erreurs sont classees et affichees de maniere contextuelle :
- **Format non supporte** : le fichier est rejete au drop avec message rouge `Le format .xyz n'est pas supporte. Formats acceptes : [liste]`. Le fichier n'est pas uploade.
- **Fichier corrompu** : detecte cote serveur apres upload. Message : `Le fichier semble corrompu et ne peut pas etre ouvert. Verifiez le fichier source.` Code HTTP 422.
- **Mot de passe incorrect** (PDF unlock) : message rouge sous le champ mot de passe. Le champ est vide. Focus replace dans le champ.
- **Timeout depassement** (>60s) : message : `La conversion a pris trop de temps (>60s). Essayez avec un fichier plus petit ou une qualite inferieure.` L'utilisateur peut retenter.
- **Service indisponible** : si signapps-office ne repond pas (timeout connexion >5s), message : `Le service de conversion est temporairement indisponible. Reessayez dans quelques instants.` Bouton `Reessayer`.
- **Quota depasse** : message orange : `Vous avez atteint la limite de 20 conversions/minute. Reessayez dans N secondes.` Avec countdown en temps reel.
- **Fichier trop volumineux** : rejet au drop (client-side) avant upload. Message : `Le fichier depasse la taille maximale autorisee (100 Mo). Taille du fichier : X Mo.`
- **Espace disque insuffisant** (serveur) : rare, retourne HTTP 507. Message : `Espace de stockage temporaire insuffisant. Contactez l'administrateur.`

---

## Categorie 7 -- Architecture backend et API

### 7.1 Service signapps-office
Le service signapps-office (port 3018) gere toutes les conversions de documents. Architecture : serveur Axum avec pool de workers. Chaque worker maintient une instance LibreOffice headless prete. Pool size : min 2, max 8 (configurable). Cold start d'un worker : ~3 secondes. Le crate `calamine` est utilise pour le parsing natif Rust des fichiers XLSX/XLS/ODS (lecture des cellules, types, formules, metadonnees) sans passer par LibreOffice quand seule la lecture est necessaire.

### 7.2 Endpoints API

| Method | Route | Description | Request | Response |
|---|---|---|---|---|
| `POST` | `/api/v1/office/convert` | Conversion generique | multipart: file + JSON params (`{from, to, options}`) | Binary stream (converted file) |
| `POST` | `/api/v1/office/pdf/merge` | Fusionner N PDFs | multipart: files[] | Binary stream (merged PDF) |
| `POST` | `/api/v1/office/pdf/split` | Decouper un PDF | multipart: file + JSON `{ranges: ["1-3","4-7"]}` | Binary stream (ZIP) |
| `POST` | `/api/v1/office/pdf/compress` | Compresser un PDF | multipart: file + JSON `{quality: "medium", dpi: 100}` | Binary stream (compressed PDF) |
| `POST` | `/api/v1/office/pdf/rotate` | Pivoter les pages | multipart: file + JSON `{pages: "all", angle: 90}` | Binary stream (rotated PDF) |
| `POST` | `/api/v1/office/pdf/watermark` | Ajouter un filigrane | multipart: file + JSON `{text, position, opacity, color, font_size}` | Binary stream (watermarked PDF) |
| `POST` | `/api/v1/office/pdf/protect` | Proteger par mot de passe | multipart: file + JSON `{password, permissions}` | Binary stream (protected PDF) |
| `POST` | `/api/v1/office/pdf/unlock` | Retirer la protection | multipart: file + JSON `{password}` | Binary stream (unlocked PDF) |
| `POST` | `/api/v1/office/pdf/ocr` | OCR sur un scan | multipart: file + JSON `{language: "fra", multi_language: false}` | Binary stream (searchable PDF) |
| `POST` | `/api/v1/office/pdf/fill-form` | Remplir un formulaire PDF | multipart: file + JSON `{fields: {name: value}, flatten: true}` | Binary stream (filled PDF) |
| `POST` | `/api/v1/office/pdf/to-pdfa` | Conversion PDF/A | multipart: file + JSON `{level: "2b"}` | Binary stream (PDF/A) + conformance report |
| `GET` | `/api/v1/office/pdf/metadata` | Lire les metadonnees | query: file_id | JSON (title, author, subject, keywords, dates) |
| `PUT` | `/api/v1/office/pdf/metadata` | Modifier les metadonnees | multipart: file + JSON metadata | Binary stream (updated PDF) |
| `POST` | `/api/v1/office/presentation/extract-text` | Extraire le texte | multipart: file + JSON `{format: "markdown"}` | Text/Markdown file |
| `POST` | `/api/v1/office/presentation/extract-images` | Extraire les images | multipart: file | Binary stream (ZIP) |
| `POST` | `/api/v1/office/presentation/thumbnails` | Generer vignettes | multipart: file + JSON `{width: 400}` | Binary stream (ZIP of PNGs) |
| `POST` | `/api/v1/office/batch` | Batch conversion | multipart: files[] + JSON `{operation, options}` | Binary stream (ZIP) |
| `GET` | `/api/v1/office/jobs/{job_id}` | Statut d'un job async | - | JSON `{status, progress, result_url}` |

### 7.3 Traitement asynchrone
Pour les fichiers volumineux (>10 Mo) ou les operations longues (OCR, merge de N PDFs, batch), le traitement est asynchrone. Le frontend recoit un `202 Accepted` avec un `job_id`. Le frontend poll le statut via `GET /api/v1/office/jobs/{job_id}` (interval 2 secondes) avec les statuts : `queued` (en file d'attente), `processing` (en cours, `progress` 0-100), `completed` (fini, `result_url` disponible), `failed` (echec, `error` avec message). A la completion, le fichier resultat est telecharge depuis `result_url`. Les jobs expires (>1 heure) sont nettoyes.

### 7.4 Gestion des erreurs de conversion
Les erreurs de conversion sont classees en trois niveaux et retournees dans un header `X-Conversion-Report` (JSON) :
- **Erreur bloquante** (HTTP 422) : fichier corrompu, format non reconnu, mot de passe incorrect, fichier vide, timeout depassement. Message d'erreur rouge avec detail technique. Pas de fichier resultat.
- **Avertissement** (HTTP 200 + header warnings) : elements non convertis (macros ignorees, polices substituees, formules converties en valeurs, animations supprimees). Fichier resultat genere + bandeau d'avertissement jaune listant les elements affectes dans le frontend.
- **Information** (HTTP 200) : conversion reussie avec optimisations mineures (compression d'images, normalisation des encodages). Message de succes vert.

### 7.5 Quotas et rate limiting
Rate limiting par utilisateur : 20 conversions par minute, 200 par heure. Gere via signapps-cache (compteurs atomiques avec TTL). Au-dela, reponse HTTP 429 avec header `Retry-After` (secondes). Le frontend affiche : `Limite de conversions atteinte. Reessayez dans N secondes.` Les admins peuvent augmenter les quotas par role dans les parametres.

### 7.6 Formats supportes -- matrice de conversion

| Format source | Formats cibles supportes |
|---|---|
| CSV | XLSX, ODS, TSV, JSON, PDF (tableau) |
| ODS | XLSX, CSV, PDF, JSON |
| XLSX | ODS, CSV, PDF, JSON |
| XLS | XLSX, ODS, CSV, PDF |
| TSV | XLSX, CSV, JSON |
| PDF | Images (PNG/JPEG/WebP), DOCX, XLSX (tableaux), PDF/A, PDF (merge/split/compress/rotate/watermark/protect/ocr/form-fill) |
| DOCX | PDF, HTML |
| HTML | PDF |
| ODP | PPTX, PDF, Images (PNG/JPEG/WebP/SVG) |
| PPTX | ODP, PDF, Images |
| PPT | PPTX, ODP, PDF |
| Images (JPEG/PNG/WebP/TIFF/BMP) | PDF |

### 7.7 PostgreSQL Schema

```sql
CREATE TABLE tool_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    source_filename VARCHAR(255) NOT NULL,
    source_format VARCHAR(20) NOT NULL,
    source_size_bytes BIGINT NOT NULL,
    target_format VARCHAR(20) NOT NULL,
    operation VARCHAR(50) NOT NULL,
    result_filename VARCHAR(255),
    result_size_bytes BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    error_message TEXT,
    warnings JSONB DEFAULT '[]',
    duration_ms INTEGER,
    temp_file_path TEXT,
    temp_file_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_tool_conversions_user ON tool_conversions(user_id, created_at DESC);
CREATE INDEX idx_tool_conversions_status ON tool_conversions(status) WHERE status IN ('queued', 'processing');
CREATE INDEX idx_tool_conversions_cleanup ON tool_conversions(temp_file_expires_at) WHERE temp_file_path IS NOT NULL;

CREATE TABLE tool_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    tab VARCHAR(20) NOT NULL CHECK (tab IN ('spreadsheets', 'pdf', 'presentations')),
    label VARCHAR(100) NOT NULL,
    operation VARCHAR(50) NOT NULL,
    options JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, tab, label)
);
```

### 7.8 PgEventBus Events

| Event | Payload | Consumers |
|---|---|---|
| `tools.conversion.started` | `{job_id, user_id, operation, source_format, target_format, source_size}` | signapps-metrics (monitoring) |
| `tools.conversion.completed` | `{job_id, user_id, operation, source_format, target_format, duration_ms, result_size}` | signapps-metrics (monitoring), signapps-notifications (if batch) |
| `tools.conversion.failed` | `{job_id, user_id, operation, error}` | signapps-metrics (monitoring), signapps-notifications (if batch) |
| `tools.batch.completed` | `{batch_id, user_id, total, succeeded, failed}` | signapps-notifications (push to user) |

---

## Categorie 8 -- Accessibilite et permissions

### 8.1 Accessibilite ARIA
Toutes les zones de drag-and-drop ont un label ARIA (`aria-label="Zone de depot de fichier"`) et un bouton de fallback visible pour la selection de fichier classique. Les barres de progression utilisent `role="progressbar"` avec `aria-valuenow`, `aria-valuemin`, `aria-valuemax`. Les messages d'erreur et de succes sont annonces via `aria-live="polite"`. Navigation au clavier complete entre les onglets (`role="tablist"`, `role="tab"`, `role="tabpanel"`), les outils et les boutons. Les vignettes de pages PDF sont navigables au clavier avec description ARIA (`aria-label="Page 3 sur 15"`).

### 8.2 Permissions
Roles : `tools:user` (acces standard, toutes les operations sauf admin), `tools:admin` (configuration des quotas, acces aux logs de conversion, gestion des templates de favoris partages). Par defaut, tous les utilisateurs authentifies ont le role `tools:user`.

### 8.3 Audit et logs
Chaque conversion est journalisee dans la table `tool_conversions` : utilisateur, fichier source (nom + taille + format), operation, format cible, resultat (succes/echec), duree, taille du resultat, avertissements. Les logs sont accessibles aux admins via `/admin/tools/logs`. Filtres : par utilisateur, par operation, par date, par statut. Export CSV. Retention : 30 jours.

### 8.4 Conversion report
Apres chaque conversion qui genere des avertissements, un rapport de conversion est affiche dans un dialog expandable. Le rapport contient :
- **Resume** : `Conversion reussie avec N avertissements` ou `Conversion echouee`
- **Avertissements** : liste groupee par categorie (Polices, Formules, Mise en page, Images, Macros)
  - Polices : `La police "Comic Sans" a ete remplacee par "Arial" (3 occurrences)`
  - Formules : `12 formules converties en valeurs statiques (le format cible ne supporte pas les formules)`
  - Mise en page : `La mise en page multi-colonnes a ete linearisee`
  - Images : `2 images EMF converties en PNG`
  - Macros : `Les macros VBA ont ete supprimees (non supportees dans le format cible)`
- **Statistiques** : duree de traitement, taille du fichier source vs resultat
Le rapport est stocke dans la table `tool_conversions.warnings` (JSONB) et accessible depuis l'historique.

### 8.5 Admin dashboard
Page `/admin/tools` accessible aux `tools:admin`. Metriques affichees :
- Nombre total de conversions (aujourd'hui, cette semaine, ce mois)
- Repartition par type d'operation (bar chart : merge, split, compress, convert, etc.)
- Repartition par format source/cible (sankey chart ou heatmap)
- Taux de succes/echec (pie chart)
- Temps moyen de traitement par operation (bar chart)
- Top 10 utilisateurs par nombre de conversions (table)
- Espace disque temporaire utilise (gauge)
Filtrable par periode (7 jours, 30 jours, 90 jours). Rafraichissement automatique toutes les 5 minutes.

---

## References OSS

**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License -- ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **SheetJS (Community Edition)** (github.com/SheetJS/sheetjs) | **Apache-2.0** | Parsing et generation de fichiers tableur (XLSX, CSV, ODS) cote client. Base pour l'onglet Spreadsheets. |
| **calamine** (github.com/tafia/calamine) | **MIT** | Crate Rust pour lire les fichiers XLSX, XLS, ODS, XLSB. Parsing natif sans LibreOffice pour la lecture. Utilise dans signapps-office. |
| **pdf-lib** (github.com/Hopding/pdf-lib) | **MIT** | Creation et modification de PDFs en JavaScript. Merge, split, ajout de pages, embed fonts/images, form filling. Traitement cote client. |
| **PDF.js** (github.com/niclasp/pdfjs) | **Apache-2.0** | Rendu de PDFs dans le navigateur. Preview des fichiers PDF, vignettes de pages, detection de formulaires. |
| **Tesseract.js** (github.com/naptha/tesseract.js) | **Apache-2.0** | OCR en JavaScript (port de Tesseract). Alternative cote client pour l'OCR de petits documents. 100+ langues. |
| **LibreOffice** (libreoffice.org) | **MPL-2.0** | Usage comme outil externe (headless conversion). Licence permissive pour la consommation. Pas d'integration code source. |
| **react-dropzone** (github.com/react-dropzone/react-dropzone) | **MIT** | Composant React pour le drag-and-drop de fichiers. Base pour les zones d'upload. |
| **file-saver** (github.com/niclasp/FileSaver.js) | **MIT** | Declenchement de telechargement de fichiers generes cote client. Utilise avec SheetJS et pdf-lib. |
| **Mammoth** (github.com/mwilliamson/mammoth.js) | **BSD-2-Clause** | Conversion DOCX -> HTML fidele. Preview de documents Word avant conversion PDF. |
| **pdfcpu** (github.com/pdfcpu/pdfcpu) | **Apache-2.0** | Outil Go pour manipuler des PDFs (merge, split, watermark, encrypt). Reference pour l'implementation backend en Rust. |

---

## Assertions E2E cles (a tester)

- Page `/tools` -> le titre `Tools` et le sous-titre sont affiches
- Onglet `Spreadsheets` -> affiche par defaut avec la zone d'import et la textarea CSV
- Onglet `PDF Tools` -> clic affiche la grille des outils PDF (merge, split, compress, rotate, etc.)
- Onglet `Presentations` -> clic affiche la zone d'import de presentations
- Raccourci `Ctrl+O` -> ouvre le file picker
- Drag-and-drop CSV -> le fichier est parse et le preview tableau s'affiche avec colonnes detectees et types
- Paste CSV dans textarea -> les donnees sont parsees et le preview s'affiche
- Detection delimiteur -> un CSV avec point-virgules est correctement parse
- Detection encodage -> un fichier Latin-1 avec caracteres accentues est detecte et affiche correctement
- Feuille multi-onglets -> le dropdown de feuilles s'affiche avec les noms et nombres de lignes
- Anomalies detectees -> les avertissements (lignes vides, types mixtes) sont affiches sous le preview
- Export Format dropdown -> les options XLSX, CSV, ODS, TSV, JSON, PDF sont listees
- Conversion CSV -> XLSX -> le fichier XLSX est telecharge avec les donnees, en-tetes en gras, colonnes auto-ajustees
- Conversion CSV -> JSON -> le dialog propose mode objet/tableau, le JSON est correctement genere
- Conversion ODS -> XLSX -> upload reussi, fichier XLSX telecharge, formules preservees ou converties en valeurs
- Import depuis Drive -> le file picker s'ouvre et filtre les formats compatibles
- Export vers Drive -> le fichier converti est enregistre dans le dossier selectionne
- Merge PDF -> upload de 2+ PDFs, reordonnement par drag-and-drop, bouton fusionner, telechargement du PDF fusionne
- Split PDF -> upload d'un PDF, selection de plages `1-3, 4-7`, telechargement du ZIP avec les parties
- Compress PDF -> upload d'un PDF, selection qualite moyenne, telechargement du PDF comprime avec taille reduite affichee
- Rotate PDF -> upload d'un PDF, rotation 90 degres de toutes les pages, preview des vignettes tournees
- PDF to Images -> conversion en PNG 150 DPI, telechargement du ZIP
- Images to PDF -> upload de 3 images, reordonnement, creation du PDF
- PDF Watermark -> upload d'un PDF, saisie texte `CONFIDENTIEL`, preview en temps reel, telechargement du PDF filigrane
- PDF Protect -> upload, saisie mot de passe, telechargement du PDF protege
- PDF Unlock -> upload PDF protege, saisie mot de passe correct, telechargement du PDF deverrouille
- PDF Unlock mot de passe incorrect -> message d'erreur `Mot de passe incorrect`
- PDF OCR -> upload d'un PDF scan, selection langue francais, telechargement du PDF searchable
- PDF Form Fill -> upload d'un PDF formulaire, champs detectes et editables, telechargement du PDF rempli
- PDF/A -> upload d'un PDF, conversion en PDF/A-2b, rapport de conformite affiche
- Pipeline PDF -> chainer merge + compress + watermark, execution en une seule operation
- Import presentation ODP -> les vignettes des slides s'affichent en grille avec numeros
- Export presentation PDF -> le PDF est genere avec les slides en pages, options slides par page fonctionnelles
- Export slides en images -> ZIP telechargeable avec une image par slide
- Extraction texte -> le fichier Markdown contient les titres et contenus des slides
- Merge presentations -> 2 fichiers fusionnes en un seul
- Mode batch -> upload de 5 CSV, conversion en XLSX, progression individuelle, telechargement ZIP
- Fichier trop volumineux (>100 Mo) -> message d'erreur `Le fichier depasse la taille maximale autorisee (100 Mo)`
- Batch trop volumineux (>500 Mo) -> message d'erreur `La taille cumulee des fichiers depasse 500 Mo`
- Format non supporte -> message d'erreur clair lors du drag-and-drop
- Fichier corrompu -> message d'erreur `Le fichier semble corrompu et ne peut pas etre traite`
- Timeout serveur -> message d'erreur `La conversion a pris trop de temps. Essayez avec un fichier plus petit.`
- Rate limit atteint -> message `Limite de conversions atteinte. Reessayez dans N secondes.`
- Historique conversions -> page `/tools/history` affiche les conversions recentes avec statut et telechargement
- Service signapps-office indisponible -> message d'erreur gracieux `Service de conversion indisponible`
