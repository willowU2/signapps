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

1. **Agregation cross-module** — les favoris sont un hub centralise qui rassemble les elements marques depuis n'importe quel module SignApps (documents, mails, contacts, evenements, taches, fichiers, notes, messages chat, pages wiki). Un seul endroit pour tout retrouver.
2. **Marquage en un clic** — ajouter un favori se fait via une icone etoile presente sur chaque element dans chaque module. Un clic = favori. Un second clic = retrait. Zero formulaire, zero dialogue.
3. **Contexte preserve** — chaque favori conserve le lien vers l'element source, son type (icone module), son titre, sa date d'ajout, et un apercu contextuel (extrait de texte, miniature, expediteur). Le clic ouvre directement l'element dans son module d'origine.
4. **Organisation legere** — les favoris supportent des tags personnalises et un systeme de collections (dossiers) pour regrouper les favoris par theme ou projet. Pas de hierarchie complexe : un niveau de collection suffit.
5. **Recherche et filtrage instantanes** — barre de recherche full-text sur les titres et descriptions des favoris, plus filtres par module source, par tag, par collection, et par date d'ajout.
6. **Synchronisation temps reel** — quand un element source est modifie (titre change, document supprime), le favori reflète le changement. Si l'element source est supprime, le favori affiche un etat "element supprime" avec option de retrait.

---

## Categorie 1 — Marquage et collecte des favoris

### 1.1 Icone etoile universelle
Chaque element affichable dans les modules SignApps (document, mail, contact, evenement, tache, fichier Drive, note Keep, message chat, page wiki, formulaire) possede une icone etoile cliquable. Etat vide = non favori. Etat rempli jaune = favori. Toggle au clic. L'icone est positionnee de maniere coherente dans chaque module (coin superieur droit de la carte ou debut de la ligne en vue liste).

### 1.2 Ajout rapide sans interruption
Le clic sur l'etoile ajoute le favori immediatement sans dialogue ni confirmation. Un toast discret apparait brievement : `Ajoute aux favoris` avec un lien `Annuler`. L'annulation retire le favori dans les 5 secondes.

### 1.3 Retrait de favori
Un second clic sur l'etoile (deja remplie) retire le favori. Toast : `Retire des favoris` avec lien `Annuler`. Le retrait est egalement possible depuis la page /bookmarks via un bouton etoile ou un menu contextuel `Retirer des favoris`.

### 1.4 Metadonnees capturees automatiquement
Lors de l'ajout, le systeme enregistre : `item_id` (UUID de l'element source), `item_type` (enum : document, mail, contact, event, task, file, note, chat_message, wiki_page, form), `title` (titre de l'element au moment de l'ajout), `preview` (extrait texte ou miniature), `source_url` (route interne vers l'element), `module` (nom du module source), `created_at` (timestamp d'ajout du favori), `user_id` (proprietaire du favori).

### 1.5 Favoris de recherche
En plus des elements, l'utilisateur peut sauvegarder des recherches frequentes comme favoris. La recherche sauvegardee stocke la query, les filtres actifs, et le module source. Le clic sur un favori de recherche re-execute la recherche avec les memes parametres.

### 1.6 Favoris depuis le menu contextuel
En plus de l'etoile, chaque element propose dans son menu contextuel (clic droit ou bouton `...`) l'option `Ajouter aux favoris` / `Retirer des favoris`. Ce menu est le point d'entree secondaire pour les elements ou l'etoile n'est pas visible (par ex. dans les vues compactes).

---

## Categorie 2 — Page Favoris (/bookmarks)

### 2.1 En-tete et description
La page affiche le titre `Favoris` et le sous-titre `Vos elements marques comme favoris dans tous les modules`. Un compteur indique le nombre total de favoris.

### 2.2 Onglets de navigation
Deux onglets principaux :
- **Recent** — affiche les favoris tries par date d'ajout decroissante, avec un regroupement par periode (Aujourd'hui, Cette semaine, Ce mois, Plus ancien). Limite aux 50 derniers par defaut, pagination par scroll infini.
- **Tous (N)** — affiche tous les favoris avec le compteur total entre parentheses. Tri par defaut : date d'ajout decroissante. Options de tri : titre A-Z, module, date d'ajout.

### 2.3 Etat vide
Quand aucun favori n'existe, affichage centre : icone etoile grisee, texte `Aucun favori`, sous-texte `Cliquez sur l'etoile dans n'importe quel module pour ajouter un favori`. Cet etat est visible dans les deux onglets.

### 2.4 Carte de favori
Chaque favori est affiche sous forme de carte contenant : icone du module source (couleur codee), titre de l'element, extrait/apercu (2 lignes max), date d'ajout (`il y a 3 heures`), tags assignes, bouton etoile (pour retirer). Le clic sur la carte ouvre l'element dans son module d'origine.

### 2.5 Vue liste alternative
Toggle grille/liste en haut a droite. La vue liste affiche les favoris en lignes avec colonnes : icone module, titre, type, date d'ajout, tags. Plus compacte, adaptee aux utilisateurs avec beaucoup de favoris.

### 2.6 Filtres par module
Barre de filtres horizontale sous les onglets avec les icones de chaque module. Clic sur un module filtre les favoris de ce module uniquement. Multi-selection possible (ex : Documents + Mail). Un badge sur chaque icone indique le nombre de favoris dans ce module.

### 2.7 Recherche dans les favoris
Barre de recherche en haut de la page. Filtre en temps reel sur le titre et la description des favoris. Compatible avec les filtres de module actifs. Resultats mis en surbrillance.

### 2.8 Actions groupees (bulk)
Cases a cocher sur chaque carte. Selection multiple puis actions groupees dans une barre d'actions : `Retirer des favoris`, `Ajouter a une collection`, `Ajouter un tag`, `Exporter`. Bouton `Tout selectionner` / `Deselectionner tout`.

---

## Categorie 3 — Collections et organisation

### 3.1 Collections de favoris
L'utilisateur peut creer des collections pour regrouper ses favoris par theme, projet ou contexte. Une collection a un nom, une couleur optionnelle et une description. Les collections sont listees dans la sidebar gauche de la page /bookmarks.

### 3.2 Ajout a une collection
Lors de l'ajout d'un favori (ou apres), l'utilisateur peut assigner le favori a une ou plusieurs collections via un menu dropdown. Un favori sans collection est classe dans la vue `Non classes`.

### 3.3 Sidebar de collections
Sidebar gauche avec :
- `Tous les favoris` (vue par defaut)
- `Recent` (raccourci)
- `Non classes` (favoris sans collection)
- Liste des collections avec compteur
- Bouton `+ Nouvelle collection`
La sidebar est repliable.

### 3.4 Tags personnalises
Systeme de tags libres assignables a chaque favori. Auto-completion sur les tags existants. Filtre par tag dans la sidebar ou via la barre de filtres. Un favori peut avoir jusqu'a 10 tags.

### 3.5 Drag-and-drop pour organiser
Les favoris peuvent etre glisses-deposes entre collections dans la sidebar. Reordonnancement libre a l'interieur d'une collection par drag-and-drop. L'ordre personnalise est persiste cote serveur.

### 3.6 Collections partagees
Une collection peut etre partagee avec d'autres utilisateurs SignApps (lecture seule ou edition). Les collaborateurs voient la collection dans leur sidebar. Utile pour les listes de ressources d'equipe.

---

## Categorie 4 — Integration cross-module

### 4.1 API Favori generique
Endpoint REST unique pour le marquage : `POST /api/v1/bookmarks` avec body `{ item_id, item_type }`. `DELETE /api/v1/bookmarks/:id` pour le retrait. `GET /api/v1/bookmarks` avec query params `module`, `collection_id`, `tag`, `search`, `sort`, `page`. L'API est consommee par tous les modules frontend.

### 4.2 Hook React `useBookmark`
Hook partage `useBookmark(itemId, itemType)` retournant `{ isBookmarked, toggle, isLoading }`. Utilise React Query avec optimistic updates. Chaque module importe ce hook pour gerer l'etoile.

### 4.3 Composant `BookmarkStar`
Composant React partage `<BookmarkStar itemId={id} itemType="document" />` encapsulant l'icone etoile, le hook, et le toast. Importe par tous les modules pour garantir la coherence visuelle et comportementale.

### 4.4 Synchronisation avec les elements sources
Un listener PgEventBus ecoute les evenements de suppression et de modification des elements. Quand un element source est supprime, le favori est marque comme `orphan` avec un badge `Element supprime`. Quand le titre change, le favori met a jour son titre.

### 4.5 Favoris dans la barre de navigation globale
Un raccourci `Favoris` (icone etoile) dans la sidebar principale de SignApps donne acces a /bookmarks. Un badge indique le nombre de favoris non consultes recemment (optionnel, configurable).

### 4.6 Widget favoris dans le Dashboard
Widget optionnel pour le dashboard principal affichant les 5 derniers favoris ajoutes avec lien direct. Configurable par l'utilisateur dans les preferences du dashboard.

### 4.7 Favoris dans la recherche globale
Les favoris apparaissent dans les resultats de la recherche globale SignApps avec un badge etoile. Les elements favoris sont priorises dans le ranking de recherche (boost de score).

---

## Categorie 5 — Persistance et performance

### 5.1 Schema PostgreSQL
Table `bookmarks` : `id` (UUID PK), `user_id` (UUID FK users), `item_id` (UUID), `item_type` (VARCHAR enum), `title` (TEXT), `preview` (TEXT nullable), `source_url` (TEXT), `module` (VARCHAR), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ), `is_orphan` (BOOLEAN default false). Index unique sur `(user_id, item_id, item_type)`. Index sur `user_id` et `created_at`.

### 5.2 Table collections
Table `bookmark_collections` : `id` (UUID PK), `user_id` (UUID FK), `name` (VARCHAR 255), `description` (TEXT nullable), `color` (VARCHAR 7 nullable), `sort_order` (INT), `created_at` (TIMESTAMPTZ). Table de jointure `bookmark_collection_items` : `bookmark_id` (UUID FK), `collection_id` (UUID FK), `sort_order` (INT).

### 5.3 Table tags
Table `bookmark_tags` : `id` (UUID PK), `user_id` (UUID FK), `name` (VARCHAR 100). Table de jointure `bookmark_tag_items` : `bookmark_id` (UUID FK), `tag_id` (UUID FK). Index unique sur `(user_id, name)` pour eviter les doublons de tags par utilisateur.

### 5.4 Pagination par curseur
L'API liste les favoris avec pagination par curseur (cursor-based) pour des performances stables sur de grands volumes. Le curseur encode `created_at` + `id`. Taille de page par defaut : 50, max : 200.

### 5.5 Cache en memoire
Les favoris de l'utilisateur courant sont caches cote client (React Query, staleTime 30s) et cote serveur (signapps-cache moka, TTL 60s). L'etat `isBookmarked` pour un element est resolu en O(1) via un Set en memoire.

### 5.6 Optimistic updates
Les operations de toggle favori sont appliquees immediatement en UI. Rollback automatique en cas d'erreur backend. Le toast d'annulation utilise le meme mecanisme de rollback.

---

## Categorie 6 — Securite et gouvernance

### 6.1 Isolation par utilisateur
Chaque utilisateur ne voit que ses propres favoris. Les collections partagees sont en lecture/ecriture selon les permissions. Aucun admin ne peut voir les favoris d'un autre utilisateur (sauf audit log).

### 6.2 Respect des permissions source
Le favori n'accorde pas d'acces supplementaire. Si l'utilisateur perd l'acces a un document, le favori reste mais le clic affiche `Acces refuse`. Le backend verifie les permissions de l'element source a chaque ouverture.

### 6.3 Audit trail
Log des actions : creation de favori, retrait, creation de collection, partage de collection. Visible dans le panneau d'audit admin. Champs : `user_id`, `action`, `bookmark_id`, `timestamp`.

### 6.4 Limite de favoris
Limite configurable par l'admin : nombre max de favoris par utilisateur (defaut : 5000), nombre max de collections (defaut : 100), nombre max de tags (defaut : 500). Au-dela, message d'erreur explicite avec suggestion de nettoyage.

### 6.5 Export et portabilite
L'utilisateur peut exporter ses favoris en JSON ou CSV (titre, type, URL, tags, collection, date). L'export respecte le RGPD (droit a la portabilite). Import possible depuis un fichier JSON au meme format.

### 6.6 Suppression en cascade
Quand un utilisateur est supprime, tous ses favoris, collections et tags sont supprimes. Quand un element source est supprime definitivement (purge corbeille), les favoris orphelins sont marques pour nettoyage.

---

## Categorie 7 — Notifications et rappels sur favoris

### 7.1 Notification de modification
Quand un element favori est modifie de maniere significative (titre change, contenu mis a jour, nouvelle version), une notification optionnelle est envoyee a l'utilisateur. Configurable dans les preferences : `Notifier quand un favori est modifie` (on/off). La notification indique : nom de l'element, type de modification, auteur de la modification.

### 7.2 Rappels sur favoris
L'utilisateur peut definir un rappel sur un favori : `Me rappeler dans 1h / demain / la semaine prochaine / date personnalisee`. Le rappel cree une notification push (via signapps-notifications) avec le lien vers l'element. Utile pour les articles a lire plus tard ou les taches a revisiter.

### 7.3 Digest quotidien des favoris
Option dans les preferences : recevoir un email digest quotidien listant les favoris modifies dans les dernieres 24h. Le digest regroupe les modifications par module avec un resume pour chaque element. Desactivable.

### 7.4 Badge de favoris non consultes
Un compteur dans la sidebar indique le nombre de favoris ajoutes mais jamais consultes (l'utilisateur a clique etoile mais n'a pas encore ouvert l'element depuis la page /bookmarks). Le badge disparait quand l'utilisateur consulte l'element.

### 7.5 Alerte de favori orphelin
Quand un element source est supprime et qu'un favori devient orphelin, une notification est envoyee : `L'element "Rapport Q4" que vous aviez en favori a ete supprime`. L'utilisateur peut retirer le favori orphelin ou contacter le proprietaire.

### 7.6 Notification de collection partagee
Quand un collaborateur ajoute un favori a une collection partagee, les autres membres recoivent une notification : `Alice a ajoute "Budget 2024" a la collection "Projet Alpha"`. Configurable par collection.

---

## Categorie 8 — Statistiques et analytics

### 8.1 Compteurs par module
La page /bookmarks affiche des compteurs visuels par module source : nombre de favoris Documents, Mail, Calendar, Drive, etc. Affichage en barre horizontale ou en badges colores. Permet a l'utilisateur de voir la repartition de ses favoris.

### 8.2 Historique d'ajout
Graphique chronologique montrant le nombre de favoris ajoutes par jour/semaine/mois. Permet de visualiser les periodes d'activite intense (ex: lors d'un projet). Filtrable par module.

### 8.3 Favoris les plus consultes
Section optionnelle dans /bookmarks : `Frequemment consultes` affichant les 10 favoris les plus ouverts. Tri par nombre d'ouvertures. Utile pour identifier les ressources les plus importantes pour l'utilisateur.

### 8.4 Favoris obsoletes
Detection automatique des favoris non consultes depuis plus de 90 jours. Suggestion periodique : `Vous avez 12 favoris non consultes depuis 3 mois. Voulez-vous les archiver ?`. L'archivage les deplace dans une section `Archives` sans les supprimer.

### 8.5 Dashboard admin
L'admin dispose de statistiques agregees : nombre total de favoris dans l'organisation, modules les plus favorises, taux d'utilisation du systeme de favoris, collections les plus partagees. Donnees anonymisees (pas de vue individuelle sauf audit).

### 8.6 Export des statistiques
Export CSV des statistiques personnelles (nombre de favoris par module, historique d'ajout, collections). Compatible avec les rapports d'utilisation de la plateforme.

---

## Categorie 9 — Raccourcis clavier et accessibilite

### 9.1 Raccourci clavier global
`Ctrl+D` (ou `Cmd+D` sur macOS) dans n'importe quel module pour basculer le favori sur l'element actuellement selectionne ou en focus. Meme comportement que le clic sur l'etoile. Feedback visuel et sonore (optionnel).

### 9.2 Navigation clavier dans /bookmarks
La page /bookmarks est entierement navigable au clavier : Tab pour passer d'une carte a l'autre, Enter pour ouvrir un favori, Delete pour retirer un favori (avec confirmation), Ctrl+F pour activer la recherche, fleches pour naviguer dans les filtres.

### 9.3 Accessibilite ARIA
Chaque etoile de favori possede un `aria-label` descriptif : `Ajouter [titre] aux favoris` ou `Retirer [titre] des favoris`. Les etats sont annonces par les lecteurs d'ecran. Les cartes de favoris utilisent `role="article"` avec `aria-labelledby`.

### 9.4 Contraste et visibilite
L'etoile remplie utilise un jaune satisfaisant les criteres WCAG AA (ratio de contraste > 4.5:1 sur fond clair et fond sombre). En mode sombre, l'etoile est doree sur fond fonce. L'etat vide utilise une bordure visible.

### 9.5 Taille de cible tactile
L'icone etoile a une zone de clic minimale de 44x44px (norme WCAG 2.5.5) pour les interfaces tactiles. Sur mobile, la zone est encore plus grande (48x48px).

### 9.6 Mode lecteur d'ecran
Le composant BookmarkStar annonce les changements d'etat via `aria-live="polite"` : `Ajoute aux favoris` / `Retire des favoris`. Les toasts de confirmation sont egalement annonces.

### 9.7 Internationalisation
Tous les textes de l'interface favoris (titres, toasts, etats vides, labels de filtres) utilisent les cles i18n du systeme de traduction SignApps. Les dates d'ajout respectent le format locale de l'utilisateur (ex: `il y a 3 heures` en francais, `3 hours ago` en anglais).

### 9.8 Performance perceptible
Le toggle de l'etoile doit etre instantane (< 50ms de latence perceptible). L'optimistic update garantit que l'utilisateur n'attend jamais la reponse serveur. Le chargement initial de /bookmarks doit afficher les premiers favoris en < 200ms (cache React Query + prefetch).

---

## References OSS

**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Raindrop.io** (raindrop.io) | Proprietaire | Reference UX uniquement via documentation publique. Collections, tags, vues multiples, recherche. |
| **Linkding** (github.com/sissbruecker/linkding) | **MIT** | Bookmark manager self-hosted en Python/Django. Pattern de tags, recherche, archivage, bulk edit. UI simple et efficace. |
| **Shiori** (github.com/go-shiori/shiori) | **MIT** | Bookmark manager en Go. Pattern de stockage, cache de contenu, API REST, archivage offline. Architecture backend legere. |
| **Bentobox** (github.com/nicehash/Bento) | **MIT** | Bookmark startpage. Pattern d'organisation visuelle en grille, drag-drop, categories. |
| **xBrowserSync** (github.com/nicehash/xBrowserSync) | **MIT** | Sync bookmarks cross-browser. Pattern de synchronisation, chiffrement cote client, API REST simple. |
| **react-beautiful-dnd** (github.com/atlassian/react-beautiful-dnd) | **Apache-2.0** | Drag-and-drop accessible pour React. Pattern pour le reordonnancement des favoris et collections. |
| **Zustand** (github.com/pmndrs/zustand) | **MIT** | State management pour le store bookmarks (optimistic updates, cache local). Deja utilise dans SignApps. |
| **TanStack Query** (github.com/TanStack/query) | **MIT** | Data fetching et cache. Pattern pour les optimistic updates du toggle favori. Deja utilise dans SignApps. |

---

## Assertions E2E cles (a tester)

- Navigation vers /bookmarks affiche le titre `Favoris` et le sous-titre `Vos elements marques comme favoris dans tous les modules`
- Etat vide : message `Aucun favori` avec instruction sur l'etoile visible dans les deux onglets
- Clic sur l'etoile d'un document dans /docs → toast `Ajoute aux favoris`, etoile remplie
- Navigation vers /bookmarks → le document apparait dans l'onglet `Recent` avec icone module Documents
- Clic sur l'etoile remplie dans /docs → toast `Retire des favoris`, etoile vide, favori disparait de /bookmarks
- L'onglet `Tous` affiche le compteur correct (ex: `Tous (3)`)
- Clic sur une carte de favori dans /bookmarks → navigation vers l'element source dans son module
- Filtrer par module (clic sur icone Documents) → seuls les favoris de type document sont affiches
- Recherche par titre dans la barre de recherche → resultats filtres en temps reel
- Creation d'une collection → elle apparait dans la sidebar avec compteur 0
- Drag-drop d'un favori dans une collection → le favori est classe, compteur incremente
- Ajout d'un tag sur un favori → le tag apparait sur la carte et dans les filtres
- Toggle vue grille/liste → le layout change sans perte de donnees
- Selection multiple + action `Retirer des favoris` → les favoris selectionnes disparaissent
- Suppression d'un element source (ex: document supprime) → le favori affiche `Element supprime`
- Le widget Dashboard affiche les 5 derniers favoris avec liens fonctionnels
- L'etoile dans le module Mail fonctionne : clic → favori cree avec type `mail`
- L'etoile dans le module Calendar fonctionne : clic → favori cree avec type `event`
- Export JSON des favoris → fichier telecharge contenant tous les favoris avec metadonnees
- Collection partagee : le destinataire voit la collection dans sa sidebar /bookmarks
- Raccourci Ctrl+D sur un document en focus → toggle favori, meme effet que clic sur etoile
- Rappel sur un favori : definir rappel `demain` → notification recue le lendemain avec lien
- Compteurs par module dans /bookmarks : le badge Documents affiche le nombre correct
- Section `Frequemment consultes` affiche les favoris les plus ouverts tries par frequence
- Detection de favoris obsoletes : apres 90 jours sans consultation → suggestion d'archivage
- Accessibilite : navigation au clavier dans /bookmarks avec Tab, Enter, Delete fonctionnels
- Etoile avec aria-label correct : `Ajouter [titre] aux favoris` annonce par lecteur d'ecran
- Mode sombre : l'etoile doree est visible et contrastee sur fond fonce
- Favori de recherche : sauvegarder une recherche, la retrouver dans /bookmarks, clic re-execute la query
- Actions groupees : selectionner 3 favoris, ajouter un tag en bulk → tag present sur les 3 cartes
- Annulation du retrait : clic `Retirer`, clic `Annuler` dans les 5s → favori restaure
- Import JSON de favoris → les favoris importes apparaissent dans /bookmarks avec metadonnees correctes
- Collection avec couleur : la couleur est affichee dans la sidebar et sur les cartes de la collection
- Reordonnancement drag-drop dans une collection → l'ordre persiste apres rechargement de la page
