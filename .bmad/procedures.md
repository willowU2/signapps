# Procédures et Auto-amélioration (Kaizen)

*Ce document sera mis à jour de manière itérative (auto-correction, améliorations des workflows) à la fin de chaque sprint BMAD.*

## Protocole d'Orchestration Dual-AI (WhatsApp <-> VS Code)
Le projet utilise deux agents IA pour assister le Boss :
- **L'Agent Frontline (Baguettotron via OpenClaw)** : Écoute le Boss sur WhatsApp (H24) de façon autonome. Son rôle est de discuter, de peaufiner les idées d'architecture "sur le vif", et de rédiger des tickets/résumés techniques dans le fichier `INBOX.md`.
- **L'Orchestrateur Technique (Antigravity)** : C'est moi. J'interviens dans l'éditeur de code. Mon rôle est de lire l'`INBOX.md` ou de m'informer des logs réseaux, puis de générer, modifier, valider et commiter le code source du projet SignApps en suivant scrupuleusement les consignes de sécurité et d'architecture.

**Flux de Travail :**
1. Idée -> Boss vers WhatsApp.
2. Synthèse -> Baguettotron vers `INBOX.md`.
3. Validation -> Boss valide et ping Antigravity.
4. Exécution -> Antigravity modifie la codebase.
