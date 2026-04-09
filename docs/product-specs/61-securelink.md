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
Onglet Dashboard avec 4 cartes KPI en haut, disposees en grille 4 colonnes sur desktop, 2x2 sur tablette, pile verticale sur mobile. Chaque carte a un fond subtil, une icone a gauche, la valeur principale en gros, et un sous-texte informatif.

- **Active Tunnels** : nombre de tunnels actuellement connectes. Icone tube/lien vert. Badge arrondi vert a cote du nombre. Sous-texte : tendance par rapport a hier (fleche haut verte "+2" ou fleche bas rouge "-1"). Clic → navigation vers l'onglet Tunnels filtre sur statut "connected". Si aucun tunnel actif : "0" en gris avec sous-texte "No active tunnels — create one with Quick Connect".

- **Active Relays** : nombre de serveurs relais en ligne. Icone serveur. Indicateur de sante aggregate : tous verts → badge "All healthy" (vert), certains degrades → badge "1 degraded" (orange), aucun → badge "All down" (rouge clignotant). Sous-texte : latence moyenne de tous les relais ("Avg latency: 23ms"). Clic → onglet Relays.

- **DNS Queries Today** : nombre total de requetes DNS resolues dans la journee en cours. Icone DNS/globe. Compteur anime (nombre qui s'incremente en direct via WebSocket). Sous-texte : mini sparkline horizontale (graphique inline en ASCII ou SVG minimaliste) montrant le volume par heure sur les dernieres 24h. Clic → onglet DNS > Statistics.

- **Blocked Queries** : nombre de requetes DNS bloquees par les filtres. Icone bouclier/croix. Pourcentage du total entre parentheses : "1,247 (12.3%)". Sous-texte : repartition par categorie — "Malware: 45%, Tracking: 38%, Ads: 17%". Couleur : rouge si > 20% (indique un trafic suspect), orange si 5-20%, vert si < 5%. Clic → onglet DNS > Blocked.

### 1.2 Graphique de trafic temps reel
Area chart bidirectionnel occupe toute la largeur sous les KPIs. Implementation avec recharts (MIT).

- Axe X : timestamps avec labels adaptatifs selon le zoom. Derniere heure : label toutes les 5 minutes. Dernieres 24h (defaut) : label toutes les 2 heures. 7 jours : label par jour. 30 jours : label par semaine. Selector de periode en haut a droite du chart : boutons `1h`, `6h`, `12h`, `24h`, `7d`, `30d`.
- Axe Y : bande passante auto-scalee (bytes/s, formatte en KB/s, MB/s, GB/s selon l'echelle). Double axe optionnel pour upload/download si les echelles sont tres differentes.
- Deux aires empilees : upload (couleur primaire, opacity 0.6) et download (couleur secondaire, opacity 0.6). Ligne de contour pour chaque serie.
- Tooltip au survol : bulle avec timestamp exact, upload value, download value, total. Ligne verticale pointillee au survol.
- Bouton `Refresh` (icone rotate) a cote du selecteur de periode pour forcer le rechargement depuis le backend.
- Mode Live : toggle `Live` qui active le WebSocket. Quand actif, le chart scroll horizontalement et ajoute un point toutes les secondes. Indicateur pulsant "LIVE" en vert a cote du toggle. Quand desactive, le chart est statique avec les donnees du dernier rechargement.
- Legende sous le chart : carres de couleur avec labels "Upload" et "Download", cliquables pour masquer/afficher une serie.

### 1.3 Statut global
Bandeau horizontal sous le chart de trafic. 3 etats possibles :
- `Operational` (fond vert pale, icone checkmark vert, texte "All systems operational") — tous les relais en ligne, tous les tunnels connectes sans erreur.
- `Degraded` (fond orange pale, icone warning orange, texte "Service degraded — 1 relay offline, 2 tunnels reconnecting") — au moins un composant en erreur mais le service est disponible.
- `Incident` (fond rouge pale, icone erreur rouge clignotant, texte "Service incident — no relay available, all tunnels disconnected") — aucun relais disponible, tous les tunnels down.
Calcule automatiquement a partir de l'etat des composants (relais + tunnels). Mis a jour en temps reel via WebSocket. Clic sur le bandeau → page de statut detaillee avec historique des incidents sur 90 jours.

### 1.4 Evenements recents
Feed chronologique vertical sous le bandeau de statut. Derniers 20 evenements. Chaque evenement : icone de type (tunnel vert pour connexion, tunnel rouge pour deconnexion, serveur bleu pour relais, DNS violet pour DNS, bouclier orange pour securite), timestamp relatif ("il y a 2 min"), description ("Tunnel `api-dev` connected via relay `eu-west-1`"), lien vers la ressource concernee. Types d'evenements : tunnel.created, tunnel.connected, tunnel.disconnected, tunnel.error, relay.added, relay.removed, relay.health_changed, dns.record_created, dns.record_deleted, security.access_denied, security.ddos_detected. Bouton `View all events` → page dediee avec pagination, filtres par type et date.

### 1.5 Carte geographique des relais
Carte mondiale SVG (pas de dependance cartographique lourde — SVG statique avec les continents). Points positionnes pour chaque relais avec : couleur par latence (vert < 50ms, orange 50-200ms, rouge > 200ms), tooltip au hover (nom, region, latence, connexions actives, bande passante). Lignes animees entre les tunnels actifs et leurs relais assignes. Clic sur un relais → navigation vers sa page de detail dans l'onglet Relays. Si un seul relais : carte centree sur sa position. Si aucun relais : carte grisee avec message "No relays configured".

### 1.6 Metriques de performance
Panneau horizontal avec 6 metriques en inline :
- **Avg Latency** : latence moyenne de tous les tunnels actifs (ms). Couleur : vert < 50, orange 50-200, rouge > 200.
- **Total Throughput** : debit total upload + download (formatte en MB/s).
- **Active Connections** : nombre de connexions TCP/UDP concurrentes a travers tous les tunnels.
- **Error Rate** : pourcentage d'erreurs (timeouts, connection refused, TLS handshake failures) sur les dernieres 5 minutes. Couleur : vert < 1%, orange 1-5%, rouge > 5%.
- **Uptime** : uptime du service securelink sur 30 jours (ex: "99.97%"). Barre de disponibilite avec barres vertes/rouges par jour.
- **DNS Response Time** : temps de resolution DNS moyen (ms). Vert < 10ms, orange 10-50ms, rouge > 50ms.

---

## Categorie 2 — Gestion des tunnels

### 2.1 Liste des tunnels
Tableau avec colonnes : Nom (lien cliquable vers le detail), Adresse locale (host:port en monospace), Sous-domaine public (*.securelink.local, copiable au clic), Protocole (badge colore : HTTP bleu, HTTPS vert, TCP orange, UDP violet), Statut (badge anime : "Connected" vert pulsant, "Disconnected" gris, "Connecting" orange spinner, "Error" rouge avec tooltip de l'erreur), Trafic cumule (bytes formatte up/down), Uptime (duree depuis la derniere connexion), Dernier heartbeat (timestamp relatif), Actions (boutons icones : edit crayon, toggle on/off switch, duplicate copy, delete trash). Tri par statut (connected en premier par defaut), nom (A-Z), trafic (desc), uptime (desc). Filtre par protocole (multi-select) et statut (multi-select). Barre de recherche par nom. Pagination 25 par page.

### 2.2 Creation de tunnel
Dialogue modal de creation (680px de large) avec champs :
- **Nom** (texte, requis, max 64 caracteres) — identifiant humain du tunnel. Validation : alphanumerique + tirets, pas d'espaces. Erreur inline si le nom existe deja.
- **Adresse locale** (host:port, requis) — ex: `localhost:8080`, `192.168.1.100:3000`. Validation de format. Bouton `Detect` qui scanne les ports locaux ouverts et propose les services detectes en dropdown.
- **Protocole** (select : HTTP, HTTPS, TCP, UDP) — determine le type de proxy et les options disponibles. HTTP/HTTPS activent l'inspection de requetes. TCP/UDP desactivent l'inspection mais permettent n'importe quel protocole applicatif.
- **Sous-domaine** (texte, optionnel) — genere automatiquement si vide (format `<adjectif>-<animal>-<4chars>.securelink.local`). Si saisi : verification de disponibilite en temps reel (debounce 500ms, checkmark vert ou croix rouge). Min 3 caracteres, max 32, alphanumerique + tirets.
- **Authentication** (select : None, JWT, mTLS, WireGuard) — methode d'authentification pour les connexions entrantes au tunnel. JWT : token signe par signapps-identity, valide par le relais (defaut pour HTTP/HTTPS). mTLS : certificat client requis (upload du CA cert). WireGuard : paire de cles Curve25519 (defaut pour TCP/UDP).
- **Auto-start** (toggle, defaut ON) — le tunnel se reconnecte automatiquement au demarrage du service ou apres une coupure reseau.
- **Options avancees** (section collapsible, fermee par defaut) :
  - Basic Auth (toggle + user/password) — couche d'authentification HTTP supplementaire.
  - IP Whitelist (textarea, une IP/CIDR par ligne) — seules les IPs listees peuvent se connecter.
  - Rate limiting (input numerique, defaut : 0 = illimite, unite : requetes/seconde par IP).
  - TLS termination (radio : "Terminate at relay" ou "Passthrough") — le relais dechiffre le TLS ou le passe tel quel.
  - Connect timeout (input, defaut : 10s) et Read timeout (input, defaut : 60s).
  - Bandwidth limit (2 inputs : upload Mo/s et download Mo/s, defaut : illimite).
  - Keep-alive interval (input, defaut : 30s) — frequence des heartbeats pour detecter les coupures.

Bouton `Create Tunnel` (bleu, pleine largeur en bas). A la creation : animation de connexion (3 etapes avec spinners : "Creating tunnel...", "Connecting to relay...", "Tunnel active"). En cas d'erreur : message detaille avec suggestion (ex: "Connection refused on localhost:8080 — is your service running?").

### 2.3 Quick Connect
Bouton proeminent en haut du Dashboard et de la liste des tunnels. Icone eclair + texte "Quick Connect". Un clic declenche :
1. Scan des ports locaux courants (3000, 3001, 8080, 8443, 8000, 5000, 4200, 5173, 80, 443) en parallele. Timeout 2s par port.
2. Affichage d'un dropdown avec les services detectes : "localhost:3000 (Next.js dev)", "localhost:8080 (HTTP service)". Si aucun service detecte : champ de saisie manuelle avec placeholder "Enter host:port".
3. Selection du service → generation automatique du sous-domaine (ex: `autumn-fox-7k2m.securelink.local`), detection du protocole (HTTP si port 80/3000/8080, HTTPS si port 443/8443), creation du tunnel avec parametres par defaut.
4. Feedback visuel : spinner (1s) → checkmark vert → URL publique affichee en gros avec bouton `Copy` a droite. Toast : "Tunnel active — your service is now accessible at autumn-fox-7k2m.securelink.local".
Temps total < 5 secondes de la detection au tunnel actif.

### 2.4 Activation et desactivation
Toggle switch on/off sur chaque ligne du tableau des tunnels. Un tunnel desactive :
- Ferme la connexion active immediatement (RST pour TCP, dernier paquet pour UDP).
- Libere les ressources sur le relais (slot de connexion).
- Conserve la configuration complete (nom, adresse, options).
- Le sous-domaine est reserve pendant 24h (pas reutilisable par un autre tunnel).
Reactivation : clic sur le toggle → reconnexion automatique en < 5 secondes avec feedback visuel (spinner → connected). Si l'adresse locale n'est plus accessible : statut "Error" avec message "Connection refused — service not reachable".

### 2.5 Edition de tunnel
Bouton `Edit` (icone crayon) ouvre le meme formulaire que la creation, pre-rempli. Changements a chaud (hot reload, sans coupure) : nom, IP whitelist, rate limiting, bandwidth limit, basic auth, timeouts. Changements avec reconnexion (coupure < 5s) : adresse locale, protocole, TLS mode, authentication method, sous-domaine. Indicateur dans le formulaire : badge "Hot reload" (vert) ou "Requires reconnection" (orange) a cote de chaque champ modifie.

### 2.6 Duplication de tunnel
Bouton `Duplicate` (icone copy) dans le menu actions de chaque tunnel. Cree un nouveau tunnel avec les memes parametres sauf : sous-domaine regenere automatiquement, nom suffixe " (copy)". Le tunnel duplique est cree en etat desactive — l'utilisateur doit l'activer manuellement. Utile pour creer des variantes (dev/staging/prod avec meme config reseau).

### 2.7 Suppression de tunnel
Bouton `Delete` (icone trash) ouvre une modal de confirmation : "Delete tunnel `api-dev`? This will immediately disconnect all active sessions. The subdomain `autumn-fox-7k2m.securelink.local` will be released after 24 hours." Bouton `Delete` rouge + bouton `Cancel`. Si le tunnel est actuellement connecte : warning supplementaire "This tunnel has 3 active connections that will be terminated." Apres suppression : toast "Tunnel deleted", la ligne disparait du tableau avec animation fadeOut. Les logs de trafic historiques sont conserves pour l'audit (retention configurable).

### 2.8 Inspection du trafic
Pour les tunnels HTTP/HTTPS uniquement. Bouton `Inspect` (icone loupe) ouvre un panneau lateral (drawer) ou une page dediee. Contenu :

- **Request list** : tableau temps reel des requetes traversant le tunnel. Colonnes : timestamp, methode (badge colore : GET vert, POST bleu, PUT orange, DELETE rouge, PATCH violet), URL (path tronque avec tooltip du full URL), status code (badge : 2xx vert, 3xx bleu, 4xx orange, 5xx rouge), duree (ms), taille response (bytes). Nouvelles requetes apparaissent en haut avec animation slideDown. Bouton `Pause` pour geler la liste (les nouvelles requetes sont bufferisees). Bouton `Clear` pour vider la liste.
- **Filtres** : dropdown status code (2xx, 3xx, 4xx, 5xx, all), champ texte pour filtrer par URL path, dropdown methode.
- **Detail d'une requete** : clic sur une ligne ouvre un panneau de detail avec 3 onglets : Request (method, URL, headers, body tronque a 10KB), Response (status, headers, body tronque a 10KB), Timing (DNS, connect, TLS, TTFB, transfer). Headers affiches en tableau key:value avec search. Body affiche en pretty-print si JSON/XML, brut sinon.
- **Replay** : bouton `Replay` sur une requete pour la renvoyer (meme methode, URL, headers, body). Resultat affiche a cote de l'original pour comparaison.

### 2.9 Metriques par tunnel
Onglet `Stats` dans la page de detail d'un tunnel. Contenu :
- Graphique de trafic dedie (meme format que le dashboard mais filtre sur ce tunnel).
- Compteurs : requetes totales (HTTP) ou connexions totales (TCP/UDP), bytes transferes (up/down), duree moyenne de connexion.
- Latence : graphique de latence p50/p95/p99 sur 24h. Points individuels au hover.
- Taux d'erreur : graphique temporel du pourcentage d'erreurs.
- Top 10 IPs clientes (tableau : IP, requetes, bytes, derniere connexion, pays si GeoIP disponible).
- Top 10 URLs (pour HTTP — tableau : path, methode, count, avg duration, avg response size).

---

## Categorie 3 — Serveurs relais (Relays)

### 3.1 Liste des relais
Tableau avec colonnes : Nom (lien vers detail), Region/Localisation (badge avec drapeau emoji optionnel), Adresse IP (monospace, copiable), Port, Protocole (WireGuard ou TLS), Statut (badge anime : "Online" vert pulsant, "Offline" rouge, "Degraded" orange), Latence (valeur en ms + barre de couleur proportionnelle), Bande passante disponible (Mo/s), Connexions actives / Capacite max (ex: "23/100"), Uptime (duree depuis le dernier redemarrage). Badge de sante colore integre au nom : cercle vert/orange/rouge.

### 3.2 Ajout d'un relais
Formulaire modal :
- **Nom** (texte, requis) — identifiant du relais (ex: "eu-west-1", "us-east-1").
- **Adresse** (IP ou hostname, requis) — adresse publique du serveur relais. Validation de format IPv4/IPv6/hostname.
- **Port** (nombre, requis, defaut : 9443) — port d'ecoute du relais.
- **Region** (texte, requis) — localisation geographique pour l'affichage et le routage (ex: "Europe West", "US East", "Asia Pacific").
- **Cle publique** (texte, requis) — cle WireGuard Curve25519 du relais pour l'authentification mutuelle. Bouton `Generate` pour generer une paire et afficher la cle publique.
- **Capacite max** (nombre, requis, defaut : 100) — nombre maximal de connexions simultanees. Au-dela, les nouveaux tunnels sont routes vers un autre relais.
- **Health check interval** (nombre, defaut : 30s) — frequence des verifications de sante.
- **Auto-failover** (toggle, defaut ON) — si le relais tombe, ses tunnels sont automatiquement migres.
- **Priority** (nombre 1-10, defaut 5) — priorite pour le load balancing. Les relais de priorite elevee sont preferes.

Bouton `Add Relay` → test de connectivite immediat (TLS handshake + ping). Si OK : toast "Relay added and connected". Si echec : message d'erreur avec suggestion ("Connection refused — verify the relay is running and port 9443 is open").

### 3.3 Health check des relais
Verification periodique configurable (defaut : toutes les 30 secondes). Chaque health check execute 4 tests :
1. **Ping ICMP** : latence aller-retour. Timeout 5s = echec.
2. **Handshake TLS/WireGuard** : verification que le protocole de chiffrement fonctionne. Timeout 10s.
3. **Test de throughput** : transfert d'un payload de 1MB et mesure de la bande passante effective (MB/s). Execute toutes les 5 minutes seulement (pas a chaque check).
4. **Verification de capacite** : interrogation du relais pour connaitre le nombre de connexions actives vs capacite max.

Resultats stockes dans `securelink_relay_health_checks` (timestamp, relay_id, latency_ms, throughput_mbps, active_connections, status). Graphique de latence sur 24h par relais (sparkline dans le tableau + graphique complet dans la page de detail). Historique consultable sur 30 jours. Alertes : si 2 health checks consecutifs echouent → statut passe a "Degraded" ; si 4 consecutifs → "Offline" + notification admin.

### 3.4 Failover automatique
Si un relais devient indisponible (statut "Offline") :
1. Detection en < 30 secondes (2 health checks echoues consecutifs, intervalle 15s en mode urgence).
2. Identification des tunnels affectes (query `SELECT * FROM securelink_tunnels WHERE relay_id = $1 AND status = 'connected'`).
3. Selection du relais de remplacement : meme region en priorite, puis region la plus proche, puis global. Respect de la capacite max.
4. Migration automatique des tunnels vers le relais de remplacement. Chaque tunnel est deconnecte puis reconnecte. Interruption < 5 secondes par tunnel, migration sequentielle par batchs de 10.
5. Notification a l'admin : "Failover: relay `eu-west-1` offline. 12 tunnels migrated to `eu-west-2`. Avg reconnection time: 3.2s."
6. Re-migration optionnelle : quand le relais original revient en ligne, option (configurable) de re-migrer les tunnels vers leur relais d'origine. Desactivee par defaut pour eviter les flapping.

### 3.5 Load balancing
Repartition des tunnels entre les relais disponibles. Algorithme configurable dans les parametres globaux ou surchargeable par tunnel :
- **Round-robin** : repartition equitable sequentielle entre les relais. Simple, previsible.
- **Least connections** : preference au relais avec le moins de connexions actives par rapport a sa capacite. Formule : `score = active_connections / max_capacity`. Le relais avec le score le plus bas est choisi.
- **Latency-based** : preference au relais avec la latence la plus basse par rapport au client (mesure au handshake initial). Utile quand les relais sont dans des regions differentes.
- **Geographic** : routage vers le relais de la meme region que le client (detection par IP GeoIP). Fallback sur latency-based si aucun relais dans la region.
- **Weighted** : chaque relais a un poids (1-100). La probabilite de selection est proportionnelle au poids. Utile pour les relais de capacites differentes.

Affichage dans l'interface : dropdown dans les parametres "Load Balancing Algorithm" avec description de chaque option. Indicateur visuel dans la liste des relais : barre de charge (connections/capacity) coloree (vert < 60%, orange 60-85%, rouge > 85%).

### 3.6 Statistiques par relais
Vue detaillee par relais (clic sur le nom dans le tableau). Page dediee avec :
- Graphique de trafic (upload/download) sur 24h/7j/30j.
- Nombre de tunnels heberges (actifs / total assigne).
- Graphique de latence (p50, p95, p99) sur 24h.
- Bande passante utilisee / disponible (jauge).
- Utilisation CPU/memoire du relais (si un agent de monitoring est installe — optionnel, affiche "N/A" sinon).
- Historique de disponibilite sur 30 jours : barre horizontale avec barres vertes (en ligne) et rouges (hors ligne) par heure. Pourcentage de disponibilite global.
- Logs des health checks recents (20 derniers).

### 3.7 Relay chain (multi-hop)
Pour les configurations haute securite ou les topologies complexes : possibilite de chainer 2 relais. Le trafic traverse relay A → relay B → destination. Configuration dans le formulaire du tunnel : champ "Relay chain" avec selection ordonnee de 2 relais. La latence additionnelle est affichee : "Estimated latency: 23ms (relay A) + 45ms (relay B) = ~68ms". Warning si la latence totale depasse 200ms. Utile pour : le transit entre zones reseaux isolees, l'obfuscation de la source du trafic, la conformite avec les regles de routage geographique.

---

## Categorie 4 — Gestion DNS

### 4.1 Liste des enregistrements DNS
Tableau avec colonnes : Type (badge colore : A bleu, AAAA violet, CNAME vert, TXT gris, MX orange, SRV jaune, NS cyan), Nom (hostname en monospace), Valeur (IP, CNAME target, TXT content — tronque a 60 chars avec tooltip pour le texte complet), TTL (formatte : "5m", "1h", "24h"), Priorite (pour MX et SRV, vide sinon), Statut (toggle actif/inactif), Date de creation (relative), Actions (edit, delete). Recherche par nom ou valeur (debounce 300ms). Tri par type, nom, date. Filtre par type (multi-select). Compteur : "24 records (18 active, 6 inactive)".

### 4.2 Creation d'enregistrement DNS
Formulaire modal :
- **Type** (select : A, AAAA, CNAME, TXT, MX, SRV, NS) — chaque type affiche des champs specifiques.
- **Nom** (texte) — hostname ou sous-domaine (ex: "api", "mail", "*.dev"). Validation : alphanumerique + tirets + points + wildcard `*`.
- **Valeur** (texte) — contenu dependant du type :
  - A : champ IPv4 avec validation (`192.168.1.1`). Erreur si format invalide.
  - AAAA : champ IPv6 avec validation (`2001:db8::1`).
  - CNAME : champ FQDN (ex: `api.example.com.`). Warning si pointe vers un nom interne.
  - TXT : textarea multiline (SPF, DKIM, verification tokens). Max 255 chars par record TXT.
  - MX : champ hostname du serveur mail + champ priorite (0-65535, defaut 10).
  - SRV : champs priority, weight, port, target.
  - NS : champ hostname du nameserver.
- **TTL** (select avec presets : 60s "1 minute", 300s "5 minutes", 3600s "1 hour", 86400s "1 day" — ou input custom en secondes). Defaut : 300s.
- **Proxy** (toggle, HTTP/HTTPS seulement) — si active, le trafic passe par le relais SecureLink (protection DDoS, TLS auto, analytics). Si desactive, resolution DNS directe.

Bouton `Create Record`. Validation du format selon le type. En cas de conflit (meme nom + type existe deja) : warning "A record for `api` already exists. Creating a second one will enable DNS round-robin." A la creation : propagation immediate (pas de delai DNS classique car resolution interne).

### 4.3 Edition et suppression d'enregistrements
Edition inline dans le tableau : clic sur la valeur → le champ devient editable avec validation en temps reel. Bouton checkmark pour sauvegarder, bouton croix pour annuler. Ou bien bouton `Edit` pour ouvrir le formulaire modal pre-rempli. Suppression : bouton `Delete` avec modal de confirmation ("Delete A record `api` → `192.168.1.1`?"). Si le record est utilise par un tunnel actif : warning "This record is used by tunnel `api-dev`. Deleting it may break the tunnel." Historique des modifications : onglet `History` par record avec qui, quoi, quand (ex: "admin changed value from 192.168.1.1 to 10.0.0.5 — 2 hours ago").

### 4.4 DNS Filtering (blocklists)
Configuration des listes de blocage par categorie. Ecran dedie avec tableau de categories, chacune sur une ligne :

- **Malware** : domaines connus pour distribuer des malwares. Sources : URLhaus, PhishTank, OpenPhish. Toggle on/off. Nombre de domaines bloques : "~45,000 domains". Derniere mise a jour : "Updated 2h ago".
- **Tracking & Ads** : domaines de tracking et publicite. Sources : EasyList, EasyPrivacy, Steven Black unified hosts. Toggle on/off. "~120,000 domains".
- **Adult content** : domaines pour adultes. Toggle on/off. "~80,000 domains".
- **Gambling** : sites de jeux d'argent. Toggle on/off. "~15,000 domains".
- **Social media** : reseaux sociaux (Facebook, Twitter, Instagram, TikTok, etc.). Toggle on/off. "~2,000 domains". Note : "Use for corporate environments where social media access should be restricted."
- **Custom** : liste personnalisee. Bouton `Edit` ouvre un textarea pour saisir des domaines (un par ligne) ou un bouton `Upload` pour charger un fichier texte. Compteur du nombre de domaines. Regex support : `*.doubleclick.net` bloque tous les sous-domaines.

Chaque categorie indique le toggle on/off, le nombre de domaines, la source, la date de derniere mise a jour. Bouton `Update All` pour forcer le telechargement des listes depuis les sources. Mise a jour automatique configurable : quotidienne (defaut), hebdomadaire, manuelle uniquement. Metriques par liste : combien de requetes ont ete bloquees par cette liste dans les derniers 24h/7j.

### 4.5 Allowlist DNS
Tableau des domaines en liste blanche. Chaque entree : domaine (texte, supporte les wildcards `*.example.com`), raison (texte, ex: "Faux positif — CDN interne"), date d'ajout, ajoute par. Bouton `+ Add Domain`. Priorite absolue sur les blocklists : si un domaine est dans une blocklist ET dans l'allowlist, il est resolu normalement. Tri par nom, date. Recherche. Import/export en fichier texte (un domaine par ligne).

### 4.6 Statistiques DNS
Panneau de statistiques occupe une section complete de l'onglet DNS. Contenu :
- **Requetes totales aujourd'hui** : compteur anime, mis a jour en temps reel. Sous-texte : comparaison avec hier ("↑ 12% vs yesterday").
- **Requetes bloquees aujourd'hui** : compteur + pourcentage du total. Donut chart a cote : repartition par categorie de blocage (malware, tracking, ads, adult, gambling, social, custom).
- **Graphique temporel** : area chart montrant requetes resolues (vert) vs bloquees (rouge) empilees sur l'axe Y. Axe X : timestamps. Periodes selectionnables : 24h (defaut), 7j, 30j. Granularite : 24h = par heure, 7j = par 6h, 30j = par jour.
- **Top 10 domaines resolus** : tableau avec rang, domaine, nombre de requetes, pourcentage du total. Barre horizontale proportionnelle.
- **Top 10 domaines bloques** : tableau avec rang, domaine, categorie de blocage (badge), nombre de tentatives. Barre horizontale.
- **Top 10 clients** : tableau avec IP, hostname (si reverse DNS disponible), requetes totales, requetes bloquees, pourcentage bloque. Barre horizontale.
- **Query types distribution** : donut chart montrant la repartition A / AAAA / CNAME / MX / TXT / SRV / other.

### 4.7 DNS over HTTPS (DoH) et DNS over TLS (DoT)
Support des protocoles DNS chiffres pour les requetes sortantes (upstream resolution). Configuration dans les parametres DNS :
- **Upstream resolvers** (tableau editable, ordonne par priorite) : IP/hostname du resolver, protocole (UDP, DoH, DoT), port. Presets : Cloudflare (1.1.1.1 / 1.0.0.1, DoH `https://cloudflare-dns.com/dns-query`), Google (8.8.8.8 / 8.8.4.4, DoH `https://dns.google/dns-query`), Quad9 (9.9.9.9, DoH `https://dns.quad9.net/dns-query`), Custom.
- **Fallback strategy** : si le resolver principal est indisponible apres 3 tentatives (timeout 2s chacune), basculer automatiquement vers le resolver suivant dans la liste. Log l'evenement.
- **DNSSEC validation** (toggle, defaut ON) : verifier les signatures DNSSEC des reponses. Si la validation echoue, la reponse est marquee comme non-fiable et un warning est logue.

Statut de connexion aux resolvers affiche dans les parametres : indicateur vert/rouge par resolver avec latence de test.

### 4.8 DNS cache
Cache local des resolutions DNS integre au service securelink.
- **TTL respecte** : chaque enregistrement en cache expire selon son TTL. Si le TTL est 0, pas de mise en cache.
- **Taille du cache** (configurable, defaut : 10 000 entrees). LRU eviction quand le cache est plein.
- **TTL override** (optionnel) : forcer un TTL minimum (ex: 60s) et maximum (ex: 86400s) pour eviter les TTL trop courts (performance) ou trop longs (staleness).
- **Statistiques** affichees dans le panneau DNS :
  - Cache size : "4,230 / 10,000 entries"
  - Hit ratio : "87.3%" (graphique sparkline sur 24h)
  - Avg hit latency : "< 1ms" vs avg miss latency : "23ms"
- **Bouton `Flush Cache`** : vide le cache manuellement avec confirmation ("This will temporarily increase DNS latency until the cache is rebuilt. Continue?"). A la flush : toast "DNS cache flushed — 4,230 entries removed".
- **Flush selectif** : champ texte pour vider un domaine specifique du cache (ex: `api.example.com`).

### 4.9 DNS query log
Journal detaille des requetes DNS. Tableau avec colonnes : timestamp, client IP, domaine demande, type de requete (A/AAAA/CNAME/MX/TXT/SRV), resultat (badge : "Resolved" vert, "Blocked" rouge, "NXDOMAIN" gris, "Cache hit" bleu, "Error" orange), categorie de blocage (si bloque — badge avec nom de la categorie), temps de resolution (ms), upstream resolver utilise. Recherche full-text dans le domaine. Filtres : type, resultat, categorie, date range. Pagination 100 par page. Export CSV/JSON. Retention configurable (defaut 30 jours — volume eleve).

---

## Categorie 5 — Securite et acces

### 5.1 Authentification des tunnels
Chaque tunnel est authentifie via une methode configurable :
- **JWT** (defaut pour HTTP/HTTPS) : token emis par signapps-identity (port 3001), valide par le relais. Claims requis : `sub` (user_id), `org_id`, `tunnel_permissions` (liste de tunnel IDs autorises). Expiration : 1h, renouvellement automatique via refresh token. Le token est transmis dans le header `Authorization: Bearer <jwt>` ou dans le header custom `X-Tunnel-Auth`.
- **WireGuard keys** (defaut pour TCP/UDP) : paire de cles Curve25519 generee a la creation du tunnel. La cle publique du client est enregistree sur le relais. La cle privee est stockee localement (jamais transmise). Le handshake WireGuard authentifie mutuellement le client et le relais.
- **mTLS** (optionnel pour HTTPS) : certificat client signe par une CA interne. Upload du CA certificate dans la configuration du tunnel. Le relais valide le certificat client lors du TLS handshake. Utile pour les tunnels sensibles avec authentification forte.

### 5.2 Chiffrement du trafic
Tout le trafic tunnel est chiffre de bout en bout :
- **WireGuard** (protocole par defaut pour TCP/UDP) : ChaCha20-Poly1305 pour le chiffrement, Curve25519 pour l'echange de cles, BLAKE2s pour le hashing. Performance : ~3 Gbps sur hardware moderne. Overhead minimal (~60 bytes par paquet).
- **TLS 1.3** (pour HTTP/HTTPS) : cipher suites autorisees : TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256. Pas de fallback vers TLS 1.0/1.1/1.2 (refuse avec erreur "TLS version not supported"). Certificate pinning optionnel.
- **Double encryption** optionnelle pour les configurations haute securite : TLS 1.3 a l'interieur d'un tunnel WireGuard. Active par checkbox dans les options avancees du tunnel.

### 5.3 Politiques d'acces
Regles d'acces par tunnel, configurables dans l'onglet "Access Policies" de chaque tunnel :
- **IP whitelist / blacklist** : IPv4, IPv6, CIDR. Tableau editable : IP/CIDR, action (allow/deny), commentaire. Evaluation top-to-bottom, derniere regle = deny all. Import depuis un fichier texte.
- **Plages horaires autorisees** : selecteur de jours (lundi-dimanche avec checkboxes) + heure debut/fin (time pickers). Ex: lundi-vendredi 8h-20h. En dehors : connexion refusee avec message "Access denied — outside allowed hours (Mon-Fri 08:00-20:00)".
- **Groupes utilisateurs** : integration RBAC signapps-identity. Dropdown multi-select des groupes autorises. Seuls les membres de ces groupes peuvent se connecter au tunnel.
- **Device posture** (futur, placeholder dans l'UI avec badge "Coming soon") : OS minimum, antivirus actif, disk encryption.

### 5.4 Protection DDoS
Detection et mitigation automatique, configurable par tunnel :
- **Rate limiting** par IP : input (requetes/seconde, defaut : 100 pour HTTP, illimite pour TCP/UDP). Les requetes au-dela du seuil recoivent HTTP 429 "Too Many Requests" avec header `Retry-After`.
- **Spike detection** : si le trafic depasse 5x la moyenne mobile sur 5 minutes, alerte automatique. Seuil configurable (multiplicateur : 3x, 5x, 10x).
- **Challenge mode** (HTTP uniquement) : si une attaque est detectee, les requetes suspectes (IPs avec taux eleve) recoivent un challenge JavaScript (pas de CAPTCHA — challenge computationnel transparent). Les bots echouent, les navigateurs passent.
- **Auto-ban** : les IPs depassant le rate limit 3 fois en 5 minutes sont bloquees automatiquement. Duree configurable (defaut : 1h). Liste des IPs bannies consultable dans l'onglet Security > Banned IPs avec bouton `Unban`.
- **Dashboard de mitigation** : panneau dedie dans l'onglet Security. Nombre d'attaques detectees (24h), IPs bannies actives, trafic filtre (bytes), graphique temporel des evenements de mitigation.

### 5.5 Certificats TLS automatiques
Chaque tunnel HTTPS recoit un certificat TLS automatique :
- **Let's Encrypt (ACME)** pour les sous-domaines publics : generation automatique a la creation du tunnel, validation DNS-01 (via le DNS integre de SecureLink). Temps de generation : < 30 secondes.
- **Certificat auto-signe** pour les tunnels internes (sous-domaines .local) : genere instantanement, CA interne.
- **Renouvellement automatique** : 30 jours avant expiration, le systeme demande un nouveau certificat. Si le renouvellement echoue (3 tentatives en 24h), notification admin.
- **Indicateur de validite** dans la liste des tunnels : icone cadenas vert (certificat valide), cadenas orange (expire dans < 30 jours), cadenas rouge (expire ou invalide).
- **Custom certificates** : upload de certificat et cle privee pour les domaines propres (PEM format).

### 5.6 Audit trail
Journalisation de tous les evenements de securite dans `securelink_audit_log` :
- Connexions/deconnexions de tunnel avec IP source, user agent, et duree de session.
- Modifications de configuration (par qui, quoi, quand — avant/apres en JSON diff).
- Tentatives d'acces refusees (IP non-autorisee, token invalide, hors plage horaire) avec raison.
- Alertes DDoS declenchees et mesures de mitigation appliquees.
- Changements de politique d'acces.
- Health check failures et failovers.
Format structure JSON pour integration avec les outils de SIEM. Export API : `GET /api/v1/securelink/audit-log?from=&to=&type=`.

---

## Categorie 6 — Historique et logs

### 6.1 Logs de connexion
Table chronologique des sessions tunnel. Colonnes : date/heure debut, date/heure fin (ou "Active" si en cours), tunnel (nom avec lien), relay (nom avec lien), IP source, user agent (tronque, tooltip complet), duree de session (formattee : "2h 34m"), bytes transferes up/down (formatte), statut de deconnexion (badge : "Clean" vert, "Timeout" orange, "Error" rouge, "Active" bleu pulsant). Filtres par tunnel, date range, statut. Tri par date (defaut : plus recent en premier). Pagination 50 par page.

### 6.2 Logs de trafic
Metriques de trafic agregees par tunnel et par periode. Granularite : minute (raw, retention 24h), heure (agrege, retention 30j), jour (agrege, retention 365j). Colonnes : timestamp, tunnel, bytes_in, bytes_out, requests (HTTP), connections (TCP/UDP), errors, avg_latency_ms. Graphiques exportables en PNG ou SVG. API : `GET /api/v1/securelink/traffic?tunnel_id=&from=&to=&granularity=minute|hour|day`.

### 6.3 Logs DNS
Journal des requetes DNS (voir 4.9 pour le detail). Table dediee `securelink_dns_logs`. Retention par defaut : 30 jours (volume eleve — une instance moyenne genere ~100 000 requetes/jour). Archivage automatique vers le stockage SignApps apres expiration.

### 6.4 Export des logs
Export CSV, JSON, ou Syslog des logs filtres par :
- Periode (date debut/fin avec date pickers)
- Tunnel specifique (dropdown)
- Type d'evenement (connexion, trafic, DNS, securite — multi-select)
- Niveau de severite (info, warning, error, critical — multi-select)
Bouton `Export` en haut de chaque page de logs. Pour les exports volumineux (> 10 MB) : generation asynchrone avec notification quand le fichier est pret. Lien de telechargement valide 24h.

### 6.5 Retention des logs
Politique configurable par type de log (tableau dans les parametres) :
- Logs de connexion : 90 jours (defaut). Slider 30-365 jours.
- Logs de trafic agrege : 365 jours (defaut). Slider 90-730 jours.
- Logs DNS : 30 jours (defaut, volume eleve). Slider 7-180 jours.
- Logs de securite : 365 jours (defaut, audit). Minimum 90 jours.
Archivage automatique vers le stockage SignApps (module Drive, port 3004) pour les logs expires. Format : JSON compresse (gzip), un fichier par jour par type. Indicateur de stockage : "Logs storage: 2.3 GB / 10 GB".

### 6.6 Recherche dans les logs
Barre de recherche full-text en haut de chaque page de logs. Recherche dans : domaines DNS, IPs, noms de tunnels, messages d'erreur. Filtres combinables : tunnel + periode + type + severite + texte libre. Resultats pagines avec highlighting des termes recherches (fond jaune). Raccourci clavier : `Ctrl+F` focus la barre de recherche. Temps de recherche affiche : "42 results in 0.12s".

---

## REST API endpoints

### Tunnels
- `GET /api/v1/securelink/tunnels` — Liste des tunnels (pagination, filtres statut/protocole)
- `POST /api/v1/securelink/tunnels` — Creer un tunnel
- `GET /api/v1/securelink/tunnels/{id}` — Detail d'un tunnel
- `PUT /api/v1/securelink/tunnels/{id}` — Modifier un tunnel
- `DELETE /api/v1/securelink/tunnels/{id}` — Supprimer un tunnel
- `POST /api/v1/securelink/tunnels/{id}/toggle` — Activer/desactiver
- `POST /api/v1/securelink/tunnels/{id}/duplicate` — Dupliquer
- `GET /api/v1/securelink/tunnels/{id}/stats` — Metriques du tunnel
- `GET /api/v1/securelink/tunnels/{id}/requests` — Inspection HTTP (WebSocket pour temps reel)
- `POST /api/v1/securelink/tunnels/quick-connect` — Quick Connect (body: `{port: 8080}`)

### Relays
- `GET /api/v1/securelink/relays` — Liste des relais
- `POST /api/v1/securelink/relays` — Ajouter un relais
- `GET /api/v1/securelink/relays/{id}` — Detail d'un relais
- `PUT /api/v1/securelink/relays/{id}` — Modifier un relais
- `DELETE /api/v1/securelink/relays/{id}` — Supprimer un relais
- `GET /api/v1/securelink/relays/{id}/health` — Historique health checks
- `GET /api/v1/securelink/relays/{id}/stats` — Statistiques du relais

### DNS
- `GET /api/v1/securelink/dns/records` — Liste des enregistrements
- `POST /api/v1/securelink/dns/records` — Creer un enregistrement
- `PUT /api/v1/securelink/dns/records/{id}` — Modifier
- `DELETE /api/v1/securelink/dns/records/{id}` — Supprimer
- `GET /api/v1/securelink/dns/blocklists` — Liste des blocklists et statut
- `PUT /api/v1/securelink/dns/blocklists/{category}` — Activer/desactiver une blocklist
- `POST /api/v1/securelink/dns/blocklists/update` — Forcer la mise a jour des listes
- `GET /api/v1/securelink/dns/allowlist` — Liste blanche
- `POST /api/v1/securelink/dns/allowlist` — Ajouter un domaine
- `DELETE /api/v1/securelink/dns/allowlist/{id}` — Supprimer
- `GET /api/v1/securelink/dns/stats` — Statistiques DNS
- `GET /api/v1/securelink/dns/query-log` — Journal des requetes (pagination, filtres)
- `POST /api/v1/securelink/dns/cache/flush` — Vider le cache
- `GET /api/v1/securelink/dns/cache/stats` — Statistiques du cache

### Dashboard & Logs
- `GET /api/v1/securelink/dashboard/kpis` — Les 4 KPIs
- `GET /api/v1/securelink/dashboard/traffic` — Donnees du graphique de trafic
- `GET /api/v1/securelink/dashboard/events` — Evenements recents
- `GET /api/v1/securelink/logs/connections` — Logs de connexion
- `GET /api/v1/securelink/logs/traffic` — Logs de trafic agrege
- `GET /api/v1/securelink/logs/dns` — Logs DNS
- `GET /api/v1/securelink/logs/security` — Logs de securite
- `GET /api/v1/securelink/audit-log` — Audit trail complet
- `WS /api/v1/securelink/ws` — WebSocket (trafic live, events, tunnel status)

---

## PostgreSQL schema

```sql
-- Tunnels
CREATE TABLE securelink_tunnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL UNIQUE,
    local_address VARCHAR(255) NOT NULL,
    subdomain VARCHAR(64) NOT NULL UNIQUE,
    protocol VARCHAR(10) NOT NULL CHECK (protocol IN ('HTTP', 'HTTPS', 'TCP', 'UDP')),
    auth_method VARCHAR(20) NOT NULL DEFAULT 'jwt' CHECK (auth_method IN ('none', 'jwt', 'mtls', 'wireguard')),
    auto_start BOOLEAN NOT NULL DEFAULT true,
    config JSONB NOT NULL DEFAULT '{}',
    relay_id UUID REFERENCES securelink_relays(id),
    status VARCHAR(20) NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'connecting', 'error')),
    error_message TEXT,
    wireguard_public_key TEXT,
    tls_cert_id UUID,
    bytes_in BIGINT NOT NULL DEFAULT 0,
    bytes_out BIGINT NOT NULL DEFAULT 0,
    connected_at TIMESTAMPTZ,
    last_heartbeat TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relais
CREATE TABLE securelink_relays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL UNIQUE,
    address VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 9443,
    region VARCHAR(100) NOT NULL,
    protocol VARCHAR(20) NOT NULL DEFAULT 'wireguard',
    public_key TEXT NOT NULL,
    max_capacity INTEGER NOT NULL DEFAULT 100,
    health_check_interval_s INTEGER NOT NULL DEFAULT 30,
    auto_failover BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'degraded')),
    latency_ms INTEGER,
    active_connections INTEGER NOT NULL DEFAULT 0,
    uptime_since TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Health checks des relais
CREATE TABLE securelink_relay_health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relay_id UUID NOT NULL REFERENCES securelink_relays(id) ON DELETE CASCADE,
    latency_ms INTEGER,
    throughput_mbps REAL,
    active_connections INTEGER,
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enregistrements DNS
CREATE TABLE securelink_dns_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_type VARCHAR(10) NOT NULL CHECK (record_type IN ('A', 'AAAA', 'CNAME', 'TXT', 'MX', 'SRV', 'NS')),
    name VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    ttl INTEGER NOT NULL DEFAULT 300,
    priority INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_proxied BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blocklists DNS
CREATE TABLE securelink_dns_blocklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL UNIQUE,
    source_url TEXT,
    domain_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT false,
    last_updated TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allowlist DNS
CREATE TABLE securelink_dns_allowlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    reason TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Logs de connexion
CREATE TABLE securelink_connection_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tunnel_id UUID NOT NULL REFERENCES securelink_tunnels(id),
    relay_id UUID REFERENCES securelink_relays(id),
    source_ip INET NOT NULL,
    user_agent TEXT,
    connected_at TIMESTAMPTZ NOT NULL,
    disconnected_at TIMESTAMPTZ,
    duration_s INTEGER,
    bytes_in BIGINT NOT NULL DEFAULT 0,
    bytes_out BIGINT NOT NULL DEFAULT 0,
    disconnect_reason VARCHAR(20) CHECK (disconnect_reason IN ('clean', 'timeout', 'error', 'admin')),
    error_message TEXT
);

-- Metriques de trafic (time series)
CREATE TABLE securelink_traffic_metrics (
    tunnel_id UUID NOT NULL REFERENCES securelink_tunnels(id),
    timestamp TIMESTAMPTZ NOT NULL,
    bytes_in BIGINT NOT NULL DEFAULT 0,
    bytes_out BIGINT NOT NULL DEFAULT 0,
    requests INTEGER NOT NULL DEFAULT 0,
    connections INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    avg_latency_ms INTEGER,
    PRIMARY KEY (tunnel_id, timestamp)
);

-- Logs DNS
CREATE TABLE securelink_dns_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_ip INET NOT NULL,
    domain VARCHAR(255) NOT NULL,
    query_type VARCHAR(10) NOT NULL,
    result VARCHAR(20) NOT NULL CHECK (result IN ('resolved', 'blocked', 'nxdomain', 'cache_hit', 'error')),
    block_category VARCHAR(50),
    resolution_ms INTEGER,
    upstream_resolver VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Politiques d'acces par tunnel
CREATE TABLE securelink_access_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tunnel_id UUID NOT NULL REFERENCES securelink_tunnels(id) ON DELETE CASCADE,
    policy_type VARCHAR(20) NOT NULL CHECK (policy_type IN ('ip_whitelist', 'ip_blacklist', 'schedule', 'group')),
    config JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit trail
CREATE TABLE securelink_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    tunnel_id UUID REFERENCES securelink_tunnels(id),
    relay_id UUID REFERENCES securelink_relays(id),
    user_id UUID REFERENCES users(id),
    source_ip INET,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tunnel_status ON securelink_tunnels(status);
CREATE INDEX idx_relay_status ON securelink_relays(status);
CREATE INDEX idx_health_checks_relay ON securelink_relay_health_checks(relay_id, created_at);
CREATE INDEX idx_dns_records_type ON securelink_dns_records(record_type);
CREATE INDEX idx_dns_records_name ON securelink_dns_records(name);
CREATE INDEX idx_connection_logs_tunnel ON securelink_connection_logs(tunnel_id, connected_at);
CREATE INDEX idx_traffic_metrics_time ON securelink_traffic_metrics(timestamp);
CREATE INDEX idx_dns_logs_created ON securelink_dns_logs(created_at);
CREATE INDEX idx_dns_logs_domain ON securelink_dns_logs(domain);
CREATE INDEX idx_audit_log_created ON securelink_audit_log(created_at);
CREATE INDEX idx_audit_log_type ON securelink_audit_log(event_type);
CREATE INDEX idx_access_policies_tunnel ON securelink_access_policies(tunnel_id);
```

---

## Metriques Prometheus

Export via signapps-metrics (port 3008) :
- `securelink_tunnels_active` — nombre de tunnels connectes
- `securelink_tunnels_total{status="connected|disconnected|error"}` — tunnels par statut
- `securelink_relays_active` — nombre de relais en ligne
- `securelink_relays_latency_ms{relay="..."}` — latence par relais
- `securelink_traffic_bytes_total{direction="in|out", tunnel="..."}` — bytes transferes
- `securelink_connections_active{tunnel="..."}` — connexions actives par tunnel
- `securelink_dns_queries_total{result="resolved|blocked|nxdomain|error"}` — requetes DNS
- `securelink_dns_cache_hit_ratio` — ratio de cache DNS
- `securelink_ddos_events_total{tunnel="..."}` — evenements DDoS detectes
- `securelink_tls_cert_expiry_days{tunnel="..."}` — jours avant expiration du certificat

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
1. **Tunnel server** : service signapps-securelink (port 3006) en Axum. Chaque tunnel est un task tokio avec un channel bidirectionnel (client <-> relais <-> target).
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
- KPI Active Tunnels → tendance (fleche up/down) par rapport a hier
- KPI Active Relays → indicateur de sante aggregate (all healthy / degraded)
- KPI DNS Queries Today → compteur anime qui s'incremente en temps reel
- KPI Blocked Queries → pourcentage et repartition par categorie
- Graphique de trafic → le chart se rend avec les axes timestamp (X) et bandwidth (Y)
- Selecteur de periode → basculer entre 1h, 6h, 12h, 24h, 7d, 30d met a jour le chart
- Mode Live → le chart scroll horizontalement avec points en temps reel, indicateur "LIVE" pulsant
- Bouton `Refresh` → les donnees du dashboard se rechargent
- Bandeau de statut → affiche "Operational" / "Degraded" / "Incident" selon l'etat des composants
- Carte geographique → les relais sont positionnes avec indicateurs de latence colores
- Quick Connect → un tunnel est cree et active en moins de 5 secondes, URL publique affichee avec bouton Copy
- Quick Connect → scan des ports locaux detecte les services en cours d'execution
- Onglet Tunnels → le tableau des tunnels s'affiche avec colonnes (nom, adresse, sous-domaine, protocole, statut, trafic)
- Creer un tunnel manuellement → champs valides (nom unique, format host:port, sous-domaine disponible)
- Creation avec authentication JWT → le tunnel se connecte au relais
- Creation avec authentication WireGuard → paire de cles generee, tunnel connecte
- Editer un tunnel → hot reload pour IP whitelist (pas de coupure), reconnexion pour changement de protocole
- Desactiver un tunnel → le statut passe a `disconnected`, le trafic est coupe
- Reactiver un tunnel → reconnexion en moins de 5 secondes
- Supprimer un tunnel → il disparait de la liste apres confirmation
- Dupliquer un tunnel → nouveau tunnel cree avec memes parametres et sous-domaine different
- Inspection HTTP → les requetes s'affichent en temps reel avec methode, URL, status code, duree
- Clic sur une requete → detail avec headers, body, timing
- Replay d'une requete → le resultat s'affiche a cote de l'original
- Metriques par tunnel → graphiques de trafic, latence p50/p95/p99, top IPs
- Onglet Relays → le tableau des relais s'affiche avec latence et statut
- Ajouter un relais → test de connectivite, il apparait dans la liste, health check vert apres validation
- Health check → le graphique de latence 24h est visible par relais
- Failover → si un relais tombe (2 health checks echoues), les tunnels migrent automatiquement vers un autre relais
- Load balancing → les tunnels sont repartis selon l'algorithme configure (least connections par defaut)
- Relay chain → configuration multi-hop avec latence estimee affichee
- Onglet DNS → la liste des enregistrements s'affiche avec type, nom, valeur, TTL
- Ajouter un enregistrement DNS (type A) → il apparait dans la liste, validation IPv4
- Ajouter un enregistrement CNAME → validation FQDN
- Edition inline d'un enregistrement → la valeur est modifiee en place
- Activer la blocklist Malware → le nombre de domaines bloques s'affiche
- Blocklist Tracking & Ads → toggle on, compteur de domaines mis a jour
- Custom blocklist → saisie manuelle de domaines, compteur
- Allowlist DNS → un domaine en allowlist n'est pas bloque meme si present dans une blocklist
- Statistiques DNS → graphique requetes resolues vs bloquees, top 10 domaines, top 10 clients
- DNS cache stats → hit ratio affiche, bouton Flush Cache vide le cache
- DoH/DoT → configuration du resolver upstream, statut de connexion vert
- IP Whitelist sur un tunnel → les requetes d'IPs non-autorisees recoivent HTTP 403
- Rate limiting → les requetes au-dela du seuil recoivent HTTP 429 avec Retry-After
- Plages horaires → acces refuse en dehors des heures configurees
- Auto-ban DDoS → les IPs offensantes sont bannies, visibles dans la liste Banned IPs
- Certificat TLS auto → icone cadenas vert sur les tunnels HTTPS
- Export des logs en CSV → fichier telecharge avec les colonnes attendues
- Recherche dans les logs → les resultats filtres s'affichent avec highlighting
- Audit trail → les modifications de configuration sont tracees avec before/after
