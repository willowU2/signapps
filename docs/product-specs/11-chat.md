# Module Chat (messagerie) — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Slack** | Channels publics/privés, threads, DMs, Huddles (audio/video rapide), Canvas (docs collaboratifs intégrés), apps/bots, workflows, search indexé, mentions granulaires, custom statuses, timezones, dark mode, Slack AI, clips (messages vidéo) |
| **Microsoft Teams** | Intégration Office, meetings riches, channels avec tabs, Wiki, files, Microsoft 365 natif, compliance enterprise, Live events, breakout rooms |
| **Discord** | Voice channels persistants, roles et permissions granulaires, screen sharing, rich embeds, custom emoji, threads, stage channels, activities (games), communities scalabes |
| **Twist** (Doist) | Async first, threads = subject, pas de DM volatile, notifications sages, inbox structurée |
| **Basecamp Campfire** | Chat éphémère dans le contexte d'un projet, pas de distractions |
| **Zulip** | Topics (sous-canaux structurés), search puissant, open source, threading par topic |
| **Rocket.Chat** | Open source, omnichannel, self-hosted, customizable |
| **Element / Matrix** | Décentralisé, E2E par défaut, fédération, open source |
| **Mattermost** | Alternative Slack open source, entreprise, DevOps integration, self-hosted |
| **Keybase** | E2E, identités vérifiables, teams |
| **Telegram** | Stickers, bots puissants, channels massifs, secret chats, cloud |
| **Signal** | E2E par défaut, disparition automatique, privacy absolue |
| **Flock** / **Chanty** | Alternatives focus PME |

## Principes directeurs

1. **Channels + DMs + Threads** — trois modes complémentaires. Channels pour le persistent public, DMs pour le 1:1, threads pour les sujets imbriqués sans polluer le flux.
2. **Async-friendly** — pas de pression pour répondre immédiatement. Notifications intelligentes, statuts clairs, horaires respectés.
3. **Search puissante** — trouver un message, un fichier, un canal en moins de 2 secondes.
4. **Intégré au reste de SignApps** — mentions de tâches, partage de fichiers du drive, embed de docs, visio en un clic.
5. **E2E en option** — pour les conversations sensibles, chiffrement bout en bout.
6. **Léger** — l'app doit charger en <2s et fonctionner en offline.

---

## Catégorie 1 — Organisation et navigation

### 1.1 Workspaces
Top level : un workspace par organisation. Multi-workspace avec switcher.

### 1.2 Sidebar de navigation
- **Home** (vue d'accueil : unreads, mentions, threads suivis, DMs récents)
- **Unreads** (tous les messages non lus)
- **Threads** (threads auxquels on participe)
- **Mentions** (où on a été @mentionné)
- **Drafts** (brouillons)
- **Saved items** (messages bookmarkés)
- **Channels** section (liste des canaux, avec dot rouge pour unreads)
- **Direct messages** section (liste des DMs récents)
- **Apps & Integrations**

### 1.3 Channels publics et privés
- **Public** : tous les membres de l'orga peuvent rejoindre, découvrir, chercher
- **Privé** : invitation uniquement, invisible pour les non-membres
- **Externes** (shared channels) : canal partagé entre deux organisations différentes

### 1.4 Channels par catégories
Organiser les channels en sections : `#general`, `#engineering` (avec sub-channels), `#marketing`, `#random`. Collapsible.

### 1.5 Channel description et sujet
Chaque channel a une description (à quoi il sert) et un sujet (current focus, change fréquemment). Visible en haut du channel.

### 1.6 Pinning dans la sidebar
Épingler un channel ou une DM en haut pour accès rapide.

### 1.7 Muter un channel
Désactiver les notifications d'un channel sans s'en désabonner. Messages non lus comptés différemment.

### 1.8 Quitter un channel
Bouton `Leave channel` retire l'utilisateur. Le channel n'apparaît plus dans sa sidebar.

### 1.9 Découverte de channels
Page `Browse channels` avec liste de tous les channels publics, description, nombre de membres, dernière activité.

### 1.10 Favorite / Star
Marquer une conversation (DM ou channel) comme favorite → apparaît dans une section dédiée en haut.

### 1.11 Quick switcher
`Ctrl+K` ouvre un quick switcher pour naviguer entre channels/DMs/fichiers/apps.

### 1.12 Sidebar personnalisée
Drag-drop pour réorganiser l'ordre des channels dans la sidebar. Sections custom.

---

## Catégorie 2 — Messages et composition

### 2.1 Envoyer un message
Input en bas du channel. Taper + Entrée pour envoyer. Shift+Entrée pour saut de ligne.

### 2.2 Rich text formatting
Gras (`**text**`), italique (`*text*`), barré (`~~text~~`), code inline (\`text\`), code block (```code```), citation (`> text`), liste à puces (`- `), liste numérotée (`1. `), lien (`[text](url)`).

### 2.3 Éditeur rich text (sans markdown)
Toolbar avec boutons de formatting pour ceux qui ne connaissent pas markdown. Tiptap-based.

### 2.4 Emoji picker
`:` déclenche l'autocomplétion d'emoji (`:smile:` → 😀). Ou bouton émoji dans l'input.

### 2.5 @mentions
`@` déclenche l'autocomplétion des membres. `@channel` pour notifier tout le monde, `@here` pour les actifs, `@everyone` pour tous.

### 2.6 #channel mentions
`#` pour lier à un autre channel (autocomplétion).

### 2.7 Slash commands
`/` déclenche un menu de commandes :
- `/remind me [msg] [time]` — reminder
- `/topic [new topic]` — changer le sujet
- `/away` — passer en statut away
- `/poll` — créer un sondage
- `/task` — créer une tâche
- `/gif [keyword]` — envoyer un GIF
- `/zoom`, `/meet` — lancer une visio
- Extensions via apps/integrations

### 2.8 Pièces jointes
Drag-drop de fichiers, upload depuis le drive, URL. Preview inline des images/vidéos/audio. Card pour les docs.

### 2.9 Screen capture
Bouton "screenshot" pour capturer et envoyer directement. Cropping intégré.

### 2.10 Voice messages
Bouton micro pour enregistrer un message vocal. Waveform inline. Transcription automatique (STT).

### 2.11 Video messages (clips)
Enregistrer une vidéo courte (max 5 min) depuis la webcam et l'envoyer. Transcription automatique. Utile pour les explications asynchrones.

### 2.12 Brouillons automatiques
Les messages non envoyés sont sauvegardés comme brouillons (visibles dans `Drafts`). Restaurés au prochain focus.

### 2.13 Schedule send
Planifier l'envoi d'un message à une date/heure future. Utile pour les timezones différentes.

### 2.14 Edit message
Éditer un message après envoi (limite de temps configurable). Tag `(edited)` visible.

### 2.15 Delete message
Supprimer un message (pour tout le monde ou juste pour soi). Remplacement par "Message supprimé" ou absent selon la policy.

### 2.16 Undo send
Toast "Envoyé · Annuler" pendant 5 secondes pour récupérer une erreur.

### 2.17 Send message to self
"Messages personnels" : DM avec soi-même pour prendre des notes rapides. Accessible depuis la sidebar.

### 2.18 Message templates / Canned responses
Templates réutilisables pour les réponses fréquentes. Insertion en un clic via `/canned`.

---

## Catégorie 3 — Threads

### 3.1 Démarrer un thread
Survol d'un message → bouton `Reply in thread`. Ouvre un panneau latéral avec le message original et un input pour la réponse.

### 3.2 Vue thread
Panneau latéral avec le thread complet. Input en bas. Le thread ne pollue pas le channel principal.

### 3.3 Option `Send back to channel`
Quand on répond dans un thread, option de dupliquer la réponse dans le channel principal (pour les réponses importantes).

### 3.4 Compteur de réponses
Sur le message original dans le channel, "X réponses" avec avatars des participants. Clic ouvre le thread.

### 3.5 Thread follow
Automatiquement suivre un thread où on a participé. Notifications des nouvelles réponses.

### 3.6 Unfollow
Cesser de suivre un thread.

### 3.7 Vue `Threads` dans la sidebar
Liste tous les threads suivis avec indication des non-lus. Permet de retrouver facilement les discussions actives.

### 3.8 Resolve thread
Marquer un thread comme "résolu" (comme un commentaire). Utile pour les questions/réponses.

### 3.9 Thread summary par IA
Pour un thread de 30+ messages, bouton `Summarize` génère un résumé IA.

---

## Catégorie 4 — Réactions et interactions

### 4.1 Emoji reactions
Réactions rapides avec emoji sur un message. Picker accessible au survol. Quantité visible, liste des utilisateurs qui ont réagi.

### 4.2 Custom emoji
Upload de custom emoji pour l'organisation. Utilisable dans les messages et réactions.

### 4.3 Read receipts (lecture)
Indicateurs de qui a lu un message (optionnel, configurable par user).

### 4.4 Bookmark / Save for later
Enregistrer un message important pour le retrouver. Section `Saved items` dans la sidebar.

### 4.5 Share message
Partager un message dans un autre channel/DM. Citation avec lien vers l'original.

### 4.6 Copy link to message
Lien permanent vers un message pour le référencer ailleurs.

### 4.7 Remind me about this
Sur un message : "Me le rappeler dans 1h / demain / la semaine prochaine". Le bot envoie un rappel.

### 4.8 Mark as unread
Marquer un message comme non lu pour y revenir plus tard.

### 4.9 Actions message menu
Menu contextuel (clic droit ou survol) avec toutes les actions : reply, reply in thread, react, share, copy link, bookmark, remind, edit, delete, report.

---

## Catégorie 5 — Direct Messages et groupes

### 5.1 DM 1-to-1
Conversation privée entre deux utilisateurs.

### 5.2 DM groupe
Conversation privée à plusieurs (3-N utilisateurs) sans créer de channel.

### 5.3 Renommer un DM groupe
Ajouter un nom au DM pour le distinguer dans la sidebar.

### 5.4 Ajouter/retirer des participants
Dans un DM groupe, ajouter ou retirer des membres. Les anciens messages restent visibles pour les membres actuels.

### 5.5 Convert DM to channel
Transformer un DM groupe en channel privé pour ajouter plus de structure.

### 5.6 External DMs
DM avec des utilisateurs d'autres organisations (si les deux orgs acceptent le partage).

### 5.7 Self DM (Notes)
DM à soi-même pour garder des notes, liens, idées.

---

## Catégorie 6 — Recherche et découverte

### 6.1 Search globale
`Ctrl+F` ou barre de recherche globale. Cherche dans : messages, fichiers, canaux, personnes.

### 6.2 Syntaxe avancée
```
from:@jean        → auteur
in:#channel       → dans un channel
to:@sarah         → dans un DM avec sarah
has:link          → messages avec lien
has:file          → avec fichier
has:image         → avec image
after:2026-01-01  → après date
before:...        → avant date
"exact phrase"    → phrase exacte
```

### 6.3 Filtres facettés
Sidebar avec filtres : channel, auteur, type (message/fichier), date range.

### 6.4 Recherche dans les pièces jointes
Indexation du contenu des fichiers uploadés (PDFs, docs). Cherchable.

### 6.5 Results ranked
Résultats pertinents en haut : matches exacts, récents, fréquemment référencés.

### 6.6 Recherches sauvegardées
Sauvegarder une recherche comme un "smart filter" consultable à la demande.

### 6.7 Recherche AI
Question en langage naturel : "Dans quel channel Jean a parlé du lancement produit ?". L'IA traverse les messages et répond.

---

## Catégorie 7 — Voice et Video

### 7.1 Huddles (voice rooms)
Dans un channel, bouton `Start huddle` lance un audio room persistant. Membres peuvent join/leave à tout moment. Spectateurs peuvent écouter. Utile pour le deep work collaboratif.

### 7.2 Video calls
Lancer une visio depuis un channel ou DM. Fullscreen ou mini-window. Intégration avec le module Meet.

### 7.3 Screen sharing
Partager l'écran pendant une huddle ou video call. Sélection d'une app ou écran entier.

### 7.4 Voice notes
Enregistrer et envoyer un message audio court (1 min max). Waveform + transcription.

### 7.5 Clips vidéo
Enregistrer une vidéo courte (max 5 min) avec webcam et/ou écran. Envoyer comme message. Utile pour les walkthroughs.

### 7.6 Live captions
Sous-titres automatiques pendant les calls (STT en temps réel). Multi-language.

### 7.7 Reaction pendant un call
Réactions rapides en temps réel (thumbs up, clap, heart) sans interrompre.

### 7.8 Raise hand
Bouton "lever la main" pendant une huddle/call pour demander la parole sans interrompre.

---

## Catégorie 8 — Notifications et statuts

### 8.1 Statuts utilisateur
- **Active** (en ligne)
- **Away** (inactif depuis X min)
- **Do not disturb** (notifications off)
- **Out of office** (absent, avec dates de retour)
- **Custom status** (emoji + texte libre : "🍽️ Déjeuner", "🏠 Remote", "📝 Deep work")

### 8.2 Status scheduling
Planifier des statuts récurrents (`DND pendant les stand-ups`, `🏠 Remote tous les vendredis`).

### 8.3 Notifications par channel
Par channel, choisir quand notifier : `Tous les messages`, `Mentions directes seulement`, `Rien`. Override du global.

### 8.4 Keywords to notify
Ajouter des mots-clés personnels (ex: `billing`, `prod down`). Notif à chaque mention de ces mots, même sans @mention.

### 8.5 Do Not Disturb scheduling
Heures de DND automatiques (soirs, weekends, vacances). Respect de la zone horaire.

### 8.6 Notification preferences globales
- Son (on/off, choix du son)
- Desktop notifs (avec preview, sans preview, désactivée)
- Mobile notifs (on/off selon plateforme)
- Email digest (hebdomadaire, quotidien)

### 8.7 Snooze a conversation
Snooze une DM ou un channel pour X temps → pas de notif pendant cette durée.

### 8.8 Unread indicators
Point rouge pour les messages non lus. Compteur de mentions en badge.

### 8.9 Highlights summary
Email quotidien ou hebdomadaire résumant les messages importants manqués (IA-powered).

### 8.10 @channel / @here restrictions
Admin peut limiter qui peut utiliser @channel/@here (pour éviter le spam).

---

## Catégorie 9 — Fichiers et intégrations

### 9.1 Upload de fichiers
Drag-drop ou bouton d'upload. Fichiers stockés dans le module Drive sous un dossier lié au channel.

### 9.2 Preview inline
Images, vidéos, audio, PDF, docs : preview directement dans le chat sans télécharger.

### 9.3 Rich unfurl
Coller une URL → preview automatique (Open Graph) avec titre, description, image.

### 9.4 Smart chips (liens internes)
Coller un lien vers un doc/sheet/task SignApps → rendu comme smart chip avec infos live (titre, auteur, dernier modif).

### 9.5 Files browser
Onglet `Files` dans un channel listant tous les fichiers partagés avec filtres (type, date, auteur).

### 9.6 App integrations
Intégrations avec des apps tierces : GitHub (commits, PRs), Jira (issues), Figma (designs), Google Drive, Zoom, Loom, etc. Chaque app peut poster des messages riches avec actions.

### 9.7 Bots custom
API pour créer des bots custom. Hooks entrants/sortants, slash commands, messages riches.

### 9.8 Workflow builder
Créer des workflows automatisés : "Quand un formulaire est soumis, poster dans #sales avec les détails". No-code.

### 9.9 Canvas (docs dans chat)
Canvas est un doc collaboratif ancré à un channel. Tous les membres peuvent co-éditer. Utilisé pour les wiki d'équipe, les onboarding, les knowledge bases.

### 9.10 Reminders
`/remind` ou bouton "Reminder" sur un message. Le bot re-poste le message à l'heure demandée.

### 9.11 Polls
`/poll "Question ?" "Option 1" "Option 2"` crée un sondage visible dans le channel avec boutons de vote.

### 9.12 Giphy / stickers
Intégration Giphy pour des GIFs. Stickers custom par workspace.

---

## Catégorie 10 — Collaboration et équipe

### 10.1 Shared channels (entre organisations)
Channel partagé entre deux orgs SignApps différentes. Utile pour les collaborations client-fournisseur.

### 10.2 Guest users
Inviter des externes (clients, freelances) dans des channels spécifiques avec accès limité. Pas d'accès aux autres channels de l'orga.

### 10.3 User groups
Groupes nommés (`@engineering`, `@marketing`, `@on-call`). @mention d'un groupe notifie tous ses membres.

### 10.4 Role-based permissions
Admin, Manager, Member, Guest. Permissions granulaires sur les channels, DM, apps, workflows.

### 10.5 Channel members list
Liste des membres d'un channel avec rôles et statuts. Bouton add/remove pour les admins.

### 10.6 Announcement channels
Channel où seuls les admins/owners peuvent poster. Les autres peuvent seulement réagir.

### 10.7 Archive channel
Archiver un channel (plus actif mais accessible pour historique). Pas de nouveau message possible.

### 10.8 Delete channel (admin only)
Supprimer un channel définitivement. Avec confirmation.

### 10.9 Transfer ownership
Transférer le rôle de channel admin à un autre membre.

### 10.10 Group DMs avec gestion
Ajouter/retirer des participants dans un DM groupe sans perdre l'historique.

---

## Catégorie 11 — IA intégrée

### 11.1 Résumé de conversation
Bouton `Résumer` sur un channel ou thread pour obtenir un summary IA des derniers N messages.

### 11.2 Catch up
`Catch me up` génère un résumé des messages manqués depuis la dernière visite dans un channel. Liste les points importants.

### 11.3 Smart reply
Sous un message, 3 suggestions de réponse contextuelles générées par l'IA.

### 11.4 Traduction automatique
Traduire un message dans une autre langue en un clic. Utile pour les équipes multilingues.

### 11.5 Q&A sur l'historique
"Quels sont les blockers du sprint actuel ?" → l'IA parcourt les messages récents et répond.

### 11.6 Sentiment analysis
Analyse du sentiment général d'un channel (morale de l'équipe). Dashboard pour les managers.

### 11.7 Extraction d'action items
Sur un thread de discussion → bouton `Extract action items` crée des tâches automatiques.

### 11.8 Channel recommendations
Suggère des channels à rejoindre basé sur les intérêts et l'activité de l'utilisateur.

### 11.9 Duplicate question detection
Détection automatique des questions déjà posées dans d'autres channels. Link vers la réponse précédente.

### 11.10 Meeting notes generation
Si un call est enregistré, résumé automatique posté dans le channel après le call.

---

## Catégorie 12 — Sécurité et conformité

### 12.1 E2E encryption (optionnel par channel)
Pour les channels hautement sensibles, chiffrement end-to-end avec clés dérivées. Le serveur ne peut pas lire.

### 12.2 Retention policies
Règles par channel : conserver X jours, X années, ou infiniment. Suppression automatique.

### 12.3 Legal hold
Marquer un channel sous séquestre : aucune suppression possible.

### 12.4 Audit logs
Log immuable : qui a posté/supprimé/modifié quoi, quand, depuis où. Pour compliance.

### 12.5 DLP (Data Loss Prevention)
Détection automatique de données sensibles (cartes bancaires, SSN, clés API) dans les messages. Warning ou blocage.

### 12.6 External sharing policies
Admin peut interdire/limiter le partage externe de messages, fichiers, screenshots.

### 12.7 Screenshots detection
Impossible (techniquement) sur tous les OS, mais warning si on essaie via l'app native.

### 12.8 2FA obligatoire
Admin peut forcer 2FA sur tous les comptes.

### 12.9 Approved apps list
Admin peut restreindre quelles apps tierces peuvent être installées par les utilisateurs.

### 12.10 SAML / SSO
Login via SSO enterprise (Okta, Azure AD, Google Workspace).

---

## Catégorie 13 — Mobile et accessibilité

### 13.1 Application mobile native
iOS et Android avec toutes les features principales. Push notifications, offline support.

### 13.2 Swipe gestures
Swipe pour répondre, archive, delete sur mobile.

### 13.3 Keyboard shortcuts exhaustifs
- `Ctrl+K` : quick switcher
- `Ctrl+F` : search
- `Ctrl+T` : threads
- `Ctrl+Shift+A` : all unreads
- `Ctrl+Shift+M` : mentions
- `Ctrl+Up/Down` : scroll back in channel
- `Ctrl+.` : next unread channel
- `Ctrl+J` : jump to date
- `Alt+↑/↓` : previous/next channel
- `Esc` : mark all read
- `?` : help

### 13.4 Accessibilité WCAG AA
Screen reader, navigation clavier, contrastes, focus visible.

### 13.5 Offline mode
Lire l'historique mis en cache hors-ligne. Envoyer en queue.

### 13.6 Multi-workspace
Switcher entre plusieurs workspaces (pro, perso, projets).

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **Slack Help Center** (slack.com/help) — guides channels, threads, huddles, workflows, apps, compliance.
- **Slack Academy** (app.slack.com/academy) — certifications et cours.
- **Microsoft Teams Support** (support.microsoft.com/teams) — channels, meetings, Office integration.
- **Discord Help Center** (support.discord.com) — voice channels, roles, permissions.
- **Twist Help** (twist.com/help) — async workflows.
- **Zulip Docs** (zulip.com/help) — topics, search, keyboard.
- **Rocket.Chat Docs** (docs.rocket.chat) — self-hosting, admin.
- **Matrix.org Docs** (matrix.org/docs) — décentralisé, E2E.

### Projets open source permissifs
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **Mattermost** (mattermost.com) | **AGPL v3** | **INTERDIT**. Alternative Slack open source enterprise. |
| **Rocket.Chat** (rocket.chat) | **MIT** | Chat open source. Référence pour le self-hosting et l'admin. **À étudier**. |
| **Element / Matrix** (element.io) | **Apache-2.0** | Décentralisé, E2E. Excellente référence pour le protocole et l'architecture. |
| **Matrix Synapse** (github.com/matrix-org/synapse) | **Apache-2.0** | Serveur Matrix Python. Pattern pour le serveur. |
| **Dendrite** (github.com/matrix-org/dendrite) | **Apache-2.0** | Serveur Matrix Go. |
| **Conduit** (conduit.rs) | **Apache-2.0** | Serveur Matrix Rust léger. |
| **Zulip** (zulip.com) | **Apache-2.0** | Chat avec topics. Référence pour la structuration des threads. **À étudier**. |
| **Tinode** (tinode.co) | **Apache-2.0** | Chat backend/client open source. Simple et performant. |
| **Revolt** (revolt.chat) | **AGPL v3** | **INTERDIT**. Alternative Discord. |
| **Rocket.Chat API Client** | **MIT** | SDK client. |
| **Signal Protocol** (signal.org/docs) | **GPL v3** | **INTERDIT pour copie**, mais le protocole est documenté et réimplémentable. |
| **OLM / Megolm** (matrix.org/olm) | **Apache-2.0** | Implementation de la crypto E2E (Signal-like) pour Matrix. Utilisable directement. |
| **Yjs** (yjs.dev) | **MIT** | CRDT pour la collab (si on fait des canvas co-edit). |
| **Socket.io** (socket.io) | **MIT** | WebSockets avec fallback. |
| **ws** (github.com/websockets/ws) | **MIT** | WebSocket Node plus léger. |
| **tokio-tungstenite** (crates.io/crates/tokio-tungstenite) | **MIT** | WebSocket Rust. |
| **Tantivy** (quickwit.io) | **MIT** | Full-text search pour les messages. |
| **MeiliSearch** (meilisearch.com) | **MIT** | Alternative plus simple pour la recherche. |
| **emoji-mart** (github.com/missive/emoji-mart) | **BSD-3-Clause** | Emoji picker React. |
| **linkifyjs** (linkify.js.org) | **MIT** | Auto-détection et transformation des URLs/emails/mentions. |
| **dompurify** (github.com/cure53/DOMPurify) | **Apache-2.0** | Sanitize HTML des messages. |
| **highlight.js** (highlightjs.org) | **BSD-3-Clause** | Syntax highlighting pour les code blocks. |
| **Tiptap** (tiptap.dev) | **MIT** | Éditeur rich text (déjà utilisé par Docs). |
| **react-window** / **react-virtualized** | **MIT** | Virtualisation des listes de messages. |
| **@tanstack/react-virtual** | **MIT** | Alternative moderne. |
| **LiveKit** (livekit.io) | **Apache-2.0** | Backend WebRTC pour les calls (huddles, video). Excellent pour les SFU. |
| **Jitsi Meet** (jitsi.org) | **Apache-2.0** | Alternative self-hosted pour video calls. |

### Pattern d'implémentation recommandé
1. **Protocole** : Matrix (Apache-2.0) est l'option la plus robuste pour un chat fédérable, mais complexe. Alternative : WebSocket custom avec un protocole simple (JSON messages) pour un chat non-fédéré.
2. **Backend** : Rust avec `tokio-tungstenite` (MIT) pour les WebSockets. Event sourcing pour la persistence.
3. **Full-text search** : Tantivy (MIT) pour l'indexation. Invalidation par event.
4. **E2E encryption** : OLM/Megolm (Apache-2.0) — même lib que Matrix, éprouvée, Signal-level security.
5. **Rich text input** : Tiptap (MIT) — le même éditeur que Docs pour cohérence.
6. **Emoji picker** : emoji-mart (BSD-3).
7. **URL detection** : linkifyjs (MIT).
8. **Code highlighting** : highlight.js (BSD-3) ou Shiki (MIT).
9. **Virtualisation messages** : react-virtualized (MIT) ou @tanstack/react-virtual (MIT).
10. **Huddles (voice)** : LiveKit (Apache-2.0) comme SFU. Client WebRTC natif.
11. **Video calls** : LiveKit (Apache-2.0) ou intégration Meet interne SignApps.
12. **Voice messages** : `MediaRecorder` API natif + upload dans le Drive.
13. **Push notifications** : FCM (Firebase) pour Android, APNs pour iOS, WebPush pour browser.
14. **Transcription** : whisper-rs (Unlicense) côté serveur.
15. **AI features** : LLM interne avec context windows.

### Ce qu'il ne faut PAS faire
- **Pas de fork** de Mattermost, Revolt (AGPL).
- **Pas de copie** de Signal code (GPL). Le protocole est libre, la lib non.
- **Attention à OLM/Megolm** : Apache-2.0, OK mais complexe. Bien comprendre les mécanismes de clés.
- **Pas de stockage en clair** des messages E2E côté serveur.

---

## Assertions E2E clés (à tester)

- Création d'un channel public
- Création d'un channel privé
- Invitation d'un membre dans un channel
- Envoi d'un message texte
- Message avec formatting (gras, italique, code)
- @mention d'un utilisateur (notif)
- @mention de tout le channel
- Thread (reply dans un thread)
- Ajout d'une emoji reaction
- Upload d'un fichier (image, doc, vidéo)
- Preview inline des fichiers
- Recherche globale avec opérateurs
- Switcher de channel avec Ctrl+K
- DM 1:1 et DM groupe
- Huddle (voice room) démarrée
- Video call depuis un channel
- Status utilisateur (DND, custom)
- Mute d'un channel
- Schedule send d'un message
- Edit et delete message
- Brouillon auto-sauvegardé
- Slash commands (/poll, /remind, /task)
- Smart reply suggestions
- Traduction d'un message
- Résumé d'un channel avec IA
- Archive et restauration d'un channel
- Workflow automation déclenché
- Guest users limités aux bons channels
- Push notifications mobile
- Offline : lire l'historique cache
