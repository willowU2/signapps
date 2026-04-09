# Module Corbeille globale (Trash) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Google Drive Trash** | Corbeille unifiee pour tous les fichiers Drive, tri par date de suppression, restauration en un clic dans l'emplacement d'origine, purge auto apres 30 jours, bouton "Vider la corbeille" avec confirmation, recherche dans la corbeille, apercu du fichier sans restauration, indication du proprietaire pour les fichiers partages |
| **Microsoft 365 Recycle Bin** | Deux niveaux de corbeille (site + collection de sites), retention configurable (93 jours par defaut), restauration dans l'emplacement d'origine, filtrage par type de fichier, tri par taille/date/type, corbeille par site SharePoint, quota de corbeille (secondaire = 100% du site), admin purge |
| **macOS Trash** | Corbeille unifiee cross-volume, Put Back restaure dans le dossier d'origine, Secure Empty Trash (ecriture zeros), indicateur visuel (icone corbeille pleine/vide), raccourci clavier Cmd+Delete, Quick Look dans la corbeille, tri et recherche Spotlight |
| **Notion Trash** | Corbeille par workspace, arborescence preservee (pages + sous-pages supprimees ensemble), restauration hierarchique, recherche dans la corbeille, filtre par type (page, database, template), purge individuelle ou globale, retention illimitee (pas d'auto-purge) |
| **Nextcloud Trash** | Corbeille par utilisateur dans Files, retention configurable, restauration dans le chemin d'origine, affichage du chemin d'origine dans la liste, quota de corbeille (50% du quota utilisateur par defaut), API OCS pour la gestion programmatique, auto-purge configurable |
| **Dropbox Deleted Files** | Historique de 30 jours (gratuit) a 180 jours (business), restauration de fichiers et dossiers, recovery d'evenements (restauration en masse a un point dans le temps), filtrage par date, recherche, preview, partage des fichiers supprimes |
| **SharePoint Recycle Bin** | Corbeille premier niveau (utilisateur, 93 jours) + second niveau (admin, 93 jours apres premier niveau), restauration preservant les permissions et metadonnees, filtrage par type et date, tri multi-colonnes, selection en masse |
| **GitLab Waste Bin** | Corbeille pour projets, groupes et snippets, retention configurable (7 jours par defaut), restauration par l'admin ou le proprietaire, indication du temps restant avant purge, audit log des suppressions et restaurations |

## Principes directeurs

1. **Unification cross-module** — la corbeille agrege les elements supprimes de tous les modules SignApps (Documents, Drive, Mail, Calendar, Contacts, Tasks, Forms, Chat). Un point d'entree unique evite de chercher dans chaque module individuellement.
2. **Restauration fidele** — restaurer un element le remet exactement a son emplacement d'origine avec ses metadonnees, permissions et liens intacts. Si l'emplacement d'origine n'existe plus, l'element est place dans un dossier par defaut du module.
3. **Retention predictible** — chaque element a une date d'expiration visible. L'auto-purge est configurable par l'admin (defaut : 30 jours). L'utilisateur voit le temps restant avant suppression definitive.
4. **Actions en masse** — selection multiple (checkboxes), restauration en masse, suppression definitive en masse, vidage complet de la corbeille. Toutes les actions destructives requierent une confirmation explicite.
5. **Tracabilite** — chaque suppression et restauration est loguee dans l'audit trail avec : qui, quand, quoi, depuis quel module. L'admin peut consulter l'historique complet.
6. **Performance a grande echelle** — la corbeille doit supporter des milliers d'elements sans degradation. Pagination cote serveur, recherche indexee, chargement lazy des aperçus.

---

## Categorie 1 — Vue principale de la corbeille (/trash)

### 1.1 En-tete de page
Icone Trash2 suivie du titre `Corbeille` en gras. Sous-titre : `Elements supprimes dans tous les modules — restaurez ou purgez`. Statistiques affichees en badges : nombre total d'items et taille totale occupee.

### 1.2 Bouton Vider la corbeille
Bouton `Empty Trash` (variant destructive, rouge) en haut a droite. Desactive si la corbeille est vide. Clic ouvre un AlertDialog de confirmation avec icone AlertTriangle : `Empty Trash? — This will permanently delete all N items (X MB) from trash. This action cannot be undone.`. Boutons `Annuler` et `Empty Trash`.

### 1.3 Barre de recherche
Champ de recherche avec icone loupe, placeholder `Rechercher...`. Filtre les elements par nom de fichier, type, emplacement d'origine. Le filtre declenche un re-fetch cote serveur (la recherche est passee a l'API).

### 1.4 Filtrage par module
Onglets ou badges de filtre par type d'entite : `Tout`, `Document`, `Fichier`, `Email`, `Evenement`, `Contact`, `Tache`, `Formulaire`, `Message`. Chaque filtre affiche son compteur (ex: `Fichier (12)`). Le filtre `Tout` montre la somme avec le compteur total (ex: `Tout (47)`).

### 1.5 Etat vide
Quand la corbeille est vide : icone Trash2 opacifiee (opacity-50) centree, texte `La corbeille est vide` en dessous, sous-texte `Les elements supprimes apparaitront ici pendant 30 jours`.

---

## Categorie 2 — Liste des elements supprimes

### 2.1 Tableau avec colonnes
La liste est affichee dans un Card contenant un tableau a 6 colonnes :
- **Checkbox** : selection individuelle (col-span-1)
- **Nom** : icone de type + nom du fichier/element, truncate si trop long (col-span-4)
- **Emplacement d'origine** : bucket/key ou module/path d'origine, truncate (col-span-2)
- **Taille** : formatee en B/KB/MB/GB (col-span-2)
- **Supprime le** : date et heure de suppression avec icone Clock (col-span-2)
- **Expiration** : badge avec nombre de jours restants (col-span-1). Badge destructive (rouge) si <= 7 jours. Badge secondary sinon. `Expiring` si <= 0 jours.

### 2.2 Icones par type de contenu
L'icone depend du content_type et du nom de fichier :
- Images (png, jpg, gif, webp) → FileImage (vert)
- Archives (zip, tar, gz, rar) → FileArchive (jaune)
- PDF → FileText (rouge)
- Dossiers → Folder (bleu)
- Autres → File (muted)
Pour la corbeille unifiee cross-module, les icones sont des emojis par type d'entite : document (📄), drive_node (📁), mail_message (✉️), calendar_event (📅), contact (👤), task (✅), form_response (📝), chat_message (💬).

### 2.3 Selection multiple
Checkbox en en-tete de tableau pour tout selectionner/deselectionner. Checkboxes individuelles par ligne. Le compteur de selection apparait dans la barre d'actions (ex: `3 item(s) selected`).

### 2.4 Hover et interaction
Chaque ligne est surlignee au hover (`hover:bg-muted/50`). Pas de clic sur la ligne entiere (les actions sont via les boutons de la barre d'actions).

### 2.5 Tri
Les colonnes Nom, Taille, Date de suppression et Expiration sont triables. Tri par defaut : date de suppression decroissante (les plus recents en premier). Clic sur l'en-tete de colonne alterne ascendant/descendant.

### 2.6 Pagination
Si la corbeille contient plus de 50 elements, pagination cote serveur. Boutons `Precedent` / `Suivant` avec indicateur de page. La pagination preserve le filtre et la recherche actifs.

---

## Categorie 3 — Actions sur les elements

### 3.1 Barre d'actions contextuelles
Quand au moins un element est selectionne, une Card surlignee (border-primary) apparait avec :
- Texte `N item(s) selected`
- Bouton `Restore` (variant outline, icone RotateCcw) — restaure les elements selectionnes
- Bouton `Delete Permanently` (variant destructive, icone Trash2) — supprime definitivement

### 3.2 Restauration
Appel a `trashApi.restore(ids)` ou `POST /trash/:id/restore`. L'API retourne `{ restored: string[], failed: string[] }`. Toast de succes avec le nombre d'elements restaures. Toast d'erreur si certains echouent. La liste se rafraichit automatiquement. L'element restaure retrouve son emplacement d'origine dans le module source.

### 3.3 Suppression definitive
Appel a `trashApi.empty(ids)` ou `DELETE /trash/:id`. La suppression est irreversible. Toast de confirmation. La liste et les statistiques se rafraichissent.

### 3.4 Vidage complet de la corbeille
Appel a `trashApi.empty()` (sans IDs) ou `DELETE /trash`. Supprime tous les elements de la corbeille de l'utilisateur. Confirmation modale obligatoire avec rappel du nombre d'items et de la taille totale.

### 3.5 Feedback pendant les operations
Pendant restauration ou suppression, les boutons affichent un spinner (`SpinnerInfinity`) a la place de l'icone. Les boutons sont desactives pendant l'operation. Les toasts confirment le succes ou signalent l'echec.

---

## Categorie 4 — Corbeille unifiee cross-module

### 4.1 Sources de suppression
La corbeille agrege les elements supprimes depuis :
- **Drive/Storage** : fichiers et dossiers supprimes (via signapps-storage trash API)
- **Docs** : documents supprimes
- **Mail** : emails supprimes (pas les emails en corbeille IMAP, uniquement les purges definitives)
- **Calendar** : evenements supprimes
- **Contacts** : fiches contact supprimees
- **Tasks** : taches supprimees
- **Forms** : reponses de formulaire supprimees
- **Chat** : messages supprimes (selon la politique de retention)

### 4.2 Deux implementations complementaires
Le systeme a deux vues de corbeille qui coexistent :
- `/trash` — corbeille unifiee cross-module (composant `UnifiedTrash`), fetche depuis `GET /trash` du service identity
- `/storage/trash` — corbeille specifique aux fichiers Drive (composant dedie), fetche depuis `trashApi.list()` du service storage

### 4.3 Modele de donnees unifie
Chaque element de la corbeille unifiee a la structure :
```
SuppriméItem {
  id: string,              // UUID unique dans la corbeille
  entity_type: string,     // "document", "drive_node", "mail_message", "calendar_event", "contact", "task", "form_response", "chat_message"
  entity_id: string,       // ID original de l'entite dans son module source
  entity_title: string,    // Titre/nom affiche a l'utilisateur
  deleted_by: string,      // User ID de celui qui a supprime
  deleted_at: string,      // ISO 8601 date de suppression
  expires_at?: string,     // ISO 8601 date d'expiration auto-purge
}
```

### 4.4 Modele de donnees fichiers (storage trash)
Les fichiers Drive ont un modele enrichi :
```
TrashItem {
  id: string,
  filename: string,
  content_type: string,
  size: number,            // taille en octets
  original_bucket: string, // bucket d'origine
  original_key: string,    // chemin d'origine
  deleted_at: string,
  expires_at: string,
}
```

### 4.5 Statistiques
L'API `trashApi.stats()` retourne :
```
TrashStats {
  total_items: number,     // nombre total d'elements
  total_size: number,      // taille totale en octets
}
```
Affiche dans le header sous forme de badges : `N items` et `X MB`.

---

## Categorie 5 — Retention et auto-purge

### 5.1 Politique de retention par defaut
Les elements supprimes sont conserves 30 jours avant purge automatique. La duree est configurable par l'admin dans les parametres systeme (minimum 1 jour, maximum 365 jours, ou illimite).

### 5.2 Calcul de l'expiration
A la suppression, `expires_at = deleted_at + retention_duration`. Le calcul est fait cote serveur au moment de la mise en corbeille. Le frontend affiche le nombre de jours restants : `daysLeft = ceil((expires_at - now) / 86400000)`.

### 5.3 Indicateur d'urgence
Si un element expire dans 7 jours ou moins, le badge d'expiration passe en rouge (variant `destructive`). Si l'element est en cours d'expiration (0 jours), le badge affiche `Expiring`.

### 5.4 Job de purge automatique
Un job CRON cote serveur (signapps-calendar CRON scheduler ou PostgreSQL pg_cron) execute la purge des elements expires. Frequence : quotidienne a 3h du matin (configurable). Le job supprime les fichiers physiques (via signapps-storage) et les enregistrements en base.

### 5.5 Retention differenciee par module
L'admin peut configurer des durees de retention differentes par type d'entite. Exemple : emails 7 jours, documents 30 jours, fichiers Drive 60 jours. Les politiques par module prennent precedence sur la politique globale.

### 5.6 Quota de corbeille
La corbeille peut avoir un quota maximal (ex: 10% du quota de stockage de l'utilisateur). Si le quota est depasse, les elements les plus anciens sont purges automatiquement pour liberer de l'espace, meme si leur retention n'est pas expiree.

---

## Categorie 6 — API backend

### 6.1 Endpoints corbeille unifiee (signapps-identity)
- `GET /trash` — Liste les elements supprimes de l'utilisateur authentifie. Parametres query : `entity_type` (filtre par module), `search` (recherche par titre).
- `POST /trash/:id/restore` — Restaure un element. Renvoie l'element au module source via PgEventBus. Retourne 200 si succes, 404 si l'element n'existe plus, 409 si l'emplacement d'origine est en conflit.
- `DELETE /trash/:id` — Suppression definitive d'un element. Envoie un event au module source pour purger les donnees physiques.
- `DELETE /trash` — Vider toute la corbeille de l'utilisateur.

### 6.2 Endpoints corbeille storage (signapps-storage)
- `GET /api/v1/trash` — Liste les fichiers supprimes. Parametres : `bucket` (optionnel), `search` (optionnel).
- `POST /api/v1/trash/restore` — Restauration en masse. Body : `{ ids: string[] }`. Retourne `{ restored: string[], failed: string[] }`.
- `DELETE /api/v1/trash` — Purge. Body optionnel : `{ ids: string[] }` (si absent, purge tout).
- `GET /api/v1/trash/stats` — Statistiques : `{ total_items, total_size }`.

### 6.3 PgEventBus events
- `trash.item_deleted` — emis quand un element est mis en corbeille par n'importe quel module. Le service identity l'ecoute et ajoute l'entree dans la table `trash_items`.
- `trash.item_restored` — emis quand un element est restaure. Le module source l'ecoute et reactive l'entite.
- `trash.item_purged` — emis quand un element est purge definitivement. Le module source l'ecoute et supprime les donnees physiques.

### 6.4 Schema PostgreSQL
```sql
CREATE TABLE trash_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  entity_type TEXT NOT NULL,         -- "document", "drive_node", etc.
  entity_id UUID NOT NULL,           -- ID dans le module source
  entity_title TEXT NOT NULL,
  entity_metadata JSONB DEFAULT '{}', -- metadonnees specifiques au module
  deleted_by UUID NOT NULL REFERENCES users(id),
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE(entity_type, entity_id)     -- un element ne peut etre en corbeille qu'une fois
);

CREATE INDEX idx_trash_user_id ON trash_items(user_id);
CREATE INDEX idx_trash_entity_type ON trash_items(entity_type);
CREATE INDEX idx_trash_expires_at ON trash_items(expires_at);
CREATE INDEX idx_trash_deleted_at ON trash_items(deleted_at DESC);
```

---

## Categorie 7 — Securite et gouvernance

### 7.1 Isolation par utilisateur
Chaque utilisateur ne voit que les elements qu'il a lui-meme supprimes ou ceux dont il est proprietaire. Les admins peuvent voir la corbeille de tous les utilisateurs via le panneau d'administration.

### 7.2 Permissions de restauration
Seul le proprietaire de l'element ou un admin peut restaurer. Si l'element a ete supprime par un admin (purge forcee), l'utilisateur ne peut pas le restaurer.

### 7.3 Suppression definitive et RGPD
La purge definitive efface toutes les donnees : fichier physique, metadonnees, index de recherche, vecteurs d'embedding. C'est l'implementation du "droit a l'effacement" (Article 17 RGPD). Un certificat de destruction est genere pour les donnees sensibles.

### 7.4 Audit trail complet
Chaque action sur la corbeille est loguee :
- Suppression (mise en corbeille) : `trash.soft_delete` avec entity_type, entity_id, user_id
- Restauration : `trash.restore` avec entity_type, entity_id, user_id
- Purge definitive : `trash.hard_delete` avec entity_type, entity_id, user_id
- Vidage corbeille : `trash.empty_all` avec user_id, count
L'audit est consultable dans le module Administration > Audit.

### 7.5 Protection contre la suppression accidentelle
Les modules critiques (ex: documents avec des signatures, factures validees) peuvent marquer un element comme non-supprimable. La tentative de suppression affiche un message explicatif. Seul un admin peut forcer la suppression.

### 7.6 Admin bulk purge
L'admin peut purger la corbeille de tous les utilisateurs en une action (maintenance). Un job asynchrone est lance avec reporting du nombre d'elements purges et de l'espace libere.

---

## Categorie 8 — Integration avec les modules

### 8.1 Soft-delete dans chaque module
Chaque module implemente le pattern soft-delete : au lieu de `DELETE FROM table`, les lignes sont marquees avec `deleted_at = now()` et un event `trash.item_deleted` est emis sur le PgEventBus. Les queries normales excluent les lignes avec `deleted_at IS NOT NULL`.

### 8.2 Drive / Storage
Les fichiers supprimes dans Drive sont deplaces dans un bucket `_trash` de signapps-storage. Le fichier physique est conserve jusqu'a la purge. La corbeille specifique Drive (`/storage/trash`) permet la gestion fine avec taille, type MIME et apercu.

### 8.3 Docs
Les documents supprimes sont soft-deleted en base. Le contenu CRDT (Yjs) est conserve. La restauration reouvre le document dans son etat exact au moment de la suppression. L'historique de versions est preserve.

### 8.4 Mail
Les emails supprimes du dossier Corbeille IMAP sont marques pour purge. La corbeille globale ne montre que les emails purges definitivement du dossier IMAP Trash (pas les emails simplement deplaces vers le dossier Corbeille IMAP, qui est gere par le module Mail).

### 8.5 Calendar
Les evenements supprimes sont soft-deleted. Les evenements recurrents supprimes sont geres individuellement (suppression d'une occurrence) ou globalement (suppression de la serie). La restauration restaure les participants et les rappels.

### 8.6 Contacts
Les fiches contact supprimees sont soft-deleted. Les liens avec d'autres entites (deals CRM, emails) sont preserves mais inactifs. La restauration reactive tous les liens.

### 8.7 Tasks
Les taches supprimees sont soft-deleted avec leurs sous-taches, commentaires et pieces jointes. La restauration replace la tache dans son projet et sa colonne Kanban d'origine.

### 8.8 Crosslinks et interdependances
Si un element en corbeille est reference par un autre element actif (ex: un fichier Drive lie a un document Docs), un avertissement est affiche avant la purge definitive. La purge ne casse pas les references — elle les marque comme "lien brise".

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Google Drive Help — Trash** (support.google.com/drive/answer/2375102) — fonctionnement de la corbeille, retention 30 jours, restauration.
- **Microsoft 365 — Recycle Bin** (support.microsoft.com/recycle-bin) — deux niveaux de corbeille, retention, restauration.
- **Nextcloud — Deleted Files** (docs.nextcloud.com/server/latest/user_manual/files/deleted_file_management.html) — API, retention, quota.
- **SharePoint — Recycle Bin** (learn.microsoft.com/sharepoint/recycle-bin) — premier et second niveau, administration.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

## References OSS

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Minio** (github.com/minio/minio) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Pattern versioning + soft-delete object storage. |
| **OpenDAL** (github.com/apache/opendal) | **Apache-2.0** | Deja utilise dans signapps-storage. Abstraction multi-backend (fs, s3) avec support delete/list. Pattern trash bucket pour les fichiers supprimes. |
| **sqlx** (github.com/launchbadge/sqlx) | **MIT / Apache-2.0** | Deja utilise. Pattern soft-delete avec `deleted_at` column, filtered queries, index strategies. |
| **pg_cron** (github.com/citusdata/pg_cron) | **PostgreSQL License** | Job scheduler PostgreSQL natif. Pattern pour le cron de purge auto des elements expires. |
| **sonner** (github.com/emilkowalski/sonner) | **MIT** | Toast notifications React. Deja utilise pour le feedback utilisateur (restauration, suppression, erreurs). |
| **shadcn/ui AlertDialog** (github.com/shadcn-ui/ui) | **MIT** | Composant de dialogue de confirmation. Pattern pour les actions destructives (vidage corbeille, suppression definitive). |
| **Supabase** (github.com/supabase/supabase) | **Apache-2.0** | Pattern soft-delete avec RLS (Row Level Security) pour l'isolation par utilisateur dans PostgreSQL. |
| **PgEventBus pattern** | **Interne** | Pattern evenementiel via PostgreSQL LISTEN/NOTIFY pour la communication inter-modules (trash.item_deleted, trash.item_restored, trash.item_purged). |

---

## Assertions E2E cles (a tester)

- Page /trash → le titre `Corbeille` est visible avec le sous-titre
- Corbeille vide → icone Trash2 opacifiee et message `La corbeille est vide`
- Suppression d'un document dans Docs → l'element apparait dans /trash avec type `Document`
- Suppression d'un fichier dans Drive → l'element apparait dans /storage/trash avec taille et type
- Filtre par type `Document` → seuls les documents supprimes sont affiches
- Filtre `Tout` → tous les elements sont affiches avec le compteur total
- Recherche par nom de fichier → les resultats sont filtres en temps reel
- Selection d'un element → la barre d'actions apparait avec `1 item(s) selected`
- Selection tout → toutes les checkboxes sont cochees
- Bouton Restore → l'element disparait de la corbeille, toast de succes
- Element restaure → il reapparait dans son module d'origine a son emplacement d'origine
- Bouton Delete Permanently → l'element est supprime definitivement, toast de succes
- Bouton Empty Trash → le dialogue de confirmation s'ouvre avec le compte et la taille
- Confirmation Empty Trash → tous les elements sont purges, la corbeille affiche l'etat vide
- Badge d'expiration <= 7 jours → badge rouge `destructive`
- Badge d'expiration > 7 jours → badge gris `secondary`
- Element expire (0 jours) → badge affiche `Expiring`
- Statistiques → badges `N items` et `X MB` affiches dans le header
- Spinner pendant restauration/suppression → les boutons sont desactives
- Utilisateur non-admin → ne voit que ses propres elements supprimes
