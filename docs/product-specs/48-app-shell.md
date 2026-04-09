# Module App Shell & Launcher -- Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Google Workspace App Launcher** | Grille 3x3 iconique (waffle menu), acces rapide aux 20+ apps Google, raccourcis recents, barre de recherche integree, tri par frequence d'utilisation, badge de notification sur les icones, ouverture dans un nouvel onglet, switch rapide entre comptes |
| **Microsoft 365 Waffle Menu** | Panneau lateral gauche avec apps epinglees en haut et "Toutes les apps" en dessous, recherche d'apps, personnalisation de l'ordre des apps, integration avec les apps recentes, badges de notification, deep links vers les fichiers recents par app |
| **Notion Sidebar** | Navigation hierarchique avec pages imbriquees, sections favorites, espaces de travail, toggle collapse, drag-and-drop pour reordonner, quick search (Cmd+K), breadcrumb navigation, icones et emojis personnalisables, section "Private" vs "Shared" |
| **Slack Sidebar** | Channels organises par sections custom, section "Starred", section "Direct Messages", unread badge counts, drag-and-drop entre sections, collapse/expand par section, quick switcher (Cmd+K), status presence indicators |
| **macOS Spotlight / Launchpad** | Recherche universelle instantanee (fichiers, apps, contacts, calculs, web), Launchpad avec grille paginated, dossiers d'apps par drag, recherche fuzzy, resultats categorises, raccourci clavier global (Cmd+Space), suggestions intelligentes |
| **Windows Start Menu** | Apps epinglees en grille, section recommandee (fichiers recents), recherche universelle, groupes d'apps, live tiles avec apercu, acces rapide aux parametres, power menu, tous les programmes en liste alphabetique |
| **Zoho One App Drawer** | 45+ apps dans un panneau lateral, categories metier (Sales, Marketing, HR, IT), recherche, favoris, apps recentes, toggle entre vue grille et liste, indicateur de statut par app (actif/inactif), role-based visibility |
| **Nextcloud App Launcher** | Menu hamburger avec grille d'apps, apps installees depuis le store, icones SVG, recherche rapide, section admin separee, badges de notification, ordre personnalisable |

## Principes directeurs

1. **Hub centralise** -- la page /all-apps est le point d'entree unique vers les 44+ applications SignApps. Elle doit permettre de trouver n'importe quelle app en moins de 3 secondes via recherche, filtrage par categorie, ou scan visuel de la grille.
2. **Navigation adaptative** -- la sidebar, le header, la bottom nav mobile et la command palette forment un systeme de navigation coherent. Chaque composant est optimise pour son contexte (desktop sidebar detaillee, mobile bottom nav 5 onglets, command palette pour les power users).
3. **Personnalisation persistante** -- les apps epinglees, les labels, les groupes de workspace et l'ordre de la sidebar sont persistes par utilisateur. Chaque utilisateur configure son shell selon ses habitudes sans impacter les autres.
4. **Zero latence perceptible** -- le shell (header, sidebar, bottom nav) est rendu cote serveur ou cache agressivement. Les transitions entre apps utilisent le prefetching Next.js. Le skeleton loading est immediat.
5. **Accessibilite clavier complete** -- chaque element du shell est navigable au clavier (Tab, Enter, Escape, fleches). La command palette (Cmd+K) permet de naviguer sans souris. Les raccourcis clavier sont documentes.
6. **Responsive first** -- le layout s'adapte du mobile (320px) au desktop 4K. La sidebar collapse en icones, la bottom nav remplace la sidebar sur mobile, les grilles passent de 1 a 4 colonnes.

---

## Categorie 1 -- Page All Apps (/all-apps)

### 1.1 En-tete de page
Titre `Toutes les Applications` avec sous-titre `Lancez vos applications intelligentes depuis votre portail centralise.`. L'en-tete reste fixe en haut de la page lors du scroll. Le titre utilise la classe `text-3xl font-bold` et le sous-titre `text-muted-foreground`.

### 1.2 Barre de recherche
Champ de recherche avec icone loupe (Search de Lucide), placeholder `Rechercher une application...`. Filtre en temps reel sur le nom, la description et la categorie de chaque app. Debounce de 150ms via `useDebounce` hook. Quand la recherche est active, la vue groupee par categorie bascule en vue plate (grille unique sans separateurs de categorie). Effacer le champ (bouton X ou Escape) revient a la vue groupee. Le champ supporte le raccourci `/` quand focus est hors d'un input pour focus rapide.

### 1.3 Filtres par categorie
Rangee de boutons pill/badge horizontaux : `Toutes`, `Productivite`, `Communication`, `Organisation`, `Business`, `Infrastructure`, `Administration`, `Avance`. Le bouton actif est en style `default` (rempli), les autres en `outline`. Clic sur une categorie filtre la grille. Clic sur `Toutes` revient a la vue groupee par categorie. Les boutons scrollent horizontalement sur mobile avec overflow-x-auto. Le scroll snap aligne sur les boutons.

### 1.4 Vue groupee par categorie (defaut)
Quand aucun filtre de recherche ni de categorie n'est actif, les apps sont affichees groupees par categorie. Chaque groupe a un header avec le nom de la categorie et un compteur (ex: `Productivite (9)`). Les apps de chaque groupe sont dans une grille responsive 1/2/3/4 colonnes. Les groupes vides (aucune app visible pour le role de l'utilisateur) sont masques.

### 1.5 Vue filtree (recherche ou categorie)
Quand un filtre est actif, les apps sont affichees dans une grille plate unique sans separateurs de categorie. Un etat vide affiche une icone Grid et le message `Aucune application trouvee` avec `Essayez de modifier votre recherche.`. L'etat vide utilise le pattern EmptyState avec icone opacity-50, texte centre, sous-texte text-muted-foreground.

### 1.6 Carte d'application (AppCard)
Chaque app est rendue comme une SpotlightCard (effet de lumiere radial au hover qui suit la position du curseur). Contenu : icone Lucide dans un carre arrondi colore (bg correspondant a la couleur de l'app avec opacity 10%), nom en gras (`font-semibold`), description en 2 lignes max (`line-clamp-2 text-muted-foreground text-sm`), badge de categorie en bas a gauche, fleche de navigation (ChevronRight) en bas a droite (visible au hover avec transition opacity 200ms). Clic sur la carte navigue vers l'app via `router.push(app.href)`. La carte entiere est une zone cliquable avec `cursor-pointer`. Au focus clavier, la bordure passe en `ring-2 ring-ring`. Animation hover : scale(1.02) avec transition 150ms ease-out.

### 1.7 Registre dynamique d'applications
Les apps proviennent du `APP_REGISTRY` statique (44 entrees) avec fallback dynamique via le gateway (`GET /api/v1/apps/discover`). Le registre dynamique est cache 5 minutes en localStorage sous la cle `signapps_app_registry`. Si le gateway est indisponible, le registre statique est utilise. Le schema du registre : `{ apps: AppEntry[], cached_at: number }`. Chaque `AppEntry` contient `{ id, name, description, icon, color, href, category, requiredRole?, badge? }`.

### 1.8 Categories du registre
Les 7 categories fixes avec leurs apps :

| Categorie | Apps |
|-----------|------|
| **Productivite** | Docs, Sheets, Slides, Design, Keep, Forms, Wiki, Whiteboard, Vault, Signatures |
| **Communication** | Mail, Chat, Meet, Social |
| **Organisation** | Calendar, Tasks, Projects, Resources, Contacts |
| **Business** | CRM, Billing, Accounting, Analytics, Workforce |
| **Infrastructure** | Drive, Containers, VPN, Monitoring, Media, Routes, IT Assets, PXE Deploy, Remote, Serveur Mail |
| **Administration** | Utilisateurs, Parametres, Sauvegardes, Planificateur, Workflows, Roles, Audit Drive, Structure org, Personnes, Sites, API Docs, Hub entites, Webhooks, Conformite |
| **Avance** | Office, Intelligence, Favoris, App Store |

L'ordre d'affichage des categories est fixe (Productivite en premier, Avance en dernier). Les groupes vides (aucune app visible pour le role) sont masques. L'icone de chaque categorie est assignee statiquement : Productivite (Zap), Communication (MessageCircle), Organisation (CalendarDays), Business (Briefcase), Infrastructure (Server), Administration (Shield), Avance (Sparkles).

---

## Categorie 2 -- Sidebar de navigation

### 2.1 Structure de la sidebar
Sidebar gauche persistante avec 3 sections principales : apps epinglees (pinned) en haut, labels au milieu, groupes de workspace en bas. La sidebar est repliable en mode icones uniquement (toggle via bouton chevron en bas de la sidebar, icone ChevronsLeft/ChevronsRight). Largeur expanded : 256px. Largeur collapsed : 64px. Transition largeur : 200ms ease-in-out. La sidebar a un `role="navigation"` et `aria-label="Main navigation"`.

### 2.2 Apps epinglees
Section superieure de la sidebar affichant les apps que l'utilisateur a epinglees. Chaque entree montre l'icone Lucide (20x20) et le nom de l'app. L'element actif (correspondant a la route courante) est surbrille avec `bg-accent text-accent-foreground` et une barre verticale bleue de 3px a gauche. Bouton `+` (icone Plus, 16x16) en haut a droite de la section pour ajouter une app depuis le registre via un Popover listant les apps non encore epinglees.

### 2.3 Drag-and-drop pour reordonner les pins
Le reordonnancement utilise dnd-kit (MIT). Au debut du drag, l'item saisi recoit `opacity-50` et une ombre portee (`shadow-lg`). Un placeholder bleu translucide (`bg-primary/20 border-2 border-dashed border-primary`) marque la position de drop. Au drop, l'ordre est persiste immediatement dans le store Zustand `usePinnedAppsStore` et synchronise en localStorage. L'animation de rearrangement utilise `transform` avec transition 200ms. Le drag est declenche par un appui long (300ms) sur mobile ou par un grab handle (icone GripVertical) visible au hover sur desktop. Si l'utilisateur drag un pin sur un dossier, le pin est insere dans ce dossier. Si l'utilisateur drag un pin hors d'un dossier vers la zone racine, le pin est extrait du dossier.

### 2.4 Dossiers de pins
Les apps epinglees peuvent etre organisees en dossiers. Un dossier est repliable (Collapsible de Radix UI) et contient une liste d'apps. Icone Folder (ou FolderOpen quand expanse) suivie du nom du dossier et du compteur d'apps entre parentheses. Clic sur le chevron (ChevronRight, rotation 90 degres quand ouvert, transition 150ms) toggle l'etat. Drag-and-drop entre dossiers et vers/depuis la racine. Creation de dossier via le bouton `+` > `Nouveau dossier` qui ouvre un Input inline avec auto-focus. Enter confirme, Escape annule. Le nom par defaut est `Nouveau dossier`. Double-clic sur le nom du dossier active le mode renommage inline. Suppression via clic droit > `Supprimer le dossier` (les pins sont remontes a la racine, pas supprimes).

### 2.5 Pin/Unpin animation
Epingler une app : l'icone de l'app effectue un micro-rebond (scale 1 > 1.2 > 1, 300ms cubic-bezier) en s'inserant dans la liste. L'item apparait avec une animation slide-in de la gauche (translateX -20px > 0, opacity 0 > 1, 200ms). Desepingler : l'item effectue un slide-out vers la gauche (translateX 0 > -20px, opacity 1 > 0, 200ms) puis est retire du DOM. Le toast confirme l'action : `"{App name}" epinglee` ou `"{App name}" desepinglee` avec un bouton `Annuler` (undo) pendant 5 secondes.

### 2.6 Labels
Section de labels personnalises dans la sidebar, separee par un Separator horizontal. Titre de section `Labels` avec bouton `+` pour creer. Chaque label a un cercle de couleur (12x12, rempli), un nom, et un compteur d'items entre parentheses. Clic sur un label filtre le contenu de l'app active (si l'app supporte le filtrage par label via un hook `useLabelFilter`). Le label actif recoit `font-semibold` et le cercle grossit a 14x14 avec transition 150ms.

### 2.7 Label CRUD avec color picker
Creation : bouton `+` ouvre un Popover avec un champ nom (placeholder `Nom du label`, max 30 caracteres) et un color picker inline (grille de 12 couleurs predefinies : red, orange, amber, yellow, lime, green, emerald, teal, cyan, blue, violet, pink, plus une option "Custom" ouvrant un input hex). Validation : Enter ou bouton `Creer`. Annulation : Escape ou clic hors du Popover. Edition : double-clic sur le nom du label active le mode inline edit. Clic droit > `Modifier la couleur` ouvre le color picker. Suppression : clic droit > `Supprimer le label` avec AlertDialog de confirmation `Supprimer le label "{name}" ? Les items associes ne seront pas supprimes.`. API : `POST /api/v1/labels` (create), `PUT /api/v1/labels/:id` (update), `DELETE /api/v1/labels/:id` (delete). Schema backend : `labels(id UUID, user_id UUID, name TEXT, color TEXT, sort_order INT, created_at TIMESTAMPTZ)`.

### 2.8 Badges de notification
Certains items de la sidebar affichent un badge rouge avec un compteur (ex: Mail non lus, taches en retard). Le badge est un cercle rouge (bg-destructive) de 18x18px avec le nombre en blanc, font-size 10px, positionne en haut a droite de l'icone de l'app avec `absolute -top-1 -right-1`. Si le compteur depasse 99, afficher `99+`. Les badges sont mis a jour toutes les 30 secondes via polling `GET /api/v1/notifications/badges` qui retourne `{ mail_unread: number, tasks_overdue: number, chat_unread: number, calendar_pending: number }`. Le hook `useSidebarBadges` centralise la logique, utilise `useQuery` avec `refetchInterval: 30000` et `staleTime: 15000`. En plus du polling, les WebSocket events `notification.badge_update` mettent a jour les badges en temps reel quand disponible.

### 2.9 Sidebar en mode compact
En mode compact (icones seules), la sidebar affiche uniquement les icones avec des tooltips au hover (Tooltip de Radix UI, delai 300ms, positionnement a droite). Les dossiers affichent l'icone Folder sans liste enfant -- au hover, un Popover montre la liste des apps du dossier. Les labels sont masques en mode compact. Les badges restent visibles. Le mode compact est memorise dans `useUIStore` sous la cle `sidebarCollapsed: boolean` et persiste en localStorage.

### 2.10 Navigation contextuelle par role
La sidebar affiche des liens differents selon le role de l'utilisateur : les liens admin (Utilisateurs, Roles, Audit, Structure org) ne sont visibles que pour les roles `admin` et `super_admin`. Le composant `RBACGuard` enveloppe chaque section et verifie `claims.role` contre les roles requis. Les entrees masquees ne sont pas rendues dans le DOM (pas de `display:none`, mais absence totale) pour eviter les fuites d'information.

### 2.11 Keyboard navigation dans la sidebar
Tab entre dans la sidebar, puis les fleches Haut/Bas naviguent entre les items. Enter active l'item selectionne (navigation vers l'app). Espace toggle un dossier (expand/collapse). Home/End sautent au premier/dernier item visible. Les items de la sidebar ont `tabindex="0"` et `role="treeitem"`. La sidebar entiere est un `role="tree"`. Les dossiers sont des `role="group"`. Le focus visible utilise `ring-2 ring-ring ring-offset-2`.

---

## Categorie 3 -- Header global

### 3.1 Breadcrumb
En haut a gauche du header, un fil d'Ariane affiche le chemin de navigation actuel : `Accueil > Module > Page`. Le breadcrumb est cliquable a chaque niveau. Algorithme de generation : le pathname Next.js est split par `/`, chaque segment est mappe vers un label lisible via une table de correspondance `BREADCRUMB_LABELS` (ex: `drive` -> `Drive`, `settings` -> `Parametres`, UUID ignore). Le dernier segment est affiche en `font-medium text-foreground` (actif), les precedents en `text-muted-foreground` avec `hover:text-foreground`. Separateur : icone ChevronRight (12x12, text-muted-foreground). Sur mobile (< 768px), seul le dernier segment est affiche avec un bouton `...` qui ouvre un Popover avec le chemin complet. Si le breadcrumb depasse 4 niveaux, les niveaux intermediaires sont collapses dans un dropdown `...`. Le breadcrumb a `aria-label="Breadcrumb"` et chaque item est un `<li>` dans un `<ol>`.

### 3.2 Logo et nom de l'instance
Logo SignApps (composant AppLogo) en haut a gauche de la sidebar, au-dessus du breadcrumb. Le logo fait 32x32px en mode expanded, 28x28px en mode compact. Clic sur le logo redirige vers le dashboard (`/dashboard`). A cote du logo (mode expanded uniquement), le nom de l'instance est affiche en `font-bold text-lg`. Le nom est configurable dans les parametres admin (`instance_name`, defaut `SignApps`). Transition opacity sur le texte quand la sidebar collapse/expand (opacity 0 -> 1, 150ms, delayed 50ms pour laisser la sidebar s'ouvrir d'abord).

### 3.3 Barre de recherche universelle (Command Palette)
Raccourci `Cmd+K` (macOS) ou `Ctrl+K` (Windows/Linux) ouvre une command palette modale centree avec overlay sombre (bg-black/50, transition opacity 150ms). Le composant utilise cmdk (MIT). Le champ de recherche est auto-focus avec placeholder `Rechercher des apps, fichiers, contacts...`. La palette fait max-width 640px, max-height 400px, avec border rounded-lg et shadow-xl. Fermeture par Escape, clic sur l'overlay, ou Cmd+K a nouveau (toggle). Le shortcut hint `Cmd+K` est affiche comme badge dans la barre de recherche du header (visible desktop uniquement).

### 3.4 Bouton notifications
Icone cloche (Bell de Lucide) dans le header, 24x24px. Badge rouge circulaire avec compteur de notifications non lues (meme pattern que les sidebar badges). Le compteur provient de `GET /api/v1/notifications/unread-count`. Clic ouvre un panneau dropdown (Popover, largeur 380px, max-height 480px) avec la liste des 20 notifications les plus recentes, groupees par date (Aujourd'hui, Hier, Cette semaine). Chaque notification affiche : icone du module source, titre, description tronquee (1 ligne), horodatage relatif (il y a 5 min, 2h, hier). Clic sur une notification navigue vers la page concernee et marque comme lue (`POST /api/v1/notifications/:id/read`). Bouton `Tout marquer comme lu` en haut du dropdown. Lien `Voir toutes les notifications` en bas du dropdown navigue vers `/notifications`. Animation d'entree du dropdown : slide-down + fade-in 200ms.

### 3.5 Bouton aide
Icone point d'interrogation (HelpCircle de Lucide, 20x20px). Clic ouvre un DropdownMenu avec 4 items : `Documentation` (icone BookOpen, ouvre la doc dans un nouvel onglet), `Raccourcis clavier` (icone Keyboard, ouvre un Dialog modal listant tous les raccourcis groupes par categorie), `A propos` (icone Info, ouvre un Dialog avec version, build date, licence), `Contact support` (icone MessageCircle, ouvre un formulaire de contact ou un lien mailto). Le Dialog des raccourcis clavier affiche une grille 2 colonnes : description a gauche, keybinding a droite (rendu comme `<kbd>` tags). Raccourci pour ouvrir le Dialog : `Shift+?`.

### 3.6 Bouton parametres
Icone engrenage (Settings de Lucide, 20x20px). Clic navigue vers `/settings` en mode desktop. En mode mobile, ouvre un quick-settings DropdownMenu avec 3 sections : Theme (Light/Dark/System avec icones Sun/Moon/Monitor et radio buttons), Langue (dropdown), Densite (Compact/Comfortable/Spacious avec radio buttons). Chaque changement est applique immediatement (pas de bouton Sauvegarder) et persiste dans `useUIStore`.

### 3.7 Theme toggle (light/dark/system)
Le switch de theme utilise `next-themes` (MIT). Trois options : Light (icone Sun), Dark (icone Moon), System (icone Monitor). Le theme `system` ecoute `prefers-color-scheme` media query et bascule automatiquement. Au changement de theme, la classe `dark` est toggled sur `<html>`. Tous les tokens semantiques Tailwind (`bg-card`, `text-foreground`, `border-border`, `bg-muted`) reagissent automatiquement. Pas de flash au chargement grace au script inline de `next-themes` dans le `<head>`. La transition entre themes utilise `transition-colors duration-200` sur le body. Le theme est persiste en localStorage sous la cle `theme` et synchronise dans `useUIStore`.

### 3.8 Menu utilisateur
Avatar utilisateur en haut a droite du header (40x40px, rounded-full, avec fallback initiales sur fond colore si pas d'avatar). Clic ouvre un DropdownMenu avec : section header (nom complet, email, badge du role actif), separateur, items : `Mon profil` (icone User), `Switch de role` (icone Users, sous-menu avec les roles disponibles), `Preferences` (icone Settings), separateur, `Se deconnecter` (icone LogOut, text-destructive). Le switch de role appelle `POST /api/v1/auth/switch-role` et reload les permissions. La deconnexion appelle `POST /api/v1/auth/logout`, invalide le JWT, clear le localStorage, et redirige vers `/login`.

---

## Categorie 4 -- Navigation mobile

### 4.1 Bottom navigation bar
Barre fixe en bas de l'ecran sur mobile (< 768px) avec `position: fixed; bottom: 0; left: 0; right: 0`. 5 onglets : Home (icone Home, route /dashboard), Mail (icone Mail, route /mail), Calendar (icone Calendar, route /calendar), Tasks (icone CheckSquare, route /tasks), More (icone Grid, route /all-apps). Chaque onglet a une icone (24x24) et un label (text-xs, 10px). L'onglet actif est surbrille en `text-primary` avec l'icone remplie. Les onglets inactifs sont en `text-muted-foreground`. Feedback haptique au tap : `navigator.vibrate(10)` (si supporte). Hauteur : 64px + safe-area-inset-bottom. Background : `bg-background/95 backdrop-blur-sm border-t`.

### 4.2 Detection de route active
Chaque onglet declare une fonction `match` qui teste la route actuelle via `usePathname()`. Home matche `/dashboard`, `/`. Mail matche `/mail/**`. Calendar matche `/calendar/**`. Tasks matche `/tasks/**`. More matche `/all-apps`, `/apps/**`, `/settings/**`, `/admin/**`, `/docs/**`, `/drive/**` et toute route non matchee par les autres onglets. Le style actif utilise `cn()` pour conditionner les classes CSS en fonction du match.

### 4.3 Masquage de la sidebar sur mobile
Sur mobile (< 768px), la sidebar est masquee par defaut (`translateX(-100%)`). Un bouton hamburger (icone Menu, 24x24) dans le header ouvre la sidebar en slide-over depuis la gauche (transition translateX 300ms ease-out). Un overlay sombre (bg-black/50, transition opacity 200ms) couvre le contenu. Fermeture : swipe gauche sur la sidebar (detecte via touch events, seuil 50px), tap sur l'overlay, bouton X en haut a droite de la sidebar, ou navigation vers une app (auto-fermeture). La sidebar mobile a `z-index: 50`. Le body recoit `overflow: hidden` quand la sidebar est ouverte pour empecher le scroll en arriere-plan.

### 4.4 Gesture handling mobile
Swipe depuis le bord gauche de l'ecran (touch start dans les premiers 20px) ouvre la sidebar. La sidebar suit le doigt pendant le swipe (translateX proportionnel au delta touch). Si le swipe depasse 40% de la largeur, la sidebar s'ouvre completement au relachement. Sinon elle revient a sa position fermee. Le swipe utilise les events `touchstart`, `touchmove`, `touchend` avec `passive: true` pour la performance. Un debounce empeche les ouvertures accidentelles lors du scroll vertical (le swipe doit etre principalement horizontal, angle < 30 degres).

### 4.5 Safe areas
La bottom nav respecte les safe areas iOS : `padding-bottom: env(safe-area-inset-bottom)`. Le header respecte `padding-top: env(safe-area-inset-top)`. Le meta tag `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` est defini dans le layout racine. Sur Android avec barre de navigation gestuelle, la bottom nav n'overlap pas les gestes systeme.

### 4.6 Mobile header simplification
Sur mobile (< 768px), le header est simplifie pour economiser l'espace vertical. Seuls les elements essentiels sont affiches : bouton hamburger (ouvre la sidebar), logo SignApps (compact, 24x24), titre de la page courante (truncate a 20 caracteres), bouton notifications (bell), bouton avatar utilisateur. La barre de recherche est masquee -- le raccourci Cmd+K ou le champ de recherche dans la sidebar mobile ouvre la command palette. Le breadcrumb est masque sur mobile. La hauteur du header est reduite a 48px (vs 56px desktop).

### 4.7 Pull-to-refresh
Sur mobile, un geste pull-down (swipe vers le bas) depuis le haut du contenu declenche un refresh de la page courante. L'indicateur de refresh (spinner circulaire) apparait sous le header. Le seuil de declenchement est 80px de pull. Le refresh appelle `router.refresh()` pour invalider le cache de la route et re-fetcher les donnees. L'indicateur disparait une fois le rechargement termine (max 5 secondes timeout).

---

## Categorie 5 -- Quick actions et widgets flottants

### 5.1 Barre de quick actions
Barre flottante en bas du viewport (16px au-dessus de la bottom nav sur mobile, 16px au-dessus du bord inferieur sur desktop) centree horizontalement avec `max-width: 400px`. Background : `bg-background/95 backdrop-blur-md border rounded-full shadow-lg px-4 py-2`. Actions contextuelles sous forme de boutons icone + label court : `Nouveau Dossier` (FolderPlus), `Nouveau Contact` (UserPlus), `Nouvelle Feuille` (FileSpreadsheet), `Nouvelle Note` (StickyNote). Les actions visibles dependent du module actif (Drive montre les actions Drive, Contacts montre les actions Contacts). Chaque action ouvre un dialogue de creation rapide (Dialog modal) sans quitter la page courante. Animation d'entree : slide-up 200ms ease-out depuis le bas.

### 5.2 Quick action bar customization
L'utilisateur peut personnaliser les actions visibles via un long press (500ms) ou clic droit sur la barre qui ouvre un Popover d'edition. Liste de toutes les actions disponibles avec toggles on/off. Drag-and-drop pour reordonner. Maximum 5 actions visibles. La configuration est persistee dans `useUIStore` sous `quickActions: { id: string, visible: boolean, order: number }[]`. Un bouton `Reset` restaure les actions par defaut du module actif.

### 5.3 Widget Keep Notes
Widget flottant en bas a droite du viewport (desktop uniquement, position fixed, 16px du bord). Etat initial : bouton compact avec icone StickyNote et badge compteur de notes recentes. Clic expand le widget en panneau (280px largeur, 360px max-height) avec : header `Mes Notes` + bouton `X` pour replier, liste scrollable des 5 dernieres notes (titre tronque + apercu 1 ligne + date relative), bouton `+` pour creer une note rapide inline (textarea auto-expand), bouton `Voir tout` pour ouvrir Keep (/keep). Les notes proviennent de `GET /api/v1/keep/notes?limit=5&sort=-updated_at`. Animation expand/collapse : scale + opacity 200ms.

### 5.4 Bouton d'action flottant (FAB) mobile
Sur mobile, un floating action button (FAB) en bas a droite (16px du bord, au-dessus de la bottom nav) remplace la barre de quick actions. Cercle de 56x56px, `bg-primary text-primary-foreground shadow-lg`. Icone Plus (24x24) au centre. Tap expand le FAB en un menu radial de 4-5 actions (disposees en arc de cercle 90 degres vers le haut-gauche). Chaque action est un cercle de 44x44px avec icone et label. L'overlay sombre apparait en arriere-plan. Animation : les actions apparaissent en sequence (staggered, 50ms entre chaque) avec spring physics. Tap hors du menu ou sur l'overlay replie le FAB. Le FAB est masque pendant le scroll descendant (transition translateY +80px 200ms) et reapparait au scroll ascendant.

---

## Categorie 6 -- Layout et responsive design

### 6.1 Structure AppLayout
Le composant `AppLayout` encapsule toutes les pages. Il fournit le header (height: 56px), la sidebar (width: 256px expanded / 64px collapsed), la bottom nav mobile (height: 64px + safe-area), et le content area central. Le content area est scrollable independamment de la sidebar. Structure HTML : `<div class="flex h-screen">` > `<aside>` (sidebar) + `<div class="flex-1 flex flex-col">` > `<header>` + `<main class="flex-1 overflow-y-auto">`. Le layout utilise CSS Grid sur desktop : `grid-template-columns: auto 1fr` pour la sidebar + contenu.

### 6.2 Breakpoints responsive
- **xs** (< 480px) : sidebar masquee, bottom nav visible, grille 1 colonne, header simplifie (logo + hamburger + avatar uniquement), quick actions masquees au profit du FAB
- **sm** (480px-639px) : sidebar masquee, bottom nav visible, grille 1-2 colonnes, FAB visible
- **md** (640px-767px) : sidebar masquee, bottom nav visible, grille 2 colonnes
- **lg** (768px-1023px) : sidebar compacte (icones, 64px), pas de bottom nav, grille 2-3 colonnes, quick action bar visible
- **xl** (1024px-1279px) : sidebar complete (256px), grille 3 colonnes
- **2xl** (1280px+) : sidebar complete, grille 4 colonnes, panneau lateral optionnel (details, preview)

### 6.3 Transitions entre apps
La navigation entre apps utilise le prefetching Next.js (`<Link prefetch>`). Les transitions sont instantanees grace au cache du router. Un skeleton loading est affiche pendant le chargement initial des donnees de chaque app. Le skeleton reproduit la mise en page de la destination (via des composants `Skeleton` shadcn/ui) pour eviter le layout shift. Le `NProgress` bar en haut de l'ecran (2px, bg-primary) indique le chargement de la route. Duree maximale du skeleton : 3 secondes, apres quoi un message `Le chargement prend plus longtemps que prevu` apparait.

### 6.4 Theme et densite
Le shell respecte le theme sombre/clair defini dans les preferences utilisateur. Les tokens semantiques Tailwind (`bg-card`, `text-foreground`, `border-border`, `bg-muted`) sont utilises partout. La densite affecte les paddings et gaps : Compact (py-1 gap-1), Comfortable (py-2 gap-2, defaut), Spacious (py-3 gap-3). La densite est stockee dans `useUIStore` sous `density: 'compact' | 'comfortable' | 'spacious'` et appliquee via une classe CSS sur le body (`density-compact`, `density-comfortable`, `density-spacious`) qui override les variables CSS `--spacing-unit`.

### 6.5 Workspace switching
Les utilisateurs peuvent basculer entre workspaces (si multi-workspace active). Le selecteur de workspace est un DropdownMenu dans le header (visible uniquement si l'utilisateur a acces a 2+ workspaces). Il affiche le nom du workspace actif avec un icone ChevronDown. Les workspaces proviennent de `GET /api/v1/workspaces`. Le switch appelle `POST /api/v1/auth/switch-workspace` qui retourne un nouveau JWT scope au workspace. Les stores Zustand sont reinitialises apres le switch (clear all stores, re-fetch pinned apps, labels, badges pour le nouveau workspace). Une animation de fade-out/fade-in (300ms) couvre la transition. La sidebar affiche le nom du workspace actif sous le logo en mode expanded.

### 6.6 Loading states and skeleton patterns
Chaque zone du shell a un skeleton loading defini :
- **Sidebar** : 6 barres horizontales grises (Skeleton de shadcn/ui) representant les items epingles, espacees de 8px, largeur aleatoire (60-90%) pour un aspect naturel
- **Header** : barre de breadcrumb grise (Skeleton, width 200px), cercle avatar gris (Skeleton, 40x40 rounded-full)
- **Content area** : depend du module cible. Le fichier `loading.tsx` de chaque route definit le skeleton specifique
- **Command palette** : pas de skeleton, les resultats apparaissent progressivement (chaque source ajoute ses resultats des qu'ils arrivent)
Les skeletons utilisent l'animation `animate-pulse` (sauf si `prefers-reduced-motion`). Le skeleton est remplace par le contenu reel via une transition opacity 200ms pour eviter le flash.

---

## Categorie 7 -- Persistance et synchronisation

### 7.1 Store UI (Zustand)
Le store `useUIStore` persiste les preferences UI de l'utilisateur. Schema : `{ sidebarCollapsed: boolean, theme: 'light' | 'dark' | 'system', density: 'compact' | 'comfortable' | 'spacious', lastVisitedPath: string, quickActions: QuickAction[], commandPaletteHistory: string[] }`. Persistence via `zustand/middleware` avec `persist` et `storage: localStorage`. Cle localStorage : `signapps_ui_store`. Hydration : les valeurs par defaut sont utilisees pendant le SSR, la valeur localStorage est appliquee apres hydration pour eviter les mismatches.

### 7.2 Store apps epinglees (Zustand)
Le store `usePinnedAppsStore` persiste la liste des apps epinglees, leur ordre et les dossiers. Schema : `{ pins: PinnedItem[], folders: PinnedFolder[] }` ou `PinnedItem = { id: string, appId: string, folderId: string | null, order: number }` et `PinnedFolder = { id: string, name: string, order: number, collapsed: boolean }`. Persistence via localStorage sous la cle `signapps_pinned_apps`. Sync backend optionnelle : au chargement, `GET /api/v1/users/me/preferences/pinned-apps` est appele. Si le serveur a des donnees plus recentes (comparaison `updated_at`), elles remplacent le local. Les modifications locales sont debounce-sync (2 secondes) vers `PUT /api/v1/users/me/preferences/pinned-apps`.

### 7.3 Store labels (Zustand)
Le store `useLabelsStore` gere les labels personnalises. Schema : `{ labels: Label[], loading: boolean, error: string | null }` ou `Label = { id: string, name: string, color: string, sortOrder: number, itemCount: number }`. Les labels sont synchronises avec le backend : `GET /api/v1/labels` au chargement, `POST` a la creation, `PUT` a l'edition, `DELETE` a la suppression. Le store est la source de verite cote client -- les operations optimistes mettent a jour le store immediatement et rollback en cas d'erreur API.

### 7.4 localStorage persistence schema
Toutes les cles localStorage du shell :
- `signapps_ui_store` -- preferences UI (theme, density, sidebar state)
- `signapps_pinned_apps` -- apps epinglees et dossiers
- `signapps_app_registry` -- cache du registre d'apps (TTL 5 min)
- `signapps_command_history` -- 20 dernieres recherches command palette
- `signapps_recent_pages` -- 20 dernieres pages visitees (path + timestamp)
- `signapps_sidebar_badges` -- dernier etat des badges (pour rendu instantane au chargement)
- `theme` -- valeur de next-themes (light/dark/system)
Chaque cle est prefixee `signapps_` pour eviter les collisions. Le total localStorage du shell ne depasse pas 50KB. Un mecanisme de garbage collection supprime les entrees expirees au chargement de l'app.

### 7.5 Registre d'apps dynamique
Le hook `useAppRegistry` fournit la liste des apps depuis le cache localStorage (5 min TTL) ou le gateway. Pattern stale-while-revalidate : le cache est retourne immediatement, un refetch est lance en arriere-plan si le TTL est depasse. Si le refetch reussit, le cache est mis a jour et le composant re-render. Si le refetch echoue, le cache expire est utilise en fallback. Si aucun cache n'existe et le gateway est indisponible, le registre statique `APP_REGISTRY` est utilise. Le hook expose : `{ apps: AppEntry[], loading: boolean, error: Error | null, refresh: () => void }`.

### 7.6 Prefetching intelligent
Les 5 apps les plus utilisees par l'utilisateur sont prefetchees au chargement du shell. L'historique de navigation est stocke localement : `{ [appHref: string]: { visits: number, lastVisit: number } }`. Les apps sont classees par `visits * recencyWeight` (recencyWeight decroit avec l'anciennete). Les routes des top 5 sont passees a `router.prefetch(href)` au montage du shell. Le prefetching est egalement declenche au hover (300ms) sur un lien de la sidebar.

---

## Categorie 8 -- Command palette et recherche universelle

### 8.1 Declenchement
Raccourci `Cmd+K` (macOS) ou `Ctrl+K` (Windows/Linux) ouvre la command palette comme modal centree avec overlay sombre. Detection de la plateforme via `navigator.platform` pour afficher le bon hint (Cmd vs Ctrl). Le champ de recherche est auto-focus. Escape ou clic sur l'overlay ferme la palette. Le hook `useHotkeys('mod+k', toggle)` de react-hotkeys-hook (MIT) gere le raccourci. Le raccourci fonctionne meme quand le focus est dans un input (stopPropagation est desactive). La palette s'ouvre avec une animation scale(0.95) + opacity(0) -> scale(1) + opacity(1) en 150ms.

### 8.2 Sources de resultats
La command palette interroge simultanement (Promise.allSettled pour la resilience) :
- **Applications** : les 44+ apps du registre (filtrage local, instantane, < 1ms)
- **Fichiers recents** : les 20 derniers fichiers ouverts (cache local, instantane)
- **Contacts** : recherche par nom, email (`GET /api/v1/contacts?search=...&limit=5`, debounce 200ms)
- **Taches** : recherche par titre (`GET /api/v1/tasks?search=...&limit=5`, debounce 200ms)
- **Documents** : recherche par titre (`GET /api/v1/docs?search=...&limit=5`, debounce 200ms)
- **Emails** : recherche par sujet, expediteur (`GET /api/v1/mail/search?q=...&limit=5`, debounce 200ms)
- **Actions rapides** : commandes systeme filtrees localement (nouveau document, nouvelle tache, ouvrir parametres, se deconnecter)
Les resultats locaux (apps, fichiers, actions) apparaissent instantanement. Les resultats API apparaissent progressivement avec un spinner par section pendant le chargement. La performance cible : resultats locaux < 10ms, resultats API < 200ms.

### 8.3 Categories de resultats
Les resultats sont groupes par categorie avec un header de section gris (`text-xs font-medium text-muted-foreground uppercase tracking-wider`) : `Applications`, `Documents`, `Contacts`, `Taches`, `Emails`, `Actions`. Chaque categorie affiche au maximum 5 resultats avec un lien `Voir tous les resultats ({count})` en bas si plus de resultats existent. L'icone du module precede chaque resultat (Apps -> icone de l'app, Contacts -> User, Docs -> FileText, Tasks -> CheckSquare, Mail -> Mail, Actions -> Zap). Le texte matche est surbrille avec `<mark class="bg-yellow-200/50 dark:bg-yellow-800/50">`.

### 8.4 Navigation clavier complete
- `ArrowDown` / `ArrowUp` : naviguer entre les resultats (le focus boucle du dernier au premier et vice versa)
- `Enter` : ouvrir le resultat selectionne (navigation + fermeture de la palette)
- `Tab` : passer au premier resultat de la categorie suivante
- `Shift+Tab` : passer au premier resultat de la categorie precedente
- `Escape` : fermer la palette (retour du focus a l'element precedent)
- `Cmd+Enter` : ouvrir dans un nouvel onglet (window.open)
- `Cmd+Backspace` : effacer le champ de recherche
Le resultat selectionne est surbrille avec `bg-accent`. Un indicateur visuel (fleche ou barre bleue a gauche) marque la selection active. Le scrolling automatique (`scrollIntoView({ block: 'nearest' })`) garantit que la selection est toujours visible.

### 8.5 Recherche fuzzy
La recherche tolere les fautes de frappe legeres (distance de Levenshtein <= 2) pour les apps et les actions. Implementation : `fuse.js` (MIT) avec threshold 0.4, keys ponderes (name weight 2, description weight 1). Les resultats sont tries par score de pertinence : correspondance exacte (score 1.0) > debut de mot (score 0.8) > contient (score 0.5) > fuzzy (score < 0.5). Les termes de recherche sont surbrilles dans les resultats via regex split. Pour les recherches API (contacts, docs, mail), la recherche full-text est cote serveur (PostgreSQL ts_vector) -- pas de fuzzy client.

### 8.6 Actions rapides (slash commands)
L'utilisateur peut taper des commandes directes precedees de `/` :
- `/new doc` -> cree un nouveau document (navigate `/docs/new`)
- `/new sheet` -> cree une nouvelle feuille (navigate `/sheets/new`)
- `/new task` -> cree une nouvelle tache (ouvre dialog creation rapide)
- `/new contact` -> cree un nouveau contact (ouvre dialog)
- `/new event` -> cree un nouvel evenement (ouvre dialog)
- `/settings` -> ouvre les parametres (`/settings`)
- `/theme dark` -> bascule en theme sombre
- `/theme light` -> bascule en theme clair
- `/logout` -> se deconnecter
- `/help` -> ouvre la documentation
Quand l'utilisateur tape `/`, la liste des commandes disponibles est affichee a la place des resultats de recherche. La saisie subsequente filtre les commandes. Les commandes non reconnues affichent `Commande inconnue`.

### 8.7 Resultats recents
A l'ouverture de la palette (champ vide), deux sections sont affichees : `Recherches recentes` (10 derniers termes, avec icone Clock et bouton X pour supprimer individuellement) et `Pages recentes` (10 dernieres pages visitees, avec icone de l'app correspondante et horodatage relatif). L'historique est stocke en localStorage (`signapps_command_history` et `signapps_recent_pages`). Un bouton `Effacer l'historique` en bas efface les deux listes. Clic sur une recherche recente re-execute la recherche. Clic sur une page recente navigue directement.

### 8.8 Performance de la command palette
La recherche locale (apps + actions + fichiers recents) s'execute en < 10ms (benchmark cible). Le rendu de la liste de resultats utilise la virtualisation si plus de 50 resultats via `@tanstack/react-virtual`. Les appels API sont debounces a 200ms et annules (AbortController) si l'utilisateur continue de taper. Le composant cmdk utilise `React.memo` et `useMemo` pour eviter les re-renders inutiles. Target : le premier resultat est affiche < 100ms apres la derniere frappe.

---

## Categorie 9 -- API backend et schema

### 9.1 Endpoints pinned apps (signapps-identity)
- `GET /api/v1/users/me/preferences/pinned-apps` -- Retourne la configuration des apps epinglees. Reponse : `{ pins: PinnedItem[], folders: PinnedFolder[], updated_at: string }`.
- `PUT /api/v1/users/me/preferences/pinned-apps` -- Sauvegarde la configuration complete (ecrasement). Body : `{ pins: PinnedItem[], folders: PinnedFolder[] }`. Retourne : 200 + `{ updated_at: string }`.

### 9.2 Endpoints labels (signapps-identity)
- `GET /api/v1/labels` -- Liste les labels de l'utilisateur authentifie. Retourne : `Label[]` tries par `sort_order ASC`.
- `POST /api/v1/labels` -- Creer un label. Body : `{ name: string, color: string }`. Le `sort_order` est auto-incremente (MAX + 1). Retourne : 201 + `Label`.
- `PUT /api/v1/labels/:id` -- Modifier un label. Body : `{ name?: string, color?: string, sort_order?: number }`. Retourne : 200 + `Label`.
- `DELETE /api/v1/labels/:id` -- Supprimer un label. Retourne : 204. Les associations label-item sont supprimees en cascade.

### 9.3 Endpoints notifications badges (signapps-gateway)
- `GET /api/v1/notifications/badges` -- Retourne les compteurs de badges pour la sidebar. Aggreage les compteurs depuis les services backend. Reponse : `{ mail_unread: number, tasks_overdue: number, chat_unread: number, calendar_pending: number, total: number }`. Cache 15 secondes cote gateway.
- `GET /api/v1/notifications/unread-count` -- Nombre total de notifications non lues (pour le bell icon du header). Reponse : `{ count: number }`.
- `GET /api/v1/notifications` -- Liste paginee des notifications. Query params : `page`, `per_page`, `unread_only`. Reponse : `{ items: Notification[], total: number, unread: number }`.
- `POST /api/v1/notifications/:id/read` -- Marquer une notification comme lue. Retourne : 200.
- `POST /api/v1/notifications/read-all` -- Marquer toutes les notifications comme lues. Retourne : 200 + `{ count: number }`.

### 9.4 Endpoints app registry (signapps-gateway)
- `GET /api/v1/apps/discover` -- Retourne la liste des apps visibles pour le JWT courant (filtre RBAC). Reponse : `{ apps: AppEntry[] }`. Cache 5 minutes cote gateway. Le header `Cache-Control: max-age=300` est retourne.

### 9.5 Endpoints workspaces
- `GET /api/v1/workspaces` -- Liste les workspaces accessibles pour l'utilisateur. Reponse : `Workspace[]`.
- `POST /api/v1/auth/switch-workspace` -- Change le workspace actif. Body : `{ workspace_id: UUID }`. Retourne un nouveau JWT scope au workspace : `{ access_token: string, workspace: Workspace }`.

### 9.6 PostgreSQL schema (preferences utilisateur)
```sql
-- Labels utilisateur
CREATE TABLE user_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_user_labels_user ON user_labels(user_id, sort_order);

-- Preferences utilisateur (pinned apps, UI settings)
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  pinned_apps JSONB NOT NULL DEFAULT '{"pins":[],"folders":[]}',
  ui_settings JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  icon TEXT,
  link TEXT,
  source_module TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
```

### 9.7 Error states and edge cases
- **Gateway unavailable** : si `GET /api/v1/apps/discover` echoue, le registre statique `APP_REGISTRY` est utilise. Un bandeau jaune `Mode hors-ligne : certaines fonctionnalites peuvent etre limitees` apparait en haut du contenu pendant 10 secondes. Le bandeau est dismissible.
- **Badge API timeout** : si le polling des badges echoue 3 fois consecutives, le polling passe a 60 secondes. Les badges affichent la derniere valeur connue (cache localStorage). Un indicateur `(cache)` apparait au hover des badges.
- **Notification click on deleted item** : si la cible d'une notification n'existe plus (ex: document supprime), la navigation affiche une page 404 standard. La notification est marquee comme lue malgre tout.
- **Label name collision** : si l'utilisateur cree un label avec un nom deja existant, l'API retourne 409 Conflict. Le frontend affiche l'erreur inline sous le champ nom : `Un label avec ce nom existe deja`.
- **Pinned apps sync conflict** : si le serveur a des donnees plus recentes que le local (comparaison `updated_at`), les donnees serveur remplacent silencieusement le local. Pas de merge -- last-write-wins avec priorite serveur. Un toast informatif `Vos epingles ont ete synchronisees depuis un autre appareil` apparait si les donnees different.
- **Too many pins** : maximum 30 pins (apps + dossiers). Le bouton `+` est desactive avec tooltip `Maximum 30 elements epingles` si la limite est atteinte.
- **Sidebar resize conflict** : si la fenetre est redimensionnee pendant un drag-and-drop, le drag est annule (drop annule, items reviennent a leur position).

---

## Categorie 10 -- Securite et RBAC

### 10.1 Visibilite des apps par role
Le registre d'apps filtre les entrees visibles selon le role de l'utilisateur. Chaque `AppEntry` a un champ optionnel `requiredRole: 'admin' | 'operator' | 'user'`. Les apps sans `requiredRole` sont visibles par tous. Les apps admin (`requiredRole: 'admin'`) ne sont pas listees pour les utilisateurs standard. Le filtrage est applique cote client dans `useAppRegistry` ET cote serveur dans `GET /api/v1/apps/discover` (le gateway ne retourne que les apps autorisees pour le JWT courant). Double verification pour eviter les fuites.

### 10.2 Protection des routes
Les routes protegees redirigent vers `/login` si le JWT est absent ou expire. Le middleware Next.js (`middleware.ts`) intercepte les requetes avant le rendu et verifie la presence du cookie `access_token`. Si absent ou expire, redirect 302 vers `/login?redirect={currentPath}`. Apres login, l'utilisateur est renvoye vers `redirect`. Le refresh token est gere automatiquement par l'intercepteur Axios : sur une reponse 401, un appel `POST /api/v1/auth/refresh` est effectue avec le refresh token, le nouveau access token est stocke, et la requete originale est rejouee. Si le refresh echoue, deconnexion forcee.

### 10.3 Auto-login dev
En mode developpement (`NODE_ENV=development`), l'URL `http://localhost:3000/login?auto=admin` permet un login automatique sans saisir de credentials. Le frontend appelle `POST /api/v1/auth/dev-login` avec le role demande. Ce endpoint retourne un JWT valide pour l'utilisateur dev. Ce mecanisme est desactive en production (le endpoint n'existe pas). Les roles disponibles : `auto=admin`, `auto=user`, `auto=operator`.

### 10.4 PWA install prompt
Le shell detecte le support PWA via l'event `beforeinstallprompt`. Quand detecte, un banner discret apparait en haut de la page (`bg-primary/10 border border-primary/20 rounded-lg p-3 mx-4 mt-2`) avec le message `Installez SignApps pour un acces rapide` et un bouton `Installer`. Clic declenche `prompt.prompt()`. Apres installation, le banner disparait et ne reapparait jamais (flag `pwa_install_dismissed` en localStorage). Le banner est egalement dismissible via un bouton X. Sur iOS (detection via user agent), le message indique `Ajoutez a l'ecran d'accueil via le menu Partage de Safari`. Le manifest.json definit : `name`, `short_name`, `start_url: /dashboard`, `display: standalone`, `theme_color`, `background_color`, `icons` (192x192 et 512x512).

---

## Categorie 11 -- Performance et optimisation

### 11.1 Sidebar render < 50ms
La sidebar est rendue avec un budget de 50ms maximum. Les icones Lucide sont importees statiquement (pas de dynamic import pour les icones de la sidebar car elles sont toujours visibles). Les badges sont charges de maniere asynchrone apres le premier rendu (ne bloquent pas le SSR). Le store Zustand est hydrate en une passe unique. Les animations CSS sont GPU-accelerated (transform, opacity uniquement -- pas de width/height transitions sauf pour la sidebar collapse qui utilise transform scaleX).

### 11.2 Command palette search < 100ms
Le premier resultat doit apparaitre en moins de 100ms apres la derniere frappe clavier. La recherche locale (apps, actions, fichiers recents) est synchrone et executee en < 5ms. Les resultats API sont affiches progressivement (chaque source ajoute ses resultats des qu'ils arrivent). Un `React.startTransition` enveloppe les mises a jour de resultats pour ne pas bloquer les frappes clavier.

### 11.3 Prefetching des routes
Les routes des 5 apps les plus visitees par l'utilisateur sont prefetchees au chargement du shell via `router.prefetch(href)`. Le routeur Next.js cache les pages visitees dans l'historique de la session pour des retours instantanes (back/forward navigation). Les liens de la sidebar utilisent `<Link prefetch={false}>` par defaut et `<Link prefetch>` pour les 5 top apps (pour eviter de prefetcher 44 routes).

### 11.4 Static shell rendering
Le layout (header, sidebar, bottom nav) est rendu avec les props par defaut au build time (Next.js App Router layout.tsx). Le contenu dynamique (badges, compteurs, apps epinglees, theme) est hydrate cote client. Ceci evite le flash de contenu vide au chargement initial. Le layout est mis en cache par le CDN/edge pour les visiteurs authentifies via le cookie.

### 11.5 Code splitting par route
Chaque page d'app est un dynamic import via le systeme de route Next.js (chaque `page.tsx` est un chunk separe). Le bundle JavaScript du shell (layout + header + sidebar + bottom nav) est < 80 KB gzip. Les bundles des apps sont charges a la demande. Le loading skeleton est affiche pendant le chargement du chunk via le fichier `loading.tsx` de chaque route.

### 11.6 Cache du registre d'apps
Le registre est cache en localStorage avec un TTL de 5 minutes (`cached_at + 300000 > Date.now()`). Apres expiration, un re-fetch asynchrone est lance sans bloquer le rendu (stale-while-revalidate). Si le fetch echoue, le cache expire est utilise en fallback. Le refetch est declenche au montage de `useAppRegistry` et au focus de la fenetre (`visibilitychange` event).

### 11.7 Lazy loading des images et icones
Les icones Lucide sont importees dynamiquement via `LucideIcons[name]` pour les cartes d'apps (qui ont 44+ icones differentes). Seules les icones referencees dans le registre sont chargees. Les avatars utilisateur sont lazy-loaded avec `loading="lazy"` et un placeholder circulaire gris (`bg-muted rounded-full animate-pulse`). Les images des apps du store sont chargees via `<Image>` de Next.js avec `blur` placeholder.

### 11.8 Debounce et throttle
- Recherche command palette : debounce 200ms (chaque frappe reset le timer)
- Recherche page all-apps : debounce 150ms
- Scroll de la sidebar : pas de throttle (CSS scroll natif)
- Badge polling : 30 secondes interval (`refetchInterval`)
- Prefetch sync (pinned apps vers le serveur) : debounce 2 secondes
- Resize listener pour breakpoints : throttle 100ms via `ResizeObserver`

### 11.9 Service Worker et PWA
Le shell enregistre un service worker via `next-pwa` (MIT) qui cache les assets statiques (CSS, JS, icones, fonts) pour le mode offline. La strategie de cache : `StaleWhileRevalidate` pour les assets statiques, `NetworkFirst` pour les appels API. La page /all-apps est accessible offline avec le registre cache. Les notifications push transitent par le service worker via `PushManager.subscribe()`. Le service worker est mis a jour silencieusement quand une nouvelle version est deploye (prompt de refresh apres 24h ou au prochain chargement).

---

## Categorie 12 -- Accessibilite

### 12.1 ARIA landmarks
Le header porte `role="banner"`, la sidebar `role="navigation"` avec `aria-label="Navigation principale"`, la zone de contenu `role="main"`, la bottom nav `role="navigation"` avec `aria-label="Navigation mobile"`. Les landmarks permettent aux lecteurs d'ecran de naviguer entre les regions via des raccourcis specifiques (ex: VoiceOver rotor). Le `<footer>` de page (si present) porte `role="contentinfo"`.

### 12.2 Focus management
A l'ouverture de la command palette, le focus est place sur le champ de recherche via `ref.current?.focus()` dans un `useEffect`. A la fermeture, le focus retourne a l'element qui a declenche l'ouverture (stocke dans une ref `triggerRef`). La navigation au clavier (Tab) suit l'ordre logique : header -> sidebar -> contenu -> footer. Le focus trap dans les modales (Dialog, AlertDialog) empeche le focus de sortir (via `FocusTrap` de Radix UI). Le skip-to-content link (`Aller au contenu principal`) est le premier element focusable de la page, visible uniquement au focus.

### 12.3 Contraste et taille
Tous les textes respectent le ratio de contraste WCAG AA (4.5:1 pour le texte normal < 18px, 3:1 pour le texte large >= 18px ou bold >= 14px). Les icones ont une taille minimum de 24x24px. Les cibles tactiles ont une zone minimale de 44x44px sur mobile (padding ajoute si l'element visuel est plus petit). Les couleurs de badge (destructive, primary, secondary) sont testees en light et dark mode pour les deux ratios. Aucun texte ne depend uniquement de la couleur pour transmettre l'information (ex: les badges d'expiration utilisent couleur + texte).

### 12.4 Motion preferences
Les animations (transitions sidebar, hover effects, skeleton pulse, FAB expansion, pin/unpin animations) respectent `prefers-reduced-motion`. Le media query est detecte via `useReducedMotion()` hook. Si l'utilisateur a active la reduction des animations dans l'OS, les transitions sont instantanees (duration: 0ms) et les animations de pulse/spin sont desactivees. Les microinteractions essentielles (focus ring, selection highlight) restent actives car elles ne sont pas des animations decoratives.

### 12.5 Screen reader
Les badges de notification portent `aria-label` dynamique (ex: `3 emails non lus` construit via template literal). Les boutons icon-only portent `aria-label` (ex: `Ouvrir les notifications`, `Ouvrir le menu`, `Replier la sidebar`). Les tooltips sont accessibles via `role="tooltip"` et `aria-describedby`. Le breadcrumb utilise `aria-current="page"` sur le dernier element. Les items de la sidebar en mode compact ont `aria-label` avec le nom de l'app (pas juste le tooltip visuel). Les etat expanded/collapsed des dossiers sont communiques via `aria-expanded`.

---

## Categorie 13 -- Inter-module integration

### 13.1 Shell as event bus consumer
Le shell ecoute les PgEventBus events relayed via WebSocket pour mettre a jour son etat en temps reel :
- `notification.created` -> incremente le compteur de notifications du bell icon
- `notification.badge_update` -> met a jour les badges de la sidebar (mail_unread, tasks_overdue, etc.)
- `workspace.settings_changed` -> recharge le nom de l'instance et le logo si modifies par un admin
- `user.role_changed` -> recharge les permissions et refiltre les apps visibles dans la sidebar et le registre
Le WebSocket est connecte a `WS /api/v1/events` avec reconnexion automatique (exponential backoff : 1s, 2s, 4s, max 30s). Le hook `useShellEvents` centralise l'abonnement et dispatche les events vers les stores Zustand concernes.

### 13.2 Deep linking depuis les autres modules
Chaque module peut generer des liens profonds vers des elements specifiques. Le shell route ces liens sans rechargement de page :
- `/docs/{id}` -> ouvre le document dans l'editeur
- `/drive/{bucket}/{path}` -> ouvre le fichier dans Drive
- `/mail/{id}` -> ouvre l'email dans Mail
- `/calendar/{id}` -> ouvre l'evenement dans Calendar
Les smart chips (dans Docs, Mail, Chat) affichent un preview au hover et naviguent au clic. Le breadcrumb se met a jour dynamiquement pour refleter le contexte de navigation.

### 13.3 Cross-app notifications routing
Quand l'utilisateur clique sur une notification dans le dropdown du header, le shell determine le module cible a partir du champ `source_module` et du champ `link` de la notification. La navigation utilise `router.push(notification.link)`. Si le module cible est deja charge, la navigation est instantanee (client-side). Si le module n'est pas charge, le skeleton loading du module cible est affiche pendant le chargement du chunk.

### 13.4 Global keyboard shortcuts registry
Le shell maintient un registre global de raccourcis clavier pour eviter les conflits entre modules :
- `Cmd+K` : command palette (shell)
- `Cmd+/` : aide raccourcis (shell)
- `Cmd+,` : parametres (shell)
- `Cmd+Shift+N` : nouveau (contextuel au module actif)
- `Cmd+Shift+F` : recherche dans le module actif
Les modules enregistrent leurs raccourcis via le hook `useRegisterShortcut(key, handler, options)`. Le shell detecte les conflits et affiche un warning en console dev. La priorite est : dialog ouvert > module actif > shell global.

### 13.5 State preservation on navigation
Quand l'utilisateur navigue d'un module a un autre et revient, l'etat du module est preserve :
- Position de scroll dans les listes (Drive, Mail, Contacts)
- Filtres et tris actifs
- Onglet selectionne (Calendar month/week/day)
- Contenu du champ de recherche
La preservation est assuree par les stores Zustand de chaque module (pas de reset au unmount) et par le cache du router Next.js. Le navigateur back/forward restaure l'etat precedent. La duree de preservation : tant que la session de navigation est active (pas de persistence localStorage pour l'etat transitoire des modules).

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Google Workspace App Launcher** (workspace.google.com) -- grille d'apps, personnalisation, switch de compte.
- **Microsoft 365 App Launcher** (microsoft.com/microsoft-365) -- panneau lateral, apps recentes, recherche.
- **Notion Navigation** (notion.so/help) -- sidebar, favoris, breadcrumb, Cmd+K.
- **Slack Sidebar** (slack.com/help) -- channels, sections, quick switcher.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License -- ne pas copier**

## References OSS

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **cmdk** (github.com/pacocoursey/cmdk) | **MIT** | Command palette React. Pattern Cmd+K, recherche fuzzy, navigation clavier, categories de resultats. |
| **next-themes** (github.com/pacocoursey/next-themes) | **MIT** | Theme switching pour Next.js. Pattern dark/light/system, persistence localStorage, flash prevention. |
| **zustand** (github.com/pmndrs/zustand) | **MIT** | State management leger. Deja utilise dans SignApps pour les stores UI, labels, pinned apps. |
| **react-hotkeys-hook** (github.com/JohannesKlawornn/react-hotkeys-hook) | **MIT** | Raccourcis clavier React. Pattern pour la command palette, navigation clavier, shortcuts globaux. |
| **radix-ui** (github.com/radix-ui/primitives) | **MIT** | Composants UI accessibles (Dialog, Popover, Collapsible, Tooltip). Base de shadcn/ui. |
| **dnd-kit** (github.com/clauderic/dnd-kit) | **MIT** | Drag-and-drop React performant. Pattern pour reordonner les apps epinglees, les dossiers de la sidebar. |
| **fuse.js** (github.com/krisk/Fuse) | **Apache-2.0** | Recherche fuzzy cote client. Pattern pour la command palette et la page all-apps. |
| **Heimdall** (github.com/linuxserver/Heimdall) | **MIT** | Dashboard d'apps self-hosted. Pattern grille d'apps, categories, search, pinning. |
| **Homer** (github.com/bastienwirtz/homer) | **Apache-2.0** | Dashboard statique de services. Pattern de configuration YAML pour les apps, groupes, icones. |

---

## Assertions E2E cles (a tester)

- Page /all-apps -> le titre `Toutes les Applications` est visible avec le sous-titre
- Grille groupee -> les 7 categories sont affichees avec leurs compteurs
- Clic sur le badge `Communication` -> seules les apps Communication sont affichees
- Clic sur `Toutes` -> retour a la vue groupee par categorie
- Saisie `mail` dans la recherche -> seules les apps contenant "mail" apparaissent
- Recherche sans resultat -> message `Aucune application trouvee` visible
- Clic sur une carte d'app -> navigation vers la route de l'app
- Sidebar -> les apps epinglees sont visibles et cliquables
- Sidebar collapse -> les icones sont visibles avec tooltips au hover
- Sidebar drag-and-drop -> reordonner une app epinglee persiste apres rechargement
- Sidebar dossier -> creer un dossier, drag un pin dedans, collapse/expand le dossier
- Sidebar keyboard -> Tab entre dans la sidebar, fleches naviguent, Enter active l'item
- Pin animation -> epingler une app montre le slide-in, desepingler montre le slide-out
- Label CRUD -> creer un label avec couleur, renommer, supprimer avec confirmation
- Badge notification Mail -> le compteur de non lus est affiche et se met a jour
- Cmd+K -> la command palette s'ouvre avec le champ de recherche focus
- Command palette -> saisie `cal` -> le resultat Calendar apparait, Enter navigue
- Command palette -> saisie `/new doc` -> la commande cree un nouveau document
- Command palette -> champ vide -> les recherches recentes et pages recentes s'affichent
- Command palette keyboard -> ArrowDown/Up navigue, Enter ouvre, Escape ferme
- Header -> breadcrumb affiche le chemin correct pour la page courante
- Header -> breadcrumb > 4 niveaux -> les niveaux intermediaires sont collapses
- Menu utilisateur -> le dropdown affiche nom, email, role, deconnexion
- Theme toggle -> le shell bascule entre dark et light sans rechargement
- Mobile (< 768px) -> la bottom nav affiche 5 onglets (Home, Mail, Calendar, Tasks, More)
- Mobile -> onglet actif surbrille selon la route courante
- Mobile -> swipe depuis le bord gauche ouvre la sidebar
- Mobile -> FAB visible, tap expand les actions en arc
- Quick actions -> les boutons de creation rapide sont visibles et fonctionnels
- Quick action customization -> long press ouvre le Popover d'edition, toggle et reordre fonctionnent
- Widget Keep -> le widget flottant affiche les notes recentes
- Workspace switch -> le selecteur change le workspace actif et reload les donnees
- PWA install -> le banner apparait sur les navigateurs compatibles, le bouton installe l'app
- Responsive breakpoints -> la sidebar collapse a 768px, la bottom nav apparait en dessous
- Performance -> sidebar render < 50ms, command palette first result < 100ms
- Accessibility -> skip-to-content link visible au Tab, focus trap dans les modales
- Accessibility -> toutes les icones ont aria-label, tous les badges sont annonces
- Error state -> gateway indisponible -> registre statique utilise, bandeau jaune visible
- Error state -> label name collision -> message inline `Un label avec ce nom existe deja`
- Error state -> too many pins (30) -> bouton + desactive avec tooltip
- Offline -> page /all-apps affiche le registre cache, service worker sert les assets
- Accessibility -> toutes les icones ont aria-label, tous les badges sont annonces
