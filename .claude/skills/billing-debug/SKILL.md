---
name: billing-debug
description: Use when debugging the Billing (invoicing & payments) module. Spec at docs/product-specs/17-billing.md. Backend via signapps-billing (port 8096). Covers invoices, quotes, payments, subscriptions, tax management, Stripe/PayPal integration, PDF generation. Interacts with CRM (deal → invoice) and Contacts (client data).
---

# Billing — Debug Skill

## Source of truth
**`docs/product-specs/17-billing.md`**

## Code map
- **Backend**: `services/signapps-billing/` — port **8096**
- **Frontend**: `client/src/app/billing/`, components `client/src/components/billing/`
- **E2E**: 0 tests, 0 data-testids

## Key journeys
1. Create invoice → PDF generation → send to client
2. Create quote → client accepts → auto-convert to invoice
3. Record payment → invoice marked as paid
4. Subscription billing → recurring charge
5. Tax report export

## Dependencies
- **Stripe** API (proprietary, used as service) ✅
- **jspdf** or **pdf-lib** (MIT) for PDF generation ✅

## Historique
- **2026-04-09** : Skill créé (skeleton).
