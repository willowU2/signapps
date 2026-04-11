# Module Meet (vidéoconférence) — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Zoom** | Fiabilité, recording cloud, transcription, breakout rooms, webinars, polls, Q&A, whiteboard, filters, stable sur bas débit, 1000 participants, apps (Zoom Apps), AI Companion |
| **Google Meet** | Intégration Workspace, noise cancellation, live captions, host controls, visual effects, breakout rooms, polls, Q&A, companion mode, Gemini |
| **Microsoft Teams** | Intégration Office, live events, breakout rooms, whiteboard, Copilot summarization, meeting insights, together mode, reactions, PowerPoint Live |
| **Whereby** | Browser-only (no install), rooms permanents, custom branding, embeds, API, virtual receptionist |
| **Around** | Floating heads (pas de grid), AI framing, noise cancel, screen share focus |
| **Jitsi Meet** | Open source (Apache-2.0), self-hostable, no account required, E2E option |
| **Daily.co** | API-first, embeddable, recording, analytics, transcription |
| **LiveKit Meet** | Open source self-hostable, scalable SFU, AI agents integration |
| **BigBlueButton** | Education-focused, whiteboard, multi-user whiteboard, breakout, poll |
| **Jami** (GNU) | P2P, fully decentralized, FOSS |
| **Cisco Webex** | Enterprise leader legacy, AI Assistant, end-to-end encryption |
| **Signal video** | E2E, 40 participants, privacy-first |

## Principes directeurs

1. **No-install par défaut** — rejoindre un meeting via URL dans le navigateur sans télécharger d'app.
2. **Qualité audio en priorité** — noise cancellation excellente, echo suppression, bande passante adaptative.
3. **Accessibilité de base** — sous-titres live, transcription complète, raccourcis clavier, haute visibilité.
4. **Collaboration active** — partage d'écran fluide, annotation collective, whiteboard intégré, polls, Q&A.
5. **Privacy et sécurité** — chambres verrouillées, waiting room, E2E option, pas de recording sans consentement.
6. **Scalable** — de 1:1 à 1000 participants sans dégradation.

---

## Catégorie 1 — Création et accès aux meetings

### 1.1 Création instantanée
Bouton `Meet now` → nouvelle room avec URL unique immédiatement. Partage du lien aux participants par mail/chat.

### 1.2 Création planifiée
Créer un meeting avec date/heure, durée, titre, description, participants. Intégration calendrier : apparaît comme événement avec lien meet.

### 1.3 Rooms permanentes
Créer une room réutilisable (`/room/jean-standup`) avec URL stable. Utilisée pour les réunions récurrentes.

### 1.4 Rooms privées vs publiques
- **Publique** : tout le monde avec le lien peut entrer
- **Privée** : invitation obligatoire, authentification requise
- **Verrouillée** : nouvelle entrée bloquée après le début (waiting room)

### 1.5 Rejoindre par URL
URL unique `meet.signapps.com/abc-def-ghi`. Ouvre directement dans le navigateur. Pas d'installation requise.

### 1.6 Rejoindre par code court
Code à 6 chiffres `123-456` pour rejoindre rapidement. Pour les scenarios où on ne peut pas copier une URL (présentation, affiche).

### 1.7 Lobby / Waiting room
Les participants attendent dans un lobby avant que le host les admette (un par un ou en batch). Messages possibles pendant l'attente.

### 1.8 Knock to enter
Au lieu du lobby automatique, option où le host approuve chaque arrivée.

### 1.9 Pre-meeting device check
Avant d'entrer, page de test : vérifier caméra, micro, haut-parleurs. Choisir les bons devices. Preview de son visage et niveau d'audio.

### 1.10 Blurred background et virtual background
Choix d'un fond : net, flou, image custom, vidéo. Preview avant entrée.

### 1.11 Joining as audio only
Option pour rejoindre sans caméra. Économise la bande passante.

### 1.12 Dial-in (téléphone)
Numéros de téléphone par pays pour rejoindre par appel vocal. Pour les participants sans internet.

---

## Catégorie 2 — Audio et vidéo

### 2.1 Caméra toggle
Bouton activer/désactiver la caméra. Raccourci `Ctrl+E`. Indicateur quand on parle avec caméra coupée (silhouette avec nom).

### 2.2 Micro toggle (mute/unmute)
Raccourci `Ctrl+D` ou `Space` (push-to-talk). Indicateur visuel quand on parle (cadre animé).

### 2.3 Sélection des devices
Menu pour choisir : caméra, micro, haut-parleurs. Changement à chaud pendant le meeting.

### 2.4 Noise cancellation (IA)
Filtre audio IA qui supprime le bruit de fond (clavier, clim, voix lointaines). Toggleable. Basé sur ML models légers.

### 2.5 Echo cancellation
Suppression automatique de l'écho entre haut-parleurs et micro.

### 2.6 Audio gate / gain automatique
Niveau d'audio automatiquement ajusté pour un volume constant.

### 2.7 Resolution auto-adaptative
Qualité vidéo adaptée à la bande passante disponible : 1080p → 720p → 480p → 360p → audio-only selon la connexion.

### 2.8 Bitrate et codec
Codec AV1 quand supporté (meilleure qualité pour la même bande passante), fallback VP9 / H.264.

### 2.9 Caméra beauty filter
Filtres légers : lissage peau, ajustement luminosité, blanc des dents. Désactivable.

### 2.10 Touch-up lighting (low-light enhancement)
Amélioration automatique en conditions de faible luminosité (IA).

### 2.11 Mirror video toggle
Option pour miroiter la vidéo (comportement naturel vs caméra-as-seen).

### 2.12 Studio audio (haute fidélité musicale)
Mode "studio" qui désactive le noise cancel pour les musiciens/audio pros.

### 2.13 Spatial audio
Audio positionnel : quand un participant parle, le son vient de leur position à l'écran. Expérience plus naturelle pour les gros calls.

### 2.14 Virtual background
Arrière-plan remplaçable (flou, image, vidéo). Sans green screen grâce à l'IA. Library de backgrounds pré-définis.

### 2.15 Frame me (auto-framing)
La caméra recadre automatiquement sur le visage. Si on bouge, le cadrage suit. Utilisé par Google Meet et Teams.

---

## Catégorie 3 — Layout et affichage

### 3.1 Grid view (galerie)
Tous les participants en grille équivalente. 4, 9, 16, 25 participants visibles selon la taille d'écran.

### 3.2 Speaker view
Focus sur la personne qui parle actuellement. Les autres en petites vignettes en bas.

### 3.3 Side-by-side / Pin
Épingler un participant spécifique pour le voir en grand en permanence.

### 3.4 Fullscreen d'un participant
Double-clic sur une vignette pour l'afficher en plein écran.

### 3.5 Masquer soi-même
Option de ne pas se voir (réduit l'anxiété de parler en visio).

### 3.6 Cacher les participants sans vidéo
Option de masquer les vignettes audio-only.

### 3.7 Hide non-speaking
Afficher uniquement ceux qui ont parlé récemment (pour les grands groupes).

### 3.8 Layout custom drag
Glisser les vignettes pour les réorganiser. Sauvegardé comme préférence par meeting.

### 3.9 Together mode
Tous les participants affichés comme assis dans une salle virtuelle (auditorium, café, salle de classe). Plus engageant pour les grandes réunions.

### 3.10 Floating video (picture-in-picture)
Mini fenêtre flottante avec la vidéo du speaker. Reste au-dessus des autres apps pour suivre le meeting tout en travaillant.

### 3.11 Presentation mode
Quand un écran est partagé, layout auto-ajusté : screen share en grand, speaker vignette à côté.

---

## Catégorie 4 — Partage d'écran

### 4.1 Share entire screen
Partager tout l'écran. Multi-monitor supporté (choix du monitor).

### 4.2 Share specific window / app
Partager uniquement une fenêtre spécifique. Évite d'exposer d'autres apps par erreur.

### 4.3 Share Chrome tab / browser
Partager un onglet spécifique du navigateur. Plus sécurisé et léger.

### 4.4 Share with audio
Option d'inclure l'audio du système (utile pour partager une vidéo avec son).

### 4.5 Presenter annotations
Dessiner par-dessus son propre écran partagé pour souligner des éléments. Pen, highlighter, pointer, text, shapes.

### 4.6 Participant annotations
Les participants peuvent aussi annoter le screen share (si le host l'autorise).

### 4.7 Laser pointer
Curseur transformé en pointeur laser rouge quand on partage.

### 4.8 Stop sharing
Bouton `Stop sharing` flottant toujours visible pendant le partage.

### 4.9 Simultaneous sharing
Plusieurs participants peuvent partager en même temps (side-by-side). Utilisé pour les comparaisons.

### 4.10 Quality selector
Option de choisir la qualité du partage : motion (fluide pour vidéos) vs text (clair pour lecture).

### 4.11 Fullscreen du shared content
Bouton pour afficher le contenu partagé en plein écran côté participant.

### 4.12 Viewer follow presenter
Mode "follow" où le viewport du participant suit automatiquement où le presenter scrolle/zoom.

---

## Catégorie 5 — Chat et collaboration

### 5.1 Chat texte intégré
Panneau chat latéral avec messages pendant le meeting. Messages visibles par tous ou DM entre participants.

### 5.2 Rich text dans le chat
Formatting markdown (gras, italique, code, liens).

### 5.3 Share files dans le chat
Envoyer des fichiers via le chat. Stockés dans le drive, liens dans le chat.

### 5.4 Réactions rapides
Emoji reactions visibles sur l'écran pendant quelques secondes (thumbs up, clap, heart, confetti, laugh).

### 5.5 Raise hand
Bouton "lever la main" pour demander la parole sans interrompre. Host voit les mains levées dans l'ordre.

### 5.6 Emoji sur vignette
Participants peuvent cliquer sur leur vignette pour ajouter un emoji temporaire (comme raise hand mais plus divers).

### 5.7 Whiteboard intégré
Tableau blanc collaboratif dans la meeting. Dessins, formes, texte, sticky notes, connections. Sauvegardé après la meeting.

### 5.8 Polls et sondages
Host peut créer des polls (choix simple/multiple) en live. Réponses anonymes ou nommées. Résultats affichés en direct.

### 5.9 Q&A structuré
Mode Q&A où les participants soumettent des questions via un panneau dédié. Upvotes pour prioriser. Host répond dans l'ordre.

### 5.10 Breakout rooms
Diviser les participants en petits groupes dans des rooms séparées. Duration configurable, rebalancing automatique, broadcast du host vers toutes les rooms.

### 5.11 Co-host
Désigner d'autres participants comme co-hosts avec des permissions supplémentaires (moderate chat, manage breakouts, etc.).

### 5.12 Spotlight speaker
Le host peut "spotlight" un participant pour que tous le voient en grand. Utile pour les panels.

### 5.13 Live captions
Sous-titres automatiques en temps réel (STT). Multi-language. Position configurable sur l'écran.

### 5.14 Translation live
Sous-titres traduits en temps réel dans la langue du viewer (ex: speaker en français, subs en anglais).

---

## Catégorie 6 — Enregistrement et transcription

### 6.1 Cloud recording
Bouton `Record` démarre l'enregistrement cloud. Tous les participants voient l'indicateur rouge "REC". Consentement explicite requis.

### 6.2 Local recording
Option d'enregistrer en local (pour les participants qui veulent leur propre copie).

### 6.3 Options d'enregistrement
Choisir ce qui est enregistré :
- Active speaker view
- Grid view
- Screen share séparé
- Chat
- Whiteboard
- Transcription

### 6.4 Post-meeting recording
À la fin du meeting, le fichier vidéo est sauvegardé dans le drive associé. Accessible par les participants (selon les permissions).

### 6.5 Auto-transcription
Tout le meeting est transcrit automatiquement (STT). Transcription consultable dans le Drive avec timestamps cliquables.

### 6.6 Speaker identification
La transcription identifie qui a dit quoi (`Jean: ...`, `Sarah: ...`).

### 6.7 Searchable transcripts
Recherche dans la transcription d'un meeting passé : "Quand avons-nous parlé du budget Q2 ?". Jump au timestamp exact.

### 6.8 Auto-summary (IA)
Après le meeting, résumé généré par l'IA : points clés, décisions, action items, participants. Posté automatiquement dans le channel associé.

### 6.9 Action items extraction
L'IA extrait les action items du meeting et les crée comme tâches dans le module Tasks, assignées aux bonnes personnes.

### 6.10 Meeting highlights
Top moments clippés automatiquement (les plus engagés, les décisions, les questions). Playback rapide.

### 6.11 Chapter markers
Le host peut marquer des chapitres pendant le meeting (`Introduction`, `Product update`, `Q&A`). Visible dans la playback.

### 6.12 Audio-only recording
Option d'enregistrer uniquement l'audio (podcast-style), sans vidéo. Plus léger.

### 6.13 Download recording
Télécharger l'enregistrement en MP4 ou MP3. Partage externe possible.

### 6.14 Consent announcement
Annonce audio automatique quand l'enregistrement démarre : "Ce meeting est en cours d'enregistrement."

---

## Catégorie 7 — IA et automation

### 7.1 AI Companion / Copilot
Panneau latéral avec assistant IA pendant le meeting. Peut :
- Résumer ce qui a été dit jusqu'à présent
- Répondre à des questions sur le contexte
- Extraire les points clés
- Suggérer des actions

### 7.2 Résumé en temps réel
Le résumé se met à jour progressivement pendant le meeting. Les retardataires peuvent "catch up" sans interrompre.

### 7.3 Q&A sur le meeting
"Qu'est-ce que Jean a dit sur le budget ?" → L'IA retrouve et résume.

### 7.4 Next steps automation
Suggestion de prochaines étapes basées sur le contenu du meeting : créer des tâches, envoyer un follow-up email, planifier un autre meeting.

### 7.5 Meeting type detection
L'IA détecte le type de meeting (stand-up, retrospective, presentation, brainstorm) et adapte ses suggestions.

### 7.6 Engagement analytics
Dashboard post-meeting : temps de parole par participant, nombre d'interactions, engagement score.

### 7.7 Sentiment analysis
Analyse du ton général du meeting (positif, constructif, tendu). Alerte si tendu.

### 7.8 Auto-assigned notes
Les notes prises sur un whiteboard sont automatiquement sauvegardées dans le drive avec un titre et un résumé.

### 7.9 Smart reminders
Avant le meeting, résumé des documents/threads liés. Après le meeting, follow-up automatique.

### 7.10 Auto-schedule follow-up
Si une action item nécessite un meeting, l'IA propose de le planifier immédiatement.

---

## Catégorie 8 — Host controls et modération

### 8.1 Mute all
Bouton pour muter tous les participants d'un coup. Sauf le host.

### 8.2 Mute on entry
Nouveaux participants arrivent mutés par défaut.

### 8.3 Disable unmute
Empêcher les participants de se dé-muter (sauf le host qui les désigne).

### 8.4 Remove participant
Expulser un participant du meeting. Blocage optionnel pour empêcher le rejoint.

### 8.5 Disable video
Forcer la caméra coupée pour certains participants.

### 8.6 Disable chat
Désactiver le chat texte (ou lecture seule pour les participants).

### 8.7 Disable reactions / raise hand
Désactiver les réactions visuelles.

### 8.8 Lock meeting
Verrouiller le meeting : plus personne ne peut entrer.

### 8.9 Waiting room control
Admettre individuellement, en batch, ou tout admettre.

### 8.10 Report abuse
Participants peuvent signaler un comportement abusif. Log pour review.

### 8.11 End meeting for all
Bouton pour terminer le meeting pour tous les participants.

### 8.12 Transfer host role
Passer le rôle de host à un autre participant.

### 8.13 Watermark pour recording
Quand l'enregistrement est activé, watermark avec nom utilisateur visible pour éviter les leaks.

---

## Catégorie 9 — Intégrations

### 9.1 Intégration Calendar
Créer un meeting depuis un événement calendrier → génère automatiquement le lien meet. Ajout aux détails de l'événement.

### 9.2 Intégration Chat
`/meet` dans un channel lance un meeting avec les membres du channel. Lien posté automatiquement.

### 9.3 Intégration Docs
Ouvrir un doc pendant le meeting avec tous les participants en co-édition.

### 9.4 Intégration Drive
Partager un fichier du drive dans le meeting. Visible par tous.

### 9.5 Intégration Tasks
Action items extraits créent automatiquement des tâches.

### 9.6 Intégration Whiteboard
Whiteboard collaboratif intégré (module Whiteboard SignApps) directement dans le meeting.

### 9.7 Salesforce / HubSpot
Meetings avec un contact CRM automatiquement liés à la fiche. Enregistrement accessible depuis le CRM.

### 9.8 Outlook / Google Calendar
Boutons "Join meeting" dans les événements synchronisés.

### 9.9 Slack / Microsoft Teams
Plugin pour démarrer un meet SignApps depuis Slack/Teams.

### 9.10 Webhook API
API pour automatiser la création de meetings depuis d'autres systèmes.

### 9.11 SIP / VoIP integration
Interoperability avec les systèmes téléphoniques d'entreprise (SIP trunking).

### 9.12 Live streaming vers YouTube/Twitch/RTMP
Streamer un meeting en live sur une plateforme externe. Pour les webinars et événements.

---

## Catégorie 10 — Scalabilité et modes

### 10.1 1:1 call
Appel entre deux personnes, peer-to-peer quand possible (WebRTC direct) pour la latence minimale.

### 10.2 Small group (3-25)
Mode SFU (Selective Forwarding Unit) pour routage optimal. Full-duplex audio/vidéo.

### 10.3 Medium (25-100)
Mode SFU avec simulcast (chaque participant envoie plusieurs résolutions, le SFU route la bonne à chaque viewer).

### 10.4 Large (100-500)
Mode optimisé : seuls les speakers actifs sont envoyés en vidéo, les autres en audio. Gestion de la file d'attente pour parler.

### 10.5 Webinar (500-10000)
Mode webinar : 1-10 speakers + X viewers. Les viewers n'ont pas de vidéo/audio mais peuvent poser des questions via chat/Q&A.

### 10.6 Live events (broadcast, 10000+)
Streaming unidirectionnel avec chat et réactions. Infra CDN (HLS/DASH).

### 10.7 Breakout rooms au sein d'un meeting
Diviser en groupes (ex: 10 rooms de 5 personnes) pour les workshops. Chaque room est isolée, host peut broadcaster à tous.

### 10.8 Persistent rooms (huddles)
Room toujours ouverte dans un channel chat. Join/leave à tout moment.

### 10.9 Scheduled webinars avec registration
Landing page pour inscription (collecte emails). Email de confirmation + rappel. Accès via un lien unique.

### 10.10 Panelists vs attendees
Séparation des rôles : panelists ont vidéo/audio/screen share, attendees sont en lecture seule avec chat/Q&A.

---

## Catégorie 11 — Sécurité et confidentialité

### 11.1 E2E encryption (option)
Pour les meetings sensibles, chiffrement end-to-end. Pas de middlebox qui déchiffre. Compromis : pas de cloud recording, pas de transcription IA côté serveur (doit être en local).

### 11.2 Meeting password
Protéger l'accès par un mot de passe en plus de l'URL.

### 11.3 Authentication required
Forcer l'authentification SignApps pour rejoindre. Pas d'anonymes.

### 11.4 Domain restrictions
Autoriser uniquement les emails d'un ou plusieurs domaines.

### 11.5 Watermark on recording
Watermark avec le nom de l'utilisateur sur chaque frame enregistrée. Dissuade les leaks.

### 11.6 Screen capture detection
Détection (quand possible) quand un participant prend un screenshot. Notification au host.

### 11.7 Audit logs
Log de qui a rejoint/quitté quand, enregistrements, chats, polls. Pour compliance.

### 11.8 Compliance (GDPR, HIPAA, SOC2)
Modes configurables pour respecter les normes : data retention, data residency, encryption.

### 11.9 Data residency
Choisir la région où les données sont stockées (EU, US, APAC).

### 11.10 Do not record policy
Empêcher tout enregistrement sur certains meetings (ex: médical, juridique).

---

## Catégorie 12 — Accessibilité et mobile

### 12.1 Application mobile native
iOS et Android avec audio, vidéo, chat, reactions, raise hand. Bonne qualité même en 4G.

### 12.2 Background during call
Le meeting continue en arrière-plan quand on switch d'app sur mobile.

### 12.3 PiP (Picture in Picture)
Mini fenêtre flottante sur mobile et desktop pour continuer à voir/entendre pendant qu'on fait autre chose.

### 12.4 Auto-rotate et landscape
Support landscape sur mobile/tablette pour un meilleur rendu grid.

### 12.5 Bluetooth headset support
Support natif des Bluetooth (écouteurs, headset).

### 12.6 AirPlay / Chromecast
Caster le meeting sur un grand écran TV.

### 12.7 Keyboard shortcuts exhaustifs
- `Ctrl+D` : mute/unmute
- `Ctrl+E` : caméra on/off
- `Ctrl+M` : chat
- `Ctrl+P` : participants
- `Ctrl+H` : raise hand
- `Ctrl+Shift+S` : start/stop recording
- `Ctrl+L` : leave meeting
- `?` : aide
- `Space` : push to talk (mute par défaut)

### 12.8 Accessibility WCAG AA
Navigation clavier complète, screen reader annonces, contrastes, focus visible.

### 12.9 Live captions enabled par défaut pour audience avec besoins
Auto-enable des sous-titres pour les utilisateurs qui l'ont configuré.

### 12.10 Sign language interpretation spotlight
Épingler un interprète langue des signes en permanence sur l'écran pour les utilisateurs sourds.

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **Zoom Support** (support.zoom.us) — docs exhaustives : breakout rooms, webinars, recording, polls, compliance.
- **Google Meet Help** (support.google.com/meet) — features Workspace, captions, noise cancel.
- **Microsoft Teams Help** (support.microsoft.com/teams) — Live events, breakouts, Copilot, together mode.
- **Jitsi Handbook** (jitsi.github.io/handbook) — self-hosting, config avancée.
- **Daily.co Docs** (docs.daily.co) — API-first, recording, transcription.
- **LiveKit Docs** (docs.livekit.io) — SFU architecture, agents, room management.
- **BigBlueButton Docs** (docs.bigbluebutton.org) — education-focused features.
- **WebRTC Samples** (webrtc.github.io/samples) — exemples officiels WebRTC.

### Projets open source permissifs
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **Jitsi Meet** (github.com/jitsi/jitsi-meet) | **Apache-2.0** | Frontend et backend complet. Référence principale pour un Meet open source. **À étudier en profondeur**. |
| **Jitsi Videobridge** (github.com/jitsi/jitsi-videobridge) | **Apache-2.0** | SFU Java. Utilisable directement ou comme référence. |
| **LiveKit** (github.com/livekit/livekit) | **Apache-2.0** | SFU moderne en Go. Scalable, agents AI, excellente doc. **Recommandation #1**. |
| **LiveKit Client SDKs** | **Apache-2.0** | SDK JavaScript, iOS, Android, Flutter. |
| **LiveKit Agents** | **Apache-2.0** | Framework pour les agents IA temps réel (STT, TTS, LLM). |
| **Janus Gateway** (janus.conf.meetecho.com) | **GPL v3** | **INTERDIT**. WebRTC gateway. |
| **MediaSoup** (mediasoup.org) | **ISC** | SFU minimaliste en C++/Node. Très performant. Pattern très propre. |
| **ion-sfu** (github.com/pion/ion-sfu) | **MIT** | SFU en Go. Part de l'écosystème Pion. |
| **Pion** (github.com/pion/webrtc) | **MIT** | Implémentation WebRTC complète en Go. Base pour custom. |
| **Openvidu** (openvidu.io) | **Apache-2.0** | Platform complète pour vidéoconf. Sur Kurento. |
| **BigBlueButton** (bigbluebutton.org) | **LGPL v3** | **INTERDIT pour copie**, OK comme consommateur si dyn linking. Étudier via docs publiques. |
| **Matrix Video Conferencing** (Element Call) | **AGPL v3** | **INTERDIT**. |
| **Jami** (jami.net) | **GPL v3+** | **INTERDIT**. P2P FOSS. |
| **Signal Video** | **GPL v3** | **INTERDIT pour copie**. Protocole documenté. |
| **WebRTC standard** (webrtc.org) | **BSD-3-Clause** | Standard web natif, libre d'utilisation. |
| **Simple Peer** (github.com/feross/simple-peer) | **MIT** | Wrapper WebRTC simple pour du P2P. |
| **PeerJS** (peerjs.com) | **MIT** | Alternative pour les connexions P2P. |
| **RecordRTC** (recordrtc.org) | **MIT** | Recording côté client des streams WebRTC. |
| **MediaRecorder API** (MDN) | Web standard | Recording natif navigateur. |
| **OpusScript** (github.com/abalabahaha/opusscript) | **BSD-3-Clause** | Codec Opus en JS. |
| **WebRTC VAD** / **silero-vad** | **Apache-2.0** (silero) | Voice activity detection pour savoir quand quelqu'un parle. |
| **RNNoise** (github.com/xiph/rnnoise) | **BSD-3-Clause** | Noise suppression AI léger. |
| **TensorFlow.js (models)** | **Apache-2.0** | Models pour background blur, face detection. |
| **MediaPipe** (google.github.io/mediapipe) | **Apache-2.0** | Models Google pour face tracking, background segmentation, pose detection. |

### Pattern d'implémentation recommandé
1. **SFU backend** : **LiveKit** (Apache-2.0) est le choix #1. Moderne, scalable, agents AI intégrés, bien documenté. Alternative : Jitsi Videobridge (Apache-2.0) si on veut le package Jitsi complet. Ou MediaSoup (ISC) pour maximum de contrôle bas niveau.
2. **Client WebRTC** : LiveKit Client SDK (Apache-2.0) en React/JS. SDK natifs iOS/Android.
3. **Codec vidéo** : VP9 par défaut (libre), AV1 quand supporté (meilleur compression). H.264 en fallback.
4. **Codec audio** : Opus (libre, excellent pour la voix).
5. **Noise suppression** : RNNoise (BSD-3) pour le noise cancellation ML-based léger. Alternative : Web API native.
6. **Background blur / virtual background** : MediaPipe Selfie Segmentation (Apache-2.0) dans un worker.
7. **Face tracking / auto-framing** : MediaPipe Face Detection (Apache-2.0).
8. **Speech-to-Text (live captions)** : whisper-rs (Unlicense) local ou LiveKit Agents avec OpenAI/Google Speech. Privilégier local pour la privacy.
9. **Recording** : côté serveur via LiveKit egress (Apache-2.0) ou composition custom avec ffmpeg (dynamic linking).
10. **Transcription post-meeting** : whisper-rs (Unlicense) côté serveur.
11. **Chat intégré** : utiliser le module Chat SignApps (Tiptap + Yjs).
12. **Whiteboard** : tldraw (Apache-2.0) ou Excalidraw (MIT).
13. **TURN server** : Coturn (BSD-3) — standard industry pour le NAT traversal.
14. **STUN** : Google public STUN ou Coturn.
15. **Security** : DTLS-SRTP pour chiffrement media (standard WebRTC).
16. **Signaling** : LiveKit gère le signaling, ou WebSocket custom si on va MediaSoup.
17. **AI Copilot** : LiveKit Agents framework pour bots IA en temps réel (LLM, STT, TTS).

### Ce qu'il ne faut PAS faire
- **Pas de fork** de Janus, BBB (copie), Jami (tous GPL/LGPL).
- **Pas d'Element Call** (AGPL).
- **Attention à BBB** : LGPL, OK si dyn linking mais leur SDK n'est pas forcément adapté.
- **Pas de recording sans consentement explicite** — toujours annoncer et demander.
- **Pas d'E2E cassable** — si E2E activé, pas de cloud recording ni transcription IA côté serveur.

---

## Assertions E2E clés (à tester)

- Création d'un meeting instantané avec URL
- Création d'un meeting planifié via calendar
- Rejoindre un meeting via URL (no-install)
- Pre-meeting device check
- Toggle caméra on/off
- Toggle micro mute/unmute
- Sélection d'un autre micro/caméra
- Background blur activé
- Partage d'écran (window, tab, full screen)
- Annotation sur écran partagé
- Chat texte dans le meeting
- Emoji reactions
- Raise hand (host voit)
- Whiteboard collaboratif
- Poll créé et voté
- Breakout rooms (créer, assigner, revenir)
- Record meeting (avec consentement)
- Transcription automatique accessible après
- Auto-summary par IA
- Live captions
- Traduction live
- Lock meeting
- Mute all
- Remove participant
- Waiting room (admit individually)
- 1:1 call P2P
- Group call avec 10 participants
- Webinar mode avec Q&A
- Push to talk (Space)
- PiP mode
- Mobile : rejoindre, partager, raise hand
