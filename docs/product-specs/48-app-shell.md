# Module App Shell & Launcher — Specification fonctionnelle

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

1. **Hub centralise** — la page /all-apps est le point d'entree unique vers les 44+ applications SignApps. Elle doit permettre de trouver n'importe quelle app en moins de 3 secondes via recherche, filtrage par categorie, ou scan visuel de la grille.
2. **Navigation adaptative** — la sidebar, le header, la bottom nav mobile et la command palette forment un systeme de navigation coherent. Chaque composant est optimise pour son contexte (desktop sidebar detaillee, mobile bottom nav 5 onglets, command palette pour les power users).
3. **Personnalisation persistante** — les apps epinglees, les labels, les groupes de workspace et l'ordre de la sidebar sont persistes par utilisateur. Chaque utilisateur configure son shell selon ses habitudes sans impacter les autres.
4. **Zero latence perceptible** — le shell (header, sidebar, bottom nav) est rendu cote serveur ou cache agressivement. Les transitions entre apps utilisent le prefetching Next.js. Le skeleton loading est immediat.
5. **Accessibilite clavier complete** — chaque element du shell est navigable au clavier (Tab, Enter, Escape, fleches). La command palette (Cmd+K) permet de naviguer sans souris. Les raccourcis clavier sont documentes.
6. **Responsive first** — le layout s'adapte du mobile (320px) au desktop 4K. La sidebar collapse en icones, la bottom nav remplace la sidebar sur mobile, les grilles passent de 1 a 4 colonnes.

---

## Categorie 1 — Page All Apps (/all-apps)

### 1.1 En-tete de page
Titre `Toutes les Applications` avec sous-titre `Lancez vos applications intelligentes depuis votre portail centralise.`. L'en-tete reste fixe en haut de la page lors du scroll.

### 1.2 Barre de recherche
Champ de recherche avec icone loupe, placeholder `Rechercher une application...`. Filtre en temps reel sur le nom, la description et la categorie de chaque app. Debounce de 150ms. Quand la recherche est active, la vue groupee par categorie bascule en vue plate (grille unique sans separateurs de categorie).

### 1.3 Filtres par categorie
Rangee de boutons pill/badge horizontaux : `Toutes`, `Productivite`, `Communication`, `Organisation`, `Business`, `Infrastructure`, `Administration`, `Avance`. Le bouton actif est en style `default` (rempli), les autres en `outline`. Clic sur une categorie filtre la grille. Clic sur `Toutes` revient a la vue groupee par categorie.

### 1.4 Vue groupee par categorie (defaut)
Quand aucun filtre de recherche ni de categorie n'est actif, les apps sont affichees groupees par categorie. Chaque groupe a un header avec le nom de la categorie et un compteur (ex: `Productivite (9)`). Les apps de chaque groupe sont dans une grille responsive 1/2/3/4 colonnes.

### 1.5 Vue filtree (recherche ou categorie)
Quand un filtre est actif, les apps sont affichees dans une grille plate unique sans separateurs de categorie. Un etat vide affiche une icone Grid et le message `Aucune application trouvee` avec `Essayez de modifier votre recherche.`.

### 1.6 Carte d'application (AppCard)
Chaque app est rendue comme une SpotlightCard (effet de lumiere au hover). Contenu : icone Lucide dans un carre arrondi colore, nom en gras, description en 2 lignes max (line-clamp-2), badge de categorie en bas a gauche, fleche de navigation en bas a droite (visible au hover). Clic sur la carte navigue vers l'app.

### 1.7 Registre dynamique d'applications
Les apps proviennent du `APP_REGISTRY` statique (44 entrees) avec fallback dynamique via le gateway (`/api/v1/apps/discover`). Le registre dynamique est cache 5 minutes en localStorage. Si le gateway est indisponible, le registre statique est utilise.

### 1.8 Categories du registre
Les 7 categories fixes : `Productivite` (Docs, Sheets, Slides, Design, Keep, Forms, Wiki, Whiteboard, Vault, Signatures), `Communication` (Mail, Chat, Meet, Social), `Organisation` (Calendar, Tasks, Projects, Resources, Contacts), `Business` (CRM, Billing, Accounting, Analytics, Workforce), `Infrastructure` (Drive, Containers, VPN, Monitoring, Media, Routes, IT Assets, PXE Deploy, Remote, Serveur Mail), `Administration` (Utilisateurs, Parametres, Sauvegardes, Planificateur, Workflows, Roles, Audit Drive, Structure org, Personnes, Sites, API Docs, Hub entites, Webhooks, Conformite), `Avance` (Office, Intelligence, Favoris, App Store).

---

## Categorie 2 — Sidebar de navigation

### 2.1 Structure de la sidebar
Sidebar gauche persistante avec 3 sections principales : apps epinglees (pinned) en haut, labels au milieu, groupes de workspace en bas. La sidebar est repliable en mode icones uniquement (toggle via bouton chevron).

### 2.2 Apps epinglees
Section superieure de la sidebar affichant les apps que l'utilisateur a epinglees. Chaque entree montre l'icone Lucide et le nom de l'app. L'element actif (correspondant a la route courante) est surbrille. Drag-and-drop pour reordonner les apps epinglees. Bouton `+` pour ajouter une app depuis le registre.

### 2.3 Dossiers de pins
Les apps epinglees peuvent etre organisees en dossiers. Un dossier est repliable (Collapsible) et contient une liste d'apps. Drag-and-drop entre dossiers. Creation de dossier via le bouton `+` > `Nouveau dossier`.

### 2.4 Labels
Section de labels personnalises dans la sidebar. Chaque label a un nom, une couleur et un compteur d'items. Clic sur un label filtre le contenu de l'app active (si l'app supporte le filtrage par label). Creation, edition, suppression de labels.

### 2.5 Badges de notification
Certains items de la sidebar affichent un badge rouge avec un compteur (ex: Mail non lus, taches en retard). Les badges sont mis a jour en temps reel via polling ou WebSocket. Le hook `useSidebarBadges` centralise la logique.

### 2.6 Sidebar en mode compact
En mode compact (icones seules), la sidebar affiche uniquement les icones avec des tooltips au hover. Le mode compact est memorise par utilisateur dans le store UI.

### 2.7 Navigation contextuelle
La sidebar affiche des liens differents selon le role de l'utilisateur : les liens admin (Utilisateurs, Roles, Audit, Structure org) ne sont visibles que pour les admins. Le RBAC cote client masque les entrees non autorisees.

---

## Categorie 3 — Header global

### 3.1 Breadcrumb
En haut a gauche du header, un fil d'Ariane affiche le chemin de navigation actuel : `Accueil > Module > Page`. Le breadcrumb est cliquable a chaque niveau. Il est genere automatiquement a partir de la route Next.js.

### 3.2 Logo et nom de l'instance
Logo SignApps (composant AppLogo) en haut a gauche de la sidebar, au-dessus du breadcrumb. Clic sur le logo redirige vers le dashboard (`/dashboard`).

### 3.3 Barre de recherche universelle (Command Palette)
Raccourci `Cmd+K` (ou `Ctrl+K`) ouvre une command palette modale. Recherche unifiee sur : apps, fichiers recents, contacts, taches, documents, emails. Resultats categorises avec icones. Navigation au clavier (fleches + Enter). Fermeture par Escape ou clic en dehors.

### 3.4 Bouton notifications
Icone cloche dans le header. Badge rouge avec compteur de notifications non lues. Clic ouvre un panneau dropdown avec la liste des notifications recentes. Lien vers `/notifications` pour la vue complete.

### 3.5 Bouton aide
Icone point d'interrogation (HelpCircle). Clic ouvre un menu avec : documentation, raccourcis clavier, a propos, contact support.

### 3.6 Bouton parametres
Icone engrenage (Settings). Clic navigue vers `/settings` ou ouvre un quick-settings dropdown (theme, langue, densite).

### 3.7 Menu utilisateur
Avatar utilisateur en haut a droite. Clic ouvre un dropdown avec : nom et email, switch de role, preferences, se deconnecter. Le dropdown affiche le role actif (Admin, Utilisateur, etc.).

---

## Categorie 4 — Navigation mobile

### 4.1 Bottom navigation bar
Barre fixe en bas de l'ecran sur mobile (< 768px). 5 onglets : Home (dashboard), Mail, Calendar, Tasks, More (all-apps). Chaque onglet a une icone et un label. L'onglet actif est surbrille. Feedback haptique au tap (navigator.vibrate).

### 4.2 Detection de route active
Chaque onglet declare une fonction `match` qui teste la route actuelle. `More` matche un ensemble elargi de routes (/all-apps, /apps, /settings, /admin, /docs, /drive). Le style actif utilise `cn()` pour conditionner les classes CSS.

### 4.3 Masquage de la sidebar
Sur mobile, la sidebar est masquee par defaut. Elle peut etre ouverte via un bouton hamburger dans le header (slide-over depuis la gauche). Fermeture par swipe gauche, tap sur l'overlay, ou bouton X.

### 4.4 Safe areas
La bottom nav respecte les safe areas iOS (env(safe-area-inset-bottom)) pour eviter le chevauchement avec le home indicator.

---

## Categorie 5 — Quick actions et widgets flottants

### 5.1 Barre de quick actions
Barre flottante en bas du viewport (au-dessus de la bottom nav sur mobile) avec des actions rapides contextuelles : `Nouveau Dossier`, `Nouveau Contact`, `Nouvelle Feuille`, etc. Chaque action ouvre un dialogue de creation rapide sans quitter la page courante.

### 5.2 Widget Keep Notes
Widget flottant en bas a droite du viewport (desktop) affichant un apercu des notes Keep recentes. Repliable en un bouton compact. Clic sur une note ouvre Keep. Bouton `+` pour creer une note rapide sans quitter la page courante.

### 5.3 Bouton d'action flottant (FAB)
Sur mobile, un floating action button (FAB) en bas a droite donne acces aux actions rapides (nouveau document, nouvelle tache, etc.). Le FAB s'expand en un menu radial au tap.

---

## Categorie 6 — Layout et responsive design

### 6.1 Structure AppLayout
Le composant `AppLayout` encapsule toutes les pages. Il fournit le header, la sidebar, la bottom nav mobile, et le content area central. Le content area est scrollable independamment de la sidebar.

### 6.2 Breakpoints responsive
- **xs** (< 640px) : sidebar masquee, bottom nav visible, grille 1 colonne, header simplifie
- **sm** (640px-767px) : sidebar masquee, bottom nav visible, grille 2 colonnes
- **md** (768px-1023px) : sidebar compacte (icones), pas de bottom nav, grille 2 colonnes
- **lg** (1024px-1279px) : sidebar complete, grille 3 colonnes
- **xl** (1280px+) : sidebar complete, grille 4 colonnes

### 6.3 Transitions entre apps
La navigation entre apps utilise le prefetching Next.js (`<Link prefetch>`). Les transitions sont instantanees grace au cache du router. Un skeleton loading est affiche pendant le chargement initial des donnees de chaque app.

### 6.4 Theme et densite
Le shell respecte le theme sombre/clair defini dans les preferences utilisateur. Les tokens semantiques Tailwind (`bg-card`, `text-foreground`, `border-border`, `bg-muted`) sont utilises partout. La densite (compact/comfortable/spacious) est configurable.

---

## Categorie 7 — Persistance et synchronisation

### 7.1 Store UI (Zustand)
Le store `useUIStore` persiste : etat de la sidebar (open/collapsed), theme, densite, derniere page visitee. Persistence via localStorage.

### 7.2 Store apps epinglees (Zustand)
Le store `usePinnedAppsStore` persiste la liste des apps epinglees, leur ordre et les dossiers. Persistence via localStorage avec sync backend optionnelle.

### 7.3 Store labels (Zustand)
Le store `useLabelsStore` persiste les labels personnalises. Les labels sont synchronises avec le backend (API identity).

### 7.4 Registre d'apps dynamique
Le hook `useAppRegistry` fournit la liste des apps depuis le cache localStorage (5 min TTL) ou le gateway. Fallback sur le registre statique `APP_REGISTRY` si le gateway est indisponible.

### 7.5 Prefetching intelligent
Les apps les plus utilisees par l'utilisateur sont prefetchees au chargement du shell. Le prefetching est base sur l'historique de navigation stocke localement.

---

## Categorie 8 — Command palette et recherche universelle

### 8.1 Declenchement
Raccourci `Cmd+K` (macOS) ou `Ctrl+K` (Windows/Linux) ouvre la command palette comme modal centree avec overlay sombre. Le champ de recherche est auto-focus. Escape ou clic sur l'overlay ferme la palette.

### 8.2 Sources de resultats
La command palette interroge simultanement :
- **Applications** : les 44+ apps du registre (filtrage local, instantane)
- **Fichiers recents** : les 20 derniers fichiers ouverts (cache local)
- **Contacts** : recherche par nom, email (API signapps-contacts)
- **Taches** : recherche par titre (API signapps-calendar tasks)
- **Documents** : recherche par titre (API signapps-docs)
- **Emails** : recherche par sujet, expediteur (API signapps-mail)
- **Actions rapides** : commandes systeme (nouveau document, nouvelle tache, ouvrir parametres)

### 8.3 Categories de resultats
Les resultats sont groupes par categorie avec un header de section (ex: `Applications`, `Documents`, `Contacts`). Chaque categorie affiche au maximum 5 resultats avec un lien `Voir tous les resultats` en bas.

### 8.4 Navigation clavier
- Fleches haut/bas : naviguer entre les resultats
- Enter : ouvrir le resultat selectionne
- Tab : passer a la categorie suivante
- Escape : fermer la palette
Le resultat selectionne est surbrille visuellement.

### 8.5 Recherche fuzzy
La recherche tolere les fautes de frappe legeres (distance de Levenshtein <= 2). Les resultats sont tries par pertinence : correspondance exacte > debut de mot > contient > fuzzy. Les termes de recherche sont surbrilles dans les resultats.

### 8.6 Actions rapides (slash commands)
L'utilisateur peut taper des commandes directes :
- `/new doc` → cree un nouveau document
- `/new task` → cree une nouvelle tache
- `/settings` → ouvre les parametres
- `/logout` → se deconnecter
Les commandes disponibles sont listees quand l'utilisateur tape `/`.

### 8.7 Resultats recents
A l'ouverture de la palette (champ vide), les 10 dernieres recherches et les 10 dernieres pages visitees sont affichees. L'historique est stocke en localStorage et peut etre efface.

---

## Categorie 9 — Securite et RBAC

### 8.1 Visibilite des apps par role
Le registre d'apps filtre les entrees visibles selon le role de l'utilisateur. Les apps admin ne sont pas listees pour les utilisateurs standard. Le filtrage est applique cote client ET cote serveur (le gateway ne retourne que les apps autorisees).

### 8.2 Protection des routes
Les routes protegees redirigent vers `/login` si le JWT est absent ou expire. Le middleware Next.js intercepte les requetes avant le rendu. Le refresh token est gere automatiquement par l'intercepteur Axios.

### 8.3 Auto-login dev
En mode developpement, l'URL `http://localhost:3000/login?auto=admin` permet un login automatique sans saisir de credentials. Ce mecanisme est desactive en production.

---

## Categorie 10 — Performance et optimisation

### 10.1 Prefetching des routes
Les routes des 5 apps les plus visitees par l'utilisateur sont prefetchees au chargement du shell via `<Link prefetch>`. Le routeur Next.js cache les pages visitees dans l'historique de la session pour des retours instantanes.

### 10.2 Static shell rendering
Le layout (header, sidebar, bottom nav) est rendu avec les props par defaut au build time. Le contenu dynamique (badges, compteurs, apps epinglees) est hydrate cote client. Ceci evite le flash de contenu vide au chargement initial.

### 10.3 Code splitting par route
Chaque page d'app est un dynamic import. Le bundle JavaScript du shell est minimal (< 100 KB gzip). Les bundles des apps sont charges a la demande. Le loading skeleton est affiche pendant le chargement du chunk.

### 10.4 Cache du registre d'apps
Le registre est cache en localStorage avec un TTL de 5 minutes. Apres expiration, un re-fetch asynchrone est lance sans bloquer le rendu (stale-while-revalidate). Si le fetch echoue, le cache expire est utilise en fallback.

### 10.5 Lazy loading des images et icones
Les icones Lucide sont importees dynamiquement via `LucideIcons[name]` pour eviter de bundler les 1000+ icones. Seules les icones referencees dans le registre sont chargees. Les avatars utilisateur sont lazy-loaded avec un placeholder gris.

### 10.6 Debounce et throttle
La recherche dans la command palette est debounced a 200ms pour eviter les appels API excessifs. Le scroll de la sidebar utilise un throttle a 16ms (60fps) pour les animations. Les badges de notification sont polles toutes les 30 secondes (pas a chaque rendu).

### 10.7 Service Worker et PWA
Le shell enregistre un service worker qui cache les assets statiques (CSS, JS, icones) pour le mode offline. La page /all-apps est accessible offline avec le registre cache. Les notifications push transitent par le service worker.

---

## Categorie 11 — Accessibilite

### 11.1 ARIA landmarks
Le header porte `role="banner"`, la sidebar `role="navigation"`, la zone de contenu `role="main"`, la bottom nav `role="navigation"` avec `aria-label="Navigation mobile"`. Les landmarks permettent aux lecteurs d'ecran de naviguer entre les regions.

### 11.2 Focus management
A l'ouverture de la command palette, le focus est place sur le champ de recherche. A la fermeture, le focus retourne a l'element qui a declenche l'ouverture. La navigation au clavier (Tab) suit l'ordre logique : header → sidebar → contenu → footer.

### 11.3 Contraste et taille
Tous les textes respectent le ratio de contraste WCAG AA (4.5:1 pour le texte normal, 3:1 pour le texte large). Les icones ont une taille minimum de 24x24px pour les cibles tactiles (44x44px sur mobile).

### 11.4 Motion preferences
Les animations (transitions sidebar, hover effects, skeleton pulse) respectent `prefers-reduced-motion`. Si l'utilisateur a active la reduction des animations dans l'OS, les transitions sont instantanees.

### 11.5 Screen reader
Les badges de notification portent `aria-label` (ex: `3 emails non lus`). Les boutons icon-only portent `aria-label` (ex: `Ouvrir les notifications`). Les tooltips sont accessibles via `role="tooltip"`.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Google Workspace App Launcher** (workspace.google.com) — grille d'apps, personnalisation, switch de compte.
- **Microsoft 365 App Launcher** (microsoft.com/microsoft-365) — panneau lateral, apps recentes, recherche.
- **Notion Navigation** (notion.so/help) — sidebar, favoris, breadcrumb, Cmd+K.
- **Slack Sidebar** (slack.com/help) — channels, sections, quick switcher.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

## References OSS

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **cmdk** (github.com/pacocoursey/cmdk) | **MIT** | Command palette React. Pattern Cmd+K, recherche fuzzy, navigation clavier, categories de resultats. |
| **next-themes** (github.com/pacocoursey/next-themes) | **MIT** | Theme switching pour Next.js. Pattern dark/light/system, persistence localStorage, flash prevention. |
| **zustand** (github.com/pmndrs/zustand) | **MIT** | State management leger. Deja utilise dans SignApps pour les stores UI, labels, pinned apps. |
| **react-hotkeys-hook** (github.com/JohannesKlawornn/react-hotkeys-hook) | **MIT** | Raccourcis clavier React. Pattern pour la command palette, navigation clavier, shortcuts globaux. |
| **radix-ui** (github.com/radix-ui/primitives) | **MIT** | Composants UI accessibles (Dialog, Popover, Collapsible, Tooltip). Base de shadcn/ui. |
| **dnd-kit** (github.com/clauderic/dnd-kit) | **MIT** | Drag-and-drop React performant. Pattern pour reordonner les apps epinglees, les dossiers de la sidebar. |
| **Heimdall** (github.com/linuxserver/Heimdall) | **MIT** | Dashboard d'apps self-hosted. Pattern grille d'apps, categories, search, pinning. |
| **Homer** (github.com/bastienwirtz/homer) | **Apache-2.0** | Dashboard statique de services. Pattern de configuration YAML pour les apps, groupes, icones. |

---

## Assertions E2E cles (a tester)

- Page /all-apps → le titre `Toutes les Applications` est visible avec le sous-titre
- Grille groupee → les 7 categories sont affichees avec leurs compteurs
- Clic sur le badge `Communication` → seules les apps Communication sont affichees
- Clic sur `Toutes` → retour a la vue groupee par categorie
- Saisie `mail` dans la recherche → seules les apps contenant "mail" apparaissent
- Recherche sans resultat → message `Aucune application trouvee` visible
- Clic sur une carte d'app → navigation vers la route de l'app
- Sidebar → les apps epinglees sont visibles et cliquables
- Sidebar collapse → les icones sont visibles avec tooltips au hover
- Badge notification Mail → le compteur de non lus est affiche
- Cmd+K → la command palette s'ouvre avec le champ de recherche focus
- Command palette → saisie `cal` → le resultat Calendar apparait, Enter navigue
- Header → breadcrumb affiche le chemin correct pour la page courante
- Menu utilisateur → le dropdown affiche nom, email, role, deconnexion
- Mobile (< 768px) → la bottom nav affiche 5 onglets (Home, Mail, Calendar, Tasks, More)
- Mobile → onglet actif surbrille selon la route courante
- Quick actions → les boutons de creation rapide sont visibles et fonctionnels
- Widget Keep → le widget flottant affiche les notes recentes
- Theme toggle → le shell bascule entre dark et light sans rechargement
- Sidebar drag-and-drop → reordonner une app epinglee persiste apres rechargement
