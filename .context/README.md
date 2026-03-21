# Contextes Technologiques Live

Ce dossier contient la documentation compilée et à jour pour chaque technologie utilisée dans SignApps Platform.

## Objectif

**Règle d'Or N°8** : Avant d'implémenter avec une technologie, AgentIQ doit :
1. Vérifier si le contexte existe et est à jour
2. Sinon, fetcher la documentation officielle récente
3. Compiler les patterns actuels, exemples concrets, et pièges
4. Sauvegarder dans ce dossier

## Structure des Fichiers

```
.context/
├── README.md           # Ce fichier
├── _TEMPLATE.md        # Template pour nouveaux contextes
├── axum.md             # Framework web Rust
├── nextjs.md           # Framework React
├── sqlx.md             # ORM Rust
├── tokio.md            # Runtime async Rust
├── zustand.md          # State management React
├── react-query.md      # Data fetching React
├── tailwind.md         # CSS framework
├── playwright.md       # E2E testing
└── ...
```

## Format d'un Fichier Contexte

```markdown
# {Technologie} - Contexte Live

## Méta
- **Version** : X.Y.Z
- **Licence** : MIT/Apache 2.0
- **Dernière MàJ** : YYYY-MM-DD
- **Source** : [lien doc officielle]

## Patterns Actuels
[code exemples concrets]

## Breaking Changes
[changements récents importants]

## Pièges à Éviter
[anti-patterns, erreurs communes]

## Intégration SignApps
[comment cette techno s'intègre dans notre stack]
```

## Mise à Jour

Les contextes sont mis à jour :
- À chaque session de veille (Radar Prédictif)
- Avant d'implémenter une feature utilisant la techno
- Lors de la découverte d'un breaking change

## Technologies Principales

### Backend (Rust)
- `axum.md` - Web framework
- `tokio.md` - Async runtime
- `sqlx.md` - Database queries
- `serde.md` - Serialization
- `tower.md` - Middleware

### Frontend (TypeScript/React)
- `nextjs.md` - Framework
- `react.md` - UI library
- `zustand.md` - State
- `react-query.md` - Data fetching
- `tailwind.md` - Styling

### Testing
- `playwright.md` - E2E
- `cargo-test.md` - Rust unit tests

### AI/ML
- `ollama.md` - Local LLM
- `whisper-rs.md` - STT
- `piper-rs.md` - TTS
