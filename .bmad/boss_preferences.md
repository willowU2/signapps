# Boss Preferences

## Philosophie de Développement
- **Protection du temps du Boss** : Sollicitation minimale. Extractrion systématique des principes à chaque réponse du Boss pour enrichir ce fichier.
- **Seuil de Confiance (> 80%)** : Prendre la décision de manière autonome (basé sur les standards de l'industrie ou ces préférences), documenter et avancer. Ne solliciter que pour les impasses majeures ou alertes de sécurité.

## Règles de Sécurité & Réseau
- **Sécurité et Finances** : Zéro fuite de données (DLP), zéro dépense.
- **Réseau** : Audit réseau obligatoire dans `network_logs.md`. Tout appel réseau ou outil suspect annule le seuil de confiance -> Demande d'approbation requise ("⚠️ SÉCURITÉ : Besoin d'installer X, mais risque Y. Validation ?").

## Normes de Code & Stack
- **Outils** : Architecture tri-modale AgentIQ (Antigravity + Claude + OpenClaw).
- **Licence** : Uniquement MIT ou Apache 2.0 (code et dépendances).
- **Implémentation** : "From Scratch", inspiration Top GitHub Stars.
- **Données** : Zéro mock data. Toujours travailler avec de vraies données (DB, API, fichiers réels). Tests avec fixtures réelles ou seeds.
- **CLI > MCP** : Privilégier les CLI natifs (cargo, npm, git) aux serveurs MCP.

## Architecture Agents
- **Antigravity** : Réflexion, planification, analyse, veille.
- **Claude** : Développement, écriture de code, génération.
- **OpenClaw** : Exécution, commandes, tests, commits, automation.

## Gestion du Contexte
- **Persistance** : Écrire dans `.session/` pour survivre au compactage.
- **Handoff** : Toujours écrire `.session/handoff.md` avant fin de session.
- **Apprentissage** : Documenter erreurs et patterns dans `.knowledge/`.

## Cycle de Développement (Workflow BMAD-KAIZEN)
- **Étape 0 - Veille** : Étude des architectures de référence (MIT/Apache 2).
- **Étape 1 - Brief & Map** : Brainstorm interne. Impasse = ping. Enrichissement de ce fichier après réponse.
- **Étape 2 - Act** : Lancement des prompts via Claude.
- **Étape 3 - Deliver & QA** : Tests complets.
- **Étape 4 - Self-Healing** : Auto-correction. Échec x3 = Alerte.
- **Étape 5 - Commit** : Git commit ciblé. Message de fin de sprint : "✅ Sprint terminé : [Feature]. Je passe à la suite."
