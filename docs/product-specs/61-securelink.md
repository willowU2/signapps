# Module SecureLink — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Cloudflare Tunnel (cloudflared)** | Zero-trust sans port ouvert, tunnel chiffre automatique, DNS intelligent, protection DDoS L3/L4/L7, Access policies (identite + device posture), analytics trafic, split tunneling, WARP client, integration Workers/Pages |
| **Tailscale** | Mesh VPN WireGuard zero-config, MagicDNS, ACL policies (HuJSON), exit nodes, subnet routers, Tailscale Funnel (exposition publique), SSH via Tailscale, taildrop (transfert fichiers), audit logs, DERP relay servers |
| **WireGuard** | Protocole VPN ultra-leger (~4000 LOC kernel), Noise protocol framework, performance superieure (throughput + latency), chiffrement state-of-the-art (ChaCha20, Poly1305, Curve25519, BLAKE2s), roaming natif |
| **ngrok** | Exposition localhost instantanee, inspection HTTP/WebSocket, replay de requetes, domaines custom, TLS automatique, IP whitelisting, traffic policy engine, edge labels, API programmable, OAuth integration |
| **frp (fast reverse proxy)** | Reverse proxy tunnel en Go, multi-protocole (TCP/UDP/HTTP/HTTPS/STCP), dashboard web, load balancing, plugin system, TLS encryption, bandwidth limiting, port reuse, KCP protocol pour UDP |
| **Rathole** | Reverse proxy tunnel en Rust, performance elevee, faible empreinte memoire (~2MB RSS), noise protocol encryption, multiplexing, hot reload config, TCP/UDP, zero-copy forwarding, service discovery |
| **bore** | Tunnel TCP minimaliste en Rust (~1500 LOC), NAT traversal simple, authentification par secret, assignation de port, protocole binaire custom, latence minimale, deployment trivial |
| **Pi-hole** | DNS sinkhole pour bloquer ads/malware/tracking, dashboard stats (requetes, clients, domaines), gravity lists (3M+ domaines), regex filtering, group management, DHCP integre, API query log |

## Principes directeurs

1. **Tunnel en un clic** — creer et activer un tunnel securise doit prendre moins de 30 secondes. Le bouton `Quick Connect` pre-configure automatiquement le protocole, genere un sous-domaine, et demarre le tunnel avec feedback visuel immediat (connecting → connected → live).
2. **Dashboard temps reel** — le tableau de bord affiche en temps reel les tunnels actifs, le trafic bidirectionnel (bandwidth up/down), les requetes DNS, et les requetes bloquees. Les graphiques sont mis a jour par WebSocket sans polling. Les timestamps sont affiches sur l'axe X du chart de trafic.
3. **Zero-trust networking** — chaque tunnel est authentifie par JWT (integration signapps-identity), chiffre (WireGuard ou TLS 1.3), et soumis a des politiques d'acces par utilisateur/groupe/IP. Aucun port n'est ouvert sur le serveur destination.
4. **DNS filtering intelligent** — resolution DNS avec blocklists configurables (malware, tracking, adult, gambling, social). Statistiques de requetes en temps reel (total, bloquees, autorisees). Top domaines resolus et bloques.
5. **Relay haute disponibilite** — les serveurs relais assurent la connectivite quand le NAT traversal direct echoue. Dashboard de sante par relais (latence, bande passante, connexions actives, uptime). Failover automatique entre relais.
6. **Audit et observabilite** — chaque connexion, deconnexion, changement de configuration, et evenement de securite est trace avec horodatage, IP source, identite utilisateur, et duree de session. Metriques Prometheus pour le monitoring.

---

## Categorie 1 — Dashboard et vue d'ensemble

### 1.1 Cartes KPI principales
Onglet Dashboard avec 4 cartes KPI en haut :
- **Active Tunnels** : nombre de tunnels actuellement connectes (badge vert), avec tendance (fleche up/down par rapport a hier)
- **Active Relays** : nombre de serveurs relais en ligne, avec indicateur de sante (tous verts / certains degrades)
- **DNS Queries Today** : nombre total de requetes DNS resolues dans la journee en cours
- **Blocked Queries** : nombre de requetes DNS bloquees par les filtres (malware, tracking, etc.)

### 1.2 Graphique de trafic temps reel
Area chart bidirectionnel montrant le trafic reseau au fil du temps :
- Axe X : timestamps (dernieres 24h par defaut, zoom possible sur 1h/6h/12h/7j)
- Axe Y : bande passante (bytes/s, formatte en KB/s, MB/s)
- Deux aires : upload (couleur primaire) et download (couleur secondaire)
- Tooltip au survol avec valeurs exactes et timestamp
- Bouton `Refresh` pour forcer le rechargement des donnees
- Mode Live (WebSocket) avec mise a jour seconde par seconde

### 1.3 Statut global
Bandeau de statut : `Operational` (vert), `Degraded` (orange si un relais est down), `Incident` (rouge si aucun relais disponible). Calcule automatiquement a partir de l'etat des composants.

### 1.4 Evenements recents
Feed chronologique des 20 derniers evenements : tunnel cree, tunnel connecte/deconnecte, relais ajoute/supprime, DNS record modifie, alerte securite. Chaque evenement avec timestamp, type, et details.

### 1.5 Carte geographique des relais
Carte mondiale (ou carte schematique) montrant la localisation des relais avec indicateur de latence. Lignes entre les tunnels et leurs relais. Couleur par latence : vert (< 50ms), orange (50-200ms), rouge (> 200ms).

### 1.6 Metriques de performance
Panneau avec metriques agregees : latence moyenne des tunnels, debit total (upload + download), nombre de connexions concurrentes, taux d'erreur (timeouts, connection refused), uptime du service securelink sur 30 jours.

---

## Categorie 2 — Gestion des tunnels

### 2.1 Liste des tunnels
Tableau avec colonnes : Nom, Adresse locale (host:port), Sous-domaine public (*.securelink.local), Protocole (HTTP/HTTPS/TCP/UDP), Statut (connected/disconnected/error), Trafic cumule (bytes formatte), Uptime, Dernier heartbeat, Actions (edit/toggle/delete). Tri par statut, nom, trafic. Filtre par protocole et statut.

### 2.2 Creation de tunnel
Dialogue de creation avec champs :
- **Nom** (texte, requis) — identifiant humain du tunnel
- **Adresse locale** (host:port, requis) — ex: `localhost:8080`, `192.168.1.100:3000`
- **Protocole** (select : HTTP, HTTPS, TCP, UDP) — determine le type de proxy
- **Sous-domaine** (texte, optionnel) — genere automatiquement si vide, sinon verifie la disponibilite
- **Options avancees** (collapsible) :
  - Basic Auth (toggle + user/password)
  - IP Whitelist (liste d'IPs ou CIDR autorisees)
  - Rate limiting (requetes/seconde par IP)
  - TLS termination (terminer TLS au relais ou passer en mode passthrough)
  - Timeout (connect timeout, read timeout en secondes)
  - Bandwidth limit (Mo/s upload et download)

### 2.3 Quick Connect
Bouton en haut du Dashboard et de la liste des tunnels. Un clic :
1. Detecte le service local le plus probable (scan ports 3000, 8080, 8443, 80)
2. Genere un sous-domaine aleatoire (ex: `autumn-fox-7k2m.securelink.local`)
3. Cree le tunnel avec les parametres par defaut
4. Affiche l'URL publique avec bouton copier
Feedback visuel : spinner → checkmark vert → URL cliquable.

### 2.4 Activation et desactivation
Toggle on/off par tunnel. Un tunnel desactive :
- Ferme la connexion active
- Libere les ressources sur le relais
- Conserve la configuration complete
- Le sous-domaine est reserve (pas reutilise)
Reactivation : reconnexion automatique en < 5 secondes.

### 2.5 Edition de tunnel
Modification des parametres sans detruire le tunnel. Changements a chaud (hot reload) pour : nom, IP whitelist, rate limiting, bandwidth limit. Changements avec reconnexion : adresse locale, protocole, TLS mode.

### 2.6 Duplication de tunnel
Bouton `Duplicate` pour creer un tunnel avec les memes parametres (sauf sous-domaine regenere). Utile pour les environnements multiples (dev tunnel, staging tunnel, prod tunnel avec meme config).

### 2.7 Suppression de tunnel
Suppression avec confirmation modale. Le sous-domaine est libere apres 24h (grace period contre suppression accidentelle). Les logs de trafic historiques sont conserves pour l'audit.

### 2.8 Inspection du trafic
Pour les tunnels HTTP/HTTPS : panneau d'inspection montrant les requetes en temps reel (methode, URL, status code, duree, taille). Filtre par status code (2xx, 3xx, 4xx, 5xx). Clic sur une requete affiche les headers et le body (tronque a 10KB). Similaire a l'inspecteur ngrok.

### 2.9 Metriques par tunnel
Onglet Stats par tunnel : graphique de trafic dedie, nombre de requetes/connexions, latence p50/p95/p99, taux d'erreur, top IPs clientes, top URLs (pour HTTP).

---

## Categorie 3 — Serveurs relais (Relays)

### 3.1 Liste des relais
Tableau avec colonnes : Nom, Region/Localisation, Adresse IP, Port, Protocole (WireGuard/TLS), Statut (online/offline/degraded), Latence (ms), Bande passante disponible (Mo/s), Connexions actives, Uptime. Badge de sante colore.

### 3.2 Ajout d'un relais
Formulaire d'ajout :
- **Nom** (texte) — identifiant du relais
- **Adresse** (IP ou hostname) — adresse publique du serveur relais
- **Port** (nombre) — port d'ecoute (defaut : 9443)
- **Region** (texte) — localisation geographique (pour l'affichage)
- **Cle publique** (texte) — cle WireGuard du relais pour l'authentification mutuelle
- **Capacite max** (nombre) — nombre maximal de connexions simultanees

### 3.3 Health check des relais
Verification periodique (toutes les 30 secondes) :
- Ping ICMP et latence
- Handshake TLS/WireGuard
- Test de throughput (transfert de 1MB)
- Verification de la capacite restante
Historique des health checks avec graphique de latence sur 24h.

### 3.4 Failover automatique
Si un relais devient indisponible :
1. Detection en < 30 secondes (2 health checks echoues consecutifs)
2. Migration automatique des tunnels vers un relais disponible de la meme region
3. Reconnexion transparente pour les clients (< 5 secondes d'interruption)
4. Notification a l'admin du failover
5. Re-migration automatique quand le relais original revient en ligne (optionnel)

### 3.5 Load balancing
Repartition des tunnels entre les relais disponibles :
- **Round-robin** : repartition equitable
- **Least connections** : preference au relais le moins charge
- **Latency-based** : preference au relais le plus proche du client
- **Geographic** : routage vers le relais de la meme region que le client
Algorithme configurable globalement ou par tunnel.

### 3.6 Statistiques par relais
Vue detaillee par relais : graphique de trafic, nombre de tunnels heberges, utilisation CPU/memoire du relais (si agent installe), historique de disponibilite sur 30 jours.

---

## Categorie 4 — Gestion DNS

### 4.1 Liste des enregistrements DNS
Tableau avec colonnes : Type (A, AAAA, CNAME, TXT, MX, SRV, NS), Nom (hostname), Valeur (IP, CNAME target, etc.), TTL (secondes), Statut (actif/inactif), Date de creation. Recherche par nom ou valeur.

### 4.2 Creation d'enregistrement DNS
Formulaire :
- **Type** (select : A, AAAA, CNAME, TXT, MX, SRV, NS)
- **Nom** (texte) — hostname ou sous-domaine
- **Valeur** (texte) — IP, target, ou contenu selon le type
- **TTL** (select : 60s, 300s, 3600s, 86400s, ou custom)
- **Priorite** (nombre, uniquement pour MX et SRV)
Validation du format selon le type (IPv4 pour A, IPv6 pour AAAA, FQDN pour CNAME, etc.).

### 4.3 Edition et suppression d'enregistrements
Edition inline dans le tableau (clic sur la valeur pour modifier). Suppression avec confirmation. Historique des modifications (qui a change quoi, quand).

### 4.4 DNS Filtering (blocklists)
Configuration des listes de blocage par categorie :
- **Malware** : domaines connus pour distribuer des malwares (sources : URLhaus, PhishTank, OpenPhish)
- **Tracking & Ads** : domaines de tracking et publicite (sources : EasyList, EasyPrivacy, Steven Black)
- **Adult content** : domaines pour adultes
- **Gambling** : sites de jeux d'argent
- **Social media** : reseaux sociaux (blocage optionnel, par ex. en environnement corporate)
- **Custom** : liste personnalisee de domaines a bloquer (upload de fichier ou saisie manuelle)
Chaque categorie indique le nombre de domaines bloques. Toggle on/off par categorie.

### 4.5 Allowlist DNS
Liste blanche de domaines qui ne seront jamais bloques, meme si presents dans une blocklist. Priorite sur les blocklists. Utile pour les faux positifs.

### 4.6 Statistiques DNS
Panneau de statistiques :
- Requetes totales aujourd'hui (compteur anime)
- Requetes bloquees aujourd'hui (compteur + pourcentage)
- Graphique temporel des requetes (resolues vs bloquees) sur 24h/7j/30j
- Top 10 domaines les plus resolus (avec nombre de requetes)
- Top 10 domaines les plus bloques (avec categorie de blocage)
- Top 10 clients (IPs) avec le plus de requetes

### 4.7 DNS over HTTPS (DoH) et DNS over TLS (DoT)
Support des protocoles DNS chiffres pour les requetes sortantes :
- Configuration du resolver upstream (Cloudflare 1.1.1.1/1.0.0.1, Google 8.8.8.8/8.8.4.4, Quad9 9.9.9.9, custom)
- Choix du protocole (UDP classique, DoH, DoT)
- Fallback automatique si le resolver principal est indisponible

### 4.8 DNS cache
Cache local des resolutions DNS :
- TTL respecte pour chaque enregistrement
- Taille du cache configurable (defaut : 10000 entrees)
- Statistiques de hit/miss ratio
- Bouton `Flush Cache` pour vider le cache manuellement

---

## Categorie 5 — Securite et acces

### 5.1 Authentification des tunnels
Chaque tunnel est authentifie via :
- **JWT** : token emis par signapps-identity, valide par le relais. Claims : user_id, org_id, tunnel_permissions.
- **WireGuard keys** : paire de cles Curve25519 generee a la creation du tunnel. La cle publique est enregistree sur le relais.
- **mTLS** (optionnel) : certificat client pour les tunnels HTTPS sensibles.

### 5.2 Chiffrement du trafic
Tout le trafic tunnel est chiffre :
- **WireGuard** (protocole par defaut pour TCP/UDP) : ChaCha20-Poly1305, Curve25519, BLAKE2s
- **TLS 1.3** (pour HTTP/HTTPS) : AES-256-GCM ou ChaCha20-Poly1305
Pas de fallback vers des versions de protocole obsoletes (TLS 1.0/1.1 refuse).

### 5.3 Politiques d'acces
Regles d'acces par tunnel :
- IP whitelist / blacklist (IPv4, IPv6, CIDR)
- Plages horaires autorisees (ex: lundi-vendredi 8h-20h)
- Groupes utilisateurs autorises (integration RBAC signapps-identity)
- Device posture (optionnel, futur : OS minimum, antivirus actif)

### 5.4 Protection DDoS
Detection et mitigation automatique :
- Rate limiting par IP (configurable par tunnel, defaut : 100 req/s)
- Detection de spike de trafic (> 5x la moyenne sur 5 minutes)
- Challenge mode : CAPTCHA pour les requetes suspectes (HTTP uniquement)
- Blocage automatique des IPs offensantes (duree configurable, defaut : 1h)
- Dashboard de mitigation : attaques en cours, IPs bloquees, trafic filtre

### 5.5 Certificats TLS automatiques
Chaque tunnel HTTPS recoit un certificat TLS automatique :
- Generation via Let's Encrypt (ACME) pour les sous-domaines publics
- Certificat auto-signe pour les tunnels internes
- Renouvellement automatique 30 jours avant expiration
- Indicateur de validite dans la liste des tunnels

### 5.6 Audit trail
Journalisation de tous les evenements de securite :
- Connexions/deconnexions de tunnel avec IP source et duree
- Modifications de configuration (par qui, quoi, quand)
- Tentatives d'acces refusees (IP non-autorisee, token invalide)
- Alertes DDoS declenchees et mitigees
- Changements de politique d'acces
Format structure (JSON) pour integration avec les outils de SIEM.

---

## Categorie 6 — Historique et logs

### 6.1 Logs de connexion
Table chronologique des sessions tunnel : date/heure debut, date/heure fin, tunnel, IP source, user agent, duree de session, bytes transferes (up/down), statut de deconnexion (clean/timeout/error).

### 6.2 Logs de trafic
Metriques de trafic agregees par tunnel et par periode (heure/jour/semaine) : bytes in, bytes out, requetes (HTTP), connexions (TCP/UDP), erreurs. Graphiques exportables.

### 6.3 Logs DNS
Journal des requetes DNS : timestamp, client IP, domaine demande, type de requete (A/AAAA/CNAME), resultat (resolved/blocked/NXDOMAIN), categorie de blocage (si bloque), temps de resolution (ms).

### 6.4 Export des logs
Export CSV, JSON, ou Syslog des logs filtres par :
- Periode (date debut/fin)
- Tunnel specifique
- Type d'evenement (connexion, trafic, DNS, securite)
- Niveau de severite (info, warning, error, critical)
Utile pour la conformite, l'audit, et l'integration SIEM.

### 6.5 Retention des logs
Politique configurable par type de log :
- Logs de connexion : 90 jours (defaut)
- Logs de trafic agrege : 365 jours (defaut)
- Logs DNS : 30 jours (defaut, volume eleve)
- Logs de securite : 365 jours (defaut, audit)
Archivage automatique vers le stockage SignApps (module Drive) pour les logs expires.

### 6.6 Recherche dans les logs
Barre de recherche full-text dans les logs. Filtres combines : tunnel + periode + type + severite + texte libre. Resultats pagines avec highlighting des termes recherches.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Cloudflare Tunnel Documentation** (developers.cloudflare.com/cloudflare-one/connections/connect-networks) — zero-trust tunnels, DNS routing, Access policies, analytics.
- **ngrok Documentation** (ngrok.com/docs) — tunnels, HTTP inspection, traffic policy, domains, edges.
- **Tailscale Documentation** (tailscale.com/kb) — mesh VPN, ACL, MagicDNS, DERP relay, Funnel.
- **WireGuard Documentation** (wireguard.com/papers/wireguard.pdf) — protocole cryptographique, configuration, performance benchmarks.
- **Pi-hole Documentation** (docs.pi-hole.net) — DNS filtering, blocklists, gravity, group management, API.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **rathole** (github.com/rapiz1/rathole) | **Apache-2.0** | Tunnel reverse proxy en Rust. Architecture client/serveur, noise protocol encryption, multiplexing, hot reload. Reference principale pour les tunnels. |
| **bore** (github.com/ekzhang/bore) | **MIT** | Tunnel TCP minimaliste en Rust. NAT traversal, protocole binaire, assignation de port. Pattern pour le Quick Connect. |
| **frp** (github.com/fatedier/frp) | **Apache-2.0** | Reverse proxy tunnel. Multi-protocole (TCP/UDP/HTTP/HTTPS), dashboard web, load balancing, plugins, TLS, bandwidth limiting. |
| **Netbird** (github.com/netbirdio/netbird) | **BSD-3-Clause** | Mesh VPN WireGuard. Management server, ACL, DNS, relay servers, route management. Pattern pour la gestion des relais et politiques. |
| **Firezone** (github.com/firezone/firezone) | **Apache-2.0** | VPN WireGuard avec admin portal. Dashboard, policies, audit logs, SSO. Pattern pour l'interface d'administration. |
| **trust-dns** (github.com/hickory-dns/hickory-dns) | **MIT/Apache-2.0** | Serveur DNS en Rust. Resolution, cache, DNSSEC, DoH, DoT. Base pour le serveur DNS integre. |
| **boringtun** (github.com/cloudflare/boringtun) | **BSD-3-Clause** | Implementation WireGuard en Rust (userspace) par Cloudflare. Pattern pour l'integration WireGuard sans module kernel. |
| **warp** (github.com/seanmonstar/warp) | **MIT** | Framework HTTP Rust. Pattern pour le proxy HTTP et l'inspection de trafic (deja utilise via Axum/hyper ecosystem). |
| **recharts** (github.com/recharts/recharts) | **MIT** | Graphiques React pour les charts de trafic et statistiques DNS. Composable, responsive, performant. |
| **blocky** (github.com/0xERR0R/blocky) | **Apache-2.0** | DNS proxy avec blocklists en Go. Pattern pour le DNS filtering, group management, caching, conditional forwarding. |

### Pattern d'implementation recommande
1. **Tunnel server** : service signapps-securelink (port 3006) en Axum. Chaque tunnel est un task tokio avec un channel bidirectionnel (client ↔ relais ↔ target).
2. **Protocole tunnel** : noise protocol (via `snow` crate, Apache-2.0) pour le handshake, puis stream chiffre. Multiplexing via yamux ou les streams natifs.
3. **DNS server** : hickory-dns (MIT/Apache-2.0) comme resolver embarque. Blocklists chargees en memoire (HashMap de domaines). Cache LRU avec TTL.
4. **Relay management** : chaque relais expose un health endpoint. Le serveur central poll les relais toutes les 30s. Table `securelink_relays` dans PostgreSQL.
5. **Trafic chart** : donnees stockees en time-series dans PostgreSQL (1 row par minute par tunnel : bytes_in, bytes_out, requests). Retention configurable. Frontend : recharts area chart avec WebSocket pour le mode live.
6. **Metrics** : export Prometheus via signapps-metrics. Labels : tunnel_id, relay_id, protocol.

### Ce qu'il ne faut PAS faire
- **Pas de trafic non-chiffre** — meme les tunnels internes sont chiffres.
- **Pas de port ouvert sur la destination** — le tunnel est initie par le client, pas de port d'ecoute cote destination.
- **Pas de DNS sans cache** — chaque requete DNS non-cachee ajoute de la latence.
- **Pas de copier-coller** depuis les projets ci-dessus. On s'inspire des patterns, on reecrit.
- **Pas de dependance GPL/AGPL** — meme comme dependance transitive (cargo deny bloque). Pi-hole et AdGuard Home sont des references pedagogiques uniquement.
- **Pas de single relay** — toujours au moins 2 relais pour le failover.
- **Pas de blocklist hardcodee** — les listes sont mises a jour dynamiquement depuis des sources externes.

---

## Assertions E2E cles (a tester)

- Navigation vers `/securelink` → le titre "SecureLink" et la description s'affichent
- Onglet Dashboard → les 4 cartes KPI (Active Tunnels, Active Relays, DNS Queries Today, Blocked Queries) s'affichent avec des valeurs
- Graphique de trafic → le chart se rend avec les axes timestamp (X) et bandwidth (Y)
- Bouton `Refresh` → les donnees du dashboard se rechargent
- Quick Connect → un tunnel est cree et active en moins de 5 secondes, URL publique affichee
- Onglet Tunnels → le tableau des tunnels s'affiche avec colonnes (nom, adresse, sous-domaine, protocole, statut, trafic)
- Creer un tunnel manuellement → il apparait dans la liste avec statut `connected`
- Editer un tunnel → les parametres sont mis a jour sans coupure
- Desactiver un tunnel → le statut passe a `disconnected`, le trafic est coupe
- Reactiver un tunnel → reconnexion en moins de 5 secondes
- Supprimer un tunnel → il disparait de la liste apres confirmation
- Dupliquer un tunnel → nouveau tunnel cree avec memes parametres et sous-domaine different
- Inspection HTTP → les requetes s'affichent en temps reel avec methode, URL, status code
- Onglet Relays → le tableau des relais s'affiche avec latence et statut
- Ajouter un relais → il apparait dans la liste, health check vert apres validation
- Failover → si un relais tombe, les tunnels migrent automatiquement vers un autre relais
- Onglet DNS → la liste des enregistrements s'affiche
- Ajouter un enregistrement DNS (type A) → il apparait dans la liste
- Activer la blocklist Malware → le nombre de domaines bloques s'affiche
- Statistiques DNS → graphique requetes resolues vs bloquees, top 10 domaines
- Allowlist DNS → un domaine en allowlist n'est pas bloque meme si present dans une blocklist
- IP Whitelist sur un tunnel → les requetes d'IPs non-autorisees recoivent HTTP 403
- Rate limiting → les requetes au-dela du seuil recoivent HTTP 429
- Export des logs en CSV → fichier telecharge avec les colonnes attendues
- Recherche dans les logs → les resultats filtres s'affichent avec highlighting
