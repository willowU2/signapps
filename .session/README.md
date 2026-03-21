# Système de Persistance du Contexte (.session/)

Ce dossier implémente la **Règle d'Or N°11 : Persistance du Contexte (Anti-Amnésie)**.

## Problème Résolu

Quand la fenêtre de contexte de l'IA est pleine, elle doit "compacter" (résumer) et perd des informations critiques. Ce système persiste le contexte important dans des fichiers pour survivre au compactage.

## Principe Fondamental

> **"Le contexte écrit survit au compactage. Le contexte non écrit meurt."**

## Architecture

```
.session/
├── README.md              # Ce fichier
├── current_state.md       # État actuel (tâche en cours, décisions, blocages)
├── task_queue.md          # File de tâches (todo/doing/done)
├── decisions_log.md       # Journal des décisions avec raisons
├── active_files.md        # Fichiers en cours de modification
├── handoff.md             # Briefing pour prochaine session
├── memory_pointers.md     # Références vers données volumineuses
├── checkpoints/           # Snapshots périodiques
│   └── YYYY-MM-DD-HHMM.md
└── archive/               # Sessions terminées
    └── YYYY-MM-DD-*.md
```

## Protocole de Session

### 🟢 DÉBUT de Session

```bash
# 1. Lire le handoff (résumé de la session précédente)
cat .session/handoff.md

# 2. Charger l'état actuel
cat .session/current_state.md

# 3. Vérifier la file de tâches
cat .session/task_queue.md
```

### 🔵 PENDANT la Session

| Trigger | Action |
|---------|--------|
| Nouvelle décision importante | Écrire dans `decisions_log.md` |
| Modification d'un fichier | Mettre à jour `active_files.md` |
| Changement de tâche | Mettre à jour `task_queue.md` |
| Toutes les 5-10 actions | Checkpoint dans `current_state.md` |
| Avant un commit Git | Sauvegarder état complet |
| Avant changement de module | Checkpoint complet |

### 🔴 FIN de Session

```bash
# 1. Mettre à jour l'état final
# 2. Écrire le handoff pour la prochaine session
# 3. Archiver si nécessaire
```

## Fichiers Clés

### current_state.md
État instantané : tâche en cours, % avancement, dernière action, prochaine étape.
**Mis à jour** : Toutes les 5-10 actions.

### task_queue.md
File de tâches structurée : TODO → DOING → DONE.
**Mis à jour** : À chaque changement de tâche.

### decisions_log.md
Journal immuable des décisions avec contexte et raison.
**Mis à jour** : À chaque décision importante.

### active_files.md
Fichiers en cours de modification avec leur état (draft, testing, ready).
**Mis à jour** : À chaque ouverture/fermeture de fichier.

### handoff.md
Résumé exécutif pour transmission inter-sessions.
**Mis à jour** : En fin de session ou avant compactage.

### memory_pointers.md
Références vers données volumineuses stockées ailleurs (évite de saturer le contexte).
**Mis à jour** : Quand de grandes données sont générées.

## Bonnes Pratiques (Sources)

Basé sur les recherches de :
- [Anthropic - Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [arXiv - Solving Context Window Overflow](https://arxiv.org/abs/2511.22729)
- [Claude Code Docs - Memory](https://code.claude.com/docs/en/memory)

### Principes Appliqués

1. **Structured Note-Taking** : Notes régulières persistées hors contexte
2. **Memory Pointers** : Identifiants courts au lieu de données volumineuses
3. **Just-In-Time Loading** : Charger les données quand nécessaire
4. **Progressive Disclosure** : Découverte graduelle via exploration
5. **Compaction-Ready** : Tout ce qui est critique est écrit

## Triggers de Sauvegarde Automatique

| Situation | Fichier(s) à mettre à jour |
|-----------|---------------------------|
| Nouvelle décision | `decisions_log.md` |
| Changement de tâche | `task_queue.md`, `current_state.md` |
| Modification fichier | `active_files.md` |
| Résolution bug complexe | `current_state.md`, `decisions_log.md` |
| Avant commit Git | Tous |
| Avant compactage | `handoff.md` (prioritaire) |
| Changement de module | Checkpoint complet |

## Mantra

> **"Écris pour te souvenir. Le contexte qui n'est pas écrit sera oublié."**
