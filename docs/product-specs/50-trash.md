# Module Corbeille globale (Trash) -- Specification fonctionnelle

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

1. **Unification cross-module** -- la corbeille agrege les elements supprimes de tous les modules SignApps (Documents, Drive, Mail, Calendar, Contacts, Tasks, Forms, Chat). Un point d'entree unique evite de chercher dans chaque module individuellement.
2. **Restauration fidele** -- restaurer un element le remet exactement a son emplacement d'origine avec ses metadonnees, permissions et liens intacts. Si l'emplacement d'origine n'existe plus, l'element est place dans un dossier par defaut du module.
3. **Retention predictible** -- chaque element a une date d'expiration visible. L'auto-purge est configurable par l'admin (defaut : 30 jours). L'utilisateur voit le temps restant avant suppression definitive.
4. **Actions en masse** -- selection multiple (checkboxes), restauration en masse, suppression definitive en masse, vidage complet de la corbeille. Toutes les actions destructives requierent une confirmation explicite.
5. **Tracabilite** -- chaque suppression et restauration est loguee dans l'audit trail avec : qui, quand, quoi, depuis quel module. L'admin peut consulter l'historique complet.
6. **Performance a grande echelle** -- la corbeille doit supporter des milliers d'elements sans degradation. Pagination cote serveur, recherche indexee, chargement lazy des apercus.

---

## Categorie 1 -- Vue principale de la corbeille (/trash)

### 1.1 En-tete de page
Icone Trash2 (24x24, text-muted-foreground) suivie du titre `Corbeille` en `text-3xl font-bold`. Sous-titre en `text-muted-foreground` : `Elements supprimes dans tous les modules -- restaurez ou purgez`. Statistiques affichees en Badges a droite du titre : nombre total d'items (`{count} elements`, variant `secondary`) et taille totale occupee (`{size}`, variant `secondary`, formattee en KB/MB/GB via `formatBytes()`). Les stats proviennent de `GET /api/v1/trash/stats`.

### 1.2 Bouton Vider la corbeille
Bouton `Empty Trash` (variant `destructive`, icone Trash2, 16x16) en haut a droite du header. Desactive (opacity-50, cursor-not-allowed) si la corbeille est vide (`total_items === 0`). Clic ouvre un AlertDialog de confirmation centree avec :
- Icone AlertTriangle (48x48, text-destructive) en haut
- Titre : `Empty Trash?`
- Description : `This will permanently delete all {count} items ({formattedSize}) from trash. This action cannot be undone.`
- Bouton `Annuler` (variant outline)
- Bouton `Empty Trash` (variant destructive)
Pendant l'execution : le bouton dans le dialog affiche un Spinner + `Purging...`. Le dialog reste ouvert jusqu'a completion. Succes : dialog ferme, toast vert `Corbeille videe -- {count} elements supprimes definitivement`. Echec : toast rouge avec message d'erreur.

### 1.3 Barre de recherche
Champ de recherche (Input avec icone Search) en dessous du header, placeholder `Rechercher dans la corbeille...`. La recherche filtre les elements par nom/titre. Le filtre est passe cote serveur (`GET /api/v1/trash?search={query}`) car la corbeille peut contenir des milliers d'elements. Debounce de 300ms. Pendant le fetch : spinner dans le champ de recherche. Bouton X pour effacer (visible quand le champ n'est pas vide). Le compteur de resultats est mis a jour en temps reel : `{count} resultats`.

### 1.4 Filtrage par module
Rangee de boutons pill/badge horizontaux sous la barre de recherche : `Tout`, `Document`, `Fichier`, `Email`, `Evenement`, `Contact`, `Tache`, `Formulaire`, `Message`. Chaque filtre affiche son compteur entre parentheses (ex: `Fichier (12)`). Le compteur provient de `GET /api/v1/trash/stats?by_type=true` qui retourne `{ counts: { document: 5, drive_node: 12, ... }, total: 47, total_size: 1234567 }`. Le filtre `Tout` montre le compteur total (ex: `Tout (47)`). Le bouton actif recoit le style `default` (rempli), les inactifs `outline`. Clic sur un filtre re-fetche la liste avec le parametre `entity_type`. Les filtres avec compteur 0 sont affiches mais en opacite reduite (opacity-50).

### 1.5 Tri des resultats
Un DropdownMenu `Trier par` (icone ArrowUpDown) a droite de la barre de recherche avec les options :
- `Date de suppression (recent)` -- defaut, `deleted_at DESC`
- `Date de suppression (ancien)` -- `deleted_at ASC`
- `Nom (A-Z)` -- `entity_title ASC`
- `Nom (Z-A)` -- `entity_title DESC`
- `Taille (grand)` -- `size DESC` (disponible uniquement pour les fichiers Drive)
- `Expiration (proche)` -- `expires_at ASC`
Le tri selectionne est persiste dans `useUIStore` sous `trashSortBy` et passe au backend via le query param `sort`.

### 1.6 Etat vide
Quand la corbeille est vide : icone Trash2 (64x64, opacity-50) centree verticalement dans la zone de contenu, texte `La corbeille est vide` en `text-lg font-medium` en dessous, sous-texte `Les elements supprimes apparaitront ici pendant {retention_days} jours` en `text-sm text-muted-foreground`. Le nombre de jours est dynamique (valeur admin). L'etat vide est egalement affiche quand un filtre est actif mais ne retourne aucun resultat, avec le message `Aucun element de type {type} dans la corbeille`.

---

## Categorie 2 -- Liste des elements supprimes

### 2.1 Tableau avec colonnes
La liste est affichee dans un Card (shadcn/ui) contenant un tableau a 6 colonnes :
- **Checkbox** : 32px, selection individuelle. Checkbox de Radix UI avec `onCheckedChange`.
- **Nom** : flex-1 (minimum 200px). Icone du type (20x20, couleur par type) + nom du fichier/element (`text-sm font-medium`), truncate avec tooltip si depasse.
- **Module** : 120px. Badge indiquant le module source (`Document`, `Drive`, `Mail`, `Calendar`, etc.) avec couleur par module.
- **Emplacement d'origine** : 180px. Chemin d'origine tronque (`text-sm text-muted-foreground`), tooltip avec chemin complet au hover.
- **Supprime le** : 140px. Date relative (il y a 2h, Hier, 15 mars) avec tooltip date complete au hover. Icone Clock (14x14) devant la date.
- **Expiration** : 100px. Badge avec nombre de jours restants. Badge `destructive` (rouge) si <= 7 jours. Badge `secondary` (gris) sinon. Texte `Expiring` si <= 0 jours. Texte `{days}j restants` sinon.

L'en-tete du tableau utilise `text-xs font-medium text-muted-foreground uppercase tracking-wider`. Les colonnes triables (Nom, Supprime le, Expiration) ont un bouton avec icone ArrowUpDown qui toggle le tri au clic.

### 2.2 Icones par type d'entite
L'icone depend du `entity_type` :
- `document` : FileText (couleur blue-500)
- `drive_node` (fichier) : determine par content_type dans entity_metadata :
  - Images (png, jpg, gif, webp) -> FileImage (green-500)
  - Archives (zip, tar, gz, rar) -> FileArchive (yellow-500)
  - PDF -> FileText (red-500)
  - Dossiers -> Folder (blue-500)
  - Autres -> File (muted-foreground)
- `mail_message` : Mail (purple-500)
- `calendar_event` : Calendar (orange-500)
- `contact` : User (teal-500)
- `task` : CheckSquare (emerald-500)
- `form_response` : ClipboardList (pink-500)
- `chat_message` : MessageCircle (sky-500)

### 2.3 Selection multiple
Checkbox en en-tete de tableau pour tout selectionner/deselectionner la page courante. Etat intermediaire (`indeterminate`) quand certaines lignes sont selectionnees mais pas toutes. Checkboxes individuelles par ligne. Le compteur de selection apparait dans la barre d'actions : `{count} element(s) selectionne(s)`. Raccourci clavier : `Cmd+A` (Ctrl+A) selectionne toutes les lignes de la page courante. `Escape` deselectionne tout. Si toute la page est selectionnee, un lien `Selectionner les {total} elements de la corbeille` apparait au-dessus du tableau pour etendre la selection a tous les elements (pas uniquement la page courante).

### 2.4 Hover et interaction
Chaque ligne est surlignee au hover (`hover:bg-muted/50 transition-colors`). Les lignes selectionnees ont un fond persistant `bg-primary/5`. Pas de clic sur la ligne entiere -- les actions sont via les boutons de la barre d'actions ou le menu contextuel (clic droit). Le clic droit sur une ligne ouvre un ContextMenu avec : `Restaurer` (icone RotateCcw), `Supprimer definitivement` (icone Trash2, text-destructive), `Details` (icone Info, ouvre un panneau lateral avec les metadonnees completes de l'element).

### 2.5 Pagination (cursor-based)
La pagination utilise des curseurs plutot que des offsets pour la performance sur de grandes corbeilles. Le backend retourne : `{ items: TrashItem[], next_cursor: string | null, prev_cursor: string | null, total: number }`. Le curseur est un `deleted_at` encode en base64 (cursor-based pagination sur l'index `idx_trash_deleted_at`). 50 elements par page. Boutons `Precedent` / `Suivant` (icones ChevronLeft/ChevronRight) avec indicateur `Page {page} sur {totalPages}`. Les boutons sont desactives quand `prev_cursor` / `next_cursor` est null. La pagination preserve le filtre par type, la recherche et le tri actifs. Le scroll remonte en haut du tableau au changement de page.

---

## Categorie 3 -- Actions sur les elements

### 3.1 Barre d'actions contextuelles
Quand au moins un element est selectionne, une barre fixe apparait en bas de l'ecran (position sticky, bg-background border-t shadow-lg, z-30). Contenu :
- Texte `{count} element(s) selectionne(s)` (text-sm font-medium)
- Bouton `Restaurer` (variant outline, icone RotateCcw) -- restaure les elements selectionnes
- Bouton `Supprimer definitivement` (variant destructive, icone Trash2) -- supprime definitivement
- Bouton `Deselectionner` (variant ghost, icone X) -- deselectionne tout
Animation d'entree : slide-up 200ms depuis le bas. Animation de sortie : slide-down 200ms quand la selection est videe.

### 3.2 Restauration
Restauration d'un ou plusieurs elements :
1. **Appel API** : `POST /api/v1/trash/restore` avec body `{ ids: string[] }`. Le backend traite chaque element individuellement et retourne `{ restored: string[], failed: { id: string, reason: string }[] }`.
2. **Traitement backend** : pour chaque element, le handler emet un event PgEventBus `item.restored` avec `{ entity_type, entity_id, entity_metadata }`. Le module source ecoute cet event et reactive l'entite (supprime `deleted_at`, replace les donnees dans leur emplacement d'origine). Si l'emplacement d'origine n'existe plus (dossier parent supprime), l'element est place dans un dossier par defaut (`/Restored` pour Drive, `Inbox` pour Mail, calendrier par defaut pour Calendar).
3. **Feedback frontend** : toast vert `{count} element(s) restaure(s)` si tout reussit. Si certains echouent : toast orange `{restored} restaure(s), {failed} echoue(s)` avec detail des erreurs dans un expandable. La liste se rafraichit automatiquement (`queryClient.invalidateQueries('trash')`).

### 3.3 Undo toast avec countdown
Apres une restauration ou une suppression, un toast special avec countdown apparait pendant 10 secondes :
- Restauration : toast `{count} element(s) restaure(s)` avec bouton `Annuler` et barre de progression diminuante (10s). Si l'utilisateur clique `Annuler` dans les 10s, l'element est remis en corbeille (`POST /api/v1/trash` avec les IDs restaures). La barre de progression utilise CSS `animation: countdown 10s linear`.
- Suppression definitive : pas d'undo possible (le toast de confirmation AlertDialog suffit comme garde-fou).
Le toast undo est implementee via sonner (MIT) avec `duration: 10000` et un composant custom pour la barre de countdown.

### 3.4 Suppression definitive
Suppression irreversible d'un ou plusieurs elements :
1. **Confirmation** : AlertDialog `Supprimer definitivement {count} element(s) ? Cette action est irreversible. Les donnees seront detruites.` Bouton `Annuler` et bouton `Supprimer` (variant destructive).
2. **Appel API** : `DELETE /api/v1/trash` avec body `{ ids: string[] }`. Le backend emet un event PgEventBus `item.purged` pour chaque element.
3. **Traitement backend** : le module source ecoute `item.purged` et detruit les donnees physiques :
   - Drive : suppression du fichier physique via OpenDAL + suppression de l'enregistrement en base
   - Docs : suppression du contenu CRDT (Yjs) + suppression de l'enregistrement
   - Mail : suppression du message stocke
   - Calendar : suppression de l'evenement + recurrences + participants
   - Contacts : suppression de la fiche + liens CRM
   - Tasks : suppression de la tache + sous-taches + commentaires + pieces jointes
   - Forms : suppression de la reponse
   - Chat : suppression du message
4. **Feedback** : toast vert `{count} element(s) supprime(s) definitivement`. Les statistiques (total items, total size) sont recalculees.

### 3.5 Vidage complet de la corbeille
Le bouton `Empty Trash` declenche `DELETE /api/v1/trash` sans body (ou avec `{ all: true }`). Le backend supprime tous les elements de la corbeille de l'utilisateur en batch (par lots de 100 pour eviter les timeout). L'operation est asynchrone pour les grandes corbeilles : le backend retourne 202 Accepted et traite en arriere-plan. Un event PgEventBus `trash.empty_all` est emis. Le frontend affiche un toast `Vidage en cours...` avec spinner, puis `Corbeille videe` quand l'operation est terminee (notification via WebSocket ou polling).

### 3.6 Bulk operations UI
Quand plus de 10 elements sont selectionnes, un bandeau informatif apparait : `{count} elements selectionnes. Les operations en masse peuvent prendre quelques secondes.`. Les boutons de la barre d'actions affichent un spinner pendant l'operation. Les operations en masse sont traitees en batch cote backend (lots de 50) avec retour progressif. Le frontend desactive les interactions sur le tableau pendant le traitement (overlay translucide avec spinner).

### 3.7 Feedback pendant les operations
Pendant restauration ou suppression, les boutons de la barre d'actions affichent un Spinner (Loader2, animate-spin) a la place de l'icone et le texte change (`Restauration...`, `Suppression...`). Les boutons sont desactives (`disabled`) pendant l'operation. Les checkboxes sont egalement desactivees. Un overlay translucide (bg-background/50) couvre le tableau avec un spinner central pour les operations > 2 secondes. Les toasts (sonner) confirment le succes ou signalent l'echec avec detail.

---

## Categorie 4 -- Corbeille unifiee cross-module

### 4.1 Per-module soft delete implementation
Chaque module implemente le pattern soft-delete de maniere uniforme :

**Pattern standard pour chaque table de module** :
```sql
-- Ajout de la colonne deleted_at sur chaque table concernee
ALTER TABLE documents ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE drive_nodes ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE mail_messages ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE calendar_events ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE form_responses ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE chat_messages ADD COLUMN deleted_at TIMESTAMPTZ;

-- Index partiel pour les requetes normales (exclut les supprimes)
CREATE INDEX idx_documents_active ON documents(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_drive_nodes_active ON drive_nodes(id) WHERE deleted_at IS NULL;
-- ... idem pour chaque table

-- Index pour la corbeille (elements supprimes tries par date)
CREATE INDEX idx_documents_deleted ON documents(deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_drive_nodes_deleted ON drive_nodes(deleted_at DESC) WHERE deleted_at IS NOT NULL;
-- ... idem pour chaque table
```

**Pattern dans les repositories Rust** : chaque query normale ajoute `WHERE deleted_at IS NULL`. La suppression logique fait `UPDATE {table} SET deleted_at = now() WHERE id = $1`. Apres le SET, un event PgEventBus `item.trashed` est emis avec les metadonnees de l'entite.

### 4.2 Cross-module trash aggregation query
La corbeille unifiee agrege les elements supprimes de toutes les tables via une query UNION ALL :

```sql
-- Query d'aggregation cross-module (executee par signapps-identity ou un service dedie)
SELECT
  id, 'document' AS entity_type, title AS entity_title,
  NULL::BIGINT AS size, deleted_at, user_id AS deleted_by
FROM documents WHERE deleted_at IS NOT NULL AND user_id = $1

UNION ALL

SELECT
  id, 'drive_node', filename AS entity_title,
  size, deleted_at, owner_id AS deleted_by
FROM drive_nodes WHERE deleted_at IS NOT NULL AND owner_id = $1

UNION ALL

SELECT
  id, 'mail_message', subject AS entity_title,
  NULL, deleted_at, user_id AS deleted_by
FROM mail_messages WHERE deleted_at IS NOT NULL AND user_id = $1

UNION ALL

SELECT
  id, 'calendar_event', title AS entity_title,
  NULL, deleted_at, user_id AS deleted_by
FROM calendar_events WHERE deleted_at IS NOT NULL AND user_id = $1

UNION ALL

SELECT
  id, 'contact', CONCAT(first_name, ' ', last_name) AS entity_title,
  NULL, deleted_at, user_id AS deleted_by
FROM contacts WHERE deleted_at IS NOT NULL AND user_id = $1

UNION ALL

SELECT
  id, 'task', title AS entity_title,
  NULL, deleted_at, user_id AS deleted_by
FROM tasks WHERE deleted_at IS NOT NULL AND user_id = $1

UNION ALL

SELECT
  id, 'form_response', form_title AS entity_title,
  NULL, deleted_at, user_id AS deleted_by
FROM form_responses WHERE deleted_at IS NOT NULL AND user_id = $1

UNION ALL

SELECT
  id, 'chat_message', LEFT(content, 100) AS entity_title,
  NULL, deleted_at, user_id AS deleted_by
FROM chat_messages WHERE deleted_at IS NOT NULL AND user_id = $1

ORDER BY deleted_at DESC
LIMIT $2 OFFSET $3;
```

**Alternative table centralisee** : pour la performance sur de grandes corbeilles, une table `trash_items` centralisee (voir schema section 6.4) est alimentee par les events PgEventBus `item.trashed` de chaque module. Cette table sert de cache read-optimized et evite la query UNION ALL couteuse. Les requetes sur la corbeille lisent uniquement `trash_items`. La coherence est maintenue par les events.

### 4.3 Deux implementations complementaires
Le systeme a deux vues de corbeille qui coexistent :
- `/trash` -- corbeille unifiee cross-module (composant `UnifiedTrash`), fetche depuis `GET /api/v1/trash` du service identity. Affiche tous les types d'entites. C'est le point d'entree principal.
- `/storage/trash` -- corbeille specifique aux fichiers Drive (composant dedie), fetche depuis `GET /api/v1/storage/trash` du service storage. Affiche uniquement les fichiers avec taille, type MIME et apercu. Accessible depuis le module Drive > bouton `Corbeille`.

Les deux vues partagent les memes composants UI (TrashTable, TrashActions) mais avec des colonnes et des APIs differentes.

### 4.4 Modele de donnees unifie (trash_items)
Chaque element de la corbeille unifiee est enregistre dans la table centralisee :
```
TrashItem {
  id: UUID,                     // UUID unique dans la corbeille
  user_id: UUID,                // Proprietaire de l'element
  entity_type: string,          // "document" | "drive_node" | "mail_message" | "calendar_event" | "contact" | "task" | "form_response" | "chat_message"
  entity_id: UUID,              // ID original de l'entite dans son module source
  entity_title: string,         // Titre/nom affiche a l'utilisateur
  entity_metadata: JSONB,       // Metadonnees specifiques au module (taille, content_type, chemin d'origine, etc.)
  deleted_by: UUID,             // User ID de celui qui a supprime
  deleted_at: TIMESTAMPTZ,      // Date de suppression
  expires_at: TIMESTAMPTZ,      // Date d'expiration auto-purge
}
```

Le champ `entity_metadata` contient les informations specifiques au module :
- Drive : `{ size: number, content_type: string, original_bucket: string, original_key: string }`
- Docs : `{ word_count: number, last_editor: string }`
- Mail : `{ sender: string, recipients: string[], has_attachments: boolean }`
- Calendar : `{ start_time: string, end_time: string, is_recurring: boolean }`
- Contacts : `{ email: string, phone: string, company: string }`
- Tasks : `{ project_id: string, assignee: string, priority: string }`
- Forms : `{ form_id: string, form_name: string }`
- Chat : `{ channel_id: string, content_preview: string }`

### 4.5 Statistiques
L'API `GET /api/v1/trash/stats` retourne :
```
TrashStats {
  total_items: number,           // Nombre total d'elements
  total_size: number,            // Taille totale en octets (principalement drive_node)
  counts_by_type: {              // Compteurs par type d'entite
    document: number,
    drive_node: number,
    mail_message: number,
    calendar_event: number,
    contact: number,
    task: number,
    form_response: number,
    chat_message: number,
  },
  oldest_item_date: string,      // Date du plus ancien element (ISO 8601)
  expiring_soon: number,         // Nombre d'elements expirant dans les 7 prochains jours
}
```
Affiche dans le header sous forme de Badges : `{total_items} elements` et `{formatBytes(total_size)}`. Le badge `{expiring_soon} expirent bientot` apparait en rouge si > 0.

---

## Categorie 5 -- Retention et auto-purge

### 5.1 Politique de retention par defaut
Les elements supprimes sont conserves 30 jours avant purge automatique. La duree est configurable par l'admin dans `Administration > Parametres > Corbeille`. Champ : slider 1-365 jours ou toggle `Illimite` (pas d'auto-purge). Valeur stockee dans la table `settings` : `trash_retention_days INTEGER DEFAULT 30`. Changement de politique : applicable uniquement aux futures suppressions. Les elements deja en corbeille conservent leur `expires_at` original (pas de recalcul retroactif).

### 5.2 Retention differenciee par module
L'admin peut configurer des durees de retention differentes par type d'entite dans une grille editable :

| Module | Retention par defaut | Cle setting |
|--------|---------------------|-------------|
| Documents | 30 jours | `trash_retention_document` |
| Drive (fichiers) | 60 jours | `trash_retention_drive_node` |
| Emails | 7 jours | `trash_retention_mail_message` |
| Evenements | 30 jours | `trash_retention_calendar_event` |
| Contacts | 90 jours | `trash_retention_contact` |
| Taches | 30 jours | `trash_retention_task` |
| Formulaires | 14 jours | `trash_retention_form_response` |
| Messages chat | 7 jours | `trash_retention_chat_message` |

Les politiques par module prennent precedence sur la politique globale. Si aucune politique par module n'est definie, la globale s'applique.

### 5.3 Calcul de l'expiration
A la suppression, `expires_at = deleted_at + retention_duration`. Le calcul est fait cote serveur au moment de la mise en corbeille (dans le handler de l'event `item.trashed`). La duree est lue depuis les settings (par module d'abord, global en fallback). Le frontend affiche le nombre de jours restants : `daysLeft = Math.ceil((expires_at - now) / 86400000)`. Si `expires_at` est null (retention illimitee), le badge affiche `Pas d'expiration` en variant `outline`.

### 5.4 Indicateur d'urgence
Si un element expire dans 7 jours ou moins, le badge d'expiration passe en rouge (variant `destructive`). Texte : `{days}j restants`. Si l'element expire dans les prochaines 24h : texte `Expire aujourd'hui` avec icone AlertTriangle. Si l'element est deja expire (0 jours ou negatif), le badge affiche `Expiring` avec animation pulse. Ces elements sont purges au prochain passage du CRON.

### 5.5 Auto-purge CRON job
Un job CRON cote serveur execute la purge des elements expires :

**Configuration** :
- Frequence : quotidienne a 3h00 UTC (configurable via `trash_purge_cron` setting, format cron `0 3 * * *`)
- Implementation : pg_cron (PostgreSQL) ou CRON interne du scheduler signapps-calendar
- Timeout : 30 minutes max par execution

**Algorithme** :
1. `SELECT id, entity_type, entity_id FROM trash_items WHERE expires_at <= now() ORDER BY expires_at ASC LIMIT 500` (batch de 500)
2. Pour chaque batch :
   a. Emettre `item.purged` sur PgEventBus pour chaque element (le module source detruit les donnees physiques)
   b. `DELETE FROM trash_items WHERE id IN ({batch_ids})`
   c. Logger dans l'audit : `trash.auto_purged` avec count et entity_types
3. Repeter jusqu'a ce que la query retourne 0 resultat
4. Mettre a jour les statistiques de stockage (`SELECT sum(size) FROM drive_nodes WHERE deleted_at IS NULL`)

**Monitoring** : le job logue dans tracing le nombre d'elements purges, la duree d'execution, et les erreurs eventuelles. Un event `trash.purge_completed` est emis avec `{ purged_count, freed_bytes, duration_ms, errors }`. L'admin recoit une notification si des erreurs surviennent.

### 5.6 Quota de corbeille
La corbeille peut avoir un quota maximal configurable par l'admin :
- Setting : `trash_quota_percent INTEGER DEFAULT 10` (pourcentage du quota de stockage utilisateur)
- Si le quota est depasse, les elements les plus anciens sont purges automatiquement pour liberer de l'espace, meme si leur retention n'est pas expiree. Le CRON de purge verifie le quota apres la purge par expiration.
- Un bandeau d'avertissement apparait dans l'UI quand le quota est a > 80% : `Votre corbeille utilise {percent}% de son quota ({usedSize}/{maxSize}). Les elements les plus anciens seront purges automatiquement.`

### 5.7 Storage space recalculation after purge
Apres chaque purge (manuelle ou CRON), l'espace de stockage est recalcule :
1. Le module storage recoit les events `item.purged` pour les fichiers Drive et supprime les fichiers physiques via OpenDAL (`operator.delete(path)`).
2. La taille liberee est sommee et enregistree dans le log du job.
3. Les quotas utilisateur sont mis a jour : `UPDATE user_quotas SET used_bytes = used_bytes - {freed_bytes} WHERE user_id = $1`.
4. Les statistiques de la corbeille sont recalculees via `GET /api/v1/trash/stats` (invalidation du cache).
5. Un toast ou notification informe l'admin : `Purge terminee : {count} elements supprimes, {freed_size} liberes`.

---

## Categorie 6 -- API backend

### 6.1 Endpoints corbeille unifiee (signapps-identity)
- `GET /api/v1/trash` -- Liste les elements supprimes de l'utilisateur authentifie. Query params :
  - `entity_type` : filtre par module (string, optionnel)
  - `search` : recherche par titre (string, optionnel, PostgreSQL ts_vector)
  - `sort` : tri (`deleted_at_desc`, `deleted_at_asc`, `title_asc`, `title_desc`, `expires_at_asc`), defaut `deleted_at_desc`
  - `cursor` : curseur de pagination (string base64, optionnel)
  - `limit` : nombre d'elements par page (number, defaut 50, max 200)
  Retourne : `{ items: TrashItem[], next_cursor: string | null, prev_cursor: string | null, total: number }`

- `GET /api/v1/trash/stats` -- Statistiques de la corbeille. Query param optionnel `by_type=true` pour les compteurs par module.
  Retourne : `TrashStats`

- `POST /api/v1/trash/restore` -- Restauration en masse. Body : `{ ids: UUID[] }`. Emet `item.restored` sur PgEventBus pour chaque element. Le module source ecoute et reactive l'entite.
  Retourne : `{ restored: UUID[], failed: { id: UUID, reason: string }[] }`

- `DELETE /api/v1/trash` -- Suppression definitive. Body optionnel : `{ ids: UUID[] }`. Si absent ou `{ all: true }`, purge toute la corbeille de l'utilisateur. Emet `item.purged` pour chaque element.
  Retourne : `{ purged: number, freed_bytes: number }`

- `GET /api/v1/trash/:id` -- Detail d'un element. Retourne : `TrashItem` complet avec toutes les metadonnees.

### 6.2 Endpoints corbeille storage (signapps-storage)
- `GET /api/v1/storage/trash` -- Liste les fichiers supprimes. Query params : `bucket` (optionnel), `search` (optionnel), `cursor`, `limit`.
  Retourne : `{ items: StorageTrashItem[], next_cursor, prev_cursor, total }`
- `POST /api/v1/storage/trash/restore` -- Restauration en masse. Body : `{ ids: UUID[] }`. Replace les fichiers dans leur bucket/key d'origine.
  Retourne : `{ restored: UUID[], failed: { id: UUID, reason: string }[] }`
- `DELETE /api/v1/storage/trash` -- Purge. Body optionnel : `{ ids: UUID[] }` (si absent, purge tout). Supprime les fichiers physiques via OpenDAL.
  Retourne : `{ purged: number, freed_bytes: number }`
- `GET /api/v1/storage/trash/stats` -- Statistiques : `{ total_items: number, total_size: number }`.

### 6.3 PgEventBus events
Tous les events sont emis sur le channel `trash` via PostgreSQL LISTEN/NOTIFY :

- **`item.trashed`** -- emis quand un element est mis en corbeille par n'importe quel module.
  Payload : `{ entity_type, entity_id, entity_title, entity_metadata, user_id, deleted_at }`.
  Consumer : le service identity/trash ecoute et insere dans `trash_items`. Calcule `expires_at` a partir de la retention policy du module.

- **`item.restored`** -- emis quand un element est restaure depuis la corbeille.
  Payload : `{ entity_type, entity_id, entity_metadata, user_id, restored_at }`.
  Consumer : le module source ecoute et execute `UPDATE {table} SET deleted_at = NULL WHERE id = entity_id`. Le service trash supprime l'entree de `trash_items`.

- **`item.purged`** -- emis quand un element est purge definitivement (manuellement ou par auto-purge).
  Payload : `{ entity_type, entity_id, entity_metadata, user_id, purged_at, reason: 'manual' | 'auto_expire' | 'quota' | 'gdpr' }`.
  Consumer : le module source ecoute et detruit les donnees physiques. Le service audit logue l'evenement.

- **`trash.stats_updated`** -- emis apres chaque operation modifiant la corbeille (insert, restore, purge).
  Payload : `{ user_id, total_items, total_size }`.
  Consumer : le frontend ecoute via WebSocket pour mettre a jour les badges en temps reel.

### 6.4 Schema PostgreSQL
```sql
-- Table centralisee de la corbeille unifiee
CREATE TABLE trash_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'document', 'drive_node', 'mail_message', 'calendar_event',
    'contact', 'task', 'form_response', 'chat_message'
  )),
  entity_id UUID NOT NULL,
  entity_title TEXT NOT NULL,
  entity_metadata JSONB DEFAULT '{}',
  deleted_by UUID NOT NULL REFERENCES users(id),
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE(entity_type, entity_id)
);

-- Index pour la liste par utilisateur (tri par date de suppression)
CREATE INDEX idx_trash_user_deleted ON trash_items(user_id, deleted_at DESC);

-- Index pour le filtrage par type
CREATE INDEX idx_trash_user_type ON trash_items(user_id, entity_type);

-- Index pour le CRON de purge (elements expires)
CREATE INDEX idx_trash_expires ON trash_items(expires_at ASC) WHERE expires_at IS NOT NULL;

-- Index pour la recherche full-text
CREATE INDEX idx_trash_title_search ON trash_items USING GIN(to_tsvector('french', entity_title));

-- Index pour la deduplication
CREATE UNIQUE INDEX idx_trash_entity_unique ON trash_items(entity_type, entity_id);

-- Table de configuration retention par module
CREATE TABLE trash_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL UNIQUE CHECK (entity_type IN (
    'document', 'drive_node', 'mail_message', 'calendar_event',
    'contact', 'task', 'form_response', 'chat_message'
  )),
  retention_days INTEGER NOT NULL DEFAULT 30 CHECK (retention_days >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table d'audit des operations corbeille
CREATE TABLE trash_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('soft_delete', 'restore', 'hard_delete', 'empty_all', 'auto_purge')),
  entity_type TEXT,
  entity_id UUID,
  entity_title TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trash_audit_user ON trash_audit_log(user_id, created_at DESC);
CREATE INDEX idx_trash_audit_action ON trash_audit_log(action, created_at DESC);
```

---

## Categorie 7 -- Securite et gouvernance

### 7.1 Isolation par utilisateur
Chaque utilisateur ne voit que les elements qu'il a lui-meme supprimes ou ceux dont il est proprietaire. Le filtre `WHERE user_id = $1` (extrait du JWT `claims.sub`) est applique sur toutes les queries. Les admins peuvent voir la corbeille de tous les utilisateurs via `GET /api/v1/admin/trash?user_id={id}` (endpoint reserve aux admins, verifie via middleware `require_admin`).

### 7.2 Permissions de restauration
Seul le proprietaire de l'element ou un admin peut restaurer. Si l'element a ete supprime par un admin (purge forcee via l'interface admin), seul un admin peut le restaurer (pas l'utilisateur original). La verification des permissions est faite cote backend avant chaque restauration. Erreur 403 si non autorise avec message `You do not have permission to restore this item`.

### 7.3 RGPD hard-delete cascade
La purge definitive (hard delete) implemente le "droit a l'effacement" (Article 17 RGPD) de maniere exhaustive :

**Donnees supprimees pour chaque type d'entite** :
- **Document** : contenu CRDT (Yjs), metadonnees, historique de versions, commentaires, permissions de partage, vecteurs d'embedding (pgvector), index de recherche (ts_vector)
- **Drive file** : fichier physique (OpenDAL), vignette/preview, metadonnees, permissions, liens de partage, vecteurs d'embedding
- **Email** : message complet (headers + body + pieces jointes stockees), index de recherche
- **Calendar event** : evenement + recurrences + participants + rappels + pieces jointes
- **Contact** : fiche complete, photo, liens CRM/deals, historique d'interactions
- **Task** : tache + sous-taches + commentaires + pieces jointes + activite
- **Form response** : reponse complete avec toutes les valeurs de champs
- **Chat message** : message + pieces jointes + reactions

**Audit de la suppression** : une entree dans `trash_audit_log` avec `action = 'hard_delete'` et `metadata` contenant un hash SHA-256 de l'entite supprimee (preuve de destruction sans stocker les donnees). Le certificat de destruction est generable via `GET /api/v1/trash/audit/{audit_id}/certificate` (PDF avec details de la suppression, horodatage, hash).

### 7.4 Audit trail complet
Chaque action sur la corbeille est loguee dans `trash_audit_log` :
- `soft_delete` : entite mise en corbeille. Metadata : `{ entity_type, entity_id, entity_title, source_module }`.
- `restore` : entite restauree. Metadata : `{ entity_type, entity_id, restored_to: string }`.
- `hard_delete` : entite purgee manuellement. Metadata : `{ entity_type, entity_id, entity_hash, freed_bytes }`.
- `empty_all` : corbeille videe entierement. Metadata : `{ count, freed_bytes }`.
- `auto_purge` : entite purgee par le CRON. Metadata : `{ entity_type, entity_id, reason: 'expired' | 'quota' }`.
L'audit est consultable dans le module Administration > Audit avec filtres par action, utilisateur, type d'entite et plage de dates.

### 7.5 Protection contre la suppression accidentelle
Les modules critiques peuvent marquer un element comme non-supprimable via le flag `protected: true` dans les metadonnees. Exemples : documents avec signatures electroniques, factures validees, contrats signes. La tentative de suppression retourne 409 Conflict : `This item is protected and cannot be deleted. Reason: {reason}`. L'interface affiche un Dialog informatif au lieu de supprimer. Seul un admin peut forcer la suppression d'un element protege via `DELETE /api/v1/{module}/{id}?force=true`.

### 7.6 Admin bulk purge
L'admin peut purger la corbeille de tous les utilisateurs en une action (maintenance systeme). Interface : `Administration > Corbeille > Purge globale`. Filtres : par utilisateur, par type d'entite, par anciennete (ex: `tous les elements > 90 jours`). Le job est lance en arriere-plan (`POST /api/v1/admin/trash/purge` avec body filtres). Progression via WebSocket : `{ processed: number, total: number, freed_bytes: number }`. Rapport final : `{ purged: number, freed_bytes: number, duration_ms: number, errors: string[] }`.

---

## Categorie 8 -- Integration avec les modules

### 8.1 Soft-delete pattern uniforme
Chaque module implemente le pattern soft-delete de maniere identique :

```rust
// Pattern Rust dans chaque repository
pub async fn soft_delete(&self, pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<(), AppError> {
    // 1. Marquer comme supprime
    sqlx::query!(
        "UPDATE documents SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL",
        id, user_id
    )
    .execute(pool)
    .await
    .map_err(|e| AppError::internal(format!("Failed to soft delete: {e}")))?;

    // 2. Emettre l'event pour la corbeille unifiee
    PgEventBus::emit(pool, "item.trashed", &TrashEvent {
        entity_type: "document",
        entity_id: id,
        entity_title: doc.title.clone(),
        entity_metadata: json!({ "word_count": doc.word_count }),
        user_id,
    }).await?;

    Ok(())
}
```

Les queries normales excluent les lignes avec `deleted_at IS NOT NULL` via les index partiels ou une clause WHERE explicite.

### 8.2 Drive / Storage
Les fichiers supprimes dans Drive sont soft-deleted en base (`drive_nodes.deleted_at = now()`). Le fichier physique est conserve dans le stockage OpenDAL jusqu'a la purge. La corbeille specifique Drive (`/storage/trash`) permet la gestion fine avec taille, type MIME, apercu miniature (si image/PDF). La restauration replace le fichier dans son bucket/key d'origine. Si le bucket n'existe plus, le fichier est place dans le bucket par defaut de l'utilisateur.

### 8.3 Docs
Les documents supprimes sont soft-deleted en base. Le contenu CRDT (Yjs) est conserve. La restauration reouvre le document dans son etat exact au moment de la suppression. L'historique de versions est preserve. Les collaborateurs avec le document ouvert voient une notification `Ce document a ete supprime` et sont redirigees vers la page d'accueil.

### 8.4 Mail
Les emails supprimes du dossier Corbeille IMAP (deuxieme suppression) sont marques pour purge. La corbeille globale ne montre que les emails purges definitivement du dossier IMAP Trash (pas les emails simplement deplaces vers le dossier Corbeille IMAP, qui est gere par le module Mail en local). La restauration replace l'email dans le dossier Inbox par defaut.

### 8.5 Calendar
Les evenements supprimes sont soft-deleted. Gestion des evenements recurrents :
- Suppression d'une occurrence : seule l'exception est mise en corbeille (l'evenement recurrent continue pour les autres dates). Restauration reactive l'occurrence.
- Suppression de la serie entiere : l'evenement recurrent + toutes les exceptions sont mis en corbeille comme un groupe. La restauration restaure le tout. Les participants et les rappels sont preserves.

### 8.6 Contacts
Les fiches contact supprimees sont soft-deleted. Les liens avec d'autres entites (deals CRM, emails envoyes/recus, evenements avec ce contact) sont preserves mais inactifs (le contact apparait comme `[Supprime]` dans les vues liees). La restauration reactive tous les liens. Si un deal CRM reference un contact supprime et que le deal est modifie, un avertissement `Ce contact est en corbeille` apparait.

### 8.7 Tasks
Les taches supprimees sont soft-deleted avec leurs sous-taches (cascade), commentaires et pieces jointes. La restauration replace la tache dans son projet et sa colonne Kanban d'origine. Si le projet a ete supprime, la tache est placee dans un projet `Sans projet`. Les assignations et les dates limites sont preservees.

### 8.8 Crosslinks et interdependances
Si un element en corbeille est reference par un autre element actif (ex: un fichier Drive lie a un document Docs, un contact lie a un deal CRM), la purge definitive genere un avertissement :
- Avant la purge : Dialog informatif `Cet element est reference par {count} autres elements. La purge cassera ces liens.` avec liste des elements references (max 10, lien `et {n} de plus`).
- Apres la purge : les references deviennent des "liens brises" affiches comme `[Element supprime]` avec icone AlertTriangle. Les liens brises sont cliquables et affichent un tooltip `Cet element a ete definitivement supprime le {date}`.
- La purge ne bloque PAS a cause des references (l'utilisateur confirme via le Dialog) mais l'information est donnee pour une decision eclairee.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Google Drive Help -- Trash** (support.google.com/drive/answer/2375102) -- fonctionnement de la corbeille, retention 30 jours, restauration.
- **Microsoft 365 -- Recycle Bin** (support.microsoft.com/recycle-bin) -- deux niveaux de corbeille, retention, restauration.
- **Nextcloud -- Deleted Files** (docs.nextcloud.com/server/latest/user_manual/files/deleted_file_management.html) -- API, retention, quota.
- **SharePoint -- Recycle Bin** (learn.microsoft.com/sharepoint/recycle-bin) -- premier et second niveau, administration.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License -- ne pas copier**

## References OSS

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **OpenDAL** (github.com/apache/opendal) | **Apache-2.0** | Deja utilise dans signapps-storage. Abstraction multi-backend (fs, s3) avec support delete/list. Pattern trash bucket pour les fichiers supprimes. |
| **sqlx** (github.com/launchbadge/sqlx) | **MIT / Apache-2.0** | Deja utilise. Pattern soft-delete avec `deleted_at` column, filtered queries, index strategies. |
| **pg_cron** (github.com/citusdata/pg_cron) | **PostgreSQL License** | Job scheduler PostgreSQL natif. Pattern pour le cron de purge auto des elements expires. |
| **sonner** (github.com/emilkowalski/sonner) | **MIT** | Toast notifications React. Deja utilise pour le feedback utilisateur (restauration, suppression, erreurs). Pattern pour le toast undo avec countdown. |
| **shadcn/ui AlertDialog** (github.com/shadcn-ui/ui) | **MIT** | Composant de dialogue de confirmation. Pattern pour les actions destructives (vidage corbeille, suppression definitive). |
| **Supabase** (github.com/supabase/supabase) | **Apache-2.0** | Pattern soft-delete avec RLS (Row Level Security) pour l'isolation par utilisateur dans PostgreSQL. |
| **PgEventBus pattern** | **Interne** | Pattern evenementiel via PostgreSQL LISTEN/NOTIFY pour la communication inter-modules (item.trashed, item.restored, item.purged). |

---

## Assertions E2E cles (a tester)

- Page /trash -> le titre `Corbeille` est visible avec le sous-titre
- Corbeille vide -> icone Trash2 opacifiee et message `La corbeille est vide`
- Suppression d'un document dans Docs -> l'element apparait dans /trash avec type `Document`
- Suppression d'un fichier dans Drive -> l'element apparait dans /storage/trash avec taille et type
- Filtre par type `Document` -> seuls les documents supprimes sont affiches
- Filtre par type avec compteur 0 -> le bouton est visible mais en opacite reduite
- Filtre `Tout` -> tous les elements sont affiches avec le compteur total
- Recherche par nom de fichier -> les resultats sont filtres cote serveur
- Tri par date de suppression -> les elements les plus recents sont en premier
- Tri par expiration -> les elements expirant bientot sont en premier
- Selection d'un element -> la barre d'actions sticky apparait en bas avec `1 element(s) selectionne(s)`
- Selection tout -> toutes les checkboxes sont cochees, option de selectionner tous les elements
- Bouton Restore -> l'element disparait de la corbeille, toast de succes avec bouton Annuler (undo 10s)
- Undo restore -> clic sur Annuler dans les 10s remet l'element en corbeille
- Element restaure -> il reapparait dans son module d'origine a son emplacement d'origine
- Element restaure sans dossier parent -> place dans le dossier par defaut du module
- Bouton Delete Permanently -> AlertDialog de confirmation, puis suppression irreversible
- Bouton Empty Trash -> le dialogue de confirmation s'ouvre avec le compte et la taille
- Confirmation Empty Trash -> tous les elements sont purges, la corbeille affiche l'etat vide
- Badge d'expiration <= 7 jours -> badge rouge `destructive`
- Badge d'expiration > 7 jours -> badge gris `secondary`
- Element expire (0 jours) -> badge affiche `Expiring` avec animation pulse
- Statistiques -> badges elements et taille affiches dans le header
- Badge expiring soon -> badge rouge avec compteur si elements expirent dans 7 jours
- Spinner pendant restauration/suppression -> les boutons sont desactives
- Bulk operation > 10 elements -> bandeau informatif et overlay pendant traitement
- Pagination cursor-based -> Previous/Next fonctionnels, page indicator correct
- Clic droit sur une ligne -> ContextMenu avec Restaurer, Supprimer, Details
- Utilisateur non-admin -> ne voit que ses propres elements supprimes
- Admin -> peut voir la corbeille de tous les utilisateurs via le panneau admin
- Element protege -> tentative de suppression affiche un Dialog informatif (409)
- Crosslinks -> la purge d'un element reference affiche l'avertissement avec la liste des references
- Auto-purge -> apres 30 jours (ou la retention configuree), les elements disparaissent automatiquement
- RGPD -> la purge detruit toutes les donnees liees (fichier, metadonnees, index, vecteurs)
- Storage recalculation -> apres une purge, l'espace libere est reflecte dans les quotas
