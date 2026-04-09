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
Vue en cartes (grid) des connexions sauvegardees. Chaque carte affiche : nom, protocole (badge couleur : RDP bleu, VNC violet, SSH gris, Telnet ambre), hostname:port, username, bouton `Connecter`.

### 1.2 Creation de connexion
Dialogue de creation avec champs : Nom (texte), Protocole (select : RDP/VNC/SSH/Telnet), Hostname/IP (texte), Port (numerique, pre-rempli selon protocole : 3389/5900/22/23), Username (optionnel), Password (optionnel, masque). Options avancees : private key (SSH), parametres specifiques au protocole.

### 1.3 Edition de connexion
Modification de tous les champs d'une connexion existante. Le password peut etre laisse vide pour conserver l'actuel. Toggle `Enregistrement de session` activable/desactivable.

### 1.4 Suppression de connexion
Bouton supprimer avec dialogue de confirmation. Suppression definitive de la connexion et de ses credentials.

### 1.5 Etat vide (empty state)
Si aucune connexion n'est configuree, afficher une illustration avec message `Aucune connexion configuree` et bouton `Nouvelle connexion` prominent.

### 1.6 Recherche et filtrage
Barre de recherche par nom/hostname. Filtre par protocole (badges cliquables). Tri par nom, date de creation, dernier acces.

---

## Categorie 2 — Session de bureau distant (RDP/VNC)

### 2.1 Viewer plein ecran
A la connexion, un dialogue plein ecran (95vw x 90vh) s'ouvre avec le flux video du bureau distant rendu dans un canvas HTML5. Header avec : nom de connexion, hostname:port, protocole, statut, bouton `Deconnecter`.

### 2.2 Rendu canvas
Le protocole Guacamole traduit les instructions de dessin du serveur RDP/VNC en operations canvas 2D. Rendu fluide a 30fps minimum. Redimensionnement adaptatif a la taille de la fenetre du navigateur.

### 2.3 Transmission clavier
Toutes les frappes clavier sont capturees et transmises au serveur distant via WebSocket. Support des touches speciales : Ctrl+Alt+Del, Alt+Tab, touches de fonction, raccourcis Windows. Barre d'outils avec boutons pour les combinaisons speciales.

### 2.4 Transmission souris
Mouvements, clics (gauche, droit, milieu), scroll, et double-clic sont transmis au serveur distant. Curseur local masque ou synchronise avec le curseur distant.

### 2.5 Redimensionnement dynamique
Changement de taille de la fenetre du navigateur → la resolution du bureau distant s'adapte automatiquement (si le serveur le supporte). Fallback : scaling avec ratio preserved.

### 2.6 Qualite adaptative
Detection automatique de la bande passante. Mode haute qualite (LAN) : palette complete, compression minimale. Mode basse qualite (WAN) : reduction des couleurs, compression JPEG agressive, reduction de framerate.

---

## Categorie 3 — Terminal SSH/Telnet

### 3.1 Emulateur de terminal
Pour les connexions SSH et Telnet, le viewer affiche un terminal complet dans un element `<pre>` avec police monospace. Couleurs ANSI supportees. Scroll infini.

### 3.2 Saisie de commandes
Input texte en bas du terminal. Les frappes sont envoyees en temps reel au serveur. Support des caracteres speciaux : Tab (completion), Ctrl+C (interrupt), Ctrl+D (EOF), fleches (historique).

### 3.3 Copier-coller
Selection de texte dans le terminal → Ctrl+C copie. Ctrl+V colle dans l'input. Presse-papier bidirectionnel entre le navigateur et la session distante.

### 3.4 Historique de session
Le contenu du terminal est conserve en memoire pendant la session (scrollback buffer). Exportable en texte brut a la fin de la session.

---

## Categorie 4 — Securite et audit

### 4.1 Authentification des connexions
Chaque connexion est protegee par les credentials stockes dans le catalogue. Les passwords sont chiffres en base de donnees (AES-256 ou vault integration). L'acces au module Remote requiert un JWT valide.

### 4.2 Enregistrement de session (recording)
Option par connexion : activer l'enregistrement. Les instructions Guacamole sont sauvegardees sur le serveur. Replay disponible depuis l'interface (vue en lecture seule du bureau distant reconstitue).

### 4.3 MFA avant connexion
Option d'exiger une re-authentification MFA (TOTP ou push) avant d'ouvrir une session distante. Configurable globalement ou par connexion.

### 4.4 Timeout de session
Deconnexion automatique apres X minutes d'inactivite (configurable, defaut 30 min). Avertissement 5 minutes avant. L'utilisateur peut prolonger la session.

### 4.5 Audit logs
Log de chaque action : connexion, deconnexion, duree de session, utilisateur, IP source, machine cible, protocole. Exportable pour conformite.

### 4.6 Acces par role
Les connexions peuvent etre restreintes par role RBAC : admin (toutes les connexions), operateur (connexions de son perimetre), utilisateur (ses propres connexions uniquement).

---

## Categorie 5 — Statistiques et integration

### 5.1 KPIs en haut de page
Quatre cartes : Gateway Status (en ligne/hors ligne), Sessions actives (nombre), Endpoints sauvegardes (nombre total de connexions), Logs d'audit (nombre d'evenements aujourd'hui).

### 5.2 Historique des sessions
Table avec : date/heure, utilisateur, machine, protocole, duree, statut (success/error). Filtre par utilisateur, machine, date.

### 5.3 Integration IT Assets
Lier une connexion a un asset IT (signapps-it-assets). Depuis la fiche d'un asset, bouton `Se connecter` qui ouvre la session Remote directement. Hardware_id stocke dans la connexion.

### 5.4 Wake-on-LAN
Bouton `Reveiller` sur une connexion. Envoie un magic packet WoL au MAC address de la machine. Utile pour les serveurs en veille. Feedback de succes/echec.

### 5.5 API REST
Endpoints : `GET /api/v1/remote/connections` (liste), `POST` (creation), `PUT/:id` (mise a jour), `DELETE/:id` (suppression), `GET /:id/ws` (WebSocket Guacamole pour la session). Backend signapps-remote port 3017.

### 5.6 Transfert de fichiers (futur)
Upload/download de fichiers entre le navigateur et la machine distante via le canal Guacamole SFTP. Drag-drop depuis le navigateur vers le bureau distant.

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

- Page Remote → les 4 KPIs s'affichent (Gateway Status, Sessions actives, Endpoints, Logs)
- Creer une connexion RDP → elle apparait dans la grille avec badge bleu `RDP`
- Creer une connexion SSH → elle apparait avec badge gris `SSH`
- Editer une connexion → les parametres sont mis a jour
- Supprimer une connexion → dialogue de confirmation, puis la carte disparait
- Cliquer `Connecter` sur une connexion RDP → le viewer plein ecran s'ouvre
- Cliquer `Connecter` sur une connexion SSH → le terminal s'affiche
- Bouton `Deconnecter` dans le viewer → retour a la grille
- Toggle enregistrement de session → l'option est sauvegardee
- Empty state sans connexion → message et bouton `Nouvelle connexion` affiches
- Recherche par nom → seules les connexions correspondantes apparaissent
- Filtre par protocole → seules les connexions du protocole selectionne apparaissent
- Rafraichir la liste → les connexions sont rechargees depuis le backend
- WebSocket connection failure → message d'erreur dans le viewer, statut `error`
