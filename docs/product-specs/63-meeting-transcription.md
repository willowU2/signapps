# Module Meeting Transcription — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Otter.ai** | Transcription temps réel avec speaker identification automatique, résumés structurés (outline/key takeaways/action items), vocabulaire custom par équipe, intégration Zoom/Teams/Meet avec bot qui rejoint automatiquement, recherche full-text sur tout l'historique, commentaires et highlights inline, export vers Salesforce/HubSpot, OtterPilot autonome, partage de transcriptions avec équipes |
| **Fireflies.ai** | Bot fantôme qui rejoint les meetings automatiquement (Zoom/Teams/Meet/Webex), détection AI de topics/sentiments/questions, AskFred (chat conversationnel sur le contenu des meetings passés), soundbites (clips audio partageables), conversation intelligence analytics (talk-time ratio, monologues), intégration CRM auto-fill, résumés multi-templates (action items, notes, short summary) |
| **tl;dv** | Enregistrement gratuit illimité, timestamps automatiques avec detection de moments clés, résumés AI multi-langues (30+ langues), meeting notes templates personnalisables, speaker analytics (qui parle combien), intégration Notion/Slack/CRM, recurring meeting insights, filtrage par speaker dans la recherche |
| **Grain** | Découpage automatique en moments clés (highlights), partage de clips vidéo/audio avec timestamp, playlists de moments thématiques, coaching insights (analyse de patterns de communication), intégration HubSpot/Salesforce/Slack, recherche dans les clips, summary AI structuré |
| **Tome (Parakeet)** | Application desktop locale, capture audio système (pas de bot dans le meeting), transcription 100% locale via Parakeet/Whisper, privacy-first (aucune donnée cloud), diarization locale, modèles téléchargés au premier lancement, overlay compact pendant la capture, export Markdown |
| **Whisper (OpenAI)** | Open source (MIT), multilingue (99 langues), word-level timestamps, modèles de tailles variées (tiny 39M à large 1.5B), exécution locale complète, Faster-Whisper (CTranslate2) pour 4x speedup, whisper.cpp pour CPU-only, fine-tuning possible, robustesse au bruit |
| **Microsoft Teams Transcription** | Transcription live intégrée nativement dans Teams, attribution automatique des speakers aux participants du meeting, résumés Copilot post-meeting (action items, décisions, follow-ups), chapitrage intelligent, recherche dans les transcriptions depuis le hub Teams, traduction simultanée en 30+ langues |
| **Google Meet Transcription** | Transcription automatique enregistrée dans Google Docs, attribution des speakers aux participants Google, intégration Drive native (dossier auto), résumé Gemini (take notes for me), traduction live des sous-titres, indexation dans Google Search/Drive |
| **Zoom AI Companion** | Résumé intelligent post-meeting (summary, next steps, smart chapters), transcription live avec speaker identification, détection de questions non répondues, composition d'emails de suivi, intégration native au recording cloud Zoom, smart chapters dans la timeline du recording |
| **Rev.ai** | API robuste de transcription (streaming + async), diarization haute précision, vocabulaire custom, ponctuation automatique, dual-channel processing (pour calls téléphoniques), latence <300ms en streaming, topic detection, sentiment analysis, SLA enterprise |
| **Descript** | Édition audio/vidéo par le texte (supprimer un mot dans la transcription supprime l'audio correspondant), overdub (voix synthétique), filler word removal automatique, studio sound enhancement, multitrack editing, collaboration temps réel sur les transcriptions, chapitrage auto |
| **AssemblyAI** | API-first, LeMUR (LLM sur les transcriptions — résumé, Q&A, action items), PII redaction automatique, détection de topics/entités/sentiments, custom vocabulary, real-time streaming, speaker labels, dual channel, content moderation |
| **Tactiq** | Extension Chrome légère, transcription live de Google Meet/Zoom/Teams sans bot, templates de notes de meeting personnalisables, détection d'action items, partage via lien, intégration Notion/Google Docs, fonctionnement hors-ligne partiel |
| **Krisp** | Noise cancellation AI (supprime bruits de fond des deux côtés), transcription locale desktop, meeting notes auto-générées, speaker timeline, accent du locuteur non altéré, fonctionne avec toute app de visio (capture audio système), privacy-first (processing local) |

## Principes directeurs

1. **Local-first privacy** — Tout le traitement audio (STT, diarization, résumé) s'exécute localement sur le serveur ou le poste client Tauri. Aucun flux audio n'est envoyé vers un service cloud tiers. Les modèles sont téléchargés une seule fois puis cachés localement. Les transcriptions restent dans la base de données PostgreSQL de l'organisation.
2. **Multi-pipeline unifié** — Trois pipelines de transcription (Meet interne, capture audio externe, mémo vocal) produisent le même `TranscriptionResult` unifié. Le format de sortie, le modèle de données et l'intégration docs sont identiques quel que soit la source. Cela garantit une expérience cohérente et un code de stockage/recherche/export unique.
3. **Diarization intelligente hybride** — Pour les meetings internes SignApps Meet, la diarization exploite les flux LiveKit séparés par participant (attribution directe track → user_id → display_name, sans ML). Pour les captures externes, la diarization utilise pyannote.audio en sidecar Python. Fallback gracieux si pyannote n'est pas installé : transcription sans identification des speakers, avec avertissement dans le document.
4. **Document structuré natif (Tiptap)** — Chaque transcription génère un document Tiptap éditable avec des extensions custom (`transcriptMeta` pour les métadonnées, `transcriptSegment` pour chaque intervention). Le document est placé dans le Drive, indexé dans la recherche globale, et entièrement modifiable après création. Les timestamps sont cliquables pour naviguer dans l'audio source.
5. **Recherche full-text cross-transcriptions** — Toutes les transcriptions sont indexées dans `global_search_index` via le mécanisme existant de signapps-docs. La recherche permet de retrouver un mot ou une phrase prononcée dans n'importe quel meeting passé, avec highlighting du segment correspondant et navigation directe au timestamp.
6. **Accessibilité WCAG AA** — Tous les composants UI (overlay de capture, document de transcription, lecteur audio) respectent les standards WCAG 2.1 AA. Navigation clavier complète, labels ARIA sur tous les contrôles interactifs, contrastes suffisants (ratio 4.5:1 minimum), respect du mode high-contrast, lecteur d'écran compatible avec les segments de transcription.

---

## Catégorie 1 — Pipeline de transcription

### 1.1 Pipeline post-meeting Meet (MeetPipeline)
Lorsqu'une session SignApps Meet se termine avec un enregistrement (`meet.session.ended` via PgEventBus), le pipeline s'active automatiquement. Il exécute 5 étapes séquentielles : fetch des métadonnées de l'enregistrement, récupération de l'audio depuis signapps-storage, transcription via `SttBackend`, construction du `TranscriptionResult` avec diarization par tracks LiveKit, et création du document Tiptap via `POST /api/v1/docs`. Le job est tracké dans `meet.transcription_jobs` avec les statuts `pending → processing → completed → failed`.

### 1.2 Pipeline capture externe (CapturePipeline)
Pour les meetings sur des plateformes tierces (Zoom, Teams, Google Meet), le pipeline Tauri desktop capture l'audio système (micro + sortie son), transcrit localement via whisper-rs embarqué, diarise via le sidecar pyannote, puis POST le `TranscriptionResult` vers `signapps-media` qui crée le document Tiptap. Le résultat est identique au pipeline Meet : même document, même indexation, même recherche.

### 1.3 Pipeline mémo vocal (VoiceMemo)
Un mode simplifié pour les notes vocales individuelles. L'utilisateur enregistre depuis l'app desktop ou mobile, la transcription s'exécute localement, et un document Tiptap mono-speaker est créé. Pas de diarization (un seul locuteur). Durée limitée à 30 minutes par défaut (configurable par l'admin).

### 1.4 Moteur STT pluggable (SttBackend)
Le moteur de transcription est abstrait via le trait `SttBackend`. Deux implémentations : whisper-rs natif (défaut desktop, feature `native-stt`) et Faster-Whisper HTTP (fallback serveur). Le choix est configurable par environnement (`STT_BACKEND=native|http`). Les modèles Whisper sont téléchargés automatiquement au premier usage dans `MODELS_DIR` et cachés pour les usages suivants.

### 1.5 Sélection du modèle Whisper
L'administrateur peut choisir la taille du modèle Whisper (tiny, base, small, medium, large-v3) via les paramètres d'administration. Le choix impacte la précision vs la vitesse : tiny transcrit 10x plus vite mais avec plus d'erreurs, large-v3 offre la meilleure qualité mais nécessite un GPU. Le modèle par défaut est `small` (bon compromis précision/performance sur CPU).

### 1.6 Détection automatique de la langue
Whisper détecte automatiquement la langue parlée dans les 30 premières secondes. La langue détectée est stockée dans `SessionMeta.language` et affichée dans le bandeau `transcriptMeta` du document. L'utilisateur peut forcer une langue spécifique via l'UI ou l'API (`language=fr`) pour améliorer la précision quand la langue est connue à l'avance.

### 1.7 Gestion des erreurs et retry
Si une étape du pipeline échoue, le job passe en status `failed` avec le message d'erreur dans `error_message`. L'utilisateur peut relancer manuellement la transcription depuis l'UI. Un mécanisme de retry automatique est configurable (max 3 tentatives, backoff exponentiel). Les erreurs sont tracées via `tracing::error!` avec le recording_id pour diagnostic.

### 1.8 File d'attente et priorités
Les jobs de transcription sont traités dans une file FIFO (PostgreSQL `SKIP LOCKED`). Les transcriptions de meetings courts (<15 min) sont prioritaires sur les longs meetings pour garantir un temps de réponse rapide. La concurrence est configurable (`TRANSCRIPTION_WORKERS=2` par défaut). Un compteur de jobs en attente est visible dans l'UI d'administration.

### 1.9 Formats audio supportés
Le pipeline accepte les formats audio via symphonia : WAV, MP3, OGG/Opus, FLAC, AAC, WebM/Opus. L'audio est normalisé en PCM 16kHz mono avant envoi au moteur STT. La conversion est transparente pour l'utilisateur. Les fichiers audio uploadés manuellement (import) suivent le même chemin.

### 1.10 Transcription par import de fichier audio
En plus des pipelines automatiques, l'utilisateur peut uploader un fichier audio (ou vidéo dont l'audio est extrait) pour transcription. L'upload se fait via l'UI web (drag & drop ou sélection de fichier). Le fichier est stocké dans signapps-storage puis traité par le pipeline standard. Limite de taille configurable (500 Mo par défaut).

---

## Catégorie 2 — Capture audio externe (Tauri desktop)

### 2.1 Capture dual-stream
Le module Tauri capture simultanément deux flux audio : le microphone de l'utilisateur et l'audio système (sortie son de l'application de visioconférence). Les deux flux sont mixés en un seul fichier PCM 16kHz mono pour la transcription. L'utilisateur peut choisir de capturer uniquement le micro, uniquement le système, ou les deux.

### 2.2 Backend WASAPI (Windows)
Sur Windows, la capture audio système utilise WASAPI en mode loopback via le crate `cpal` + l'API `windows`. Ce mécanisme capture l'audio de n'importe quelle application sans nécessiter de driver virtuel. Le loopback WASAPI est standard sur Windows 10+ et ne requiert aucune installation supplémentaire.

### 2.3 Backend CoreAudio (macOS)
Sur macOS, la capture utilise `coreaudio-rs` avec ScreenCaptureKit audio tap (macOS 13+). Cette API native permet de capturer l'audio d'une application spécifique sans autorisation micro séparée (seule l'autorisation Screen Recording est requise). Fallback vers BlackHole (driver virtuel audio) sur macOS 12.

### 2.4 Backend PulseAudio (Linux)
Sur Linux, la capture utilise `cpal` avec PulseAudio monitor source. La source monitor permet de capturer l'audio de sortie de n'importe quelle application. Compatible PipeWire (qui émule PulseAudio). L'utilisateur peut sélectionner une source spécifique dans la liste des sinks PulseAudio.

### 2.5 Détection automatique de l'application de conférence
Au démarrage de la capture, le module détecte automatiquement l'application de visioconférence active (Zoom, Teams, Google Meet via Chrome, Webex, Slack Huddle). Le nom de l'application est stocké dans `SessionMeta.source_app` et affiché dans le document. La détection se fait par enumération des fenêtres actives et matching sur les noms de processus connus.

### 2.6 Filtrage par source audio
L'utilisateur peut filtrer la capture pour ne capturer que l'audio d'une application spécifique (pas tout l'audio système). Le champ `CaptureConfig.source_filter` permet de spécifier le nom ou l'ID de la source audio. Sur macOS (ScreenCaptureKit) et Windows (WASAPI per-process), le filtrage par application est natif. Sur Linux, le filtrage se fait par sink PulseAudio.

### 2.7 Voice Activity Detection (VAD)
Le module VAD détecte les segments de parole et les segments de silence par analyse de l'énergie RMS du signal audio. Le seuil est configurable (`DEFAULT_RMS_THRESHOLD = 500.0`). Les segments de silence sont marqués pour optimiser la transcription (Whisper ignore les chunks silencieux). Le VAD est utilisé aussi pour l'auto-stop après timeout de silence.

### 2.8 Auto-stop sur silence prolongé
Si aucune parole n'est détectée pendant 120 secondes (configurable via `CaptureConfig.silence_timeout_secs`), la capture s'arrête automatiquement. L'utilisateur est notifié par une notification système. Cela évite de capturer des heures de silence si l'utilisateur oublie d'arrêter la capture manuellement.

### 2.9 Overlay compact de capture
Pendant la capture, un overlay flottant s'affiche toujours au premier plan. Il montre : l'indicateur d'enregistrement (point rouge pulsant), le compteur de durée, le nom de l'application capturée, une waveform RMS temps réel, et les boutons Pause/Stop. L'overlay est minimaliste pour ne pas gêner la visioconférence. Il peut être déplacé et redimensionné.

### 2.10 Menu system tray
Un icône dans le system tray (zone de notification) permet d'accéder rapidement aux fonctions de transcription : démarrer une capture, voir les captures en cours, accéder aux transcriptions récentes. Le menu affiche aussi le statut du moteur STT (modèle chargé, GPU disponible).

### 2.11 Raccourci global configurable
Un raccourci clavier global (par défaut `Ctrl+Shift+T`) permet de démarrer/arrêter la capture audio depuis n'importe quelle application. Le raccourci est configurable dans les préférences Tauri. L'appui affiche brièvement l'overlay puis le masque si la capture est en cours.

### 2.12 Conversion en WAV pour Whisper
Le module `AudioBuffer::to_wav_bytes()` convertit le buffer PCM capturé en fichier WAV valide (header RIFF + données PCM 16-bit signed mono) pour ingestion par le moteur Whisper. La conversion est zero-copy quand possible. Le format WAV est le format natif attendu par whisper-rs.

---

## Catégorie 3 — Diarization et identification des speakers

### 3.1 Diarization par tracks LiveKit (meetings internes)
Pour les meetings SignApps Meet, chaque participant a un track audio identifié dans LiveKit. L'attribution speaker se fait par correspondance directe `track.participant_identity → users.username → persons.display_name`. Aucun modèle ML n'est nécessaire : la diarization est déterministe et 100% précise. Les speakers sont pré-remplis avec les vrais noms des participants.

### 3.2 Diarization pyannote (captures externes)
Pour les captures audio externes, la diarization utilise le sidecar Python `scripts/pyannote-sidecar/diarize.py`. Le modèle `pyannote/speaker-diarization-3.1` (~80 Mo, licence MIT) est téléchargé au premier lancement. L'exécution est post-session uniquement (pas de streaming). La communication se fait via stdin/stdout JSON. Les speakers sont labellisés "Speaker 1", "Speaker 2", etc.

### 3.3 Renommage des speakers dans l'UI
Après la transcription, l'utilisateur peut cliquer sur un label "Speaker 1" dans le document Tiptap pour le renommer. Un dropdown propose les contacts de l'annuaire SignApps avec autocomplétion. Le renommage se propage à tous les segments du même speaker dans le document. L'association speaker ↔ contact est mémorisée pour les futures transcriptions du même interlocuteur.

### 3.4 Fallback sans diarization
Si pyannote n'est pas installé (Python absent ou dépendances manquantes), la transcription est générée sans identification des speakers. Un avertissement est ajouté en tête du document Tiptap : "Diarization non disponible — tous les segments sont attribués à un speaker unique." La transcription reste fonctionnelle et le texte est correct, seule l'attribution est absente.

### 3.5 Nombre de speakers détectés
Le nombre de speakers détectés est stocké dans `transcription_jobs.speaker_count` et affiché dans le bandeau `transcriptMeta`. Pour pyannote, le nombre est déterminé automatiquement (pas de paramètre obligatoire). L'utilisateur peut fournir un indice (`expected_speakers=3`) pour améliorer la précision de la segmentation.

### 3.6 Fusion de segments adjacents du même speaker
Les segments consécutifs attribués au même speaker et séparés par moins de 2 secondes de silence sont fusionnés en un seul segment. Cela produit des paragraphes de parole cohérents plutôt qu'une succession de phrases courtes. Le seuil de fusion est configurable.

### 3.7 Empreinte vocale et apprentissage
Pour les speakers renommés manuellement, le système peut optionnellement stocker une empreinte vocale (embedding pyannote) associée au contact. Lors des futures transcriptions, les speakers sont automatiquement identifiés par similarité d'embedding. Cette fonctionnalité est opt-in et désactivable par l'admin pour raisons de privacy.

### 3.8 Timeline des speakers
Le document Tiptap inclut une visualisation timeline des interventions par speaker : une barre horizontale colorée par speaker montrant quand chacun a parlé. Cela donne une vue d'ensemble rapide de la dynamique de la réunion (qui a dominé la conversation, y a-t-il eu des échanges équilibrés).

### 3.9 Statistiques par speaker
Pour chaque speaker, le système calcule : le temps de parole total, le pourcentage du temps total, le nombre d'interventions, la durée moyenne d'une intervention. Ces statistiques sont affichées dans un panneau latéral du document de transcription et servent pour les analytics de réunion (conversation intelligence).

### 3.10 Détection de chevauchements (overlapping speech)
Le moteur de diarization détecte les moments où plusieurs speakers parlent en même temps. Ces segments sont marqués visuellement dans le document (icône de chevauchement). La transcription de ces passages est moins fiable, ce qui est indiqué par un score de confiance plus bas et un indicateur visuel dans le segment.

---

## Catégorie 4 — Document de transcription (Tiptap)

### 4.1 Extension transcriptMeta
Le noeud Tiptap `transcriptMeta` est un bloc atomique en tête du document. Il affiche un bandeau avec : la durée totale de la transcription (format `HH:MM:SS`), la source (Meet/External/Memo), la liste des speakers avec badges colorés, la langue détectée. Le composant React `TranscriptMetaView` rend ce bandeau avec une mise en page card responsive.

### 4.2 Extension transcriptSegment
Le noeud Tiptap `transcriptSegment` est un bloc avec contenu inline. Chaque segment affiche : un avatar/badge du speaker (couleur attribuée), le timestamp cliquable (format `MM:SS` ou `HH:MM:SS`), et le texte transcrit éditable. Le clic sur le timestamp navigue vers la position correspondante dans le lecteur audio intégré.

### 4.3 Lecteur audio intégré
Le document de transcription inclut un lecteur audio en haut de page (ou flottant en bas). Le lecteur est synchronisé avec le texte : lorsque l'audio joue, le segment courant est surligne (highlight). Le clic sur un timestamp dans le texte positionne le curseur audio au bon endroit. Contrôles : play/pause, vitesse (0.5x à 2x), avance/recul 10s.

### 4.4 Surlignage du segment actif
Pendant la lecture audio, le segment correspondant au timestamp courant est visuellement mis en évidence (background légèrement teinté, bordure gauche colorée). Le scroll automatique suit le segment actif. L'utilisateur peut désactiver le scroll automatique pour lire à son rythme tout en écoutant.

### 4.5 Titre automatique du document
Le titre du document est généré automatiquement selon la source : "Réunion — 13 avril 2026, 14:30" pour Meet, "Zoom — 13 avril 2026, 14:30" pour une capture externe (avec le nom de l'app), "Mémo vocal — 13 avril 2026, 14:30" pour un mémo. Le titre est éditable par l'utilisateur.

### 4.6 Placement automatique dans le Drive
Le document de transcription est automatiquement placé dans un dossier "Transcriptions" du Drive de l'utilisateur. Le dossier est créé automatiquement s'il n'existe pas. L'organisation peut configurer un dossier partagé pour toutes les transcriptions d'équipe. Le document peut être déplacé manuellement après création.

### 4.7 Type de document "transcript"
Le document est créé avec `type: "transcript"` dans signapps-docs, ce qui permet de le filtrer dans le Drive et la recherche. L'icône du document dans le Drive est distincte (icône micro/transcription) pour le différencier des documents texte classiques. Le type permet aussi d'appliquer des templates d'affichage spécifiques.

### 4.8 Métadonnées enrichies
Le document stocke des métadonnées supplémentaires dans un champ JSON : `recording_id`, `room_id` (pour les meetings Meet), langue, nombre de speakers, nombre de segments, durée, score de confiance moyen. Ces métadonnées sont utilisées pour le tri, le filtrage et les analytics.

### 4.9 Édition libre post-transcription
Le document de transcription est entièrement éditable après création. L'utilisateur peut corriger les erreurs de transcription, ajouter des notes, reformuler des passages, insérer des headings pour structurer. Les modifications sont versionnées via le mécanisme de versioning standard de signapps-docs. L'historique des modifications est accessible.

### 4.10 Collaboration temps réel sur la transcription
Plusieurs utilisateurs peuvent éditer simultanément le document de transcription via Yjs/CRDT (mécanisme existant de signapps-docs/collab). Les curseurs des collaborateurs sont visibles. Les corrections de transcription sont ainsi réparties entre les participants du meeting.

### 4.11 Insertion de commentaires et annotations
Les utilisateurs peuvent ajouter des commentaires inline sur des segments spécifiques (fonctionnalité existante de l'éditeur Tiptap). Les commentaires sont visibles par tous les collaborateurs et peuvent être résolus. Utile pour marquer des points d'action, des questions, ou des désaccords sur la transcription.

### 4.12 Score de confiance visuel
Chaque segment affiche un indicateur visuel du score de confiance de la transcription. Les segments à faible confiance (<0.7) sont marqués avec un fond légèrement orangé et une icône d'avertissement, incitant l'utilisateur à vérifier et corriger manuellement. Le score provient du `avg_logprob` de Whisper.

---

## Catégorie 5 — Recherche et navigation dans les transcriptions

### 5.1 Indexation full-text automatique
Chaque document de transcription est automatiquement indexé dans `global_search_index` lors de sa création, via le mécanisme existant de signapps-docs. Le texte brut de tous les segments est indexé, ainsi que les métadonnées (speakers, date, source, langue). La mise à jour de l'index est incrémentale lors des éditions.

### 5.2 Recherche par mot ou phrase dans toutes les transcriptions
L'utilisateur peut rechercher un mot ou une phrase dans l'ensemble des transcriptions passées via la barre de recherche globale. Les résultats affichent le segment correspondant avec highlighting, le nom du meeting, la date, le speaker, et le timestamp. Le clic navigue directement au segment dans le document.

### 5.3 Filtrage par speaker
La recherche permet de filtrer les résultats par speaker : "Montrer uniquement ce que Pierre Durand a dit." Le filtre s'applique sur le champ `speaker` des segments. Combinable avec la recherche textuelle pour trouver "quand Pierre a parlé de budget".

### 5.4 Filtrage par date et période
Recherche filtrée par période : "Transcriptions de la semaine dernière", "Meetings du mois de mars". Le filtre s'applique sur `SessionMeta.created_at`. Combinable avec d'autres filtres (speaker, mot-clé, source).

### 5.5 Filtrage par source
L'utilisateur peut filtrer les transcriptions par source : Meet uniquement, captures externes uniquement, mémos vocaux uniquement. Le filtre s'applique sur `SessionMeta.source`. Utile pour retrouver une capture Zoom spécifique parmi de nombreuses transcriptions de meetings internes.

### 5.6 Navigation par timestamps dans les résultats
Chaque résultat de recherche affiche le timestamp du segment correspondant. Le clic ouvre le document de transcription positionné sur le segment et, si l'audio est disponible, positionne le lecteur audio au bon timestamp. La navigation est directe : un clic suffit pour retrouver le contexte complet.

### 5.7 Recherche sémantique (vecteurs)
En complément de la recherche full-text, une recherche sémantique par similarité vectorielle (pgvector 384d via `VectorRepository` existant) permet de retrouver des segments par sens plutôt que par mots exacts. Requête exemple : "discussion sur la stratégie commerciale" retrouve des segments mentionnant "plan de vente", "objectifs chiffre d'affaires", etc.

### 5.8 Suggestions de recherche
La barre de recherche propose des suggestions basées sur les speakers fréquents, les topics récents et les mots-clés les plus mentionnés dans les transcriptions. Les suggestions sont générées par analyse statistique des documents indexés (TF-IDF sur les segments).

### 5.9 Vue liste des transcriptions
Une page dédiée `/transcriptions` affiche la liste de toutes les transcriptions de l'utilisateur, triées par date (plus récentes en premier). Chaque entrée montre : titre, date, durée, nombre de speakers, source (icône), aperçu du premier paragraphe. Pagination infinie avec chargement progressif.

### 5.10 Recherche dans un document unique
À l'intérieur d'un document de transcription, `Ctrl+F` active une barre de recherche locale qui highlight les occurrences dans le document et permet de naviguer entre elles (previous/next). Le nombre d'occurrences est affiché. La recherche locale est instantanée (côté client, pas de requête serveur).

---

## Catégorie 6 — Édition et correction post-transcription

### 6.1 Correction inline du texte
L'utilisateur clique sur un segment pour éditer le texte directement dans le document Tiptap. Les corrections sont sauvegardées automatiquement via le mécanisme d'auto-save existant. L'audio original reste inchangé : seul le texte de la transcription est modifié. Les corrections sont prises en compte dans l'index de recherche.

### 6.2 Remplacement global (find & replace)
Fonction chercher-remplacer (`Ctrl+H`) pour corriger un mot mal transcrit systématiquement (ex: un nom propre). Le remplacement peut être appliqué à tous les segments du document en un clic. Un aperçu des remplacements est affiché avant confirmation.

### 6.3 Fusion de segments
L'utilisateur peut sélectionner deux segments consécutifs et les fusionner en un seul (utile quand le moteur a coupé une phrase en deux). Le timestamp du segment résultant prend le start du premier et le end du second. Le speaker est conservé (doit être le même pour les deux segments).

### 6.4 Scission de segments
L'utilisateur peut positionner son curseur dans un segment et le scinder en deux segments séparés. Le nouveau segment hérite du même speaker et reçoit un timestamp interpolé. Utile pour séparer deux phrases ou deux idées dans un bloc trop long.

### 6.5 Réattribution de speaker
L'utilisateur peut changer le speaker d'un ou plusieurs segments sélectionnés. Un dropdown propose les speakers existants du document ou permet d'en créer un nouveau. La réattribution est utile quand la diarization a fait une erreur d'attribution.

### 6.6 Suppression de segments
L'utilisateur peut supprimer un segment (passage hors-sujet, bruit, faux positif). La suppression est réversible via Ctrl+Z. Les segments supprimés ne sont plus inclus dans l'export ni dans l'index de recherche.

### 6.7 Ajout de notes entre segments
L'utilisateur peut insérer des blocs de texte libre entre les segments de transcription (notes, contexte, liens). Ces blocs sont visuellement distincts des segments transcrits (pas de timestamp, pas de speaker). Ils sont inclus dans l'export et la recherche.

### 6.8 Vocabulaire custom
L'utilisateur ou l'admin peut définir un dictionnaire de termes spécifiques (noms de produits, acronymes, jargon métier) qui sont utilisés comme hint par le moteur Whisper pour améliorer la reconnaissance. Le dictionnaire est stocké par tenant et chargé avant chaque transcription.

### 6.9 Correction assistée par IA
Un bouton "Corriger avec l'IA" envoie le texte de la transcription au module `signapps-ai` (port 3005) pour correction grammaticale et ponctuation. L'IA propose des corrections que l'utilisateur peut accepter ou rejeter une par une (mode suggestion, pas d'application automatique). Les noms propres et termes techniques du vocabulaire custom sont préservés.

### 6.10 Historique des versions
Chaque modification du document de transcription crée un snapshot versionné. L'utilisateur peut naviguer dans l'historique des versions, comparer deux versions (diff visuel), et restaurer une version précédente. Le mécanisme utilise le versioning existant de signapps-docs.

---

## Catégorie 7 — IA intégrée (résumé, action items, topics, traduction)

### 7.1 Résumé automatique post-meeting
À la fin de la transcription (ou à la demande), le module `signapps-ai` (port 3005) génère un résumé structuré : résumé exécutif (3-5 phrases), points clés (5-10 items), décisions prises (formulation assertive). Le résumé est inséré au début du document de transcription, après le bandeau `transcriptMeta`.

### 7.2 Détection d'action items
L'IA identifie automatiquement les action items mentionnés dans la transcription (ex: "Pierre doit envoyer le rapport d'ici vendredi"). Chaque action item est extrait avec : la description, le responsable (si mentionné), la deadline (si mentionnée). Les action items peuvent être convertis en tâches dans signapps-tasks en un clic.

### 7.3 Détection de topics et chapitrage
L'IA segmente la transcription en topics (ex: "Budget Q3", "Recrutement", "Roadmap produit"). Chaque topic est inséré comme un heading dans le document, permettant la navigation par table des matières. Le chapitrage est ajouté comme métadonnée et visible dans la timeline.

### 7.4 Détection de questions non répondues
L'IA identifie les questions posées pendant le meeting qui n'ont pas reçu de réponse claire. Ces questions sont listées dans un encadré "Questions ouvertes" à la fin du document. L'utilisateur peut marquer une question comme "résolue" ou la convertir en action item.

### 7.5 Analyse de sentiment par segment
Pour chaque segment ou topic, l'IA attribue un indicateur de sentiment (positif, neutre, négatif, tendu). Les segments avec un sentiment négatif ou tendu sont subtilment marqués visuellement. Cela permet de repérer rapidement les points de friction dans un long meeting.

### 7.6 Traduction automatique
La transcription peut être traduite dans une autre langue via le module AI. La traduction est stockée comme version alternative du document (pas de remplacement). L'utilisateur peut basculer entre la version originale et la version traduite. Les langues supportées dépendent du modèle LLM configuré.

### 7.7 Génération d'email de suivi
Un bouton "Générer l'email de suivi" crée un brouillon d'email dans signapps-mail avec : le résumé du meeting, les action items avec responsables, les décisions prises, et un lien vers la transcription complète. L'email est pré-rempli avec les participants du meeting comme destinataires.

### 7.8 Q&A sur la transcription (chat)
Un panneau latéral permet de poser des questions en langage naturel sur le contenu de la transcription (ex: "Quel budget a été proposé pour le projet Alpha ?"). L'IA répond en citant les segments pertinents avec leurs timestamps. Le mécanisme utilise RAG (retrieval-augmented generation) sur les segments du document.

### 7.9 Mots-clés et tags automatiques
L'IA extrait les mots-clés et entités nommées de la transcription (personnes, organisations, lieux, dates, montants). Les mots-clés sont ajoutés comme tags sur le document pour faciliter le filtrage et la navigation. Les entités sont linkées aux fiches contact ou projet correspondantes si elles existent dans le système.

### 7.10 Détection de décisions
L'IA identifie spécifiquement les moments de décision dans la transcription (ex: "On a décidé de reporter le lancement"). Les décisions sont extraites avec : la formulation, le contexte, les personnes impliquées. Elles sont listées dans un encadré "Décisions" et peuvent être liées à un workflow d'approbation.

---

## Catégorie 8 — Export et partage

### 8.1 Export Markdown
Le document de transcription peut être exporté en Markdown structuré : titre, métadonnées (durée, speakers, langue), puis segments avec timestamps et attribution de speaker. Le Markdown est compatible avec Notion, Obsidian, et tout éditeur Markdown. Le résumé AI est inclus s'il a été généré.

### 8.2 Export PDF
Export en PDF formaté avec mise en page professionnelle : page de garde avec titre/date/participants, table des matières par topics (si chapitré), corps avec segments horodatés et attribution de speaker. Le PDF inclut les métadonnées dans les propriétés du fichier.

### 8.3 Export SRT/VTT (sous-titres)
Export au format SRT ou WebVTT pour usage comme sous-titres vidéo. Chaque segment de transcription devient un sous-titre avec timecode de début/fin. Le nom du speaker est optionnellement préfixé au texte. Compatible avec les lecteurs vidéo standard.

### 8.4 Export JSON brut
Export du `TranscriptionResult` complet en JSON (métadonnées + segments). Format machine-readable pour intégration avec des outils tiers (analytics, CRM, BI). Inclut les scores de confiance, les IDs de speakers, et tous les timestamps.

### 8.5 Export DOCX (Word)
Export en document Word avec mise en forme : en-tête avec métadonnées, tableau des participants, corps avec segments horodatés. Les speakers sont mis en gras, les timestamps en italique. Compatible avec l'import dans signapps-office.

### 8.6 Partage par lien
Le document de transcription peut être partagé via un lien public ou restreint (mécanisme existant de signapps-docs). Les permissions (lecture seule, lecture + commentaire, lecture + édition) sont configurables. Le lien peut avoir une date d'expiration.

### 8.7 Partage vers Slack/Teams/Chat
Un bouton de partage rapide envoie un résumé de la transcription (titre, durée, speakers, premiers paragraphes, lien) dans un canal signapps-chat, ou via webhook vers Slack/Teams. Le format du message est adapté à chaque plateforme.

### 8.8 Envoi par email
La transcription complète ou son résumé peut être envoyée par email aux participants du meeting via signapps-mail. Le document est attaché en PDF et/ou le lien de consultation est inclus dans le corps de l'email. L'envoi peut être automatisé post-meeting.

### 8.9 Impression optimisée
Le document de transcription dispose d'une feuille de style d'impression (`@media print`) optimisée : pas de lecteur audio, timestamps en marge, speakers en gras, découpage propre des pages. L'impression se fait via `Ctrl+P` standard.

### 8.10 Clips audio partageables
L'utilisateur peut sélectionner un segment ou une plage de segments et créer un "clip audio" (extrait de l'enregistrement correspondant aux timestamps). Le clip est stocké dans signapps-storage et partageable par lien. Inspiré des soundbites de Fireflies.ai.

---

## Catégorie 9 — Administration et quotas

### 9.1 Quota de transcription par tenant
L'administrateur définit un quota mensuel de minutes de transcription par tenant (ex: 500 min/mois pour le plan standard, illimité pour enterprise). Le compteur est incrémenté à la fin de chaque transcription. Un avertissement est affiché à 80% du quota et la transcription est refusée à 100% (sauf override admin).

### 9.2 Dashboard d'administration
Page admin `/admin/transcription` avec : nombre de transcriptions ce mois, minutes consommées vs quota, répartition par source (Meet/External/Memo), top speakers par temps de parole, jobs en file d'attente, jobs échoués. Graphiques Recharts avec historique mensuel.

### 9.3 Configuration du modèle STT
L'admin choisit le modèle Whisper par défaut pour le tenant (tiny/base/small/medium/large-v3). Le choix impacte la qualité et les ressources. L'admin peut aussi configurer le fallback HTTP (URL du serveur Faster-Whisper) si le mode natif n'est pas disponible. La configuration est par tenant.

### 9.4 Politique de rétention
L'admin définit la durée de rétention des enregistrements audio source (ex: 90 jours). Les documents de transcription (texte Tiptap) sont conservés indéfiniment par défaut. Les fichiers audio sont supprimés automatiquement après la période de rétention. La transcription reste consultable sans l'audio (le lecteur affiche "Audio expiré").

### 9.5 Activation/désactivation par module
L'admin peut activer ou désactiver séparément chaque pipeline de transcription : Meet auto-transcription, capture externe, mémo vocal, IA post-traitement. Par défaut, seul le pipeline Meet est activé. La capture externe nécessite le client desktop Tauri.

### 9.6 Gestion des modèles téléchargés
Page admin montrant les modèles Whisper et pyannote téléchargés dans `MODELS_DIR`, leur taille, leur date de téléchargement. Boutons pour supprimer un modèle, télécharger un nouveau modèle, mettre à jour vers la dernière version. Indicateur d'espace disque utilisé par les modèles.

### 9.7 Logs et audit trail
Chaque transcription génère une entrée d'audit : qui a lancé la transcription, quand, sur quel enregistrement, durée, résultat (succès/échec), modèle utilisé, temps de traitement. Les logs sont accessibles dans la page admin et exportables en CSV.

### 9.8 Permissions RBAC
Les permissions de transcription sont gérées via le RBAC existant de signapps-identity. Permissions granulaires : `transcription.create` (lancer une transcription), `transcription.read` (voir les transcriptions), `transcription.export` (exporter), `transcription.admin` (configurer quotas et modèles). Par défaut, tous les utilisateurs ont `create` et `read`.

### 9.9 Langue par défaut du tenant
L'admin peut configurer une langue par défaut pour les transcriptions du tenant (ex: `fr`). Cette langue est utilisée comme hint pour Whisper quand la détection automatique n'est pas souhaitée. La langue par défaut peut être overridée par l'utilisateur au moment de lancer une transcription.

### 9.10 Notification de transcription terminée
Quand une transcription se termine (succès ou échec), l'utilisateur qui l'a initiée reçoit une notification push (via signapps-notifications, port 8095). La notification contient un lien direct vers le document de transcription. En cas d'échec, le message d'erreur est inclus.

---

## Catégorie 10 — Intégrations cross-modules

### 10.1 Intégration Calendar
Quand un événement Calendar se termine et qu'un enregistrement Meet est disponible, la transcription est lancée automatiquement. Le document de transcription est lié à l'événement Calendar correspondant. Depuis la vue Calendar, un lien "Voir la transcription" permet d'accéder directement au document.

### 10.2 Intégration Drive
Les documents de transcription sont stockés dans le Drive et apparaissent dans le dossier "Transcriptions". Ils sont soumis aux mêmes règles de partage, quota de stockage et corbeille que les autres documents Drive. La recherche Drive inclut le contenu des transcriptions.

### 10.3 Intégration Meet
La page de fin de meeting Meet affiche un lien "Transcription en cours..." puis "Voir la transcription" quand elle est prête. L'enregistrement Meet et la transcription sont liés bidirectionnellement : depuis le recording on accède à la transcription, et vice versa. Le lien est via `transcription_jobs.recording_id`.

### 10.4 Intégration Docs
Les transcriptions sont des documents Tiptap standard avec des extensions spécifiques. Elles bénéficient de toutes les fonctionnalités de l'éditeur Docs : versioning, collaboration temps réel, commentaires, partage, export. Un document Docs classique peut inclure un lien vers une transcription.

### 10.5 Intégration Tasks
Les action items détectés par l'IA peuvent être convertis en tâches signapps-tasks d'un clic. La tâche créée inclut : le titre de l'action item, le responsable (si détecté), la deadline (si détectée), un lien vers le segment de transcription source. La tâche est liée au projet associé au meeting Calendar si applicable.

### 10.6 Intégration Chat
Les transcriptions peuvent être partagées dans un salon de chat avec un aperçu rich-link (titre, durée, speakers, extrait). Les participants du meeting peuvent être notifiés dans le chat quand la transcription est disponible. Un bot peut poster automatiquement le résumé dans le canal d'équipe.

### 10.7 Intégration Wiki
Le contenu d'une transcription peut être converti en page Wiki (ou extrait dans une page Wiki existante). Le chapitrage par topics de l'IA facilite cette conversion : chaque topic devient une section du Wiki. Les décisions et action items sont formatés en checklist.

### 10.8 Intégration Search globale
Les transcriptions apparaissent dans les résultats de la recherche globale SignApps (`/search`). Le type "Transcription" est un filtre disponible. Les résultats affichent le segment correspondant avec timestamp et speaker, pas seulement le titre du document.

### 10.9 Intégration CRM/Contacts
Quand un speaker est associé à un contact de l'annuaire, la transcription est référencée dans la fiche contact (onglet "Historique des échanges"). Cela permet de retrouver toutes les transcriptions où un client ou partenaire a parlé. Utile pour le suivi commercial et la relation client.

### 10.10 Intégration Notifications
Le système de notifications envoie des événements pour : transcription démarrée, transcription terminée (avec lien), transcription échouée (avec erreur). Les notifications respectent les préférences de canal de l'utilisateur (in-app, push, email) configurées dans signapps-notifications.

### 10.11 Intégration AI Gateway
Les requêtes AI (résumé, action items, Q&A) passent par le gateway AI existant (`signapps-ai`, port 3005). Cela bénéficie du routing intelligent vers le meilleur modèle disponible (local Ollama, vLLM, ou API externe si configuré). Les prompts sont optimisés pour le contexte de transcription de meeting.

---

## Catégorie 11 — Mobile et accessibilité

### 11.1 Consultation mobile responsive
Les documents de transcription sont lisibles sur mobile avec une mise en page adaptée : segments en pleine largeur, timestamps réduits, speakers en badge compact au-dessus du texte. Le lecteur audio est fixé en bas de l'écran (sticky player). La navigation entre segments se fait par swipe vertical.

### 11.2 Mémo vocal mobile
Sur mobile (PWA), un bouton flottant permet d'enregistrer un mémo vocal directement. L'enregistrement utilise l'API MediaRecorder du navigateur. À la fin de l'enregistrement, le fichier est uploadé pour transcription. L'expérience est similaire à l'enregistrement vocal de WhatsApp : appui long pour enregistrer, relâcher pour envoyer.

### 11.3 Navigation clavier complète
Tous les contrôles du document de transcription sont accessibles au clavier : navigation entre segments (Tab/Shift+Tab), play/pause du lecteur (Space), avance/recul (flèches), édition d'un segment (Enter), fermeture du mode édition (Escape). Les raccourcis sont documentés dans une modale d'aide (`?`).

### 11.4 Labels ARIA et rôles sémantiques
Chaque composant interactif porte un `aria-label` descriptif. Les segments de transcription ont le rôle `article` avec `aria-label` incluant le speaker et le timestamp. Le lecteur audio a le rôle `region` avec `aria-label="Lecteur audio de la transcription"`. Les boutons d'action ont des labels explicites.

### 11.5 Contraste et mode high-contrast
Les couleurs des speakers respectent un ratio de contraste minimum de 4.5:1 sur fond clair et fond sombre. Le mode high-contrast du système d'exploitation est respecté (media query `forced-colors`). Les segments à faible confiance utilisent un indicateur iconique en plus de la couleur orangée.

### 11.6 Lecteur d'écran compatible
Le contenu de la transcription est navigable par un lecteur d'écran (NVDA, VoiceOver, JAWS). L'annonce inclut : "Segment de [speaker] à [timestamp] : [texte]". Les changements de speaker sont annoncés. Le résumé AI est dans un landmark `complementary` avec heading propre.

### 11.7 Réduction de mouvement
Les animations (waveform, pulsation du point rouge, highlight du segment actif) respectent la media query `prefers-reduced-motion`. En mode réduit, les animations sont remplacées par des changements de style statiques (bordure, couleur de fond).

### 11.8 Sous-titres pour les clips audio
Les clips audio partageables incluent un fichier de sous-titres (VTT) automatiquement. Les sous-titres sont générés à partir des segments de transcription correspondants. Les lecteurs audio/vidéo modernes affichent les sous-titres automatiquement.

### 11.9 Taille de texte ajustable
L'utilisateur peut augmenter ou diminuer la taille du texte de la transcription sans casser la mise en page. Le dimensionnement utilise des unités relatives (rem) et les breakpoints responsive s'adaptent. Trois tailles prédéfinies : compacte, standard, grande.

### 11.10 Mode hors-ligne (lecture seule)
Les transcriptions consultées récemment sont mises en cache dans le Service Worker (PWA). En mode hors-ligne, l'utilisateur peut relire les transcriptions cachées (texte uniquement, pas l'audio). La mise en cache est automatique et ne nécessite aucune action de l'utilisateur.

---

## Catégorie 12 — V2 préparation — Streaming live (spec uniquement, non implémenté)

### 12.1 Pipeline StreamingPipeline
Troisième implémentation du trait `TranscriptionPipeline`, mode continu. L'audio est découpé en chunks de 3-5 secondes par le VAD, chaque chunk est transcrit par whisper-rs en mode streaming, les résultats intermédiaires sont diffusés via WebSocket. À la fin du meeting, le buffer complet produit le même `TranscriptionResult` que les pipelines V1.

### 12.2 Sous-titres live dans SignApps Meet
Un composant React `<LiveCaptions>` affiche les sous-titres en temps réel en bas de la fenêtre de visioconférence. Les sous-titres montrent le speaker courant et les derniers mots transcrits, avec un effet de typing en temps réel. L'utilisateur peut activer/désactiver les sous-titres. Latence cible : < 3 secondes entre la parole et l'affichage.

### 12.3 Messages WebSocket de transcription
Le format des messages WebSocket est défini : `{ "type": "transcript.segment", "speaker": "Pierre", "text": "on commence", "timestamp": 83.5, "is_final": false }`. Les messages `is_final: false` sont des résultats partiels (mis à jour en place). Les messages `is_final: true` sont définitifs et ajoutés au buffer.

### 12.4 Traduction live des sous-titres
Extension du streaming : les sous-titres sont traduits en temps réel via le module AI. Chaque participant peut choisir sa langue d'affichage des sous-titres. La traduction ajoute ~1 seconde de latence. Langues cibles configurées par l'admin du tenant.

### 12.5 Panneau de transcription live
En plus des sous-titres compacts, un panneau latéral affiche la transcription intégrale en temps réel (tous les segments, pas seulement les derniers mots). Le panneau scroll automatiquement et affiche les speakers avec codes couleur. Il sert de preview du document final qui sera généré.

### 12.6 Détection de mots-clés en temps réel
Le système peut monitorer la transcription live pour détecter des mots-clés prédéfinis (ex: "deadline", "urgent", "décision"). Quand un mot-clé est détecté, une notification discrète est envoyée à l'utilisateur. Utile pour le suivi de meetings longs où l'on attend un sujet spécifique.

### 12.7 Export du buffer en cours de meeting
Pendant un meeting en cours avec streaming actif, l'utilisateur peut exporter un snapshot de la transcription en cours (PDF ou Markdown). Le snapshot est marqué "en cours — non finalisé". Utile pour partager des notes pendant un long meeting sans attendre la fin.

### 12.8 Résumé incrémental
Le module AI produit un résumé mis à jour toutes les 10 minutes pendant un meeting long. Le résumé est affiché dans un panneau latéral et mis à jour en place. À la fin du meeting, le résumé final remplace les résumés intermédiaires.

### 12.9 Mode dictée
Extension du streaming pour usage individuel : dictée de texte avec transcription en temps réel. Le texte transcrit est inséré directement dans un champ texte ou un document Tiptap actif. Commandes vocales pour la ponctuation ("point", "virgule", "à la ligne"). Activation par bouton micro ou raccourci.

### 12.10 Intégration LiveKit Agents
Le streaming live utilise le framework LiveKit Agents pour déployer un bot de transcription dans la room LiveKit. Le bot reçoit les flux audio de tous les participants, transcrit en continu, et diffuse les résultats via le data channel LiveKit. Cela élimine la latence réseau supplémentaire d'un service externe.

---

## Sources

### Help centers et documentation produit

- Otter.ai : https://help.otter.ai/
- Fireflies.ai : https://help.fireflies.ai/
- tl;dv : https://tldv.io/help-center/
- Grain : https://support.grain.com/
- Tome / Parakeet : https://github.com/AkshayKuchibhatla/parakeet (inspiration architecture locale)
- Tactiq : https://help.tactiq.io/
- Krisp : https://help.krisp.ai/
- Zoom AI Companion : https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0060677
- Microsoft Teams Transcription : https://support.microsoft.com/en-us/office/view-live-transcription-in-microsoft-teams-meetings-dc1a8f23-2e20-4684-885e-2152e06a4a8b
- Google Meet Transcription : https://support.google.com/meet/answer/10101980
- Rev.ai API : https://docs.rev.ai/
- AssemblyAI : https://docs.assemblyai.com/
- Descript : https://help.descript.com/

### Projets open source permissifs (utilisables)

| Projet | Licence | Usage |
|---|---|---|
| **whisper.cpp** | MIT | Inférence Whisper C++ CPU-only, binding possible via FFI |
| **whisper-rs** | MIT | Binding Rust natif de whisper.cpp, moteur STT principal |
| **cpal** | Apache-2.0 | Capture audio cross-platform (WASAPI, CoreAudio, ALSA/PulseAudio) |
| **pyannote.audio** | MIT | Speaker diarization ML, sidecar Python |
| **Vosk** | Apache-2.0 | STT offline léger, alternative à Whisper pour CPU faible |
| **Silero VAD** | MIT | Voice Activity Detection ML, plus précis que le VAD RMS pour la V2 |
| **symphonia** | MPL-2.0 (consommateur OK) | Décodage audio (MP3, FLAC, OGG, AAC, WAV) — déjà utilisé dans signapps-media |
| **Kaldi** | Apache-2.0 | Framework ASR complet, référence académique, utilisable en pipeline |
| **wav2letter** / **flashlight** | BSD-3-Clause | Framework ASR de Meta, backend alternatif pour STT |
| **coreaudio-rs** | MIT | Binding CoreAudio macOS pour la capture audio native |
| **Faster-Whisper** | MIT | Inférence Whisper via CTranslate2, 4x plus rapide, serveur HTTP |
| **LiveKit** | Apache-2.0 | SFU pour les meetings internes, flux audio séparés par participant |

### Projets avec restrictions de licence

| Projet | Licence | Statut |
|---|---|---|
| **DeepSpeech (Mozilla)** | MPL-2.0 | Consommateur OK, pas de fork/modification sans redistribution MPL |
| **ESPnet** | Apache-2.0 | OK, framework ASR/TTS japonais-first |
| **NeMo (NVIDIA)** | Apache-2.0 | OK, mais lourd (GPU NVIDIA requis) |
| **OpenAI Whisper (Python)** | MIT | OK, mais la version Python est lente vs whisper.cpp/Faster-Whisper |
| **SpeechBrain** | Apache-2.0 | OK, alternative à pyannote pour la diarization |
| **GNU Parrot** | GPL-3.0 | **INTERDIT** — licence GPL incompatible avec usage commercial propriétaire |
| **Julius** | BSD-3-Clause | OK mais ancien, Whisper est supérieur |
| **CMU Sphinx / PocketSphinx** | BSD-2-Clause | OK mais très ancien, précision insuffisante |

---

## Assertions E2E clés (à tester)

1. Un meeting SignApps Meet avec enregistrement génère automatiquement une transcription après la fin de la session.
2. Le document de transcription Tiptap contient un noeud `transcriptMeta` avec durée, source, speakers et langue.
3. Le document contient un noeud `transcriptSegment` par segment de transcription avec speaker et timestamp.
4. La capture audio externe via Tauri capture simultanément le micro et l'audio système.
5. L'overlay de capture affiche le compteur de durée, le nom de l'app détectée et les boutons pause/stop.
6. La capture s'arrête automatiquement après 120 secondes de silence (VAD).
7. La diarization par tracks LiveKit attribue les vrais noms des participants Meet aux segments.
8. La diarization pyannote attribue des labels "Speaker 1", "Speaker 2" aux segments des captures externes.
9. Le renommage d'un speaker dans l'UI se propage à tous ses segments dans le document.
10. La transcription sans pyannote installé génère un document avec avertissement mais sans crash.
11. Le clic sur un timestamp dans le document positionne le lecteur audio au bon endroit.
12. La recherche full-text retrouve un mot prononcé dans un meeting passé avec highlighting du segment.
13. Le filtre par speaker dans la recherche ne retourne que les segments du speaker sélectionné.
14. L'export Markdown contient les timestamps, speakers et texte de tous les segments.
15. L'export SRT/VTT produit un fichier de sous-titres valide avec timecodes corrects.
16. Le résumé AI post-meeting contient un résumé exécutif, des points clés et des action items.
17. Un action item détecté par l'IA peut être converti en tâche signapps-tasks d'un clic.
18. Le quota de transcription par tenant est décrémenté après chaque transcription réussie.
19. L'upload d'un fichier audio (MP3, WAV, OGG) déclenche une transcription avec document résultant.
20. Le document de transcription est accessible au clavier (Tab entre segments, Space pour play/pause).
21. Les labels ARIA sont présents sur le lecteur audio, les segments et les contrôles d'édition.
22. La notification push est envoyée à l'utilisateur quand la transcription est terminée.
23. Le document de transcription apparaît dans le dossier "Transcriptions" du Drive.
24. La recherche globale SignApps retourne les transcriptions avec le filtre type "Transcription".
25. La page `/transcriptions` affiche la liste triée par date avec titre, durée, speakers et source.

---

## Historique

- 2026-04-13 : Création initiale. Benchmark 14 concurrents. 12 catégories, 128 features. Aligné avec le design spec `docs/superpowers/specs/2026-04-13-local-meeting-transcription-design.md` et le code existant (`signapps-transcription`, `signapps-audio-capture`, `signapps-meet/handlers/transcription.rs`).
