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
Ecran principal avec tableau des regles actives. Colonnes : table PostgreSQL cible, colonne, type de donnee (VARCHAR, TEXT, INTEGER, etc.), strategie de masquage (icone + label), preview du resultat (valeur originale → valeur masquee), environnements d'application (badges dev/staging/test), statut (toggle actif/inactif avec animation slide), date de creation, dernier masquage execute. Compteur en haut : "N champs masques — PII protege dans les environnements non-production". Bouton `+ Add Rule` en haut a droite avec icone shield. Barre de recherche pour filtrer par nom de table ou de colonne. Tri par table (A-Z), date de creation (recent d'abord), strategie. Pagination avec 25 regles par page et scroll infini en alternative.

### 1.2 Strategies de masquage disponibles
Chaque regle definit une strategie parmi 8 options. L'interface affiche un panneau de selection en grille (4 colonnes x 2 lignes) avec pour chaque strategie : icone, nom, description courte, et un exemple avant/apres en temps reel base sur la valeur echantillon de la colonne selectionnee.

- **Partial** : masquage partiel preservant le format. Configuration UI : slider pour le nombre de caracteres visibles au debut et a la fin, caractere de remplacement (defaut `*`). Preview en direct quand l'utilisateur deplace les sliders. Exemples par type : Email `j***n@example.com` (premier/dernier caractere + domaine complet). Telephone `06 ** ** ** 42` (2 premiers + 2 derniers chiffres). Carte bancaire `**** **** **** 1234` (4 derniers chiffres). IBAN `FR** **** **** **** **** ***8 901`. Le format est detecte automatiquement selon le type de colonne et un echantillon de valeurs.

- **Redact** : remplacement par une valeur fixe. Configuration UI : champ texte libre pour la valeur de remplacement avec presets (boutons : `[REDACTED]`, `***`, `000-00-0000`, `N/A`, custom). Toggle "Conserver la longueur" qui remplace chaque caractere individuellement par le caractere de masquage plutot qu'une valeur fixe. Preview : `John Smith` → `[REDACTED]` ou `**********`.

- **Faker realistic** : generation de donnees fictives realistes preservant le type et le format. Configuration UI : dropdown de categorie (name, email, phone, address, company, username, date_of_birth, credit_card, iban, ssn, city, country, job_title, sentence, paragraph). Dropdown de locale (fr_FR, en_US, de_DE, es_ES, it_IT, pt_BR, ja_JP, zh_CN — 15 locales supportees). Champ seed (entier, defaut : 42) pour le determinisme — meme seed = memes faux noms a chaque execution. Bouton `Regenerate` pour pre-visualiser avec un autre seed. Preview : `Jean Dupont` → `Pierre Martin` (avec seed 42), `alice@corp.com` → `marie.lefevre@fake.test`.

- **Hash (SHA-256)** : hash irreversible de la valeur. Configuration UI : toggle "Tronquer" avec longueur (defaut : 16 caracteres du hash pour la lisibilite). Toggle "Prefixe" pour ajouter un prefixe identifiant le type (ex: `USR-a1b2c3d4`). Toggle "Salt" avec champ salt personnalise (defaut : cle generee automatiquement, stockee dans le vault). Preview : `john@example.com` → `a1b2c3d4e5f6g7h8` ou `USR-a1b2c3d4`. Utile pour les identifiants uniques qui doivent rester joinables mais non-lisibles.

- **Format-Preserving Encryption (FPE)** : chiffrement qui preserve le format (un email reste un email valide, un IBAN reste un IBAN valide, un telephone reste un telephone valide). Configuration UI : dropdown d'algorithme (FF1, FF3-1 — standards NIST SP 800-38G). Champ cle de chiffrement (generee automatiquement, stockee dans le vault, rotable). Toggle "Tweak" avec champ tweak optionnel pour diversifier le chiffrement par contexte. Warning : "Ce masquage est reversible avec la cle. Utilisez-le uniquement si vous avez besoin de dechiffrer en environnement de test." Preview : `FR7630006000011234567890189` → `FR7612345678901234567890456`.

- **Shuffle** : melange les valeurs au sein de la meme colonne. Les donnees sont reelles mais reassignees a d'autres lignes. Configuration UI : dropdown de scope (toute la table, par partition — utile si une colonne `department_id` doit garder les noms dans le meme departement). Toggle "Deterministe" (meme seed = meme shuffle a chaque execution). Warning : "Ne convient pas si le nombre de valeurs distinctes est faible (< 10) — la re-identification est triviale." Preview : tableau de 5 lignes montrant les valeurs originales a gauche et les valeurs shufflees a droite avec des fleches croisees.

- **Null** : remplacement par NULL. Configuration UI : toggle "Nullable check" qui verifie si la colonne accepte NULL (si NOT NULL, le masquage echoue avec message d'erreur clair). Toggle "Valeur par defaut" avec champ alternatif si la colonne est NOT NULL (ex: chaine vide `""`, 0 pour integer). Preview : `john@example.com` → `NULL`. Simple et definitif.

- **Generalization** : reduction de la precision. Configuration UI specifique au type de donnee detecte. Pour les ages : dropdown de taille de tranche (5, 10, 20 ans). Pour les codes postaux : slider du nombre de chiffres masques (1 a 4). Pour les dates : dropdown de precision (annee, mois, trimestre). Pour les montants : dropdown d'arrondi (dizaine, centaine, millier). Preview adaptative : `27 ans` → `25-30`, `75015` → `750**`, `1990-06-15` → `1990`, `47 352 EUR` → `47 000 EUR`.

### 1.3 Creation d'une regle de masquage
Formulaire en 4 etapes avec stepper horizontal en haut (etapes numerotees, etape active en bleu, etapes completees avec checkmark vert). Boutons `Precedent` et `Suivant` en bas. `Annuler` ferme le formulaire avec confirmation si des modifications ont ete faites.

**Etape 1 — Cible** : dropdown de selection de la table (autocomplete avec recherche, liste populee par `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`). A la selection de la table, un second dropdown affiche les colonnes (`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1`). A la selection de la colonne : affichage du type de donnee (VARCHAR(255), TEXT, INTEGER, TIMESTAMP, etc.), de la contrainte nullable (YES/NO), et d'un echantillon de 5 valeurs reelles (query : `SELECT DISTINCT colonne FROM table LIMIT 5`). Si la colonne a une contrainte FK, un badge "Foreign Key → table.colonne" est affiche avec un tooltip expliquant l'impact sur l'integrite referentielle.

**Etape 2 — Strategie** : grille des 8 strategies (voir 1.2). Clic sur une strategie la selectionne et affiche son panneau de configuration a droite. En bas du panneau, preview en temps reel sur les 5 valeurs echantillons de l'etape 1. Chaque modification de configuration met a jour la preview instantanement (debounce 200ms). Si la strategie est incompatible avec le type de donnee (ex: Partial sur un INTEGER), un warning orange est affiche : "Cette strategie est concue pour les chaines de caracteres. Resultats imprevisibles sur INTEGER."

**Etape 3 — Environnements** : liste de checkboxes des environnements cibles (dev, staging, test, custom). Chaque environnement affiche son label, sa connexion PostgreSQL tronquee (host:port/db), et un badge colore (vert=non-production, rouge=production). L'environnement Production est affiche en grise avec un cadenas et un tooltip : "Le masquage en production est interdit par la politique de securite." Si l'utilisateur tente de cocher Production : modal de warning avec texte en rouge : "Le masquage en production peut entrainer une perte de donnees irreversible. Cette action necessite l'approbation de deux administrateurs." Le bouton de confirmation est desactive par defaut — il ne s'active qu'apres une saisie manuelle de "CONFIRMER" dans un champ texte.

**Etape 4 — Validation** : dry-run automatique sur 100 lignes. Tableau a 3 colonnes : valeur originale, valeur masquee, statut (icone checkmark vert pour OK, icone warning orange, icone erreur rouge). Compteurs en haut : "98 OK, 2 warnings, 0 erreurs". Warnings possibles : la valeur masquee est identique a l'originale (ex: NULL masque en NULL), le format est casse (email masque non-valide), la FK pointe vers une valeur inexistante apres masquage. Erreurs possibles : type incompatible, depassement de longueur de colonne. Bouton `Creer la regle` (actif uniquement si 0 erreurs). Bouton `Creer quand meme` (avec warning) si seulement des warnings existent.

### 1.4 Preview et dry-run
Accessible depuis la liste des regles via un bouton `Preview` sur chaque regle. Affiche un tableau de 10 lignes (configurable : 10, 25, 50, 100) avec 3 colonnes : valeur originale, valeur masquee, statut. Le dry-run ne modifie aucune donnee — il execute le masquage en memoire et retourne les resultats. Temps d'execution affiche en bas ("Dry-run complete en 0.23s sur 100 lignes"). Bouton `Exporter en CSV` pour telecharger le comparatif.

### 1.5 Execution du masquage
Deux modes accessibles depuis un bouton `Execute` avec dropdown :

- **Batch** : masquage de toutes les lignes d'une table en une execution. Confirmation modale avec resume : table, colonne, strategie, nombre de lignes estimees, environnement cible. Barre de progression (N/M lignes, pourcentage, ETA estimee). Transaction atomique : rollback complet si une erreur survient a n'importe quelle ligne. Notification toast a la fin : "Masquage termine : 150 000 lignes traitees en 12.3s" (vert) ou "Masquage echoue : rollback effectue. Erreur a la ligne 45 012 : depassement de longueur" (rouge). Log detaille dans l'audit trail.

- **Clone & Mask** : creation d'une copie de la base, application du masquage sur la copie. Etapes affichees : 1) Clonage du schema (CREATE TABLE ... AS SELECT ...), 2) Application des regles de masquage, 3) Verification d'integrite. La base originale reste intacte. Bouton `Telecharger le dump` pour generer un pg_dump de la base clonee masquee. Utile pour distribuer un jeu de donnees de test.

### 1.6 Integrite referentielle
Le systeme detecte automatiquement les contraintes FK entre tables via `SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY'`. Si la colonne `users.email` est masquee, toutes les tables referencant `users.id` restent coherentes car l'id n'est pas masque. Si une colonne referencee par FK est masquee (rare mais possible), le systeme force une strategie deterministe (meme input = meme output) pour preserver les jointures. Un graphe de dependances est affiche dans l'UI : noeuds = tables, aretes = FK, colonnes masquees en surbrillance.

### 1.7 Regles pre-configurees
Templates accessibles via un bouton `Use Template` dans le formulaire de creation. Selection dans une grille de 9 cartes :
- **Email** : Partial (`j***n@domain.com`) ou Faker (`alice.martin@fake.test`)
- **Telephone** : Partial (`06 ** ** ** 42`) ou Faker (`+33 6 12 34 56 78`)
- **Mot de passe hash** : Redact (`[REDACTED]`) — le hash n'est pas une donnee utile en test
- **Nom/Prenom** : Faker (`Jean Dupont` → `Pierre Martin`)
- **Adresse** : Faker (adresse complete fictive avec numero, rue, ville, code postal)
- **IBAN** : FPE (format preserve, valeur chiffree, cle dans le vault)
- **Numero de securite sociale** : Partial (`1 ** ** ** *** ** **`)
- **Date de naissance** : Generalization (annee seule : `1990-06-15` → `1990`)
- **Adresse IP** : Partial (`192.168.*.*`) ou Null

Chaque template pre-remplit toutes les etapes du formulaire. L'utilisateur peut modifier avant de sauvegarder.

### 1.8 Edition et suppression de regle
Modification d'une regle existante : clic sur la ligne dans le tableau ou bouton `Edit`. Meme formulaire en 4 etapes, pre-rempli. Changement de strategie, d'environnement, de configuration. Warning : "La modification ne s'applique pas retroactivement aux donnees deja masquees. Il faut relancer le masquage pour appliquer la nouvelle strategie." Suppression via bouton `Delete` avec modal de confirmation : "Supprimer la regle de masquage sur users.email (Partial) ? Les donnees deja masquees ne seront pas restaurees." Historique des modifications accessible via un onglet `History` sur chaque regle : date, operateur, changement (strategie changee de Partial a Faker, environnement ajoute staging).

### 1.9 Import/export de regles
Export JSON de toutes les regles de masquage. Bouton `Export Rules` en haut de la liste → telecharge un fichier `masking-rules-YYYY-MM-DD.json` contenant la definition de chaque regle (table, colonne, strategie, configuration, environnements) mais pas les cles de chiffrement (celles-ci restent dans le vault). Import via bouton `Import Rules` → upload du fichier JSON, validation du schema, preview des regles qui seront creees (avec diff si des regles existent deja pour les memes colonnes), bouton `Importer N regles`. Utile pour synchroniser les regles entre equipes ou entre instances.

---

## Categorie 2 — Detection PII (PII Detector)

### 2.1 Scan automatique du schema
Le PII Detector analyse le schema PostgreSQL (tables, colonnes, types) et detecte les colonnes susceptibles de contenir des PII via trois mecanismes complementaires :

- **Heuristiques de nommage** : colonnes nommees `email`, `e_mail`, `mail`, `phone`, `telephone`, `mobile`, `name`, `first_name`, `last_name`, `full_name`, `surname`, `address`, `street`, `city`, `zip`, `postal_code`, `ssn`, `social_security`, `iban`, `bank_account`, `credit_card`, `card_number`, `birth_date`, `date_of_birth`, `dob`, `password`, `passwd`, `ip_address`, `ip`, `gender`, `nationality`, `passport`, `driver_license`. Matching insensible a la casse et aux separateurs (`firstName`, `first_name`, `FIRSTNAME` tous detectes). Score de confiance : 0.9 pour les noms exacts, 0.7 pour les noms partiels (ex: `user_addr` contient `addr`).

- **Pattern matching regex** : scan d'un echantillon de valeurs (100 lignes par defaut, configurable) pour detecter les patterns. Regex integres : email (`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`), telephone international (`^\+?[0-9\s\-\.\(\)]{7,20}$`), carte bancaire (Luhn + prefixes Visa/MC/Amex), numero de secu francais (`^[12]\d{2}(0[1-9]|1[0-2])\d{2}\d{3}\d{3}\d{2}$`), IBAN (`^[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}$`), adresse IPv4 (`^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$`), UUID (`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`). Score de confiance : ratio de valeurs matchant le pattern (ex: 95/100 valeurs matchent un email → confiance 0.95).

- **Classification ML** (optionnel, via signapps-ai, port 3005) : classification automatique du type de PII par modele NLP. Analyse des valeurs en langage naturel pour detecter les noms propres, adresses, etc. Active uniquement si le module AI est disponible. Score de confiance fourni par le modele.

Le score final est le maximum des 3 mecanismes. Les colonnes avec score >= seuil (defaut 0.7) sont marquees comme PII.

### 2.2 Rapport de scan
Tableau des colonnes detectees avec colonnes : table, colonne, type PostgreSQL, type de PII detecte (icone + label : email, phone, name, address, financial, health, identifier, other), niveau de confiance (barre de progression coloree : vert >= 0.9, orange 0.7-0.9, rouge < 0.7 si force en manuel), nombre de lignes dans la table, statut de masquage (badge : "Masque" vert si regle active, "Non masque" rouge si aucune regle, "Partiellement masque" orange si regle inactive ou environnements manquants). Filtres en haut : dropdown type de PII (multi-select), dropdown table, dropdown statut de masquage. Compteur : "N colonnes PII detectees — M masquees — K non masquees". Les lignes non masquees sont mises en evidence avec fond rouge pale.

### 2.3 Scan incremental
Le scan ne reanalyse que les tables modifiees depuis le dernier scan. Detection via `pg_stat_user_tables.last_analyze` et `pg_stat_user_tables.n_mod_since_analyze`. Si une nouvelle table est creee ou une colonne ajoutee (detectable par comparaison du schema en cache), elle est automatiquement incluse dans le prochain scan. Planification configurable : dropdown dans les parametres avec options quotidien (02:00 UTC par defaut), hebdomadaire (dimanche 02:00), sur chaque migration SQL (detection via hook sur `sqlx migrate run`), ou desactive. Le dernier scan est affiche dans le header : "Dernier scan : il y a 3 heures — 45 tables analysees en 1.2s".

### 2.4 Scan a la demande
Bouton `Scan Now` en haut a droite de l'onglet PII Detector. Deux options dans le dropdown : "Scanner toutes les tables" ou "Scanner les tables selectionnees" (multi-select avec checkboxes). Barre de progression : "Analyse de la table users (12/45)..." avec nom de la table en cours. A la fin, notification toast : "Scan termine : 3 nouvelles colonnes PII detectees" (orange si nouvelles detections, vert si aucune nouvelle). Le rapport se met a jour en temps reel pendant le scan.

### 2.5 Alertes PII non masquee
Si le scan detecte une colonne PII sans regle de masquage associee :
- Badge rouge sur l'onglet PII Detector dans la navigation du module : "(3)" indiquant 3 colonnes non masquees.
- Notification au DPO via le module Notifications (port 8095) : "3 colonnes PII detectees sans masquage : users.phone, contacts.email, employees.ssn".
- Email recapitulatif hebdomadaire au DPO si des colonnes restent non masquees pendant plus de 7 jours.
- Banniere d'alerte en haut du Dashboard : "Attention : 3 colonnes PII ne sont pas protegees par le masquage" avec lien direct vers le rapport.

### 2.6 Historique des scans
Journal des scans executes : tableau avec colonnes date/heure, type (automatique/manuel), duree, nombre de tables analysees, nombre de colonnes PII detectees, nouvelles detections (badge vert "+2"), colonnes resolues (badge bleu "-1" si une regle a ete creee depuis le dernier scan). Graphique sparkline d'evolution du nombre de colonnes PII non masquees dans le temps (30 derniers jours). Clic sur une ligne de scan affiche le detail : liste des colonnes detectees a ce moment.

### 2.7 Exclusions
Liste des colonnes exclues du scan PII (faux positifs). Bouton `Exclude` dans le rapport de scan, a cote de chaque colonne detectee. Modal de confirmation avec champ obligatoire "Raison de l'exclusion" (texte libre, minimum 10 caracteres). Exemples de raisons valides : "email_template contient des templates HTML, pas des emails reels", "ip_pool est un pool d'adresses internes sans lien avec des personnes". Tableau des exclusions : table, colonne, raison, exclu par (utilisateur), date. Bouton `Re-inclure` pour annuler une exclusion.

### 2.8 Integration avec le masquage
Depuis le rapport de scan, bouton `Create Rule` sur chaque colonne PII detectee (icone bouclier + texte). Pre-remplit le formulaire de creation de regle avec : table (etape 1), colonne (etape 1), et strategie suggeree basee sur le type de PII (etape 2). Suggestions : email → Partial ou Faker, phone → Partial, name → Faker, address → Faker, ssn → Partial, iban → FPE, ip → Partial, birth_date → Generalization, password → Redact. L'utilisateur peut modifier la suggestion avant de valider.

### 2.9 Auto-suggest en masse
Bouton `Auto-suggest all` dans le rapport de scan. Genere des regles suggerees pour toutes les colonnes PII non masquees. Tableau de preview : table, colonne, strategie suggeree, option de modifier individuellement. Bouton `Create N rules` pour creer toutes les regles en un clic. Workflow rapide pour atteindre 100% de couverture.

---

## Categorie 3 — Suppression GDPR (GDPR Deletion)

### 3.1 Workflow de suppression guidee
Assistant en 5 etapes avec stepper vertical a gauche (icones numerotees, etape active mise en evidence, etapes completees avec checkmark). Chaque etape occupe le panneau principal.

**Etape 1 — Identification** : champ de recherche unifie (email, user_id, nom, telephone). Autocomplete avec debounce 300ms. Resultats affiches en dropdown avec avatar, nom, email, date de creation. Clic selectionne la personne. Affichage du profil complet : nom, email, telephone, date de creation, dernier login, statut (actif/inactif/supprime), nombre de ressources associees. Bouton `Suivant` active uniquement si une personne est selectionnee.

**Etape 2 — Cartographie** : le systeme scanne toutes les tables contenant des donnees de cette personne. Recherche via FK depuis `users.id`, et colonnes nommees `user_id`, `created_by`, `owner_id`, `assigned_to`, `shared_with`, `updated_by`, `deleted_by`. Affichage en arbre interactif (expandable tree ou graphe de dependances) : noeud racine = utilisateur, branches = tables, feuilles = nombre de lignes. Chaque noeud affiche : nom de la table, nombre de lignes, taille estimee, type d'action suggeree (delete/anonymize/retain). Compteur total : "42 tables impactees — 1 247 lignes — 3 tables en retention legale". Temps de scan affiche : "Cartographie terminee en 0.8s".

**Etape 3 — Plan de suppression** : generation automatique du plan sous forme de tableau. Colonnes : table, nombre de lignes, action (dropdown : DELETE, Anonymize, Retain), raison de retention (si Retain — texte pre-rempli : "Retention legale — factures 10 ans", "Retention legale — logs connexion 1 an"). L'admin peut modifier l'action par table : passer de DELETE a Anonymize, ou de Retain a DELETE (avec warning). Graphe de dependances visible en panneau lateral : ordre de suppression (feuilles d'abord, topological sort inverse). Si des tables ont des CASCADE constraints, le systeme les detecte et les inclut dans le plan. Bouton `Valider le plan` avec case a cocher : "Je confirme avoir verifie le plan de suppression et ses implications."

**Etape 4 — Execution** : execution du plan dans une transaction PostgreSQL unique. Barre de progression par table : "Suppression de orders (3/42)..." avec nombre de lignes traitees. En cas d'erreur : rollback complet, message d'erreur detaille (table, ligne, contrainte violee), bouton `Reessayer` ou `Modifier le plan`. Chaque suppression est loguee dans `data_management_audit_log` avec : operation=GDPR_DELETE, target_user_id, target_table, rows_deleted, timestamp. Duree totale affichee a la fin.

**Etape 5 — Confirmation** : rapport de suppression avec 4 sections. Section 1 : resume (utilisateur, date, operateur, duree). Section 2 : detail par table (lignes supprimees, lignes anonymisees, lignes conservees avec raison). Section 3 : verification post-suppression (voir 3.8). Section 4 : certificat de conformite. Bouton `Telecharger PDF` genere un document signe avec horodatage, logo SignApps, detail de l'operation, et signature numerique. Bouton `Envoyer au demandeur` envoie le certificat par email via le module Mail (port 3012).

### 3.2 Detection automatique des dependances
Le systeme analyse les contraintes FK via `pg_constraint`, les colonnes nommees `user_id`, `created_by`, `owner_id`, `assigned_to`, `shared_with`, et les tables de jointure (tables avec 2+ FK et peu de colonnes propres). Chaque branche de l'arbre est annotee avec le nombre de lignes et le type de donnee (transactionnel, activite, configuration, contenu). Les tables orphelines (pas de FK directe mais colonne `email` contenant l'email de l'utilisateur) sont detectees par cross-reference.

### 3.3 Exceptions de retention
Certaines donnees ne peuvent pas etre supprimees pour des raisons legales. Le systeme identifie automatiquement ces cas :
- **Factures** : tables `invoices`, `billing_*` — retention obligatoire 10 ans (article L123-22 du Code de commerce). Action : anonymisation (nom → "Utilisateur supprime", email → NULL) mais conservation des montants, dates, references.
- **Logs de connexion** : tables `auth_sessions`, `login_history` — retention 1 an (article 34-1 CPCE). Action : conservation 1 an puis suppression automatique.
- **Contrats** : tables `contracts`, `agreements` — retention pendant la duree de prescription (5 ans droit commun). Action : anonymisation apres expiration.
Le panneau "Retention Policies" dans les parametres permet de configurer les regles par table avec duree et action automatique.

### 3.4 Anonymisation au lieu de la suppression
Pour les donnees soumises a retention legale, le workflow propose l'anonymisation automatique :
- Nom → `Utilisateur anonyme #SHA256(user_id)[:8]` (ex: `Utilisateur anonyme #a1b2c3d4`)
- Email → NULL
- Telephone → NULL
- Adresse → NULL
- Les donnees transactionnelles (montants, dates, references, numeros de facture) sont conservees intactes.
Preview avant execution : tableau avant/apres pour chaque table anonymisee.

### 3.5 Demandes DSAR (Data Subject Access Request)
Gestion des demandes d'acces aux donnees (article 15 RGPD). Bouton `New DSAR Request` dans l'onglet GDPR Deletion.
- Collecte de toutes les donnees d'un utilisateur dans un export structure. Le systeme utilise la meme cartographie que l'etape 2 du workflow de suppression.
- Categorisation automatique par type : identite (nom, email, telephone), activite (logs, sessions), transactions (factures, paiements), communications (messages, emails), contenu (fichiers, documents), social (contacts, groupes).
- Generation d'un rapport lisible : export JSON brut pour la portabilite machine, export PDF formate pour la lisibilite humaine (sections par categorie, tableau des donnees, pagination).
- Delai legal : 30 jours. Timer visible sur chaque demande avec barre de progression temporelle. Alertes automatiques a 15 jours (notification orange) et 25 jours (notification rouge) envoyees au DPO.

### 3.6 File d'attente des demandes
Liste des demandes GDPR en cours. Tableau avec colonnes : type (badge : deletion, access, rectification, portability), demandeur (nom + email), date de reception, deadline (avec indicateur de couleur : vert > 15j, orange 7-15j, rouge < 7j, noir = depassee), statut (badges : pending, in_progress, completed, rejected), assignee (avatar + nom). Actions par ligne : assigner, traiter, completer, rejeter (avec motif obligatoire). Filtres par type, statut, deadline. Compteurs en haut : "3 en attente — 1 en depassement — 12 completees ce mois".

### 3.7 Suppression en masse
Pour les campagnes de nettoyage periodiques. Bouton `Bulk Deletion` dans l'onglet GDPR.
- Selection de criteres : comptes inactifs depuis > N mois (slider, defaut 24), comptes avec statut "deleted" depuis > N jours, comptes sans login depuis > N mois, comptes test (email contenant @test. ou @fake.).
- Estimation : "187 comptes matchent les criteres — 23 450 lignes dans 42 tables seront impactees."
- Generation du plan global (meme format que le workflow individuel mais pour N utilisateurs).
- Validation par l'admin avec double confirmation (saisie du nombre d'utilisateurs concernes).
- Execution avec rapport consolide.

### 3.8 Verification post-suppression
Apres l'execution d'une suppression, le systeme lance automatiquement un scan de verification :
- Recherche de l'email et du user_id dans toutes les tables (requetes `SELECT COUNT(*) FROM table WHERE colonne = $1` sur chaque table).
- Recherche de patterns dans les colonnes JSON/JSONB (scan des valeurs JSONB contenant l'email ou le nom).
- Rapport de verification avec 2 statuts possibles : "Clean" (icone checkmark vert, aucune donnee residuelle) ou "Residual Data Found" (icone warning rouge, liste des tables/colonnes ou des donnees subsistent avec action suggeree).

### 3.9 Portabilite des donnees (article 20)
Export des donnees d'un utilisateur dans un format structure, couramment utilise et lisible par machine.
- Formats : JSON (structure hierarchique), CSV (un fichier par table), ou les deux dans une archive ZIP.
- Contenu du package : profil (identite), fichiers (liste + metadata, pas les fichiers physiques sauf demande explicite), messages (email, chat), contacts (nom, email, telephone), calendrier (evenements), taches, documents (metadata + contenu texte).
- Taille estimee affichee avant generation. Pour les gros packages (> 100 MB), generation asynchrone avec notification par email quand le ZIP est pret a telecharger.
- Lien de telechargement valide 48 heures, protege par token a usage unique.

---

## Categorie 4 — Anonymisation

### 4.1 Jeux de donnees anonymises
Creation de datasets anonymises pour l'analytique et le machine learning. Ecran principal : liste des datasets generes avec colonnes nom, tables sources, nombre de lignes, taille, date de creation, statut (ready/generating/failed). Bouton `+ New Dataset`. Formulaire : nom du dataset, description, selection des tables sources (multi-select avec preview du schema), configuration des transformations par colonne (grille editable), format de sortie (table PostgreSQL, CSV, Parquet, JSON).

### 4.2 Techniques d'anonymisation
- **Suppression** : retrait complet des colonnes PII. Configuration : checkboxes des colonnes a supprimer. Le dataset final n'inclut pas ces colonnes.
- **Generalisation** : reduction de precision. Configuration par type : age exact → tranche d'age (taille configurable 5/10/20), ville → region, code postal → 2 premiers chiffres, date → mois/annee ou annee seule, salaire → tranche de 5000 EUR. Preview en temps reel.
- **Perturbation** : ajout de bruit aleatoire aux valeurs numeriques. Configuration : pourcentage de bruit (slider 1-50%, defaut 10%), distribution (uniforme ou gaussienne). Preview : `52 000 EUR` → `49 830 EUR` (±5%), coordonnees GPS ± 500m.
- **K-anonymite** : chaque combinaison de quasi-identifiants (age, genre, code postal) apparait au moins K fois dans le dataset. Configuration : selection des quasi-identifiants (checkboxes), valeur de K (input numerique, defaut 5, minimum 2). L'algorithme generalise progressivement les quasi-identifiants jusqu'a atteindre K. Indicateur visuel : "K=5 atteint — 98.2% des lignes conservees (1.8% supprimees car K impossible)."
- **L-diversite** : dans chaque groupe K-anonyme, l'attribut sensible a au moins L valeurs distinctes. Configuration : selection de l'attribut sensible (dropdown), valeur de L (defaut 3). Protege contre l'attaque par homogeneite.
- **Differential privacy** : ajout de bruit calibre (mecanisme de Laplace) pour garantir qu'aucune ligne individuelle ne peut etre re-identifiee. Configuration : parametre epsilon (slider 0.1 a 10, defaut 1.0 — plus petit = plus de bruit = plus de protection). Preview de l'impact sur la precision des statistiques : "Precision de la moyenne : ±2.3%".

### 4.3 Validation de l'anonymisation
Apres generation, le systeme verifie automatiquement :
- Qu'aucune valeur PII brute ne subsiste dans le dataset (re-scan PII sur le dataset genere).
- Que le critere de K-anonymite est respecte (si configure) : verification exhaustive de toutes les combinaisons de quasi-identifiants.
- Que les distributions statistiques sont preservees (ecart entre moyenne/mediane/ecart-type du dataset original et anonymise < seuil configurable, defaut 5%).
- Rapport de validation avec score de qualite global (0-100), detail par colonne, et alertes si un critere n'est pas respecte.

### 4.4 Preview du dataset anonymise
Avant l'export, affichage d'un echantillon de 50 lignes du dataset anonymise. Toggle "Comparaison" affiche un tableau split : donnees originales a gauche, donnees anonymisees a droite, avec diff highlighting (valeurs changees en bleu). Statistiques en bas : nombre de colonnes supprimees, colonnes generalisees, valeurs perturbees, K atteint.

### 4.5 Export et scheduling
Export ponctuel : bouton `Export` avec dropdown de format (CSV, Parquet, JSON). Destination : telechargement navigateur, stockage SignApps (module Drive, port 3004), ou table PostgreSQL dediee (nom configurable, schema `anonymized`). Export planifie : configuration cron (quotidien, hebdomadaire, mensuel) avec meme destination. Historique des exports : date, format, taille, checksum SHA-256, destination, statut (success/failed).

### 4.6 Anonymisation en streaming
Pour les gros datasets (> 1M lignes) : traitement par batch de 10 000 lignes avec streaming. Barre de progression en temps reel : "Traitement du batch 45/120 (375 000 / 1 200 000 lignes)". Resume en cas d'interruption : le systeme enregistre le dernier batch traite et reprend au batch suivant. Temps estime restant affiche. Annulation possible a tout moment (les batchs deja traites sont conserves si export vers table PostgreSQL).

---

## Categorie 5 — Dashboard et reporting

### 5.1 Vue d'ensemble
Dashboard principal du module, affiche par defaut a l'arrivee sur `/data-management`. 4 cartes KPI en haut, disposees en grille 4 colonnes sur desktop, 2x2 sur tablette, pile verticale sur mobile.

- **PII Fields Detected** : nombre total de colonnes PII identifiees par le scanner. Icone scanner. Sous-texte : "Dernier scan : il y a 3h". Clic → onglet PII Detector. Tendance : fleche haut/bas par rapport a la semaine precedente.
- **Masked Fields** : nombre de colonnes avec une regle de masquage active. Icone bouclier. Barre de progression sous le nombre : ratio masque/total (ex: "42/50 — 84%"). Couleur : vert si >= 90%, orange si 70-89%, rouge si < 70%.
- **GDPR Requests** : nombre de demandes GDPR en cours. Icone dossier. Sous-compteur en rouge si deadline < 7 jours : "(2 urgent)". Clic → onglet GDPR Deletion.
- **Anonymized Datasets** : nombre de datasets anonymises generes. Icone data. Sous-texte : taille totale des datasets. Clic → onglet Anonymization.

### 5.2 Couverture PII
Graphique circulaire (donut chart) montrant le ratio colonnes masquees / colonnes PII detectees. Segment vert = masquees, segment rouge = non masquees. Pourcentage central en gros : "84%". Objectif affiche : "Objectif : 100%". Clic sur le segment rouge affiche la liste des colonnes non masquees dans un drawer lateral avec bouton `Create Rule` sur chaque ligne.

### 5.3 Timeline des operations
Chronologie verticale des 20 operations recentes. Chaque evenement avec : icone de type (scan, masquage, suppression, anonymisation), timestamp relatif ("il y a 2h"), description ("Scan PII : 3 nouvelles colonnes detectees"), operateur (avatar + nom). Filtre par type d'operation (multi-select) et par date (date range picker). Bouton `Voir tout` → page dediee avec pagination.

### 5.4 Rapport de conformite RGPD
Rapport auto-genere accessible via bouton `Generate Report`. Sections :
- Registre des traitements de donnees personnelles detectes (tables, colonnes, types de PII).
- Couverture du masquage par environnement (dev : 100%, staging : 84%, test : 92%).
- Demandes GDPR traitees ce trimestre (nombre, delai moyen en jours, taux de conformite au delai de 30 jours).
- Colonnes PII non masquees (liste detaillee avec date de detection).
- Score de conformite global (0-100) base sur la couverture de masquage, le traitement des demandes GDPR, et l'absence de PII non protegee.
Export PDF pour transmission au DPO ou aux autorites. Le PDF est horodate, pagine, avec logo et en-tete de l'organisation.

### 5.5 Metriques Prometheus
Export des metriques pour le module signapps-metrics (port 3008) :
- `data_mgmt_pii_columns_total{status="detected|masked|unmasked"}` — nombre de colonnes PII par statut
- `data_mgmt_masked_columns_total` — nombre de colonnes masquees
- `data_mgmt_gdpr_requests_total{status="pending|in_progress|completed|rejected|overdue"}` — demandes GDPR par statut
- `data_mgmt_gdpr_requests_overdue` — demandes GDPR en depassement de delai
- `data_mgmt_anonymization_rows_processed_total` — lignes anonymisees (compteur cumulatif)
- `data_mgmt_anonymization_datasets_total` — nombre de datasets generes
- `data_mgmt_last_scan_timestamp` — timestamp du dernier scan PII
- `data_mgmt_scan_duration_seconds` — duree du dernier scan PII
- `data_mgmt_masking_execution_duration_seconds{table="..."}` — duree du masquage par table

---

## Categorie 6 — Configuration et RBAC

### 6.1 Roles et permissions
Integration avec signapps-identity (RBAC, port 3001) :
- **data-admin** : acces complet — creation/edition/suppression de regles, scans PII, suppressions GDPR, anonymisation, configuration, import/export de regles, gestion des environnements.
- **dpo** : acces lecture sur tout + validation des suppressions GDPR (etape 3 du workflow) + rapports de conformite + export PDF. Ne peut pas creer de regles de masquage ni executer de masquage.
- **data-operator** : execution des masquages (batch et clone & mask), anonymisations, scans PII. Pas de suppression GDPR, pas de configuration des environnements.
- **data-viewer** : consultation des rapports, dashboard, et historique uniquement. Aucune action d'ecriture.

Chaque action dans l'interface est conditionnee par le role. Les boutons non autorises sont masques (pas grises — masques, pour ne pas encombrer l'interface).

### 6.2 Configuration des environnements
Definition des environnements disponibles pour le masquage. Tableau editable : nom (texte), connexion PostgreSQL (host:port/database), indicateur production (toggle boolean), couleur de badge. L'environnement marque comme production ne peut pas etre cible par le masquage batch (le toggle est desactive avec tooltip "Utilisez Clone & Mask pour generer un dump masque sans toucher a la production"). Validation de la connexion : bouton `Test Connection` qui execute un `SELECT 1` et affiche "Connection OK" (vert) ou "Connection failed: reason" (rouge).

### 6.3 Configuration du scanner PII
Parametres du scanner, editables dans un formulaire :
- Taille d'echantillon par table : input numerique (defaut : 100 lignes, min 10, max 10 000)
- Seuil de confiance minimum pour la detection : slider (defaut : 0.7, range 0.1 a 1.0)
- Patterns regex personnalises : tableau editable (nom du pattern, regex, type de PII associe, ex: "Numero employe", `^EMP-\d{5}$`, "identifier")
- Colonnes a exclure globalement : input avec tags (defaut : `id`, `created_at`, `updated_at`, `deleted_at`, `version`)
- Tables a exclure globalement : input avec tags (ex: `schema_migrations`, `pg_*`)
- Planification : dropdown (quotidien, hebdomadaire, sur migration, desactive)

### 6.4 Webhook et integration
Envoi de webhooks sur les evenements. Configuration : URL du webhook, secret HMAC pour la signature, selection des evenements :
- `pii.detected` : nouvelle colonne PII detectee sans masquage
- `gdpr.deletion.completed` : suppression GDPR executee
- `gdpr.request.overdue` : demande GDPR en depassement du delai de 30 jours
- `masking.executed` : masquage batch execute avec succes
- `masking.failed` : masquage echoue avec erreur
Payload JSON standardise : `{event, timestamp, data: {...}, signature}`. Retry automatique (3 tentatives, backoff exponentiel : 1s, 5s, 25s). Log des webhooks envoyes (statut HTTP, duree). Integration avec les modules Notifications (port 8095) et Mail (port 3012) pour les alertes internes.

### 6.5 Retention des logs d'audit
Politique de retention configurable dans les parametres :
- Dropdown : 1 an, 3 ans, 5 ans, illimite.
- Les logs d'audit des operations GDPR sont conserves au minimum 3 ans (preuve de conformite), quels que soient les parametres.
- Archivage automatique des logs anciens vers le stockage SignApps (module Drive, port 3004) en format JSON compresse (gzip).
- Compteur : "1 247 operations tracees — 3.2 MB d'audit logs — Retention : 3 ans".
- Bouton `Export Audit Log` : export CSV/JSON des logs filtres par date, type d'operation, operateur.

---

## REST API endpoints

### Masking Rules CRUD
- `GET /api/v1/data-management/masking-rules` — Liste des regles (pagination, filtres par table, strategie, statut)
- `POST /api/v1/data-management/masking-rules` — Creer une regle
- `GET /api/v1/data-management/masking-rules/{id}` — Detail d'une regle
- `PUT /api/v1/data-management/masking-rules/{id}` — Modifier une regle
- `DELETE /api/v1/data-management/masking-rules/{id}` — Supprimer une regle
- `POST /api/v1/data-management/masking-rules/{id}/preview` — Dry-run (body: `{sample_size: 100}`)
- `POST /api/v1/data-management/masking-rules/{id}/execute` — Executer le masquage batch
- `POST /api/v1/data-management/masking-rules/import` — Importer des regles (body: JSON)
- `GET /api/v1/data-management/masking-rules/export` — Exporter les regles (JSON)

### PII Scanner
- `POST /api/v1/data-management/pii/scan` — Lancer un scan (body: `{tables: ["users", "contacts"] | null}`)
- `GET /api/v1/data-management/pii/results` — Resultats du dernier scan (pagination, filtres)
- `GET /api/v1/data-management/pii/history` — Historique des scans
- `POST /api/v1/data-management/pii/exclude` — Exclure une colonne (body: `{table, column, reason}`)
- `DELETE /api/v1/data-management/pii/exclude/{id}` — Re-inclure une colonne

### GDPR
- `POST /api/v1/data-management/gdpr/requests` — Creer une demande (body: `{type, subject_email}`)
- `GET /api/v1/data-management/gdpr/requests` — Liste des demandes (pagination, filtres)
- `GET /api/v1/data-management/gdpr/requests/{id}` — Detail d'une demande
- `POST /api/v1/data-management/gdpr/requests/{id}/map` — Cartographier les donnees
- `POST /api/v1/data-management/gdpr/requests/{id}/plan` — Generer le plan de suppression
- `POST /api/v1/data-management/gdpr/requests/{id}/execute` — Executer le plan
- `POST /api/v1/data-management/gdpr/requests/{id}/verify` — Verification post-suppression
- `GET /api/v1/data-management/gdpr/requests/{id}/certificate` — Telecharger le certificat PDF
- `GET /api/v1/data-management/gdpr/requests/{id}/export` — Export des donnees (DSAR)

### Anonymization
- `POST /api/v1/data-management/anonymization/datasets` — Creer un dataset
- `GET /api/v1/data-management/anonymization/datasets` — Liste des datasets
- `GET /api/v1/data-management/anonymization/datasets/{id}` — Detail
- `GET /api/v1/data-management/anonymization/datasets/{id}/preview` — Preview 50 lignes
- `POST /api/v1/data-management/anonymization/datasets/{id}/export` — Exporter (body: `{format, destination}`)
- `GET /api/v1/data-management/anonymization/datasets/{id}/validation` — Rapport de validation

### Dashboard
- `GET /api/v1/data-management/dashboard/kpis` — Les 4 KPIs
- `GET /api/v1/data-management/dashboard/coverage` — Couverture PII (ratio)
- `GET /api/v1/data-management/dashboard/timeline` — Evenements recents
- `GET /api/v1/data-management/dashboard/compliance-report` — Rapport RGPD (JSON ou PDF via header Accept)

### Audit
- `GET /api/v1/data-management/audit-log` — Logs d'audit (pagination, filtres par date, operation, operateur)
- `GET /api/v1/data-management/audit-log/export` — Export CSV/JSON

---

## PostgreSQL schema

```sql
-- Regles de masquage
CREATE TABLE masking_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_table VARCHAR(255) NOT NULL,
    target_column VARCHAR(255) NOT NULL,
    data_type VARCHAR(100),
    strategy VARCHAR(50) NOT NULL CHECK (strategy IN ('partial', 'redact', 'faker', 'hash', 'fpe', 'shuffle', 'null', 'generalization')),
    config JSONB NOT NULL DEFAULT '{}',
    environments TEXT[] NOT NULL DEFAULT '{dev,staging,test}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(target_table, target_column)
);

-- Resultats du scan PII
CREATE TABLE pii_scan_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES pii_scans(id) ON DELETE CASCADE,
    target_table VARCHAR(255) NOT NULL,
    target_column VARCHAR(255) NOT NULL,
    pii_type VARCHAR(50) NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    detection_method VARCHAR(50) NOT NULL,
    row_count BIGINT,
    masking_rule_id UUID REFERENCES masking_rules(id),
    is_excluded BOOLEAN NOT NULL DEFAULT false,
    exclusion_reason TEXT,
    excluded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historique des scans PII
CREATE TABLE pii_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_type VARCHAR(20) NOT NULL CHECK (scan_type IN ('manual', 'scheduled', 'migration')),
    tables_analyzed INTEGER NOT NULL,
    columns_detected INTEGER NOT NULL,
    new_detections INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL,
    triggered_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Demandes GDPR
CREATE TABLE gdpr_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('deletion', 'access', 'rectification', 'portability')),
    subject_user_id UUID NOT NULL REFERENCES users(id),
    subject_email VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
    assignee_id UUID REFERENCES users(id),
    rejection_reason TEXT,
    deadline TIMESTAMPTZ NOT NULL,
    deletion_plan JSONB,
    verification_result JSONB,
    certificate_url TEXT,
    completed_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Datasets anonymises
CREATE TABLE anonymization_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_tables TEXT[] NOT NULL,
    config JSONB NOT NULL,
    row_count BIGINT,
    size_bytes BIGINT,
    format VARCHAR(20),
    destination VARCHAR(255),
    validation_score REAL,
    validation_report JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'failed')),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Journal d'audit immutable
CREATE TABLE data_management_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation VARCHAR(50) NOT NULL,
    operator_id UUID NOT NULL REFERENCES users(id),
    target_table VARCHAR(255),
    target_column VARCHAR(255),
    target_user_id UUID,
    rows_affected BIGINT DEFAULT 0,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_created_at ON data_management_audit_log(created_at);
CREATE INDEX idx_audit_log_operation ON data_management_audit_log(operation);
CREATE INDEX idx_audit_log_operator ON data_management_audit_log(operator_id);
CREATE INDEX idx_gdpr_requests_status ON gdpr_requests(status);
CREATE INDEX idx_gdpr_requests_deadline ON gdpr_requests(deadline);
CREATE INDEX idx_pii_scan_results_scan ON pii_scan_results(scan_id);
CREATE INDEX idx_masking_rules_table ON masking_rules(target_table);
```

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
- Bouton `Add Rule` → le formulaire de creation en 4 etapes s'ouvre avec stepper horizontal
- Etape 1 : dropdown table charge les tables depuis information_schema, selection de colonne affiche le type et l'echantillon
- Etape 2 : grille des 8 strategies avec preview en temps reel sur les valeurs echantillons
- Creation d'une regle Partial sur `users.email` → la regle apparait dans le tableau avec preview (`j***n@example.com`)
- Creation d'une regle Faker sur `contacts.phone` → preview affiche un numero fictif realiste
- Creation d'une regle Redact sur `staging.password_hash` → preview affiche `[REDACTED]`
- Creation d'une regle Hash sur `users.external_id` → preview affiche un hash tronque
- Creation d'une regle FPE sur `accounts.iban` → preview affiche un IBAN chiffre au bon format
- Creation d'une regle Shuffle sur `employees.salary` → preview affiche les valeurs melangees
- Creation d'une regle Null sur `contacts.notes` → preview affiche NULL
- Creation d'une regle Generalization sur `users.birth_date` → preview affiche l'annee seule
- Dry-run d'une regle → le tableau avant/apres s'affiche avec 10 lignes et compteurs OK/warnings/erreurs
- Execution batch du masquage → barre de progression puis statut OK
- Clone & Mask → la base clonee est creee, masquage applique, dump telechargeale
- Integrite referentielle : masquer une colonne FK-dependante utilise une strategie deterministe
- Compteur affiche "N fields masked — PII protected in non-production environments"
- Import/export de regles → le fichier JSON est telecharge, puis reimporte avec preview
- Onglet PII Detector → bouton `Scan Now` lance un scan et affiche la barre de progression
- Scan detecte les colonnes `email`, `phone`, `name` avec confiance high (>= 0.9)
- Colonnes PII non-masquees affichent un badge d'alerte rouge
- Bouton `Create Rule` depuis le rapport PII → pre-remplit le formulaire de masquage avec strategie suggeree
- Bouton `Auto-suggest all` → genere des regles suggerees pour toutes les colonnes non masquees
- Exclusion d'une colonne faux-positif → elle disparait du rapport avec raison documentee
- Scan incremental → seules les tables modifiees sont re-analysees
- Alertes PII → notification au DPO et badge rouge sur l'onglet
- Onglet GDPR Deletion → le workflow en 5 etapes s'affiche avec stepper vertical
- Recherche d'un utilisateur par email → affichage de la cartographie des donnees en arbre
- Generation du plan de suppression → liste des tables avec nombre de lignes et action par table
- Tables en retention legale → action "Anonymize" ou "Retain" avec raison
- Execution de la suppression → barre de progression par table, rapport de confirmation
- Verification post-suppression → statut "clean" (aucune donnee residuelle)
- Telecharger certificat PDF → document horodate avec detail de l'operation
- DSAR → export JSON/CSV/PDF des donnees d'un utilisateur
- File d'attente GDPR → les demandes s'affichent avec deadline et couleur d'urgence
- Suppression en masse → criteres, estimation, plan, execution, rapport
- Onglet Anonymization → creation d'un dataset anonymise depuis une table source
- Configuration K-anonymite → K=5, verification que chaque groupe a >= 5 lignes
- Configuration differential privacy → epsilon=1.0, preview de l'impact sur la precision
- Preview du dataset anonymise → 50 lignes affichees sans PII, comparaison split view
- Validation du dataset → score de qualite, pas de PII residuelle
- Export CSV du dataset anonymise → fichier telecharge avec checksum
- Dashboard KPIs → les 4 cartes affichent des valeurs coherentes avec tendances
- Couverture PII → donut chart avec pourcentage, clic sur le rouge liste les colonnes non masquees
- Rapport de conformite RGPD → export PDF avec toutes les sections et score
- RBAC : un data-viewer ne peut pas creer de regle ni lancer de suppression (boutons masques)
- RBAC : un dpo peut valider les suppressions GDPR mais pas creer de regles de masquage
- RBAC : un data-operator peut executer le masquage mais pas modifier les environnements
