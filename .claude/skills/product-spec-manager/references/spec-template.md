# Module {{DISPLAY_NAME}} — Spécification fonctionnelle

> **Template for `docs/product-specs/NN-<kebab-name>.md`**
>
> **Instructions**: Copy this template, fill in all `{{PLACEHOLDERS}}` and sections.
> Follow the format of existing specs (01-spreadsheet.md, 02-docs.md, 03-calendar.md, etc.) as reference.
> The spec MUST be in French (the project is French-first).
> Feature count should be 100-300 depending on the function's complexity.

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **{{COMPETITOR_1}}** | {{strength1}} |
| **{{COMPETITOR_2}}** | {{strength2}} |
| **{{COMPETITOR_3}}** | {{strength3}} |
| **{{COMPETITOR_4}}** | {{strength4}} |
| **{{COMPETITOR_5}}** | {{strength5}} |
| **{{COMPETITOR_6}}** | {{strength6}} |
| **{{COMPETITOR_7}}** | {{strength7}} |
| **{{COMPETITOR_8}}** | {{strength8}} |
| **{{COMPETITOR_9}}** | {{strength9}} |
| **{{COMPETITOR_10}}** | {{strength10}} |

> Aim for 10-15 competitors. Each row should be 1-3 sentences highlighting what this competitor does BEST that we should learn from.

## Principes directeurs

1. **{{PRINCIPLE_1}}** — {{explanation_1}}
2. **{{PRINCIPLE_2}}** — {{explanation_2}}
3. **{{PRINCIPLE_3}}** — {{explanation_3}}
4. **{{PRINCIPLE_4}}** — {{explanation_4}}
5. **{{PRINCIPLE_5}}** — {{explanation_5}}
6. **{{PRINCIPLE_6}}** — {{explanation_6}}

> 6 principes obligatoires. These are non-negotiable UX/technical values that guide every feature decision.

---

## Catégorie 1 — {{CATEGORY_1_NAME}}

### 1.1 {{Feature_name}}
{{Description paragraph explaining UX and expected behavior in detail. Be specific about clicks, states, transitions, constraints.}}

### 1.2 {{Feature_name}}
{{Description}}

### 1.3 {{Feature_name}}
{{Description}}

### ...

> Aim for 10-30 features per category. Each feature should be:
> - **Numbered** (N.M format for stable references)
> - **Named** clearly (short title that becomes an assertion)
> - **Described** in 1-4 sentences explaining UX, states, edge cases
> - **Testable** (the description should translate to an E2E assertion)

---

## Catégorie 2 — {{CATEGORY_2_NAME}}

### 2.1 ...

---

## Catégorie 3 — {{CATEGORY_3_NAME}}

...

---

> Continue with 8-14 categories total. Common category types across specs:
> 1. Création / Setup / Layout initial
> 2. Navigation / Vues multiples
> 3. Édition / Manipulation du contenu principal
> 4. Types de données / Types de champs
> 5. Collaboration / Temps réel / Commentaires
> 6. Recherche / Filtres / Tri
> 7. IA intégrée (obligatoire pour tout nouveau module)
> 8. Intégrations (avec autres modules SignApps et services externes)
> 9. Mobile et accessibilité (obligatoire)
> 10. Sécurité et gouvernance (obligatoire pour P0/P1)
> 11. Analytics et reporting (si applicable)
> 12. Administration (si applicable)

---

## Sources d'inspiration

### Aides utilisateur publiques et démos

- **{{Competitor 1}} Help Center** ({{URL}}) — {{what to learn}}
- **{{Competitor 2}} Docs** ({{URL}}) — {{what to learn}}
- **{{Competitor 3}} Support** ({{URL}}) — {{what to learn}}
- **{{Competitor 4}} Academy/Blog** ({{URL}}) — {{what to learn}}
- {{Continue for 8-15 sources}}

> Include the official help centers, knowledge bases, tutorials, blog posts, and published specs for each competitor. These are our study materials.

### Projets open source permissifs à étudier comme pattern

**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License, Sustainable Use License**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **{{Permissive Project 1}}** ({{repo URL}}) | **MIT** / **Apache-2.0** / etc. | {{what we can learn or integrate}} |
| **{{Permissive Project 2}}** ({{repo URL}}) | **BSD-3-Clause** | {{what}} |
| **{{Forbidden Project 1}}** ({{repo URL}}) | **AGPL v3** | **INTERDIT**. {{reason — e.g. AGPL copyleft}}. Étudier via démos publiques uniquement. |
| **{{Forbidden Project 2}}** ({{repo URL}}) | **GPL v3** | **INTERDIT**. {{reason}}. |
| {{Continue for 10-25 projects}} | | |

> **Rules for this table**:
> - Every row must have an explicit license
> - Forbidden projects are explicitly marked with "INTERDIT" and the reason
> - Never recommend a GPL/AGPL project as a dependency, even if we can "just use its API"
> - If a project changed license (e.g. n8n, HashiCorp Vault, Elasticsearch), note the change date
> - MPL-2.0 projects are OK as consumers only (never fork the source)

### Pattern d'implémentation recommandé

1. **{{Core concern 1}}** : {{specific project + license + why}}
2. **{{Core concern 2}}** : {{specific project}}
3. **{{Core concern 3}}** : {{specific project}}
4. ...

> Give a concrete stack recommendation using the permissive projects above. This is the "how to actually build it" section.

### Ce qu'il ne faut PAS faire

- **Pas de fork** de {{list of AGPL/GPL projects}} — list explicitement.
- **Pas de dépendance sur** {{problematic thing}} — expliquer pourquoi.
- **Attention à** {{dual-licensed or recently-changed licenses}} — valider avant utilisation.
- **Respect strict** de la politique de licences (voir `deny.toml` et `memory/feedback_license_policy.md`).

---

## Assertions E2E clés (à tester)

- {{Assertion 1 — something testable derived from feature 1.1}}
- {{Assertion 2}}
- {{Assertion 3}}
- ...

> Aim for 20-40 E2E assertions. Each one should be:
> - **Self-contained** (no dependencies on other tests)
> - **Observable** (testable with Playwright)
> - **Specific** (not "it works" but "clicking X produces Y")
> - **Derived from the feature descriptions above**

---

## Historique

- {{YYYY-MM-DD}} : Création initiale du spec pour le module {{display_name}}.

> This section tracks changes over time. Every update (workflow B) should append an entry here with date, feature name, and category affected.
