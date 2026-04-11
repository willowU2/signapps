# Module LMS (Learning Management System) — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Moodle** | Leader open source, cours, quizzes, activités, forums, gradebook, plugins, SCORM, accessibility, LTI |
| **Canvas LMS** (Instructure) | UX moderne, cours, assignments, grades, calendar, SpeedGrader, modules, conferences, pages, New Quizzes |
| **Google Classroom** | Simple, free pour education, assignments, grades, Google Drive integration |
| **Workday Learning** | Enterprise, LMS + LxP, skills, certifications, compliance training |
| **Docebo** | AI-powered, corporate, social learning, certifications, ILT (Instructor-Led Training) |
| **TalentLMS** | SMB-friendly, e-commerce, courses, reports, blended learning |
| **Learnworlds** | Sell courses, landing pages, community, interactive videos |
| **Thinkific** | Course creators, white-label, memberships, drip content |
| **Teachable** | Sell courses, affiliate, quizzes, certificates |
| **LinkedIn Learning** | Content library (16k+ courses), Skills assessment, Paths, Gamification, corporate integration |
| **Udemy Business** | Content + corporate, skill tracking |
| **360Learning** | Collaborative learning, peer learning, AI course authoring |
| **Absorb LMS** | Corporate training, SCORM, compliance |
| **Open edX** | MOOC platform, leader academic |

## Principes directeurs

1. **Content creation facile** — créer un cours en quelques clics, sans formation technique.
2. **Parcours flexibles** — self-paced, blended, instructor-led, cohort-based selon les besoins.
3. **Engagement et completion** — gamification, progression, certificats, social, tous facteurs qui augmentent le taux de complétion.
4. **Analytics et compliance** — tracking des formations obligatoires, certifications, taux de complétion.
5. **Multi-formats** — vidéo, texte, quiz, interactif, SCORM, livebooks, live sessions.
6. **Mobile-first** — accès et consommation depuis mobile pour le micro-learning.

---

## Catégorie 1 — Création de cours

### 1.1 Nouveau cours
Bouton `Créer un cours` → formulaire initial : titre, description, catégorie, langue, durée estimée, niveau, tags.

### 1.2 Structure hiérarchique
Cours → Chapitres (modules) → Leçons → Ressources (vidéos, textes, quiz, assignments).

### 1.3 Création depuis template
Templates de cours : "Introduction à X", "Formation compliance", "Onboarding nouveau", "Présentation produit".

### 1.4 Cover image et video intro
Image de couverture et vidéo d'intro pour le cours.

### 1.5 Learning objectives
Liste des objectifs d'apprentissage (ce que l'apprenant saura faire après le cours).

### 1.6 Prerequisites
Cours prérequis à compléter avant de s'inscrire à celui-ci.

### 1.7 Catégories et tags
Organisation dans des catégories hiérarchiques (ex: `Sales > Prospection > Cold calling`). Tags pour la recherche transverse.

### 1.8 Niveau
Débutant, intermédiaire, avancé, expert.

### 1.9 Durée et effort estimés
Temps total, temps par module, effort (léger/moyen/intensif).

### 1.10 Visibilité
Public (accessible à tous), privé (invitation seulement), organisation (interne entreprise), draft (en cours).

### 1.11 Multi-language
Cours disponible en plusieurs langues. Switcher de langue par l'apprenant.

### 1.12 Versioning
Historique des versions d'un cours. Les learners en cours gardent leur version, les nouveaux ont la dernière.

### 1.13 Collaboration
Plusieurs auteurs peuvent éditer un cours. Commentaires internes.

### 1.14 Preview
Mode preview pour voir le cours comme un apprenant avant publication.

### 1.15 Publishing
Publier le cours pour le rendre disponible. Scheduled publishing possible.

---

## Catégorie 2 — Types de contenu

### 2.1 Video lessons
Upload de vidéos (MP4, WebM, MOV). Player avec contrôles, vitesse variable (0.5x à 2x), sous-titres, chapters.

### 2.2 Streaming adaptatif
Vidéos encodées en HLS/DASH pour adaptation automatique à la bande passante.

### 2.3 Interactive video
Vidéos avec annotations cliquables, questions au milieu, choix influençant la suite (branching scenarios).

### 2.4 Text lessons
Leçons en texte rich (markdown/WYSIWYG). Images inline, code blocks, tables, math, embeds.

### 2.5 PDF lessons
Upload de PDFs lus dans le navigateur. Annotations, bookmarks.

### 2.6 Slides (présentation)
Intégration avec le module Slides de SignApps pour des présentations navigables.

### 2.7 SCORM content
Support des packages SCORM 1.2 et 2004 pour importer des cours externes.

### 2.8 xAPI / Tin Can
Support xAPI pour le tracking avancé (expériences d'apprentissage).

### 2.9 LTI integration
Intégration d'outils externes via LTI 1.3 (Learning Tools Interoperability).

### 2.10 Audio lessons
Upload de fichiers audio (podcasts, interviews). Player avec waveform.

### 2.11 Downloadable resources
Fichiers téléchargeables (templates, cheat sheets, workbooks) attachés à une leçon.

### 2.12 External links
Liens vers articles, ressources externes.

### 2.13 Embeds
Embed de contenu externe : YouTube, Vimeo, CodePen, Figma, etc.

### 2.14 Live sessions
Sessions live avec formateur (intégration avec le module Meet). Enregistrement disponible ensuite.

### 2.15 Webinars
Webinar enregistré avec Q&A. Replay disponible.

### 2.16 Simulations
Simulations interactives (ex: terminal Linux virtuel, éditeur de code). Bac à sable pour expérimenter.

### 2.17 Virtual labs
Environnement virtualisé pour exercices pratiques (pour cours techniques).

---

## Catégorie 3 — Quiz et évaluations

### 3.1 Types de questions
- **Multiple choice** (une seule bonne réponse)
- **Multiple answer** (plusieurs bonnes réponses)
- **True/False**
- **Fill in the blank** (texte libre)
- **Matching** (associer des paires)
- **Ordering** (mettre dans le bon ordre)
- **Numerical** (réponse chiffrée)
- **Essay** (réponse libre avec grading manuel)
- **Upload assignment** (upload d'un fichier)
- **Hot spot** (cliquer sur une zone d'une image)
- **Drag and drop** (placer des items dans des zones)
- **Code** (évaluation de code avec test automatique)

### 3.2 Banque de questions
Bibliothèque de questions réutilisables. Catégories, tags, niveau.

### 3.3 Randomization
Randomiser l'ordre des questions et des options pour éviter le copier.

### 3.4 Question pools
Tirer au hasard X questions d'une banque de Y questions pour chaque tentative.

### 3.5 Temps limité
Timer global ou par question. Soumission automatique à l'expiration.

### 3.6 Tentatives multiples
Autoriser N tentatives, compter la meilleure ou la moyenne.

### 3.7 Feedback immédiat ou différé
Afficher la bonne réponse immédiatement ou à la fin.

### 3.8 Feedback par réponse
Explication personnalisée selon la réponse choisie (pour les distracteurs).

### 3.9 Scoring
Points par question (pondérables). Score total, pourcentage, passing grade.

### 3.10 Passing grade
Définir le score minimum pour considérer le quiz réussi (ex: 80%).

### 3.11 Certification quiz
Quiz obligatoire à passer pour obtenir un certificat.

### 3.12 Proctoring (surveillance)
Pour les examens importants : webcam, détection d'onglets changeants, lockdown browser.

### 3.13 Review mode
Après soumission, revoir les questions avec les bonnes réponses et explications.

### 3.14 Export results
Export des résultats en CSV pour analyse externe.

### 3.15 Analytics par question
Identifier les questions trop faciles/difficiles (% de bonnes réponses) pour calibrer.

---

## Catégorie 4 — Parcours d'apprentissage et inscription

### 4.1 Enrollment manuel
Admin/instructor inscrit manuellement des utilisateurs à un cours.

### 4.2 Self-enrollment
Apprenants peuvent s'inscrire eux-mêmes aux cours publics ou visibles.

### 4.3 Enrollment payant
Cours payants avec paiement via Stripe/PayPal. Accès après paiement.

### 4.4 Enrollment par code
Code d'accès que l'instructor distribue (ex: "FORMATION2026"). L'apprenant rentre le code pour s'inscrire.

### 4.5 Enrollment automatique par rôle
Règle : tous les nouveaux commerciaux sont auto-inscrits au cours "Onboarding Sales".

### 4.6 Enrollment par groupe
Inscrire tout un groupe (équipe, département) en une fois.

### 4.7 Enrollment deadline
Date limite d'inscription. Après cette date, cours fermé.

### 4.8 Waitlist
Si cours complet, file d'attente. Auto-inscription quand des places se libèrent.

### 4.9 Prerequisites check
Vérification que l'apprenant a complété les prérequis avant de s'inscrire.

### 4.10 Parcours (Learning paths)
Séquence de plusieurs cours à compléter dans un ordre pour obtenir une certification plus large.

### 4.11 Recommandations
L'IA suggère des cours basés sur : profil, skills manquantes, cours complétés par des collègues similaires, objectifs de carrière.

### 4.12 Catalogues et tags
Catalogue de cours avec filtres, recherche, tri.

### 4.13 Wishlists
Apprenants peuvent sauvegarder des cours pour plus tard.

### 4.14 Featured courses
Cours mis en avant sur la homepage.

### 4.15 Due dates
Cours avec date de fin obligatoire (ex: formation compliance à finir avant le 31 mars).

---

## Catégorie 5 — Apprentissage (learner experience)

### 5.1 Dashboard learner
Vue personnelle : cours en cours, cours terminés, certifications, progression globale, badges.

### 5.2 Course homepage
Page du cours avec description, programme, prérequis, objectifs, inscription/continue.

### 5.3 Lesson player
Player de leçon avec :
- Vidéo/texte/quiz courant
- Navigation : précédent, suivant, table des matières
- Progress bar
- Transcription (pour les vidéos)
- Speed control, subtitles
- Full screen

### 5.4 Progress tracking
% complété par cours, par chapitre. Visualisation claire.

### 5.5 Resume where you left off
Reprendre exactement où on s'est arrêté.

### 5.6 Notes personnelles
L'apprenant peut prendre des notes pendant le cours. Timestamped pour les vidéos.

### 5.7 Highlights et bookmarks
Surligner du texte, bookmarker des moments de vidéo pour révision.

### 5.8 Q&A par leçon
Poser une question à l'instructor ou à la communauté. Thread public visible par tous les apprenants.

### 5.9 Discussion forum
Forum du cours pour discussions entre apprenants. Modéré par l'instructor.

### 5.10 Peer review
Apprenants reviewent mutuellement leurs assignments. Échange constructif.

### 5.11 Notifications
Rappels : "Vous avez commencé ce cours mais pas terminé", "Nouveau module disponible", "Votre certificat est prêt".

### 5.12 Offline mode
Download du cours pour consommation hors-ligne (mobile principalement).

### 5.13 Transcripts for videos
Transcription automatique (whisper-rs) de toutes les vidéos. Cherchable et cliquable pour sauter au timestamp.

### 5.14 Multi-language subtitles
Sous-titres traduits automatiquement en plusieurs langues.

### 5.15 Accessibility
Screen reader, navigation clavier, contrastes, ratio de texte, transcription.

---

## Catégorie 6 — Gamification et engagement

### 6.1 Points et XP
Gagner des points en complétant des cours, quiz, assignments. Total visible.

### 6.2 Badges
Badges pour les accomplissements : "1er cours complété", "Speed learner", "Top contributor", "100% de complétion", "Streak 7 jours".

### 6.3 Leaderboards
Classement des apprenants par XP, cours complétés, badges. Par équipe, par département.

### 6.4 Streaks
Séries de jours consécutifs d'apprentissage. Encourager la régularité.

### 6.5 Levels
Système de niveaux (novice → expert) basé sur les points accumulés.

### 6.6 Achievements
Achievements à débloquer (similaire aux jeux vidéo).

### 6.7 Social features
Voir ce que ses collègues apprennent. "Jean vient de compléter le cours Sales 101". Motivation sociale.

### 6.8 Share achievements
Partager un badge ou certification sur LinkedIn. Bouton intégré.

### 6.9 Challenges
Défis : "Complète 3 cours cette semaine", "Obtenir 95% au quiz final".

### 6.10 Rewards
Recompenses concrètes pour les top learners : bonus, reconnaissance manager, swag.

### 6.11 Progress reminders
Rappels doux pour ne pas perdre son streak ou abandonner un cours.

---

## Catégorie 7 — Certifications et diplômes

### 7.1 Certificate generation
Génération automatique d'un certificat PDF à la complétion d'un cours. Template personnalisable avec logo, signature, date, nom.

### 7.2 Certificate verification
Chaque certificat a un ID unique. URL de vérification publique pour les employeurs vérifient l'authenticité.

### 7.3 Blockchain certification (optional)
Pour les certifications importantes, hash du certificat sur blockchain (Ethereum, Polygon) pour inaltérabilité.

### 7.4 Expiration
Certains certificats expirent (ex: formation sécurité tous les ans). Rappels avant expiration pour renouvellement.

### 7.5 Continuing education
Tracking des heures de formation continue pour les professions réglementées (ordre médical, avocats, comptables).

### 7.6 Transcripts
Transcript officiel listant tous les cours complétés avec scores. Exportable.

### 7.7 Digital badges (Open Badges)
Badges au standard Open Badges 2.0/3.0, partageables sur LinkedIn.

### 7.8 Learning paths certifications
Certification obtenue en complétant un learning path complet.

### 7.9 Required training tracking
Pour les formations obligatoires (compliance, sécurité) : qui doit les faire, qui les a faites, qui est en retard.

### 7.10 Compliance dashboard
Vue d'ensemble pour l'organisation : % de l'équipe en règle sur les formations obligatoires.

---

## Catégorie 8 — Formats de formation (blended)

### 8.1 Self-paced online
Cours 100% en ligne, apprenant à son rythme.

### 8.2 Instructor-led training (ILT)
Formation en présentiel ou virtuelle avec instructor en live. Dates, horaires, participants.

### 8.3 Blended learning
Mélange : une partie self-paced, une partie live avec instructor.

### 8.4 Cohort-based
Apprenants démarrent ensemble et progressent à un rythme commun. Échanges entre pairs favorisés.

### 8.5 Drip content
Contenu libéré progressivement (une leçon par jour, une par semaine).

### 8.6 Scheduled sessions
Sessions live planifiées avec inscription. Zoom/Meet integration.

### 8.7 Webinars
Webinars avec inscription, live chat, Q&A, recording disponible ensuite.

### 8.8 In-person training
Formations physiques : lieu, horaires, capacité, materials.

### 8.9 Hybrid
Certains participants en présentiel, d'autres en virtuel.

### 8.10 Asynchronous discussions
Forums pour discussions hors-live entre sessions.

---

## Catégorie 9 — Analytics et reporting

### 9.1 Dashboard admin
- Nombre d'apprenants actifs
- Cours les plus populaires
- Taux de complétion global
- Temps moyen par cours
- Certifications délivrées
- Formations obligatoires en retard

### 9.2 Cours analytics
Pour chaque cours : inscrits, complétion, taux d'abandon, temps moyen, score moyen au quiz, feedback apprenants.

### 9.3 Learner analytics
Pour chaque learner : cours inscrits, complétion, score moyen, badges, time spent, dernière activité.

### 9.4 Instructor analytics
Performance des instructors : cours créés, apprenants inscrits, taux de complétion, feedback.

### 9.5 Engagement metrics
Sessions par semaine, durée moyenne, taux de retour, completion rate.

### 9.6 Drop-off analysis
Où les apprenants abandonnent un cours. Identifier les leçons problématiques.

### 9.7 Quiz analytics
Questions trop faciles ou trop difficiles. Distracteurs efficaces.

### 9.8 Skill tracking
Compétences acquises par l'équipe au fil du temps.

### 9.9 ROI training
Impact business des formations : corrélation avec KPIs (ventes, satisfaction client, etc.).

### 9.10 Custom reports
Builder de rapports custom avec filtres, groupements, exports.

### 9.11 Scheduled reports
Rapports envoyés automatiquement par email (hebdo, mensuel).

### 9.12 Export
CSV, PDF, Excel.

---

## Catégorie 10 — Content creation et authoring

### 10.1 Rich editor
Éditeur Tiptap cohérent avec le reste de SignApps. Rich text, embeds, media.

### 10.2 Video recording (screencast)
Enregistrer directement depuis le navigateur : caméra + écran + audio. Éditeur simple intégré.

### 10.3 Video editing basic
Trimming, cropping, transitions simples, annotations.

### 10.4 AI content generation
Génération de leçon depuis un prompt : titre + description → outline + contenu. Révision humaine requise.

### 10.5 AI quiz generation
Depuis une leçon, génération automatique de questions de quiz.

### 10.6 AI voiceover
Transformer du texte en voix (TTS) pour les leçons narrées.

### 10.7 AI translation
Traduire tout un cours dans plusieurs langues automatiquement.

### 10.8 AI subtitling
Sous-titres automatiques pour toutes les vidéos (whisper).

### 10.9 Collaborative authoring
Plusieurs auteurs co-éditent un cours en temps réel (Yjs).

### 10.10 Content library
Bibliothèque de contenus réutilisables : vidéos, images, quiz questions, templates.

### 10.11 Import depuis Docs/Slides
Importer un document ou une présentation SignApps comme base de cours.

### 10.12 Asset management
Gérer tous les assets du cours (vidéos, images, docs) dans un seul panneau.

---

## Catégorie 11 — Intégrations

### 11.1 HR / SignApps Workforce
Sync avec les employés. Formations obligatoires par rôle.

### 11.2 Calendar
Inscriptions aux sessions live apparaissent dans le calendrier.

### 11.3 Meet
Live sessions via le module Meet interne.

### 11.4 Drive
Upload de matériels pédagogiques.

### 11.5 Docs
Référence à des docs comme ressources.

### 11.6 Chat
Discussions par cours dans un channel dédié.

### 11.7 Mail
Notifications email.

### 11.8 CRM
Formations clients liées au CRM (customer onboarding, enablement).

### 11.9 SCORM
Import de packages SCORM externes.

### 11.10 LTI 1.3
Intégration d'outils externes via LTI.

### 11.11 Zoom / Google Meet / Teams
Pour les sessions live via providers externes.

### 11.12 API REST
API complète pour intégration custom.

### 11.13 SSO
Login unifié via SAML/OIDC.

### 11.14 Payment (Stripe, PayPal)
Pour les cours payants.

### 11.15 Webhooks
Events : enrollment, completion, certificate issued.

---

## Catégorie 12 — Mobile et accessibilité

### 12.1 Application mobile
iOS et Android pour apprendre en déplacement.

### 12.2 Offline mode
Download d'un cours complet pour consommation hors-ligne. Sync du progress au retour.

### 12.3 Picture-in-picture
Vidéo du cours en PiP pour continuer à suivre tout en faisant autre chose.

### 12.4 Accessibility WCAG AA
- Screen reader
- Keyboard navigation
- High contrast mode
- Captions obligatoires
- Transcripts
- Adjustable text size
- Skip to content

### 12.5 Audio descriptions
Descriptions audio pour les vidéos (pour malvoyants).

### 12.6 Sign language
Option d'inclure un interprète en langue des signes dans un coin de la vidéo.

### 12.7 Dyslexia-friendly
Mode lecture adapté : police OpenDyslexic, espacement, couleurs.

### 12.8 Speed control
Vitesse de lecture de 0.5x à 2x.

### 12.9 Night mode
Dark theme pour l'apprentissage le soir.

---

## Sources d'inspiration

### Aides utilisateur publiques
- **Moodle Docs** (docs.moodle.org) — plateforme leader, plugins, SCORM.
- **Canvas Community** (community.canvaslms.com) — guides modernes.
- **Google Classroom Help** (support.google.com/edu/classroom) — simplicité.
- **Docebo Help** (help.docebo.com) — enterprise, AI learning.
- **TalentLMS Help** (help.talentlms.com) — SMB corporate.
- **xAPI Specification** (xapi.com) — tracking avancé.
- **SCORM Explained** (scorm.com) — standard interopérabilité.
- **Open Badges** (openbadges.org) — badges numériques.
- **WCAG 2.1** (w3.org/WAI) — accessibilité.

### Projets open source permissifs
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL**

| Projet | Licence | Ce qu'on peut étudier |
|---|---|---|
| **Moodle** (moodle.org) | **GPL v3** | **INTERDIT**. Leader open source. Étudier via docs publiques. |
| **Open edX** (openedx.org) | **AGPL v3** | **INTERDIT**. Plateforme MOOC derrière edX. |
| **Canvas LMS** (github.com/instructure/canvas-lms) | **AGPL v3** | **INTERDIT**. |
| **Chamilo** (chamilo.org) | **GPL v3** | **INTERDIT**. |
| **Sakai** (sakailms.org) | **Apache-2.0** (Educational Community License) | **À vérifier** — ECL est proche Apache mais pas identique. |
| **Forma LMS** | **GPL v2** | **INTERDIT**. |
| **Gnowsys / Gnowbe** | Various | À vérifier. |
| **ILIAS** | **GPL v3** | **INTERDIT**. Leader allemand. |
| **ATutor** | **GPL v3** | **INTERDIT**. |
| **Rise / Articulate** | Commercial | Pour inspiration UI. |
| **h5p** (h5p.org, github.com/h5p/h5p-php-library) | **MIT** | Interactive content library. Vidéos interactives, quizzes, presentations. **À étudier**. |
| **h5p-editor** | **MIT** | Éditeur pour h5p. |
| **Video.js** (videojs.com) | **Apache-2.0** | Player vidéo. |
| **hls.js** (github.com/video-dev/hls.js) | **Apache-2.0** | Streaming HLS. |
| **Plyr** (plyr.io) | **MIT** | Video player moderne. |
| **SCORM wrapper libraries** | Various | Pour le support SCORM. |
| **pdf.js** (mozilla.github.io/pdf.js) | **Apache-2.0** | Viewer PDF. |
| **Tiptap** | **MIT** | Éditeur cohérent SignApps. |
| **Chart.js / ECharts** | **MIT / Apache-2.0** | Graphiques pour analytics. |
| **react-player** (github.com/cookpete/react-player) | **MIT** | Wrapper player vidéo/audio. |
| **lottie-web** (lottiefiles.com) | **MIT** | Animations pour gamification. |
| **qrcode.js** | **MIT** | QR pour certificats. |
| **puppeteer** | **Apache-2.0** | Génération PDF certificats. |
| **whisper-rs** (github.com/tazz4843/whisper-rs) | **Unlicense** | STT pour transcription vidéos. |
| **rust_opus** | **BSD-3** | Encoding audio. |
| **ffmpeg** | **LGPL/GPL** | **Attention** — en binary externe OK. |

### Pattern d'implémentation recommandé
1. **Structure** : signapps-db avec tables `courses`, `modules`, `lessons`, `enrollments`, `quizzes`, `submissions`, `certificates`.
2. **Video hosting** : stockage dans le Drive SignApps + transcoding ffmpeg (externe) + streaming HLS via hls.js (Apache-2.0).
3. **Video player** : Video.js (Apache-2.0) ou Plyr (MIT).
4. **Interactive content** : h5p (MIT) comme library pour les interactions avancées.
5. **Transcription** : whisper-rs (Unlicense) pour la génération automatique de sous-titres.
6. **SCORM support** : implémentation du runtime SCORM 1.2/2004 selon le standard.
7. **Quiz engine** : custom avec React + state machine pour les flows.
8. **Certificates** : génération PDF avec pdf-lib (MIT) ou puppeteer (Apache-2.0).
9. **Gamification** : custom avec table des points et badges. Triggers sur events.
10. **Analytics** : aggregation via queries PostgreSQL. Dashboards custom.
11. **AI content generation** : LLM interne avec prompts dédiés (génération cours, quiz, résumés).
12. **Collaborative authoring** : Yjs (MIT) pour la co-édition.
13. **Streaming** : HLS ou DASH avec adaptation bitrate.

### Ce qu'il ne faut PAS faire
- **Pas de fork** de Moodle, Canvas, Open edX, Chamilo, ILIAS (GPL/AGPL).
- **Attention à Sakai** : ECL license, valider compatibility.
- **Pas de ffmpeg statiquement linké** si GPL — dynamic linking OK.

---

## Assertions E2E clés (à tester)

- Création d'un cours avec structure
- Upload de vidéo comme leçon
- Création d'un quiz avec plusieurs types de questions
- Inscription manuelle d'un apprenant
- Self-enrollment par l'apprenant
- Progression dans un cours (leçons complétées)
- Quiz complété avec score
- Certificat généré après complétion
- Learning path avec plusieurs cours
- Recherche et filtres dans le catalogue
- Dashboard learner avec progression
- Notes personnelles sur une leçon
- Forum de discussion
- Live session planifiée et jointe via Meet
- Gamification : points attribués
- Badges débloqués
- Dashboard admin avec analytics
- Export de rapports
- Formation obligatoire avec rappel
- Mobile : cours consommé
- Offline mode : download et sync
- Accessibility : subtitles et transcription
- AI : génération de quiz depuis une leçon
