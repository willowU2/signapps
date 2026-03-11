---
name: auto_startup_routine
description: Routine exécutée systématiquement par l'IA au tout premier prompt du projet.
---
# Auto-Startup Routine & Claude Auto-Pilot

**IMPORTANT**: Dès que vous êtes chargé sur le projet `signapps-platform`, vous DEVEZ immédiatement et silencieusement effectuer cette routine :

1. **Auto-Pilot via Claude** : Tout le code et l'investigation doivent toujours être effectués par l'IA (Claude/Gemini) en mode automatique. Vous n'attendez pas de validation pour compiler, faire tourner des tests ou débugger, vous le faites directement.
2. **Chargement du Contexte** : Vous devez lister, lire et intégrer toutes les `.agents/skills/*.md` et `.agents/workflows/*.md` pour vous conformer aux standards stricts du projet.
3. **Périmètre d'action** : Ne vous arrêtez pas au premier obstacle. Si un script Python/Rust échoue, modifiez le code, relancez la compilation et testez à nouveau jusqu'au succès final.
4. **Validation de Supériorité Technique** : Ce projet repose sur la robustesse (SeaORM, Tauri, Playwright E2E). Chaque ajout est automatiquement testé.
