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

1. **Agregation cross-module** — la page "Partages avec moi" regroupe TOUTES les ressources partagees par d'autres utilisateurs, quel que soit le module source : fichiers (Drive), documents (Docs), feuilles de calcul (Spreadsheet), presentations (Slides), formulaires (Forms), taches (Tasks), calendriers (Calendar), contacts (Contacts), notes (Keep). Un seul endroit pour tout retrouver.
2. **Temps reel et notifications** — quand un utilisateur partage une ressource, le destinataire voit apparaitre l'element en temps reel (WebSocket push) avec une notification. Les modifications sur les ressources partagees sont signalees (badge "Modified" ou "New comment").
3. **Recherche et filtrage puissants** — filtrer par type de ressource, par proprietaire, par date de partage, par permission (lecture/ecriture), par module source. Recherche full-text dans les noms et descriptions des ressources partagees.
4. **Actions directes** — depuis la vue "Partages avec moi", l'utilisateur peut ouvrir, copier dans son Drive, supprimer le partage (retirer de sa vue), re-partager (si autorise), et voir les details de permission. Pas besoin de naviguer vers le module source.
5. **Organisation personnelle** — l'utilisateur peut epingler (favoris), trier, et regrouper les ressources partagees selon ses preferences. Les favoris apparaissent en premier. Les ressources non-consultees sont mises en evidence.
6. **Respect des permissions** — la vue "Partages avec moi" respecte strictement les permissions definies par le proprietaire. Lecture seule = pas de modification. Aucun re-partage si le proprietaire l'a interdit. Revocation immediate si le proprietaire retire le partage.

---

## Categorie 1 — Vue principale et navigation

### 1.1 En-tete de page
Titre "Partages avec moi" avec sous-titre descriptif "Toutes les ressources que d'autres utilisateurs ont partagees avec vous". Compteur total d'elements partages visible.

### 1.2 Barre de filtres
Barre horizontale de filtres en haut de la liste :
- **Type de ressource** (select multiple) : Tous les types, Fichiers, Documents, Feuilles de calcul, Presentations, Formulaires, Taches, Calendriers, Contacts, Notes, Dossiers
- **Proprietaire** (select avec recherche) : filtre par l'utilisateur qui a partage
- **Date de partage** (date range) : Aujourd'hui, 7 derniers jours, 30 derniers jours, Personnalise
- **Permission** (select) : Tous, Lecture seule, Lecture/ecriture, Proprietaire
- **Module source** (select) : Drive, Docs, Spreadsheet, Slides, Forms, Tasks, Calendar, Contacts, Keep
Bouton `Reset filters` pour reinitialiser tous les filtres.

### 1.3 Barre de recherche
Champ de recherche full-text : recherche dans le nom de la ressource, la description, et le nom du proprietaire. Resultats filtres en temps reel (debounce 300ms). Highlighting des termes trouves dans les resultats.

### 1.4 Modes d'affichage
Toggle entre :
- **Vue liste** (defaut) : tableau avec colonnes (nom, type, proprietaire, date de partage, permission, dernier acces, taille)
- **Vue grille** : cartes avec icone/preview, nom, proprietaire, date. 4 colonnes sur desktop, 2 sur tablette, 1 sur mobile.
Preference persistante dans le localStorage.

### 1.5 Tri
Options de tri : par nom (A-Z / Z-A), par date de partage (recent d'abord / ancien d'abord), par dernier acces (recent d'abord), par type de ressource, par proprietaire. Le tri actif est indique visuellement (fleche dans l'en-tete de colonne en mode liste).

### 1.6 Groupement
Regroupement optionnel des ressources :
- Par proprietaire (sections avec le nom de l'utilisateur)
- Par type (sections : Fichiers, Documents, etc.)
- Par date de partage (Aujourd'hui, Cette semaine, Ce mois, Plus ancien)
- Aucun (liste plate)

### 1.7 Pagination et scroll infini
Chargement initial de 50 elements. Scroll infini pour charger les suivants (par pages de 50). Indicateur de chargement en bas. Compteur "Affichage de X sur Y elements".

### 1.8 Etat vide
Si aucune ressource partagee : illustration (icone de partage), message "Aucune ressource partagee avec vous pour le moment", description "Quand quelqu'un partagera un fichier, un document ou une autre ressource avec vous, elle apparaitra ici".

### 1.9 Etat d'erreur
Si le backend n'est pas disponible (HTTP 404, 500, etc.) : message d'erreur explicite "Impossible de charger les partages" avec bouton `Retry`. Pas d'ecran blanc — toujours un feedback utilisateur.

---

## Categorie 2 — Carte de ressource partagee

### 2.1 Informations affichees par element
Chaque ressource partagee affiche :
- **Icone de type** : icone specifique au module (fichier, document, spreadsheet, slides, form, task, calendar, contact, note, folder)
- **Nom** de la ressource (avec extension pour les fichiers)
- **Proprietaire** : avatar + nom de l'utilisateur qui a partage
- **Date de partage** : format relatif ("il y a 2 heures", "hier", "12 mars 2026")
- **Permission** : badge "Lecture" (gris) ou "Edition" (bleu)
- **Module source** : badge discret indiquant le module (Drive, Docs, etc.)
- **Indicateur d'activite** : badge "Nouveau" (orange) si jamais ouvert, "Modifie" (bleu) si modifie depuis le dernier acces

### 2.2 Preview inline
Pour les fichiers images : miniature dans la carte grille. Pour les documents/spreadsheets : apercu des premieres lignes. Pour les taches : statut (open/in_progress/done) et assignees. Pour les contacts : avatar, nom, email.

### 2.3 Menu contextuel (clic droit ou bouton ...)
Actions disponibles par element :
- **Ouvrir** → navigation vers la ressource dans son module natif
- **Ouvrir dans un nouvel onglet** → meme chose, nouvel onglet
- **Copier dans mon Drive** → copie le fichier/document dans le Drive personnel de l'utilisateur
- **Ajouter aux favoris** → epingle l'element en haut de la liste
- **Retirer des favoris** → supprime l'epingle
- **Retirer de ma vue** → cache l'element (ne supprime pas le partage, juste la visibilite). Reversible via un filtre "Elements caches".
- **Details du partage** → panneau lateral avec : proprietaire, date de partage, permission, autres destinataires du partage, historique de modifications
- **Re-partager** → partager a son tour avec d'autres utilisateurs (si autorise par le proprietaire)
- **Copier le lien** → copie l'URL directe vers la ressource

### 2.4 Double-clic
Double-clic sur un element l'ouvre directement dans son module natif (meme comportement que "Ouvrir").

### 2.5 Selection multiple
Checkbox sur chaque element (ou selection avec Ctrl+clic / Shift+clic). Barre d'actions groupees : "Copier dans mon Drive (N)", "Retirer de ma vue (N)", "Ajouter aux favoris (N)".

---

## Categorie 3 — Agregation cross-module (backend)

### 3.1 API d'agregation
Endpoint unique `GET /api/v1/shared-with-me` qui interroge tous les modules et retourne une liste unifiee. Parametres :
- `type` (optionnel) : filtre par type de ressource
- `owner_id` (optionnel) : filtre par proprietaire
- `since` (optionnel) : date minimale de partage
- `permission` (optionnel) : read, write
- `search` (optionnel) : recherche full-text
- `sort` (optionnel) : shared_at, name, last_accessed, type
- `order` (optionnel) : asc, desc
- `page`, `per_page` : pagination

### 3.2 Sources de donnees
L'API agrege les partages depuis les tables de chaque module :
- `drive_shares` → fichiers et dossiers partages (module Drive)
- `document_shares` → documents Tiptap (module Docs)
- `spreadsheet_shares` → feuilles de calcul (module Spreadsheet)
- `presentation_shares` → presentations (module Slides)
- `form_shares` → formulaires (module Forms)
- `task_shares` → taches et projets (module Tasks)
- `calendar_shares` → calendriers et evenements (module Calendar)
- `contact_shares` → contacts et groupes (module Contacts)
- `note_shares` → notes (module Keep)

### 3.3 Schema unifie
Chaque element retourne un objet normalise :

```
SharedResource {
  id: UUID,
  resource_id: UUID,          // ID de la ressource dans son module
  resource_type: String,      // "file", "document", "spreadsheet", "presentation", "form", "task", "calendar", "contact", "note", "folder"
  module: String,             // "drive", "docs", "spreadsheet", "slides", "forms", "tasks", "calendar", "contacts", "keep"
  name: String,               // Nom affiche
  description: Option<String>,
  owner_id: UUID,
  owner_name: String,
  owner_avatar: Option<String>,
  permission: String,         // "read", "write", "admin"
  shared_at: DateTime,
  last_accessed: Option<DateTime>,
  last_modified: Option<DateTime>,
  size: Option<i64>,          // Taille en bytes (fichiers)
  mime_type: Option<String>,  // Type MIME (fichiers)
  thumbnail_url: Option<String>,
  is_favorited: bool,
  is_hidden: bool,
  is_new: bool,               // Jamais ouvert par le destinataire
  is_modified: bool,          // Modifie depuis le dernier acces
  url: String,                // URL directe vers la ressource
}
```

### 3.4 Performance et cache
L'agregation de N modules peut etre couteuse. Strategies d'optimisation :
- **Cache applicatif** (signapps-cache, moka) : cache de 5 minutes par utilisateur. Invalidation sur evenement de partage (PgEventBus).
- **Requetes paralleles** : les N requetes vers les tables de partage s'executent en parallele (tokio::join!).
- **Vue materialisee** (optionnel) : si les performances ne suffisent pas, creer une vue materialisee `shared_resources_mv` rafraichie toutes les minutes.

### 3.5 Evenements temps reel
Quand un partage est cree, modifie ou revoque dans n'importe quel module :
1. Le module emet un evenement `share.created` / `share.updated` / `share.revoked` sur le PgEventBus
2. Le service gateway ecoute ces evenements et notifie les clients concernes via WebSocket
3. Le frontend met a jour la liste en temps reel (ajout, modification, suppression de l'element)

### 3.6 Gestion des ressources supprimees
Si une ressource partagee est supprimee par le proprietaire :
- L'element disparait de la vue "Partages avec moi"
- Si l'utilisateur tente d'acceder a une URL directe vers une ressource supprimee : message "Cette ressource n'est plus disponible"
- Nettoyage periodique des references orphelines (cron quotidien)

---

## Categorie 4 — Notifications et activite

### 4.1 Notification de nouveau partage
Quand un utilisateur recoit un nouveau partage :
- Notification push via le module Notifications (toast in-app + badge sur l'icone Partages dans la sidebar)
- Contenu : "Alice a partage 'Budget Q1.xlsx' avec vous" avec lien direct
- Actions dans la notification : "Ouvrir" et "Ignorer"

### 4.2 Notification de modification
Quand une ressource partagee est modifiee par un autre utilisateur :
- Badge "Modifie" sur l'element dans la liste
- Notification optionnelle (configurable par l'utilisateur) : "Alice a modifie 'Budget Q1.xlsx'"

### 4.3 Notification de revocation
Quand un partage est revoque :
- Notification : "Alice a revoque votre acces a 'Budget Q1.xlsx'"
- L'element disparait de la liste
- Si l'utilisateur a une copie locale (copie dans son Drive), elle reste intacte

### 4.4 Preferences de notification
L'utilisateur peut configurer les notifications de partage :
- Nouveau partage : toujours / jamais / uniquement si mentionne
- Modification : toujours / uniquement favoris / jamais
- Revocation : toujours / jamais
Canaux : in-app (toujours), email (configurable), push mobile (configurable).

### 4.5 Historique d'activite
Panneau "Activite recente" (optionnel, accessible via bouton) montrant les derniers evenements sur les ressources partagees : nouveau partage, modification, commentaire, renommage, deplacement. Timeline chronologique avec avatar et description.

---

## Categorie 5 — Actions sur les partages

### 5.1 Ouvrir une ressource
Clic sur un element → navigation vers la page de la ressource dans son module natif :
- Fichier Drive → `/drive/file/{id}` (download ou preview)
- Document Docs → `/docs/{id}` (editeur Tiptap)
- Spreadsheet → `/spreadsheet/{id}` (editeur tableur)
- Presentation → `/slides/{id}` (editeur diapositives)
- Formulaire → `/forms/{id}` (formulaire ou resultats selon permission)
- Tache → `/tasks/{id}` (detail de la tache)
- Calendrier → `/calendar?view={id}` (vue calendrier)
- Contact → `/contacts/{id}` (fiche contact)
- Note → `/keep/{id}` (editeur de note)
Le dernier acces est enregistre (pour le tri et le badge "Nouveau").

### 5.2 Copier dans mon Drive
Cree une copie de la ressource dans le Drive personnel de l'utilisateur :
- Pour les fichiers : copie physique du fichier
- Pour les documents/spreadsheets : copie du contenu (nouveau document independant)
- Le lien de partage d'origine est conserve (l'original et la copie sont independants)
Feedback : toast "Copie dans votre Drive" avec lien vers la copie.

### 5.3 Re-partager
Si le proprietaire autorise le re-partage (`allow_reshare = true`), l'utilisateur peut partager la ressource avec d'autres :
- Dialogue de partage identique au partage natif du module
- Le destinataire voit le proprietaire original (pas le re-partageur)
- Le proprietaire est notifie du re-partage
Si le re-partage est interdit : le menu "Re-partager" est grise avec tooltip "Le proprietaire a desactive le re-partage".

### 5.4 Retirer de ma vue
L'utilisateur peut masquer un element partage sans revoquer le partage :
- L'element est marque `is_hidden = true` et disparait de la liste par defaut
- Un filtre "Afficher les elements caches" permet de les retrouver
- Bouton "Restaurer" pour annuler le masquage
Utile pour desencombrer la vue sans perdre l'acces.

### 5.5 Favoris
Epingler un element partage en favoris :
- L'element apparait en premier dans la liste (section "Favoris" en haut)
- Badge etoile visible sur l'element
- Synchronise avec les favoris globaux (si l'element est aussi epingle dans Drive, c'est le meme favori)

### 5.6 Details du partage
Panneau lateral (drawer) affichant les details complets :
- Proprietaire : avatar, nom, email
- Date de partage
- Permission : lecture / ecriture / admin
- Autres destinataires du meme partage (si visible par l'utilisateur)
- Historique : date de creation du partage, modifications de permission, derniers acces
- Lien direct (copiable)
- Taille et type (pour les fichiers)

---

## Categorie 6 — Integration avec la sidebar et les autres modules

### 6.1 Entree dans la sidebar
Dans la sidebar principale de l'application, entree "Partages avec moi" avec :
- Icone de partage (share/people)
- Badge numerique indiquant le nombre de nouveaux partages non-consultes
- Position : sous "Mon Drive" et avant "Corbeille" dans la section Drive

### 6.2 Widget dans le Dashboard
Le Dashboard principal (/dashboard) affiche un widget "Partages recents" avec les 5 derniers elements partages. Lien "Voir tout" vers `/shared-with-me`.

### 6.3 Integration Drive
Dans le module Drive, la sidebar inclut "Partages avec moi" comme vue speciale. Les fichiers partages peuvent etre ajoutes dans l'arborescence du Drive de l'utilisateur (raccourci/shortcut, pas copie).

### 6.4 Integration recherche globale
La recherche globale (module Search, `/search`) inclut les ressources partagees dans les resultats. Badge "Partage" pour les differencier des ressources personnelles. Le score de pertinence tient compte de la date de partage et de la frequence d'acces.

### 6.5 Integration notifications
Le module Notifications affiche les notifications de partage dans le centre de notifications global. Clic sur la notification → navigation directe vers la ressource.

### 6.6 Partages emis ("Shared by me")
Lien ou onglet secondaire "Partages emis" listant les ressources que l'utilisateur a lui-meme partagees avec d'autres. Meme format de liste avec : nom, destinataires, permission, date de partage, statut (consulte/non-consulte par le destinataire). Actions : revoquer le partage, modifier la permission, voir les statistiques d'acces.

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
| **date-fns** (github.com/date-fns/date-fns) | **MIT** | Formatage de dates relatives ("il y a 2 heures", "hier"). `formatDistanceToNow`. Deja utilise dans SignApps. |
| **sqlx** (github.com/launchbadge/sqlx) | **MIT/Apache-2.0** | Requetes SQL async pour l'agregation cross-tables. `query_as` avec mapping vers `SharedResource`. Deja utilise. |
| **serde** (github.com/serde-rs/serde) | **MIT/Apache-2.0** | Serialisation/deserialisation du schema unifie `SharedResource`. Deja utilise dans tout le workspace. |

### Pattern d'implementation recommande
1. **Table de partages** : chaque module a sa propre table `<module>_shares` avec colonnes `resource_id, shared_by, shared_with, permission, shared_at, allow_reshare`. Pas de table centralisee (chaque module est autonome).
2. **Agregation** : le handler `shared-with-me` execute N requetes en parallele (`tokio::join!`) vers les tables de partage, unifie les resultats dans un `Vec<SharedResource>`, trie et pagine.
3. **Cache** : `signapps-cache` (moka) avec cle `shared_with_me:{user_id}`, TTL 5 minutes. Invalidation via PgEventBus sur les evenements `share.*`.
4. **WebSocket** : le gateway ecoute PgEventBus `share.created`, `share.updated`, `share.revoked` et push vers les clients concernes via la connexion WebSocket existante.
5. **Frontend store** : `client/src/stores/shared-with-me-store.ts` (Zustand) avec etat : `resources[], filters, sort, loading, error`. Actions : `fetchResources, toggleFavorite, hideResource, setFilter, setSort`.
6. **Route** : `client/src/app/shared-with-me/page.tsx` avec composants : `SharedResourceList`, `SharedResourceCard`, `SharedResourceFilters`, `SharedResourceDetails` (drawer).

### Ce qu'il ne faut PAS faire
- **Pas de table centralisee** de partages — chaque module gere ses propres partages. L'agregation est faite au moment de la lecture.
- **Pas de copie de donnees** — la vue "Partages avec moi" ne duplique pas les ressources. Elle reference les ressources originales via `resource_id` et `module`.
- **Pas de degradation de permission** — si le proprietaire definit "lecture seule", aucun chemin ne doit permettre l'ecriture.
- **Pas de copier-coller** depuis les projets ci-dessus. On s'inspire des patterns, on reecrit.
- **Pas de dependance GPL/AGPL** — Nextcloud et ownCloud sont des references pedagogiques uniquement.
- **Pas de N+1 queries** — les requetes vers les tables de partage doivent etre batch, pas une par ressource.
- **Pas de chargement complet** — toujours paginer, meme si l'utilisateur a 10 000 partages.

---

## Assertions E2E cles (a tester)

- Navigation vers `/shared-with-me` → le titre "Partages avec moi" et la description s'affichent
- Etat vide → message "Aucune ressource partagee" avec illustration si aucun partage
- Etat erreur → si le backend retourne 404/500, message d'erreur explicite avec bouton Retry
- Un fichier partage par un autre utilisateur → l'element apparait dans la liste avec nom, proprietaire, date, permission
- Filtre "Tous les types" → tous les types de ressources s'affichent
- Filtre par type "Fichiers" → seuls les fichiers Drive s'affichent
- Filtre par proprietaire → seuls les elements partages par cet utilisateur s'affichent
- Recherche par nom → les resultats filtres s'affichent avec highlighting
- Tri par date de partage → les elements sont ordonnes chronologiquement
- Toggle vue liste / vue grille → l'affichage change, preference persistante
- Double-clic sur un document → navigation vers `/docs/{id}` dans le module Docs
- Double-clic sur un fichier → navigation vers `/drive/file/{id}` dans le module Drive
- Menu contextuel → "Ouvrir", "Copier dans mon Drive", "Details du partage", "Retirer de ma vue" sont visibles
- "Copier dans mon Drive" → toast de confirmation, le fichier apparait dans le Drive personnel
- "Ajouter aux favoris" → l'element est epingle en haut de la liste avec badge etoile
- "Retirer de ma vue" → l'element disparait, reapparait avec le filtre "Elements caches"
- "Details du partage" → panneau lateral avec proprietaire, permission, date, autres destinataires
- Nouveau partage recu en temps reel → l'element apparait sans rafraichissement de page
- Notification de nouveau partage → toast in-app "Alice a partage 'fichier.pdf' avec vous"
- Revocation de partage → l'element disparait en temps reel de la liste
- Badge "Nouveau" sur un element jamais ouvert → le badge disparait apres ouverture
- Badge "Modifie" sur un element modifie depuis le dernier acces → visible dans la liste
- Selection multiple (Ctrl+clic) → barre d'actions groupees "Copier (N)", "Retirer (N)"
- Scroll infini → les elements suivants se chargent au scroll, compteur "X sur Y" mis a jour
- Sidebar → entree "Partages avec moi" avec badge numerique des nouveaux partages
- Re-partager un element (si autorise) → le dialogue de partage s'ouvre
- Re-partager un element (si interdit) → le bouton est grise avec tooltip explicatif
- Permission lecture seule → les actions d'edition sont desactivees dans le module cible
