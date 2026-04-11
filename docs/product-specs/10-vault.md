# Module Vault (coffre-fort de secrets) — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **1Password** | UX premium, Watchtower (breach alerts), Secret Sharing, Shared vaults, travel mode (masquer certains vaults aux douanes), Masked Email, SSH key management, CLI, dev tools integration, psw generator avancé |
| **Bitwarden** | Open source, self-hostable, E2E, CLI, Send (partage temporaire), vault health reports, emergency access, username generator, organization vaults |
| **LastPass** | Emergency access, multi-factor, dark web monitoring, password sharing, folders, form fills |
| **Dashlane** | VPN intégré, dark web monitoring, password health, autofill puissant, business admin |
| **KeePassXC** | Totalement offline, open source, KDBX format, SSH agent, key files, auto-type |
| **NordPass** | Xchacha20 encryption, data breach scanner, cross-device sync, secure notes |
| **Proton Pass** | E2E, Proton ecosystem, aliases unlimited, zero-knowledge, open source |
| **Keeper** | Enterprise focus, compliance reports, audit, secure messaging |
| **RoboForm** | Form filling excellence, application forms, bookmarks |
| **Enpass** | Local storage option, self-hosted sync, lifetime plan |
| **HashiCorp Vault** | Secrets management enterprise pour infra (DevOps), dynamic secrets, encryption as a service |
| **AWS Secrets Manager** / **Azure Key Vault** | Cloud-native secrets pour infra |
| **Doppler** | Developer-first secrets management, env vars, team access |
| **Infisical** | Open source alternative to Doppler, source-available |

## Principes directeurs

1. **Zero-knowledge** — le serveur ne voit JAMAIS les mots de passe en clair. Chiffrement côté client uniquement. Perte de master password = perte des données (avec récupération optionnelle).
2. **Usage aussi facile que possible** — auto-fill, suggestions, intégration navigateur, mobile autofill natif. Le vault doit être invisible au quotidien.
3. **Partage sécurisé** — partager un mot de passe à un collègue sans l'envoyer par email/chat en clair.
4. **Audit et santé du vault** — alertes sur les mots de passe faibles, réutilisés, compromis dans des breaches publiques.
5. **Multi-types de secrets** — pas juste des passwords : notes, cartes, identités, SSH keys, API keys, documents sensibles.
6. **Récupération d'urgence** — en cas de perte d'accès, héritiers ou collègues peuvent récupérer l'accès avec délai de carence.

---

## Catégorie 1 — Vaults et organisation

### 1.1 Vaults multiples
Plusieurs vaults séparés : `Personnel`, `Travail`, `Famille`, `Projet X`. Chaque vault a sa clé dérivée et ses permissions propres.

### 1.2 Vaults partagés (équipe)
Vault partagé avec une équipe ou un groupe. Tous les membres ayant accès peuvent lire/écrire selon leurs permissions.

### 1.3 Hiérarchie de dossiers
Dans un vault, organiser les entrées en dossiers et sous-dossiers. Drag-drop pour réorganiser.

### 1.4 Tags
Tags cross-vault pour classer : `critical`, `prod`, `dev`, `backup`, `shared`. Multiples par entrée.

### 1.5 Favoris
Marquer les entrées les plus utilisées. Accès rapide depuis un onglet `Favoris`.

### 1.6 Recherche rapide
Barre de recherche en haut, ou raccourci `Ctrl+K`. Autocomplétion sur titres, URLs, noms d'utilisateurs. Résultats instant.

### 1.7 Filtres
Par type (passwords, notes, cards, SSH, etc.), par vault, par dossier, par tag, par date de création/modification.

### 1.8 Tri
Par nom (A-Z), date de création, date de modification, dernière utilisation, importance.

### 1.9 Vue liste et vue grille
Liste détaillée ou grille avec icônes des sites.

### 1.10 Sidebar de navigation
Vaults → Dossiers → Entrées. Tags en bas, filtres rapides.

---

## Catégorie 2 — Types d'entrées

### 2.1 Password (login)
Type principal. Champs : titre, URL, username, password, TOTP (2FA), notes, tags. Icône du site auto-fetched.

### 2.2 Secure note
Note libre chiffrée. Text long avec rich formatting. Pour les informations sensibles non structurées (clé master, instructions de récupération, recovery codes).

### 2.3 Credit card
Type carte bancaire : titulaire, numéro (masqué par défaut), date d'expiration, CVV, banque, couleur, PIN. Utilisé pour l'autofill en checkout.

### 2.4 Identity
Informations personnelles : nom complet, adresse, téléphone, email, SSN/NISS, passport, driver's license. Pour auto-remplir les formulaires.

### 2.5 Bank account
Compte bancaire : banque, titulaire, IBAN, BIC/SWIFT, numéro de compte, nom de la branche.

### 2.6 SSH key
Clé SSH privée/publique avec passphrase. Export direct vers `~/.ssh`. Intégration SSH agent.

### 2.7 API key / Token
Tokens d'API, bearer tokens, secrets d'application. Copiable avec masquage.

### 2.8 Wi-Fi
SSID, password, type de sécurité (WEP/WPA/WPA2/WPA3), notes. QR code généré pour partage mobile.

### 2.9 Email account
Configuration email : provider, server (IMAP/SMTP), port, username, password, TLS settings.

### 2.10 Software license
Clés de licence de logiciels : produit, version, clé, date d'achat, email, notes.

### 2.11 Document sécurisé
Upload de fichiers sensibles (PDF, scans d'identité, contrats) avec chiffrement. Preview déchiffré à la volée.

### 2.12 Passkey / FIDO2
Stockage de passkeys (WebAuthn credentials). Synchronisation cross-device. Alternative aux mots de passe.

### 2.13 Crypto wallet
Seed phrases, private keys, adresses wallets. Marquage "danger" pour ne pas partager par erreur.

### 2.14 Database credential
Host, port, database, user, password, protocol. Connection string generator.

### 2.15 Server / SSH login
Host, port, user, password, key file, jump host. One-click SSH (via terminal app).

### 2.16 Custom entry
Type custom avec champs définis par l'utilisateur : ajouter des fields de type text, password, URL, date, checkbox.

---

## Catégorie 3 — Création et édition

### 3.1 Ajout manuel
Bouton `Nouveau` → sélection du type → formulaire avec les champs du type. Validation.

### 3.2 Ajout depuis le navigateur (extension)
Quand on sauvegarde un mot de passe dans une page web, l'extension propose `Sauvegarder dans le vault`. Pré-rempli avec URL, username, password.

### 3.3 Import depuis autres vaults
Import CSV (format Bitwarden, 1Password, LastPass, Dashlane, Chrome, Firefox, Safari). Mapping des colonnes.

### 3.4 Import depuis browser exports
Upload d'un `.csv` exporté depuis Chrome/Firefox/Edge/Safari avec détection automatique du format.

### 3.5 Import depuis KeePass (KDBX)
Upload d'un fichier KDBX avec master password → décryption côté client → import des entrées.

### 3.6 Export
`Fichier > Exporter` avec options : CSV non chiffré (warning), JSON chiffré, KDBX (pour migration).

### 3.7 Duplication
Duplicate une entrée pour en créer une variante (même login mais URL différente par exemple).

### 3.8 Édition inline
Clic sur un champ pour l'éditer. Sauvegarde immédiate ou sur perte de focus.

### 3.9 Notes rich text
Dans les entrées, le champ `Notes` peut contenir du texte formaté (gras, listes, liens).

### 3.10 Attachments
Ajouter des fichiers joints à une entrée (scan de passport, factures, contrats).

### 3.11 Historique de modifications
Chaque entrée a un historique de ses versions. Restaurer une ancienne version si erreur.

### 3.12 Version history des passwords
Historique des anciens passwords de l'entrée (utile si on est forcé de revenir à un ancien).

---

## Catégorie 4 — Autofill et intégration navigateur

### 4.1 Extension navigateur
Extension Chrome, Firefox, Safari, Edge, Brave qui :
- Détecte les pages avec formulaire de login
- Propose l'entrée correspondante via un popup
- Auto-fill en un clic ou un shortcut
- Sauvegarde les nouvelles entrées

### 4.2 Sélection intelligente
Si plusieurs entrées correspondent à un site, dropdown pour choisir. Priorité sur les plus utilisées.

### 4.3 Auto-submit
Option pour soumettre automatiquement le formulaire après autofill. Optionnelle et désactivable.

### 4.4 Ne pas remplir certains champs
Option par entrée : ne pas remplir le champ X. Pour les formulaires exigeant des captchas ou des confirmations manuelles.

### 4.5 Credit card autofill
Dans les pages checkout, autofill des cartes bancaires après confirmation utilisateur (jamais automatique sans clic).

### 4.6 Identity autofill
Dans les pages avec formulaires (inscription, billing), autofill des champs nom/email/adresse depuis l'identity.

### 4.7 Générateur de passwords
Dans l'extension, bouton `Générer un password` pour les champs de création de mot de passe. Options : longueur, chars, symboles, mémorable.

### 4.8 Touch ID / Face ID / Windows Hello
Unlock du vault via biométrie sur desktop et mobile.

### 4.9 Keyboard shortcut pour autofill
Raccourci configurable (`Ctrl+Shift+L`) pour déclencher l'autofill sans cliquer sur l'extension.

### 4.10 Application natives
Sur desktop, intégration avec les apps natives qui supportent le protocole de password manager (Apple Keychain-like).

### 4.11 Mobile autofill (iOS / Android)
Intégration avec le système d'autofill natif : AutofillService Android, Password AutoFill iOS.

### 4.12 SSH agent integration
Les clés SSH du vault sont exposées à l'agent SSH du système. Utilisation transparente dans le terminal.

---

## Catégorie 5 — Générateur de secrets

### 5.1 Password generator
Générer un password avec options :
- Longueur (1-100)
- Uppercase (A-Z)
- Lowercase (a-z)
- Chiffres (0-9)
- Symboles (!@#$%^&*)
- Exclure chars ambigus (l, I, O, 0)
- Exclure chars spécifiques

### 5.2 Passphrase generator
Suite de mots aléatoires (Diceware). Plus facile à mémoriser. Configurable : nombre de mots, séparateur, capitalisation, numéros, langue du dictionnaire.

### 5.3 PIN generator
Code PIN numérique de 4-12 chiffres.

### 5.4 Username generator
Générer des usernames uniques : mot aléatoire, nom aléatoire, pattern custom.

### 5.5 Email alias generator
Créer un alias jetable (ex: `xyz@alias.signapps.com`) qui forward vers l'email principal. Blocable individuellement. Utile pour les inscriptions.

### 5.6 Strength meter
Barre de progression de la force du password : très faible, faible, moyen, fort, très fort. Calcul basé sur entropie.

### 5.7 Copy to clipboard
Bouton copier à côté du password généré. Auto-clear clipboard après 30s pour éviter les leaks.

### 5.8 History of generated passwords
Historique des passwords générés récemment (chiffré localement).

---

## Catégorie 6 — 2FA et TOTP

### 6.1 TOTP codes intégrés
Champ TOTP dans une entrée. Scan un QR code ou saisir le secret manuellement. Code généré toutes les 30s dans l'entrée.

### 6.2 Copy TOTP
Bouton copier à côté du code TOTP. Auto-clear clipboard.

### 6.3 Autofill TOTP
Après l'autofill du password, si la page demande le TOTP, auto-fill le code actuel.

### 6.4 Backup codes storage
Stockage des backup codes 2FA. Utilisés comme fallback si TOTP indisponible.

### 6.5 Hardware tokens
Support des hardware tokens (YubiKey, Feitian, Titan) pour l'unlock du vault ou comme second facteur.

### 6.6 Passkey support (WebAuthn)
Stockage de passkeys (alternative moderne aux passwords). Création et gestion intégrées.

---

## Catégorie 7 — Partage sécurisé

### 7.1 Partage d'une entrée à un utilisateur
Bouton `Partager` sur une entrée → sélection d'un utilisateur SignApps (ou email externe). Niveau d'accès : lecture seule, lecture+copie, édition. Le partage est chiffré E2E entre les clés des deux utilisateurs.

### 7.2 Partage à un groupe
Partager à un groupe prédéfini (`Équipe dev`, `Admin`). Ajout/retrait de membres propage le partage.

### 7.3 Vault partagé
Alternative : créer un vault spécifique et inviter des membres. Tous les membres voient toutes les entrées du vault.

### 7.4 Revocation de partage
Retirer l'accès à un utilisateur ou un groupe. Les clés dérivées sont révoquées (l'utilisateur ne peut plus déchiffrer).

### 7.5 Partage temporaire (one-time share)
Générer un lien temporaire pour partager un password à un externe (Bitwarden Send-style). Expiration après X vues ou X heures. Lien déchiffré avec un code envoyé séparément.

### 7.6 Demande d'accès
Un utilisateur peut demander l'accès à une entrée. Le propriétaire reçoit une notification et peut accepter/refuser.

### 7.7 Transfer of ownership
Transférer une entrée à un autre utilisateur. Utile quand un employé quitte et son successeur reprend ses comptes.

### 7.8 Audit des accès
Log : qui a accédé à quelle entrée, quand, depuis quel device. Alerte en cas d'accès inhabituel.

### 7.9 Zero-knowledge partage
Le serveur ne voit jamais le contenu partagé en clair. Utilisation de ECDH pour l'échange de clés (comme Signal).

### 7.10 Expiration automatique
Partage avec date d'expiration automatique. Après cette date, accès révoqué automatiquement.

---

## Catégorie 8 — Santé et audit du vault

### 8.1 Dashboard de santé
Page `Santé du vault` avec indicateurs :
- **Passwords faibles** (entropie basse)
- **Passwords réutilisés** (le même sur plusieurs entrées)
- **Passwords anciens** (non changés depuis >1 an)
- **Passwords compromis** (trouvés dans HaveIBeenPwned)
- **Comptes sans 2FA** alors qu'ils pourraient en avoir un
- **Notes mal sécurisées** (type wrong)
- **Score global** de santé

### 8.2 Détection de passwords compromis (HIBP)
Intégration avec Have I Been Pwned API (K-anonymity) pour vérifier si un password a fuité publiquement. Alertes en direct pour les entrées concernées.

### 8.3 Watchtower (breach monitoring)
Monitoring continu des emails utilisés dans les entrées. Alerte si une breach les mentionne (ex: fuite LinkedIn, Yahoo, etc.).

### 8.4 Duplicate password detection
Identifier les passwords réutilisés entre plusieurs entrées. Suggestion de les changer.

### 8.5 Old password warning
Détecter les passwords non changés depuis X temps (configurable). Suggestion de rotation.

### 8.6 Weak password detection
Calculer l'entropie de chaque password et flag ceux en dessous d'un seuil.

### 8.7 2FA recommendation
Pour les sites qui supportent 2FA (détection via URL/domain database), suggestion d'activer 2FA.

### 8.8 Unused entries
Entrées jamais utilisées depuis plus d'un an. Nettoyage suggéré.

### 8.9 Export audit report
Rapport PDF de l'audit pour compliance/ISO27001.

---

## Catégorie 9 — Sécurité et crypto

### 9.1 Master password
Un seul mot de passe à retenir. Stretching avec Argon2id (préféré) ou PBKDF2 (nombre d'iterations élevé). Dérivation de la clé de chiffrement.

### 9.2 Chiffrement AES-256 / ChaCha20-Poly1305
Toutes les entrées chiffrées avec AES-256-GCM ou ChaCha20-Poly1305 (plus rapide sur ARM). Un IV unique par entrée.

### 9.3 Zero-knowledge architecture
Le serveur ne voit JAMAIS les données en clair. Tout le chiffrement/déchiffrement côté client. Upload des blobs chiffrés seulement.

### 9.4 E2E pour le partage
Pour les vaults partagés, utilisation de clés asymétriques (curve25519) pour l'échange de clés entre utilisateurs. Chaque utilisateur a sa paire publique/privée.

### 9.5 Master password recovery
Option `Emergency contact` : désigner un contact de confiance qui peut récupérer l'accès après un délai de carence (ex: 7 jours sans déblocage de l'utilisateur). Le contact reçoit une copie chiffrée de la clé de récupération.

### 9.6 Biometric unlock
Touch ID, Face ID, Windows Hello, fingerprint Android pour unlock rapide. La clé de déchiffrement est stockée dans le secure enclave du device.

### 9.7 Auto-lock
Le vault se verrouille automatiquement après X minutes d'inactivité, à la fermeture du navigateur, à la mise en veille.

### 9.8 Brute force protection
Après N tentatives de master password incorrectes, lock temporaire ou complet avec notification.

### 9.9 Travel mode
Marquer certains vaults comme "travel mode" : ils sont temporairement cachés de l'appareil pour éviter une saisie forcée aux frontières.

### 9.10 Secure clipboard
Quand on copie un password, il est auto-cleared du clipboard après 30s pour éviter les leaks par d'autres apps.

### 9.11 Clipboard blocking
Sur mobile, bloquer certaines apps (keyboards custom) de lire le clipboard.

### 9.12 Screenshot prevention
Option pour empêcher les screenshots des pages du vault (sur mobile et desktop si supporté).

### 9.13 Secure boot et integrity check
Au démarrage, vérifier l'intégrité de l'app (hash des binaires) pour détecter les tampering.

### 9.14 Open source et auditable
Code source auditable. Audits de sécurité tiers publiés publiquement.

---

## Catégorie 10 — Administration entreprise

### 10.1 SSO integration
Login SSO via SAML, OIDC, OAuth. Intégration avec Okta, Azure AD, Google Workspace, JumpCloud.

### 10.2 SCIM provisioning
Synchronisation automatique des utilisateurs et groupes depuis l'IdP. Déprovision automatique au départ.

### 10.3 Policies (mots de passe, 2FA, etc.)
Admin peut imposer des règles : longueur min du master password, 2FA obligatoire, rotation des passwords après X mois, interdire l'export, etc.

### 10.4 Vault d'équipe obligatoire
Certains comptes (ex: comptes pro) doivent être stockés dans un vault d'équipe partagé, pas dans le personnel. Enforcement par règle.

### 10.5 Audit logs complet
Log de toutes les actions : création, lecture, modification, partage, export, login. Exportable pour compliance.

### 10.6 Reports
Rapports : utilisation du vault par utilisateur, nombre d'entrées, passwords faibles, 2FA activations, derniers logins.

### 10.7 Delegation admin
Déléguer des permissions admin granulaires : gestion des utilisateurs, vaults, policies, audit.

### 10.8 Offboarding automatique
Quand un utilisateur est supprimé de l'IdP, ses vaults partagés sont transférés à son manager, ses vaults personnels archivés ou détruits selon policy.

### 10.9 Password expiration policy
Forcer le renouvellement des passwords stockés après X mois. Notifications à l'utilisateur.

### 10.10 Break glass accounts
Comptes d'urgence pour récupérer l'accès en cas de perte totale (ex: PC perdu + backup inaccessible). Accessible uniquement via procédure stricte.

---

## Catégorie 11 — Mobile et synchronisation

### 11.1 Application mobile native
iOS et Android natifs. Autofill système, biométrie, QR scan, notifications.

### 11.2 Synchronisation cross-device
Sync chiffrée entre desktop, web, mobile. Push en temps réel via CRDT (Yjs) ou revisions.

### 11.3 Mode offline
Accès au vault en mode offline. Modifications mises en queue et syncées au retour.

### 11.4 QR code sharing
Partager une entrée via QR code pour transfert rapide vers un autre device.

### 11.5 Widget mobile
Widget écran d'accueil pour accès rapide à certaines entrées (après unlock biométrique).

### 11.6 Apple Watch / Android Wear
Consulter les TOTPs depuis la montre (sans clavier à taper).

### 11.7 Safari / Chrome extension iOS
Extension Safari iOS pour autofill dans Safari.

### 11.8 Shortcuts / automatisations iOS
Intégration avec l'app Shortcuts pour des actions personnalisées.

---

## Catégorie 12 — Intégrations développeur

### 12.1 CLI
Outil en ligne de commande pour accéder au vault depuis un terminal. Utile pour les scripts shell et les DevOps.

### 12.2 API REST
API pour les intégrations programmatiques. Auth via token API.

### 12.3 SDK (Python, Go, Node, Rust)
SDKs officiels pour utiliser le vault depuis des applications.

### 12.4 Secrets injection dans les env vars
`signapps-vault run -- my-app` lance `my-app` avec les secrets du vault injectés en variables d'environnement. Pas de `.env` en clair.

### 12.5 CI/CD integration
Intégration avec GitHub Actions, GitLab CI, CircleCI pour injecter les secrets dans les pipelines.

### 12.6 Terraform provider
Provider Terraform pour manager le vault comme infrastructure.

### 12.7 Kubernetes secrets
Injection des secrets du vault dans les pods Kubernetes via un External Secrets Operator.

### 12.8 SSH key management pour DevOps
Gestion centralisée des clés SSH pour l'accès aux serveurs. Audit de qui se connecte où.

### 12.9 Rotation automatique
Rotation automatique des credentials d'API, DB, etc. selon une policy. Support pour les services qui permettent la rotation (AWS, GCP, DB).

### 12.10 Dynamic secrets
Génération de credentials à la demande, expirant automatiquement (ex: DB credential valable 1h). Comme HashiCorp Vault.

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **1Password Support** (support.1password.com) — docs complètes sur tous les types de secrets, sharing, travel mode.
- **Bitwarden Help** (bitwarden.com/help) — self-hosting, CLI, integrations.
- **LastPass Support** (support.lastpass.com) — emergency access, form fills.
- **Dashlane Help** (support.dashlane.com) — VPN, dark web monitoring.
- **KeePassXC Getting Started** (keepassxc.org/docs) — KDBX format, plugins.
- **Proton Pass** (proton.me/support/pass) — aliases, zero-knowledge.
- **HashiCorp Vault Docs** (developer.hashicorp.com/vault) — enterprise secrets, dynamic, K8s.
- **OWASP Password Storage Cheat Sheet** (cheatsheetseries.owasp.org) — références crypto et best practices.
- **HaveIBeenPwned** (haveibeenpwned.com) — API K-anonymity pour check breaches.

### Projets open source permissifs
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **Bitwarden Server** (github.com/bitwarden/server) | **AGPL v3** | **INTERDIT** (AGPL). Étudier via docs publiques. |
| **Vaultwarden** (github.com/dani-garcia/vaultwarden) | **AGPL v3** | **INTERDIT**. |
| **KeePassXC** | **GPL v3** | **INTERDIT pour copie**. Format KDBX libre à réimplémenter. |
| **pass** (passwordstore.org) | **GPL v2** | **INTERDIT**. |
| **Hashicorp Vault** | **BSL** (since Aug 2023) | **INTERDIT depuis 2023**. Forks avant août 2023 étaient MPL (OK). |
| **OpenBao** (openbao.org) | **MPL v2** | **Weak copyleft OK comme consommateur**. Fork de HashiCorp Vault pré-BSL. |
| **Infisical** | **MIT** (Community) | Alternative open source. Pattern pour les secrets DevOps. |
| **Openpass** (github.com/UCL-Open-Research-Group/OpenPass) | **MIT** | Password manager expérimental. Référence de concepts. |
| **KDBX4 (format)** | Libre | Format de fichier KeePass. Réimplémentable. |
| **libsodium** (libsodium.org) | **ISC** | Cryptographie moderne. NaCl-compatible. Base pour E2E. |
| **sodium-native** (github.com/sodium-friends/sodium-native) | **ISC** | Bindings Node.js. |
| **argon2** / **node-argon2** | **MIT** | KDF moderne recommandé pour master password. |
| **crypto-js** (github.com/brix/crypto-js) | **MIT** | Library crypto JS (AES, SHA). Alternative à libsodium pour usage browser. |
| **WebAuthn / SimpleWebAuthn** (simplewebauthn.dev) | **MIT** | Support WebAuthn/Passkeys côté client et serveur. |
| **otplib** (github.com/yeojz/otplib) | **MIT** | Génération TOTP/HOTP pour le 2FA intégré. |
| **zxcvbn-ts** (github.com/zxcvbn-ts/zxcvbn) | **MIT** | Password strength estimation. Basé sur les travaux de Dropbox. |
| **has-been-pwned / pwned-passwords** | Various (check) | K-anonymity lookup pour breach check. |
| **qrcode.js** / **qrcode** (node) | **MIT** | Génération de QR codes. |
| **jsqr** (github.com/cozmo/jsQR) | **Apache-2.0** | Scan de QR codes côté navigateur. |
| **fido2-lib** (github.com/webauthn-open-source/fido2-lib) | **MIT** | Serveur WebAuthn complet. |

### Pattern d'implémentation recommandé
1. **Crypto** : `libsodium` via `sodium-native` (ISC) en Node ou la crate `sodiumoxide` (MIT) en Rust. Alternative : Web Crypto API native.
2. **KDF (master password)** : `argon2` (MIT) en Rust ou Node. Paramètres : `m=65536, t=3, p=4` minimum. Calibrage selon la machine cible.
3. **Chiffrement symétrique** : ChaCha20-Poly1305 (plus rapide mobile) ou AES-256-GCM. Un nonce unique par message.
4. **Zero-knowledge** : tout le déchiffrement côté client. Le serveur stocke seulement des blobs chiffrés opaques + métadonnées minimales (titre chiffré, timestamps).
5. **E2E sharing** : ECDH (curve25519) pour l'échange de clés entre utilisateurs. Chaque entrée partagée est re-chiffrée avec une clé dérivée.
6. **TOTP** : `otplib` (MIT) pour le générateur TOTP.
7. **Password strength** : zxcvbn-ts (MIT).
8. **Breach check** : intégration HaveIBeenPwned K-anonymity API (pas de lib spécifique, simple HTTP).
9. **WebAuthn** : SimpleWebAuthn (MIT) pour l'implémentation serveur et client.
10. **QR codes** : `qrcode` (MIT) pour la génération, `jsqr` (Apache-2.0) pour le scan.
11. **Format interne** : JSON chiffré comme blob, ou format custom binaire optimisé. Pas de KDBX (complexité Keepass).
12. **Synchronisation** : Yjs (MIT) pour le sync temps réel, avec blobs chiffrés comme contenu. Ou révisions classiques avec LWW.

### Ce qu'il ne faut PAS faire
- **Pas de fork** de Bitwarden (AGPL) ou HashiCorp Vault post-2023 (BSL).
- **Pas de MD5 ni SHA-1** pour la dérivation de clés.
- **Pas de stockage de passwords en clair** nulle part, même temporairement.
- **Pas de logging** des passwords, même dans les debug logs.
- **Pas d'export non chiffré** par défaut (warning obligatoire).

---

## Assertions E2E clés (à tester)

- Création d'un vault avec master password
- Unlock avec master password
- Ajout d'un password manuel avec titre, URL, username, password
- Ajout via extension navigateur depuis un formulaire
- Import CSV depuis Bitwarden/1Password/LastPass
- Édition d'une entrée
- Duplication d'une entrée
- Suppression d'une entrée (avec corbeille)
- Recherche d'une entrée
- Filtres par type, tag, vault
- Autofill dans un formulaire web via extension
- Génération de password avec options
- Génération de passphrase
- Copy to clipboard avec auto-clear
- TOTP code visible et copiable
- Partage d'une entrée à un utilisateur
- Revocation de partage
- Vault partagé d'équipe
- Santé du vault : rapport généré
- Détection de password compromis (HIBP)
- Détection de passwords réutilisés
- Export en KDBX ou JSON chiffré
- Biometric unlock
- Auto-lock après timeout
- Mobile autofill natif
- Sync cross-device
- Offline mode
- Passkey / WebAuthn création et usage
