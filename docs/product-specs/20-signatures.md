# Module Signatures électroniques — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **DocuSign** | Leader, eSignature, CLM (Contract Lifecycle Management), identity verification, audit trails, reminders, templates, branding, mobile, API-first |
| **Adobe Acrobat Sign** | Intégration PDF native, templates, workflows, Acrobat Pro integration, enterprise |
| **PandaDoc** | Docs + e-signature + CPQ (Configure Price Quote), analytics, templates riches, payment, pricing tables |
| **HelloSign (Dropbox Sign)** | UX simple, intégration Dropbox, API développeur, templates, bulk send |
| **SignNow** | Affordable, bulk invites, templates, kiosk mode, mobile-first |
| **OneSpan Sign** | Enterprise, compliance strict, authentication avancée |
| **GetAccept** | Sales-focused, vidéo intros, analytics, tracking |
| **Dropbox Sign** | Intégration Dropbox, simple, abordable |
| **Yousign** | Français, eIDAS compliant, e-signature avancée |
| **Signaturely** | Gratuit limité, API, templates |
| **Docsketch** | Simple, abordable |
| **Oneflow** | Contracts, CLM, integrations |
| **Concord** | Contract management complet |

## Principes directeurs

1. **Conformité eIDAS** — supports des trois niveaux de signature (simple, avancée, qualifiée) selon le règlement européen.
2. **Audit trail inviolable** — traçabilité complète : qui, quand, depuis où, IP, user-agent, timestamps signés.
3. **Experience signataire** — signer en 30 secondes sans créer de compte, sur mobile, avec zero friction.
4. **Templates et workflows** — réutilisation, automation, routing multi-parties.
5. **Intégration native** — documents du Drive, contacts du CRM, workflows internes.
6. **Stockage sécurisé** — archivage légal, export conformes.

---

## Catégorie 1 — Création et préparation d'enveloppe

### 1.1 Nouvelle enveloppe
Bouton `Nouvelle demande de signature` ou `Nouvelle enveloppe`. Workflow guidé.

### 1.2 Upload de documents
Upload d'un ou plusieurs PDFs, DOCX, ou sélection depuis le drive. Si DOCX, conversion automatique en PDF.

### 1.3 Multiple documents
Une enveloppe peut contenir plusieurs documents (ex: contrat + annexe + conditions générales). Tous signés en même temps.

### 1.4 Preview PDF
Visualisation du document dans le navigateur avec zoom, navigation entre pages.

### 1.5 Ajout de signataires
Liste des signataires : nom, email, rôle (signer, approver, viewer, form filler), ordre de signature (séquentiel ou parallèle).

### 1.6 Signataires depuis les contacts
Auto-completion depuis les contacts SignApps. Création inline si nouveau contact.

### 1.7 Signature workflow (routing)
- **Séquentiel** : A signe, puis B, puis C (dans l'ordre)
- **Parallèle** : tous peuvent signer en même temps
- **Mixte** : groupes séquentiels avec parallélisme interne (A, puis B+C en parallèle, puis D)

### 1.8 Placement des champs
Sur chaque page du document, placer par drag-drop des champs :
- **Signature** (zone de signature obligatoire)
- **Paraphe / Initiales** (signature courte)
- **Date** (auto-remplie à la date de signature)
- **Nom** (auto-rempli avec le nom du signataire)
- **Texte libre** (à remplir par le signataire)
- **Checkbox** (à cocher)
- **Radio buttons** (choix unique)
- **Dropdown** (choix multiple)
- **Attachment** (upload d'un fichier par le signataire)

### 1.9 Assignation des champs
Chaque champ est assigné à un signataire spécifique (par couleur visuelle).

### 1.10 Champs obligatoires vs optionnels
Marquer certains champs comme requis (rouge) vs optionnels (bleu).

### 1.11 Pré-remplissage
Pré-remplir certains champs avec des données (ex: nom du client depuis le CRM, date d'aujourd'hui, montant depuis la facture).

### 1.12 Templates
Sauvegarder une enveloppe comme template pour réutilisation : contrats types, formulaires RH, NDAs.

### 1.13 Template library
Galerie de templates pré-construits : contrat de travail, NDA, proposition commerciale, cerfa, autorisation parentale.

### 1.14 Messages d'invitation
Subject et body du message email envoyé aux signataires. Variables disponibles.

### 1.15 Date d'expiration
Définir une date limite pour la signature. Après expiration, l'enveloppe est close.

### 1.16 Reminders
Rappels automatiques aux signataires qui n'ont pas encore signé (J+3, J+7, J+14).

---

## Catégorie 2 — Processus de signature

### 2.1 Invitation par email
Chaque signataire reçoit un email avec un lien unique pour accéder au document et signer.

### 2.2 Accès sans compte
Le signataire n'a pas besoin de créer un compte SignApps. Accès direct via le lien magique.

### 2.3 Vérification d'identité
Options d'authentification :
- **Simple** : email seulement
- **SMS OTP** : code envoyé par SMS
- **ID document** : upload de CIN/passport
- **Video selfie** : pour eIDAS qualified
- **SSO d'entreprise** : pour les signataires internes

### 2.4 Consentement d'utilisation
Avant de commencer, acceptation des conditions générales et consentement à la signature électronique.

### 2.5 Revue du document
Le signataire voit le document complet, peut naviguer dans les pages, zoomer. Les champs qu'il doit remplir sont surlignés.

### 2.6 Remplissage des champs
Clic sur un champ pour le remplir. Validation en temps réel (format, requis).

### 2.7 Signature
Click sur le champ signature → dialog avec options :
- **Dessin à la souris/doigt** sur un canvas
- **Saisie du nom** en stylisation (signature style police)
- **Upload d'une image** de signature existante
- **Signature sauvegardée** (si déjà créée dans un profil)

### 2.8 Apply signature
La signature remplit tous les champs signature assignés à ce signataire.

### 2.9 Confirmation
Avant la finalisation, récap des champs remplis. Bouton `Confirmer et signer`.

### 2.10 Acte final
Le document est signé. Le signataire reçoit une copie du PDF signé par email.

### 2.11 Refus de signer
Option `Refuser de signer` avec motif obligatoire. Notification à l'émetteur.

### 2.12 Reassign
Un signataire peut déléguer à quelqu'un d'autre (ex: "Ce contrat doit être signé par mon manager").

### 2.13 Questions
Le signataire peut poser une question à l'émetteur sans signer.

### 2.14 Mobile experience
Interface optimisée mobile : signature au doigt, formulaires faciles à remplir.

### 2.15 Multi-language
Interface de signature disponible en français, anglais, espagnol, allemand, italien, portugais, néerlandais, polonais, japonais.

---

## Catégorie 3 — Audit trail et preuve légale

### 3.1 Audit trail complet
Log horodaté de tous les événements :
- Enveloppe créée (par qui, quand, IP)
- Email envoyé à chaque signataire
- Email ouvert par le signataire
- Document consulté (timestamp, IP, user-agent)
- Signataire identifié (méthode)
- Champs remplis (horodatage individuel)
- Signature apposée (horodatage, IP)
- Document complété

### 3.2 Horodatage qualifié
Pour les signatures avancées/qualifiées : horodatage cryptographique RFC 3161 par un TSA (Time Stamping Authority) qualifié.

### 3.3 Certificat de signature
Pour les signatures avancées et qualifiées : certificat X.509 du signataire embarqué dans le PDF.

### 3.4 Checksums et hash
Hash SHA-256 du document à chaque étape. Détection de toute modification post-signature.

### 3.5 Certificat d'achèvement (Certificate of Completion)
PDF généré à la fin du processus contenant le résumé de l'audit trail : signataires, dates, IPs, statuts. Inclus dans le PDF final ou séparé.

### 3.6 Signature électronique intégrée au PDF
La signature est intégrée dans le PDF selon les standards PAdES (PDF Advanced Electronic Signatures). Compatible Adobe Reader.

### 3.7 Vérification de l'intégrité
Après signature, quiconque peut vérifier la validité en chargeant le PDF dans Adobe Reader ou SignApps.

### 3.8 Long-term validation (LTV)
PDF signé avec toutes les infos nécessaires pour vérifier la signature 10+ ans après (CRL, OCSP responses embedded).

### 3.9 Export de l'audit trail
Export de l'audit trail en PDF ou JSON pour archivage légal.

### 3.10 Immutabilité
Après signature, le document est verrouillé. Aucune modification possible. Seule option : déclarer invalide et créer un nouveau.

---

## Catégorie 4 — Niveaux de signature eIDAS

### 4.1 Signature électronique simple (SES)
Signature basique : email + clic. Juridiquement valable pour la plupart des cas (contrats commerciaux, B2C). Pas de vérification forte d'identité.

### 4.2 Signature électronique avancée (AES)
- Identifie le signataire de manière unique
- Sous le contrôle exclusif du signataire
- Vérification d'identité (ex: SMS OTP, photo d'ID)
- Intégrité du document garantie
- Certificat numérique avec clé privée

### 4.3 Signature électronique qualifiée (QES)
Plus haut niveau légal :
- Certificat qualifié émis par un QTSP (Qualified Trust Service Provider)
- Dispositif de création de signature qualifié (QSCD)
- Vérification d'identité en face-à-face ou équivalent
- Présomption légale d'équivalence avec la signature manuscrite

### 4.4 Niveau choisi par document
L'émetteur choisit le niveau requis par document selon le risque et la loi applicable.

### 4.5 Intégration QTSP
Intégration avec des fournisseurs qualifiés français/européens : Universign, DocuSign QES, Certsign, BearingPoint, etc.

### 4.6 Certificat temporaire
Pour les signatures avancées, émission d'un certificat temporaire au moment de la signature (pas de long-term certificate).

### 4.7 e-ID nationale
Support des cartes d'identité électroniques (FranceConnect, Itsme en Belgique, SPID en Italie, DigiD aux Pays-Bas).

---

## Catégorie 5 — Templates et réutilisation

### 5.1 Template library
Galerie de templates personnels et organisation. Preview, duplication, édition.

### 5.2 Création de template
Sauvegarder une enveloppe comme template. Variables à remplir pour chaque envoi (`{{client_name}}`, `{{amount}}`, `{{date}}`).

### 5.3 Template merge fields
Champs variables dans le texte du document remplacés au moment de l'envoi.

### 5.4 Template permissions
Templates personnels vs partagés avec l'équipe vs organisation-wide.

### 5.5 Template versioning
Historique des versions d'un template.

### 5.6 Bulk send
Envoi d'un même template à N destinataires différents avec données individuelles (depuis CSV ou tableur). Parfait pour les renouvellements de contrats massifs.

### 5.7 Powerform (link to sign)
Générer un lien public qui permet à n'importe qui de remplir et signer le document. Le signataire entre son nom/email et remplit les champs. Utilisé pour les inscriptions, consentements, etc.

### 5.8 Kiosk mode
Mode où plusieurs personnes signent successivement sur un même iPad (ex: consentements médicaux à l'accueil).

### 5.9 Template analytics
Combien de fois un template a été utilisé, taux de complétion, temps moyen.

---

## Catégorie 6 — Tableau de bord et suivi

### 6.1 Dashboard d'envois
Vue de tous les envois avec :
- Statut (draft, envoyé, consulté, partiellement signé, complété, expiré, refusé)
- Signataires restants
- Date d'envoi et date d'expiration
- Dernière activité

### 6.2 Filtres et recherche
Filtrer par statut, signataire, template, date, tag.

### 6.3 Détail d'un envoi
Clic sur un envoi → vue détaillée avec signataires, leur statut, audit trail, document.

### 6.4 Actions en cours
Bouton `Relancer` pour envoyer un rappel manuel. `Modifier le destinataire` pour un email incorrect. `Annuler l'envoi` (avant que quiconque ait signé).

### 6.5 Real-time updates
Notification en temps réel (push, email) à l'émetteur quand quelqu'un signe.

### 6.6 Email de completion
Email automatique quand le document est complètement signé, avec PDF final en pièce jointe, envoyé à toutes les parties.

### 6.7 Organisation par dossier
Organiser les envois en dossiers (par client, par projet, par année).

### 6.8 Tags
Tagger les envois pour faciliter la recherche.

### 6.9 Export liste
Export CSV/Excel de la liste des envois.

---

## Catégorie 7 — Intégrations

### 7.1 Drive
Sélectionner un document du Drive à signer. Sauvegarder le document signé dans un dossier du Drive.

### 7.2 Docs
Envoyer un document créé dans Docs pour signature directement.

### 7.3 CRM
Lier une enveloppe à un deal ou un contact. Statut visible dans le CRM.

### 7.4 Mail
Envoi via le module Mail SignApps. Historique dans l'activité du contact.

### 7.5 HR
Pour l'onboarding : contrats de travail signés automatiquement à la création d'un employé.

### 7.6 Billing
Devis signés électroniquement directement convertis en factures.

### 7.7 Forms
Formulaires web avec signature intégrée.

### 7.8 Workflows
Actions workflow pour déclencher une demande de signature. Trigger sur completion.

### 7.9 API REST
API complète pour création/envoi/suivi d'enveloppes. Webhooks pour events.

### 7.10 Zapier / Make
Connecteurs pour les intégrations tierces.

### 7.11 Export to Google Drive / Dropbox / OneDrive
Export automatique des documents signés vers un storage externe.

### 7.12 CLM Integration
Export vers des systèmes de Contract Lifecycle Management plus avancés si nécessaire.

---

## Catégorie 8 — Sécurité et conformité

### 8.1 Chiffrement end-to-end
Documents chiffrés at rest (AES-256) et in transit (TLS 1.3).

### 8.2 Archivage légal
Documents signés archivés pendant 10 ans minimum (obligation légale en France). Prolongation possible.

### 8.3 Horodatage qualifié
Timestamps RFC 3161 par TSA qualifié pour les signatures avancées/qualifiées.

### 8.4 Compliance eIDAS (EU)
Conformité au règlement européen eIDAS (910/2014) pour la reconnaissance légale des signatures électroniques.

### 8.5 Compliance UETA / ESIGN (US)
Conformité aux lois US pour la reconnaissance des signatures électroniques.

### 8.6 HIPAA (healthcare US)
Support pour les documents médicaux HIPAA-compliant.

### 8.7 Data residency
Choix de la région de stockage (EU pour RGPD, US, etc.).

### 8.8 Audit trail immuable
Log stocké de manière immuable (append-only, blockchain-style optionnel).

### 8.9 Double encryption
Encryption locale + encryption in database. Multi-layered.

### 8.10 RGPD compliance
- Droit d'accès : signataire peut obtenir sa copie
- Droit à l'oubli : suppression sur demande (sauf obligation légale)
- Consentement explicite
- Minimisation des données

### 8.11 Backup et DR
Backup quotidien, disaster recovery plan. RPO < 1h, RTO < 4h.

### 8.12 Pen testing annuel
Audit sécurité par un tiers qualifié chaque année.

---

## Catégorie 9 — Branding et personnalisation

### 9.1 Logo personnalisé
Logo de l'organisation sur les emails et les pages de signature.

### 9.2 Couleurs et thème
Couleurs, police, CSS custom pour cohérence avec la charte graphique.

### 9.3 Custom domain
Emails envoyés depuis `sign.monentreprise.com`. Liens de signature avec custom domain.

### 9.4 Email templates custom
Personnaliser le wording des emails envoyés aux signataires.

### 9.5 Reply-to address
Configurer l'adresse de réponse (par défaut ou par utilisateur).

### 9.6 Remove SignApps branding
Option pour les plans payants de retirer le "Powered by SignApps".

### 9.7 Landing page custom
Page d'atterrissage personnalisée vue par les signataires.

### 9.8 Multi-language par branding
Définir la langue par défaut pour chaque brand.

---

## Catégorie 10 — Mobile et accessibilité

### 10.1 Mobile web optimized
Interface de signature fonctionne parfaitement sur mobile (touch signature, grands boutons).

### 10.2 Application mobile native
iOS et Android pour émettre et suivre des enveloppes, signer en déplacement.

### 10.3 In-person signing
Mode "signer en personne" sur l'app mobile : passer l'appareil à un autre pour signature, retour à l'émetteur.

### 10.4 Offline signing (mobile)
Signer des documents hors-ligne, sync au retour.

### 10.5 Accessibility WCAG AA
Navigation clavier, screen reader, contrastes. Signature alternative pour les personnes handicapées (signature audio, signature assistée).

### 10.6 Keyboard shortcuts
Raccourcis pour naviguer dans le document et les champs.

---

## Catégorie 11 — IA intégrée

### 11.1 Auto-detection des champs
L'IA détecte automatiquement les zones de signature, nom, date dans un document uploadé. Placement auto-suggéré.

### 11.2 OCR sur documents scannés
Documents PDFs scannés (images) → OCR pour rendre le texte sélectionnable et les zones détectables.

### 11.3 Contract review
L'IA lit le contrat et signale les clauses potentiellement risquées ou non standard. Suggestions d'amélioration.

### 11.4 Résumé du contrat
Générer un résumé des points clés pour le signataire (en plus du texte complet).

### 11.5 Traduction
Traduire le contrat en plusieurs langues pour les signataires internationaux.

### 11.6 Q&A sur le contrat
Le signataire peut poser des questions en langage naturel sur le contrat. L'IA répond avec citation des paragraphes sources.

### 11.7 Extract key data
Extraction automatique des données clés (parties, montants, dates, durées) pour alimenter le CRM.

### 11.8 Duplicate detection
Détection des contrats similaires déjà signés pour éviter les doublons.

### 11.9 Compliance check
Vérification que le contrat contient les mentions obligatoires légales (selon le type et le pays).

### 11.10 Risk scoring
Score de risque d'un contrat basé sur la complexité, la durée, le montant, le type.

---

## Sources d'inspiration

### Aides utilisateur publiques
- **DocuSign Support** (support.docusign.com) — templates, workflows, compliance.
- **Adobe Sign Help** (helpx.adobe.com/sign) — PDF native signature.
- **PandaDoc Help** (support.pandadoc.com) — docs + signature.
- **HelloSign (Dropbox Sign) Help** (faq.hellosign.com) — simple e-signature.
- **eIDAS Regulation** (eur-lex.europa.eu) — règlement européen officiel.
- **ETSI standards** (etsi.org) — standards techniques pour les signatures qualifiées.
- **PAdES specification** (etsi.org) — signatures électroniques dans les PDFs.

### Projets open source permissifs
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL**

| Projet | Licence | Ce qu'on peut étudier |
|---|---|---|
| **Documenso** (documenso.com, github.com/documenso/documenso) | **AGPL v3** | **INTERDIT**. Alternative DocuSign open source. Étudier via démo publique. |
| **BoxyHQ** | **Apache-2.0** | Security-focused, enterprise SSO. |
| **Papermark** (papermark.io) | **AGPL v3** | **INTERDIT**. Data room. |
| **eSignatur** | **GPL v3** | **INTERDIT**. |
| **OpenSignature** | Various | À vérifier. |
| **pdf-lib** (pdf-lib.js.org) | **MIT** | Génération et modification de PDFs côté JS. |
| **pdfmake** | **MIT** | Génération PDF. |
| **jsPDF** | **MIT** | Génération PDF legacy. |
| **PDF.js** (mozilla.github.io/pdf.js) | **Apache-2.0** | Viewer PDF dans navigateur. |
| **node-forge** (github.com/digitalbazaar/forge) | **BSD-3-Clause / GPL v2 dual** | **Attention dual license**. Crypto in JS. |
| **signpdf** (github.com/vbuch/node-signpdf) | **MIT** | Signer des PDFs en Node.js. |
| **signature_pad** (szimek.github.io/signature_pad) | **MIT** | Canvas de signature. |
| **OpenSSL** | **Apache-2.0** (depuis 3.0) | Crypto de référence. |
| **PDF-lib** | **MIT** | Manipulation PDF. |
| **PyPDF2 / pypdf** | **BSD-3-Clause** | Python PDF library. |
| **HummusJS / muhammara** | **Apache-2.0** | Alternative HS PDF JS. |
| **DSS (Digital Signature Services)** (github.com/esig/dss) | **LGPL v2.1** | **Weak copyleft** — OK consommateur. Library complète pour signatures eIDAS (Java). |
| **pdf-signing-js** (divers MIT) | **MIT** | Signatures PDF simples. |
| **jsrsasign** (github.com/kjur/jsrsasign) | **MIT** | Cryptographic utilities JS. |

### Pattern d'implémentation recommandé
1. **PDF manipulation** : `pdf-lib` (MIT) pour créer/modifier, PDF.js (Apache-2.0) pour viewer.
2. **PDF signing** : `signpdf` (MIT) pour Node.js, ou intégration Java avec DSS (LGPL en dynamic linking).
3. **Signature canvas** : `signature_pad` (MIT) pour la saisie tactile.
4. **Crypto** : `node-forge` (BSD-3/GPL dual) — utiliser uniquement la partie BSD-3. Ou libsodium.
5. **Audit trail** : append-only log en DB avec hash chaîné pour détection de tampering.
6. **Horodatage** : client RFC 3161 vers un TSA qualifié (FreeTSA ou service commercial pour prod).
7. **Certificats** : génération de certificats X.509 temporaires pour AES. Intégration QTSP pour QES.
8. **Email delivery** : module Mail SignApps avec tracking d'ouverture.
9. **Identity verification** : intégration Stripe Identity, Onfido, Veriff pour SMS/ID/face verification.
10. **LTV (Long-term Validation)** : embed CRL/OCSP dans le PDF pour vérification future.
11. **OCR** : Tesseract.js (Apache-2.0) pour les PDFs scannés.
12. **AI contract review** : LLM interne avec prompts spécialisés légaux.

### Ce qu'il ne faut PAS faire
- **Pas de fork** de Documenso, Papermark (AGPL).
- **Attention a DSS** (LGPL) : OK comme library dynamique, mais pas forker.
- **Attention a node-forge** : dual license, utiliser seulement les parties BSD-3.
- **Pas d'invocation d'une signature** sans consentement explicite du signataire.

---

## UI Behavior Details

### Envelope Preparation Wizard
Step-by-step wizard with 4 steps shown as a progress bar at the top. Step 1 "Documents": drag-drop zone for PDF upload (or "Select from Drive" button). Multiple files can be added; they appear as a vertical list with thumbnails, reorder handles, and delete icons. Step 2 "Signataires": table with columns Name, Email, Role (dropdown: Signer/Approver/Viewer/Form Filler), Order (dropdown: 1/2/3 or "Same time" for parallel). Each signer gets a distinct color. "Add signer" button at bottom. Autocomplete from Contacts on name/email fields. Step 3 "Fields": full PDF viewer in center with zoom controls. Left panel shows field palette: Signature, Initials, Date, Name, Text, Checkbox, Radio, Dropdown, Attachment. Each field type shows the color of the assigned signer. Drag from palette to the PDF page to place a field. Click a placed field to select it — properties panel on the right shows: assigned signer (dropdown), required/optional toggle, pre-fill value, dimensions. Fields snap to text baselines detected by OCR. Step 4 "Review & Send": summary showing document list, signer list with order, field count per signer, message subject and body (editable rich text with variables), expiration date picker, reminder schedule checkboxes (3 days, 7 days, 14 days).

### PDF Viewer for Signataires
When a signer opens the link, a full-page PDF viewer loads. Navigation: page thumbnails on left (collapsible), page number input at bottom, zoom slider. All fields assigned to this signer are highlighted with a pulsing colored border. Non-assigned fields are grayed out. A floating "guide" panel in the top-right says "3 fields to complete" with a "Start" button that scrolls to the first field. After filling each field, a "Next" button auto-scrolls to the next. After all fields are filled, the "Confirm and Sign" button appears at the bottom. A progress bar at the top shows "2/3 fields completed".

### Signature Dialog
When the signer clicks a signature field, a modal dialog opens with three tabs. Tab "Draw": a canvas (300x150px) where the signer draws with mouse or finger. Clear button, color picker (black/blue/red), pen thickness slider. Tab "Type": text input with the signer's name pre-filled; 5 signature-style fonts previewed below. Tab "Upload": drag-drop zone for an existing signature image (PNG/JPG). A "Save for future use" checkbox stores the signature in the signer's profile. "Apply" button places the signature in the field and all other signature fields assigned to this signer.

### Dashboard
Default view shows all envelopes in a table with columns: Title, Status (colored badge), Signataires (avatar stack with progress dots), Sent Date, Expiration Date, Last Activity. Status badges: Draft (gray), Sent (blue), Viewed (yellow), Partially Signed (orange), Completed (green), Expired (red), Refused (dark red). Filter bar at top: status dropdown, date range picker, search by title or signer name, tag filter. Bulk actions on selected rows: remind, void, delete. Click an envelope to open the detail view.

### Envelope Detail View
Three-panel layout. Left (20%): document thumbnail navigator. Center (55%): PDF viewer with all fields visible (completed fields show values, pending fields show placeholders). Right (25%): signer status list (each signer with name, email, status icon, and timestamp of last action). Below the signer list: audit trail log (scrollable, reverse-chronological). Actions bar at top: "Remind", "Void", "Download PDF", "Download Audit Trail", "Edit Recipients" (only before any signatures).

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New envelope |
| `Ctrl+S` | Send envelope (from review step) |
| `Ctrl+D` | Download signed PDF |
| `Tab` | Next field (signer view) |
| `Shift+Tab` | Previous field (signer view) |
| `Enter` | Confirm current field |
| `Ctrl+Enter` | Confirm and sign (after all fields) |
| `Escape` | Close dialog / cancel |
| `Ctrl+Z` | Undo field placement (preparation) |
| `+` / `-` | Zoom in/out (PDF viewer) |
| `Ctrl+F` | Search in document text |
| `Page Up/Down` | Navigate pages |
| `Ctrl+/` | Show keyboard shortcut help |

---

## Schema PostgreSQL

```sql
-- Signature envelopes
CREATE TABLE sig_envelopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    title VARCHAR(512) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, sent, viewed, partially_signed, completed, expired, voided, refused
    routing_type VARCHAR(16) NOT NULL DEFAULT 'parallel', -- sequential, parallel, mixed
    message_subject VARCHAR(512),
    message_body TEXT,
    expires_at TIMESTAMPTZ,
    reminder_schedule JSONB DEFAULT '[]', -- [3, 7, 14] (days after send)
    custom_branding JSONB DEFAULT '{}', -- {logo_url, primary_color, font, reply_to}
    template_id UUID REFERENCES sig_templates(id),
    tags TEXT[] DEFAULT '{}',
    folder_id UUID,
    eidas_level VARCHAR(16) NOT NULL DEFAULT 'simple', -- simple, advanced, qualified
    completed_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,
    voided_reason TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sig_envelopes_workspace ON sig_envelopes(workspace_id, status);
CREATE INDEX idx_sig_envelopes_creator ON sig_envelopes(created_by);
CREATE INDEX idx_sig_envelopes_expires ON sig_envelopes(expires_at) WHERE status IN ('sent', 'viewed', 'partially_signed');
CREATE INDEX idx_sig_envelopes_tags ON sig_envelopes USING gin(tags);

-- Documents in an envelope
CREATE TABLE sig_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    envelope_id UUID NOT NULL REFERENCES sig_envelopes(id) ON DELETE CASCADE,
    file_name VARCHAR(512) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(128) NOT NULL DEFAULT 'application/pdf',
    storage_path TEXT NOT NULL, -- path in Drive/storage
    page_count INT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    original_hash VARCHAR(64) NOT NULL, -- SHA-256 of original file
    signed_storage_path TEXT, -- path to signed version
    signed_hash VARCHAR(64), -- SHA-256 of signed file
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sig_documents_envelope ON sig_documents(envelope_id, sort_order);

-- Signataires (recipients of an envelope)
CREATE TABLE sig_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    envelope_id UUID NOT NULL REFERENCES sig_envelopes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'signer', -- signer, approver, viewer, form_filler
    routing_order INT NOT NULL DEFAULT 1, -- for sequential routing
    contact_id UUID REFERENCES contacts(id), -- link to contacts module
    color VARCHAR(7) NOT NULL DEFAULT '#3b82f6', -- visual color in field editor
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, notified, viewed, signed, refused, delegated
    access_token VARCHAR(128) NOT NULL, -- unique magic link token
    identity_verification VARCHAR(16) DEFAULT 'email', -- email, sms_otp, id_document, video_selfie, sso
    phone_for_otp VARCHAR(50), -- if sms_otp verification
    signed_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    refused_at TIMESTAMPTZ,
    refused_reason TEXT,
    delegated_to UUID REFERENCES sig_recipients(id),
    ip_address INET,
    user_agent TEXT,
    signature_image_url TEXT, -- stored drawn/typed/uploaded signature
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sig_recipients_envelope ON sig_recipients(envelope_id, routing_order);
CREATE UNIQUE INDEX idx_sig_recipients_token ON sig_recipients(access_token);
CREATE INDEX idx_sig_recipients_email ON sig_recipients(email);

-- Fields placed on documents
CREATE TABLE sig_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES sig_documents(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES sig_recipients(id) ON DELETE CASCADE,
    field_type VARCHAR(20) NOT NULL, -- signature, initials, date, name, text, checkbox, radio, dropdown, attachment
    page_number INT NOT NULL,
    position_x NUMERIC(10,4) NOT NULL, -- percentage of page width
    position_y NUMERIC(10,4) NOT NULL,
    width NUMERIC(10,4) NOT NULL,
    height NUMERIC(10,4) NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT true,
    prefill_value TEXT,
    options JSONB, -- for dropdown: ["Option A", "Option B"]; for radio: [{label, value}]
    filled_value TEXT, -- value entered by signer
    filled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sig_fields_document ON sig_fields(document_id, page_number);
CREATE INDEX idx_sig_fields_recipient ON sig_fields(recipient_id);

-- Audit trail (immutable append-only log)
CREATE TABLE sig_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    envelope_id UUID NOT NULL REFERENCES sig_envelopes(id) ON DELETE CASCADE,
    event_type VARCHAR(32) NOT NULL, -- created, sent, viewed, field_filled, signed, refused, delegated, reminded, expired, voided, completed, downloaded
    actor_type VARCHAR(16) NOT NULL, -- system, sender, recipient
    actor_id UUID, -- user ID or recipient ID
    actor_email VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}', -- event-specific data
    document_hash VARCHAR(64), -- SHA-256 at this point in time
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sig_audit_envelope ON sig_audit_log(envelope_id, occurred_at);

-- Certificate of completion
CREATE TABLE sig_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    envelope_id UUID NOT NULL REFERENCES sig_envelopes(id),
    certificate_pdf_path TEXT NOT NULL, -- stored in Drive
    certificate_hash VARCHAR(64) NOT NULL,
    timestamp_token BYTEA, -- RFC 3161 timestamp response
    timestamp_authority VARCHAR(255),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Templates
CREATE TABLE sig_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    title VARCHAR(512) NOT NULL,
    description TEXT,
    category VARCHAR(64), -- nda, employment, proposal, consent, invoice
    documents JSONB NOT NULL DEFAULT '[]', -- [{file_name, storage_path, page_count}]
    recipient_roles JSONB NOT NULL DEFAULT '[]', -- [{role, label, color}]
    fields JSONB NOT NULL DEFAULT '[]', -- [{field_type, page, position, recipient_role, required}]
    merge_fields TEXT[] DEFAULT '{}', -- {{client_name}}, {{amount}}, {{date}}
    message_subject VARCHAR(512),
    message_body TEXT,
    usage_count INT NOT NULL DEFAULT 0,
    is_shared BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sig_templates_workspace ON sig_templates(workspace_id);

-- Powerforms (public signing links)
CREATE TABLE sig_powerforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES sig_templates(id),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    slug VARCHAR(128) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    max_uses INT,
    current_uses INT NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_sig_powerforms_slug ON sig_powerforms(slug);

-- Saved signatures (per user)
CREATE TABLE sig_saved_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    signature_type VARCHAR(16) NOT NULL, -- drawn, typed, uploaded
    image_url TEXT NOT NULL,
    font_name VARCHAR(128), -- for typed signatures
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sig_saved ON sig_saved_signatures(user_id);
```

---

## REST API Endpoints

All endpoints require JWT authentication unless noted. Base path: signatures handler embedded in `signapps-gateway` or a dedicated service.

### Envelopes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/signatures/envelopes?status=&tag=&q=&from=&to=&page=` | List envelopes |
| POST | `/api/v1/signatures/envelopes` | Create envelope (draft) |
| GET | `/api/v1/signatures/envelopes/:id` | Get envelope detail (with recipients, fields, audit) |
| PATCH | `/api/v1/signatures/envelopes/:id` | Update envelope (title, message, expiry, reminders) |
| DELETE | `/api/v1/signatures/envelopes/:id` | Delete draft envelope |
| POST | `/api/v1/signatures/envelopes/:id/send` | Send envelope to recipients |
| POST | `/api/v1/signatures/envelopes/:id/void` | Void envelope `{reason}` |
| POST | `/api/v1/signatures/envelopes/:id/remind` | Send manual reminder to pending signers |
| GET | `/api/v1/signatures/envelopes/:id/audit` | Get audit trail |
| GET | `/api/v1/signatures/envelopes/:id/certificate` | Download certificate of completion |
| GET | `/api/v1/signatures/envelopes/:id/download` | Download signed PDF(s) |

### Documents
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/signatures/envelopes/:id/documents` | Upload document (multipart) |
| DELETE | `/api/v1/signatures/envelopes/:id/documents/:did` | Remove document |
| PATCH | `/api/v1/signatures/envelopes/:id/documents/reorder` | Reorder documents |

### Recipients
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/signatures/envelopes/:id/recipients` | Add recipient |
| PATCH | `/api/v1/signatures/envelopes/:id/recipients/:rid` | Update recipient (name, email, role, order) |
| DELETE | `/api/v1/signatures/envelopes/:id/recipients/:rid` | Remove recipient |

### Fields
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/signatures/envelopes/:id/fields` | Add field |
| PATCH | `/api/v1/signatures/envelopes/:id/fields/:fid` | Update field (position, size, options) |
| DELETE | `/api/v1/signatures/envelopes/:id/fields/:fid` | Remove field |
| POST | `/api/v1/signatures/envelopes/:id/fields/auto-detect` | AI auto-detect signature zones |

### Signing (accessed via magic link token, no JWT required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/signatures/sign/:token` | Load document and fields for signing |
| POST | `/api/v1/signatures/sign/:token/verify` | Identity verification (SMS OTP code) |
| PATCH | `/api/v1/signatures/sign/:token/fields/:fid` | Fill a field |
| POST | `/api/v1/signatures/sign/:token/confirm` | Confirm and apply signature |
| POST | `/api/v1/signatures/sign/:token/refuse` | Refuse to sign `{reason}` |
| POST | `/api/v1/signatures/sign/:token/delegate` | Delegate to another person `{name, email}` |
| POST | `/api/v1/signatures/sign/:token/question` | Ask a question to the sender |

### Templates
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/signatures/templates?category=&q=` | List templates |
| POST | `/api/v1/signatures/templates` | Create template |
| PATCH | `/api/v1/signatures/templates/:id` | Update template |
| DELETE | `/api/v1/signatures/templates/:id` | Delete template |
| POST | `/api/v1/signatures/templates/:id/use` | Create envelope from template `{recipients, merge_values}` |
| GET | `/api/v1/signatures/templates/:id/analytics` | Template usage stats |

### Bulk Send
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/signatures/bulk-send` | Bulk send template to CSV recipients `{template_id, csv_file}` |
| GET | `/api/v1/signatures/bulk-send/:batch_id` | Get batch status |

### Powerforms
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/signatures/powerforms` | Create powerform from template |
| GET | `/api/v1/signatures/powerforms` | List powerforms |
| DELETE | `/api/v1/signatures/powerforms/:id` | Deactivate powerform |
| GET | `/api/v1/signatures/powerforms/:slug` | Public: load powerform (no auth) |
| POST | `/api/v1/signatures/powerforms/:slug/submit` | Public: self-sign powerform (no auth) |

### Saved Signatures
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/signatures/saved` | List saved signatures |
| POST | `/api/v1/signatures/saved` | Save a signature |
| DELETE | `/api/v1/signatures/saved/:id` | Delete saved signature |
| PATCH | `/api/v1/signatures/saved/:id/default` | Set as default |

### Branding
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/signatures/branding` | Get workspace branding settings |
| PATCH | `/api/v1/signatures/branding` | Update branding (logo, colors, domain, email template) |

### AI
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/signatures/ai/detect-fields` | Auto-detect signature zones in PDF |
| POST | `/api/v1/signatures/ai/ocr` | OCR scanned PDF to make text selectable |
| POST | `/api/v1/signatures/ai/review-contract` | AI contract review (risks, clauses) |
| POST | `/api/v1/signatures/ai/summarize` | Generate contract summary |
| POST | `/api/v1/signatures/ai/translate` | Translate contract |
| POST | `/api/v1/signatures/ai/extract-data` | Extract key data (parties, amounts, dates) |
| POST | `/api/v1/signatures/ai/compliance-check` | Check for mandatory legal mentions |
| POST | `/api/v1/signatures/ai/ask` | Q&A on contract content |

---

## PgEventBus Events

| Event | Payload | Consumers |
|-------|---------|-----------|
| `signatures.envelope.created` | `{envelope_id, workspace_id, created_by, document_count}` | dashboard |
| `signatures.envelope.sent` | `{envelope_id, recipient_count, eidas_level}` | notifications (recipients), audit |
| `signatures.envelope.viewed` | `{envelope_id, recipient_id, recipient_email, ip}` | notifications (sender), audit |
| `signatures.envelope.signed` | `{envelope_id, recipient_id, recipient_email, ip}` | notifications (sender, next recipient in sequence), audit |
| `signatures.envelope.completed` | `{envelope_id, workspace_id, document_ids[], recipient_emails[]}` | notifications (all parties), crm, billing, drive (archive), audit |
| `signatures.envelope.refused` | `{envelope_id, recipient_id, reason}` | notifications (sender), audit |
| `signatures.envelope.expired` | `{envelope_id, workspace_id}` | notifications (sender) |
| `signatures.envelope.voided` | `{envelope_id, voided_by, reason}` | notifications (all recipients), audit |
| `signatures.envelope.reminded` | `{envelope_id, recipient_id}` | notifications (recipient) |
| `signatures.recipient.delegated` | `{envelope_id, from_recipient_id, to_name, to_email}` | notifications (sender, new recipient), audit |
| `signatures.field.filled` | `{envelope_id, recipient_id, field_id, field_type}` | audit |
| `signatures.bulk.completed` | `{batch_id, total, sent, failed}` | notifications |
| `signatures.template.used` | `{template_id, envelope_id}` | analytics |
| `signatures.certificate.generated` | `{envelope_id, certificate_id}` | audit |

---

## Inter-module Integration

### Signatures <-> Drive (signapps-storage, port 3004)
Documents uploaded for signing are stored in Drive. The "Select from Drive" button in the wizard browses Drive folders. After completion, the signed PDF and certificate of completion are saved back to Drive in a "Signed Documents" folder (auto-created). The original unsigned document is preserved alongside the signed version.

### Signatures <-> Docs (signapps-docs, port 3010)
A document created in Docs can be sent for signature directly from the Docs editor via a "Send for Signature" button. The Docs module exports the document as PDF and creates a new envelope with the PDF pre-loaded.

### Signatures <-> CRM (signapps-crm)
When an envelope is linked to a CRM deal or contact (via `contact_id` on recipients), the signature status is visible on the deal/contact activity timeline. When the envelope is completed, the CRM logs a "Contract signed" activity. The CRM emits `crm.deal.won` which can trigger a signature request for the service agreement.

### Signatures <-> Billing (signapps-billing, port 8096)
Signed quotes/proposals can be automatically converted to invoices. When `signatures.envelope.completed` fires with a billing-linked template, the Billing module creates an invoice draft with the extracted amount and recipient as customer.

### Signatures <-> HR / Workforce (signapps-workforce)
Employee onboarding workflows trigger signature requests for employment contracts, NDAs, and policy acknowledgments. The HR module creates envelopes using templates and pre-fills merge fields (employee name, position, start date, salary). Completion events update the onboarding checklist.

### Signatures <-> Forms (signapps-forms, port 3015)
Forms with integrated signature fields use the Signatures module for the actual signing flow. The form submission triggers an envelope creation with the form data pre-filled into the document fields.

### Signatures <-> Mail (signapps-mail, port 3012)
All signature-related emails (invitations, reminders, completion notifications) are sent through the Mail service. Email tracking (opens) feeds back into the audit trail. Custom reply-to addresses route through the Mail configuration.

### Signatures <-> AI (signapps-ai, port 3005)
AI features (field auto-detection, OCR, contract review, summary, translation, data extraction, compliance check, Q&A) route through the AI gateway. The Signatures module sends PDF content and context; the AI returns structured results (field positions, text analysis, risk scores).

### Signatures <-> Contacts (signapps-contacts)
Recipient autocomplete in the wizard uses the Contacts search API. When a new external signer is not in contacts, an option to add them appears after the envelope is sent. Completed signatures log activities on the contact record.

### Signatures <-> Workflows (signapps-workflows)
Workflow automation can trigger signature requests as an action step. Workflow conditions can depend on signature completion events. Example: "When a deal moves to Won -> Send contract for signature -> On completion, create invoice".

---

## Assertions E2E cles (a tester)

- Create envelope: upload PDF -> document visible with page thumbnails
- Upload DOCX -> auto-converted to PDF
- Multiple documents: add 2 PDFs -> both listed with reorder handles
- Add signer: name + email -> appears in recipient list with color
- Add approver role -> marked differently from signer
- Sequential routing: set order 1, 2, 3 -> signer 2 only notified after signer 1 completes
- Parallel routing: set all to "Same time" -> all notified simultaneously
- Mixed routing: group A parallel, then group B sequential -> correct notification order
- Place signature field: drag from palette to PDF page -> field appears at drop position
- Place date field: auto-fills with current date when signer signs
- Place text field: signer can type free text
- Place checkbox: signer can check/uncheck
- Assign fields to different signers: color-coded correctly
- Required field: marked red, blocks signing if empty
- AI auto-detect: click "Auto-detect" -> signature and date zones identified on standard contract
- Send envelope -> signers receive email with unique link
- Signer opens link -> document loads without requiring SignApps account
- Signer views document -> "Viewed" status in dashboard, audit log entry
- Signer fills text field -> value saved
- Signer draws signature on canvas -> signature applied to all signature fields
- Signer types name as signature -> styled font renders
- Signer uploads signature image -> placed correctly
- "Save for future use" checkbox -> signature available for next envelope
- Signer confirms -> status changes to "Signed", next signer notified (sequential)
- All signers complete -> envelope status "Completed", email sent to all parties
- Download signed PDF -> opens in Adobe Reader with valid signature badge
- Audit trail: shows created, sent, viewed, signed events with timestamps and IPs
- Certificate of completion: PDF generated with full audit summary
- Refuse to sign -> mandatory reason -> sender notified
- Delegate signing -> new signer receives invitation, original signer marked "delegated"
- Ask question -> message sent to sender without signing
- Expiration: set expiry 1 day ago -> envelope auto-expires, status "Expired"
- Reminder: 3 days after send, unsigned signer receives reminder email
- Manual remind: click "Remind" -> email sent immediately
- Void envelope -> all recipients notified, no more signing possible
- Template: save envelope as template -> reuse with new recipients and merge values
- Template merge fields: {{client_name}} replaced with actual name when creating envelope
- Bulk send: upload CSV with 10 recipients -> 10 envelopes created and sent
- Powerform: create public link -> external person fills and signs without invitation
- Kiosk mode: multiple people sign on same device in sequence
- SMS OTP verification: signer enters phone -> receives code -> enters code -> verified
- ID document verification: signer uploads CIN photo -> verified
- eIDAS advanced: certificate generated and embedded in PDF
- Custom branding: upload logo -> appears on signing page and emails
- Custom domain: signing links use custom domain
- Dashboard filter: filter by "Completed" status -> only completed envelopes shown
- Search: search by signer name -> envelope found
- Tags: tag envelope "Q1 Contracts" -> filter by tag works
- Folder organization: create folder "2026" -> move envelopes into it
- CRM integration: link envelope to deal -> signature status visible on deal page
- Billing integration: completed signed quote -> invoice draft auto-created
- HR integration: onboarding triggers employment contract signing
- Mobile signing: open signing link on phone -> touch signature works smoothly
- Offline signing (mobile): sign offline -> sync when online -> signature applied
- Accessibility: navigate all fields with Tab key, screen reader announces field labels
- AI summary: upload contract -> AI generates key points summary
- AI review: AI flags risky clause -> displayed as warning to sender
- AI compliance check: French employment contract -> checks for mandatory mentions
- AI data extraction: extracts parties, amounts, dates from contract
- Integrity check: modify signed PDF externally -> validation fails
- Long-term validation: signed PDF verifiable 10+ years later with embedded CRL/OCSP
- RGPD: signer requests data export -> all audit data provided in JSON
