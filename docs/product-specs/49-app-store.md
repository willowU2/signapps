# Module App Store -- Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Nextcloud App Store** | Catalogue de 300+ apps, categories (files, multimedia, integration, tools), notes et avis utilisateurs, versioning compatible, activation/desactivation en un clic, API REST pour les developpeurs, apps officielles vs communautaires, dependances automatiques |
| **Synology Package Center** | Interface polie avec screenshots, categories (multimedia, productivity, security, utilities), mise a jour automatique, sources tierces configurables, gestion des permissions par package, monitoring CPU/RAM par app, installation avec volumes pre-configures |
| **Unraid Community Apps** | 2500+ apps Docker templates, recherche full-text, categories fines (40+), icons et descriptions detaillees, installation one-click avec formulaire de configuration, variables d'environnement editables, support multi-registry, trending et popular |
| **TrueNAS App Catalog** | Catalogue Helm/Docker, categories (storage, media, networking), app train system (official, community, enterprise), configuration YAML, resource limits, storage claims, backup automatique avant mise a jour |
| **Portainer Templates** | Templates Docker Compose predefinies, categories, formulaire de configuration des variables, port mapping auto, volume mapping, network selection, stack deployment, custom templates uploadables |
| **Cloudron** | Marketplace d'apps self-hosted, installation one-click, domaine + SSL auto, backup integre, mail integre par app, LDAP/SSO auto, mise a jour automatique, rollback, monitoring par app, marketplace curated |
| **YunoHost App Catalog** | 500+ apps packagées, niveaux de qualite (0-8), integration SSO LDAP auto, backup/restore par app, multi-domaine, permissions par app et par utilisateur, diagnostic auto, apps communautaires avec CI |
| **CasaOS App Store** | Interface mobile-first, Docker apps avec icones larges, one-click install, configuration simplifiee (wizard), panneau de gestion par app (logs, stats, shell), custom app via Docker Compose, communaute de contributions |

## Principes directeurs

1. **Installation en un clic** -- deployer une app self-hosted doit etre aussi simple qu'installer une app mobile. Un bouton `Installer`, un dialogue de configuration optionnel, et l'app est live en moins de 60 secondes via Docker (signapps-containers).
2. **Catalogue agrege multi-sources** -- le store agrege les apps depuis plusieurs sources (registries Docker, listes curated, templates custom). L'admin peut ajouter/supprimer des sources. Les apps sont dedupliquees par nom.
3. **Decouverte intelligente** -- la recherche full-text, les categories dynamiques et les compteurs par categorie permettent de trouver une app rapidement parmi 189+ entrees. La vue groupee met en avant les categories les plus peuplees.
4. **Gestion du cycle de vie** -- une app installee peut etre demarree, arretee, mise a jour, desinstallee. Le store affiche le statut d'installation et fournit un lien direct vers l'app running. Integration complete avec le module Containers.
5. **Extensibilite admin** -- l'admin peut ajouter des apps custom (image Docker + config), gerer les sources de catalogue, et forcer un refresh du cache. Le bouton `Ajouter une app` ouvre un formulaire de creation manuelle.
6. **Securite par defaut** -- chaque installation Docker est sandboxed. Les ports sont mappes explicitement. Les volumes sont crees dans des chemins controles. Le RBAC limite l'installation aux roles autorises.

---

## Categorie 1 -- Catalogue et navigation

### 1.1 En-tete de page
Titre `App Store` avec compteur dynamique du nombre d'apps filtrees (ex: `189 applications (page 1/8)`). Le compteur se met a jour en temps reel quand un filtre est applique. Trois boutons d'action en haut a droite : `Ajouter une app` (bouton primary avec icone Plus, visible uniquement pour admin/operator), `Sources` (bouton outline avec icone Settings2, visible uniquement pour admin), `Actualiser` (bouton outline avec icone RefreshCw, animation spin pendant le refresh via `animate-spin` sur l'icone). Le layout du header est `flex justify-between items-center`.

### 1.2 Barre de recherche
Champ de recherche avec icone loupe (Search de Lucide), placeholder `Rechercher...`. Filtre en temps reel sur le nom, la description et les tags de chaque app. Debounce de 150ms. La recherche est appliquee cote client apres le chargement initial de la liste complete. Le champ supporte le raccourci `/` pour focus rapide (quand aucun input n'a le focus). Un bouton X (visible quand le champ n'est pas vide) efface la recherche. Le nombre de resultats est affiche a droite du champ : `{count} resultats`.

### 1.3 Categories dynamiques
Les categories sont extraites automatiquement du premier tag de chaque app. Les 12 categories les plus peuplees sont affichees comme boutons pill horizontaux scrollables. Le bouton `All` (toujours premier) affiche toutes les apps. Clic sur une categorie filtre par tag correspondant. Le bouton actif recoit le style `default` (rempli), les inactifs `outline`. Chaque bouton affiche le compteur entre parentheses : `Media (23)`. Categories observees : selfhosted, Media, Network, development, Utilities, Developer, download, pastebin, productivity, Downloader, monitoring, communication. Le scroll horizontal sur mobile utilise `overflow-x-auto scrollbar-hide` avec snap points.

### 1.4 Vue groupee par categorie (defaut)
Quand aucun filtre n'est actif, les apps sont groupees par categorie (premier tag). Chaque groupe affiche : le nom de la categorie en `text-lg font-semibold`, le compteur d'apps entre parentheses, et une preview de 4 apps max en grille 1/2/3/4 colonnes responsive. Un bouton `View all` (avec icone ArrowRight) apparait si la categorie a plus de 4 apps. Clic sur `View all` active le filtre de categorie correspondant, scrolle en haut, et affiche la vue paginee. Les groupes sont tries par nombre d'apps decroissant (les categories les plus fournies en premier).

### 1.5 Vue plate avec pagination
Quand un filtre (recherche ou categorie) est actif, les apps sont affichees dans une grille plate paginee. 24 apps par page en grille responsive (1/2/3/4 colonnes). Navigation par boutons `Previous` / `Next` (icones ChevronLeft/ChevronRight) avec indicateur de page (`Page 1 of 8`). Les boutons Previous/Next sont desactives (`disabled opacity-50`) sur la premiere/derniere page. Le numero de page se reset a 1 quand le filtre change. Le scroll remonte en haut de la grille au changement de page (`window.scrollTo({ top: gridRef.offsetTop, behavior: 'smooth' })`).

### 1.6 Etat vide
Si aucune app ne correspond aux filtres : icone Search opacity-50, texte `No apps match your filters`, sous-texte `Try adjusting your search or category filter.`. Si aucune app n'est disponible du tout : icone Package opacity-50, texte `No apps available.`, sous-texte `Try refreshing sources.` avec un bouton `Refresh` inline. L'etat vide est centre verticalement dans la zone de contenu.

### 1.7 Deduplication
Les apps avec le meme nom (case-insensitive, trim, normalize whitespace) sont dedupliquees -- seule la premiere occurrence (par ordre de source) est conservee. La deduplication est executee cote client apres la fusion des sources. Un log console en dev mode affiche les doublons detectes pour le debugging.

### 1.8 Search indexing
Au chargement initial des apps, un index de recherche cote client est construit avec `fuse.js` (Apache-2.0). Keys indexes : `name` (weight 3), `description` (weight 1), `tags` (weight 2). Threshold : 0.3. Le rebuild de l'index est declenche uniquement au refresh des sources. L'index est garde en memoire (pas localStorage) car il est reconstruit rapidement (< 50ms pour 200 apps). La recherche retourne un score de pertinence utilise pour le tri des resultats.

---

## Categorie 2 -- Carte d'application (AppCard)

### 2.1 Informations affichees
Chaque carte est un composant Card (shadcn/ui) avec : nom de l'app en `font-semibold text-base` (truncate 1 ligne), description en `text-sm text-muted-foreground` (line-clamp-2, max 2 lignes), icone ou logo en haut a gauche (40x40px, rounded-md, avec fallback icone Package grise si pas de logo), tags comme Badges (variant `outline`, max 3 tags visibles, `+N` si plus), bouton d'action principal en bas. La carte fait 100% de largeur dans la grille, min-height 160px. Au hover : `shadow-md transition-shadow 200ms` et legere elevation.

### 2.2 Statut d'installation
La carte detecte si l'app est deja installee en croisant avec la liste des conteneurs Docker (via `GET /api/v1/containers`). Le matching se fait par : (1) label Docker `signapps.app.id` correspondant a l'id de l'app, ou (2) correspondance du nom d'image Docker (base name sans tag ni registry, ex: `nginx` matche `docker.io/library/nginx:latest`). Le statut est un des suivants : `not_installed`, `running`, `stopped`, `restarting`, `error`. Un indicateur visuel de statut apparait en haut a droite de la carte : cercle vert (running), gris (stopped/not_installed), jaune pulse (restarting), rouge (error).

### 2.3 Actions selon le statut
- **Non installee** (`not_installed`) : bouton `Installer` (variant `default`, icone Download) ouvre le dialogue d'installation
- **Installee et running** (`running`) : bouton `Ouvrir` (variant `default`, icone ExternalLink) avec lien vers l'URL du conteneur. Bouton secondaire icone-only (MoreHorizontal) avec DropdownMenu : `Arreter` (icone Square), `Redemarrer` (icone RefreshCw), `Logs` (icone Terminal), `Mettre a jour` (icone ArrowUp, visible si update disponible), `Desinstaller` (icone Trash2, text-destructive)
- **Installee mais arretee** (`stopped`) : bouton `Demarrer` (variant `outline`, icone Play). Bouton secondaire DropdownMenu : `Logs` (icone Terminal), `Desinstaller` (icone Trash2, text-destructive)
- **En erreur** (`error`) : bouton `Diagnostiquer` (variant `destructive`, icone AlertTriangle). DropdownMenu : `Voir les logs`, `Redemarrer`, `Desinstaller`

### 2.4 URL du conteneur
L'URL d'acces est derivee automatiquement du port mapping Docker du conteneur. La fonction `getContainerUrl()` construit l'URL `http://{hostname}:{hostPort}` a partir du premier port host mappe. Si le conteneur a le label `signapps.app.url`, cette valeur est utilisee en priorite (permet les chemins custom comme `http://host:8080/admin`). Si aucun port n'est mappe, le bouton `Ouvrir` est remplace par un texte `Pas de port expose`. Le hostname est detecte via `window.location.hostname` (meme hote que SignApps).

### 2.5 Detail dialog
Clic sur le nom de l'app ou un bouton `Detail` (icone Info) ouvre un Dialog modal (`AppDetailDialog`, max-width 600px) avec : icone/logo large (80x80), nom en `text-2xl font-bold`, description complete (sans truncation), liste des tags comme Badges, section `Image Docker` avec le nom complet de l'image (copiable avec bouton Copy), section `Configuration par defaut` (ports, env vars, volumes sous forme de code block), lien vers la homepage du projet (si disponible, icone ExternalLink), bouton `Installer` en bas (pleine largeur) si non installe. Si installe, les boutons de gestion (Open, Stop, Update, Uninstall) remplacent le bouton Installer.

---

## Categorie 3 -- Installation d'applications

### 3.1 Dialogue d'installation (InstallDialog)
Modal Dialog (max-width 600px) avec les champs de configuration pour l'installation Docker, organises en sections avec Accordion (shadcn/ui) :

**Section "General" (ouverte par defaut)** :
- **Nom du conteneur** : Input text, pre-rempli depuis le nom de l'app (lowercase, tirets au lieu d'espaces), validation regex `^[a-zA-Z0-9][a-zA-Z0-9_.-]+$`, max 64 caracteres. Erreur inline si le nom existe deja.
- **Image Docker** : Input text, pre-rempli depuis l'app (ex: `nginx:latest`), editable. Autocomplete des tags recents si l'image est connue du registry. Bouton `Pull` pour pre-telecharger l'image.

**Section "Ports"** :
- **Port mapping** : liste de paires host:container avec bouton `+ Ajouter un port`. Chaque ligne : Input numerique host port (1-65535), icone ArrowRight, Input numerique container port (1-65535), protocole (dropdown TCP/UDP, defaut TCP), bouton Trash2 pour supprimer la ligne. Pre-rempli avec les ports par defaut de l'app. Validation : detection de collision avec les ports deja utilises par d'autres conteneurs (`GET /api/v1/containers/ports-in-use`), erreur inline `Port {port} deja utilise par {container_name}`.

**Section "Variables d'environnement"** :
- Liste de paires cle=valeur avec bouton `+ Ajouter une variable`. Chaque ligne : Input cle (placeholder `NOM_VARIABLE`), Input valeur (placeholder `valeur`), toggle oeil pour masquer/afficher la valeur (pour les secrets), bouton Trash2 pour supprimer. Pre-remplies si l'app a des defaults. Les variables marquees `required` dans le template ont un asterisque rouge.

**Section "Volumes"** :
- Liste de mappings host:container avec bouton `+ Ajouter un volume`. Chaque ligne : Input host path (placeholder `/data/appname`, avec bouton Browse pour file picker), Input container path (placeholder `/app/data`), dropdown mode (rw/ro, defaut rw), bouton Trash2 pour supprimer. Pre-remplis depuis le template. Le host path est automatiquement prefixe avec `STORAGE_FS_ROOT/containers/{container_name}/` si un chemin relatif est saisi.

Bouton `Installer` (variant `default`, pleine largeur) en bas du dialog. Bouton `Annuler` a cote.

### 3.2 Docker container lifecycle (pull/create/start)
L'installation appelle `POST /api/v1/containers/install` qui orchestre le cycle complet :
1. **Pull** : `POST /api/v1/images/pull` avec body `{ image: "nginx:latest" }`. L'API streame la progression du pull via SSE (Server-Sent Events). Le frontend affiche une ProgressBar avec le pourcentage de download (layer par layer). Si l'image existe localement et est a jour, le pull est skip.
2. **Create** : `POST /api/v1/containers` avec body `{ name, image, ports, env, volumes, labels }`. Le label `signapps.app.id` est automatiquement ajoute. Le label `signapps.managed=true` identifie les conteneurs geres par le store. Le restart policy est `unless-stopped` par defaut.
3. **Start** : `POST /api/v1/containers/{id}/start`. Le conteneur demarre et le health check (si defini) est surveille.
4. **Verification** : `GET /api/v1/containers/{id}` pour confirmer le statut `running`. Si le conteneur est en statut `exited` apres 10 secondes, l'installation est consideree echouee.

### 3.3 Feedback d'installation
Pendant l'installation : le bouton `Installer` est remplace par une ProgressBar + texte indiquant l'etape actuelle (`Telechargement de l'image... 45%`, `Creation du conteneur...`, `Demarrage...`). La ProgressBar utilise des etapes : Pull (0-70%), Create (70-85%), Start (85-95%), Verify (95-100%). Succes : toast (sonner) vert avec message `{app_name} installe avec succes` et bouton `Ouvrir` dans le toast. Le Dialog se ferme automatiquement. Echec : toast rouge avec le message d'erreur Docker (ex: `port is already allocated`, `image not found`). Le Dialog reste ouvert pour permettre de corriger la configuration.

### 3.4 Custom App Dialog
Le bouton `Ajouter une app` ouvre un Dialog (`CustomAppDialog`, max-width 600px) pour creer une app custom a la volee. Les champs sont identiques a l'InstallDialog mais avec en plus :
- **Nom de l'app** : visible dans le catalogue (Input text, required)
- **Description** : textarea, optionnel
- **Tags** : Input avec suggestion des tags existants, multi-valeur (Enter pour ajouter, X pour supprimer)
- **Sauvegarder dans le catalogue** : Checkbox (defaut false). Si coche, l'app custom est ajoutee au catalogue local pour reutilisation future via `POST /api/v1/store/apps/custom`. Sinon, le conteneur est cree directement sans ajout au catalogue.

L'app custom est installee immediatement comme un conteneur Docker avec le label `signapps.app.source=custom`.

### 3.5 Resource limits (CPU/RAM)
Dans la section "Configuration avancee" (toggle Accordion, fermee par defaut) du dialogue d'installation :
- **CPU limit** : Slider 0.1 -> 16 cores, pas de 0.1, defaut 0 (unlimited). Affiche la valeur selectionnee : `2.0 CPU`. Valeur backend : `NanoCpus = value * 1e9`.
- **RAM limit** : Slider 64MB -> 32GB, echelle logarithmique, defaut 0 (unlimited). Affiche la valeur en MB ou GB. Valeur backend : `Memory = value * 1024 * 1024`.
- **RAM reservation** (soft limit) : Slider similaire, doit etre <= RAM limit.
- **Restart policy** : DropdownMenu avec options `no`, `always`, `unless-stopped` (defaut), `on-failure` (avec max retry count Input numerique).
- **Network mode** : DropdownMenu avec `bridge` (defaut), `host`, reseau Docker custom (liste depuis `GET /api/v1/networks`).
- **Capabilities** : toggle list des capabilities Linux (NET_ADMIN, SYS_ADMIN, etc). Toutes desactivees par defaut. Warning orange si une cap dangereuse est activee.

---

## Categorie 4 -- Gestion des sources

### 4.1 Source Manager
Le bouton `Sources` ouvre un Dialog (`SourceManager`, max-width 700px) listant les sources de catalogue configurees dans un tableau. Colonnes : Nom (text-sm font-medium), URL (text-sm text-muted-foreground, truncate), Type (Badge : `curated`, `registry`, `compose`), Apps (compteur), Dernier sync (date relative), Statut (Badge vert `Active` ou gris `Inactive`). Boutons par ligne : toggle on/off (Switch), editer (Pencil), supprimer (Trash2).

### 4.2 Multi-source registry management
L'ajout de source supporte 3 types :
- **Curated list** : URL JSON retournant un tableau d'objets `StoreApp`. Format attendu : `{ apps: StoreApp[] }`. Validation : le frontend fetche l'URL et verifie le format avant de sauvegarder.
- **Docker Registry** : URL d'un registry Docker (ex: `https://registry.hub.docker.com`, `https://ghcr.io`, registry prive `https://registry.company.com:5000`). Le store enumere les repositories et construit les cartes d'apps a partir des tags et manifests. Authentification optionnelle (username/password ou token).
- **Docker Compose templates** : URL d'un repo Git ou dossier contenant des fichiers `docker-compose.yml`. Chaque fichier devient un template de stack.

Formulaire d'ajout : Dialog avec champs Nom (required), URL (required, validation URL), Type (dropdown), Authentification (optionnel, section collapsible avec username/password), bouton `Tester la connexion` qui verifie l'accessibilite et le format, bouton `Ajouter`.

### 4.3 Suppression de source
Clic sur le bouton Trash2 ouvre un AlertDialog : `Supprimer la source "{name}" ? Les {count} apps de cette source disparaitront du catalogue. Les apps deja installees ne seront pas affectees.`. Boutons `Annuler` et `Supprimer` (variant destructive). Apres suppression, la liste des apps est rafraichie immediatement (les apps de la source supprimee disparaissent).

### 4.4 Refresh des sources
Le bouton `Actualiser` declenche `POST /api/v1/store/refresh` qui re-synchronise toutes les sources actives en parallele. Pendant le refresh, l'icone RefreshCw tourne (`animate-spin`). Un toast indique le progres : `Synchronisation des sources... (2/4)`. A la fin, toast de succes : `{count} apps chargees depuis {sourceCount} sources`. Les nouvelles apps apparaissent, les apps supprimees de la source disparaissent. Le refresh est aussi declenche automatiquement toutes les 6 heures par un CRON backend.

### 4.5 Sources par defaut
Le store est pre-configure avec une source curated contenant les 189+ apps self-hosted. Cette source par defaut ne peut pas etre supprimee (le bouton Trash2 est desactive avec tooltip `Source par defaut non supprimable`). Elle peut etre desactivee. Les sources additionnelles sont configurables par l'admin.

---

## Categorie 5 -- API backend (signapps-containers)

### 5.1 Endpoints store
- `GET /api/v1/store/apps` -- Liste toutes les apps du catalogue. Query params : `category` (filtre par tag), `search` (full-text sur name, description, tags), `page` (defaut 1), `per_page` (defaut 50, max 200). Retourne : `{ apps: StoreApp[], total: number, page: number, pages: number }`.
- `GET /api/v1/store/apps/:id` -- Detail d'une app. Retourne : `StoreApp` complet avec les defaults de configuration.
- `POST /api/v1/store/apps/custom` -- Creer une app custom dans le catalogue local. Body : `StoreApp` (sans id, genere cote serveur). Retourne : 201 + `StoreApp`.
- `DELETE /api/v1/store/apps/custom/:id` -- Supprimer une app custom. Retourne : 204.
- `POST /api/v1/store/sources` -- Ajouter une source. Body : `{ name, url, type, auth? }`. Retourne : 201 + `Source`.
- `PUT /api/v1/store/sources/:id` -- Modifier une source. Body : `{ name?, url?, type?, active?, auth? }`. Retourne : 200 + `Source`.
- `DELETE /api/v1/store/sources/:id` -- Supprimer une source. Retourne : 204.
- `POST /api/v1/store/refresh` -- Forcer le refresh de toutes les sources. Retourne : 200 + `{ synced: number, apps_total: number, errors: string[] }`.
- `GET /api/v1/store/sources` -- Lister les sources configurees. Retourne : `Source[]`.

### 5.2 Endpoints conteneurs (pour l'installation)
- `POST /api/v1/containers/install` -- Installation complete (pull + create + start). Body : `{ name, image, ports, env, volumes, labels, resource_limits?, restart_policy?, network_mode? }`. Retourne : 201 + `Container` avec statut.
- `POST /api/v1/containers` -- Creer un conteneur (sans demarrer). Body identique. Retourne : 201 + `Container`.
- `DELETE /api/v1/containers/:id` -- Supprimer un conteneur (stop + remove). Query param : `force=true` pour forcer l'arret. Retourne : 204.
- `POST /api/v1/containers/:id/start` -- Demarrer. Retourne : 200.
- `POST /api/v1/containers/:id/stop` -- Arreter. Query param : `timeout=10` (secondes). Retourne : 200.
- `POST /api/v1/containers/:id/restart` -- Redemarrer. Retourne : 200.
- `GET /api/v1/containers` -- Lister tous les conteneurs. Query param : `managed=true` pour ne retourner que les conteneurs geres par SignApps (label `signapps.managed=true`). Retourne : `Container[]` avec docker_info (ports, state, labels, image, created).
- `GET /api/v1/containers/:id` -- Detail d'un conteneur. Retourne : `Container` complet.
- `GET /api/v1/containers/:id/stats` -- Metriques temps reel (CPU, RAM, network, disk). Stream SSE ou poll.
- `GET /api/v1/containers/:id/logs` -- Logs du conteneur. Query params : `tail=1000` (nombre de lignes), `since=timestamp`, `follow=true` (SSE stream). Retourne : texte brut ou stream SSE.
- `GET /api/v1/containers/ports-in-use` -- Ports host deja mappes. Retourne : `{ ports: { port: number, container_name: string, protocol: string }[] }`.
- `POST /api/v1/images/pull` -- Pull une image Docker. Body : `{ image: "nginx:latest", auth?: { username, password } }`. Stream SSE de progression.

### 5.3 Modele de donnees StoreApp
```
StoreApp {
  id: UUID,
  source_id: UUID,              // FK vers la source
  name: string,                 // Nom affiche
  description: string,          // Description complete
  image: string,                // Docker image name:tag (ex: "nginx:latest")
  tags: string[],               // Categories/tags pour le filtrage
  ports: PortMapping[],         // [{ container: 80, host: 8080, protocol: "tcp" }]
  env: EnvVar[],                // [{ key: "DB_HOST", value: "localhost", required: bool, secret: bool }]
  volumes: VolumeMapping[],     // [{ host: "/data/app", container: "/app/data", mode: "rw" }]
  icon_url?: string,            // URL de l'icone/logo
  homepage?: string,            // URL du projet upstream
  version?: string,             // Version de l'app (pas du container)
  min_cpu?: number,             // CPU minimum recommande (cores)
  min_ram?: number,             // RAM minimum recommandee (MB)
  depends_on?: string[],        // IDs d'autres apps requises
  created_at: string,           // ISO 8601
  updated_at: string,           // ISO 8601
}
```

### 5.4 Modele de donnees Container
```
Container {
  id: string,                   // Docker container ID (short)
  name: string,                 // Nom du conteneur
  image: string,                // Image Docker complete
  state: string,                // "running" | "stopped" | "restarting" | "exited" | "dead" | "created"
  status: string,               // Description humaine ("Up 3 hours", "Exited (1) 5 minutes ago")
  ports: PortBinding[],         // [{ host: 8080, container: 80, protocol: "tcp" }]
  labels: Record<string, string>, // Labels Docker incluant signapps.*
  created: string,              // ISO 8601
  started_at?: string,          // ISO 8601
  health_status?: string,       // "healthy" | "unhealthy" | "starting" | "none"
  resource_usage?: {            // Metriques live (quand demandees)
    cpu_percent: number,
    memory_usage: number,
    memory_limit: number,
    network_rx: number,
    network_tx: number,
  }
}
```

### 5.5 PostgreSQL schema
```sql
CREATE TABLE store_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('curated', 'registry', 'compose')),
  auth_config JSONB DEFAULT '{}',  -- { username, password_encrypted }
  active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  app_count INTEGER NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE store_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES store_sources(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  ports JSONB NOT NULL DEFAULT '[]',
  env JSONB NOT NULL DEFAULT '[]',
  volumes JSONB NOT NULL DEFAULT '[]',
  icon_url TEXT,
  homepage TEXT,
  version TEXT,
  min_cpu REAL,
  min_ram INTEGER,
  depends_on UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_store_apps_name_source ON store_apps(lower(name), source_id);
CREATE INDEX idx_store_apps_tags ON store_apps USING GIN(tags);
CREATE INDEX idx_store_apps_source ON store_apps(source_id);

CREATE TABLE store_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES store_apps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(app_id, user_id)
);

CREATE INDEX idx_store_reviews_app ON store_reviews(app_id);

CREATE TABLE store_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES store_apps(id),
  user_id UUID NOT NULL REFERENCES users(id),
  container_id TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}', -- snapshot de la config au moment de l'install
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uninstalled_at TIMESTAMPTZ
);

CREATE INDEX idx_store_installs_app ON store_installs(app_id);
CREATE INDEX idx_store_installs_container ON store_installs(container_id);
```

### 5.6 Cache et performance
La liste des apps est chargee une seule fois au montage de la page via `useQuery('store-apps', fetchApps, { staleTime: 5 * 60 * 1000 })`. Le filtrage, la recherche et la pagination sont cote client pour une reactivite instantanee (< 1ms de filtre sur 200 apps). Le refresh explicite (bouton Actualiser) est la seule operation qui re-fetche le backend, via `queryClient.invalidateQueries('store-apps')`. La liste des conteneurs est chargee en parallele et pollee toutes les 10 secondes pour detecter les changements de statut.

---

## Categorie 6 -- Securite et gouvernance

### 6.1 RBAC
Matrice de permissions :

| Action | admin | operator | user |
|--------|-------|----------|------|
| Voir le catalogue | oui | oui | oui |
| Installer/desinstaller | oui | oui | non |
| Creer app custom | oui | oui | non |
| Gerer les sources | oui | non | non |
| Voir les logs/stats | oui | oui | lecture seule |
| Shell dans conteneur | oui | non | non |
| Configurer resource limits | oui | oui | non |

Les boutons d'action sont masques (pas desactives) pour les roles non autorises. Le backend verifie egalement le role via le JWT claims -- un appel API non autorise retourne 403.

### 6.2 Isolation des conteneurs
Chaque conteneur installe est isole par le runtime Docker. Politique par defaut :
- Pas de mode `privileged`
- Capabilities Linux au minimum (`--cap-drop=ALL`, ajout explicite des caps necessaires)
- Pas d'acces au socket Docker (`/var/run/docker.sock` non monte par defaut)
- Reseau `bridge` par defaut (isolation reseau)
- Read-only root filesystem optionnel (`--read-only` + tmpfs pour /tmp)
- PID namespace isole (`--pids-limit 100` par defaut)
- ulimits configures (nofile, nproc)

### 6.3 Controle des images (registry whitelist)
L'admin peut configurer une whitelist de registries autorises dans `GET /api/v1/store/settings`. Champs : `allowed_registries: string[]` (ex: `["docker.io", "ghcr.io", "registry.company.com"]`). Les images provenant de registries non listes sont bloquees a l'installation (erreur 400 : `Registry {registry} is not in the allowed list`). Par defaut, tous les registries sont autorises (whitelist vide = pas de restriction). La whitelist est modifiable via `PUT /api/v1/store/settings`.

### 6.4 Audit trail
Chaque action est loguee dans le journal d'audit via PgEventBus :
- `container.installed` : app_id, container_id, user_id, config snapshot
- `container.started` : container_id, user_id
- `container.stopped` : container_id, user_id
- `container.removed` : container_id, user_id
- `container.updated` : container_id, old_image, new_image, user_id
- `store.source_added` : source_id, url, user_id
- `store.source_removed` : source_id, user_id
L'admin peut consulter l'historique dans le module Administration > Audit avec filtres par action et par date.

### 6.5 Ressources limitees
L'admin peut configurer des limites de ressources globales par defaut dans les settings store :
- `default_cpu_limit: number` (cores, defaut 0 = unlimited)
- `default_memory_limit: number` (MB, defaut 0 = unlimited)
- `max_containers: number` (nombre max de conteneurs geres par le store, defaut 50)
- `max_total_memory: number` (RAM totale allouee a tous les conteneurs, defaut 0 = unlimited)
Si le nombre max de conteneurs est atteint, l'installation affiche une erreur : `Limite de {max} conteneurs atteinte. Desinstallez une app avant d'en installer une nouvelle.`.

---

## Categorie 7 -- Mise a jour et maintenance

### 7.1 Detection de mise a jour
Le store compare periodiquement les digests d'images locales avec les digests distants (via `HEAD` sur le manifest du registry). Frequence : toutes les 6 heures (CRON backend) ou manuellement via le bouton `Verifier les mises a jour` dans le dashboard des apps installees. Si un nouveau digest est disponible pour le meme tag (ex: `nginx:latest` a change), un badge `Mise a jour disponible` (icone ArrowUp, variant outline, couleur blue) apparait sur la carte de l'app. Le nombre total de mises a jour disponibles est affiche dans le header du store.

### 7.2 App update flow
Le processus de mise a jour, declenche par le bouton `Mettre a jour` dans le DropdownMenu de la carte :
1. **Confirmation** : AlertDialog affiche `Mettre a jour {app_name} ? L'app sera arretee pendant la mise a jour. Les donnees persistantes (volumes) seront conservees.` avec info sur l'image actuelle vs nouvelle.
2. **Backup** : snapshot des volumes (si le driver de stockage le supporte).
3. **Pull** : telecharge la nouvelle image. ProgressBar visible.
4. **Stop** : arrete le conteneur actuel. Statut passe a `updating`.
5. **Recreate** : supprime l'ancien conteneur, recree avec la meme configuration + nouvelle image.
6. **Start** : demarre le nouveau conteneur.
7. **Health check** : attend 30 secondes que le conteneur soit healthy. Si unhealthy, declenche le rollback automatique.
8. **Succes** : toast vert `{app_name} mis a jour avec succes`.

### 7.3 Rollback mechanism
Si une mise a jour echoue (conteneur ne demarre pas, health check fail apres 30s), le rollback est automatique :
1. Stop du nouveau conteneur (si running).
2. Suppression du nouveau conteneur.
3. Recreation du conteneur avec l'ancienne image (stockee dans `store_installs.config`).
4. Start de l'ancien conteneur.
5. Toast orange `Mise a jour echouee pour {app_name}. Rollback vers la version precedente.`.
L'admin peut aussi declencher un rollback manuel depuis le DropdownMenu > `Rollback` (visible uniquement si un historique de mise a jour existe). L'historique des versions est stocke dans `store_installs` (chaque install/update cree une entree).

### 7.4 Backup avant mise a jour
Avant chaque mise a jour, les volumes du conteneur sont snapshotes :
1. Les chemins host des volumes montes sont identifies.
2. Un tar.gz est cree pour chaque volume : `{STORAGE_FS_ROOT}/backups/containers/{container_name}/{timestamp}.tar.gz`.
3. Le backup est reference dans la table `container_backups(id, container_id, volume_path, backup_path, size, created_at)`.
4. Les backups sont conserves 7 jours par defaut (configurable). Un CRON quotidien supprime les backups expires.
5. Restauration manuelle via `POST /api/v1/containers/{id}/restore-backup/{backup_id}`.

### 7.5 Notifications de mise a jour
L'admin recoit une notification (via signapps-notifications) quand des mises a jour sont disponibles :
- Event : `store.updates_available` avec `{ count: number, apps: string[] }`.
- Frequence configurable dans les settings store : `update_check_notify: 'daily' | 'weekly' | 'never'` (defaut `daily`).
- La notification contient un lien direct vers la page App Store avec le filtre `updates available` actif.

---

## Categorie 8 -- Templates et presets

### 8.1 Templates d'application
Chaque app du catalogue peut definir un template Docker Compose en JSONB dans le champ `template` de `store_apps`. Le template contient : services (image, ports, volumes, env, depends_on, healthcheck), networks, volumes declares. Le template est rendu comme un formulaire dans le dialog d'installation (chaque variable d'environnement devient un champ Input, chaque port un mapping editable). Le template YAML original (si la source est compose) est consultable via un bouton `Voir le template` qui ouvre un code viewer read-only.

### 8.2 One-click stack templates
Le store propose des stacks pre-configures pour les cas d'usage courants :
- **LAMP** : Apache + MySQL + phpMyAdmin (3 conteneurs)
- **LEMP** : Nginx + MySQL + phpMyAdmin (3 conteneurs)
- **ELK** : Elasticsearch + Logstash + Kibana (3 conteneurs)
- **Monitoring** : Prometheus + Grafana + Node Exporter (3 conteneurs)
- **WordPress** : WordPress + MySQL (2 conteneurs)
- **GitLab** : GitLab CE + PostgreSQL + Redis (3 conteneurs)

Les stacks sont identifies par le badge `Stack` (variant `secondary`) sur la carte. L'installation d'une stack deploie tous les conteneurs lies comme une unite. Le dialogue d'installation montre les services avec des onglets (un onglet par service, chacun avec sa configuration de ports/env/volumes).

### 8.3 Stacks multi-conteneurs
Certaines apps requierent plusieurs conteneurs. Le store supporte les stacks Docker Compose qui deploient plusieurs conteneurs lies avec un reseau Docker dedie (`{stack_name}_network`). La stack est geree comme une unite : demarrer/arreter la stack agit sur tous les conteneurs. Le statut de la stack est l'agregation des statuts : `running` si tous running, `partial` si certains, `stopped` si tous stopped, `error` si un en erreur. Sur la carte, les conteneurs de la stack sont listables via un Accordion expandable. L'installation d'une stack appelle `POST /api/v1/stacks` (qui cree le reseau, pull les images, cree et start les conteneurs en sequence respectant les depends_on).

### 8.4 Presets par environnement
Le template peut definir des presets nommes dans un champ `presets: Record<string, Partial<Config>>`. Exemple : `development` (RAILS_ENV=development, DEBUG=true, ports ouverts), `production` (RAILS_ENV=production, HTTPS=true, resource limits actifs). L'utilisateur choisit le preset lors de l'installation via un DropdownMenu en haut du dialog. La selection d'un preset pre-remplit les champs correspondants. Les champs restent editables apres selection du preset. Un preset `Custom` permet de repartir de zero.

### 8.5 App dependency resolution
Si une app declare des dependances (`depends_on: ["postgresql", "redis"]`), le dialog d'installation affiche un bandeau d'information : `Cette app necessite : PostgreSQL, Redis`. Si les dependances ne sont pas installees, un bouton `Installer les dependances` lance l'installation en chaine (dependances d'abord, puis l'app). Si deja installees mais arretees, un bouton `Demarrer les dependances` les redemarre. Le status des dependances est affiche avec des indicateurs vert/rouge.

### 8.6 Validation de la configuration
Avant l'installation, le formulaire valide :
- Ports non deja utilises par un autre conteneur (erreur inline rouge sous le champ port)
- Chemins de volumes valides (pas de traversal `..`, pas de chemins systeme `/etc`, `/proc`)
- Variables d'environnement obligatoires remplies (marquees `*`)
- Nom du conteneur unique et au bon format
- Image Docker syntaxiquement valide (regex `^[\w./-]+(:\w+)?$`)
- Resource limits dans les bornes admises par le systeme
Le bouton `Installer` est desactive tant que des erreurs de validation existent. Les erreurs sont affichees inline sous chaque champ concerne en `text-sm text-destructive`.

---

## Categorie 9 -- Monitoring des apps installees

### 9.1 Dashboard apps installees
Un onglet `Installees` en haut de la page store montre uniquement les apps gerees par SignApps (label `signapps.managed=true`). Layout en grille avec les cartes enrichies : statut, metriques compactes (CPU%, RAM%), uptime, boutons d'action directs. Un compteur en haut : `{count} apps installees, {running} en cours d'execution`.

### 9.2 Statut en temps reel
Les cartes d'apps installees affichent un indicateur de statut en temps reel. Le statut est un cercle colore (8px) avec label texte :
- Vert + `Running` : conteneur actif
- Gris + `Stopped` : conteneur arrete
- Jaune pulse + `Restarting` : en cours de redemarrage
- Rouge + `Error` : conteneur en erreur ou exited avec code != 0
- Bleu + `Starting` : health check en cours (conteneur demarre mais healthcheck pas encore passe)

Le statut est rafraichi toutes les 10 secondes via polling `GET /api/v1/containers?managed=true`. Le polling est pause quand l'onglet est inactif (`document.hidden`) et reprend au focus.

### 9.3 Metrics par app
Clic sur une app installee expande un panneau de metriques sous la carte (Collapsible, animation slide-down 200ms). Metriques affichees :
- **CPU** : gauge circulaire (0-100%) + texte `X.X%`
- **RAM** : barre horizontale (usage/limit) + texte `256MB / 512MB`
- **Reseau** : compteurs cumules `In: X MB | Out: X MB`
- **Disque** : compteurs `Read: X MB | Write: X MB`
- **Uptime** : duree depuis le demarrage (ex: `3j 12h 45m`)

Les metriques sont streamed depuis `GET /api/v1/containers/{id}/stats` via SSE (mise a jour toutes les 2 secondes quand le panneau est ouvert). L'historique (graphiques sur 1h/24h/7j) est disponible via integration avec le module Monitoring (`GET /api/v1/metrics/container/{id}`).

### 9.4 Log viewer integration
Bouton `Logs` ouvre un Dialog plein ecran (ou panneau lateral 60% largeur) avec :
- Terminal-like background (`bg-black text-green-400 font-mono text-xs`)
- Les 1000 dernieres lignes chargees initialement via `GET /api/v1/containers/{id}/logs?tail=1000`
- Auto-scroll vers le bas (toggle on/off avec bouton `Auto-scroll`)
- Follow mode : `GET /api/v1/containers/{id}/logs?follow=true` streame les nouvelles lignes en SSE
- Recherche dans les logs (Cmd+F) avec highlighting des matches
- Filtre par niveau : checkboxes `INFO`, `WARN`, `ERROR` (detection par regex sur le contenu des lignes)
- Bouton `Telecharger` (export en fichier .log)
- Bouton `Effacer l'ecran` (local uniquement, ne supprime pas les logs Docker)

### 9.5 Health checks
Si le conteneur definit un HEALTHCHECK Docker (dans le Dockerfile ou dans la config), le statut de sante est affiche :
- `healthy` : badge vert avec icone Heart
- `unhealthy` : badge rouge avec icone HeartOff
- `starting` : badge jaune avec icone Loader2 (animee)
- `none` : pas de badge (pas de healthcheck defini)

Les conteneurs `unhealthy` pendant plus de 5 minutes declenchent une notification admin via PgEventBus event `container.unhealthy`. Le panneau de detail affiche les 5 derniers resultats de healthcheck avec timestamp et output.

### 9.6 Acces console (shell)
Bouton `Shell` (visible admin uniquement) ouvre un Dialog plein ecran avec un terminal web (xterm.js via WebSocket). La connexion est etablie vers `WS /api/v1/containers/{id}/exec` qui cree un exec instance Docker avec `/bin/sh` (fallback `/bin/bash`). Le terminal supporte : 256 couleurs, resize dynamique (fit addon), copier-coller (Ctrl+Shift+C/V), scroll historique (1000 lignes). Timeout : la session shell est fermee apres 30 minutes d'inactivite. Un bandeau rouge en haut du terminal rappelle : `Vous etes connecte au conteneur {name}. Soyez prudent.`.

---

## Categorie 10 -- Marketplace communautaire

### 10.1 Contributions utilisateur
Les utilisateurs avec role `operator` ou `admin` peuvent soumettre des apps custom au catalogue partage de l'instance. La soumission inclut : nom, description, image Docker, configuration par defaut (ports, env, volumes), tags, capture d'ecran optionnelle (upload via `POST /api/v1/store/apps/submit` avec multipart form). La soumission est identifiee par `status: 'pending' | 'approved' | 'rejected'` dans la table `store_apps`.

### 10.2 Moderation
Les soumissions en attente sont listees dans un panneau admin `Moderation` (visible uniquement pour les admins). Chaque soumission affiche : detail complet de l'app, qui l'a soumise, date de soumission. Boutons : `Approuver` (change status a `approved`, l'app apparait dans le catalogue), `Rejeter` (change status a `rejected`, avec champ commentaire obligatoire expliquant la raison), `Demander des modifications` (status `revision_requested`, commentaire libre). L'auteur recoit une notification pour chaque changement de status.

### 10.3 Rating/review system
Les utilisateurs ayant installe une app peuvent la noter (1-5 etoiles) et laisser un commentaire. Interface : Dialog `Laisser un avis` avec 5 etoiles cliquables (icone Star, remplie = selectionnee, outline = non), textarea commentaire (optionnel, max 500 caracteres). Un utilisateur ne peut laisser qu'un seul avis par app (UNIQUE constraint). La note peut etre modifiee. La note moyenne est affichee sur la carte de l'app comme `{avg}/5` avec icone Star remplie (couleur amber) et nombre d'avis entre parentheses. Le tri par note est disponible dans les filtres (`Sort by: Most popular`). Les avis sont consultables dans l'AppDetailDialog, section `Avis ({count})`, tries par date decroissante.

### 10.4 Statistiques d'installation
Chaque app affiche le nombre d'installations sur l'instance (`install_count` calcule depuis `store_installs`). Les apps les plus installees remontent dans un onglet `Populaires` (tri par install_count DESC). Un onglet `Nouveautes` montre les ajouts recents (tri par created_at DESC, derniers 30 jours). Les statistiques globales sont affichees dans le header du store : `{total_installed} apps installees, {total_running} en cours`.

### 10.5 Export/Import de catalogue
L'admin peut exporter le catalogue custom (apps custom uniquement, pas les sources externes) en JSON : `GET /api/v1/store/export` retourne `{ apps: StoreApp[], exported_at: string, version: string }`. L'import : `POST /api/v1/store/import` avec body JSON. L'import est additif (pas de suppression des apps existantes). Les doublons par nom sont ignores. Un rapport d'import est retourne : `{ imported: number, skipped: number, errors: string[] }`. Ceci facilite la replication de configurations entre instances SignApps.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Synology Package Center** (kb.synology.com) -- gestion de packages, sources tierces, mise a jour.
- **Portainer Documentation** (docs.portainer.io) -- templates, stacks, registry management.
- **Cloudron Documentation** (docs.cloudron.io) -- app installation, backup, update, SSO.
- **YunoHost Documentation** (yunohost.org/docs) -- app catalog, packaging, quality levels.
- **Unraid Community Applications** (forums.unraid.net/topic/38582-plug-in-community-applications/) -- templates Docker, search, categories.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License -- ne pas copier**

## References OSS

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Yacht** (github.com/SelfhostedPro/Yacht) | **MIT** | Container management UI. Pattern template-based deployment, variable configuration forms, port/volume mapping. |
| **Homer** (github.com/bastienwirtz/homer) | **Apache-2.0** | Dashboard de services self-hosted. Pattern catalogue YAML, categories, search, icones, layout responsive. |
| **Heimdall** (github.com/linuxserver/Heimdall) | **MIT** | Application dashboard. Pattern app cards, categories, pinning, search, tags. |
| **CasaOS** (github.com/IceWhaleTech/CasaOS) | **Apache-2.0** | OS self-hosted avec app store Docker. Pattern one-click install, wizard configuration, app lifecycle. |
| **Portainer CE** (github.com/portainer/portainer) | **Zlib** | Container management. Pattern template deployment, stack management, registry integration. |
| **bollard** (github.com/fussybeaver/bollard) | **Apache-2.0** | Crate Rust pour Docker API. Deja utilise dans signapps-containers. Docker client async natif. |
| **Runtipi** (github.com/runtipi/runtipi) | **GPL-3.0** | **INTERDIT** -- reference pedagogique uniquement. Pattern app store self-hosted, one-click Docker deployment. |
| **Cosmos Server** (github.com/azukaar/Cosmos-Server) | **Apache-2.0** | Self-hosted platform avec marketplace, reverse proxy auto, SSL auto. Pattern app store + networking integre. |
| **xterm.js** (github.com/xtermjs/xterm.js) | **MIT** | Terminal web. Pattern pour le shell dans le conteneur, WebSocket, resize, 256 couleurs. |

---

## Assertions E2E cles (a tester)

- Page /apps -> le titre `App Store` est visible avec le compteur d'apps
- Chargement -> skeleton loading visible puis grille d'apps s'affiche
- Vue groupee -> les categories sont affichees avec compteurs et previews de 4 apps
- Clic `View all` sur une categorie -> le filtre de categorie s'active, vue paginee affichee
- Saisie `nginx` dans la recherche -> seules les apps contenant "nginx" apparaissent
- Clic sur le badge categorie `Media` -> seules les apps tagguees Media s'affichent
- Clic `All` -> retour a la vue groupee
- Pagination -> boutons Previous/Next fonctionnels, indicateur de page correct
- Clic `Installer` sur une app -> le dialogue InstallDialog s'ouvre avec les champs pre-remplis
- Installation -> ProgressBar visible avec etapes, toast de succes, l'app apparait comme installee
- Collision de port -> erreur inline `Port {port} deja utilise par {container_name}`
- App installee running -> bouton `Ouvrir` visible avec lien vers le port mappe
- App installee stopped -> bouton `Demarrer` visible, DropdownMenu avec Logs et Desinstaller
- Stop/Start -> les boutons changent de statut, l'indicateur de couleur se met a jour
- Bouton `Ajouter une app` -> le dialogue CustomAppDialog s'ouvre avec les champs editables
- Bouton `Sources` -> le panneau SourceManager s'ouvre avec la liste des sources
- Ajout de source -> formulaire de creation, bouton Tester la connexion, sauvegarde
- Bouton `Actualiser` -> l'icone tourne, les apps sont re-fetched, toast de confirmation
- Recherche sans resultat -> message `No apps match your filters` visible
- Aucune app disponible -> message `No apps available. Try refreshing sources.`
- App deja installee -> le statut installe est detecte via correspondance d'image Docker
- Detail dialog -> clic sur une app affiche description, tags, image, bouton installer
- Resource limits -> slider CPU et RAM fonctionnels, valeurs affichees
- Stack install -> le dialogue montre les services par onglets, installation deploie tous les conteneurs
- Logs viewer -> les logs s'affichent, le follow mode streame les nouvelles lignes
- Health check -> les conteneurs healthy/unhealthy affichent le bon badge
- Rating -> noter une app (etoiles), le rating moyen se met a jour
- Onglet Installees -> ne montre que les apps gerees, statuts en temps reel
- Onglet Populaires -> tri par nombre d'installations
- RBAC -> un user standard ne voit pas les boutons Installer, Sources, Shell
