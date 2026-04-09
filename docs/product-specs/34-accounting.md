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
Affichage en arbre a gauche de l'ecran. Structure PCG par defaut :
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

Chaque compte affiche : numero, libelle, type (actif/passif/charge/produit), solde debiteur/crediteur, nombre d'ecritures.

### 1.2 Business card recapitulative
Carte en haut de la page avec les KPIs cles :
- **Capital social** : 50 000 EUR
- **Report a nouveau** : 8 000 EUR
- **Chiffre d'affaires services** : 120 000 EUR
- **Chiffre d'affaires produits** : 80 000 EUR
- **Cout des marchandises vendues** : 40 000 EUR
- **Solde total** : 500 400 EUR

Chaque KPI est cliquable pour naviguer vers le detail du compte.

### 1.3 Recherche et filtrage de comptes
Barre de recherche en haut de l'arbre : recherche par numero (`411`), par libelle (`client`), par type (`charge`). Filtres rapides : `Actifs uniquement`, `Passifs uniquement`, `Comptes avec mouvements`, `Comptes a solde non nul`. Resultats en surbrillance dans l'arbre.

### 1.4 Gestion des comptes (CRUD)
Bouton `+ Nouveau compte` ouvre un formulaire : numero (auto-suggere selon la classe parente), libelle, type, devise, commentaire. Modification du libelle et du type a tout moment (le numero est immutable une fois qu'une ecriture existe). Desactivation d'un compte (masque dans les listes mais conserve l'historique). Suppression uniquement si aucune ecriture.

### 1.5 Comptes auxiliaires (tiers)
Sous-comptes par tiers : `411001 — Client Dupont`, `411002 — Client Martin`. Ouverture automatique lors de la premiere facture d'un nouveau client/fournisseur. Lettrage automatique (rapprochement facture/paiement) sur les comptes auxiliaires.

### 1.6 Import de plan comptable
Import CSV ou FEC pour charger un plan comptable existant. Mapping des colonnes avec preview. Detection des doublons et des conflits de numerotation. Mode `fusion` (ajoute les manquants) ou `remplacement` (ecrase tout).

### 1.7 Multi-plans comptables
Support de plans comptables alternatifs : PCG (France), plan OHADA (Afrique), IFRS, plan suisse, plan belge. Selection a la creation de l'organisation. Possibilite de maintenir un plan local et un plan IFRS en parallele (mapping entre les deux).

---

## Categorie 2 — Saisie d'ecritures (Journal Entries)

### 2.1 Journal de saisie
Ecran principal de saisie en tableau : date, piece (numero auto ou manuel), libelle, compte debit, montant debit, compte credit, montant credit, lettrage. Ligne de totalisation en bas avec controle d'equilibre (total debit = total credit). Bordure rouge si desequilibre.

### 2.2 Saisie multi-lignes
Une ecriture peut comporter N lignes (ex: facture avec TVA = 3 lignes : charge HT, TVA deductible, fournisseur TTC). Bouton `+ Ligne` pour ajouter, glisser pour reordonner, croix pour supprimer. Autocomplement sur les numeros de compte avec recherche fuzzy.

### 2.3 Modeles d'ecritures (templates)
Creer des modeles pour les ecritures recurrentes : `Loyer mensuel`, `Salaires`, `Abonnement serveur`. Un modele pre-remplit les comptes et les libelles, l'utilisateur ajuste les montants. Bouton `Appliquer un modele` dans la barre d'outils.

### 2.4 Ecritures automatiques
Les modules adjacents generent des ecritures automatiquement :
- **Factures clients** → debit 411 (Client), credit 701 (Ventes) + credit 44571 (TVA collectee)
- **Factures fournisseurs** → debit 601 (Achats) + debit 44566 (TVA deductible), credit 401 (Fournisseur)
- **Notes de frais** → debit 625 (Deplacements), credit 421 (Personnel)
- **Paiements recus** → debit 512 (Banque), credit 411 (Client)
- **Paiements emis** → debit 401 (Fournisseur), credit 512 (Banque)

Chaque ecriture auto porte une reference vers le document source (lien cliquable).

### 2.5 Journaux comptables
Organisation par journaux : `Achats (HA)`, `Ventes (VE)`, `Banque (BQ)`, `Caisse (CA)`, `Operations diverses (OD)`, `A-nouveaux (AN)`. Chaque ecriture est rattachee a un journal. Filtrage par journal dans la vue principale. Creation de journaux personnalises.

### 2.6 Pieces justificatives
Chaque ecriture peut avoir une ou plusieurs pieces jointes (PDF, image). Drag-and-drop depuis le bureau ou depuis le module Drive. OCR automatique pour extraire date, montant, numero de facture et pre-remplir les champs. Lien vers la piece dans le detail de l'ecriture.

### 2.7 Validation et verrouillage
Workflow de validation : `Brouillon` → `Valide` → `Cloture`. Une ecriture validee n'est plus modifiable (seulement contre-passable). Une ecriture cloturee fait partie de l'exercice clos. Bouton `Contre-passer` genere l'ecriture inverse avec reference a l'originale.

### 2.8 Numerotation des pieces
Numerotation sequentielle automatique par journal et par exercice : `VE-2026-0001`, `HA-2026-0001`. Pas de trou dans la sequence (obligation legale francaise). Affichage d'un warning si un numero est manquant.

### 2.9 Saisie rapide au clavier
Navigation complete au clavier : Tab entre les champs, Entree pour valider la ligne et passer a la suivante, Echap pour annuler. Raccourcis : `Ctrl+S` sauvegarde, `Ctrl+N` nouvelle ecriture, `Ctrl+D` duplique la derniere ligne.

### 2.10 Import d'ecritures en masse
Import CSV/FEC avec mapping des colonnes, detection des doublons (meme date + montant + compte), preview avant validation. Mode `simulation` pour verifier l'equilibre et les comptes avant insertion.

---

## Categorie 3 — Rapprochement bancaire (Bank Reconciliation)

### 3.1 Import des releves bancaires
Import de fichiers OFX, QIF, CSV, CAMT.053 (format SEPA), MT940. Drag-and-drop ou connexion bancaire directe (Open Banking / DSP2). Parsing automatique : date, libelle, montant, reference.

### 3.2 Vue de rapprochement
Ecran en deux colonnes : a gauche les operations bancaires (releve), a droite les ecritures comptables du compte 512. Matching automatique par montant exact + date proche. Les operations rapprochees passent en vert, les non-rapprochees restent en blanc.

### 3.3 Rapprochement automatique (matching IA)
Algorithme de matching multi-criteres : montant exact, date +/- 3 jours, libelle fuzzy (Levenshtein), reference de facture. Score de confiance affiche. Auto-rapprochement au-dessus de 95% de confiance, suggestion manuelle en-dessous.

### 3.4 Rapprochement manuel
Drag-and-drop d'une operation bancaire vers une ecriture comptable pour les rapprocher. Selection multiple pour rapprocher une operation bancaire avec plusieurs ecritures (ex: virement groupe). Split d'une operation pour la ventiler sur plusieurs comptes.

### 3.5 Creation d'ecritures depuis le releve
Pour une operation bancaire sans ecriture correspondante : bouton `Creer l'ecriture`. Pre-remplissage avec le montant et la date. L'utilisateur choisit le compte de contrepartie. Regles de categorisation memorisees : "SNCF" → 625 Deplacements, "AMAZON" → 606 Fournitures.

### 3.6 Regles de categorisation automatique
Panneau `Regles` : definir des correspondances libelle → compte comptable. Conditions : contient, commence par, regex, montant entre. Priorite des regles. Application automatique aux futures operations. Import/export des regles.

### 3.7 Etat de rapprochement
Tableau de bord : nombre d'operations rapprochees vs non-rapprochees, ecart (solde bancaire vs solde comptable), graphique d'evolution de l'ecart dans le temps. Alerte si ecart > seuil configurable.

### 3.8 Multi-comptes bancaires
Onglets par compte bancaire (Compte courant, Compte epargne, Compte devise). Chaque compte a son propre flux de rapprochement. Vue consolidee tous comptes.

### 3.9 Historique de rapprochement
Chaque rapprochement est date et attribue a un utilisateur. Possibilite de de-rapprocher une operation (audit trail conserve). Export de l'etat de rapprochement en PDF pour l'expert-comptable.

---

## Categorie 4 — Bilan et Compte de resultat (Balance Sheet & P&L)

### 4.1 Bilan comptable
Presentation normee en deux colonnes : Actif (immobilisations, actif circulant, tresorerie) et Passif (capitaux propres, provisions, dettes). Calcul automatique depuis les soldes des comptes. Drill-down : clic sur un poste → detail des comptes → detail des ecritures.

### 4.2 Compte de resultat
Presentation en cascade : Produits d'exploitation - Charges d'exploitation = Resultat d'exploitation. + Produits financiers - Charges financieres = Resultat financier. + Produits exceptionnels - Charges exceptionnelles = Resultat exceptionnel. Resultat net = somme des trois. Affichage en pourcentage du CA.

### 4.3 Balance generale
Tableau de tous les comptes avec colonnes : numero, libelle, total debit, total credit, solde debiteur, solde crediteur. Totaux en bas (debit = credit). Filtres par classe, par periode, par journal. Export PDF/CSV/XLSX.

### 4.4 Grand Livre
Detail de toutes les ecritures par compte, ordonnees chronologiquement. Pour chaque ligne : date, piece, libelle, journal, debit, credit, solde cumule. Filtre par compte, par periode, par journal. Navigation vers l'ecriture source.

### 4.5 Balance agee (clients et fournisseurs)
Tableau des creances clients et dettes fournisseurs ventilees par anciennete : 0-30 jours, 31-60 jours, 61-90 jours, 91-120 jours, > 120 jours. Total par tranche. Indicateur visuel (vert/orange/rouge). Identification des impasses pour relance.

### 4.6 Comparaison N/N-1
Chaque rapport affiche en parallele l'exercice courant et le precedent, avec la variation en montant et en pourcentage. Colonnes additionnelles optionnelles : N-2, budget previsionnel. Highlight des variations significatives (>10%).

### 4.7 Rapports personnalises
Constructeur de rapports : choisir les comptes a inclure, les periodes, le niveau de detail (compte, sous-compte, ecriture), le mode de presentation (tableau, graphique). Sauvegarder comme modele reutilisable. Planification d'envoi automatique par email.

### 4.8 Soldes intermediaires de gestion (SIG)
Calcul automatique des SIG : marge commerciale, production de l'exercice, valeur ajoutee, EBE (Excedent Brut d'Exploitation), resultat d'exploitation, resultat courant avant impots, resultat exceptionnel, resultat net. Presentation en cascade avec graphique.

### 4.9 Export PDF avec mise en page professionnelle
Generation de PDF avec en-tete societe (logo, raison sociale, SIRET, adresse), pied de page (date de generation, page X/Y), mise en page comptable normee. Templates : format expert-comptable, format dirigeant (simplifie), format banque.

### 4.10 Tableaux de bord en temps reel
Dashboard avec widgets : tresorerie du jour, CA mensuel (graphique barres), charges par categorie (camembert), resultat net glissant (courbe), top 10 clients, top 10 fournisseurs. Actualisation automatique a chaque ecriture.

---

## Categorie 5 — Factures clients et fournisseurs

### 5.1 Creation de facture client
Formulaire : client (autocompletion depuis Contacts), date, echeance, lignes de facturation (designation, quantite, prix unitaire, TVA, remise, total HT). Calcul automatique du total HT, TVA, TTC. Numerotation sequentielle obligatoire (`FA-2026-0001`).

### 5.2 Modeles de factures
Templates de mise en page : classique, moderne, minimaliste. Personnalisation : logo, couleurs, mentions legales, conditions de paiement, RIB, message personnalise. Preview PDF temps reel.

### 5.3 Factures recurrentes
Creer une facture modele avec frequence (mensuelle, trimestrielle, annuelle) et date de fin. Generation automatique a la date prevue. Notification avant generation pour revision. Historique des factures generees.

### 5.4 Gestion des avoirs
Creer un avoir lie a une facture : total ou partiel. L'avoir annule (ou reduit) la creance client et genere les ecritures inverses. Numerotation specifique (`AV-2026-0001`).

### 5.5 Suivi des paiements
Tableau de bord des factures : emises, en attente, en retard, payees. Enregistrement du paiement (date, montant, mode : virement, cheque, carte, especes). Paiement partiel supporte. Lettrage automatique facture/paiement.

### 5.6 Relances automatiques
Configuration de scenarios de relance : J+7 (rappel amical), J+15 (relance formelle), J+30 (mise en demeure). Envoi automatique par email via le module Mail. Templates personnalisables par etape. Historique des relances par client.

### 5.7 Factures fournisseurs (achats)
Saisie manuelle ou OCR (scan/photo → extraction date, fournisseur, montant, TVA, numero). Validation par workflow (soumission → approbation → comptabilisation). Rapprochement avec bon de commande si applicable.

### 5.8 Integration comptable
Chaque facture validee genere automatiquement les ecritures comptables (cf. 2.4). Lien bidirectionnel : depuis l'ecriture, naviguer vers la facture source. Depuis la facture, voir les ecritures generees.

---

## Categorie 6 — Notes de frais (Expense Reports)

### 6.1 Saisie de depense
Formulaire : date, categorie (deplacement, repas, hebergement, fournitures, telephone, autre), montant TTC, montant TVA (calcul auto selon taux), description, piece justificative (photo/PDF). Saisie depuis mobile avec photo du recu.

### 6.2 OCR des recus
Photo ou scan d'un recu → extraction automatique : date, montant, nom du commercant, taux de TVA. Pre-remplissage du formulaire. Correction manuelle si besoin. Piece jointe archivee automatiquement.

### 6.3 Notes de frais groupees
Regrouper plusieurs depenses dans une note de frais mensuelle. Tableau recapitulatif avec totaux par categorie. Ajout/suppression de lignes. Soumission en bloc pour approbation.

### 6.4 Workflow d'approbation
Circuit de validation configurable : employe → manager → comptabilite. Notifications a chaque etape. Approbation, rejet (avec motif), demande de modification. Historique complet des actions.

### 6.5 Baremes kilometriques
Saisie d'un trajet : depart, arrivee, distance (calcul auto via API cartographique ou saisie manuelle), puissance fiscale du vehicule. Calcul automatique de l'indemnite selon le bareme fiscal en vigueur. Mise a jour annuelle du bareme.

### 6.6 Plafonds et politiques
Definition de politiques par categorie : plafond repas (ex: 20 EUR), plafond hebergement par ville, categories autorisees par role. Alerte si depassement. Blocage ou avertissement selon la severite.

### 6.7 Remboursement
Generation automatique de l'ordre de virement pour remboursement des notes approuvees. Integration avec le module bancaire. Ecriture comptable automatique (debit 625, credit 421).

### 6.8 Tableau de bord des depenses
Graphiques : depenses par categorie (camembert), evolution mensuelle (barres), top 10 depensiers, depenses par departement. Filtres par periode, par employe, par categorie. Export CSV/PDF.

---

## Categorie 7 — Budget previsionnel (Budget Forecasting)

### 7.1 Creation de budget
Formulaire : exercice, nom du budget, type (exploitation, investissement, tresorerie). Grille de saisie par compte comptable et par mois (12 colonnes). Pre-remplissage optionnel depuis le realise N-1. Saisie par montant ou par formule (ex: `N-1 * 1.05` pour +5%).

### 7.2 Versions de budget
Plusieurs versions par exercice : budget initial, budget revise Q1, budget revise Q2. Comparaison entre versions. Verrouillage de la version validee.

### 7.3 Suivi budgetaire (realise vs budget)
Tableau mensuel : budget, realise, ecart en montant, ecart en pourcentage. Code couleur : vert (<5% d'ecart), orange (5-15%), rouge (>15%). Drill-down du realise vers les ecritures.

### 7.4 Alertes de depassement
Notifications automatiques quand un poste budgetaire depasse un seuil (80%, 100%, 120%). Destinataires configurables par poste. Historique des alertes.

### 7.5 Budget par centre de cout
Repartition du budget par departement, projet ou activite. Chaque centre de cout a son propre budget. Consolidation au niveau de l'entreprise.

### 7.6 Previsions glissantes (rolling forecast)
Mise a jour trimestrielle : les mois ecoules sont remplaces par le realise, les mois futurs sont re-previsionnes. Graphique d'evolution des previsions dans le temps.

### 7.7 Scenarios what-if
Creation de scenarios : optimiste, pessimiste, base. Modification des hypotheses (taux de croissance, couts, effectifs). Comparaison visuelle des scenarios sur un meme graphique.

---

## Categorie 8 — Cash Flow et tresorerie

### 8.1 Tableau de flux de tresorerie
Presentation normee : flux d'exploitation, flux d'investissement, flux de financement. Calcul automatique depuis les ecritures bancaires. Solde de debut, variation, solde de fin.

### 8.2 Prevision de tresorerie
Projection sur 3, 6 ou 12 mois : encaissements prevus (factures clients en cours + recurrentes) - decaissements prevus (factures fournisseurs + charges fixes + echeances). Graphique courbe avec zone de confort/danger.

### 8.3 Echeancier
Liste chronologique des encaissements et decaissements a venir : date, libelle, montant, source (facture, charge recurrente, echeance d'emprunt). Filtre par type, par montant minimum. Export calendrier (iCal).

### 8.4 Cash burn rate
Pour les startups : calcul automatique du burn rate mensuel (depenses - revenus), tresorerie restante, nombre de mois de runway. Alerte quand runway < 6 mois.

### 8.5 Multi-devises
Gestion des comptes en devises etrangeres (USD, GBP, CHF). Taux de change automatique (BCE) ou manuel. Ecarts de conversion comptabilises. Tableau de tresorerie consolide en devise de reference.

### 8.6 Graphiques de tresorerie
Courbe de tresorerie historique + previsionnelle sur 12 mois. Barres empilees encaissements/decaissements par mois. Heatmap des jours de tension (solde bas). Widget dashboard avec solde du jour et tendance.

---

## Categorie 9 — Declaration TVA et conformite

### 9.1 Calcul automatique de la TVA
Collecte automatique de la TVA collectee (comptes 4457x) et deductible (comptes 4456x) sur la periode. Calcul du solde : TVA a payer ou credit de TVA. Ventilation par taux (20%, 10%, 5.5%, 2.1%).

### 9.2 Declaration CA3 (mensuelle/trimestrielle)
Pre-remplissage du formulaire CA3 depuis les ecritures comptables. Verification des montants avec drill-down. Validation par le responsable. Export au format EDI pour tele-declaration. Historique des declarations.

### 9.3 Declaration CA12 (annuelle simplifiee)
Pour les entreprises au regime simplifie. Calcul des acomptes trimestriels et de la regularisation annuelle. Pre-remplissage et export.

### 9.4 Export FEC (Fichier des Ecritures Comptables)
Generation du FEC au format normatif (article A.47 A-1 du LPF). Contenu obligatoire : JournalCode, JournalLib, EcritureNum, EcritureDate, CompteNum, CompteLib, CompAuxNum, CompAuxLib, PieceRef, PieceDate, EcritureLib, Debit, Credit, EcritureLet, DateLet, ValidDate, Montantdevise, Idevise. Validation de conformite avant export.

### 9.5 Piste d'audit
Tracabilite complete de chaque ecriture : qui a cree, modifie, valide, quand, depuis quelle source (facture, saisie manuelle, import). Aucune suppression possible apres validation. Conformite avec les exigences du controle fiscal informatise (CFI).

### 9.6 Cloture d'exercice
Assistant de cloture : verification de l'equilibre general, controle des comptes d'attente (solde = 0), generation des ecritures d'inventaire (amortissements, provisions, charges a payer, produits constates d'avance), calcul du resultat, generation des a-nouveaux. Verrouillage definitif de l'exercice.

### 9.7 Archivage legal
Conservation des pieces justificatives et des ecritures pendant 10 ans (obligation legale). Archivage horodate et signe electroniquement. Acces en lecture seule aux exercices clos.

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
Endpoints pour integrations tierces : `GET /api/v1/accounting/accounts`, `POST /api/v1/accounting/entries`, `GET /api/v1/accounting/balance`. Auth JWT. Documentation OpenAPI. Rate limiting.

### 10.7 Synchronisation expert-comptable
Mode collaboratif : l'expert-comptable accede au dossier en temps reel. Annotations et commentaires sur les ecritures. Chat integre pour les questions. Export du dossier de revision annuel.

---

## Categorie 11 — Immobilisations et amortissements

### 11.1 Registre des immobilisations
Liste de tous les actifs immobilises : designation, date d'acquisition, valeur d'origine, duree d'amortissement, methode (lineaire, degressif), valeur nette comptable. Filtres par categorie (materiel, mobilier, vehicules, logiciels, brevets).

### 11.2 Calcul automatique des amortissements
Generation mensuelle ou annuelle des dotations aux amortissements. Methode lineaire (repartition egale) ou degressive (coefficient fiscal). Tableau d'amortissement par immobilisation avec cumul.

### 11.3 Cession et mise au rebut
Enregistrement de la cession : date, prix de cession, calcul de la plus/moins-value. Ecritures automatiques : sortie de l'actif, reprise des amortissements, constatation du resultat de cession. Mise au rebut : valeur de cession = 0.

### 11.4 Ecritures automatiques d'amortissement
Les dotations generent automatiquement les ecritures comptables : debit 681 (Dotations), credit 28x (Amortissements). Integration avec la cloture d'exercice.

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
- Creation d'un compte, modification du libelle, desactivation
- Saisie d'une ecriture multi-lignes equilibree (debit = credit)
- Rejet d'une ecriture desequilibree (message d'erreur explicite)
- Application d'un modele d'ecriture pre-rempli
- Generation automatique d'ecritures depuis une facture client
- Import d'un releve bancaire CSV et affichage dans la vue de rapprochement
- Rapprochement automatique d'une operation bancaire avec une ecriture
- Rapprochement manuel par drag-and-drop
- Creation d'une ecriture depuis une operation bancaire non-rapprochee
- Affichage du bilan comptable (Actif = Passif)
- Affichage du compte de resultat avec calcul du resultat net
- Export de la balance generale en PDF
- Affichage du Grand Livre avec drill-down vers les ecritures
- Creation d'une facture client avec calcul TVA automatique
- Suivi du paiement d'une facture (lettrage automatique)
- Saisie d'une note de frais avec OCR de recu
- Workflow d'approbation de note de frais (soumission → approbation → remboursement)
- Creation d'un budget previsionnel avec saisie mensuelle
- Comparaison budget vs realise avec code couleur
- Prevision de tresorerie sur 6 mois
- Calcul automatique de la TVA collectee et deductible
- Export FEC avec les 18 colonnes obligatoires
- Cloture d'exercice avec generation des a-nouveaux
- Import CSV d'ecritures avec detection de doublons
- Registre des immobilisations avec calcul d'amortissement
- Business card KPI avec les montants corrects
