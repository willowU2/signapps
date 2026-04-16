# Phase E1 — A11y Tooling + Baseline + Catalog — Design Spec

**Date:** 2026-04-16
**Statut:** Validated, ready for implementation plan
**Auteurs:** Brainstorming Claude + Étienne

---

## 1. Context & Goals

### 1.1 Problem

Aucun outillage d'accessibilité n'est en place côté frontend SignApps :
- Pas de lint plugin a11y (`eslint-plugin-jsx-a11y` absent de `package.json`)
- Pas de test runtime a11y (axe-core absent, pas de spec Playwright dédié)
- Pas de baseline a11y ni de catalogue documenté des violations

Le projet a **270 routes** (260 statiques + 10 paramétrées). Faire des fixes a11y sans mesure est aveugle — on ne sait pas quelles règles sont les plus impactantes ni où elles se concentrent.

### 1.2 Goals

1. **Installer les 2 analyseurs complémentaires** : `eslint-plugin-jsx-a11y` (statique) + `@axe-core/playwright` (runtime)
2. **Produire un baseline** : liste des violations statiques (ESLint) et runtime (axe) sur toutes les routes
3. **Produire un catalogue priorisé** : violations groupées par règle / impact / nombre de pages affectées, au format humain-lisible
4. **Enchaîner sur des pattern-level fixes** : attaquer les composants partagés qui propagent le fix à N pages (Button, Input, Icon, etc.) — capé à 6 commits dans cette session

### 1.3 Non-goals

- **Pas de fix par-page** individuel — les fixes ciblés (/admin/users corrige seul) sont Phase E2 dédiée
- **Pas d'audit manuel** (screen reader testing, keyboard nav approfondi) — Phase E3 si requis
- **Pas de WCAG AA certification** — l'objectif est la réduction mesurable, pas la conformité complète
- **Pas de fix de contraste couleur sur Tailwind tokens** — Phase D2/E2 séparée (design system)
- **Pas de tests E2E de régression a11y bloquants** dans la CI — le spec a11y-audit produit un artifact, pas un gate (décision future)

---

## 2. Paramètres validés

| Axe | Choix |
|---|---|
| Outillage | **Statique + runtime** (jsx-a11y + @axe-core/playwright) |
| Scope audit | **Toutes les 270 routes** (260 static + 10 param avec seed fixtures) |
| Séverité lint | **`"warn"` progressif** — pas de bloquage build, suit la politique Phase C |
| Exécution | **Décomposée en E1a (static sync) + E1b (runtime async, requires services) + E1c (fixes)** |
| Gouvernance | Auto-chain entre sous-étapes, validation auto par tsc + eslint |

---

## 3. Architecture

### 3.1 Flow de données

```
┌─────────────────────────────────────────────┐
│  ESLint avec jsx-a11y (static)              │
│  ↓                                          │
│  scripts/a11y-catalog.mjs                   │
│  ↓                                          │
│  docs/bug-sweep/a11y-lint-catalog.md        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Playwright e2e/a11y-audit.spec.ts          │
│  ↓ (pour chaque route)                      │
│  @axe-core/playwright                       │
│  ↓                                          │
│  docs/bug-sweep/a11y-axe-baseline.json      │
│  ↓                                          │
│  scripts/a11y-catalog.mjs                   │
│  ↓                                          │
│  docs/bug-sweep/a11y-axe-summary.md         │
└─────────────────────────────────────────────┘
```

### 3.2 Composants

| # | Fichier | Rôle | Nouveau/Modifié |
|---|---|---|---|
| 1 | `client/package.json` | Add `eslint-plugin-jsx-a11y` + `@axe-core/playwright` en devDeps | Modifié |
| 2 | `client/eslint.config.mjs` | Registrer jsx-a11y + 40 règles `recommended` en `"warn"` | Modifié |
| 3 | `client/e2e/a11y-audit.spec.ts` | Playwright spec : énumère les routes, loop axe per page, écrit JSON | Nouveau |
| 4 | `client/scripts/a11y-catalog.mjs` | Node script : eslint + parse axe JSON → génère les 2 markdowns | Nouveau |
| 5 | `docs/bug-sweep/a11y-lint-catalog.md` | Output humain-lisible des violations lint | Généré |
| 6 | `docs/bug-sweep/a11y-axe-baseline.json` | Raw axe violations, serialisé pour diff futur | Généré |
| 7 | `docs/bug-sweep/a11y-axe-summary.md` | Résumé humain-lisible des violations axe | Généré |

### 3.3 Routes dans le spec audit

Le spec enumère dynamiquement les routes via `fs.readdir` sur `src/app` :
- Routes statiques : 260 (skip `(auth)`, `(app)`, layout-only dirs, `/api/*`, etc.)
- Routes paramétrées : 10, injectées manuellement avec des IDs seed stables :
  - `/f/[id]` → `/f/${SEED_PUBLIC_FORM_ID}`
  - `/forms/[id]` → `/forms/${SEED_FORM_ID}`
  - etc.
  - Les IDs viennent de `scripts/seed-a11y-fixtures.ts` (nouveau, optionnel — si pas seedé, on skip ces routes avec un warning)

### 3.4 Stratégie du spec axe

Pour chaque route :
```ts
for (const route of ROUTES) {
  await page.goto(`http://localhost:3000${route}`, { waitUntil: "domcontentloaded" });
  // Wait for a root element to appear (nav/main/content) to avoid auditing an empty SPA shell
  await page.locator("main, nav, [data-slot='sidebar']").first().waitFor({ timeout: 10000 }).catch(() => {});
  const results = await new AxeBuilder({ page }).analyze();
  allResults.push({ route, violations: results.violations });
}
await fs.writeFile("docs/bug-sweep/a11y-axe-baseline.json", JSON.stringify(allResults, null, 2));
```

Le spec ne `fail` pas sur les violations — il les collecte et passe vert. C'est intentionnel : on veut un baseline, pas un gate.

### 3.5 Format du catalog markdown

```markdown
# A11y Lint Catalog — 2026-04-16

Source: eslint-plugin-jsx-a11y on src/**/*.{ts,tsx}

## Top rules by count

| Rule | Count | Severity | Top files |
|---|---|---|---|
| jsx-a11y/alt-text | 87 | warn | components/ui/image-gallery.tsx (12), ... |
| jsx-a11y/click-events-have-key-events | 42 | warn | ... |
...

## By file (top 20)

| File | Count |
|---|---|
| components/whiteboard/canvas.tsx | 23 |
...
```

---

## 4. Plan d'exécution (sous-phases)

### E1a — Static baseline (cette session, sync)

**Prérequis** : aucun (pas de services requis pour eslint).

- Commit 1 : `chore(a11y): install eslint-plugin-jsx-a11y` (devDep + config)
- Commit 2 : `chore(a11y): generate lint catalog` (script + output markdown committé)

### E1b — Runtime baseline (requires services)

**Prérequis** :
- PostgreSQL démarré (`just db-start`)
- Services démarrés (`bash scripts/start-all.sh --skip-build` ou équivalent)
- Dev server frontend : `npm run dev` dans un autre terminal

- Commit 3 : `chore(a11y): add @axe-core/playwright + audit spec` (spec + script, pas d'execution)
- User exécute : `cd client && npm run test:e2e -- a11y-audit.spec.ts`
- Commit 4 : `chore(a11y): commit runtime baseline + summary` (JSON + markdown générés)

**Si l'user préfère** : E1b peut être reporté à une session dédiée. Les commits 1-2 + 3 sont autonomes.

### E1c — Pattern-level fixes (enchaîner à E1a, indépendant de E1b)

Dès que E1a est complet, le lint catalog donne une liste priorisée. Attaque les top rules qui touchent le plus de fichiers :

- Rules auto-fixables par `eslint --fix` : appliquer directement (commit séparé)
- Rules avec pattern identifiable (ex: tous les `<img>` sans `alt=""` → remplacer par `<Image alt="">` de Next, ou ajouter `alt=""` décoratif) : search/replace + commit par rule
- Rules qui demandent du judgment (ex: `click-events-have-key-events` sur un div clickable) : fix dans le composant réutilisable (Button, CardClickable) pour propager

**Cap de la session** : 6 commits de fix max. Ce qui reste → Phase E2.

---

## 5. Validation

Chaque commit :
- `npx tsc --noEmit` : 0 erreur
- `npx eslint src/` : pas de nouvelle erreur (les warnings jsx-a11y augmentent puis diminuent au fil des fixes)
- Count de warnings jsx-a11y documenté dans le commit message (avant / après quand possible)

Post-E1a : le catalog est généré et commité. Post-E1c : count final documenté dans journal.

---

## 6. Error handling

- **E1b audit crash** : si axe échoue sur une route (error 500, hydratation bloquée, etc.), le spec log l'erreur et continue. La route concernée apparaît dans le JSON avec `{ error: "..." }` au lieu de `{ violations: [...] }`.
- **Seed fixtures absentes** : si les IDs paramétrés ne résolvent pas (404), skip avec warning. Pas de fail.
- **Service down au moment de l'audit** : le spec skip la route, log l'erreur. User re-run quand services OK.
- **E1c fix casse un test existant** : revert le commit, documenter dans `bug-sweep-todo.md`.

---

## 7. Testing

Pas de nouveau test (Phase F dédiée). Validation :
- Le lint catalog est lisible et cohérent (sample check sur 5 rules)
- L'audit spec compile (`npx playwright test --list a11y-audit.spec.ts`)
- Les tests existants restent verts (les fixes E1c ne cassent rien)

---

## 8. Success criteria

- [ ] `eslint-plugin-jsx-a11y` installé + configuré
- [ ] `@axe-core/playwright` installé
- [ ] `docs/bug-sweep/a11y-lint-catalog.md` généré + committé
- [ ] `client/e2e/a11y-audit.spec.ts` compile et est lancible
- [ ] `client/scripts/a11y-catalog.mjs` compile et produit les 2 markdowns
- [ ] Lint count total documenté dans le commit E1a-2 et dans le journal
- [ ] Top 10 rules identifiées et priorisées pour E1c
- [ ] ≥ 3 commits de pattern fixes appliqués (E1c)
- [ ] Count jsx-a11y warnings réduit mesurément (ratio documenté)
- [ ] `tsc --noEmit` 0 erreur à chaque commit

---

## 9. Out-of-scope (futures phases)

- **Phase E2** : fixes ciblés page-par-page (petits gains, long tail)
- **Phase E3** : audit manuel (screen reader, keyboard nav deep)
- **Phase E4** : conformité WCAG AA complète, certification
- **Phase E5** : tests a11y E2E bloquants en CI (gate)
- **Phase F** : coverage tests

---

## 10. Glossaire

- **jsx-a11y** : plugin ESLint qui inspecte le JSX pour catcher les patterns d'a11y cassés au compile time. ~40 rules.
- **axe-core** : runtime a11y engine injecté dans le navigateur pendant un test Playwright ; détecte les violations WCAG 2.1 A/AA.
- **Pattern-level fix** : modification d'un composant partagé (Button, Input) qui corrige automatiquement toutes les pages qui l'utilisent.
- **Baseline** : snapshot daté de l'état a11y, servant de point de référence pour mesurer les améliorations futures.
- **Impact** (axe) : `minor`, `moderate`, `serious`, `critical`. Focus sur serious + critical en E1c.
