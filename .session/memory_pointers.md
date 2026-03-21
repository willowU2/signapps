# Memory Pointers - Références aux Données Volumineuses

> Basé sur [arXiv - Solving Context Window Overflow](https://arxiv.org/abs/2511.22729)
>
> **Principe** : Stocker les grandes données hors contexte, utiliser des pointeurs courts.

---

## 🎯 Concept

Au lieu de charger de grandes quantités de données dans le contexte :
1. Stocker les données dans des fichiers
2. Garder uniquement un **pointeur** (chemin + description courte)
3. Charger **à la demande** quand nécessaire

**Réduction tokens** : ~7x moins de tokens (842 vs 6411 dans les études)

---

## 📍 Pointeurs Actifs

### Code & Architecture

| ID | Description | Chemin | Taille |
|----|-------------|--------|--------|
| `PTR_STACK` | Stack technique complète | `STACK.md` | ~400 lignes |
| `PTR_CONV` | Conventions de code | `CONVENTIONS.md` | ~570 lignes |
| `PTR_ARCH` | Architecture services | `docs/architecture/` | Multiple |

### Contextes Technologiques

| ID | Techno | Chemin | Dernière MàJ |
|----|--------|--------|--------------|
| `PTR_AXUM` | Axum framework | `.context/axum.md` | - |
| `PTR_NEXTJS` | Next.js 16 | `.context/nextjs.md` | - |
| `PTR_SQLX` | SQLx ORM | `.context/sqlx.md` | - |

### Outputs BMAD

| ID | Type | Chemin |
|----|------|--------|
| `PTR_PRD_*` | PRD actif | `_bmad-output/prd-*.md` |
| `PTR_ARCH_*` | Architecture doc | `_bmad-output/architecture-*.md` |
| `PTR_EPIC_*` | Epics & Stories | `_bmad-output/epics-*.md` |

### Résultats de Recherche

| ID | Sujet | Chemin | Date |
|----|-------|--------|------|
| `PTR_SEARCH_*` | [Recherche X] | `.session/cache/search-*.md` | - |

---

## 📖 Comment Utiliser

### Créer un Pointeur

```markdown
Quand tu génères une grande quantité de données :
1. Écrire dans un fichier approprié
2. Ajouter une entrée dans ce fichier
3. Utiliser le PTR_ID dans le contexte
```

### Charger un Pointeur

```markdown
Quand tu as besoin des données :
1. Lire le fichier référencé par le pointeur
2. Utiliser les données
3. Ne pas les garder en mémoire après usage
```

---

## 🗂️ Cache de Session

<!-- Données temporaires de cette session -->

| Fichier | Contenu | Expire |
|---------|---------|--------|
| `.session/cache/` | Résultats recherche | Fin session |

---

## ♻️ Nettoyage

Les pointeurs obsolètes doivent être nettoyés régulièrement :
- Cache de session : Fin de session
- Recherches : Après 24h
- Contextes technos : Jamais (persistant)

---

*Règle : Préférer un pointeur de 10 tokens à une donnée de 1000 tokens.*
