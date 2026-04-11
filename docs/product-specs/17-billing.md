# Module Billing / Invoicing — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Stripe Billing** | API-first, subscription management, metered billing, revenue recognition, tax automation (Stripe Tax), Connect marketplaces, invoicing, dunning, recurring |
| **Chargebee** | Subscription management leader, trials, dunning, proration, tax handling multi-country, analytics, integration ERP |
| **QuickBooks Online** | Small business leader US, accounting + invoicing + expenses + payroll integration, estimates, projects, inventory |
| **Xero** | Alternative QuickBooks, accounting leader Australia/UK, bank feeds, payroll integration, inventory |
| **FreshBooks** | Simple invoicing SMB, time tracking, expenses, proposals, payments |
| **Wave** | Free invoicing et accounting, payments, payroll, bank connections |
| **Zoho Invoice** | Free invoicing, clients, time tracking, recurring, integration Zoho |
| **Harvest** | Time tracking + invoicing integrated, expense tracking, reports |
| **Pennylane** | France-focused, comptabilité + facturation + banques |
| **Sage** | Enterprise accounting, multi-country compliance |
| **Odoo Accounting** | Part of Odoo ERP, modular, self-hostable |
| **Invoice Ninja** | Open source self-hosted, clients, projects, expenses, payments |
| **Crater** | Open source simple invoicing |
| **Paymo** | Project management + time tracking + invoicing |

## Principes directeurs

1. **Pays-aware** — règles fiscales, formats de facture, devises, mentions légales adaptées au pays.
2. **Automatisation maximale** — factures récurrentes, relances automatiques, rapprochements bancaires.
3. **Multi-devise et TVA** — gestion correcte des taxes, de l'international et des remises.
4. **Intégration native** avec CRM (facturer un deal gagné), Tasks (time tracking), Drive (archiver factures).
5. **Conformité comptable** — numérotation continue, archivage légal, export pour logiciels comptables (Quickbooks, Sage, EBP).
6. **Client-facing** — portail client pour voir et payer ses factures.

---

## Catégorie 1 — Clients (customers pour facturation)

### 1.1 Fiche client facturation
Distincte du contact CRM mais synchronisée :
- Raison sociale
- Adresse de facturation
- Numéro TVA intracommunautaire
- Numéro SIRET / EIN / autre numéro légal
- Conditions de règlement (30/45/60/90 jours, comptant)
- Devise par défaut
- TVA par défaut
- Email de facturation
- Langue préférée

### 1.2 Création depuis contact CRM
Convertir un contact/entreprise du CRM en client facturable. Auto-remplissage des champs communs.

### 1.3 Import CSV
Import bulk de clients depuis un CSV.

### 1.4 Historique de facturation
Vue complète : toutes les factures émises, avoirs, paiements, impayés. Total dû, en retard, total facturé.

### 1.5 Rappels de paiement automatiques
Règles par client : première relance à J+7, deuxième à J+15, mise en demeure à J+30. Templates d'email.

### 1.6 Notes internes
Notes privées sur un client (ex: "demande toujours avoir la facture en double").

### 1.7 Fichiers joints
Documents liés : contrat, conditions particulières, bon de commande.

### 1.8 Multi-contacts par client
Plusieurs contacts au sein d'une entreprise : comptable, directeur, acheteur. Envois ciblés selon le rôle.

---

## Catégorie 2 — Produits et services

### 2.1 Catalogue de produits/services
Liste des items facturables avec :
- Nom
- Description
- Référence/SKU
- Prix HT
- TVA applicable
- Unité (heure, jour, pièce, mois)
- Image
- Catégorie

### 2.2 Produits récurrents (abonnements)
Items en abonnement : prix mensuel, trimestriel, annuel. Engagement minimum. Prorata automatique.

### 2.3 Tarification par palier (tiered pricing)
Prix dégressif selon la quantité (ex: 10€/unité pour 1-10, 8€ pour 11-50, 6€ pour 50+).

### 2.4 Pricing par usage (metered billing)
Facturation à l'usage (ex: 0.01€ par API call, 100MB gratuits puis 0.1€/GB). Traitement automatique en fin de mois.

### 2.5 Remises et promotions
- Remise fixe ou pourcentage
- Remise par client
- Coupons et codes promo
- Remises conditionnelles (à partir de X€)

### 2.6 Bundles
Groupement de plusieurs produits à un prix spécial.

### 2.7 Variations de produit
Options (taille, couleur, version) avec prix différents.

### 2.8 Multi-devise
Prix définis en plusieurs devises ou conversion automatique.

### 2.9 TVA par produit
Taux de TVA spécifique par produit (ex: 5.5% sur livres, 20% sur services, 10% sur restauration).

### 2.10 Import catalogue
Import CSV ou sync avec un ERP.

---

## Catégorie 3 — Devis (estimates)

### 3.1 Création de devis
Bouton `Nouveau devis` → sélection du client, ajout d'items du catalogue ou libres, calcul automatique total HT/TVA/TTC.

### 3.2 Template de devis
Templates personnalisables avec logo, conditions, mentions légales. Un ou plusieurs templates par entreprise.

### 3.3 Numérotation
Numérotation automatique des devis (ex: DEV-2026-001). Configurable.

### 3.4 Validité
Date de validité du devis. Expiration automatique.

### 3.5 Statut
Draft / Envoyé / Accepté / Refusé / Expiré.

### 3.6 Envoi par email
Envoi du devis en PDF joint ou lien vers une vue web. Template d'email configurable.

### 3.7 Acceptation par le client
Lien unique dans l'email permet au client de voir le devis en ligne et de l'accepter avec signature électronique. Statut passe à "Accepté".

### 3.8 Conversion en facture
Bouton `Convertir en facture` sur un devis accepté. Création de la facture avec les mêmes items. Statut du devis → "Facturé".

### 3.9 Révisions
Un devis peut être révisé. Historique des versions.

### 3.10 Notes et conditions
Conditions générales, conditions particulières, mentions obligatoires (délai, garantie, etc.).

### 3.11 Signature électronique intégrée
Signature on-screen ou via email. Archive du PDF signé.

### 3.12 Rappels automatiques
Si pas de réponse sous X jours, rappel automatique au client.

---

## Catégorie 4 — Factures

### 4.1 Création manuelle
`Nouvelle facture` → client, items, dates, taxes. Preview avant envoi.

### 4.2 Création depuis devis
One-click convert d'un devis accepté.

### 4.3 Création depuis un deal CRM
Depuis un deal gagné du CRM, bouton `Facturer` pré-remplit.

### 4.4 Création depuis timesheets
Pour la facturation horaire (consulting), générer une facture automatique depuis les timesheets d'un projet.

### 4.5 Numérotation légale
Numérotation continue, non modifiable (obligation légale en France). Reset annuel optionnel.

### 4.6 Champs obligatoires (conformité)
- Numéro
- Date de facture
- Date d'exécution
- Nom et adresse du vendeur
- Nom et adresse de l'acheteur
- Numéro TVA du vendeur
- Numéro TVA du client (si B2B intra-UE)
- Détail des items (désignation, quantité, prix unitaire HT, remise)
- Total HT, TVA (taux et montant), TTC
- Mentions légales (ex: "Pas d'escompte", "TVA non applicable art. 293B")
- Conditions de paiement
- Pénalités de retard

### 4.7 Statut de facture
Draft / Envoyée / Impayée / Partiellement payée / Payée / En retard / Annulée.

### 4.8 Envoi par email
Avec PDF en pièce jointe, ou lien vers vue web pour paiement en ligne.

### 4.9 Portail client
Lien unique pour le client pour voir ses factures, télécharger, payer en ligne.

### 4.10 Factures récurrentes
Facturation automatique mensuelle/trimestrielle/annuelle. Templates avec variables.

### 4.11 Prorata
Calcul automatique du prorata pour les abonnements qui commencent en cours de mois.

### 4.12 Remises et avoirs
- **Avoir (credit note)** : facture négative pour remboursement
- **Remise** : pourcentage ou fixe sur la facture entière ou un item

### 4.13 Rappels automatiques (dunning)
Workflow de relances pour les factures impayées :
- J+7 : 1er rappel poli
- J+14 : 2ème rappel ferme
- J+30 : Mise en demeure
- J+45 : Escalade juridique

### 4.14 Export PDF
Génération du PDF avec template, logo, QR code pour paiement.

### 4.15 Impression
Option d'imprimer directement.

### 4.16 Multi-language
Factures en plusieurs langues selon la langue du client.

### 4.17 Duplication
Dupliquer une facture pour en créer une nouvelle similaire.

### 4.18 Annulation (facture d'annulation)
Créer une facture d'annulation (avec numéro propre) qui annule une facture précédente. La facture originale reste dans le système pour traçabilité.

---

## Catégorie 5 — Paiements

### 5.1 Modes de paiement supportés
- Virement bancaire (IBAN affiché)
- Carte bancaire (Stripe, PayPal, autre gateway)
- Prélèvement SEPA
- PayPal
- Apple Pay / Google Pay
- Crypto (optionnel)
- Chèque (enregistrement manuel)
- Espèces (enregistrement manuel)

### 5.2 Paiement en ligne
Bouton `Pay now` sur la vue web de la facture. Redirection vers le gateway de paiement (Stripe Checkout, PayPal). Confirmation automatique de la facture après paiement.

### 5.3 Paiement partiel
Le client peut payer une partie de la facture. Solde restant tracké.

### 5.4 Paiement multi-factures
Le client peut payer plusieurs factures en un seul paiement (checkout combiné).

### 5.5 Gateway integration
- **Stripe** : checkout, subscription, tax, invoicing
- **PayPal** : express checkout, subscriptions
- **Mollie** : Europe-friendly
- **GoCardless** : prélèvements SEPA
- **Adyen** : enterprise
- **Square** : in-person

### 5.6 Autoreconciliation bancaire
Import des transactions bancaires et rapprochement automatique avec les factures par montant et référence.

### 5.7 Paiement par prélèvement automatique
Autorisation SEPA mandate. Prélèvement automatique à l'échéance.

### 5.8 Paiements manuels
Enregistrer un paiement manuel (chèque, virement vu sur relevé) : date, montant, mode, référence.

### 5.9 Reçus
Émettre un reçu après paiement. Envoyé automatiquement par email.

### 5.10 Historique des paiements
Liste de tous les paiements reçus avec date, montant, mode, facture(s) liée(s).

### 5.11 Remboursements
Lancer un remboursement depuis une facture/paiement. Génération d'un avoir automatique.

### 5.12 Échecs de paiement
Si un paiement échoue (carte refusée, compte insuffisant), notification et retry automatique selon règle.

---

## Catégorie 6 — Abonnements (subscriptions)

### 6.1 Plans et pricing
Définir des plans (ex: `Basic 29€/mois`, `Pro 99€/mois`, `Enterprise sur devis`). Options multiples.

### 6.2 Trial periods
Essai gratuit avec date de fin. Conversion automatique en abonnement payant.

### 6.3 Engagement minimum
Période minimale (ex: 12 mois engagement). Résiliation possible avec frais de rupture.

### 6.4 Upgrade / Downgrade
Client peut changer de plan. Prorata automatique, crédit ou facturation complémentaire.

### 6.5 Add-ons
Options optionnelles ajoutables à un abonnement (ex: utilisateurs supplémentaires, storage additionnel).

### 6.6 Cancellation
Annulation de l'abonnement. Options : immédiate, à la fin de la période, différée.

### 6.7 Pause subscription
Pause temporaire pour X mois. Reprise automatique.

### 6.8 Dunning
Si un paiement d'abonnement échoue, workflow : retry J+3, J+7, J+14, puis downgrade/cancel selon policy.

### 6.9 Churn prevention
Avant l'annulation, proposition de downgrade, de remise, ou de pause pour éviter la perte.

### 6.10 Renewal alerts
Alerte X jours avant la fin d'un contrat pour relance.

### 6.11 Subscription analytics
MRR (Monthly Recurring Revenue), ARR (Annual), churn rate, LTV (Lifetime Value), CAC payback.

### 6.12 Usage-based billing
Pour les modèles à l'usage, collecte des métriques et facturation automatique en fin de période.

### 6.13 Coupons et remises
Codes promo applicables aux abonnements (first month free, 20% pendant 3 mois, etc.).

---

## Catégorie 7 — Taxes et conformité

### 7.1 TVA multi-taux
Support des taux de TVA par pays et par produit. France : 20%, 10%, 5.5%, 2.1%. UE : selon pays de destination.

### 7.2 TVA intracommunautaire
Auto-liquidation pour les ventes B2B intra-UE avec numéro TVA valide du client. Mention obligatoire sur la facture.

### 7.3 VAT number validation
Vérification du numéro TVA client via VIES (Europe) ou autre service.

### 7.4 Taxes locales (multi-country)
- **UE** : TVA par pays selon règles OSS/IOSS
- **US** : sales tax par état (TaxJar, Avalara integration)
- **UK** : VAT post-Brexit
- **Canada** : GST/HST/PST
- **Australie** : GST

### 7.5 Automatic tax calculation
Calcul automatique selon l'adresse du client. Règles OSS (One Stop Shop) pour l'EU.

### 7.6 Exemptions
Certains clients sont exemptés (ex: associations, export hors UE). Tag et règle appliquée.

### 7.7 Rapports fiscaux
- **Déclaration TVA mensuelle/trimestrielle** : pré-remplie avec les montants collectés
- **DES** (Déclaration Européenne de Services)
- **DEB** (Déclaration d'Échanges de Biens)
- **OSS return**

### 7.8 Tax archive
Archive légale des factures pendant 10 ans minimum (obligation fiscale française).

### 7.9 Numérotation continue (obligation légale)
Numérotation des factures sans trou, sans doublon, sans modification possible après émission.

### 7.10 Conformité Factur-X / ZUGFeRD
Format hybride PDF+XML pour la facturation électronique. Obligatoire en France pour B2B à partir de 2026-2027.

### 7.11 Chorus Pro (France)
Intégration avec la plateforme de facturation publique française.

### 7.12 PEPPOL (Europe)
Support du réseau PEPPOL pour la facturation inter-entreprises en Europe.

---

## Catégorie 8 — Comptabilité et exports

### 8.1 Export comptable (Sage, EBP, Quickbooks, Xero)
Export au format attendu par les logiciels comptables pour intégration dans la comptabilité de l'entreprise.

### 8.2 Plan comptable
Mapping des produits vers les comptes du Plan Comptable Général (PCG) français ou équivalent.

### 8.3 Journal des ventes
Export mensuel des factures comme journal comptable.

### 8.4 Export FEC (Fichier des Écritures Comptables)
Format obligatoire en France pour les contrôles fiscaux. Export annuel.

### 8.5 Compte de résultat
Calcul automatique du chiffre d'affaires, marge, résultat.

### 8.6 Bilan simplifié
Dashboard avec créances clients, dettes fournisseurs, trésorerie estimée.

### 8.7 Cash flow
Prévision de trésorerie basée sur les factures émises et leurs dates d'échéance.

### 8.8 Lettrage
Rapprochement des paiements avec les factures pour la comptabilité.

### 8.9 Grand livre
Vue détaillée des mouvements par compte.

### 8.10 Balance
Vue de l'état des comptes à une date donnée.

---

## Catégorie 9 — Notes de frais (expenses)

### 9.1 Saisie d'une note de frais
Employee remplit : date, catégorie (transport, repas, hôtel, matériel), montant HT/TVA/TTC, fournisseur, description, justificatif (photo).

### 9.2 Scan de reçu (OCR)
Photo du reçu par l'app mobile → OCR → pré-remplissage des champs automatique.

### 9.3 Catégories custom
Admin définit les catégories (ex: "Formation", "Client A - déplacements", "Matériel informatique").

### 9.4 Approbation
Workflow d'approbation : manager → RH → compta. Chaque étape peut approuver/refuser.

### 9.5 Remboursement
Une fois approuvée, la note est intégrée dans la paye ou payée séparément.

### 9.6 Rapport de frais
Compilation de plusieurs notes en un rapport (par mois, par mission).

### 9.7 Mileage tracking
Suivi des kilomètres parcourus (voiture personnelle) avec calcul automatique de l'indemnité.

### 9.8 Per diem
Indemnités journalières forfaitaires pour les déplacements longs.

### 9.9 Policy rules
Limites configurables par catégorie (ex: "pas de repas > 25€", "hotel max 150€/nuit"). Alertes au dépassement.

### 9.10 Carte de crédit corporate
Intégration avec les cartes d'entreprise. Import automatique des transactions pour création des notes.

---

## Catégorie 10 — Rapports et analytics

### 10.1 Dashboard financier
KPIs : CA du mois, CA year-to-date, créances clients, factures en retard, taux de paiement à l'heure, prévision trésorerie.

### 10.2 Rapports standards
- CA par mois / trimestre / année
- CA par client
- CA par produit/service
- CA par commercial (si CRM lié)
- Taux de paiement
- Délai moyen de paiement
- Créances en retard
- Taux de conversion devis → facture

### 10.3 Rapports personnalisés
Builder visuel pour créer ses rapports.

### 10.4 Export
CSV, PDF, Excel.

### 10.5 Graphiques
Graphiques visuels : évolution du CA, répartition par client, cash flow.

### 10.6 Goals financiers
Objectifs de CA mensuels/annuels. Tracking.

### 10.7 Top clients
Liste des top clients par CA, par marge.

### 10.8 Profitability par projet
Pour le consulting, marge par projet (CA - temps passé × taux).

### 10.9 Aging report
Factures impayées groupées par ancienneté (< 30j, 30-60j, 60-90j, > 90j).

### 10.10 Forecast
Prévision du CA basée sur le pipeline CRM et les factures récurrentes.

---

## Catégorie 11 — Intégrations

### 11.1 CRM
Facturer un deal gagné depuis le CRM. Factures liées au deal.

### 11.2 Tasks (time tracking)
Générer une facture depuis les timesheets d'un projet.

### 11.3 Contacts
Clients facturation = contacts CRM avec flag "facturable".

### 11.4 Drive
Archive des factures PDF dans le drive.

### 11.5 Mail
Envoi des factures par email via le module Mail. Suivi des ouvertures.

### 11.6 Stripe / PayPal / Mollie / GoCardless
Gateways pour le paiement en ligne.

### 11.7 Banque
- **Bank feeds** : import automatique des transactions (via API Open Banking ou PSD2)
- **Exemples** : Plaid, Fintecture, Budget Insight

### 11.8 Comptables externes
Export vers Sage, EBP, Quickbooks, Xero, Pennylane.

### 11.9 Zapier / Make
Triggers et actions pour les intégrations tierces.

### 11.10 API REST
API complète pour CRUD factures, clients, produits, paiements, abonnements.

### 11.11 Webhooks
Events : facture créée, payée, en retard, abonnement cancelled, etc.

### 11.12 Chorus Pro
Intégration pour la facturation aux administrations publiques françaises.

---

## Catégorie 12 — Portail client

### 12.1 Login client
Portal dédié où les clients peuvent se connecter avec email + password (ou magic link).

### 12.2 Liste des factures
Vue de toutes les factures émises pour le client. Statut de chacune.

### 12.3 Download PDF
Téléchargement direct des factures en PDF.

### 12.4 Paiement en ligne
Boutons pour payer directement les factures impayées.

### 12.5 Historique des paiements
Liste des paiements effectués.

### 12.6 Mise à jour des informations
Le client peut mettre à jour son adresse, email de facturation, coordonnées bancaires.

### 12.7 Abonnements actifs
Liste des abonnements avec possibilité d'upgrade/downgrade/cancel.

### 12.8 Downloadable documents
Autres documents liés : contrats, CGV, conditions particulières.

### 12.9 Support link
Lien vers le helpdesk pour questions de facturation.

### 12.10 Custom branding
Logo, couleurs, domaine custom du client.

---

## Sources d'inspiration

### Aides utilisateur publiques
- **Stripe Docs** (stripe.com/docs/billing) — subscriptions, tax, dunning, proration, API.
- **Chargebee Docs** (chargebee.com/docs) — SaaS billing leader, best practices.
- **QuickBooks Help** (quickbooks.intuit.com/support) — accounting + invoicing SMB.
- **Xero Central** (central.xero.com) — bank feeds, reporting, compliance.
- **FreshBooks Help** (support.freshbooks.com) — invoicing simple, time tracking.
- **France: Article 289 CGI** (bofip.impots.gouv.fr) — mentions légales factures France.
- **Factur-X / ZUGFeRD Spec** (ferd-net.de) — format facture électronique.
- **Chorus Pro** (chorus-pro.gouv.fr) — documentation.
- **PEPPOL** (peppol.org) — interopérabilité européenne.

### Projets open source permissifs
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL**

| Projet | Licence | Ce qu'on peut étudier |
|---|---|---|
| **Invoice Ninja** (invoiceninja.com) | **AAL / Elastic 2** | **INTERDIT**. Pas open source au sens OSI. |
| **Crater** (craterapp.com) | **AAL 1.0** | **INTERDIT**. |
| **Kill Bill** (killbill.io) | **Apache-2.0** | **OK**. Billing backend enterprise. **À étudier**. |
| **ERPNext / Frappe** | **GPL v3** | **INTERDIT**. |
| **Odoo Community** | **LGPL v3** | **Weak copyleft** OK consommateur. Modules accounting/invoicing. |
| **Akaunting** (akaunting.com) | **GPL v3** | **INTERDIT**. |
| **Furious** | Various | Pour inspiration. |
| **phpinvoice** | **MIT** | Génération de factures PDF PHP. |
| **pdfmake** (pdfmake.org) | **MIT** | Génération PDF en JS. |
| **pdf-lib** | **MIT** | Alternative génération PDF. |
| **jsPDF** | **MIT** | Génération PDF. |
| **puppeteer** (pptr.dev) | **Apache-2.0** | Génération PDF headless Chrome. |
| **Factur-X Node/PHP libs** | Various | Génération Factur-X. |
| **Stripe Node SDK** | **MIT** | SDK Stripe officiel. |
| **PayPal Checkout JS SDK** | **Apache-2.0** | SDK PayPal officiel. |
| **currency.js** (currency.js.org) | **MIT** | Arithmétique monétaire sans float errors. |
| **dinero.js** (dinerojs.com) | **MIT** | Alternative pour les montants. |
| **VIES SOAP client** | Various | Validation VAT intra-EU. |
| **Tantivy / MeiliSearch** | **MIT** | Full-text search sur factures. |

### Pattern d'implémentation recommandé
1. **Stockage** : signapps-db avec tables `customers`, `invoices`, `invoice_items`, `payments`, `subscriptions`, `tax_rates`, `products`.
2. **Calculs monétaires** : `dinero.js` (MIT) ou `currency.js` (MIT) pour éviter les erreurs de float. Côté Rust : `rust_decimal` (MIT).
3. **Génération PDF** : `pdf-lib` (MIT) pour le côté client/serveur Node, ou Puppeteer (Apache-2.0) pour du rendu HTML → PDF fidèle.
4. **Templates de facture** : HTML + CSS rendu en PDF. Plusieurs templates au choix.
5. **Paiements** : Stripe SDK (MIT), PayPal SDK (Apache-2.0) comme intégrations principales.
6. **Subscription management** : logique custom ou wrapper sur Stripe Billing (qui gère beaucoup).
7. **Validation VAT** : client SOAP custom vers VIES (service gratuit Commission Européenne).
8. **Factur-X** : génération custom XML + embed dans PDF, ou library existante.
9. **Export comptable** : générateurs custom par format (CSV, FEC, XML pour Sage).
10. **Bank feeds** : intégration Plaid (US), Tink (Europe), Fintecture (France).
11. **Time tracking pour facturation** : timesheets du module Tasks ou saisie directe.
12. **Dunning** : workflow engine avec triggers time-based.

### Ce qu'il ne faut PAS faire
- **Pas de fork** de Akaunting, Invoice Ninja, ERPNext (tous GPL/AAL/Elastic).
- **Pas de float pour les montants** — toujours decimal ou integer (centimes).
- **Pas d'invoice sans numérotation continue** — obligation légale.
- **Pas de modification d'une facture émise** — créer un avoir à la place.

---

## Assertions E2E clés (à tester)

- Création d'un client facturation
- Création d'un produit dans le catalogue
- Création d'un devis
- Envoi du devis au client par email
- Acceptation d'un devis par le client (signature)
- Conversion devis → facture
- Création d'une facture manuelle
- Génération PDF fidèle
- Envoi de facture par email
- Calcul automatique TVA multi-taux
- Validation numéro TVA intracommunautaire
- Paiement en ligne via Stripe
- Enregistrement d'un paiement manuel
- Facture partiellement payée
- Facture récurrente (mensuelle) générée automatiquement
- Rappel automatique sur facture en retard
- Création d'un avoir (credit note)
- Abonnement avec trial et conversion
- Upgrade/Downgrade d'abonnement
- Cancel d'abonnement
- Portal client : voir factures
- Paiement par le client via portal
- Export comptable (Sage / Quickbooks)
- Export FEC
- Import des transactions bancaires
- Lettrage automatique
- Dashboard financier avec KPIs
- Rapport TVA mensuel
- Note de frais soumise et approuvée
- OCR d'un reçu photo
- Intégration Factur-X
