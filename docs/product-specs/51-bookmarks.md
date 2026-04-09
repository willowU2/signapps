# Module Favoris (Bookmarks) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Chrome Bookmarks** | Barre de favoris persistante, dossiers imbriques illimites, sync cross-device via compte Google, gestionnaire de favoris avec recherche, import/export HTML, raccourci Ctrl+D, favicons auto, tri par nom/date, suggestions de dossiers |
| **Notion Favorites** | Sidebar favorites section, glisser-deposer pour reorganiser, favoris par workspace, distinction favoris perso vs partages, breadcrumb navigation vers la page favorite, icones emoji custom, favoris de databases et vues |
| **Slack Saved Items** | Sauvegarder n'importe quel message/fichier/canvas, vue dediee "Saved Items", tri par date, filtres par channel/DM/type, rappels sur items sauvegardes, archivage des items traites, compteur d'items sauvegardes |
| **Microsoft Edge Collections** | Collections thematiques avec titre et description, ajout de pages web + notes + images, drag-drop depuis le web, export vers Excel/Word/Pinterest, partage de collections, mode presentation, AI-generated descriptions |
| **Pocket** | Save-for-later avec extraction article, tags illimites, vue lecture epuree, highlights et annotations, recherche full-text dans le contenu sauvegarde, recommendations basees sur les favoris, archive, bulk edit |
| **Raindrop.io** | Collections imbriquees, tags, filtres avances (type, domaine, date, tag), vues (liste, grille, moodboard, headlines), recherche dans le contenu des pages, duplicates detection, broken links check, collaboration sur collections, export multi-format |
| **Google Keep Pins** | Epinglage en un clic, notes epinglees en section haute, distinction visuelle epingle/non-epingle, reordonnancement par drag-drop, persistance cross-device, couleur de fond comme marqueur visuel |
| **Safari Reading List** | Liste de lecture offline, synchronisation iCloud, articles sauvegardes avec apercu, distinction lu/non-lu, ajout depuis le menu partage, stockage local pour lecture hors-ligne |

## Principes directeurs

1. **Agregation cross-module** -- les favoris sont un hub centralise qui rassemble les elements marques depuis n'importe quel module SignApps (documents, mails, contacts, evenements, taches, fichiers, notes, messages chat, pages wiki). Un seul endroit pour tout retrouver.
2. **Marquage en un clic** -- ajouter un favori se fait via une icone etoile presente sur chaque element dans chaque module. Un clic = favori. Un second clic = retrait. Zero formulaire, zero dialogue.
3. **Contexte preserve** -- chaque favori conserve le lien vers l'element source, son type (icone module), son titre, sa date d'ajout, et un apercu contextuel (extrait de texte, miniature, expediteur). Le clic ouvre directement l'element dans son module d'origine.
4. **Organisation legere** -- les favoris supportent des tags personnalises et un systeme de collections (dossiers) pour regrouper les favoris par theme ou projet. Pas de hierarchie complexe : un niveau de collection suffit.
5. **Recherche et filtrage instantanes** -- barre de recherche full-text sur les titres et descriptions des favoris, plus filtres par module source, par tag, par collection, et par date d'ajout.
6. **Synchronisation temps reel** -- quand un element source est modifie (titre change, document supprime), le favori reflete le changement. Si l'element source est supprime, le favori affiche un etat "element supprime" avec option de retrait.

---

## Categorie 1 -- Marquage et collecte des favoris

### 1.1 Composant StarButton (BookmarkStar)
Composant React partage `<BookmarkStar itemId={id} itemType="document" size="md" />` rendu dans chaque module. L'icone est un `Star` de lucide-react : contour gris quand inactif (fill `none`, stroke `muted-foreground`), jaune rempli quand actif (fill `#FACC15`, stroke `#FACC15`). Tailles : `sm` (16px), `md` (20px), `lg` (24px). La zone de clic est toujours au minimum 44x44px (WCAG 2.5.5) meme si l'icone est petite. Au clic, l'etoile joue une animation de scale : 1.0 -> 1.3 -> 1.0 en 200ms (ease-out). En cas d'erreur reseau lors du toggle, l'etoile revient a son etat precedent (rollback optimistic update) et un toast rouge `Impossible de mettre a jour le favori. Reessayez.` s'affiche pendant 4 secondes.

### 1.2 Hook React `useBookmark`
Hook partage `useBookmark(itemId: string, itemType: BookmarkItemType)` retournant `{ isBookmarked: boolean, toggle: () => void, isLoading: boolean, error: Error | null }`. Utilise TanStack Query (`useQuery` pour lire l'etat + `useMutation` pour le toggle) avec optimistic updates. Le query key suit le pattern `['bookmarks', 'status', itemId, itemType]`. Le `staleTime` est de 30 secondes. Lors du toggle, le cache est mis a jour immediatement via `queryClient.setQueryData`, et en cas d'erreur le `onError` callback restaure la valeur precedente via le snapshot `previousValue` capture dans `onMutate`.

### 1.3 Ajout rapide sans interruption
Le clic sur l'etoile ajoute le favori immediatement sans dialogue ni confirmation. Un toast discret apparait brievement en bas a gauche : `Ajoute aux favoris` avec un lien `Annuler` souligne. Le toast reste visible 5 secondes. Le clic sur `Annuler` dans ce delai appelle `DELETE /api/v1/bookmarks/:id` et retire le favori. Le toast utilise le composant `Sonner` (deja integre dans SignApps). Animation d'entree : slide-up 200ms. Animation de sortie : fade-out 300ms.

### 1.4 Retrait de favori
Un second clic sur l'etoile (deja remplie) retire le favori. Toast : `Retire des favoris` avec lien `Annuler`. L'annulation re-cree le favori avec les memes metadonnees. Le retrait est egalement possible depuis la page /bookmarks via un bouton etoile ou un menu contextuel (clic droit) `Retirer des favoris`. Le raccourci clavier `Delete` fonctionne quand un favori est en focus sur la page /bookmarks, avec un dialogue de confirmation si plus de 1 favori est selectionne.

### 1.5 Metadonnees capturees automatiquement
Lors de l'ajout, le systeme enregistre : `item_id` (UUID de l'element source), `item_type` (enum : `document`, `mail`, `contact`, `event`, `task`, `file`, `note`, `chat_message`, `wiki_page`, `form`), `title` (titre de l'element au moment de l'ajout, max 500 chars), `preview` (extrait texte 200 chars max ou URL miniature), `source_url` (route interne vers l'element, ex: `/docs/abc-123`), `module` (nom du module source en lowercase), `created_at` (TIMESTAMPTZ), `user_id` (UUID du proprietaire). Le frontend passe `item_id` et `item_type` dans le POST; le backend enrichit les autres champs en requetant la table source via PgEventBus ou query directe.

### 1.6 Favoris de recherche
En plus des elements, l'utilisateur peut sauvegarder des recherches frequentes comme favoris. La recherche sauvegardee stocke la query, les filtres actifs, et le module source. Le `item_type` est `saved_search`. Le clic sur un favori de recherche re-execute la recherche avec les memes parametres via navigation vers `/search?q=...&module=...&filters=...`.

### 1.7 Favoris depuis le menu contextuel
En plus de l'etoile, chaque element propose dans son menu contextuel (clic droit ou bouton `...` trois points) l'option `Ajouter aux favoris` / `Retirer des favoris` avec l'icone etoile a gauche du texte. Ce menu est le point d'entree secondaire pour les elements ou l'etoile n'est pas visible (vues compactes, vue liste dense). Le composant `ContextMenuItem` utilise `useBookmark` en interne.

### 1.8 Raccourci clavier global de marquage
`B` (sans modificateur) dans n'importe quel module, quand un element est selectionne ou en focus, bascule le favori. Le raccourci est annonce dans la command palette (`Ctrl+K`) avec le label `Basculer favori`. Si aucun element n'est en focus, le raccourci est ignore (pas de toast d'erreur). Sur macOS, le raccourci est identique (`B`). Le raccourci est desactivable dans les preferences utilisateur sous `Parametres > Raccourcis clavier`.

### 1.9 Batch status check au chargement de liste
Quand un module charge une liste d'elements (ex: /docs affiche 50 documents), un appel batch `POST /api/v1/bookmarks/status/batch` avec `{ items: [{ item_id, item_type }] }` recupere le statut de tous les elements en un seul appel. La reponse `{ statuses: { [item_id]: { is_bookmarked: boolean, bookmark_id: string | null } } }` est injectee dans le cache TanStack Query pour chaque element. Cela evite N requetes individuelles et permet d'afficher l'etat de chaque etoile immediatement au rendu de la liste.

---

## Categorie 2 -- Page Favoris (/bookmarks)

### 2.1 En-tete et description
La page affiche le titre `Favoris` en H1 (`text-3xl font-bold`) et le sous-titre `Vos elements marques comme favoris dans tous les modules` en `text-muted-foreground`. Un compteur `badge` affiche le nombre total de favoris a cote du titre : `Favoris (42)`. L'en-tete est sticky en haut de la page pendant le scroll.

### 2.2 Onglets de navigation
Deux onglets principaux sous l'en-tete, rendus avec le composant `Tabs` de shadcn/ui :
- **Recent** -- affiche les favoris tries par date d'ajout decroissante, avec un regroupement par periode (Aujourd'hui, Cette semaine, Ce mois, Plus ancien). Chaque groupe a un separateur avec le label de la periode en `text-sm font-medium text-muted-foreground`. Scroll infini : charge 50 favoris initialement, puis 50 de plus quand le scroll atteint 200px du bas (IntersectionObserver).
- **Tous (N)** -- affiche tous les favoris avec le compteur total entre parentheses. Tri par defaut : date d'ajout decroissante. Dropdown de tri en haut a droite : `Date d'ajout`, `Titre A-Z`, `Titre Z-A`, `Module`. Pagination par curseur identique.

### 2.3 Etat vide
Quand aucun favori n'existe, affichage centre vertical et horizontal : icone `Star` grisee (64px, stroke `muted-foreground`), texte `Aucun favori` en `text-xl font-semibold`, sous-texte `Cliquez sur l'etoile dans n'importe quel module pour ajouter un favori` en `text-muted-foreground text-sm`. Cet etat est visible dans les deux onglets. Aucun bouton d'action (le CTA est implicite : aller dans un module).

### 2.4 Carte de favori (vue grille)
Chaque favori est affiche sous forme de carte (`Card` shadcn/ui) avec :
- Icone du module source en haut a gauche (16px, couleur codee : bleu pour docs, rouge pour mail, vert pour calendar, etc.)
- Titre de l'element en `font-medium` (1 ligne, `truncate` si trop long, `title` tooltip au hover)
- Extrait/apercu en `text-sm text-muted-foreground` (2 lignes max, `line-clamp-2`)
- Date d'ajout relative en `text-xs text-muted-foreground` (`il y a 3 heures`, formatee avec `date-fns/formatDistanceToNow`)
- Tags assignes en bas de la carte (badges `outline` variant, max 3 affiches + `+N` si plus)
- Bouton etoile jaune en haut a droite (pour retirer le favori sans quitter la page)
La carte a un hover effect : `shadow-md` transition 150ms. Le clic sur la carte (sauf sur l'etoile) ouvre l'element dans son module d'origine via `router.push(source_url)`.

### 2.5 Vue liste alternative
Toggle grille/liste en haut a droite via deux icones (`LayoutGrid` et `List` de lucide-react). La vue liste affiche les favoris en lignes dans un `Table` avec colonnes : icone module (24px), titre, type (badge), date d'ajout, tags (badges). Chaque ligne est cliquable. L'etoile de retrait est dans la derniere colonne. La largeur des colonnes est responsive : sur ecrans < 1024px, les colonnes `type` et `tags` sont masquees. La preference grille/liste est persistee en localStorage cle `bookmarks-view-mode`.

### 2.6 Filtres par module
Barre de filtres horizontale sous les onglets avec les icones de chaque module (Documents, Mail, Calendar, Drive, Chat, Contacts, Tasks, Forms, Wiki). Rendu en `flex gap-2 overflow-x-auto`. Chaque filtre est un bouton pill avec l'icone du module et le compteur (`Docs (12)`). Clic sur un module filtre les favoris de ce module uniquement (query param `?type=document`). Multi-selection possible : un second clic sur un filtre actif le desactive, Ctrl+clic ajoute un filtre. Un bouton `Tous` reinitialise les filtres. Les filtres actifs sont surlignees en `bg-primary text-primary-foreground`.

### 2.7 Recherche dans les favoris
Barre de recherche `Input` en haut de la page avec icone loupe a gauche et placeholder `Rechercher dans les favoris...`. La recherche est client-side via Fuse.js (fuzzy matching) sur les champs `title` et `preview` des favoris deja charges. Le filtrage est en temps reel (debounce 150ms). Les termes recherches sont mis en surbrillance dans les resultats via un composant `Highlight` qui wrap les matches en `<mark class="bg-yellow-200 dark:bg-yellow-800">`. Si le volume depasse 500 favoris, la recherche bascule sur l'API backend (`GET /api/v1/bookmarks?search=...`) avec full-text PostgreSQL (`to_tsvector('french', title || ' ' || coalesce(preview, ''))` et `plainto_tsquery`).

### 2.8 Actions groupees (bulk)
Cases a cocher sur chaque carte (coin superieur gauche, apparaissent au hover ou quand le mode selection est actif). Le mode selection s'active au premier clic sur une checkbox. Barre d'actions flottante en bas de l'ecran (sticky, `bg-card border shadow-lg rounded-lg p-3`) affichant le compteur `N selectionnes` et les boutons : `Retirer des favoris` (icone `Trash2`, rouge), `Ajouter a une collection` (icone `FolderPlus`), `Ajouter un tag` (icone `Tag`), `Exporter` (icone `Download`). Bouton `Tout selectionner` dans l'en-tete de la liste. `Escape` annule la selection. `Shift+clic` selectionne une plage continue.

---

## Categorie 3 -- Collections et organisation

### 3.1 Collections de favoris
L'utilisateur peut creer des collections pour regrouper ses favoris par theme, projet ou contexte. Une collection a un `name` (VARCHAR 255, obligatoire), une `color` (hex 7 chars, optionnelle, defaut `#6B7280`), une `description` (TEXT, optionnelle, max 500 chars) et un `icon` (emoji ou lucide-react icon name, optionnel). Les collections sont listees dans la sidebar gauche de la page /bookmarks.

### 3.2 Creation de collection
Le bouton `+ Nouvelle collection` en bas de la sidebar ouvre un dialogue modal (`Dialog` shadcn/ui) avec les champs : `Nom` (obligatoire, autofocus), `Description` (optionnel, textarea), `Couleur` (picker avec 12 couleurs predefinies + custom hex), `Icone` (picker emoji). Validation : le nom doit etre unique par utilisateur (erreur inline `Ce nom existe deja`). La creation appelle `POST /api/v1/bookmarks/collections` et la collection apparait immediatement dans la sidebar.

### 3.3 Renommage et modification de collection
Clic droit ou bouton `...` sur une collection dans la sidebar ouvre un menu contextuel : `Renommer`, `Modifier la couleur`, `Modifier la description`, `Supprimer`. Le renommage s'active inline (le texte de la sidebar devient un input editable). `Enter` valide, `Escape` annule. La modification appelle `PUT /api/v1/bookmarks/collections/:id`.

### 3.4 Suppression de collection
La suppression d'une collection affiche un dialogue de confirmation : `Supprimer la collection "Projet Alpha" ? Les favoris qu'elle contient ne seront pas supprimes, ils deviendront non classes.` Deux boutons : `Annuler` (defaut, focus) et `Supprimer` (rouge, `variant="destructive"`). La suppression appelle `DELETE /api/v1/bookmarks/collections/:id`. Les lignes de la table de jointure `bookmark_collection_items` sont supprimees en cascade.

### 3.5 Sidebar de collections
Sidebar gauche (largeur 240px, repliable a 0px via bouton chevron) avec :
- `Tous les favoris` (icone `Star`, vue par defaut, compteur total)
- `Recent` (icone `Clock`, raccourci vers l'onglet Recent)
- `Non classes` (icone `Inbox`, favoris sans collection, compteur)
- Separateur `---`
- Liste des collections avec pastille de couleur (8px cercle), nom, compteur entre parentheses
- Bouton `+ Nouvelle collection` en bas
La sidebar est repliable. L'etat replie/deploye est persiste en localStorage. Sur mobile (< 768px), la sidebar est un drawer qui s'ouvre par swipe ou bouton hamburger.

### 3.6 Ajout a une collection
Depuis la page /bookmarks ou depuis n'importe quel module, l'utilisateur peut assigner un favori a une collection via un dropdown menu (`DropdownMenu` shadcn/ui). Le dropdown liste toutes les collections avec checkboxes (multi-assignation possible). Un favori sans collection apparait dans `Non classes`. L'ajout appelle `POST /api/v1/bookmarks/collections/:collectionId/items` avec `{ bookmark_id }`.

### 3.7 Tags personnalises
Systeme de tags libres assignables a chaque favori. Input d'ajout de tag avec auto-completion (les tags existants de l'utilisateur sont suggeres, filtres par frappe). `Enter` cree le tag ou selectionne la suggestion. Les tags sont affiches comme badges `outline` sur la carte. Un favori peut avoir jusqu'a 10 tags. Au-dela, le bouton `+` est desactive avec tooltip `Maximum 10 tags atteint`. L'API backend valide cette limite et retourne HTTP 422 si depassee.

### 3.8 Drag-and-drop pour organiser
Les favoris peuvent etre glisses-deposes entre collections dans la sidebar. Implementation avec `@dnd-kit/core` (MIT). Le drag commence apres 150ms de maintien (pour eviter les clics accidentels). Pendant le drag, la collection cible est surlignee en `bg-accent`. Le drop appelle `POST /api/v1/bookmarks/collections/:collectionId/items`. Reordonnancement libre a l'interieur d'une collection par drag-and-drop vertical. L'ordre est persiste via le champ `sort_order` (entiers avec espacement de 1000 pour permettre les insertions). Apres le drop, un toast confirme : `Deplace dans "Projet Alpha"`.

### 3.9 Reordonnancement des collections
Les collections elles-memes peuvent etre reordonnees dans la sidebar par drag-and-drop. L'ordre est persiste via `sort_order` dans la table `bookmark_collections`. L'API `PUT /api/v1/bookmarks/collections/reorder` accepte un tableau `[{ id, sort_order }]`.

### 3.10 Collections partagees
Une collection peut etre partagee avec d'autres utilisateurs SignApps. Le menu contextuel de la collection propose `Partager...` qui ouvre un dialogue modal avec :
- Champ de recherche utilisateur (Combobox avec auto-completion par nom/email)
- Liste des collaborateurs actuels avec avatar, nom, dropdown de permission (`Lecture seule` / `Edition`), bouton supprimer (X)
- Bouton `Copier le lien` (genere un lien interne `/bookmarks/collections/:id` accessible aux membres)

Les collaborateurs voient la collection dans leur sidebar avec un badge `Partage` (icone `Users`, texte `Partage par [Proprietaire]`). En mode `Lecture seule`, le collaborateur voit les favoris mais ne peut pas en ajouter ni en retirer. En mode `Edition`, il peut ajouter/retirer des favoris et modifier l'ordre.

Table `bookmark_collection_shares` : `collection_id` (UUID FK), `user_id` (UUID FK), `permission` (enum: `read`, `write`), `created_at`. La suppression d'un collaborateur appelle `DELETE /api/v1/bookmarks/collections/:id/shares/:userId`.

---

## Categorie 4 -- Integration cross-module

### 4.1 API REST complete
Endpoints servis par le service signapps-gateway (port 3099) qui route vers la logique bookmark :

| Methode | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/v1/bookmarks` | Creer un favori. Body: `{ item_id, item_type }`. Retourne 201 + bookmark JSON. | JWT requis |
| `DELETE` | `/api/v1/bookmarks/:id` | Supprimer un favori par son UUID. Retourne 204. | JWT requis, owner only |
| `GET` | `/api/v1/bookmarks` | Lister les favoris. Query: `type`, `collection_id`, `tag`, `search`, `sort` (`created_at_desc`, `created_at_asc`, `title_asc`, `title_desc`), `cursor`, `limit` (defaut 50, max 200). Retourne `{ data: Bookmark[], next_cursor: string | null }`. | JWT requis |
| `GET` | `/api/v1/bookmarks/:id` | Obtenir un favori par ID. Retourne 200 + bookmark JSON ou 404. | JWT requis, owner only |
| `GET` | `/api/v1/bookmarks/status/:itemType/:itemId` | Verifier si un element est en favori. Retourne `{ is_bookmarked: bool, bookmark_id: string | null }`. | JWT requis |
| `POST` | `/api/v1/bookmarks/collections` | Creer une collection. Body: `{ name, description?, color?, icon? }`. Retourne 201. | JWT requis |
| `PUT` | `/api/v1/bookmarks/collections/:id` | Modifier une collection. | JWT requis, owner only |
| `DELETE` | `/api/v1/bookmarks/collections/:id` | Supprimer une collection. | JWT requis, owner only |
| `GET` | `/api/v1/bookmarks/collections` | Lister les collections de l'utilisateur (inclut partagees). | JWT requis |
| `POST` | `/api/v1/bookmarks/collections/:id/items` | Ajouter un favori a une collection. Body: `{ bookmark_id }`. | JWT requis |
| `DELETE` | `/api/v1/bookmarks/collections/:id/items/:bookmarkId` | Retirer un favori d'une collection. | JWT requis |
| `PUT` | `/api/v1/bookmarks/collections/reorder` | Reordonner les collections. Body: `[{ id, sort_order }]`. | JWT requis |
| `POST` | `/api/v1/bookmarks/export` | Exporter les favoris. Query: `format` (`json`, `csv`). Retourne le fichier. | JWT requis |
| `POST` | `/api/v1/bookmarks/import` | Importer des favoris depuis un fichier JSON. | JWT requis |

Toutes les reponses d'erreur suivent le format RFC 7807 (`AppError`) avec `status`, `title`, `detail`.

### 4.2 Positionnement du StarButton dans chaque module
Chaque module integre le `BookmarkStar` de maniere coherente :
- **Documents** (/docs) : dans la toolbar superieure du document, a droite du titre, a cote du bouton partage
- **Mail** (/mail) : dans l'en-tete du mail ouvert, a droite de l'objet; dans la liste, a droite de la date sur la ligne hover
- **Calendar** (/calendar) : dans le detail d'un evenement (drawer), en haut a droite du titre
- **Drive** (/drive) : dans la ligne de fichier (vue liste), derniere colonne; dans la carte (vue grille), coin superieur droit
- **Chat** (/chat) : au hover d'un message, dans la barre d'actions flottante (a cote de reply, react, etc.)
- **Contacts** (/contacts) : dans le detail du contact (drawer), en haut a droite
- **Tasks** (/tasks) : dans la ligne de tache, a droite du titre
- **Forms** (/forms) : dans l'en-tete du formulaire, a droite du titre
- **Wiki** (/wiki) : dans la toolbar du wiki, a droite du titre

### 4.3 Synchronisation avec les elements sources
Un listener PgEventBus ecoute les evenements :
- `entity.deleted` : quand un element source est supprime, le favori est marque comme `is_orphan = true`. La carte du favori affiche un badge rouge `Element supprime` et le lien est desactive (pas de navigation). Un bouton `Retirer` est propose a la place.
- `entity.updated` : quand le titre d'un element source change, le favori met a jour son champ `title`. Le champ `updated_at` est mis a jour.
- `entity.access_revoked` : quand l'utilisateur perd l'acces a un element, le favori reste mais le clic affiche un toast `Acces refuse -- vous n'avez plus acces a cet element`.

### 4.4 Widget favoris dans le Dashboard
Widget optionnel pour le dashboard principal (`/dashboard`). Rendu dans un `Card` avec titre `Favoris recents` et un lien `Voir tout` vers /bookmarks. Affiche les 5 derniers favoris ajoutes avec : icone module, titre (1 ligne truncate), date relative. Chaque ligne est cliquable. Le widget est configurable dans les preferences du dashboard (drag-drop grid layout). La taille minimale du widget est 2x2 dans la grille.

### 4.5 Favoris dans la recherche globale
Les elements favoris apparaissent dans les resultats de la recherche globale SignApps (`Ctrl+K` command palette) avec un badge etoile jaune a cote du titre. Les favoris beneficient d'un boost de score de +20% dans le ranking de recherche, ce qui les fait remonter par rapport aux elements non-favoris a pertinence egale.

### 4.6 Favoris dans la barre de navigation globale
Un raccourci `Favoris` (icone `Star`) dans la sidebar principale de SignApps donne acces a /bookmarks. Position dans la sidebar : apres Dashboard, avant les modules metier. Un badge chiffre rouge indique le nombre de favoris non consultes recemment (favoris ajoutes dans les 7 derniers jours non encore ouverts depuis /bookmarks). Ce badge est desactivable dans les preferences. Quand le badge est present, le survol de l'icone affiche un tooltip : `3 nouveaux favoris depuis votre derniere visite`.

### 4.7 Integration avec la commande palette
La command palette globale (`Ctrl+K`) inclut une section `Favoris recents` affichant les 5 derniers favoris ajoutes. Chaque resultat affiche l'icone du module, le titre et le type. La selection (Enter ou clic) ouvre l'element dans son module d'origine. La recherche dans la palette inclut les titres des favoris avec un boost de pertinence.

---

## Categorie 5 -- Persistance et performance

### 5.1 Schema PostgreSQL -- table `bookmarks`
```sql
CREATE TABLE bookmarks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id       UUID NOT NULL,
    item_type     VARCHAR(50) NOT NULL,  -- enum: document, mail, contact, event, task, file, note, chat_message, wiki_page, form, saved_search
    title         TEXT NOT NULL,
    preview       TEXT,
    source_url    TEXT NOT NULL,
    module        VARCHAR(50) NOT NULL,
    is_orphan     BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_bookmarks_user_item ON bookmarks(user_id, item_id, item_type);
CREATE INDEX idx_bookmarks_user_created ON bookmarks(user_id, created_at DESC);
CREATE INDEX idx_bookmarks_user_module ON bookmarks(user_id, module);
CREATE INDEX idx_bookmarks_fulltext ON bookmarks USING gin(to_tsvector('french', title || ' ' || coalesce(preview, '')));
```

### 5.2 Schema PostgreSQL -- table `bookmark_collections`
```sql
CREATE TABLE bookmark_collections (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    color         VARCHAR(7) DEFAULT '#6B7280',
    icon          VARCHAR(50),
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_collections_user_name ON bookmark_collections(user_id, name);

CREATE TABLE bookmark_collection_items (
    bookmark_id   UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    collection_id UUID NOT NULL REFERENCES bookmark_collections(id) ON DELETE CASCADE,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (bookmark_id, collection_id)
);

CREATE TABLE bookmark_collection_shares (
    collection_id UUID NOT NULL REFERENCES bookmark_collections(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission    VARCHAR(10) NOT NULL DEFAULT 'read',  -- read | write
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (collection_id, user_id)
);
```

### 5.3 Schema PostgreSQL -- table `bookmark_tags`
```sql
CREATE TABLE bookmark_tags (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name     VARCHAR(100) NOT NULL
);

CREATE UNIQUE INDEX idx_tags_user_name ON bookmark_tags(user_id, lower(name));

CREATE TABLE bookmark_tag_items (
    bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES bookmark_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (bookmark_id, tag_id)
);
```

### 5.4 Pagination par curseur
L'API liste les favoris avec pagination par curseur (cursor-based) pour des performances stables sur de grands volumes. Le curseur encode `created_at` + `id` en base64. Requete SQL : `WHERE (created_at, id) < ($cursor_ts, $cursor_id) ORDER BY created_at DESC, id DESC LIMIT $limit + 1`. Le `+1` sert a detecter la presence d'une page suivante. Taille de page par defaut : 50, max : 200. Le champ `next_cursor` est `null` quand il n'y a plus de resultats.

### 5.5 Cache en memoire
Cote client : TanStack Query avec `staleTime: 30_000` (30s) et `gcTime: 300_000` (5min). L'etat `isBookmarked` pour un element est resolu en O(1) : au chargement de la page d'un module, un appel unique `GET /api/v1/bookmarks/status/:itemType/:itemId` verifie le statut. Cote serveur : signapps-cache moka avec TTL 60 secondes pour la liste des favoris d'un utilisateur. L'invalidation se fait sur les mutations (POST/DELETE bookmark).

### 5.6 Optimistic updates detaillees
Le cycle complet d'un toggle favori :
1. L'utilisateur clique sur l'etoile
2. `onMutate` : snapshot de la valeur actuelle, update immediate du cache TanStack Query
3. L'etoile change d'apparence instantanement (< 50ms)
4. Le toast `Ajoute aux favoris` apparait
5. La mutation HTTP est envoyee en arriere-plan
6. `onSuccess` : le cache est confirme, le toast reste
7. `onError` : le cache est restore avec le snapshot, l'etoile revient a son etat precedent, le toast change en `Impossible de mettre a jour le favori`
8. `onSettled` : invalidation du query key pour re-fetch eventuel

### 5.7 Offline support via IndexedDB
Les favoris de l'utilisateur courant sont caches dans IndexedDB (table `bookmarks-cache`). Quand l'utilisateur est hors-ligne (detecte via `navigator.onLine` + event `offline`), les toggles de favoris sont stockes dans une queue IndexedDB `bookmarks-pending-ops`. Au retour en ligne (event `online`), les operations en attente sont rejouees dans l'ordre (FIFO). Si une operation echoue (element supprime entre-temps), elle est silencieusement ignoree. Un indicateur `Hors-ligne -- les modifications seront synchronisees au retour en ligne` s'affiche dans un bandeau jaune en haut de /bookmarks.

---

## Categorie 6 -- Securite et gouvernance

### 6.1 Isolation par utilisateur
Chaque utilisateur ne voit que ses propres favoris. Le middleware auth injecte `claims.sub` (user_id) dans chaque requete. Toutes les requetes SQL incluent `WHERE user_id = $1`. Les collections partagees sont accessibles en lecture ou ecriture selon les permissions definies dans `bookmark_collection_shares`. Aucun admin ne peut voir les favoris d'un autre utilisateur (sauf via audit log anonymise).

### 6.2 Respect des permissions source
Le favori n'accorde pas d'acces supplementaire. Quand l'utilisateur clique sur un favori, le backend du module cible verifie les permissions normalement. Si l'acces a ete revoque, le module retourne 403 et le frontend affiche `Acces refuse`. Le favori reste dans la liste (l'utilisateur peut le retirer manuellement). Cette verification est faite cote module cible, pas cote bookmark.

### 6.3 Audit trail
Log des actions dans la table `audit_logs` : creation de favori (`bookmark.created`), retrait (`bookmark.deleted`), creation de collection (`bookmark_collection.created`), suppression de collection (`bookmark_collection.deleted`), partage de collection (`bookmark_collection.shared`). Champs : `user_id`, `action`, `entity_id`, `entity_type`, `metadata` (JSONB avec details), `timestamp`.

### 6.4 Limite de favoris
Limites configurables par l'admin dans `/admin/settings` :
- Nombre max de favoris par utilisateur : defaut 5000, min 100, max 50000
- Nombre max de collections : defaut 100, min 10, max 1000
- Nombre max de tags : defaut 500, min 50, max 5000
Au-dela, l'API retourne HTTP 422 avec `detail: "Limite de favoris atteinte (5000/5000). Supprimez des favoris pour en ajouter."`. Le toast cote frontend affiche ce message en rouge.

### 6.5 Export et portabilite
L'utilisateur peut exporter ses favoris en JSON ou CSV via le bouton `Exporter` en haut a droite de /bookmarks. Le JSON inclut tous les champs (titre, type, URL, tags, collections, dates). Le CSV inclut les colonnes : titre, type, module, URL, tags (separes par `|`), collection, date d'ajout. L'export respecte le RGPD (droit a la portabilite). Import possible depuis un fichier JSON au meme format : l'API valide chaque ligne, ignore les doublons (meme `item_id` + `item_type`), et retourne un rapport `{ imported: 42, skipped: 3, errors: 1 }`.

### 6.6 Suppression en cascade
Quand un utilisateur est supprime (`ON DELETE CASCADE` sur `user_id`), tous ses favoris, collections, tags et partages sont supprimes. Quand un element source est supprime definitivement (purge corbeille), les favoris orphelins sont marques `is_orphan = true`. Un job CRON hebdomadaire (`bookmark_orphan_cleanup`) supprime les favoris orphelins de plus de 90 jours.

---

## Categorie 7 -- Notifications et rappels sur favoris

### 7.1 Notification de modification
Quand un element favori est modifie de maniere significative (titre change, contenu mis a jour, nouvelle version), une notification optionnelle est envoyee via signapps-notifications (port 8095). Configurable dans les preferences : `Notifier quand un favori est modifie` (on/off, defaut off). La notification contient : nom de l'element, type de modification, auteur de la modification, lien direct. Le PgEventBus emet `entity.updated` et le consumer bookmarks filtre les entites qui sont en favori pour au moins un utilisateur.

### 7.2 Rappels sur favoris
L'utilisateur peut definir un rappel sur un favori via le menu contextuel `Rappel...`. Options predefinies : `Dans 1 heure`, `Demain matin (9h)`, `La semaine prochaine (lundi 9h)`, `Date personnalisee` (date picker + time picker). Le rappel est stocke dans la table `bookmark_reminders` : `id`, `bookmark_id` (FK), `user_id`, `remind_at` (TIMESTAMPTZ), `status` (pending/sent/cancelled). Un job CRON minute verifie les rappels echus et cree une notification push via signapps-notifications.

### 7.3 Digest quotidien des favoris
Option dans les preferences utilisateur : `Recevoir un digest quotidien des favoris modifies` (off par defaut). Si active, un email est envoye a 8h (fuseau horaire de l'utilisateur) via signapps-mail listant les favoris dont l'element source a ete modifie dans les dernieres 24h. Le digest regroupe les modifications par module avec un lien direct vers chaque element.

### 7.4 Badge de favoris non consultes
Un compteur dans la sidebar /bookmarks indique le nombre de favoris ajoutes mais jamais consultes (l'utilisateur a clique l'etoile mais n'a pas encore ouvert l'element depuis la page /bookmarks). Techniquement : un champ `last_visited_at` (TIMESTAMPTZ nullable) est mis a jour quand l'utilisateur clique sur la carte du favori dans /bookmarks. Le badge compte les favoris ou `last_visited_at IS NULL`.

### 7.5 Alerte de favori orphelin
Quand un element source est supprime et qu'un favori devient orphelin, une notification est envoyee : `L'element "[titre]" que vous aviez en favori a ete supprime par [auteur]`. L'utilisateur peut retirer le favori orphelin depuis la notification (bouton `Retirer`) ou contacter le proprietaire (bouton `Contacter`).

### 7.6 Notification de collection partagee
Quand un utilisateur est ajoute a une collection partagee, il recoit une notification : `[Proprietaire] vous a ajoute a la collection "[Nom]"`. Quand un collaborateur ajoute un favori a une collection partagee en mode `write`, les autres membres recoivent : `[Auteur] a ajoute "[Titre]" a la collection "[Nom]"`. Configurable par collection via un toggle `Notifications` dans les parametres de la collection.

---

## Categorie 8 -- Statistiques et analytics

### 8.1 Compteurs par module
La page /bookmarks affiche des compteurs visuels par module source en haut de la page (sous les filtres). Rendu en badges horizontaux : `Documents (15)`, `Mail (8)`, `Calendar (3)`, etc. Les modules avec 0 favoris ne sont pas affiches. Le clic sur un compteur active le filtre correspondant.

### 8.2 Historique d'ajout
Section optionnelle dans /bookmarks > menu `Statistiques` : graphique en barres (`recharts` BarChart) montrant le nombre de favoris ajoutes par semaine sur les 12 dernieres semaines. Couleurs par module (stacked bars). Survol d'une barre affiche le tooltip avec le detail par module. Filtrable par module via les memes filtres que la page principale.

### 8.3 Favoris les plus consultes
Section dans /bookmarks : `Frequemment consultes` affichant les 10 favoris les plus ouverts. Le champ `visit_count` (INTEGER) dans la table `bookmarks` est incremente a chaque clic sur la carte. Tri par `visit_count DESC`. Affichage en liste compacte avec : icone module, titre, compteur de visites en badge. Cette section est repliable et masquable dans les preferences.

### 8.4 Favoris obsoletes
Detection automatique des favoris non consultes depuis plus de 90 jours (`last_visited_at < now() - interval '90 days'` OR `last_visited_at IS NULL AND created_at < now() - interval '90 days'`). Suggestion periodique via une banniere en haut de /bookmarks (une fois par mois) : `Vous avez [N] favoris non consultes depuis 3 mois. Nettoyer ?`. Le clic ouvre un dialogue listant les favoris obsoletes avec des checkboxes pour les retirer selectivement ou en masse.

### 8.5 Dashboard admin
L'admin dispose de statistiques agregees dans `/admin/bookmarks` : nombre total de favoris dans l'organisation, modules les plus favorises (pie chart), taux d'utilisation du systeme de favoris (% utilisateurs avec au moins 1 favori), collections les plus partagees (top 10), evolution mensuelle. Donnees anonymisees (pas de vue individuelle sauf audit log).

### 8.6 Export des statistiques
Export CSV des statistiques personnelles depuis /bookmarks > menu `Statistiques` > `Exporter`. Colonnes : module, nombre de favoris, favoris actifs, favoris orphelins, derniere activite. Compatible avec les rapports d'utilisation de la plateforme.

### 8.7 Widget analytique dans /bookmarks
En haut de la page /bookmarks, un bandeau repliable affiche un resume visuel : nombre total de favoris (chiffre grand), graphique en mini-barres des 4 dernieres semaines, top 3 modules (icones avec compteurs). Le bandeau est repliable via un chevron. L'etat replie/deploye est persiste en localStorage. Sur mobile, le bandeau est masque par defaut (espace optimise).

---

## Categorie 9 -- Raccourcis clavier et accessibilite

### 9.1 Raccourci clavier global
`B` dans n'importe quel module pour basculer le favori sur l'element actuellement en focus. Sur la page /bookmarks : `B` retire le favori selectionne. Meme comportement que le clic sur l'etoile. Feedback visuel (animation etoile) et sonore (optionnel, desactivable dans les preferences).

### 9.2 Navigation clavier dans /bookmarks
La page /bookmarks est entierement navigable au clavier :
- `Tab` : passe d'une carte a l'autre (focus visible avec outline `ring-2 ring-primary`)
- `Enter` : ouvre le favori selectionne dans son module
- `Delete` : retire le favori selectionne (dialogue de confirmation si > 1 selectionne)
- `/` : active la barre de recherche
- `Escape` : ferme la recherche ou desactive le mode selection
- `Arrow Up/Down` : navigation en vue liste
- `Arrow Left/Right` : navigation en vue grille
- `Space` : toggle la checkbox du favori en focus (mode selection)
- `Ctrl+A` : tout selectionner
- `Ctrl+Shift+E` : exporter les favoris

### 9.3 Accessibilite ARIA
Chaque etoile de favori possede un `aria-label` descriptif : `Ajouter [titre] aux favoris` ou `Retirer [titre] des favoris` selon l'etat. L'etoile utilise `role="button"` et `aria-pressed` (true/false). Les changements d'etat sont annonces via `aria-live="polite"` sur un element SR-only. Les cartes de favoris utilisent `role="article"` avec `aria-labelledby` pointant vers le titre. La liste de cartes utilise `role="list"` et chaque carte `role="listitem"`.

### 9.4 Contraste et visibilite
L'etoile remplie utilise `#FACC15` (Tailwind yellow-400) qui satisfait WCAG AA sur fond clair (`bg-card` = blanc) avec un ratio de contraste de 4.6:1. En mode sombre, l'etoile est `#FDE047` (yellow-300) sur fond fonce (`bg-card` = slate-900) avec un ratio de 5.2:1. L'etat vide utilise `stroke: muted-foreground` avec `fill: none`, contraste > 4.5:1 dans les deux modes.

### 9.5 Taille de cible tactile
L'icone etoile a une zone de clic minimale de 44x44px (norme WCAG 2.5.5) via du padding interne sur le bouton, meme quand l'icone fait 16px ou 20px. Sur mobile, la zone est 48x48px. L'espacement entre deux etoiles adjacentes (ex: vue liste) est d'au moins 8px pour eviter les clics errones.

### 9.6 Mode lecteur d'ecran
Le composant BookmarkStar annonce les changements d'etat via un element `<span role="status" aria-live="polite" class="sr-only">` : `Ajoute aux favoris` / `Retire des favoris`. Les toasts de confirmation sont egalement annonces par `aria-live`. Le focus reste sur l'etoile apres le toggle (pas de deplacement de focus inattendu).

### 9.7 Internationalisation
Tous les textes de l'interface favoris (titres, toasts, etats vides, labels de filtres) utilisent les cles i18n du systeme de traduction SignApps (fichiers `locales/{lang}/bookmarks.json`). Les dates d'ajout respectent le format locale de l'utilisateur via `date-fns/locale` (ex: `il y a 3 heures` en francais, `3 hours ago` en anglais). Les noms de modules dans les filtres sont traduits.

### 9.8 Performance perceptible
Le toggle de l'etoile doit etre instantane (< 50ms de latence perceptible). L'optimistic update garantit que l'utilisateur n'attend jamais la reponse serveur. Le chargement initial de /bookmarks doit afficher les premiers favoris en < 200ms (cache TanStack Query + prefetch). Le Largest Contentful Paint (LCP) de la page /bookmarks cible < 1.5s. Le skeleton loading (8 cartes placeholder avec `animate-pulse`) s'affiche pendant le fetch initial.

### 9.9 Mode responsive mobile
Sur mobile (< 768px) : la sidebar de collections se transforme en drawer (slide-in depuis la gauche). Les cartes passent en colonne unique (`grid-cols-1`). La barre d'actions bulk est en bas de l'ecran (sticky, full width). Les filtres par module sont dans un dropdown au lieu d'une barre horizontale. Le toggle grille/liste est masque (forcage liste sur mobile). Le drag-drop dans les collections est remplace par un menu contextuel `Deplacer vers...`.

### 9.10 Mode sombre specifique
En mode sombre, l'etoile utilise `#FDE047` (yellow-300) au lieu de `#FACC15` pour un meilleur contraste sur fond fonce. Les cartes utilisent `bg-card` (slate-900). Les badges de tags utilisent `border-border` (visible sur fond sombre). Les icones de module conservent leurs couleurs vives (pas d'attenuation). Le toast de confirmation utilise un fond `bg-card` avec bordure `border` au lieu du blanc.

---

## Categorie 10 -- Zustand store et state management

### 10.1 Store bookmarks
Le store Zustand `useBookmarksStore` gere l'etat global des favoris :
```typescript
interface BookmarksState {
  bookmarks: Bookmark[];
  collections: Collection[];
  tags: Tag[];
  activeCollectionId: string | null;
  activeModuleFilters: string[];
  searchQuery: string;
  viewMode: 'grid' | 'list';
  selectedIds: Set<string>;
  isSelectionMode: boolean;
}
```
Le store est hydrate au chargement de /bookmarks via TanStack Query (`useQuery` avec `initialData` du SSR). Les mutations (toggle, create collection, etc.) passent par TanStack Query `useMutation` et mettent a jour le store via `onSuccess`. Le store persiste `viewMode` et `activeCollectionId` dans localStorage via le middleware `persist` de Zustand.

### 10.2 Prefetch et SSR
La page /bookmarks utilise le prefetch TanStack Query dans le `loader` Next.js (App Router). Le serveur pre-charge les 50 premiers favoris et les injecte dans le `dehydratedState`. Le client hydrate le cache sans flash de contenu. Le premier rendu est complet en < 200ms apres navigation. Les collections et tags sont egalement pre-charges. Le `staleTime` du SSR est de 60 secondes pour eviter les re-fetch inutiles pendant la navigation SPA.

### 10.3 Skeleton loading
Pendant le chargement initial de /bookmarks, 8 cartes skeleton sont affichees en grille (ou 8 lignes skeleton en mode liste). Chaque skeleton utilise le composant `Skeleton` de shadcn/ui avec `animate-pulse`. Les skeletons reproduisent la forme des cartes reelles : rectangle pour le titre, deux lignes pour l'apercu, petit cercle pour l'icone module, badges rectangulaires pour les tags. Transition du skeleton vers le contenu reel : fade-out du skeleton + fade-in du contenu en 200ms.

### 10.4 Error states et edge cases
- **Favori sur element supprime pendant la requete** : le POST retourne 404, toast `L'element n'existe plus`, l'etoile revient a l'etat vide
- **Double clic rapide sur l'etoile** : le debounce de 300ms empeche deux requetes simultanees. Le second clic est ignore pendant le loading de la mutation
- **Perte de connexion pendant le toggle** : rollback optimistic + toast `Connexion perdue. Modification non enregistree.`
- **Limite de favoris atteinte** : le POST retourne 422, toast rouge `Limite de 5000 favoris atteinte. Supprimez des favoris.`, l'etoile revient a l'etat vide
- **Collection supprimee pendant l'ajout** : le POST retourne 404, toast `Cette collection n'existe plus`, refresh automatique de la liste des collections
- **Tag avec caracteres speciaux** : les tags sont normalises (trim, lowercase, max 100 chars). Les caracteres `<>{}` sont rejetes (400)

### 10.5 Animations et micro-interactions
- **Toggle etoile** : scale 1.0 -> 1.3 -> 1.0 en 200ms (ease-out), couleur transition 150ms
- **Toast entree** : slide-up depuis le bas, 200ms
- **Toast sortie** : fade-out 300ms
- **Carte hover** : shadow-md transition 150ms, scale 1.0 -> 1.01 en 100ms
- **Drag start** : opacity 0.6, rotate 2deg
- **Drag over collection** : collection background pulse bg-accent
- **Drop** : scale 1.0 -> 1.05 -> 1.0 en 200ms
- **Bulk selection** : checkbox apparait avec scale-up 100ms
- **Barre d'actions bulk** : slide-up depuis le bas, 200ms
- **Suppression de favori** : fade-out + scale-down en 200ms, les cartes restantes se repositionnent en 300ms

---

## References OSS

**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License -- ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Linkding** (github.com/sissbruecker/linkding) | **MIT** | Bookmark manager self-hosted en Python/Django. Pattern de tags, recherche, archivage, bulk edit. UI simple et efficace. |
| **Shiori** (github.com/go-shiori/shiori) | **MIT** | Bookmark manager en Go. Pattern de stockage, cache de contenu, API REST, archivage offline. Architecture backend legere. |
| **@dnd-kit/core** (github.com/clauderic/dnd-kit) | **MIT** | Drag-and-drop toolkit pour React. Pattern pour le reordonnancement des favoris et le drag into collections. Accessible, performant. |
| **Fuse.js** (github.com/krisk/Fuse) | **Apache-2.0** | Recherche fuzzy client-side. Pattern pour la recherche instantanee dans les favoris sans appel serveur. |
| **Zustand** (github.com/pmndrs/zustand) | **MIT** | State management pour le store bookmarks (optimistic updates, cache local). Deja utilise dans SignApps. |
| **TanStack Query** (github.com/TanStack/query) | **MIT** | Data fetching et cache. Pattern pour les optimistic updates du toggle favori. Deja utilise dans SignApps. |
| **Sonner** (github.com/emilkowalski/sonner) | **MIT** | Toast notifications. Deja utilise dans SignApps pour les toasts de confirmation. |
| **recharts** (github.com/recharts/recharts) | **MIT** | Graphiques React pour les statistiques d'utilisation des favoris. |
| **idb-keyval** (github.com/nicehash/idb-keyval) | **Apache-2.0** | Wrapper IndexedDB simple. Pattern pour le cache offline des favoris. |

---

## Assertions E2E cles (a tester)

- Navigation vers /bookmarks affiche le titre `Favoris` et le sous-titre `Vos elements marques comme favoris dans tous les modules`
- Etat vide : message `Aucun favori` avec instruction sur l'etoile visible dans les deux onglets
- Clic sur l'etoile d'un document dans /docs : toast `Ajoute aux favoris`, etoile remplie jaune, animation scale
- Navigation vers /bookmarks : le document apparait dans l'onglet `Recent` avec icone module Documents
- Clic sur l'etoile remplie dans /docs : toast `Retire des favoris`, etoile vide, favori disparait de /bookmarks
- L'onglet `Tous` affiche le compteur correct (ex: `Tous (3)`)
- Clic sur une carte de favori dans /bookmarks : navigation vers l'element source dans son module
- Filtrer par module (clic sur icone Documents) : seuls les favoris de type document sont affiches
- Recherche par titre dans la barre de recherche : resultats filtres en temps reel avec highlight des termes
- Creation d'une collection via le bouton `+ Nouvelle collection` : dialogue modal, saisie du nom, la collection apparait dans la sidebar avec compteur 0
- Drag-drop d'un favori dans une collection : le favori est classe, compteur incremente, toast de confirmation
- Renommage d'une collection via clic droit > Renommer : edition inline, Enter valide, nom mis a jour
- Suppression d'une collection : dialogue de confirmation, les favoris deviennent non classes
- Ajout d'un tag sur un favori : le tag apparait sur la carte et dans le dropdown de filtres
- Toggle vue grille/liste : le layout change sans perte de donnees, preference persistee
- Selection multiple + action `Retirer des favoris` : les favoris selectionnes disparaissent, barre d'actions visible
- Shift+clic selectionne une plage continue de favoris
- Suppression d'un element source (ex: document supprime) : le favori affiche badge `Element supprime`
- Le widget Dashboard affiche les 5 derniers favoris avec liens fonctionnels
- L'etoile dans le module Mail fonctionne : clic, favori cree avec type `mail`
- L'etoile dans le module Calendar fonctionne : clic, favori cree avec type `event`
- Export JSON des favoris : fichier telecharge contenant tous les favoris avec metadonnees
- Export CSV des favoris : fichier telecharge avec colonnes titre, type, module, URL, tags, date
- Import JSON de favoris : les favoris importes apparaissent dans /bookmarks, doublons ignores
- Collection partagee : le destinataire voit la collection dans sa sidebar /bookmarks avec badge `Partage`
- Raccourci `B` sur un document en focus : toggle favori, meme effet que clic sur etoile
- Rappel sur un favori : definir rappel `demain`, notification recue le lendemain avec lien
- Compteurs par module dans /bookmarks : le badge Documents affiche le nombre correct
- Section `Frequemment consultes` affiche les favoris les plus ouverts tries par frequence
- Detection de favoris obsoletes : apres 90 jours sans consultation, banniere de suggestion de nettoyage
- Accessibilite : navigation au clavier dans /bookmarks avec Tab, Enter, Delete fonctionnels
- Etoile avec aria-label correct : `Ajouter [titre] aux favoris` annonce par lecteur d'ecran
- Mode sombre : l'etoile doree est visible et contrastee sur fond fonce (ratio > 4.5:1)
- Favori de recherche : sauvegarder une recherche, la retrouver dans /bookmarks, clic re-execute la query
- Actions groupees : selectionner 3 favoris, ajouter un tag en bulk, tag present sur les 3 cartes
- Annulation du retrait : clic `Retirer`, clic `Annuler` dans les 5s, favori restaure
- Optimistic update : clic etoile, changement instantane, erreur reseau simulee, rollback automatique
- Offline : desactiver le reseau, clic etoile, bandeau jaune affiche, retour en ligne, sync automatique
- Scroll infini : charger 60 favoris, scroller en bas, 50 supplementaires charges automatiquement
- Collection avec couleur : la pastille de couleur est affichee dans la sidebar et sur les cartes
- Reordonnancement drag-drop dans une collection : l'ordre persiste apres rechargement de la page
- Reordonnancement des collections dans la sidebar : l'ordre persiste apres rechargement
