# Module Forms (builder) — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Google Forms** | Simplicité extrême, intégration Sheets pour les réponses, sections, logique conditionnelle simple, quiz mode, themes, templates, 10+ question types |
| **Typeform** | Un-question-à-la-fois (conversational), beautiful design, logic jumps, calculator, embed video/image, thank you pages, hidden fields, recall (variables), integrations, payment |
| **Jotform** | 10000+ templates, widget store, HIPAA compliant, payment integrations, PDF generator, conditional logic avancée, appointment fields |
| **Tally** | Notion-like builder, gratuit illimité, logic, pricing field, integrations, payment Stripe, super simple UX |
| **Airtable Forms** | Directement connecté à une base, prefill, conditional, attachments, themes |
| **Formstack** | Enterprise, workflow, approvals, electronic signature, HIPAA |
| **SurveyMonkey** | Market leader des enquêtes, analytics, AI-powered analysis, benchmarks |
| **Qualtrics** | Enterprise research, advanced logic, statistical analysis, multi-language |
| **Paperform** | Design-first, embed anywhere, products & payment, booking |
| **Cognito Forms** | Calculations, conditional logic, payments, HIPAA, document generation |
| **123FormBuilder** | Workflow, approval chains |
| **Microsoft Forms** | Office 365 integration, simple, quiz mode |
| **Fillout** | Alternative Typeform avec meilleur UX récent |

## Principes directeurs

1. **Builder visuel simple** — drag-drop pour créer un formulaire en 2 minutes sans formation.
2. **Deux modes d'affichage** — classique (toutes questions sur une page) et conversationnel (une question à la fois, Typeform-style).
3. **Logique conditionnelle puissante** — masquer/afficher, rediriger, calculer selon les réponses.
4. **Réponses structurées** — chaque soumission est une ligne dans une base ou un tableur.
5. **Embeds partout** — intégrable dans Docs, Chat, Site externe, email.
6. **Gratuit sans limite raisonnable** — pas de plafond artificiel sur le nombre de réponses.

---

## Catégorie 1 — Builder du formulaire

### 1.1 Création d'un formulaire vierge
Bouton `Nouveau formulaire` ouvre le builder. Canvas central avec un titre par défaut, une première question, et un bouton `Envoyer`. Panneau latéral avec la palette de types de questions.

### 1.2 Création depuis un template
Galerie de templates : feedback client, inscription événement, candidature, commande, sondage, contact, devis, quiz. Clonage vers le workspace.

### 1.3 Création depuis une base Airtable-like
Depuis une table du module Sheets/Base, bouton `Générer un formulaire`. Chaque colonne devient une question automatiquement (label = nom de la colonne, type = type de la colonne).

### 1.4 Duplication d'un formulaire
Clic droit → Dupliquer. Copie complète avec tous les champs, logique, thème.

### 1.5 Import depuis Typeform/Google Forms
Connecteur pour importer un formulaire existant depuis Typeform (via leur API) ou Google Forms (via URL).

### 1.6 Drag-drop de questions
Glisser une question pour changer son ordre. Feedback visuel. Drop target visible.

### 1.7 Sections / Pages
Diviser le formulaire en sections ou pages. Chaque page a un titre et description. Navigation entre pages avec `Suivant`/`Précédent`. Logique de saut conditionnelle.

### 1.8 Preview en direct
Panneau de prévisualisation à droite ou toggle `Aperçu` qui affiche le formulaire tel que l'utilisateur le verra. Multi-device preview (desktop, tablet, mobile).

### 1.9 Undo / Redo
Toutes les actions sont annulables avec `Ctrl+Z`. Historique de plusieurs étapes.

### 1.10 Auto-save
Chaque modification du builder est sauvegardée instantanément. Pas de "Sauvegarder" nécessaire.

### 1.11 Versioning
Historique des versions du formulaire. Restaurer une version antérieure en un clic.

### 1.12 Collaboration builder
Plusieurs utilisateurs peuvent éditer le même formulaire simultanément avec curseurs visibles.

---

## Catégorie 2 — Types de questions

### 2.1 Short answer (texte court, une ligne)
Simple input text. Validation : longueur min/max, regex pattern, requis.

### 2.2 Long answer (texte long, plusieurs lignes)
Textarea. Limite de caractères configurable. Placeholder.

### 2.3 Number
Input numérique. Min/max, step, décimales, unité (€, kg, etc.).

### 2.4 Email
Input email avec validation (regex standard + optionnel vérification DNS).

### 2.5 Phone
Input phone avec dropdown de pays (drapeau + code), formatage automatique (libphonenumber).

### 2.6 URL
Input URL avec validation. Preview du favicon au hover.

### 2.7 Date / DateTime
Date picker. Range (début/fin). Restrictions (pas avant/après date X, jours ouvrés uniquement).

### 2.8 Time
Time picker (hh:mm). Intervalle autorisé.

### 2.9 Multiple choice (radio)
Liste d'options, une seule sélectionnable. Option "Autre..." avec input libre. Affichage vertical ou horizontal. Avec ou sans images.

### 2.10 Checkboxes (multi-select)
Liste d'options, plusieurs sélectionnables. Min/max de sélections. "Autre..." possible.

### 2.11 Dropdown (select)
Liste déroulante pour longues listes. Recherche inline. Multi-select option.

### 2.12 Scale / Opinion scale
Échelle de 1 à N (configurable). Labels aux extrêmes ("Pas du tout" à "Parfaitement"). Utilisé pour les sondages de satisfaction.

### 2.13 NPS (Net Promoter Score)
Échelle 0-10 spécifique pour le NPS. Calcul automatique du score.

### 2.14 Rating (étoiles)
De 1 à N étoiles (configurable). Ou emoji faces (😞 à 😍).

### 2.15 Likert scale
Tableau à double entrée : lignes = énoncés, colonnes = options ("Pas du tout d'accord" à "Tout à fait d'accord"). Plusieurs énoncés en une question.

### 2.16 Ranking
Liste d'éléments à ordonner par drag-drop de préférence.

### 2.17 File upload
Champ permettant d'uploader un ou plusieurs fichiers. Types acceptés configurables (PDF, images, docs). Taille max. Stockage dans le Drive associé.

### 2.18 Signature
Canvas de signature (trackpad/mouse/touch). Sauvegardé comme image PNG. Utilisé pour les accords, consentements.

### 2.19 Address
Champs groupés : rue, ville, code postal, pays. Autocomplete via Google Places ou OSM Nominatim.

### 2.20 Legal / Consent
Case à cocher obligatoire avec texte long (conditions, RGPD). Confirmation timestamp stockée.

### 2.21 Payment
Champ de paiement intégré (Stripe/PayPal). Montant fixe ou calculé selon les réponses. Récepisée automatique.

### 2.22 Image choice
Options visuelles (grille d'images). Utilisateur clique sur celles qui correspondent. Souvent pour les tests UX ou les choix visuels.

### 2.23 Matrix (grid)
Tableau avec lignes de sous-questions et colonnes d'options. Pour les sondages complexes.

### 2.24 Quiz (bonne/mauvaise réponse)
Mode quiz : chaque question a une réponse correcte. Score calculé automatiquement. Afficher le score à la fin ou non.

### 2.25 Section header / Divider
Pas une question, mais un en-tête visuel pour structurer le formulaire.

### 2.26 Rich text block
Paragraphe d'information, instructions, texte riche (markdown, images, liens). Pas de saisie.

### 2.27 Hidden field
Champ invisible pour l'utilisateur, pré-rempli depuis l'URL ou un paramètre. Utilisé pour le tracking (source, campaign).

### 2.28 Opinion poll (1 question)
Mode spécial pour des polls simples à 1 question déployables rapidement.

### 2.29 Welcome screen (Typeform-style)
Page d'accueil du formulaire avec titre, description, image/video, bouton `Commencer`.

### 2.30 Thank you screen
Page de fin après soumission. Message personnalisé, lien vers une page, redirection auto, réponses pré-remplies pour un formulaire lié.

---

## Catégorie 3 — Logique conditionnelle

### 3.1 Afficher / masquer une question
"Si la question X a la valeur Y, afficher/masquer la question Z". Conditions multiples avec AND/OR.

### 3.2 Saut conditionnel (logic jump)
"Si Q1 = A, aller directement à Q5. Si Q1 = B, aller à Q7". Schéma arborescent.

### 3.3 Calculs entre champs
Utiliser les valeurs des questions précédentes dans une formule : `Q_quantité * Q_prix = Q_total`. Affiché dans un champ calculé ou utilisé dans le paiement.

### 3.4 Pre-fill depuis URL parameters
`?q1=John&q2=Acme` pré-remplit Q1 et Q2. Utilisé pour les campagnes email personnalisées.

### 3.5 Pre-fill depuis un utilisateur connecté
Si l'utilisateur est connecté, pré-remplir automatiquement son nom, email, organisation.

### 3.6 Variables et recall
Utiliser la valeur d'une réponse précédente dans le texte d'une question suivante : "Bonjour {{nom}}, quelle est votre entreprise ?".

### 3.7 Expressions / Formules
Champs calculés avec formules (comme dans un tableur) : `IF(Q1 > 100, Q1 * 0.9, Q1)` pour des remises.

### 3.8 Validation croisée
"Q_date_fin doit être > Q_date_debut". Erreur si condition non respectée.

### 3.9 Compteur d'avancement
Barre de progression basée sur les questions remplies. Texte configurable ("Page 3 / 5", "66% complet").

### 3.10 Timer (quiz)
Temps limite pour répondre. Compte à rebours visible. Soumission automatique à l'expiration.

### 3.11 Randomization
Ordre des questions ou des options randomisé à chaque nouvelle soumission. Utilisé pour éviter les biais dans les sondages.

### 3.12 Force required
Empêcher la soumission si des champs requis sont vides. Highlighting en rouge et scroll vers la première erreur.

---

## Catégorie 4 — Design et thèmes

### 4.1 Thèmes pré-définis
Galerie de thèmes (Moderne, Corporate, Minimaliste, Coloré, Sombre, Newsletter). Appliqués en un clic.

### 4.2 Customisation du design
Couleurs (fond, texte, bouton, accent), police, taille, border-radius, ombres, espacement. Preview en live.

### 4.3 Logo et image d'en-tête
Upload d'un logo (haut du formulaire) et d'une image de bannière (cover).

### 4.4 Fond personnalisable
Couleur unie, dégradé, image, vidéo, gradient animé.

### 4.5 Font custom
Choix parmi Google Fonts ou upload d'une police custom (TTF/OTF/WOFF).

### 4.6 CSS custom (power users)
Injection de CSS personnalisé pour les cas avancés. Isolé au formulaire.

### 4.7 Mode sombre
Thème sombre automatique pour les préférences utilisateur. Override manuel.

### 4.8 Accessibilité WCAG AA
Contrastes respectés, focus visible, labels ARIA, navigation clavier complète.

### 4.9 Responsive design
Adapté automatiquement à mobile, tablet, desktop. Preview multi-device.

### 4.10 Animations et transitions
Transitions entre questions (slide, fade). Ajustable.

### 4.11 Multi-language
Formulaire en plusieurs langues. Sélection de langue par l'utilisateur. Labels traduits pour chaque question.

### 4.12 Branding (logo, watermark)
Option `Powered by SignApps` ou retrait (plan payant).

---

## Catégorie 5 — Distribution et partage

### 5.1 Lien public partageable
URL unique `signapps.com/f/abc123` partageable par email, chat, réseaux sociaux. QR code généré automatiquement.

### 5.2 Embed dans un site externe
Code HTML/iframe à copier-coller pour intégrer le formulaire dans un site. Plusieurs tailles (compact, popover, full-page).

### 5.3 Embed dans les apps SignApps
Intégration native dans Docs, Chat, Mail. Les réponses sont collectées directement dans le module.

### 5.4 Popup / slide-in widget
Widget qui apparaît en popup sur clic ou après X secondes sur un site. Configurable (position, délai, trigger).

### 5.5 Envoi par email
Formulaire envoyable directement par email (SMTP) à une liste. Les destinataires cliquent et accèdent au formulaire.

### 5.6 QR code
Pour les événements physiques (inscription, feedback). Scannable par téléphone.

### 5.7 Domain custom
Formulaire accessible depuis `form.monentreprise.com` au lieu du domaine SignApps. CNAME.

### 5.8 Short URL
URLs courtes générables (`signapps.co/abc`).

### 5.9 Date limite de soumission
Formulaire expire après une date. Page "Formulaire fermé".

### 5.10 Limite de soumissions
Max N réponses, puis formulaire fermé. Utilisé pour les inscriptions limitées.

### 5.11 Password protect
Formulaire protégé par mot de passe. Utile pour les formulaires internes ou sensibles.

### 5.12 Access by link only
Formulaire non indexable, accessible seulement par ceux qui ont le lien.

### 5.13 Require sign-in (authentification)
Formulaire réservé aux utilisateurs authentifiés SignApps. Pré-remplir avec leurs infos.

---

## Catégorie 6 — Réponses et analytics

### 6.1 Dashboard des réponses
Page listant toutes les soumissions reçues. Vue par réponse individuelle ou agrégée.

### 6.2 Vue tabulaire (tableur)
Chaque ligne = une soumission, chaque colonne = une question. Tri, filtres, export CSV. Directement connecté à un tableur SignApps si lié.

### 6.3 Vue individuelle (fiche)
Clic sur une soumission → fiche détaillée avec toutes les réponses, timestamp, IP, user-agent, durée de complétion, source (UTM).

### 6.4 Analytics graphiques
Dashboard avec graphiques automatiques par question :
- **Multiple choice** → pie chart / bar chart
- **Scale** → histogram
- **Date** → timeline
- **Number** → distribution, moyenne, médiane
- **Text** → word cloud, exemples random

### 6.5 Filtres sur les réponses
Filtrer par : date, réponse spécifique, source, complétée/abandonnée, durée.

### 6.6 Export
CSV, Excel, PDF, JSON. Sélectionner les champs à inclure.

### 6.7 Connection à une base
Les soumissions sont automatiquement ajoutées comme lignes dans un tableur ou une base Airtable-like du workspace.

### 6.8 Notifications
Notification par email/push/Slack à chaque nouvelle soumission. Ou digest quotidien/hebdo.

### 6.9 Réponses par assignee
Répartir les soumissions vers des personnes pour traitement (round-robin, par région, par type).

### 6.10 Workflow trigger
Chaque soumission déclenche un workflow : créer un lead CRM, créer une tâche, envoyer un email, notifier Slack, etc.

### 6.11 Marquer comme traitée
Status pour chaque soumission : nouvelle / en cours / traitée / archivée.

### 6.12 Commentaires internes
Ajouter des notes sur une soumission pour l'équipe (non visible par le répondant).

### 6.13 Suppression et RGPD
Possibilité de supprimer une soumission définitivement. Export des données personnelles sur demande.

### 6.14 Données démographiques (aggregated)
Distribution géographique des répondants (pays, villes) basée sur l'IP. Optionnel et RGPD-compliant.

### 6.15 Temps de complétion
Temps moyen, médian, distribution. Identifier les questions qui font abandonner.

### 6.16 Completion rate
% de répondants qui ont commencé vs terminé. Funnel d'abandon par question.

### 6.17 A/B testing
Deux variantes d'un formulaire, répartition aléatoire, comparaison des taux de completion et de réponse.

---

## Catégorie 7 — Intégrations et automations

### 7.1 Webhook sortant
À chaque soumission, POST vers une URL avec le payload JSON. Utilisé pour alimenter un système externe.

### 7.2 Zapier / Make
Forms comme trigger Zapier. Actions Zapier pour créer une soumission par API.

### 7.3 Email transactionnel
Email automatique au répondant après soumission (confirmation avec récap de ses réponses).

### 7.4 Email au propriétaire
Email au propriétaire du formulaire à chaque nouvelle soumission.

### 7.5 Slack / Microsoft Teams notification
Message posté dans un channel à chaque soumission avec résumé.

### 7.6 Google Sheets / Airtable sync
Sync bidirectionnelle des réponses avec Google Sheets ou Airtable externe.

### 7.7 CRM integration
Créer automatiquement un lead/deal dans le CRM à partir de la soumission.

### 7.8 Tasks integration
Créer une tâche avec les infos du formulaire.

### 7.9 Calendar integration
Si le formulaire contient un champ date (rendez-vous), créer un événement.

### 7.10 Email marketing
Ajouter le répondant à une liste Mailchimp/SendGrid avec les tags correspondants.

### 7.11 Payment providers
Stripe, PayPal, Square pour les formulaires de paiement. Reçu automatique.

### 7.12 Electronic signature
Signature électronique en fin de formulaire (SignRequest, DocuSign intégrations, ou module interne).

### 7.13 API REST
Endpoints pour lister/lire/créer/supprimer des soumissions par API.

---

## Catégorie 8 — Sécurité et conformité

### 8.1 Anti-spam (captcha)
reCAPTCHA v3 (Google) ou hCaptcha (privacy-friendly) invisible. Option de rendre visible pour les formulaires à risque.

### 8.2 Rate limiting par IP
Limiter le nombre de soumissions par IP par période pour prévenir les abus.

### 8.3 Blacklist
Domaines ou IPs blacklistés. Utilisé pour bloquer les spammeurs connus.

### 8.4 Data encryption
Toutes les soumissions chiffrées au repos (AES-256) et en transit (TLS 1.3).

### 8.5 RGPD compliance
Case à cocher de consentement obligatoire avec texte personnalisable. Lien vers politique de confidentialité. Export/suppression des données sur demande.

### 8.6 HIPAA (healthcare)
Pour les formulaires médicaux : BAA signé, audit logs, encryption, limitation d'accès.

### 8.7 Audit logs
Log de qui a créé/édité/vu le formulaire et les soumissions. Pour la conformité.

### 8.8 Cookies banner (si embed)
Si embed externe, banner cookies conforme RGPD.

### 8.9 IP anonymization
Option de ne pas stocker les IPs des répondants (RGPD-friendly).

### 8.10 Double opt-in
Pour les inscriptions newsletter : email de confirmation obligatoire pour valider la soumission.

---

## Catégorie 9 — IA intégrée

### 9.1 Génération de formulaire depuis un prompt
"Créer un formulaire d'inscription à un événement tech avec nom, email, entreprise, poste, attentes" → le LLM génère un formulaire complet prêt à utiliser.

### 9.2 Suggestions de questions
L'IA propose des questions manquantes basées sur le contexte du formulaire. "Vous avez oublié de demander le budget ?".

### 9.3 Analyse des réponses texte
Pour les champs texte long (open-ended), l'IA regroupe les réponses par thèmes, identifie le sentiment, extrait les mots-clés.

### 9.4 Résumé des soumissions
Bouton `Résumer toutes les réponses` génère un executive summary : nombre de soumissions, thèmes principaux, pain points, recommandations.

### 9.5 Détection de spam
L'IA détecte les soumissions suspectes (texte incohérent, URLs spam, pattern bot) et les flag.

### 9.6 Traduction automatique
Traduire le formulaire en plusieurs langues automatiquement. Répondant peut changer de langue.

### 9.7 Auto-correction de typos
Dans les champs texte, suggestions de correction orthographique pour les répondants.

### 9.8 Predictive form
Questions dynamiquement générées basées sur les réponses précédentes (adaptive forms). Utile pour les diagnostiques ou les parcours personnalisés.

### 9.9 Smart follow-up
Si une réponse mérite un suivi, l'IA suggère une action (envoyer un email, créer une tâche) avec un brouillon pré-rempli.

### 9.10 Sentiment analysis sur les feedbacks
Classement positif/neutre/négatif des réponses pour rapidement identifier les clients insatisfaits.

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **Google Forms Help** (support.google.com/docs/forms) — sections, logic, quiz mode.
- **Typeform Help Center** (help.typeform.com) — conversational patterns, logic jumps, hidden fields, recall.
- **Jotform Blog & Help** (jotform.com/help) — 10000 templates library, advanced logic.
- **Tally Blog** (tally.so/blog) — simple builder patterns.
- **Airtable Forms Guide** (support.airtable.com/forms) — integration avec bases.
- **SurveyMonkey Help** (help.surveymonkey.com) — research methodology.
- **Qualtrics Support** (qualtrics.com/support) — advanced logic, branching, stats.

### Projets open source permissifs
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **Formbricks** (formbricks.com) | **AGPL v3** | **INTERDIT**. Étudier via démos publiques. |
| **OhMyForm** | **AGPL v3** | **INTERDIT**. |
| **Jotform API** | Commercial | Pattern des types de champs. |
| **SurveyJS** (surveyjs.io) | **MIT** (Community) | Excellente library pour les formulaires. 30+ question types. Peut servir de base. |
| **Formik** (formik.org) | **MIT** | Library React pour les formulaires. Pattern standard. |
| **React Hook Form** (react-hook-form.com) | **MIT** | Alternative Formik, plus performant. **Déjà utilisé dans SignApps.** |
| **Zod** (zod.dev) | **MIT** | Schema validation. Déjà utilisé. |
| **Yup** (github.com/jquense/yup) | **MIT** | Alternative Zod. |
| **react-final-form** | **MIT** | Alternative library. |
| **@tanstack/react-form** (tanstack.com/form) | **MIT** | Moderne, form state management. |
| **RJSF** (react-jsonschema-form, rjsf-team.github.io) | **Apache-2.0** | Form generation depuis JSON Schema. Pour les formulaires générés dynamiquement. |
| **uniforms** (uniforms.tools) | **MIT** | Bridge entre schema et UI. |
| **Papa Parse** (papaparse.com) | **MIT** | Export CSV des soumissions. |
| **dompurify** (github.com/cure53/DOMPurify) | **Apache-2.0** | Sanitize HTML des champs rich text. |
| **hcaptcha** | Service externe | Alternative reCAPTCHA, privacy-friendly. |
| **signature_pad** (github.com/szimek/signature_pad) | **MIT** | Canvas de signature. |
| **libphonenumber-js** (github.com/catamphetamine/libphonenumber-js) | **MIT** | Formatage téléphone. |
| **chrono-node** (github.com/wanasit/chrono) | **MIT** | Parse des dates en natural language. |
| **react-phone-number-input** (github.com/catamphetamine/react-phone-number-input) | **MIT** | UI phone input avec flags. |
| **react-select** (react-select.com) | **MIT** | Composant dropdown avancé. |
| **@dnd-kit/core** (dndkit.com) | **MIT** | Drag-drop du builder. Déjà utilisé. |
| **Stripe.js** (stripe.com/docs/js) | **MIT** (SDK) | Paiement. SDK open source, service commercial. |

### Pattern d'implémentation recommandé
1. **Builder UX** : React Hook Form (MIT) pour le state, @dnd-kit/core (MIT) pour le drag-drop, Tiptap (MIT) pour les champs rich text.
2. **Schema des formulaires** : JSON Schema standard ou Zod schemas. Permet la validation serveur et client avec le même schéma.
3. **Rendu du formulaire** : composants custom React par type de question. Pattern similar à RJSF (Apache-2.0) mais custom.
4. **Signature** : signature_pad (MIT) pour le canvas.
5. **Phone input** : libphonenumber-js (MIT) + react-phone-number-input (MIT).
6. **Captcha** : hCaptcha (service privacy-friendly) ou reCAPTCHA v3. Lib officielle.
7. **Paiement** : Stripe.js (MIT) comme intégration.
8. **Export CSV** : Papa Parse (MIT).
9. **Analytics** : Chart.js (MIT) pour les graphiques par question.
10. **IA form generation** : LLM interne avec prompt templates.

### Ce qu'il ne faut PAS faire
- **Pas de fork** de Formbricks, OhMyForm (AGPL).
- **Pas de tracking de l'IP sans consentement** en UE.
- **Pas de stockage de données sensibles sans consentement explicite**.

---

## UI Behavior Details

### Builder View
Three-panel layout. Left panel (20%): question type palette organized by category (Basic, Choice, Advanced, Layout). Each type shown as icon + label; drag from palette to canvas, or click to append. Center panel (55%): form canvas showing all questions in order. Each question is a card with drag handle (left), question text (editable inline), type badge (top-right), settings icon (gear), delete icon (trash), and duplicate icon. Active question has a blue left border. Drop zone indicators appear between questions during drag. Bottom of canvas: "Add question" button. Top of canvas: form title (editable, large font) and description (editable, smaller). Right panel (25%): context-sensitive settings panel. When a question is selected: field-specific settings (required toggle, placeholder, validation rules, conditional visibility rules, help text). When no question selected: form-level settings (theme, language, submission settings, integrations).

### Preview Mode
Toggle button "Preview" in top toolbar switches the center panel to a rendered form view. Three preview modes via icons: desktop (default, 600px centered), tablet (768px), mobile (375px). The preview is interactive — user can fill fields and test validation. A banner at top says "Preview mode — submissions are not saved". Back button returns to builder.

### Conversational Mode (Typeform-style)
Toggle in form settings: "Display mode: Classic / Conversational". In conversational mode, the preview and published form show one question at a time, full-screen, with a large centered card. Navigation: "Next" button or Enter key. Progress bar at top. Back button (or Up arrow key) to return. Smooth slide-up transition (200ms) between questions. Auto-advance when a single-choice question is answered.

### Responses Dashboard
Tab "Responses" shows a summary header: total submissions, completion rate (%), average time, submissions today. Below: two sub-views toggled by tab: "Table" (spreadsheet grid with one row per submission, columns are questions) and "Analytics" (charts per question). Table view supports column resize, sort by any column, filter by date range or specific answer value. Click a row to open the individual response detail in a slide-over panel.

### Individual Response View
Slide-over panel from the right (50% width). Shows all question-answer pairs vertically. Metadata section at bottom: submitted at, IP (if stored), user agent, completion time, source URL, UTM parameters. Status badge (New / In Progress / Processed / Archived) with dropdown to change. Internal comments section below metadata.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New form |
| `Ctrl+S` | Force save (though auto-save is active) |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+D` | Duplicate selected question |
| `Delete` | Delete selected question (with confirm) |
| `Ctrl+P` | Toggle preview mode |
| `Ctrl+Enter` | Publish form |
| `Up/Down` | Move between questions in builder |
| `Ctrl+Up/Down` | Reorder selected question |
| `Ctrl+Shift+F` | Toggle fullscreen preview |
| `Escape` | Close right panel / exit preview |
| `Ctrl+/` | Show keyboard shortcut help |

---

## Schema PostgreSQL

```sql
-- Forms definition
CREATE TABLE forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    title VARCHAR(512) NOT NULL DEFAULT 'Untitled Form',
    description TEXT,
    display_mode VARCHAR(16) NOT NULL DEFAULT 'classic', -- classic, conversational
    status VARCHAR(16) NOT NULL DEFAULT 'draft', -- draft, published, closed
    theme JSONB DEFAULT '{}', -- {primary_color, bg_color, font, border_radius, logo_url, cover_url}
    settings JSONB DEFAULT '{}', -- {require_signin, password, submission_limit, close_date, redirect_url, confirmation_message}
    language VARCHAR(5) DEFAULT 'fr',
    translations JSONB DEFAULT '{}', -- {en: {title: "...", questions: {...}}}
    slug VARCHAR(128) NOT NULL, -- unique URL slug for public access
    custom_domain VARCHAR(255),
    is_template BOOLEAN NOT NULL DEFAULT false,
    template_category VARCHAR(64),
    version INT NOT NULL DEFAULT 1,
    published_at TIMESTAMPTZ,
    closes_at TIMESTAMPTZ,
    submission_limit INT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_forms_slug ON forms(workspace_id, slug);
CREATE INDEX idx_forms_workspace_status ON forms(workspace_id, status);
CREATE INDEX idx_forms_template ON forms(is_template) WHERE is_template = true;

-- Form questions
CREATE TABLE form_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    question_type VARCHAR(32) NOT NULL, -- short_text, long_text, number, email, phone, url, date, time, multiple_choice, checkboxes, dropdown, scale, nps, rating, likert, ranking, file_upload, signature, address, legal, payment, image_choice, matrix, quiz, section_header, rich_text, hidden, welcome_screen, thank_you_screen
    label TEXT NOT NULL,
    description TEXT,
    placeholder TEXT,
    is_required BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL,
    settings JSONB DEFAULT '{}', -- type-specific: {min, max, step, options[], correct_answer, regex, file_types[], max_size}
    validation_rules JSONB DEFAULT '[]', -- [{type: "min_length", value: 5, message: "Too short"}]
    conditional_logic JSONB, -- {action: "show"|"hide"|"jump", conditions: [{question_id, operator, value}], logic: "and"|"or"}
    section_id UUID, -- for grouping into pages/sections
    recall_variable VARCHAR(64), -- variable name for {{recall}} in subsequent questions
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_form_questions_form ON form_questions(form_id, sort_order);

-- Form question options (for choice-based questions)
CREATE TABLE form_question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES form_questions(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    value TEXT,
    image_url TEXT, -- for image_choice type
    is_other BOOLEAN NOT NULL DEFAULT false, -- "Other..." free text option
    sort_order INT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false -- for quiz mode
);
CREATE INDEX idx_form_options_question ON form_question_options(question_id, sort_order);

-- Form submissions
CREATE TABLE form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    respondent_id UUID REFERENCES users(id), -- null for anonymous
    respondent_email VARCHAR(255),
    answers JSONB NOT NULL DEFAULT '{}', -- {question_id: value, ...}
    metadata JSONB DEFAULT '{}', -- {ip, user_agent, referrer, utm_source, utm_medium, utm_campaign, completion_time_seconds}
    quiz_score INT, -- calculated if quiz mode
    quiz_total INT,
    status VARCHAR(16) NOT NULL DEFAULT 'new', -- new, in_progress, processed, archived
    payment_status VARCHAR(16), -- null, pending, completed, failed
    payment_amount BIGINT, -- in cents
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_form_submissions_form ON form_submissions(form_id, submitted_at DESC);
CREATE INDEX idx_form_submissions_workspace ON form_submissions(workspace_id);
CREATE INDEX idx_form_submissions_status ON form_submissions(form_id, status);

-- Form submission comments (internal)
CREATE TABLE form_submission_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Form webhooks
CREATE TABLE form_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret VARCHAR(128),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    last_status INT, -- HTTP status code
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Form integrations
CREATE TABLE form_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    integration_type VARCHAR(32) NOT NULL, -- crm_lead, task, calendar_event, email_notify, slack, sheets_sync, webhook
    config JSONB NOT NULL DEFAULT '{}', -- type-specific: {pipeline_id, assignee_id, channel_id, sheet_id, ...}
    field_mapping JSONB DEFAULT '{}', -- {question_id: target_field}
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Form versions (for versioning)
CREATE TABLE form_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    snapshot JSONB NOT NULL, -- full form + questions snapshot
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_form_versions ON form_versions(form_id, version_number DESC);

-- A/B test variants
CREATE TABLE form_ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    variant_form_id UUID NOT NULL REFERENCES forms(id),
    traffic_split INT NOT NULL DEFAULT 50 CHECK (traffic_split BETWEEN 1 AND 99),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## REST API Endpoints

All endpoints require JWT authentication. Base path: `signapps-forms` service, port 3015.

### Forms CRUD
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/forms?status=&page=&per_page=&q=` | List forms |
| POST | `/api/v1/forms` | Create form |
| GET | `/api/v1/forms/:id` | Get form with questions |
| PATCH | `/api/v1/forms/:id` | Update form settings |
| DELETE | `/api/v1/forms/:id` | Delete form |
| POST | `/api/v1/forms/:id/duplicate` | Duplicate form |
| POST | `/api/v1/forms/:id/publish` | Publish form (set status to published) |
| POST | `/api/v1/forms/:id/close` | Close form (stop accepting submissions) |
| GET | `/api/v1/forms/:id/versions` | List form versions |
| POST | `/api/v1/forms/:id/versions/:version/restore` | Restore a previous version |

### Questions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/forms/:id/questions` | List questions |
| POST | `/api/v1/forms/:id/questions` | Add question |
| PATCH | `/api/v1/forms/:id/questions/:qid` | Update question |
| DELETE | `/api/v1/forms/:id/questions/:qid` | Delete question |
| PATCH | `/api/v1/forms/:id/questions/reorder` | Reorder questions `{question_ids: [...]}` |

### Public Form Access (no auth required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/forms/public/:slug` | Get published form for respondent |
| POST | `/api/v1/forms/public/:slug/submit` | Submit a response |
| GET | `/api/v1/forms/public/:slug/prefill?q1=&q2=` | Prefill values via URL params |

### Submissions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/forms/:id/submissions?status=&from=&to=&page=` | List submissions |
| GET | `/api/v1/forms/:id/submissions/:sid` | Get single submission detail |
| PATCH | `/api/v1/forms/:id/submissions/:sid` | Update status |
| DELETE | `/api/v1/forms/:id/submissions/:sid` | Delete submission |
| GET | `/api/v1/forms/:id/submissions/export?format=csv&fields=` | Export submissions |
| POST | `/api/v1/forms/:id/submissions/:sid/comments` | Add internal comment |
| GET | `/api/v1/forms/:id/submissions/:sid/comments` | List comments |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/forms/:id/analytics/summary` | Summary stats (count, completion rate, avg time) |
| GET | `/api/v1/forms/:id/analytics/per-question` | Per-question breakdown (chart data) |
| GET | `/api/v1/forms/:id/analytics/funnel` | Abandonment funnel by question |
| GET | `/api/v1/forms/:id/analytics/over-time?from=&to=&granularity=` | Submissions over time |

### Templates
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/forms/templates?category=` | List form templates |
| POST | `/api/v1/forms/templates/:id/use` | Create form from template |

### Integrations
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/forms/:id/integrations` | List integrations for form |
| POST | `/api/v1/forms/:id/integrations` | Add integration |
| PATCH | `/api/v1/forms/:id/integrations/:iid` | Update integration |
| DELETE | `/api/v1/forms/:id/integrations/:iid` | Remove integration |

### Webhooks
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/forms/:id/webhooks` | List webhooks |
| POST | `/api/v1/forms/:id/webhooks` | Add webhook |
| DELETE | `/api/v1/forms/:id/webhooks/:wid` | Remove webhook |

### A/B Testing
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/forms/:id/ab-test` | Create A/B variant |
| GET | `/api/v1/forms/:id/ab-test/results` | Compare variant performance |
| DELETE | `/api/v1/forms/:id/ab-test` | End A/B test |

### AI
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/forms/ai/generate` | Generate form from prompt |
| POST | `/api/v1/forms/ai/suggest-questions` | Suggest missing questions for existing form |
| POST | `/api/v1/forms/ai/analyze-responses` | AI summary of text responses |
| POST | `/api/v1/forms/ai/translate` | Auto-translate form to target language |
| POST | `/api/v1/forms/ai/detect-spam` | Batch spam detection on submissions |

---

## PgEventBus Events

| Event | Payload | Consumers |
|-------|---------|-----------|
| `forms.form.published` | `{form_id, workspace_id, slug, url}` | notifications, dashboard |
| `forms.form.closed` | `{form_id, workspace_id, total_submissions}` | notifications |
| `forms.submission.created` | `{submission_id, form_id, workspace_id, respondent_email, crm_integration}` | crm (lead creation), notifications, tasks, workflows, webhooks |
| `forms.submission.processed` | `{submission_id, processed_by}` | dashboard |
| `forms.submission.spam_detected` | `{submission_id, form_id, confidence}` | notifications |
| `forms.webhook.failed` | `{webhook_id, form_id, url, status_code, error}` | notifications |
| `forms.integration.triggered` | `{integration_id, form_id, type, submission_id}` | target module (crm, tasks, calendar) |
| `forms.quiz.completed` | `{submission_id, form_id, score, total}` | notifications |
| `forms.ab_test.completed` | `{form_id, variant_id, winner, metric}` | notifications |
| `forms.limit.reached` | `{form_id, limit, current_count}` | notifications (owner) |

---

## Inter-module Integration

### Forms <-> CRM (signapps-crm)
When `crm_lead` integration is active on a form, each submission triggers `forms.submission.created` with `crm_integration: true`. The CRM module consumes this, maps form fields to contact fields via `field_mapping`, creates or updates a contact (matching by email), optionally creates a deal in a specified pipeline, and applies lead routing rules. The form builder UI allows selecting the target pipeline and stage.

### Forms <-> Tasks (signapps-gateway tasks)
The `task` integration type creates a task for each submission. Configuration specifies the assignee (fixed user or round-robin), project, due date offset (e.g., +3 days), and which form field maps to the task title/description.

### Forms <-> Calendar (signapps-calendar, port 3011)
If the form contains a date/datetime field and the `calendar_event` integration is active, each submission creates a calendar event. The integration config maps which question is the event title, date, and description.

### Forms <-> Sheets (signapps-sheets)
The `sheets_sync` integration appends each submission as a new row in a specified spreadsheet. Columns are auto-mapped from question labels. The spreadsheet updates in real time and can be used for reporting.

### Forms <-> Mail (signapps-mail, port 3012)
Confirmation emails to respondents and notification emails to form owners are sent via the Mail service. The form settings define the email template, subject, and reply-to address. The Mail module handles SMTP delivery and tracking.

### Forms <-> Notifications (signapps-notifications, port 8095)
Every `forms.submission.created` event triggers a push notification and/or email to the form owner (configurable per form). Digest mode (daily/weekly summary) is also available.

### Forms <-> Drive (signapps-storage, port 3004)
File upload fields store files in Drive under a form-specific folder. The submission record stores `file_id` references. File size limits and allowed types are validated both client-side and server-side.

### Forms <-> AI (signapps-ai, port 3005)
Form generation from prompt, question suggestions, response analysis, translation, and spam detection all route through the AI gateway. The Forms module sends structured context (form schema, response data) and receives structured outputs.

---

## Assertions E2E cles (a tester)

- Create an empty form -> title and first question visible in builder
- Add questions: short text, number, email, date, multiple choice, file upload, signature, NPS
- Drag-drop to reorder questions -> order persists after reload
- Delete question -> confirm dialog -> question removed
- Duplicate question -> copy appears below with "(copy)" suffix
- Preview mode: toggle desktop/tablet/mobile -> layout adapts
- Preview: fill fields and test validation (required, email format, regex)
- Conversational mode: one question at a time, Enter advances, progress bar updates
- Conditional logic: if Q1 = "Yes" then show Q3 -> in preview, Q3 hidden when Q1 is "No"
- Logic jump: if Q2 = "B" then jump to page 3 -> works in conversational mode
- Validation: required field left empty -> red error message, form cannot submit
- Validation: email field with invalid format -> inline error
- Validation: number field with min/max -> out-of-range blocked
- Publish form -> URL generated, accessible without auth
- Submit a response via public URL -> response appears in dashboard
- Responses table: sort by date, filter by status -> table updates
- Individual response: click row -> slide-over shows all answers and metadata
- Export CSV: click export -> CSV file downloads with all questions as columns
- Analytics: per-question charts render (pie for multiple choice, histogram for scale)
- Completion funnel: shows drop-off percentage per question
- Embed iframe: copy embed code -> paste in external HTML -> form renders
- Theme: change primary color and font -> preview reflects changes
- Notification: submit response -> form owner receives email notification
- Webhook: configure URL -> submit response -> POST sent with JSON payload
- CRM integration: submit form with email -> new CRM contact created
- Pre-fill from URL: append ?q1=John -> form field pre-populated
- Variables recall: Q2 text "Hello {{name}}" where name = Q1 -> renders "Hello John"
- Quiz mode: set correct answers -> submit -> score displayed on thank-you screen
- Signature canvas: draw signature on touch/mouse -> saved as PNG in submission
- File upload: upload PDF -> stored in Drive, link in submission
- Payment field: enter card via Stripe -> payment processed, receipt sent
- Multi-language: add English translation -> respondent switches language -> labels change
- Anti-spam: captcha blocks bot submission (simulated with headless browser)
- AI generation: prompt "event registration form" -> form created with relevant fields
- AI suggest: existing form missing "budget" -> AI suggests adding it
- A/B test: create variant -> 50% traffic split -> compare completion rates
- Template: save form as template -> create new form from template -> fields preserved
- Rate limiting: >10 submissions from same IP in 1 minute -> blocked
- Date limit: set close date in past -> form shows "closed" message
- Submission limit: set max 5 -> after 5 submissions, form closes
- Password protect: set password -> public URL requires password entry
- Require sign-in: unauthenticated user redirected to login
- Version history: make changes -> restore previous version -> questions match snapshot
- Collaboration: two users edit same form -> both see cursor positions
- Auto-save: edit question label -> close browser -> reopen -> change preserved
- Keyboard: Ctrl+Z undoes last action, Ctrl+D duplicates question
