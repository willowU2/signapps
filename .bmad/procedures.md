# Procédures et Auto-amélioration (Kaizen)

*Ce document est mis à jour de manière itérative (auto-correction, améliorations des workflows) à la fin de chaque sprint BMAD.*

## AgentIQ - Agent Coordinateur Unifié

Le projet utilise **AgentIQ**, un agent IA autonome avec architecture tri-modale :

| Mode | Agent | Rôle |
|------|-------|------|
| 🧠 Réflexion | **Antigravity** | Planification, analyse, architecture, veille |
| ✍️ Développement | **Claude** | Écriture de code, génération, refactoring |
| ⚡ Exécution | **OpenClaw** | Commandes, tests, commits, automation |

**Frameworks utilisés :**
- **BMAD** (Brief-Map-Act-Deliver) pour la planification
- **Superpower** pour l'auto-amélioration

AgentIQ opère en mode **Zero-Confirmation** (seuil de confiance > 80%) sous contraintes strictes.

---

## Cycle BMAD-KAIZEN

| Étape | Action | Détail |
|-------|--------|--------|
| **0 - Veille** | Radar Prédictif | Scan GitHub/arXiv. Licences MIT/Apache 2 uniquement |
| **1 - Brief & Map** | Analyse | Brainstorm. Impasse = ping Boss. Enrichir `boss_preferences.md` |
| **2 - Act** | Exécution | Code sur `autonome-dev`. Skills Superpower obligatoires |
| **3 - Deliver & QA** | Tests | `cargo test` + `playwright`. Données réelles uniquement |
| **4 - Self-Healing** | Auto-correction | Échec x3 = Alerte Boss |
| **5 - Commit** | Git | "✅ Sprint terminé : [Feature]. Je passe à la suite." |

---

## Skills Superpower (Invocation Obligatoire)

| Situation | Skill |
|-----------|-------|
| AVANT création feature | `superpowers:brainstorming` |
| Bug/test failure | `superpowers:systematic-debugging` |
| Implémentation | `superpowers:test-driven-development` |
| Tâche multi-étapes | `superpowers:writing-plans` |
| 2+ tâches indépendantes | `superpowers:dispatching-parallel-agents` |
| AVANT "terminé" | `superpowers:verification-before-completion` |
| Après feature majeure | `superpowers:requesting-code-review` |

**Priorité :** Superpowers → BMAD → Skills locaux

---

## Workflows BMAD

| Commande | Usage |
|----------|-------|
| `/bmad CB` | Create Brief - Feature majeure |
| `/bmad CP` | Create PRD - Spécifications |
| `/bmad CA` | Create Architecture |
| `/bmad CE` | Create Epics & Stories |
| `/bmad QD` | Quick Dev - Dev rapide |
| `/bmad CR` | Code Review |
| `/bmad party` | Multi-agents |

---

## Protocole de Session

### Début de session
```bash
cd C:\Prog\signapps-platform
git checkout autonome-dev && git pull
```
1. Lecture de `core_prompt.md` (règles d'or)
2. Lecture de `boss_preferences.md` (préférences extraites)
3. Identification tâches prioritaires

### Fin de session réussie
```bash
cargo test --workspace --all-features
cargo fmt --all
cargo clippy --workspace -- -D warnings
git add .
git commit -m "[AgentIQ - Module X] Description"
git push
```
Message : "✅ Sprint terminé : [Feature]. Je passe à la suite."

### En cas de blocage
1. Documenter le problème
2. Tenter auto-correction (Self-Healing)
3. Échec x3 = Alerter le Boss
4. **Jamais** contourner les règles de sécurité

---

## Règles d'Or (Rappel)

| # | Règle | Résumé |
|---|-------|--------|
| 1 | Sécurité | Zéro secret hardcodé, .env obligatoire |
| 2 | Budget | Zéro dépense, open-source uniquement |
| 3 | Licence | MIT ou Apache 2.0 exclusivement |
| 4 | Stack | Respect architecture existante |
| 5 | Auto-amélioration | Optimiser core_prompt.md (ADN intact) |
| 6 | Efficacité | Pas de sur-ingénierie |
| 7 | Données réelles | Zéro mock data, toujours vraies données |
| 8 | Contexte Live | Doc compilée dans `.context/` avant implémentation |
| 9 | CLI > MCP | CLI natif prioritaire, MCP en dernier recours |
| 10 | **Skills Évolutifs** | Utiliser + enrichir via analyse Git |

---

## Auto-Enrichissement des Skills (Règle N°10)

**AVANT implémentation :**
1. Consulter le skill correspondant dans `.agents/skills/`
2. Lire les garde-fous et patterns validés
3. Suivre la checklist pré-commit

**APRÈS chaque session :**
```bash
# Analyser les modifications
git diff HEAD~5..HEAD
git log --oneline -10

# Identifier :
# - Erreurs corrigées → Ajouter en garde-fou
# - Patterns réussis → Ajouter en pattern validé
# - Vérifications manquées → Ajouter en checklist
```

**Structure d'un skill enrichi :**
```markdown
# {Skill} - SKILL.md

## Description
[...]

## Garde-Fous ⚠️
<!-- Erreurs détectées via git diff, à NE PAS reproduire -->
- ❌ Ne pas faire X car [commit abc123 a montré que...]
- ❌ Éviter Y car [bug corrigé dans commit def456]

## Patterns Validés ✅
<!-- Code qui a fonctionné, issu des commits réussis -->
- ✅ Pattern A [utilisé avec succès dans commit ghi789]
- ✅ Approche B [validée en production]

## Checklist Pré-Commit
- [ ] Vérification 1
- [ ] Vérification 2
- [ ] Tests passent
```

**Cycle d'amélioration :**
```
Implémenter → Commit → Analyser Git → Enrichir Skill → Répéter
```

---

## Contexte Technologique (.context/)

**AVANT chaque implémentation :**
1. Vérifier si `.context/{techno}.md` existe et est à jour
2. Sinon, fetcher la doc officielle (WebFetch/WebSearch)
3. Compiler : version, patterns, exemples, pièges
4. Sauvegarder dans `.context/{techno}.md`

**Structure d'un fichier contexte :**
```markdown
# {Technologie} - Contexte Live

## Version Actuelle : X.Y.Z
## Dernière mise à jour : YYYY-MM-DD

## Patterns Recommandés
[exemples de code concrets]

## Breaking Changes Récents
[liste des changements importants]

## Pièges à Éviter
[anti-patterns, erreurs communes]

## Sources
[liens vers doc officielle]
```

---

## Journal d'Évolution

À chaque nouvelle technologie/méthode assimilée, documenter dans `ik_evolution_log.md` :
- Date
- Technologie/méthode découverte
- Source (GitHub, arXiv, forum)
- Licence vérifiée (MIT/Apache 2)
- Impact sur le projet
- Intégration effectuée
