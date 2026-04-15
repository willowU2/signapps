# Drive Sanity Check — Rapport d'audit

**Date** : 2026-04-14
**Plan** : `docs/plans/2026-04-14-drive-sanity-check.md`
**Design** : `docs/plans/2026-04-14-drive-sanity-check-design.md`

## Résumé exécutif

5 bugs P0 trouvés par revue de code, tous corrigés. 4 helpers P2 (URLs frontend sans `/api/v1`) nettoyés au passage. Audit Playwright partiellement skipé pour cause de blocker technique — les fixes ont été validés via `cargo check`, `cargo clippy`, et `tsc --noEmit`.

## Bugs corrigés

| ID | Couche | Localisation | Fix | Commit |
|----|--------|--------------|-----|--------|
| P0-A | Collaboration | `secure-share.tsx` | Remplacé le mock (setTimeout + localStorage + token client-side + URL `/f/:token` inexistante) par un appel réel à un nouvel endpoint `POST /drive/nodes/:id/share` | `f595a91a` |
| P0-B | Collaboration | `shares.rs:202-208` | Fallback pointait vers port 3000 (frontend) au lieu de 3004 (backend) et concaténait mal les segments ; strip propre du suffixe `/api/v1` + préfixe explicite | `fd593f50` |
| P0-C | Avancé | `storage.ts:610-611` | `previewApi.getPreviewUrl` omettait `/api/v1` → 404 sur aperçu documents | `6d161775` |
| P0-D | Collaboration | `versions.rs` + `main.rs` | Endpoint `GET /files/:file_id/versions/:version_id/download` n'existait pas (diff versions côté UI appelait une route absente) | `91a4f46f` |
| P0-E | Avancé | `search.rs` + `main.rs` | Endpoint `GET /search/content` n'existait pas ; ajout d'un fallback metadata en attendant un vrai FTS | `a74765ad` |

## Nettoyage P2 (URL helpers sans `/api/v1`)

Inclus dans `6d161775` (même commit que P0-C) :

- `drive.ts:86-92` `downloadNodeUrl`
- `storage.ts:274-277` `sharesApi.access`
- `storage.ts:280` `sharesApi.downloadUrl`
- `storage.ts:604-609` `previewApi.getThumbnailUrl`

Ces helpers n'avaient pas de consommateur direct mais construisaient des URLs cassées. Nettoyés par rigueur.

## Nouveaux endpoints backend

| Endpoint | Handler | Rôle |
|----------|---------|------|
| `POST /drive/nodes/:id/share` | `drive::create_node_share` | Crée un lien de partage public pour un nœud Drive (résolution bucket/key automatique) |
| `GET /files/:file_id/versions/:version_id/download` | `versions::download_version` | Stream le binaire d'une version archivée comme attachment |
| `GET /search/content` | `search::search_content` | Recherche fallback dans les métadonnées (key) jusqu'à ce qu'un index FTS soit branché |

## Vérifications

- `cargo check -p signapps-storage` → pass
- `cargo clippy -p signapps-storage --all-features --no-deps -- -D warnings` → pass
- `cargo fmt` → fichiers modifiés formatés (`226ee2ad`)
- `tsc --noEmit` côté client → aucune erreur sur `secure-share.tsx`, `drive.ts`, `storage.ts` (erreurs pré-existantes sur `data-management/`, `notifications/preferences`, `login/page.tsx` — hors scope)

## Blockers rencontrés

### Playwright via MCP

- Le browser MCP refuse `localhost` (navigation échoue avec `ERR_FAILED`), accepte uniquement `127.0.0.1`
- CSP du frontend limite `connect-src` à `http://localhost:*` — toute requête sortante depuis `127.0.0.1:3000` vers `127.0.0.1:3001` est bloquée par CSP
- Impossible de compléter un auto-login stable dans cette configuration via MCP

**Contournement** : Tasks 7-10 de l'audit Playwright skipées. Les 5 bugs P0 ont été confirmés par revue de code statique (pas besoin de browser pour identifier des endpoints absents ou des URLs malformées).

**Validation finale des fixes** : cargo check + tsc + clippy. Un audit manuel via navigateur classique (sans MCP) reste à faire côté utilisateur pour confirmer UX.

## Bugs bonus découverts (hors scope Drive — non corrigés)

Signalés pour suivi ultérieur :

- 404 sur `http://localhost:3001/api/v1/mail/unread-count`, `/chat/unread-count`, `/tasks/overdue-count` — routes appelées sur `signapps-identity` alors qu'elles devraient taper mail/chat/tasks respectivement
- 404 intermittents sur `http://localhost:3011/api/v1/calendars/:id/events` (ID utilisateur non initialisé ?)
- CSP `connect-src` ne liste pas `127.0.0.1:*` — cross-origin local bloqué pour les tests
- 409 sur création de bucket `drive` (idempotence à vérifier)

## Recommandations de suivi

1. **Vrai FTS pour content search** : remplacer le fallback `ILIKE %q% sur key` par un index full-text (pgvector ou pg tsvector) une fois l'OCR/extraction de texte en place
2. **Ajouter des data-testid** sur les composants Drive pour faciliter les futurs tests E2E (convention `drive-{action}-{target}` déjà établie)
3. **Corriger la CSP** frontend pour autoriser `127.0.0.1:*` en dev afin de débloquer les tests Playwright via MCP
4. **Résoudre les routes mail/chat/tasks/unread-count** mal dirigées vers identity
5. **Migration ACL → signapps-sharing** : toujours en cours, drift possible entre l'ancien et le nouveau système de permissions

## Commits

```
226ee2ad style(storage): apply rustfmt to drive/shares/versions handlers
f595a91a refactor(drive): replace SecureShareDialog mock with real share API
a74765ad feat(storage): add content search endpoint fallback
91a4f46f feat(storage): add file version download endpoint
fd593f50 fix(storage): build share URLs from base host with explicit /api/v1 prefix
6d161775 fix(drive): add /api/v1 prefix to direct URL helpers
93857f7f docs(drive): add sanity check implementation plan
9a8331c8 docs(drive): add sanity check end-to-end design
```

## Scope tenu / non tenu

**Tenu** :

- Revue exhaustive des 4 couches (fondations, gestion, collaboration, avancé)
- Identification de tous les P0 par lecture code
- 5/5 P0 corrigés, 4/4 P2 nettoyés
- Conformité CLAUDE.md : `#[instrument]`, `AppError`, `#[utoipa::path]`, `/// rustdoc`, pas de `.unwrap()`/`println!` en code non-test

**Non tenu** :

- Audit Playwright en navigateur (blocker MCP + CSP)
- Data-testid sur les composants (scope étendu remis à plus tard)
- Validation E2E manuelle des parcours utilisateur post-fix (à faire côté utilisateur)
