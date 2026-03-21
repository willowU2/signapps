# Base de Connaissances AgentIQ (.knowledge/)

Ce dossier contient la **mémoire à long terme** d'AgentIQ - les apprentissages qui persistent indéfiniment et améliorent continuellement la pertinence.

## Architecture

```
.knowledge/
├── README.md              # Ce fichier
├── errors/                # Erreurs rencontrées et solutions
│   ├── rust.md           # Erreurs Rust
│   ├── typescript.md     # Erreurs TypeScript
│   ├── database.md       # Erreurs BDD
│   └── infrastructure.md # Erreurs infra
├── patterns/              # Patterns validés par l'expérience
│   ├── rust.md           # Patterns Rust
│   ├── typescript.md     # Patterns TypeScript
│   ├── api.md            # Patterns API
│   └── testing.md        # Patterns tests
├── codebase/              # Connaissance du code
│   ├── modules.md        # Map des modules
│   ├── dependencies.md   # Graphe des dépendances
│   └── hotspots.md       # Zones à risque
├── performance/           # Métriques et optimisations
│   ├── benchmarks.md     # Résultats benchmarks
│   └── optimizations.md  # Optimisations appliquées
└── tech_watch/            # Veille technologique
    ├── discoveries.md    # Nouvelles technos découvertes
    └── evaluations.md    # Évaluations de technos
```

## Principe

> **"L'apprentissage qui n'est pas écrit est un apprentissage perdu."**

Chaque erreur corrigée, chaque pattern qui fonctionne, chaque optimisation réussie doit être documentée pour :
1. Ne jamais refaire la même erreur
2. Réutiliser ce qui fonctionne
3. Améliorer continuellement la pertinence

## Cycle d'Enrichissement

```
Développer → Erreur/Succès → Analyser → Documenter → Apprendre
     ↑                                                    ↓
     └──────────── Appliquer ← Consulter ←────────────────┘
```

## Sources d'Enrichissement

| Source | Fichier cible | Trigger |
|--------|---------------|---------|
| `git diff` erreurs corrigées | `errors/*.md` | Après fix |
| `git log` patterns réussis | `patterns/*.md` | Après commit |
| Tests échoués puis passés | `errors/*.md` | Après tests |
| Optimisations performance | `performance/*.md` | Après benchmark |
| Veille technologique | `tech_watch/*.md` | Session veille |

## Règle N°10 Appliquée

Les skills dans `.agents/skills/` doivent être enrichis à partir de cette base de connaissances. Le flux est :

```
.knowledge/ (connaissances brutes)
     ↓
.agents/skills/ (connaissances appliquées)
     ↓
Code produit (meilleure qualité)
```
