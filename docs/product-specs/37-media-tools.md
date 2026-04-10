# Module Outils Media (Media Tools) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Adobe Acrobat OCR** | OCR de haute precision sur PDF scannes, reconnaissance multi-langues (50+), preservation de la mise en page, export vers Word/Excel/PowerPoint, text searchable PDF, batch processing |
| **Google Cloud Vision** | OCR API cloud, detection d'objets/visages/labels, text detection (dense et sparse), document AI (formulaires structures), handwriting recognition, multi-langues 100+ |
| **Tesseract** | Open source (Apache-2.0), OCR engine mature (LSTM), 100+ langues, line/word/character level, page segmentation modes, trainable pour polices custom, CLI et API C++ |
| **AWS Textract** | Extraction structuree de documents (tables, formulaires, key-value pairs), OCR haute precision, integration S3, analyse de documents d'identite, analyse de factures |
| **Cloudinary** | Media pipeline cloud, transformation d'images a la volee (resize, crop, effects, format), video transcoding, AI tagging, responsive images, CDN integre, upload widget |
| **imgix** | Transformation d'images par URL parameters, real-time processing, auto-format (WebP/AVIF), focal point crop, face detection, color palette extraction, purge cache |

## Principes directeurs

1. **Traitement natif (local-first)** — tous les traitements sont executes localement sur le serveur SignApps via le service signapps-media (port 3009). Pas de dependance cloud obligatoire pour la vie privee et la latence.
2. **Pipeline composable** — chaque outil (OCR, TTS, STT, resize, encode) est une etape independante composable en pipeline. Exemple : upload PDF → OCR → TTS → audio.
3. **GPU-accelere quand disponible** — detection automatique du GPU (CUDA, ROCm, Metal, Vulkan) pour accelerer l'OCR, le STT, le TTS et l'encodage. Fallback CPU transparent.
4. **Formats universels** — accepte tous les formats courants en entree, produit des formats standards en sortie. Pas de format proprietaire.
5. **Batch et temps reel** — chaque outil fonctionne en mode unitaire (un fichier) et en mode batch (dossier/selection). Barre de progression pour les traitements longs.
6. **Qualite configurable** — pour chaque outil, l'utilisateur choisit le compromis qualite/vitesse/taille. Presets : rapide, equilibre, haute qualite.

---

## Categorie 1 — OCR (Reconnaissance Optique de Caracteres)

### 1.1 Pipeline OCR : upload → extract → edit → save
Le pipeline OCR complet se deroule en 4 phases :
1. **Upload** : drag-and-drop ou bouton `Upload Image/Document`. Formats acceptes : PNG, JPEG, TIFF, BMP, WebP, PDF (multi-pages), HEIC. Taille maximale : 50 Mo par fichier. Si le fichier excede la limite, message `Fichier trop volumineux (62 Mo). Limite : 50 Mo.`. Preview de l'image/document avec zoom (molette souris) et navigation (pour les PDF multi-pages : fleches gauche/droite ou miniatures en bas).
2. **Extract** : bouton `Extraire le texte` lance le traitement OCR via `POST /api/v1/media/ocr`. Barre de progression avec pourcentage et estimation du temps restant. Pour les PDF multi-pages : progression page par page (`Page 3/12 — 25%`). Le traitement est execute dans un thread pool dedie (pas sur le main tokio runtime). Delai typique : 2-5 secondes par page A4.
3. **Edit** : texte extrait affiche dans un editeur a droite de l'image source. Mise en correspondance visuelle : survoler un paragraphe dans le texte met en surbrillance la zone correspondante dans l'image (overlay semi-transparent bleu). L'utilisateur peut corriger les mots mal reconnus directement dans l'editeur. Les mots avec un score de confiance < 80% sont soulignes en rouge.
4. **Save** : bouton `Sauvegarder` avec options d'export : TXT (texte brut), DOCX (document Word), PDF searchable (texte invisible superpose), JSON (texte + coordonnees + confiance). Bouton `Copier tout` copie le texte dans le presse-papier. Le fichier est sauvegarde dans Drive avec le tag `ocr-result`. Raccourci : `Ctrl+S` sauvegarde, `Ctrl+C` copie le texte selectionne.

### 1.2 Detection de la langue
Detection automatique de la langue du document avant l'OCR. Support : francais, anglais, allemand, espagnol, italien, portugais, neerlandais, arabe, chinois, japonais, coreen, russe, et 80+ autres. Si la detection automatique echoue ou est ambigue, un selecteur de langue s'affiche : `Langue detectee : Francais (92%). Corriger ?`. Selection manuelle dans un dropdown avec recherche. La langue affecte le modele OCR utilise et la qualite de la reconnaissance.

### 1.3 OCR de tableaux
Detection automatique des tableaux dans le document. Les lignes horizontales et verticales sont analysees pour reconstruire la structure (lignes et colonnes). Export vers le module Tableur (Spreadsheet) ou en CSV. Preview du tableau reconstruit avant export dans un panneau dedie. Si le tableau est complexe (cellules fusionnees, bordures manquantes), un mode `Assiste` permet a l'utilisateur de tracer manuellement les delimitations.

### 1.4 OCR de formulaires
Detection des champs de formulaire (label + valeur). Extraction en paires cle-valeur : `Nom : Dupont`, `Date : 15/03/2026`. Export en JSON ou vers le module Forms. Utile pour numeriser des formulaires papier. L'interface affiche les paires detectees avec un score de confiance et un bouton `Corriger` pour chaque paire.

### 1.5 OCR par lot (batch)
Selection de plusieurs fichiers ou d'un dossier entier. Traitement sequentiel ou parallele (selon les ressources CPU/GPU). Tableau de progression avec statut par fichier : nom, taille, statut (En attente / En cours / Termine / Erreur), confiance moyenne. Export groupee en ZIP contenant les textes extraits. API : `POST /api/v1/media/ocr/batch` avec un tableau de `file_id`. Reponse : `202 Accepted` avec un `batch_id`. Progression via SSE : `GET /api/v1/media/ocr/batch/:id/progress`.

### 1.6 PDF searchable
Transformer un PDF scanne (image) en PDF searchable : le texte OCR est incruste en couche invisible au-dessus des images. Le PDF reste visuellement identique mais le texte est selectionnable et recherchable. API : `POST /api/v1/media/ocr/searchable-pdf`. Option : compresser les images du PDF en meme temps pour reduire la taille (reduction de 30-50%).

### 1.7 Precision et confiance
Affichage du score de confiance par mot (code couleur : vert >95%, orange 80-95%, rouge <80%). Option de correction manuelle : clic sur un mot rouge pour le corriger. Statistiques globales : nombre de mots, confiance moyenne, nombre de mots a faible confiance. Si la confiance moyenne < 70%, un bandeau warning s'affiche : `Qualite de reconnaissance faible. Verifiez la nettete de l'image source.`

### 1.8 Integration avec Drive
Clic droit sur un fichier image/PDF dans Drive → `Extraire le texte (OCR)`. Le texte extrait est sauvegarde comme nouveau document ou ajoute en metadonnees du fichier (recherche full-text). Integration avec le module de recherche : les fichiers OCR-ises sont cherchables par leur contenu texte.

---

## Categorie 2 — TTS (Text-to-Speech / Synthese vocale)

### 2.1 Interface de saisie avec controles
Zone de texte large pour coller ou taper le texte a convertir. Compteur de caracteres en bas a droite (`2 450 / 10 000`). Limite configurable (defaut : 10 000 caracteres par requete). Import depuis un fichier texte, un document Docs, ou le resultat d'un OCR via le bouton `Importer`. Le texte colle est automatiquement nettoye (suppression des sauts de ligne multiples, normalisation des espaces).

### 2.2 Selection de voix
Liste des voix disponibles avec preview (bouton play sur chaque voix). Filtres : langue (dropdown), genre (masculin/feminin/neutre), style (professionnel, conversationnel, narratif). Voix natives generees par les modeles locaux (Piper TTS, MIT). Chaque voix affiche : nom, langue, genre, qualite (etoiles 1-5), taille du modele. Les modeles sont telecharges a la demande et caches localement. Si le modele n'est pas installe, bouton `Telecharger` (taille et duree estimees).

### 2.3 Parametres de vitesse et controle
- **Vitesse** : slider 0.5x a 2.0x (normal = 1.0x). Valeur affichee a cote du slider.
- **Pitch** : slider -50% a +50% (normal = 0%)
- **Volume** : slider 0-100% (normal = 80%)
- **Pauses** : duree des pauses entre phrases (court 200ms, moyen 500ms, long 1000ms)
- **Format de sortie** : MP3 (defaut, compact), WAV (non-compresse, haute qualite), OGG (open format), FLAC (lossless)

Chaque slider affiche sa valeur numerique et peut etre reinitialise individuellement par double-clic. Bouton `Reinitialiser tout` remet les valeurs par defaut.

### 2.4 Preview temps reel
Bouton `Ecouter` pour generer et jouer le resultat en streaming (pas besoin d'attendre la fin de la generation). Controles : play/pause, slider de position (seek), vitesse de lecture. Le streaming commence en moins de 500ms. Si l'utilisateur modifie le texte pendant la lecture, un bouton `Regenerer` apparait. API : `POST /api/v1/media/tts/stream` avec streaming SSE audio chunks.

### 2.5 SSML support
Pour les utilisateurs avances : editeur SSML (Speech Synthesis Markup Language) pour controler finement la prononciation, les pauses, l'emphase, la phonetique. Aide inline avec les balises supportees. Toggle entre mode texte simple et mode SSML. Validation du SSML avant generation (erreur si balise invalide).

### 2.6 Synthese par lot
Convertir un document multi-pages ou une liste de textes en fichiers audio individuels ou en un seul fichier concatene. Table des matieres audio (chapitres avec timestamps). Barre de progression globale et par element. Export en ZIP. API : `POST /api/v1/media/tts/batch`.

### 2.7 Integration avec Docs et Mail
Bouton `Lire a voix haute` dans l'editeur Docs pour ecouter le document. Conversion d'un email en audio pour ecoute en mobilite. Sauvegarde de l'audio dans Drive avec lien vers le document source. Le bouton est accessible dans la toolbar de l'editeur et dans l'action menu d'un email.

---

## Categorie 3 — STT (Speech-to-Text / Transcription)

### 3.1 Upload audio/video
Drag-and-drop ou bouton `Upload`. Formats acceptes : MP3, WAV, OGG, FLAC, M4A, WEBM, MP4, MKV, AVI. Extraction automatique de la piste audio pour les fichiers video (via FFmpeg en subprocess). Taille maximale : 500 Mo. Duree maximale : 4 heures. Si le fichier excede les limites, message avec les limites exactes.

### 3.2 Enregistrement en direct
Bouton `Enregistrer` avec selection du microphone (dropdown si plusieurs peripheriques). Indicateur de niveau sonore en temps reel (barre verte/jaune/rouge). Pause/reprise. Arret et transcription automatique. Duree maximale d'enregistrement : 2 heures. Le buffer audio est envoye au serveur toutes les 5 secondes pour une transcription quasi temps reel (resultat partiel affiche avec ~2s de latence).

### 3.3 Transcription avec timestamps
Texte transcrit affiche avec timestamps au niveau du mot ou de la phrase. Format : `[00:01:05] Bonjour et bienvenue dans cette reunion.` Clic sur un timestamp saute a cette position dans le lecteur audio integre. Le lecteur audio est synchronise : la phrase en cours de lecture est surlignee en bleu dans le texte. Raccourci : `Espace` pour play/pause, fleches pour avancer/reculer de 5 secondes.

### 3.4 Diarization (identification des locuteurs)
Detection automatique du nombre de locuteurs et attribution de chaque segment. Affichage : `Locuteur 1 [00:01:05]: Bonjour...`, `Locuteur 2 [00:01:12]: Merci...`. Renommage des locuteurs (Locuteur 1 → "Marie") par clic sur le nom. Couleur distincte par locuteur. Filtre par locuteur pour ne voir que les segments d'une personne. Statistiques : temps de parole par locuteur (camembert).

### 3.5 Multi-langues
Detection automatique de la langue ou selection manuelle. Support du code-switching (melange de langues dans le meme audio). Transcription en langue source ou traduction directe vers une autre langue. Langues supportees : toutes les langues du modele Whisper (97+).

### 3.6 Ponctuation et formatage
Ajout automatique de la ponctuation (points, virgules, points d'interrogation). Detection des paragraphes. Majuscules en debut de phrase. Option de formatage : texte brut, paragraphes, sous-titres (SRT/VTT).

### 3.7 Export multi-format
Export en TXT (texte brut), SRT (sous-titres), VTT (WebVTT), DOCX (document Word), JSON (timestamps + texte + locuteurs). Copie rapide dans le presse-papier. Chaque format a un bouton dedie. L'export SRT/VTT est compatible avec les lecteurs video standards. API : `GET /api/v1/media/stt/:id/export?format=srt`.

### 3.8 Integration avec Meet et Chat
Transcription en direct pendant une reunion Meet. Sauvegarde automatique de la transcription a la fin de la reunion. Transcription d'un message vocal dans Chat (affiche le texte sous le message audio). Evenement PgEventBus : `meeting.ended` declenche la transcription finale.

---

## Categorie 4 — Video Transcoding et sous-titres

### 4.1 Upload et conversion web-friendly
Upload d'une video dans n'importe quel format (MP4, MKV, AVI, MOV, WebM, FLV, WMV, 3GP). Le systeme detecte automatiquement si le format est compatible web. Si non compatible, proposition de transcodage : `Ce fichier MKV n'est pas compatible avec les navigateurs. Convertir en MP4 (H.264) ?`. Bouton `Convertir`. Barre de progression avec pourcentage, taille estimee, et ETA. Le fichier original est conserve, le fichier converti est ajoute a cote dans Drive. API : `POST /api/v1/media/video/transcode` avec body `{ file_id, target_format, preset }`.

### 4.2 Presets de transcodage
- **Web (defaut)** : MP4 H.264, AAC audio, 720p, CRF 23, ~2 Mo/min
- **Haute qualite** : MP4 H.265, AAC audio, 1080p, CRF 20, ~5 Mo/min
- **Archive** : MP4 AV1, Opus audio, resolution originale, CRF 30, ~1 Mo/min
- **Mobile** : MP4 H.264, AAC audio, 480p, CRF 26, ~1 Mo/min
- **Custom** : tous les parametres configurables (codec, resolution, bitrate, framerate, audio codec)

Chaque preset affiche : qualite estimee, taille estimee, duree estimee de conversion.

### 4.3 Detection automatique de chapitres
Upload d'une video → analyse du contenu (detection de scene via changements visuels, changements de sujet via STT, silences). Generation automatique de chapitres avec titre et timestamp. Edition manuelle des titres et des points de coupure. Timeline de la video avec marqueurs de chapitres draggables.

### 4.4 Sous-titres automatiques
Generation de sous-titres via STT avec synchronisation temporelle. Formats : SRT, VTT, ASS. Edition inline : modifier le texte, ajuster le timing (drag des bornes), splitter/merger les segments. Preview : la video joue avec les sous-titres superposes. Export par format. API : `POST /api/v1/media/video/:id/subtitles/generate`.

### 4.5 Traduction de sous-titres
Sous-titres dans la langue source → traduction automatique vers une ou plusieurs langues cibles. Sous-titres multi-pistes (l'utilisateur choisit sa langue). Export par langue. Preview avec selection de la piste.

### 4.6 Incrustation de sous-titres (burn-in)
Option d'incruster les sous-titres dans la video (hardcoded). Choix de la police, taille, couleur, position (bas, haut, centre), fond (transparent, semi-transparent noir, opaque). Preview avant encodage.

### 4.7 Format conversion matrix
Matrice des conversions supportees (input → output) :

| Input | Output MP4 | Output WebM | Output MKV | Output AVI | Output Audio |
|---|---|---|---|---|---|
| MP4 | Remux/Transcode | Transcode | Remux | Transcode | Extract |
| MKV | Transcode | Transcode | Remux | Transcode | Extract |
| AVI | Transcode | Transcode | Transcode | Remux | Extract |
| MOV | Transcode | Transcode | Transcode | Transcode | Extract |
| WebM | Transcode | Remux | Transcode | Transcode | Extract |

`Remux` = changement de conteneur sans re-encodage (instantane). `Transcode` = re-encodage (duree proportionnelle). `Extract` = extraction de la piste audio sans re-encodage video.

---

## Categorie 5 — Editeur d'images

### 5.1 Outils de base
- **Recadrage** (crop) : libre, ratio fixe (1:1, 4:3, 16:9, A4), crop circulaire. Poignees de redimensionnement aux coins et aux bords. Overlay assombri sur la zone exclue. Validation par `Enter`, annulation par `Escape`.
- **Rotation** : 90, 180, 270 par bouton, libre par slider (-180 a +180 degres). Preview en temps reel. Grille d'alignement optionnelle.
- **Retournement** : horizontal, vertical (boutons dans la toolbar).
- **Redimensionnement** : par pixels (largeur x hauteur), par pourcentage, avec/sans conservation du ratio (cadenas toggle). Algorithme Lanczos pour la haute qualite.

Raccourcis clavier : `C` pour crop, `R` pour rotation, `Ctrl+Z` undo, `Ctrl+Shift+Z` redo. Historique illimite des modifications (stack d'undo).

### 5.2 Ajustements
Sliders pour : luminosite, contraste, saturation, teinte, temperature, exposition, ombres, hautes lumieres, nettete, flou, vignette. Preview temps reel (delai < 50ms). Bouton `Reinitialiser` par slider et global. Les ajustements sont non-destructifs : la source est preservee et les parametres sont appliques au rendu.

### 5.3 Filtres
Bibliotheque de filtres pre-definis : Noir & Blanc, Sepia, Vintage, Froid, Chaud, Cinema, HDR, Pastel, Polaroid. Preview en grille avant application (miniatures de l'image avec chaque filtre). Intensite du filtre ajustable (slider 0-100%). Application non-destructive.

### 5.4 Annotations et watermark
Outils d'annotation : texte (police, taille, couleur), fleches, rectangles, cercles, lignes, surlignage, flou (pour masquer des infos sensibles), tampon (date, logo). Couches superposees reordonnables par drag-and-drop dans un panneau de calques.

**Watermark** : ajout d'un watermark texte ou image sur la photo. Position configurable (centre, coin, tile). Opacite reglable (0-100%). Le watermark est applique a l'export, pas sur l'original.

### 5.5 Detourage (remove background)
Bouton `Supprimer le fond` → detection automatique du sujet principal, suppression du fond. Resultat : image sur fond transparent (PNG) ou fond uni de couleur choisie. Affinage manuel avec pinceau (ajouter/retirer des zones). Delai : 2-5 secondes selon la complexite. API : `POST /api/v1/media/image/remove-background`.

### 5.6 Conversion de format
Convertir entre : PNG, JPEG, WebP, AVIF, TIFF, BMP, GIF, SVG (rasterisation), ICO. Options : qualite (JPEG/WebP : slider 1-100), compression (PNG level 1-9), profondeur de couleur (8/16 bits), profil ICC. Comparaison avant/apres : taille originale vs taille convertie, affichage du pourcentage de reduction.

### 5.7 Traitement par lot
Selection de plusieurs images → appliquer la meme operation (resize, crop, filtre, format, compression) a toutes. Barre de progression. Export en ZIP. Tableau de resultats avec miniature, taille avant/apres, statut. API : `POST /api/v1/media/image/batch` avec operations et liste de file_id.

---

## Categorie 6 — Thumbnails et EXIF

### 6.1 Generation automatique de thumbnails
Generation automatique de thumbnails pour chaque image uploadee dans Drive. Tailles generees : 64x64 (icone), 256x256 (preview), 512x512 (galerie). Crop intelligent centre sur le sujet principal (face detection ou saliency map). Les thumbnails sont stockes dans un cache dedie et servis via un endpoint optimise : `GET /api/v1/media/thumbnails/:file_id?size=256`. Header `Cache-Control: public, max-age=86400`. Regeneration a la demande si l'image source est modifiee.

### 6.2 EXIF metadata viewer
Panneau de metadonnees affiche pour chaque image : modele d'appareil, date de prise de vue, resolution, ouverture, vitesse, ISO, GPS (carte miniature si disponible), profil couleur, taille du fichier. Bouton `Supprimer les metadonnees` pour anonymiser (suppression GPS, modele, date). Bouton `Supprimer uniquement le GPS` pour la vie privee sans perdre les autres infos. Raccourci : `I` pour afficher/masquer le panneau EXIF. API : `GET /api/v1/media/image/:id/exif`, `DELETE /api/v1/media/image/:id/exif?fields=gps`.

### 6.3 CDN integration
Les images traitees (thumbnails, conversions, optimisations) sont servies depuis un endpoint dedie avec headers de cache optimises. Support de la negociation de format : si le navigateur supporte WebP/AVIF (header `Accept`), le format le plus efficace est retourne automatiquement. URL pattern : `/media/cdn/:file_id/:size.:format`. Les images sont stockees dans le backend signapps-storage (port 3004) avec OpenDAL.

---

## Categorie 7 — Batch Processing Queue

### 7.1 File d'attente de traitement
Tous les traitements media longs (OCR batch, TTS batch, transcodage video, batch resize) sont geres par une file d'attente centralisee. Dashboard de la file : traitements en cours, en attente, termines. Priorite par type : les traitements utilisateur interactifs (preview, single file) sont prioritaires sur les batchs.

### 7.2 Gestion de la file
Tableau : nom du job, type (OCR/TTS/STT/Video/Image), fichiers (nombre), progression, priorite, utilisateur, date de soumission. Actions : annuler, reprioritiser, relancer. L'annulation est immediate pour les jobs en attente, et avec un delai de quelques secondes pour les jobs en cours (le processus en cours termine l'element courant).

### 7.3 Limites et quotas
Nombre de jobs paralleles configurable (defaut : 2 par type, 4 total). Queue maximum : 100 jobs en attente. Si la queue est pleine, message `La file d'attente est pleine. Reessayez dans quelques minutes.` avec `503 Service Unavailable`. Quota par utilisateur : configurable (defaut : illimite).

### 7.4 Notifications de completion
Notification push quand un batch est termine : `Votre batch OCR (12 fichiers) est termine. 11 succes, 1 erreur.`. Lien vers les resultats. Notification via PgEventBus `media.batch.completed` consommee par le module Notifications.

---

## Categorie 8 — Encodage video et audio

### 8.1 Transcodage video
Conversion entre formats : MP4, MKV, WebM, AVI, MOV, FLV. Codecs : H.264, H.265/HEVC, VP9, AV1. Options : resolution, bitrate, framerate, audio codec (AAC, Opus, MP3). Presets : web (H.264 720p), haute qualite (H.265 1080p), archive (AV1 4K). Acceleration GPU via detection automatique (NVIDIA NVENC, AMD AMF, Intel QSV, Apple VideoToolbox). Le GPU est utilise si disponible, sinon fallback CPU transparent. Statistique affichee : `Encodage GPU (NVENC) — 3.2x temps reel`.

### 8.2 Transcodage audio
Conversion entre : MP3, WAV, OGG, FLAC, AAC, M4A, OPUS, WMA. Options : bitrate (64-320 kbps), sample rate (22050-48000 Hz), channels (mono/stereo). Normalisation du volume (loudness normalization EBU R128). Suppression du bruit de fond (option).

### 8.3 Extraction de piste
Extraire la piste audio d'une video. Extraire les sous-titres embarques. Extraire un frame a un timestamp donne (screenshot video). Interface : timeline de la video avec un marqueur positionnable, bouton `Extraire le frame`. API : `POST /api/v1/media/video/:id/extract-audio`, `POST /api/v1/media/video/:id/extract-frame?timestamp=01:23:45`.

### 8.4 Concatenation
Assembler plusieurs fichiers audio ou video en un seul. Ordre par drag-and-drop. Transition entre les segments : coupe franche (defaut), fondu au noir (0.5s-2s), fondu enchaine (0.5s-2s). Preview de la transition.

### 8.5 Trim (decoupage)
Definir un point d'entree et un point de sortie sur la timeline. Exporter le segment selectionne sans re-encodage (si compatible) pour la vitesse. Re-encodage si changement de format. Interface : double curseur sur la timeline, preview en temps reel du segment selectionne.

### 8.6 Thumbnails video
Generation de thumbnails a intervalles reguliers (ex: 1 par minute). Grille de previews (sprite sheet) pour le survol de la timeline dans le lecteur video. Choix d'un thumbnail custom pour la cover.

### 8.7 Acceleration GPU
Detection automatique du GPU : NVIDIA (NVENC/NVDEC), AMD (AMF), Intel (QSV), Apple (VideoToolbox). Encodage hardware 3-10x plus rapide que le CPU. Fallback CPU transparent si pas de GPU. Detection via `signapps-runtime::HardwareProfile::detect()`. Statistiques dans le dashboard : type de GPU detecte, encodeur utilise, ratio de performance.

---

## Schema PostgreSQL

```sql
-- Jobs de traitement media
CREATE TABLE media_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    job_type VARCHAR(20) NOT NULL CHECK (job_type IN ('ocr', 'tts', 'stt', 'transcode', 'image', 'batch')),
    status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'success', 'error', 'cancelled')),
    priority SMALLINT NOT NULL DEFAULT 5,
    input_files UUID[] NOT NULL,
    output_files UUID[],
    config JSONB NOT NULL,
    progress_percent SMALLINT DEFAULT 0,
    progress_detail VARCHAR(200),
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_media_jobs_org ON media_jobs(org_id);
CREATE INDEX idx_media_jobs_status ON media_jobs(status);
CREATE INDEX idx_media_jobs_type ON media_jobs(job_type);

-- Resultats OCR
CREATE TABLE media_ocr_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES media_jobs(id) ON DELETE CASCADE,
    source_file_id UUID NOT NULL,
    page_number INTEGER NOT NULL DEFAULT 1,
    extracted_text TEXT NOT NULL,
    confidence_average NUMERIC(5,2),
    word_count INTEGER,
    language_detected VARCHAR(10),
    words JSONB,
    tables JSONB,
    form_fields JSONB,
    searchable_pdf_file_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ocr_results_job ON media_ocr_results(job_id);
CREATE INDEX idx_ocr_results_file ON media_ocr_results(source_file_id);

-- Resultats TTS
CREATE TABLE media_tts_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES media_jobs(id) ON DELETE CASCADE,
    input_text_hash VARCHAR(64) NOT NULL,
    voice_id VARCHAR(50) NOT NULL,
    speed NUMERIC(3,1) NOT NULL DEFAULT 1.0,
    format VARCHAR(10) NOT NULL DEFAULT 'mp3',
    output_file_id UUID NOT NULL,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tts_results_hash ON media_tts_results(input_text_hash, voice_id);

-- Resultats STT (transcriptions)
CREATE TABLE media_stt_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES media_jobs(id) ON DELETE CASCADE,
    source_file_id UUID NOT NULL,
    language_detected VARCHAR(10),
    full_text TEXT NOT NULL,
    segments JSONB NOT NULL,
    speakers JSONB,
    duration_seconds INTEGER,
    word_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stt_results_job ON media_stt_results(job_id);

-- Resultats de transcodage
CREATE TABLE media_transcode_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES media_jobs(id) ON DELETE CASCADE,
    source_file_id UUID NOT NULL,
    output_file_id UUID NOT NULL,
    source_format VARCHAR(20),
    target_format VARCHAR(20) NOT NULL,
    source_codec VARCHAR(20),
    target_codec VARCHAR(20),
    source_resolution VARCHAR(20),
    target_resolution VARCHAR(20),
    source_size_bytes BIGINT,
    output_size_bytes BIGINT,
    gpu_used BOOLEAN NOT NULL DEFAULT false,
    gpu_type VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Thumbnails
CREATE TABLE media_thumbnails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_file_id UUID NOT NULL,
    size_px INTEGER NOT NULL,
    format VARCHAR(10) NOT NULL DEFAULT 'webp',
    file_path VARCHAR(500) NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(source_file_id, size_px)
);
CREATE INDEX idx_thumbnails_source ON media_thumbnails(source_file_id);

-- EXIF metadata cache
CREATE TABLE media_exif_cache (
    file_id UUID PRIMARY KEY,
    camera_model VARCHAR(100),
    taken_at TIMESTAMPTZ,
    gps_latitude NUMERIC(10,7),
    gps_longitude NUMERIC(10,7),
    resolution_width INTEGER,
    resolution_height INTEGER,
    aperture VARCHAR(10),
    shutter_speed VARCHAR(20),
    iso INTEGER,
    color_profile VARCHAR(50),
    raw_exif JSONB,
    cached_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## PgEventBus Events

| Event | Payload | Emitted by | Consumed by |
|---|---|---|---|
| `media.ocr.completed` | `{ job_id, file_id, confidence, word_count }` | Media | Drive (index), Dashboard |
| `media.ocr.failed` | `{ job_id, file_id, error }` | Media | Notifications |
| `media.tts.completed` | `{ job_id, output_file_id, duration }` | Media | Drive, Notifications |
| `media.stt.completed` | `{ job_id, file_id, language, word_count }` | Media | Meet, Chat, Drive |
| `media.transcode.completed` | `{ job_id, source_id, output_id, format }` | Media | Drive, Notifications |
| `media.batch.completed` | `{ batch_id, job_type, total, success, errors }` | Media | Notifications |
| `media.thumbnail.generated` | `{ file_id, sizes }` | Media | Drive |
| `meeting.ended` | `{ meeting_id, recording_file_id }` | Meet | Media (auto-transcribe) |
| `file.uploaded` | `{ file_id, mime_type, size }` | Drive | Media (auto-thumbnail) |

---

## REST API Endpoints

```
# OCR
POST   /api/v1/media/ocr                               — Single file OCR
POST   /api/v1/media/ocr/batch                          — Batch OCR (multiple files)
GET    /api/v1/media/ocr/batch/:id/progress              — Batch progress (SSE)
POST   /api/v1/media/ocr/searchable-pdf                  — Generate searchable PDF
GET    /api/v1/media/ocr/:id/result                      — Get OCR result (text, words, tables)

# TTS
POST   /api/v1/media/tts                                — Generate speech from text
POST   /api/v1/media/tts/stream                          — Stream speech (SSE audio chunks)
POST   /api/v1/media/tts/batch                           — Batch TTS
GET    /api/v1/media/tts/voices                          — List available voices

# STT
POST   /api/v1/media/stt                                — Transcribe audio/video file
POST   /api/v1/media/stt/stream                          — Live transcription (WebSocket)
GET    /api/v1/media/stt/:id/result                      — Get transcription result
GET    /api/v1/media/stt/:id/export                      — Export (format: txt, srt, vtt, docx, json)

# Video
POST   /api/v1/media/video/transcode                     — Transcode video
POST   /api/v1/media/video/:id/subtitles/generate        — Auto-generate subtitles
POST   /api/v1/media/video/:id/subtitles/translate        — Translate subtitles
POST   /api/v1/media/video/:id/subtitles/burn-in          — Burn-in subtitles
POST   /api/v1/media/video/:id/chapters/detect            — Auto-detect chapters
POST   /api/v1/media/video/:id/extract-audio              — Extract audio track
POST   /api/v1/media/video/:id/extract-frame              — Extract frame at timestamp
POST   /api/v1/media/video/:id/trim                       — Trim video segment
POST   /api/v1/media/video/concatenate                    — Concatenate videos

# Image
POST   /api/v1/media/image/edit                          — Apply edits (crop, rotate, filter, etc.)
POST   /api/v1/media/image/remove-background              — Remove background
POST   /api/v1/media/image/convert                        — Convert format
POST   /api/v1/media/image/batch                          — Batch image processing
GET    /api/v1/media/image/:id/exif                       — Get EXIF metadata
DELETE /api/v1/media/image/:id/exif                       — Strip EXIF metadata

# Thumbnails
GET    /api/v1/media/thumbnails/:file_id                  — Get thumbnail (query: size)

# Jobs & Queue
GET    /api/v1/media/jobs                                — List media jobs (filter: type, status)
GET    /api/v1/media/jobs/:id                             — Get job details with progress
POST   /api/v1/media/jobs/:id/cancel                      — Cancel a job
GET    /api/v1/media/jobs/:id/progress                    — Stream progress (SSE)
GET    /api/v1/media/queue                                — Queue dashboard stats
```

Auth JWT. Rate limiting : 30 req/min for processing endpoints, 200 req/min for read endpoints.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Tesseract Documentation** (tesseract-ocr.github.io) — architecture du moteur OCR, modes de segmentation, entrainement de modeles, API C++.
- **Google Cloud Vision API Docs** (cloud.google.com/vision/docs) — concepts OCR, detection d'objets, best practices pour la qualite des images source.
- **Cloudinary Documentation** (cloudinary.com/documentation) — transformation d'images, responsive images, formats modernes, video transcoding.
- **FFmpeg Documentation** (ffmpeg.org/documentation.html) — reference complete pour l'encodage/decodage audio/video, filtres, codecs.
- **Mozilla Speech API** (developer.mozilla.org/Web/API/Web_Speech_API) — concepts TTS et STT dans le navigateur.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Tesseract OCR** (github.com/tesseract-ocr/tesseract) | **Apache-2.0** | Moteur OCR LSTM mature, 100+ langues. Reference pour l'extraction de texte. Utilisable comme dependance native. |
| **leptonica** (github.com/DanBloomberg/leptonica) | **BSD-2-Clause** | Image processing library (binarization, deskew, segmentation). Prerequis de Tesseract. |
| **PaddleOCR** (github.com/PaddlePaddle/PaddleOCR) | **Apache-2.0** | OCR multi-langues haute precision, detection de texte + reconnaissance + layout analysis. Alternative moderne a Tesseract. |
| **Whisper.cpp** (github.com/ggerganov/whisper.cpp) | **MIT** | Port C++ de Whisper (STT). Inference locale, multi-langues, diarization basique. Reference pour le STT natif. |
| **Coqui TTS** (github.com/coqui-ai/TTS) | **MPL-2.0** | **Attention** : MPL-2.0 est acceptable en consommation (pas de modification). Synthese vocale multi-langues, multi-voix. |
| **Piper TTS** (github.com/rhasspy/piper) | **MIT** | TTS natif rapide, multi-langues, modeles ONNX. Ideal pour le TTS local. |
| **image-rs** (github.com/image-rs/image) | **MIT/Apache-2.0** | Library Rust pour la manipulation d'images (resize, crop, rotate, filters, format conversion). |
| **fast_image_resize** (github.com/cykooz/fast_image_resize) | **MIT/Apache-2.0** | Resize d'images ultra-rapide en Rust avec SIMD. Pattern pour les thumbnails. |
| **rimage** (github.com/SalOne22/rimage) | **MIT** | Optimisation d'images en Rust (compression JPEG, PNG, WebP, AVIF). Pattern pour la compression sans perte visible. |
| **FFmpeg** (github.com/FFmpeg/FFmpeg) | **LGPL-2.1+** | **Attention** : LGPL acceptable en linkage dynamique uniquement. Reference absolue pour l'encodage audio/video. |
| **GStreamer** (github.com/GStreamer/gstreamer) | **LGPL-2.1+** | **Attention** : LGPL acceptable en linkage dynamique uniquement. Pipeline multimedia composable. |
| **symphonia** (github.com/pdeljanov/symphonia) | **MPL-2.0** | Decodage audio pure-Rust (MP3, FLAC, WAV, OGG, AAC). Pas de dependance C. |
| **sharp** (github.com/lovell/sharp) | **Apache-2.0** | Image processing Node.js (libvips). Pattern pour le pipeline de transformation. Deja considere cote frontend. |
| **thumbhash** (github.com/evanw/thumbhash) | **MIT** | Placeholder image ultra-leger (28 bytes). Pattern pour les previews avant chargement. |

### Pattern d'implementation recommande
1. **OCR** : Tesseract (Apache-2.0) via bindings natifs ou PaddleOCR (Apache-2.0) pour la precision superieure. Execution dans un thread dedie (pas sur le main tokio runtime).
2. **STT** : Whisper.cpp (MIT) avec modeles `small` (rapide) et `large` (precis). Detection GPU automatique. Streaming pour la transcription en direct.
3. **TTS** : Piper (MIT) pour les voix de base. Modeles ONNX charges au demarrage. Cache des resultats pour les textes frequents.
4. **Images** : `image-rs` (MIT) pour les operations de base. `fast_image_resize` (MIT) pour les thumbnails. `rimage` (MIT) pour la compression.
5. **Video/Audio** : FFmpeg en sous-process (LGPL, linkage dynamique) pour le transcodage. `symphonia` (MPL-2.0) pour le decodage audio pur-Rust quand possible.
6. **Pipeline** : chaque outil expose un trait `MediaProcessor { fn process(&self, input: MediaInput) -> Result<MediaOutput> }`. Composition par chaining.
7. **GPU** : detection hardware via `signapps-runtime::HardwareProfile::detect()`. Selection automatique du backend (CUDA, ROCm, Metal, CPU).

### Ce qu'il ne faut PAS faire
- **Pas de traitement sur le main thread** — les operations media sont CPU/GPU-bound, toujours dans un thread pool dedie ou un subprocess.
- **Pas de dependance cloud obligatoire** — tout doit fonctionner en local. Les APIs cloud sont optionnelles.
- **Pas de stockage de fichiers temporaires non-nettoyes** — les fichiers intermediaires sont supprimes apres traitement.
- **Pas de copier-coller** depuis les projets ci-dessus, meme MIT. On s'inspire des patterns, on reecrit.
- **Pas de linkage statique de FFmpeg/GStreamer** — LGPL exige le linkage dynamique. Utiliser en subprocess est preferable.
- **Pas de modeles IA non-libres** — uniquement des modeles avec licence permissive (Apache-2.0, MIT, CC-BY).

---

## Assertions E2E cles (a tester)

- Pipeline OCR complet : upload image → extract text → edit → save as TXT
- OCR multi-pages sur un PDF scanne avec progression page par page
- Score de confiance affiche par mot avec code couleur (rouge/orange/vert)
- Generation de PDF searchable a partir d'un scan
- OCR de tableau avec export vers CSV
- OCR batch : 5 fichiers traites en parallele avec progression
- Saisie de texte et generation audio TTS avec voix francaise
- Selection de voix differentes et preview audio
- Controle de vitesse TTS (0.5x et 2.0x)
- Upload d'un fichier audio et transcription STT
- Transcription avec timestamps synchronises et clic-to-seek
- Diarization : identification de 2+ locuteurs avec renommage
- Export STT en format SRT valide
- Upload video MKV → transcodage en MP4 H.264 web-friendly
- Detection automatique de chapitres video
- Generation de sous-titres SRT/VTT automatiques
- Traduction de sous-titres vers une autre langue
- Recadrage et rotation d'une image avec preview temps reel
- Application d'un filtre (Noir & Blanc) avec intensite reglable
- Suppression de fond (detourage) avec export PNG transparent
- Ajout d'un watermark texte sur une image
- Redimensionnement par lot (batch resize) avec export ZIP
- Conversion de format (PNG → WebP) avec comparaison de taille
- Generation automatique de thumbnails (3 tailles)
- Viewer EXIF avec suppression selective du GPS
- Transcodage video avec acceleration GPU (si disponible)
- Extraction de piste audio depuis une video
- Trim d'une video (decoupage d'un segment)
- File d'attente media : soumission, progression, annulation
- Integration Drive : clic droit → OCR sur un fichier
