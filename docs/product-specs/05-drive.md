# Module Drive (gestion de fichiers) — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Google Drive** | Recherche sémantique ultra-rapide, prévisualisation universelle (100+ formats), collab native docs/sheets/slides, partage granulaire, Workspace shared drives, activity log, version history automatique, Starred/Priority/Recent/Shared views, Backup & Sync desktop, Google Workspace integration |
| **Dropbox** | Sync desktop impeccable, Smart Sync (cloud-only, pas d'espace disque), Paper, HelloSign, Dash (search), Replay (video review), transfer (envoi d'un gros fichier à un externe), extensions pour tiers (Zoom, Slack, etc.) |
| **OneDrive** | Version Microsoft 365 native, Personal Vault (zone sécurisée 2FA), Files On-Demand, PC Folder Backup, Known Folder Move, Secure Link, sharing limits |
| **Box** | Enterprise-grade, DLP, retention policies, legal hold, Box Shield, Box Governance, custom branding, workflows, Shield (ransomware detection) |
| **pCloud** | Lifetime plans, Swiss-based, encryption client-side, media player intégré, Crypto (zero-knowledge folders) |
| **Nextcloud** | Self-hosted, app ecosystem (Talk, Calendar, Mail, Deck, Office), Files, Collabora integration |
| **Sync.com** | Zero-knowledge, Canadian, affordable unlimited |
| **Tresorit** | E2E encryption, Swiss-based, enterprise compliance |
| **iCloud Drive** | Apple ecosystem integration, Optimize Storage, Family Sharing |
| **Mega** | 50 GB free, E2E encryption, large plans |
| **ProtonDrive** | E2E, zero-knowledge, privacy-focused |
| **Internxt** | Zero-knowledge, open source client |

## Principes directeurs

1. **Un seul fichier, plusieurs vues** — le même fichier doit être manipulable depuis Drive, Mail (pièce jointe), Docs (lien), Chat (partage). Pas de duplication.
2. **Recherche qui comprend le contenu** — trouver un fichier par son titre, son contenu, son auteur, son contexte, pas juste par son nom.
3. **Partage sans friction et traçable** — partager en 2 clics, révoquer en 1, savoir qui a accédé à quoi quand.
4. **Sync transparent** — les utilisateurs desktop doivent avoir leurs fichiers comme s'ils étaient locaux, sans pensée sur où ils sont réellement stockés.
5. **Collaboration temps réel** — éditer un doc/sheet/slide directement dans Drive sans télécharger/réuploader.
6. **Stockage illimité pratique** — pas de limite arbitraire pour pousser à upgrader, mais des quotas clairs par organisation.

---

## Catégorie 1 — Organisation et navigation

### 1.1 Vue hiérarchique (dossiers et sous-dossiers)
Arbre classique de dossiers. Breadcrumb en haut (`Mon drive > Projets > 2026 > Q1`). Clic pour naviguer, Backspace pour remonter. Création de dossier avec `Nouveau > Dossier` ou `Ctrl+Shift+N`.

### 1.2 Sidebar de navigation
Sidebar gauche avec :
- **Mon drive** (personnel)
- **Partagés avec moi** (accès direct)
- **Drives partagés** (drives d'équipe)
- **Récents** (10 derniers)
- **Étoilés** (favoris)
- **Importants** (marqués par l'IA)
- **Corbeille**
- **Stockage** (jauge d'utilisation)
- Sections personnalisées (dossiers épinglés)

### 1.3 Vue grille et vue liste
Toggle entre vue grille (icônes/previews larges) et vue liste (lignes avec nom, taille, modifié, propriétaire, partagé). Préférence persistante par dossier.

### 1.4 Vue galerie (pour images)
Miniatures de toutes les images d'un dossier. Clic ouvre le viewer plein écran avec navigation gauche/droite.

### 1.5 Tri et filtres
Tri par : nom (A-Z/Z-A), modifié (récent/ancien), ouvert (récent/ancien), propriétaire, taille. Filtres : par type (documents, images, vidéos, PDFs, audio, archives), par propriétaire, par date, avec/sans étoile.

### 1.6 Étoiles (favoris)
Marquer un fichier/dossier comme étoilé → accès rapide via `Étoilés`. Multiples (pas juste une étoile binaire).

### 1.7 Colors et émojis sur les dossiers
Couleur personnalisée par dossier pour identification visuelle rapide. Émoji en préfixe du nom (🎨 Design, 📊 Analytics).

### 1.8 Épingler (pin to sidebar)
Épingler un dossier dans la sidebar pour accès ultra-rapide.

### 1.9 Activité récente
Feed chronologique des actions : "Jean a modifié `Contrat.docx`", "Sarah a partagé `Budget Q1.xlsx`". Utile pour "qu'est-ce qui a changé récemment ?".

### 1.10 Récents personnel vs équipe
Onglet `Récents par moi` vs `Récents par l'équipe`. Découverte des nouveautés partagées.

### 1.11 Workspaces (collections intelligentes)
Grouper des fichiers de différents dossiers dans un "workspace" virtuel pour un projet. Les fichiers restent à leur emplacement, mais apparaissent aussi dans le workspace. Type de smart folder.

### 1.12 Spaces (grouper par contexte)
Boîtes de rangement temporaires : "Préparation Board Q2" regroupe fichiers + emails + notes + tâches. Dissoluble une fois le projet fini.

---

## Catégorie 2 — Upload et création

### 2.1 Upload par drag-drop
Glisser un ou plusieurs fichiers depuis le bureau → upload avec progress bar par fichier. Drop sur un dossier précis ou sur le fond pour le dossier courant.

### 2.2 Upload de dossier entier
Drag d'un dossier complet avec sa structure → conservation de l'arborescence. Progress par fichier.

### 2.3 Upload via bouton
Bouton `Nouveau > Téléverser un fichier` ou `Téléverser un dossier`. Dialog de sélection système.

### 2.4 Upload par URL
"Importer depuis une URL" pour cloner un fichier distant dans le drive (ex: une PDF en ligne).

### 2.5 Création directe (nouveaux fichiers)
Bouton `Nouveau` avec sous-menu :
- **Dossier**
- **Document** (ouvre Docs vide)
- **Feuille de calcul** (ouvre Sheets)
- **Présentation** (ouvre Slides)
- **Formulaire** (ouvre Forms)
- **Tableau blanc** (ouvre Whiteboard)
- **Dessin** (ouvre Draw)
- **À partir d'un modèle** → galerie de templates

### 2.6 Reprise de upload interrompu
Si la connexion tombe pendant un upload, reprise automatique au retour sans recommencer depuis zéro. Chunks uploadés de manière résumable.

### 2.7 Upload en arrière-plan
Un upload en cours ne bloque pas la navigation. Barre de progression flottante avec queue des uploads. Possibilité d'annuler ou pauser.

### 2.8 Gestion des doublons
Si un fichier du même nom existe déjà : dialog demandant `Remplacer`, `Garder les deux` (ajoute `(1)` au nom), `Skip`. Option `Appliquer à tous` pour un batch.

### 2.9 Upload d'images avec compression
Option `Compresser les images` à l'upload (JPEG optimisé). Utile pour les rapports avec beaucoup de photos.

### 2.10 Scan vers Drive (mobile)
Sur mobile, bouton `Scanner un document` utilise la caméra pour capturer une ou plusieurs pages, les traite avec OCR et crée un PDF dans le drive.

### 2.11 Limites de taille
Fichier unique jusqu'à 5 GB (configurable par plan). Warning clair si dépassement. Suggestion d'utiliser un compresseur.

---

## Catégorie 3 — Prévisualisation et viewer

### 3.1 Preview universel
Clic sur un fichier → viewer plein écran avec rendu natif :
- **Images** : JPG, PNG, GIF, SVG, WebP, BMP, TIFF, HEIC, RAW
- **Vidéos** : MP4, WebM, MOV, AVI, MKV (avec player intégré)
- **Audio** : MP3, WAV, FLAC, OGG, M4A (player + waveform)
- **Documents** : PDF, DOCX, ODT, TXT, RTF, Markdown
- **Spreadsheets** : XLSX, XLS, ODS, CSV
- **Slides** : PPTX, ODP, Keynote
- **Code** : JS, TS, PY, RS, GO, JAVA, C, CPP, HTML, CSS (avec syntax highlighting)
- **Archives** : ZIP, TAR, GZ, 7Z (liste du contenu sans extraction)
- **Web** : HTML (preview rendu)
- **Modèles 3D** : OBJ, STL, GLB (avec viewer 3D)

### 3.2 Zoom et navigation dans le viewer
Ctrl+scroll ou boutons `+/-` pour zoomer. Espace/flèches pour naviguer entre pages. Fit-to-width / Fit-to-height / Actual size.

### 3.3 Navigation entre fichiers
Flèches gauche/droite (ou `j/k`) pour passer au fichier précédent/suivant du dossier sans fermer le viewer.

### 3.4 Annotations sur PDF et images
Barre d'outils dans le viewer : surligner, commenter, dessiner, barrer. Sauvegardes annotées comme nouvelle version du fichier ou comme layer séparé.

### 3.5 Comments sur un fichier
Panneau de commentaires dans le viewer. @mention pour notifier. Thread de réponses. Résolu/non résolu.

### 3.6 Open with (ouvrir avec...)
Si le format est éditable (DOCX, XLSX, PPTX, MD), bouton `Ouvrir avec Docs/Sheets/Slides` convertit et ouvre dans l'éditeur natif SignApps. `Télécharger` pour obtenir le fichier original.

### 3.7 Preview de vidéos avec timeline
Player avec barre de progression, contrôles (play/pause/vitesse/volume/fullscreen), preview des frames au survol, sous-titres si disponibles.

### 3.8 Preview audio avec waveform
Lecteur audio avec visualisation de la waveform. Utile pour les enregistrements de réunion, podcasts.

### 3.9 Preview 3D (OBJ, STL, GLB)
Viewer 3D avec rotation, zoom, pan. Pour les modèles techniques, CAD.

### 3.10 Thumbnails auto-générés
Miniatures générées automatiquement à l'upload pour tous les formats supportés. Accélère le chargement de la vue grille.

### 3.11 Plein écran et mode présentation
Bouton `Plein écran` masque toute la UI. Mode `Présentation` pour les diaporamas (transitions automatiques, flèches pour naviguer).

### 3.12 Dark mode pour le viewer
Fond sombre pour les images et PDFs, respect du mode sombre du système.

---

## Catégorie 4 — Partage et permissions

### 4.1 Partager un fichier ou dossier
Bouton `Partager` ouvre un dialog avec deux sections : `Personnes avec accès` (liste des utilisateurs/groupes ayant accès explicite) et `Accès général` (lien public, domaine, restreint).

### 4.2 Ajout de personnes
Input avec autocomplétion (contacts, annuaire, emails externes). Rôles : `Lecteur`, `Commentateur`, `Éditeur`, `Propriétaire` (transfert). Optionnel : notification par email avec message custom.

### 4.3 Lien de partage
Générer un lien avec un niveau d'accès : `Tout le monde avec le lien peut voir/commenter/éditer`. Option de restreindre au domaine organisation. Option d'expiration.

### 4.4 Restrictions avancées
- **Expiration** : le lien expire après X jours
- **Password** : accès protégé par mot de passe
- **Watermark** : watermark avec nom du visiteur sur le preview
- **Pas de téléchargement** (lecture seule dans le viewer)
- **Pas d'impression** (désactive les options d'impression)
- **Pas de copie** (désactive Ctrl+C)
- **Nombre max de vues** (expire après N accès)

### 4.5 Transfert de propriété
Menu `Changer de propriétaire` → choix d'un autre utilisateur. Confirmation email à l'ancien et au nouveau. Le fichier passe dans le drive du nouveau propriétaire.

### 4.6 Groupes de partage
Partager avec un groupe prédéfini (`Équipe Marketing`, `Direction`, `Freelances 2026`). Ajouter/retirer des membres du groupe propage automatiquement.

### 4.7 Révocation
Retirer l'accès d'une personne en un clic. Le fichier disparaît de son drive. Notification optionnelle.

### 4.8 Audit des accès
Pour chaque fichier, voir la liste de qui a eu accès, quand, et quelles actions ont été faites (vue, édit, téléchargement, partage).

### 4.9 Request access (demande d'accès)
Si quelqu'un reçoit un lien mais n'a pas accès, bouton `Demander l'accès`. Notification au propriétaire qui peut accepter/refuser.

### 4.10 Partage avec approbation
Pour les fichiers classifiés, un manager doit approuver le partage avant qu'il devienne effectif.

### 4.11 Vérification du domaine externe
Quand on partage avec un email externe, warning `Attention, [externe] n'est pas dans votre organisation`. Double confirmation.

### 4.12 Limit des partages externes
Admin peut définir des règles : pas de partage externe sur les fichiers classifiés Confidentiel+, pas de lien public pour les dossiers HR.

---

## Catégorie 5 — Recherche

### 5.1 Recherche globale
Barre de recherche en haut. Résultats progressifs pendant la saisie, priorisés : fichiers récents matchant, puis plus anciens.

### 5.2 Syntaxe avancée
```
type:doc                 → type de fichier (doc/sheet/slide/pdf/image/video/audio/folder)
owner:jean@exemple.com  → propriétaire
to:me                    → partagé avec moi par
after:2026-01-01         → modifié après
before:2025-12-31        → modifié avant
title:"rapport Q1"       → titre exact
in:mon-dossier           → dans un dossier
sharedwith:jean          → partagé avec
label:urgent             → avec ce label
size:>10mb               → taille
```

### 5.3 Recherche full-text dans le contenu
Indexation du contenu des documents, spreadsheets, PDFs, DOCX, textes. Chercher un mot → trouve les fichiers qui le contiennent (pas juste les noms).

### 5.4 OCR sur images et PDF scannés
Les images de texte et les PDFs sans couche textuelle sont OCRisés à l'upload. Recherchables ensuite.

### 5.5 Recherche sémantique (IA)
Chercher "document sur la stratégie marketing de 2025" sans avoir les mots exacts. Le moteur comprend l'intention et retourne les fichiers pertinents.

### 5.6 Recherche par image (reverse image search)
Uploader une image → trouver les fichiers drive contenant une image similaire. Utilise des embeddings visuels.

### 5.7 Recherche par contenu d'image
"Trouver les images contenant un chat" → l'IA (vision) classifie et trouve. Tags automatiques appliqués à l'upload.

### 5.8 Filtres facettés
Panneau latéral avec les facettes de recherche : type, propriétaire, date, taille, label, dossier. Raffinement itératif.

### 5.9 Recherches sauvegardées
Transformer une recherche en dossier virtuel qui se met à jour dynamiquement. "Tous les PDFs modifiés ce mois par l'équipe marketing".

### 5.10 Historique de recherches
Accès rapide aux 10 dernières recherches.

### 5.11 Search operators visual builder
Dialog "Recherche avancée" avec tous les champs sous forme de formulaire. Génère la query correspondante.

---

## Catégorie 6 — Versioning et historique

### 6.1 Version history automatique
Chaque sauvegarde (Drive crée une version à chaque modification pour les docs natifs, ou à chaque re-upload pour les autres). Liste chronologique avec auteur, date, taille.

### 6.2 Preview d'une version antérieure
Clic sur une version → preview sans écraser la version courante. `Restaurer` copie cette version comme version courante.

### 6.3 Comparaison de versions
Diff visuel entre deux versions (texte pour les docs, valeurs pour les sheets, paragraphes pour les slides).

### 6.4 Nommage de versions (jalons)
Marquer une version comme `v1.0 publiée` pour la distinguer des auto-sauvegardes. Les versions nommées ne sont jamais supprimées.

### 6.5 Rétention de versions
Par défaut, 30 jours d'historique puis compression (garde uniquement les versions nommées et les dernières). Configurable par l'admin.

### 6.6 Rollback en un clic
Bouton `Restaurer cette version` ramène le fichier à l'état de cette version (crée une nouvelle version courante identique à l'ancienne).

### 6.7 Download d'une version spécifique
Télécharger une version ancienne sans restaurer.

---

## Catégorie 7 — Sync desktop et mobile

### 7.1 Application desktop (Windows, macOS, Linux)
App native qui crée un dossier système `~/SignApps Drive` synchronisé avec le cloud. Les fichiers apparaissent comme locaux mais sont en fait streamés du cloud (Files On-Demand).

### 7.2 Files On-Demand
Option `Libérer de l'espace` sur un fichier : reste visible mais est déchargé du disque. Clic re-télécharge. Icône indique l'état (cloud only, disponible hors-ligne, téléchargé).

### 7.3 Sync bidirectionnelle
Modifier un fichier sur le desktop → sync vers le cloud dans les secondes qui suivent. Modifier depuis le web → sync vers le desktop.

### 7.4 Resolve conflicts
Si un fichier est modifié simultanément sur deux appareils, dialog de résolution : garder les deux versions, garder la locale, garder la cloud.

### 7.5 Pause / Reprise de sync
Bouton dans la tray icon pour mettre en pause la sync (utile en tethering ou petite bande passante).

### 7.6 Bande passante throttling
Limite configurable (upload/download) pour ne pas saturer la connexion.

### 7.7 Sélectif sync
Choisir quels dossiers syncer localement. Les autres restent cloud-only.

### 7.8 Desktop pour mobile
Apps iOS et Android avec upload automatique des photos (avec dossier dédié), preview universel, offline view, share extension.

### 7.9 Photo backup automatique
Option sur mobile pour sauvegarder automatiquement les photos prises par la caméra. Compression configurable.

### 7.10 Backup PC folders
Option "Backup dossiers PC" : Documents, Images, Bureau syncés automatiquement avec le cloud. Protection contre les crash et ransomware.

---

## Catégorie 8 — Collaboration et intégrations

### 8.1 Ouverture d'un doc/sheet/slide depuis le drive
Double-clic sur un `.gdoc/.gsheet/.gslide` (ou équivalent SignApps) → ouvre dans l'éditeur natif en nouvel onglet.

### 8.2 Édition collaborative temps réel
Le même fichier peut être édité par plusieurs utilisateurs simultanément (via le module Docs/Sheets/Slides). Curseurs visibles, changements instantanés.

### 8.3 Commentaires cross-format
Commenter directement depuis le drive (sans ouvrir le fichier) sur un PDF, une image, ou un document.

### 8.4 Intégration Mail (pièces jointes drive)
Dans le module Mail, bouton `Joindre depuis Drive` au lieu de uploader. Lien intelligent avec permissions cohérentes (si le destinataire n'a pas accès, le système propose de partager).

### 8.5 Intégration Chat
Partager un fichier dans un chat SignApps → apparaît comme une carte riche (titre, icône, preview, bouton ouvrir). Modifiable en direct par les membres du chat qui ont accès.

### 8.6 Intégration Tasks
Joindre un fichier à une tâche. Ouvert depuis la tâche. Mise à jour du fichier reflétée dans la tâche.

### 8.7 Intégration Forms (réponses stockées)
Les formulaires stockent leurs soumissions (pièces jointes comprises) dans un dossier drive dédié au formulaire.

### 8.8 Webhooks et notifications API
Configurer des webhooks pour notifier un système externe quand un fichier est créé, modifié, supprimé dans un dossier. Utilisé pour les workflows externes.

### 8.9 Liaison avec un CRM/ERP
Lier un dossier drive à un contact CRM ou une opportunité. Tous les fichiers du dossier apparaissent dans la fiche du contact.

### 8.10 API REST complète
Endpoints pour lister, créer, lire, mettre à jour, supprimer des fichiers. Upload direct, téléchargement direct, gestion des permissions par API.

---

## Catégorie 9 — Sécurité et gouvernance

### 9.1 Chiffrement au repos et en transit
TLS 1.3, AES-256. Keys managed par HSM.

### 9.2 Chiffrement côté client (E2E) optionnel
Pour les dossiers marqués ultra-sensibles, chiffrement avec la clé de l'utilisateur. Serveur ne voit que des blobs chiffrés.

### 9.3 Personal Vault
Dossier spécial avec 2FA obligatoire pour y accéder. Auto-lock après 10 min d'inactivité.

### 9.4 Classification des fichiers
Public, Interne, Confidentiel, Secret. Règles automatiques (ex: pas de partage externe pour Confidentiel+).

### 9.5 Watermark automatique
Sur les fichiers classifiés, watermark visible dans le preview et les exports PDF avec nom utilisateur + horodatage.

### 9.6 Audit logs
Log immuable : qui a ouvert, édité, partagé, téléchargé, supprimé. Exportable pour conformité.

### 9.7 DLP (Data Loss Prevention)
Scan du contenu des fichiers à l'upload pour détecter les données sensibles (numéros de CB, IBAN, NISS, clés API, mots de passe). Warning et quarantaine automatique.

### 9.8 Détection de ransomware
Monitoring des patterns suspects (renommage massif, extensions exotiques). Alerte admin et rollback automatique.

### 9.9 Rétention policies
Règles par dossier : suppression automatique après X ans, archivage après X mois d'inactivité. Pour conformité RGPD/HIPAA.

### 9.10 Legal hold
Marquer un dossier/fichier en séquestre : aucune modification ni suppression possible, même par le propriétaire, jusqu'à levée admin.

### 9.11 Virus scan
Scan antivirus automatique à l'upload (ClamAV ou équivalent). Fichiers infectés mis en quarantaine.

### 9.12 Révocation à distance
Si un device est perdu, révoquer les sessions et les caches locaux à distance.

---

## Catégorie 10 — IA intégrée

### 10.1 Suggestions de classement
L'IA suggère dans quel dossier ranger un nouveau fichier en se basant sur le nom, le contenu, et l'historique.

### 10.2 Auto-tagging
Tags automatiques appliqués aux fichiers (projet, client, type de document) basés sur le contenu et les métadonnées.

### 10.3 Résumé de fichier
Clic droit `Résumer avec IA` → résumé de 3 phrases du contenu du document/sheet/PDF. Pratique pour savoir si un fichier vaut la peine d'être ouvert.

### 10.4 Extraction de données
Pour un PDF scanné (facture, contrat), l'IA extrait automatiquement : fournisseur, montant, date, numéro. Ajoute ces infos comme métadonnées.

### 10.5 Q&A sur un fichier ou un dossier
Panneau `Ask AI` : "Quel est le montant total des factures du dossier Fournisseurs ?". L'IA traverse les fichiers et répond.

### 10.6 Dédoublonnage intelligent
Détection des fichiers identiques (hash) et similaires (contenu proche). Suggestion de dédoublonnage avec merge des partages.

### 10.7 Traduction de documents
Bouton `Traduire` sur un fichier → crée une copie traduite dans la langue choisie, mise en forme préservée.

### 10.8 OCR et extraction de texte
Pour les images et PDFs scannés : OCR automatique à l'upload, texte devient recherchable.

### 10.9 Détection de doublons visuels
Les images sont comparées visuellement pour trouver des doublons même si les fichiers diffèrent (ex: même photo en JPG et PNG).

### 10.10 Suggestions de partage
"Vous avez créé un fichier dans `Projets/Client A` — vouloir le partager avec l'équipe projet habituelle ?". Suggestion basée sur l'historique des partages similaires.

---

## Catégorie 11 — Performance et accessibilité

### 11.1 Virtualisation des listes
Dossier avec 10 000 fichiers scrolle fluidement. Seules les lignes visibles sont rendues.

### 11.2 Indexation asynchrone
L'upload retourne immédiatement, l'indexation (OCR, thumbnails, full-text) se fait en arrière-plan. Status `Indexation en cours`.

### 11.3 Streaming de vidéos lourdes
Les vidéos sont streamées (pas téléchargées en entier). Seek instantané avec segments HLS/DASH.

### 11.4 Compression et CDN
Images et vidéos servies via CDN avec variantes (thumbnail, medium, original) pour réduire la bande passante.

### 11.5 Offline mode mobile
Accès aux fichiers "pinned" hors-ligne. Édition queuée et syncée au retour.

### 11.6 Keyboard shortcuts
- `n` : nouveau fichier
- `N` : nouveau dossier
- `/` : recherche
- `j/k` ou flèches : navigation
- `Enter` : ouvrir
- `Delete` : supprimer
- `Ctrl+C/V/X` : copier/coller/couper
- `Ctrl+Z` : undo
- `s` : étoile
- `r` : renommer
- `m` : déplacer
- `p` : partager
- `?` : aide

### 11.7 Accessibilité WCAG AA
Navigation clavier complète, lecteur d'écran, contrastes AA.

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **Google Drive Help** (support.google.com/drive) — partage, recherche, storage, sync.
- **Dropbox Help** (help.dropbox.com) — Smart Sync, Paper, HelloSign, integrations.
- **OneDrive Support** (support.microsoft.com/onedrive) — Personal Vault, Files On-Demand.
- **Box Help** (support.box.com) — Governance, Shield, workflows.
- **Nextcloud Docs** (docs.nextcloud.com) — self-hosting, apps, federation.
- **pCloud Help** (pcloud.com/help) — Crypto folder, Lifetime plans.
- **iCloud Drive Support** (support.apple.com/icloud) — Family Sharing.

### Projets open source permissifs
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **Nextcloud** | **AGPL v3** | **INTERDIT comme code**. Étudier uniquement via docs et démos publiques. |
| **ownCloud** | **AGPL v3** | **INTERDIT**. |
| **Seafile Community** | **GPL v3** | **INTERDIT**. |
| **MinIO** (min.io, github.com/minio/minio) | **AGPL v3** | **INTERDIT**. Alternative : S3 protocole direct avec lib permissive. |
| **rclone** (rclone.org) | **MIT** | Excellent pour la sync multi-backend (S3, Dropbox, Google Drive, OneDrive, etc.). Utilisable en dépendance. |
| **Gokapi** (github.com/forceu/gokapi) | **GPL v3** | **INTERDIT**. File sharing simple. |
| **Filebrowser** (filebrowser.org) | **Apache-2.0** | File manager web simple. Pattern pour la UI de navigation. |
| **Pydio Cells** | **AGPL v3** | **INTERDIT**. |
| **File.io** | API propriétaire | Pattern de temporary sharing. |
| **opendal** (github.com/apache/opendal) | **Apache-2.0** | Data access layer unifié pour multi-backend (S3, fs, Azure, GCS, Dropbox, etc.). Déjà utilisé par SignApps. |
| **react-dropzone** (react-dropzone.js.org) | **MIT** | Upload par drag-drop. Standard. |
| **tus.io / tus-js-client** (tus.io) | **MIT** | Protocole d'upload résumable. Pour les gros fichiers. |
| **PDF.js** (mozilla.github.io/pdf.js) | **Apache-2.0** | Viewer PDF dans le navigateur. Standard. |
| **DOCX.js / docx-preview** (github.com/volodalexey/simple-docx-preview) | **MIT** | Preview de DOCX dans le navigateur. |
| **mammoth.js** (github.com/mwilliamson/mammoth.js) | **BSD-2-Clause** | Conversion DOCX → HTML pour preview. |
| **SheetJS** (sheetjs.com) | **Apache-2.0** | Preview XLSX. |
| **Video.js** (videojs.com) | **Apache-2.0** | Player vidéo web. |
| **howler.js** (howlerjs.com) | **MIT** | Player audio web. |
| **ffmpeg.wasm** (ffmpegwasm.netlify.app) | **LGPL v2.1+** | **Attention weak copyleft**. OK en dynamic linking (le wasm est chargé à runtime). Pour la conversion de vidéos côté client. Alternative : processing côté serveur avec ffmpeg. |
| **three.js** (threejs.org) | **MIT** | Viewer 3D pour les OBJ/STL/GLB. |
| **ag-grid Community** (ag-grid.com) | **MIT** | Grid pour la vue liste de fichiers. |
| **ClamAV** (clamav.net) | **GPL v2** | **INTERDIT comme lib**, mais utilisable comme daemon externe en dépendance système. |
| **yara-rs** | **MIT** | Alternative pour la détection de patterns (malware, ransomware). |
| **Tantivy** (github.com/quickwit-oss/tantivy) | **MIT** | Moteur de recherche full-text Rust. Pour l'indexation des contenus. |
| **MeiliSearch** (meilisearch.com) | **MIT** | Moteur de recherche instantanée. Alternative à Tantivy. |
| **Tesseract.js** (github.com/naptha/tesseract.js) | **Apache-2.0** | OCR côté client/server. Pour l'extraction de texte des images. |

### Pattern d'implémentation recommandé
1. **Stockage backend** : SignApps utilise déjà OpenDAL (Apache-2.0) pour abstraction multi-backend. Continuer.
2. **Upload résumable** : protocole `tus` (MIT) pour les gros fichiers. `tus-js-client` côté client.
3. **Sync desktop** : inspiration rclone (MIT). Peut être un wrapper autour de rclone en binary externe, ou réimplémenté en Rust avec `opendal`.
4. **Preview PDF** : PDF.js (Apache-2.0) côté client. Pas de processing serveur nécessaire.
5. **Preview DOCX/XLSX/PPTX** : `mammoth.js` + `SheetJS` + conversion vers images pour PPTX.
6. **Preview vidéo/audio** : Video.js (Apache-2.0) et howler.js (MIT). Streaming HLS avec `hls.js` (Apache-2.0).
7. **3D preview** : three.js (MIT) + loaders pour OBJ/STL/GLB.
8. **Search backend** : Tantivy (MIT) pour l'indexation full-text, ou MeiliSearch (MIT) si on veut un service dédié.
9. **OCR** : Tesseract.js (Apache-2.0) en webworker ou service dédié. Alternative : appels à un service externe (Google Vision, AWS Textract) via connecteur.
10. **Thumbnail generation** : `image-rs` (MIT/Apache-2.0) côté Rust pour générer des thumbnails d'images. `ffmpeg` (externe, LGPL dynamic) pour les vidéos.
11. **Antivirus** : ClamAV daemon (GPL en binary externe, OK — pas de linkage). Alternative permissive : pas de scan AV ou service tiers.

### Ce qu'il ne faut PAS faire
- **Pas de copie de code** depuis Nextcloud, ownCloud, Seafile (AGPL/GPL).
- **Pas de dépendance compilée** sur ffmpeg statiquement (GPL si full-version). OK en dynamic linking ou binary externe.
- **Pas de processing serveur** des documents sensibles sans chiffrement — utiliser des sandboxes.

---

## Assertions E2E clés (à tester)

- Upload par drag-drop d'un ou plusieurs fichiers
- Upload d'un dossier entier avec hiérarchie préservée
- Reprise d'upload après perte de connexion
- Création d'un dossier, renommage, suppression
- Navigation dans l'arborescence avec breadcrumb
- Vue grille / vue liste toggle
- Tri par nom/date/taille
- Recherche rapide avec opérateurs
- Preview universel (image, PDF, vidéo, audio, docx, xlsx)
- Partage avec email + rôle (Lecteur/Éditeur/Commentateur)
- Partage par lien avec restriction (domain/expiration/password)
- Révocation d'accès
- Version history avec restore
- Étoile (favori) et filtrage par étoilés
- Corbeille : déplacement, restauration, vidage
- Drag-drop pour déplacer un fichier entre dossiers
- Copier/coller (Ctrl+C, Ctrl+V)
- Ouvrir un doc dans l'éditeur natif
- Commentaires sur un fichier
- OCR sur PDF scanné
- Recherche full-text dans le contenu
- Download d'un fichier ou dossier (zip)
- Upload avec duplicata détecté
- Keyboard shortcuts (n, N, r, m, p, /, Delete, etc.)
