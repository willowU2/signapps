---
name: signatures-debug
description: Use when debugging the Signatures (e-signatures / PAdES) module. Spec at docs/product-specs/20-signatures.md. Covers document signing workflow, PAdES-B/T/LT/LTA compliance, signature pads, certificate management, audit trail. Backend likely via signapps-docs or dedicated service.
---

# Signatures — Debug Skill

## Source of truth
**`docs/product-specs/20-signatures.md`**

## Key journeys
1. Upload document → add signature fields → send for signing
2. Signer opens link → draws/types signature → signs → audit logged
3. Verify signed PDF → PAdES validation passes
4. Multi-signer workflow → sequential signing order
5. Certificate management → upload X.509 cert

## Historique
- **2026-04-09** : Skill créé (skeleton).
