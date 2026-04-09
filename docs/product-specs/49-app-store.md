# Module App Store — Specification fonctionnelle

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

1. **Installation en un clic** — deployer une app self-hosted doit etre aussi simple qu'installer une app mobile. Un bouton `Installer`, un dialogue de configuration optionnel, et l'app est live en moins de 60 secondes via Docker (signapps-containers).
2. **Catalogue aggrege multi-sources** — le store agrege les apps depuis plusieurs sources (registries Docker, listes curated, templates custom). L'admin peut ajouter/supprimer des sources. Les apps sont dedupliquees par nom.
3. **Decouverte intelligente** — la recherche full-text, les categories dynamiques et les compteurs par categorie permettent de trouver une app rapidement parmi 189+ entrees. La vue groupee met en avant les categories les plus peuplees.
4. **Gestion du cycle de vie** — une app installee peut etre demarree, arretee, mise a jour, desinstallee. Le store affiche le statut d'installation et fournit un lien direct vers l'app running. Integration complete avec le module Containers.
5. **Extensibilite admin** — l'admin peut ajouter des apps custom (image Docker + config), gerer les sources de catalogue, et forcer un refresh du cache. Le bouton `Ajouter une app` ouvre un formulaire de creation manuelle.
6. **Securite par defaut** — chaque installation Docker est sandboxed. Les ports sont mappes explicitement. Les volumes sont crees dans des chemins controles. Le RBAC limite l'installation aux roles autorises.

---

## Categorie 1 — Catalogue et navigation

### 1.1 En-tete de page
Titre `App Store` avec compteur dynamique du nombre d'apps filtrees (ex: `189 applications (page 1/8)`). Trois boutons d'action en haut a droite : `Ajouter une app` (bouton primary avec icone Plus), `Sources` (bouton outline avec icone Settings2), `Actualiser` (bouton outline avec icone RefreshCw, animation spin pendant le refresh).

### 1.2 Barre de recherche
Champ de recherche avec icone loupe, placeholder `Rechercher...`. Filtre en temps reel sur le nom, la description et les tags de chaque app. La recherche est appliquee cote client apres le chargement initial de la liste complete.

### 1.3 Categories dynamiques
Les categories sont extraites automatiquement des tags des apps. Les 12 categories les plus peuplees sont affichees comme boutons pill horizontaux. Le bouton `All` affiche toutes les apps. Clic sur une categorie filtre par tag correspondant. Categories observees : selfhosted, Media, Network, development, Utilities, Developer, download, pastebin, productivity, Downloader.

### 1.4 Vue groupee par categorie (defaut)
Quand aucun filtre n'est actif, les apps sont groupees par categorie (premier tag). Chaque groupe affiche le nom de la categorie, le compteur d'apps, et une preview de 4 apps max. Un bouton `View all` (avec fleche) apparait si la categorie a plus de 4 apps. Clic sur `View all` active le filtre de categorie correspondant.

### 1.5 Vue plate avec pagination
Quand un filtre (recherche ou categorie) est actif, les apps sont affichees dans une grille plate paginee. 24 apps par page. Navigation par boutons `Previous` / `Next` avec indicateur de page (`Page 1 of 8`). Le numero de page se reset a 1 quand le filtre change.

### 1.6 Etat vide
Si aucune app ne correspond aux filtres : `No apps match your filters`. Si aucune app n'est disponible du tout : `No apps available. Try refreshing sources.`.

### 1.7 Deduplication
Les apps avec le meme nom (case-insensitive) sont dedupliquees — seule la premiere occurrence est conservee. Ceci gere les doublons entre sources.

---

## Categorie 2 — Carte d'application (AppCard)

### 2.1 Informations affichees
Chaque carte affiche : nom de l'app, description (truncated), icone ou logo (si disponible), tags comme badges, bouton d'action principal.

### 2.2 Statut d'installation
La carte detecte si l'app est deja installee en croisant avec la liste des conteneurs Docker (via `containersApi.list()`). Le matching se fait par `signapps.app.id` label ou par correspondance du nom d'image Docker (base name sans tag).

### 2.3 Actions selon le statut
- **Non installee** : bouton `Installer` ouvre le dialogue d'installation
- **Installee et running** : bouton `Ouvrir` avec lien vers l'URL du conteneur (detectee via port mapping). Bouton secondaire pour gerer (stop, remove).
- **Installee mais arretee** : bouton `Demarrer` + `Desinstaller`.

### 2.4 URL du conteneur
L'URL d'acces est derivee automatiquement du port mapping Docker du conteneur. La fonction `getContainerUrl()` construit l'URL `http://hostname:port` a partir du premier port host mappe.

### 2.5 Detail dialog
Clic sur le nom ou un bouton `Detail` ouvre un dialogue modal (`AppDetailDialog`) avec : description complete, liste des tags, image Docker, configuration requise, bouton d'installation.

---

## Categorie 3 — Installation d'applications

### 3.1 Dialogue d'installation (InstallDialog)
Modal avec les champs de configuration pour l'installation Docker :
- **Nom du conteneur** (pre-rempli depuis le nom de l'app)
- **Image Docker** (pre-rempli depuis l'app, editable)
- **Port mapping** (host:container, avec ports par defaut de l'app)
- **Variables d'environnement** (paires cle=valeur, pre-remplies si l'app a des defaults)
- **Volumes** (mapping host:container)
- Bouton `Installer` lance le deploiement.

### 3.2 Processus d'installation
L'installation appelle `containersApi.install()` (ou equivalent) qui :
1. Pull l'image Docker si absente localement
2. Cree le conteneur avec la configuration specifiee
3. Demarre le conteneur
4. Ajoute le label `signapps.app.id` pour le tracking
5. Retourne le statut et les informations du conteneur cree

### 3.3 Feedback d'installation
Pendant l'installation : spinner + message `Installation en cours...`. Succes : toast de confirmation avec lien pour ouvrir l'app. Echec : toast d'erreur avec le message Docker.

### 3.4 Custom App Dialog
Le bouton `Ajouter une app` ouvre un formulaire (`CustomAppDialog`) pour creer une app custom :
- Nom de l'app
- Description
- Image Docker (obligatoire)
- Port(s) a exposer
- Variables d'environnement
- Volumes
L'app custom est installee immediatement comme un conteneur Docker.

---

## Categorie 4 — Gestion des sources

### 4.1 Source Manager
Le bouton `Sources` ouvre un panneau (`SourceManager`) listant les sources de catalogue configurees. Chaque source a : nom, URL, statut (active/inactive), nombre d'apps, derniere synchronisation.

### 4.2 Ajout de source
Formulaire pour ajouter une nouvelle source : nom, URL du catalogue (JSON endpoint ou Docker registry), type (curated list, docker registry, compose templates), activation/desactivation.

### 4.3 Suppression de source
Supprimer une source retire ses apps du catalogue. Les apps deja installees ne sont pas affectees. Confirmation requise.

### 4.4 Refresh des sources
Le bouton `Actualiser` declenche `storeApi.refreshAll()` qui re-synchronise toutes les sources actives. Pendant le refresh, l'icone RefreshCw tourne (animation spin). Les nouvelles apps apparaissent, les apps supprimees disparaissent.

### 4.5 Sources par defaut
Le store est pre-configure avec au moins une source curated contenant les 189+ apps self-hosted. Les sources additionnelles sont configurables par l'admin.

---

## Categorie 5 — API backend (signapps-containers)

### 5.1 Endpoints store
- `GET /api/v1/store/apps` — Liste toutes les apps du catalogue (filtrable par categorie et recherche)
- `GET /api/v1/store/apps/:id` — Detail d'une app
- `POST /api/v1/store/sources` — Ajouter une source
- `DELETE /api/v1/store/sources/:id` — Supprimer une source
- `POST /api/v1/store/refresh` — Forcer le refresh de toutes les sources
- `GET /api/v1/store/sources` — Lister les sources configurees

### 5.2 Endpoints conteneurs (pour l'installation)
- `POST /api/v1/containers` — Creer et demarrer un conteneur
- `DELETE /api/v1/containers/:id` — Supprimer un conteneur
- `POST /api/v1/containers/:id/start` — Demarrer
- `POST /api/v1/containers/:id/stop` — Arreter
- `GET /api/v1/containers` — Lister tous les conteneurs (avec docker_info : ports, state, labels)

### 5.3 Modele de donnees StoreApp
```
StoreApp {
  id: string,
  source_id: string,
  name: string,
  description: string,
  image: string,          // Docker image name:tag
  tags: string[],         // categories/tags
  ports: number[],        // default ports a exposer
  env: Record<string, string>,  // default env vars
  volumes: string[],      // default volume mappings
  icon_url?: string,      // URL de l'icone
  homepage?: string,      // URL du projet
}
```

### 5.4 Cache et performance
La liste des apps est chargee une seule fois au montage de la page (via `useEffect`). Le filtrage et la pagination sont cote client pour une reactivite instantanee. Le refresh explicite est la seule operation qui re-fetche le backend.

---

## Categorie 6 — Securite et gouvernance

### 6.1 RBAC
Seuls les utilisateurs avec le role `admin` ou `operator` peuvent installer/desinstaller des apps. Les utilisateurs standard peuvent voir le catalogue mais pas agir. Les boutons d'action sont masques ou desactives selon le role.

### 6.2 Isolation des conteneurs
Chaque conteneur installe est isole par le runtime Docker. Pas de mode privilegied par defaut. Les capabilities Linux sont restreintes au minimum necessaire.

### 6.3 Controle des images
L'admin peut configurer une whitelist de registries autorises (ex: Docker Hub officiel, registry prive). Les images provenant de registries non autorises sont bloquees a l'installation.

### 6.4 Audit trail
Chaque installation, desinstallation, demarrage et arret est logue dans le journal d'audit (signapps-identity). L'admin peut consulter l'historique des actions dans le module Audit.

### 6.5 Ressources limitees
L'admin peut configurer des limites de ressources par conteneur : CPU max, RAM max, stockage max. Les limites par defaut sont appliquees si l'utilisateur ne les specifie pas.

---

## Categorie 7 — Mise a jour et maintenance

### 7.1 Detection de mise a jour
Le store compare periodiquement les tags d'images locales avec les tags distants. Si une version plus recente est disponible, un badge `Mise a jour disponible` apparait sur la carte de l'app.

### 7.2 Processus de mise a jour
La mise a jour pull la nouvelle image, arrete le conteneur, recree le conteneur avec la meme configuration, et redemarre. Les volumes persistants sont preserves.

### 7.3 Rollback
Si une mise a jour echoue (conteneur ne demarre pas), l'ancienne image est restauree automatiquement. L'admin peut aussi forcer un rollback manuel vers une version anterieure.

### 7.4 Backup avant mise a jour
Avant chaque mise a jour, les volumes du conteneur sont snapshotes (si le driver de stockage le supporte). Le snapshot est conserve 7 jours par defaut.

### 7.5 Notifications de mise a jour
L'admin recoit une notification (via signapps-notifications) quand des mises a jour sont disponibles pour les apps installees. Frequence configurable (quotidien, hebdomadaire, jamais).

---

## Categorie 8 — Templates et presets

### 8.1 Templates d'application
Chaque app du catalogue peut definir un template Docker Compose avec des presets de configuration. Le template contient : image, ports, volumes, variables d'environnement, dependances (ex: une app qui requiert PostgreSQL deploie aussi un conteneur PostgreSQL).

### 8.2 Stacks multi-conteneurs
Certaines apps requierent plusieurs conteneurs (ex: WordPress = app + MySQL). Le store supporte les stacks (Docker Compose) qui deploient plusieurs conteneurs lies. La stack est geree comme une unite : demarrer/arreter la stack agit sur tous les conteneurs.

### 8.3 Presets par environnement
Le template peut definir des presets : `development` (debug active, ports ouverts), `production` (optimisations, HTTPS force). L'utilisateur choisit le preset lors de l'installation, les variables sont pre-remplies en consequence.

### 8.4 Configuration avancee
Un toggle `Configuration avancee` dans le dialogue d'installation revele les options supplementaires : resource limits (CPU, RAM), restart policy (always, on-failure, no), network mode (bridge, host, custom), capabilities Linux, labels Docker custom.

### 8.5 Validation de la configuration
Avant l'installation, le formulaire valide : ports non deja utilises par un autre conteneur, chemins de volumes valides, variables d'environnement obligatoires remplies. Les erreurs sont affichees inline sous les champs concernes.

---

## Categorie 9 — Monitoring des apps installees

### 9.1 Statut en temps reel
Les cartes d'apps installees affichent un indicateur de statut en temps reel : vert (running), gris (stopped), jaune (restarting), rouge (error/dead). Le statut est rafraichi toutes les 10 secondes via polling.

### 9.2 Metrics par app
Clic sur une app installee affiche un panneau de metriques : CPU %, RAM (usage/limit), reseau (in/out), disque (read/write). Les metriques sont streamed depuis `containersApi.stats()`. Integration avec le module Monitoring pour l'historique.

### 9.3 Logs
Acces aux logs du conteneur directement depuis le store. Bouton `Logs` ouvre un panneau avec les 1000 dernières lignes, auto-scroll, recherche dans les logs, filtre par niveau (info, warn, error).

### 9.4 Health checks
Si le conteneur definit un HEALTHCHECK Docker, le statut de sante est affiche : healthy, unhealthy, starting. Un badge de sante apparait sur la carte. Les conteneurs unhealthy declenchent une notification admin.

### 9.5 Acces console
Bouton `Shell` ouvre un terminal web (xterm.js) avec un shell bash/sh dans le conteneur. Acces restreint aux admins. Utile pour le debug et la maintenance.

---

## Categorie 10 — Marketplace communautaire

### 10.1 Contributions utilisateur
Les utilisateurs peuvent soumettre des apps custom au catalogue partage de l'instance. La soumission inclut : nom, description, image Docker, configuration par defaut, capture d'ecran optionnelle.

### 10.2 Moderation
Les soumissions sont en attente de validation par un admin avant d'apparaitre dans le catalogue public. L'admin peut approuver, rejeter (avec commentaire), ou demander des modifications.

### 10.3 Notes et avis
Les utilisateurs peuvent noter les apps (1-5 etoiles) et laisser un commentaire apres installation. La note moyenne est affichee sur la carte. Les avis sont moderes par l'admin.

### 10.4 Statistiques d'installation
Chaque app affiche le nombre d'installations sur l'instance. Les apps les plus installees remontent dans un onglet `Populaires`. Un onglet `Nouveautes` montre les ajouts recents.

### 10.5 Export/Import de catalogue
L'admin peut exporter le catalogue custom en JSON et l'importer sur une autre instance SignApps. Ceci facilite la replication de configurations entre instances.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Synology Package Center** (kb.synology.com) — gestion de packages, sources tierces, mise a jour.
- **Portainer Documentation** (docs.portainer.io) — templates, stacks, registry management.
- **Cloudron Documentation** (docs.cloudron.io) — app installation, backup, update, SSO.
- **YunoHost Documentation** (yunohost.org/docs) — app catalog, packaging, quality levels.
- **Unraid Community Applications** (forums.unraid.net/topic/38582-plug-in-community-applications/) — templates Docker, search, categories.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

## References OSS

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Yacht** (github.com/SelfhostedPro/Yacht) | **MIT** | Container management UI. Pattern template-based deployment, variable configuration forms, port/volume mapping. |
| **Homer** (github.com/bastienwirtz/homer) | **Apache-2.0** | Dashboard de services self-hosted. Pattern catalogue YAML, categories, search, icones, layout responsive. |
| **Heimdall** (github.com/linuxserver/Heimdall) | **MIT** | Application dashboard. Pattern app cards, categories, pinning, search, tags. |
| **CasaOS** (github.com/IceWhaleTech/CasaOS) | **Apache-2.0** | OS self-hosted avec app store Docker. Pattern one-click install, wizard configuration, app lifecycle. |
| **Portainer CE** (github.com/portainer/portainer) | **Zlib** | Container management. Pattern template deployment, stack management, registry integration. |
| **bollard** (github.com/fussybeaver/bollard) | **Apache-2.0** | Crate Rust pour Docker API. Deja utilise dans signapps-containers. Docker client async natif. |
| **Runtipi** (github.com/runtipi/runtipi) | **GPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Pattern app store self-hosted, one-click Docker deployment. |
| **Cosmos Server** (github.com/azukaar/Cosmos-Server) | **Apache-2.0** | Self-hosted platform avec marketplace, reverse proxy auto, SSL auto. Pattern app store + networking integre. |

---

## Assertions E2E cles (a tester)

- Page /apps → le titre `App Store` est visible avec le compteur d'apps
- Chargement → skeleton loading visible puis grille d'apps s'affiche
- Vue groupee → les categories sont affichees avec compteurs et previews de 4 apps
- Clic `View all` sur une categorie → le filtre de categorie s'active
- Saisie `nginx` dans la recherche → seules les apps contenant "nginx" apparaissent
- Clic sur le badge categorie `Media` → seules les apps tagguees Media s'affichent
- Clic `All` → retour a la vue groupee
- Pagination → boutons Previous/Next fonctionnels, indicateur de page correct
- Clic `Installer` sur une app → le dialogue InstallDialog s'ouvre avec les champs pre-remplis
- Installation → spinner visible, toast de succes, l'app apparait comme installee
- App installee running → bouton `Ouvrir` visible avec lien vers le port mappe
- Bouton `Ajouter une app` → le dialogue CustomAppDialog s'ouvre
- Bouton `Sources` → le panneau SourceManager s'ouvre avec la liste des sources
- Bouton `Actualiser` → l'icone tourne, les apps sont re-fetched
- Recherche sans resultat → message `No apps match your filters` visible
- Aucune app disponible → message `No apps available. Try refreshing sources.`
- App deja installee → le statut installe est detecte via correspondance d'image Docker
- Detail dialog → clic sur une app affiche description, tags, image, bouton installer
