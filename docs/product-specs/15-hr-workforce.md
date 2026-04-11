# Module HR / Workforce — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **BambooHR** | SMB leader, ATS + HRIS + payroll + performance + engagement. Org chart, time off requests, onboarding workflows, document storage, analytics |
| **Rippling** | IT + HR + Finance tout-en-un, global payroll, device management, app provisioning, employé onboarding automatisé |
| **Gusto** | Payroll US leader, health benefits, 401k, compliance, onboarding |
| **Personio** | Europe leader, HR management, applicant tracking, time off, performance reviews, GDPR-first |
| **Workday** | Enterprise leader, HCM (Human Capital Management), financial management, planning, analytics, everything |
| **BambooHR** | SMB focus, ATS, performance, engagement |
| **Deel** | Global payroll, international contractors, compliance par pays |
| **Remote** | Employer of Record (EOR) pour embauches internationales |
| **HiBob** | Modern HRIS, people analytics, culture tools, shoutouts, flex surveys |
| **Factorial** | Europe SMB, payroll, time off, shifts, documents |
| **Zoho People** | Abordable, HR core features |
| **Namely** | Mid-market US, HR + payroll |
| **ADP Workforce Now** | Enterprise payroll + HR |
| **Lattice** | Performance management, reviews, goals, 1:1s, engagement surveys |
| **Culture Amp** | Engagement surveys, performance, analytics people-focused |

## Principes directeurs

1. **Employee-first** — chaque employé doit avoir une expérience moderne et self-service (voir son planning, ses congés, ses fiches de paie).
2. **Automation maximale** — onboarding, offboarding, renouvellements de contrat, rappels automatisés.
3. **Conformité localisée** — règles de paye, congés, contrats adaptés au pays (France, Belgique, Suisse, etc.).
4. **Données centralisées** — dossier employé unique accessible par RH, manager, employé.
5. **Analytics pour décisions** — turnover, charge de travail, engagement, performance en un dashboard.
6. **Intégration tech stack** — SSO, IT provisioning, payroll provider, learning platform.

---

## Catégorie 1 — Employés (dossiers et directory)

### 1.1 Fiche employé complète
Page avec :
- Photo, nom, poste, manager, équipe, localisation
- Coordonnées pro et perso (adresse, téléphone, email)
- Contact d'urgence
- Informations bancaires (IBAN, SWIFT pour paye)
- Numéro de sécurité sociale (chiffré)
- Numéro de contrat
- Type de contrat (CDI, CDD, freelance, stage, apprentissage, intérim)
- Date d'embauche
- Salaire et historique (accessible RH/manager uniquement)
- Compétences et certifications
- Langues parlées
- Équipements fournis (laptop, téléphone, badge)

### 1.2 Org chart (organigramme)
Vue hiérarchique de toute l'organisation. Drag-drop pour déplacer un employé entre équipes. Vue collapsible.

### 1.3 People directory
Vue en grille de tous les employés avec photo, nom, poste, département. Recherche et filtres par département, localisation, poste, skills.

### 1.4 Fiche personnelle (self-service)
Chaque employé peut voir et éditer certaines infos personnelles (photo, adresse, téléphone, contact d'urgence, préférences). Modifications soumises à validation RH pour les champs sensibles.

### 1.5 Équipe (team view)
Pour les managers : vue de leur équipe avec tous les membres, leur statut, leur charge de travail, leurs derniers congés.

### 1.6 Matrice de compétences
Tableau de qui a quelles skills à quel niveau (débutant, intermédiaire, expert). Utilisé pour la constitution d'équipes et la formation.

### 1.7 Custom fields
Admin peut ajouter des champs custom (ex: "Taille de t-shirt" pour les cadeaux, "Préférences alimentaires", "Hobbies").

### 1.8 Documents personnels
Upload et stockage : contrat signé, CIN/passport, diplômes, certificats. Chiffrés, accessibles RH + employé uniquement.

### 1.9 Photos d'identité et badge
Photo pour badge d'accès, trombinoscope, intranet. Option de flouter automatiquement pour la directory publique.

### 1.10 Historique des changements
Log des modifications d'une fiche : qui a changé quoi quand. Pour audit.

---

## Catégorie 2 — Onboarding et offboarding

### 2.1 Workflow d'onboarding
Liste de tâches à faire avant, le jour de l'arrivée, et pendant la première semaine/mois. Attribution aux parties prenantes : IT, RH, manager, buddy.

### 2.2 Templates d'onboarding par rôle
Templates différents par poste (dev, commercial, marketing, support, finance). Personnalisables.

### 2.3 Checklist employé
Le nouvel employé a sa propre checklist : remplir les infos perso, lire le handbook, signer les documents, configurer ses outils, rencontrer l'équipe.

### 2.4 Checklist manager
Le manager reçoit sa propre liste : préparer le plan d'onboarding, assigner un buddy, envoyer le welcome email, planifier les premiers 1:1s.

### 2.5 Checklist IT
Provisioning des comptes, attribution du matériel, configuration VPN, badge, accès aux outils. Automatisation via intégration avec le module IT Assets.

### 2.6 Welcome package
Email automatique au nouvel employé avec les infos pratiques : premier jour, dress code, parking, cafétéria, accès, calendrier du premier jour.

### 2.7 Digital signature
Signature électronique des contrats, NDA, politiques internes (intégration avec le module Signatures).

### 2.8 Offboarding workflow
Même structure mais inverse : récupération matériel, révocation accès, entretien de sortie, calcul solde de tout compte, transfer of knowledge.

### 2.9 Exit interview
Questionnaire de sortie pour collecter du feedback. Analyse agrégée pour identifier les problèmes.

### 2.10 Knowledge transfer
Checklist pour documenter les connaissances du partant : dossiers, responsabilités, contacts clés, procédures.

### 2.11 Alumni network
Ancien employés gardent un profil allégé. Réseau pour rappels de rôle, references, rehires.

---

## Catégorie 3 — Congés et absences

### 3.1 Types de congés
- **Congés payés** (CP)
- **RTT** (Réduction du Temps de Travail)
- **Congé maladie**
- **Congé maternité / paternité**
- **Congé parental**
- **Congé sans solde**
- **Congé formation**
- **Congé pour événement familial** (mariage, décès, naissance)
- **Télétravail**
- **Congé exceptionnel**
- **Custom** (définissable par admin)

### 3.2 Demande de congé (employé)
Formulaire avec type, date de début, date de fin, motif optionnel. Calcul automatique du nombre de jours (ouvrés ou calendaires selon la règle).

### 3.3 Approbation (manager)
Notification au manager. Bouton `Approuver` / `Refuser` / `Demander des infos`. Approbation multi-niveaux si policy l'exige.

### 3.4 Balances (soldes)
Chaque employé voit son solde actuel par type de congé : acquis, utilisé, restant. Prévisionnel de l'année.

### 3.5 Calcul automatique
Règles de calcul localisées :
- **France** : 2.5 jours ouvrables par mois travaillé
- **Belgique** : 20 jours par an
- **Allemagne** : 24 jours par an minimum légal
Configurable par admin selon les lois locales.

### 3.6 Jours fériés
Calendrier des jours fériés par pays / région. Exclus des calculs de congés.

### 3.7 Congé collectif (fermeture annuelle)
Admin peut définir des périodes de fermeture (entre Noël et Nouvel An, août). Automatique pour tous les employés.

### 3.8 Calendrier d'équipe
Vue calendar partagée montrant qui est absent quand. Aide à planifier les projets et meetings.

### 3.9 Conflits de congés
Détection automatique des conflits (trop de monde absent en même temps). Warning au manager.

### 3.10 Règle "carry over"
Report des congés non pris à l'année suivante (selon policy : pas de report, max X jours, tous).

### 3.11 Délais de prévenance
Règle : congés demandés X jours à l'avance (ex: 2 semaines). Warning si urgence.

### 3.12 Justificatif médical
Upload d'un arrêt maladie. Chiffré, accessible RH uniquement.

### 3.13 Remplacement pendant les congés
Assigner un remplaçant pour les responsabilités pendant l'absence.

### 3.14 Auto-reply email
Pendant un congé, auto-reply email configuré automatiquement (intégration Mail).

### 3.15 Statut calendrier automatique
Passer en "Out of office" automatiquement dans Calendar pendant un congé.

---

## Catégorie 4 — Timesheets et temps de travail

### 4.1 Pointage (check-in / check-out)
Employé marque son arrivée et son départ. Manuel ou automatique (badge, géolocalisation, app mobile).

### 4.2 Saisie de temps par projet
Pour les entreprises facturant le temps (consulting, agences), saisie du temps passé par client/projet/tâche. Notes optionnelles.

### 4.3 Timesheets hebdomadaire
Vue semaine avec heures par jour. Total hebdomadaire automatique.

### 4.4 Timer inline
Bouton "Start timer" sur une tâche → comptage en temps réel. Stop quand on passe à autre chose.

### 4.5 Heures supplémentaires
Détection automatique des heures au-delà du contrat. Notification et approbation manager.

### 4.6 Comp time (récupération)
Les heures sup peuvent être converties en RTT (selon règles internes).

### 4.7 Approbation hebdomadaire
Timesheets soumises hebdomadairement au manager pour approbation. Verrouillage après approbation.

### 4.8 Export pour payroll
Export vers le provider de paye (PayFit, Silae, ADP) avec heures et modifications du mois.

### 4.9 Rapports d'activité
Temps passé par projet/client/catégorie. Pour facturation et reporting.

### 4.10 Règles d'horaires
Horaires standards définis par contrat (35h, 39h, 39h semaine avec RTT). Détection des écarts.

### 4.11 Flexi-time
Support des horaires flexibles : pas de pointage strict, juste un total sur la semaine.

### 4.12 Télétravail / Bureau
Indicateur jour de télétravail vs bureau pour statistiques.

### 4.13 Pauses
Enregistrement des pauses (déjeuner, pauses café) soustraites du temps de travail.

### 4.14 Anti-fraud
Règles de bon sens : pas de saisie de >24h/jour, pas de futur dates, cohérence GPS (si géoloc).

---

## Catégorie 5 — Paie (payroll)

### 5.1 Informations de paye (employé)
Dans sa fiche : salaire brut/net, primes récurrentes, avantages (titres restaurant, transport, mutuelle). Historique des fiches de paie.

### 5.2 Bulletins de paie (fiches de paie)
Génération et distribution des fiches de paie mensuelles. Accessibles dans son espace, téléchargeables en PDF. Archive indéfinie.

### 5.3 Intégration avec provider paye
Export mensuel vers PayFit, Silae, ADP, Gusto, etc. Envoi des variables (heures, congés, primes, absences).

### 5.4 Variables de paye
Éléments variables chaque mois : heures sup, primes, frais, avances, bonus. Saisie par RH ou automatique depuis les timesheets.

### 5.5 Augmentations et évolutions
Historique des salaires avec dates et motifs. Alerte manager pour les revues annuelles.

### 5.6 Avances sur salaire
Demande et approbation d'avances. Retenue automatique sur la prochaine paye.

### 5.7 Frais professionnels
Soumission de notes de frais avec justificatifs scannés. Approbation manager. Remboursement via paye ou hors paye.

### 5.8 Benefits (avantages)
Gestion des titres restaurant, chèques vacances, primes de transport, mutuelle, prévoyance. Montants et bénéficiaires.

### 5.9 Taxes et retenues
Calcul des cotisations sociales, impôt à la source, mutuelle, prévoyance selon règles locales.

### 5.10 Reports fiscaux
Génération des déclarations annuelles (DSN en France, W-2 aux US).

### 5.11 Compliance multi-pays
Règles de paye par pays pour les entreprises internationales.

---

## Catégorie 6 — Performance et objectifs

### 6.1 Objectifs individuels
Définir des objectifs (OKR ou KPI) par employé pour la période (trimestre, semestre, année). Owner, deadline, métrique, progression.

### 6.2 Objectifs cascadés
Objectifs d'entreprise → d'équipe → individuels. Visualisation de l'alignement.

### 6.3 Check-ins réguliers
1:1s hebdomadaires ou bi-hebdos avec le manager. Template : quoi depuis la dernière fois, blockers, prochaines priorités. Notes partagées.

### 6.4 Reviews formelles (annuelles / semestrielles)
Workflow de performance review :
- Self-assessment par l'employé
- Assessment par le manager
- Feedback 360° (pairs et subordonnés)
- Calibration entre managers
- Revue finale et rating
- Communication et signature

### 6.5 Feedback 360°
Demander des feedbacks à plusieurs personnes autour de l'employé (pairs, subordonnés, clients internes). Anonyme ou nominatif.

### 6.6 Competency framework
Grille de compétences par poste/niveau. Évaluation sur chaque compétence lors des reviews.

### 6.7 Goals OKR tracker
Suivi des OKRs avec progression trimestrielle. Grading à la fin.

### 6.8 Continuous feedback
Possibilité de donner du feedback positif (kudos) ou constructif à tout moment (pas seulement lors des reviews).

### 6.9 Reconnaissance et kudos
Système de "thanks" ou "kudos" publics à un collègue. Gamification légère.

### 6.10 Rating et grille
Rating par employé (Exceeds, Meets, Below) avec explications. Utilisé pour les augmentations et promotions.

### 6.11 Development plans
Plan de développement personnel : formations à suivre, compétences à acquérir, évolutions de poste envisagées.

### 6.12 Promotions et changements de poste
Workflow de promotion : demande, approbation manager + HR, mise à jour fiche, communication.

---

## Catégorie 7 — Recrutement (ATS - Applicant Tracking System)

### 7.1 Jobs board interne
Liste des postes ouverts publiée en interne (mobilité) et/ou externe (candidats). Description, salaire range, localisation.

### 7.2 Page carrière publique
Site web des offres publié sous custom domain. SEO optimisé, applications trackées.

### 7.3 Formulaire de candidature
Champs : nom, email, téléphone, CV (upload), lettre de motivation, portfolio, questions custom (années d'expérience, disponibilité, salaire attendu).

### 7.4 Pipeline candidats (Kanban)
Étapes : Nouveaux → Screening → Entretien RH → Entretien technique → Assessment → Entretien CEO → Offer → Embauché. Drag-drop entre étapes.

### 7.5 Parsing CV
Upload d'un CV → extraction automatique (IA) de : nom, email, téléphone, expériences, formations, skills. Pré-remplit la fiche candidat.

### 7.6 Scoring candidats
Rating par recruteur/manager après chaque entretien. Notes. Score agrégé.

### 7.7 Entretiens et planification
Demande d'entretien avec un candidat. Lien de booking avec les disponibilités. Lien de visio.

### 7.8 Feedback structuré
Après un entretien, remplir un scorecard structuré (skills testées, ressenti, recommandation).

### 7.9 Références
Contacter les références fournies par le candidat. Stockage des réponses.

### 7.10 Offer management
Génération d'une lettre d'offre (template avec salaire, date de début, bénéfices). Signature électronique.

### 7.11 Embauche (convert to employee)
Bouton `Hire this candidate` convertit le candidat en employé. Import des infos dans sa fiche. Démarrage du workflow d'onboarding.

### 7.12 Rejet et talent pool
Si pas retenu maintenant, garder en "talent pool" pour opportunités futures. Notification optionnelle au candidat.

### 7.13 Analytics recrutement
Stats : nombre de candidatures par poste, temps moyen de recrutement, taux de conversion par étape, source des candidats.

### 7.14 Intégrations jobs boards
Publier automatiquement les offres sur LinkedIn, Indeed, Welcome to the Jungle, etc. Aggregation des candidatures.

### 7.15 Diversity & inclusion
Options pour masquer nom/photo/éducation pendant le screening pour réduire les biais.

---

## Catégorie 8 — Documents et contrats

### 8.1 Bibliothèque de documents
Documents partagés : handbook, politiques, procédures, organigramme. Categorisés et cherchables.

### 8.2 Documents personnels de l'employé
Contrat, amendements, bulletins, certificats, évaluations. Accessibles par lui et les RH.

### 8.3 Signature électronique
Intégration avec le module Signatures pour faire signer : contrats, NDA, politiques, autorisations.

### 8.4 Templates de contrats
Templates pré-remplis (CDI, CDD, freelance, stage). Variables remplies automatiquement (nom, poste, salaire, date).

### 8.5 Expiration et renouvellement
Alerte pour les contrats avec date de fin (CDD, freelance). Rappel de renouveler ou mettre fin.

### 8.6 Lettres RH
Templates pour lettres courantes : attestation employeur, lettre d'embauche, lettre de recommandation, lettre de rupture.

### 8.7 Versions et historique
Historique des versions d'un document (contrat amendé, handbook mis à jour).

### 8.8 Accusés de lecture
Demander une confirmation de lecture pour les documents importants (nouvelle politique, code de conduite). Tracking.

### 8.9 E-signature audit trail
Log immuable : qui a signé, quand, depuis quelle IP. Pour conformité légale.

### 8.10 Retention policies
Règles de rétention par type de document selon les lois locales (RGPD, French labor law).

---

## Catégorie 9 — Time off et planning d'équipe

### 9.1 Calendrier d'équipe
Vue calendar partagée de tous les congés et absences de l'équipe. Filtres par équipe.

### 9.2 Who's off today
Dashboard du jour : qui est absent, qui est en télétravail, qui est au bureau.

### 9.3 Staff scheduling (shifts)
Pour les équipes postées (support, production, retail) : planification des shifts par semaine. Drag-drop pour assigner, échanges entre employés.

### 9.4 Publication du planning
Publication hebdomadaire ou mensuelle. Notifications aux employés. Verrouillage après publication.

### 9.5 Échanges de shifts
Employé peut proposer d'échanger un shift avec un collègue. Approbation manager.

### 9.6 Disponibilités
Employés déclarent leurs disponibilités (jours préférés, contraintes). Prise en compte dans le planning.

### 9.7 Time off requests dans le calendrier
Demandes de congés visibles sur le calendrier avant validation (grisé) et après (coloré).

### 9.8 Compte rendu mensuel
Récap mensuel des congés, absences, heures travaillées par employé.

---

## Catégorie 10 — Engagement et bien-être

### 10.1 Surveys d'engagement
Sondages anonymes réguliers (quarterly, monthly pulse) pour mesurer le moral et l'engagement.

### 10.2 eNPS (Employee Net Promoter Score)
"Recommanderiez-vous votre entreprise comme employeur ?" sur 10. Agrégation.

### 10.3 Feedback anonyme
Boîte à idées anonyme pour remonter des problèmes ou suggestions.

### 10.4 1:1 templates
Templates pour les 1:1s : checkins, career growth, mental health, feedback.

### 10.5 Reconnaissance publique
Fil d'actualité des kudos et shoutouts. Bouton "Thanks" avec template.

### 10.6 Birthdays et anniversaires d'entreprise
Rappels automatiques des birthdays et anniversaires d'embauche. Cartes et messages auto.

### 10.7 Onboarding buddy system
Assignation automatique d'un buddy pour les nouveaux.

### 10.8 Mental health resources
Accès aux ressources (thérapie, EAP) intégrées et privées.

### 10.9 Learning / formation
Catalogue de formations proposées. Inscription, suivi, certifications.

### 10.10 Social features
Trombinoscope, profils avec hobbies, photo sympa. Pour favoriser les rencontres inter-équipes.

---

## Catégorie 11 — Analytics et reporting

### 11.1 HR dashboard
KPIs : headcount, turnover, tenure moyen, time to hire, cost per hire, absentéisme, budget restant congés.

### 11.2 Turnover analysis
Qui part, quand, pourquoi. Par département, par manager, par ancienneté. Tendances.

### 11.3 Headcount planning
Prévision des embauches futures. Budget associé.

### 11.4 Compensation analytics
Distribution des salaires, écarts par genre/rôle/localisation (pay gap), percentiles.

### 11.5 Diversity metrics
Répartition genre, âge, ancienneté, origine (si collecté légalement). Pour les rapports DEI.

### 11.6 Absenteeism
Taux d'absentéisme par département. Identification des hotspots.

### 11.7 Performance distribution
Répartition des ratings (exceeds/meets/below). Calibration entre managers.

### 11.8 Survey results
Résultats des enquêtes d'engagement par période, département.

### 11.9 Recruitment funnel
Performance du pipeline par poste, temps moyen par étape.

### 11.10 Rapports réglementaires
Index égalité H/F (France), BSR (Belgique), autres rapports légaux.

---

## Catégorie 12 — Sécurité et conformité

### 12.1 Permissions granulaires
Par rôle (admin RH, manager, employé) et par équipe. Fine-grain : qui peut voir salaires, qui peut approuver, etc.

### 12.2 Encryption des données sensibles
NIS, IBAN, données médicales chiffrés at rest et in transit.

### 12.3 Audit logs
Log de qui accède à quelles données, quand. Pour conformité RGPD/SOX.

### 12.4 RGPD
- **Droit d'accès** : employé peut exporter ses données
- **Droit à l'oubli** : suppression sur demande (après départ)
- **Consentement** : explicite pour les traitements optionnels
- **Minimisation** : ne collecter que le nécessaire

### 12.5 Data residency
Hébergement des données dans le pays requis par la loi (EU pour RGPD).

### 12.6 Accès employé à ses données
L'employé peut voir toutes les données le concernant : c'est la transparence.

### 12.7 Documentation légale
Politique RGPD, contrats DPA avec sous-traitants, register of processing activities.

### 12.8 Anonymisation pour analytics
Les rapports agrégés n'exposent jamais des données individuelles.

### 12.9 Consent tracking pour surveys
Les surveys optionnels ont un consent explicite, traçable.

### 12.10 Legal hold
Pour les dossiers en contentieux, legal hold qui empêche toute modification/suppression.

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **BambooHR Support** (support.bamboohr.com) — SMB HRIS, time off, performance.
- **Personio Help Center** (support.personio.de) — EU-focused, GDPR, ATS.
- **Gusto Help** (support.gusto.com) — payroll US, benefits, compliance.
- **Rippling Help** (rippling.com/help) — IT+HR+Finance unified.
- **Deel Help** (help.deel.com) — global payroll, contractors, compliance.
- **Workday Community** (community.workday.com) — enterprise HCM.
- **HiBob Help** (hibob.com/help) — modern HRIS, culture.
- **Factorial Help** (factorialhr.com/help) — EU SMB.
- **Code du travail France** (code.travail.gouv.fr) — référence légale.

### Projets open source permissifs
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **OrangeHRM** (orangehrm.com) | **GPL v2** | **INTERDIT**. HR complet open source. |
| **Sentrifugo** | **LGPL v3** | **Weak copyleft** — OK consommateur. |
| **Jorani** (jorani.org) | **AGPL v3** | **INTERDIT**. Leave management. |
| **WorkAdventure** | **AGPL v3** | **INTERDIT**. |
| **OpenHR** | Various | À vérifier. |
| **Twill** (twill.io) | **LGPL v3** | **Weak copyleft** OK consommateur. CMS pouvant servir de base. |
| **Teamhood** | Proprietary | Pour inspiration. |
| **RFC 7265 jCal / JSCalendar** | Libre | Standards pour les calendriers d'équipe. |
| **ICS4J** | **MIT** | Génération ICS en Java. |
| **iCal parsers** (divers MIT) | **MIT** | Pour les imports/exports ICS (congés). |
| **libphonenumber** (google/libphonenumber) | **Apache-2.0** | Normalisation téléphone. |
| **money.js** / **currency.js** | **MIT** | Manipulation de montants (salaires). |
| **React Org Chart libraries** (plusieurs MIT) | **MIT** | Visualisation organigramme. |
| **Luxon** / **date-fns** | **MIT** | Dates et calculs de jours ouvrés. |
| **holidays-api** / **nager.date** | Service libre | Jours fériés par pays. |
| **qrcode.js** | **MIT** | QR pour badges. |

### Pattern d'implémentation recommandé
1. **Schéma** : signapps-db avec tables `employees`, `contracts`, `leave_requests`, `timesheets`, `performance_reviews`, `job_openings`.
2. **Calcul congés** : library custom avec règles par pays. Date-fns (MIT) pour les calculs.
3. **Jours fériés** : API nager.date ou library en Rust/JS.
4. **Payroll export** : formats standards (DSN en France, autre par pays). Génération XML/CSV.
5. **Org chart** : composant React custom ou library MIT.
6. **Signature électronique** : intégration module Signatures SignApps.
7. **Workflow onboarding/offboarding** : workflow engine avec triggers + actions.
8. **Intégration IT Assets** : API interne pour provisioning automatique.
9. **ATS** : base simple avec pipeline Kanban (@dnd-kit/core MIT).
10. **Parsing CV** : LLM interne avec prompts d'extraction.
11. **Sondages anonymes** : module Forms SignApps avec option "anonymisation".

### Ce qu'il ne faut PAS faire
- **Pas de fork** de OrangeHRM, Jorani (GPL/AGPL).
- **Pas de stockage de données médicales sans chiffrement**.
- **Pas de partage automatique des salaires** entre collègues.
- **Respect strict RGPD** pour les données personnelles.

---

## Assertions E2E clés (à tester)

- Création d'un employé avec toutes les infos
- Org chart avec drag-drop
- Directory avec recherche et filtres
- Self-service : employé édite son profil
- Demande de congés par l'employé
- Approbation/Refus par le manager
- Balance de congés à jour
- Calendar d'équipe montrant les absences
- Onboarding workflow : checklist générée
- Offboarding workflow
- Timesheet hebdomadaire saisie
- Approbation de timesheet par manager
- Bulletin de paie accessible par l'employé
- Performance review : self + manager + 360
- OKRs définis et tracking
- Feedback 360° collecté anonymement
- Pipeline recrutement Kanban
- Candidature : upload CV + parsing auto
- Entretien planifié avec scorecard
- Hire : candidat → employé avec onboarding démarré
- Document signé électroniquement
- Survey d'engagement envoyé et résultats agrégés
- Kudos donné et visible dans le feed
- Dashboard RH avec KPIs
- RGPD : export des données personnelles
- Audit log : modifications tracées
