# Module Data Management — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Delphix** | Masquage dynamique en temps reel, virtualisation des donnees (clones legers), profiling automatique de PII, 30+ algorithmes de masquage, compliance GDPR/CCPA/HIPAA, lineage des donnees masquees, API-first, detection automatique des relations FK |
| **Informatica Data Masking** | 50+ techniques de masquage (substitution, shuffling, encryption, nulling), profiling automatique, masquage persistant et dynamique, integration ETL, referential integrity preservation, audit trail, support multi-SGBD |
| **IBM InfoSphere Optim** | Masquage, archivage et subset des donnees, preservation de l'integrite referentielle, generation de donnees de test, support mainframe, masquage en place ou lors de l'extraction, policies centralisees |
| **Oracle Data Masking** | Masquage integre a Oracle DB, format-preserving encryption (FPE), detection automatique de colonnes sensibles, masquage conditionnel, clonage de schemas masques, integration Enterprise Manager |
| **AWS DMS Data Masking** | Masquage lors de la migration/replication, transformation rules, colonnes source/cible, integration S3/Redshift/RDS, serverless, regles JSON declaratives, filtrage de tables |
| **PostgreSQL Anonymizer** | Extension native PostgreSQL, masquage dynamique (vues), masquage statique (in-place), generalization, k-anonymity, pseudonymisation, fonctions faker, regles declaratives SQL, open source |
| **Tonic.ai** | Generation de donnees synthetiques realistes, preservation des distributions statistiques, referential integrity, de-identification differentially private, subsetting intelligent, CI/CD integration, SDK |
| **Gretel.ai** | Donnees synthetiques par IA generative (GPT), differential privacy, detection PII par NLP, classification automatique, anonymisation par transformation, API cloud, modeles pre-entraines |

## Principes directeurs

1. **PII-first scanning** — le systeme detecte automatiquement les donnees personnelles (noms, emails, telephones, numeros de secu, IBAN) dans toutes les tables PostgreSQL via des heuristiques de nommage et du pattern matching regex. Le scan est incremental et planifiable.
2. **Masquage deterministe** — un meme input produit toujours le meme output masque (pour preserver les jointures et les tests reproductibles). Les strategies sont configurables par colonne : partial, redact, faker, hash, FPE, shuffle, null.
3. **GDPR by design** — les workflows de suppression RGPD sont guides par un assistant qui identifie toutes les tables contenant des donnees de l'utilisateur cible (via FK et colonnes user_id), genere un plan de suppression, et l'execute avec audit trail immutable.
4. **Environnements isoles** — le masquage s'applique aux environnements non-production (dev, staging, test). Les donnees de production ne sont jamais masquees en place. L'interface indique clairement quel environnement est cible.
5. **Anonymisation irreversible** — l'anonymisation (contrairement au masquage) detruit definitivement le lien entre la donnee anonymisee et la personne. Utilisee pour les datasets analytiques et le machine learning. Le processus est irreversible et documente.
6. **Audit et preuve de conformite** — chaque operation (scan PII, masquage, suppression GDPR, anonymisation) est tracee dans un journal immutable avec timestamp, operateur, tables impactees, nombre de lignes traitees. Exportable en PDF pour les autorites de controle.

---

## Categorie 1 — Masquage des donnees (Data Masking)

### 1.1 Liste des regles de masquage
Ecran principal avec tableau des regles actives : table PostgreSQL cible, colonne, strategie de masquage, preview du resultat, environnements d'application (dev/staging/test), statut (actif/inactif), date de creation. Compteur en haut : "N champs masques — PII protege dans les environnements non-production". Bouton `+ Add Rule` en haut a droite.

### 1.2 Strategies de masquage disponibles
Chaque regle definit une strategie parmi :
- **Partial** : masquage partiel preservant le format. Email : `j***n@example.com` (premier/dernier caractere + domaine). Telephone : `06 ** ** ** 42`. Carte : `**** **** **** 1234`.
- **Redact** : remplacement par une valeur fixe (`[REDACTED]`, `***`, `000-00-0000`). Configurable.
- **Faker realistic** : generation de donnees fictives realistes (noms, adresses, emails, telephones) preservant le type et le format. Locale configurable (fr_FR, en_US). Deterministe (meme seed = memes faux noms).
- **Hash (SHA-256)** : hash irreversible de la valeur. Utile pour les identifiants uniques qui doivent rester joinables mais non-lisibles.
- **Format-Preserving Encryption (FPE)** : chiffrement qui preserve le format (un email reste un email, un IBAN reste un IBAN). Reversible avec la cle. Utile pour les environnements de test fonctionnel.
- **Shuffle** : melange les valeurs au sein de la meme colonne. Les donnees sont reelles mais reassignees a d'autres lignes. Preserve la distribution statistique.
- **Null** : remplacement par NULL. Simple et definitif.
- **Generalization** : reduction de la precision. Age exact → tranche (25-30). Code postal 75015 → 750**. Date de naissance → annee seulement.

### 1.3 Creation d'une regle de masquage
Formulaire en 4 etapes :
1. **Cible** : selection de la table (autocomplete depuis le schema PostgreSQL) et de la colonne. Affichage du type de donnee (VARCHAR, TEXT, INTEGER, etc.) et d'un echantillon de 5 valeurs reelles.
2. **Strategie** : choix de la strategie avec preview en temps reel. Pour Faker : choix du locale et de la categorie (name, email, phone, address, company). Pour Partial : configuration du pattern de masquage.
3. **Environnements** : selection des environnements cibles (dev, staging, test, custom). Production est exclu par defaut avec warning explicite si l'utilisateur tente de l'ajouter.
4. **Validation** : dry-run sur 100 lignes avec comparaison avant/apres. Verification que les FK sont preservees si la strategie est deterministe.

### 1.4 Preview et dry-run
Avant d'activer une regle, le systeme affiche un apercu sur un echantillon de donnees reelles (10 lignes par defaut). Tableau a 3 colonnes : valeur originale, valeur masquee, statut (OK/warning). Warnings si : la valeur masquee est identique a l'originale, le format est casse, ou la FK pointe vers une valeur inexistante.

### 1.5 Execution du masquage
Deux modes :
- **Batch** : masquage de toutes les lignes d'une table en une execution. Progression (N/M lignes, ETA). Transaction atomique : rollback complet si erreur.
- **Clone & Mask** : creation d'une copie de la base, application du masquage sur la copie. La base originale reste intacte. Utile pour generer un dump de test.

### 1.6 Integrite referentielle
Le systeme detecte automatiquement les contraintes FK entre tables. Si la colonne `users.email` est masquee, toutes les tables referencant `users.id` sont coherentes. Si une colonne est referencee par FK, le masquage utilise une strategie deterministe (meme input = meme output) pour preserver les jointures.

### 1.7 Regles pre-configurees
Templates pour les cas courants :
- **Email** : Partial (`j***n@domain.com`) ou Faker (`alice.martin@fake.test`)
- **Telephone** : Partial (`06 ** ** ** 42`) ou Faker (`+33 6 12 34 56 78`)
- **Mot de passe hash** : Redact (`[REDACTED]`) — le hash n'est pas une donnee utile en test
- **Nom/Prenom** : Faker (`Jean Dupont` → `Pierre Martin`)
- **Adresse** : Faker (adresse complete fictive)
- **IBAN** : FPE (format preserve, valeur chiffree)
- **Numero de securite sociale** : Partial (`1 ** ** ** *** ** **`)

### 1.8 Edition et suppression de regle
Modification d'une regle existante : changement de strategie, d'environnement. La modification ne s'applique pas retroactivement aux donnees deja masquees (il faut relancer le masquage). Suppression avec confirmation. Historique des modifications.

### 1.9 Import/export de regles
Export JSON de toutes les regles de masquage. Import depuis un fichier JSON pour appliquer les memes regles sur une autre instance. Utile pour synchroniser les regles entre equipes.

---

## Categorie 2 — Detection PII (PII Detector)

### 2.1 Scan automatique du schema
Le PII Detector analyse le schema PostgreSQL (tables, colonnes, types) et detecte les colonnes susceptibles de contenir des PII via :
- **Heuristiques de nommage** : colonnes nommees `email`, `phone`, `name`, `first_name`, `last_name`, `address`, `ssn`, `iban`, `birth_date`, `password`, `ip_address`, etc.
- **Pattern matching regex** : scan des valeurs (echantillon de 100 lignes) pour detecter les patterns email, telephone, carte bancaire, numero de secu, IBAN, adresse IP, UUID associe a un utilisateur.
- **Classification ML** (optionnel, via signapps-ai) : classification automatique du type de PII par modele NLP.

### 2.2 Rapport de scan
Tableau des colonnes detectees : table, colonne, type de PII detecte (email, phone, name, address, financial, health, identifier), niveau de confiance (high/medium/low), nombre de lignes, statut de masquage (masque/non-masque/partiellement masque). Filtres par type de PII, par table, par statut.

### 2.3 Scan incremental
Le scan ne reanalyse que les tables modifiees depuis le dernier scan (detection via `pg_stat_user_tables.last_analyze` ou triggers). Planification automatique : quotidien, hebdomadaire, ou sur chaque migration SQL.

### 2.4 Scan a la demande
Bouton `Scan Now` pour lancer un scan immediat. Selection optionnelle des tables a scanner (ou toutes). Barre de progression avec nombre de tables analysees.

### 2.5 Alertes PII non-masquee
Si le scan detecte une colonne PII sans regle de masquage associee, une alerte est generee. Notification au DPO (via module Notifications). Badge rouge sur l'onglet PII Detector tant que des colonnes non-masquees existent.

### 2.6 Historique des scans
Journal des scans executes : date, duree, nombre de tables analysees, nombre de colonnes PII detectees, nouvelles detections, colonnes resolues. Graphique d'evolution du nombre de colonnes PII non-masquees dans le temps.

### 2.7 Exclusions
Liste des colonnes exclues du scan PII (faux positifs). Par exemple, une colonne `email_template` qui contient des templates HTML, pas des emails reels. Chaque exclusion est documentee avec la raison.

### 2.8 Integration avec le masquage
Depuis le rapport de scan, bouton `Create Rule` sur chaque colonne PII detectee. Pre-remplit le formulaire de creation de regle avec la table, la colonne et une strategie suggeree basee sur le type de PII.

---

## Categorie 3 — Suppression GDPR (GDPR Deletion)

### 3.1 Workflow de suppression guidee
Assistant en 5 etapes pour traiter une demande de droit a l'effacement (article 17 RGPD) :
1. **Identification** : saisir l'identifiant de la personne (email, user_id, ou recherche). Le systeme affiche le profil trouve avec les donnees associees.
2. **Cartographie** : le systeme scanne toutes les tables contenant des donnees de cette personne (via FK depuis `users.id`, colonnes `user_id`, `created_by`, `owner_id`, etc.). Affichage de l'arbre des dependances.
3. **Plan de suppression** : generation automatique du plan listant chaque table, le nombre de lignes a supprimer, et le type d'action (DELETE, anonymize, retain pour obligation legale). L'admin peut modifier le plan.
4. **Execution** : execution du plan dans une transaction. Barre de progression. Chaque suppression est loguee dans l'audit trail.
5. **Confirmation** : rapport de suppression avec preuve (tables, lignes supprimees, timestamp). Export PDF pour le demandeur.

### 3.2 Detection automatique des dependances
Le systeme analyse les contraintes FK, les colonnes nommees `user_id`, `created_by`, `owner_id`, `assigned_to`, `shared_with`, et les tables de jointure pour construire l'arbre complet des donnees d'un utilisateur. Chaque branche est annotee avec le nombre de lignes.

### 3.3 Exceptions de retention
Certaines donnees ne peuvent pas etre supprimees pour des raisons legales :
- **Factures** : retention obligatoire 10 ans (article L123-22 du Code de commerce)
- **Logs de connexion** : retention 1 an (article 34-1 CPCE)
- **Contrats** : retention pendant la duree de prescription
Le systeme identifie automatiquement ces cas et propose l'anonymisation au lieu de la suppression. Les champs personnels (nom, email) sont anonymises, les montants et dates sont conserves.

### 3.4 Anonymisation au lieu de la suppression
Pour les donnees soumises a retention legale, le workflow propose l'anonymisation : remplacement du nom par `Utilisateur anonyme #HASH`, suppression de l'email, du telephone, de l'adresse. Les donnees transactionnelles (montants, dates, references) sont conservees.

### 3.5 Demandes DSAR (Data Subject Access Request)
Gestion des demandes d'acces aux donnees (article 15 RGPD) :
- Collecte de toutes les donnees d'un utilisateur dans un export JSON/CSV
- Categorisation par type (identite, activite, transactions, communications)
- Generation d'un rapport lisible (PDF) pour le demandeur
- Delai legal : 30 jours. Timer visible avec alertes a 15j et 25j.

### 3.6 File d'attente des demandes
Liste des demandes GDPR en cours : type (deletion, access, rectification, portability), demandeur, date de reception, deadline, statut (pending, in_progress, completed, rejected), assignee. Filtres par type, statut, deadline.

### 3.7 Suppression en masse
Pour les campagnes de nettoyage : selection de criteres (comptes inactifs depuis > 2 ans, comptes supprimes, etc.), generation du plan global, validation par l'admin, execution avec rapport.

### 3.8 Verification post-suppression
Apres l'execution d'une suppression, le systeme lance un scan de verification :
- Recherche de l'email/user_id dans toutes les tables
- Verification que les donnees sont effectivement supprimees ou anonymisees
- Rapport de verification avec statut (clean/residual_data_found)

### 3.9 Portabilite des donnees (article 20)
Export des donnees d'un utilisateur dans un format structure, couramment utilise et lisible par machine (JSON, CSV). Le package inclut : profil, fichiers, messages, contacts, calendrier, taches. Archive ZIP telechargeale.

---

## Categorie 4 — Anonymisation

### 4.1 Jeux de donnees anonymises
Creation de datasets anonymises pour l'analytique et le machine learning. Selection des tables sources, configuration des transformations par colonne, generation du dataset anonymise dans une table ou un export CSV.

### 4.2 Techniques d'anonymisation
- **Suppression** : retrait complet des colonnes PII (nom, email, telephone)
- **Generalisation** : reduction de precision (age exact → tranche d'age, ville → region, date → mois/annee)
- **Perturbation** : ajout de bruit aleatoire aux valeurs numeriques (salaire ± 10%, coordonnees GPS ± 500m)
- **K-anonymite** : chaque combinaison de quasi-identifiants (age, genre, code postal) apparait au moins K fois dans le dataset. Parametre K configurable (defaut : 5).
- **L-diversite** : dans chaque groupe K-anonyme, l'attribut sensible a au moins L valeurs distinctes
- **Differential privacy** : ajout de bruit calibre (mecanisme de Laplace) pour garantir qu'aucune ligne individuelle ne peut etre re-identifiee

### 4.3 Validation de l'anonymisation
Apres generation, le systeme verifie :
- Qu'aucune valeur PII brute ne subsiste dans le dataset
- Que le critere de K-anonymite est respecte (si configure)
- Que les distributions statistiques sont preservees (ecart < seuil configurable)
Rapport de validation avec score de qualite et alertes.

### 4.4 Preview du dataset anonymise
Avant l'export, affichage d'un echantillon de 50 lignes du dataset anonymise. Comparaison cote a cote avec les donnees originales (si l'utilisateur a les droits).

### 4.5 Export et scheduling
Export ponctuel (CSV, Parquet, JSON) ou planifie (cron). Destination : fichier local, stockage SignApps (module Drive), ou table PostgreSQL dediee. Historique des exports avec taille et checksum.

### 4.6 Anonymisation en streaming
Pour les gros datasets (> 1M lignes) : traitement par batch avec streaming. Progression en temps reel. Resume en cas d'interruption.

---

## Categorie 5 — Dashboard et reporting

### 5.1 Vue d'ensemble
Dashboard avec 4 cartes KPI :
- **PII Fields Detected** : nombre total de colonnes PII identifiees par le scanner
- **Masked Fields** : nombre de colonnes avec une regle de masquage active
- **GDPR Requests** : nombre de demandes GDPR en cours (avec deadline < 7j en rouge)
- **Anonymized Datasets** : nombre de datasets anonymises generes

### 5.2 Couverture PII
Graphique circulaire (ou barre de progression) montrant le ratio colonnes masquees / colonnes PII detectees. Objectif : 100%. Clic affiche la liste des colonnes non-masquees.

### 5.3 Timeline des operations
Chronologie des operations recentes : scans PII, regles de masquage creees, suppressions GDPR executees, datasets anonymises. Filtre par type d'operation et par date.

### 5.4 Rapport de conformite RGPD
Rapport auto-genere resumant :
- Registre des traitements de donnees personnelles detectes
- Couverture du masquage par environnement
- Demandes GDPR traitees (nombre, delai moyen, taux de conformite au delai de 30j)
- Colonnes PII non-masquees (alerte)
Export PDF pour transmission au DPO ou aux autorites.

### 5.5 Metriques Prometheus
Export des metriques pour le module signapps-metrics (port 3008) :
- `data_mgmt_pii_columns_total` — nombre de colonnes PII detectees
- `data_mgmt_masked_columns_total` — nombre de colonnes masquees
- `data_mgmt_gdpr_requests_pending` — demandes GDPR en attente
- `data_mgmt_gdpr_requests_overdue` — demandes GDPR en depassement de delai
- `data_mgmt_anonymization_rows_processed` — lignes anonymisees
- `data_mgmt_last_scan_timestamp` — timestamp du dernier scan PII

---

## Categorie 6 — Configuration et RBAC

### 6.1 Roles et permissions
Integration avec signapps-identity (RBAC) :
- **data-admin** : acces complet (regles, scans, suppressions, anonymisation, configuration)
- **dpo** : acces lecture + validation des suppressions GDPR + rapports de conformite
- **data-operator** : execution des masquages et anonymisations, pas de suppression GDPR
- **data-viewer** : consultation des rapports et dashboards uniquement

### 6.2 Configuration des environnements
Definition des environnements disponibles pour le masquage : nom (dev, staging, test, custom), connexion PostgreSQL, indicateur production (boolean, non-masquable par defaut). Validation que la connexion de production ne peut pas etre ciblee par le masquage.

### 6.3 Configuration du scanner PII
Parametres du scanner :
- Taille d'echantillon par table (defaut : 100 lignes)
- Seuil de confiance minimum pour la detection (defaut : 0.7)
- Patterns regex personnalises (ex: numero interne `EMP-XXXXX`)
- Colonnes a exclure globalement (`id`, `created_at`, `updated_at`)

### 6.4 Webhook et integration
Envoi de webhooks sur les evenements :
- Nouvelle colonne PII detectee (non-masquee)
- Suppression GDPR executee
- Demande GDPR en depassement de delai
Integration avec les modules Notifications et Mail pour les alertes.

### 6.5 Retention des logs d'audit
Politique de retention configurable : 1 an, 3 ans, 5 ans, illimite. Les logs d'audit des operations GDPR sont conserves au minimum 3 ans (preuve de conformite). Archivage automatique des logs anciens.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Delphix Documentation** (docs.delphix.com) — masquage dynamique, profiling, algorithmes, integrite referentielle.
- **PostgreSQL Anonymizer Documentation** (postgresql-anonymizer.readthedocs.io) — masquage declaratif SQL, strategies, K-anonymite, generalisation.
- **Tonic.ai Documentation** (docs.tonic.ai) — generation de donnees synthetiques, subsetting, referential integrity.
- **CNIL Guides RGPD** (cnil.fr/fr/rgpd-de-quoi-parle-t-on) — obligations legales, droits des personnes, registre des traitements.
- **ICO GDPR Guide** (ico.org.uk/for-organisations/guide-to-data-protection) — right to erasure, data portability, DSAR.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **PostgreSQL Anonymizer** (gitlab.com/dalibo/postgresql_anonymizer) | **PostgreSQL License** (permissive) | Masquage declaratif via labels SQL, strategies (partial, random, faker, shuffle, generalization), K-anonymite. Reference principale. |
| **ARX** (github.com/arx-deidentify/arx) | **Apache-2.0** | Anonymisation K-anonymite, L-diversite, T-closeness, differential privacy. Algorithmes de reference pour la categorie 4. |
| **Faker** (github.com/faker-js/faker) | **MIT** | Generation de donnees fictives realistes (noms, emails, telephones, adresses) en 50+ locales. Pattern pour la strategie Faker. |
| **fake-rs** (github.com/cksac/fake-rs) | **MIT/Apache-2.0** | Generation de fausses donnees en Rust. Locales, types structures, derive macro. Integration native. |
| **opendp** (github.com/opendp/opendp) | **MIT** | Framework differential privacy. Mecanismes de Laplace, Gaussian, composition. Pattern pour l'anonymisation DP. |
| **presidio** (github.com/microsoft/presidio) | **MIT** | Detection et anonymisation de PII par NLP (spaCy). Recognizers pour email, phone, SSN, credit card, IBAN. Pattern pour le PII Detector. |
| **piicatcher** (github.com/tokern/piicatcher) | **Apache-2.0** | Scanner de PII dans les bases de donnees. Detection par metadata (noms de colonnes) et par contenu (regex). Pattern pour le scan de schema. |
| **sqlx** (github.com/launchbadge/sqlx) | **MIT/Apache-2.0** | Deja utilise dans SignApps. Acces PostgreSQL async pour les operations de masquage et suppression. |

### Pattern d'implementation recommande
1. **Scanner PII** : query `information_schema.columns` pour les heuristiques de nommage. Echantillonnage via `SELECT colonne FROM table TABLESAMPLE SYSTEM(1)` pour le pattern matching.
2. **Masquage** : implementation comme une fonction SQL par strategie. Execution via `UPDATE table SET colonne = mask_function(colonne)` dans une transaction.
3. **GDPR Deletion** : construction du graphe de dependances via `pg_constraint` (FK). Suppression en ordre topologique inverse (feuilles d'abord).
4. **Anonymisation** : pipeline streaming via `COPY ... TO PROGRAM` ou curseurs serveur pour les gros volumes.
5. **Audit** : table `data_management_audit_log` avec colonnes `id, operation, operator_id, target_table, target_column, rows_affected, details_jsonb, created_at`. Index sur `created_at` et `operation`.

### Ce qu'il ne faut PAS faire
- **Pas de masquage en production** — le masquage ne cible que les environnements non-prod. Tout ciblage production requiert une validation explicite a 2 niveaux.
- **Pas de suppression sans audit trail** — chaque ligne supprimee est tracee.
- **Pas de copier-coller** depuis les projets ci-dessus. On s'inspire des patterns, on reecrit.
- **Pas de dependance GPL/AGPL** — meme comme dependance transitive.
- **Pas de re-identification** — les datasets anonymises ne doivent jamais etre croises avec des donnees nominatives.
- **Pas de masquage reversible sans cle** — si FPE est utilise, la cle est stockee dans le vault SignApps uniquement.

---

## Assertions E2E cles (a tester)

- Navigation vers `/data-management` → le titre "Data Management" et la description s'affichent
- Onglet Masking → le tableau des regles actives s'affiche avec les colonnes (table, field, strategy, preview, environments)
- Bouton `Add Rule` → le formulaire de creation en 4 etapes s'ouvre
- Creation d'une regle Partial sur `users.email` → la regle apparait dans le tableau avec preview (`j***n@example.com`)
- Creation d'une regle Faker sur `contacts.phone` → preview affiche un numero fictif realiste
- Creation d'une regle Redact sur `staging.password_hash` → preview affiche `[REDACTED]`
- Dry-run d'une regle → le tableau avant/apres s'affiche avec 10 lignes
- Execution batch du masquage → barre de progression puis statut OK
- Compteur affiche "N fields masked — PII protected in non-production environments"
- Onglet PII Detector → bouton `Scan Now` lance un scan et affiche les resultats
- Scan detecte les colonnes `email`, `phone`, `name` avec confiance high
- Colonnes PII non-masquees affichent un badge d'alerte rouge
- Bouton `Create Rule` depuis le rapport PII → pre-remplit le formulaire de masquage
- Onglet GDPR Deletion → le workflow en 5 etapes s'affiche
- Recherche d'un utilisateur par email → affichage de la cartographie des donnees
- Generation du plan de suppression → liste des tables avec nombre de lignes
- Execution de la suppression → rapport de confirmation avec preuve
- Verification post-suppression → statut "clean" (aucune donnee residuelle)
- Onglet Anonymization → creation d'un dataset anonymise depuis une table source
- Preview du dataset anonymise → 50 lignes affichees sans PII
- Export CSV du dataset anonymise → fichier telecharge
- Dashboard KPIs → les 4 cartes affichent des valeurs coherentes
- Rapport de conformite RGPD → export PDF avec toutes les sections
- RBAC : un data-viewer ne peut pas creer de regle ni lancer de suppression
- RBAC : un dpo peut valider les suppressions GDPR mais pas creer de regles de masquage
