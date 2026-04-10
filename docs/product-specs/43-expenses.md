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
Bouton `Scanner un recu` en haut de la page (bouton primary, pleine largeur sur mobile, icone camera). Clic ouvre un input file avec accept `image/*, application/pdf`. Sur mobile, ouvre directement la camera (`capture="environment"` pour la camera arriere). Le fichier (image JPEG/PNG ou PDF d'une page) est envoye a signapps-media (port 3009) via `POST /api/v1/media/ocr/receipt` avec le fichier en multipart. Le service media utilise sa capacite OCR native pour extraire les champs structurels du recu.

Pendant le traitement (1-5 secondes), un spinner s'affiche avec le texte `Analyse du recu en cours...` et une barre de progression indeterminee. Le resultat de l'OCR pre-remplit le formulaire :
- **Montant** : nombre avec 2 decimales (extrait du total TTC du recu)
- **Devise** : detectee depuis le symbole de monnaie (EUR par defaut)
- **Date** : date de la transaction
- **Fournisseur** : nom du commercant/entreprise
- **Categorie** : suggestion basee sur le type de commercant (restaurant → Repas, station service → Transport, etc.)
- **TVA** : montant et taux de TVA si detectable (20%, 10%, 5.5%, 2.1% pour la France)

Chaque champ pre-rempli est affiche avec un badge `IA` bleu a cote, indiquant qu'il a ete extrait automatiquement. L'utilisateur corrige si necessaire. Score de confiance affiche en pourcentage (ex: `Confiance : 92%`). Si la confiance est < 70%, un avertissement `Verifiez attentivement les champs extraits` s'affiche.

**Endpoint backend :**
```
POST /api/v1/media/ocr/receipt
Content-Type: multipart/form-data
Body: file (image/png, image/jpeg, application/pdf)
Response: {
  "amount": 42.50,
  "currency": "EUR",
  "date": "2026-04-07",
  "vendor": "Restaurant Le Bon Vivant",
  "category_suggestion": "meals",
  "vat_amount": 7.08,
  "vat_rate": 20.0,
  "confidence": 0.92,
  "raw_text": "..."
}
```

### 1.2 Formulaire de creation
Dialogue modal (500px max-width) avec les champs :
- **Montant** (input numerique, 2 decimales, obligatoire) — affiche le symbole de devise a gauche
- **Devise** (select, defaut EUR, options : EUR, USD, GBP, CHF, CAD, + 20 devises courantes)
- **Date** (datepicker, defaut aujourd'hui, ne peut pas etre dans le futur au-dela de demain)
- **Fournisseur** (input texte, obligatoire, max 200 caracteres, autocompletion sur les fournisseurs precedents)
- **Categorie** (select obligatoire) :
  - `transport` — Transport (avion, train, taxi, carburant, peage)
  - `meals` — Repas
  - `hotel` — Hebergement
  - `supplies` — Fournitures de bureau
  - `telecom` — Telephone / Internet
  - `subscriptions` — Abonnements
  - `travel` — Deplacements (hors transport)
  - `representation` — Frais de representation
  - `other` — Autre
  - Categories custom ajoutees par l'admin
- **Sous-categorie** (select conditionnel, visible si la categorie en a — ex: Transport → Avion/Train/Taxi/Carburant/Peage)
- **Description** (textarea optionnel, max 500 caracteres)
- **TVA** : montant (input numerique) + taux (select : 0%, 2.1%, 5.5%, 10%, 20%, custom)
- **Justificatif** (preview de l'image si scannee, bouton pour en ajouter/changer, optionnel mais flagge si absent)
- **Projet** (select optionnel — pour la refacturation client)
- **Client** (select optionnel — pour la refacturation)

Bouton `Sauvegarder en brouillon` (gris) et `Sauvegarder et soumettre` (primary). Le premier cree la depense en statut `draft`, le second la cree et la soumet directement.

### 1.3 Creation rapide sans recu
Bouton `+ Nouvelle depense` ouvre le formulaire vide (sans scan prealable). Le champ justificatif est optionnel. L'absence de justificatif est flaggee visuellement : badge orange `Sans justificatif` sur la depense dans la table. Les politiques d'entreprise peuvent rendre le justificatif obligatoire au-dela d'un certain montant (configurable, defaut 25 EUR).

### 1.4 Depenses recurrentes
Bouton `+ Depense recurrente` ouvre un formulaire de template. Champs : montant, fournisseur, categorie, frequence (select : `Mensuel`, `Trimestriel`, `Annuel`), date de debut, date de fin (optionnel). Exemples : abonnement transport mensuel, forfait telephone. Le systeme genere automatiquement une depense en statut `draft` chaque mois/trimestre/an a la date configuree. L'employe la valide et la soumet. PgEventBus event `expenses.recurring.generated { expense_id, template_id, user_id }`.

### 1.5 Multi-devise avec conversion
Si la devise selectionnee est differente de la devise de reference de l'organisation (EUR par defaut), le systeme affiche un champ supplementaire : **Taux de change** (pre-rempli via API de change `GET /api/v1/billing/exchange-rate?from=USD&to=EUR&date=2026-04-07`) et **Montant converti** (calcule automatiquement). Les deux montants sont conserves en base : `amount` (montant original), `amount_currency` (devise originale), `converted_amount` (montant en devise de reference), `exchange_rate` (taux utilise). Le montant converti est utilise pour les KPIs et rapports.

### 1.6 Kilometrage
Mode specifique active via le menu `Type de depense > Kilometrage` dans le formulaire. Champs specifiques :
- **Distance** (input numerique en km, obligatoire)
- **Tarif au km** (pre-rempli avec le bareme en vigueur — defaut bareme URSSAF selon puissance fiscale du vehicule)
- **Puissance fiscale** (select : 3CV, 4CV, 5CV, 6CV, 7CV+, pre-rempli depuis le profil utilisateur)
- **Depart** (input texte, optionnel)
- **Arrivee** (input texte, optionnel)
- **Aller-retour** (checkbox — double la distance si coche)
- **Montant** : calcul automatique `distance * tarif_km * (2 si aller-retour)`, non editable

Le bareme kilometrique est configurable par l'admin (`Settings > Expenses > Bareme kilometrique`). Stockage du bareme dans la table `expense_mileage_rates`.

### 1.7 Per diem (indemnites forfaitaires)
Mode specifique pour les deplacements avec forfaits journaliers. Champs :
- **Destination** (input texte, obligatoire)
- **Date debut** / **Date fin** (datepickers, obligatoires)
- **Type de sejour** : France, Europe, Hors-Europe (le forfait change selon la zone)
- **Forfait jour** (pre-rempli selon la zone et la politique, editable)
- **Nombre de jours** (calcule automatiquement depuis les dates)
- **Montant** : calcul automatique `forfait * jours`

Les baremes per diem sont configurables par l'admin. Stockage dans `expense_per_diem_rates`.

---

## Categorie 2 — Tableau de bord et KPIs

### 2.1 Total depense
Carte KPI (premiere position). Icone portefeuille, label `Total depense`, valeur en format `X XXX,XX EUR` (police 24px, bold). Periode selectionnable : `Ce mois` (defaut), `Ce trimestre`, `Cette annee`, `Tout`. Sous-texte comparatif : `+15% vs mois dernier` ou `-8% vs mois dernier` avec fleche.

### 2.2 Total approuve / rembourse
Carte KPI (deuxieme position). Icone check-circle, label `Approuve / Rembourse`. Couleur verte. Valeur = somme des depenses avec statut `approved` ou `paid` dans la periode. Sous-texte : `dont X EUR rembourses`.

### 2.3 Total en attente
Carte KPI (troisieme position). Icone hourglass, label `En attente`. Couleur bleue. Valeur = somme des depenses avec statut `submitted`. Sous-texte : `X depenses en attente d'approbation`.

### 2.4 Total rejete
Carte KPI (quatrieme position). Icone x-circle, label `Rejete`. Couleur rouge/`destructive`. Valeur = somme des depenses rejetees dans la periode. Clic sur la carte filtre la table par statut `rejected`.

### 2.5 Graphique mensuel
Bar chart sous les KPIs (hauteur 220px, pleine largeur). Axe X : mois (12 derniers mois). Axe Y : montant en EUR. Barres empilees par categorie (couleurs distinctes par categorie). Tooltip au hover : `Avril 2026 : 1 234 EUR (Transport: 450, Repas: 380, Hotel: 250, Autres: 154)`. Ligne de tendance pointillee montrant la moyenne mobile sur 3 mois.

### 2.6 Repartition par categorie
Donut chart a droite du bar chart (200x200px). Segments colores par categorie. Centre du donut : montant total de la periode. Legende avec : pastille de couleur, nom de la categorie, montant, pourcentage. Clic sur un segment filtre la table par cette categorie.

---

## Categorie 3 — Liste et filtrage

### 3.1 Table des depenses
Tableau principal avec colonnes :
- **Date** — format `jj/mm/yyyy`. Triable.
- **Fournisseur** — nom tronque a 30 caracteres. Clic ouvre le detail.
- **Description** — apercu en 1 ligne, tronque, `text-muted-foreground`
- **Categorie** — badge avec pastille de couleur et label
- **Montant** — format `X XXX,XX EUR`. Gras. Triable.
- **TVA** — montant TVA si renseigne (sinon `—`)
- **Justificatif** — icone trombone si un fichier est attache (hover affiche la miniature), icone avertissement orange si absent
- **Statut** — badge colore (voir 3.6)
- **Actions** — boutons icones : editer, dupliquer, soumettre (si brouillon), supprimer (si brouillon)

Pagination 20 lignes par page. Tri par defaut : date decroissante. Lignes alternees zebra.

### 3.2 Filtres par statut
Boutons-onglets au-dessus de la table : `Tous` (compteur total), `Brouillon` (gris), `En attente` (bleu), `Approuve` (vert), `Rejete` (rouge), `Paye` (violet). Le filtre actif a un fond `primary` et texte blanc. Le compteur indique le nombre de depenses dans chaque statut.

### 3.3 Recherche
Barre de recherche full-text au-dessus des filtres. Recherche sur fournisseur, description, montant (format texte). Debounce 200ms. Highlight des termes trouves.

### 3.4 Filtre par periode
Datepicker range (du/au) a droite des filtres. Presets : `Cette semaine`, `Ce mois`, `Ce trimestre`, `Cette annee`, `Mois dernier`, `Trimestre dernier`, `Personnalise`.

### 3.5 Filtre par categorie
Multi-select sur les categories. Combinable avec les autres filtres.

### 3.6 Badge de statut avec icone
Chaque statut a un badge distinctif :
- `draft` — gris, icone horloge, label `Brouillon`
- `submitted` — bleu, icone envoi (fleche vers le haut), label `En attente`
- `approved` — vert, icone check, label `Approuve`
- `rejected` — rouge, icone croix, label `Rejete`
- `paid` — violet, icone dollar/euro, label `Rembourse`

Hover sur un badge `rejected` affiche le commentaire du manager en tooltip. Hover sur un badge `approved` affiche `Approuve par [Nom] le JJ/MM`.

---

## Categorie 4 — Rapport de depenses et workflow d'approbation

### 4.1 Rapport de depenses (expense report)
Un rapport de depenses groupe plusieurs depenses individuelles pour soumission groupee. Bouton `Creer un rapport` ouvre un dialogue : nom du rapport (texte, ex: `Deplacement Paris - Avril 2026`), description (optionnel). Le rapport est cree vide. L'utilisateur ajoute des depenses au rapport via un bouton `Ajouter au rapport` sur chaque depense en brouillon. Un rapport affiche : nom, nombre de depenses, montant total, statut, date de creation. Workflow de statut identique aux depenses individuelles (draft → submitted → approved → rejected → paid).

### 4.2 Soumission d'une depense individuelle
L'employe clique `Soumettre` sur une depense en brouillon. Validation prealable :
- Montant > 0 (erreur si non)
- Date renseignee (erreur si non)
- Fournisseur renseigne (erreur si non)
- Categorie renseignee (erreur si non)
- Justificatif present si montant > seuil configurable (avertissement, non bloquant)
- Pas de doublon detecte (avertissement si meme montant + meme date + meme fournisseur deja soumis)

Apres validation, statut passe a `submitted`. Le manager recoit une notification push + email. PgEventBus event `expenses.expense.submitted { expense_id, user_id, amount, category }`.

### 4.3 Auto-approbation sous seuil
Si le montant est inferieur au seuil configurable (defaut 50 EUR, configurable par l'admin de 0 a 500 EUR), la depense passe directement de `submitted` a `approved` avec commentaire automatique `Auto-approuve (montant < seuil de XX EUR)`. L'employe recoit un toast `Depense auto-approuvee`. Pas de notification au manager pour les auto-approbations. Le seuil est stocke dans `expense_policies`.

### 4.4 Decision du manager
Le manager accede aux depenses en attente via un onglet `A approuver` dans la page Expenses (visible seulement pour les roles manager/admin). Table des depenses soumises par les membres de son equipe. Clic sur une depense ouvre un panneau detaille avec :
- Informations completes de la depense
- Preview du justificatif (image cliquable pour zoom plein ecran)
- Historique des actions (creation, modification, soumission)
- Alerte si hors-politique (montant > plafond categorie, categorie non autorisee pour ce role)

Deux boutons en bas : `Approuver` (vert) et `Rejeter` (rouge). L'approbation cree un commentaire optionnel. Le rejet requiert un commentaire obligatoire (min 10 caracteres, placeholder `Raison du rejet...`).

### 4.5 Approbation multi-niveaux
Pour les montants eleves (seuil configurable, defaut 500 EUR), double approbation requise :
- **N1** : manager direct approuve → statut `approved_n1`
- **N2** : directeur financier (ou role configure) approuve → statut `approved`

Si le manager N1 rejette, la depense est rejetee directement. Si le N2 rejette apres N1, la depense est rejetee. L'employe est notifie a chaque etape. Le seuil de double approbation est configurable dans `expense_policies`.

### 4.6 Paiement / Remboursement
Apres approbation, la depense peut etre marquee comme `paid` (remboursee). Action manuelle par le service comptabilite/finance via bouton `Marquer comme rembourse` avec date de remboursement et reference de virement. L'employe recoit une notification : `Votre depense "X" de XX EUR a ete remboursee`. Integration optionnelle avec le module Billing (signapps-billing port 8096) via PgEventBus event `expenses.expense.paid { expense_id, user_id, amount, payment_reference }`.

### 4.7 Politique de depenses
Regles configurables par l'admin dans `Settings > Expenses > Politique de depenses` :
- **Plafond par categorie** : montant maximum par depense pour chaque categorie (ex: Repas max 30 EUR)
- **Plafond mensuel global** : enveloppe mensuelle par employe (ex: 500 EUR/mois)
- **Obligation de justificatif** : au-dela de X EUR (defaut 25 EUR)
- **Categories autorisees par role** : certaines categories reservees a certains roles (ex: `representation` pour les commerciaux uniquement)
- **Delai de soumission** : nombre de jours max apres la date de la depense pour soumettre (defaut 90 jours)

Non-conformite = avertissement a la soumission (badge orange `Hors politique` avec detail). Le manager voit l'alerte lors de l'approbation. La soumission n'est pas bloquee (sauf si l'admin configure le mode strict).

---

## Categorie 5 — Export et integration

### 5.1 Export CSV/Excel
Bouton `Exporter` dans la barre d'actions avec options CSV et XLSX. Colonnes : date, fournisseur, categorie, sous-categorie, description, montant, devise, TVA montant, TVA taux, statut, commentaire approbation, projet, client, justificatif (URL). Les filtres actifs s'appliquent a l'export. Nom : `expenses_{user}_{date_debut}_{date_fin}.csv`.

### 5.2 Export PDF rapport
Rapport PDF formate avec :
- En-tete : logo entreprise, nom de l'employe, poste, departement, periode
- Resume : total depense, total approuve, total rejete, ventilation par categorie (mini bar chart)
- Tableau detaille de chaque depense avec date, fournisseur, categorie, montant, TVA, statut
- Annexes : miniatures des justificatifs (une par page si necessaire)
- Pied de page : date de generation, signature numerique

Utile pour la comptabilite et les audits fiscaux.

### 5.3 Export comptable
Export dans un format compatible avec les logiciels comptables. Format FEC (Fichier des Ecritures Comptables) pour la France. Mapping automatique categorie → compte comptable (configurable : `Settings > Expenses > Plan comptable`). Colonnes FEC : JournalCode, JournalLib, EcritureNum, EcritureDate, CompteNum, CompteLib, CompAuxNum, CompAuxLib, PieceRef, PieceDate, EcritureLib, Debit, Credit.

### 5.4 Integration Billing
Les depenses approuvees peuvent etre poussees vers le module Billing (signapps-billing port 8096) pour :
- **Remboursement employe** : cree une ligne de paie dans le module Workforce
- **Refacturation client** : si un projet et un client sont associes, cree une ligne de facture pour le client

PgEventBus event `expenses.export.billing { expense_ids, target: "reimbursement" | "client_invoice", project_id?, client_id? }`.

### 5.5 Integration calendrier
Les depenses de type transport/hotel avec des dates de deplacement creent optionnellement des evenements dans le calendrier (signapps-calendar port 3011). PgEventBus event `expenses.travel.created { expense_id, user_id, date_start, date_end, destination }`.

### 5.6 Archivage a valeur probante
Les justificatifs scannes et les depenses approuvees sont archivees avec :
- Horodatage qualifie (timestamp RFC 3161)
- Empreinte SHA-256 du fichier justificatif
- Signature numerique du document
- Metadonnees d'archivage (date, auteur, action)

Conformite NF203 et URSSAF pour le marche francais. Les fichiers archives ne peuvent pas etre modifies ou supprimes (immutabilite garantie). Duree de conservation : 10 ans (exigence fiscale francaise).

---

## Categorie 6 — Persistance et API

### 6.1 API REST complete

**Base path :** `/api/v1/expenses`

| Methode | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Liste paginee. Query params : `cursor`, `limit`, `status`, `category`, `date_from`, `date_to`, `project_id`, `search`, `sort_by`, `sort_order` |
| `GET` | `/:id` | Detail d'une depense |
| `POST` | `/` | Creer une depense. Body : `{ amount, currency?, date, vendor, category, subcategory?, description?, vat_amount?, vat_rate?, project_id?, client_id?, receipt_file? }` |
| `PUT` | `/:id` | Modifier une depense (brouillon uniquement) |
| `DELETE` | `/:id` | Supprimer (brouillon uniquement, soft-delete) |
| `POST` | `/:id/submit` | Soumettre pour approbation |
| `POST` | `/:id/approve` | Approuver (manager). Body : `{ comment? }` |
| `POST` | `/:id/reject` | Rejeter (manager). Body : `{ comment }` |
| `POST` | `/:id/mark-paid` | Marquer comme rembourse. Body : `{ payment_date, payment_reference? }` |
| `POST` | `/:id/receipt` | Upload justificatif (multipart/form-data) |
| `DELETE` | `/:id/receipt` | Supprimer le justificatif |
| `POST` | `/:id/duplicate` | Dupliquer une depense |
| `GET` | `/reports` | Liste des rapports de depenses |
| `POST` | `/reports` | Creer un rapport. Body : `{ name, description? }` |
| `POST` | `/reports/:id/add-expense` | Ajouter une depense au rapport. Body : `{ expense_id }` |
| `POST` | `/reports/:id/submit` | Soumettre le rapport |
| `GET` | `/stats` | KPIs. Query params : `period` (month, quarter, year) |
| `GET` | `/categories` | Liste des categories (incluant custom) |
| `POST` | `/categories` | Creer une categorie custom (admin) |
| `GET` | `/policies` | Politique de depenses active |
| `PUT` | `/policies` | Modifier la politique (admin) |
| `GET` | `/mileage-rates` | Bareme kilometrique en vigueur |
| `GET` | `/per-diem-rates` | Baremes per diem |
| `GET` | `/pending-approval` | Depenses en attente d'approbation (manager) |
| `POST` | `/export/csv` | Export CSV avec filtres |
| `POST` | `/export/pdf` | Export PDF rapport |
| `POST` | `/export/accounting` | Export comptable (FEC) |

### 6.2 PostgreSQL schema

```sql
-- Depenses
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_id UUID REFERENCES expense_reports(id) ON DELETE SET NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    amount_currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    converted_amount_cents INTEGER,
    conversion_currency VARCHAR(3) DEFAULT 'EUR',
    exchange_rate NUMERIC(10, 6),
    date DATE NOT NULL,
    vendor VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    description TEXT DEFAULT '',
    vat_amount_cents INTEGER DEFAULT 0,
    vat_rate NUMERIC(5, 2),
    receipt_storage_key VARCHAR(500),
    receipt_filename VARCHAR(255),
    receipt_mime_type VARCHAR(100),
    receipt_hash_sha256 VARCHAR(64),
    project_id UUID,
    client_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted', 'approved_n1', 'approved', 'rejected', 'paid')),
    submitted_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    approved_n2_by UUID REFERENCES users(id),
    approved_n2_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES users(id),
    rejected_at TIMESTAMPTZ,
    review_comment TEXT DEFAULT '',
    paid_at TIMESTAMPTZ,
    payment_reference VARCHAR(100),
    is_mileage BOOLEAN NOT NULL DEFAULT FALSE,
    mileage_km NUMERIC(10, 1),
    mileage_rate_cents INTEGER,
    is_per_diem BOOLEAN NOT NULL DEFAULT FALSE,
    per_diem_days INTEGER,
    per_diem_rate_cents INTEGER,
    per_diem_destination VARCHAR(200),
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurring_template_id UUID,
    policy_violations JSONB DEFAULT '[]'::jsonb,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_user_date ON expenses(user_id, date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_expenses_user_status ON expenses(user_id, status) WHERE is_deleted = FALSE;
CREATE INDEX idx_expenses_status ON expenses(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_expenses_category ON expenses(user_id, category) WHERE is_deleted = FALSE;
CREATE INDEX idx_expenses_report ON expenses(report_id) WHERE report_id IS NOT NULL;
CREATE INDEX idx_expenses_vendor ON expenses USING GIN (to_tsvector('simple', vendor || ' ' || coalesce(description, '')));

-- Rapports de depenses
CREATE TABLE expense_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'paid')),
    total_amount_cents INTEGER NOT NULL DEFAULT 0,
    expense_count INTEGER NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    review_comment TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expense_reports_user ON expense_reports(user_id, status);

-- Templates de depenses recurrentes
CREATE TABLE expense_recurring_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    vendor VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT DEFAULT '',
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
    next_generation_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Politique de depenses
CREATE TABLE expense_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    auto_approve_threshold_cents INTEGER NOT NULL DEFAULT 5000,
    multi_level_threshold_cents INTEGER NOT NULL DEFAULT 50000,
    receipt_required_threshold_cents INTEGER NOT NULL DEFAULT 2500,
    max_submission_days INTEGER NOT NULL DEFAULT 90,
    category_limits JSONB DEFAULT '{}'::jsonb,
    monthly_limit_cents INTEGER,
    allowed_categories_by_role JSONB DEFAULT '{}'::jsonb,
    strict_mode BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Baremes kilometriques
CREATE TABLE expense_mileage_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_power VARCHAR(10) NOT NULL,
    rate_cents_per_km INTEGER NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Baremes per diem
CREATE TABLE expense_per_diem_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone VARCHAR(50) NOT NULL,
    rate_cents_per_day INTEGER NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log
CREATE TABLE expense_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
    report_id UUID REFERENCES expense_reports(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    performed_by UUID NOT NULL REFERENCES users(id),
    action VARCHAR(30) NOT NULL,
    old_values JSONB DEFAULT '{}'::jsonb,
    new_values JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expense_audit_log_expense ON expense_audit_log(expense_id, created_at DESC);
```

### 6.3 PgEventBus events

| Event | Payload | Consumers |
|---|---|---|
| `expenses.expense.created` | `{ expense_id, user_id, amount, category }` | Metrics |
| `expenses.expense.submitted` | `{ expense_id, user_id, amount, category }` | Notifications (manager) |
| `expenses.expense.approved` | `{ expense_id, user_id, approved_by, amount }` | Notifications (employee) |
| `expenses.expense.rejected` | `{ expense_id, user_id, rejected_by, comment }` | Notifications (employee) |
| `expenses.expense.paid` | `{ expense_id, user_id, amount, payment_reference }` | Notifications (employee), Billing |
| `expenses.report.submitted` | `{ report_id, user_id, total_amount, expense_count }` | Notifications (manager) |
| `expenses.recurring.generated` | `{ expense_id, template_id, user_id }` | — |
| `expenses.export.billing` | `{ expense_ids, target, project_id?, client_id? }` | Billing |
| `expenses.travel.created` | `{ expense_id, user_id, date_start, date_end, destination }` | Calendar |
| `expenses.policy.violation` | `{ expense_id, user_id, violations: string[] }` | Audit |

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

- Cliquer `Scanner un recu`, uploader une image → les champs sont pre-remplis par l'OCR IA avec badges `IA`
- Scanner un recu flou → avertissement `Verifiez attentivement` affiche, confiance < 70%
- Creer une depense manuelle, remplir tous les champs, sauvegarder → la depense apparait dans la table avec statut `Brouillon`
- Sauvegarder avec montant manquant → erreur de validation, formulaire non soumis
- Soumettre une depense < seuil (50 EUR) → auto-approuvee avec commentaire automatique
- Soumettre une depense > seuil → statut passe a `En attente`, manager notifie
- Soumettre une depense > seuil multi-niveaux (500 EUR) → passe par N1 puis N2
- Manager approuve → statut `Approuve`, commentaire visible, employe notifie
- Manager rejette → statut `Rejete`, commentaire de rejet visible et obligatoire
- Filtrer par statut `En attente` → seules les depenses en attente apparaissent
- Filtrer par categorie `Transport` → seules les depenses transport apparaissent
- Filtrer par date range → seules les depenses dans la periode apparaissent
- KPI `Total` → somme correcte apres ajout d'une depense
- KPI `En attente` → ne compte que les depenses soumises non traitees
- Supprimer une depense en brouillon → elle disparait de la liste
- Tenter de supprimer une depense soumise → bouton desactive
- Export CSV → fichier telecharge avec toutes les colonnes et filtres appliques
- Export PDF → rapport formate avec justificatifs en annexe
- Kilometrage : saisir distance + puissance fiscale → montant calcule automatiquement
- Aller-retour coche → distance doublee dans le calcul
- Multi-devise : selectionner USD → taux de change affiche, montant converti en EUR
- Depense recurrente mensuelle → depense generee automatiquement le mois suivant
- Politique : depense > plafond categorie → badge `Hors politique` affiche
- Justificatif manquant > seuil → badge orange `Sans justificatif` affiche
- Creer un rapport, ajouter 3 depenses, soumettre → rapport soumis avec total correct
- Marquer comme rembourse → statut `Paye`, employe notifie
