# Module Expenses (Notes de frais) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Expensify** | SmartScan OCR (photo du recu → extraction auto montant/date/vendeur), approbation workflow multi-niveaux, integration comptabilite (QuickBooks, Xero, NetSuite), rapports de depenses, carte corporate, per diem, kilometrage, multi-devise |
| **SAP Concur** | Enterprise-grade, politique de depenses automatisee, integration ERP SAP, audit automatique (doublons, hors-politique), e-receipts, approbation workflow complexe, analytics, conformite fiscale multi-pays |
| **Ramp** | Carte corporate avec controles en temps reel, auto-categorisation IA, rapports instantanes, integration comptabilite, blocage avant la depense (budgets par departement/personne), fermeture de mois automatique |
| **Brex** | Carte corporate, limites par employe/departement, auto-matching recu+transaction, approbation conditionnelle, integration multi-ERP, budgets de voyage, depenses recurrentes, analyse de spend |
| **Spendesk** | Cartes virtuelles a usage unique, demandes de depenses pre-approuvees, workflow approbation configurable, OCR recu, integration comptable (Sage, Cegid, Xero), budgets par equipe, analytics temps reel |
| **Payhawk** | Carte corporate + gestion des depenses + facturation fournisseurs, OCR multi-langue, auto-categorisation, regles de conformite, multi-entite, multi-devise, integration ERP, approbation mobile |
| **Zoho Expense** | OCR recu, auto-scan email pour detecter les recus, approbation multi-niveaux, integration Zoho Books/QuickBooks, politique de depenses, per diem, kilometrage GPS, rapports personnalisables |
| **Jenji** | Specifique marche francais, OCR certifie NF203, archivage a valeur probante, TVA auto-detectee, politique de depenses, approbation, integration paie/comptabilite, conformite URSSAF |

## Principes directeurs

1. **Capture du recu en priorite** — le parcours principal est : scanner un recu (photo ou upload) → l'IA extrait montant, date, vendeur, categorie → l'utilisateur valide et soumet. La saisie manuelle est le fallback, pas le defaut.
2. **Workflow d'approbation transparent** — chaque note de frais suit un cycle de vie clair : Brouillon → Soumis → Approuve/Rejete → Paye. L'employe voit toujours le statut en temps reel. Le manager peut approuver depuis une notif mobile.
3. **Auto-approbation sous seuil** — les depenses sous un montant configurable (par defaut 50 EUR) sont automatiquement approuvees pour reduire la friction administrative.
4. **KPIs financiers en un coup d'oeil** — trois metriques en haut de page : total depense, total approuve/rembourse, total en attente. Permet au collaborateur et au manager de piloter les enveloppes.
5. **Categorisation et conformite** — chaque depense est categorisee (Transport, Repas, Hotel, Fournitures, Autre). Les categories alimentent les rapports comptables et la conformite fiscale.
6. **Integration facturation** — les depenses approuvees peuvent etre exportees vers le module Billing pour remboursement ou refacturation client.

---

## Categorie 1 — Capture et creation de notes de frais

### 1.1 Scanner un recu (OCR IA)
Bouton `Scanner un recu` ouvre un input file (camera sur mobile, upload sur desktop). Le fichier (image ou PDF) est envoye a signapps-ai pour extraction OCR. Les champs montant, date, vendeur, categorie sont pre-remplis dans le formulaire. L'utilisateur corrige si necessaire.

### 1.2 Formulaire de creation
Dialogue modal avec les champs : Montant (EUR, 2 decimales), Date (datepicker), Fournisseur (texte libre), Categorie (select : Transport, Repas, Hotel, Fournitures, Autre — extensible par l'admin), Description (textarea optionnel), Image du recu (preview si scanne).

### 1.3 Creation rapide sans recu
Pour les depenses sans recu (parking, pourboire), creation manuelle directe. Le champ recu est optionnel. L'absence de recu est flaggee visuellement pour l'auditeur.

### 1.4 Depenses recurrentes
Template de depense recurrente (abonnement transport, forfait telephone). L'utilisateur cree un template avec montant, categorie, frequence. La depense est auto-generee chaque mois en brouillon.

### 1.5 Multi-devise
Champ devise optionnel (EUR par defaut). Conversion automatique au taux du jour via API de change. Le montant original et le montant converti sont conserves.

### 1.6 Kilometrage
Mode specifique pour les deplacements vehicule. Saisie des km parcourus, tarif au km (configurable, par defaut bareme URSSAF), calcul automatique du montant. Champs depart/arrivee optionnels.

---

## Categorie 2 — Tableau de bord et KPIs

### 2.1 Total depense
Carte KPI affichant la somme de toutes les notes de frais (tous statuts confondus). Periode configurable (mois en cours, trimestre, annee).

### 2.2 Total approuve / rembourse
Carte KPI affichant la somme des notes approuvees ou payees. Couleur verte.

### 2.3 Total en attente
Carte KPI affichant la somme des notes soumises en attente d'approbation. Couleur bleue.

### 2.4 Total rejete
Indicateur secondaire des notes rejetees avec motif. Couleur rouge. Lien vers le filtre `Rejete`.

### 2.5 Graphique mensuel
Bar chart des depenses par mois avec empilement par categorie. Permet de visualiser l'evolution et la repartition des couts.

### 2.6 Repartition par categorie
Pie chart ou bar chart horizontal montrant la ventilation par categorie (Transport, Repas, Hotel, etc.). Clickable pour filtrer.

---

## Categorie 3 — Liste et filtrage

### 3.1 Table des depenses
Tableau avec colonnes : Date, Fournisseur, Description, Categorie, Montant, Statut, Actions. Tri par colonne. Pagination.

### 3.2 Filtres par statut
Boutons-onglets en haut de la table : Tous, Brouillon, En attente, Approuve, Rejete, Paye. Compteur par statut. Le filtre actif est highlight.

### 3.3 Recherche
Barre de recherche full-text sur fournisseur, description, montant. Filtrage en temps reel.

### 3.4 Filtre par periode
Datepicker range (du/au) pour restreindre la vue a une periode. Presets : Cette semaine, Ce mois, Ce trimestre, Cette annee.

### 3.5 Filtre par categorie
Multi-select sur les categories pour affiner la liste. Combinable avec les autres filtres.

### 3.6 Badge de statut avec icone
Chaque statut a un badge colore avec icone : Brouillon (gris, horloge), En attente (bleu, envoi), Approuve (vert, check), Rejete (rouge, croix), Paye (violet, dollar). Le commentaire d'approbation/rejet est affiche en tooltip.

---

## Categorie 4 — Workflow d'approbation

### 4.1 Soumission
L'employe clique `Soumettre` sur une note en brouillon. Le statut passe a `En attente` (submitted). Le manager recoit une notification (push + email).

### 4.2 Auto-approbation sous seuil
Si le montant est inferieur au seuil configurable (defaut 50 EUR), la note passe directement a `Approuve` avec commentaire automatique `Auto-approuve (montant < seuil)`.

### 4.3 Decision du manager
Le manager ouvre la note en attente. Vue detaillee avec recu, montant, categorie, description. Deux boutons : `Approuver` (vert) et `Rejeter` (rouge). Champ commentaire optionnel pour justifier la decision.

### 4.4 Approbation multi-niveaux
Pour les montants eleves (configurable), double approbation requise : manager direct puis directeur financier. La note passe par `En attente N1` → `En attente N2` → `Approuve`.

### 4.5 Paiement
Apres approbation, le module peut marquer la note comme `Paye` (manuellement ou via integration avec le module Billing/paie). Le collaborateur est notifie du remboursement.

### 4.6 Politique de depenses
Regles configurables par l'admin : plafond par categorie, plafond mensuel global, obligation de recu au-dela de X EUR, categories autorisees par role. Non-conformite = avertissement a la soumission.

---

## Categorie 5 — Export et integration

### 5.1 Export CSV/Excel
Export de la liste filtree en CSV ou XLSX. Colonnes : date, fournisseur, categorie, description, montant, devise, statut, commentaire approbation.

### 5.2 Export PDF rapport
Rapport PDF formate avec en-tete (collaborateur, periode, totaux), tableau detaille, et repartition par categorie. Utile pour la comptabilite.

### 5.3 Integration Billing
Les notes approuvees peuvent etre poussees vers le module Billing (signapps-billing port 8096) pour remboursement. Mapping automatique categorie → compte comptable.

### 5.4 Integration calendrier
Les deplacements professionnels lies a une depense de transport/hotel peuvent apparaitre dans le calendrier SignApps.

### 5.5 API REST
Endpoints : `GET /api/v1/expenses` (liste paginee avec filtres), `POST` (creation), `PUT/:id` (mise a jour), `DELETE/:id` (suppression brouillon uniquement), `POST/:id/submit` (soumission), `POST/:id/approve` (approbation), `POST/:id/reject` (rejet).

### 5.6 Archivage a valeur probante
Les recus scannes et les notes approuvees sont archivees avec horodatage et signature numerique. Conformite NF203 et URSSAF pour le marche francais.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Expensify Help** (use.expensify.com/help) — SmartScan, workflow, integrations, rapports.
- **Spendesk Blog** (blog.spendesk.com) — bonnes pratiques notes de frais, conformite, workflow.
- **SAP Concur Documentation** (www.concurtraining.com) — guides utilisateur, administrateur, API.
- **Zoho Expense Help** (www.zoho.com/expense/help) — OCR, approbation, politique, rapports.
- **URSSAF** (urssaf.fr) — bareme kilometrique, regles de remboursement de frais professionnels.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Actual Budget** (github.com/actualbudget/actual) | **MIT** | Gestion budgetaire locale-first. Pattern pour la categorisation, les rapports financiers, l'offline-first. |
| **Invoice Ninja** (github.com/invoiceninja/invoiceninja) | **AAL (Elastic)** | **INTERDIT** — reference pedagogique uniquement via docs publiques. Pattern depenses/factures. |
| **Crater** (github.com/crater-invoice/crater) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Facturation + depenses. |
| **Firefly III** (github.com/firefly-iii/firefly-iii) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Categorisation financiere. |
| **Maybe** (github.com/maybe-finance/maybe) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. UI finance. |
| **tesseract.js** (github.com/naptha/tesseract.js) | **Apache-2.0** | OCR cote client en JavaScript. Pattern pour l'extraction de texte depuis les recus (fallback local). |
| **date-fns** (github.com/date-fns/date-fns) | **MIT** | Manipulation de dates. Deja utilise dans SignApps pour le formatage. |
| **recharts** (github.com/recharts/recharts) | **MIT** | Graphiques React pour les KPIs et rapports visuels. |

---

## Assertions E2E cles (a tester)

- Cliquer `Nouvelle note` → le dialogue de creation s'ouvre avec les champs vides
- Remplir montant + date + fournisseur, sauvegarder → la note apparait dans la table avec statut `Brouillon`
- Scanner un recu (upload image) → les champs sont pre-remplis par l'OCR IA
- Soumettre une note de frais < seuil → auto-approuvee avec commentaire automatique
- Soumettre une note de frais > seuil → statut passe a `En attente`
- Manager approuve une note → statut `Approuve`, commentaire visible, employe notifie
- Manager rejette une note → statut `Rejete`, commentaire de rejet visible
- Filtrer par statut `En attente` → seules les notes en attente apparaissent
- KPI `Total` → somme correcte apres ajout d'une depense
- KPI `En attente` → ne compte que les notes soumises non traitees
- Supprimer une note en brouillon → elle disparait de la liste
- Export CSV → fichier telecharge avec toutes les colonnes
- Filtre par categorie `Transport` → seules les depenses transport apparaissent
- Filtre par date range → seules les depenses dans la periode apparaissent
