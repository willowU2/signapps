# Module Supply Chain (Chaine d'approvisionnement) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **SAP S/4HANA** | ERP complet, gestion des stocks en temps reel, planification MRP, integration fournisseurs, warehouse management, analytics predictifs, multi-site, multi-devise, conformite reglementaire |
| **Oracle NetSuite** | ERP cloud, inventory management, order management, procurement, demand planning, warehouse management, supply chain intelligence, global business management |
| **Odoo Inventory** | Open source, multi-warehouse, barcode scanning, routes automatiques (reception → stockage → expedition), lot/serial tracking, rapports de valorisation, integration achat/vente |
| **InFlow Inventory** | PME-friendly, tracking par lot/serial, assemblage, transferts inter-entrepots, commandes fournisseurs, rapports de stock, barcode scanning, integration ecommerce |
| **Sortly** | Inventaire visuel (photos), QR codes, dossiers hierarchiques, alertes de stock bas, rapports, app mobile, checkin/checkout, champs personnalises |
| **Cin7** | Omnichannel inventory, B2B/B2C, points de vente, 3PL integration, production, purchase orders, stock forecasting, multi-warehouse, EDI |
| **Fishbowl** | Integration QuickBooks, manufacturing, inventory tracking, barcode, shipping, purchase orders, multi-warehouse, work orders, BOM management |
| **Zoho Inventory** | Multi-canal, serial/batch tracking, dropship, backorder, rapports, integration Zoho ecosystem, barcode, composite items, warehouse management |

## Principes directeurs

1. **Hub de navigation** — la page principale est un hub qui dirige vers les 7 sous-modules (Carte entrepot, Inventaire, Bons de commande, Reception/Expedition, Alertes stock, Portail fournisseurs, Suivi livraisons). Chaque sous-module est une page dediee.
2. **Visuel d'abord** — la carte de l'entrepot (warehouse map) permet de visualiser les zones de stockage, leur taux de remplissage, et les items presents. L'inventaire est enrichi de badges couleur pour les seuils.
3. **Workflow d'achat complet** — du bon de commande (draft → pending → approved → received) a la reception physique avec verification des quantites. Integration fournisseurs via le portail.
4. **Alertes proactives** — les seuils de stock bas et les ruptures sont detectes automatiquement et affiches dans un panneau d'alertes avec priorite et actions suggerees.

---

## Categorie 1 — Carte de l'entrepot (Warehouse Map)

### 1.1 Vue en grille de zones
Le warehouse map affiche une grille 2D representant les zones physiques de l'entrepot. Chaque zone est un rectangle colore par type : stockage (bleu), reception (vert), expedition (jaune), froid (cyan), bureau (violet), vide (gris).

### 1.2 Taux de remplissage par zone
Chaque zone affiche une barre de progression (capacite utilisee / capacite totale). Couleur verte si <70%, orange si 70-90%, rouge si >90%. Tooltip avec le detail des items presents.

### 1.3 Detail d'une zone
Clic sur une zone ouvre un panneau lateral avec : code, nom, type, capacite, taux utilise, liste des items stockes, derniere mise a jour.

### 1.4 Ajout/edition de zone
Formulaire de creation : code, nom, type (select), capacite, position dans la grille (row/col/width/height). Edition des parametres d'une zone existante.

### 1.5 Recherche dans le warehouse
Barre de recherche qui localise un item dans le warehouse et met en surbrillance la zone qui le contient.

---

## Categorie 2 — Inventaire

### 2.1 Table d'inventaire
Tableau avec colonnes : SKU, Nom, Categorie, Quantite, Min/Max seuils, Emplacement, Unite, Dernier mouvement, Cout unitaire, Valeur totale. Tri et filtre par colonne.

### 2.2 Mouvements de stock
Onglets : Stock actuel, Entrees, Sorties, Transferts. Chaque mouvement enregistre : date, item, type (in/out/transfer), quantite, source, destination, motif, operateur.

### 2.3 Ajout de mouvement
Formulaire : item (select), type (entree/sortie/transfert), quantite, motif, source et destination (pour les transferts). Mise a jour automatique de la quantite en stock.

### 2.4 Alertes de seuil
Les items dont la quantite est sous le seuil minimum sont flagges en rouge. Les items a zero sont flagges comme `Rupture`. Compteurs d'alertes dans l'en-tete.

### 2.5 Recherche et filtres
Recherche par SKU, nom, categorie. Filtres par categorie, emplacement, statut (normal, alerte, rupture).

### 2.6 Valorisation du stock
Calcul automatique de la valeur totale de l'inventaire (quantite x cout unitaire). Affiche en KPI en haut de page.

---

## Categorie 3 — Bons de commande (Purchase Orders)

### 3.1 Table des bons de commande
Tableau avec colonnes : Numero PO, Fournisseur, Statut, Items, Total, Date creation, Demandeur, Actions. Tri par date et statut.

### 3.2 Workflow de statut
Cycle de vie : Draft → Pending Approval → Approved → Received (ou Rejected). Badges colores par statut. Commentaires a chaque changement de statut.

### 3.3 Creation de bon de commande
Formulaire : fournisseur (select ou texte), items (lignes dynamiques avec description, quantite, prix unitaire), notes. Calcul automatique du total. Attribution d'un numero sequentiel.

### 3.4 Approbation
Le manager approuve ou rejette un PO en attente. Commentaire optionnel. Notification a l'auteur du PO.

### 3.5 Reception
A la livraison, le PO passe en `Received`. Verification des quantites recues vs commandees. Ecarts signales. Mise a jour automatique de l'inventaire.

---

## Categorie 4 — Reception, expedition et suivi

### 4.1 Reception de marchandises
Formulaire de reception : numero PO ou arrivage ad-hoc, items recus, quantites, controle qualite (conforme/non-conforme), zone de stockage cible. Mise a jour immediate de l'inventaire.

### 4.2 Expedition
Formulaire d'expedition : items, quantites, destination, transporteur, numero de suivi. Deduction automatique du stock. Generation d'un bon de livraison.

### 4.3 Suivi des livraisons
Table des livraisons en cours : numero, fournisseur/client, transporteur, date prevue, statut (en transit, livre, retard). Lien vers le tracking du transporteur si disponible.

### 4.4 Alertes de retard
Detection automatique des livraisons en retard (date prevue depassee). Notification au responsable.

---

## Categorie 5 — Portail fournisseurs et reporting

### 5.1 Portail fournisseurs
Page dediee listant les fournisseurs : nom, contact, email, telephone, categorie de produits, nombre de POs, total commande, note qualite. Ajout, edition, suppression.

### 5.2 Fiche fournisseur
Detail d'un fournisseur avec historique des commandes, delais de livraison moyens, taux de conformite, contact principal. Liens vers les POs associes.

### 5.3 Catalogue produits
Table des produits referencables dans les bons de commande : reference, nom, description, fournisseur(s), prix unitaire, unite, categorie. Import CSV pour le referentiel.

### 5.4 Rapports de stock
Rapports pre-configures : valorisation du stock par zone, rotation des stocks (items les plus/moins mouvementes), historique des ruptures, previsions de reapprovisionnement.

### 5.5 Export des rapports
Export CSV, Excel ou PDF des rapports de stock, des mouvements, et des bons de commande. Utile pour la comptabilite et l'audit.

### 5.6 Notifications et alertes
Notifications automatiques : stock bas (push), PO en attente d'approbation (push + email), livraison en retard (push + email). Configurable par l'admin.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Odoo Inventory Documentation** (www.odoo.com/documentation/17.0/applications/inventory_and_mrp) — warehouse, routes, barcode, rapports.
- **InFlow Documentation** (www.inflowinventory.com/support) — inventaire, commandes, rapports.
- **Sortly Help Center** (help.sortly.com) — inventaire visuel, QR codes, alertes.
- **Zoho Inventory Help** (www.zoho.com/inventory/help) — multi-canal, tracking, integration.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Part-DB** (github.com/Part-DB/Part-DB-server) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Gestion d'inventaire de composants. |
| **InvenTree** (github.com/inventree/InvenTree) | **MIT** | Reference principale. Inventaire open source, BOM, fournisseurs, commandes, stock tracking. |
| **erpnext** (github.com/frappe/erpnext) | **GPL-3.0** | **INTERDIT** — reference pedagogique uniquement. ERP avec module supply chain. |
| **Snipe-IT** (github.com/snipe/snipe-it) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Asset management. |
| **BoxBilling** (github.com/boxbilling/boxbilling) | **Apache-2.0** | Pattern pour les commandes et la facturation. |
| **recharts** (github.com/recharts/recharts) | **MIT** | Graphiques React pour la visualisation des stocks et mouvements. |

---

## Assertions E2E cles (a tester)

- Page Supply Chain hub → les 7 sous-modules sont affiches en cartes cliquables
- Warehouse Map → les zones s'affichent en grille avec couleurs par type
- Clic sur une zone → le detail s'ouvre avec capacite et items
- Inventaire → la table des items s'affiche avec SKU, quantite, seuils
- Item sous seuil minimum → badge alerte rouge visible
- Ajouter un mouvement d'entree → la quantite en stock augmente
- Ajouter un mouvement de sortie → la quantite en stock diminue
- Creer un bon de commande → il apparait dans la table avec statut `Draft`
- Soumettre un PO → statut passe a `Pending Approval`
- Approuver un PO → statut passe a `Approved`
- Marquer un PO comme recu → inventaire mis a jour automatiquement
- Alertes stock → les items en rupture sont visibles dans le panneau d'alertes
