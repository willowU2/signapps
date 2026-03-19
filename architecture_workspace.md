# Architecture Workspace - Antigravity Prime

Ce document explique les choix techniques gratuits et open-source effectués pour le développement de la suite logicielle TPE/PME.

## Technologies Actuelles (Découvertes via l'Audit)
- **Frontend** : Next.js (React), TypeScript, Tailwind CSS
- **Backend** : Rust (Axum, SQLx), architecture microservices
- **Stockage/Base de données** : PostgreSQL, OpenDAL
- **IA Locale / LLMs** : Intégrations Ollama, vLLM, GGUF local via llama-cpp-2, STT/TTS natif
- **Outils & Langages** : Typescript 5, Rust 2021 (MSRV 1.75), Tailwind CSS 4, Zustand, React Query

## État d'avancement des Modules (Google Workspace Alternative)

| Module | État | Composants Techniques |
|--------|------|------------------------|
| **Identity / Admin** | ✅ Avancé | SSO, LDAP/AD, OAuth2, TOTP (MFA), RBAC |
| **Documents (Docs/Sheets)** | ✅ Avancé | Tiptap v3, Yjs (Collab temps réel), Import/Export (Office) |
| **Stockage (Drive)** | ✅ Avancé | OpenDAL (FS natif / S3), Gestion RAID hardware, Permissions |
| **Agenda (Calendar)** | 🔄 En cours | Unified Scheduling UI (Sprint 26 récent), CRON jobs |
| **Emails (Mail)** | ⚠️ Partiel | Service `signapps-mail` existe mais fonctionnalités à auditer |
| **Chat / Conférence** | ❌ À faire | Outils de base présents (WebSocket, WebRTC/Livekit server) mais pas de client final Chat TPE. |
| **CRM de base** | ❌ À faire | N'existe pas encore dans les 9 microservices actuels. |

## Respect des Garde-Fous
1. **Budget Zéro :** L'architecture s'appuie à 100% sur des briques open-source auto-hébergées (PostgreSQL, Whisper, Piper, Ollama). Aucune dépendance payante obligatoire.
2. **Confidentialité / Sécurité :** L'IA tourne en local (LLM, STT, TTS, OCR) garantissant que les données TPE ne sortent pas du réseau. Le stockage est en HNSW vectoriel direct (pgvector).
3. **Stack Existante :** Axum + Next.js est le socle absolu. Interdiction d'introduire des technos externes non justifiées.
