# Module Voice & Audio — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Otter.ai** | Transcription temps réel de meetings, résumés automatiques, action items détectés, intégration Zoom/Teams/Meet, speaker identification, vocabulaire custom, live captions, highlight & comment sur transcription, search full-text dans l'historique |
| **Fireflies.ai** | Bot qui rejoint les meetings automatiquement, transcription + résumé AI, détection de topics/sentiments/questions, intégration CRM, AskFred (chat AI sur les meetings), soundbites (clips audio partageables), conversation intelligence analytics |
| **Grain** | Enregistrement + highlights, découpage automatique en moments clés, partage de clips vidéo/audio, summary AI, intégration Slack/Notion/HubSpot, coaching insights, playlists de moments |
| **tl;dv** | Enregistrement gratuit de meetings, timestamps automatiques, résumés AI multi-langues, meeting notes templates, intégration Notion/Slack/CRM, speaker analytics |
| **Fathom** | Transcription + résumé instantané post-meeting, action items auto-détectés, highlights one-click, intégration CRM auto-fill, team meeting dashboard |
| **Loom** | Enregistrement asynchrone (audio+écran), transcription automatique, viewer analytics, comments timecoded, chapitrage auto, call-to-action intégrés |
| **Rev** | Transcription humaine + AI hybride, captions pour vidéos, multi-langues, vocabulaire custom, timestamps précis, API robuste |
| **Descript** | Édition audio/vidéo par le texte (supprimer un mot dans la transcription supprime l'audio), overdub (voix synthétique), filler word removal, studio sound, multitrack |
| **Whisper (OpenAI)** | Open source (MIT), multi-lingue (99 langues), word-level timestamps, speaker diarization, modèles de tailles variées (tiny→large), exécution locale possible, Faster-Whisper (CTranslate2) pour 4x speedup |
| **AssemblyAI** | API-first, résumés, détection de topics/entités/sentiments, PII redaction, custom vocabulary, real-time streaming, speaker labels, dual channel |
| **Deepgram** | STT ultra-rapide (streaming <300ms), Nova-2 model, topic detection, summarization, diarization, intent recognition, smart formatting, keyterms |
| **Piper TTS** | Open source (MIT), voix haute qualité, multi-langues (dont français), léger, exécutable localement, VITS/ONNX, idéal pour TTS embarqué |
| **Coqui TTS** | Open source, clonage de voix, multi-speaker, XTTS v2, streaming, fine-tuning, multi-langues |

## Principes directeurs

1. **Natif et local par défaut** — transcription et synthèse vocale fonctionnent sans service cloud, grâce aux moteurs embarqués (Whisper via whisper-rs, Piper TTS via piper-rs). Aucune donnée audio ne quitte le serveur sauf configuration explicite.
2. **Temps réel prioritaire** — la transcription live doit afficher les mots <500ms après qu'ils soient prononcés, avec streaming WebSocket bidirectionnel.
3. **Speaker-aware** — la diarisation (identification des locuteurs) est activée par défaut dans les réunions, avec association automatique aux utilisateurs connus de l'annuaire.
4. **Multi-langue transparent** — détection automatique de la langue parlée, transcription et traduction simultanée vers la langue de l'interface utilisateur.
5. **Exploitable, pas juste archivé** — chaque transcription produit des artefacts actionnables : résumé, action items, décisions, topics, mots-clés. Indexé et cherchable.
6. **Intégré cross-module** — les transcriptions de Meet alimentent le Wiki, les action items créent des Tasks, les notes vocales s'attachent aux documents Drive, les commandes vocales naviguent dans toute la plateforme.

---

## Catégorie 1 — Transcription de meetings (Minutes)

### 1.1 Enregistrement d'un meeting en cours
Bouton `Démarrer l'enregistrement` dans l'onglet Minutes. Capture l'audio du microphone local en PCM 16kHz mono. Indicateur visuel rouge clignotant pendant l'enregistrement. Compteur de durée en temps réel. Boutons `Pause` et `Arrêter`.

### 1.2 Transcription temps réel (live captions)
Pendant l'enregistrement, les mots apparaissent en temps réel dans le panneau de transcription, par blocs de segments (phrases). Chaque segment affiche le timestamp de début et le nom du locuteur détecté. Latence cible <500ms entre la parole et l'affichage.

### 1.3 Speaker diarization automatique
Le moteur STT identifie automatiquement les différents locuteurs (Speaker 1, Speaker 2...) via l'analyse de la voix. Si le meeting est un Meet SignApps, les speakers sont automatiquement associés aux participants connus (via empreinte vocale ou association manuelle).

### 1.4 Association manuelle des speakers
Après l'enregistrement, l'utilisateur peut cliquer sur un label "Speaker 1" pour l'associer à un contact de l'annuaire. L'association se propage à tous les segments de ce speaker. Mémorisation pour les meetings futurs avec les mêmes participants.

### 1.5 Résumé automatique AI
À la fin du meeting (ou à la demande), le module AI génère :
- **Résumé exécutif** (3-5 phrases)
- **Points clés** (liste à puces)
- **Décisions prises** (formulation assertive)
- **Action items** (tâche, assigné, deadline si mentionnée)
- **Questions ouvertes** (non résolues)
Le résumé est éditable et versionné.

### 1.6 Détection automatique d'action items
L'IA identifie les phrases de type engagement ("je m'en occupe", "il faut qu'on fasse", "d'ici vendredi") et les convertit en action items avec : description, assigné probable, deadline estimée. Bouton one-click pour créer une tâche dans le module Tasks.

### 1.7 Détection de topics et chapitrage
La transcription est automatiquement découpée en sections thématiques (chapitres) avec un titre généré. Navigation par chapitres dans la timeline. Utile pour les longues réunions (>30 min).

### 1.8 Highlights et bookmarks
Pendant le meeting ou après, l'utilisateur peut cliquer sur un segment pour le marquer comme "highlight". Les highlights sont listés dans un panneau dédié et peuvent être partagés comme des clips audio avec leur transcription.

### 1.9 Recherche full-text dans les transcriptions
Barre de recherche dans l'historique des meetings. Cherche dans le texte transcrit. Résultats avec contexte (segment avant/après) et timestamp. Clic sur un résultat navigue directement au moment correspondant dans l'audio.

### 1.10 Intégration Meet
Quand un meeting SignApps Meet est enregistré, la transcription est automatiquement générée et liée à l'événement Calendar. Les participants du meeting sont pré-associés aux speakers. Le résumé est envoyé par notification aux participants.

### 1.11 Import audio externe
Uploader un fichier audio (MP3, WAV, OGG, FLAC, M4A, WebM, MP4) pour le transcrire. Drag-and-drop ou bouton `Importer un audio`. Limite : 100 Mo par fichier (configurable). File d'attente avec progression pour les gros fichiers.

### 1.12 Export des minutes
Exporter les minutes au format Markdown, PDF, DOCX, TXT, SRT (sous-titres), VTT (sous-titres web), JSON (structuré). Option d'inclure : transcription complète, résumé seul, action items seuls, ou tout combiné.

---

## Catégorie 2 — Commandes vocales

### 2.1 Activation des commandes vocales globales
Toggle dans l'onglet Commands pour activer l'écoute permanente (avec indicateur micro dans la barre de navigation). Hot-word configurable ("Hey SignApps" ou touche clavier). L'activation ouvre une mini-interface de commande vocale flottante.

### 2.2 Commandes de navigation
Commandes reconnues pour naviguer dans l'app :
- "Tableau de bord" / "Dashboard" → `/dashboard`
- "Calendrier" / "Calendar" → `/cal`
- "Boîte de réception" / "Inbox" → `/mail`
- "Documents" / "Docs" → `/docs`
- "Tâches" / "Tasks" → `/tasks`
- "Contacts" → `/contacts`
- "Paramètres" / "Settings" → `/settings`
- "Retour" / "Go back" → navigation arrière

### 2.3 Commandes de création
- "Nouveau document" / "Create doc" → ouvre l'éditeur Docs
- "Envoyer un mail à [nom]" → ouvre un composer Mail pré-rempli
- "Planifier une réunion" / "Schedule meeting" → ouvre le formulaire Calendar
- "Nouvelle tâche [description]" → crée une tâche avec la description dictée
- "Créer un contact [nom]" → ouvre le formulaire Contact pré-rempli

### 2.4 Commandes de recherche
- "Chercher [terme]" → lance la recherche globale
- "Trouver le document [nom]" → recherche dans Drive
- "Qui est [nom] ?" → recherche dans Contacts et affiche la fiche

### 2.5 Commandes contextuelles
Commandes disponibles selon le contexte actif :
- Dans Mail : "Répondre", "Archiver", "Suivant", "Précédent"
- Dans Calendar : "Prochain rendez-vous", "Quand est ma prochaine réunion ?"
- Dans Docs : "Enregistrer", "Partager avec [nom]"
- Dans Meet : "Muter", "Couper la caméra", "Lever la main", "Quitter"

### 2.6 Feedback visuel et sonore
Chaque commande reconnue affiche un toast de confirmation avec l'action exécutée. Son de confirmation configurable. Si la commande n'est pas comprise, feedback "Je n'ai pas compris, essayez..." avec suggestions.

### 2.7 Historique des commandes
Liste des commandes vocales récentes dans l'onglet Commands, avec timestamp, commande reconnue, action exécutée et statut (succès/échec). Utile pour le debug et l'apprentissage.

### 2.8 Vocabulaire custom
L'administrateur peut ajouter des mots/noms propres au vocabulaire du moteur STT pour améliorer la reconnaissance (noms de projets, jargon métier, acronymes internes).

---

## Catégorie 3 — Notes audio

### 3.1 Enregistrement rapide de notes vocales
Bouton micro dans l'onglet Voice Notes pour enregistrer une note vocale instantanément. Enregistrement en un tap/clic, arrêt en un tap/clic. La note est automatiquement transcrite en arrière-plan.

### 3.2 Liste des notes vocales
Affichage chronologique des notes avec : date, durée, transcription (preview tronquée), player audio inline. Tri par date, durée, recherche par texte.

### 3.3 Lecture audio avec waveform
Chaque note affiche une visualisation waveform cliquable pour naviguer dans l'audio. Vitesse de lecture ajustable (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x). Bouton skip +10s/-10s.

### 3.4 Transcription automatique
Chaque note vocale est transcrite automatiquement après l'enregistrement. La transcription est affichée sous le player et est éditable (pour corriger les erreurs de reconnaissance).

### 3.5 Tags et catégorisation
Ajouter des tags aux notes vocales (ex: #meeting, #idée, #rappel, #urgent). Filtrer les notes par tag. Tags suggérés par l'IA en fonction du contenu transcrit.

### 3.6 Rattachement à un contexte
Associer une note vocale à un document Drive, un événement Calendar, un contact, une tâche, un ticket Helpdesk. La note apparaît dans le panneau latéral de l'élément associé.

### 3.7 Partage de notes vocales
Partager une note vocale avec un lien direct (audio + transcription). Permissions : lecture seule ou lecture + commentaire. Expiration optionnelle du lien.

### 3.8 Conversion en document
Bouton `Convertir en document` qui crée un document Docs à partir de la transcription de la note, avec l'audio embarqué en pièce jointe. Utile pour formaliser des idées dictées.

### 3.9 Notes vocales dans d'autres modules
Bouton micro dans la barre d'outils de Mail (dicter un email), Docs (dicter du contenu), Tasks (dicter une description), Chat (envoyer un message vocal). Chaque note vocale inline est transcrite automatiquement pour les destinataires.

### 3.10 Suppression et rétention
Suppression manuelle ou automatique (politique de rétention configurable : 30j, 90j, 1an, jamais). Corbeille avec restauration pendant 30 jours.

---

## Catégorie 4 — Dictée (Speech-to-Text enrichie)

### 4.1 Mode dictée dans l'éditeur
Bouton micro dans la toolbar de l'éditeur Docs/Mail. Activation = le texte dicté s'insère en temps réel à la position du curseur. Désactivation par clic ou touche Escape.

### 4.2 Ponctuation automatique
Le moteur STT insère automatiquement la ponctuation (points, virgules, points d'interrogation, points d'exclamation) en fonction de l'intonation et des pauses. Ajustable en paramètres (agressif / modéré / désactivé).

### 4.3 Commandes de formatage dictées
Pendant la dictée, des commandes spéciales sont interprétées :
- "Nouveau paragraphe" → saut de ligne
- "Point" / "Virgule" / "Point d'interrogation" → ponctuation
- "Ouvrir les guillemets" / "Fermer les guillemets"
- "En gras [texte] fin du gras" → formatage bold
- "Titre [texte]" → heading
- "Liste à puces" → commence une liste
- "Retour à la ligne" → line break

### 4.4 Sélection de la langue de dictée
Dropdown pour choisir la langue de dictée (français, anglais, espagnol, allemand, italien, portugais, néerlandais, arabe, chinois, japonais, coréen). Détection automatique si "auto" est sélectionné.

### 4.5 Vocabulaire personnalisé pour la dictée
L'utilisateur peut ajouter des mots au dictionnaire personnel (noms propres, termes techniques, acronymes). Le moteur STT les priorise dans la reconnaissance.

### 4.6 Correction inline
Après la dictée, les mots à faible confiance sont soulignés en pointillés orange. Clic droit = suggestions alternatives. Raccourci clavier pour passer au mot incertain suivant.

### 4.7 Dictée multilingue dans un même flux
Passer du français à l'anglais dans la même phrase : le moteur détecte le changement de langue et transcrit correctement. Utile pour les textes avec termes anglais courants.

### 4.8 Dictée dans les formulaires
Le bouton micro apparaît dans tous les champs de texte de la plateforme (formulaires, recherche, commentaires). Activation par icône micro ou raccourci clavier global (configurable, par défaut `Ctrl+Shift+D`).

### 4.9 Historique de dictée
Log des sessions de dictée avec durée, nombre de mots, taux de confiance moyen. Statistiques personnelles pour suivre l'amélioration de la reconnaissance.

---

## Catégorie 5 — Podcasts et contenus audio

### 5.1 Lecteur de podcasts intégré
Player audio avec controls standard : play/pause, skip +10s/-10s, barre de progression, volume, vitesse (0.5x à 3x). Affichage du titre, auteur, durée, couverture.

### 5.2 Abonnement à des flux RSS
Ajouter une URL de flux RSS podcast. Le système récupère automatiquement les nouveaux épisodes. Liste des abonnements avec badge "nouveau" pour les épisodes non écoutés.

### 5.3 Transcription automatique des podcasts
Chaque épisode téléchargé est automatiquement transcrit en arrière-plan (file d'attente). La transcription est synchronisée avec l'audio (clic sur un mot = navigation à ce moment).

### 5.4 Chapitrage et résumé
L'IA génère des chapitres et un résumé de l'épisode. Navigation par chapitres dans le player. Utile pour les longs épisodes (>1h).

### 5.5 Podcasts internes (création)
Créer un podcast interne à l'organisation : enregistrer un épisode, ajouter un titre/description/couverture, publier dans le flux interne. Utile pour les communications internes, les onboarding audio, les newsletters vocales.

### 5.6 Playlists et files de lecture
Créer des playlists de notes vocales, épisodes de podcasts, enregistrements de meetings. Lecture continue en arrière-plan. Queue de lecture modifiable.

### 5.7 Écoute en arrière-plan
Le player continue de jouer quand on navigue dans d'autres modules. Mini-player flottant persistant dans le coin inférieur droit avec controls minimaux.

### 5.8 Bookmarks dans l'audio
Marquer des moments précis dans un podcast ou un enregistrement. Les bookmarks sont listés avec un label et un timestamp, cliquables pour naviguer directement.

### 5.9 Partage de clips audio
Sélectionner une portion de l'audio (début-fin) et générer un lien de partage vers ce clip spécifique. Le destinataire écoute uniquement l'extrait avec sa transcription.

### 5.10 Import/export de podcasts
Importer un fichier audio local comme épisode. Exporter un podcast interne en flux RSS standard pour distribution externe (si autorisé par l'admin).

---

## Catégorie 6 — Synthèse vocale (Text-to-Speech)

### 6.1 Lecture à voix haute d'un document
Bouton `Lire à voix haute` dans la toolbar de Docs, Mail, Wiki. Le texte est synthétisé et lu via le haut-parleur. Le mot en cours de lecture est surligné dans le document (karaoké-style). Controls : play/pause, stop, vitesse, voix.

### 6.2 Catalogue de voix
Sélectionner parmi les voix disponibles : homme/femme, plusieurs langues (français, anglais, espagnol, allemand, italien...). Preview de chaque voix avec un court échantillon. Voix par défaut configurable dans les paramètres utilisateur.

### 6.3 Paramètres de voix
Ajuster : vitesse de lecture (0.5x à 2x), hauteur (pitch), volume. Prévisualisable avant de lancer la lecture complète.

### 6.4 TTS dans les notifications
Option pour que les notifications importantes soient lues à voix haute (annonce vocale). Configurable par type de notification et par priorité.

### 6.5 Accessibilité lecteur d'écran
Le TTS natif sert de lecteur d'écran intégré pour les utilisateurs malvoyants. Navigation par sections, lecture du contenu des cellules de tableur, description des graphiques.

### 6.6 Génération audio pour partage
Bouton `Générer un audio` sur un document ou un mail → génère un fichier MP3/WAV téléchargeable de la version lue. Utile pour créer des versions audio de documents pour écoute mobile.

### 6.7 Voix personnalisée (voice cloning)
L'utilisateur peut enregistrer un échantillon de sa propre voix (>30 secondes) pour créer un modèle TTS personnalisé. Utilisable pour les podcasts internes ou les messages vocaux. Nécessite le consentement explicite.

### 6.8 TTS multilingue dans un même document
Si un document contient du texte en plusieurs langues, le moteur TTS détecte chaque section et utilise la voix appropriée automatiquement.

---

## Catégorie 7 — Audio tasks et automatisations

### 7.1 Audio-to-task
Enregistrer un court message vocal, l'IA extrait : titre de la tâche, description, priorité estimée, deadline si mentionnée. Création one-click dans le module Tasks.

### 7.2 Audio-to-email
Dicter un email complet. L'IA structure le texte (objet, corps, salutation, signature). Preview éditable avant envoi. Détection du destinataire si mentionné ("envoie un mail à Jean Dupont pour...").

### 7.3 Audio-to-event
Dicter "Réunion avec l'équipe marketing mardi prochain à 14h pendant 1h". L'IA parse les informations et pré-remplit le formulaire d'événement Calendar.

### 7.4 Traitement batch d'audio
Uploader plusieurs fichiers audio en une fois. File d'attente avec progression individuelle et globale. Résultats disponibles au fur et à mesure. Notification quand tout est terminé.

### 7.5 Transcription programmée
Configurer une transcription automatique pour tous les meetings d'un calendrier spécifique, ou pour tous les fichiers audio uploadés dans un dossier Drive particulier.

### 7.6 Webhook audio
Exposer un endpoint webhook qui accepte un POST avec un fichier audio et retourne la transcription en JSON. Utilisable par les workflows et les intégrations externes.

### 7.7 Pipeline audio personnalisé
Enchaîner des traitements : enregistrer → transcrire → résumer → créer des tâches → envoyer par mail. Pipeline configurable dans le module Workflows avec les actions audio comme blocs.

### 7.8 Traduction audio
Uploader un audio dans une langue et obtenir la transcription traduite dans une autre langue. Basé sur le mode "translate" de Whisper. Support de 99 langues source vers l'anglais, puis traduction AI vers la langue cible.

---

## Catégorie 8 — Analyse et intelligence vocale

### 8.1 Analyse de sentiment des meetings
Pour chaque meeting transcrit, l'IA détecte le sentiment global et par segment : positif, neutre, négatif. Visualisation en frise colorée sur la timeline du meeting. Utile pour les managers.

### 8.2 Temps de parole par participant
Statistique de la durée de parole de chaque participant dans un meeting. Graphique en barre ou camembert. Détecte les déséquilibres (une personne monopolise la parole).

### 8.3 Métriques de réunion
Dashboard par meeting : durée totale, nombre de participants, nombre de topics abordés, nombre d'action items générés, ratio parole/silence, questions posées. Comparaison avec la moyenne des meetings de l'équipe.

### 8.4 Tendances sur la durée
Graphiques d'évolution : durée moyenne des meetings par semaine/mois, nombre de meetings, nombre d'action items, taux de complétion des action items. Détection d'anomalies.

### 8.5 Détection de mots-clés et topics
Extraction automatique des mots-clés et topics principaux de chaque meeting. Tag cloud ou liste pondérée. Corrélation avec les projets et les tâches en cours.

### 8.6 Coaching de communication
L'IA fournit des suggestions post-meeting : "Vous avez parlé 65% du temps, considérez de poser plus de questions", "3 participants n'ont pas pris la parole", "Le meeting a duré 15 min de plus que prévu".

### 8.7 Comparaison inter-réunions
Comparer deux meetings sur les mêmes sujets : quelles décisions ont changé, quels action items sont récurrents (signifiant qu'ils ne sont pas exécutés), quels topics reviennent systématiquement.

### 8.8 Filler words detection
Compteur de mots de remplissage ("euh", "donc", "voilà", "you know", "like") par participant. Score de fluence. Tendance sur le temps. Utile pour l'amélioration personnelle et le coaching.

---

## Catégorie 9 — Sécurité, conformité et confidentialité

### 9.1 Consentement d'enregistrement
Avant de démarrer un enregistrement dans un meeting, tous les participants sont notifiés avec un bandeau "Cet appel est enregistré". Chaque participant doit voir la notification. Le host ne peut pas enregistrer discrètement.

### 9.2 Chiffrement des fichiers audio
Tous les fichiers audio sont chiffrés au repos (AES-256). Les transcriptions sont stockées en base de données avec chiffrement au niveau colonne pour les données sensibles.

### 9.3 Rétention configurable
L'administrateur définit la politique de rétention : les enregistrements audio et transcriptions sont automatiquement supprimés après X jours (30, 90, 365, jamais). Par service, par équipe ou global.

### 9.4 PII redaction
L'IA détecte automatiquement les informations personnelles dans les transcriptions (numéros de téléphone, emails, adresses, numéros de sécurité sociale, IBAN) et les masque ou les supprime. Configurable par politique.

### 9.5 Contrôle d'accès granulaire
Les enregistrements et transcriptions héritent des permissions du meeting ou du document parent. Partage explicite requis pour donner accès à un non-participant. L'admin peut révoquer l'accès à tout moment.

### 9.6 Audit log
Chaque action est loguée : enregistrement démarré/arrêté, transcription générée, fichier audio téléchargé, transcription exportée, accès en lecture. Log immuable pour conformité.

### 9.7 Traitement local uniquement
Par défaut, tout l'audio est traité sur le serveur SignApps (whisper-rs, piper-rs). Aucune donnée n'est envoyée à un service cloud. Si l'admin configure un provider cloud (OpenAI Whisper API, AssemblyAI, Deepgram), un avertissement est affiché et le consentement est requis.

### 9.8 Séquestre légal (legal hold)
Possibilité de placer un enregistrement et sa transcription sous séquestre : aucune modification, suppression ou expiration possible tant que le hold est actif. Déclenché par l'admin ou le compliance officer.

### 9.9 Classification des enregistrements
Chaque enregistrement peut être classifié (Public, Interne, Confidentiel, Secret) avec héritage des règles de partage et d'export associées.

### 9.10 RGPD et droit à l'oubli
Un utilisateur peut demander la suppression de toutes ses données vocales (enregistrements où il est speaker, notes vocales, empreinte vocale). Processus automatisé avec confirmation admin.

---

## Catégorie 10 — Performance, accessibilité et mobile

### 10.1 Streaming WebSocket bidirectionnel
Le flux audio est envoyé au serveur en chunks PCM f32le 16kHz mono via WebSocket. Le serveur renvoie les segments transcrits en temps réel via le même canal. Protocole documenté (text frames JSON pour le contrôle, binary frames pour l'audio).

### 10.2 Modèles STT adaptatifs
Sélection automatique du modèle Whisper selon le matériel disponible : `large-v3` si GPU avec >6 Go VRAM, `medium` si GPU modeste, `small` si CPU seul. Configuration manuelle possible. Téléchargement automatique du modèle au premier usage.

### 10.3 File d'attente pour les traitements longs
Les transcriptions de fichiers volumineux sont placées dans une file d'attente avec progression visible (pourcentage, temps restant estimé). L'utilisateur peut continuer à utiliser la plateforme pendant le traitement.

### 10.4 Cache audio intelligent
Les enregistrements récents sont gardés en cache local (IndexedDB) pour relecture immédiate. Purge automatique quand le cache dépasse la taille configurée (100 Mo par défaut).

### 10.5 Accessibilité WCAG AA
Navigation complète au clavier dans tous les players et contrôles. Labels ARIA sur tous les boutons. Transcriptions automatiques pour tout contenu audio (pas de contenu "audio-only" sans alternative textuelle).

### 10.6 Mode hors-ligne
Enregistrement de notes vocales en mode déconnecté. Stockées localement et transcrites au retour en ligne. Les podcasts téléchargés sont disponibles hors-ligne.

### 10.7 Mobile responsive
Interface tactile optimisée : bouton d'enregistrement large et centré, gestes de swipe pour naviguer entre les notes, player avec contrôles tactiles, enregistrement en arrière-plan quand l'écran est verrouillé.

### 10.8 Compression audio intelligente
L'audio brut est compressé en Opus/OGG pour le stockage (ratio 10:1 sans perte perceptible). L'audio PCM est utilisé uniquement pour le traitement STT. Économie de stockage significative.

### 10.9 Notification de fin de traitement
Quand une transcription longue est terminée, l'utilisateur reçoit une notification push et in-app avec un lien direct vers le résultat.

### 10.10 API REST et WebSocket documentées
Endpoints documentés via OpenAPI (Swagger UI sur `/swagger-ui/`) :
- `POST /api/v1/stt/transcribe` — transcription batch (multipart)
- `GET /api/v1/stt/transcribe/stream` — transcription streaming (SSE)
- `POST /api/v1/tts/synthesize` — synthèse vocale
- `GET /api/v1/voice` — WebSocket full-duplex (STT → LLM → TTS pipeline)
- `GET /api/v1/tts/voices` — catalogue des voix
- `GET /api/v1/stt/models` — modèles disponibles

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **Otter.ai Help Center** (help.otter.ai) — documentation sur la transcription, la diarisation, les intégrations, les résumés AI.
- **Fireflies.ai Blog** (fireflies.ai/blog) — articles sur la conversation intelligence, les patterns de transcription de meetings.
- **Whisper GitHub** (github.com/openai/whisper) — documentation du modèle, benchmarks multi-langues, architecture.
- **Faster-Whisper** (github.com/SYSTRAN/faster-whisper) — implémentation CTranslate2 4x plus rapide que le Whisper original, API compatible.
- **Piper TTS** (github.com/rhasspy/piper) — documentation des voix disponibles, formats supportés, configuration.
- **AssemblyAI Docs** (assemblyai.com/docs) — documentation API exhaustive sur les features STT avancées (diarization, summarization, PII redaction).
- **Deepgram Docs** (developers.deepgram.com) — documentation sur le streaming temps réel, les modèles, le smart formatting.
- **Web Speech API MDN** (developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) — standard W3C pour la reconnaissance vocale côté navigateur.
