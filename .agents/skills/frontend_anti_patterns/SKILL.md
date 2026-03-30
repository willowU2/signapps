---
name: frontend_anti_patterns
description: Prévention des anti-patterns frontend identifiés dans l'historique Git — dark theme, layout, types, E2E
---
# Frontend Anti-Patterns Prevention

Skill défensif basé sur l'analyse de 828 commits. Empêche la reproduction des 6 anti-patterns frontend les plus coûteux.

## Quand Utiliser

- AVANT d'écrire un composant React/Next.js
- AVANT de modifier le layout (sidebar, providers, app-layout)
- AVANT de créer/modifier un test E2E
- À chaque code review frontend

## Anti-Pattern 1 : Couleurs hardcodées (3 vagues, 800+ instances)

**Coût historique :** 16 commits de fix, 434 fichiers à migrer

### Détection
```bash
# Scanner les fichiers modifiés
git diff --name-only HEAD | xargs grep -n "bg-white\|text-gray-900\|text-slate-900\|border-gray-200\|bg-gray-50\|bg-gray-100\|text-black" 2>/dev/null
```

### Règle absolue

| Interdit | Remplacement | Token CSS |
|----------|-------------|-----------|
| `bg-white` | `bg-card` | `--card: #ffffff / #1a2133` |
| `bg-gray-50` | `bg-muted` | `--muted: #f1f3f4 / #1e293b` |
| `bg-gray-100` | `bg-muted` | idem |
| `text-gray-900` | `text-foreground` | `--foreground: #1a1a2e / #e2e8f0` |
| `text-slate-900` | `text-foreground` | idem |
| `text-black` | `text-foreground` | idem |
| `text-gray-500/600/700` | `text-muted-foreground` | `--muted-foreground: #6b7194 / #64748b` |
| `border-gray-200` | `border-border` | `--border: #e0e0e0 / rgba(255,255,255,0.12)` |
| `border-gray-300` | `border-border` | idem |

**Exception unique :** Toggle switch knobs (`bg-white` intentionnel pour le cercle blanc).

### Validation
```bash
# Zéro tolérance — exécuter avant commit
grep -rn "bg-white\b" src/ --include="*.tsx" | grep -v "bg-white/" | grep -v "toggle\|knob\|switch"
```

## Anti-Pattern 2 : Layout Wrapper Thrashing (7 commits en 28 min)

**Coût historique :** sidebar.tsx = 57 modifications (plus haut churn du projet)

### Règle absolue

```
JAMAIS de <AppLayout> dans une page individuelle.
Le layout est géré par:
  - client/src/app/layout.tsx       → Shell HTML
  - client/src/components/providers.tsx  → Providers (QueryClient, Theme, Auth)
  - client/src/components/layout/app-layout.tsx → Sidebar + Header + Main
```

**Avant de toucher au layout :**
1. Lire `providers.tsx` pour comprendre la hiérarchie actuelle
2. Vérifier qu'on ne duplique pas un wrapper existant
3. Tester sur /dashboard, /mail, /cal, /admin (4 layouts différents)

### Détection
```bash
# Pages qui importent AppLayout directement (probable doublon)
grep -rn "import.*AppLayout\|import.*app-layout" src/app/ --include="*.tsx"
```

## Anti-Pattern 3 : Types contournés avec "as any" (262 casts)

**Coût historique :** 8 commits dédiés à corriger des erreurs TS

### Règle

```typescript
// ❌ INTERDIT — cache le vrai problème
const users = response.data as any;
const value = (obj as any).field;

// ✅ Corriger le type à la source
interface UsersResponse {
  users: User[];
}
const { users } = response.data as UsersResponse;

// ✅ Si urgent, documenter le vrai type
const users = response.data as unknown as User[]; // TODO: fix API return type in lib/api/users.ts
```

### Détection
```bash
# Compter les nouveaux "as any" dans les fichiers modifiés
git diff HEAD --name-only -- "*.tsx" "*.ts" | xargs grep -c "as any" 2>/dev/null | grep -v ":0$"
```

## Anti-Pattern 4 : Tests E2E fragiles (11 commits de fix)

**Coût historique :** expect(true) = 22 assertions inutiles, waitForTimeout masquait les échecs

### Règles

```typescript
// ❌ JAMAIS
await page.waitForTimeout(2000);
expect(true).toBeTruthy();
expect(hasGrid || true).toBeTruthy();
await page.waitForSelector('.editor').catch(() => {});

// ✅ TOUJOURS
await page.waitForLoadState('networkidle').catch(() => {});
await expect(page.locator('.editor')).toBeVisible({ timeout: 10000 });
expect(content?.length).toBeGreaterThan(100);
const visible = await page.locator('.editor').isVisible().catch(() => false);
```

| Interdit | Remplacement |
|----------|-------------|
| `waitForTimeout(N)` | `waitForLoadState('networkidle')` |
| `expect(true)` | `expect(realValue).toBeTruthy()` |
| `.catch(() => {})` | `.catch(() => false)` + condition |
| `\|\| true` dans expect | Retirer le `\|\| true` |

## Anti-Pattern 5 : Mega-commits (63 commits >30 fichiers)

**Coût historique :** ratio fix 34%, cascades de régressions

### Règle

| Taille | Action |
|--------|--------|
| 1-3 fichiers | ✅ Commit directement |
| 4-10 fichiers | ⚠️ Découper si possible |
| 10-30 fichiers | ❌ Obligatoirement découper |
| >30 fichiers | ❌ Refuser — batch interdit sauf migration automatisée |

**Exception :** Les refactoring automatisés (sed/replace bulk comme la migration dark theme) sont acceptables en un commit si le changement est mécaniquement vérifiable.

## Anti-Pattern 6 : Infinite loops React (5 incidents)

**Coût historique :** 5 bugs critiques, chacun nécessitant un fix dédié

### Causes identifiées

| Cause | Fichier(s) | Prévention |
|-------|-----------|------------|
| Objet instable dans deps useEffect | AI frontend, scheduling | `useMemo` sur les objets passés en deps |
| Zustand selector retourne nouvel objet | GlobalActivityFeed | Utiliser des selectors atomiques : `store(s => s.field)` pas `store(s => ({ a: s.a, b: s.b }))` |
| setState dans useEffect sans condition | Chat, theme toggle | Toujours conditionner : `if (value !== prev) setState(value)` |
| getSnapshot retourne nouvel objet | Activity tracker | `useSyncExternalStore` avec ref stable |
| Double init de canvas | Fabric/Design | Flag `useRef(false)` pour initialisation unique |

### Template safe
```typescript
// ✅ Zustand selector stable (pas de nouvel objet)
const count = useCalendarStore(s => s.layers.length);
// ❌ Crée un nouvel objet à chaque render
const { layers, view } = useCalendarStore(s => ({ layers: s.layers, view: s.view }));

// ✅ useEffect avec condition
useEffect(() => {
  if (data && data.id !== prevId.current) {
    prevId.current = data.id;
    setProcessed(transform(data));
  }
}, [data]);
```

## Checklist Composant Frontend

- [ ] Zéro couleur hardcodée → tokens sémantiques uniquement
- [ ] Pas de `<AppLayout>` dans la page
- [ ] Zéro `as any` (ou TODO documenté)
- [ ] Zustand selectors atomiques (pas d'objet composite)
- [ ] `useMemo`/`useCallback` pour les objets passés en deps
- [ ] useEffect a des conditions de guard
- [ ] E2E: pas de waitForTimeout, pas d'expect(true)

## Liens

- Memory : `feedback_git_lessons.md` (10 anti-patterns complets)
- Skills liés : `enterprise_code_review`, `nextjs_component`, `claude_md_governance`
- Fichiers à haut risque : `sidebar.tsx` (57 mods), `spreadsheet.tsx` (46 mods), `providers.tsx` (35 mods)
