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

### 1.1 Interface d'upload
Zone de drag-and-drop ou bouton `Upload Image/Document`. Formats acceptes : PNG, JPEG, TIFF, BMP, WebP, PDF (multi-pages), HEIC. Preview de l'image/document avec zoom et navigation (pour les PDF multi-pages).

### 1.2 Bouton Extract Text
Bouton principal `Extraire le texte` lance le traitement OCR. Barre de progression avec pourcentage et estimation du temps restant. Pour les PDF multi-pages : progression page par page.

### 1.3 Resultat de l'extraction
Texte extrait affiche dans un panneau a droite de l'image source. Mise en correspondance visuelle : survoler un paragraphe dans le texte met en surbrillance la zone correspondante dans l'image. Copie en un clic (bouton `Copier tout`). Export en TXT, DOCX, PDF searchable.

### 1.4 Detection de la langue
Detection automatique de la langue du document. Support : francais, anglais, allemand, espagnol, italien, portugais, neerlandais, arabe, chinois, japonais, coreen, russe, et 80+ autres. Selection manuelle si la detection automatique echoue.

### 1.5 OCR de tableaux
Detection automatique des tableaux dans le document. Extraction structuree en lignes et colonnes. Export vers le module Tableur (Spreadsheet) ou en CSV. Preview du tableau reconstruit avant export.

### 1.6 OCR de formulaires
Detection des champs de formulaire (label + valeur). Extraction en paires cle-valeur. Export en JSON ou vers le module Forms. Utile pour numeriser des formulaires papier.

### 1.7 OCR par lot (batch)
Selection de plusieurs fichiers ou d'un dossier entier. Traitement sequentiel ou parallele (selon les ressources). Tableau de progression avec statut par fichier. Export groupee en ZIP.

### 1.8 PDF searchable
Transformer un PDF scanne (image) en PDF searchable : le texte OCR est incruste en couche invisible au-dessus des images. Le PDF reste visuellement identique mais le texte est selectionnable et recherchable.

### 1.9 Precision et confiance
Affichage du score de confiance par mot (code couleur : vert >95%, orange 80-95%, rouge <80%). Option de correction manuelle : clic sur un mot rouge pour le corriger. Statistiques globales : nombre de mots, confiance moyenne.

### 1.10 Integration avec Drive
Clic droit sur un fichier image/PDF dans Drive → `Extraire le texte (OCR)`. Le texte extrait est sauvegarde comme nouveau document ou ajoute en metadonnees du fichier (recherche full-text).

---

## Categorie 2 — TTS (Text-to-Speech / Synthese vocale)

### 2.1 Interface de saisie
Zone de texte large pour coller ou taper le texte a convertir. Compteur de caracteres. Limite configurable (ex: 10 000 caracteres par requete). Import depuis un fichier texte, un document Docs, ou le resultat d'un OCR.

### 2.2 Selection de voix
Liste des voix disponibles avec preview (bouton play sur chaque voix). Filtres : langue, genre (masculin/feminin/neutre), style (professionnel, conversationnel, narratif). Voix natives generees par les modeles locaux.

### 2.3 Parametres de synthese
- **Vitesse** : slider 0.5x a 2.0x (normal = 1.0x)
- **Pitch** : slider -50% a +50%
- **Volume** : slider 0-100%
- **Pauses** : duree des pauses entre phrases (court, moyen, long)
- **Format de sortie** : MP3, WAV, OGG, FLAC

### 2.4 Preview temps reel
Bouton `Ecouter` pour generer et jouer le resultat en streaming (pas besoin d'attendre la fin de la generation). Controles : play/pause, slider de position, vitesse de lecture.

### 2.5 SSML support
Pour les utilisateurs avances : editeur SSML (Speech Synthesis Markup Language) pour controler finement la prononciation, les pauses, l'emphase, la phonetique. Aide inline avec les balises supportees.

### 2.6 Synthese par lot
Convertir un document multi-pages ou une liste de textes en fichiers audio individuels ou en un seul fichier concatene. Table des matieres audio (chapitres avec timestamps).

### 2.7 Integration avec Docs et Mail
Bouton `Lire a voix haute` dans l'editeur Docs pour ecouter le document. Conversion d'un email en audio pour ecoute en mobilite. Sauvegarde de l'audio dans Drive.

---

## Categorie 3 — STT (Speech-to-Text / Transcription)

### 3.1 Upload audio/video
Drag-and-drop ou bouton `Upload`. Formats acceptes : MP3, WAV, OGG, FLAC, M4A, WEBM, MP4, MKV, AVI. Extraction automatique de la piste audio pour les fichiers video.

### 3.2 Enregistrement en direct
Bouton `Enregistrer` avec selection du microphone. Indicateur de niveau sonore en temps reel. Pause/reprise. Arret et transcription automatique.

### 3.3 Transcription avec timestamps
Texte transcrit affiche avec timestamps au niveau du mot ou de la phrase. Format : `[00:01:05] Bonjour et bienvenue dans cette reunion.` Clic sur un timestamp saute a cette position dans l'audio.

### 3.4 Diarization (identification des locuteurs)
Detection automatique du nombre de locuteurs et attribution de chaque segment. Affichage : `Locuteur 1 [00:01:05]: Bonjour...`, `Locuteur 2 [00:01:12]: Merci...`. Renommage des locuteurs (Locuteur 1 → "Marie").

### 3.5 Multi-langues
Detection automatique de la langue ou selection manuelle. Support du code-switching (melange de langues dans le meme audio). Transcription en langue source ou traduction directe.

### 3.6 Ponctuation et formatage
Ajout automatique de la ponctuation (points, virgules, points d'interrogation). Detection des paragraphes. Majuscules en debut de phrase. Option de formatage : texte brut, paragraphes, sous-titres (SRT/VTT).

### 3.7 Export multi-format
Export en TXT (texte brut), SRT (sous-titres), VTT (WebVTT), DOCX (document Word), JSON (timestamps + texte). Copie rapide dans le presse-papier.

### 3.8 Integration avec Meet et Chat
Transcription en direct pendant une reunion Meet. Sauvegarde automatique de la transcription a la fin de la reunion. Transcription d'un message vocal dans Chat.

---

## Categorie 4 — Video Chapters et sous-titres

### 4.1 Detection automatique de chapitres
Upload d'une video → analyse du contenu (detection de scene, changements de sujet via STT, silences). Generation automatique de chapitres avec titre et timestamp. Edition manuelle des titres et des points de coupure.

### 4.2 Editeur de chapitres
Timeline de la video avec marqueurs de chapitres draggables. Preview du frame a chaque marqueur. Ajout/suppression de chapitres. Titre et description par chapitre.

### 4.3 Sous-titres automatiques
Generation de sous-titres via STT avec synchronisation temporelle. Formats : SRT, VTT, ASS. Edition inline : modifier le texte, ajuster le timing, splitter/merger les segments.

### 4.4 Traduction de sous-titres
Sous-titres dans la langue source → traduction automatique vers une ou plusieurs langues cibles. Sous-titres multi-pistes (l'utilisateur choisit sa langue). Export par langue.

### 4.5 Incrustation de sous-titres (burn-in)
Option d'incruster les sous-titres dans la video (hardcoded). Choix de la police, taille, couleur, position, fond. Preview avant encodage.

### 4.6 Export des chapitres
Export en format YouTube (description avec timestamps), en JSON (pour les players custom), en marqueurs MP4 (chapitres natifs). Integration avec le module Drive pour le stockage.

---

## Categorie 5 — Editeur d'images

### 5.1 Outils de base
- **Recadrage** (crop) : libre, ratio fixe (1:1, 4:3, 16:9, A4), crop circulaire
- **Rotation** : 90, 180, 270, libre (slider)
- **Retournement** : horizontal, vertical
- **Redimensionnement** : par pixels, par pourcentage, avec/sans conservation du ratio

### 5.2 Ajustements
Sliders pour : luminosite, contraste, saturation, teinte, temperature, exposition, ombres, hautes lumieres, nettete, flou, vignette. Preview temps reel. Bouton `Reinitialiser`.

### 5.3 Filtres
Bibliotheque de filtres pre-definis : Noir & Blanc, Sepia, Vintage, Froid, Chaud, Cinema, HDR, Pastel, Polaroid. Preview en grille avant application. Intensite du filtre ajustable (slider 0-100%).

### 5.4 Annotations
Outils d'annotation : texte (police, taille, couleur), fleches, rectangles, cercles, lignes, surlignage, flou (pour masquer des infos sensibles), tampon (date, logo). Couches superposees reordonnables.

### 5.5 Detourage (remove background)
Bouton `Supprimer le fond` → detection automatique du sujet principal, suppression du fond. Result : image sur fond transparent (PNG) ou fond uni de couleur choisie. Affinage manuel avec pinceau (ajouter/retirer des zones).

### 5.6 Conversion de format
Convertir entre : PNG, JPEG, WebP, AVIF, TIFF, BMP, GIF, SVG (rasterisation), ICO. Options : qualite (JPEG/WebP), compression (PNG level), profondeur de couleur, profil ICC.

### 5.7 Traitement par lot
Selection de plusieurs images → appliquer la meme operation (resize, crop, filtre, format, compression) a toutes. Barre de progression. Export en ZIP.

---

## Categorie 6 — Resize et optimisation

### 6.1 Redimensionnement intelligent
Presets de taille : vignette (150x150), web (800x600), full HD (1920x1080), 4K (3840x2160), custom. Option : fit (contenir dans la boite), fill (remplir la boite avec crop), stretch (etirer). Algorithme : Lanczos (haute qualite), bilineaire (rapide).

### 6.2 Responsive images
Generation automatique de variantes pour le web : srcset avec breakpoints (320, 640, 960, 1280, 1920). Formats modernes (WebP, AVIF) avec fallback JPEG. Snippet HTML copie en un clic.

### 6.3 Compression sans perte visible
Optimisation de la taille de fichier sans degradation perceptible. Analyse avant/apres : taille originale, taille optimisee, pourcentage de reduction, comparaison visuelle (slider before/after). Objectif : -60% a -80% sur les JPEG, -30% a -50% sur les PNG.

### 6.4 Thumbnails automatiques
Generation automatique de thumbnails pour chaque image uploadee dans Drive. Tailles : 64x64 (icone), 256x256 (preview), 512x512 (galerie). Crop intelligent centre sur le sujet principal (face detection ou saliency map).

### 6.5 Metadata stripping
Option de supprimer les metadonnees EXIF (localisation GPS, modele d'appareil, date de prise de vue) pour la vie privee. Affichage des metadonnees avant suppression. Choix selectif : garder la date, supprimer le GPS.

---

## Categorie 7 — Galerie et gestion media

### 7.1 Galerie d'images
Vue galerie responsive : grille de thumbnails avec lazy loading. Modes : grille carree, masonry, liste avec details. Tri par date, nom, taille, type. Filtres par format, par dimensions, par date.

### 7.2 Visionneuse plein ecran
Lightbox : navigation fleches (gauche/droite), zoom (molette/pinch), pan, diaporama automatique. Informations : nom, dimensions, taille, date. Boutons : telecharger, partager, editer, supprimer.

### 7.3 Albums et tags
Organisation par albums (dossiers virtuels). Tags multi-valeurs par image. Recherche par tag, par contenu (AI vision), par texte OCR. Albums partageables avec permissions.

### 7.4 Timeline photo
Affichage chronologique des images groupees par jour/mois/annee. Scroll infini avec lazy loading. Zoom temporel (annee → mois → jour). Similaire a Google Photos.

---

## Categorie 8 — Encodage video et audio

### 8.1 Transcodage video
Conversion entre formats : MP4, MKV, WebM, AVI, MOV, FLV. Codecs : H.264, H.265/HEVC, VP9, AV1. Options : resolution, bitrate, framerate, audio codec (AAC, Opus, MP3). Presets : web (H.264 720p), haute qualite (H.265 1080p), archive (AV1 4K).

### 8.2 Transcodage audio
Conversion entre : MP3, WAV, OGG, FLAC, AAC, M4A, OPUS, WMA. Options : bitrate, sample rate, channels (mono/stereo). Normalisation du volume. Suppression du bruit de fond.

### 8.3 Extraction de piste
Extraire la piste audio d'une video. Extraire les sous-titres embarques. Extraire un frame a un timestamp donne (screenshot video).

### 8.4 Concatenation
Assembler plusieurs fichiers audio ou video en un seul. Ordre par drag-and-drop. Transition entre les segments : coupe franche, fondu au noir, fondu enchaine.

### 8.5 Trim (decoupage)
Definir un point d'entree et un point de sortie sur la timeline. Exporter le segment selectionne sans re-encodage (si compatible) pour la vitesse. Re-encodage si changement de format.

### 8.6 Thumbnails video
Generation de thumbnails a intervalles reguliers (ex: 1 par minute). Grille de previews (sprite sheet) pour le survol de la timeline dans le lecteur video. Choix d'un thumbnail custom pour la cover.

### 8.7 Acceleration GPU
Detection automatique du GPU : NVIDIA (NVENC/NVDEC), AMD (AMF), Intel (QSV), Apple (VideoToolbox). Encodage hardware 3-10x plus rapide que le CPU. Fallback CPU transparent si pas de GPU.

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

- Upload d'une image et extraction OCR du texte
- OCR multi-pages sur un PDF scanne
- Score de confiance affiche par mot avec code couleur
- Generation de PDF searchable a partir d'un scan
- OCR de tableau avec export vers CSV
- Saisie de texte et generation audio TTS avec voix francaise
- Selection de voix differentes et preview
- Upload d'un fichier audio et transcription STT
- Transcription avec timestamps synchronises
- Diarization : identification de 2+ locuteurs
- Detection automatique de chapitres video
- Generation de sous-titres SRT/VTT
- Recadrage et rotation d'une image
- Application d'un filtre (Noir & Blanc)
- Suppression de fond (detourage)
- Redimensionnement par lot (batch resize)
- Conversion de format (PNG → WebP)
- Transcodage video (MKV → MP4 H.264)
- Extraction de piste audio depuis une video
- Trim d'une video (decoupage d'un segment)
- Integration Drive : clic droit → OCR sur un fichier
- Galerie d'images avec visionneuse plein ecran
