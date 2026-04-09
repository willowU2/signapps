# Module Partages (Shared With Me) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Google Drive "Shared with me"** | Aggregation automatique de tout fichier partage, tri par date de partage/dernier acces, recherche dans les fichiers partages, ajout au "My Drive" pour organiser, preview inline, filtres par type/proprietaire, suggestion de fichiers pertinents par IA |
| **Dropbox Shared Folders** | Dossiers partages synchronises localement, notifications de changements, commentaires sur fichiers, demande d'acces, badge desktop (status sync), Dropbox Paper collaboration, permissions granulaires (view/edit/manage), audit log |
| **OneDrive Shared** | Vue unifiee "Shared" avec sous-onglets (Shared with you / Shared by you), integration Office 365 co-authoring, permissions granulaires, expiration de partage, lien de partage avec mot de passe, vue recente cross-module |
| **Notion Shared Pages** | Pages partagees avec permissions par bloc, mention @user pour partager, sidebar "Shared" avec toutes les pages, guest access, teamspaces, permission par page/database/workspace, favoris, derniers edites |
| **Box Shared Files** | Enterprise sharing avec DLP, watermarking, access statistics, Box Relay workflows, external collaboration secure, preview 150+ formats, classification automatique, retention policies, legal hold sur partages |
| **Nextcloud Shares** | Federation de partages entre instances, partage par lien (password, expiration, download interdit), partage vers groupes/cercles, re-partage controle, tags collaboratifs, activity stream des partages, API OCS |
| **iCloud Shared** | Partage de fichiers/dossiers/albums, collaboration sur iWork (Pages, Numbers, Keynote), shared album photos, notifications de modifications, partage familial, control granulaire (view/edit), iCloud Drive shared folders |
| **SharePoint Shared** | Hub de partages enterprise, sites d'equipe, librairies de documents partagees, co-authoring Office, version history, check-in/check-out, metadata columns, search across shared sites, external sharing policies |

## Principes directeurs

1. **Agregation cross-module** — la page "Partages avec moi" regroupe TOUTES les ressources partagees par d'autres utilisateurs, quel que soit le module source : fichiers (Drive), documents (Docs), feuilles de calcul (Spreadsheet), presentations (Slides), formulaires (Forms), taches (Tasks), calendriers (Calendar), contacts (Contacts), notes (Keep), identifiants partages (Vault). Un seul endroit pour tout retrouver.
2. **Temps reel et notifications** — quand un utilisateur partage une ressource, le destinataire voit apparaitre l'element en temps reel (WebSocket push) avec une notification. Les modifications sur les ressources partagees sont signalees (badge "Modified" ou "New comment").
3. **Recherche et filtrage puissants** — filtrer par type de ressource, par proprietaire, par date de partage, par permission (lecture/ecriture), par module source. Recherche full-text dans les noms et descriptions des ressources partagees.
4. **Actions directes** — depuis la vue "Partages avec moi", l'utilisateur peut ouvrir, copier dans son Drive, supprimer le partage (retirer de sa vue), re-partager (si autorise), et voir les details de permission. Pas besoin de naviguer vers le module source.
5. **Organisation personnelle** — l'utilisateur peut epingler (favoris), trier, et regrouper les ressources partagees selon ses preferences. Les favoris apparaissent en premier. Les ressources non-consultees sont mises en evidence.
6. **Respect des permissions** — la vue "Partages avec moi" respecte strictement les permissions definies par le proprietaire. Lecture seule = pas de modification. Aucun re-partage si le proprietaire l'a interdit. Revocation immediate si le proprietaire retire le partage.

---

## Categorie 1 — Vue principale et navigation

### 1.1 En-tete de page
Titre "Shared with me" en H1 avec sous-titre descriptif "All resources that other users have shared with you". Compteur total d'elements partages visible a droite du titre : badge gris "(142 items)". Le compteur exclut les elements masques (hidden). Si l'utilisateur filtre, le compteur se met a jour : "(23 of 142 items)".

### 1.2 Barre de filtres
Barre horizontale de filtres en haut de la liste, responsive (wrap sur mobile). Chaque filtre est un dropdown ou input avec label :

- **Type de ressource** (dropdown multi-select avec checkboxes) : All types (defaut), Files, Documents, Spreadsheets, Presentations, Forms, Tasks, Calendars, Contacts, Notes, Credentials. Chaque option a une icone a gauche du label. Le dropdown affiche le nombre selectionne si > 1 : "Types (3)".
- **Owner** (dropdown avec recherche integree) : champ de recherche en haut du dropdown, liste des utilisateurs qui ont partage au moins une ressource. Avatar + nom. Selection unique ou "All owners" (defaut). Raccourci : taper les premieres lettres filtre la liste (debounce 200ms).
- **Date range** (date range picker) : presets "Today", "Last 7 days", "Last 30 days", "Last 90 days", "Custom" (ouvre deux date pickers from/to). Defaut : All time. Le preset actif est affiche dans le bouton.
- **Permission** (dropdown single-select) : All, Read only, Read/Write, Admin. Defaut : All.
- **Module source** (dropdown multi-select) : Drive, Docs, Spreadsheet, Slides, Forms, Tasks, Calendar, Contacts, Keep, Vault. Meme logique que le filtre Type mais filtre par module backend plutot que par type de ressource.

Bouton `Reset filters` (icone croix, texte "Clear") visible uniquement si au moins un filtre est actif. Clic reset tous les filtres a leurs valeurs par defaut. Etat des filtres persiste dans le query string de l'URL (ex: `/shared-with-me?type=file,document&owner=uuid`) pour permettre le bookmarking et le partage de liens filtres.

### 1.3 Barre de recherche
Champ de recherche pleine largeur entre les filtres et la liste. Placeholder : "Search by name, description, or owner...". Icone loupe a gauche, bouton clear (croix) a droite quand du texte est saisi. Recherche dans : le nom de la ressource, la description (si disponible), le nom du proprietaire. Resultats filtres en temps reel avec debounce 300ms. Highlighting des termes trouves dans les resultats (fond jaune sur les caracteres matchant dans le nom et le proprietaire). Si aucun resultat : message "No resources match your search" avec suggestion "Try different keywords or clear your filters". Raccourci clavier : `Ctrl+K` ou `/` focus la barre de recherche.

### 1.4 Modes d'affichage
Toggle a deux boutons (icones) a droite de la barre de recherche :

- **Vue liste** (defaut) : tableau avec colonnes — checkbox de selection, icone de type (16x16), nom (lien cliquable, gras si non-lu), type (badge texte), proprietaire (avatar 24x24 + nom), date de partage (relative : "2 hours ago", "yesterday", "Mar 12, 2026"), permission (badge colore : "Read" gris, "Write" bleu, "Admin" violet), dernier acces (relative ou "Never" en italique gris), taille (pour les fichiers, vide sinon). Colonnes redimensionnables par drag des bordures. Colonnes triables par clic sur l'en-tete (fleche up/down).

- **Vue grille** : cartes de 200x180px disposees en grille responsive. Desktop 12 colonnes → 4 cartes par ligne. Tablette → 2 par ligne. Mobile → 1 par ligne. Chaque carte : icone de type (48x48) ou thumbnail (si image/document), nom (tronque a 2 lignes avec ellipsis), proprietaire (avatar 20x20 + nom tronque), date de partage relative, badge permission. Hover : overlay avec preview du contenu (image en miniature agrandie, document premiere page, spreadsheet preview des cellules). Le hover preview apparait apres 500ms de hover, disparait immediatement au mouseout.

Preference de mode persistante dans localStorage (cle `shared-with-me-view-mode`). Le mode selectionne est conserve entre les sessions.

### 1.5 Tri
Dropdown "Sort by" a droite de la barre de filtres. Options :
- Date shared (newest first) — defaut
- Date shared (oldest first)
- Name (A-Z)
- Name (Z-A)
- Last accessed (recent first)
- Type
- Owner (A-Z)

En mode liste, le tri actif est aussi indique visuellement par une fleche dans l'en-tete de la colonne correspondante. Clic sur un en-tete de colonne alterne entre ascendant, descendant, et pas de tri (retour au defaut).

### 1.6 Groupement
Dropdown "Group by" a cote du tri. Options :
- **None** (defaut) — liste plate
- **By owner** — sections avec un header par proprietaire (avatar + nom + compteur d'elements). Les sections sont collapsibles (clic sur le header plie/deplie).
- **By type** — sections par type de ressource (Files, Documents, Spreadsheets, etc.) avec icone et compteur.
- **By date** — sections temporelles : "Today", "This week", "This month", "Older". Chaque section avec compteur.
- **By module** — sections par module source (Drive, Docs, etc.) avec icone du module.

Le groupement est combinable avec le tri : les elements a l'interieur de chaque groupe respectent le tri selectionne. Si un groupe est vide apres filtrage, il n'est pas affiche.

### 1.7 Pagination et scroll infini
Chargement initial de 50 elements (requete API avec `per_page=50`). Scroll infini : quand l'utilisateur scroll a 200px du bas de la liste, la page suivante est chargee automatiquement. Indicateur de chargement en bas : spinner + texte "Loading more...". Compteur en bas de la liste : "Showing 100 of 142 items". Quand tous les elements sont charges : "All 142 items loaded". Bouton "Back to top" (fleche vers le haut) apparait quand l'utilisateur a scroll de > 500px. Clic → smooth scroll vers le haut.

### 1.8 Etat vide
Si aucune ressource partagee avec l'utilisateur :
- Illustration SVG centree (icone de partage stylisee, personnages echangeant un document, couleurs muted).
- Titre : "Nothing shared with you yet"
- Description : "When someone shares a file, document, or other resource with you, it will appear here."
- Pas de bouton d'action (l'utilisateur ne peut pas se partager quelque chose a lui-meme).

Si des filtres sont actifs et aucun resultat :
- Icone loupe barree.
- Titre : "No results found"
- Description : "No shared resources match your current filters."
- Bouton `Clear filters` pour reinitialiser.

### 1.9 Etat d'erreur
Si le backend n'est pas disponible (HTTP 500, 502, 503, timeout) :
- Icone warning triangle rouge.
- Titre : "Unable to load shared resources"
- Description : "Something went wrong while fetching your shared items. Please try again."
- Bouton `Retry` (bleu, pleine largeur sur mobile) qui relance la requete API.
- Pas d'ecran blanc — toujours un feedback utilisateur.

Si un service specifique est down (ex: module Docs retourne 503 mais les autres fonctionnent) : les resultats des modules fonctionnels sont affiches, avec un bandeau d'avertissement en haut : "Some services are temporarily unavailable. Shared documents may not appear." Le bandeau est dismissable.

---

## Categorie 2 — Carte de ressource partagee

### 2.1 Informations affichees par element
Chaque ressource partagee affiche les informations suivantes, adaptees au mode d'affichage (liste ou grille) :

- **Icone de type** : icone specifique au module, coherente avec le design system SignApps. Fichier generique (document gris), fichier image (image verte), fichier PDF (PDF rouge), fichier video (video violette), document Docs (doc bleu), spreadsheet (tableau vert), presentation (slides orange), formulaire (form violet), tache (checkmark bleu), calendrier (calendar rouge), contact (person bleu), note (note jaune), credential (key gris). Taille 16x16 en mode liste, 48x48 en mode grille.

- **Nom** de la ressource avec extension pour les fichiers (ex: "Budget Q1.xlsx", "Meeting Notes", "Alice Contact Card"). Tronque a 1 ligne en mode liste (ellipsis), 2 lignes en mode grille. Tooltip avec le nom complet au hover. Gras si l'element n'a jamais ete ouvert par le destinataire (is_new = true).

- **Proprietaire** : avatar (24x24 cercle, fallback initiales si pas d'avatar) + nom complet. En mode grille : avatar 20x20 + prenom seul pour gagner de l'espace. Hover sur le nom → tooltip card avec avatar large, nom complet, email, role dans l'organisation.

- **Date de partage** : format relatif intelligent — "Just now" (< 1 min), "5 minutes ago", "2 hours ago", "Yesterday at 3:14 PM", "March 12, 2026". Basculement vers format absolu au-dela de 7 jours. Tooltip avec la date et heure exactes en format ISO.

- **Permission** : badge inline colore — "Read" (gris, icone oeil), "Write" (bleu, icone crayon), "Admin" (violet, icone couronne). En mode grille : badge dans le coin inferieur droit de la carte.

- **Module source** : badge discret sous le nom — "Drive", "Docs", "Calendar", etc. Texte petit, couleur muted. Visible uniquement en mode liste (masque en mode grille pour gagner de l'espace, visible au hover).

- **Indicateur d'activite** : badge positionne dans le coin superieur droit de la carte (grille) ou apres le nom (liste) :
  - "New" (badge orange pulsant) — si l'element n'a jamais ete ouvert par le destinataire (is_new = true). Le badge disparait apres la premiere ouverture.
  - "Modified" (badge bleu) — si l'element a ete modifie par le proprietaire ou un autre collaborateur depuis le dernier acces du destinataire (is_modified = true). Le badge disparait apres la prochaine ouverture.

- **Etoile favori** : icone etoile a gauche du nom. Pleine et doree si favori, contour gris sinon. Clic toggle le favori (requete API immediate, feedback visuel instant).

### 2.2 Preview inline et thumbnail
Le champ `thumbnail_url` de `SharedResource` est utilise pour afficher un apercu visuel :

- **Fichiers images** (JPEG, PNG, GIF, WebP) : miniature 200x150 dans la carte grille. Chargement lazy (IntersectionObserver). Placeholder gris pendant le chargement. En mode liste : miniature 32x32 a la place de l'icone de type.
- **Documents Docs** : miniature de la premiere page (generee par le backend, cache). Si pas disponible : icone document avec les 2 premieres lignes de texte en preview gris.
- **Spreadsheets** : miniature montrant les 5 premieres lignes/colonnes du tableau.
- **Presentations** : miniature de la premiere slide.
- **Taches** : pas de thumbnail. Affichage inline : statut (badge "Open" vert, "In Progress" bleu, "Done" gris barre), assignees (avatars empiles, max 3 + "+N").
- **Contacts** : avatar du contact (64x64 en grille) + nom + email.
- **Formulaires** : icone formulaire + nombre de reponses si l'utilisateur a la permission de les voir.

Hover preview en mode grille : apres 500ms de hover sur une carte, un tooltip agrandi (300x200px) apparait avec un apercu plus detaille. Pour les images : version plus grande. Pour les documents : premiere page lisible. Pour les spreadsheets : tableau avec plus de lignes. Animation fadeIn 200ms. Le preview disparait immediatement au mouseout (pas de fadeOut).

### 2.3 Menu contextuel (clic droit ou bouton ...)
Bouton "..." (three dots) visible au hover de chaque element (en mode liste : colonne Actions, en mode grille : coin superieur droit de la carte). Clic ouvre un dropdown menu. Memes actions accessibles par clic droit sur l'element.

Actions disponibles, dans cet ordre :
1. **Open** → navigation vers la ressource dans son module natif (voir 5.1 pour les URLs).
2. **Open in new tab** → meme destination, `window.open` avec `_blank`.
3. **---** (separateur)
4. **Copy to my Drive** → copie le fichier/document dans le Drive personnel (voir 5.2).
5. **Add to favorites** / **Remove from favorites** → toggle, label dynamique selon l'etat actuel.
6. **Re-share** → partager a son tour (voir 5.3). Grise avec tooltip "Owner has disabled re-sharing" si `allow_reshare = false`.
7. **---** (separateur)
8. **Copy link** → copie l'URL directe vers la ressource dans le presse-papier. Toast : "Link copied to clipboard".
9. **Share details** → ouvre le panneau lateral de details (voir 5.6).
10. **---** (separateur)
11. **Hide from list** → masque l'element (voir 5.4). Icone oeil barre.

Les actions non-autorisees (permission insuffisante, re-share interdit) sont grises avec un tooltip explicatif.

### 2.4 Double-clic
Double-clic sur un element l'ouvre directement dans son module natif (meme comportement que "Open" du menu contextuel). Le `last_accessed` est mis a jour (requete API `PATCH /api/v1/shared-with-me/{id}/access`), le badge "New" disparait si present.

### 2.5 Selection multiple
Checkbox sur chaque element (colonne gauche en mode liste, coin superieur gauche en mode grille au hover). Raccourcis clavier :
- `Ctrl+Click` : ajoute/retire un element de la selection.
- `Shift+Click` : selectionne tous les elements entre le dernier selectionne et celui clique.
- `Ctrl+A` : selectionne tous les elements visibles (avec confirmation si > 100 : "Select all 142 items?").

Barre d'actions groupees qui apparait en haut de la liste quand >= 1 element est selectionne (animation slideDown). Contenu : "N selected" + boutons d'action : "Copy to my Drive (N)" (icone copie), "Add to favorites (N)" (icone etoile), "Hide from list (N)" (icone oeil barre). Bouton "Deselect all" (croix). La barre est sticky (reste visible au scroll).

---

## Categorie 3 — Agregation cross-module (backend)

### 3.1 API d'agregation unifiee
Endpoint unique `GET /api/v1/shared-with-me` qui interroge 10 services backend en parallele et retourne une liste unifiee. Le handler est situe dans le service signapps-gateway (port 3099) car il agrege les donnees de multiples services.

Parametres de requete :
- `type` (optionnel, multi-valeur) : filtre par type de ressource (`file`, `document`, `spreadsheet`, `presentation`, `form`, `task`, `calendar`, `contact`, `note`, `credential`)
- `module` (optionnel, multi-valeur) : filtre par module source (`drive`, `docs`, `spreadsheet`, `slides`, `forms`, `tasks`, `calendar`, `contacts`, `keep`, `vault`)
- `owner_id` (optionnel, UUID) : filtre par proprietaire
- `since` (optionnel, ISO 8601) : date minimale de partage
- `until` (optionnel, ISO 8601) : date maximale de partage
- `permission` (optionnel) : `read`, `write`, `admin`
- `search` (optionnel) : recherche full-text dans le nom, la description, le nom du proprietaire
- `is_favorited` (optionnel, bool) : filtrer les favoris
- `is_hidden` (optionnel, bool, defaut false) : inclure les elements masques
- `sort` (optionnel) : `shared_at`, `name`, `last_accessed`, `type`, `owner_name` (defaut : `shared_at`)
- `order` (optionnel) : `asc`, `desc` (defaut : `desc`)
- `group_by` (optionnel) : `owner`, `type`, `date`, `module`
- `page` (optionnel, defaut 1) et `per_page` (optionnel, defaut 50, max 100)

Response :
```json
{
  "data": [SharedResource, ...],
  "meta": {
    "total": 142,
    "page": 1,
    "per_page": 50,
    "total_pages": 3,
    "new_count": 5,
    "services_status": {
      "drive": "ok",
      "docs": "ok",
      "spreadsheet": "ok",
      "slides": "ok",
      "forms": "ok",
      "tasks": "ok",
      "calendar": "ok",
      "contacts": "ok",
      "keep": "ok",
      "vault": "ok"
    }
  }
}
```

Le champ `services_status` permet au frontend de detecter si un service est down et d'afficher un warning partiel.

### 3.2 Sources de donnees
L'API agrege les partages depuis les tables de chaque module. Chaque module expose un endpoint interne (non-public) interroge par le gateway :

| Module | Service (port) | Endpoint interne | Table source |
|---|---|---|---|
| Drive | signapps-storage (3004) | `GET /internal/shares?user_id=` | `drive_shares` |
| Docs | signapps-docs (3010) | `GET /internal/shares?user_id=` | `document_shares` |
| Spreadsheet | signapps-docs (3010) | `GET /internal/shares?user_id=&type=spreadsheet` | `spreadsheet_shares` |
| Slides | signapps-docs (3010) | `GET /internal/shares?user_id=&type=presentation` | `presentation_shares` |
| Forms | signapps-forms (3015) | `GET /internal/shares?user_id=` | `form_shares` |
| Tasks | signapps-calendar (3011) | `GET /internal/shares?user_id=&type=task` | `task_shares` |
| Calendar | signapps-calendar (3011) | `GET /internal/shares?user_id=&type=calendar` | `calendar_shares` |
| Contacts | signapps-contacts | `GET /internal/shares?user_id=` | `contact_shares` |
| Keep | signapps-docs (3010) | `GET /internal/shares?user_id=&type=note` | `note_shares` |
| Vault | signapps-identity (3001) | `GET /internal/shares?user_id=` | `credential_shares` |

Chaque endpoint interne retourne un `Vec<SharedResource>` au format unifie. Le gateway merge les resultats, applique les filtres globaux (search, sort, pagination), et retourne la reponse.

### 3.3 Schema unifie
Chaque element retourne un objet normalise :

```
SharedResource {
  id: UUID,                       -- ID unique du partage
  resource_id: UUID,              -- ID de la ressource dans son module
  resource_type: String,          -- "file", "document", "spreadsheet", "presentation",
                                  -- "form", "task", "calendar", "contact", "note",
                                  -- "credential", "folder"
  module: String,                 -- "drive", "docs", "spreadsheet", "slides", "forms",
                                  -- "tasks", "calendar", "contacts", "keep", "vault"
  name: String,                   -- Nom affiche de la ressource
  description: Option<String>,    -- Description ou extrait (100 premiers caracteres)
  owner_id: UUID,                 -- ID du proprietaire qui a partage
  owner_name: String,             -- Nom complet du proprietaire
  owner_avatar: Option<String>,   -- URL de l'avatar du proprietaire
  permission: String,             -- "read", "write", "admin"
  allow_reshare: bool,            -- Le proprietaire autorise-t-il le re-partage
  shared_at: DateTime<Utc>,       -- Date/heure du partage
  last_accessed: Option<DateTime<Utc>>,  -- Dernier acces par le destinataire
  last_modified: Option<DateTime<Utc>>,  -- Derniere modification par quiconque
  size: Option<i64>,              -- Taille en bytes (fichiers uniquement)
  mime_type: Option<String>,      -- Type MIME (fichiers uniquement)
  thumbnail_url: Option<String>,  -- URL du thumbnail (cache, signe, expire dans 1h)
  is_favorited: bool,             -- Epingle en favori par le destinataire
  is_hidden: bool,                -- Masque de la vue par le destinataire
  is_new: bool,                   -- Jamais ouvert par le destinataire
  is_modified: bool,              -- Modifie depuis le dernier acces du destinataire
  url: String,                    -- URL directe vers la ressource dans son module
}
```

Le `thumbnail_url` est une URL signee avec expiration (1h), generee par le service source. Pour les images : redimensionnement cote serveur (200x150 max). Pour les documents : capture de la premiere page via le service Office (port 3018). Pour les spreadsheets : rendu HTML des premieres cellules. Si aucun thumbnail n'est disponible : `null` (le frontend utilise l'icone de type).

### 3.4 Performance et cache
L'agregation de 10 modules en parallele peut etre couteuse. Strategies d'optimisation implementees :

- **Requetes paralleles** : les 10 requetes vers les services internes s'executent en parallele via `tokio::join!`. Timeout par service : 3 secondes. Si un service timeout, ses resultats sont omis (le champ `services_status` indique "timeout") et les autres resultats sont retournes normalement.

- **Cache applicatif** (signapps-cache, moka) : cache de 2 minutes par utilisateur. Cle : `shared_with_me:{user_id}:{hash(filters)}`. Invalidation sur evenement de partage (PgEventBus `share.*`). La premiere requete apres invalidation rebuild le cache. Taille max du cache : 10 000 entrees (LRU eviction).

- **Pagination cote service** : chaque service interne recoit `per_page=100` (plafond) et retourne ses resultats tries par `shared_at DESC`. Le gateway merge les 10 listes triees en O(N log 10) (merge sort de 10 listes pre-triees) et pagine le resultat final.

- **Vue materialisee** (optionnel, activable si les performances ne suffisent pas) : creer une vue materialisee `shared_resources_mv` dans PostgreSQL qui agrege les tables `*_shares` en une seule table denormalisee. Rafraichie toutes les minutes via `REFRESH MATERIALIZED VIEW CONCURRENTLY`. Utilise par le handler quand le flag `use_materialized_view = true` est active dans la configuration.

### 3.5 Evenements temps reel
Quand un partage est cree, modifie ou revoque dans n'importe quel module, le flux temps reel est le suivant :

1. Le module source emet un evenement sur le PgEventBus avec le payload :
   - `share.created` : `{resource_id, resource_type, module, shared_by, shared_with, permission}`
   - `share.updated` : `{resource_id, module, shared_with, changes: {permission: "write"}}` (quand la permission change)
   - `share.revoked` : `{resource_id, module, shared_by, shared_with}`
   - `resource.modified` : `{resource_id, module, modified_by}` (quand le contenu change)

2. Le service gateway ecoute ces evenements (`PgEventBus::subscribe("share.*")` et `PgEventBus::subscribe("resource.modified")`). Pour chaque evenement, il identifie les utilisateurs concernes (`shared_with`).

3. Le gateway pousse l'evenement vers les clients concernes via la connexion WebSocket existante (canal `shared-with-me`). Payload : `{type: "share.created", data: SharedResource}` ou `{type: "share.revoked", data: {resource_id}}`.

4. Le frontend (store Zustand `shared-with-me-store`) recoit l'evenement et met a jour la liste en temps reel :
   - `share.created` → insere la nouvelle ressource en haut de la liste avec animation slideDown. Le compteur total s'incremente.
   - `share.updated` → met a jour les champs modifies (permission, nom) avec animation highlight (fond jaune pendant 2s).
   - `share.revoked` → retire la ressource de la liste avec animation fadeOut (300ms). Le compteur total decremente.
   - `resource.modified` → met a jour `is_modified = true` et `last_modified` de la ressource. Le badge "Modified" apparait.

5. Le cache moka est invalide (`shared_with_me:{user_id}:*`) a chaque evenement `share.*`.

### 3.6 Gestion des ressources supprimees
Si une ressource partagee est supprimee par le proprietaire :
- Le module source emet `share.revoked` pour tous les destinataires.
- L'element disparait de la vue "Shared with me" en temps reel.
- Si l'utilisateur tente d'acceder a une URL directe vers une ressource supprimee (`/docs/{id}`, `/drive/file/{id}`) : page d'erreur avec message "This resource is no longer available. The owner may have deleted it or revoked your access." Bouton "Back to Shared with me".
- Nettoyage periodique : cron quotidien (02:00 UTC) qui scan les tables `*_shares` et supprime les references vers des ressources inexistantes (`resource_id NOT IN (SELECT id FROM resources)`). Log : "Cleaned 3 orphaned share references".

---

## Categorie 4 — Notifications et activite

### 4.1 Notification de nouveau partage
Quand un utilisateur recoit un nouveau partage :
- **Toast in-app** : notification toast en bas a droite de l'ecran, visible pendant 5 secondes. Contenu : avatar du proprietaire + "Alice shared 'Budget Q1.xlsx' with you". Deux boutons : "Open" (navigation directe) et "Dismiss" (ferme le toast). Si le toast est ignore, il est archive dans le centre de notifications.
- **Badge sidebar** : le badge numerique sur l'entree "Shared with me" dans la sidebar s'incremente. Le badge reste jusqu'a ce que l'utilisateur visite la page `/shared-with-me` (a ce moment, seuls les elements reellement non-lus restent comptes).
- **Push notification** (si activee par l'utilisateur) : notification push mobile/desktop via le module Notifications (port 8095). Titre : "New share from Alice". Body : "Budget Q1.xlsx — Read access". Action : ouvrir l'app sur `/shared-with-me`.
- **Email** (si active par l'utilisateur) : email via le module Mail (port 3012). Objet : "Alice shared 'Budget Q1.xlsx' with you". Contenu : nom de la ressource, type, permission, lien direct "Open in SignApps".

### 4.2 Notification de modification
Quand une ressource partagee est modifiee par un autre utilisateur (proprietaire ou collaborateur) :
- Badge "Modified" (bleu) apparait sur l'element dans la liste (temps reel via WebSocket).
- Notification optionnelle (configurable, desactivee par defaut pour eviter le bruit) : "Alice modified 'Budget Q1.xlsx'". Le badge suffit dans la plupart des cas.
- Si l'utilisateur a ajoute l'element en favori : notification activee par defaut pour les favoris (les modifications sur les favoris sont plus susceptibles d'etre importantes).

### 4.3 Notification de revocation
Quand un partage est revoque par le proprietaire :
- L'element disparait de la liste en temps reel (animation fadeOut).
- Toast de notification : "Alice revoked your access to 'Budget Q1.xlsx'". Pas de bouton d'action (l'acces est retire, rien a faire).
- Si l'utilisateur avait copie la ressource dans son Drive (via "Copy to my Drive"), la copie reste intacte — seul le lien de partage est revoque. Mention dans le toast : "Your copy in Drive is not affected."
- Le compteur total se decremente.

### 4.4 Preferences de notification
Panneau de preferences accessible via l'icone engrenage en haut de la page `/shared-with-me`. Section "Notification preferences" dans les parametres utilisateur.

Configuration par type d'evenement :

| Evenement | In-app (toast + badge) | Email | Push mobile |
|---|---|---|---|
| Nouveau partage | Toujours (non configurable) | Configurable (defaut: ON) | Configurable (defaut: ON) |
| Modification | Configurable (defaut: favoris only) | Configurable (defaut: OFF) | Configurable (defaut: OFF) |
| Revocation | Toujours (non configurable) | Configurable (defaut: OFF) | Configurable (defaut: OFF) |
| Nouveau commentaire | Configurable (defaut: ON) | Configurable (defaut: ON) | Configurable (defaut: OFF) |

Option additionnelle : "Quiet hours" (plage horaire pendant laquelle les notifications email et push sont retardees). Defaut : 22:00 - 07:00 fuseau local.

### 4.5 Historique d'activite
Panneau "Recent activity" accessible via un bouton "Activity" (icone horloge) en haut de la page. Drawer lateral droit (400px) qui s'ouvre avec animation slideIn.

Timeline verticale chronologique des evenements sur les ressources partagees :
- Nouveau partage : avatar + "Alice shared 'Budget Q1.xlsx' with you" + timestamp relatif.
- Modification : avatar + "Alice modified 'Budget Q1.xlsx'" + timestamp.
- Commentaire : avatar + "Alice commented on 'Meeting Notes'" + extrait du commentaire (30 chars max).
- Renommage : avatar + "Alice renamed 'Doc' to 'Meeting Notes'" + timestamp.
- Permission changee : avatar + "Alice changed your permission to Write on 'Budget'" + timestamp.
- Revocation : avatar + "Alice revoked your access to 'Old Report'" + timestamp.

Filtres en haut du drawer : dropdown de type d'evenement (all, shares, modifications, comments, revocations). Les 50 derniers evenements sont charges, avec bouton "Load more" en bas. Clic sur un evenement → navigation vers la ressource (si encore accessible).

---

## Categorie 5 — Actions sur les partages

### 5.1 Ouvrir une ressource
Clic (en mode liste) ou double-clic (en mode grille) sur un element → navigation vers la page de la ressource dans son module natif. Mapping des routes :

| Type | Module | Route |
|---|---|---|
| Fichier | Drive | `/drive/file/{resource_id}` (preview/download) |
| Dossier | Drive | `/drive/folder/{resource_id}` |
| Document | Docs | `/docs/{resource_id}` (editeur Tiptap) |
| Spreadsheet | Spreadsheet | `/spreadsheet/{resource_id}` |
| Presentation | Slides | `/slides/{resource_id}` |
| Formulaire | Forms | `/forms/{resource_id}` (formulaire ou resultats selon permission) |
| Tache | Tasks | `/tasks/{resource_id}` |
| Calendrier | Calendar | `/calendar?view={resource_id}` |
| Contact | Contacts | `/contacts/{resource_id}` |
| Note | Keep | `/keep/{resource_id}` |
| Credential | Vault | `/vault/{resource_id}` |

A l'ouverture, le backend met a jour `last_accessed` pour cet utilisateur et cette ressource. Le badge "New" disparait (is_new → false). Le badge "Modified" disparait (is_modified → false). Ces changements sont refletes dans le store Zustand et persistes via l'API.

### 5.2 Copier dans mon Drive
Action "Copy to my Drive" dans le menu contextuel. Comportement selon le type :
- **Fichiers** : copie physique du fichier dans le Drive personnel de l'utilisateur. Le fichier apparait dans la racine du Drive (ou dans un dossier "Shared copies" configurable). Le fichier copie est independant — les modifications de l'original ne se propagent pas.
- **Documents / Spreadsheets / Presentations / Notes** : copie du contenu au moment de la copie. Nouveau document independant cree dans le module correspondant, avec le meme contenu mais un nouveau `id`. Le proprietaire du nouveau document est l'utilisateur qui a copie.
- **Taches / Contacts / Calendriers / Formulaires / Credentials** : action non disponible (bouton grise avec tooltip "This resource type cannot be copied to Drive").

Feedback pendant la copie : spinner sur le bouton + texte "Copying...". A la fin : toast "Copied to your Drive" avec lien "View copy" qui ouvre le fichier copie. En cas d'erreur (stockage plein, permission insuffisante) : toast d'erreur rouge avec message explicatif.

### 5.3 Re-partager
Si le proprietaire autorise le re-partage (`allow_reshare = true`), l'utilisateur peut partager la ressource avec d'autres utilisateurs.

Clic sur "Re-share" → ouvre le dialogue de partage standard (meme composant `ShareDialog` utilise dans tous les modules). Champs : email ou nom du destinataire (autocomplete depuis l'annuaire), permission (read/write — l'utilisateur ne peut pas accorder plus de permission qu'il n'en a lui-meme ; s'il a "read", il ne peut partager qu'en "read"). Bouton "Share". Le destinataire voit le proprietaire original (pas le re-partageur) dans la liste des partages, avec une mention "Shared via Alice" pour la tracabilite.

Le proprietaire est notifie du re-partage : "Bob re-shared 'Budget Q1.xlsx' with Charlie (Read access)". Le proprietaire peut revoquer le re-partage a tout moment.

Si le re-partage est interdit (`allow_reshare = false`) : le bouton "Re-share" est grise avec tooltip "The owner has disabled re-sharing for this resource".

### 5.4 Retirer de ma vue (Hide)
L'utilisateur peut masquer un element partage sans revoquer le partage :
- Clic sur "Hide from list" → confirmation inline (pas de modal) : le bouton change en "Undo" pendant 5 secondes, puis l'element disparait avec animation fadeOut.
- L'element est marque `is_hidden = true` cote backend (`PATCH /api/v1/shared-with-me/{id}` avec body `{is_hidden: true}`).
- L'element disparait de la liste par defaut.
- Pour retrouver les elements masques : activer le filtre `is_hidden=true` via un toggle "Show hidden items" en bas de la barre de filtres. Les elements masques apparaissent avec un fond gris et une icone oeil barre.
- Bouton "Unhide" sur chaque element masque pour le restaurer.
- Masquer un element ne revoque pas le partage — l'utilisateur conserve l'acces et peut toujours y acceder via l'URL directe.

### 5.5 Favoris
Clic sur l'etoile a cote du nom (ou "Add to favorites" dans le menu contextuel) :
- L'icone etoile passe de contour gris a plein dore avec animation scale (0.8 → 1.2 → 1.0, 200ms).
- Requete API : `PATCH /api/v1/shared-with-me/{id}` avec body `{is_favorited: true}`.
- L'element apparait dans une section "Favorites" en haut de la liste (si le groupement n'est pas actif) ou est marque avec une etoile dans le tri courant.
- La section "Favorites" est collapsible, ouverte par defaut.
- Les favoris sont synchronises avec les favoris globaux : si l'element est aussi epingle dans le module Drive, c'est le meme favori (basee sur le `resource_id`).
- Retirer des favoris : meme geste, animation inverse (dore → contour gris).

### 5.6 Details du partage
Panneau lateral droit (drawer, 400px) qui s'ouvre avec animation slideIn. Ouvert par "Share details" dans le menu contextuel. Contenu :

- **Header** : icone de type (48x48) + nom de la ressource + badge permission. Bouton fermer (croix).
- **Section Owner** : avatar (48x48) + nom complet + email + role dans l'organisation. Lien "View profile" → page profil.
- **Section Share info** :
  - Date de partage : format absolu (March 12, 2026 at 3:14 PM)
  - Permission : "Read only" / "Read & Write" / "Admin" avec icone
  - Re-share : "Allowed" (vert) ou "Not allowed" (gris)
  - Expiration : date d'expiration du partage si definie, sinon "No expiration"
- **Section Other recipients** : liste des autres utilisateurs avec qui cette ressource est partagee (si visible par l'utilisateur). Chaque destinataire : avatar + nom + permission badge. Si l'utilisateur n'a pas la permission de voir les autres destinataires : mention "You do not have permission to view other recipients".
- **Section History** : timeline des evenements sur ce partage : date de creation du partage, modifications de permission, derniers acces par le destinataire. Les 10 derniers evenements. Format : timestamp + description.
- **Section Metadata** : taille du fichier (si applicable), type MIME, date de creation de la ressource, date de derniere modification, URL directe (copiable).

---

## Categorie 6 — Integration avec la sidebar et les autres modules

### 6.1 Entree dans la sidebar
Dans la sidebar principale de l'application, entree "Shared with me" avec :
- Icone de partage (two people with arrow, coherent avec le design system).
- Badge numerique orange indiquant le nombre de nouveaux partages non-consultes (is_new = true). Le badge disparait quand l'utilisateur visite la page et que tous les elements sont marques comme lus.
- Position : sous "My Drive" et avant "Trash" dans la section Drive de la sidebar.
- Le badge se met a jour en temps reel via WebSocket (evenement `share.created` incremente, visite de la page decremente).

### 6.2 Widget dans le Dashboard
Le Dashboard principal (`/dashboard`) affiche un widget "Recent shares" avec :
- Titre "Recent shares" avec icone partage et lien "View all" → `/shared-with-me`.
- Liste des 5 derniers elements partages (date < 7 jours). Chaque element : icone de type + nom (lien) + proprietaire + date relative.
- Si aucun partage recent : texte "No recent shares".
- Le widget est une carte draggable si le Dashboard supporte le drag-and-drop layout.

### 6.3 Integration Drive
Dans le module Drive (`/drive`), la sidebar inclut "Shared with me" comme vue speciale :
- Clic → affiche la meme vue que `/shared-with-me` mais filtree sur les fichiers et dossiers uniquement (type = file, folder).
- Les fichiers partages peuvent etre ajoutes dans l'arborescence du Drive via un "shortcut" (raccourci/lien symbolique, pas une copie physique). L'element apparait dans le Drive avec une icone de raccourci (petite fleche sur l'icone). Clic ouvre le fichier original.

### 6.4 Integration recherche globale
La recherche globale (barre de recherche dans la topbar, ou `/search`) inclut les ressources partagees dans les resultats. Chaque resultat provenant d'un partage a un badge "Shared" a droite du nom. Le score de pertinence tient compte de : la frequence d'acces, la date de partage (plus recent = plus pertinent), et la correspondance textuelle. Les resultats de partage sont melanges avec les resultats personnels (pas de section separee).

### 6.5 Integration notifications
Le module Notifications (centre de notifications dans la topbar) affiche les notifications de partage dans le feed global. Chaque notification est regroupee si plusieurs partages arrivent dans un court laps de temps : "Alice shared 3 files with you" au lieu de 3 notifications separees (regroupement si > 2 partages du meme proprietaire dans les 5 minutes). Clic sur la notification → navigation directe vers la ressource (si un seul element) ou vers `/shared-with-me?owner_id={owner}` (si regroupement).

### 6.6 Partages emis ("Shared by me")
Lien ou onglet secondaire "Shared by me" accessible via un toggle ou un tab en haut de la page `/shared-with-me`. Ce toggle bascule entre "Received" (defaut) et "Sent".

La vue "Shared by me" liste les ressources que l'utilisateur a lui-meme partagees avec d'autres. Meme format de liste avec : nom, type, destinataires (avatars empiles + tooltip avec la liste), permission, date de partage, statut de consultation (badge "Not yet viewed" si le destinataire n'a jamais ouvert, "Viewed" gris sinon, "Viewed 3x" avec compteur pour les partages tres consultes).

Actions disponibles sur chaque partage emis :
- **Revoke** → revoque le partage (confirmation modale). Le destinataire perd l'acces immediatement.
- **Change permission** → dropdown pour modifier la permission (read → write, write → read). Changement immediat, notification au destinataire.
- **View access stats** → panneau lateral avec : nombre d'ouvertures, date du dernier acces, duree totale de consultation (si mesurable), historique des acces.

---

## REST API endpoints

### Shared With Me (aggregated)
- `GET /api/v1/shared-with-me` — Liste agrege des ressources partagees (pagination, filtres, tri, groupement)
- `GET /api/v1/shared-with-me/{id}` — Detail d'une ressource partagee
- `PATCH /api/v1/shared-with-me/{id}` — Modifier les proprietes utilisateur (is_favorited, is_hidden)
- `PATCH /api/v1/shared-with-me/{id}/access` — Enregistrer un acces (met a jour last_accessed, is_new, is_modified)
- `POST /api/v1/shared-with-me/{id}/copy` — Copier dans mon Drive
- `POST /api/v1/shared-with-me/{id}/reshare` — Re-partager (body: `{shared_with: UUID, permission: "read"}`)
- `GET /api/v1/shared-with-me/activity` — Historique d'activite (pagination)
- `GET /api/v1/shared-with-me/count` — Compteurs (total, new, favorited, hidden)
- `GET /api/v1/shared-with-me/owners` — Liste des proprietaires (pour le filtre)

### Shared By Me
- `GET /api/v1/shared-by-me` — Liste des ressources partagees par l'utilisateur
- `DELETE /api/v1/shared-by-me/{id}` — Revoquer un partage
- `PATCH /api/v1/shared-by-me/{id}` — Modifier la permission
- `GET /api/v1/shared-by-me/{id}/stats` — Statistiques d'acces

### WebSocket events (canal `shared-with-me`)
- `share.created` → nouvelle ressource partagee (payload: SharedResource)
- `share.updated` → permission ou proprietes modifiees (payload: {id, changes})
- `share.revoked` → acces revoque (payload: {resource_id, module})
- `resource.modified` → contenu modifie par un collaborateur (payload: {resource_id, module, modified_by})

### Notification preferences
- `GET /api/v1/users/me/notification-preferences/shared` — Preferences actuelles
- `PUT /api/v1/users/me/notification-preferences/shared` — Modifier les preferences

---

## PostgreSQL schema

Les tables de partage sont dans chaque module (pas de table centralisee). Voici le schema type d'une table `*_shares` (repete dans chaque module avec des variations) :

```sql
-- Schema type pour les tables de partage par module
-- Exemple : drive_shares, document_shares, form_shares, etc.
CREATE TABLE drive_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES drive_files(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES users(id),
    shared_with UUID NOT NULL REFERENCES users(id),
    permission VARCHAR(10) NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'write', 'admin')),
    allow_reshare BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(resource_id, shared_with)
);

CREATE INDEX idx_drive_shares_shared_with ON drive_shares(shared_with, created_at DESC);
CREATE INDEX idx_drive_shares_shared_by ON drive_shares(shared_by);
CREATE INDEX idx_drive_shares_resource ON drive_shares(resource_id);
```

Tables supplementaires pour les fonctionnalites cross-module (dans le schema gateway) :

```sql
-- Preferences utilisateur pour les partages
CREATE TABLE shared_with_me_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    view_mode VARCHAR(10) NOT NULL DEFAULT 'list' CHECK (view_mode IN ('list', 'grid')),
    default_sort VARCHAR(20) NOT NULL DEFAULT 'shared_at',
    default_order VARCHAR(4) NOT NULL DEFAULT 'desc',
    default_group_by VARCHAR(20),
    notification_new_share_email BOOLEAN NOT NULL DEFAULT true,
    notification_new_share_push BOOLEAN NOT NULL DEFAULT true,
    notification_modification VARCHAR(20) NOT NULL DEFAULT 'favorites_only',
    notification_modification_email BOOLEAN NOT NULL DEFAULT false,
    notification_revocation_email BOOLEAN NOT NULL DEFAULT false,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Etat utilisateur par partage (favoris, masque, dernier acces)
CREATE TABLE shared_with_me_user_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    resource_id UUID NOT NULL,
    module VARCHAR(20) NOT NULL,
    is_favorited BOOLEAN NOT NULL DEFAULT false,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    first_accessed_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ,
    access_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, resource_id, module)
);

CREATE INDEX idx_user_state_user ON shared_with_me_user_state(user_id);
CREATE INDEX idx_user_state_resource ON shared_with_me_user_state(resource_id, module);
CREATE INDEX idx_user_state_favorited ON shared_with_me_user_state(user_id, is_favorited) WHERE is_favorited = true;

-- Vue materialisee optionnelle pour la performance
-- Active si config.use_materialized_view = true
CREATE MATERIALIZED VIEW shared_resources_mv AS
    SELECT
        ds.id,
        ds.resource_id,
        'file'::text AS resource_type,
        'drive'::text AS module,
        df.name,
        df.description,
        ds.shared_by AS owner_id,
        u.display_name AS owner_name,
        u.avatar_url AS owner_avatar,
        ds.permission,
        ds.allow_reshare,
        ds.shared_with,
        ds.created_at AS shared_at,
        df.updated_at AS last_modified,
        df.size,
        df.mime_type,
        df.thumbnail_url
    FROM drive_shares ds
    JOIN drive_files df ON ds.resource_id = df.id
    JOIN users u ON ds.shared_by = u.id
    WHERE ds.expires_at IS NULL OR ds.expires_at > now()

    UNION ALL

    SELECT
        dcs.id,
        dcs.resource_id,
        'document'::text AS resource_type,
        'docs'::text AS module,
        d.title AS name,
        LEFT(d.plain_text, 100) AS description,
        dcs.shared_by AS owner_id,
        u.display_name AS owner_name,
        u.avatar_url AS owner_avatar,
        dcs.permission,
        dcs.allow_reshare,
        dcs.shared_with,
        dcs.created_at AS shared_at,
        d.updated_at AS last_modified,
        NULL::bigint AS size,
        'application/json'::text AS mime_type,
        NULL::text AS thumbnail_url
    FROM document_shares dcs
    JOIN documents d ON dcs.resource_id = d.id
    JOIN users u ON dcs.shared_by = u.id
    WHERE dcs.expires_at IS NULL OR dcs.expires_at > now()

    -- ... UNION ALL for each module (spreadsheet, presentation, form, task, calendar, contact, note, credential)
;

CREATE INDEX idx_shared_resources_mv_user ON shared_resources_mv(shared_with, shared_at DESC);
CREATE INDEX idx_shared_resources_mv_type ON shared_resources_mv(resource_type);

-- Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY shared_resources_mv;
-- Scheduled via cron every minute or triggered by PgEventBus share.* events
```

---

## Metriques Prometheus

Export via signapps-metrics (port 3008) :
- `shared_with_me_total{user_id="..."}` — nombre total de partages par utilisateur
- `shared_with_me_new_total` — nombre de partages non-lus (somme globale)
- `shared_with_me_query_duration_seconds{service="drive|docs|..."}` — duree de requete par service backend
- `shared_with_me_cache_hit_ratio` — ratio de cache moka
- `shared_with_me_websocket_events_total{type="created|updated|revoked"}` — evenements WebSocket emis
- `shared_with_me_aggregation_duration_seconds` — duree totale de l'agregation cross-module
- `shared_with_me_service_errors_total{service="..."}` — erreurs par service backend

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Google Drive Help** (support.google.com/drive/answer/2375057) — "Shared with me" fonctionnement, organisation, gestion.
- **Dropbox Help** (help.dropbox.com/share/view-manage-shared) — gestion des dossiers partages, permissions, notifications.
- **OneDrive Help** (support.microsoft.com/en-us/office/share-onedrive-files) — partage, permissions, liens, expiration.
- **Nextcloud Documentation** (docs.nextcloud.com/server/latest/user_manual/en/files/sharing.html) — Federation de partages, API OCS, permissions.
- **Box Developer Docs** (developer.box.com/reference/resources/collaboration) — API collaborations, permissions, enterprise sharing.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Nextcloud Server** (github.com/nextcloud/server) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Architecture de partage federation, API OCS, types de partage (user, group, link, remote). |
| **ownCloud** (github.com/owncloud/core) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Pattern de partage cross-module, resolution de permissions. |
| **Filestash** (github.com/mickael-kerjean/filestash) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Interface web de gestion de fichiers, preview multi-format. |
| **tanstack-table** (github.com/TanStack/table) | **MIT** | Table headless React pour la liste des partages. Tri, filtres, pagination, selection. Deja dans l'ecosysteme frontend. |
| **tanstack-virtual** (github.com/TanStack/virtual) | **MIT** | Virtualisation de listes longues pour le scroll infini. Performance sur 1000+ elements. |
| **zustand** (github.com/pmndrs/zustand) | **MIT** | State management React. Store `shared-with-me-store.ts` pour l'etat des filtres, la selection, et le cache local. Deja utilise dans SignApps. |
| **react-hot-toast** (github.com/timolins/react-hot-toast) | **MIT** | Toast notifications pour les actions (copie, favoris, retrait). Leger, composable. |
| **date-fns** (github.com/date-fns/date-fns) | **MIT** | Formatage de dates relatives ("2 hours ago", "yesterday"). `formatDistanceToNow`. Deja utilise dans SignApps. |
| **sqlx** (github.com/launchbadge/sqlx) | **MIT/Apache-2.0** | Requetes SQL async pour l'agregation cross-tables. `query_as` avec mapping vers `SharedResource`. Deja utilise. |
| **serde** (github.com/serde-rs/serde) | **MIT/Apache-2.0** | Serialisation/deserialisation du schema unifie `SharedResource`. Deja utilise dans tout le workspace. |

### Pattern d'implementation recommande
1. **Table de partages** : chaque module a sa propre table `<module>_shares` avec colonnes `resource_id, shared_by, shared_with, permission, allow_reshare, expires_at, shared_at`. Pas de table centralisee (chaque module est autonome).
2. **Agregation** : le handler `shared-with-me` dans le gateway execute 10 requetes en parallele (`tokio::join!`) vers les endpoints internes des services, unifie les resultats dans un `Vec<SharedResource>`, trie et pagine.
3. **Etat utilisateur** : table `shared_with_me_user_state` dans le gateway pour les donnees propres au destinataire (favoris, hidden, last_accessed). Jointure avec les resultats agreges.
4. **Cache** : `signapps-cache` (moka) avec cle `shared_with_me:{user_id}:{filter_hash}`, TTL 2 minutes. Invalidation via PgEventBus sur les evenements `share.*`.
5. **WebSocket** : le gateway ecoute PgEventBus `share.created`, `share.updated`, `share.revoked`, `resource.modified` et push vers les clients concernes via la connexion WebSocket existante.
6. **Frontend store** : `client/src/stores/shared-with-me-store.ts` (Zustand) avec etat : `resources[], filters, sort, groupBy, viewMode, loading, error, selectedIds[]`. Actions : `fetchResources, toggleFavorite, hideResource, unhideResource, setFilter, setSort, setGroupBy, setViewMode, selectResource, deselectAll, copyToDrive, reshare`.
7. **Route** : `client/src/app/shared-with-me/page.tsx` avec composants : `SharedResourceList`, `SharedResourceCard`, `SharedResourceFilters`, `SharedResourceSearch`, `SharedResourceDetails` (drawer), `SharedResourceActivity` (drawer), `SharedByMeView`.

### Ce qu'il ne faut PAS faire
- **Pas de table centralisee** de partages — chaque module gere ses propres partages. L'agregation est faite au moment de la lecture.
- **Pas de copie de donnees** — la vue "Shared with me" ne duplique pas les ressources. Elle reference les ressources originales via `resource_id` et `module`.
- **Pas de degradation de permission** — si le proprietaire definit "lecture seule", aucun chemin ne doit permettre l'ecriture. Le re-partage ne peut pas accorder plus de permission que l'utilisateur n'en a.
- **Pas de copier-coller** depuis les projets ci-dessus. On s'inspire des patterns, on reecrit.
- **Pas de dependance GPL/AGPL** — Nextcloud et ownCloud sont des references pedagogiques uniquement.
- **Pas de N+1 queries** — les requetes vers les tables de partage doivent etre batch, pas une par ressource.
- **Pas de chargement complet** — toujours paginer, meme si l'utilisateur a 10 000 partages.
- **Pas de blocage sur un service down** — si un module ne repond pas (timeout 3s), les resultats des autres modules sont retournes. L'utilisateur est informe du service indisponible.

---

## Assertions E2E cles (a tester)

- Navigation vers `/shared-with-me` → le titre "Shared with me" et la description s'affichent
- Compteur total → affiche le nombre d'elements partages "(142 items)"
- Etat vide → message "Nothing shared with you yet" avec illustration si aucun partage
- Etat erreur → si le backend retourne 500, message d'erreur explicite avec bouton Retry
- Service partiel down → les resultats des modules fonctionnels s'affichent, bandeau d'avertissement pour le service down
- Un fichier partage par un autre utilisateur → l'element apparait dans la liste avec nom, proprietaire, date, permission
- Le nom est gras si l'element n'a jamais ete ouvert (badge "New")
- Filtre "All types" → tous les types de ressources s'affichent
- Filtre par type "Files" → seuls les fichiers Drive s'affichent
- Filtre par type multi-select "Files + Documents" → les deux types s'affichent
- Filtre par proprietaire → seuls les elements partages par cet utilisateur s'affichent
- Filtre par date range "Last 7 days" → seuls les partages recents s'affichent
- Filtre par permission "Read only" → seuls les partages en lecture s'affichent
- Bouton "Clear filters" → reset tous les filtres, tous les elements apparaissent
- Recherche par nom → les resultats filtres s'affichent avec highlighting jaune
- Recherche par nom du proprietaire → les resultats s'affichent
- Raccourci `Ctrl+K` → focus la barre de recherche
- Tri par date de partage (newest) → les elements sont ordonnes du plus recent au plus ancien
- Tri par nom A-Z → les elements sont ordonnes alphabetiquement
- Clic sur l'en-tete de colonne en mode liste → alterne le tri
- Groupement par proprietaire → sections avec header avatar + nom + compteur
- Groupement par type → sections Files, Documents, etc.
- Groupement par date → sections Today, This week, etc.
- Toggle vue liste / vue grille → l'affichage change, preference persistante dans localStorage
- Vue grille → cartes avec icone/thumbnail, nom, proprietaire, date
- Hover sur une carte grille (500ms) → preview agrandie du contenu
- Clic (liste) ou double-clic (grille) sur un document → navigation vers `/docs/{id}` dans le module Docs
- Clic sur un fichier → navigation vers `/drive/file/{id}` dans le module Drive
- Badge "New" disparait apres l'ouverture d'un element
- Badge "Modified" apparait quand une ressource partagee est modifiee par un autre utilisateur
- Menu contextuel (clic droit ou "...") → "Open", "Copy to my Drive", "Add to favorites", "Share details", "Hide from list" sont visibles
- "Copy to my Drive" → spinner puis toast de confirmation, le fichier apparait dans le Drive personnel
- "Copy to my Drive" sur une tache → bouton grise (non applicable)
- "Add to favorites" → l'etoile passe de contour a plein dore, l'element apparait dans la section Favorites
- "Remove from favorites" → l'etoile revient en contour gris
- "Hide from list" → l'element disparait avec fadeOut, bouton "Undo" pendant 5 secondes
- Toggle "Show hidden items" → les elements masques reapparaissent en grise
- "Unhide" sur un element masque → il revient dans la liste normale
- "Share details" → panneau lateral avec proprietaire, permission, date, autres destinataires, historique
- "Re-share" (si autorise) → dialogue de partage s'ouvre, destinataire recoit le partage
- "Re-share" (si interdit) → bouton grise avec tooltip "Owner has disabled re-sharing"
- "Copy link" → URL copiee dans le presse-papier, toast de confirmation
- Nouveau partage recu en temps reel → l'element apparait en haut de la liste sans rafraichissement, animation slideDown
- Notification toast de nouveau partage → "Alice shared 'fichier.pdf' with you" avec boutons Open/Dismiss
- Badge sidebar → incremente quand un nouveau partage arrive, decremente apres visite de la page
- Revocation de partage → l'element disparait en temps reel de la liste, toast de notification
- Modification de ressource → badge "Modified" apparait en temps reel
- Selection multiple (Ctrl+clic) → barre d'actions groupees "Copy (N)", "Favorite (N)", "Hide (N)"
- Selection Shift+clic → selectionne la plage
- Ctrl+A → selectionne tous les elements visibles
- Scroll infini → les elements suivants se chargent au scroll, compteur "Showing X of Y items" mis a jour
- Bouton "Back to top" → apparait apres 500px de scroll, smooth scroll vers le haut
- Sidebar → entree "Shared with me" avec badge numerique orange des nouveaux partages
- Widget Dashboard → les 5 derniers partages apparaissent dans le widget "Recent shares"
- Recherche globale → les ressources partagees apparaissent avec badge "Shared"
- Onglet "Shared by me" → liste des ressources partagees par l'utilisateur avec destinataires, permission, statut
- "Revoke" sur un partage emis → le destinataire perd l'acces immediatement
- "Change permission" sur un partage emis → la permission est modifiee, notification au destinataire
- "View access stats" → panneau avec nombre d'ouvertures, dernier acces, historique
- Permission lecture seule → les actions d'edition sont desactivees dans le module cible
- Preferences de notification → toggle email/push par type d'evenement
