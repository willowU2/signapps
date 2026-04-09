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
Onglet principal avec 4 cartes KPI : Tunnels actifs (nombre + icone online), Trafic total 24h (bytes formatte), Requetes DNS (nombre), Alertes securite (DDoS tentatives + IPs bloquees).

### 1.2 Graphique de trafic 24h
Line chart ou area chart temps reel du trafic entrant (download) et sortant (upload) sur les dernieres 24 heures. Echantillonnage par minute. Tooltip avec valeur exacte. Couleurs distinctes pour in/out.

### 1.3 Quick Connect
Bouton `Quick Connect` qui cree et active un tunnel avec les parametres par defaut (adresse locale, sous-domaine auto-genere). Le tunnel est immediatement accessible via son URL publique. Feedback visuel de connexion en cours → connecte.

### 1.4 Statut des relais
Liste des relay servers avec : nom, region, latence (ping), bande passante disponible, nombre de connexions, statut (online/offline/degraded). Badge de sante colore.

### 1.5 Alertes DDoS et IPs bloquees
Compteurs d'alertes securite : tentatives DDoS detectees et mitigees, nombre d'IPs bloquees automatiquement ou manuellement. Lien vers l'historique detaille.

### 1.6 Uptime et disponibilite
Indicateur de disponibilite du service securelink sur les 30 derniers jours. Bar chart horizontal avec journees vertes (100%), jaunes (degradation), rouges (downtime).

---

## Categorie 2 — Gestion des tunnels

### 2.1 Liste des tunnels
Tableau avec colonnes : Nom, Adresse locale, Sous-domaine, Protocole, Statut (actif/inactif), Trafic, Date de creation, Actions. Tri et filtre par statut.

### 2.2 Creation de tunnel
Dialogue de creation : Nom (texte), Adresse locale (host:port), Sous-domaine souhaite (auto-complete avec .signapps.tunnel), Protocole (HTTP/TCP/UDP). Options avancees : basic auth, IP whitelist, TLS termination.

### 2.3 Edition de tunnel
Modification des parametres d'un tunnel existant sans le detruire. Changement de nom, adresse locale, options de securite. Rechargement a chaud sans coupure.

### 2.4 Activation / Desactivation
Toggle on/off par tunnel. Un tunnel desactive libere les ressources mais conserve sa configuration. Reactivation instantanee.

### 2.5 Suppression de tunnel
Suppression definitive avec confirmation. Libere le sous-domaine. Les donnees de trafic historiques sont conservees pour l'audit.

### 2.6 Duplication de tunnel
Bouton `Dupliquer` pour creer un nouveau tunnel avec les memes parametres (sauf le sous-domaine qui est genere). Utile pour les environnements staging/production.

---

## Categorie 3 — Gestion des IPs et securite

### 3.1 Liste des IPs
Tableau des IPs associees : IP publique attribuee, IP privee du tunnel, statut (active/expired), date d'attribution. Support IPv4 et IPv6.

### 3.2 IP Whitelisting
Configurer une liste d'IPs autorisees par tunnel. Les requetes provenant d'autres IPs sont rejetees avec HTTP 403.

### 3.3 IP Blocklist
Liste noire d'IPs bloquees manuellement ou automatiquement (suite a une detection d'attaque). Ajout/suppression manuelle. Expiration optionnelle.

### 3.4 Certificats TLS
Chaque tunnel HTTPS recoit un certificat TLS automatique (Let's Encrypt ou interne). Renouvellement auto. Indicateur de validite et date d'expiration.

### 3.5 Authentification par tunnel
Options d'authentification par tunnel : Basic Auth (user/password), Bearer Token, mTLS (certificat client). Configurable dans les parametres du tunnel.

### 3.6 Protection DDoS
Detection automatique d'anomalies de trafic (spike, request flood). Mitigation : rate limiting, challenge CAPTCHA, blocage IP automatique. Dashboard de mitigation en temps reel.

---

## Categorie 4 — DNS et filtrage

### 4.1 Configuration DNS
Panneau DNS avec les enregistrements existants : type (A, AAAA, CNAME, TXT, MX), nom, valeur, TTL. Ajout, edition, suppression d'enregistrements custom.

### 4.2 Enregistrements DNS personnalises
Formulaire de creation : Type (select), Nom (texte), Valeur (texte), TTL (select ou custom). Validation du format selon le type.

### 4.3 Blocklists DNS
Activation/desactivation de listes de blocage par categorie : Malware, Tracking/Ads, Adult content, Social media, Gambling. Chaque liste indique le nombre de domaines bloques.

### 4.4 DNS over HTTPS (DoH) / DNS over TLS (DoT)
Support des protocoles DNS chiffres. Configuration du resolver upstream (Cloudflare 1.1.1.1, Google 8.8.8.8, custom).

### 4.5 Statistiques DNS
Compteurs de requetes : total, bloquees, autorisees. Graphique de repartition. Top 10 des domaines les plus resolus. Top 10 des domaines bloques.

### 4.6 DHCP integration
Le service DNS peut servir de serveur DHCP pour le reseau local. Attribution d'IPs, baux (leases), reservation par MAC address.

---

## Categorie 5 — Historique et audit

### 5.1 Logs de connexion
Table chronologique des evenements : date/heure, tunnel, action (connect/disconnect/error), IP source, user agent, duree de session.

### 5.2 Logs de trafic
Metriques de trafic par tunnel par heure/jour : bytes in, bytes out, requetes, erreurs. Aggregation pour les rapports.

### 5.3 Logs de securite
Evenements de securite : tentatives DDoS, IPs bloquees, certificats renouveles, authentifications echouees. Severite (info/warning/critical).

### 5.4 Export des logs
Export CSV/JSON des logs filtres par date, tunnel, type d'evenement. Utile pour la conformite et l'audit de securite.

### 5.5 Retention des logs
Politique de retention configurable par l'admin : 30/90/365 jours. Archivage automatique des logs anciens.

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
- Quick Connect → un tunnel est cree et active en moins de 5 secondes
- Creer un tunnel manuellement → il apparait dans la liste avec statut `actif`
- Desactiver un tunnel → le statut passe a `inactif`, le trafic est coupe
- Supprimer un tunnel → il disparait de la liste apres confirmation
- Graphique de trafic 24h → le graphique se rend avec les donnees disponibles
- Onglet DNS → la liste des enregistrements s'affiche
- Ajouter un enregistrement DNS custom → il apparait dans la liste
- Activer une blocklist DNS → le nombre de domaines bloques s'affiche
- Onglet IPs → la liste des IPs associees s'affiche
- Ajouter une IP en whitelist → les requetes d'autres IPs sont rejetees
- Onglet Historique → les logs de connexion s'affichent chronologiquement
- Export des logs en CSV → fichier telecharge avec les colonnes attendues
- Edition d'un tunnel → les parametres sont mis a jour sans coupure
- Duplication d'un tunnel → nouveau tunnel cree avec memes parametres
