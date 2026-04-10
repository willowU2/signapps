# Module Impression & Supports physiques (Print & Physical) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Canva Print** | 1000+ templates par categorie (cartes de visite, flyers, affiches, invitations), editeur drag-and-drop, preview 3D des cartes de visite, commande d'impression integree, brand kit (polices, couleurs, logos), resize magique entre formats |
| **Vistaprint** | Configurateur de cartes de visite avec preview recto/verso temps reel, choix de papier (mat, brillant, recycle, premium), finitions (coins arrondis, vernis selectif, dorure), upload de design ou creation en ligne, commande en ligne |
| **MOO** | Designs premium, papier haute qualite (Cotton, Luxe, Original), NFC business cards, Printfinity (design different par carte), tailles non-standard, finitions speciales (spot gloss, gold foil) |
| **Adobe Express** | Templates professionnels, integration Creative Cloud, AI generatif (text-to-design), marque coherente (brand kit), export PDF haute resolution, formats d'impression normes |
| **Business Card Maker** | Simplicite : formulaire → design → export PDF. Templates minimalistes. QR code integre. Preview instantanee. Export print-ready (CMYK, 300 DPI, bleed) |

## Principes directeurs

1. **WYSIWYG print-ready** — ce qui est affiche a l'ecran est exactement ce qui sera imprime. Respect des marges, des zones de coupe et des fonds perdus (bleed).
2. **Donnees pre-remplies** — les informations de l'utilisateur (nom, email, telephone, entreprise) sont pre-remplies depuis le profil Identity et les Contacts. Zero saisie manuelle inutile.
3. **Brand coherent** — les couleurs, polices et logos de l'organisation sont appliques par defaut. Brand kit centralise (cf. Admin Settings).
4. **Export professionnel** — export PDF haute resolution (300 DPI minimum), espace colorimetrique CMYK pour l'impression professionnelle, fonds perdus de 3mm, traits de coupe.
5. **Templates extensibles** — bibliotheque de templates de base fournie, creation de templates custom par l'administrateur, partage au sein de l'organisation.
6. **Eco-responsable** — indication de la consommation papier, suggestions de formats economiques, option de preview numerique avant impression.

---

## Categorie 1 — Cartes de visite (Business Cards)

### 1.1 Template picker
Ecran d'accueil du designer de cartes de visite : grille de templates organises par style (Classique, Moderne, Creatif, Minimaliste, Premium). Chaque template est affiche en miniature avec le nom du style. Survol : agrandissement de la miniature (scale 1.1, 200ms ease-out) et affichage du nom. Clic selectionne le template et ouvre l'editeur. Filtre par orientation (horizontale/verticale), par couleur dominante. Bouton `Commencer de zero` pour un canvas vide. Les templates de l'organisation (crees par l'admin) apparaissent en premier avec un badge `Entreprise`. API : `GET /api/v1/print/business-cards/templates`.

### 1.2 Formulaire de saisie avec field mapping depuis Contacts
Panneau gauche avec les champs du formulaire :
- **Nom complet** (pre-rempli depuis le profil Identity `user.display_name`)
- **Poste / Titre** (pre-rempli depuis le profil HR `user.job_title`)
- **Entreprise** (pre-rempli depuis l'organisation `org.name`)
- **Email** (pre-rempli depuis le profil `user.email`)
- **Telephone** (pre-rempli depuis le profil `user.phone`)
- **Site web** (pre-rempli depuis l'organisation `org.website`)
- **Adresse** (pre-rempli depuis l'organisation `org.address`)
- **Logo** (pre-rempli depuis le brand kit `org.logo_url`)

Chaque champ est editable. Champs optionnels masquables par toggle. Si un champ est vide dans le profil, il s'affiche en placeholder gris : `Non renseigne — cliquer pour saisir`. Bouton `Charger depuis un contact` ouvre le selecteur de Contacts pour pre-remplir avec les informations d'un autre utilisateur (utile pour un assistant qui cree les cartes). Raccourci : `Tab` pour naviguer entre les champs.

### 1.3 Preview en direct
Panneau droit avec apercu de la carte de visite en temps reel. Chaque modification dans le formulaire se reflete instantanement (debounce 100ms). Preview recto et verso (bouton bascule avec animation flip 3D, 400ms). Zoom pour voir les details (molette souris ou boutons +/-). Grille d'alignement et guides affiches en mode edition (toggle). Indicateur de safe zone (5mm du bord) en trait pointille bleu. Les elements hors safe zone sont signales par un warning orange : `Le texte est trop proche du bord de coupe.`

### 1.4 Themes de couleur
Minimum 3 themes pre-definis :
- **Classique** : fond blanc, texte noir, accent couleur primaire de l'organisation
- **Sombre** : fond #1a1a2e, texte #eaeaea, accent vif (couleur secondaire org)
- **Gradient** : fond degrade (couleur primaire → secondaire), texte blanc, style moderne

Chaque theme est personnalisable : couleur de fond (color picker hex/RGB/HSL), couleur du texte, couleur d'accent. Le color picker est un composant inline avec un champ hex et un selecteur visuel. Les couleurs du brand kit sont proposees en raccourci (pastilles cliquables).

### 1.5 QR Code integre
Option d'ajouter un QR code sur la carte (recto ou verso). Contenu selectionnable : vCard (informations de contact completes), URL du profil public, lien personnalise (saisie libre). Position et taille configurables par drag-and-drop sur le canvas. Taille minimale : 15mm x 15mm (en-dessous, warning `QR code trop petit pour un scan fiable`). Preview du QR code avec bouton `Tester le scan` qui ouvre la camera du mobile. Le QR code est genere cote backend via la crate `qrcode` (MIT). Couleur du QR code personnalisable (defaut : noir sur fond blanc). API : `POST /api/v1/print/qr-code` avec `{ content, size, color }`.

### 1.6 Recto/Verso
Design du recto (informations de contact) et du verso (logo agrandi, slogan, carte, pattern graphique, ou vide). Edition independante des deux faces. Templates distincts pour le verso. Toggle recto/verso dans l'editeur. Le verso peut etre : identique pour toutes les cartes, ou personnalise par employe.

### 1.7 Format et decoupe
Format standard : 85 x 55 mm (Europe) ou 89 x 51 mm (US). Selection dans un dropdown. Coins : droits ou arrondis (rayon configurable par slider, 0-5mm). Zone de securite (safe zone) affichee pour les elements critiques (texte a 5mm du bord minimum). Fond perdu (bleed) : 3mm de chaque cote, affiche en zone hachure.

### 1.8 Export et impression
Bouton `Exporter PDF` genere un PDF print-ready :
- Resolution : 300 DPI
- Espace colorimetrique : CMYK (conversion automatique depuis RGB)
- Fonds perdus : 3mm de chaque cote
- Traits de coupe (crop marks) aux 4 coins
- Planche d'impression : multiples cartes par page A4 (8 ou 10 cartes, configurable)

Dialogue d'impression systeme ou sauvegarde du PDF dans Drive. Bouton `Imprimer` ouvre le dialogue d'impression du navigateur avec les parametres pre-configures (taille, orientation). Bouton `Sauvegarder dans Drive` enregistre le PDF dans le dossier `Print/Cartes de visite/`. Animation de generation : spinner pendant 1-2 secondes puis preview du PDF. API : `POST /api/v1/print/business-cards/export` avec `{ template_id, data, format, options }`.

### 1.9 Impression par lot (bulk generate)
Pour l'administrateur : generer les cartes de visite de tous les employes en une seule operation. Selection par departement, equipe ou individuel (checkboxes dans la liste des employes). Source de donnees : module Identity (profils utilisateurs) + HR (postes). Preview de 2-3 exemplaires avant validation. Export en PDF unique (une page par employe, recto et verso) ou ZIP de PDFs individuels. Barre de progression : `Generation en cours : 42/120 cartes...`. API : `POST /api/v1/print/business-cards/bulk` avec `{ user_ids[], template_id, options }`.

---

## Categorie 2 — Certificats et diplomes

### 2.1 Templates de certificats
Bibliotheque de templates : certificat de formation, diplome de reussite, attestation de participation, certificat de competence, diplome honorifique. Styles : academique (cadre orne, serif), moderne (minimaliste, sans-serif), professionnel (sobre, logo entreprise). Chaque template est affiche en miniature dans une grille. Orientation : paysage (defaut, 297x210mm) ou portrait (210x297mm).

### 2.2 Champs dynamiques (variables)
Variables inserables dans le template via la syntaxe `{{variable}}` :
- `{{nom}}` — nom du destinataire
- `{{formation}}` — intitule de la formation
- `{{date}}` — date de delivrance (format configurable : JJ/MM/AAAA)
- `{{formateur}}` — nom du formateur
- `{{duree}}` — duree de la formation (ex: `14 heures`)
- `{{score}}` — note obtenue (ex: `85/100`)
- `{{numero}}` — numero de certificat (auto-increment par organisation : `CERT-2026-0001`)

Pre-remplissage depuis le module LMS (formations) ou saisie manuelle. L'editeur de template marque les variables en bleu avec un indicateur visuel. Double-clic sur une variable ouvre un panel de configuration (format, valeur par defaut).

### 2.3 Signature et cachet
Emplacement pour la signature manuscrite (image uploadee, format PNG avec transparence) ou signature electronique (module Signatures). Cachet de l'organisation (logo + texte circulaire genere automatiquement). Positionnement libre par drag-and-drop. La signature est redimensionnable avec conservation du ratio. Le cachet est genere cote backend : `POST /api/v1/print/stamp` avec `{ org_name, subtitle, logo_url }`.

### 2.4 QR Code de verification
Chaque certificat porte un numero unique et un QR code de verification. Scan du QR code → page web confirmant l'authenticite (nom, formation, date, numero). URL : `https://app.signapps.com/verify/cert/:id`. La page de verification est publique (pas besoin de login). Le QR code est genere automatiquement a la creation du certificat et positionne dans le coin inferieur droit (deplacable). Si le certificat est revoque, la page de verification affiche `Ce certificat a ete revoque le DD/MM/YYYY.` en rouge. API : `GET /api/v1/print/certificates/:id/verify`.

### 2.5 Generation en masse
Import CSV avec les noms des destinataires et les donnees variables. Format CSV attendu : colonnes correspondant aux variables du template (nom, formation, date, etc.). Detection automatique des colonnes par le header. Preview de 2-3 exemplaires avant validation (premier, milieu, dernier). Validation : alerte si des champs obligatoires sont vides. Export en PDF multi-pages ou ZIP. Barre de progression : `Generation : 15/50 certificats...`. API : `POST /api/v1/print/certificates/bulk` avec `{ template_id, csv_file_id }`.

### 2.6 Envoi par email
Apres generation, option d'envoyer chaque certificat par email a son destinataire (adresse dans le CSV ou depuis Contacts). Template d'email personnalisable : objet, corps avec variables (`{{nom}}`, `{{formation}}`). Piece jointe PDF. Preview de l'email avant envoi groupee. Progression : `Envoi : 30/50 emails...`. L'envoi utilise le module Mail via PgEventBus `certificate.send_email`. Historique des envois dans l'onglet `Envois` du certificat.

---

## Categorie 3 — Badges et cartes d'identification

### 3.1 Templates de badges
Types : badge employe (photo, nom, departement, code-barre), badge visiteur (nom, entreprise, date, accompagnateur), badge evenement (nom, societe, role, QR code). Formats : carte de credit (85x55mm), badge A6 (105x148mm), lanyard (86x54mm). Templates organises par type dans la grille. Chaque template affiche les zones editables (photo, texte, code-barre) avec des indicateurs de position.

### 3.2 Photo d'identite et elements visuels
Upload ou capture webcam (bouton `Prendre une photo` avec acces camera). Recadrage automatique (detection de visage via signapps-media). Fond uni (blanc, gris, bleu) avec suppression de fond optionnelle. Dimensions normalisees (35x45mm pour une photo d'identite standard). Si aucune photo n'est fournie, affichage des initiales en gros caracteres sur un fond colore.

### 3.3 Barcode et QR code
Code-barre (Code 128) ou QR code pour le scan a l'entree. Contenu : numero d'employe, URL de profil, ou valeur custom. Numero unique genere automatiquement. Le code-barre est genere cote backend et insere dans le template. Options : Code 128 (texte alphanumerique), EAN-13 (numerique), QR Code (donnees riches). Taille et position configurables.

### 3.4 Generation par lot
Import CSV ou selection depuis HR/Contacts. Colonnes attendues : nom, prenom, departement, photo_url (optionnel). Generation de tous les badges en un lot. Planches de decoupe pour impression sur imprimante badge (format CR-80) ou imprimante standard (A4 avec multiples badges par page). Bouton `Generer la planche A4` dispose automatiquement les badges sur la page avec reperes de decoupe.

### 3.5 Badge temporaire (visiteur)
Workflow : reception saisit le nom du visiteur dans un formulaire simplifie (nom, entreprise, personne visitee) → badge genere et imprime instantanement → QR code pour l'acces. Expiration automatique en fin de journee (23:59 du jour meme). Log des visiteurs avec heure d'arrivee et de depart. Le formulaire visiteur est accessible sur une page dediee (`/visitors/check-in`) optimisee tablette. Impression directe sans preview (un clic). Evenement PgEventBus : `visitor.checked_in`, `visitor.checked_out`.

---

## Categorie 4 — Etiquettes (Labels)

### 4.1 Formats d'etiquettes
Formats pre-definis compatibles avec les planches commerciales :
- Avery L7160 (21 par planche, 63.5 x 38.1 mm)
- Avery L7161 (18 par planche, 63.5 x 46.6 mm)
- Avery L7163 (14 par planche, 99.1 x 38.1 mm)
- Avery L7165 (8 par planche, 99.1 x 67.7 mm)
- Dymo LW 99012 (adresse, 89 x 36 mm, rouleau)
- Zebra ZPL (custom dimensions, ZPL format output)
- Format personnalise (dimensions, marges, espacement)

Selection du format dans un dropdown avec preview de la planche. Les dimensions et le nombre d'etiquettes par planche sont pre-configures.

### 4.2 Editeur d'etiquette
Zone d'edition aux dimensions exactes de l'etiquette. Outils : texte (multi-lignes, polices, tailles, gras/italique), code-barres (Code 128, EAN-13, QR Code, Data Matrix), images, formes, lignes de separation. Chaque element est positionnable par drag-and-drop avec snap-to-grid (grille de 1mm). Undo/Redo illimite.

### 4.3 Fusion de donnees depuis spreadsheet (publipostage)
Source de donnees : CSV, Contacts, ou saisie manuelle. Upload du fichier CSV avec auto-detection du separateur (, ; tab). Champs de fusion : `{{nom}}`, `{{adresse}}`, `{{code_postal}}`, `{{ville}}`, `{{pays}}`. Preview de la planche complete avec les donnees fusionnees (bouton `Apercu de la planche`). Navigation entre les pages de la planche : `Page 1/5 (etiquettes 1-21)`. Si un champ est vide dans une ligne du CSV, l'etiquette correspondante est generee avec le champ vide (pas de ligne sautee).

### 4.4 Codes-barres et QR codes
Generation de codes-barres dans l'etiquette : Code 128 (texte alphanumerique), EAN-13 (produits), QR Code (URL, texte, vCard), Data Matrix (compact). Donnees depuis un champ de fusion (`{{reference}}`) ou valeur fixe. Taille auto-ajustee a l'espace disponible. Qualite d'impression verifiee : warning si la resolution du code-barre est trop basse pour un scan fiable.

### 4.5 Impression Dymo/Zebra
Support des imprimantes d'etiquettes :
- **Dymo** : generation au format natif Dymo (via CUPS/driver), impression directe depuis le navigateur via Web USB API ou dialogue systeme
- **Zebra** : generation de code ZPL (Zebra Programming Language), envoi direct a l'imprimante via TCP/IP ou USB

Configuration : adresse IP de l'imprimante (pour Zebra reseau), taille du rouleau, nombre d'etiquettes par rouleau. Bouton `Imprimer` detecte les imprimantes compatibles.

### 4.6 Planche d'impression standard
Remplissage automatique de la planche A4 avec les etiquettes. Preview de la planche entiere. Offset de debut (commencer a l'etiquette N pour les planches partiellement utilisees — slider ou input numerique). Export PDF aux dimensions exactes. Nombre total de planches affiche : `3 planches A4 necessaires pour 50 etiquettes (Avery L7160)`.

---

## Categorie 5 — Papier a en-tete et enveloppes

### 5.1 Template de page (letterhead)
Design de la page A4 complete : en-tete (logo, nom de l'entreprise, slogan), pied de page (adresse, telephone, email, site web, mentions legales, SIRET, capital social). Zone de corps avec marges definies (defaut : 25mm haut, 15mm cotes, 20mm bas).

### 5.2 Variantes
Plusieurs variantes par organisation : papier a en-tete standard, papier a en-tete de direction, papier a en-tete par departement. Selection de la variante lors de la creation d'un document. Chaque variante est identifiee par un nom et un badge couleur.

### 5.3 Integration avec Docs
Le papier a en-tete est applique automatiquement lors de l'export PDF d'un document Docs. L'utilisateur ecrit le corps du document dans Docs, le letterhead est ajoute a l'impression. Option dans l'export PDF : `Appliquer le papier a en-tete` (toggle, actif par defaut). L'en-tete est superpose en arriere-plan (sous le texte du document).

### 5.4 Enveloppes : formats et adressage
Formats pre-definis :
- DL (110 x 220 mm) — format standard pour courrier A4 plie en 3
- C5 (162 x 229 mm) — pour A5 ou A4 plie en 2
- C4 (229 x 324 mm) — pour A4 non plie
- US Letter (#10, 4.125 x 9.5 inches)

Placement automatique : expediteur (haut-gauche, depuis l'organisation), destinataire (centre-droite, depuis Contact ou saisie), zone d'affranchissement (haut-droite, vide). Logo optionnel a cote de l'expediteur. Mention optionnelle (RECOMMANDE, LETTRE SUIVIE, PERSONNEL, CONFIDENTIEL) — dropdown sous le champ expediteur.

### 5.5 Fusion d'adresses pour enveloppes
Source de donnees : Contacts, CSV, saisie manuelle. Champs : nom, adresse, code postal, ville, pays. Generation de N enveloppes avec les adresses fusionnees. Preview avant impression. Tri alphabetique ou par code postal.

### 5.6 Export et impression enveloppes
PDF aux dimensions exactes de l'enveloppe. Indication du sens d'insertion dans l'imprimante (schema visuel). Option d'impression directe si l'imprimante supporte le format. Si le format n'est pas supporte par l'imprimante, suggestion de redimensionner sur A4 avec zone de decoupe.

---

## Categorie 6 — Posters, flyers et templates

### 6.1 Templates de posters/flyers
Bibliotheque de templates organises par usage : affiche evenement, flyer promotionnel, annonce interne, menu restaurant, planning hebdomadaire. Formats : A3 (297x420mm), A4 (210x297mm), A5 (148x210mm), US Letter, US Tabloid, format custom. Orientation : portrait ou paysage.

### 6.2 Editeur drag-and-drop
Canvas a la taille du support choisi. Outils : texte (titre, sous-titre, paragraphe avec presets de style), images (upload, Drive, gallery stock), formes (rectangles, cercles, lignes, fleches), arriere-plan (couleur unie, degrade, image). Chaque element est positionnable par drag-and-drop avec snap-to-grid et alignement auto (guides apparaissent quand un element est aligne avec un autre). Layers panel pour reordonner les elements (front/back).

### 6.3 Export multi-format
Export : PDF haute resolution (300 DPI, CMYK), PNG (pour affichage ecran), JPEG (pour envoi email). Options CMYK pour impression professionnelle. Bleed configurable (0, 3mm, 5mm). Traits de coupe optionnels.

---

## Categorie 7 — Print queue management

### 7.1 File d'attente d'impression
Tableau de bord des impressions en cours et en attente : nom du document, type (carte, certificat, etiquette, poster), utilisateur, imprimante cible, statut (En attente, En cours, Termine, Erreur), date de soumission. Filtres par type, par statut, par utilisateur.

### 7.2 Gestion de la queue
Actions : annuler un job en attente, reprioriser (monter/descendre dans la queue), relancer un job en erreur. L'admin peut voir et gerer les jobs de tous les utilisateurs. Un utilisateur standard ne voit que ses propres jobs.

### 7.3 Imprimantes configurees
Liste des imprimantes disponibles : nom, type (standard, badge, etiquette), statut (en ligne, hors ligne, erreur), jobs en attente. Configuration : ajout d'une imprimante (nom, type, adresse IP/USB, driver). Test d'impression (page test). API : `GET /api/v1/print/printers`, `POST /api/v1/print/printers`.

### 7.4 Historique d'impression
Log de toutes les impressions : date, utilisateur, type de document, imprimante, nombre de pages, statut. Filtres par periode, par utilisateur, par type. Statistiques : nombre d'impressions par mois, par utilisateur, par type. Widget dashboard : `Ce mois : 450 pages imprimees`.

---

## Categorie 8 — Personnalisation et brand kit

### 8.1 Brand kit centralise
Definition au niveau de l'organisation :
- **Couleurs** : primaire, secondaire, accent, fond, texte (palette de 5-10 couleurs)
- **Polices** : titres, corps, accent (upload de polices custom TTF/OTF/WOFF2 ou selection Google Fonts)
- **Logo** : principal (couleur), secondaire (monochrome), icone (favicon/avatar)
- **Slogan** : phrase d'accroche de l'entreprise

Applique automatiquement a tous les templates. Interface de configuration dans `Admin > Brand Kit`. Chaque couleur est definie en hex et le systeme genere les equivalents CMYK pour l'impression.

### 8.2 Templates custom
Creation de templates personnalises par l'administrateur. Editeur visuel drag-and-drop. Elements fixes (logo, adresse) et variables (champs de fusion). Sauvegarde dans la bibliotheque de l'organisation. Versionning des templates (historique avec diff). Un template peut etre marque `Par defaut` pour etre pre-selectionne dans les assistants.

### 8.3 Gestion des polices
Upload de polices custom (TTF, OTF, WOFF2). Verification de la licence (usage commercial). Embedding dans les PDFs exportes (subset pour reduire la taille). Fallback si la police n'est pas disponible (police systeme la plus proche). Liste des polices installees avec preview.

---

## Schema PostgreSQL

```sql
-- Templates d'impression
CREATE TABLE print_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    template_type VARCHAR(30) NOT NULL CHECK (template_type IN ('business_card', 'certificate', 'badge', 'label', 'letterhead', 'envelope', 'poster', 'flyer')),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    orientation VARCHAR(10) NOT NULL DEFAULT 'landscape' CHECK (orientation IN ('landscape', 'portrait')),
    width_mm NUMERIC(7,2) NOT NULL,
    height_mm NUMERIC(7,2) NOT NULL,
    design JSONB NOT NULL,
    thumbnail_url VARCHAR(500),
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_system BOOLEAN NOT NULL DEFAULT false,
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_print_templates_org ON print_templates(org_id);
CREATE INDEX idx_print_templates_type ON print_templates(org_id, template_type);

-- Documents generes
CREATE TABLE print_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    template_id UUID NOT NULL REFERENCES print_templates(id),
    document_type VARCHAR(30) NOT NULL,
    name VARCHAR(200) NOT NULL,
    data JSONB NOT NULL,
    pdf_file_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'printed', 'sent')),
    generated_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_print_documents_org ON print_documents(org_id);
CREATE INDEX idx_print_documents_type ON print_documents(org_id, document_type);

-- Certificats (avec verification)
CREATE TABLE print_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES print_documents(id) ON DELETE CASCADE,
    certificate_number VARCHAR(30) NOT NULL UNIQUE,
    recipient_name VARCHAR(200) NOT NULL,
    recipient_email VARCHAR(255),
    training_name VARCHAR(200),
    issue_date DATE NOT NULL,
    verification_url VARCHAR(500) NOT NULL,
    qr_code_data TEXT NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    email_sent BOOLEAN NOT NULL DEFAULT false,
    email_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_print_certificates_number ON print_certificates(certificate_number);

-- Badges visiteurs
CREATE TABLE print_visitor_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    visitor_name VARCHAR(200) NOT NULL,
    visitor_company VARCHAR(200),
    host_user_id UUID REFERENCES users(id),
    badge_number VARCHAR(30) NOT NULL,
    qr_code_data TEXT,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    checked_out_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_visitor_badges_org ON print_visitor_badges(org_id);
CREATE INDEX idx_visitor_badges_date ON print_visitor_badges(checked_in_at DESC);

-- Brand kit
CREATE TABLE print_brand_kits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) UNIQUE,
    colors JSONB NOT NULL DEFAULT '{}',
    fonts JSONB NOT NULL DEFAULT '{}',
    logo_primary_url VARCHAR(500),
    logo_secondary_url VARCHAR(500),
    logo_icon_url VARCHAR(500),
    slogan VARCHAR(200),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Polices custom
CREATE TABLE print_fonts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    family VARCHAR(100) NOT NULL,
    style VARCHAR(20) NOT NULL DEFAULT 'normal',
    weight INTEGER NOT NULL DEFAULT 400,
    file_url VARCHAR(500) NOT NULL,
    format VARCHAR(10) NOT NULL CHECK (format IN ('ttf', 'otf', 'woff2')),
    license_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id, family, style, weight)
);

-- File d'impression
CREATE TABLE print_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    document_id UUID REFERENCES print_documents(id),
    printer_id UUID,
    job_name VARCHAR(200) NOT NULL,
    document_type VARCHAR(30) NOT NULL,
    pages INTEGER NOT NULL DEFAULT 1,
    copies INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'printing', 'completed', 'error', 'cancelled')),
    error_message TEXT,
    submitted_by UUID NOT NULL REFERENCES users(id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX idx_print_queue_org ON print_queue(org_id);
CREATE INDEX idx_print_queue_status ON print_queue(status);

-- Bulk generation jobs
CREATE TABLE print_bulk_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    template_id UUID NOT NULL REFERENCES print_templates(id),
    job_type VARCHAR(30) NOT NULL,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('csv', 'contacts', 'hr', 'manual')),
    source_data JSONB,
    total_items INTEGER NOT NULL,
    processed_items INTEGER NOT NULL DEFAULT 0,
    success_items INTEGER NOT NULL DEFAULT 0,
    error_items INTEGER NOT NULL DEFAULT 0,
    output_file_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'error', 'cancelled')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id)
);
```

---

## PgEventBus Events

| Event | Payload | Emitted by | Consumed by |
|---|---|---|---|
| `print.document.generated` | `{ org_id, document_id, type, pdf_file_id }` | Print | Drive, Dashboard |
| `print.bulk.completed` | `{ org_id, job_id, type, total, success, errors }` | Print | Notifications |
| `print.certificate.created` | `{ certificate_id, recipient_name, number }` | Print | Audit |
| `print.certificate.revoked` | `{ certificate_id, reason, revoked_by }` | Print | Audit |
| `certificate.send_email` | `{ certificate_id, recipient_email, pdf_file_id }` | Print | Mail |
| `visitor.checked_in` | `{ org_id, badge_id, visitor_name, host }` | Print | Notifications, Audit |
| `visitor.checked_out` | `{ org_id, badge_id, visitor_name }` | Print | Audit |
| `print.job.completed` | `{ job_id, printer, pages, status }` | Print | Dashboard |
| `print.job.error` | `{ job_id, printer, error }` | Print | Notifications |

---

## REST API Endpoints

```
# Business Cards
GET    /api/v1/print/business-cards/templates            — List templates
POST   /api/v1/print/business-cards/preview               — Generate preview image
POST   /api/v1/print/business-cards/export                — Export as PDF
POST   /api/v1/print/business-cards/bulk                  — Bulk generate for multiple users

# Certificates
GET    /api/v1/print/certificates/templates               — List certificate templates
POST   /api/v1/print/certificates                         — Create a certificate
POST   /api/v1/print/certificates/bulk                    — Bulk generate from CSV
GET    /api/v1/print/certificates/:id/verify              — Public verification page
POST   /api/v1/print/certificates/:id/revoke              — Revoke a certificate
POST   /api/v1/print/certificates/:id/send-email          — Send certificate by email

# Badges
GET    /api/v1/print/badges/templates                     — List badge templates
POST   /api/v1/print/badges                               — Create a badge
POST   /api/v1/print/badges/bulk                          — Bulk generate badges
POST   /api/v1/print/badges/visitor                       — Create visitor badge (quick)
POST   /api/v1/print/badges/visitor/:id/checkout           — Check out visitor

# Labels
GET    /api/v1/print/labels/formats                       — List label formats (Avery, Dymo, Zebra)
POST   /api/v1/print/labels/preview                       — Preview label sheet
POST   /api/v1/print/labels/export                        — Export label sheet as PDF
POST   /api/v1/print/labels/print-dymo                    — Print to Dymo printer
POST   /api/v1/print/labels/print-zebra                   — Print to Zebra printer (ZPL)

# Envelopes
POST   /api/v1/print/envelopes/preview                    — Preview envelope
POST   /api/v1/print/envelopes/export                     — Export envelope PDF
POST   /api/v1/print/envelopes/bulk                       — Bulk envelope generation

# Posters & Flyers
GET    /api/v1/print/posters/templates                    — List poster/flyer templates
POST   /api/v1/print/posters/export                       — Export poster as PDF/PNG

# QR & Barcodes
POST   /api/v1/print/qr-code                              — Generate QR code (SVG/PNG)
POST   /api/v1/print/barcode                               — Generate barcode (SVG/PNG)
POST   /api/v1/print/stamp                                 — Generate organization stamp

# Brand Kit
GET    /api/v1/print/brand-kit                             — Get brand kit
PATCH  /api/v1/print/brand-kit                             — Update brand kit
POST   /api/v1/print/fonts                                 — Upload custom font
GET    /api/v1/print/fonts                                 — List custom fonts

# Print Queue
GET    /api/v1/print/queue                                 — List print jobs
POST   /api/v1/print/queue                                 — Submit print job
POST   /api/v1/print/queue/:id/cancel                      — Cancel print job
GET    /api/v1/print/printers                              — List configured printers
POST   /api/v1/print/printers                              — Add printer
POST   /api/v1/print/printers/:id/test                     — Print test page

# Templates (generic)
GET    /api/v1/print/templates                             — List all templates (filter: type)
POST   /api/v1/print/templates                             — Create custom template
PATCH  /api/v1/print/templates/:id                         — Update template
DELETE /api/v1/print/templates/:id                         — Delete template
```

Auth JWT. Rate limiting : 60 req/min.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Canva Print Help** (canva.com/help) — guides de creation, specifications d'impression (DPI, bleed, CMYK), templates par categorie.
- **Vistaprint Design Studio** (vistaprint.fr/studio) — configurateur de cartes de visite, specifications papier, finitions.
- **Adobe Express Templates** (express.adobe.com/templates) — templates professionnels, bonnes pratiques de design d'impression.
- **Avery Design & Print** (avery.com/templates) — dimensions exactes des planches d'etiquettes, templates, guides d'impression.
- **Print & Design Guidelines** (99designs.com/blog) — guide des bonnes pratiques : bleed, safe zone, resolution, CMYK vs RGB.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **html2pdf.js** (github.com/eKoopmans/html2pdf.js) | **MIT** | Conversion HTML → PDF en JavaScript. Pattern pour la generation de documents imprimables depuis le navigateur. |
| **jsPDF** (github.com/parallax/jsPDF) | **MIT** | Generation de PDF en JavaScript. Support texte, images, vecteurs, polices, multi-pages. |
| **pdfkit** (github.com/foliojs/pdfkit) | **MIT** | Generation de PDF en Node.js. API riche : texte, images, vecteurs, polices embeddees, annotations. |
| **Puppeteer** (github.com/puppeteer/puppeteer) | **Apache-2.0** | Headless Chrome pour la generation de PDF haute fidelite depuis du HTML/CSS. Print-perfect rendering. |
| **qrcode** (github.com/nicross/qrcode-svg) | **MIT** | Generation de QR codes en SVG. Pattern pour les QR codes dans les cartes et badges. |
| **barcode** (github.com/nicross/JsBarcode) | **MIT** | Generation de codes-barres (Code 128, EAN, UPC) en SVG/Canvas. Pattern pour les etiquettes et badges. |
| **printd** (github.com/joseluisq/printd) | **MIT** | Impression depuis le navigateur avec CSS print optimise. Pattern pour le dialogue d'impression. |
| **genpdf** (github.com/sublime-finance/genpdf-rs) | **Apache-2.0** | Generation de PDF en Rust (wrapper autour de printpdf). Pattern pour l'export PDF cote backend. |
| **printpdf** (github.com/nicross/printpdf) | **MIT** | Library Rust pour la creation de PDF. Texte, images, vecteurs, polices, CMYK. |
| **image-rs** (github.com/image-rs/image) | **MIT/Apache-2.0** | Manipulation d'images en Rust. Pour les logos, photos d'identite, traitements. |
| **resvg** (github.com/nicross/resvg) | **MPL-2.0** | Rendu SVG haute qualite en Rust. Pour les QR codes, logos vectoriels, elements graphiques. |

### Pattern d'implementation recommande
1. **Generation PDF** : `printpdf` (MIT) ou `genpdf` (Apache-2.0) cote backend pour les PDFs print-ready. CMYK natif, bleed, crop marks.
2. **Preview frontend** : rendu HTML/CSS avec `@media print` pour la fidelite. Conversion en image pour la preview temps reel.
3. **QR codes** : `qrcode` crate Rust (MIT/Apache-2.0) pour la generation. SVG pour la nettete a toute taille.
4. **Codes-barres** : library JS cote preview, generation definitive cote backend pour la precision.
5. **Fusion de donnees** : template Handlebars avec variables, remplissage depuis CSV/Contacts, generation en batch.
6. **Brand kit** : stockage en base (couleurs, polices, logos), injection dans les templates au rendering.
7. **Polices** : embedding dans le PDF (subset pour reduire la taille). Fallback vers une police systeme si indisponible.

### Ce qu'il ne faut PAS faire
- **Pas de RGB pour l'impression** — toujours convertir en CMYK pour les exports print-ready. Le RGB est pour l'ecran uniquement.
- **Pas de resolution < 300 DPI** — les textes et logos doivent etre vectoriels ou a 300+ DPI minimum.
- **Pas de contenu hors safe zone** — le texte critique doit etre a 5mm minimum du bord de decoupe.
- **Pas de copier-coller** depuis les projets ci-dessus, meme MIT. On s'inspire des patterns, on reecrit.
- **Pas de dependance GPL/AGPL** — meme comme dependance transitive (cargo deny bloque).
- **Pas de polices non-licensiees** — verification de la licence commerciale avant embedding.

---

## Assertions E2E cles (a tester)

- Template picker : selection d'un template de carte de visite
- Formulaire de carte de visite avec pre-remplissage depuis le profil Identity
- Field mapping : chargement des donnees depuis un Contact
- Preview temps reel lors de la modification d'un champ (< 200ms)
- Changement de theme de couleur avec mise a jour instantanee
- QR code genere avec les informations de contact (scan valide)
- Export PDF de carte de visite en 300 DPI avec crop marks
- Planche d'impression A4 avec 8-10 cartes
- Impression par lot : generation de 50 cartes pour un departement
- Creation d'un certificat avec champs dynamiques
- Numero de serie unique et QR code de verification
- Verification publique d'un certificat via URL (page accessible sans login)
- Revocation d'un certificat et verification de la page revoquee
- Generation de certificats en masse depuis un CSV
- Envoi par email de certificats avec piece jointe PDF
- Badge employe avec photo et code-barre scannable
- Badge visiteur avec expiration en fin de journee
- Workflow visiteur : check-in → badge imprime → check-out
- Etiquettes Avery L7160 : preview de la planche complete
- Fusion d'adresses depuis les Contacts vers des etiquettes
- Impression Dymo/Zebra depuis l'interface
- Papier a en-tete applique a l'export PDF d'un document Docs
- Enveloppe DL avec fusion d'adresses depuis les Contacts
- Poster/flyer : creation depuis template avec export PDF
- Brand kit applique automatiquement a tous les templates
- File d'impression : soumission, suivi, annulation
- Upload de police custom avec verification de licence
