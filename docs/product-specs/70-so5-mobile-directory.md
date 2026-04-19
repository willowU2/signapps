# 70 — Mobile Directory (SO5)

> **Scope** : annuaire `/directory` responsive + tap-to-contact + cache offline

---

## 1. Objectif produit

Donner à chaque utilisateur authentifié un **annuaire mobile-first** qui, en trois taps, déclenche un appel / mail / chat / meet. Les vues `/admin/persons` et `/admin/org-structure` existaient déjà mais sont pensées desktop et réservées aux admins ; SO5 crée une surface complémentaire accessible par tous, optimisée pour le pouce et le hors-réseau.

Cas d'usage canonique : **le CEO en déplacement sort son téléphone, ouvre l'app SignApps installée en PWA, tape le prénom d'un collaborateur, appuie sur la tuile "Appeler"**.

---

## 2. Parcours utilisateur

1. **Launcher** — shortcut PWA "Annuaire" installé avec l'app → ouvre directement `/directory`.
2. **Header sticky** — search input + retour + refresh. Persistance du résultat même lors du scroll.
3. **Chips de filtres** — "Tous", top 8 OU, "Avec photo", "Reset". Une chip active = primary color (rempli).
4. **Liste scrollable** — cards compactes `h-20` mobile / `h-24` desktop. Avatar `SmartAvatar` (photo ou initiales tintées), nom, titre, email.
5. **Tap sur une card** — mobile : drawer full-screen ; desktop : panel de détail à droite (grid 5/7).
6. **Detail drawer** — photo grande, nom, titre, OU puis 4 gros boutons `Appeler / Email / Chat / Meet` + QR code vCard collapsible + bouton `Voir dans l'organigramme`.

---

## 3. Architecture

### Frontend only — pas de migration DB, pas d'endpoint backend nouveau

| Rôle | Fichier |
|------|---------|
| Page | `client/src/app/directory/page.tsx` |
| Layout | `client/src/app/directory/layout.tsx` |
| Store Zustand | `client/src/stores/directory-store.ts` |
| API route vCard | `client/src/app/api/directory/vcard/[id]/route.ts` |
| Carte compacte | `client/src/components/directory/person-card.tsx` |
| Drawer détail | `client/src/components/directory/person-detail-drawer.tsx` |
| Search bar | `client/src/components/directory/search-bar.tsx` |
| Filter chips | `client/src/components/directory/filter-chips.tsx` |
| QR vCard | `client/src/components/directory/vcard-qr.tsx` |

Les 4 endpoints backend utilisés existent déjà :
- `GET /org/persons?tenant_id=…&active=true` → liste des personnes (signapps-org port 3026)
- `GET /org/nodes` → arbre des OU (pour filtres + enrichissement)
- `GET /org/skills` → catalogue skills (filtre catégorie, enrichissement)
- `POST /api/v1/meet/rooms/adhoc` → meet-svc (bouton "Meet" adhoc)

### Cache + offline

- **Zustand `persist`** (`directory-cache` key dans localStorage) stocke `persons`, `nodes`, `skills`, `lastFetchedAt`.
- **TTL** 5 minutes via `isFresh()`; `loadAll({ force: true })` pour bypass.
- **Serwist** ajoute une rule `StaleWhileRevalidate` sur `/org/persons*`, `/org/nodes*`, `/org/skills*` (`cacheName: directory-cache`, TTL 5 min) → reload hors-ligne affiche la dernière liste cachée.

### Recherche

- **fuse.js** 14 kb gzip, déjà optimisé dans `next.config.ts` (`optimizePackageImports`).
- Clés de match : `full_name` (poids 0.5), `email` (0.2), `title` (0.2), `phone` (0.1).
- `threshold: 0.35`, `ignoreLocation: true`, `minMatchCharLength: 2`.
- Debounce input : 150 ms dans `SearchBar`.
- Fallback tri alphabétique quand la requête est vide.

---

## 4. Data model (réutilisation)

Aucune nouvelle table. `Person` est défini dans `client/src/types/org.ts` :

```ts
interface Person {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
}
```

Champs enrichis (lus depuis `attributes` ou `metadata`) :
- `title` — intitulé de poste (ex: "Senior Engineer")
- `primary_node_id` / `node_id` — OU principale (pour le filtre OU et le lien organigramme)
- `org_name` — surface uniquement dans la vCard téléchargée

---

## 5. vCard 4.0

Format normalisé RFC 6350, généré côté client dans `vcard-qr.tsx::buildVcard` :

```
BEGIN:VCARD
VERSION:4.0
FN:Marie Dupont
N:Dupont;Marie;;;
TEL;TYPE=cell:+33123456789
EMAIL;TYPE=work:marie.dupont@nexus.corp
ORG:Nexus Industries
TITLE:CEO
PHOTO;VALUE=uri:https://…/photo.png
END:VCARD
```

L'API route `/api/directory/vcard/[id]` produit la même payload côté serveur (pour scan QR inter-app, emails signature, etc.) en proxy-fetchant `signapps-org` avec le header `Authorization` du visiteur. Retour : `text/vcard; charset=utf-8` + `Content-Disposition: attachment`.

> **Note architecturale** : le rendu QR est purement côté client (composant `VcardQR` avec `qrcode.react`). Next.js 16 interdit `react-dom/server` dans les route handlers, donc un éventuel `?format=qr` serveur nécessiterait un encodeur QR auto-contenu — volontairement hors scope de SO5.

---

## 6. PWA & manifest

```json
{
  "shortcuts": [
    {
      "name": "Annuaire",
      "url": "/directory",
      "icons": [
        { "src": "/icons/directory-192.png", "sizes": "192x192", "type": "image/png" },
        { "src": "/icons/directory-512.png", "sizes": "512x512", "type": "image/png" }
      ]
    }
  ]
}
```

Icônes générées au build-time par `client/scripts/generate-directory-icons.js` (PNG `192×192` et `512×512`, fond `#3b82f6`, glyphe "D" blanc). Script à re-run manuellement si le branding évolue.

---

## 7. Accessibilité

- Search input : `aria-label="Recherche annuaire"`, `type="search"`, `inputMode="search"`.
- Chips filtres : `role="toolbar"`, `aria-pressed` sur chaque chip actif.
- Cards : `button type="button"` + `aria-label="Voir la fiche de {name}"`.
- Drawer : `SheetTitle` en `sr-only` (le titre visuel est dans le header du drawer pour le design).
- SmartAvatar : fallback `role="img"` + `aria-label`.
- Focus management : `focus-visible:outline-hidden focus-visible:ring-2` sur tous les interactifs.

---

## 8. Performance

- **Liste** : 81 persons → < 4 KB JSON, rendu direct en `<ul>`. Virtualisation déclenchable via `<VirtualList>` si le tenant dépasse 500 persons (non activé par défaut pour éviter les quirks de focus sur mobile iOS).
- **fuse.js** : recompilé à chaque frappe mais sur un corpus de taille fixe — budget typique < 10 ms pour 100 entrées.
- **Rehydration SSR** : page `use client`. Aucune donnée n'est rendue côté serveur → le store Zustand hydrate depuis localStorage au premier render client.
- **Icônes PWA** : 1 KB (192) + 5 KB (512) — pas de dégradation Lighthouse.

---

## 9. Tests

- **Unit** — `client/src/stores/directory-store.test.ts` (tri alphabétique, fuzzy match, filtre photo, TTL) + `client/src/scripts/manifest.test.ts` (assure le shortcut)
- **E2E** — `client/e2e/so5-directory.spec.ts` : viewport mobile + desktop, ouverture drawer, présence des 4 actions, `tel:` href.

---

## 10. Exit criteria (voir aussi la spec design source)

- [x] `/directory` accessible par tout user authentifié (pas sous `/admin`)
- [x] Search réactif (< 50 ms par frappe grâce au debounce + fuse local)
- [x] Tap card → 4 actions cliquables (`tel:`, `mailto:`, chat, meet adhoc)
- [x] Mobile 375 px sans overflow horizontal (drawer full screen)
- [x] Offline : données persistées Zustand + SWR serwist rule
- [x] Manifest shortcut "Annuaire" + icônes 192/512
- [x] Tests tsc + unit + E2E (skip gracieux si seed manquant)
