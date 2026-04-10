# Module Comptabilite (Accounting) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **QuickBooks** | Plan comptable configurable, rapprochement bancaire automatise (matching IA), factures clients avec paiement en ligne, tableaux de bord tresorerie temps reel, multi-devises, declaration TVA automatique, integration bancaire directe (Open Banking), export FEC |
| **Xero** | Bank feeds en temps reel avec regle de categorisation auto, rapprochement bancaire drag-and-drop, factures recurrentes, 1000+ integrations (Stripe, PayPal, Shopify), multi-devises natif, budgets comparatifs, fixed asset management |
| **FreshBooks** | UX simple pour non-comptables, time tracking integre aux factures, depenses automatiques (OCR recus), proposals/estimates, late payment reminders, client portal, profit & loss dynamique |
| **Wave** | Gratuit pour la comptabilite de base, rapprochement bancaire, factures illimitees, recus scannes, rapports financiers complets (bilan, P&L, balance agee), dashboard simple |
| **Sage** | Plan comptable francais norme PCG, ecritures comptables manuelles et automatiques, declarations fiscales (TVA, IS, liasse), edition du Grand Livre, balance generale, journal centralisateur, export FEC certifie |
| **Pennylane** | Comptabilite collaborative (expert-comptable + dirigeant), OCR factures fournisseurs auto, rapprochement bancaire IA, pre-comptabilisation automatique, tableau de bord cash flow previsionnel, TVA auto-calculee |
| **Indy** | Comptabilite pour independants, categorisation automatique des transactions, declarations 2035/2042/TVA, suivi AGA, interface simplifiee zero jargon, synchronisation bancaire |
| **Tiime** | Facturation + comptabilite tout-en-un, notes de frais avec OCR, rapprochement bancaire, declarations TVA, export FEC, collaboration expert-comptable temps reel |
| **Dolibarr** | Open source PHP/MySQL, plan comptable PCG pre-charge, double-entry bookkeeping, journaux comptables, grand livre, balance, ecritures manuelles/auto, multi-devises, export FEC |
| **ERPNext** | Open source Python, chart of accounts hierarchique, journal entries avec templates, bank reconciliation, multi-company, budget tracking, cost centers, declarations fiscales |
| **Odoo Accounting** | Plan comptable par pays, ecritures automatiques (factures, paiements, notes de frais), rapprochement bancaire IA, relances clients, aged receivable/payable, consolidation multi-societes, analytic accounting |

## Principes directeurs

1. **Double-entry par defaut** — chaque ecriture debite un compte et credite un autre pour un total toujours equilibre a zero. Aucune ecriture desequilibree ne peut etre validee.
2. **Plan comptable francais (PCG) pre-charge** — le plan comptable general francais est charge par defaut avec les classes 1 a 7. Personnalisation libre : ajout, renommage, desactivation de comptes, mais la structure hierarchique reste coherente.
3. **Non-comptable friendly** — l'interface guide les utilisateurs non-experts avec des assistants (saisie guidee, categorisation automatique, explications en langage clair) tout en offrant la puissance complete aux experts-comptables.
4. **Temps reel et automatise** — les ecritures generees par les modules adjacents (factures, notes de frais, paiements) sont comptabilisees automatiquement. Le tableau de bord se met a jour en temps reel.
5. **Conformite fiscale francaise** — declarations TVA (CA3/CA12), export FEC (Fichier des Ecritures Comptables) au format normatif, piste d'audit complete pour le controle fiscal.
6. **Multi-exercices et cloture** — gestion de plusieurs exercices comptables avec processus de cloture structure (a-nouveaux, report, verrouillage des periodes closes).

---

## Categorie 1 — Plan comptable (Chart of Accounts)

### 1.1 Arborescence hierarchique du plan comptable
Affichage en arbre a gauche de l'ecran avec expand/collapse par clic sur le chevron. Structure PCG par defaut :
- **Classe 1 — Capitaux** (Capital, Reserves, Resultat, Emprunts)
  - 1.1 Capital et reserves
  - 1.2 Provisions pour risques
  - 1.6 Emprunts et dettes
- **Classe 2 — Immobilisations** (Immo corporelles, incorporelles, financieres)
  - 2.1 Immobilisations incorporelles
  - 2.2 Immobilisations corporelles
  - 2.8 Amortissements
- **Classe 3 — Stocks** (Matieres premieres, Produits finis, En-cours)
- **Classe 4 — Tiers** (Clients, Fournisseurs, Etat, Personnel)
  - 4.1 Clients et comptes rattaches
  - 4.0 Fournisseurs et comptes rattaches
  - 4.3 Securite sociale et organismes sociaux
  - 4.4 Etat et collectivites
- **Classe 5 — Financiers** (Banque, Caisse, VMP)
  - 5.1 Banques et etablissements financiers
  - 5.3 Caisse
- **Classe 6 — Charges** (Achats, Services, Impots, Personnel, Financieres)
  - 6.0 Achats
  - 6.1 Services exterieurs
  - 6.3 Impots et taxes
  - 6.4 Charges de personnel
  - 6.6 Charges financieres
- **Classe 7 — Produits** (Ventes, Production, Financiers, Exceptionnels)
  - 7.0 Ventes de produits
  - 7.1 Production stockee/immobilisee
  - 7.6 Produits financiers

Chaque compte affiche : numero, libelle, type (actif/passif/charge/produit), solde debiteur/crediteur, nombre d'ecritures. Pastille bleue sur les comptes avec des ecritures en brouillon.

### 1.2 Tree view drag-reorder
L'administrateur peut reorganiser les comptes dans l'arbre par drag-and-drop. Un indicateur bleu apparait entre les noeuds pour montrer la destination. Contraintes : un compte ne peut etre deplace que dans sa propre classe (pas de deplacement de 411 vers la classe 6). L'API envoie `PATCH /api/v1/accounting/accounts/:id/move` avec le nouveau `parent_id` et `sort_order`. Animation de 200ms `ease-out` pour le repositionnement. Raccourci clavier : `Alt+Up` / `Alt+Down` pour monter/descendre un compte dans la liste. Le drag-and-drop met a jour le `sort_order` en base sans modifier le numero de compte. Undo disponible pendant 5 secondes via un toast `Compte deplace. Annuler`.

### 1.3 Business card recapitulative
Carte en haut de la page avec les KPIs cles :
- **Capital social** : 50 000 EUR
- **Report a nouveau** : 8 000 EUR
- **Chiffre d'affaires services** : 120 000 EUR
- **Chiffre d'affaires produits** : 80 000 EUR
- **Cout des marchandises vendues** : 40 000 EUR
- **Solde total** : 500 400 EUR

Chaque KPI est cliquable pour naviguer vers le detail du compte. Les montants se mettent a jour en temps reel via SSE quand une ecriture est validee. Animation de transition numerique (compteur qui incremente/decremente sur 300ms). Si le service est indisponible, le dernier snapshot connu est affiche avec un badge `Stale data` en orange.

### 1.4 Recherche et filtrage de comptes
Barre de recherche en haut de l'arbre : recherche par numero (`411`), par libelle (`client`), par type (`charge`). Filtres rapides : `Actifs uniquement`, `Passifs uniquement`, `Comptes avec mouvements`, `Comptes a solde non nul`. Resultats en surbrillance dans l'arbre avec parents auto-expanded. Raccourci clavier : `/` focus la barre de recherche, `Escape` efface le filtre. Debounce de 200ms sur la saisie. Si aucun resultat, afficher le message `Aucun compte ne correspond a "X"` avec un lien `Creer le compte X`.

### 1.5 Gestion des comptes (CRUD)
Bouton `+ Nouveau compte` ouvre un formulaire : numero (auto-suggere selon la classe parente), libelle, type, devise, commentaire. Modification du libelle et du type a tout moment (le numero est immutable une fois qu'une ecriture existe). Desactivation d'un compte (masque dans les listes mais conserve l'historique). Suppression uniquement si aucune ecriture. Validation cote client : le numero doit etre unique, ne peut contenir que des chiffres, minimum 3 caracteres, maximum 10 caracteres. Erreur si un compte avec le meme numero existe deja : `Le compte 411001 existe deja : Client Dupont`. Sur sauvegarde, un evenement PgEventBus `account.created` ou `account.updated` est emis. Raccourci clavier : `Ctrl+Shift+N` ouvre le formulaire de creation.

### 1.6 Comptes auxiliaires (tiers)
Sous-comptes par tiers : `411001 — Client Dupont`, `411002 — Client Martin`. Ouverture automatique lors de la premiere facture d'un nouveau client/fournisseur. Lettrage automatique (rapprochement facture/paiement) sur les comptes auxiliaires. Lien bidirectionnel : depuis le compte auxiliaire, clic sur le nom du tiers ouvre sa fiche Contact. Depuis une fiche Contact, un onglet `Comptabilite` montre le solde, les ecritures recentes et le lettrage.

### 1.7 Import de plan comptable
Import CSV ou FEC pour charger un plan comptable existant. Mapping des colonnes avec preview. Detection des doublons et des conflits de numerotation. Mode `fusion` (ajoute les manquants) ou `remplacement` (ecrase tout). Progression : barre avec pourcentage et compteur `142/350 comptes traites`. En cas d'erreur de format sur une ligne, la ligne est ignoree et un rapport d'erreurs est affiche a la fin avec les numeros de lignes. Timeout : 60 secondes maximum pour un import de 10 000 comptes.

### 1.8 Multi-plans comptables
Support de plans comptables alternatifs : PCG (France), plan OHADA (Afrique), IFRS, plan suisse, plan belge. Selection a la creation de l'organisation. Possibilite de maintenir un plan local et un plan IFRS en parallele (mapping entre les deux). Changement de plan comptable impossible si des ecritures existent deja (message : `Des ecritures existent. Le plan comptable ne peut plus etre change.`).

### 1.9 Seeding du plan comptable PCG
A la creation d'une nouvelle organisation avec le mode comptabilite active, le systeme insere automatiquement le plan comptable general francais complet : environ 300 comptes hierarchises de la classe 1 a la classe 7. Les comptes sont marques `system: true` et ne peuvent pas etre supprimes (seulement desactives). Le seeding est idempotent : s'il est execute deux fois, les comptes existants ne sont pas dupliques. Appel API : `POST /api/v1/accounting/seed-chart` avec `{ "chart_type": "pcg" }`. Reponse : `{ "created": 312, "skipped": 0, "errors": 0 }`. Le seeding prend moins de 2 secondes.

---

## Categorie 2 — Saisie d'ecritures (Journal Entries)

### 2.1 Journal de saisie
Ecran principal de saisie en tableau : date, piece (numero auto ou manuel), libelle, compte debit, montant debit, compte credit, montant credit, lettrage. Ligne de totalisation en bas avec controle d'equilibre (total debit = total credit). Bordure rouge si desequilibre avec le message `Ecart de X.XX EUR — l'ecriture ne peut pas etre validee`. Le bouton `Valider` est desactive (grise, `cursor: not-allowed`) tant que l'ecriture n'est pas equilibree. Animation : la bordure rouge pulse une fois (300ms) quand l'utilisateur clique sur `Valider` avec un desequilibre.

### 2.2 Formulaire debit/credit avec validation d'equilibre
Chaque ligne de l'ecriture contient : numero de compte (input avec autocompletion fuzzy), libelle de la ligne (optionnel, herite du libelle general si vide), montant debit (input numerique), montant credit (input numerique). Une ligne ne peut avoir qu'un debit OU un credit, jamais les deux. Si l'utilisateur saisit un debit puis un credit sur la meme ligne, le premier est efface. Sous le tableau, un bandeau affiche en temps reel : `Total debit : 1 500.00 | Total credit : 1 500.00 | Ecart : 0.00`. L'ecart passe en vert quand il est nul, rouge sinon. La validation front-end empeche l'envoi si l'ecart est different de zero. L'API retourne `422 Unprocessable Entity` si `sum(debit) != sum(credit)` avec le corps `{ "error": "entry_unbalanced", "detail": "Debit total 1500.00 differs from credit total 1200.00" }`.

### 2.3 Saisie multi-lignes
Une ecriture peut comporter N lignes (ex: facture avec TVA = 3 lignes : charge HT, TVA deductible, fournisseur TTC). Bouton `+ Ligne` pour ajouter, glisser pour reordonner, croix pour supprimer. Autocompletion sur les numeros de compte avec recherche fuzzy. Minimum 2 lignes par ecriture. Maximum 100 lignes (au-dela, message `Limite de 100 lignes atteinte. Decoupez l'ecriture.`). Les lignes sont numerotees sequentiellement. Le raccourci `Tab` passe au champ suivant, `Shift+Tab` revient en arriere. `Enter` sur la derniere ligne cree automatiquement une nouvelle ligne.

### 2.4 Modeles d'ecritures (templates)
Creer des modeles pour les ecritures recurrentes : `Loyer mensuel`, `Salaires`, `Abonnement serveur`. Un modele pre-remplit les comptes et les libelles, l'utilisateur ajuste les montants. Bouton `Appliquer un modele` dans la barre d'outils. Raccourci clavier : `Ctrl+M` ouvre la liste des modeles. Recherche par nom dans le dialog. Double-clic ou `Enter` applique le modele. Les modeles sont stockes par organisation et partages entre utilisateurs. CRUD sur les modeles : creer, modifier, dupliquer, supprimer. Un modele supprime n'affecte pas les ecritures deja creees.

### 2.5 Ecritures automatiques
Les modules adjacents generent des ecritures automatiquement :
- **Factures clients** : debit 411 (Client), credit 701 (Ventes) + credit 44571 (TVA collectee)
- **Factures fournisseurs** : debit 601 (Achats) + debit 44566 (TVA deductible), credit 401 (Fournisseur)
- **Notes de frais** : debit 625 (Deplacements), credit 421 (Personnel)
- **Paiements recus** : debit 512 (Banque), credit 411 (Client)
- **Paiements emis** : debit 401 (Fournisseur), credit 512 (Banque)

Chaque ecriture auto porte une reference vers le document source (lien cliquable). L'ecriture auto est creee en statut `Valide` (pas de brouillon). Si le module Billing emet `invoice.validated` sur le PgEventBus, le module Accounting consomme l'evenement et cree l'ecriture dans les 500ms. Si la creation echoue (compte manquant, devise incompatible), l'evenement est place en DLQ et une notification est envoyee a l'admin comptable.

### 2.6 Journaux comptables
Organisation par journaux : `Achats (HA)`, `Ventes (VE)`, `Banque (BQ)`, `Caisse (CA)`, `Operations diverses (OD)`, `A-nouveaux (AN)`. Chaque ecriture est rattachee a un journal. Filtrage par journal dans la vue principale. Creation de journaux personnalises. Chaque journal a un code unique (2-3 lettres), un libelle, et un type (achats, ventes, banque, operations diverses). Suppression d'un journal uniquement s'il ne contient aucune ecriture.

### 2.7 Pieces justificatives
Chaque ecriture peut avoir une ou plusieurs pieces jointes (PDF, image). Drag-and-drop depuis le bureau ou depuis le module Drive. OCR automatique pour extraire date, montant, numero de facture et pre-remplir les champs. Lien vers la piece dans le detail de l'ecriture. Taille maximale par piece : 25 Mo. Formats acceptes : PDF, PNG, JPEG, TIFF. Si le fichier excede la limite, message `Fichier trop volumineux (32 Mo). Limite : 25 Mo.`. Les pieces sont stockees dans Drive avec le tag `accounting` et sont liees a l'ecriture par `document_id`.

### 2.8 Validation et verrouillage
Workflow de validation : `Brouillon` → `Valide` → `Cloture`. Une ecriture validee n'est plus modifiable (seulement contre-passable). Une ecriture cloturee fait partie de l'exercice clos. Bouton `Contre-passer` genere l'ecriture inverse avec reference a l'originale. Transition de statut : un brouillon peut etre valide par un utilisateur avec le role `accounting.write`. Une ecriture validee ne peut etre cloturee que lors du processus de cloture d'exercice. Tentative de modification d'une ecriture validee affiche : `Cette ecriture est validee. Utilisez la contre-passation pour corriger.`

### 2.9 Numerotation des pieces
Numerotation sequentielle automatique par journal et par exercice : `VE-2026-0001`, `HA-2026-0001`. Pas de trou dans la sequence (obligation legale francaise). Affichage d'un warning si un numero est manquant. La numerotation est calculee a l'insertion en base avec un `SELECT MAX(piece_number)` dans une transaction serialisable pour eviter les doublons en cas de saisie concurrente.

### 2.10 Saisie rapide au clavier
Navigation complete au clavier : Tab entre les champs, Entree pour valider la ligne et passer a la suivante, Echap pour annuler. Raccourcis : `Ctrl+S` sauvegarde, `Ctrl+N` nouvelle ecriture, `Ctrl+D` duplique la derniere ligne, `Ctrl+Shift+V` valide l'ecriture, `F2` edite la cellule courante. Le focus est mis automatiquement sur le premier champ vide a l'ouverture du formulaire. L'autocompletion de compte s'ouvre avec 2 caracteres minimum et se ferme avec `Escape`.

### 2.11 Import d'ecritures en masse
Import CSV/FEC avec mapping des colonnes, detection des doublons (meme date + montant + compte), preview avant validation. Mode `simulation` pour verifier l'equilibre et les comptes avant insertion. Barre de progression avec compteur. Si des ecritures desequilibrees sont detectees dans le fichier, elles sont listees en rouge dans la preview avec le message `Ligne 42 : ecart de 0.01 EUR`. L'utilisateur peut les corriger ou les exclure avant import.

---

## Categorie 3 — Rapprochement bancaire (Bank Reconciliation)

### 3.1 Import des releves bancaires
Import de fichiers OFX, QIF, CSV, CAMT.053 (format SEPA), MT940. Drag-and-drop ou connexion bancaire directe (Open Banking / DSP2). Parsing automatique : date, libelle, montant, reference. Si le format n'est pas reconnu automatiquement, un dialog de mapping s'affiche avec les colonnes du fichier et les champs attendus. Les doublons (meme date + montant + reference) sont detectes et marques en jaune avec le message `Transaction potentiellement dupliquee`. L'utilisateur choisit : importer ou ignorer.

### 3.2 Vue de rapprochement
Ecran en deux colonnes : a gauche les operations bancaires (releve), a droite les ecritures comptables du compte 512. Matching automatique par montant exact + date proche. Les operations rapprochees passent en vert avec une animation de fondu (300ms), les non-rapprochees restent en blanc. Un compteur en haut affiche : `42 rapprochees | 5 en attente | Ecart : 0.00 EUR`. Le solde bancaire et le solde comptable sont affiches cote a cote pour comparaison immediate.

### 3.3 Rapprochement automatique (matching IA)
Algorithme de matching multi-criteres : montant exact, date +/- 3 jours, libelle fuzzy (Levenshtein), reference de facture. Score de confiance affiche (0-100%). Auto-rapprochement au-dessus de 95% de confiance, suggestion manuelle en-dessous. Les suggestions entre 70% et 95% sont affichees avec un badge `Suggestion` orange. En dessous de 70%, aucune suggestion. L'algorithme tourne en arriere-plan a chaque import de releve et les resultats sont disponibles en moins de 2 secondes pour 1000 transactions.

### 3.4 Rapprochement manuel
Drag-and-drop d'une operation bancaire vers une ecriture comptable pour les rapprocher. Selection multiple pour rapprocher une operation bancaire avec plusieurs ecritures (ex: virement groupe). Split d'une operation pour la ventiler sur plusieurs comptes. Raccourci clavier : selectionner une transaction bancaire avec les fleches, `Ctrl+Enter` pour la rapprocher avec l'ecriture selectionnee en face. Undo via `Ctrl+Z` ou le bouton `De-rapprocher`.

### 3.5 Creation d'ecritures depuis le releve
Pour une operation bancaire sans ecriture correspondante : bouton `Creer l'ecriture`. Pre-remplissage avec le montant et la date. L'utilisateur choisit le compte de contrepartie. Regles de categorisation memorisees : "SNCF" → 625 Deplacements, "AMAZON" → 606 Fournitures. Si une regle de categorisation existe pour le libelle, le compte est pre-rempli automatiquement et l'ecriture est creee en un clic. Sinon, le dialog de saisie s'ouvre avec le montant et la date deja remplis.

### 3.6 Regles de categorisation automatique
Panneau `Regles` : definir des correspondances libelle → compte comptable. Conditions : contient, commence par, regex, montant entre. Priorite des regles (numero d'ordre, drag-and-drop pour reordonner). Application automatique aux futures operations. Import/export des regles en JSON. La premiere regle qui correspond est appliquee (stop au premier match). Bouton `Tester` pour voir quelles transactions existantes matchent une regle.

### 3.7 Etat de rapprochement
Tableau de bord : nombre d'operations rapprochees vs non-rapprochees, ecart (solde bancaire vs solde comptable), graphique d'evolution de l'ecart dans le temps. Alerte si ecart > seuil configurable (defaut : 1 EUR). L'ecart est calcule en temps reel a chaque rapprochement. Si l'ecart est nul, un badge vert `Rapproche` s'affiche. Sinon, un badge rouge `Ecart : X.XX EUR`.

### 3.8 Multi-comptes bancaires
Onglets par compte bancaire (Compte courant, Compte epargne, Compte devise). Chaque compte a son propre flux de rapprochement. Vue consolidee tous comptes. Ajout d'un compte bancaire : `+ Nouveau compte bancaire` avec le numero IBAN, le nom de la banque, et le compte comptable 512 associe.

### 3.9 Historique de rapprochement
Chaque rapprochement est date et attribue a un utilisateur. Possibilite de de-rapprocher une operation (audit trail conserve). Export de l'etat de rapprochement en PDF pour l'expert-comptable. L'historique conserve toutes les actions : rapprochement, de-rapprochement, modification, avec timestamp, user_id et IP source.

---

## Categorie 4 — Bilan et Compte de resultat (Balance Sheet & P&L)

### 4.1 Bilan comptable
Presentation normee en deux colonnes : Actif (immobilisations, actif circulant, tresorerie) et Passif (capitaux propres, provisions, dettes). Calcul automatique depuis les soldes des comptes. Drill-down : clic sur un poste → detail des comptes → detail des ecritures. Le bilan s'affiche en moins de 1 seconde grace a une vue materialisee PostgreSQL rafraichie toutes les 5 minutes ou a la demande. Verification automatique : si Actif != Passif, un bandeau rouge s'affiche en haut `ATTENTION : le bilan n'est pas equilibre (ecart : X EUR)`.

### 4.2 Compte de resultat
Presentation en cascade : Produits d'exploitation - Charges d'exploitation = Resultat d'exploitation. + Produits financiers - Charges financieres = Resultat financier. + Produits exceptionnels - Charges exceptionnelles = Resultat exceptionnel. Resultat net = somme des trois. Affichage en pourcentage du CA. Chaque ligne est cliquable pour un drill-down vers les comptes puis les ecritures. Les montants negatifs s'affichent en rouge entre parentheses.

### 4.3 Balance generale
Tableau de tous les comptes avec colonnes : numero, libelle, total debit, total credit, solde debiteur, solde crediteur. Totaux en bas (debit = credit). Filtres par classe, par periode, par journal. Export PDF/CSV/XLSX. Infinite scroll pour les grands plans comptables (500+ comptes). La balance est generee automatiquement depuis les ecritures de la periode selectionnee. Si la balance n'est pas equilibree (total debit != total credit), un warning s'affiche : `Balance desequilibree — verifiez les ecritures de la periode`. Raccourci : `Ctrl+P` ouvre le dialog d'export PDF.

### 4.4 Grand Livre avec infinite scroll
Detail de toutes les ecritures par compte, ordonnees chronologiquement. Pour chaque ligne : date, piece, libelle, journal, debit, credit, solde cumule. Filtre par compte, par periode, par journal. Navigation vers l'ecriture source par clic sur le numero de piece. Infinite scroll : les ecritures sont chargees par pages de 100. Le scroll vers le bas charge automatiquement la page suivante. Un spinner s'affiche en bas du tableau pendant le chargement. Le solde cumule est calcule en temps reel a mesure que les lignes se chargent. Raccourci : `Ctrl+G` ouvre le Grand Livre filtre sur le compte selectionne dans le plan comptable.

### 4.5 Balance agee (clients et fournisseurs)
Tableau des creances clients et dettes fournisseurs ventilees par anciennete : 0-30 jours, 31-60 jours, 61-90 jours, 91-120 jours, > 120 jours. Total par tranche. Indicateur visuel (vert/orange/rouge). Identification des impasses pour relance. Clic sur un montant d'une tranche filtre les factures correspondantes. Bouton `Relancer` sur chaque client ouvre le dialog d'envoi de relance email.

### 4.6 Comparaison N/N-1
Chaque rapport affiche en parallele l'exercice courant et le precedent, avec la variation en montant et en pourcentage. Colonnes additionnelles optionnelles : N-2, budget previsionnel. Highlight des variations significatives (>10%). Les variations positives s'affichent en vert avec une fleche vers le haut, les negatives en rouge avec une fleche vers le bas. Toggle pour afficher/masquer les colonnes de comparaison.

### 4.7 Rapports personnalises
Constructeur de rapports : choisir les comptes a inclure, les periodes, le niveau de detail (compte, sous-compte, ecriture), le mode de presentation (tableau, graphique). Sauvegarder comme modele reutilisable. Planification d'envoi automatique par email (quotidien, hebdomadaire, mensuel). L'envoi utilise le module Mail via l'evenement PgEventBus `report.scheduled`. Le rapport est genere en PDF et envoye en piece jointe.

### 4.8 Soldes intermediaires de gestion (SIG)
Calcul automatique des SIG : marge commerciale, production de l'exercice, valeur ajoutee, EBE (Excedent Brut d'Exploitation), resultat d'exploitation, resultat courant avant impots, resultat exceptionnel, resultat net. Presentation en cascade avec graphique en barres horizontales. Chaque SIG est cliquable pour voir les comptes qui le composent.

### 4.9 Export PDF avec mise en page professionnelle
Generation de PDF avec en-tete societe (logo, raison sociale, SIRET, adresse), pied de page (date de generation, page X/Y), mise en page comptable normee. Templates : format expert-comptable, format dirigeant (simplifie), format banque. Export via `GET /api/v1/accounting/reports/:type/pdf?period=2026-01&format=expert`. Le PDF est genere cote backend avec `printpdf` (MIT) et retourne en streaming. Delai maximum : 10 secondes pour un rapport de 50 pages.

### 4.10 Tableaux de bord en temps reel
Dashboard avec widgets : tresorerie du jour, CA mensuel (graphique barres), charges par categorie (camembert), resultat net glissant (courbe), top 10 clients, top 10 fournisseurs. Actualisation automatique a chaque ecriture via SSE. Les widgets sont repositionnables par drag-and-drop et la disposition est sauvegardee par utilisateur.

---

## Categorie 5 — Factures clients et fournisseurs

### 5.1 Creation de facture client
Formulaire : client (autocompletion depuis Contacts), date, echeance, lignes de facturation (designation, quantite, prix unitaire, TVA, remise, total HT). Calcul automatique du total HT, TVA, TTC. Numerotation sequentielle obligatoire (`FA-2026-0001`). Si le client n'existe pas dans Contacts, un lien `Creer le contact` ouvre le formulaire de creation inline. Les montants sont affiches en `NUMERIC(15,2)` — jamais de floating point.

### 5.2 Modeles de factures
Templates de mise en page : classique, moderne, minimaliste. Personnalisation : logo, couleurs, mentions legales, conditions de paiement, RIB, message personnalise. Preview PDF temps reel dans le panneau droit. Le template par defaut est configure dans les parametres de l'organisation.

### 5.3 Factures recurrentes
Creer une facture modele avec frequence (mensuelle, trimestrielle, annuelle) et date de fin. Generation automatique a la date prevue via le scheduler interne. Notification 3 jours avant generation pour revision. Historique des factures generees. Evenement PgEventBus emis : `invoice.recurring.generated`.

### 5.4 Gestion des avoirs
Creer un avoir lie a une facture : total ou partiel. L'avoir annule (ou reduit) la creance client et genere les ecritures inverses. Numerotation specifique (`AV-2026-0001`). Un avoir ne peut pas depasser le montant de la facture d'origine.

### 5.5 Suivi des paiements
Tableau de bord des factures : emises, en attente, en retard, payees. Enregistrement du paiement (date, montant, mode : virement, cheque, carte, especes). Paiement partiel supporte. Lettrage automatique facture/paiement. Badge de statut : `Brouillon` (gris), `Emise` (bleu), `En retard` (rouge), `Payee` (vert), `Partiellement payee` (orange).

### 5.6 Relances automatiques
Configuration de scenarios de relance : J+7 (rappel amical), J+15 (relance formelle), J+30 (mise en demeure). Envoi automatique par email via le module Mail. Templates personnalisables par etape. Historique des relances par client. L'envoi est declenche par un cron interne qui verifie quotidiennement les factures en retard. Evenement PgEventBus : `invoice.reminder.sent`.

### 5.7 Factures fournisseurs (achats)
Saisie manuelle ou OCR (scan/photo → extraction date, fournisseur, montant, TVA, numero). Validation par workflow (soumission → approbation → comptabilisation). Rapprochement avec bon de commande si applicable. Le workflow d'approbation est configurable par organisation : 1 ou 2 niveaux de validation.

### 5.8 Integration comptable
Chaque facture validee genere automatiquement les ecritures comptables (cf. 2.5). Lien bidirectionnel : depuis l'ecriture, naviguer vers la facture source. Depuis la facture, voir les ecritures generees. L'ecriture porte un champ `source_type = "invoice"` et `source_id = <invoice_uuid>`.

---

## Categorie 6 — Notes de frais (Expense Reports)

### 6.1 Saisie de depense
Formulaire : date, categorie (deplacement, repas, hebergement, fournitures, telephone, autre), montant TTC, montant TVA (calcul auto selon taux), description, piece justificative (photo/PDF). Saisie depuis mobile avec photo du recu. Chaque champ a une validation inline : date ne peut pas etre dans le futur, montant doit etre positif, piece justificative obligatoire pour les montants > 50 EUR (configurable).

### 6.2 OCR des recus
Photo ou scan d'un recu → extraction automatique : date, montant, nom du commercant, taux de TVA. Pre-remplissage du formulaire. Correction manuelle si besoin. Piece jointe archivee automatiquement dans Drive avec le tag `expense`. L'OCR est effectue par le service signapps-media (port 3009). Delai typique : 2-3 secondes par recu. Score de confiance affiche pour chaque champ extrait.

### 6.3 Notes de frais groupees
Regrouper plusieurs depenses dans une note de frais mensuelle. Tableau recapitulatif avec totaux par categorie. Ajout/suppression de lignes. Soumission en bloc pour approbation. Maximum 50 depenses par note de frais.

### 6.4 Workflow d'approbation
Circuit de validation configurable : employe → manager → comptabilite. Notifications a chaque etape via le module Notifications. Approbation, rejet (avec motif obligatoire), demande de modification. Historique complet des actions. Evenements PgEventBus : `expense.submitted`, `expense.approved`, `expense.rejected`.

### 6.5 Baremes kilometriques
Saisie d'un trajet : depart, arrivee, distance (calcul auto via API cartographique ou saisie manuelle), puissance fiscale du vehicule. Calcul automatique de l'indemnite selon le bareme fiscal en vigueur. Mise a jour annuelle du bareme. Le bareme est stocke en base et editable par l'admin.

### 6.6 Plafonds et politiques
Definition de politiques par categorie : plafond repas (ex: 20 EUR), plafond hebergement par ville, categories autorisees par role. Alerte si depassement. Blocage ou avertissement selon la severite. Configuration dans `Admin > Comptabilite > Politiques de depenses`.

### 6.7 Remboursement
Generation automatique de l'ordre de virement pour remboursement des notes approuvees. Integration avec le module bancaire. Ecriture comptable automatique (debit 625, credit 421). Le remboursement genere un evenement `expense.reimbursed`.

### 6.8 Tableau de bord des depenses
Graphiques : depenses par categorie (camembert), evolution mensuelle (barres), top 10 depensiers, depenses par departement. Filtres par periode, par employe, par categorie. Export CSV/PDF.

---

## Categorie 7 — Budget previsionnel (Budget Forecasting)

### 7.1 Creation de budget
Formulaire : exercice, nom du budget, type (exploitation, investissement, tresorerie). Grille de saisie par compte comptable et par mois (12 colonnes). Pre-remplissage optionnel depuis le realise N-1. Saisie par montant ou par formule (ex: `N-1 * 1.05` pour +5%). Raccourci : `Ctrl+Enter` sauvegarde le budget.

### 7.2 Versions de budget
Plusieurs versions par exercice : budget initial, budget revise Q1, budget revise Q2. Comparaison entre versions avec diff (colonnes supplementaires montrant l'ecart). Verrouillage de la version validee par le directeur financier.

### 7.3 Suivi budgetaire (realise vs budget)
Tableau mensuel : budget, realise, ecart en montant, ecart en pourcentage. Code couleur : vert (<5% d'ecart), orange (5-15%), rouge (>15%). Drill-down du realise vers les ecritures. Graphique en barres groupees (budget vs realise) par mois.

### 7.4 Alertes de depassement
Notifications automatiques quand un poste budgetaire depasse un seuil (80%, 100%, 120%). Destinataires configurables par poste. Historique des alertes. L'alerte est emise via PgEventBus `budget.threshold.exceeded` et consommee par le module Notifications.

### 7.5 Budget par centre de cout
Repartition du budget par departement, projet ou activite. Chaque centre de cout a son propre budget. Consolidation au niveau de l'entreprise.

### 7.6 Previsions glissantes (rolling forecast)
Mise a jour trimestrielle : les mois ecoules sont remplaces par le realise, les mois futurs sont re-previsionnes. Graphique d'evolution des previsions dans le temps.

### 7.7 Scenarios what-if
Creation de scenarios : optimiste, pessimiste, base. Modification des hypotheses (taux de croissance, couts, effectifs). Comparaison visuelle des scenarios sur un meme graphique (courbes superposees, couleurs distinctes).

---

## Categorie 8 — Cash Flow et tresorerie

### 8.1 Tableau de flux de tresorerie
Presentation normee : flux d'exploitation, flux d'investissement, flux de financement. Calcul automatique depuis les ecritures bancaires. Solde de debut, variation, solde de fin.

### 8.2 Prevision de tresorerie
Projection sur 3, 6 ou 12 mois : encaissements prevus (factures clients en cours + recurrentes) - decaissements prevus (factures fournisseurs + charges fixes + echeances). Graphique courbe avec zone de confort (vert) et zone de danger (rouge, sous le seuil minimum configure).

### 8.3 Echeancier
Liste chronologique des encaissements et decaissements a venir : date, libelle, montant, source (facture, charge recurrente, echeance d'emprunt). Filtre par type, par montant minimum. Export calendrier (iCal) pour integration avec le module Calendar.

### 8.4 Cash burn rate
Pour les startups : calcul automatique du burn rate mensuel (depenses - revenus), tresorerie restante, nombre de mois de runway. Alerte quand runway < 6 mois (configurable). Widget dashboard avec la jauge de runway.

### 8.5 Multi-devises
Gestion des comptes en devises etrangeres (USD, GBP, CHF). Taux de change automatique (BCE) ou manuel. Ecarts de conversion comptabilises dans le compte 476/477 (differences de conversion). Tableau de tresorerie consolide en devise de reference. Le taux de change est mis a jour quotidiennement via un cron qui interroge l'API BCE. Evenement PgEventBus : `exchange_rate.updated`.

### 8.6 Graphiques de tresorerie
Courbe de tresorerie historique + previsionnelle sur 12 mois. Barres empilees encaissements/decaissements par mois. Heatmap des jours de tension (solde bas). Widget dashboard avec solde du jour et tendance (fleche haut/bas + pourcentage).

---

## Categorie 9 — Declaration TVA et conformite

### 9.1 Calcul automatique de la TVA
Collecte automatique de la TVA collectee (comptes 4457x) et deductible (comptes 4456x) sur la periode. Calcul du solde : TVA a payer ou credit de TVA. Ventilation par taux (20%, 10%, 5.5%, 2.1%). Affichage du detail dans un tableau : base HT, montant TVA, total TTC par taux. Le calcul est effectue depuis les ecritures validees uniquement (les brouillons sont exclus).

### 9.2 Declaration CA3 (mensuelle/trimestrielle)
Pre-remplissage du formulaire CA3 depuis les ecritures comptables. Verification des montants avec drill-down. Validation par le responsable. Export au format EDI pour tele-declaration. Historique des declarations avec statut (brouillon, validee, teledeclaree).

### 9.3 Declaration CA12 (annuelle simplifiee)
Pour les entreprises au regime simplifie. Calcul des acomptes trimestriels et de la regularisation annuelle. Pre-remplissage et export.

### 9.4 Export FEC (Fichier des Ecritures Comptables)
Generation du FEC au format normatif (article A.47 A-1 du LPF). Contenu obligatoire : JournalCode, JournalLib, EcritureNum, EcritureDate, CompteNum, CompteLib, CompAuxNum, CompAuxLib, PieceRef, PieceDate, EcritureLib, Debit, Credit, EcritureLet, DateLet, ValidDate, Montantdevise, Idevise. Validation de conformite avant export : verification de la numerotation sequentielle, des dates coherentes, des comptes existants. Si la validation echoue, un rapport d'erreurs est affiche avec les lignes problematiques. API : `GET /api/v1/accounting/fec?fiscal_year=2026` retourne un fichier TSV.

### 9.5 Piste d'audit
Tracabilite complete de chaque ecriture : qui a cree, modifie, valide, quand, depuis quelle source (facture, saisie manuelle, import). Aucune suppression possible apres validation. Conformite avec les exigences du controle fiscal informatise (CFI). Chaque action est enregistree dans la table `audit_log` avec `user_id`, `action`, `entity_type`, `entity_id`, `timestamp`, `ip_address`, `old_value`, `new_value`.

### 9.6 Cloture d'exercice
Assistant de cloture en 5 etapes :
1. Verification de l'equilibre general (debit total = credit total)
2. Controle des comptes d'attente (solde = 0)
3. Generation des ecritures d'inventaire (amortissements, provisions, charges a payer, produits constates d'avance)
4. Calcul du resultat (solde du compte 120 ou 129)
5. Generation des a-nouveaux (report des soldes de bilan vers le nouvel exercice)
Verrouillage definitif de l'exercice : aucune ecriture ne peut etre ajoutee ou modifiee apres cloture. Evenement PgEventBus : `fiscal_year.closed`.

### 9.7 Archivage legal
Conservation des pieces justificatives et des ecritures pendant 10 ans (obligation legale). Archivage horodate et signe electroniquement. Acces en lecture seule aux exercices clos.

### 9.8 Configuration des codes TVA
Interface de gestion des codes TVA : liste des taux applicables (20%, 10%, 5.5%, 2.1%, 0%), compte comptable de collecte associe (4457x), compte de deduction associe (4456x), libelle, type (normale, intermediaire, reduite, super-reduite, exoneree). Ajout de taux personnalises pour les cas speciaux (DOM-TOM, operations intracommunautaires). Chaque code TVA est identifie par un code unique (`TVA20`, `TVA55`, `TVA_INTRA`). Suppression d'un code TVA uniquement s'il n'est utilise par aucune facture. API : `GET /api/v1/accounting/tax-codes`, `POST /api/v1/accounting/tax-codes`.

### 9.9 Gestion des exercices fiscaux
CRUD des exercices fiscaux : date de debut, date de fin (generalement 12 mois), statut (ouvert, en cours de cloture, clos). Un seul exercice peut etre ouvert en saisie a la fois (les exercices precedents sont verrouilles). Possibilite d'ouvrir temporairement un exercice cloture pour correction (necessite le role `accounting.admin`). Exercice par defaut : du 1er janvier au 31 decembre. Exercices decales supportes (ex: du 1er avril au 31 mars). API : `GET /api/v1/accounting/fiscal-years`, `POST /api/v1/accounting/fiscal-years`.

---

## Categorie 10 — Import, export et integrations

### 10.1 Import CSV generique
Import de transactions depuis un fichier CSV : mapping des colonnes (date, libelle, debit, credit, compte), preview, detection des doublons, validation avant insertion.

### 10.2 Import FEC
Import d'un FEC existant (migration depuis un autre logiciel). Validation du format, creation automatique des comptes manquants, insertion des ecritures. Rapport de migration avec warnings.

### 10.3 Connexion bancaire (Open Banking)
Connexion directe aux banques via API DSP2/Open Banking. Synchronisation automatique des releves (quotidienne ou temps reel). Consentement renouvele tous les 90 jours. Banques supportees : principales banques francaises et europeennes.

### 10.4 Integration avec les modules SignApps
- **Billing** (factures) → ecritures de ventes et encaissements
- **HR/Workforce** (paie) → ecritures de salaires et charges
- **Drive** (pieces justificatives) → archivage des documents comptables
- **Calendar** (echeances) → rappels de declarations et de cloture
- **Contacts** (tiers) → annuaire clients/fournisseurs synchronise
- **Forms** (notes de frais) → workflow de validation des depenses

### 10.5 Export multi-format
Export des rapports en PDF, XLSX, CSV, JSON. Export FEC certifie. Export DATEV (pour les entreprises franco-allemandes). Export ebics/SEPA pour les virements.

### 10.6 API REST comptable
Endpoints pour integrations tierces :
- `GET /api/v1/accounting/accounts` — liste des comptes (filtre par classe, type, solde)
- `GET /api/v1/accounting/accounts/:id` — detail d'un compte avec solde et historique
- `POST /api/v1/accounting/accounts` — creer un compte
- `PATCH /api/v1/accounting/accounts/:id` — modifier un compte
- `PATCH /api/v1/accounting/accounts/:id/move` — deplacer un compte dans l'arbre
- `DELETE /api/v1/accounting/accounts/:id` — supprimer (si aucune ecriture)
- `POST /api/v1/accounting/entries` — creer une ecriture (body : lignes avec comptes et montants)
- `GET /api/v1/accounting/entries` — liste des ecritures (filtre par journal, periode, compte)
- `GET /api/v1/accounting/entries/:id` — detail d'une ecriture avec pieces jointes
- `PATCH /api/v1/accounting/entries/:id/validate` — valider une ecriture brouillon
- `POST /api/v1/accounting/entries/:id/reverse` — contre-passer une ecriture
- `GET /api/v1/accounting/balance` — balance generale (filtre par periode, classe)
- `GET /api/v1/accounting/trial-balance` — balance de verification auto-generee
- `GET /api/v1/accounting/general-ledger` — grand livre (filtre par compte, periode)
- `GET /api/v1/accounting/income-statement` — compte de resultat
- `GET /api/v1/accounting/balance-sheet` — bilan comptable
- `GET /api/v1/accounting/fec` — export FEC
- `POST /api/v1/accounting/seed-chart` — seeder le plan comptable PCG
- `GET /api/v1/accounting/tax-codes` — liste des codes TVA
- `POST /api/v1/accounting/tax-codes` — creer un code TVA
- `GET /api/v1/accounting/fiscal-years` — liste des exercices
- `POST /api/v1/accounting/fiscal-years` — creer un exercice
- `POST /api/v1/accounting/fiscal-years/:id/close` — cloturer un exercice
- `POST /api/v1/accounting/bank-reconciliation/import` — importer un releve bancaire
- `GET /api/v1/accounting/bank-reconciliation/suggestions` — suggestions de rapprochement
- `POST /api/v1/accounting/bank-reconciliation/match` — rapprocher une transaction
- `GET /api/v1/accounting/reports/:type/pdf` — export PDF d'un rapport

Auth JWT. Documentation OpenAPI. Rate limiting : 100 req/min par API key.

### 10.7 Synchronisation expert-comptable
Mode collaboratif : l'expert-comptable accede au dossier en temps reel. Annotations et commentaires sur les ecritures. Chat integre pour les questions. Export du dossier de revision annuel.

---

## Categorie 11 — Immobilisations et amortissements

### 11.1 Registre des immobilisations
Liste de tous les actifs immobilises : designation, date d'acquisition, valeur d'origine, duree d'amortissement, methode (lineaire, degressif), valeur nette comptable. Filtres par categorie (materiel, mobilier, vehicules, logiciels, brevets). Recherche par designation.

### 11.2 Calcul automatique des amortissements
Generation mensuelle ou annuelle des dotations aux amortissements. Methode lineaire (repartition egale) ou degressive (coefficient fiscal). Tableau d'amortissement par immobilisation avec cumul. Le calcul est declenche automatiquement a la cloture mensuelle.

### 11.3 Cession et mise au rebut
Enregistrement de la cession : date, prix de cession, calcul de la plus/moins-value. Ecritures automatiques : sortie de l'actif, reprise des amortissements, constatation du resultat de cession. Mise au rebut : valeur de cession = 0.

### 11.4 Ecritures automatiques d'amortissement
Les dotations generent automatiquement les ecritures comptables : debit 681 (Dotations), credit 28x (Amortissements). Integration avec la cloture d'exercice. Evenement PgEventBus : `depreciation.calculated`.

---

## Categorie 12 — Analytique et centres de cout

### 12.1 Plan analytique
Definition d'axes analytiques : departements, projets, activites, produits. Chaque axe a une arborescence de centres. Une ecriture peut etre ventilee sur plusieurs axes.

### 12.2 Ventilation analytique
Lors de la saisie d'une ecriture, repartition du montant sur les centres de cout : 60% Projet A, 40% Projet B. Cles de repartition pre-definies pour les charges communes (loyer, electricite).

### 12.3 Rapports analytiques
Compte de resultat par centre de cout, par projet, par activite. Comparaison entre centres. Rentabilite par projet. Export et integration avec le module Budget.

### 12.4 Refacturation interne
Mecanisme de refacturation entre departements : le departement IT facture ses services aux autres departements. Ecritures de transfert automatiques.

---

## Schema PostgreSQL

```sql
-- Plan comptable
CREATE TABLE accounting_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    account_number VARCHAR(10) NOT NULL,
    label VARCHAR(255) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    account_class SMALLINT NOT NULL CHECK (account_class BETWEEN 1 AND 7),
    parent_id UUID REFERENCES accounting_accounts(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system BOOLEAN NOT NULL DEFAULT false,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id, account_number)
);
CREATE INDEX idx_accounting_accounts_org ON accounting_accounts(org_id);
CREATE INDEX idx_accounting_accounts_parent ON accounting_accounts(parent_id);
CREATE INDEX idx_accounting_accounts_number ON accounting_accounts(org_id, account_number);

-- Journaux comptables
CREATE TABLE accounting_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR(3) NOT NULL,
    label VARCHAR(100) NOT NULL,
    journal_type VARCHAR(20) NOT NULL CHECK (journal_type IN ('purchases', 'sales', 'bank', 'cash', 'misc', 'opening')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id, code)
);

-- Exercices fiscaux
CREATE TABLE accounting_fiscal_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closing', 'closed')),
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ecritures comptables (header)
CREATE TABLE accounting_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    fiscal_year_id UUID NOT NULL REFERENCES accounting_fiscal_years(id),
    journal_id UUID NOT NULL REFERENCES accounting_journals(id),
    entry_date DATE NOT NULL,
    piece_number VARCHAR(20) NOT NULL,
    label VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'closed')),
    source_type VARCHAR(30),
    source_id UUID,
    validated_at TIMESTAMPTZ,
    validated_by UUID REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id, journal_id, piece_number)
);
CREATE INDEX idx_accounting_entries_org_date ON accounting_entries(org_id, entry_date);
CREATE INDEX idx_accounting_entries_journal ON accounting_entries(journal_id);
CREATE INDEX idx_accounting_entries_source ON accounting_entries(source_type, source_id);

-- Lignes d'ecritures (debit/credit)
CREATE TABLE accounting_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES accounting_entries(id) ON DELETE CASCADE,
    line_number SMALLINT NOT NULL,
    account_id UUID NOT NULL REFERENCES accounting_accounts(id),
    label VARCHAR(255),
    debit NUMERIC(15,2) NOT NULL DEFAULT 0,
    credit NUMERIC(15,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    currency_amount NUMERIC(15,2),
    lettering_code VARCHAR(10),
    lettering_date DATE,
    analytical_center_id UUID REFERENCES accounting_analytical_centers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (debit >= 0 AND credit >= 0),
    CHECK (NOT (debit > 0 AND credit > 0))
);
CREATE INDEX idx_entry_lines_entry ON accounting_entry_lines(entry_id);
CREATE INDEX idx_entry_lines_account ON accounting_entry_lines(account_id);

-- Rapprochement bancaire
CREATE TABLE accounting_bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    bank_account_id UUID NOT NULL,
    transaction_date DATE NOT NULL,
    value_date DATE,
    label VARCHAR(255) NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    reference VARCHAR(100),
    raw_data JSONB,
    reconciled BOOLEAN NOT NULL DEFAULT false,
    reconciled_entry_id UUID REFERENCES accounting_entries(id),
    reconciled_at TIMESTAMPTZ,
    reconciled_by UUID REFERENCES users(id),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bank_tx_org_date ON accounting_bank_transactions(org_id, transaction_date);
CREATE INDEX idx_bank_tx_reconciled ON accounting_bank_transactions(org_id, reconciled);

-- Regles de categorisation bancaire
CREATE TABLE accounting_categorization_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    rule_order INTEGER NOT NULL,
    match_type VARCHAR(20) NOT NULL CHECK (match_type IN ('contains', 'starts_with', 'regex', 'amount_range')),
    match_value VARCHAR(255) NOT NULL,
    target_account_id UUID NOT NULL REFERENCES accounting_accounts(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Codes TVA
CREATE TABLE accounting_tax_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR(20) NOT NULL,
    label VARCHAR(100) NOT NULL,
    rate NUMERIC(5,2) NOT NULL,
    collection_account_id UUID REFERENCES accounting_accounts(id),
    deduction_account_id UUID REFERENCES accounting_accounts(id),
    tax_type VARCHAR(20) NOT NULL DEFAULT 'standard',
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(org_id, code)
);

-- Modeles d'ecritures
CREATE TABLE accounting_entry_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    journal_id UUID REFERENCES accounting_journals(id),
    lines JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Centres analytiques
CREATE TABLE accounting_analytical_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    axis VARCHAR(50) NOT NULL,
    code VARCHAR(20) NOT NULL,
    label VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES accounting_analytical_centers(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(org_id, axis, code)
);

-- Immobilisations
CREATE TABLE accounting_fixed_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    designation VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    acquisition_date DATE NOT NULL,
    original_value NUMERIC(15,2) NOT NULL,
    depreciation_method VARCHAR(20) NOT NULL CHECK (depreciation_method IN ('linear', 'declining')),
    depreciation_duration_months INTEGER NOT NULL,
    residual_value NUMERIC(15,2) NOT NULL DEFAULT 0,
    disposal_date DATE,
    disposal_value NUMERIC(15,2),
    account_id UUID NOT NULL REFERENCES accounting_accounts(id),
    depreciation_account_id UUID NOT NULL REFERENCES accounting_accounts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budgets
CREATE TABLE accounting_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    fiscal_year_id UUID NOT NULL REFERENCES accounting_fiscal_years(id),
    name VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL DEFAULT 'initial',
    budget_type VARCHAR(20) NOT NULL,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE accounting_budget_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID NOT NULL REFERENCES accounting_budgets(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounting_accounts(id),
    month_01 NUMERIC(15,2) NOT NULL DEFAULT 0,
    month_02 NUMERIC(15,2) NOT NULL DEFAULT 0,
    month_03 NUMERIC(15,2) NOT NULL DEFAULT 0,
    month_04 NUMERIC(15,2) NOT NULL DEFAULT 0,
    month_05 NUMERIC(15,2) NOT NULL DEFAULT 0,
    month_06 NUMERIC(15,2) NOT NULL DEFAULT 0,
    month_07 NUMERIC(15,2) NOT NULL DEFAULT 0,
    month_08 NUMERIC(15,2) NOT NULL DEFAULT 0,
    month_09 NUMERIC(15,2) NOT NULL DEFAULT 0,
    month_10 NUMERIC(15,2) NOT NULL DEFAULT 0,
    month_11 NUMERIC(15,2) NOT NULL DEFAULT 0,
    month_12 NUMERIC(15,2) NOT NULL DEFAULT 0,
    UNIQUE(budget_id, account_id)
);

-- Audit log comptable
CREATE TABLE accounting_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(30) NOT NULL,
    entity_type VARCHAR(30) NOT NULL,
    entity_id UUID NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_accounting_audit_log ON accounting_audit_log(org_id, entity_type, entity_id);
```

---

## PgEventBus Events

| Event | Payload | Emitted by | Consumed by |
|---|---|---|---|
| `account.created` | `{ org_id, account_id, account_number, label }` | Accounting | Gateway, Audit |
| `account.updated` | `{ org_id, account_id, changes }` | Accounting | Gateway, Audit |
| `entry.created` | `{ org_id, entry_id, journal, piece_number, total }` | Accounting | Dashboard, Audit |
| `entry.validated` | `{ org_id, entry_id, validated_by }` | Accounting | Dashboard, Reports, Audit |
| `entry.reversed` | `{ org_id, original_entry_id, reverse_entry_id }` | Accounting | Dashboard, Audit |
| `bank_transaction.imported` | `{ org_id, count, bank_account_id }` | Accounting | Dashboard |
| `bank_transaction.reconciled` | `{ org_id, transaction_id, entry_id }` | Accounting | Dashboard, Audit |
| `invoice.validated` | `{ org_id, invoice_id, type, amount }` | Billing | Accounting (creates entry) |
| `expense.approved` | `{ org_id, expense_id, amount }` | Forms/HR | Accounting (creates entry) |
| `payment.received` | `{ org_id, payment_id, invoice_id, amount }` | Billing | Accounting (creates entry) |
| `budget.threshold.exceeded` | `{ org_id, budget_id, account_id, threshold, actual }` | Accounting | Notifications |
| `fiscal_year.closed` | `{ org_id, fiscal_year_id, closed_by }` | Accounting | Audit, Notifications |
| `depreciation.calculated` | `{ org_id, asset_id, amount, period }` | Accounting | Audit |
| `exchange_rate.updated` | `{ base_currency, rates, date }` | Accounting | Billing, All |
| `report.scheduled` | `{ org_id, report_type, recipients, format }` | Accounting | Mail |

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **QuickBooks Help Center** (quickbooks.intuit.com/learn-support) — tutoriels comptabilite, guides plan comptable, rapprochement bancaire, declarations.
- **Xero Central** (central.xero.com) — guides par fonctionnalite, videos, webinars, community forum.
- **Sage Knowledge Base** (sage.com/fr-fr/support) — documentation comptable francaise, guide FEC, declarations fiscales.
- **Pennylane Help** (help.pennylane.com) — guides utilisateur, FAQ comptabilite collaborative.
- **Plan Comptable General** (plancomptable.com) — reference officielle du PCG francais, liste des comptes, explications.
- **Bofip** (bofip.impots.gouv.fr) — documentation fiscale officielle (TVA, FEC, amortissements, obligations legales).

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Ledger** (github.com/ledger/ledger) | **BSD-3-Clause** | Pattern de double-entry bookkeeping en ligne de commande. Structure de donnees pour les transactions multi-lignes. |
| **Hledger** (github.com/simonmichael/hledger) | **GPL** | **INTERDIT** (GPL). Ne pas utiliser ni copier. Reference pedagogique uniquement via la documentation publique. |
| **Beancount** (github.com/beancount/beancount) | **GPL** | **INTERDIT** (GPL). Reference pedagogique uniquement. |
| **Firefly III** (github.com/firefly-iii/firefly-iii) | **AGPL-3.0** | **INTERDIT** (AGPL). Ne pas utiliser. |
| **Akaunting** (github.com/akaunting/akaunting) | **GPL-3.0** | **INTERDIT** (GPL). Ne pas utiliser. |
| **Invoice Ninja** (github.com/invoiceninja/invoiceninja) | **MIT** (CE) | Pattern pour la facturation, generation PDF, recurrences, portail client. |
| **ERPNext** (github.com/frappe/erpnext) | **GPL** | **INTERDIT** (GPL). Reference pedagogique uniquement. |
| **Crater** (github.com/crater-invoice/crater) | **MIT** | Pattern pour facturation, notes de frais, rapports financiers en Vue/Laravel. |
| **Bigcapital** (github.com/bigcapital/bigcapital) | **AGPL-3.0** | **INTERDIT** (AGPL). Ne pas utiliser. |
| **rust_decimal** (github.com/paupino/rust-decimal) | **MIT** | Library Rust pour calculs decimaux exacts (pas de floating point pour la comptabilite). |
| **sqlx** (github.com/launchbadge/sqlx) | **MIT/Apache-2.0** | Deja utilise dans SignApps. Pattern pour les requetes comptables complexes avec types PostgreSQL (NUMERIC). |
| **calamine** (github.com/tafia/calamine) | **MIT** | Lecture de fichiers XLSX/ODS en Rust. Pattern pour l'import de plans comptables et d'ecritures. |
| **csv** (github.com/BurntSushi/rust-csv) | **MIT/Unlicense** | Parsing CSV en Rust. Import FEC et releves bancaires. |

### Pattern d'implementation recommande
1. **Types monetaires** : `rust_decimal::Decimal` (MIT) pour tous les montants. JAMAIS de `f64` pour la comptabilite. PostgreSQL `NUMERIC(15,2)` cote base.
2. **Double-entry engine** : structure `Entry { lines: Vec<EntryLine> }` avec contrainte `sum(debit) == sum(credit)` validee avant insertion. Transaction PostgreSQL pour l'atomicite.
3. **Plan comptable** : table `accounts` avec `parent_id` (arbre) et `account_number` (VARCHAR, pas INT, pour supporter les sous-comptes `411001`). Index sur `account_number` pour les recherches.
4. **FEC export** : serialisation CSV avec les 18 colonnes obligatoires. Validation de conformite (pas de trou dans la numerotation, dates coherentes).
5. **Rapprochement bancaire** : algorithme de matching base sur `(amount_exact AND date_close) OR (reference_match)`. Score de confiance = somme ponderee des criteres.
6. **Rapports financiers** : requetes SQL aggregees avec `GROUP BY account_class` et `SUM(debit) - SUM(credit)`. Materialised views pour les rapports frequents.
7. **Import CSV** : `csv` crate (MIT) + mapping configurable. Preview des 10 premieres lignes avant insertion.

### Ce qu'il ne faut PAS faire
- **Pas de floating point** (`f64`, `f32`) pour les montants — erreurs d'arrondi inacceptables en comptabilite.
- **Pas de suppression physique** des ecritures validees — obligation legale de tracabilite.
- **Pas de copier-coller** depuis les projets ci-dessus, meme MIT. On s'inspire des patterns, on reecrit.
- **Pas de dependance GPL/AGPL** — meme comme dependance transitive (cargo deny bloque).
- **Pas de connexion bancaire non-securisee** — uniquement via des APIs certifiees DSP2 avec chiffrement TLS.
- **Pas de stockage de secrets bancaires** en clair — credentials chiffres dans le vault.

---

## Assertions E2E cles (a tester)

- Affichage du plan comptable hierarchique avec les 7 classes PCG
- Drag-reorder d'un compte dans l'arbre avec persistence du nouvel ordre
- Seeding du plan comptable PCG (312 comptes crees en < 2s)
- Creation d'un compte, modification du libelle, desactivation
- Saisie d'une ecriture multi-lignes equilibree (debit = credit)
- Rejet d'une ecriture desequilibree (message d'erreur explicite, bouton desactive)
- Validation inline du formulaire debit/credit (ecart affiche en temps reel)
- Application d'un modele d'ecriture pre-rempli
- Generation automatique d'ecritures depuis une facture client
- Import d'un releve bancaire CSV et affichage dans la vue de rapprochement
- Rapprochement automatique d'une operation bancaire avec une ecriture
- Rapprochement manuel par drag-and-drop
- Creation d'une ecriture depuis une operation bancaire non-rapprochee
- Affichage du bilan comptable (Actif = Passif)
- Affichage du compte de resultat avec calcul du resultat net
- Balance generale auto-generee avec totaux equilibres
- Grand Livre avec infinite scroll (chargement de 100 ecritures a la fois)
- Export de la balance generale en PDF
- Affichage du Grand Livre avec drill-down vers les ecritures
- Creation d'une facture client avec calcul TVA automatique
- Suivi du paiement d'une facture (lettrage automatique)
- Saisie d'une note de frais avec OCR de recu
- Workflow d'approbation de note de frais (soumission → approbation → remboursement)
- Creation d'un budget previsionnel avec saisie mensuelle
- Comparaison budget vs realise avec code couleur
- Prevision de tresorerie sur 6 mois
- Multi-devises : saisie d'une ecriture en USD avec conversion EUR
- Calcul automatique de la TVA collectee et deductible
- Configuration d'un code TVA avec comptes associes
- Export FEC avec les 18 colonnes obligatoires
- Cloture d'exercice avec generation des a-nouveaux
- Import CSV d'ecritures avec detection de doublons
- Registre des immobilisations avec calcul d'amortissement
- Gestion des exercices fiscaux (creation, cloture, verrouillage)
- Business card KPI avec les montants corrects et mise a jour temps reel
- Export PDF d'un rapport avec en-tete societe
