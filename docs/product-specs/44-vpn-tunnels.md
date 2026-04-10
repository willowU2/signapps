# Module VPN & Tunnels (Tunnels Web) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Cloudflare Tunnel** | Zero-trust access sans ouvrir de ports, tunnel chiffre automatique, DNS intelligent, protection DDoS integree, Access policies (identite + device posture), dashboard traffic analytics, split tunneling, WARP client |
| **ngrok** | Exposition localhost en un clic, dashboard web, replay de requetes, inspection HTTP, domaines custom, TLS automatique, IP whitelisting, webhooks, API, edge labels, traffic policy |
| **Tailscale** | Mesh VPN WireGuard, zero-config, MagicDNS, ACL policies, exit nodes, subnet routers, funnel (partage public), SSH via Tailscale, taildrop (transfert de fichiers), audit logs |
| **WireGuard** | Protocole VPN moderne, ultra-leger (~4000 lignes de code), performance superieure a OpenVPN/IPSec, chiffrement state-of-the-art (Noise protocol), kernel-space, configuration minimale |
| **ZeroTier** | SDN (software-defined networking), reseau virtuel Layer 2, peer-to-peer, central controller, regles de flux, multipath, bridging, fonctionne derriere NAT sans port forwarding |
| **Netbird** | Open source, WireGuard-based mesh, SSO integration (OIDC), ACL policies, relay servers, DNS management, route management, posture checks, dashboard admin, multi-OS |
| **Firezone** | Open source, WireGuard-based, SSO/OIDC, admin portal, split tunneling, auto-expiring configs, NAT traversal, DNS-based traffic filtering, audit logs, multi-site |
| **Pritunl** | Open source, serveur VPN enterprise, multi-server clustering, SSO (SAML/RADIUS/DUO), audit logging, organisation multi-tenant, client cross-platform, link aggregation |

## Principes directeurs

1. **Quick Connect en un clic** — creer et activer un tunnel doit prendre moins de 30 secondes. Un bouton `Quick Connect` pre-remplit les champs et demarre le tunnel immediatement.
2. **Dashboard temps reel** — le tableau de bord affiche en temps reel : nombre de tunnels actifs, trafic entrant/sortant, alertes DDoS, IPs bloquees. Graphique de trafic 24h avec echantillonnage par minute.
3. **Securite zero-trust** — chaque tunnel est authentifie, chiffre (WireGuard/TLS), et soumis a des politiques d'acces. Le DNS filtering bloque les domaines malveillants. Protection DDoS integree.
4. **DNS intelligent** — resolution DNS custom avec blocklists (malware, tracking, adult), enregistrements personnalises, et statistiques de requetes. Integration DHCP pour le reseau local.
5. **Gestion des relais** — les relais (relay servers) assurent la connectivite quand le NAT traversal echoue. Dashboard de sante des relais avec latence et bande passante.
6. **Audit complet** — chaque connexion, deconnexion, changement de configuration, et evenement de securite est logge avec horodatage, IP source, et identite utilisateur.

---

## Categorie 1 — Dashboard et monitoring

### 1.1 Vue d'ensemble (Dashboard)
Onglet principal affiche en haut 4 cartes KPI alignees horizontalement :
- **Tunnels actifs** : nombre + icone signal (vert si > 0, gris si 0). Sous-texte : `X sur Y tunnels`
- **Trafic total 24h** : bytes formates intelligemment (`1.2 GB`, `456 MB`, `12 KB`). Icone fleches bidirectionnelles. Sous-texte : `Upload: X / Download: Y`
- **Requetes DNS** : nombre total de requetes DNS resolues dans les 24h. Icone globe. Sous-texte : `dont X bloquees`
- **Alertes securite** : nombre d'alertes actives. Icone bouclier. Couleur rouge si > 0, vert si 0. Sous-texte : `X DDoS mitigees, Y IPs bloquees`

Les KPIs se rafraichissent toutes les 30 secondes via polling (`GET /api/v1/securelink/stats`). Animation de transition sur les chiffres (countUp de 300ms).

### 1.2 Graphique de trafic 24h
Area chart en dessous des KPIs (hauteur 250px, pleine largeur). Deux courbes empilees :
- **Download** (inbound) : couleur `primary` avec remplissage transparent
- **Upload** (outbound) : couleur `secondary` avec remplissage transparent

Axe X : 24 heures (echantillonnage par minute, 1440 points). Axe Y : debit en bytes/s (formate adaptativement). Tooltip au hover : `14:32 — Download: 12.4 MB/s, Upload: 3.2 MB/s`. Zoom possible par selection de zone (drag horizontal). Bouton `Reset zoom` pour revenir a la vue 24h. Les donnees sont recuperees via `GET /api/v1/securelink/traffic?period=24h&interval=1m`.

### 1.3 Quick Connect
Bouton `Quick Connect` prominent en haut a droite (bouton primary, icone eclair). Clic declenche la creation automatique d'un tunnel avec :
- Nom auto-genere : `tunnel-{random-4-chars}` (ex: `tunnel-a7f3`)
- Adresse locale : `localhost:3000` (editable dans un mini-formulaire inline qui s'ouvre)
- Sous-domaine auto-genere : `{tunnel-name}.{org-domain}.signapps.tunnel`
- Protocole : HTTP (defaut)
- TLS : active automatiquement (Let's Encrypt)

Le tunnel est cree et active en une seule action. Feedback visuel : bouton passe en loading (spinner), puis affiche `Connecte !` avec l'URL publique cliquable (copie dans le presse-papier au clic). Temps cible : <5 secondes entre le clic et la connexion.

### 1.4 Statut des relais
Section `Relais` sous le graphique de trafic. Table compacte avec colonnes :
- **Nom** : identifiant du relay (ex: `relay-eu-west-1`, `relay-us-east-1`)
- **Region** : drapeau emoji + nom (ex: `Europe (Paris)`)
- **Latence** : mesure en ms avec couleur (vert < 50ms, jaune 50-150ms, rouge > 150ms)
- **Bande passante** : capacite disponible en Mbps
- **Connexions** : nombre de tunnels routant via ce relay
- **Statut** : badge `En ligne` (vert), `Degrade` (jaune), `Hors ligne` (rouge)

Les mesures de latence sont rafraichies toutes les 60 secondes via ping ICMP ou HTTP health check. Clic sur un relay ouvre un panneau de detail avec graphique historique de latence sur 7 jours.

### 1.5 Alertes DDoS et IPs bloquees
Section `Securite` avec deux sous-sections :
- **Alertes DDoS recentes** : table des 10 dernieres alertes avec : date/heure, tunnel cible, type d'attaque (SYN flood, HTTP flood, UDP amplification), duree, action prise (rate limited, blocked, challenged). Badge de severite : `Info` (bleu), `Warning` (jaune), `Critical` (rouge).
- **IPs bloquees** : table des IPs actuellement bloquees avec : IP, raison (manual, auto-ddos, brute-force), date de blocage, expiration (si temporaire). Boutons : `Debloquer` (par IP), `Ajouter une IP` (blocage manuel).

### 1.6 Uptime et disponibilite
Barre de disponibilite sur les 30 derniers jours (30 rectangles verticaux, 1 par jour). Vert = 100% uptime, jaune = >99% (degradation partielle), rouge = <99% (incident). Hover sur un jour affiche : date, uptime %, incidents (s'il y en a). Pourcentage global en gras a droite : `99.97% uptime`.

---

## Categorie 2 — Gestion des tunnels

### 2.1 Liste des tunnels
Onglet `Tunnels` avec table principale :
- **Nom** : texte editable inline (double-clic pour renommer)
- **Adresse locale** : `host:port` (ex: `localhost:3000`, `192.168.1.10:8080`)
- **URL publique** : sous-domaine complet, cliquable (ouvre dans un nouvel onglet), bouton copie a droite
- **Protocole** : badge `HTTP` (bleu), `HTTPS` (vert), `TCP` (gris), `UDP` (jaune)
- **Statut** : toggle switch `Actif` (vert) / `Inactif` (gris) — cliquable pour activer/desactiver
- **Trafic** : total bytes transferes (formate, ex: `1.2 GB`)
- **Cree le** : date relative (`il y a 3 jours`)
- **Actions** : menu `...` avec : Editer, Dupliquer, Voir les logs, Supprimer

Tri par nom (defaut) ou date. Filtre par statut (Tous, Actifs, Inactifs). Recherche par nom ou URL.

### 2.2 Creation de tunnel (wizard)
Bouton `+ Nouveau tunnel` ouvre un wizard en 3 etapes :

**Etape 1 — Configuration de base :**
- **Nom** (texte, obligatoire, max 50 caracteres, regex `[a-z0-9-]+`)
- **Adresse locale** (texte, obligatoire, format `host:port`, validation en temps reel)
- **Protocole** (select : HTTP, HTTPS, TCP, UDP)

**Etape 2 — Endpoint public :**
- **Sous-domaine** (texte, pre-rempli avec le nom, suffixe `.{org}.signapps.tunnel`). Verification de disponibilite en temps reel (icone check vert ou croix rouge)
- **TLS termination** (checkbox, defaut active pour HTTP/HTTPS) — certificat Let's Encrypt auto-provisionne

**Etape 3 — Securite :**
- **Authentification** (select : Aucune, Basic Auth, Bearer Token, mTLS)
  - Basic Auth : champs username + password
  - Bearer Token : champ token (genere automatiquement, copiable)
  - mTLS : upload du certificat client CA
- **IP Whitelist** (textarea, une IP ou CIDR par ligne, optionnel)
- **Rate limiting** (toggle + input : max requetes par minute, defaut 1000)

Bouton `Creer le tunnel` en etape 3. Le tunnel est cree et active immediatement. Redirection vers la page de detail du tunnel.

### 2.3 Edition de tunnel
Clic sur `Editer` dans le menu actions ouvre le meme formulaire que le wizard mais pre-rempli. Modification de n'importe quel champ sauf le sous-domaine (qui est immutable apres creation — pour changer, il faut creer un nouveau tunnel). Les changements de configuration sont appliques a chaud sans coupure du tunnel (hot-reload). Toast : `Configuration mise a jour`.

### 2.4 Activation / Desactivation
Toggle switch dans la colonne `Statut` de la table. Clic active/desactive le tunnel instantanement :
- **Desactiver** : le tunnel cesse de router le trafic. L'URL publique retourne HTTP 503 `Service Unavailable`. La configuration est preservee. Les ressources serveur sont liberees.
- **Activer** : le tunnel reprend le routage. Connexion au backend local verifiee. Si le backend local est injoignable, avertissement `L'adresse locale ${host}:${port} ne repond pas`.

Transition animee du toggle (200ms). Le statut est mis a jour en base via `PATCH /api/v1/securelink/tunnels/:id { active: true|false }`.

### 2.5 Suppression de tunnel
Bouton `Supprimer` dans le menu actions. Dialogue de confirmation : `Supprimer definitivement le tunnel "${nom}" ? L'URL publique sera liberee. Les donnees de trafic historiques seront conservees pour l'audit.` Champ de saisie du nom pour confirmer (pattern GitHub). Suppression libere le sous-domaine. Soft-delete en base (le tunnel est marque `deleted` mais conserve pour l'audit). Les logs de trafic historiques restent accessibles via l'onglet Audit.

### 2.6 Duplication de tunnel
Bouton `Dupliquer` dans le menu actions. Cree un nouveau tunnel avec les memes parametres (nom, adresse locale, protocole, securite) sauf le sous-domaine qui est auto-genere avec un suffixe `-copy`. Le nouveau tunnel est cree en statut inactif pour eviter les conflits. L'utilisateur active manuellement apres verification.

### 2.7 WireGuard VPN tunnel creation
Pour les tunnels VPN (type WireGuard), le wizard differe :

**Etape 1 — Configuration WireGuard :**
- **Nom du tunnel** (texte)
- **Adresse du serveur** (endpoint IP:port)
- **Plage d'IPs** (CIDR pour le reseau VPN, ex: `10.0.0.0/24`)
- **DNS** (adresses DNS a utiliser dans le tunnel, defaut : DNS SignApps)
- **Allowed IPs** (CIDR des reseaux accessibles via le tunnel, defaut `0.0.0.0/0` pour tout router)

**Etape 2 — Peers :**
- Ajout de peers (un par appareil client). Pour chaque peer :
  - Nom (ex: `Laptop Etienne`, `iPhone Marie`)
  - Cle publique (generee automatiquement, ou saisie manuelle)
  - IP assignee dans le tunnel (auto-assignee depuis la plage)
  - Allowed IPs du peer

**Etape 3 — Options avancees :**
- **Kill switch** (toggle) — bloque tout trafic internet si le VPN se deconnecte
- **Split tunneling** (toggle) — ne router que certains reseaux via le VPN (au lieu de tout le trafic)
- **Auto-connect** (toggle) — se connecter automatiquement sur les reseaux non-fiables (WiFi public)
- **Keepalive** (input, defaut 25 secondes) — intervalle de keepalive pour maintenir le NAT

### 2.8 Peer management (WireGuard)
Page de detail d'un tunnel WireGuard avec section `Peers` :
- Table des peers : nom, IP assignee, cle publique (tronquee), derniere connexion, trafic, statut (connecte/deconnecte)
- Bouton `+ Ajouter un peer` → dialogue avec nom + generation de cles
- Pour chaque peer, bouton `QR Code` genere un QR code contenant la configuration WireGuard complete du peer (scannable par l'app WireGuard mobile). Le QR code s'affiche dans un dialogue modal avec bouton `Telecharger le QR` (PNG) et `Copier la config` (texte)
- Bouton `Telecharger la config` exporte un fichier `.conf` compatible avec le client WireGuard officiel
- Bouton `Revoquer` desactive le peer (sa cle est retiree du serveur)

### 2.9 Client config export
Pour les tunnels WireGuard, export de la configuration client dans les formats :
- **WireGuard** (`.conf`) — format natif, compatible avec tous les clients WireGuard
- **OpenVPN** (`.ovpn`) — format OpenVPN pour les clients legacy (conversion automatique)
- **JSON** — pour les integrations programmatiques

Bouton `Exporter la config` avec dropdown de format. Le fichier inclut : endpoint serveur, cles, DNS, allowed IPs, keepalive. Les cles privees sont incluses uniquement dans l'export — jamais stockees cote serveur.

---

## Categorie 3 — Gestion des IPs et securite

### 3.1 Liste des IPs
Onglet `IPs` avec table des IPs associees au compte :
- **IP publique** : adresse IPv4 ou IPv6 attribuee
- **Type** : `Tunnel` (IP d'un tunnel), `VPN` (IP du VPN), `Relay` (IP d'un relay)
- **Tunnel/VPN associe** : nom du tunnel ou VPN lie
- **Statut** : badge `Active` (vert), `Expiree` (gris), `Bloquee` (rouge)
- **Attribuee le** : date
- **Expire le** : date (ou `Permanent`)

Support IPv4 et IPv6 natif. Les IPs des tunnels sont des sous-domaines DNS resolus, pas des IPs statiques (sauf configuration avancee).

### 3.2 IP Whitelisting
Configuration par tunnel dans les parametres de securite. Textarea avec une IP ou CIDR par ligne. Les requetes provenant d'IPs non listees recoivent HTTP 403 `Forbidden` avec body JSON `{ "error": "ip_not_allowed", "detail": "Your IP X.X.X.X is not in the whitelist" }`. Validation en temps reel du format IP/CIDR (regex + parsing). Support IPv4 et IPv6. Max 100 entrees par whitelist. Preview : `12 IPs/reseaux autorises`.

### 3.3 IP Blocklist
Onglet `IPs > Bloquees` avec table des IPs bloquees :
- **IP** : adresse bloquee
- **Raison** : badge `Manuel` (gris), `DDoS auto` (rouge), `Brute-force` (orange)
- **Date de blocage** : timestamp
- **Expiration** : date (ou `Permanent` pour les blocages manuels)
- **Actions** : `Debloquer` (avec confirmation)

Ajout manuel via bouton `+ Bloquer une IP`. Formulaire : IP (texte, validation format), raison (textarea), duree (select : 1h, 24h, 7j, 30j, Permanent). Les blocages automatiques (DDoS, brute-force) ont une duree par defaut de 24h, configurable dans les parametres de securite.

### 3.4 Certificats TLS
Onglet `Certificats` avec table des certificats TLS geres :
- **Domaine** : sous-domaine du tunnel
- **Emetteur** : `Let's Encrypt` ou `Internal CA`
- **Valide du** / **Valide jusqu'au** : dates
- **Statut** : badge `Valide` (vert), `Expire bientot` (jaune, <30j), `Expire` (rouge)
- **Renouvellement auto** : toggle (active par defaut pour Let's Encrypt)

Renouvellement automatique 30 jours avant expiration. Notification push + email si le renouvellement echoue. Bouton `Renouveler maintenant` pour forcer le renouvellement. Support des certificats custom (upload PEM) pour les domaines custom.

### 3.5 Authentification par tunnel
Configuration dans les parametres de securite de chaque tunnel :
- **Aucune** : le tunnel est public (utile pour les webhooks, les demos)
- **Basic Auth** : username + password. Le navigateur affiche la boite de dialogue standard. Credentials stockes hashes (bcrypt) en base.
- **Bearer Token** : token genere aleatoirement (32 bytes hex). L'appelant doit inclure `Authorization: Bearer {token}` dans chaque requete.
- **mTLS** : certificat client requis. Upload du CA root qui signe les certificats clients. Seuls les clients avec un certificat signe par ce CA sont acceptes.
- **SignApps Auth** : integration avec le SSO SignApps (JWT). L'utilisateur doit etre authentifie via signapps-identity pour acceder au tunnel. Redirection vers la page de login si non authentifie.

### 3.6 Protection DDoS
Configuration globale et par tunnel :
- **Rate limiting** : nombre max de requetes par minute par IP (defaut 1000, configurable 10-10000)
- **Challenge mode** : si le rate limit est depasse, l'IP recoit un challenge JavaScript (CAPTCHA-like) au lieu d'un blocage direct. Si le challenge est resolu, le trafic reprend normalement.
- **Blocage automatique** : si une IP depasse 5x le rate limit, elle est bloquee automatiquement pour 24h
- **Seuil d'alerte DDoS** : si le trafic global depasse X Mbps (configurable), une alerte est creee. L'admin recoit une notification push + email.

Dashboard de mitigation en temps reel accessible via `Securite > DDoS` avec : nombre de requetes bloquees (compteur), IPs les plus actives (top 10), types d'attaque detectes.

---

## Categorie 4 — DNS et filtrage

### 4.1 Configuration DNS
Onglet `DNS` avec panneau de gestion DNS. Table des enregistrements existants :
- **Type** : badge colore (`A` bleu, `AAAA` violet, `CNAME` vert, `TXT` gris, `MX` orange, `SRV` cyan, `NS` jaune)
- **Nom** : sous-domaine ou `@` pour la racine
- **Valeur** : IP, domaine, ou texte selon le type
- **TTL** : duree en secondes (affiche en format humain : `5 min`, `1 h`, `1 jour`)
- **Actions** : editer, supprimer

Les enregistrements des tunnels sont geres automatiquement (CNAME vers le relay). Les enregistrements custom sont editables.

### 4.2 Creation d'enregistrement DNS
Bouton `+ Nouvel enregistrement` ouvre un formulaire :
- **Type** (select : A, AAAA, CNAME, TXT, MX, SRV, NS, CAA)
- **Nom** (texte, validation selon le type — ex: `www`, `mail`, `@`)
- **Valeur** (texte, validation selon le type — ex: format IP pour A/AAAA, domaine pour CNAME/MX)
- **Priorite** (numero, visible uniquement pour MX et SRV)
- **TTL** (select : Auto (300s), 1 min, 5 min, 30 min, 1 h, 12 h, 1 jour)

Validation en temps reel du format. Preview de l'enregistrement sous le formulaire. Propagation du DNS en 1-5 minutes (indicateur `Propagation en cours...` puis `Propage`).

### 4.3 Blocklists DNS
Section `Filtrage` dans l'onglet DNS. Toggle par categorie de blockliste :
- **Malware** — domaines malveillants connus (sources : URLhaus, PhishTank). Badge `X domaines`
- **Tracking / Publicite** — trackers et ad networks (source : EasyList, Peter Lowe). Badge `X domaines`
- **Contenu adulte** — domaines pornographiques
- **Reseaux sociaux** — Facebook, Twitter, TikTok, etc. (utile pour les reseaux d'entreprise)
- **Jeux d'argent** — sites de gambling

Chaque categorie affiche le nombre de domaines bloques. Toggle actif = les requetes DNS vers ces domaines retournent NXDOMAIN. Les blocklistes sont mises a jour quotidiennement depuis les sources publiques.

Custom blocklist : textarea pour ajouter des domaines manuellement (un par ligne). Custom allowlist : domaines a exclure du blocage meme s'ils sont dans une liste (whitelisting).

### 4.4 DNS over HTTPS (DoH) / DNS over TLS (DoT)
Section `Chiffrement` dans l'onglet DNS. Configuration du protocole de resolution :
- **DoH** (DNS over HTTPS) — toggle, URL affichee : `https://dns.{org}.signapps.tunnel/dns-query`
- **DoT** (DNS over TLS) — toggle, endpoint : `dns.{org}.signapps.tunnel:853`

Resolver upstream configurable (select avec options) :
- Cloudflare (`1.1.1.1`, `1.0.0.1`)
- Google (`8.8.8.8`, `8.8.4.4`)
- Quad9 (`9.9.9.9`)
- Custom (champs IP + port)

### 4.5 Statistiques DNS
Section `Statistiques` dans l'onglet DNS :
- **Compteurs** : requetes totales (24h), requetes bloquees, requetes autorisees, ratio de blocage (%)
- **Top 10 domaines resolus** : table avec domaine, nombre de requetes, derniere requete
- **Top 10 domaines bloques** : table avec domaine, nombre de tentatives, categorie de blocage
- **Repartition par type** : donut chart (A, AAAA, CNAME, MX, TXT, Other)
- **Graphique horaire** : line chart des requetes par heure sur 24h (autorisees en vert, bloquees en rouge)

Les statistiques sont calculees via `GET /api/v1/securelink/dns/stats?period=24h`.

### 4.6 DHCP integration
Section `DHCP` dans l'onglet DNS (visible uniquement si un VPN est configure). Configuration du serveur DHCP :
- **Plage d'IPs** : debut-fin (ex: `10.0.0.100` - `10.0.0.200`)
- **Masque** : (ex: `255.255.255.0`)
- **Passerelle** : IP de la gateway
- **DNS** : IPs des serveurs DNS (pre-rempli avec le DNS SignApps)
- **Duree du bail** : select (1h, 12h, 1j, 7j)

Table des baux actifs : IP attribuee, MAC address, hostname, date d'attribution, expiration. Bouton `Reserver` pour creer un bail statique (reservation MAC → IP).

---

## Categorie 5 — Historique et audit

### 5.1 Logs de connexion
Onglet `Historique` avec table chronologique (plus recent en haut) :
- **Date/heure** : timestamp format `JJ/MM/YYYY HH:MM:SS`
- **Tunnel** : nom du tunnel avec lien
- **Action** : badge `Connexion` (vert), `Deconnexion` (gris), `Erreur` (rouge), `Config change` (bleu)
- **IP source** : adresse IP du client
- **User Agent** : navigateur/client (tronque, hover pour le complet)
- **Duree** : duree de la session (si applicable)
- **Details** : texte contextuel (ex: `TLS handshake successful`, `Connection refused: backend unreachable`)

Pagination 50 lignes par page. Filtre par tunnel, par action, par date.

### 5.2 Logs de trafic
Sous-onglet `Trafic` dans l'historique. Metriques aggregees par tunnel par heure :
- **Tunnel** : nom
- **Heure** : creneau horaire
- **Bytes In** : trafic entrant (formate)
- **Bytes Out** : trafic sortant (formate)
- **Requetes** : nombre total
- **Erreurs** : nombre d'erreurs (4xx + 5xx)
- **Latence P50/P95/P99** : latence en ms

Export CSV disponible. Graphique de trafic par tunnel selectionnable.

### 5.3 Logs de securite
Sous-onglet `Securite` dans l'historique. Evenements de securite :
- Tentatives DDoS detectees et mitigees
- IPs bloquees automatiquement ou manuellement
- Certificats TLS renouveles (succes/echec)
- Authentifications echouees (basic auth, bearer, mTLS)
- Changements de configuration de securite (whitelist, blocklist, policy)

Chaque evenement a un niveau de severite : `Info` (bleu), `Warning` (jaune), `Critical` (rouge). Les evenements `Critical` declenchent une notification push a l'admin.

### 5.4 Export des logs
Bouton `Exporter` dans chaque sous-onglet. Formats : CSV, JSON. Filtres appliques a l'export. Periode max : 90 jours par export. Nom : `securelink_logs_{type}_{date_debut}_{date_fin}.csv`.

### 5.5 Retention des logs
Politique de retention configurable dans `Settings > SecureLink > Retention` :
- Logs de connexion : 90 jours par defaut (30/90/180/365 jours)
- Logs de trafic : 30 jours par defaut (agrege au-dela)
- Logs de securite : 365 jours par defaut (obligation reglementaire)

Archivage automatique des logs anciens en stockage froid (signapps-storage). Les logs archives restent consultables via un bouton `Charger les archives` mais avec un delai de chargement.

---

## Categorie 6 — Persistance et API

### 6.1 API REST complete

**Base path :** `/api/v1/securelink`

| Methode | Endpoint | Description |
|---|---|---|
| `GET` | `/stats` | KPIs du dashboard. Response : `{ active_tunnels, traffic_24h, dns_requests, security_alerts }` |
| `GET` | `/traffic` | Graphique de trafic. Query params : `period` (1h, 24h, 7d, 30d), `interval` (1m, 5m, 1h) |
| `GET` | `/tunnels` | Liste des tunnels. Query params : `cursor`, `limit`, `status` (active, inactive, all), `search`, `protocol` |
| `GET` | `/tunnels/:id` | Detail d'un tunnel |
| `POST` | `/tunnels` | Creer un tunnel. Body : `{ name, local_address, protocol, subdomain, tls, auth_type, auth_config?, ip_whitelist?, rate_limit? }` |
| `PUT` | `/tunnels/:id` | Modifier un tunnel |
| `PATCH` | `/tunnels/:id` | Patch partiel (ex: activer/desactiver) |
| `DELETE` | `/tunnels/:id` | Supprimer un tunnel (soft-delete) |
| `POST` | `/tunnels/:id/duplicate` | Dupliquer un tunnel |
| `POST` | `/tunnels/quick-connect` | Quick Connect. Body : `{ local_address? }` |
| `GET` | `/vpn` | Liste des tunnels VPN WireGuard |
| `POST` | `/vpn` | Creer un VPN. Body : `{ name, server_endpoint, address_range, dns, allowed_ips, kill_switch?, split_tunnel?, auto_connect?, keepalive? }` |
| `GET` | `/vpn/:id/peers` | Liste des peers |
| `POST` | `/vpn/:id/peers` | Ajouter un peer. Body : `{ name, public_key?, allowed_ips? }` |
| `DELETE` | `/vpn/:id/peers/:peer_id` | Revoquer un peer |
| `GET` | `/vpn/:id/peers/:peer_id/config` | Export config du peer. Query param : `format` (wireguard, openvpn, json) |
| `GET` | `/vpn/:id/peers/:peer_id/qr` | QR code de la config (image PNG) |
| `GET` | `/dns/records` | Liste des enregistrements DNS |
| `POST` | `/dns/records` | Creer un enregistrement |
| `PUT` | `/dns/records/:id` | Modifier un enregistrement |
| `DELETE` | `/dns/records/:id` | Supprimer un enregistrement |
| `GET` | `/dns/blocklists` | Liste des blocklists avec statut |
| `PATCH` | `/dns/blocklists/:category` | Activer/desactiver une blocklist |
| `GET` | `/dns/stats` | Statistiques DNS |
| `GET` | `/ips` | Liste des IPs |
| `GET` | `/ips/blocked` | Liste des IPs bloquees |
| `POST` | `/ips/block` | Bloquer une IP. Body : `{ ip, reason, duration? }` |
| `DELETE` | `/ips/block/:ip` | Debloquer une IP |
| `GET` | `/certificates` | Liste des certificats TLS |
| `POST` | `/certificates/:id/renew` | Forcer le renouvellement |
| `GET` | `/logs/connections` | Logs de connexion. Query params : `tunnel_id`, `action`, `date_from`, `date_to`, `cursor`, `limit` |
| `GET` | `/logs/traffic` | Logs de trafic |
| `GET` | `/logs/security` | Logs de securite |
| `GET` | `/relays` | Liste des relais |

### 6.2 PostgreSQL schema

```sql
-- Tunnels web
CREATE TABLE securelink_tunnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    local_address VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) NOT NULL UNIQUE,
    protocol VARCHAR(10) NOT NULL CHECK (protocol IN ('http', 'https', 'tcp', 'udp')),
    tls_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    auth_type VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'basic', 'bearer', 'mtls', 'signapps')),
    auth_config JSONB DEFAULT '{}'::jsonb,
    ip_whitelist TEXT[] DEFAULT '{}',
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 1000,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    total_bytes_in BIGINT NOT NULL DEFAULT 0,
    total_bytes_out BIGINT NOT NULL DEFAULT 0,
    total_requests BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_securelink_tunnels_user ON securelink_tunnels(user_id, is_deleted);
CREATE INDEX idx_securelink_tunnels_subdomain ON securelink_tunnels(subdomain) WHERE is_deleted = FALSE;

-- VPN WireGuard
CREATE TABLE securelink_vpn (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    server_endpoint VARCHAR(255) NOT NULL,
    server_public_key VARCHAR(44) NOT NULL,
    server_private_key_encrypted BYTEA NOT NULL,
    address_range CIDR NOT NULL,
    dns_servers TEXT[] DEFAULT '{}'::text[],
    allowed_ips TEXT[] DEFAULT '{"0.0.0.0/0"}'::text[],
    kill_switch BOOLEAN NOT NULL DEFAULT FALSE,
    split_tunnel BOOLEAN NOT NULL DEFAULT FALSE,
    auto_connect BOOLEAN NOT NULL DEFAULT FALSE,
    keepalive_seconds INTEGER NOT NULL DEFAULT 25,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_securelink_vpn_user ON securelink_vpn(user_id);

-- Peers WireGuard
CREATE TABLE securelink_vpn_peers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vpn_id UUID NOT NULL REFERENCES securelink_vpn(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    public_key VARCHAR(44) NOT NULL,
    assigned_ip INET NOT NULL,
    allowed_ips TEXT[] DEFAULT '{"0.0.0.0/0"}'::text[],
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    last_handshake_at TIMESTAMPTZ,
    total_bytes_rx BIGINT NOT NULL DEFAULT 0,
    total_bytes_tx BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_securelink_vpn_peers_vpn ON securelink_vpn_peers(vpn_id, is_revoked);

-- Enregistrements DNS
CREATE TABLE securelink_dns_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    record_type VARCHAR(10) NOT NULL CHECK (record_type IN ('A', 'AAAA', 'CNAME', 'TXT', 'MX', 'SRV', 'NS', 'CAA')),
    name VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    priority INTEGER,
    ttl_seconds INTEGER NOT NULL DEFAULT 300,
    is_auto_managed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_securelink_dns_user ON securelink_dns_records(user_id);

-- IPs bloquees
CREATE TABLE securelink_blocked_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip INET NOT NULL,
    reason VARCHAR(50) NOT NULL,
    reason_detail TEXT DEFAULT '',
    blocked_by UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_securelink_blocked_ips_ip ON securelink_blocked_ips(ip);
CREATE INDEX idx_securelink_blocked_ips_expires ON securelink_blocked_ips(expires_at) WHERE expires_at IS NOT NULL;

-- Certificats TLS
CREATE TABLE securelink_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tunnel_id UUID NOT NULL REFERENCES securelink_tunnels(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    issuer VARCHAR(100) NOT NULL DEFAULT 'letsencrypt',
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    certificate_pem TEXT NOT NULL,
    private_key_encrypted BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_securelink_certs_tunnel ON securelink_certificates(tunnel_id);
CREATE INDEX idx_securelink_certs_expiry ON securelink_certificates(valid_until) WHERE auto_renew = TRUE;

-- Logs de connexion
CREATE TABLE securelink_connection_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tunnel_id UUID REFERENCES securelink_tunnels(id) ON DELETE SET NULL,
    vpn_id UUID REFERENCES securelink_vpn(id) ON DELETE SET NULL,
    action VARCHAR(20) NOT NULL,
    source_ip INET,
    user_agent TEXT,
    duration_seconds INTEGER,
    details TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_securelink_conn_logs_tunnel ON securelink_connection_logs(tunnel_id, created_at DESC);
CREATE INDEX idx_securelink_conn_logs_created ON securelink_connection_logs(created_at DESC);

-- Logs de trafic (agrege par heure)
CREATE TABLE securelink_traffic_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tunnel_id UUID NOT NULL REFERENCES securelink_tunnels(id) ON DELETE CASCADE,
    hour TIMESTAMPTZ NOT NULL,
    bytes_in BIGINT NOT NULL DEFAULT 0,
    bytes_out BIGINT NOT NULL DEFAULT 0,
    requests BIGINT NOT NULL DEFAULT 0,
    errors BIGINT NOT NULL DEFAULT 0,
    latency_p50_ms INTEGER,
    latency_p95_ms INTEGER,
    latency_p99_ms INTEGER,
    UNIQUE(tunnel_id, hour)
);

CREATE INDEX idx_securelink_traffic_tunnel_hour ON securelink_traffic_logs(tunnel_id, hour DESC);
```

### 6.3 PgEventBus events

| Event | Payload | Consumers |
|---|---|---|
| `securelink.tunnel.created` | `{ tunnel_id, user_id, name, subdomain }` | Metrics, DNS |
| `securelink.tunnel.activated` | `{ tunnel_id, user_id }` | Metrics |
| `securelink.tunnel.deactivated` | `{ tunnel_id, user_id }` | Metrics |
| `securelink.tunnel.deleted` | `{ tunnel_id, user_id }` | DNS (cleanup records) |
| `securelink.vpn.created` | `{ vpn_id, user_id, name }` | Metrics |
| `securelink.vpn.peer.added` | `{ vpn_id, peer_id, peer_name }` | — |
| `securelink.vpn.peer.revoked` | `{ vpn_id, peer_id }` | — |
| `securelink.ddos.detected` | `{ tunnel_id, attack_type, source_ips, severity }` | Notifications (admin), Audit |
| `securelink.ip.blocked` | `{ ip, reason, blocked_by, expires_at }` | Audit |
| `securelink.ip.unblocked` | `{ ip, unblocked_by }` | Audit |
| `securelink.certificate.renewed` | `{ cert_id, tunnel_id, domain, valid_until }` | — |
| `securelink.certificate.renewal_failed` | `{ cert_id, tunnel_id, domain, error }` | Notifications (admin) |

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Cloudflare Tunnel Documentation** (developers.cloudflare.com/cloudflare-one/connections/connect-networks) — zero-trust tunnels, configuration, policies.
- **ngrok Documentation** (ngrok.com/docs) — tunnels, inspection, API, domains.
- **Tailscale Documentation** (tailscale.com/kb) — mesh VPN, ACL, DNS, relay, SSH.
- **WireGuard Documentation** (wireguard.com/papers) — protocole, configuration, performance.
- **Netbird Documentation** (docs.netbird.io) — mesh VPN, SSO, ACL, routes, DNS.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **rathole** (github.com/rapiz1/rathole) | **Apache-2.0** | Tunnel reverse proxy en Rust. Reference principale pour l'architecture tunnel. Performant, leger. |
| **bore** (github.com/ekzhang/bore) | **MIT** | Tunnel TCP minimaliste en Rust. Pattern pour le NAT traversal et le protocole tunnel. |
| **frp** (github.com/fatedier/frp) | **Apache-2.0** | Reverse proxy tunnel en Go. Dashboard web, multi-protocole (TCP/UDP/HTTP/HTTPS), TLS, plugins. |
| **Netbird** (github.com/netbirdio/netbird) | **BSD-3-Clause** | Mesh VPN WireGuard. Pattern pour le management, les ACL, le DNS, les relay servers. |
| **Firezone** (github.com/firezone/firezone) | **Apache-2.0** | VPN WireGuard avec admin portal. Pattern pour le dashboard, les policies, l'audit. |
| **AdGuard Home** (github.com/AdguardTeam/AdGuardHome) | **GPL-3.0** | **INTERDIT** — reference pedagogique uniquement. DNS filtering, blocklists, dashboard. |
| **Pi-hole** (github.com/pi-hole/pi-hole) | **EUPL** | Reference pedagogique uniquement pour le DNS filtering et les statistiques. |
| **recharts** (github.com/recharts/recharts) | **MIT** | Graphiques React pour les charts de trafic et metriques. |

---

## Assertions E2E cles (a tester)

- Onglet Dashboard → les 4 KPIs s'affichent avec des valeurs (ou zero si pas de tunnel)
- Graphique de trafic 24h → le graphique se rend avec les courbes download/upload
- Quick Connect → un tunnel est cree et active en moins de 5 secondes, URL publique affichee
- Quick Connect → l'URL publique est copiable dans le presse-papier
- Creer un tunnel via wizard → il apparait dans la liste avec statut `Actif`
- Desactiver un tunnel (toggle) → le statut passe a `Inactif`, l'URL retourne 503
- Reactiver un tunnel → le statut repasse a `Actif`, le trafic reprend
- Supprimer un tunnel → dialogue de confirmation avec saisie du nom, tunnel disparait
- Dupliquer un tunnel → nouveau tunnel cree avec suffixe `-copy`, statut inactif
- Editer un tunnel → les parametres sont mis a jour sans coupure (hot-reload)
- Creer un VPN WireGuard → tunnel VPN cree avec les parametres
- Ajouter un peer → cle generee, IP assignee, config disponible
- QR code d'un peer → image QR affichee, scannable par l'app WireGuard
- Telecharger la config d'un peer → fichier `.conf` valide
- Revoquer un peer → le peer ne peut plus se connecter
- Onglet DNS → la liste des enregistrements s'affiche
- Ajouter un enregistrement DNS (A record) → il apparait dans la liste
- Activer la blocklist `Malware` → le nombre de domaines bloques s'affiche
- Statistiques DNS → top 10 domaines resolus/bloques affiches
- Onglet IPs → la liste des IPs s'affiche
- Bloquer une IP manuellement → elle apparait dans la blocklist
- Debloquer une IP → elle disparait de la blocklist
- Certificat TLS → statut `Valide` affiche pour les tunnels HTTPS
- Onglet Historique → les logs de connexion s'affichent chronologiquement
- Export des logs en CSV → fichier telecharge avec les colonnes attendues
- Alertes DDoS → alerte affichee avec severite et details
- Uptime bar → 30 jours affiches avec couleurs correctes
