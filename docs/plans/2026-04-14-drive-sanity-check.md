# Drive Sanity Check End-to-End — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Garantir que tous les parcours utilisateur du Drive fonctionnent end-to-end sur `/drive` : upload, dossiers, rename, download, trash, favoris, partage, versions, search, preview.

**Architecture:** Audit en 4 phases (revue code → Playwright → fix → re-run final), en 4 couches de criticité croissante (fondations → gestion → collaboration → avancé). Fix respecte strictement CLAUDE.md (tracing, AppError, utoipa, rustdoc).

**Tech Stack:** Rust (Axum, sqlx, OpenDAL, tracing, utoipa) pour `signapps-storage` port 3004 ; Next.js 16 / React 19 / TypeScript / React Query pour frontend port 3000 ; Playwright pour audit E2E (webapp-testing skill).

**Design doc:** `docs/plans/2026-04-14-drive-sanity-check-design.md`

**Préconditions:**
- PostgreSQL up (`just db-start` si besoin)
- `signapps-storage` en cours d'exécution sur 3004
- Frontend en cours sur 3000 (`cd client && npm run dev`)
- Auto-login dispo : `http://localhost:3000/login?auto=admin`

---

## Phase 1 — Revue de code ciblée

Objectif : identifier les incohérences code sans lancer les services. Livrable : liste de "suspects" classés par couche.

### Task 1 : Revue couche Fondations

**Files:**
- Read: `services/signapps-storage/src/main.rs` (routes)
- Read: `services/signapps-storage/src/handlers/drive.rs`
- Read: `services/signapps-storage/src/handlers/files.rs`
- Read: `client/src/app/drive/page.tsx`
- Read: `client/src/lib/api/drive.ts`
- Read: `client/src/lib/api/storage.ts`

**Step 1: Lister les routes backend exposées**

Grep `main.rs` pour `.route(` et lister chaque endpoint avec sa méthode HTTP.

**Step 2: Lister les appels frontend API**

Grep `lib/api/drive.ts` + `lib/api/storage.ts` pour chaque fonction exportée. Noter URL, méthode, paramètres.

**Step 3: Comparer — suspects**

Écrire dans un scratchpad (mental / note temp) :
- Endpoints backend non appelés par frontend (dead code ?)
- Appels frontend sans endpoint backend correspondant (404 garanti)
- Méthodes HTTP qui mismatchent
- Params/query strings qui mismatchent

**Step 4: Vérifier types**

Comparer les `#[derive(Serialize)]` des réponses backend (handlers + `signapps-db/models`) aux types TS correspondants (`client/src/types/drive.ts` ou inline). Noter les mismatchs (champ renommé, optionnel/requis différent, type scalaire différent).

**Step 5: Vérifier gestion d'erreurs frontend**

Grep `drive/page.tsx` pour `onError`, `catch`, `toast.error`. Confirmer que chaque mutation (upload, createNode, deleteNode, updateNode) affiche un feedback d'erreur.

**Step 6: Commit notes**

Pas de commit — les "suspects" sont gardés en mémoire pour la Phase 3.

### Task 2 : Revue couche Gestion

**Files:**
- Read: `services/signapps-storage/src/handlers/trash.rs`
- Read: `services/signapps-storage/src/handlers/favorites.rs`
- Read: `client/src/components/storage/` (composants trash + favoris : `trash-*.tsx`, `favorite-*.tsx`, `StarButton.tsx` si présent)

**Step 1: Lister les endpoints trash**

Grep trash.rs pour `pub async fn` et `#[utoipa::path]`. Lister endpoints (list trash, restore, purge, purge-all).

**Step 2: Lister les endpoints favorites**

Idem pour favorites.rs.

**Step 3: Lister les appels frontend correspondants**

Grep `lib/api/` pour `trash`, `favorite`, `star`. Identifier les wrappers.

**Step 4: Vérifier l'intégration UI**

- Trash : la corbeille a-t-elle un bouton dans la sidebar ? Les actions restore/purge existent-elles dans l'UI ?
- Favoris : un bouton star est-il rendu sur chaque item ? L'état (is_favorite) vient-il de l'API ?

**Step 5: Noter suspects**

Mêmes critères que Task 1 (endpoints orphelins, mismatches, erreurs non gérées).

### Task 3 : Revue couche Collaboration

**Files:**
- Read: `services/signapps-storage/src/handlers/shares.rs`
- Read: `services/signapps-storage/src/handlers/versions.rs`
- Read: `client/src/components/drive/ShareDialog.tsx`
- Read: `client/src/components/drive/secure-share.tsx`
- Read: `client/src/components/storage/` (composants versions : `version-*.tsx`)

**Step 1: Lister endpoints shares + versions**

Grep pour `pub async fn` et `#[utoipa::path]`.

**Step 2: Flows attendus**

Pour chaque flow, vérifier que backend + frontend existent :
- Créer lien de partage : POST shares → ouvre dialog avec URL copiable
- Accéder via lien : GET `/s/:token` ou `/shares/:token` (peut être public, non authentifié)
- Révoquer : DELETE shares/:id
- Lister versions : GET versions/:node_id
- Restaurer version : POST versions/:id/restore (ou similaire)

**Step 3: Point d'attention migration ACL**

Vérifier si `shares.rs` route encore via ACL legacy ou si la migration `signapps-sharing` est déjà appliquée côté handlers. Noter.

**Step 4: Noter suspects**

### Task 4 : Revue couche Avancé

**Files:**
- Read: `services/signapps-storage/src/handlers/search.rs`
- Read: `services/signapps-storage/src/handlers/preview.rs`
- Read: `client/src/components/drive/file-previewer.tsx`
- Read: `client/src/components/drive/pdf-viewer.tsx`

**Step 1: Endpoints search**

Lister endpoints, confirmer paramètres (query, pagination, filters).

**Step 2: Endpoints preview**

Lister endpoints (thumbnail, fullsize, format). Noter les formats supportés (PDF, image formats).

**Step 3: Intégration UI search**

La SearchBar appelle quel endpoint ? Les résultats sont-ils affichés ? Debounce en place ?

**Step 4: Intégration UI preview**

PDF : pdf-viewer.tsx utilise quoi (iframe ? pdfjs ?) ? Images : `<img>` direct ou API endpoint ?

**Step 5: Noter suspects**

### Task 5 : Consolider la liste des suspects

**Step 1:** Regrouper tous les suspects en une liste structurée par couche.

**Step 2:** Ajouter un score de priorité (P0 = bloquant, P1 = dégrade fortement UX, P2 = nice-to-have) par suspect.

**Step 3:** Commit : aucun (suspects restent en mémoire / notes temp).

---

## Phase 2 — Audit Playwright par couche

Objectif : confirmer en navigateur réel quels suspects sont de vrais bugs + découvrir les bugs non-suspectés. Livrable : liste de bugs confirmés par couche.

Référence : `webapp-testing` skill pour les détails Playwright.

### Task 6 : Setup session Playwright + login

**Step 1: Vérifier services up**

```bash
curl -s http://localhost:3000 > /dev/null && echo "frontend OK" || echo "frontend DOWN"
curl -s http://localhost:3004/health > /dev/null && echo "storage OK" || echo "storage DOWN"
```

Expected: `frontend OK` + `storage OK`. Si un est DOWN, STOP et prévenir l'utilisateur.

**Step 2: Lancer browser via webapp-testing skill**

Naviguer vers `http://localhost:3000/login?auto=admin`.

**Step 3: Confirmer redirection**

Attendre redirection vers `/` ou `/dashboard`. Capture `browser_snapshot`.

**Step 4: Naviguer vers /drive**

`browser_navigate` vers `http://localhost:3000/drive`. Snapshot.

**Step 5: Capture console + network initiaux**

`browser_console_messages` + `browser_network_requests`. Noter toute erreur 4xx/5xx ou exception JS avant même d'avoir interagi.

### Task 7 : Audit couche Fondations

Parcours : upload → créer dossier → rename → download → delete.

**Step 1: Upload fichier simple**

- Créer un fichier test local : `c:/tmp/drive-test.txt` avec contenu "test 1".
- Cliquer le bouton upload (ou trigger drop zone).
- Utiliser `browser_file_upload` avec le path du fichier.
- Attendre toast success ou apparition dans la liste.
- Capture console + network : noter toute 5xx ou erreur.

Expected: fichier visible dans la liste, aucune erreur console/network.

**Step 2: Créer dossier**

- Cliquer "Nouveau dossier" ou équivalent.
- Saisir nom "test-folder".
- Valider.

Expected: dossier visible, aucune erreur.

**Step 3: Rename**

- Clic droit (ou menu contextuel) sur `drive-test.txt` → Renommer → "drive-test-renamed.txt".

Expected: nom mis à jour, aucune erreur.

**Step 4: Download**

- Clic droit → Télécharger.
- Vérifier via `browser_network_requests` qu'un GET a renvoyé 200 avec `content-disposition: attachment`.

Expected: téléchargement déclenché sans 5xx.

**Step 5: Delete**

- Clic droit → Supprimer.
- Confirmer.

Expected: fichier disparaît de la liste, aucune erreur.

**Step 6: Enregistrer résultats**

Pour chaque étape : OK / KO + description du bug si KO.

### Task 8 : Audit couche Gestion

Parcours : trash (restore/purge) + favoris (star/unstar).

**Step 1: Trash — visualiser**

Naviguer vers section "Corbeille" dans la sidebar. Le fichier supprimé en Task 7.5 doit apparaître.

**Step 2: Trash — restore**

Clic droit sur fichier trash → Restaurer. Vérifier retour dans la racine.

**Step 3: Trash — purge**

Re-supprimer, aller dans corbeille, Purger définitivement. Confirmer disparition.

**Step 4: Favoris — star**

Re-créer un fichier test. Cliquer étoile. Vérifier via section "Favoris" qu'il apparaît.

**Step 5: Favoris — unstar**

Cliquer étoile à nouveau. Vérifier disparition de la section Favoris.

**Step 6: Enregistrer résultats**

### Task 9 : Audit couche Collaboration

Parcours : partage lien public (créer, accéder anonyme, révoquer) + versions (lister, restaurer).

**Step 1: Créer lien de partage**

- Clic droit sur un fichier → Partager.
- Ouvrir le ShareDialog.
- Générer un lien public (sans password, sans expiration pour simplifier).
- Copier l'URL.

**Step 2: Accéder anonymement**

Ouvrir un nouvel onglet Playwright (`browser_tabs`) en mode "incognito-like" (pas de cookies). Naviguer vers l'URL du lien.

Expected: le fichier est accessible ou téléchargeable sans login.

**Step 3: Révoquer**

Revenir sur l'onglet principal, ouvrir le ShareDialog du même fichier, révoquer le lien.

**Step 4: Vérifier révocation**

Retourner sur l'onglet anonyme, rafraîchir. Expected: accès refusé (401/403/404).

**Step 5: Versions — lister**

Uploader une V2 du même fichier (même nom, contenu différent). Ouvrir le panel version-history. Vérifier 2 versions listées.

**Step 6: Versions — restaurer**

Cliquer "Restaurer" sur la V1. Vérifier que le contenu actuel redevient V1 (télécharger et lire).

**Step 7: Enregistrer résultats**

### Task 10 : Audit couche Avancé

Parcours : search par nom + preview PDF + preview image.

**Step 1: Search par nom**

Dans la SearchBar du Drive, taper une partie du nom d'un fichier existant. Attendre résultats.

Expected: fichier apparaît dans les résultats, aucune erreur.

**Step 2: Preview PDF**

- Uploader un PDF test (`c:/tmp/test.pdf` — à créer ou utiliser un existant).
- Double-cliquer (ou action "Aperçu").
- Vérifier que le pdf-viewer s'ouvre et affiche le contenu.

**Step 3: Preview image**

- Uploader une image (`c:/tmp/test.png`).
- Double-cliquer.
- Vérifier que l'image s'affiche.

**Step 4: Enregistrer résultats**

### Task 11 : Consolider la liste de bugs confirmés

**Step 1:** Fusionner résultats Playwright + suspects Phase 1.

**Step 2:** Classer par couche, par priorité (P0/P1/P2), par origine (backend/frontend/les deux).

**Step 3:** Pour chaque bug, identifier le fichier précis à modifier.

---

## Phase 3 — Fix par couche

Objectif : corriger les bugs confirmés. Chaque fix suit un mini-cycle TDD. Chaque couche fait l'objet d'un (ou plusieurs) commits conventionnels.

Référence : `superpowers:test-driven-development` skill pour chaque fix non-trivial.

### Task 12 : Fix couche Fondations

**Pour chaque bug confirmé en Task 7 :**

**Step 1: Reproduire via test ciblé**

- Si bug backend : écrire un test d'intégration ou unitaire dans le crate concerné.
  - Exemple : test dans `services/signapps-storage/src/handlers/files.rs` `#[cfg(test)] mod tests` ou crate test file.
  - Utiliser `cargo nextest run -p signapps-storage -- <test_name>`.
- Si bug frontend : ajouter/étendre un test Playwright dans `client/e2e/drive-*.spec.ts`.

**Step 2: Lancer le test — vérifier qu'il échoue**

Expected: FAIL avec le symptôme du bug.

**Step 3: Implémenter le fix**

Conventions CLAUDE.md obligatoires :
- Rust : pas de `.unwrap()` / `.expect()` hors tests ; utiliser `.map_err(|e| AppError::internal(...))?` ou `.context(...)?`
- Rust : pas de `println!` / `eprintln!` / `dbg!` ; utiliser `tracing::info!` / `warn!` / `error!` / `debug!`
- Rust : `#[tracing::instrument]` sur handlers publics (avec `skip(pool, claims)`)
- Rust : `#[utoipa::path]` sur endpoints + `ToSchema` sur structs req/resp
- Rust : `/// rustdoc` sur items publics nouveaux/modifiés
- TS : tokens Tailwind sémantiques (`bg-card`, `text-foreground`, `border-border`, `bg-muted`)
- TS : gestion d'erreurs avec toast (`toast.error(...)`)

**Step 4: Ajouter data-testid si frontend touché**

Convention : `data-testid="drive-{action}-{target}"` (ex : `drive-upload-button`, `drive-file-item`, `drive-rename-input`).

**Step 5: Relancer le test**

Expected: PASS.

**Step 6: Vérifier qualité**

```bash
# Si backend touché
cargo clippy -p signapps-storage --all-features -- -D warnings
cargo fmt --all -- --check

# Si frontend touché
cd client && npx tsc --noEmit
cd client && npm run lint
```

Expected: aucun warning.

**Step 7: Commit atomique**

```bash
git add <fichiers du fix>
git commit -m "fix(drive): <description concise du bug corrigé>"
```

Exemple : `fix(drive): handle empty filename in upload response`.

**Step 8: Répéter pour le bug suivant de la couche**

**Step 9: Re-run Playwright audit couche Fondations**

Re-exécuter Task 7 entièrement. Tous les parcours doivent passer OK.

### Task 13 : Fix couche Gestion

Même procédure que Task 12, pour les bugs de Task 8.

Re-run Task 8 après fixes.

### Task 14 : Fix couche Collaboration

Même procédure que Task 12, pour les bugs de Task 9.

**Point d'arrêt :** si migration ACL legacy rend le partage intractable, STOP et prévenir l'utilisateur. Ne pas forcer le fix — sortir le partage du scope et documenter.

Re-run Task 9 après fixes.

### Task 15 : Fix couche Avancé

Même procédure que Task 12, pour les bugs de Task 10.

Re-run Task 10 après fixes.

---

## Phase 4 — Validation finale

### Task 16 : Re-run Playwright complet

**Step 1:** Re-exécuter Tasks 6, 7, 8, 9, 10 dans l'ordre, depuis un état propre (refresh browser, vider fichiers test).

**Step 2:** Capturer résultats OK/KO.

**Step 3:** Si KO restant : retour Phase 3 sur la couche concernée.

### Task 17 : Qualité globale

**Step 1:** Backend :

```bash
cargo clippy --workspace --all-features -- -D warnings
cargo fmt --all -- --check
cargo nextest run -p signapps-storage
```

Expected: tout pass.

**Step 2:** Frontend :

```bash
cd client && npx tsc --noEmit
cd client && npm run lint
```

Expected: tout pass.

**Step 3:** Si échec : fix puis commit `chore(drive): fix lint warnings post-audit`.

### Task 18 : Rapport final

**Step 1:** Créer `docs/plans/2026-04-14-drive-sanity-check-report.md` contenant :

- Résumé exécutif (x bugs trouvés, y corrigés, z hors scope)
- Table par couche : parcours | statut initial | statut final | bugs corrigés (commit hash)
- Liste des data-testids ajoutés
- Recommandations de suivi (items hors scope à planifier : sync desktop, OCR, etc.)

**Step 2:** Commit :

```bash
git add docs/plans/2026-04-14-drive-sanity-check-report.md
git commit -m "docs(drive): add sanity check audit report"
```

**Step 3:** Présenter le rapport à l'utilisateur.

---

## Règles globales d'exécution

1. **Un commit atomique par fix** — pas de mega-commit fin de phase
2. **Conventional commits obligatoires** — `fix(drive):`, `feat(drive):`, `test(drive):`, `docs(drive):`, `chore(drive):`
3. **Vérifier CLAUDE.md checklist** avant chaque commit (tracing, AppError, utoipa, rustdoc, pas d'unwrap)
4. **Si migration SQL nécessaire** : STOP et demander validation utilisateur avant de créer le fichier
5. **Si bug trop lourd** (couche Collaboration cassée par migration ACL) : STOP, proposer de sortir du scope, documenter
6. **Pas de sécurité dégradée** : jamais bypass auth pour "faire marcher", toujours traiter l'erreur
7. **Frontend sémantique** : tokens Tailwind, pas de couleurs hard-codées
