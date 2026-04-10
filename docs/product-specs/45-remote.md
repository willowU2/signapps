# Module Remote Desktop (Acces distant) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Apache Guacamole** | Open source, clientless (navigateur uniquement, pas de plugin), support RDP/VNC/SSH/Telnet/Kubernetes, enregistrement de session, partage de session, LDAP/SAML/TOTP auth, connection grouping, load balancing, audit logs |
| **RustDesk** | Open source (Rust + Flutter), self-hosted, pas de configuration reseau (relay auto), chiffrement E2E, transfert de fichiers, multi-moniteur, chat integre, presse-papier partage, streaming audio, low latency |
| **AnyDesk** | Codec DeskRT proprietaire ultra-rapide, latence <16ms, transfert de fichiers, wake-on-LAN, impression distante, tableau blanc sur session, address book, session recording, unattended access |
| **TeamViewer** | Installation instantanee, sessions ad-hoc (ID + password), transfert de fichiers, multi-moniteur, remote printing, chat, VPN, meeting integre, mobile-to-PC, device management, conditional access |
| **Parsec** | Optimise pour le gaming et le media (60fps 4K, H.265), faible latence, support gamepad, multi-moniteur, audio virtuel 7.1, co-hosting (multi-utilisateur sur un meme PC), peer-to-peer |
| **MeshCentral** | Open source, full remote management, RDP/VNC/SSH/terminal, fichiers, device groups, alertes, scripting, MFA, recording, multitenancy, agent-based et clientless, Wake-on-LAN |
| **Remmina** | Open source (client), support RDP/VNC/SSH/SFTP/NX/SPICE, profils de connexion, plugins, quality settings, shared folders, multi-moniteur, bookmarks |
| **xrdp** | Open source, serveur RDP pour Linux, session reuse, chiffrement TLS, integration PAM, support Xvnc/X11rdp/Xorg, multimon |

## Principes directeurs

1. **Clientless (navigateur only)** — aucun logiciel a installer sur le poste client. L'acces se fait entierement via le navigateur grace a un gateway Guacamole-like qui traduit les protocoles natifs (RDP/VNC/SSH) en WebSocket + canvas HTML5.
2. **Multi-protocole** — support des 4 protocoles principaux : RDP (Windows), VNC (Linux/Mac/multi-plateforme), SSH (terminal), Telnet (legacy). Le protocole est configurable par connexion.
3. **Securite enterprise** — chaque connexion est authentifiee via JWT SignApps, les credentials sont stockes chiffres, les sessions sont enregistrables pour l'audit. MFA optionnel avant connexion.
4. **Catalogue de machines** — les connexions sont sauvegardees dans un catalogue (address book) avec nom, protocole, hostname, port, credentials. Connexion en un clic depuis le catalogue.
5. **Recording de session** — option d'enregistrement des sessions (instructions Guacamole) pour replay ulterieur. Utile pour l'audit de securite et la conformite.
6. **Integration IT Assets** — les connexions peuvent etre liees aux assets du module IT Assets (signapps-it-assets) pour un inventaire complet des acces distants par machine.

---

## Categorie 1 — Catalogue de connexions

### 1.1 Grille de connexions
Vue en cartes (grid responsive, 3 colonnes desktop, 2 tablette, 1 mobile) des connexions sauvegardees. Chaque carte (hauteur fixe 160px, `border-radius: 12px`, bordure fine `border-border`) affiche :
- **Icone protocole** en haut a gauche (grande, 40px) : moniteur bleu pour RDP, moniteur violet pour VNC, terminal gris pour SSH, terminal ambre pour Telnet
- **Nom** de la connexion (gras, 16px, tronque a 30 caracteres)
- **Badge protocole** colore : `RDP` (bleu), `VNC` (violet), `SSH` (gris fonce), `Telnet` (ambre)
- **Hostname:port** en `text-muted-foreground` (ex: `192.168.1.100:3389`)
- **Username** en petit (si renseigne)
- **Derniere connexion** : date relative (`il y a 2h`) ou `Jamais` si premiere fois
- **Bouton `Connecter`** (primary, pleine largeur en bas de la carte)
- **Indicateur de statut** : point vert si la machine est joignable (ping recent), point rouge sinon, point gris si inconnu
- **Menu `...`** en haut a droite : Editer, Dupliquer, Partager, Reveiller (WoL), Supprimer

Hover sur la carte : elevation `shadow-lg` (transition 200ms). Clic sur le bouton `Connecter` ouvre la session (voir categorie 2/3).

### 1.2 Groupes / Dossiers de connexions
Les connexions peuvent etre organisees en groupes (dossiers). Un groupe est affiche comme un en-tete repliable au-dessus de ses connexions. Par defaut, un groupe `Toutes les connexions` contient tout. L'utilisateur cree des groupes via `+ Nouveau groupe` (nom, icone optionnelle, couleur). Drag-and-drop des cartes de connexion entre groupes. Un groupe peut etre imbrique dans un autre (2 niveaux max). L'arborescence des groupes est affichee dans une sidebar repliable a gauche (vue arbre).

### 1.3 Creation de connexion (wizard)
Bouton `+ Nouvelle connexion` ouvre un wizard en 3 etapes :

**Etape 1 — Protocole et adresse :**
- **Protocole** : selection visuelle avec 4 grandes cartes (RDP, VNC, SSH, Telnet), chacune avec icone, nom, et description courte
- **Hostname / IP** (texte, obligatoire, validation format IP ou hostname DNS)
- **Port** (numerique, pre-rempli selon protocole : RDP=3389, VNC=5900, SSH=22, Telnet=23, editable)
- **Nom de la connexion** (texte, pre-rempli avec `{hostname}`, editable)

**Etape 2 — Authentification :**
- **Username** (texte, optionnel pour VNC qui utilise souvent un password seul)
- **Password** (texte masque, optionnel — peut etre demande a chaque connexion si non sauvegarde)
- **Sauvegarder le mot de passe** (checkbox, defaut non coche — le password sera chiffre AES-256-GCM en base)
- **Domaine** (texte, visible uniquement pour RDP — ex: `CORP\`)
- **Cle privee SSH** (textarea ou upload, visible uniquement pour SSH — format PEM/OpenSSH)
- **Passphrase** de la cle (texte masque, visible si cle SSH renseignee)
- **Methode d'auth SSH** : select `Password`, `Public Key`, `Password + Public Key`
- **Recuperer depuis le vault** : bouton pour selectionner des credentials stockes dans le vault de signapps-identity (credentials securises, chiffres, avec rotation)

**Etape 3 — Options avancees :**
- **Groupe** (select parmi les groupes existants, ou `Aucun`)
- **Enregistrement de session** (toggle, defaut desactive)
- **Qualite** : select `Auto` (adaptatif), `Haute` (LAN), `Moyenne`, `Basse` (WAN lent)
- **Resolution** (visible pour RDP) : `Auto` (match navigateur), `1920x1080`, `1366x768`, `1280x720`, `Custom`
- **Couleurs** (visible pour RDP) : `True Color (32-bit)`, `High Color (16-bit)`, `256 couleurs`
- **Redirection clipboard** (toggle, defaut active)
- **Redirection audio** (toggle, defaut desactive)
- **Desactiver le fond d'ecran** (toggle pour RDP, reduit la bande passante)
- **Lier a un asset IT** (select, optionnel — recherche dans signapps-it-assets)
- **MFA requis** (toggle, defaut desactive — force re-auth TOTP avant connexion)

Bouton `Creer la connexion` en etape 3. Redirection vers la grille avec toast `Connexion "${nom}" creee`.

### 1.4 Edition de connexion
Clic sur `Editer` dans le menu de la carte. Meme formulaire que le wizard, pre-rempli. Le password affiche `*****` et ne peut pas etre lu (seulement remplace). Sauvegarde via `Enregistrer`. Les modifications n'affectent pas les sessions en cours.

### 1.5 Suppression de connexion
Clic sur `Supprimer` dans le menu. Dialogue de confirmation : `Supprimer la connexion "${nom}" ? Les credentials sauvegardes seront supprimes. Les enregistrements de session resteront disponibles.`. Suppression definitive des credentials. Soft-delete de la connexion (conservee pour l'audit pendant 90 jours).

### 1.6 Recherche et filtrage
Barre de recherche en haut de la grille : filtre par nom, hostname, username. Debounce 200ms. Filtres cliquables : badges de protocole (RDP, VNC, SSH, Telnet) pour filtrer par type. Toggle `En ligne seulement` pour n'afficher que les machines joignables. Tri : par nom (A-Z), par derniere connexion, par date de creation.

### 1.7 Etat vide (empty state)
Si aucune connexion n'est configuree, la grille affiche un empty state illustre (icone moniteur large, dessin minimaliste) avec le texte `Aucune connexion configuree` et le sous-texte `Creez votre premiere connexion pour acceder a distance a un serveur ou un bureau.` Bouton `+ Nouvelle connexion` prominent au centre.

---

## Categorie 2 — Session de bureau distant (RDP/VNC)

### 2.1 Viewer plein ecran
Clic sur `Connecter` pour une connexion RDP ou VNC ouvre un dialogue plein ecran (95vw x 90vh, `border-radius: 12px`, fond noir). Layout :
- **Header** (48px) : nom de la connexion (gras), badge protocole, `hostname:port`, indicateur de qualite (barres de signal), timer de session (`01:23:45`), bouton `Plein ecran` (F11), bouton `Deconnecter` (rouge)
- **Canvas** (zone principale) : element `<canvas>` HTML5 occupant tout l'espace restant, fond noir
- **Toolbar flottante** (bas, masquee par defaut, visible au hover ou via bouton) : boutons pour Ctrl+Alt+Del, clipboard, transfert de fichiers, qualite, multi-moniteur, screenshot, enregistrement

Animation d'ouverture : fade-in 200ms + scale 0.98→1. Pendant la connexion (negociation de protocole, authentification), un spinner s'affiche au centre du canvas avec le texte `Connexion a ${hostname}...` puis `Authentification...` puis `Chargement du bureau...`. Temps cible de connexion : <5 secondes en LAN, <15 secondes en WAN.

### 2.2 Rendu canvas
Le protocole Guacamole traduit les instructions de dessin du serveur RDP/VNC en operations canvas 2D (`drawImage`, `fillRect`, `clearRect`). Le gateway signapps-remote (port 3017) fait le pont entre le protocole natif (RDP via FreeRDP, VNC via libvnc) et le protocole Guacamole WebSocket. Rendu fluide a 30fps minimum (60fps en mode haute qualite). Le canvas est dimensionne a la taille du viewport du navigateur. Si la resolution du bureau distant differe, le canvas est scale avec `object-fit: contain` et des bandes noires.

### 2.3 Transmission clavier
Toutes les frappes clavier sont capturees via `keydown`/`keyup` events et transmises au serveur distant via le WebSocket Guacamole. Support des touches speciales :
- `Ctrl+Alt+Del` : bouton dedie dans la toolbar (pas interceptable par le navigateur)
- `Alt+Tab` : bouton dedie (capture par le navigateur sinon)
- `Alt+F4` : bouton dedie
- `Windows key` : bouton dedie (super key)
- `Print Screen` : bouton dedie
- Touches de fonction F1-F12 : transmises nativement
- Combinaisons `Ctrl+C`, `Ctrl+V` : interceptees pour le clipboard bidirectionnel (voir 2.5)

Le mapping clavier est configurable : `FR (AZERTY)`, `US (QWERTY)`, `DE (QWERTZ)`, `Auto-detect`. Parametre dans les options avancees de la connexion.

### 2.4 Transmission souris
Mouvements, clics (gauche, droit, milieu), scroll (vertical et horizontal), et double-clic sont transmis au serveur distant via les instructions Guacamole `mouse`. Le curseur local est masque sur le canvas (`cursor: none`) et le curseur distant est rendu par le serveur. Latence cible pour la souris : <50ms (le feedback visuel est le mouvement du curseur distant). Sur tablette tactile : tap = clic gauche, long-press = clic droit, two-finger scroll = scroll.

### 2.5 Clipboard synchronisation
Bidirectionnel entre le navigateur et la session distante :
- **Local → Distant** : `Ctrl+C` dans le navigateur copie le texte selectionne dans le clipboard local. `Ctrl+V` dans la session distante colle depuis le clipboard local via l'instruction Guacamole `clipboard`.
- **Distant → Local** : copier du texte dans la session distante met a jour le clipboard Guacamole. `Ctrl+V` dans le navigateur (hors canvas) colle le texte distant.

Bouton `Clipboard` dans la toolbar ouvre un dialogue avec un textarea affichant le contenu actuel du clipboard distant. L'utilisateur peut modifier le texte et cliquer `Envoyer` pour le pousser vers la session distante. Utile quand le copier-coller automatique ne fonctionne pas.

Limitation : seul le texte brut est supporte (pas d'images ni de fichiers dans le clipboard).

### 2.6 Transfert de fichiers
Bouton `Fichiers` dans la toolbar ouvre un panneau lateral (300px, droite) avec deux zones :
- **Upload** (local → distant) : zone de drag-drop avec texte `Deposez des fichiers ici` + bouton `Parcourir`. Les fichiers uploades sont envoyes au serveur via le canal SFTP de Guacamole (pour SSH/SFTP) ou le canal de lecteur virtuel (pour RDP). Barre de progression par fichier. Taille max : 100 MB par fichier.
- **Download** (distant → local) : le panneau liste les fichiers du repertoire distant (home directory par defaut). Navigation arborescente. Clic sur un fichier demarre le telechargement via le navigateur.

Le transfert est disponible pour les protocoles RDP (via drive virtuel) et SSH (via SFTP). Non disponible pour VNC et Telnet.

### 2.7 Redimensionnement dynamique
Quand la fenetre du navigateur est redimensionnee ou que l'utilisateur passe en plein ecran, la resolution du bureau distant est mise a jour via l'instruction Guacamole `size`. Le serveur RDP adapte la resolution en temps reel (requiert RDP 8.1+). Pour VNC, le scaling est fait cote client (l'image est scalee dans le canvas). Debounce de 500ms sur le resize pour eviter les rafales.

### 2.8 Qualite adaptative
Le gateway detecte automatiquement la bande passante et la latence et ajuste les parametres de compression :
- **Haute qualite (LAN)** : True Color 32-bit, compression PNG lossless, 60fps
- **Moyenne qualite** : 16-bit couleurs, compression JPEG quality 85, 30fps
- **Basse qualite (WAN lent)** : 256 couleurs, compression JPEG quality 40, 15fps, fond d'ecran desactive

L'utilisateur peut forcer un mode via le select `Qualite` dans la toolbar. Indicateur visuel : icone barres de signal (3 barres = haute, 2 = moyenne, 1 = basse). La qualite est re-evaluee toutes les 10 secondes.

### 2.9 Multi-moniteur
Pour les connexions RDP vers des machines avec plusieurs ecrans, bouton `Moniteurs` dans la toolbar. Affiche la disposition des moniteurs distants (rectangles proportionnels). Clic sur un moniteur le selectionne comme moniteur actif dans le viewer. Toggle `Tous les moniteurs` pour afficher un canvas panoramique avec tous les ecrans cote a cote (scroll horizontal si depasse le viewport).

### 2.10 Session sharing (partage de session)
Bouton `Partager` dans la toolbar de session. Genere un lien temporaire (validite : 1h, configurable) que l'utilisateur peut envoyer a un collegue. Le collegue clique sur le lien et rejoint la session en mode :
- **View-only** (defaut) : voit le bureau distant mais ne peut pas interagir (souris/clavier bloques). Utile pour le support technique.
- **Full control** : peut interagir (activation par le proprietaire de la session via un toggle dans la toolbar)

Maximum 3 spectateurs par session. Les spectateurs voient un banner `Vous observez la session de [Nom]`. Le proprietaire voit les avatars des spectateurs dans le header.

---

## Categorie 3 — Terminal SSH/Telnet

### 3.1 Emulateur de terminal
Pour les connexions SSH et Telnet, le viewer affiche un emulateur de terminal complet base sur xterm.js (MIT). Le terminal occupe tout l'espace du dialogue (memes dimensions que le viewer RDP/VNC). Police monospace (Fira Code, fallback Consolas, fallback monospace systeme), taille 14px (configurable 10-24px via `Ctrl+=` / `Ctrl+-`). Fond noir (`#1E1E1E`), texte vert clair (`#00FF41`) par defaut — theme configurable.

Couleurs ANSI 256 supportees. Bold, italic, underline, strikethrough. Scroll infini : le scrollback buffer conserve les 10 000 dernieres lignes en memoire. Barre de scroll a droite. `Ctrl+Shift+K` efface le terminal (clear).

### 3.2 Saisie de commandes
Toutes les frappes sont envoyees en temps reel au serveur via le WebSocket. Pas de champ input separe — le terminal est interactif directement (comme un terminal natif). Support complet :
- `Tab` : completion (geree par le shell distant)
- `Ctrl+C` : interrupt
- `Ctrl+D` : EOF / exit
- `Ctrl+Z` : suspend
- `Ctrl+L` : clear screen
- Fleches haut/bas : historique de commandes (gere par le shell distant)
- `Ctrl+R` : recherche inversee dans l'historique (bash)

### 3.3 Copier-coller dans le terminal
**Copier** : selection de texte dans le terminal avec la souris (clic-drag). Le texte selectionne est highlight en bleu. `Ctrl+Shift+C` copie dans le presse-papier du navigateur (ou `Ctrl+C` quand du texte est selectionne — distinction avec interrupt quand rien n'est selectionne).
**Coller** : `Ctrl+Shift+V` ou clic droit → Coller. Le texte est envoye au shell distant comme si l'utilisateur le tapait. Avertissement si le texte colle contient des retours a la ligne (pourrait executer des commandes involontairement) : dialogue `Le texte colle contient X lignes. Confirmer le collage ?`.

### 3.4 Themes de terminal
Selection dans les parametres de la connexion ou via le menu toolbar pendant la session. Themes predicts :
- **Dark** (defaut) : fond `#1E1E1E`, texte `#D4D4D4`
- **Monokai** : fond `#272822`, texte `#F8F8F2`
- **Solarized Dark** : fond `#002B36`, texte `#839496`
- **Solarized Light** : fond `#FDF6E3`, texte `#657B83`
- **Dracula** : fond `#282A36`, texte `#F8F8F2`
- **Matrix** : fond `#000000`, texte `#00FF41`

### 3.5 Historique de session exportable
Le contenu integral du terminal (scrollback buffer complet) est exportable en texte brut via bouton `Exporter` dans la toolbar. Format : fichier `.log` avec timestamps optionnels (un timestamp par ligne si active). Utile pour l'audit et la documentation des interventions.

---

## Categorie 4 — Securite et audit

### 4.1 Authentification des connexions
Chaque connexion est protegee par les credentials stockes dans le catalogue. Flux d'authentification :
1. L'utilisateur clique `Connecter` — JWT SignApps verifie par le middleware
2. Si MFA requis (option de la connexion) : dialogue TOTP ou push notification
3. Les credentials de la connexion sont dechiffres cote serveur (AES-256-GCM, cle derivee de la cle maitre du vault)
4. Le gateway signapps-remote etablit la connexion avec le serveur cible
5. Si les credentials sont invalides, erreur affichee dans le viewer : `Authentification echouee — verifiez les credentials`

Les credentials ne transitent jamais vers le navigateur. Le dechiffrement et l'utilisation se font exclusivement cote serveur (gateway).

### 4.2 Enregistrement de session (recording)
Option activable par connexion (toggle dans les parametres). Quand active, toutes les instructions Guacamole (dessin, clavier, souris) sont sauvegardees dans un fichier binaire sur signapps-storage (port 3004). Le fichier est compresse (gzip) et stocke avec les metadonnees : connexion_id, user_id, start_time, end_time, duration, file_size.

**Replay** : accessible depuis l'historique des sessions (onglet `Sessions`). Clic sur `Rejouer` ouvre un player Guacamole qui restitue le flux d'instructions dans un canvas identique a la session originale. Controles de lecture : play/pause, vitesse (1x, 2x, 4x, 8x), barre de progression seekable, timestamps. Le replay est en lecture seule — aucune interaction possible.

Stockage : 1 heure de session RDP = environ 50-200 MB compresse (selon l'activite). Retention configurable : 30/90/180/365 jours. Les enregistrements sont supprimables par l'admin uniquement.

### 4.3 MFA avant connexion
Option par connexion ou globale (politique de securite). Si active, un dialogue MFA s'affiche avant d'etablir la connexion :
- **TOTP** : champ 6 chiffres avec timer visuel (30 secondes)
- **Push notification** : notification envoyee a l'app mobile SignApps, l'utilisateur approuve/refuse

Le MFA est verifie via signapps-identity (port 3001). Si le MFA echoue 3 fois consecutives, la connexion est verrouilee pour 15 minutes.

### 4.4 Timeout de session
Deconnexion automatique apres X minutes d'inactivite (aucune frappe clavier ni mouvement souris). Configurable par connexion (defaut 30 min, range 5-480 min). Avertissement 5 minutes avant : banner rouge en haut du viewer `Session inactive — deconnexion dans 5:00. Bougez la souris pour prolonger.`. Mouvement de souris ou frappe clavier reinitialise le timer. Si timeout : deconnexion propre (logoff RDP, exit SSH) avec toast `Session deconnectee pour inactivite`.

### 4.5 Audit logs detailles
Chaque action est loggee dans `remote_audit_log` :
- `session.started` : user_id, connection_id, protocol, target_host, source_ip, timestamp
- `session.ended` : duree, raison (manual, timeout, error, server_disconnect)
- `session.recording.started` / `session.recording.stopped`
- `session.shared` : shared_with, mode (view_only, full_control)
- `clipboard.transfer` : direction (local→remote, remote→local), size_bytes (pas le contenu)
- `file.uploaded` / `file.downloaded` : filename, size_bytes
- `connection.created` / `connection.updated` / `connection.deleted`
- `auth.mfa.success` / `auth.mfa.failure`

Les logs sont consultables par l'admin dans l'onglet `Audit` de la page Remote. Filtres : par utilisateur, par connexion, par date, par type d'action. Export CSV/JSON.

### 4.6 Acces par role (RBAC)
Les connexions ont des permissions basees sur les roles RBAC de signapps-identity :
- **Admin** : voit et utilise toutes les connexions, cree/modifie/supprime, accede aux enregistrements et logs de tout le monde
- **Operateur** : voit et utilise les connexions de son perimetre (groupe/departement), cree ses propres connexions
- **Utilisateur** : voit et utilise uniquement ses propres connexions

Partage de connexion entre utilisateurs via le dialogue `Partager` (comme les notes Keep) : partage en lecture seule (viewer) ou acces complet (peut se connecter).

### 4.7 Keyboard shortcuts in session
La toolbar flottante contient des boutons pour les combinaisons de touches impossibles a transmettre directement :
| Bouton | Touche envoyee |
|---|---|
| `Ctrl+Alt+Del` | Ctrl+Alt+Delete |
| `Alt+Tab` | Alt+Tab (switch fenetre sur la machine distante) |
| `Alt+F4` | Alt+F4 (fermer la fenetre active distante) |
| `Win` | Windows key / Super key |
| `PrtScn` | Print Screen (screenshot de la machine distante) |
| `Ctrl+Esc` | Ouvrir le menu Demarrer (Windows) |

Les touches de fonction F1-F12 sont transmises nativement. Le mapping clavier (AZERTY/QWERTY/QWERTZ) est configurable dans les parametres de la connexion et dans la toolbar pendant la session.

### 4.8 Session screenshot
Bouton `Screenshot` dans la toolbar flottante. Capture l'etat actuel du canvas et le telecharge en PNG. Le screenshot est date et nomme `{nom_connexion}_{timestamp}.png`. Optionnel : sauvegarder le screenshot dans le drive SignApps (signapps-storage). Raccourci dans la session : `Ctrl+Shift+S` (capture locale sans envoyer a la machine distante).

---

## Categorie 5 — Statistiques, integration et features avancees

### 5.1 KPIs en haut de page
Quatre cartes KPI alignees horizontalement :
- **Gateway Status** : badge `En ligne` (vert) ou `Hors ligne` (rouge). Le gateway signapps-remote est pinge toutes les 30 secondes. Sous-texte : `Uptime: 99.9%`
- **Sessions actives** : nombre de sessions en cours (toutes les connexions). Clic ouvre un dropdown avec la liste des sessions actives (nom, utilisateur, duree)
- **Endpoints sauvegardes** : nombre total de connexions dans le catalogue. Sous-texte : `X RDP, Y SSH, Z VNC`
- **Logs aujourd'hui** : nombre d'evenements d'audit du jour. Sous-texte : `X connexions, Y erreurs`

### 5.2 Historique des sessions
Onglet `Sessions` avec table :
- **Date/heure** : timestamp de debut
- **Utilisateur** : avatar + nom
- **Connexion** : nom + badge protocole
- **Machine** : hostname:port
- **Duree** : format `Xh Ym Zs`
- **Statut** : badge `Succes` (vert), `Erreur` (rouge), `Timeout` (jaune)
- **Enregistrement** : icone camera si enregistre, clic → replay
- **Actions** : `Rejouer` (si enregistre), `Voir les logs`

Filtres : par utilisateur, par connexion, par date, par statut. Pagination 20 lignes/page.

### 5.3 Integration IT Assets
Lier une connexion a un asset IT (signapps-it-assets). Lors de la creation de connexion, champ `Asset IT` (select avec recherche). Si lie :
- La carte de connexion affiche un lien `Voir l'asset` → navigation vers la fiche IT Assets
- Depuis la fiche IT Assets, bouton `Se connecter` → ouvre la session Remote directement
- Le hardware_id, OS, derniere mise a jour sont affiches dans le detail de la connexion

PgEventBus event `remote.connection.linked { connection_id, asset_id }`.

### 5.4 Wake-on-LAN
Bouton `Reveiller` dans le menu de la carte de connexion (visible si le MAC address est renseigne dans l'asset IT lie ou manuellement dans les parametres de la connexion). Clic envoie un magic packet WoL via le gateway. Feedback : spinner `Envoi du signal WoL...` (2 secondes), puis `Signal envoye — la machine devrait demarrer dans 30-60 secondes`. Apres 60 secondes, un ping automatique est lance. Si la machine repond : toast `${nom} est en ligne !` et le point de statut passe au vert. Si pas de reponse : toast `${nom} ne repond pas — verifiez la configuration WoL`.

### 5.5 Connection favorites et raccourcis
Les connexions peuvent etre marquees comme favorites (etoile dans le coin de la carte). Les favorites apparaissent dans une section `Favoris` en haut de la grille. Raccourcis clavier globaux (configurables) : `Ctrl+1` → connexion favorite #1, `Ctrl+2` → #2, etc. (max 9).

### 5.6 Dark mode et themes
Le viewer de session s'adapte au mode sombre de SignApps :
- Le header et la toolbar passent en fond `bg-card` avec texte `text-foreground`
- Le canvas de la session conserve les couleurs natives du bureau distant (pas de filtre)
- Le terminal SSH respecte le theme choisi (Dark, Monokai, Solarized, etc.)
- Les dialogues (creation, edition, partage) suivent les tokens semantiques SignApps

### 5.7 Sessions simultanees
Un utilisateur peut ouvrir plusieurs sessions en parallele. Chaque session s'ouvre dans un nouvel onglet du navigateur (ou dans un dialogue separe si configure). Le header de la page Remote affiche un compteur `X sessions actives` avec un dropdown listant les sessions ouvertes (clic pour basculer).

---

## Categorie 6 — Persistance et API

### 6.1 API REST complete

**Base path :** `/api/v1/remote`

| Methode | Endpoint | Description |
|---|---|---|
| `GET` | `/connections` | Liste des connexions. Query params : `cursor`, `limit`, `protocol`, `group_id`, `search`, `sort_by` |
| `GET` | `/connections/:id` | Detail d'une connexion (sans le password en clair) |
| `POST` | `/connections` | Creer une connexion. Body : `{ name, protocol, hostname, port, username?, password?, domain?, ssh_key?, group_id?, recording?, quality?, resolution?, ... }` |
| `PUT` | `/connections/:id` | Modifier une connexion |
| `DELETE` | `/connections/:id` | Supprimer une connexion |
| `POST` | `/connections/:id/duplicate` | Dupliquer |
| `POST` | `/connections/:id/share` | Partager. Body : `{ user_id, role }` |
| `POST` | `/connections/:id/wol` | Envoyer un signal Wake-on-LAN |
| `GET` | `/connections/:id/status` | Ping la machine cible et retourne le statut |
| `GET` | `/groups` | Liste des groupes |
| `POST` | `/groups` | Creer un groupe. Body : `{ name, parent_id?, color? }` |
| `PUT` | `/groups/:id` | Modifier un groupe |
| `DELETE` | `/groups/:id` | Supprimer un groupe (les connexions passent dans `Toutes`) |
| `GET` | `/sessions` | Historique des sessions. Query params : `connection_id`, `user_id`, `date_from`, `date_to`, `status` |
| `GET` | `/sessions/:id/recording` | Telecharger l'enregistrement |
| `GET` | `/sessions/active` | Sessions en cours |
| `GET` | `/sessions/:id/share-link` | Generer un lien de partage de session |
| `WS` | `/connections/:id/ws` | WebSocket Guacamole pour la session. Protocol : `guacamole` |
| `GET` | `/stats` | KPIs (gateway status, sessions actives, endpoints, logs) |
| `GET` | `/audit` | Logs d'audit. Query params : `user_id`, `connection_id`, `action`, `date_from`, `date_to` |

### 6.2 PostgreSQL schema

```sql
-- Connexions Remote
CREATE TABLE remote_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES remote_groups(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    protocol VARCHAR(10) NOT NULL CHECK (protocol IN ('rdp', 'vnc', 'ssh', 'telnet')),
    hostname VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    username VARCHAR(100),
    password_encrypted BYTEA,
    domain VARCHAR(100),
    ssh_private_key_encrypted BYTEA,
    ssh_passphrase_encrypted BYTEA,
    ssh_auth_method VARCHAR(20) DEFAULT 'password' CHECK (ssh_auth_method IN ('password', 'publickey', 'both')),
    recording_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    quality VARCHAR(10) NOT NULL DEFAULT 'auto' CHECK (quality IN ('auto', 'high', 'medium', 'low')),
    resolution VARCHAR(20) DEFAULT 'auto',
    color_depth INTEGER DEFAULT 32,
    clipboard_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    audio_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    disable_wallpaper BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_required BOOLEAN NOT NULL DEFAULT FALSE,
    inactivity_timeout_minutes INTEGER NOT NULL DEFAULT 30,
    asset_id UUID,
    mac_address VARCHAR(17),
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    favorite_order INTEGER,
    last_connected_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_remote_connections_user ON remote_connections(user_id, is_deleted);
CREATE INDEX idx_remote_connections_group ON remote_connections(group_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_remote_connections_protocol ON remote_connections(user_id, protocol) WHERE is_deleted = FALSE;
CREATE INDEX idx_remote_connections_favorite ON remote_connections(user_id, is_favorite, favorite_order) WHERE is_deleted = FALSE;

-- Groupes de connexions
CREATE TABLE remote_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES remote_groups(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(9),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_remote_groups_user ON remote_groups(user_id);

-- Partage de connexions
CREATE TABLE remote_connection_shares (
    connection_id UUID NOT NULL REFERENCES remote_connections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('viewer', 'user')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (connection_id, user_id)
);

-- Sessions
CREATE TABLE remote_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES remote_connections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    protocol VARCHAR(10) NOT NULL,
    target_host VARCHAR(255) NOT NULL,
    source_ip INET,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    end_reason VARCHAR(30),
    recording_storage_key VARCHAR(500),
    recording_size_bytes BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'error', 'timeout'))
);

CREATE INDEX idx_remote_sessions_connection ON remote_sessions(connection_id, started_at DESC);
CREATE INDEX idx_remote_sessions_user ON remote_sessions(user_id, started_at DESC);
CREATE INDEX idx_remote_sessions_active ON remote_sessions(status) WHERE status = 'active';

-- Liens de partage de session (temporaires)
CREATE TABLE remote_session_share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES remote_sessions(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    mode VARCHAR(15) NOT NULL DEFAULT 'view_only' CHECK (mode IN ('view_only', 'full_control')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log
CREATE TABLE remote_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES remote_sessions(id) ON DELETE SET NULL,
    connection_id UUID REFERENCES remote_connections(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(40) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    source_ip INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_remote_audit_connection ON remote_audit_log(connection_id, created_at DESC);
CREATE INDEX idx_remote_audit_user ON remote_audit_log(user_id, created_at DESC);
CREATE INDEX idx_remote_audit_session ON remote_audit_log(session_id, created_at DESC);
```

### 6.3 PgEventBus events

| Event | Payload | Consumers |
|---|---|---|
| `remote.connection.created` | `{ connection_id, user_id, protocol, hostname }` | IT Assets, Metrics |
| `remote.connection.deleted` | `{ connection_id, user_id }` | IT Assets |
| `remote.connection.linked` | `{ connection_id, asset_id }` | IT Assets |
| `remote.session.started` | `{ session_id, user_id, connection_id, protocol, target_host }` | Metrics, Audit |
| `remote.session.ended` | `{ session_id, user_id, duration_seconds, end_reason }` | Metrics, Audit |
| `remote.session.shared` | `{ session_id, shared_with, mode }` | Notifications |
| `remote.session.recording.completed` | `{ session_id, recording_key, size_bytes }` | Storage |
| `remote.wol.sent` | `{ connection_id, mac_address, user_id }` | Audit |
| `remote.auth.mfa.failure` | `{ connection_id, user_id, source_ip }` | Security, Notifications (admin) |

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Apache Guacamole Manual** (guacamole.apache.org/doc/gug) — architecture, configuration, protocole, extensions.
- **RustDesk Documentation** (rustdesk.com/docs) — self-hosted, relay, client, security.
- **MeshCentral Documentation** (meshcentral.com/docs) — remote management, recording, scripting.
- **AnyDesk Help Center** (support.anydesk.com) — sessions, securite, configuration.
- **Guacamole Protocol Reference** (guacamole.apache.org/doc/gug/protocol-reference.html) — instructions, opcodes, canvas rendering.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Apache Guacamole** (github.com/apache/guacamole-server) | **Apache-2.0** | Reference principale. Protocole de rendu distant, gateway, enregistrement, multi-protocole. |
| **guacamole-client** (github.com/apache/guacamole-client) | **Apache-2.0** | Client web Java. Pattern pour le rendering canvas, la gestion clavier/souris, le WebSocket. |
| **RustDesk** (github.com/rustdesk/rustdesk) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Architecture Rust pour le remote desktop. |
| **MeshCentral** (github.com/Ylianst/MeshCentral) | **Apache-2.0** | Remote management complet. Pattern pour le device management, le recording, le multi-protocole. |
| **xterm.js** (github.com/xtermjs/xterm.js) | **MIT** | Emulateur de terminal pour le web. Pattern pour le rendu terminal SSH/Telnet dans le navigateur. |
| **ttyd** (github.com/tsl0922/ttyd) | **MIT** | Terminal web via WebSocket. Pattern leger pour le terminal dans le navigateur. |
| **websocketd** (github.com/joewalnes/websocketd) | **BSD-2-Clause** | Bridge stdio ↔ WebSocket. Pattern pour la communication bidirectionnelle. |
| **noVNC** (github.com/novnc/noVNC) | **MPL-2.0** | Client VNC HTML5. Consommation OK (MPL-2.0 comme dependance). Pattern pour le rendu VNC dans le navigateur. |

---

## Assertions E2E cles (a tester)

- Page Remote → les 4 KPIs s'affichent (Gateway Status en ligne, Sessions actives, Endpoints, Logs)
- Creer une connexion RDP via wizard → elle apparait dans la grille avec badge bleu `RDP`
- Creer une connexion SSH → elle apparait avec badge gris `SSH`
- Creer une connexion VNC → badge violet `VNC`
- Editer une connexion → les parametres sont mis a jour
- Supprimer une connexion → dialogue de confirmation, puis la carte disparait
- Organiser en groupes → la connexion apparait sous le bon groupe, drag-drop fonctionne
- Cliquer `Connecter` sur une connexion RDP → le viewer plein ecran s'ouvre, spinner de connexion
- Connexion RDP reussie → le bureau distant s'affiche dans le canvas
- Connexion RDP echouee (mauvais credentials) → message d'erreur dans le viewer
- Cliquer `Connecter` sur une connexion SSH → le terminal s'affiche avec prompt
- Taper une commande dans le terminal SSH → la sortie s'affiche
- Copier-coller dans le terminal → texte transfere correctement
- Bouton `Deconnecter` dans le viewer → retour a la grille, session loggee
- Toggle enregistrement de session → l'option est sauvegardee, icone camera visible
- Replay d'un enregistrement → le player Guacamole affiche le bureau avec controles de lecture
- Partage de session → lien genere, le spectateur voit le bureau en view-only
- MFA requis → dialogue TOTP avant connexion, erreur apres 3 echecs
- Timeout inactivite → avertissement a 5 minutes, deconnexion automatique
- Wake-on-LAN → signal envoye, feedback de succes/echec
- Empty state sans connexion → message et bouton `Nouvelle connexion` affiches
- Recherche par nom → seules les connexions correspondantes apparaissent
- Filtre par protocole → seules les connexions du protocole selectionne apparaissent
- Favoris → etoile sur la carte, section Favoris en haut
- Sessions simultanees → deux sessions ouvertes dans deux onglets
- Transfert de fichiers (SSH) → upload et download fonctionnels
- Multi-moniteur (RDP) → selection du moniteur dans la toolbar
- Qualite adaptative → changement de qualite visible dans l'indicateur de signal
