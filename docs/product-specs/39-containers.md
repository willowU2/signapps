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
- **Nom** du conteneur (cliquable → detail)
- **Image** (nom:tag)
- **Statut** (Running/Stopped/Paused/Restarting/Created/Dead) avec pastille couleur
- **Uptime** (depuis combien de temps il tourne)
- **CPU** (pourcentage en temps reel)
- **RAM** (utilisation / limite)
- **Ports** (mapping host:container)
- **Tags** (labels Docker comme metadonnees : `Recent`, `ported`, etc.)
- **Actions** (boutons : Details, Logs, Stats)

### 1.2 Onglets de filtrage par statut
Onglets en haut de la liste :
- **All** : tous les conteneurs
- **Running** : conteneurs en cours d'execution (pastille verte)
- **Stopped** : conteneurs arretes (pastille grise)
- **Idle** : conteneurs en cours mais inactifs (CPU < 1% depuis > 5 min)
- **System** : conteneurs systeme SignApps (identifiés par label `signapps.system=true`)

Compteur dans chaque onglet (ex: Running (12), Stopped (3)).

### 1.3 Filtrage par categorie
Tags de categorie sur les conteneurs (labels Docker) : `Database`, `Web`, `API`, `Worker`, `Cache`, `Monitoring`, `Custom`. Filtres multi-selection : clic sur un ou plusieurs tags pour filtrer la liste. Bouton `Effacer les filtres`.

### 1.4 Recherche
Barre de recherche en haut : recherche par nom, image, ID (partiel), label, port. Resultats en surbrillance dans le tableau. Recherche fuzzy pour les noms approximatifs.

### 1.5 Tri
Clic sur l'en-tete de colonne pour trier : nom (A-Z/Z-A), statut, CPU (decroissant), RAM (decroissant), uptime (plus recent/plus ancien). Tri secondaire par nom par defaut.

### 1.6 Vue compacte et vue detaillee
Toggle entre vue compacte (une ligne par conteneur, informations essentielles) et vue detaillee (deux lignes par conteneur avec ports, volumes et labels affiches). Preference memorisee par utilisateur.

### 1.7 Actualisation
Bouton `Refresh` pour actualiser manuellement la liste. Actualisation automatique configurable : toutes les 5s (defaut), 10s, 30s, 1min, off. Indicateur de derniere actualisation.

---

## Categorie 2 — Actions sur les conteneurs

### 2.1 Demarrer/Arreter/Redemarrer
Boutons d'action rapide sur chaque ligne :
- **Start** (triangle vert) : demarre un conteneur arrete
- **Stop** (carre rouge) : arrete proprement un conteneur (SIGTERM + timeout → SIGKILL)
- **Restart** (fleche circulaire) : stop puis start
Feedback instantane : changement du statut et de la pastille.

### 2.2 Pause/Resume
Mettre en pause un conteneur (freeze des processus) sans l'arreter. Le conteneur garde sa memoire mais ne consomme plus de CPU. Resume pour reprendre l'execution.

### 2.3 Supprimer
Bouton `Supprimer` avec confirmation modale : "Etes-vous sur de vouloir supprimer le conteneur X ? Cette action est irreversible." Options : supprimer le conteneur uniquement, supprimer le conteneur ET ses volumes associes. Impossible de supprimer un conteneur en cours d'execution (forcer l'arret avant).

### 2.4 Actions en masse
Selection multiple (checkboxes) → boutons d'action de masse : `Demarrer tout`, `Arreter tout`, `Supprimer la selection`. Confirmation avant execution. Progression par conteneur.

### 2.5 Renommer
Clic droit → `Renommer`. Modification du nom du conteneur. Validation : caracteres alphanumeriques, tirets, underscores. Pas de doublon de nom.

### 2.6 Commit (sauvegarder comme image)
Clic droit → `Commit as Image`. Creer une image Docker a partir de l'etat actuel du conteneur. Formulaire : nom de l'image, tag, message de commit. L'image apparait dans le gestionnaire d'images.

---

## Categorie 3 — Detail d'un conteneur

### 3.1 Panneau de detail
Clic sur le nom d'un conteneur → panneau lateral ou page dediee avec onglets :
- **Overview** : nom, ID, image, statut, created, started, IP, ports, commande, entrypoint
- **Logs** : logs en temps reel
- **Stats** : metriques CPU/RAM/reseau/disque
- **Inspect** : JSON complet de l'inspection Docker
- **Environment** : variables d'environnement
- **Volumes** : montages (source, destination, mode)
- **Network** : reseaux attaches, IP, aliases
- **Processes** : top des processus dans le conteneur

### 3.2 Informations generales (Overview)
Carte recapitulative :
- **Container ID** : hash court + copie en clic
- **Image** : nom:tag (lien vers le registre)
- **Status** : Running since 2d 5h 30m / Exited (0) 3h ago
- **Command** : commande lancee au demarrage
- **Ports** : tableau des mappings (host port → container port, protocole)
- **Labels** : liste des labels Docker
- **Restart policy** : no / always / unless-stopped / on-failure
- **Resources** : CPU limit, memory limit, memory reservation

### 3.3 Variables d'environnement
Tableau des variables d'environnement du conteneur : cle, valeur (masquee si contient `PASSWORD`, `SECRET`, `TOKEN`, `KEY` — clic pour reveler). Bouton copier. Non-editable (lecture seule, definies a la creation).

### 3.4 Montages de volumes
Tableau : source (path hote ou nom du volume), destination (path dans le conteneur), mode (rw/ro), driver, taille. Lien vers le gestionnaire de volumes pour les volumes nommes.

### 3.5 Configuration reseau
Reseaux attaches au conteneur : nom du reseau, subnet, gateway, IP attribuee, aliases. Bouton `Connecter a un reseau` / `Deconnecter`. Affichage des ports exposes.

---

## Categorie 4 — Logs

### 4.1 Logs en temps reel
Flux de logs en streaming (tail -f). Affichage avec horodatage, coloration syntaxique (erreurs en rouge, warnings en orange, info en bleu). Scroll automatique vers le bas (toggleable). Bouton pause pour figer le flux.

### 4.2 Filtrage des logs
Barre de filtre : recherche par mot-cle (highlight des occurrences), filtre par niveau (stdout, stderr), filtre par date (depuis, jusqu'a). Regex supportee pour les recherches avancees.

### 4.3 Historique des logs
Chargement des logs passes : derniere heure, dernier jour, derniere semaine, custom. Pagination pour les gros volumes. Indicateur du nombre de lignes.

### 4.4 Telechargement
Bouton `Telecharger les logs` : export en fichier texte (.log) avec les filtres appliques. Option : inclure les timestamps, limiter a une periode.

### 4.5 Wrap et colonnes
Toggle word-wrap (lignes longues tronquees vs wrappees). Mode colonne : parsing automatique des logs structures (JSON) en tableau avec colonnes (timestamp, level, message, fields).

---

## Categorie 5 — Statistiques et monitoring

### 5.1 CPU en temps reel
Graphique en courbe : utilisation CPU (%) sur les 5 dernieres minutes avec refresh toutes les secondes. Limite CPU affichee si configuree. Couleur : vert (<70%), orange (70-90%), rouge (>90%).

### 5.2 Memoire en temps reel
Graphique en courbe : utilisation RAM (Mo/Go) sur les 5 dernieres minutes. Limite memoire affichee. Usage / Limit / Cache / RSS detailles. Alerte si proche de la limite.

### 5.3 Reseau
Graphique : trafic entrant (Rx) et sortant (Tx) en Ko/s ou Mo/s. Cumul total depuis le demarrage. Ventilation par interface reseau.

### 5.4 Disque I/O
Graphique : operations de lecture et ecriture par seconde. Debit (Mo/s). Cumul total. Utile pour detecter les goulots d'etranglement I/O.

### 5.5 Historique des metriques
Integration avec signapps-metrics (port 3008) pour l'historique au-dela des 5 minutes. Graphiques sur 1h, 24h, 7j, 30j. Metriques Prometheus : `container_cpu_usage_seconds_total`, `container_memory_usage_bytes`, `container_network_receive_bytes_total`.

### 5.6 Comparaison
Selectionner 2-3 conteneurs et comparer leurs metriques cote a cote. Utile pour identifier quel conteneur consomme le plus de ressources.

### 5.7 Top des processus
Commande `top` dans le conteneur : PID, USER, %CPU, %MEM, VSZ, RSS, COMMAND. Actualisation periodique. Tri par CPU ou MEM. Utile pour le debug.

---

## Categorie 6 — Images Docker

### 6.1 Liste des images
Tableau : nom, tag, taille, date de creation, nombre de conteneurs utilisant cette image. Filtres : images utilisees/inutilisees, par taille, par date. Recherche par nom.

### 6.2 Pull d'image
Bouton `Pull Image` : saisir le nom complet (`nginx:latest`, `registry.signapps.com/app:v2`). Barre de progression avec les couches (layers) telechargees. Support des registres prives avec authentification.

### 6.3 Supprimer une image
Suppression avec confirmation. Impossible si un conteneur l'utilise (message d'erreur avec liste des conteneurs). Option `Force` pour supprimer meme si utilisee (dangereux, confirmation renforcee).

### 6.4 Inspection d'image
Detail : layers (taille par couche), entrypoint, cmd, env, ports exposes, volumes, labels, architecture (amd64, arm64). Dockerfile reconstitue (historique des layers).

### 6.5 Nettoyage
Bouton `Prune` : supprimer les images orphelines (dangling), les images non-utilisees, les build caches. Affichage de l'espace recuperable avant confirmation. Statistiques de nettoyage.

---

## Categorie 7 — Volumes et reseaux

### 7.1 Liste des volumes
Tableau : nom, driver, taille, date de creation, conteneurs montes. Filtres : utilises/orphelins. Bouton `Creer un volume` : nom, driver (local, nfs, etc.), options.

### 7.2 Inspection de volume
Detail : nom, mountpoint, driver, options, labels, taille occupee. Liste des conteneurs qui l'utilisent. Bouton `Parcourir` pour naviguer dans le contenu du volume (lecture seule).

### 7.3 Nettoyage des volumes
Bouton `Prune` : supprimer les volumes orphelins (non-attaches a un conteneur). Affichage de l'espace recuperable. Confirmation.

### 7.4 Liste des reseaux
Tableau : nom, driver (bridge, overlay, host, macvlan), subnet, gateway, conteneurs connectes. Bouton `Creer un reseau` : nom, driver, subnet, gateway, options.

### 7.5 Inspection de reseau
Detail : nom, ID, driver, subnet, gateway, options, labels. Liste des conteneurs connectes avec leur IP. Diagramme visuel des connexions entre conteneurs sur ce reseau.

---

## Categorie 8 — Creation de conteneurs

### 8.1 Bouton New Container
Bouton `+ New Container` ouvre un assistant de creation en etapes :
1. **Image** : selection depuis les images locales ou pull depuis un registre
2. **Configuration** : nom, commande, variables d'environnement
3. **Ports** : mapping host:container (tableau editable)
4. **Volumes** : montages (bind mount ou volume nomme)
5. **Reseau** : selection du reseau, aliases
6. **Resources** : limites CPU, memoire, restart policy
7. **Avance** : labels, capabilities, user, working dir

### 8.2 Import de conteneur
Bouton `Import Container` : importer une image depuis un fichier `.tar` (docker save/export). Upload du fichier, parsing, creation de l'image. Puis creation d'un conteneur a partir de cette image.

### 8.3 Docker Compose (Stacks)
Onglet `Stacks` : importer un fichier `docker-compose.yml`. Parsing et affichage des services. Bouton `Deploy` pour lancer tous les services. Gestion groupee : start/stop/restart de la stack entiere. Edition du compose avec preview.

### 8.4 Templates
Bibliotheque de templates pre-configures : PostgreSQL, Redis, Nginx, Node.js, Python, WordPress, Gitea, Minio. Chaque template pre-remplit le formulaire de creation avec les valeurs recommandees. Personnalisation avant creation.

### 8.5 Clone de conteneur
Cloner un conteneur existant : copie de toute la configuration (image, env, ports, volumes, network, resources). Modification du nom (obligatoire). Option de copier ou non les volumes.

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
3. **Stats temps reel** : `bollard::container::StatsOptions` avec `stream: true`. Calcul du % CPU depuis les compteurs cumulatifs. Envoi au frontend via SSE ou WebSocket.
4. **Listing** : `bollard::container::ListContainersOptions` avec filtres par statut et labels. Refresh periodique ou on-demand.
5. **Stacks** : parsing du `docker-compose.yml` cote backend (serde_yaml). Creation des services via l'API Docker (create + start). Gestion groupee par label de stack.
6. **Images** : `bollard::image::*` pour pull, list, remove, inspect. Support des registres prives via `bollard::auth::DockerCredentials`.
7. **Frontend** : composants React avec refresh auto (useEffect + interval ou SSE). Graphiques avec Recharts ou Chart.js (MIT) pour les stats.

### Ce qu'il ne faut PAS faire
- **Pas d'acces direct au socket Docker** depuis le frontend — tout passe par le service signapps-containers avec RBAC.
- **Pas d'execution de commandes arbitraires** sans validation — l'exec dans un conteneur est restreint aux commandes pre-approuvees ou aux admins.
- **Pas de suppression de volumes systeme** — les volumes tagges `signapps.system=true` sont proteges.
- **Pas de copier-coller** depuis les projets ci-dessus, meme MIT. On s'inspire des patterns, on reecrit.
- **Pas de dependance GPL/AGPL** — meme comme dependance transitive (cargo deny bloque).
- **Pas de stockage de credentials Docker en clair** — les tokens de registre sont dans le vault.
- **Pas d'exposition du daemon Docker** sur le reseau sans TLS — communication locale uniquement ou TLS mutuel.

---

## Assertions E2E cles (a tester)

- Affichage de la liste des conteneurs avec statut correct (Running/Stopped)
- Filtrage par onglet (All, Running, Stopped, Idle, System)
- Filtrage par categorie (tags/labels)
- Recherche par nom de conteneur
- Demarrer un conteneur arrete → statut passe a Running
- Arreter un conteneur en cours → statut passe a Stopped
- Redemarrer un conteneur → statut temporairement Restarting puis Running
- Supprimer un conteneur avec confirmation
- Detail d'un conteneur : overview, env, volumes, network
- Logs en temps reel avec streaming
- Filtre de logs par mot-cle avec highlight
- Telechargement des logs en fichier texte
- Stats CPU/RAM en graphique temps reel
- Pull d'une image depuis un registre
- Creation d'un conteneur via l'assistant (image, ports, volumes, env)
- Import d'une image depuis un fichier .tar
- Deploy d'une stack docker-compose
- Commit d'un conteneur comme image
- Nettoyage des images orphelines (prune)
- RBAC : un viewer ne peut pas demarrer/arreter un conteneur
