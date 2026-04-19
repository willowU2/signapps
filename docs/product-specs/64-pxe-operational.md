# Product Spec 64 — PXE Opérationnel

**Status:** Livré S2 (2026-04)
**Owner:** Track B
**Related:** `services/signapps-pxe/CLAUDE.md`

## Résumé

PXE + ProxyDHCP opérationnels en mode dev (ports non privilégiés) et en
prod (ports standard). Auto-discovery de machines via DHCPDISCOVER,
wizard 5 étapes pour le déploiement, progression live via SSE
(LISTEN/NOTIFY PostgreSQL).

## Configuration

| Env var                  | Défaut     | Rôle                                   |
|--------------------------|-----------:|----------------------------------------|
| `PXE_MODE`               | `user`     | `user` (6969/4011) ou `root` (69/67)   |
| `PXE_TFTP_PORT`          | auto       | Override explicite du port TFTP        |
| `PXE_DHCP_PORT`          | auto       | Override explicite du port ProxyDHCP   |
| `PXE_ENABLE_TFTP`        | `true`     | Spawner le listener TFTP               |
| `PXE_ENABLE_PROXY_DHCP`  | `true`     | Spawner le listener ProxyDHCP          |
| `PXE_AUTO_ENROLL`        | `true`     | Auto-discovery des MACs via DHCP       |

## Endpoints (W1 + W2)

| Endpoint                                            | Méthode | Rôle                                     |
|-----------------------------------------------------|---------|------------------------------------------|
| `/api/v1/pxe/assets/discovered`                     | GET     | Liste les MACs vus en DHCP, pas enrôlés  |
| `/api/v1/pxe/assets/:mac/enroll`                    | POST    | Transition `discovered` → `enrolled`     |
| `/api/v1/pxe/dhcp/recent?limit=N`                   | GET     | Audit trail des requêtes DHCP récentes   |
| `/api/v1/pxe/catalog/refresh`                       | POST    | Re-scan catalogue + SHA256 check         |
| `/api/v1/pxe/deployments/:mac/stream`               | GET     | SSE live progress (LISTEN/NOTIFY)        |
| `/api/v1/pxe/_test/simulate-dhcp` *(debug uniquement)* | POST | Injecte une DHCPDISCOVER synthétique     |

## Frontend

| Route            | Description                                     |
|------------------|-------------------------------------------------|
| `/pxe/wizard`    | Wizard 5 étapes (catalog, profile, target, confirm, progress) |
| `/pxe/assets`    | Tabs (Tous / Découverts / Enrôlés), bouton Enrôler |
| `/pxe/debug`     | Table refresh 3 s des requêtes DHCP récentes    |

Composants frontend :
- `client/src/components/pxe/WizardStep{1..5}*.tsx`
- `client/src/components/pxe/LiveDeploymentTerminal.tsx`
- `client/src/hooks/usePxeDeploymentStream.ts`

## Tests

```bash
# Test unitaire SSE (requires postgres)
DATABASE_URL=... cargo test -p signapps-pxe --test test_sse_stream -- --ignored

# Tests DHCP auto-discovery
cargo test -p signapps-pxe --test test_discovered_endpoints -- --ignored
cargo test -p signapps-pxe --test test_dhcp_recent -- --ignored

# E2E Playwright (3 scénarios : S2-PXE-1/2/3)
cd client && npx playwright test s2-pxe.spec.ts --reporter=list
```

## Sécurité

- ProxyDHCP filtre option 60 = `PXEClient` (ignore autres requêtes DHCP)
- Enrôlement protégé par Bearer JWT + RBAC (middleware auth)
- Auto-discovery (`PXE_AUTO_ENROLL=true`) n'accorde aucun droit utilisateur
- Catalog refresh exige rôle admin
- Endpoint `/pxe/_test/simulate-dhcp` gated sur `cfg!(debug_assertions)` —
  invisible en release (production)

## Observabilité

- Spans tracing : `pxe.dhcp_request`, `pxe.deployment_progress`,
  `sse.subscribe_deployment`
- Metrics (prévu) : `pxe_dhcp_requests_total{msg_type}`,
  `pxe_assets_discovered_total`, `pxe_deployments_active`
- NOTIFY channel : `pxe_deployment_progress` (payload JSON minimal
  `{mac, progress, status, step}`)

## Flow opérationnel démo

1. `just start` (single-binary) → PXE service bind 3016, TFTP :6969,
   ProxyDHCP :4011.
2. `cargo run -p signapps-pxe --bin signapps-pxe-sim` → envoie un
   DHCPDISCOVER vers 127.0.0.1:4011 et reçoit un OFFER.
3. L'UI `/pxe/assets → Découverts` liste la MAC, clic sur "Enrôler" →
   transition vers Enrôlés.
4. `/pxe/wizard` → 5 étapes, kickoff POST `/pxe/deployments`.
5. Côté prod, la machine PXE reçoit le boot script et émet des
   UPDATEs sur `pxe.deployments.progress`. Le trigger PostgreSQL émet
   un NOTIFY, le SSE handler forward vers le terminal live.
