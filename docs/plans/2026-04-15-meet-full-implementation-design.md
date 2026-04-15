# SignApps Meet — Full Implementation (Design)

**Date** : 2026-04-15
**Statut** : Validé, prêt pour planification
**Modules touchés** : `signapps-meet`, `signapps-containers`, `signapps-storage`, `signapps-calendar`, `signapps-chat`, `signapps-mail`, `signapps-notifications`, nouveau crate `signapps-livekit-client`, frontend `client/src/app/meet/`, `client/src/components/meet/`

## Contexte

Le module Meet a une base solide côté front (LiveKit client SDK réel, 13 composants, router) et côté back (routes CRUD, tokens JWT, schéma DB `meet.*`) mais :

- Aucun serveur LiveKit déployé → impossible de tenir une vraie réunion
- Backend stubs (kick / mute / recording) qui ne parlent pas à LiveKit Server API
- Aucune intégration Calendar / Chat / Mail / Notifications
- Pas de device pre-check, pas de waiting room, pas de virtual bg, pas de recording fonctionnel
- 0 data-testid, 0 E2E

**Objectif** : livrer toute la spec `docs/product-specs/12-meet.md` (547 lignes) — Meet fonctionnel, design signature SignApps, intégrations transverses.

## Approche — livraison phasée

5 phases indépendantes, chacune mergeable dès prête. Ordre strict : infra d'abord (sans LiveKit, rien ne marche), puis fonctionnel, puis UI, puis features avancées, puis intégrations.

| Phase | Contenu | Livrables |
|-------|---------|-----------|
| **0 — Infra** | LiveKit Server containerisé via `signapps-containers`, JWT config partagée, bucket `system-recordings` | Container auto-démarré, health check, secrets gérés |
| **1 — Core fonctionnel** | `signapps-livekit-client` crate, refacto stubs, lobby, webhook LiveKit | Create / join / leave fiable, mute / kick réels |
| **2 — UI signature SignApps** | Redesign dashboard `/meet`, lobby `/meet/[code]/lobby`, in-meeting `/meet/[code]` | Tokens sémantiques, layout distinctif, top bar + sidebar + controls bottom |
| **3 — Features avancées** | Recording, transcription, waiting room, virtual bg, raise hand, polls, Q&A, whiteboard | Chaque feature feature-flaggable, tests E2E smoke |
| **4 — Intégrations** | Calendar, Chat, Mail, Notifications | Boutons cross-module + event bus |

## Architecture haute

```
┌─────────────────────────────────────────────────┐
│  Frontend Next.js (client/src/app/meet/)       │
│  ├─ /meet                 (dashboard)           │
│  ├─ /meet/[code]          (in-meeting)          │
│  └─ /meet/[code]/lobby    (pre-check)           │
└─────────────────┬───────────────────────────────┘
                  │ REST + WebSocket
┌─────────────────▼───────────────────────────────┐
│  signapps-meet (:3014) — rooms, tokens, ctrls   │
│     └─> LiveKit Server SDK (REST) → LiveKit     │
│     └─> PgEventBus → calendar, chat, mail        │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│  LiveKit Server (Docker, via signapps-containers)│
│     port 7880 (signaling) + UDP 50000-60000     │
└─────────────────────────────────────────────────┘
```

## Scope complet

**Core** : create / join / leave, audio / vidéo, screen share, mute / camera toggle
**Lobby** : device pre-check caméra / micro, preview live, toggle blur arrière-plan
**Controls** : kick / mute forcé par host (LiveKit Server API réel)
**Recording** : start / stop + egress vers `system-recordings/` + download signé 24h
**Transcription** : temps réel via `signapps-media` STT + export (md / srt / txt)
**Waiting room** : knock-to-enter + host approve / deny
**Virtual backgrounds** : blur + presets + custom (Mediapipe client-side)
**Raise hand** : signal non-verbal via data channel
**Polls + Q&A** : modérés par host, persistés en DB
**Whiteboard** : tldraw + Yjs (via signapps-collab)
**Annotations screen-share** : out-of-scope Phase 3 (reporté Phase 5+)

## Nouveau crate `signapps-livekit-client`

Wrapper Rust autour de l'API REST LiveKit Server. Consommé par `signapps-meet` d'abord, puis `signapps-calendar` / `signapps-chat` pour créer des salles programmées.

API publique :

- `LiveKitClient::from_env()` — lit `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `generate_token(room, identity, grants)` — JWT participant
- `create_room(name, opts)`, `delete_room(name)`
- `list_participants(room)`, `remove_participant(room, identity)`, `mute_participant(room, identity, track_sid)`
- `start_egress(room, dest)`, `stop_egress(id)`

## Configuration LiveKit

- `.env` partagé : `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `livekit.yaml` généré par `signapps-containers` au premier démarrage avec les mêmes valeurs
- Egress destination : bucket `system-recordings/` sur signapps-storage
- Ports : 7880 (signaling HTTP), 7881 (TCP WebRTC), 50000-60000 UDP

## Endpoints API ajoutés

| Méthode | Path | Rôle |
|---------|------|------|
| POST | `/meet/rooms/instant` | Créer salle immédiate + code 6 digits |
| POST | `/meet/rooms/scheduled` | Créer salle planifiée |
| GET  | `/meet/rooms/:code` | Infos salle publiques |
| POST | `/meet/rooms/:code/join` | Valider l'accès + retourner token |
| GET  | `/meet/rooms/:code/lobby` | Pré-check : is_open, requires_knock, has_password |
| POST | `/meet/rooms/:code/knock` | Demander à entrer |
| POST | `/meet/rooms/:code/admit/:identity` | Host admet |
| POST | `/meet/rooms/:code/deny/:identity` | Host refuse |
| POST | `/meet/rooms/:code/kick/:identity` | Host kick |
| POST | `/meet/rooms/:code/mute/:identity` | Host force mute |
| POST | `/meet/rooms/:code/recording/start` | Start egress |
| POST | `/meet/rooms/:code/recording/stop` | Stop egress |
| GET  | `/meet/rooms/:code/transcription/stream` | SSE transcription |
| POST | `/meet/webhooks/livekit` | Callback LiveKit events |

Tous protégés `auth_middleware` sauf `/lobby` (public, pour invité anonyme).

## UI design

### Dashboard `/meet`

- Titre hero "Réunions vidéo"
- 2 grandes cartes : "Démarrer un appel instantané" (primary) + "Rejoindre avec un code" (input + bouton outline)
- Section "À venir (agenda)" = query events calendar `has_meet_room = true` entre maintenant et +7j
- Section "Mes salles permanentes" en grille de cards (avec count participants actifs temps réel)
- Section "Récentes (7 jours)" avec durée, participants, statut recording

Suppression des 4 KPI cards actuels (pas utiles au quotidien).

### Lobby `/meet/[code]/lobby`

- Preview caméra live (mirror, 16:9, 640×360)
- Dropdowns devices caméra / micro / speaker
- Barre niveau micro live
- Toggle camera on/off, micro on/off, blur bg
- Input nom affiché (pré-rempli display_name)
- Bouton primary "Rejoindre maintenant"

### In-meeting `/meet/[code]`

Layout 3 zones :

- **Top bar** (h-12) : bouton quitter, nom salle + count participants, menu options
- **Zone vidéo** : LiveKit GridLayout adaptatif (1×1 / 2×2 / 3×3 / auto), tile active speaker avec ring primary, overlay nom + status bottom-left
- **Sidebar droite** (toggleable) : onglets Chat / Participants / Polls / Q&A / Whiteboard
- **Bottom controls** : mute micro (rond), camera on/off, screen share, raise hand, menu `•••` (virtual bg, recording, transcription), bouton End rouge

Fullscreen tile = speaker view (autres en strip latéral).
Responsive mobile : sidebar = drawer bottom, controls compacts.

Tokens : `bg-background`, `bg-card border-border shadow-sm`, `bg-primary text-primary-foreground`, `bg-muted` pour hover, `text-foreground` / `text-muted-foreground`.

## Migrations SQL

À créer (STOP-point utilisateur à valider individuellement) :

1. `NNN_meet_extensions.sql`
   - Colonnes sur `meet.rooms` : `host_identity TEXT`, `requires_knock BOOLEAN DEFAULT false`, `recording_enabled BOOLEAN DEFAULT false`, `has_password BOOLEAN DEFAULT false`
   - Nouvelle table `meet.waiting_room_requests` : `id UUID PK`, `room_id`, `identity`, `display_name`, `status`, `created_at`
   - Nouvelle table `meet.polls` : `id`, `room_id`, `question`, `options JSONB`, `votes JSONB`, `created_at`, `closed_at`
   - Nouvelle table `meet.raised_hands` : `room_id`, `identity`, `raised_at`, `lowered_at`
   - Nouvelle table `meet.transcriptions` : `id`, `room_id`, `speaker_identity`, `text`, `timestamp_ms`, `language`, `created_at`

2. `NNN_calendar_meet_room.sql`
   - Colonnes sur `calendar.events` : `has_meet_room BOOLEAN DEFAULT false`, `meet_room_code TEXT`

## PgEventBus

`signapps-meet` publie :

- `meet.room.created` → consommé par calendar
- `meet.room.ended` → consommé par notifications (recording en cours)
- `meet.recording.ready` → consommé par storage + notifications
- `meet.participant.joined` / `left` → consommé par chat
- `meet.knock.requested` → consommé par notifications (badge host)

## Intégrations cross-modules

### Calendar → Meet

- Champ `has_meet_room` toggle dans modal event
- Au submit → signapps-calendar appelle signapps-meet `/rooms/scheduled` → récupère code → stocke
- Card event : bouton "📹 Rejoindre"
- Notif push 15 min avant le début
- Dashboard `/meet` section "À venir" = query events calendar

### Chat → Meet

- Bouton toolbar thread "📹 Démarrer un appel"
- Click → signapps-chat appelle signapps-meet `/rooms/instant` avec participants du thread comme invites
- Message système posté dans le thread : "Alice a démarré un appel vidéo — [Rejoindre]"

### Mail → Meet

- Compose : option "Joindre invitation réunion"
- Formulaire date/heure/durée → génère `.ics` attaché avec `X-SIGNAPPS-MEET-CODE` + lien dans le body

### Notifications

Ajouts `signapps-notifications` :

- `meet.invited` — Alice t'invite à un meet
- `meet.knock_received` — demande d'entrée (host)
- `meet.starting_soon` — 15 min avant
- `meet.recording_ready` — enregistrement prêt

## Conventions appliquées

- Rust : `#[tracing::instrument]`, `AppError` RFC 7807, `#[utoipa::path]` + `ToSchema`, `/// rustdoc`, pas de `.unwrap()` hors tests
- TypeScript : tokens Tailwind sémantiques, path alias `@/*`, hooks React Query, `"use client"` sur composants client
- Commits : Conventional Commits, un commit par unité logique
- STOP-points obligatoires : avant chaque migration SQL, avant déploiement container LiveKit si quota Docker / ports UDP 50000-60000 posent problème

## Risques & points d'arrêt

- **Ports UDP 50000-60000** sur Windows : firewall par défaut peut bloquer, documenter dans README container
- **LiveKit egress → S3** : signapps-storage doit accepter l'authent S3 de LiveKit (ajuster storage OpenDAL config si besoin)
- **Transcription temps réel** : charge CPU signapps-media, tester avec 1 speaker avant 4+
- **Virtual backgrounds** : fallback blur obligatoire si Mediapipe trop lent (seuil < 20 FPS)
- **Whiteboard tldraw + Yjs** : vérifier compatibility version tldraw avec le Yjs existant de signapps-collab

## Commits estimés par phase

| Phase | Commits estimés |
|-------|-----------------|
| 0 — Infra | 3-4 |
| 1 — Core | 8-10 |
| 2 — UI | 6-8 |
| 3 — Features | 10-12 |
| 4 — Intégrations | 6-8 |
| **Total** | **~35-40** |

Branche `feat/meet-full-impl`, merge par phase ou tout en fin selon préférence utilisateur.
