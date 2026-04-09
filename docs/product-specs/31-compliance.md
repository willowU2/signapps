# Module Compliance (RGPD / GDPR) — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **OneTrust** | Privacy management platform leader (Gartner), DPIA automation, cookie consent, data mapping, vendor risk assessment, incident response, rights automation (DSAR), 200+ data source connectors, privacy impact assessment templates, regulatory intelligence |
| **TrustArc** | Privacy compliance platform, nymity accountability framework, cookie consent, privacy assessments, data flow visualization, regulatory change alerts, benchmarking, reporting dashboards |
| **Securiti** | Data intelligence + privacy automation, sensitive data discovery AI, data mapping auto, breach management, consent management, DSR orchestration, vendor management, 100+ cloud connectors |
| **BigID** | Data discovery & classification ML, privacy by design, data retention automation, DSAR fulfillment, data minimization insights, catalog integration, identity-aware scanning |
| **DataGrail** | Real-time data mapping, live integrations (500+), DSR automation, consent preference center, privacy risk scoring, deletion verification, audit-ready reporting |
| **Osano** | Consent management platform simple, vendor monitoring, data privacy ratings, cookie consent banner, regulatory tracker, no-code deployment, teacher-style compliance scoring |
| **Cookiebot (Usercentrics)** | Cookie consent management leader, auto-scanning des cookies, catégorisation automatique, consentement granulaire, TCF 2.2, Google Consent Mode, multi-langue, audit reports |
| **iubenda** | Privacy policy generator multi-juridiction (RGPD, CCPA, LGPD, PIPA), cookie consent, terms generator, consent database, internal privacy management, SaaS + embedded |
| **Vanta** | Compliance automation (SOC 2, ISO 27001, HIPAA, GDPR), continuous monitoring, evidence collection, access reviews, vendor risk assessment, trust center, integrations 300+ |
| **Drata** | Compliance automation (SOC 2, ISO 27001, GDPR, HIPAA), continuous control monitoring, evidence auto-collection, risk assessment, policy templates, auditor dashboard |
| **CNIL (authority)** | PIA Software officiel open source, guides méthodologiques RGPD, référentiels sectoriels, registre des traitements, formulaire DPIA structuré en 9 étapes |
| **Didomi** | Consent management, preference center, privacy center, compliance analytics, A/B testing consent, cross-device consent sync, TCF/GCM, API-first |

## Principes directeurs

1. **RGPD-first, extensible** — le module couvre nativement le RGPD européen (registre des traitements, DPIA, DSAR, consentement, rétention, violation). L'architecture permet d'ajouter d'autres réglementations (CCPA, LGPD, PIPA) sans refonte.
2. **Wizard guidé, pas formulaire vide** — chaque processus complexe (DPIA, DSAR, incident de violation) est guidé par un assistant étape par étape avec descriptions, exemples et aide contextuelle. L'utilisateur ne doit jamais se demander « que mettre dans ce champ ».
3. **Audit trail immuable** — chaque action dans le module Compliance est tracée dans un journal d'audit immuable : qui a fait quoi, quand, sur quelle donnée. Ce journal est la preuve de conformité pour les autorités.
4. **Calendrier réglementaire** — les obligations récurrentes (revue annuelle DPIA, mise à jour du registre, formation DPO) sont gérées par un calendrier intégré avec rappels automatiques.
5. **Automatisation maximale** — les durées de rétention déclenchent la suppression automatique, les demandes DSAR ont un workflow automatisé, les consentements sont tracés automatiquement.
6. **Documentation exportable** — chaque élément (DPIA, registre, politique de confidentialité) est exportable en PDF pour transmission aux autorités de contrôle (CNIL, ICO, etc.).

---

## Catégorie 1 — DPIA (Data Protection Impact Assessment)

### 1.1 Wizard DPIA en 5 étapes
Le processus DPIA est guidé par un assistant en 5 étapes avec barre de progression :
1. **Overview** — Informations générales du projet
2. **Processing** — Description des traitements de données
3. **Risk Assessment** — Évaluation des risques
4. **Mitigation** — Mesures d'atténuation
5. **Reports** — Génération du rapport final

### 1.2 Étape 1 : Overview (Vue d'ensemble)
Champs du formulaire :
- **Nom du projet** (texte, requis) — ex : « Plateforme RH »
- **Data Controller** (texte, requis) — responsable de traitement
- **DPO Name** (texte, requis) — nom du Délégué à la Protection des Données
- **Date d'évaluation** (date picker, requis) — date de réalisation de la DPIA
- **Description** (texte riche, requis) — description du traitement envisagé et de ses finalités
- **Base légale** (select : consentement, contrat, obligation légale, intérêt légitime, mission publique, intérêts vitaux)
- **Catégories de personnes concernées** (multi-select : employés, clients, candidats, fournisseurs, mineurs, patients)

### 1.3 Étape 2 : Processing (Traitements)
Description détaillée de chaque traitement de données personnelles :
- **Nature des données** (multi-select : identité, contact, financier, santé, biométrique, géolocalisation, opinions politiques, données judiciaires)
- **Source des données** (texte : collecte directe, tiers, observation)
- **Destinataires** (texte : internes, sous-traitants, tiers)
- **Transferts hors UE** (toggle + pays de destination + garanties)
- **Durée de conservation** (nombre + unité : jours/mois/années + justification)
- **Mesures techniques** (checkboxes : chiffrement, pseudonymisation, minimisation, contrôle d'accès)
Possibilité d'ajouter plusieurs traitements au même DPIA.

### 1.4 Étape 3 : Risk Assessment (Évaluation des risques)
Matrice de risques avec les axes :
- **Vraisemblance** (1-4 : négligeable, limitée, importante, maximale)
- **Gravité** (1-4 : négligeable, limitée, importante, maximale)
Risques pré-définis : accès non autorisé, modification non souhaitée, disparition des données, atteinte à la vie privée. L'utilisateur peut ajouter des risques custom. Le score de risque (vraisemblance × gravité) détermine la couleur : vert (1-4), orange (5-8), rouge (9-16).

### 1.5 Étape 4 : Mitigation (Mesures d'atténuation)
Pour chaque risque identifié, définir les mesures :
- **Description de la mesure** (texte)
- **Type** (select : technique, organisationnelle, contractuelle)
- **Responsable** (personne assignée)
- **Statut** (planifié, en cours, implémenté)
- **Date prévue** (date picker)
- **Risque résiduel après mesure** (recalcul du score)

### 1.6 Étape 5 : Reports (Rapports)
Génération automatique du rapport DPIA complet au format PDF conforme aux exigences CNIL/ICO :
- Page de garde avec informations du projet
- Synthèse des traitements
- Matrice des risques (avant/après atténuation)
- Plan d'action des mesures
- Avis du DPO (champ texte pour la conclusion du DPO)
- Signatures (DPO, responsable de traitement)
Export PDF, Word, et archivage dans le module Drive.

### 1.7 Historique et versioning des DPIA
Chaque DPIA est versionné. Les modifications sont tracées (qui a changé quoi, quand). Possibilité de comparer deux versions. La dernière version approuvée fait foi.

### 1.8 Modèles de DPIA
Bibliothèque de templates DPIA par secteur : RH, Marketing, Santé, E-commerce, Vidéosurveillance. Chaque template pré-remplit les champs standards. L'admin peut créer des templates custom.

---

## Catégorie 2 — Registre des traitements (Record of Processing Activities)

### 2.1 Tableau du registre
Tableau listant tous les traitements de données personnelles de l'organisation : nom, finalité, base légale, catégories de données, catégories de personnes, destinataires, durée de conservation, mesures de sécurité, date de création, dernière mise à jour.

### 2.2 Ajout d'un traitement
Formulaire structuré pour créer une fiche de traitement (Article 30 RGPD). Champs obligatoires marqués d'un astérisque. Aide contextuelle pour chaque champ avec référence à l'article du RGPD correspondant.

### 2.3 Sous-traitants (processeurs)
Pour chaque traitement, liste des sous-traitants impliqués avec : nom, pays, contrat DPA (Data Processing Agreement) existant (oui/non + date), garanties (clauses contractuelles types, Privacy Shield, BCR).

### 2.4 Export du registre
Export du registre complet en PDF (format CNIL), Excel ou CSV. Utile pour transmission à l'autorité de contrôle ou audit interne.

### 2.5 Revue périodique
Rappel automatique (configurable : trimestriel, semestriel, annuel) pour revoir et mettre à jour chaque fiche de traitement. Le DPO reçoit une notification avec la liste des fiches à revoir.

---

## Catégorie 3 — Consentement (Consent Management)

### 3.1 Registre des consentements
Tableau des consentements collectés : personne concernée, objet du consentement (newsletter, cookies, marketing, profiling), date de collecte, méthode (formulaire, case à cocher, double opt-in), date de retrait (si applicable), preuve (lien vers le formulaire ou le log).

### 3.2 Collecte du consentement
Widget intégrable pour collecter le consentement avec : texte clair et compréhensible, finalités listées avec toggle individuel, bouton « Tout accepter » et « Tout refuser », lien vers la politique de confidentialité. Conforme aux guidelines EDPB.

### 3.3 Preuve de consentement
Chaque consentement est stocké avec : horodatage exact, identifiant de la personne, texte exact présenté, action effectuée (accepté/refusé), adresse IP, user-agent. Immuable et exportable.

### 3.4 Retrait du consentement
L'utilisateur peut retirer son consentement à tout moment via un centre de préférences. Le retrait est tracé avec horodatage. Les traitements basés sur ce consentement doivent cesser immédiatement.

### 3.5 Centre de préférences
Page accessible à chaque utilisateur listant ses consentements actifs avec toggles pour chaque finalité. Historique des changements. Lien dans chaque email (unsubscribe).

### 3.6 Consentement des mineurs
Si la catégorie « mineurs » est détectée, vérification supplémentaire (consentement parental) avec workflow d'approbation. Âge légal configurable par pays (16 ans RGPD, 13 ans COPPA).

---

## Catégorie 4 — Rétention et suppression (Data Retention)

### 4.1 Politiques de rétention
Tableau des politiques de rétention par type de données : type de donnée, durée de conservation, base légale de la durée, action à expiration (suppression, anonymisation, archivage), responsable.

### 4.2 Application automatique
Les politiques de rétention sont exécutées automatiquement. Quand la durée de conservation expire, les données sont supprimées ou anonymisées selon la politique. Un log de suppression est conservé (quoi a été supprimé, quand, par quelle politique).

### 4.3 Alertes de rétention
Notification N jours avant l'expiration d'une donnée pour permettre une revue avant suppression. L'utilisateur peut demander une extension (avec justification tracée).

### 4.4 Suppression sécurisée
La suppression est irréversible (pas de soft-delete pour les données soumises à rétention). Les fichiers sont écrasés. Les entrées en base sont purgées. Les backups sont marqués pour exclusion au prochain cycle.

### 4.5 Rapport de rétention
Tableau de bord montrant : données arrivant à expiration ce mois, données supprimées ce mois, volume de données par politique, écarts (données dépassant la durée prévue sans suppression).

---

## Catégorie 5 — DSAR (Data Subject Access Requests)

### 5.1 Formulaire de demande
Formulaire permettant à une personne concernée de soumettre une demande d'exercice de ses droits : accès, rectification, effacement (droit à l'oubli), portabilité, opposition, limitation. Champs : identité du demandeur, type de droit exercé, description, pièce d'identité.

### 5.2 Workflow automatisé
Chaque DSAR suit un workflow en étapes : Réception → Vérification d'identité → Recherche des données → Traitement → Réponse → Clôture. Assignation automatique au DPO. Délai légal de 30 jours avec compteur visible et alertes.

### 5.3 Recherche cross-modules
Depuis une DSAR, bouton « Rechercher les données de cette personne » qui interroge tous les modules SignApps (Contacts, Mail, Drive, Calendar, Forms, etc.) pour compiler un dossier complet des données détenues.

### 5.4 Export de données (portabilité)
Pour les demandes de portabilité, génération automatique d'un archive ZIP contenant toutes les données de la personne dans un format structuré (JSON ou CSV) et lisible par machine, conformément à l'article 20 du RGPD.

### 5.5 Registre des DSAR
Tableau de toutes les demandes reçues avec : date, demandeur, type de droit, statut (en cours, traité, refusé), date de réponse, délai respecté (oui/non). Export pour reporting.

### 5.6 Modèles de réponse
Bibliothèque de modèles de réponse par type de droit (accès, effacement, refus motivé, extension de délai). Personnalisables. Envoi par email depuis le module.

---

## Catégorie 6 — Politique de confidentialité (Privacy Policy)

### 6.1 Générateur de politique
Wizard pour générer une politique de confidentialité complète basée sur les informations du registre des traitements. Sections générées : identité du responsable, finalités, base légale, durée de conservation, droits des personnes, transferts hors UE, cookies, modifications.

### 6.2 Multi-langue
Génération de la politique en plusieurs langues (français, anglais, allemand, espagnol, italien, néerlandais, portugais). Traduction assistée par AI avec révision humaine obligatoire.

### 6.3 Versioning de la politique
Chaque modification de la politique crée une nouvelle version avec date d'entrée en vigueur. Les versions précédentes restent accessibles. Notification aux utilisateurs lors de la mise à jour.

### 6.4 Publication
Publication de la politique sur une URL publique accessible sans authentification. Intégrable dans les formulaires, les emails et les conditions générales.

### 6.5 Conformité automatique
Le générateur vérifie que tous les traitements du registre sont couverts dans la politique. Alerte si un traitement est ajouté au registre mais absent de la politique.

---

## Catégorie 7 — Violations de données (Breach Management)

### 7.1 Déclaration d'incident
Formulaire de déclaration de violation de données : date de découverte, nature de la violation (confidentialité, intégrité, disponibilité), catégories de données impactées, nombre de personnes concernées, description de l'incident, mesures prises.

### 7.2 Évaluation de la gravité
Matrice d'évaluation : vraisemblance × gravité (identique DPIA). Si le score dépasse un seuil, obligation de notification à l'autorité de contrôle (72h) et/ou aux personnes concernées.

### 7.3 Notification à l'autorité
Génération automatique du formulaire de notification CNIL/ICO (Article 33 RGPD) avec les informations pré-remplies depuis la déclaration d'incident. Compteur 72h avec alertes.

### 7.4 Notification aux personnes concernées
Si requis (Article 34 RGPD), génération d'un email de notification aux personnes concernées avec : nature de la violation, conséquences probables, mesures prises, coordonnées du DPO.

### 7.5 Registre des violations
Journal immuable de toutes les violations avec : date, nature, impact, mesures, notifications effectuées, clôture. Conservé sans limitation de durée. Exportable pour audit.

### 7.6 Post-mortem
Pour chaque violation clôturée, section post-mortem : cause racine, mesures correctives, plan d'action pour prévenir la récurrence. Suivi du plan d'action avec assignation et deadline.

---

## Catégorie 8 — Audit Trail et Journal

### 8.1 Journal d'audit immuable
Chaque action dans le module Compliance est enregistrée : création/modification/suppression de fiches, approbation de DPIA, réponse DSAR, changement de politique. Champs : date/heure, utilisateur, action, objet, valeur avant/après.

### 8.2 Recherche dans l'audit
Filtres par période, utilisateur, type d'action, objet. Recherche full-text dans les descriptions. Export CSV/PDF.

### 8.3 Intégrité du journal
Le journal est append-only (aucune modification ni suppression possible, même par l'admin). Hash chaîné pour détecter toute altération. Vérification d'intégrité lancable par l'admin.

### 8.4 Rapport d'audit
Génération de rapports d'audit périodiques : activité par utilisateur, actions par type, conformité des délais DSAR, revues DPIA effectuées. Format PDF pour les auditeurs.

---

## Catégorie 9 — Calendrier réglementaire

### 9.1 Vue calendrier des obligations
Calendrier mensuel/trimestriel affichant les obligations réglementaires : revue DPIA (annuelle), mise à jour du registre (semestrielle), formation DPO (annuelle), revue des sous-traitants (annuelle), test de restauration (trimestriel).

### 9.2 Rappels automatiques
Notification N jours avant chaque échéance. Rappel au DPO et au responsable assigné. Escalation si non réalisé à la date prévue.

### 9.3 Suivi de réalisation
Chaque obligation a un statut (planifié, en cours, réalisé, en retard). Tableau de bord de conformité avec taux de réalisation par période.

### 9.4 Intégration avec le calendrier SignApps
Les obligations sont visibles dans le module Calendar comme des événements spéciaux (badge « Compliance »). Pas de doublon : source unique dans le module Compliance, vue dans Calendar.

---

## Catégorie 10 — Administration et configuration

### 10.1 Rôles Compliance
Rôles spécifiques : `DPO` (accès complet), `Compliance Officer` (gestion des fiches), `Auditor` (lecture seule + exports), `User` (soumission DSAR, gestion de ses consentements). Mappés sur le RBAC SignApps.

### 10.2 Templates réglementaires
Bibliothèque de templates par réglementation : RGPD (UE), CCPA (Californie), LGPD (Brésil), PIPA (Corée), PDPA (Singapour). Chaque template adapte les formulaires, les durées légales et les textes aux exigences locales.

### 10.3 Personnalisation des workflows
L'admin peut modifier les workflows (étapes, approbateurs, délais) pour chaque processus (DPIA, DSAR, violation). Éditeur visuel de workflow.

### 10.4 Intégration DPO externe
Si le DPO est externe, configuration d'un accès limité au module Compliance (sans accès aux autres modules SignApps). Notifications par email avec lien direct.

### 10.5 API Compliance
API REST documentée (OpenAPI via utoipa) pour l'intégration avec des outils tiers de conformité. Endpoints : registre des traitements, consentements, DSAR. Authentification JWT.

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **CNIL (cnil.fr)** — Guides RGPD, modèle de registre, PIA Software, fiches pratiques, référentiels sectoriels, formulaire de notification de violation.
- **EDPB Guidelines (edpb.europa.eu)** — Guidelines officielles sur le consentement, la DPIA, la portabilité, les droits des personnes, les transferts hors UE.
- **ICO (ico.org.uk)** — Guides UK GDPR, DPIA templates, breach reporting tool, rights request handling guide.
- **OneTrust Trust Center** (onetrust.com/resources) — Whitepapers sur la privacy management, DPIA automation, consent management.
- **IAPP (iapp.org)** — International Association of Privacy Professionals. Articles, templates, certifications (CIPP/E, CIPM).
- **Vanta Documentation** (docs.vanta.com) — Guides sur la compliance automation, evidence collection, continuous monitoring.
- **PIA Software CNIL** (github.com/LINCnil/pia) — Outil DPIA officiel de la CNIL, méthodologie en 9 étapes, référence structurelle.
- **Didomi Documentation** (developers.didomi.io) — API de consent management, preference center, compliance analytics.

### Projets open source permissifs à étudier comme pattern
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **PIA (CNIL)** (github.com/LINCnil/pia) | **GPL-3.0** | **INTERDIT** (GPL). Ne pas utiliser ni copier. Étudier les docs publiques et la méthodologie DPIA uniquement. |
| **Consent-O-Matic** (github.com/nicedayfor/consent-o-matic) | **MIT** | Browser extension pour le consentement. Pattern pour les interactions utilisateur de consentement. |
| **cookie-consent** (github.com/nicedayfor/cookie-consent) | **MIT** | Widget de consentement cookies. Pattern pour le centre de préférences. |
| **react-hook-form** (github.com/react-hook-form/react-hook-form) | **MIT** | Gestion des formulaires wizard multi-étapes. Déjà utilisé dans SignApps. |
| **zod** (github.com/colinhacks/zod) | **MIT** | Validation des schémas de formulaires (DPIA, DSAR). Déjà utilisé dans SignApps. |
| **jsPDF** (github.com/parallax/jsPDF) | **MIT** | Génération de rapports PDF (DPIA, registre, politique). |
| **@react-pdf/renderer** (github.com/diegomura/react-pdf) | **MIT** | Génération de PDF React-based. Alternative à jsPDF pour les rapports structurés. |
| **react-step-wizard** (github.com/jcmcneal/react-step-wizard) | **MIT** | Composant wizard multi-étapes. Pattern pour le DPIA wizard et le DSAR workflow. |
| **date-fns** (date-fns.org) | **MIT** | Calculs de dates (délais DSAR 30j, rétention, expiration). Déjà utilisé dans SignApps. |
| **uuid** (github.com/uuid-rs/uuid) | **MIT/Apache-2.0** | Génération d'identifiants uniques pour les fiches de traitement. Déjà utilisé dans SignApps. |

### Pattern d'implémentation recommandé
1. **DPIA Wizard** : composant React multi-étapes avec `react-hook-form` + `zod` pour la validation. State géré par Zustand. Persistance brouillon à chaque étape.
2. **Registre** : table PostgreSQL avec les champs Article 30 RGPD. Repository pattern via `signapps-db`. CRUD via handler Axum avec `utoipa::path`.
3. **Consentement** : table dédiée avec `user_id`, `purpose`, `granted_at`, `revoked_at`, `proof` (JSON). Index sur `user_id + purpose`. API REST pour le centre de préférences.
4. **Rétention** : cron job dans `signapps-metrics` ou worker dédié. Évalue les politiques de rétention quotidiennement. Suppression via les repositories existants.
5. **DSAR** : workflow state machine (réception → vérification → recherche → traitement → réponse → clôture). Notifications via PgEventBus → `signapps-notifications`.
6. **Audit trail** : table append-only avec hash SHA-256 chaîné. Pas de `UPDATE` ni `DELETE` SQL sur cette table. Index GIN pour la recherche full-text.
7. **PDF** : `@react-pdf/renderer` (MIT) pour les rapports DPIA et le registre exportable.

---

## Assertions E2E clés (à tester)

- Le wizard DPIA affiche les 5 étapes avec barre de progression
- L'étape Overview accepte le nom du projet, le Data Controller, le DPO et la date
- L'étape Processing permet d'ajouter plusieurs traitements de données
- L'étape Risk Assessment affiche la matrice vraisemblance × gravité avec couleurs
- L'étape Mitigation permet de définir des mesures pour chaque risque
- L'étape Reports génère un PDF téléchargeable avec toutes les informations
- Le registre des traitements liste tous les traitements avec colonnes triables
- L'ajout d'un traitement au registre crée une fiche conforme Article 30
- L'export du registre en PDF produit un document conforme au format CNIL
- Le widget de consentement affiche les finalités avec toggles individuels
- Le retrait d'un consentement met à jour le registre avec horodatage
- Le centre de préférences affiche les consentements actifs de l'utilisateur connecté
- Les politiques de rétention déclenchent la suppression à expiration
- L'alerte de rétention notifie N jours avant l'expiration
- Le formulaire DSAR permet de soumettre une demande d'accès/effacement/portabilité
- Le workflow DSAR respecte les étapes (réception → vérification → traitement → réponse)
- Le compteur 30 jours DSAR est visible et déclenche des alertes
- La recherche cross-modules compile les données d'une personne depuis tous les modules
- L'export de portabilité génère un ZIP avec les données en format structuré
- La déclaration de violation déclenche le compteur 72h pour la notification
- Le formulaire de notification CNIL est pré-rempli depuis la déclaration
- L'audit trail enregistre chaque action sans possibilité de modification
- La recherche dans l'audit filtre par période, utilisateur et type d'action
- Le calendrier réglementaire affiche les obligations avec rappels
- Les rôles DPO/Compliance Officer/Auditor restreignent correctement les accès
