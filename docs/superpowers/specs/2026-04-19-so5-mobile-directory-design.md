# SO5 — Mobile directory — Design Spec

**Scope :** Vue annuaire mobile-first · Tap-to-call/mail/chat/meet · Recherche instant · Cache offline
**Durée :** 2 jours (1 wave)
**Branche :** `feature/so5-mobile-directory`
**Dépendances :** SO1-SO4 mergés

---

## 1. Contexte

Le CEO en déplacement veut pouvoir ouvrir l'app sur son téléphone, chercher une personne, et déclencher un appel/mail/chat en un tap. Les vues existantes (`/admin/org-structure`, `/admin/persons`) sont dense-desktop — peu utilisables à 375px.

SO5 ajoute une **page publique `/directory`** responsive mobile-first qui offre :
- Liste compacte de toutes les persons du tenant
- Search-as-you-type ultra réactif (cache local)
- Tap sur row → drawer détail avec boutons action (tel/mail/chat/meet)
- Offline : page fonctionnelle sans réseau (Serwist SW déjà en place)

Le desktop en profite aussi : `/directory` est une alternative plus rapide à `/admin/persons` pour chercher quelqu'un.

---

## 2. Features

### M1 — Page `/directory` responsive

- **M1.1** Nouvelle page `/directory` (pas `/admin/*`) accessible par tous les users authentifiés
- **M1.2** Layout mobile-first : header sticky avec search input + filtre OU, liste scroll de cards compactes (avatar 48x48 + nom + titre + OU)
- **M1.3** Layout desktop : grid 3 colonnes de cards avec detail panel à droite qui slide-in au tap
- **M1.4** Virtualisation via `<VirtualList>` existant si > 100 persons (Nexus : 81 persons → borderline, activer quand même)

### M2 — Actions tap-to-contact

- **M2.1** Drawer détail d'une person :
  - Bouton téléphone (si `phone` présent) : `tel:+33...`
  - Bouton mail : `mailto:email@nexus.corp`
  - Bouton chat : navigate vers `/chat?person_id=X` (crée DM si besoin)
  - Bouton meet : `POST /api/v1/meet/rooms/adhoc` avec invité = cette person + redirect vers room
  - Bouton "Voir dans l'organigramme" : navigate vers `/admin/org-structure?focus=<node_id>`
- **M2.2** Ouverture d'un contact = le native handler du device (tel/mail)
- **M2.3** Drawer peut aussi scanner le QR d'une card pour partager le contact (vCard 4.0 format)

### M3 — Recherche instant + cache

- **M3.1** Store Zustand `useDirectoryStore` qui charge TOUTES les persons du tenant au mount (1 requête, mise en cache 5 min)
- **M3.2** Search côté client (fuse.js ou simple `toLowerCase().includes`) pour réactivité instant — pas de round-trip
- **M3.3** Filtres : OU (dropdown), catégorie skill (tech/soft/lang/domain), présence photo
- **M3.4** Cache persist via Zustand persist middleware (localStorage) → offline disponible après 1er load

### M4 — PWA + offline

- **M4.1** Manifest mis à jour : `directory` devient un shortcut PWA (`manifest.json` shortcuts array)
- **M4.2** Serwist SW existant → ajouter la route `/directory` à la liste des `runtimeCaching` avec strategy `StaleWhileRevalidate` pour les API `/org/persons`
- **M4.3** Icône PWA `directory.png` 192x192 + 512x512 pour install home screen

---

## 3. Architecture

Pas de migration DB. Pas de nouveau endpoint backend (réutilise `/org/persons` existant).

**Composants frontend :**
```
client/src/app/directory/page.tsx                 # page principale
client/src/app/directory/layout.tsx               # layout responsive
client/src/components/directory/person-card.tsx   # card compact
client/src/components/directory/person-detail-drawer.tsx  # detail + actions
client/src/components/directory/search-bar.tsx
client/src/components/directory/filter-chips.tsx
client/src/components/directory/vcard-qr.tsx
client/src/stores/directory-store.ts              # Zustand cached
client/src/hooks/useDirectorySearch.ts            # debounced local search
client/public/icons/directory-192.png             # PWA icons
client/public/icons/directory-512.png
client/app/api/directory/vcard/[id]/route.ts      # serve vCard 4.0 pour QR scan
```

**Desktop layout** : grid 12 cols, list prend 5, detail prend 7 avec sticky top.
**Mobile layout** : stack vertical, detail = drawer full screen avec back button.

---

## 4. Tasks

### T1 — Store + API client

**Files :** `client/src/stores/directory-store.ts` + extensions `client/src/lib/api/org.ts`
- [ ] Store Zustand avec persist middleware (key `directory-cache`, TTL 5min via `lastFetchedAt`)
- [ ] `loadPersons(tenant_id)` : appelle `orgApi.persons.list({active: true})` + `orgApi.nodes.list()` + `orgApi.skills.list()`
- [ ] `filtered(query, filters)` selector avec fuse.js sur full name + email + title
- [ ] Tests unitaires selector
- [ ] Commit `feat(directory): Zustand store with cache + fuse.js search`

### T2 — Layout + page

**Files :** `client/src/app/directory/{page,layout}.tsx`
- [ ] Layout minimal sans sidebar admin (pas dans `/admin/*`), topbar slim
- [ ] Responsive : `md:grid md:grid-cols-12` avec list 5 cols / detail 7 cols
- [ ] Mobile : stack + drawer flottant via `<Sheet>` shadcn
- [ ] Commit `feat(directory): page + responsive layout`

### T3 — Composants cards + detail

**Files :** `client/src/components/directory/{person-card,person-detail-drawer,search-bar,filter-chips,vcard-qr}.tsx`
- [ ] `PersonCard` : avatar (SmartAvatar de SO4) + nom + titre + OU, h-20 sm:h-24
- [ ] `PersonDetailDrawer` : header photo/nom + 4 big buttons tel/mail/chat/meet + "Voir dans org"
- [ ] `SearchBar` : input shadcn + debounce 150ms + clear button
- [ ] `FilterChips` : pills toggleables par OU (top 8) + dropdown "Plus"
- [ ] `VcardQR` : génère vCard 4.0 + QRCodeSVG (lib `qrcode` ou `react-qr-code`)
- [ ] Commit `feat(directory): compact cards + detail drawer with tap-to-contact`

### T4 — API vCard route

**Files :** `client/src/app/api/directory/vcard/[id]/route.ts`
- [ ] Next.js route handler : récupère person via orgApi server-side, retourne text/vcard avec FN, TEL, EMAIL, ORG, TITLE
- [ ] Support `?format=qr` : retourne image/svg+xml du QR
- [ ] Commit `feat(directory): vCard route for contact sharing`

### T5 — PWA + Serwist + offline

**Files :**
- `client/public/manifest.json` (update shortcuts)
- `client/src/workers/serwist-config.ts` ou `client/next.config.ts` (précacher /directory)
- `client/public/icons/directory-{192,512}.png` (placeholder sauf si existant)
- Tests : manifest validator
- [ ] Ajouter shortcut `Directory` dans manifest avec url `/directory`
- [ ] Runtime cache rule pour `/api/v1/org/persons*` : StaleWhileRevalidate, TTL 5min
- [ ] Précache `/directory` page au build
- [ ] Commit `feat(pwa): directory shortcut + runtime cache for org/persons`

### T6 — E2E + docs + merge

**Files :**
- `client/e2e/so5-directory.spec.ts` (ouvrir /directory, chercher "marie", taper sur card, vérifier drawer + tel link)
- `docs/product-specs/70-so5-mobile-directory.md`
- `.claude/skills/mobile-directory-debug/SKILL.md`
- [ ] E2E avec viewport mobile (375x667) + desktop (1440x900)
- [ ] Product spec + debug skill
- [ ] Clippy (N/A — frontend only) + tsc + build + Lighthouse mobile score > 85
- [ ] Merge local `feature/so5-mobile-directory → main --no-ff`
- [ ] Commit `docs(so5): product spec + debug skill + E2E`

---

## 5. Exit criteria

- [ ] `/directory` accessible, 81 persons Nexus listées
- [ ] Search "marie" filtre en < 50ms
- [ ] Tap row ouvre drawer avec 4 actions cliquables (tel/mail/chat/meet)
- [ ] Mobile 375px : layout sans overflow, drawer full screen
- [ ] Offline : reload page sans réseau → persons cachées s'affichent
- [ ] PWA : install prompt affiche shortcut Directory
- [ ] Lighthouse mobile > 85 (Perf + A11y + Best Practices)
- [ ] Merge main

---

**Fin spec SO5.**
