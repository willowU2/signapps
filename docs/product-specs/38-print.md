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

### 1.1 Formulaire de saisie
Panneau gauche avec les champs du formulaire :
- **Nom complet** (pre-rempli depuis le profil)
- **Poste / Titre** (pre-rempli depuis HR)
- **Entreprise** (pre-rempli depuis l'organisation)
- **Email** (pre-rempli depuis le profil)
- **Telephone** (pre-rempli depuis le profil)
- **Site web** (pre-rempli depuis l'organisation)
- **Adresse** (pre-rempli depuis l'organisation)
- **Logo** (pre-rempli depuis le brand kit)

Chaque champ est editable. Champs optionnels masquables.

### 1.2 Preview en direct
Panneau droit avec apercu de la carte de visite en temps reel. Chaque modification dans le formulaire se reflète instantanement. Preview recto et verso (bouton bascule). Zoom pour voir les details. Grille d'alignement et guides.

### 1.3 Themes de couleur
Minimum 3 themes pre-definis :
- **Classique** : fond blanc, texte noir, accent couleur primaire de l'organisation
- **Sombre** : fond sombre, texte clair, accent vif
- **Gradient** : fond degrade, texte blanc, style moderne

Chaque theme est personnalisable : couleur de fond, couleur du texte, couleur d'accent. Color picker avec support hex/RGB/HSL.

### 1.4 Mise en page et disposition
Choix de la disposition : horizontale (standard 85x55mm) ou verticale (55x85mm). Alignement du texte : gauche, centre, droite. Placement du logo : haut-gauche, haut-droite, centre, bas. Taille du logo ajustable.

### 1.5 QR Code integre
Option d'ajouter un QR code sur la carte (recto ou verso). Contenu : vCard avec les informations de contact, URL du profil, lien personnalise. Position et taille configurables. Preview du QR code avec test de scan.

### 1.6 Recto/Verso
Design du recto (informations de contact) et du verso (logo agrandi, slogan, carte, pattern graphique, ou vide). Edition independante des deux faces. Templates distincts pour le verso.

### 1.7 Format et decoupe
Format standard : 85 x 55 mm (Europe) ou 89 x 51 mm (US). Coins : droits ou arrondis (rayon configurable). Zone de securite (safe zone) affichee pour les elements critiques (texte a 5mm du bord minimum).

### 1.8 Bouton Imprimer
Bouton `Imprimer` genere un PDF print-ready :
- Resolution : 300 DPI
- Espace colorimetrique : CMYK
- Fonds perdus : 3mm de chaque cote
- Traits de coupe (crop marks)
- Planche d'impression : multiples cartes par page A4 (8 ou 10 cartes)

Dialogue d'impression systeme ou sauvegarde du PDF dans Drive.

### 1.9 Impression par lot
Pour l'administrateur : generer les cartes de visite de tous les employes en une seule operation. Selection par departement, equipe ou individuel. Export en PDF unique (une page par employe) ou ZIP de PDFs individuels.

---

## Categorie 2 — Certificats et diplomes

### 2.1 Templates de certificats
Bibliotheque de templates : certificat de formation, diplome de reussite, attestation de participation, certificat de competence, diplome honorifique. Styles : academique (cadre orne, serif), moderne (minimaliste, sans-serif), professionnel (sobre, logo entreprise).

### 2.2 Champs dynamiques
Variables insérables dans le template :
- `{{nom}}` — nom du destinataire
- `{{formation}}` — intitule de la formation
- `{{date}}` — date de delivrance
- `{{formateur}}` — nom du formateur
- `{{duree}}` — duree de la formation
- `{{score}}` — note obtenue
- `{{numero}}` — numero de certificat (auto-increment)

Pre-remplissage depuis le module LMS (formations) ou saisie manuelle.

### 2.3 Signature et cachet
Emplacement pour la signature manuscrite (image uploadee) ou signature electronique (module Signatures). Cachet de l'organisation (logo + texte circulaire). Positionnement libre.

### 2.4 Numero de serie et verification
Chaque certificat porte un numero unique et un QR code de verification. Scan du QR code → page web confirmant l'authenticite (nom, formation, date). Base de donnees des certificats emis.

### 2.5 Generation en masse
Import CSV avec les noms des destinataires et les donnees variables. Generation de N certificats en un lot. Preview de 2-3 exemplaires avant validation. Export en PDF multi-pages ou ZIP.

### 2.6 Envoi par email
Apres generation, option d'envoyer chaque certificat par email a son destinataire (adresse dans le CSV ou depuis Contacts). Template d'email personnalisable. Piece jointe PDF.

---

## Categorie 3 — Etiquettes (Labels)

### 3.1 Formats d'etiquettes
Formats pre-definis compatibles avec les planches commerciales :
- Avery L7160 (21 par planche, 63.5 x 38.1 mm)
- Avery L7161 (18 par planche, 63.5 x 46.6 mm)
- Avery L7163 (14 par planche, 99.1 x 38.1 mm)
- Avery L7165 (8 par planche, 99.1 x 67.7 mm)
- Format personnalise (dimensions, marges, espacement)

### 3.2 Editeur d'etiquette
Zone d'edition aux dimensions exactes de l'etiquette. Outils : texte (multi-lignes, polices, tailles), code-barres (Code 128, EAN-13, QR Code, Data Matrix), images, formes, lignes de separation.

### 3.3 Fusion de donnees (publipostage)
Source de donnees : CSV, Contacts, ou saisie manuelle. Champs de fusion : `{{nom}}`, `{{adresse}}`, `{{code_postal}}`, `{{ville}}`. Preview de la planche complete avec les donnees fusionnees.

### 3.4 Codes-barres et QR codes
Generation de codes-barres dans l'etiquette : Code 128 (texte alphanumerique), EAN-13 (produits), QR Code (URL, texte, vCard), Data Matrix (compact). Donnees depuis un champ de fusion ou valeur fixe.

### 3.5 Planche d'impression
Remplissage automatique de la planche A4 avec les etiquettes. Preview de la planche entiere. Offset de debut (commencer a l'etiquette N pour les planches partiellement utilisees). Export PDF aux dimensions exactes.

---

## Categorie 4 — Badges (identification)

### 4.1 Templates de badges
Types : badge employe (photo, nom, departement, code-barre), badge visiteur (nom, entreprise, date, accompagnateur), badge evenement (nom, societe, role, QR code). Formats : carte de credit (85x55mm), badge A6 (105x148mm), lanyard (86x54mm).

### 4.2 Photo d'identite
Upload ou capture webcam. Recadrage automatique (detection de visage). Fond uni (blanc, gris, bleu) avec suppression de fond optionnelle. Dimensions normalisees.

### 4.3 Elements de securite
Code-barre (Code 128) ou QR code pour le scan a l'entree. Numero unique. Hologramme simule (pattern graphique complexe). Date de validite affichee. Logo de l'organisation.

### 4.4 Generation par lot
Import CSV ou selection depuis HR/Contacts. Generation de tous les badges en un lot. Planches de decoupe pour impression sur imprimante badge ou imprimante standard.

### 4.5 Badge temporaire (visiteur)
Workflow : reception saisit le nom du visiteur → badge genere et imprime instantanement → QR code pour l'acces. Expiration automatique en fin de journee. Log des visiteurs.

---

## Categorie 5 — Papier a en-tete (Letterhead)

### 5.1 Template de page
Design de la page A4 complete : en-tete (logo, nom de l'entreprise, slogan), pied de page (adresse, telephone, email, site web, mentions legales, SIRET, capital social). Zone de corps avec marges definies.

### 5.2 Variantes
Plusieurs variantes par organisation : papier a en-tete standard, papier a en-tete de direction, papier a en-tete par departement. Selection de la variante lors de la creation d'un document.

### 5.3 Integration avec Docs
Le papier a en-tete est applique automatiquement lors de l'export PDF d'un document Docs. L'utilisateur ecrit le corps du document dans Docs, le letterhead est ajoute a l'impression.

### 5.4 Export
Export PDF haute resolution avec en-tete et pied de page. Option : inclure uniquement sur la premiere page ou sur toutes les pages. Filigrane optionnel (CONFIDENTIEL, BROUILLON).

---

## Categorie 6 — Enveloppes

### 6.1 Formats d'enveloppes
Formats pre-definis :
- DL (110 x 220 mm) — format standard pour courrier A4 plie en 3
- C5 (162 x 229 mm) — pour A5 ou A4 plie en 2
- C4 (229 x 324 mm) — pour A4 non plie
- US Letter (#10, 4.125 x 9.5 inches)

### 6.2 Mise en page
Placement automatique : expediteur (haut-gauche), destinataire (centre-droite), zone d'affranchissement (haut-droite, vide). Logo optionnel a cote de l'expediteur. Mention optionnelle (RECOMMANDE, LETTRE SUIVIE, PERSONNEL).

### 6.3 Fusion d'adresses
Source de donnees : Contacts, CSV, saisie manuelle. Champs : nom, adresse, code postal, ville, pays. Generation de N enveloppes avec les adresses fusionnees. Preview avant impression.

### 6.4 Export et impression
PDF aux dimensions exactes de l'enveloppe. Indication du sens d'insertion dans l'imprimante (schéma). Option d'impression directe si l'imprimante supporte le format.

---

## Categorie 7 — Personnalisation et brand kit

### 7.1 Brand kit centralise
Definition au niveau de l'organisation :
- **Couleurs** : primaire, secondaire, accent, fond, texte (palette de 5-10 couleurs)
- **Polices** : titres, corps, accent (upload de polices custom ou selection Google Fonts)
- **Logo** : principal (couleur), secondaire (monochrome), icone (favicon/avatar)
- **Slogan** : phrase d'accroche de l'entreprise

Applique automatiquement a tous les templates.

### 7.2 Templates custom
Creation de templates personnalises par l'administrateur. Editeur visuel drag-and-drop. Elements fixes (logo, adresse) et variables (champs de fusion). Sauvegarde dans la bibliotheque de l'organisation. Versionning des templates.

### 7.3 Preview multi-format
Preview d'un meme design en plusieurs tailles : carte de visite, en-tete, envelope. Verification de la coherence visuelle. Ajustements specifiques par format.

### 7.4 Gestion des polices
Upload de polices custom (TTF, OTF, WOFF2). Verification de la licence (usage commercial). Embedding dans les PDFs exportes. Fallback si la police n'est pas disponible.

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

- Formulaire de carte de visite avec pre-remplissage depuis le profil
- Preview temps reel lors de la modification d'un champ
- Changement de theme de couleur avec mise a jour instantanee
- QR code genere avec les informations de contact (scan valide)
- Export PDF de carte de visite en 300 DPI avec crop marks
- Planche d'impression A4 avec 8-10 cartes
- Creation d'un certificat avec champs dynamiques
- Numero de serie unique et QR code de verification
- Generation de certificats en masse depuis un CSV
- Etiquettes Avery L7160 : preview de la planche complete
- Fusion d'adresses depuis les Contacts vers des etiquettes
- Badge employe avec photo et code-barre
- Badge visiteur avec expiration
- Papier a en-tete applique a l'export PDF d'un document Docs
- Enveloppe DL avec fusion d'adresses depuis les Contacts
- Brand kit applique automatiquement a tous les templates
- Impression par lot de cartes de visite pour un departement entier
