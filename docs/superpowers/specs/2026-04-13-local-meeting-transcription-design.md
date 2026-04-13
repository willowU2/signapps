# Local Meeting Transcription — Design Spec

**Date:** 2026-04-13
**Status:** Approved
**Inspiration:** [Tome App](https://github.com/Gremble-io/tome-app)

## Overview

Transcription locale de meetings — internes (SignApps Meet) et externes (capture audio système via Tauri). Tout est traité localement, aucun audio envoyé vers des services cloud. Les transcriptions sont converties en documents Tiptap éditables, intégrés à l'écosystème docs/drive/search existant.

## Scope V1

- Pipeline post-meeting pour les meetings internes SignApps Meet (compléter les 5 étapes existantes)
- Capture audio externe (Zoom, Teams, etc.) via Tauri desktop avec transcription locale
- Diarization hybride : flux LiveKit pour les meetings internes, pyannote pour les captures externes
- Document Tiptap structuré en sortie
- Architecture pluggable prête pour le streaming live en v2

## Decisions

| Question | Décision |
|----------|----------|
| Moteur STT | Pluggable : whisper-rs natif (défaut desktop), Faster-Whisper HTTP (fallback serveur) |
| Diarization | Hybride : flux séparés LiveKit (interne), pyannote (externe) |
| Capture audio OS | Cross-platform : WASAPI (Win), CoreAudio (macOS), PulseAudio (Linux) |
| Format de sortie | Document Tiptap (intégré à signapps-docs) |
| Live transcription | V2 — spec documenté ci-dessous, pas implémenté |

## Data Model

```rust
/// Un segment de transcription avec attribution de speaker
struct Segment {
    id: Uuid,
    start_ms: u64,
    end_ms: u64,
    text: String,
    speaker: Option<String>,
    confidence: f32,
}

/// Métadonnées de la session transcrite
struct SessionMeta {
    session_id: Uuid,
    source: TranscriptionSource,
    source_app: Option<String>,    // "Zoom", "Teams", etc.
    duration_ms: u64,
    language: String,
    speakers: Vec<Speaker>,
    created_at: DateTime<Utc>,
    recording_id: Option<Uuid>,
}

enum TranscriptionSource {
    Meet,
    ExternalCapture,
    VoiceMemo,
}

struct Speaker {
    id: String,
    label: String,
    person_id: Option<Uuid>,
}

/// Résultat unifié — contrat de sortie des deux pipelines
struct TranscriptionResult {
    meta: SessionMeta,
    segments: Vec<Segment>,
}
```

### SQL Migration

Table `meet.transcription_jobs` :

```sql
CREATE TABLE meet.transcription_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id UUID REFERENCES meet.recordings(id),
    capture_session_id UUID,          -- pour les captures externes
    source TEXT NOT NULL,             -- 'meet', 'external_capture', 'voice_memo'
    status TEXT NOT NULL DEFAULT 'pending',  -- pending → processing → completed → failed
    source_app TEXT,
    language TEXT,
    duration_ms BIGINT,
    document_id UUID,                 -- lien vers le doc Tiptap créé
    speaker_count INTEGER,
    segment_count INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    tenant_id UUID NOT NULL
);

CREATE INDEX idx_transcription_jobs_status ON meet.transcription_jobs(status);
CREATE INDEX idx_transcription_jobs_tenant ON meet.transcription_jobs(tenant_id);
CREATE INDEX idx_transcription_jobs_recording ON meet.transcription_jobs(recording_id);
```

## Architecture

```
trait TranscriptionPipeline {
    fn process(input: AudioInput) -> Result<TranscriptionResult>;
}
```

Deux implémentations, même sortie :

### MeetPipeline (serveur, signapps-media)

1. Reçoit `meet.session.ended` via PgEventBus
2. Fetch audio depuis signapps-storage (recording path dans `meet.recordings`)
3. Transcrit via `SttBackend` (whisper-rs natif ou Faster-Whisper HTTP)
4. Diarize par flux LiveKit — chaque participant a son track, attribution directe `track → user_id → display_name`
5. Crée le document Tiptap via `POST /api/v1/docs`, met à jour `transcription_jobs`

### CapturePipeline (Tauri desktop)

1. Capture dual-stream via trait `AudioCapture` (micro + audio système)
2. Transcrit localement via whisper-rs embarqué
3. Diarize via pyannote sidecar Python sur le flux mixé
4. POST le `TranscriptionResult` vers `signapps-media` → crée le doc Tiptap

## Audio Capture (Tauri)

```rust
trait AudioCapture: Send + Sync {
    fn start(&mut self, config: CaptureConfig) -> Result<AudioStream>;
    fn stop(&mut self) -> Result<AudioBuffer>;
    fn list_sources(&self) -> Result<Vec<AudioSource>>;
}

struct CaptureConfig {
    sample_rate: u32,           // 16000 Hz
    channels: u16,              // 1 (mono)
    capture_mic: bool,
    capture_system: bool,
    source_filter: Option<String>,
}
```

| OS | Crate | Mécanisme |
|---|---|---|
| Windows | `cpal` + `windows` | WASAPI loopback |
| macOS | `coreaudio-rs` | ScreenCaptureKit audio tap |
| Linux | `cpal` | PulseAudio monitor source |

**Silence detection** : VAD par énergie RMS, auto-stop après 120s de silence (configurable).

## Diarization

**Meetings internes** : pas de ML. Chaque participant LiveKit a un track audio identifié par `user_id`. Attribution directe `track_participant_identity → users.username → persons.display_name`.

**Capture externe** : pyannote sidecar Python.
- Modèle : `pyannote/speaker-diarization-3.1` (~80Mo, licence MIT)
- Exécution post-session uniquement
- Communication : `Command::new("python")`, stdin/stdout JSON
- Speakers labellisés "Speaker 1", "Speaker 2" — renommage dans l'UI Tiptap
- Fallback si Python absent : transcription sans diarization, warning dans le document
- Distribution : download au premier lancement (évite un installeur de 150Mo, comme Tome pour Parakeet)

## Document Tiptap

Deux extensions custom :

**`transcriptMeta`** : bandeau de métadonnées en haut du document (durée, source, speakers, langue).

**`transcriptSegment`** : bloc avec avatar speaker + timestamp cliquable.

```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 1 },
      "content": [{ "type": "text", "text": "Réunion — 13 avril 2026, 14:30" }]
    },
    {
      "type": "transcriptMeta",
      "attrs": {
        "duration": "00:42:15",
        "source": "meet",
        "speakers": ["Pierre Durand", "Marie-Claire Béranger"],
        "language": "fr"
      }
    },
    {
      "type": "transcriptSegment",
      "attrs": { "speaker": "Pierre Durand", "timestamp": "00:01:23" },
      "content": [{ "type": "text", "text": "On commence par le point sur la migration cloud..." }]
    }
  ]
}
```

- Créé via `POST /api/v1/docs` avec `type: "transcript"`
- Placé dans le Drive, dossier auto "Transcriptions"
- Indexé dans `global_search_index`
- Entièrement éditable après création

## Frontend Tauri — UX Capture Externe

Overlay compact, toujours au premier plan :

```
┌──────────────────────────────────┐
│ ● REC  00:42:15    Zoom Meeting  │
│ ▃▅▇▅▃▁▃▅▇▅▃           ⏸  ⏹     │
│ Transcription en cours...        │
└──────────────────────────────────┘
```

- Liste des sources audio détectées au démarrage
- Waveform RMS temps réel
- Détection auto de l'app de conférence active
- Auto-stop sur 120s silence
- Post-session : barre de progression → notification "Document créé"
- Menu system tray "Transcription"
- Raccourci global configurable (ex: `Ctrl+Shift+T`)
- Consultation des transcriptions dans l'UI web existante

## V2 — Streaming Live (spec only)

Troisième pipeline `StreamingPipeline`, même trait, mode continu :

```
Audio track → VAD (chunks 3-5s) → whisper-rs streaming
    → WebSocket broadcast type "transcript.segment"
    → sous-titres live dans l'UI Meet
    → buffer complet → TranscriptionResult final → document Tiptap
```

Composants à ajouter en v2 :
- `StreamingTranscriber` : VAD + Whisper par chunks, résultats intermédiaires via WebSocket
- Message WebSocket : `{ type: "transcript.segment", speaker, text, timestamp, is_final }`
- Composant React `<LiveCaptions>` : overlay sous-titres en bas de la vidéo
- Latence cible : < 3s
- Le buffer complet produit le même `TranscriptionResult` → même doc Tiptap

Ce qui ne change pas entre v1 et v2 : modèle de données, format de sortie, intégration docs.

## Existing Code to Reuse

| Composant | Localisation | État |
|-----------|-------------|------|
| `SttBackend` trait | `signapps-media` | Fonctionnel, pluggable |
| Whisper HTTP client | `signapps-media` | Configuré, prêt |
| `whisper-rs` natif | `signapps-media` (feature `native-stt`) | Compilable |
| LiveKit integration | `signapps-meet` | Fonctionnel |
| Meet recording lifecycle | `signapps-meet` | Status tracking ok |
| Transcription handler (partiel) | `signapps-meet/handlers` | 2/5 étapes faites |
| Event bus broadcast | `signapps-common` | Fonctionnel |
| Frontend Transcription component | `client/src/components` | Web Speech + Whisper HTTP |
| Tauri app shell | `src-tauri` | Minimal mais fonctionnel |
| Audio decoders | `signapps-media` (symphonia) | MP3, Ogg, FLAC, WAV, AAC |

## New Crates / Files

| Nouveau | Rôle |
|---------|------|
| `crates/signapps-transcription/` | Trait `TranscriptionPipeline`, `TranscriptionResult`, conversion Tiptap |
| `crates/signapps-audio-capture/` | Trait `AudioCapture` + implémentations WASAPI/CoreAudio/PulseAudio |
| `src-tauri/src/capture/` | Intégration Tauri de la capture + UI overlay |
| `src-tauri/src/transcribe/` | Pipeline local whisper-rs + pyannote sidecar |
| `client/src/components/docs/transcript-*.tsx` | Extensions Tiptap `transcriptMeta` + `transcriptSegment` |
| `migrations/XXX_transcription_jobs.sql` | Table `meet.transcription_jobs` |
| `scripts/pyannote-sidecar/` | Script Python diarization (~50 lignes) + requirements.txt |
