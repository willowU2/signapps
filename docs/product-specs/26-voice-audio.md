# Module Voice & Audio — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Otter.ai** | Transcription temps reel de meetings, resumes automatiques, action items detectes, integration Zoom/Teams/Meet, speaker identification, vocabulaire custom, live captions, highlight & comment sur transcription, search full-text dans l'historique |
| **Fireflies.ai** | Bot qui rejoint les meetings automatiquement, transcription + resume AI, detection de topics/sentiments/questions, integration CRM, AskFred (chat AI sur les meetings), soundbites (clips audio partageables), conversation intelligence analytics |
| **Grain** | Enregistrement + highlights, decoupage automatique en moments cles, partage de clips video/audio, summary AI, integration Slack/Notion/HubSpot, coaching insights, playlists de moments |
| **tl;dv** | Enregistrement gratuit de meetings, timestamps automatiques, resumes AI multi-langues, meeting notes templates, integration Notion/Slack/CRM, speaker analytics |
| **Fathom** | Transcription + resume instantane post-meeting, action items auto-detectes, highlights one-click, integration CRM auto-fill, team meeting dashboard |
| **Loom** | Enregistrement asynchrone (audio+ecran), transcription automatique, viewer analytics, comments timecoded, chapitrage auto, call-to-action integres |
| **Rev** | Transcription humaine + AI hybride, captions pour videos, multi-langues, vocabulaire custom, timestamps precis, API robuste |
| **Descript** | Edition audio/video par le texte (supprimer un mot dans la transcription supprime l'audio), overdub (voix synthetique), filler word removal, studio sound, multitrack |
| **Whisper (OpenAI)** | Open source (MIT), multi-lingue (99 langues), word-level timestamps, speaker diarization, modeles de tailles variees (tiny a large), execution locale possible, Faster-Whisper (CTranslate2) pour 4x speedup |
| **AssemblyAI** | API-first, resumes, detection de topics/entites/sentiments, PII redaction, custom vocabulary, real-time streaming, speaker labels, dual channel |
| **Deepgram** | STT ultra-rapide (streaming <300ms), Nova-2 model, topic detection, summarization, diarization, intent recognition, smart formatting, keyterms |
| **Piper TTS** | Open source (MIT), voix haute qualite, multi-langues (dont francais), leger, executable localement, VITS/ONNX, ideal pour TTS embarque |
| **Coqui TTS** | Open source, clonage de voix, multi-speaker, XTTS v2, streaming, fine-tuning, multi-langues |

## Principes directeurs

1. **Natif et local par defaut** — transcription et synthese vocale fonctionnent sans service cloud, grace aux moteurs embarques (Whisper via whisper-rs, Piper TTS via piper-rs). Aucune donnee audio ne quitte le serveur sauf configuration explicite.
2. **Temps reel prioritaire** — la transcription live doit afficher les mots <500ms apres qu'ils soient prononces, avec streaming WebSocket bidirectionnel.
3. **Speaker-aware** — la diarisation (identification des locuteurs) est activee par defaut dans les reunions, avec association automatique aux utilisateurs connus de l'annuaire.
4. **Multi-langue transparent** — detection automatique de la langue parlee, transcription et traduction simultanee vers la langue de l'interface utilisateur.
5. **Exploitable, pas juste archive** — chaque transcription produit des artefacts actionnables : resume, action items, decisions, topics, mots-cles. Indexe et cherchable.
6. **Integre cross-module** — les transcriptions de Meet alimentent le Wiki, les action items creent des Tasks, les notes vocales s'attachent aux documents Drive, les commandes vocales naviguent dans toute la plateforme.

---

## Categorie 1 — Transcription de meetings (Minutes)

### 1.1 Enregistrement d'un meeting en cours
Bouton "Demarrer l'enregistrement" dans l'onglet Minutes. Le bouton affiche un micro rouge anime (pulse CSS) pendant l'enregistrement. Capture de l'audio du microphone local en PCM 16kHz mono via MediaRecorder API (WebM/Opus) puis transcodage cote serveur en PCM f32le pour le pipeline STT. Indicateur visuel rouge clignotant (dot 8px, animation blink 1s) dans le header de la page pendant toute la duree. Compteur de duree en temps reel (format `mm:ss`, puis `hh:mm:ss` au-dela de 60 min). Boutons `Pause` (icone pause, tooltip "Mettre en pause l'enregistrement", raccourci `Ctrl+Shift+P`) et `Arreter` (icone carré, tooltip "Terminer l'enregistrement", raccourci `Ctrl+Shift+S`). Pendant la pause, le dot clignote en orange et le compteur se fige. Confirmation modale a l'arret : "Terminer l'enregistrement ? La transcription sera generee automatiquement." Si l'utilisateur ferme l'onglet pendant l'enregistrement, une alerte beforeunload le previent. L'audio est envoye au serveur en chunks de 5 secondes via WebSocket pour la transcription en temps reel (voir 1.2). API WebSocket : `WS /api/v1/voice/record` (binary frames audio, text frames control).

### 1.2 Transcription temps reel (live captions)
Pendant l'enregistrement, les mots apparaissent en temps reel dans le panneau de transcription. Le panneau est divise en segments (phrases) avec : timestamp de debut (format `[00:03:42]`, cliquable pour naviguer dans l'audio), nom du locuteur detecte (badge colore), texte transcrit en streaming (les mots apparaissent un par un avec animation fade-in). Latence cible : <500ms entre la parole et l'affichage du mot. Le pipeline utilise `signapps-media` (port 3009) qui encapsule whisper-rs avec le modele selectionne. Les chunks audio PCM 16kHz mono sont envoyes via WebSocket en binary frames. Le serveur repond avec des text frames JSON : `{"type": "partial", "text": "en train de"}` pour les resultats intermediaires et `{"type": "final", "text": "En train de discuter du budget", "speaker": 0, "start": 222.5, "end": 225.1}` pour les segments finalises. Le panneau auto-scroll vers le bas sauf si l'utilisateur a scroll manuellement vers le haut (detection via scroll event). Bouton "Auto-scroll" pour reactiver le scroll automatique.

### 1.3 Speaker diarization automatique
Le moteur STT identifie automatiquement les differents locuteurs (Speaker 1, Speaker 2...) via l'analyse de la voix (pyannote.audio ou speaker embeddings whisper). Chaque speaker recoit une couleur distincte attribuee automatiquement (palette de 8 couleurs : bleu, vert, orange, violet, rose, cyan, jaune, rouge). Si le meeting est un Meet SignApps, les speakers sont automatiquement associes aux participants connus via leur empreinte vocale enregistree (voir 1.4) ou par correlation temporelle (qui parlait quand dans le flux WebRTC). La diarisation est affichee dans le panneau de transcription sous forme de labels colores a gauche de chaque segment. Precision cible : >90% d'attribution correcte pour les meetings a 2-6 participants. Au-dela de 6, degradation acceptable jusqu'a >80%.

### 1.4 Association manuelle des speakers
Apres l'enregistrement, l'utilisateur peut cliquer sur un label "Speaker 1" pour ouvrir un dropdown de selection parmi les contacts de l'annuaire SignApps. La recherche est filtree par nom/prenom avec autocompletion. L'association se propage a tous les segments de ce speaker dans la transcription (mise a jour en batch, animation de remplacement). Mecanisme de memorisation : l'empreinte vocale du speaker est associee au contact dans la table `voice_prints` pour les meetings futurs. Bouton "Dissocier" pour retirer l'association. Si le meeting provient de Meet, les participants sont pre-suggeres dans le dropdown (tries par probabilite de correspondance). API : `PATCH /api/v1/voice/transcriptions/:id/speakers` avec `{speaker_index: 0, user_id: "uuid"}`.

### 1.5 Resume automatique AI
A la fin du meeting (ou a la demande via bouton "Generer le resume"), le module AI (`signapps-ai`, port 3005) genere :
- **Resume executif** (3-5 phrases, format paragraphe)
- **Points cles** (liste a puces, 5-10 items)
- **Decisions prises** (formulation assertive : "Decide : lancement du produit reporte a Q3")
- **Action items** (tache, assigne probable, deadline si mentionnee, format tableau)
- **Questions ouvertes** (non resolues, pour suivi)
Le resume est affiche dans un panneau a onglets sous la transcription. Chaque section est editable inline (contenteditable avec auto-save). Le resume est versionne : chaque edition cree une nouvelle version accessible via l'historique. Bouton "Regenerer" pour relancer l'IA avec un prompt different. Bouton "Partager le resume" envoie par notification aux participants. API : `POST /api/v1/voice/transcriptions/:id/summarize`.

### 1.6 Detection automatique d'action items
L'IA identifie les phrases de type engagement ("je m'en occupe", "il faut qu'on fasse", "d'ici vendredi", "I'll take care of it", "let's do this by") et les convertit en action items structures : description, assigne probable (base sur le speaker), deadline estimee (parsing de dates relatives), priorite (estimee par le contexte). Chaque action item est affiche dans la section dediee avec un bouton "Creer une tache" qui ouvre un dialog pre-rempli vers le module Tasks. Raccourci : clic sur l'icone checkbox a cote d'un segment dans la transcription pour le marquer manuellement comme action item. PgEventBus event `voice.action_item.detected` pour integration avec Tasks.

### 1.7 Detection de topics et chapitrage
La transcription est automatiquement decoupee en sections thematiques (chapitres) avec un titre genere par l'IA. Chaque chapitre affiche : titre, timestamp de debut, duree, nombre de speakers actifs. Navigation par chapitres dans la timeline (sidebar avec liste cliquable). Utile pour les longues reunions (>30 min). Les chapitres sont editables (renommer, fusionner, decouper). Un clic sur un chapitre dans la sidebar scroll la transcription au segment correspondant et positionne le player audio. API response inclut `chapters[]` avec `{title, start_seconds, end_seconds, speaker_ids}`.

### 1.8 Highlights et bookmarks
Pendant le meeting ou apres, l'utilisateur peut cliquer sur l'icone etoile a cote d'un segment pour le marquer comme "highlight". Les highlights sont listes dans un panneau dedie (onglet "Highlights" sous la transcription) avec : texte du segment, speaker, timestamp, tags optionnels. Chaque highlight peut etre partage comme un clip audio avec sa transcription (voir 5.9). Raccourci clavier : `H` pour marquer le segment en cours comme highlight pendant l'enregistrement live. Les highlights sont affiches avec un fond jaune pale dans la transcription. API : `POST /api/v1/voice/transcriptions/:id/highlights` avec `{segment_index, tags}`.

### 1.9 Recherche full-text dans les transcriptions
Barre de recherche dans la page d'historique des meetings (`/voice/minutes`). Cherche dans le texte transcrit de tous les meetings accessibles. Resultats avec contexte (segment avant/apres le match, highlight du terme trouve). Chaque resultat affiche : titre du meeting, date, speaker, timestamp. Clic sur un resultat navigue directement au moment correspondant dans l'audio et scroll la transcription. Recherche indexee cote serveur (PostgreSQL full-text search avec `tsvector`). Filtres : date range, speaker, duree du meeting. API : `GET /api/v1/voice/search?q=budget&from=2026-01-01&speaker=user_id`.

### 1.10 Integration Meet
Quand un meeting SignApps Meet (port 3014) est enregistre, la transcription est automatiquement generee et liee a l'evenement Calendar correspondant. Les participants du meeting sont pre-associes aux speakers. Le resume est envoye par notification push et in-app aux participants via PgEventBus event `voice.meeting.transcribed`. Lien vers la transcription affiche dans le detail de l'evenement Calendar. Le meeting apparat dans la liste des Minutes avec un badge "Meet" et l'icone video. Si l'enregistrement a ete consent par tous les participants (voir 9.1), un badge "Consent OK" est affiche.

### 1.11 Import audio externe
Uploader un fichier audio pour le transcrire. Formats supportes : MP3, WAV, OGG, FLAC, M4A, WebM, MP4 (piste audio extraite). Drag-and-drop sur la zone de depot ou bouton "Importer un audio". Limite : 100 Mo par fichier (configurable par l'admin). Barre de progression pendant l'upload. Apres upload, le fichier est place dans une file d'attente de transcription avec estimation du temps de traitement (base sur la duree et le modele). Notification quand la transcription est terminee. Statuts affiches : "En file d'attente", "Transcription en cours (45%)", "Termine". Fichiers multiples : upload en batch avec progression individuelle et globale. API : `POST /api/v1/voice/transcribe` (multipart/form-data avec le fichier audio).

### 1.12 Export des minutes
Exporter les minutes au format : **Markdown** (titres, listes, timestamps), **PDF** (mise en page professionnelle avec logo, titres de chapitres, speakers en couleur), **DOCX** (formatage Word compatible), **TXT** (texte brut avec timestamps), **SRT** (sous-titres, format standard), **VTT** (sous-titres web, compatible HTML5 video), **JSON** (structure complete : segments, speakers, chapters, highlights, summary). Option d'inclure : transcription complete, resume seul, action items seuls, ou tout combine. Bouton "Exporter" dans le header avec dropdown de formats. API : `GET /api/v1/voice/transcriptions/:id/export?format=pdf&include=all`.

---

## Categorie 2 — Commandes vocales

### 2.1 Activation des commandes vocales globales
Toggle dans l'onglet Commands (`/voice/commands`) pour activer l'ecoute permanente. Indicateur micro dans la barre de navigation (icone micro rouge anime) quand l'ecoute est active. Hot-word configurable (defaut "Hey SignApps") ou activation par touche clavier (defaut `Ctrl+Shift+V`). L'activation ouvre une mini-interface de commande vocale flottante (widget 320x180px, ancre en bas a droite) avec : waveform en temps reel, texte reconnu en cours, bouton fermer. Le widget disparait automatiquement 3 secondes apres execution de la commande. L'ecoute consomme le micro en continu — avertissement RGPD affiche a l'activation ("Votre micro sera ecoute en continu pour detecter le mot-cle. Aucun audio n'est stocke."). Desactivation par clic sur l'icone micro ou `Escape`.

### 2.2 Commandes de navigation
Commandes reconnues pour naviguer dans l'app :
- "Tableau de bord" / "Dashboard" -> `/dashboard`
- "Calendrier" / "Calendar" -> `/cal`
- "Boite de reception" / "Inbox" -> `/mail`
- "Documents" / "Docs" -> `/docs`
- "Taches" / "Tasks" -> `/tasks`
- "Contacts" -> `/contacts`
- "Parametres" / "Settings" -> `/settings`
- "Retour" / "Go back" -> navigation arriere (history.back)
- "Drive" / "Fichiers" -> `/drive`
- "Chat" -> `/chat`
Chaque commande reconnue declenche un toast de confirmation avec l'action executee ("Navigation vers Dashboard"). Feedback sonore optionnel (ping court). Multi-lingue : les commandes sont reconnues en francais et en anglais.

### 2.3 Commandes de creation
- "Nouveau document" / "Create doc" -> ouvre l'editeur Docs
- "Envoyer un mail a [nom]" -> ouvre un composer Mail pre-rempli avec le destinataire
- "Planifier une reunion" / "Schedule meeting" -> ouvre le formulaire Calendar
- "Nouvelle tache [description]" -> cree une tache avec la description dictee
- "Creer un contact [nom]" -> ouvre le formulaire Contact pre-rempli
- "Nouveau post [texte]" -> ouvre le compose Social avec le texte
Chaque commande de creation est confirmee par un toast et la navigation vers le module concerne. Si le nom mentionne n'est pas trouve dans les contacts, un toast d'erreur "Contact non trouve" avec suggestion du contact le plus proche.

### 2.4 Commandes de recherche
- "Chercher [terme]" -> lance la recherche globale (Ctrl+K) avec le terme pre-rempli
- "Trouver le document [nom]" -> recherche dans Drive avec filtre type=document
- "Qui est [nom] ?" -> recherche dans Contacts et affiche la fiche du contact en panneau lateral
Les resultats de recherche vocale sont affiches dans le meme panneau que la recherche clavier, avec highlight du terme.

### 2.5 Commandes contextuelles
Commandes disponibles selon le module actif :
- **Dans Mail** : "Repondre", "Archiver", "Suivant" (mail suivant), "Precedent", "Supprimer", "Marquer comme lu"
- **Dans Calendar** : "Prochain rendez-vous" (affiche le detail), "Quand est ma prochaine reunion ?" (reponse vocale TTS)
- **Dans Docs** : "Enregistrer" (Ctrl+S), "Partager avec [nom]" (ouvre le dialog de partage)
- **Dans Meet** : "Muter" / "Unmute", "Couper la camera", "Lever la main", "Quitter"
- **Dans Chat** : "Envoyer [message]" dans la conversation active
La liste des commandes contextuelles est affichee dans une bulle d'aide au survol de l'icone micro.

### 2.6 Feedback visuel et sonore
Chaque commande reconnue affiche un toast de confirmation (Sonner, position bottom-right) avec l'action executee. Trois etats visuels du widget vocal : ecoute (waveform bleu anime), traitement (spinner orange), execute (checkmark vert, 1s puis fermeture). Son de confirmation configurable (activable/desactivable dans les preferences, defaut : desactive). Si la commande n'est pas comprise, feedback "Je n'ai pas compris" avec 3 suggestions de commandes proches (distance de Levenshtein). Apres 3 echecs consecutifs, le widget affiche un lien "Voir toutes les commandes disponibles".

### 2.7 Historique des commandes
Liste des commandes vocales recentes dans l'onglet Commands (`/voice/commands/history`). Tableau avec colonnes : date/heure, texte reconnu, commande interpretee, action executee, statut (succes vert / echec rouge / non reconnu gris). Filtrable par date et statut. Exportable en CSV. Utile pour le debug et l'amelioration de la reconnaissance. Statistiques en haut : nombre total de commandes, taux de succes, commande la plus utilisee.

### 2.8 Vocabulaire custom
Page d'administration (`/voice/settings/vocabulary`) pour ajouter des mots au dictionnaire du moteur STT. Formulaire : mot/expression, prononciation optionnelle (phonetique), categorie (nom propre, acronyme, terme technique). Liste des mots custom avec edition et suppression. Les mots custom sont injectes comme "initial prompt" dans Whisper pour ameliorer la reconnaissance. Limite : 500 mots custom par organisation. Import/export en CSV. API : `POST /api/v1/voice/vocabulary`, `GET /api/v1/voice/vocabulary`.

---

## Categorie 3 — Notes audio

### 3.1 Enregistrement rapide de notes vocales
Bouton micro prominent dans l'onglet Voice Notes (`/voice/notes`). Un seul clic demarre l'enregistrement (pas de confirmation). L'icone passe au rouge avec animation pulse. Un second clic arrete. La note est automatiquement transcrite en arriere-plan. Pendant l'enregistrement : waveform en temps reel (visualisation canvas des amplitudes audio, 60fps), compteur de duree, bouton pause. Duree minimale : 1 seconde (les enregistrements plus courts sont ignores). Duree maximale : 30 minutes (configurable). Raccourci clavier global : `Ctrl+Shift+R` demarre/arrete un enregistrement depuis n'importe quelle page. L'enregistrement continue meme si l'utilisateur navigue vers une autre page (mini-player flottant affiche). API : les chunks audio sont envoyes en streaming via `WS /api/v1/voice/notes/record`.

### 3.2 Liste des notes vocales
Affichage chronologique des notes dans une liste scrollable. Chaque note affiche : date et heure (relatif + absolu au survol), duree (format `m:ss`), transcription (preview tronquee a 2 lignes), player audio inline (voir 3.3), tags (badges colores), icone du contexte lie (document, evenement, contact). Tri par : date (defaut, plus recentes en haut), duree, tags. Recherche par texte dans les transcriptions. Pagination infinite scroll (20 notes par batch). Vue alternative en grille (cards) activable par toggle. API : `GET /api/v1/voice/notes?sort=date&q=budget&page=1&per_page=20`.

### 3.3 Lecture audio avec waveform
Chaque note affiche une visualisation waveform cliquable (generee a partir de l'analyse des peaks audio, rendu SVG ou Canvas). Clic sur la waveform positionne la lecture a l'endroit clique (precision a la seconde). Vitesse de lecture ajustable via dropdown : 0.5x, 0.75x, 1x (defaut), 1.25x, 1.5x, 2x. Boutons skip +10s et -10s. Bouton play/pause avec raccourci `Espace`. Barre de progression au-dessus de la waveform. Volume ajustable. Le mot en cours de lecture est surligné dans la transcription (synchronisation audio-texte via les timestamps de mot). Couleur de la waveform : gris pour la partie non jouee, bleu pour la partie jouee.

### 3.4 Transcription automatique
Chaque note vocale est transcrite automatiquement apres l'arret de l'enregistrement. La transcription demarre immediatement si le serveur a de la capacite, sinon placement en file d'attente avec estimation. Statut affiche sous la note : "Transcription en cours..." (spinner) puis le texte. La transcription est editable : clic sur le texte active le mode edition (contenteditable). Les modifications sont sauvegardees automatiquement via `PATCH /api/v1/voice/notes/:id`. Les mots a faible confiance sont soulignes en pointilles orange (seuil <0.7). Clic droit sur un mot affiche les alternatives suggerees par le moteur STT.

### 3.5 Tags et categorisation
Ajouter des tags aux notes vocales via un selecteur multi-tag (combobox avec creation inline). Tags predefinis : #meeting, #idee, #rappel, #urgent, #personnel, #projet. Tags custom creables. Chaque tag a une couleur attribuee automatiquement. Filtrer les notes par tag dans la barre de filtres. L'IA suggere des tags en fonction du contenu transcrit (affichees comme des chips grises "Suggere : #budget" avec bouton "Ajouter"). API : `PATCH /api/v1/voice/notes/:id/tags`.

### 3.6 Rattachement a un contexte
Associer une note vocale a un element de la plateforme : document Drive, evenement Calendar, contact, tache Tasks, ticket Helpdesk, post Social. Interface : bouton "Attacher a..." ouvre un picker universel (recherche par nom avec filtrage par type). La note apparait dans le panneau lateral de l'element associe sous la section "Notes vocales" avec player inline. Un element peut avoir plusieurs notes attachees. API : `PATCH /api/v1/voice/notes/:id` avec `{context_type: "calendar_event", context_id: "uuid"}`.

### 3.7 Partage de notes vocales
Partager une note vocale via un lien direct. Le lien ouvre une page publique (authentification optionnelle) avec : player audio + waveform, transcription, tags. Permissions : lecture seule (defaut) ou lecture + commentaire. Expiration optionnelle du lien (1h, 24h, 7j, 30j, jamais). Lien genere via `POST /api/v1/voice/notes/:id/share` retournant un `share_token`. Revocation du lien possible a tout moment.

### 3.8 Conversion en document
Bouton "Convertir en document" dans le menu de la note. Cree un document dans le module Docs a partir de la transcription. Le document est pre-formate : titre = date + premiere phrase, corps = transcription complete, audio embarque en piece jointe (lien vers le fichier storage). Utile pour formaliser des idees dictees. Le document est cree via PgEventBus event `voice.note.convert_to_doc` traite par le service Docs.

### 3.9 Notes vocales dans d'autres modules
Bouton micro disponible dans les barres d'outils de : **Mail** (dicter le corps d'un email), **Docs** (dicter du contenu a la position du curseur), **Tasks** (dicter une description de tache), **Chat** (envoyer un message vocal avec player inline + transcription auto). Chaque module affiche un mini-enregistreur (waveform + bouton stop) quand le micro est actif. La transcription est inseree dans le champ de texte concerne. Pour Chat, le message vocal est affiche comme une bulle audio avec player inline et transcription en dessous (expandable). API : chaque module expose un endpoint de reception de note vocale.

### 3.10 Suppression et retention
Suppression manuelle via bouton corbeille avec modale de confirmation ("Supprimer cette note vocale et sa transcription ?"). Politique de retention configurable par l'admin : 30j, 90j, 1an, jamais. Les notes expirees sont placees en corbeille (soft delete) avec restauration possible pendant 30 jours. Purge definitive apres 30 jours en corbeille. Notification a l'utilisateur avant suppression automatique (7 jours avant). API : `DELETE /api/v1/voice/notes/:id`.

---

## Categorie 4 — Dictee (Speech-to-Text enrichie)

### 4.1 Mode dictee dans l'editeur
Bouton micro dans la toolbar de l'editeur Docs et Mail (icone micro, tooltip "Dicter", raccourci `Ctrl+Shift+D`). Activation = le texte dicte s'insere en temps reel a la position du curseur dans l'editeur. L'icone micro passe en rouge anime. Les mots apparaissent avec une animation de typing (lettre par lettre, 50ms par mot). Un curseur clignotant specifique "dictee" (barre orange au lieu de noire) indique la position d'insertion. Desactivation par clic sur le bouton micro, touche `Escape`, ou raccourci `Ctrl+Shift+D`. L'editeur reste entierement utilisable pendant la dictee (l'utilisateur peut editer avec le clavier simultanement, la dictee reprend a la nouvelle position du curseur). Pipeline : audio micro -> WebSocket -> signapps-media STT -> text frames -> insertion dans l'editeur.

### 4.2 Ponctuation automatique
Le moteur STT insere automatiquement la ponctuation (points, virgules, points d'interrogation, points d'exclamation) en fonction de l'intonation et des pauses. Trois niveaux de ponctuation configurable dans les preferences : **Agressif** (ponctuation maximale, ideal pour la dictee formelle), **Modere** (defaut, ponctuation aux pauses longues), **Desactive** (aucune ponctuation automatique). Premiere lettre apres un point automatiquement en majuscule. Les guillemets, parentheses et tirets ne sont pas auto-inseres (utiliser les commandes vocales de formatage, voir 4.3).

### 4.3 Commandes de formatage dictees
Pendant la dictee, des commandes speciales sont interpretees et executees au lieu d'etre transcrites :
- "Nouveau paragraphe" / "New paragraph" -> saut de paragraphe (deux retours a la ligne)
- "Retour a la ligne" / "New line" -> un seul retour a la ligne
- "Point" / "Virgule" / "Point d'interrogation" / "Point d'exclamation" -> ponctuation
- "Ouvrir les guillemets" / "Fermer les guillemets" -> `"` et `"`
- "Ouvrir parenthese" / "Fermer parenthese" -> `(` et `)`
- "En gras" -> active le gras, "Fin du gras" -> desactive
- "En italique" / "Fin de l'italique"
- "Titre" -> heading H2, "Sous-titre" -> heading H3
- "Liste a puces" -> commence une liste non ordonnee
- "Numero" -> commence une liste ordonnee
- "Tabulation" -> insere un tab
Les commandes sont reconnues par matching exact (pas fuzzy) pour eviter les faux positifs. Liste des commandes affichee dans un tooltip au survol du bouton micro.

### 4.4 Selection de la langue de dictee
Dropdown dans la toolbar de dictee pour choisir la langue : francais, anglais, espagnol, allemand, italien, portugais, neerlandais, arabe, chinois (simplifie), japonais, coreen, russe, turc, polonais, suedois, hindi, et "Auto" (detection automatique). Defaut : langue de l'interface utilisateur. Le changement de langue est instantane (pas de redemarrage du pipeline). Indicateur de la langue detectee affiche en temps reel quand "Auto" est selectionne (petit badge `FR` / `EN` a cote du bouton micro).

### 4.5 Vocabulaire personnalise pour la dictee
Page de configuration (`/voice/settings/dictionary`). L'utilisateur ajoute des mots a son dictionnaire personnel : noms propres de collegues, termes techniques du domaine, acronymes internes, noms de projets. Formulaire : mot, prononciation alternative optionnelle (ex: "SignApps" prononce "Sine Apps"), categorie. Le moteur STT priorise ces mots dans la reconnaissance (injectes comme prompt context). Limite : 200 mots par utilisateur. Synchronisation cross-device. Import/export CSV. Vocabulaire d'organisation (gere par l'admin) + vocabulaire personnel (gere par l'utilisateur). API : `GET /api/v1/voice/dictionary`, `POST /api/v1/voice/dictionary`.

### 4.6 Correction inline
Apres la dictee, les mots a faible confiance (<0.7) sont soulignes en pointilles orange dans l'editeur. Clic droit sur un mot souligne affiche un menu contextuel avec : les 3 alternatives suggerees par le moteur STT, "Ajouter au dictionnaire" (pour les faux positifs recurrents), "Ignorer". Raccourci clavier `Ctrl+.` pour passer au mot incertain suivant. Les corrections manuelles sont utilisees pour ameliorer la reconnaissance future (feedback loop vers le vocabulaire personnalise). Apres correction, le soulignement disparait.

### 4.7 Dictee multilingue dans un meme flux
Passer du francais a l'anglais dans la meme phrase : le moteur Whisper detecte le changement de langue au niveau du segment et transcrit correctement dans les deux langues. Utile pour les textes avec termes anglais courants ("Le meeting de ce matin a confirme le go to market strategy"). La detection est automatique quand le mode "Auto" est selectionne. Precision : bonne pour les melanges francais/anglais, correcte pour les autres paires de langues. Limitation : le changement de langue intra-mot n'est pas supporte (ex: "emailer" sera transcrit en francais).

### 4.8 Dictee dans les formulaires
Le bouton micro apparait dans tous les champs de texte de la plateforme (formulaires, champ de recherche, commentaires, descriptions de taches). Activation par clic sur l'icone micro a droite du champ ou par raccourci clavier global (configurable, defaut `Ctrl+Shift+D`). Le texte dicte est insere dans le champ actif. Pour les champs de recherche, la dictee declenche la recherche automatiquement apres 2 secondes de silence. Pour les champs multi-lignes, les commandes de formatage sont supportees. Pour les champs single-line, les retours a la ligne sont ignores.

### 4.9 Historique de dictee
Page `/voice/dictation/history` avec log des sessions de dictee. Chaque session affiche : date/heure, duree, nombre de mots dictes, taux de confiance moyen (pourcentage), module d'origine (Docs, Mail, Search...). Statistiques personnelles en haut de page : total de mots dictes (all-time), duree totale de dictee, taux de confiance moyen sur 30 jours, evolution graphique (sparkline). Utile pour suivre l'amelioration de la reconnaissance au fil du temps. API : `GET /api/v1/voice/dictation/stats`.

---

## Categorie 5 — Podcasts et contenus audio

### 5.1 Lecteur de podcasts integre
Player audio avec controls standard : play/pause (raccourci `Espace`), skip +10s/-10s (fleches gauche/droite), barre de progression cliquable, volume (slider + mute toggle), vitesse (dropdown 0.5x a 3x par increments de 0.25x). Affichage du titre, auteur, duree restante, couverture (pochette). Le player occupe un panneau fixe en bas de la page podcast. Waveform dans la barre de progression pour reperer les silences et les passages actifs. Position de lecture sauvegardee en quittant (reprise au meme endroit). Raccourci `M` pour muter.

### 5.2 Abonnement a des flux RSS
Ajouter une URL de flux RSS podcast dans le champ de recherche de l'onglet Podcasts. Le systeme valide le flux (detection du format RSS/Atom, extraction du titre et de la couverture). Confirmation d'abonnement. Le systeme recupere automatiquement les nouveaux episodes (polling configurable, defaut toutes les heures). Liste des abonnements avec : pochette, titre du podcast, nombre d'episodes, badge "X nouveaux" pour les episodes non ecoutes. Desabonnement en un clic. CRUD : `POST /api/v1/voice/podcasts/subscribe`, `GET /api/v1/voice/podcasts/subscriptions`, `DELETE /api/v1/voice/podcasts/subscriptions/:id`.

### 5.3 Transcription automatique des podcasts
Chaque episode telecharge est automatiquement transcrit en arriere-plan (placement en file d'attente). La transcription est synchronisee avec l'audio : chaque mot a un timestamp. Clic sur un mot dans la transcription navigue a ce moment dans l'audio. Recherche full-text dans les transcriptions de tous les podcasts. Indicateur de statut par episode : "Non transcrit", "En file", "Transcription en cours", "Transcrit". Option de desactiver la transcription automatique pour economiser les ressources. API : `GET /api/v1/voice/podcasts/episodes/:id/transcript`.

### 5.4 Chapitrage et resume
L'IA genere des chapitres et un resume pour chaque episode transcrit. Navigation par chapitres dans le player (liste cliquable dans le panneau lateral). Resume en 3-5 phrases affiche sous le titre de l'episode. Utile pour les longs episodes (>1h). Generation a la demande ou automatique (configurable). API : `POST /api/v1/voice/podcasts/episodes/:id/summarize`.

### 5.5 Podcasts internes (creation)
Creer un podcast interne a l'organisation : enregistrer un episode (meme interface que les notes vocales mais avec metadata enrichie), ajouter titre, description, couverture (upload image), tags. Publier dans le flux interne visible par tous les membres de l'organisation (ou un sous-groupe). Utile pour les communications internes, les onboarding audio, les newsletters vocales. Flux RSS interne genere automatiquement. API : `POST /api/v1/voice/podcasts/internal/episodes`.

### 5.6 Playlists et files de lecture
Creer des playlists de notes vocales, episodes de podcasts, enregistrements de meetings. Drag-drop pour reordonner. Lecture continue en arriere-plan. Queue de lecture modifiable (ajouter, retirer, reordonner). Bouton "Ajouter a la queue" sur chaque element audio de la plateforme. API : `POST /api/v1/voice/playlists`, `PATCH /api/v1/voice/playlists/:id/items`.

### 5.7 Ecoute en arriere-plan
Le player continue de jouer quand on navigue dans d'autres modules. Mini-player flottant persistant dans le coin inferieur droit (72px de haut) avec : pochette miniature, titre tronque, boutons play/pause et skip, barre de progression fine. Clic sur le mini-player ouvre le player complet. Le mini-player est au-dessus de tout le contenu (z-index eleve). Fermeture par clic sur l'icone X (arrete la lecture). Persistance cross-navigation via state global Zustand.

### 5.8 Bookmarks dans l'audio
Marquer des moments precis dans un podcast ou un enregistrement en cliquant sur l'icone bookmark (drapeau) dans le player. Chaque bookmark a un label editable et un timestamp. Les bookmarks sont listes dans un panneau lateral de l'episode. Clic sur un bookmark navigue directement au moment. Export des bookmarks en Markdown. API : `POST /api/v1/voice/bookmarks` avec `{audio_id, timestamp_seconds, label}`.

### 5.9 Partage de clips audio
Selectionner une portion de l'audio (debut-fin) via drag sur la waveform (handles gauche et droite avec preview du timestamp). Generer un lien de partage vers ce clip specifique. Le destinataire ecoute uniquement l'extrait avec sa transcription synchronisee. Options : expiration du lien, protection par mot de passe. Le clip est genere cote serveur (decoupe audio FFmpeg) et stocke dans `signapps-storage`. API : `POST /api/v1/voice/clips` avec `{audio_id, start_seconds, end_seconds}`.

### 5.10 Import/export de podcasts
Importer un fichier audio local comme episode (memes formats que 1.11). Exporter un podcast interne en flux RSS standard pour distribution externe (si autorise par l'admin). Le flux RSS exporte inclut : metadata du podcast (titre, description, auteur, couverture), liste des episodes avec enclosures audio. URL du flux RSS generee automatiquement. API : `GET /api/v1/voice/podcasts/internal/:id/rss`.

---

## Categorie 6 — Synthese vocale (Text-to-Speech)

### 6.1 Lecture a voix haute d'un document
Bouton "Lire a voix haute" (icone haut-parleur) dans la toolbar de Docs, Mail, Wiki. Le texte visible est synthetise et lu via le haut-parleur. Le mot en cours de lecture est surligné dans le document avec un fond bleu clair (karaoke-style) et le paragraphe en cours a un marqueur lateral. Controls flottants : play/pause, stop, vitesse (0.5x a 2x), precedent/suivant paragraphe. Raccourci : `Ctrl+Shift+L` pour demarrer/arreter la lecture. La lecture commence a la position du curseur ou au debut du document si aucun curseur. Pipeline : texte -> `POST /api/v1/voice/tts/synthesize` -> stream audio Opus via SSE -> lecture HTML5 Audio. API : `POST /api/v1/voice/tts/synthesize` avec `{text, voice_id, speed, format}`.

### 6.2 Catalogue de voix
Page `/voice/settings/voices` listant les voix disponibles. Chaque voix affiche : nom, langue, genre (homme/femme/neutre), description, echantillon audio (bouton play pour ecouter 5 secondes). Voix fournies par Piper TTS (modeles ONNX locaux). Langues disponibles : francais (3 voix), anglais (4 voix), espagnol (2 voix), allemand (2 voix), italien (2 voix), neerlandais, portugais, polonais, et plus selon les modeles installes. Telecharger de nouvelles voix depuis le gestionnaire de modeles (`signapps-runtime`). Voix par defaut configurable dans les preferences utilisateur. API : `GET /api/v1/voice/tts/voices`.

### 6.3 Parametres de voix
Ajustements disponibles dans le panneau de lecture et dans les preferences : vitesse de lecture (slider 0.5x a 2x, defaut 1x), hauteur/pitch (slider -50% a +50%, defaut 0%), volume (slider 0-100%, defaut 100%). Preview instantanee : chaque modification joue un court echantillon de 3 secondes avec les nouveaux parametres. Les parametres sont sauvegardes dans les preferences utilisateur et appliques a toutes les lectures futures.

### 6.4 TTS dans les notifications
Option dans les preferences de notification (`/notifications/preferences`) pour que les notifications de priorite haute soient lues a voix haute (annonce vocale). Configuration par type de notification : mentions directes (oui/non), rappels de reunion (oui/non), messages urgents (oui/non). La voix utilise la voix TTS par defaut de l'utilisateur. Volume de l'annonce vocale configurable independamment du volume systeme. Desactive automatiquement en mode DND.

### 6.5 Accessibilite lecteur d'ecran
Le TTS natif sert de lecteur d'ecran integre pour les utilisateurs malvoyants. Mode accessibilite activable dans les preferences (`/settings/accessibility`). Quand active : navigation par sections (H pour heading suivant, T pour tableau, L pour liste), lecture du contenu des cellules de tableur (avec coordonnees "Cellule A3 : valeur 1500"), description des graphiques generee par IA ("Graphique en barres montrant les ventes par mois, valeur maximale en mars avec 15000 euros"). Compatibilite avec les lecteurs d'ecran externes (NVDA, JAWS, VoiceOver) via ARIA attributes.

### 6.6 Generation audio pour partage
Bouton "Generer un audio" dans le menu d'un document ou d'un email. Genere un fichier MP3 (defaut) ou WAV de la version lue. Progression affichee pendant la generation (barre de progression avec estimation du temps). Le fichier est telecharge automatiquement ou partage via un lien. Options : voix, vitesse, format (MP3 128kbps, WAV 16bit, OGG Opus). Utile pour creer des versions audio de documents pour ecoute mobile (dans le train, en voiture). API : `POST /api/v1/voice/tts/generate` retourne un lien de telechargement.

### 6.7 Voix personnalisee (voice cloning)
L'utilisateur peut enregistrer un echantillon de sa propre voix (>30 secondes de parole continue) pour creer un modele TTS personnalise. Interface guidee : texte a lire affiche, enregistrement, validation de la qualite ("Audio suffisamment clair"), generation du modele (10-30 min). La voix clonee apparait dans le catalogue avec un badge "Ma voix". Utilisable pour les podcasts internes ou les messages vocaux. Necessite le consentement explicite (checkbox RGPD). Suppression du modele vocal a la demande. Stockage du modele dans `signapps-storage`, reference dans la table `voice_models`. API : `POST /api/v1/voice/tts/clone-voice` (multipart avec audio).

### 6.8 TTS multilingue dans un meme document
Si un document contient du texte en plusieurs langues, le moteur TTS detecte chaque section linguistique (via detection de langue par paragraphe) et utilise la voix appropriee automatiquement. Transition fluide entre les voix (pas de coupure). Si aucune voix n'est disponible pour une langue detectee, fallback vers la voix par defaut avec un warning "Voix non disponible pour [langue], lecture avec la voix par defaut".

---

## Categorie 7 — Audio tasks et automatisations

### 7.1 Audio-to-task
Enregistrer un court message vocal (bouton micro dans la barre d'actions rapides du module Tasks). L'IA extrait : titre de la tache (premiere phrase), description (reste du message), priorite estimee (haute si mots "urgent" / "critique" / "ASAP"), deadline si mentionnee ("pour vendredi" -> prochain vendredi). Preview editable dans un dialog avec les champs pre-remplis. Bouton "Creer la tache" envoie vers le module Tasks. PgEventBus event `voice.task.created`. API : `POST /api/v1/voice/audio-to-task` (multipart audio).

### 7.2 Audio-to-email
Dicter un email complet. L'IA structure le texte : objet (extrait de la premiere phrase), corps (paragraphes avec salutation et signature), destinataire (detecte si mentionne : "envoie un mail a Jean Dupont pour..."). Preview editable dans le composer Mail avec les champs pre-remplis. Si le destinataire est detecte, autocompletion depuis les contacts. Bouton "Envoyer" ou "Editer dans Mail" pour revenir au module. API : `POST /api/v1/voice/audio-to-email` (multipart audio).

### 7.3 Audio-to-event
Dicter "Reunion avec l'equipe marketing mardi prochain a 14h pendant 1h". L'IA parse les informations : titre ("Reunion equipe marketing"), date (mardi prochain), heure (14h), duree (1h), participants (equipe marketing -> recherche dans les groupes de l'annuaire). Preview editable dans le formulaire Calendar. API : `POST /api/v1/voice/audio-to-event` (multipart audio).

### 7.4 Traitement batch d'audio
Uploader plusieurs fichiers audio en une fois (multi-select dans le file picker ou drag-drop multiple). File d'attente avec progression individuelle (barre par fichier) et globale (barre totale + compteur "3/7 termines"). Resultats disponibles au fur et a mesure (le fichier transcrit est cliquable meme si les autres sont en cours). Notification quand tout est termine. Limite : 10 fichiers simultanement, 100 Mo par fichier. API : `POST /api/v1/voice/transcribe/batch` (multipart avec plusieurs fichiers).

### 7.5 Transcription programmee
Configurer une transcription automatique pour : tous les meetings d'un calendrier specifique (toggle dans les parametres Calendar), tous les fichiers audio uploades dans un dossier Drive particulier (configuration via `/voice/settings/auto-transcribe`). Les transcriptions generees automatiquement sont accessibles dans l'onglet Minutes et liees a l'element source. Notification a l'utilisateur quand une transcription automatique est terminee. API : `POST /api/v1/voice/auto-transcribe/rules`.

### 7.6 Webhook audio
Exposer un endpoint webhook qui accepte un POST avec un fichier audio et retourne la transcription en JSON. URL generee par l'admin dans `/voice/settings/webhooks`. Le webhook est protege par un secret HMAC dans le header `X-SignApps-Signature`. Response format : `{text, segments[], speakers[], language, duration_seconds}`. Utilisable par les workflows et les integrations externes (Zapier, n8n). Rate limit : 10 requetes/minute. API : `POST /api/v1/voice/webhook/transcribe`.

### 7.7 Pipeline audio personnalise
Enchainer des traitements : enregistrer -> transcrire -> resumer -> creer des taches -> envoyer par mail. Pipeline configurable dans les parametres vocaux. Interface : liste d'etapes drag-droppables (blocs : "Transcrire", "Resumer", "Extraire action items", "Creer taches", "Envoyer resume par email", "Sauvegarder dans Drive"). Chaque bloc a des parametres configurables. Les pipelines sont sauvegardes et reutilisables. Execution en arriere-plan avec notification de completion. API : `POST /api/v1/voice/pipelines`, `POST /api/v1/voice/pipelines/:id/execute`.

### 7.8 Traduction audio
Uploader un audio dans une langue et obtenir la transcription traduite dans une autre langue. Base sur le mode "translate" de Whisper (toute langue -> anglais) puis traduction AI vers la langue cible via `signapps-ai`. Interface : upload + selecteur langue source (auto ou manuelle) + selecteur langue cible. Resultat : transcription dans la langue source + traduction dans la langue cible, cote a cote. Support de 99 langues source. API : `POST /api/v1/voice/translate` avec `{audio, source_lang, target_lang}`.

---

## Categorie 8 — Analyse et intelligence vocale

### 8.1 Analyse de sentiment des meetings
Pour chaque meeting transcrit, l'IA detecte le sentiment global et par segment : positif (vert), neutre (gris), negatif (rouge). Visualisation en frise coloree sur la timeline du meeting (barre horizontale avec segments colores). Score global du meeting (0-100, avec interpretation : "Meeting globalement positif"). Utile pour les managers : identifier les meetings tendus, les sujets sensibles. API : `GET /api/v1/voice/transcriptions/:id/sentiment`.

### 8.2 Temps de parole par participant
Statistique de la duree de parole de chaque participant dans un meeting. Graphique en barres horizontales ou camembert. Pourcentage du temps total par participant. Detection des desequilibres : alerte si un participant depasse 60% du temps de parole. Comparaison avec la moyenne des meetings precedents du meme groupe. API inclus dans `GET /api/v1/voice/transcriptions/:id/analytics`.

### 8.3 Metriques de reunion
Dashboard par meeting : duree totale, nombre de participants, nombre de topics abordes (chapitres), nombre d'action items generes, ratio parole/silence (%), questions posees (compteur), decisions prises (compteur). Comparaison avec la moyenne des meetings de l'equipe (barre de benchmark). Score d'efficacite calcule par l'IA (0-100) base sur le ratio action items / duree. API : `GET /api/v1/voice/transcriptions/:id/analytics`.

### 8.4 Tendances sur la duree
Graphiques d'evolution sur la page `/voice/analytics` : duree moyenne des meetings par semaine/mois (ligne), nombre de meetings (barres), nombre d'action items generes (ligne), taux de completion des action items (pourcentage via integration Tasks). Periode configurable (30j, 90j, 6 mois, 1 an). Detection d'anomalies : alerte si la duree moyenne augmente de >20% par rapport au mois precedent. API : `GET /api/v1/voice/analytics/trends?period=90d`.

### 8.5 Detection de mots-cles et topics
Extraction automatique des mots-cles et topics principaux de chaque meeting. Tag cloud pondere (taille proportionnelle a la frequence). Liste avec nombre d'occurrences et segments associes (cliquables). Correlation avec les projets et taches en cours (si un mot-cle correspond a un nom de projet Tasks). Filtrage des meetings par mot-cle dans la recherche. API : `GET /api/v1/voice/transcriptions/:id/keywords`.

### 8.6 Coaching de communication
L'IA fournit des suggestions post-meeting dans un panneau "Coaching" : "Vous avez parle 65% du temps, considerez de poser plus de questions", "3 participants n'ont pas pris la parole", "Le meeting a dure 15 min de plus que prevu", "Vous avez utilise 42 mots de remplissage (euh, donc)". Les suggestions sont personnalisees par participant (chacun voit ses propres metriques). Desactivable dans les preferences. Score de communication (0-100) avec evolution sur les 10 derniers meetings.

### 8.7 Comparaison inter-reunions
Comparer deux meetings sur les memes sujets : selection de 2 meetings dans l'historique, vue split-screen. Comparaison : quelles decisions ont change, quels action items sont recurrents (signifiant qu'ils ne sont pas executes), quels topics reviennent systematiquement, evolution du sentiment, evolution du temps de parole par participant. Utile pour les retrospectives et les suivis de projet.

### 8.8 Filler words detection
Compteur de mots de remplissage ("euh", "donc", "voila", "you know", "like", "basically", "literally") par participant. Score de fluence (0-100, ou 100 = zero filler word). Tendance sur le temps (sparkline sur les 10 derniers meetings). Classement par participant (sans jugement, presente comme outil d'amelioration personnelle). Les filler words sont marques en gris leger dans la transcription (optionnel, toggle dans les preferences).

---

## Categorie 9 — Securite, conformite et confidentialite

### 9.1 Consentement d'enregistrement
Avant de demarrer un enregistrement dans un meeting, tous les participants sont notifies avec un bandeau rouge en haut de l'ecran "Cet appel est enregistre" (icone micro + texte). Le bandeau est permanent pendant toute la duree de l'enregistrement. Dans les meetings Meet, chaque participant voit la notification dans son interface. Le host ne peut pas enregistrer discretement. Si un participant rejoint apres le debut de l'enregistrement, il voit le bandeau immediatement. Option de configuration par l'admin : consentement passif (notification) ou actif (chaque participant doit cliquer "J'accepte" pour continuer).

### 9.2 Chiffrement des fichiers audio
Tous les fichiers audio sont chiffres au repos (AES-256-GCM) dans `signapps-storage`. Les transcriptions sont stockees en base de donnees PostgreSQL avec chiffrement au niveau colonne pour les donnees sensibles (colonne `transcript_encrypted` de type `BYTEA`). La cle de chiffrement est derivee de la cle maitre de l'organisation. Transit : HTTPS obligatoire pour les API REST, WSS pour les WebSocket. Les fichiers audio temporaires (pendant le traitement STT) sont supprimes immediatement apres la transcription.

### 9.3 Retention configurable
L'administrateur definit la politique de retention dans `/admin/voice/retention` : les enregistrements audio et transcriptions sont automatiquement supprimes apres X jours (30, 90, 365, jamais). Configuration possible par service (meetings, notes vocales, podcasts), par equipe, ou global. Job cron quotidien qui purge les elements expires. Notification 7 jours avant suppression aux proprietaires. Les elements sous sequestre legal (voir 9.8) ne sont jamais supprimes.

### 9.4 PII redaction
L'IA detecte automatiquement les informations personnelles dans les transcriptions : numeros de telephone (regex + NER), adresses email, adresses postales, numeros de securite sociale, IBAN, numeros de carte bancaire, noms de medicaments. Les PII detectees sont masquees ou supprimees selon la politique : remplacement par `[TELEPHONE]`, `[EMAIL]`, `[ADRESSE]`, etc. Mode preview : l'admin voit les PII detectees avec option de confirmer ou rejeter avant masquage. Configurable par type de PII. API : `POST /api/v1/voice/transcriptions/:id/redact`.

### 9.5 Controle d'acces granulaire
Les enregistrements et transcriptions heritent des permissions du meeting ou du document parent. Partage explicite requis pour donner acces a un non-participant via `POST /api/v1/voice/transcriptions/:id/share`. L'admin peut revoquer l'acces a tout moment. Permissions : lecture audio, lecture transcription, edition transcription, export, partage. Verification JWT sur chaque endpoint. Un utilisateur ne peut jamais acceder aux transcriptions d'un meeting auquel il n'a pas participe (sauf partage explicite).

### 9.6 Audit log
Chaque action est loguee dans la table `voice_audit_log` : enregistrement demarre/arrete (user_id, meeting_id, timestamp), transcription generee, fichier audio telecharge, transcription exportee, acces en lecture, modification de transcription, partage, suppression. Log immuable (INSERT only, pas de UPDATE/DELETE). Exportable en CSV/JSON pour conformite. Retention du log : 2 ans minimum. API admin : `GET /api/v1/voice/admin/audit-log?from=&to=&user=&action=`.

### 9.7 Traitement local uniquement
Par defaut, tout l'audio est traite sur le serveur SignApps (whisper-rs pour STT, piper-rs pour TTS). Aucune donnee n'est envoyee a un service cloud. Si l'admin configure un provider cloud (OpenAI Whisper API, AssemblyAI, Deepgram), un avertissement est affiche dans les parametres : "Les donnees audio seront envoyees a [provider]. Consentement requis." L'utilisateur voit un badge "Cloud" sur les transcriptions traitees via un provider externe. Configuration dans `/admin/voice/providers`.

### 9.8 Sequestre legal (legal hold)
Possibilite de placer un enregistrement et sa transcription sous sequestre : aucune modification, suppression ou expiration possible tant que le hold est actif. Declenche par l'admin ou le compliance officer via `/admin/voice/legal-holds`. Interface : selectionner les enregistrements, motif du hold, date de debut. Badge "Legal hold" affiche sur les elements concernes. Tentative de suppression = erreur "Cet element est sous sequestre legal". API : `POST /api/v1/voice/admin/legal-holds`.

### 9.9 Classification des enregistrements
Chaque enregistrement peut etre classifie (Public, Interne, Confidentiel, Secret) avec heritage des regles de partage et d'export associees. Classification par defaut configurable par l'admin (defaut : Interne). Bandeau de classification colore en haut du player. Export bloque pour les enregistrements classifies "Secret". Partage externe bloque pour "Confidentiel" et "Secret".

### 9.10 RGPD et droit a l'oubli
Un utilisateur peut demander la suppression de toutes ses donnees vocales : enregistrements ou il est speaker, notes vocales, empreinte vocale, modele de voix clone. Processus : l'utilisateur fait la demande via `/settings/privacy/voice-data`, l'admin recoit une notification, validation en 72h max, suppression irreversible avec confirmation email. Les segments de meetings multi-participants ou l'utilisateur est speaker sont anonymises ("Speaker anonyme") au lieu d'etre supprimes. API : `POST /api/v1/voice/gdpr/delete-request`.

---

## Categorie 10 — Performance, accessibilite et mobile

### 10.1 Streaming WebSocket bidirectionnel
Le flux audio est envoye au serveur en chunks PCM f32le 16kHz mono via WebSocket (`WS /api/v1/voice`). Binary frames pour l'audio (chunks de 4096 samples = 256ms). Text frames JSON pour le controle : `{"type": "start", "language": "auto", "model": "large-v3"}`, `{"type": "stop"}`, `{"type": "pause"}`. Le serveur repond avec text frames JSON : `{"type": "partial", "text": "en cours"}` (resultats intermediaires), `{"type": "segment", "text": "Phrase complete.", "speaker": 0, "start": 12.5, "end": 15.2, "confidence": 0.94}` (segments finalises). Protocole documente dans `/docs/websocket-voice-protocol.md`. Reconnexion automatique avec reprise du contexte si la connexion est perdue.

### 10.2 Modeles STT adaptatifs
Selection automatique du modele Whisper selon le materiel disponible : `large-v3` si GPU avec >6 Go VRAM (meilleure qualite), `medium` si GPU modeste (2-6 Go), `small` si CPU seul (qualite correcte, latence plus elevee), `tiny` pour les devices mobiles ou faibles (qualite basique). Configuration manuelle possible dans `/admin/voice/models`. Telechargement automatique du modele au premier usage via `signapps-runtime` ModelManager. Indicateur dans les parametres : "Modele actuel : large-v3 (GPU NVIDIA RTX 3080, 10 Go VRAM)". API : `GET /api/v1/voice/stt/models`, `PATCH /api/v1/voice/stt/models/active`.

### 10.3 File d'attente pour les traitements longs
Les transcriptions de fichiers volumineux (>10 min) sont placees dans une file d'attente avec progression visible : pourcentage (barre de progression), temps restant estime, position dans la file ("3e en file d'attente"). L'utilisateur peut continuer a utiliser la plateforme pendant le traitement. Notification push et in-app quand la transcription est terminee. Priorite : les enregistrements en cours (live) sont traites en priorite, les imports batch sont traites en arriere-plan. Queue geree par la table `voice_jobs` en PostgreSQL.

### 10.4 Cache audio intelligent
Les enregistrements recents sont gardes en cache local (IndexedDB) pour relecture immediate sans recharger depuis le serveur. Purge automatique quand le cache depasse la taille configuree (100 Mo par defaut). Strategie LRU (Least Recently Used). Les fichiers volumineux (>50 Mo) ne sont pas caches. Indicateur dans le player : icone eclair si lecture depuis le cache.

### 10.5 Accessibilite WCAG AA
Navigation complete au clavier dans tous les players et controles. Labels ARIA sur tous les boutons (`aria-label="Lire"`, `aria-label="Pause"`, `aria-label="Avancer de 10 secondes"`). Transcriptions automatiques pour tout contenu audio (pas de contenu "audio-only" sans alternative textuelle). Focus visible sur tous les elements interactifs (outline 2px bleu). Annonce des changements de statut par les lecteurs d'ecran (`aria-live="polite"` pour les mises a jour de progression). Contraste AA sur toutes les couleurs de l'interface.

### 10.6 Mode hors-ligne
Enregistrement de notes vocales en mode deconnecte. Stockees localement dans IndexedDB et transcrites au retour en ligne (synchronisation automatique). Les podcasts telecharges sont disponibles hors-ligne. Indicateur "Hors ligne" dans le header. Les commandes vocales et la dictee fonctionnent en mode degrade (modele `tiny` dans le navigateur via WASM si disponible, sinon file d'attente pour traitement au retour en ligne).

### 10.7 Mobile responsive
Interface tactile optimisee : bouton d'enregistrement large et centre (80px, easy-tap), gestes de swipe pour naviguer entre les notes (swipe gauche/droite), player avec controles tactiles (boutons 44px minimum), enregistrement en arriere-plan quand l'ecran est verrouille (via Service Worker et MediaRecorder). Layout single-column. Waveform simplifiee sur mobile (moins de points pour performance). Le mini-player flottant est positionne en bas de l'ecran avec une hauteur de 64px.

### 10.8 Compression audio intelligente
L'audio brut PCM est compresse en Opus/OGG pour le stockage (ratio 10:1 sans perte perceptible a 64kbps). L'audio PCM 16kHz est utilise uniquement pour le traitement STT (pipeline interne). Le frontend envoie en WebM/Opus (compresse nativement par MediaRecorder). Economie de stockage significative : 1h d'audio = ~30 Mo en Opus vs ~300 Mo en PCM. Les fichiers importes (MP3, WAV, FLAC) sont conserves dans leur format original et un transcode Opus est genere pour le streaming.

### 10.9 Notification de fin de traitement
Quand une transcription longue est terminee, l'utilisateur recoit : notification push navigateur (si autorisee), notification in-app (badge dans la cloche), email optionnel (si configure). La notification contient un lien direct vers la transcription. PgEventBus event `voice.transcription.completed` traite par le service notifications (port 8095).

### 10.10 API REST et WebSocket documentees
Endpoints documentes via OpenAPI (Swagger UI sur `/swagger-ui/` du service `signapps-media`, port 3009) :
- `POST /api/v1/stt/transcribe` — transcription batch (multipart audio file)
- `POST /api/v1/stt/transcribe/batch` — transcription batch multi-fichiers
- `GET /api/v1/stt/transcribe/stream` — transcription streaming (SSE)
- `POST /api/v1/tts/synthesize` — synthese vocale (retourne audio stream)
- `POST /api/v1/tts/generate` — generation fichier audio complet
- `POST /api/v1/tts/clone-voice` — creation voix personnalisee
- `GET /api/v1/voice` — WebSocket full-duplex (STT live pipeline)
- `GET /api/v1/tts/voices` — catalogue des voix disponibles
- `GET /api/v1/stt/models` — modeles STT disponibles
- `PATCH /api/v1/stt/models/active` — changer le modele actif

---

## Schema PostgreSQL

```sql
-- Transcriptions (meetings et imports)
CREATE TABLE voice_transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(512),
    source_type VARCHAR(32) NOT NULL, -- meeting, import, note
    source_meeting_id UUID, -- reference to meet event if applicable
    audio_storage_key TEXT NOT NULL, -- reference in signapps-storage
    audio_duration_seconds FLOAT NOT NULL,
    audio_format VARCHAR(32) NOT NULL, -- opus, mp3, wav, webm
    audio_size_bytes BIGINT NOT NULL,
    language VARCHAR(8), -- detected or specified (fr, en, auto)
    model_used VARCHAR(64), -- whisper-large-v3, whisper-medium, etc.
    transcript_text TEXT, -- full text (denormalized for search)
    transcript_segments JSONB DEFAULT '[]', -- [{text, start, end, speaker, confidence}]
    chapters JSONB DEFAULT '[]', -- [{title, start, end, speaker_ids}]
    summary JSONB, -- {executive, key_points[], decisions[], action_items[], open_questions[]}
    keywords TEXT[] DEFAULT '{}',
    speakers JSONB DEFAULT '[]', -- [{index, label, user_id, color}]
    sentiment_score FLOAT, -- 0.0 to 1.0 overall
    sentiment_segments JSONB DEFAULT '[]', -- [{start, end, sentiment, score}]
    status VARCHAR(32) NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed
    processing_progress FLOAT DEFAULT 0.0, -- 0.0 to 1.0
    error_message TEXT,
    classification VARCHAR(32) DEFAULT 'internal', -- public, internal, confidential, secret
    legal_hold BOOLEAN DEFAULT FALSE,
    retention_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transcriptions_owner ON voice_transcriptions(owner_id);
CREATE INDEX idx_transcriptions_status ON voice_transcriptions(status);
CREATE INDEX idx_transcriptions_search ON voice_transcriptions USING gin(to_tsvector('french', transcript_text));

-- Highlights / bookmarks dans les transcriptions
CREATE TABLE voice_highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transcription_id UUID NOT NULL REFERENCES voice_transcriptions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    segment_index INT NOT NULL,
    timestamp_seconds FLOAT NOT NULL,
    label VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_highlights_transcription ON voice_highlights(transcription_id);

-- Notes vocales
CREATE TABLE voice_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    audio_storage_key TEXT NOT NULL,
    audio_duration_seconds FLOAT NOT NULL,
    audio_format VARCHAR(32) NOT NULL,
    audio_size_bytes BIGINT NOT NULL,
    transcript_text TEXT,
    transcript_segments JSONB DEFAULT '[]',
    confidence_score FLOAT,
    tags TEXT[] DEFAULT '{}',
    context_type VARCHAR(32), -- calendar_event, document, contact, task, null
    context_id UUID,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    retention_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_owner ON voice_notes(owner_id);
CREATE INDEX idx_notes_context ON voice_notes(context_type, context_id) WHERE context_type IS NOT NULL;
CREATE INDEX idx_notes_search ON voice_notes USING gin(to_tsvector('french', transcript_text));

-- Empreintes vocales (pour diarisation automatique)
CREATE TABLE voice_prints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    embedding VECTOR(192) NOT NULL, -- speaker embedding
    sample_audio_key TEXT, -- reference audio sample in storage
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

-- Modeles TTS personnalises (voice cloning)
CREATE TABLE voice_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    model_storage_key TEXT NOT NULL,
    language VARCHAR(8) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'processing', -- processing, ready, failed
    consent_given_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vocabulaire personnalise
CREATE TABLE voice_vocabulary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope VARCHAR(32) NOT NULL, -- organization, user
    scope_id UUID NOT NULL, -- org_id or user_id
    word VARCHAR(255) NOT NULL,
    pronunciation VARCHAR(255),
    category VARCHAR(64), -- name, acronym, technical
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(scope, scope_id, word)
);

-- File d'attente des jobs audio
CREATE TABLE voice_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(32) NOT NULL, -- transcribe, summarize, translate, tts_generate, clone_voice
    input_data JSONB NOT NULL, -- job-specific parameters
    status VARCHAR(32) NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed
    progress FLOAT DEFAULT 0.0,
    priority INT DEFAULT 5, -- 1=highest, 10=lowest
    result_data JSONB,
    error_message TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jobs_status_priority ON voice_jobs(status, priority) WHERE status = 'queued';

-- Abonnements podcasts
CREATE TABLE voice_podcast_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    feed_url TEXT NOT NULL,
    title VARCHAR(512),
    author VARCHAR(255),
    cover_image_url TEXT,
    last_polled_at TIMESTAMPTZ,
    poll_interval_minutes INT DEFAULT 60,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, feed_url)
);

-- Episodes de podcasts
CREATE TABLE voice_podcast_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES voice_podcast_subscriptions(id) ON DELETE CASCADE,
    internal_podcast_id UUID, -- for internally created podcasts
    title VARCHAR(512) NOT NULL,
    description TEXT,
    audio_url TEXT NOT NULL,
    audio_storage_key TEXT, -- local cached copy
    duration_seconds FLOAT,
    cover_image_url TEXT,
    published_at TIMESTAMPTZ,
    is_listened BOOLEAN DEFAULT FALSE,
    listen_position_seconds FLOAT DEFAULT 0.0,
    transcription_id UUID REFERENCES voice_transcriptions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Playlists audio
CREATE TABLE voice_playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    items JSONB DEFAULT '[]', -- [{type: "note"|"episode"|"transcription", id: "uuid"}]
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clips audio partages
CREATE TABLE voice_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(32) NOT NULL, -- transcription, note, episode
    source_id UUID NOT NULL,
    start_seconds FLOAT NOT NULL,
    end_seconds FLOAT NOT NULL,
    clip_storage_key TEXT NOT NULL,
    share_token VARCHAR(64) UNIQUE,
    expires_at TIMESTAMPTZ,
    password_hash VARCHAR(255),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pipelines audio personnalises
CREATE TABLE voice_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    steps JSONB NOT NULL, -- [{type: "transcribe", config: {}}, {type: "summarize"}, ...]
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Regles de transcription automatique
CREATE TABLE voice_auto_transcribe_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    rule_type VARCHAR(32) NOT NULL, -- calendar, drive_folder
    target_id UUID NOT NULL, -- calendar_id or folder_id
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Log d'audit vocal
CREATE TABLE voice_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(64) NOT NULL, -- recording_started, recording_stopped, transcription_generated, audio_downloaded, transcript_exported, access_read, transcript_edited, shared, deleted
    entity_type VARCHAR(32) NOT NULL, -- transcription, note, clip, episode
    entity_id UUID NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_voice_audit_date ON voice_audit_log(created_at DESC);

-- Historique de dictee
CREATE TABLE voice_dictation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    module VARCHAR(32) NOT NULL, -- docs, mail, search, tasks, chat
    duration_seconds FLOAT NOT NULL,
    word_count INT NOT NULL,
    avg_confidence FLOAT,
    language VARCHAR(8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dictation_user ON voice_dictation_sessions(user_id);

-- Commandes vocales (historique)
CREATE TABLE voice_command_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    recognized_text TEXT NOT NULL,
    interpreted_command VARCHAR(128),
    action_executed VARCHAR(255),
    status VARCHAR(16) NOT NULL, -- success, failure, unrecognized
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_commands_user ON voice_command_log(user_id);
```

---

## REST API Endpoints

All endpoints require JWT authentication. Base path: `signapps-media` service, port 3009.

### Transcription (STT)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/stt/transcribe` | Transcribe audio file (multipart) |
| POST | `/api/v1/stt/transcribe/batch` | Batch transcription (multiple files) |
| GET | `/api/v1/stt/transcribe/stream` | SSE stream for transcription progress |
| WS | `/api/v1/voice` | WebSocket full-duplex (live STT) |
| WS | `/api/v1/voice/record` | WebSocket for recording + live STT |
| GET | `/api/v1/stt/models` | List available STT models |
| PATCH | `/api/v1/stt/models/active` | Set active model |

### Transcriptions CRUD
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/voice/transcriptions` | List user transcriptions |
| GET | `/api/v1/voice/transcriptions/:id` | Get transcription detail |
| PATCH | `/api/v1/voice/transcriptions/:id` | Update (edit text, title) |
| DELETE | `/api/v1/voice/transcriptions/:id` | Delete transcription |
| PATCH | `/api/v1/voice/transcriptions/:id/speakers` | Associate speakers |
| POST | `/api/v1/voice/transcriptions/:id/summarize` | Generate AI summary |
| POST | `/api/v1/voice/transcriptions/:id/highlights` | Add highlight |
| GET | `/api/v1/voice/transcriptions/:id/export?format=` | Export (PDF/MD/DOCX/SRT/VTT/JSON) |
| POST | `/api/v1/voice/transcriptions/:id/share` | Generate share link |
| POST | `/api/v1/voice/transcriptions/:id/redact` | PII redaction |
| GET | `/api/v1/voice/transcriptions/:id/analytics` | Meeting analytics |
| GET | `/api/v1/voice/transcriptions/:id/sentiment` | Sentiment analysis |
| GET | `/api/v1/voice/transcriptions/:id/keywords` | Keywords extraction |

### Voice Notes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/voice/notes` | List notes |
| GET | `/api/v1/voice/notes/:id` | Get note detail |
| WS | `/api/v1/voice/notes/record` | WebSocket for note recording |
| PATCH | `/api/v1/voice/notes/:id` | Update (edit transcript, tags, context) |
| PATCH | `/api/v1/voice/notes/:id/tags` | Update tags |
| DELETE | `/api/v1/voice/notes/:id` | Delete note |
| POST | `/api/v1/voice/notes/:id/share` | Generate share link |

### Text-to-Speech
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/tts/synthesize` | Synthesize text to audio stream |
| POST | `/api/v1/tts/generate` | Generate audio file (download) |
| GET | `/api/v1/tts/voices` | List available voices |
| POST | `/api/v1/tts/clone-voice` | Create custom voice (multipart) |
| DELETE | `/api/v1/tts/voices/:id` | Delete custom voice |

### Search
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/voice/search?q=&from=&to=&speaker=` | Full-text search across transcriptions |

### Audio Tasks
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/voice/audio-to-task` | Convert audio to task |
| POST | `/api/v1/voice/audio-to-email` | Convert audio to email |
| POST | `/api/v1/voice/audio-to-event` | Convert audio to calendar event |
| POST | `/api/v1/voice/translate` | Translate audio |

### Podcasts
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/voice/podcasts/subscribe` | Subscribe to RSS feed |
| GET | `/api/v1/voice/podcasts/subscriptions` | List subscriptions |
| DELETE | `/api/v1/voice/podcasts/subscriptions/:id` | Unsubscribe |
| GET | `/api/v1/voice/podcasts/episodes/:id/transcript` | Get episode transcript |
| POST | `/api/v1/voice/podcasts/episodes/:id/summarize` | Summarize episode |
| POST | `/api/v1/voice/podcasts/internal/episodes` | Create internal episode |
| GET | `/api/v1/voice/podcasts/internal/:id/rss` | Get internal RSS feed |

### Playlists & Clips
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/voice/playlists` | Create playlist |
| PATCH | `/api/v1/voice/playlists/:id/items` | Update playlist items |
| POST | `/api/v1/voice/clips` | Create audio clip |

### Pipelines & Automation
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/voice/pipelines` | Create pipeline |
| POST | `/api/v1/voice/pipelines/:id/execute` | Execute pipeline |
| POST | `/api/v1/voice/auto-transcribe/rules` | Create auto-transcribe rule |
| POST | `/api/v1/voice/webhook/transcribe` | Webhook transcription endpoint |

### Vocabulary & Settings
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/voice/vocabulary` | List vocabulary |
| POST | `/api/v1/voice/vocabulary` | Add word |
| DELETE | `/api/v1/voice/vocabulary/:id` | Remove word |
| GET | `/api/v1/voice/dictionary` | Personal dictionary |
| POST | `/api/v1/voice/dictionary` | Add to personal dictionary |
| GET | `/api/v1/voice/dictation/stats` | Dictation statistics |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/voice/analytics/trends?period=` | Meeting trends over time |

### Admin / GDPR
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/voice/admin/audit-log` | Audit log (admin) |
| POST | `/api/v1/voice/admin/legal-holds` | Create legal hold (admin) |
| POST | `/api/v1/voice/gdpr/delete-request` | GDPR deletion request |

---

## PgEventBus Events

| Event | Payload | Consumers |
|-------|---------|-----------|
| `voice.recording.started` | `{transcription_id, user_id, meeting_id}` | meet (banner display) |
| `voice.recording.stopped` | `{transcription_id, user_id, duration}` | meet, notifications |
| `voice.transcription.completed` | `{transcription_id, user_id, duration, word_count}` | notifications, dashboard, calendar |
| `voice.transcription.failed` | `{transcription_id, user_id, error}` | notifications |
| `voice.meeting.transcribed` | `{transcription_id, meeting_id, participants[]}` | notifications, calendar |
| `voice.action_item.detected` | `{transcription_id, description, assignee, deadline}` | tasks |
| `voice.note.created` | `{note_id, user_id, context_type, context_id}` | notifications, context module |
| `voice.note.convert_to_doc` | `{note_id, transcript_text}` | docs |
| `voice.tts.completed` | `{job_id, user_id, audio_url}` | notifications |
| `voice.pipeline.completed` | `{pipeline_id, user_id, results}` | notifications |

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Otter.ai Help Center** (help.otter.ai) — documentation sur la transcription, la diarisation, les integrations, les resumes AI.
- **Fireflies.ai Blog** (fireflies.ai/blog) — articles sur la conversation intelligence, les patterns de transcription de meetings.
- **Whisper GitHub** (github.com/openai/whisper) — documentation du modele, benchmarks multi-langues, architecture.
- **Faster-Whisper** (github.com/SYSTRAN/faster-whisper) — implementation CTranslate2 4x plus rapide que le Whisper original, API compatible.
- **Piper TTS** (github.com/rhasspy/piper) — documentation des voix disponibles, formats supportes, configuration.
- **AssemblyAI Docs** (assemblyai.com/docs) — documentation API exhaustive sur les features STT avancees (diarization, summarization, PII redaction).
- **Deepgram Docs** (developers.deepgram.com) — documentation sur le streaming temps reel, les modeles, le smart formatting.
- **Web Speech API MDN** (developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) — standard W3C pour la reconnaissance vocale cote navigateur.

---

## Assertions E2E cles (a tester)

- Demarrer un enregistrement, verifier l'indicateur rouge et le compteur de duree
- Pendant l'enregistrement live, les mots apparaissent en temps reel dans le panneau de transcription
- Arreter l'enregistrement, verifier que la transcription complete est disponible
- Speaker diarization : au moins 2 speakers identifies dans un audio multi-locuteurs
- Association manuelle d'un speaker a un contact de l'annuaire
- Resume AI genere avec les 5 sections (executif, points cles, decisions, actions, questions)
- Action items detectes et creables en tache via bouton one-click
- Chapitrage : navigation par chapitre dans la timeline
- Highlights : marquer un segment, le retrouver dans le panneau highlights
- Recherche full-text : trouver un terme dans une transcription passee
- Import audio : uploader un MP3, obtenir la transcription
- Export : telecharger en PDF/SRT/JSON
- Commande vocale "Dashboard" navigue vers /dashboard
- Commande vocale "Nouvelle tache urgente" cree une tache
- Note vocale : enregistrer, verifier la transcription automatique
- Waveform : clic sur la waveform positionne la lecture correctement
- Tags sur note vocale : ajouter et filtrer par tag
- Dictee dans Docs : dicter du texte, verifier l'insertion a la position du curseur
- Ponctuation automatique : verifier la presence de points et virgules
- Commande "Nouveau paragraphe" pendant la dictee insere un saut de ligne
- TTS : bouton "Lire a voix haute" synthetise le texte du document
- Catalogue de voix : choisir une voix, preview l'echantillon
- Generation audio : telecharger un MP3 depuis un document
- Podcast RSS : ajouter un flux, verifier le telechargement des episodes
- Mini-player : la lecture continue en naviguant entre les modules
- Partage de clip : selectionner une portion, generer un lien, verifier l'acces
- PII redaction : verifier que les numeros de telephone sont masques
- Consentement : le bandeau "Appel enregistre" est visible par tous les participants
- Mode hors-ligne : enregistrer une note, verifier la sync au retour en ligne
- Mobile : les boutons d'enregistrement sont assez grands (>44px)

---

## Historique

| Date | Modification |
|---|---|
| 2026-04-09 | Creation de la specification initiale — 10 categories, 8 pipelines audio, benchmark 14 concurrents |
| 2026-04-10 | Enrichissement P0 : recording UI details, waveform visualizer, WebSocket protocol, PostgreSQL schema (16 tables), REST API (60+ endpoints), PgEventBus events, dictation mode detail, transcript editor, speaker diarization flow |
