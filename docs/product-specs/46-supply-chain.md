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

## Categorie 1 — Hub et catalogue produits

### 1.1 Hub de navigation
Page principale `/supply-chain` affichant 7 cartes de navigation en grille (3 colonnes desktop, 2 tablette, 1 mobile). Chaque carte (200px hauteur, `border-radius: 12px`, ombre legere) contient :
- **Icone** grande (48px) representative du sous-module
- **Nom** du sous-module (gras, 16px)
- **Description** courte (1 ligne, `text-muted-foreground`)
- **Compteur** contextuel (ex: `42 items`, `3 PO en attente`, `2 alertes`)
- **Badge** d'alerte rouge si une action est requise

Les 7 sous-modules : Catalogue produits, Inventaire, Warehouse Map, Bons de commande, Reception & Expedition, Fournisseurs, Suivi livraisons. Clic sur une carte navigue vers la page dediee. Barre de KPIs en haut : `Valeur du stock: XXX EUR`, `PO en attente: X`, `Alertes stock: X`, `Livraisons en cours: X`.

### 1.2 Catalogue produits
Page `/supply-chain/catalog` avec table des produits referencables :
- **SKU** : code unique (texte, max 30 caracteres, uppercase force). Triable.
- **Nom** : nom du produit (texte, max 200 caracteres). Triable.
- **Categorie** : badge colore (select parmi les categories configurees). Filtrable.
- **Unite** : unite de mesure (select : `unite`, `kg`, `litre`, `metre`, `boite`, `palette`, custom)
- **Fournisseur(s)** : noms des fournisseurs lies (chips, max 3 affiches)
- **Prix unitaire** : montant en devise de reference. Triable.
- **Seuil de reapprovisionnement** (reorder point) : quantite sous laquelle une alerte est declenchee
- **Stock actuel** : quantite en stock (calculee depuis l'inventaire). Badge couleur : vert (>seuil), orange (=seuil), rouge (<seuil ou 0)
- **Actions** : editer, dupliquer, archiver

Bouton `+ Nouveau produit` ouvre un formulaire modal avec tous les champs ci-dessus + description (textarea), image (upload, preview), poids (nombre + unite), dimensions (L x l x H en cm), code-barres EAN/UPC (texte, scannable), fournisseurs (multi-select avec prix par fournisseur).

### 1.3 Import CSV du catalogue
Bouton `Importer` dans la barre d'actions. Upload d'un fichier CSV avec colonnes : `sku`, `name`, `category`, `unit`, `unit_price`, `reorder_point`, `description`, `barcode`. Dialogue de mapping : l'utilisateur mappe les colonnes du CSV aux champs du produit (auto-detection par nom de colonne). Preview des 5 premieres lignes. Validation : SKU unique (doublons signales en rouge), format de prix valide, categories connues (ou creation automatique des nouvelles). Bouton `Importer X produits` avec barre de progression.

### 1.4 Barcode scanning
Sur mobile et tablette, bouton `Scanner` dans la barre d'actions ouvre la camera pour scanner un code-barres (EAN-13, UPC-A, Code 128, QR code). Le scan identifie le produit dans le catalogue et ouvre sa fiche. Si le produit n'est pas trouve, propose de le creer avec le code-barres pre-rempli. Sur desktop, champ texte avec icone barcode qui accepte l'input d'un lecteur de code-barres USB (focus automatique, validation sur `Enter`).

### 1.5 Categories de produits
Configuration dans `Settings > Supply Chain > Categories`. Table des categories avec : nom, couleur, icone, nombre de produits. CRUD complet. Categories par defaut : `Electronique`, `Fournitures`, `Alimentaire`, `Textile`, `Chimie`, `Emballage`, `Autre`. Les categories sont hierarchiques (parent/enfant, 2 niveaux max). La categorie est obligatoire pour chaque produit.

---

## Categorie 2 — Inventaire et mouvements de stock

### 2.1 Table d'inventaire
Page `/supply-chain/inventory` avec table principale :
- **SKU** : code produit (lien vers la fiche produit)
- **Nom** : nom du produit
- **Categorie** : badge colore
- **Quantite en stock** : nombre (gras). Couleur : vert si > reorder point, orange si = reorder point, rouge si < reorder point ou 0
- **Seuil min** : reorder point
- **Seuil max** : quantite max recommandee (alertes surstock si depasse)
- **Emplacement** : zone de stockage (lien vers la warehouse map)
- **Unite** : unite de mesure
- **Cout unitaire** : prix d'achat moyen (CMUP - cout moyen unitaire pondere)
- **Valeur totale** : quantite x cout unitaire
- **Dernier mouvement** : date et type du dernier mouvement (entree/sortie/transfert)

KPIs en haut : `Articles en stock: X`, `Valeur totale: XXX EUR`, `Alertes stock bas: X`, `Articles en rupture: X`.

### 2.2 Mouvements de stock
Onglets sous la table d'inventaire : `Stock actuel`, `Entrees`, `Sorties`, `Transferts`, `Tous les mouvements`.

Table des mouvements avec colonnes :
- **Date** : timestamp du mouvement
- **Produit** : SKU + nom
- **Type** : badge `Entree` (vert, fleche vers le bas), `Sortie` (rouge, fleche vers le haut), `Transfert` (bleu, fleches bidirectionnelles), `Ajustement` (jaune, icone balance)
- **Quantite** : nombre (positif pour entree, negatif pour sortie)
- **Source** : d'ou vient le stock (fournisseur, zone source, PO numero)
- **Destination** : ou va le stock (zone cible, client, commande)
- **Motif** : raison du mouvement (reception PO, vente, transfert inter-zones, inventaire physique, casse, vol, peremption)
- **Operateur** : utilisateur qui a effectue le mouvement
- **Lot/Batch** : numero de lot (si applicable)

### 2.3 Ajout de mouvement
Bouton `+ Mouvement` ouvre un formulaire :
- **Produit** (select avec recherche SKU/nom, obligatoire)
- **Type** (select : Entree, Sortie, Transfert, Ajustement)
- **Quantite** (nombre positif, obligatoire)
- **Source** (select zone pour sortie/transfert, ou texte fournisseur pour entree)
- **Destination** (select zone pour entree/transfert)
- **Motif** (select : Reception PO, Vente, Transfert, Inventaire physique, Casse, Vol, Peremption, Retour, Autre)
- **Numero PO** (select, visible si motif = Reception PO)
- **Numero de lot** (texte, optionnel)
- **Date de peremption** (datepicker, optionnel)
- **Notes** (textarea, optionnel)

Validation : la sortie ne peut pas exceder le stock disponible (erreur `Stock insuffisant : X disponibles, Y demandes`). Le transfert decremente la source et incremente la destination atomiquement. Bouton `Enregistrer` met a jour l'inventaire en temps reel. Toast : `Mouvement enregistre : +X ${produit} → ${zone}`.

### 2.4 Lot / Batch tracking
Chaque entree de stock peut etre associee a un numero de lot (batch). Le lot contient : numero, date de fabrication (optionnel), date de peremption (optionnel), fournisseur, PO d'origine. L'inventaire par lot est consultable : pour un produit donne, liste des lots avec quantite restante par lot. Les sorties de stock suivent la methode FIFO (First In First Out) par defaut — le lot le plus ancien est consomme en premier. Methode configurable : FIFO, LIFO, FEFO (First Expired First Out — base sur la date de peremption).

### 2.5 Alertes de seuil
Les alertes sont declenchees automatiquement :
- **Stock bas** : quantite < reorder point. Severite `Warning` (orange)
- **Rupture** : quantite = 0. Severite `Critical` (rouge)
- **Surstock** : quantite > seuil max (si configure). Severite `Info` (bleu)
- **Peremption proche** : lot avec date de peremption dans les 30 jours. Severite `Warning`
- **Peremption depassee** : lot avec date depassee. Severite `Critical`

Les alertes sont affichees dans un panneau d'alertes accessible via l'icone cloche dans le hub. Chaque alerte contient : produit, severite, message, action suggeree (`Commander`, `Transferer`, `Ajuster`, `Retirer`). Notification push via signapps-notifications pour les alertes `Critical`. PgEventBus event `supplychain.alert.triggered { product_id, alert_type, severity, current_qty, threshold }`.

### 2.6 Valorisation du stock
Calcul automatique de la valeur totale de l'inventaire avec deux methodes :
- **CMUP** (Cout Moyen Unitaire Pondere) : (valeur stock + cout nouvelle entree) / (quantite stock + quantite entree). Par defaut.
- **FIFO** : la valeur est basee sur les couts des lots les plus anciens en stock
- **Derniere entree** : cout de la derniere entree

Configurable globalement dans `Settings > Supply Chain > Methode de valorisation`. Rapport de valorisation : tableau par categorie, par zone, par fournisseur avec totaux. Export PDF et XLSX.

### 2.7 Inventaire physique
Processus d'inventaire physique pour reconcilier le stock informatique avec le stock reel :
1. Bouton `Demarrer un inventaire` cree une session d'inventaire (date, zones concernees, operateurs)
2. Pour chaque produit/zone, l'operateur saisit la quantite physique constatee
3. Le systeme compare : quantite theorique vs quantite physique
4. Les ecarts sont affiches en tableau : produit, theorique, physique, ecart, ecart en valeur
5. L'admin valide les ajustements (cree automatiquement des mouvements de type `Ajustement`)
6. La session d'inventaire est cloturee avec un rapport PDF

---

## Categorie 3 — Carte de l'entrepot (Warehouse Map)

### 3.1 Vue en grille de zones
Page `/supply-chain/warehouse-map` affichant une grille 2D interactive representant les zones physiques de l'entrepot. Chaque zone est un rectangle positionne dans la grille (position row/col/width/height). Couleur par type :
- `storage` (bleu `#3B82F6`) — zones de stockage standard
- `receiving` (vert `#22C55E`) — zone de reception
- `shipping` (jaune `#EAB308`) — zone d'expedition
- `cold` (cyan `#06B6D4`) — stockage refrigere
- `hazardous` (rouge `#EF4444`) — matieres dangereuses
- `office` (violet `#8B5CF6`) — bureaux
- `empty` (gris `#9CA3AF`) — zones vides/non utilisees

Les zones sont dimensionnees proportionnellement a leur capacite. Les labels sont affiches au centre (code + nom). La grille est zoomable (molette) et pannable (drag).

### 3.2 Taux de remplissage par zone
Chaque zone affiche une barre de progression horizontale en bas du rectangle : capacite utilisee / capacite totale. Couleur dynamique :
- Vert (`#22C55E`) si < 70%
- Orange (`#F59E0B`) si 70-90%
- Rouge (`#EF4444`) si > 90%

Le pourcentage est affiche a droite de la barre (ex: `78%`). Tooltip au hover : `Zone A1 — Stockage. 78% (156/200 emplacements). 42 produits distincts.`.

### 3.3 Detail d'une zone
Clic sur une zone ouvre un panneau lateral droit (400px) avec :
- **En-tete** : code, nom, type (badge colore), capacite (`156/200`), taux (barre de progression)
- **Liste des items** : table compacte avec SKU, nom, quantite, lot, date de peremption. Triable par colonne. Recherche.
- **Derniere mise a jour** : date/heure du dernier mouvement dans cette zone
- **Actions** : `Ajouter un mouvement`, `Transferer tout`, `Exporter`

### 3.4 Ajout/edition de zone
Bouton `+ Nouvelle zone` (admin uniquement) ouvre un formulaire :
- **Code** (texte, unique, max 10 caracteres, ex: `A1`, `B2`, `COLD-1`)
- **Nom** (texte, max 100 caracteres, ex: `Rayonnage A rang 1`)
- **Type** (select parmi les types)
- **Capacite** (nombre, en unites de stockage)
- **Position grille** : row, col, width, height (drag-drop interactif sur la grille avec preview)
- **Temperature** (optionnel, pour les zones froides : min/max en degres)

Edition : memes champs, modifiables. Suppression : uniquement si la zone est vide (sinon erreur `La zone contient X items — transferez-les avant de supprimer`).

### 3.5 Recherche dans le warehouse
Barre de recherche en haut de la carte. Taper un SKU ou nom de produit met en surbrillance la zone qui le contient (border jaune epais pulsant pendant 3 secondes). Si le produit est dans plusieurs zones, toutes sont highlight avec la quantite affichee dans un badge flottant. Clic sur une zone highlight ouvre son detail.

### 3.6 Carte thermique (heatmap)
Toggle `Heatmap` en haut a droite. Active un mode ou les zones sont colorees par activite (nombre de mouvements sur les 30 derniers jours). Plus une zone est active, plus elle est rouge. Les zones inactives sont bleues. Utile pour optimiser le placement des produits a forte rotation pres de la zone d'expedition.

---

## Categorie 4 — Bons de commande (Purchase Orders)

### 4.1 Table des bons de commande
Page `/supply-chain/purchase-orders` avec table :
- **Numero PO** : identifiant sequentiel (`PO-2026-0042`). Lien vers le detail. Triable.
- **Fournisseur** : nom du fournisseur. Filtrable.
- **Statut** : badge colore :
  - `draft` — gris, `Brouillon`
  - `pending` — bleu, `En attente d'approbation`
  - `approved` — vert, `Approuve`
  - `ordered` — violet, `Commande`
  - `partially_received` — jaune, `Partiellement recu`
  - `received` — vert fonce, `Recu`
  - `rejected` — rouge, `Rejete`
  - `cancelled` — gris barre, `Annule`
- **Items** : nombre d'articles dans le PO
- **Total** : montant total HT en EUR. Triable.
- **Date creation** : date relative. Triable.
- **Demandeur** : nom de l'utilisateur qui a cree le PO
- **Actions** : editer (si brouillon), soumettre, approuver/rejeter (si manager), recevoir, annuler

### 4.2 Creation de bon de commande
Bouton `+ Nouveau PO` ouvre une page de creation :
- **Fournisseur** (select avec recherche dans le portail fournisseurs, ou texte libre si nouveau)
- **Date souhaitee de livraison** (datepicker)
- **Notes** (textarea, instructions speciales pour le fournisseur)
- **Lignes de commande** (table editable dynamique) :
  - Produit (select depuis le catalogue avec recherche SKU/nom)
  - Description (pre-rempli depuis le catalogue, editable)
  - Quantite (nombre)
  - Prix unitaire HT (pre-rempli depuis le fournisseur, editable)
  - Total ligne (calcule automatiquement)
  - Bouton `+` pour ajouter une ligne, `X` pour supprimer

Calculs automatiques en bas :
- **Sous-total HT** : somme des lignes
- **TVA** (select taux : 0%, 5.5%, 10%, 20%, custom) et montant
- **Total TTC** : sous-total + TVA
- **Frais de port** (optionnel, input numerique)
- **Total general** : total TTC + frais de port

Attribution d'un numero PO sequentiel a la creation. Bouton `Sauvegarder en brouillon` et `Sauvegarder et soumettre`.

### 4.3 Workflow d'approbation
Apres soumission, le PO passe en statut `pending`. Le manager designe (ou l'admin) recoit une notification. Vue d'approbation : toutes les informations du PO en lecture seule + boutons `Approuver` (vert, commentaire optionnel) et `Rejeter` (rouge, commentaire obligatoire). Seuils d'approbation configurables : PO < 500 EUR auto-approuve, PO 500-5000 EUR → manager, PO > 5000 EUR → directeur. PgEventBus events : `supplychain.po.submitted`, `supplychain.po.approved`, `supplychain.po.rejected`.

### 4.4 Envoi au fournisseur
Apres approbation, bouton `Envoyer au fournisseur`. Options :
- **Email** : genere un PDF du PO et l'envoie par email au contact du fournisseur via signapps-mail (port 3012)
- **Telecharger le PDF** : le demandeur l'envoie manuellement
Le statut passe a `ordered`. Date de commande enregistree.

### 4.5 Reception
Bouton `Recevoir` sur un PO approuve/commande. Formulaire de reception :
- Pour chaque ligne du PO : quantite recue (input numerique, defaut = quantite commandee)
- Statut par ligne : `Conforme`, `Non-conforme` (avec commentaire)
- Numero de lot (optionnel, texte)
- Zone de stockage cible (select)

Si toutes les quantites sont conformes : statut → `received`. Si certaines sont partielles : statut → `partially_received` (reception partielle possible, puis reception complementaire). Mise a jour automatique de l'inventaire (mouvements de type `Entree` avec reference PO).

### 4.6 Historique et audit du PO
Chaque PO conserve un historique complet des changements de statut avec : date, auteur, action, commentaire. Timeline verticale dans le panneau de detail du PO.

---

## Categorie 5 — Fournisseurs et suivi

### 5.1 Portail fournisseurs
Page `/supply-chain/suppliers` avec table :
- **Nom** : raison sociale. Triable.
- **Contact** : nom du contact principal
- **Email** : email principal
- **Telephone** : numero format international
- **Categorie** : categories de produits fournis (chips)
- **POs** : nombre de bons de commande (total)
- **Volume** : montant total commande (EUR)
- **Score qualite** : note sur 5 (etoiles) basee sur la conformite des livraisons
- **Actions** : voir la fiche, editer, archiver

Bouton `+ Nouveau fournisseur` ouvre un formulaire : nom, adresse, contact principal (nom, email, telephone), site web, conditions de paiement (Net 30, Net 60, etc.), devise, notes.

### 5.2 Fiche fournisseur
Page de detail avec :
- **Informations generales** : nom, adresse, contacts, conditions
- **KPIs** : nombre de POs, montant total, delai de livraison moyen (jours), taux de conformite (%)
- **Historique des commandes** : table des POs lies, triee par date
- **Catalogue fournisseur** : produits fournis avec prix specifiques fournisseur
- **Performance** : graphique de delai de livraison sur 12 mois (line chart), taux de conformite (bar chart)

### 5.3 Score de performance fournisseur
Calcul automatique base sur :
- **Delai de livraison** : moyenne des ecarts entre date souhaitee et date recue (poids 40%)
- **Conformite** : pourcentage de lignes de PO recues conformes (poids 40%)
- **Communication** : note manuelle du responsable achats (poids 20%)

Le score est affiche comme des etoiles (1-5) dans la table et sur la fiche fournisseur. Un score < 3 etoiles affiche un avertissement lors de la creation d'un PO avec ce fournisseur.

### 5.4 Suivi des livraisons
Page `/supply-chain/deliveries` avec table :
- **Numero** : identifiant de la livraison
- **PO** : numero du PO lie (lien)
- **Fournisseur** : nom
- **Transporteur** : nom du transporteur
- **Numero de suivi** : numero de tracking (lien externe vers le site du transporteur si format reconnu : Colissimo, DHL, UPS, FedEx, Chronopost)
- **Date prevue** : date de livraison estimee
- **Statut** : badge `En preparation` (gris), `Expedie` (bleu), `En transit` (violet), `Livre` (vert), `En retard` (rouge)
- **Actions** : mettre a jour le statut, marquer comme recu

Detection automatique des retards : si `date_prevue < today` et statut != `Livre`, le statut passe automatiquement a `En retard` et une alerte est creee. Notification push au responsable achats.

### 5.5 Rapports et exports
Rapports pre-configures accessibles via le hub :
- **Valorisation du stock** : par categorie, par zone, par fournisseur (table + totaux)
- **Rotation des stocks** : produits les plus/moins mouvementes (bar chart + table)
- **Historique des ruptures** : timeline des ruptures de stock sur 12 mois
- **Performance fournisseurs** : classement des fournisseurs par score
- **Bons de commande** : recapitulatif des POs par periode, fournisseur, statut

Export CSV, XLSX et PDF pour chaque rapport. Filtres par periode, categorie, zone, fournisseur.

---

## Categorie 6 — Persistance et API

### 6.1 API REST complete

**Base path :** `/api/v1/supply-chain`

| Methode | Endpoint | Description |
|---|---|---|
| `GET` | `/products` | Catalogue produits. Query params : `cursor`, `limit`, `category`, `search`, `low_stock` (bool), `sort_by` |
| `GET` | `/products/:id` | Detail d'un produit |
| `POST` | `/products` | Creer un produit. Body : `{ sku, name, category, unit, unit_price, reorder_point, max_stock?, description?, barcode?, image? }` |
| `PUT` | `/products/:id` | Modifier un produit |
| `DELETE` | `/products/:id` | Archiver un produit (soft-delete) |
| `POST` | `/products/import` | Import CSV du catalogue (multipart) |
| `GET` | `/products/:id/barcode` | Scanner/rechercher par code-barres |
| `GET` | `/inventory` | Inventaire avec stock par produit. Query params : `zone_id`, `category`, `alert_only` |
| `GET` | `/inventory/:product_id/lots` | Lots d'un produit avec quantites |
| `GET` | `/movements` | Mouvements de stock. Query params : `product_id`, `zone_id`, `type`, `date_from`, `date_to` |
| `POST` | `/movements` | Creer un mouvement. Body : `{ product_id, type, quantity, source_zone_id?, dest_zone_id?, reason, po_id?, lot_number?, expiry_date?, notes? }` |
| `GET` | `/zones` | Zones de l'entrepot |
| `GET` | `/zones/:id` | Detail d'une zone avec items |
| `POST` | `/zones` | Creer une zone |
| `PUT` | `/zones/:id` | Modifier une zone |
| `DELETE` | `/zones/:id` | Supprimer une zone (si vide) |
| `GET` | `/purchase-orders` | Bons de commande. Query params : `status`, `supplier_id`, `date_from`, `date_to` |
| `GET` | `/purchase-orders/:id` | Detail d'un PO |
| `POST` | `/purchase-orders` | Creer un PO |
| `PUT` | `/purchase-orders/:id` | Modifier un PO (brouillon uniquement) |
| `POST` | `/purchase-orders/:id/submit` | Soumettre pour approbation |
| `POST` | `/purchase-orders/:id/approve` | Approuver. Body : `{ comment? }` |
| `POST` | `/purchase-orders/:id/reject` | Rejeter. Body : `{ comment }` |
| `POST` | `/purchase-orders/:id/receive` | Recevoir. Body : `{ lines: [{ line_id, received_qty, conformity, lot_number?, zone_id }] }` |
| `POST` | `/purchase-orders/:id/cancel` | Annuler |
| `GET` | `/purchase-orders/:id/pdf` | Generer le PDF du PO |
| `GET` | `/suppliers` | Fournisseurs |
| `GET` | `/suppliers/:id` | Detail fournisseur avec performance |
| `POST` | `/suppliers` | Creer un fournisseur |
| `PUT` | `/suppliers/:id` | Modifier |
| `DELETE` | `/suppliers/:id` | Archiver |
| `GET` | `/deliveries` | Suivi des livraisons |
| `POST` | `/deliveries` | Creer une livraison |
| `PATCH` | `/deliveries/:id` | Mettre a jour le statut |
| `GET` | `/alerts` | Alertes de stock actives |
| `POST` | `/alerts/:id/acknowledge` | Acquitter une alerte |
| `GET` | `/reports/:type` | Rapports (valorisation, rotation, ruptures, performance) |
| `POST` | `/inventory-sessions` | Demarrer un inventaire physique |
| `POST` | `/inventory-sessions/:id/count` | Enregistrer un comptage |
| `POST` | `/inventory-sessions/:id/validate` | Valider et ajuster |

### 6.2 PostgreSQL schema

```sql
-- Produits (catalogue)
CREATE TABLE sc_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    category_id UUID NOT NULL REFERENCES sc_categories(id),
    unit VARCHAR(20) NOT NULL DEFAULT 'unite',
    unit_price_cents INTEGER NOT NULL DEFAULT 0,
    reorder_point INTEGER NOT NULL DEFAULT 0,
    max_stock INTEGER,
    barcode VARCHAR(50),
    image_storage_key VARCHAR(500),
    weight_grams INTEGER,
    dimensions_cm JSONB,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sc_products_sku ON sc_products(sku);
CREATE INDEX idx_sc_products_barcode ON sc_products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_sc_products_category ON sc_products(category_id) WHERE is_archived = FALSE;
CREATE INDEX idx_sc_products_search ON sc_products USING GIN (to_tsvector('simple', sku || ' ' || name || ' ' || coalesce(description, '')));

-- Categories
CREATE TABLE sc_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES sc_categories(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(9) NOT NULL DEFAULT '#6B7280',
    icon VARCHAR(50),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Zones d'entrepot
CREATE TABLE sc_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    zone_type VARCHAR(20) NOT NULL CHECK (zone_type IN ('storage', 'receiving', 'shipping', 'cold', 'hazardous', 'office', 'empty')),
    capacity INTEGER NOT NULL DEFAULT 100,
    grid_row INTEGER NOT NULL DEFAULT 0,
    grid_col INTEGER NOT NULL DEFAULT 0,
    grid_width INTEGER NOT NULL DEFAULT 1,
    grid_height INTEGER NOT NULL DEFAULT 1,
    temperature_min NUMERIC(5, 1),
    temperature_max NUMERIC(5, 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inventaire (stock actuel par produit x zone x lot)
CREATE TABLE sc_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES sc_products(id) ON DELETE CASCADE,
    zone_id UUID NOT NULL REFERENCES sc_zones(id),
    lot_number VARCHAR(50),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit_cost_cents INTEGER NOT NULL DEFAULT 0,
    expiry_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, zone_id, lot_number)
);

CREATE INDEX idx_sc_inventory_product ON sc_inventory(product_id);
CREATE INDEX idx_sc_inventory_zone ON sc_inventory(zone_id);
CREATE INDEX idx_sc_inventory_expiry ON sc_inventory(expiry_date) WHERE expiry_date IS NOT NULL;

-- Mouvements de stock
CREATE TABLE sc_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES sc_products(id),
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('in', 'out', 'transfer', 'adjustment')),
    quantity INTEGER NOT NULL,
    source_zone_id UUID REFERENCES sc_zones(id),
    dest_zone_id UUID REFERENCES sc_zones(id),
    reason VARCHAR(50) NOT NULL,
    po_id UUID REFERENCES sc_purchase_orders(id),
    lot_number VARCHAR(50),
    notes TEXT DEFAULT '',
    performed_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sc_movements_product ON sc_movements(product_id, created_at DESC);
CREATE INDEX idx_sc_movements_zone ON sc_movements(source_zone_id);
CREATE INDEX idx_sc_movements_type ON sc_movements(movement_type, created_at DESC);

-- Fournisseurs
CREATE TABLE sc_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    address TEXT DEFAULT '',
    contact_name VARCHAR(100),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(30),
    website VARCHAR(500),
    payment_terms VARCHAR(50) DEFAULT 'Net 30',
    currency VARCHAR(3) DEFAULT 'EUR',
    notes TEXT DEFAULT '',
    quality_score NUMERIC(2, 1) DEFAULT 0.0,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Produits fournisseur (prix par fournisseur)
CREATE TABLE sc_supplier_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES sc_suppliers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES sc_products(id) ON DELETE CASCADE,
    supplier_sku VARCHAR(50),
    unit_price_cents INTEGER NOT NULL,
    lead_time_days INTEGER,
    min_order_quantity INTEGER DEFAULT 1,
    UNIQUE(supplier_id, product_id)
);

-- Bons de commande
CREATE TABLE sc_purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(20) NOT NULL UNIQUE,
    supplier_id UUID NOT NULL REFERENCES sc_suppliers(id),
    status VARCHAR(25) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending', 'approved', 'ordered', 'partially_received', 'received', 'rejected', 'cancelled')),
    requested_by UUID NOT NULL REFERENCES users(id),
    requested_delivery_date DATE,
    notes TEXT DEFAULT '',
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    vat_rate NUMERIC(5, 2) DEFAULT 20.0,
    vat_amount_cents INTEGER NOT NULL DEFAULT 0,
    shipping_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    review_comment TEXT DEFAULT '',
    ordered_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sc_po_supplier ON sc_purchase_orders(supplier_id);
CREATE INDEX idx_sc_po_status ON sc_purchase_orders(status);
CREATE INDEX idx_sc_po_requestor ON sc_purchase_orders(requested_by);

-- Lignes de PO
CREATE TABLE sc_po_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES sc_purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES sc_products(id),
    description TEXT DEFAULT '',
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL,
    received_quantity INTEGER NOT NULL DEFAULT 0,
    conformity VARCHAR(20) DEFAULT 'pending' CHECK (conformity IN ('pending', 'conform', 'non_conform')),
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_sc_po_lines_po ON sc_po_lines(po_id, sort_order);

-- Livraisons
CREATE TABLE sc_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES sc_purchase_orders(id),
    carrier VARCHAR(100),
    tracking_number VARCHAR(100),
    expected_date DATE,
    actual_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'preparing'
        CHECK (status IN ('preparing', 'shipped', 'in_transit', 'delivered', 'late')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sc_deliveries_po ON sc_deliveries(po_id);
CREATE INDEX idx_sc_deliveries_status ON sc_deliveries(status);

-- Alertes stock
CREATE TABLE sc_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES sc_products(id),
    alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'overstock', 'expiry_near', 'expiry_past')),
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    current_quantity INTEGER,
    threshold INTEGER,
    message TEXT NOT NULL,
    is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sc_alerts_active ON sc_alerts(is_acknowledged, severity) WHERE is_acknowledged = FALSE;
```

### 6.3 PgEventBus events

| Event | Payload | Consumers |
|---|---|---|
| `supplychain.product.created` | `{ product_id, sku, name }` | Search index |
| `supplychain.movement.created` | `{ movement_id, product_id, type, quantity, zone_id }` | Inventory recalc, Alerts |
| `supplychain.alert.triggered` | `{ product_id, alert_type, severity, current_qty, threshold }` | Notifications |
| `supplychain.alert.acknowledged` | `{ alert_id, acknowledged_by }` | — |
| `supplychain.po.created` | `{ po_id, supplier_id, total }` | — |
| `supplychain.po.submitted` | `{ po_id, requested_by, total }` | Notifications (manager) |
| `supplychain.po.approved` | `{ po_id, approved_by }` | Notifications (requestor) |
| `supplychain.po.rejected` | `{ po_id, rejected_by, comment }` | Notifications (requestor) |
| `supplychain.po.received` | `{ po_id, received_lines }` | Inventory update |
| `supplychain.delivery.late` | `{ delivery_id, po_id, expected_date }` | Notifications, Alerts |
| `supplychain.inventory.adjusted` | `{ session_id, adjustments_count, value_change }` | Metrics |

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
| **InvenTree** (github.com/inventree/InvenTree) | **MIT** | Reference principale. Inventaire open source, BOM, fournisseurs, commandes, stock tracking. |
| **Part-DB** (github.com/Part-DB/Part-DB-server) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Gestion d'inventaire de composants. |
| **erpnext** (github.com/frappe/erpnext) | **GPL-3.0** | **INTERDIT** — reference pedagogique uniquement. ERP avec module supply chain. |
| **Snipe-IT** (github.com/snipe/snipe-it) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Asset management. |
| **BoxBilling** (github.com/boxbilling/boxbilling) | **Apache-2.0** | Pattern pour les commandes et la facturation. |
| **recharts** (github.com/recharts/recharts) | **MIT** | Graphiques React pour la visualisation des stocks et mouvements. |

---

## Assertions E2E cles (a tester)

- Page Supply Chain hub → les 7 sous-modules sont affiches en cartes cliquables avec compteurs
- KPIs du hub → valeur du stock, PO en attente, alertes, livraisons correctement calcules
- Catalogue : creer un produit → il apparait dans la table avec SKU et stock a 0
- Catalogue : importer un CSV → produits crees avec les bons champs
- Catalogue : scanner un code-barres → produit identifie et fiche ouverte
- Inventaire : ajouter un mouvement d'entree → la quantite en stock augmente, KPI mis a jour
- Inventaire : ajouter un mouvement de sortie → la quantite diminue
- Inventaire : sortie > stock disponible → erreur `Stock insuffisant`
- Inventaire : transfert entre zones → source decremente, destination incremente
- Inventaire : item sous seuil → badge alerte rouge visible, alerte creee
- Inventaire : item a zero → badge `Rupture`, alerte critique
- Warehouse Map → les zones s'affichent en grille avec couleurs par type
- Warehouse Map → taux de remplissage affiche avec couleurs correctes
- Warehouse Map : clic sur une zone → le detail s'ouvre avec items
- Warehouse Map : recherche d'un produit → la zone est mise en surbrillance
- Creer un PO → il apparait dans la table avec statut `Brouillon`
- Soumettre un PO → statut `En attente`, manager notifie
- Approuver un PO → statut `Approuve`
- Rejeter un PO → statut `Rejete`, commentaire visible
- Recevoir un PO → inventaire mis a jour, statut `Recu`
- Reception partielle → statut `Partiellement recu`
- Fournisseurs : creer un fournisseur → il apparait dans la table
- Fournisseurs : fiche avec score qualite et historique POs
- Livraisons : livraison en retard → statut passe automatiquement a `En retard`, alerte creee
- Livraisons : numero de suivi cliquable → ouvre le site du transporteur
- Alertes stock → les items en rupture sont visibles dans le panneau d'alertes
- Inventaire physique → ecarts detectes, ajustements generes apres validation
- Export PDF d'un PO → document formate avec toutes les lignes
- Export CSV de l'inventaire → toutes les colonnes exportees
