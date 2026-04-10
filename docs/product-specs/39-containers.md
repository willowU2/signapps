# Module Conteneurs (Containers) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Portainer** | UI web pour Docker/Swarm/Kubernetes, gestion de stacks (docker-compose), templates d'applications, RBAC, registry management, edge computing, logs/stats en temps reel, exec console dans le conteneur |
| **Docker Desktop** | Interface native desktop, Docker Compose integre, volume management, image management, extensions marketplace, resource monitoring (CPU/RAM/disk), Kubernetes local, Dev Environments |
| **Rancher** | Multi-cluster Kubernetes management, catalog d'applications (Helm charts), monitoring integre (Prometheus/Grafana), alerting, RBAC, fleet management, GitOps integration |
| **Yacht** | Open source (MIT), UI simple pour Docker, templates (compose), projects, resource monitoring, container management, theming, API REST |
| **Lazydocker** | TUI (terminal), vue unifiee containers/images/volumes, logs en direct, statistiques, exec shell, docker-compose support, raccourcis clavier, top CPU/RAM |
| **DockStation** | GUI desktop, multi-host, projects (compose), monitoring, logs, container inspection, image search, port mapping visualization |

## Principes directeurs

1. **Vue d'ensemble immediate** — l'ecran principal montre tous les conteneurs avec leur statut, leur consommation et leurs metadonnees en un coup d'oeil. Pas de navigation profonde pour les operations courantes.
2. **Actions en un clic** — demarrer, arreter, redemarrer, supprimer un conteneur directement depuis la liste. Confirmation pour les actions destructives.
3. **Observabilite native** — logs en temps reel, statistiques CPU/RAM/reseau/disque, inspection complete, sans quitter l'interface. Integration avec signapps-metrics pour le monitoring historique.
4. **Backend bollard** — toutes les operations Docker passent par le service signapps-containers (port 3002) qui utilise la crate bollard (MIT) pour communiquer avec le daemon Docker.
5. **Securite** — acces restreint par RBAC (seuls les admins et operateurs ont acces). Pas d'execution de commandes arbitraires sans autorisation explicite. Audit de toutes les actions.
6. **Extensible** — support des registries prives, des reseaux Docker custom, des volumes nommes, des docker-compose (stacks).

---

## Categorie 1 — Liste et filtrage des conteneurs

### 1.1 Vue principale en tableau
Ecran principal : tableau scrollable avec colonnes :
- **Nom** du conteneur (cliquable → detail). Texte tronque a 30 caracteres avec tooltip pour le nom complet.
- **Image** (nom:tag). Badge `latest` en orange si le tag est `latest` (warning best practice).
- **Statut** (Running/Stopped/Paused/Restarting/Created/Dead) avec pastille couleur : vert (Running), gris (Stopped), bleu (Paused), orange (Restarting), blanc (Created), rouge (Dead).
- **Uptime** (depuis combien de temps il tourne) : format humain `2d 5h 30m` ou `Stopped 3h ago`.
- **CPU** (pourcentage en temps reel, actualise toutes les 2 secondes). Barre de progression coloree : vert (<70%), orange (70-90%), rouge (>90%).
- **RAM** (utilisation / limite) : `256 Mo / 512 Mo`. Barre de progression idem.
- **Ports** (mapping host:container) : `8080:80, 443:443`. Badge par port.
- **Tags** (labels Docker comme metadonnees). Pastilles colorees cliquables pour filtrer.
- **Actions** (boutons icones : Start/Stop, Restart, Logs, Delete). Les boutons apparaissent au survol de la ligne.

Le tableau est virtualized pour supporter 100+ conteneurs sans degradation de performance. Les donnees sont rafraichies automatiquement via SSE (`GET /api/v1/containers/stream`). API source : `GET /api/v1/containers` qui appelle `bollard::container::ListContainersOptions`.

### 1.2 Onglets de filtrage par statut
Onglets en haut de la liste :
- **All** : tous les conteneurs
- **Running** : conteneurs en cours d'execution (pastille verte)
- **Stopped** : conteneurs arretes (pastille grise)
- **Idle** : conteneurs en cours mais inactifs (CPU < 1% depuis > 5 min)
- **System** : conteneurs systeme SignApps (identifies par label `signapps.system=true`)

Compteur dans chaque onglet (ex: Running (12), Stopped (3)). Animation de transition entre onglets (fade 150ms). L'onglet actif est memorise dans le localStorage.

### 1.3 Filtrage par categorie
Tags de categorie sur les conteneurs (labels Docker) : `Database`, `Web`, `API`, `Worker`, `Cache`, `Monitoring`, `Custom`. Filtres multi-selection : clic sur un ou plusieurs tags pour filtrer la liste. Bouton `Effacer les filtres`. Les tags sont affiches sous la barre de recherche comme des chips colorees.

### 1.4 Recherche
Barre de recherche en haut : recherche par nom, image, ID (partiel, minimum 3 caracteres), label, port. Resultats en surbrillance dans le tableau. Recherche fuzzy pour les noms approximatifs. Debounce de 200ms. Raccourci : `/` focus la barre de recherche, `Escape` efface.

### 1.5 Tri
Clic sur l'en-tete de colonne pour trier : nom (A-Z/Z-A), statut, CPU (decroissant), RAM (decroissant), uptime (plus recent/plus ancien). Tri secondaire par nom par defaut. Indicateur de direction (fleche haut/bas) dans l'en-tete.

### 1.6 Vue compacte et vue detaillee
Toggle entre vue compacte (une ligne par conteneur, informations essentielles) et vue detaillee (deux lignes par conteneur avec ports, volumes et labels affiches). Preference memorisee par utilisateur dans localStorage. Raccourci : `Ctrl+Shift+V` toggle la vue.

### 1.7 Actualisation
Bouton `Refresh` pour actualiser manuellement la liste. Actualisation automatique via SSE (temps reel). Si la connexion SSE est perdue, un bandeau jaune s'affiche : `Connexion perdue. Reconnexion...` et le systeme tente une reconnexion toutes les 5 secondes. Indicateur de derniere actualisation dans le coin : `Mis a jour il y a 2s`.

---

## Categorie 2 — Actions sur les conteneurs

### 2.1 Demarrer/Arreter/Redemarrer
Boutons d'action rapide sur chaque ligne :
- **Start** (triangle vert) : demarre un conteneur arrete. API : `POST /api/v1/containers/:id/start` → `bollard::container::start_container`.
- **Stop** (carre rouge) : arrete proprement un conteneur (SIGTERM + timeout 10s → SIGKILL). API : `POST /api/v1/containers/:id/stop`. Le timeout est configurable par conteneur.
- **Restart** (fleche circulaire) : stop puis start. API : `POST /api/v1/containers/:id/restart`.

Feedback instantane : changement du statut et de la pastille avec animation (flash vert/rouge 300ms). Si l'action echoue, toast d'erreur : `Impossible de demarrer "nginx" : port 80 already allocated`. Le bouton est desactive pendant l'execution (loading spinner). Raccourcis clavier quand un conteneur est selectionne : `S` start, `X` stop, `R` restart.

### 2.2 Pause/Resume
Mettre en pause un conteneur (freeze des processus) sans l'arreter. Le conteneur garde sa memoire mais ne consomme plus de CPU. Resume pour reprendre l'execution. API : `POST /api/v1/containers/:id/pause`, `POST /api/v1/containers/:id/unpause`. Le statut passe a `Paused` (pastille bleue).

### 2.3 Supprimer
Bouton `Supprimer` avec confirmation modale : `Etes-vous sur de vouloir supprimer le conteneur "nginx" ? Cette action est irreversible.` Options (checkboxes) : `Supprimer les volumes associes`, `Forcer l'arret si en cours d'execution`. Si le conteneur est en cours et que force n'est pas coche, erreur : `Le conteneur est en cours d'execution. Arretez-le d'abord ou cochez "Forcer l'arret".`. API : `DELETE /api/v1/containers/:id?force=true&volumes=true` → `bollard::container::remove_container`.

### 2.4 Actions en masse
Selection multiple (checkboxes a gauche de chaque ligne, ou `Ctrl+A` pour tout selectionner) → boutons d'action de masse dans la toolbar : `Demarrer tout`, `Arreter tout`, `Supprimer la selection`. Confirmation avant execution avec liste des conteneurs concernes. Progression par conteneur. Resultat affiche dans un toast : `3/5 conteneurs arretes. 2 erreurs.`.

### 2.5 Renommer
Clic droit → `Renommer` ou double-clic sur le nom. Modification du nom du conteneur inline. Validation : caracteres alphanumeriques, tirets, underscores, 1-63 caracteres. Pas de doublon de nom (erreur : `Le nom "web-server" est deja utilise`). API : `PATCH /api/v1/containers/:id/rename` → `bollard::container::rename_container`.

### 2.6 Commit (sauvegarder comme image)
Clic droit → `Commit as Image`. Creer une image Docker a partir de l'etat actuel du conteneur. Formulaire modal : nom de l'image (`myapp`), tag (`v1.0`), message de commit (optionnel). L'image apparait dans le gestionnaire d'images. API : `POST /api/v1/containers/:id/commit` → `bollard::container::commit_container`. Progression : spinner pendant le commit, toast de succes avec le nom de l'image creee.

### 2.7 Exec (console dans le conteneur)
Bouton `Console` ouvre un terminal web dans un panneau en bas de l'ecran. Shell par defaut : `/bin/sh` (fallback si `/bin/bash` n'existe pas). Terminal interactif avec support des couleurs ANSI, resize automatique. Commandes executees via `bollard::exec::create_exec` + `bollard::exec::start_exec`. Le terminal est connecte via WebSocket pour la latence minimale. Bouton `Fermer` ou `Escape` ferme le terminal. Restriction RBAC : seuls les utilisateurs avec le role `containers.exec` peuvent ouvrir une console. L'historique des commandes executees est logge dans l'audit trail.

---

## Categorie 3 — Detail d'un conteneur

### 3.1 Panneau de detail
Clic sur le nom d'un conteneur → page dediee avec onglets :
- **Overview** : nom, ID, image, statut, created, started, IP, ports, commande, entrypoint
- **Logs** : logs en temps reel
- **Stats** : metriques CPU/RAM/reseau/disque
- **Inspect** : JSON complet de l'inspection Docker
- **Environment** : variables d'environnement
- **Volumes** : montages (source, destination, mode)
- **Network** : reseaux attaches, IP, aliases
- **Processes** : top des processus dans le conteneur

Navigation par onglets avec raccourcis clavier : `1` Overview, `2` Logs, `3` Stats, `4` Inspect.

### 3.2 Informations generales (Overview)
Carte recapitulative :
- **Container ID** : hash court (12 chars) + bouton copie (hash complet dans le clipboard)
- **Image** : nom:tag (lien vers le detail de l'image)
- **Status** : `Running since 2d 5h 30m` ou `Exited (0) 3h ago` avec code de sortie
- **Command** : commande lancee au demarrage (code monospace, tronquee avec tooltip)
- **Ports** : tableau des mappings (host port → container port, protocole TCP/UDP)
- **Labels** : liste des labels Docker (cle: valeur, 2 colonnes)
- **Restart policy** : `no` / `always` / `unless-stopped` / `on-failure:3`
- **Resources** : CPU limit, memory limit (avec barre de progression de l'usage actuel)

### 3.3 Variables d'environnement
Tableau des variables d'environnement du conteneur : cle, valeur. Les valeurs contenant `PASSWORD`, `SECRET`, `TOKEN`, `KEY`, `CREDENTIAL` sont masquees par defaut (`********`) avec un bouton oeil pour reveler temporairement (5 secondes). Bouton copier par ligne. Recherche dans les variables. Non-editable (lecture seule, definies a la creation). Nombre total affiche : `24 variables`.

### 3.4 Montages de volumes
Tableau : source (path hote ou nom du volume), destination (path dans le conteneur), mode (rw/ro avec badge couleur : vert rw, orange ro), driver, taille. Lien vers le gestionnaire de volumes pour les volumes nommes. Si un volume est un bind mount, le chemin hote est affiche avec un bouton `Ouvrir dans Drive`.

### 3.5 Configuration reseau
Reseaux attaches au conteneur : nom du reseau, subnet, gateway, IP attribuee, aliases. Bouton `Connecter a un reseau` ouvre un dropdown des reseaux disponibles. Bouton `Deconnecter` avec confirmation. Affichage des ports exposes dans un schema visuel (host:port → container:port avec fleche).

---

## Categorie 4 — Logs

### 4.1 Logs en temps reel (follow mode)
Flux de logs en streaming (`bollard::container::logs` avec `follow: true`). Affichage avec horodatage, coloration syntaxique (erreurs en rouge `#ef4444`, warnings en orange `#f59e0b`, info en bleu `#3b82f6`, debug en gris `#6b7280`). Scroll automatique vers le bas (toggleable via bouton `Auto-scroll` ou raccourci `A`). Bouton `Pause` pour figer le flux (le streaming continue en background, les lignes sont bufferisees et affichees au resume). Police monospace (font-family: `ui-monospace, "Cascadia Code", "Source Code Pro", monospace`). Fond sombre (`#0d1117`).

API : `GET /api/v1/containers/:id/logs?follow=true&tail=500` en SSE. Le frontend recoit les lignes une par une et les append au buffer DOM (virtualized pour eviter les problemes de memoire au-dela de 10 000 lignes).

### 4.2 Filtrage des logs
Barre de filtre en haut du panneau : recherche par mot-cle (highlight des occurrences en jaune `#fbbf24`), filtre par stream (stdout vert, stderr rouge — toggles), filtre par date (depuis, jusqu'a — datepicker). Regex supportee pour les recherches avancees (toggle `Regex` dans la barre). Compteur de resultats : `42 occurrences de "error"`.

### 4.3 Historique des logs
Chargement des logs passes : derniere heure, dernier jour, derniere semaine, custom. Pagination pour les gros volumes (chargement par blocs de 1000 lignes). Indicateur du nombre de lignes total. Bouton `Charger plus` en haut du panneau pour remonter dans l'historique. API : `GET /api/v1/containers/:id/logs?since=2026-04-09T00:00:00Z&until=2026-04-10T00:00:00Z&tail=1000`.

### 4.4 Telechargement
Bouton `Telecharger les logs` : export en fichier texte (`.log`) avec les filtres appliques. Options dans le dialog : inclure les timestamps (toggle), limiter a une periode (depuis/jusqu'a), format (texte brut, JSON lines). Taille maximale de l'export : 100 Mo.

### 4.5 Wrap et colonnes
Toggle word-wrap (lignes longues tronquees vs wrappees — raccourci `W`). Mode colonne : parsing automatique des logs structures (JSON) en tableau avec colonnes (timestamp, level, message, fields). Detection automatique si > 80% des lignes sont du JSON valide. Toggle entre vue brute et vue structuree.

---

## Categorie 5 — Monitoring et statistiques (CPU/RAM charts)

### 5.1 CPU en temps reel (chart)
Graphique en courbe (Recharts ou Chart.js, MIT) : utilisation CPU (%) sur les 5 dernieres minutes avec refresh toutes les 2 secondes. Axe Y : 0-100% (ou 0-N*100% pour les conteneurs multi-CPU). Limite CPU affichee en ligne horizontale pointillee rouge si configuree. Couleur de la courbe : vert (<70%), orange (70-90%), rouge (>90%). Survol : tooltip avec la valeur exacte et le timestamp. API : `GET /api/v1/containers/:id/stats/stream` en SSE. Le calcul du CPU % est fait cote backend depuis les compteurs cumulatifs Docker : `(cpu_delta / system_delta) * num_cpus * 100`.

### 5.2 Memoire en temps reel (chart)
Graphique en courbe : utilisation RAM (Mo/Go) sur les 5 dernieres minutes. Limite memoire affichee en ligne pointillee rouge. Tooltip : Usage / Limit / Cache / RSS detailles. Alerte visuelle si l'usage depasse 90% de la limite (fond rouge transparent sur la zone du graphique). Legende : `Usage: 384 Mo / 512 Mo (75%)`.

### 5.3 Reseau (chart)
Graphique en courbe double : trafic entrant (Rx, bleu) et sortant (Tx, vert) en Ko/s ou Mo/s (auto-scale). Cumul total depuis le demarrage affiche en dessous : `Rx: 1.2 Go | Tx: 450 Mo`. Ventilation par interface reseau si multiple.

### 5.4 Disque I/O (chart)
Graphique : operations de lecture (bleu) et ecriture (orange) en Mo/s. Cumul total. Utile pour detecter les goulots d'etranglement I/O.

### 5.5 Historique des metriques
Integration avec signapps-metrics (port 3008) pour l'historique au-dela des 5 minutes. Selecteur de periode : 1h, 24h, 7j, 30j. Graphiques sur la periode selectionnee avec resolution adaptee (1 point par seconde pour 1h, 1 par minute pour 24h, 1 par heure pour 7j). Metriques Prometheus exposees par le service :
- `container_cpu_usage_seconds_total{name="nginx"}`
- `container_memory_usage_bytes{name="nginx"}`
- `container_network_receive_bytes_total{name="nginx"}`
- `container_network_transmit_bytes_total{name="nginx"}`
- `container_fs_reads_bytes_total{name="nginx"}`
- `container_fs_writes_bytes_total{name="nginx"}`

### 5.6 Comparaison
Selectionner 2-3 conteneurs (checkboxes dans la liste) → bouton `Comparer`. Graphiques cote a cote ou superposes (toggle). Couleurs distinctes par conteneur. Legende avec le nom du conteneur. Utile pour identifier quel conteneur consomme le plus.

### 5.7 Top des processus
Commande `top` dans le conteneur (`bollard::container::top_container`): PID, USER, %CPU, %MEM, VSZ, RSS, COMMAND. Actualisation toutes les 5 secondes. Tri par CPU ou MEM (clic sur l'en-tete). Le processus le plus consommateur est surligne en rouge s'il depasse 50% CPU.

---

## Categorie 6 — Images Docker

### 6.1 Liste des images
Tableau : nom, tag (badge), taille (format humain : `145 Mo`), date de creation, nombre de conteneurs utilisant cette image (badge compteur). Filtres : images utilisees/inutilisees, par taille (>100 Mo), par date. Recherche par nom. Tri par taille (decroissant) est le defaut. Pastille verte si l'image est utilisee par au moins un conteneur, grise sinon. API : `GET /api/v1/containers/images` → `bollard::image::list_images`.

### 6.2 Pull d'image
Bouton `Pull Image` ouvre un dialog : saisir le nom complet (`nginx:latest`, `registry.signapps.com/app:v2`). Autocompletion depuis Docker Hub pour les images populaires. Barre de progression avec les couches (layers) telechargees : `Layer 3/7 : 45 Mo / 120 Mo`. Support des registres prives avec authentification (credentials stockes dans le vault). API : `POST /api/v1/containers/images/pull` avec `{ image, tag, registry_auth }`. SSE pour la progression : `GET /api/v1/containers/images/pull/:id/progress`. Si le pull echoue (image non-trouvee, auth invalide), message d'erreur : `Image "myapp:v3" not found in registry.signapps.com`.

### 6.3 Supprimer une image
Suppression avec confirmation : `Supprimer l'image "nginx:1.25" (145 Mo) ?`. Impossible si un conteneur l'utilise (message d'erreur avec liste des conteneurs). Option `Force` pour supprimer meme si utilisee (confirmation renforcee avec saisie du nom de l'image). API : `DELETE /api/v1/containers/images/:id?force=true` → `bollard::image::remove_image`.

### 6.4 Inspection d'image
Detail : layers (taille par couche en tableau), entrypoint, cmd, env (variables), ports exposes, volumes, labels, architecture (amd64, arm64), OS, taille totale. Dockerfile reconstitue (historique des layers avec la commande Docker pour chaque couche). API : `GET /api/v1/containers/images/:id/inspect` → `bollard::image::inspect_image`.

### 6.5 Nettoyage (prune)
Bouton `Prune` : supprimer les images orphelines (dangling), les images non-utilisees, les build caches. Affichage de l'espace recuperable avant confirmation : `3 images orphelines detectees (890 Mo). Supprimer ?`. Statistiques de nettoyage apres execution : `2.1 Go liberes`. API : `POST /api/v1/containers/images/prune` → `bollard::image::prune_images`.

---

## Categorie 7 — Volumes et reseaux

### 7.1 Liste des volumes
Onglet `Volumes`. Tableau : nom, driver (local, nfs, etc.), taille (calculee si disponible), date de creation, conteneurs montes (nombre + noms). Filtres : utilises/orphelins. Bouton `Creer un volume` : nom, driver (dropdown), options (JSON). API : `GET /api/v1/containers/volumes` → `bollard::volume::list_volumes`.

### 7.2 Inspection de volume
Clic sur un volume → detail : nom, mountpoint (chemin sur l'hote), driver, options, labels, taille occupee (si mesurable). Liste des conteneurs qui l'utilisent avec lien vers le detail du conteneur. Bouton `Parcourir` pour naviguer dans le contenu du volume (lecture seule, arborescence de fichiers avec taille). API : `GET /api/v1/containers/volumes/:name/inspect`, `GET /api/v1/containers/volumes/:name/browse`.

### 7.3 Creation de volume
Formulaire : nom (unique), driver (`local` par defaut), options (JSON avance, optionnel), labels (cle-valeur). Validation : le nom ne doit contenir que des caracteres alphanumeriques, tirets et underscores. API : `POST /api/v1/containers/volumes` → `bollard::volume::create_volume`.

### 7.4 Suppression et nettoyage des volumes
Suppression individuelle avec confirmation. Impossible si un conteneur est monte (message d'erreur). Bouton `Prune` : supprimer les volumes orphelins (non-attaches a un conteneur). Affichage de l'espace recuperable. Protection : les volumes tagges `signapps.system=true` ne sont jamais supprimes par le prune. API : `DELETE /api/v1/containers/volumes/:name`, `POST /api/v1/containers/volumes/prune`.

### 7.5 Liste des reseaux
Onglet `Networks`. Tableau : nom, driver (bridge, overlay, host, macvlan), subnet, gateway, conteneurs connectes (nombre). Bouton `Creer un reseau` : nom, driver (dropdown), subnet (CIDR), gateway, options. API : `GET /api/v1/containers/networks` → `bollard::network::list_networks`.

### 7.6 Inspection de reseau
Detail : nom, ID, driver, subnet, gateway, options, labels. Liste des conteneurs connectes avec leur IP sur ce reseau. Diagramme visuel des connexions entre conteneurs sur ce reseau (graphe de noeuds avec les IPs). API : `GET /api/v1/containers/networks/:id/inspect` → `bollard::network::inspect_network`.

### 7.7 Connexion/Deconnexion
Depuis le detail d'un reseau : bouton `Connecter un conteneur` (dropdown des conteneurs non-connectes). Depuis le detail d'un conteneur : bouton `Connecter a un reseau` (dropdown des reseaux). Deconnexion avec confirmation. API : `POST /api/v1/containers/networks/:id/connect`, `POST /api/v1/containers/networks/:id/disconnect`.

---

## Categorie 8 — Creation de conteneurs (wizard)

### 8.1 Bouton New Container (wizard)
Bouton `+ New Container` ouvre un assistant de creation en 7 etapes avec stepper horizontal :
1. **Image** : selection depuis les images locales (dropdown avec recherche) ou pull depuis un registre (champ texte + bouton Pull). Preview de l'image selectionnee (taille, layers, date).
2. **Configuration** : nom du conteneur (auto-genere si vide), commande (override de l'entrypoint), variables d'environnement (tableau cle-valeur avec bouton +, import depuis un fichier `.env`).
3. **Ports** : mapping host:container (tableau editable). Bouton `+ Port`. Detection automatique des ports exposes par l'image (pre-rempli). Validation : le port hote ne doit pas etre deja utilise (verification en temps reel).
4. **Volumes** : montages (bind mount avec chemin hote, ou volume nomme depuis la liste). Bouton `+ Volume`. Mode rw/ro par toggle.
5. **Reseau** : selection du reseau (dropdown, `bridge` par defaut), aliases, hostname.
6. **Resources** : limites CPU (nombre de cores, slider 0.1-16), memoire (slider avec unites Mo/Go, defaut : illimite), restart policy (dropdown : no, always, unless-stopped, on-failure avec max retries).
7. **Avance** : labels (cle-valeur), capabilities (add/drop), user (override), working directory, privileged mode (checkbox avec warning rouge).

Bouton `Creer` a chaque etape pour sauter les etapes optionnelles. Bouton `Creer et demarrer` pour creer et lancer immediatement. API : `POST /api/v1/containers` avec body complet → `bollard::container::create_container` + optionnel `bollard::container::start_container`.

### 8.2 Import Docker Compose (Stacks)
Onglet `Stacks` dans la navigation. Bouton `+ New Stack`. Import d'un fichier `docker-compose.yml` par upload ou collage dans un editeur YAML avec coloration syntaxique. Parsing et affichage des services definis (liste avec nom, image, ports, volumes). Validation du YAML : erreurs affichees inline (ligne et message). Bouton `Deploy` pour lancer tous les services. Gestion groupee : start/stop/restart de la stack entiere. Les conteneurs de la stack sont tagges avec le label `com.docker.compose.project=<stack_name>`. Edition du compose avec live preview des services.

API : `POST /api/v1/containers/stacks` avec body `{ name, compose_yaml }`. Le backend parse le YAML, cree les reseaux, volumes et conteneurs. SSE pour la progression du deploiement : `Creating network "app_default"...`, `Creating container "app_web_1"...`, `Starting container "app_web_1"...`.

### 8.3 Templates
Bibliotheque de templates pre-configures : PostgreSQL (port 5432, volume pgdata, env POSTGRES_PASSWORD), Redis (port 6379), Nginx (port 80/443), Node.js, Python, WordPress, Gitea, Minio. Chaque template pre-remplit le formulaire de creation avec les valeurs recommandees. Personnalisation avant creation. Badge `Recommande` sur les templates les plus utilises. API : `GET /api/v1/containers/templates`.

### 8.4 Clone de conteneur
Cloner un conteneur existant : copie de toute la configuration (image, env, ports, volumes, network, resources). Modification du nom (obligatoire, suggere : `<nom>-clone`). Option de copier ou non les volumes (checkbox). API : `POST /api/v1/containers/:id/clone`.

---

## Schema PostgreSQL (container state tracking)

```sql
-- Etat des conteneurs (cache local pour l'historique et les recherches)
CREATE TABLE container_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    container_id VARCHAR(64) NOT NULL,
    container_name VARCHAR(255) NOT NULL,
    image_name VARCHAR(500) NOT NULL,
    image_tag VARCHAR(100) NOT NULL DEFAULT 'latest',
    status VARCHAR(20) NOT NULL,
    created_at_docker TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    ports JSONB,
    labels JSONB,
    environment JSONB,
    volumes JSONB,
    networks JSONB,
    cpu_limit NUMERIC(5,2),
    memory_limit_bytes BIGINT,
    restart_policy VARCHAR(20),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_managed BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(org_id, container_id)
);
CREATE INDEX idx_container_states_org ON container_states(org_id);
CREATE INDEX idx_container_states_status ON container_states(org_id, status);
CREATE INDEX idx_container_states_name ON container_states(org_id, container_name);

-- Stacks (Docker Compose)
CREATE TABLE container_stacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    compose_yaml TEXT NOT NULL,
    services JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'stopped' CHECK (status IN ('running', 'stopped', 'partial', 'deploying', 'error')),
    deployed_at TIMESTAMPTZ,
    deployed_by UUID REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id, name)
);
CREATE INDEX idx_container_stacks_org ON container_stacks(org_id);

-- Templates de conteneurs
CREATE TABLE container_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image VARCHAR(500) NOT NULL,
    tag VARCHAR(100) NOT NULL DEFAULT 'latest',
    default_ports JSONB,
    default_env JSONB,
    default_volumes JSONB,
    default_resources JSONB,
    category VARCHAR(50),
    icon_url VARCHAR(500),
    is_recommended BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Metriques conteneurs (agregees)
CREATE TABLE container_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    container_id VARCHAR(64) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    cpu_percent NUMERIC(6,2),
    memory_usage_bytes BIGINT,
    memory_limit_bytes BIGINT,
    network_rx_bytes BIGINT,
    network_tx_bytes BIGINT,
    disk_read_bytes BIGINT,
    disk_write_bytes BIGINT
);
CREATE INDEX idx_container_metrics_id_time ON container_metrics(container_id, timestamp DESC);
-- Retention : 30 jours de donnees detaillees, 1 an de donnees aggregees par heure

-- Historique des actions
CREATE TABLE container_actions_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    container_id VARCHAR(64),
    container_name VARCHAR(255),
    action VARCHAR(30) NOT NULL CHECK (action IN (
        'create', 'start', 'stop', 'restart', 'pause', 'unpause',
        'remove', 'rename', 'commit', 'exec', 'pull', 'prune',
        'stack_deploy', 'stack_remove'
    )),
    details JSONB,
    user_id UUID NOT NULL REFERENCES users(id),
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_container_actions_log ON container_actions_log(org_id, created_at DESC);
CREATE INDEX idx_container_actions_container ON container_actions_log(container_id);

-- Registries prives
CREATE TABLE container_registries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    url VARCHAR(500) NOT NULL,
    auth_type VARCHAR(20) NOT NULL CHECK (auth_type IN ('basic', 'token', 'none')),
    credentials_vault_key VARCHAR(200),
    is_default BOOLEAN NOT NULL DEFAULT false,
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id, url)
);
```

---

## PgEventBus Events

| Event | Payload | Emitted by | Consumed by |
|---|---|---|---|
| `container.created` | `{ org_id, container_id, name, image }` | Containers | Dashboard, Audit, Backups |
| `container.started` | `{ org_id, container_id, name }` | Containers | Dashboard, Metrics |
| `container.stopped` | `{ org_id, container_id, name, exit_code }` | Containers | Dashboard, Alerts |
| `container.removed` | `{ org_id, container_id, name }` | Containers | Dashboard, Audit |
| `container.health.unhealthy` | `{ org_id, container_id, name, check_output }` | Containers | Alerts, Notifications |
| `container.resource.high` | `{ container_id, resource, value, threshold }` | Containers | Alerts |
| `image.pulled` | `{ org_id, image, tag, size_bytes }` | Containers | Dashboard, Audit |
| `image.removed` | `{ org_id, image, tag }` | Containers | Audit |
| `stack.deployed` | `{ org_id, stack_id, name, services }` | Containers | Dashboard, Audit |
| `stack.removed` | `{ org_id, stack_id, name }` | Containers | Audit |
| `container.exec` | `{ org_id, container_id, command, user_id }` | Containers | Audit |
| `container.prune` | `{ org_id, freed_bytes, removed_count }` | Containers | Dashboard |

---

## REST API Endpoints (via bollard crate)

```
# Containers
GET    /api/v1/containers                               — List containers (filter: status, label, name)
GET    /api/v1/containers/stream                         — SSE stream of container state changes
POST   /api/v1/containers                               — Create container (full config body)
GET    /api/v1/containers/:id                            — Get container details (inspect)
DELETE /api/v1/containers/:id                            — Remove container (query: force, volumes)
POST   /api/v1/containers/:id/start                     — Start container
POST   /api/v1/containers/:id/stop                      — Stop container (query: timeout)
POST   /api/v1/containers/:id/restart                   — Restart container
POST   /api/v1/containers/:id/pause                     — Pause container
POST   /api/v1/containers/:id/unpause                   — Unpause container
PATCH  /api/v1/containers/:id/rename                    — Rename container
POST   /api/v1/containers/:id/commit                    — Commit container as image
POST   /api/v1/containers/:id/clone                     — Clone container
POST   /api/v1/containers/:id/exec                      — Execute command (WebSocket)
GET    /api/v1/containers/:id/logs                       — Get logs (query: follow, tail, since, until) — SSE
GET    /api/v1/containers/:id/stats/stream               — Stream stats (SSE)
GET    /api/v1/containers/:id/top                        — Top processes

# Images
GET    /api/v1/containers/images                         — List images (filter: dangling, reference)
POST   /api/v1/containers/images/pull                    — Pull image (body: image, tag, auth)
GET    /api/v1/containers/images/pull/:id/progress        — Pull progress (SSE)
GET    /api/v1/containers/images/:id                     — Inspect image
DELETE /api/v1/containers/images/:id                     — Remove image (query: force)
POST   /api/v1/containers/images/prune                   — Prune unused images
GET    /api/v1/containers/images/:id/history              — Image layer history

# Volumes
GET    /api/v1/containers/volumes                        — List volumes
POST   /api/v1/containers/volumes                        — Create volume
GET    /api/v1/containers/volumes/:name/inspect           — Inspect volume
GET    /api/v1/containers/volumes/:name/browse            — Browse volume contents (read-only)
DELETE /api/v1/containers/volumes/:name                   — Remove volume
POST   /api/v1/containers/volumes/prune                   — Prune orphan volumes

# Networks
GET    /api/v1/containers/networks                       — List networks
POST   /api/v1/containers/networks                       — Create network
GET    /api/v1/containers/networks/:id/inspect            — Inspect network
DELETE /api/v1/containers/networks/:id                    — Remove network
POST   /api/v1/containers/networks/:id/connect            — Connect container to network
POST   /api/v1/containers/networks/:id/disconnect         — Disconnect container from network

# Stacks (Docker Compose)
GET    /api/v1/containers/stacks                         — List stacks
POST   /api/v1/containers/stacks                         — Deploy stack (body: name, compose_yaml)
GET    /api/v1/containers/stacks/:id                     — Get stack details with services
PATCH  /api/v1/containers/stacks/:id                     — Update stack compose
POST   /api/v1/containers/stacks/:id/start               — Start all stack services
POST   /api/v1/containers/stacks/:id/stop                — Stop all stack services
POST   /api/v1/containers/stacks/:id/restart              — Restart all stack services
DELETE /api/v1/containers/stacks/:id                     — Remove stack and containers

# Templates
GET    /api/v1/containers/templates                      — List container templates

# Registries
GET    /api/v1/containers/registries                     — List registries
POST   /api/v1/containers/registries                     — Add registry
DELETE /api/v1/containers/registries/:id                  — Remove registry
POST   /api/v1/containers/registries/:id/test             — Test registry connection

# Metrics
GET    /api/v1/containers/:id/metrics                    — Historical metrics (query: period)
GET    /metrics                                          — Prometheus metrics endpoint
```

Auth JWT. Rate limiting : 100 req/min. RBAC roles : `containers.admin` (full), `containers.operator` (start/stop/logs/stats), `containers.viewer` (read-only).

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Docker Documentation** (docs.docker.com) — reference complete de l'API Docker, concepts (containers, images, volumes, networks), CLI reference, compose specification.
- **Portainer Documentation** (docs.portainer.io) — guides d'utilisation de l'interface web, gestion des stacks, RBAC, templates, edge computing.
- **Yacht Documentation** (yacht.sh/docs) — architecture simple, templates, API REST, theming.
- **Lazydocker README** (github.com/jesseduffield/lazydocker) — patterns d'interface pour le monitoring de conteneurs, raccourcis, vue unifiee.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **bollard** (github.com/fussybeaver/bollard) | **MIT/Apache-2.0** | Deja utilise dans signapps-containers. Client Docker API en Rust async. Reference directe pour toutes les operations. |
| **Yacht** (github.com/SelfhostedPro/Yacht) | **MIT** | Pattern d'interface web pour Docker management. Templates, projects, monitoring. Architecture Vue.js + FastAPI. |
| **Lazydocker** (github.com/jesseduffield/lazydocker) | **MIT** | Pattern d'UX pour le monitoring de conteneurs. Vues combinees, raccourcis, top processes. |
| **Portainer CE** (github.com/portainer/portainer) | **Zlib** | Licence permissive. Pattern pour la gestion de stacks, templates, RBAC Docker, edge computing. |
| **Dozzle** (github.com/amir20/dozzle) | **MIT** | Visualisation de logs Docker en temps reel. Pattern pour le streaming de logs avec filtre et recherche. |
| **ctop** (github.com/bcicen/ctop) | **MIT** | Monitoring de conteneurs type `top`. Pattern pour les metriques temps reel (CPU, RAM, I/O). |
| **docker-compose** spec (github.com/compose-spec/compose-spec) | **Apache-2.0** | Specification du format Compose. Reference pour le parsing et le deploiement de stacks. |
| **tokio** (github.com/tokio-rs/tokio) | **MIT** | Runtime async Rust. Deja utilise. Base pour le streaming de logs et stats. |
| **axum** (github.com/tokio-rs/axum) | **MIT** | Framework web Rust. Deja utilise pour les handlers du service. |
| **serde_json** (github.com/serde-rs/json) | **MIT/Apache-2.0** | Serialisation JSON en Rust. Pour l'inspection Docker et les reponses API. |

### Pattern d'implementation recommande
1. **API Docker** : `bollard` (MIT, deja en place) pour toutes les operations. Connexion via socket Unix (`/var/run/docker.sock`) ou TCP.
2. **Streaming logs** : `bollard::container::LogsOptions` avec `follow: true`. Streaming SSE vers le frontend pour les logs en temps reel.
3. **Stats temps reel** : `bollard::container::StatsOptions` avec `stream: true`. Calcul du % CPU depuis les compteurs cumulatifs. Envoi au frontend via SSE.
4. **Listing** : `bollard::container::ListContainersOptions` avec filtres par statut et labels. Refresh via SSE (pas de polling).
5. **Stacks** : parsing du `docker-compose.yml` cote backend (serde_yaml). Creation des services via l'API Docker (create + start). Gestion groupee par label de stack.
6. **Images** : `bollard::image::*` pour pull, list, remove, inspect. Support des registres prives via `bollard::auth::DockerCredentials`.
7. **Frontend** : composants React avec SSE pour les updates temps reel. Graphiques avec Recharts (MIT) pour les stats. Terminal web avec xterm.js (MIT) pour l'exec.

### Ce qu'il ne faut PAS faire
- **Pas d'acces direct au socket Docker** depuis le frontend — tout passe par le service signapps-containers avec RBAC.
- **Pas d'execution de commandes arbitraires** sans validation — l'exec dans un conteneur est restreint aux utilisateurs avec le role `containers.exec`.
- **Pas de suppression de volumes systeme** — les volumes tagges `signapps.system=true` sont proteges.
- **Pas de copier-coller** depuis les projets ci-dessus, meme MIT. On s'inspire des patterns, on reecrit.
- **Pas de dependance GPL/AGPL** — meme comme dependance transitive (cargo deny bloque).
- **Pas de stockage de credentials Docker en clair** — les tokens de registre sont dans le vault.
- **Pas d'exposition du daemon Docker** sur le reseau sans TLS — communication locale uniquement ou TLS mutuel.

---

## Assertions E2E cles (a tester)

- Affichage de la liste des conteneurs avec statut correct (Running/Stopped) et metriques temps reel
- Filtrage par onglet (All, Running, Stopped, Idle, System)
- Filtrage par categorie (tags/labels) avec multi-selection
- Recherche par nom de conteneur (fuzzy)
- Demarrer un conteneur arrete → statut passe a Running (animation feedback)
- Arreter un conteneur en cours → statut passe a Stopped
- Redemarrer un conteneur → statut temporairement Restarting puis Running
- Supprimer un conteneur avec confirmation (et option de supprimer les volumes)
- Actions en masse : arreter 3 conteneurs selectionnes
- Detail d'un conteneur : overview, env (masquage secrets), volumes, network
- Console exec : ouvrir un shell interactif dans un conteneur
- Logs en temps reel avec streaming SSE et auto-scroll
- Filtre de logs par mot-cle avec highlight des occurrences
- Filtre de logs par stream (stdout/stderr)
- Telechargement des logs en fichier texte
- Logs structures : detection JSON et affichage en colonnes
- Stats CPU en graphique temps reel (courbe sur 5 min)
- Stats RAM en graphique temps reel avec indication de la limite
- Stats reseau (Rx/Tx) en graphique
- Comparaison de metriques entre 2 conteneurs cote a cote
- Historique des metriques sur 24h via signapps-metrics
- Top des processus dans un conteneur avec tri par CPU
- Pull d'une image depuis Docker Hub avec barre de progression (layers)
- Pull depuis un registre prive avec authentification
- Suppression d'une image inutilisee
- Prune des images orphelines avec affichage de l'espace recupere
- Inspection d'image : layers, env, ports, Dockerfile reconstitue
- Creation d'un conteneur via le wizard (7 etapes : image → ports → volumes → deploy)
- Import et deploy d'un stack docker-compose.yml
- Gestion groupee d'une stack (start/stop/restart)
- Clone d'un conteneur existant avec nouveau nom
- Template : creation d'un conteneur PostgreSQL depuis le template
- Commit d'un conteneur comme image
- Volume : creation, inspection, browse, suppression
- Reseau : creation, connexion d'un conteneur, inspection visuelle
- Nettoyage des volumes orphelines (prune)
- RBAC : un viewer ne peut pas demarrer/arreter un conteneur
- RBAC : seuls les admins peuvent executer des commandes (exec)
- Audit log : toutes les actions sont tracees avec utilisateur et IP
