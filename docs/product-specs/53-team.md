# Module Hub Equipe & Organigramme (Team) -- Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **BambooHR Org Chart** | Organigramme auto-genere depuis les donnees RH, photos des employes, clic sur un noeud pour voir le profil complet, filtres par departement/lieu/manager, export PDF/PNG, drag-drop pour reorganiser, postes vacants affiches, vue hierarchique et matricielle |
| **Lucidchart Org Chart** | Import CSV/LDAP/AD pour generer l'organigramme, styles visuels multiples (classique, compact, photo), conditional formatting par critere, collaboration temps reel, export multi-format, smart containers, data linking, integration HRIS |
| **Microsoft Visio Org Chart** | Wizard de creation depuis fichiers Excel/Exchange/AD, formes personnalisables, sous-organigrammes par departement, hyperlinks entre niveaux, export PDF/SVG, master shapes, themes, synchronisation avec Active Directory |
| **Workday Org Viewer** | Organigramme dynamique lie aux donnees Workday, recherche par nom/role/competence, filtres par organisation/lieu/niveau, comparaison avant/apres reorganisation, analytics de span of control, postes ouverts, succession planning |
| **Deel Org Chart** | Organigramme global avec employes dans 150+ pays, filtres par entite legale/pays/departement, vue par cost center, integration paie, export, recherche rapide, profils avec contrat et compliance, headcount analytics |
| **Lattice** | Organigramme interactif lie aux reviews de performance, filtres par manager/equipe/niveau, profils avec objectifs OKR, 1-on-1 notes, feedback, competences, vue matricielle, search by skill, export PDF |
| **Figma Org Chart Templates** | Templates visuels drag-drop, design custom des noeuds (photo, nom, titre, departement), connecteurs automatiques, couleurs par equipe, annotation, partage et commentaires, export SVG/PNG |
| **Miro Org Chart** | Canvas infini, templates d'organigrammes, sticky notes comme noeuds, connecteurs flexibles, collaboration temps reel, zoom semantique, commentaires, integration avec Jira/Asana/Slack, export multi-format |

## Principes directeurs

1. **Source de verite unique** -- l'organigramme est genere automatiquement depuis les donnees organisationnelles stockees dans la base SignApps (utilisateurs, groupes, roles, rattachements hierarchiques). Pas de saisie manuelle dupliquee : modifier la structure dans l'admin met a jour l'organigramme instantanement.
2. **Navigation intuitive** -- l'arbre est explorable par expansion/repliage des noeuds, par recherche textuelle, et par filtres (departement, site, role). L'utilisateur trouve n'importe quel collaborateur en 3 clics maximum.
3. **Vue hierarchique vivante** -- chaque noeud de l'organigramme est interactif : survol affiche un apercu (photo, nom, titre, email, telephone), clic ouvre le profil complet. Les noeuds sont des portes d'entree vers la collaboration (envoyer un message, planifier une reunion, voir les fichiers partages).
4. **Multi-vues complementaires** -- en plus de l'arbre hierarchique classique, le module propose une vue liste (annuaire), une vue grille (trombinoscope), et une vue matricielle (projets transverses). Chaque vue repond a un besoin different.
5. **Scalabilite visuelle** -- l'organigramme reste lisible de 10 a 10 000 employes grace au lazy loading des sous-arbres, au zoom semantique, et au regroupement automatique des grands departements.
6. **Gouvernance stricte** -- seuls les administrateurs et les managers designes peuvent modifier la structure organisationnelle. L'organigramme est en lecture seule pour les utilisateurs standard. Chaque modification est tracee dans l'audit log.

---

## Categorie 1 -- Organigramme hierarchique (vue arbre)

### 1.1 Page principale /team
La route /team redirige vers /team/org-chart. La page affiche le titre `Organigramme` en H1 (`text-3xl font-bold`) et le sous-titre `Vue hierarchique de la structure organisationnelle` en `text-muted-foreground`. La mise en page est un canvas SVG scrollable avec zoom, occupe 100% de la hauteur restante sous le header (`calc(100vh - header - toolbar)`).

### 1.2 Rendu de l'arbre -- d3-hierarchy
L'arbre est rendu en SVG via `d3-hierarchy` (ISC license). Le layout utilise `d3.tree()` pour calculer les positions des noeuds. Deux orientations disponibles via un toggle en toolbar :
- **Vertical** (defaut) : racine en haut, enfants vers le bas. `d3.tree().nodeSize([200, 120])` -- 200px d'espacement horizontal entre freres, 120px d'espacement vertical entre niveaux.
- **Horizontal** : racine a gauche, enfants vers la droite. `d3.tree().nodeSize([80, 250])` -- 80px vertical, 250px horizontal. Adapte aux arbres profonds.

Le toggle est un `ToggleGroup` shadcn/ui avec icones `ArrowDown` (vertical) et `ArrowRight` (horizontal). Le changement d'orientation joue une animation de transition de 500ms (`d3.transition().duration(500)`) ou les noeuds glissent vers leur nouvelle position.

### 1.3 Noeud racine
L'organigramme demarre par un noeud racine representant l'organisation (ex: `SignApps Corp`). Le noeud racine affiche : nom de l'organisation en `font-bold text-lg`, type `company` avec icone `Building2`, logo optionnel (32x32px), nombre total de membres entre parentheses (`(142)`). Il est toujours visible et ne peut pas etre replie. Le noeud racine a un fond plus sombre (`bg-primary text-primary-foreground`) pour le distinguer visuellement.

### 1.4 Types de noeuds avec couleurs distinctes
11 types de noeuds avec rendu visuel distinct et couleur codee :

| Type | Couleur | Icone (lucide-react) | Description |
|---|---|---|---|
| `company` | `#1E40AF` (bleu fonce) | `Building2` | Organisation racine |
| `division` | `#1D4ED8` (bleu) | `Building` | Grande division |
| `department` | `#2563EB` (bleu moyen) | `Briefcase` | Departement |
| `team` | `#3B82F6` (bleu clair) | `Users` | Equipe |
| `unit` | `#60A5FA` (bleu pale) | `UserCog` | Unite operationnelle |
| `committee` | `#7C3AED` (violet) | `Scale` | Comite (gouvernance) |
| `project` | `#059669` (vert) | `FolderKanban` | Equipe projet (temporaire) |
| `role` | `#D97706` (ambre) | `Shield` | Role fonctionnel |
| `position` | `#DC2626` (rouge) | `UserX` | Poste vacant |
| `virtual` | `#6B7280` (gris) | `Cloud` | Groupe virtuel (cross-fonctionnel) |
| `external` | `#9CA3AF` (gris clair) | `ExternalLink` | Entite externe (prestataire, partenaire) |

Chaque noeud groupe est rendu comme un rectangle arrondi (border-radius 8px) de 180x64px avec : pastille de couleur (8px cercle) a gauche, icone du type, nom en `font-medium` (14px), compteur de membres en `text-xs text-muted-foreground`. Les noeuds personne sont de 180x72px avec : avatar (32px, cercle) a gauche, nom en `font-medium`, titre du poste en `text-xs text-muted-foreground`, pastille de presence (8px cercle vert/orange/rouge/gris).

### 1.5 Person card -- noeud individuel
Le noeud de type personne affiche dans le rectangle SVG :
- **Avatar** : image de profil en cercle 32px. Si pas de photo, initiales sur fond colore (`getInitials(firstName, lastName)`, couleur deterministe basee sur le hash du user_id)
- **Nom complet** : `font-medium text-sm`, 1 ligne truncate
- **Titre du poste** : `text-xs text-muted-foreground`, 1 ligne truncate
- **Pastille de presence** : cercle 8px en bas a droite de l'avatar. Vert = en ligne, Orange = absent, Rouge = ne pas deranger, Gris = hors ligne, Icone palmier (4px) = en conge
- **Email** : visible uniquement au hover (tooltip)
- **Telephone** : visible uniquement au hover (tooltip)
- **Departement** : visible uniquement au hover (tooltip)
- **Reports-to** : lien cliquable vers le noeud parent dans le tooltip

### 1.6 Expansion et repliage des noeuds
Chaque noeud groupe possede un bouton toggle (cercle 20px sous le noeud) avec icone `ChevronDown` (deploye) ou `ChevronRight` (replie). Clic sur le bouton : animation de 300ms (`ease-in-out`) pour deployer/replier les enfants. Les enfants apparaissent en fade-in + slide-down. Etat par defaut : seuls les 2 premiers niveaux sont deployes (racine + enfants directs). Boutons globaux dans la toolbar : `Tout deplier` (icone `ChevronsDown`) et `Tout replier` (icone `ChevronsUp`). L'etat d'expansion est sauvegarde en localStorage (cle `team-org-expanded-nodes`, Set de node IDs).

### 1.7 Etat vide
Quand aucun noeud n'existe dans l'organigramme (nouvelle installation), affichage centre : icone `GitBranch` grisee (64px), texte `Aucun noeud dans cet organigramme` en `text-xl font-semibold`, sous-texte `Configurez la structure organisationnelle dans l'administration`, bouton `Configurer la structure` (lien vers `/admin/organization`). Cet etat n'est visible que pour les admins. Les utilisateurs standard voient `L'organigramme n'est pas encore configure. Contactez votre administrateur.`

### 1.8 Apercu au survol (tooltip)
Le survol d'un noeud personne affiche un tooltip riche (`TooltipContent` Radix, largeur 280px) avec : photo agrandie (64px), nom complet en `font-semibold`, titre du poste, departement, email (lien `mailto:`), telephone (lien `tel:`), indicateur de presence (texte : `En ligne`, `Absent depuis 2h`, `Ne pas deranger`, `Hors ligne`). Le tooltip apparait apres 300ms de survol (pas de flash au passage rapide). Il disparait en quittant le noeud. Animation : fade-in 150ms.

### 1.9 Clic sur un noeud -- panneau lateral
Le clic sur un noeud personne ouvre un panneau lateral (drawer, 400px, cote droit) avec le profil complet. Le drawer ne masque pas la vue principale et se ferme par : clic en dehors, bouton `X` en haut a droite, touche `Escape`. Animation : slide-in depuis la droite, 200ms. Le drawer affiche les informations detaillees (voir Categorie 4).

### 1.10 Zoom, pan et minimap
- **Zoom** : molette de souris ou boutons `+`/`-` dans un controle flottant en bas a droite (style Google Maps). Plage de zoom : 0.1x a 3x. Pas de zoom : 0.1 par scroll. Le zoom est centre sur la position du curseur.
- **Pan** : clic + drag sur le fond du canvas (curseur `grab` -> `grabbing`). Sur mobile : two-finger pan.
- **Fit to screen** : bouton `Maximize` (icone `Maximize2`) dans le controle de zoom. Calcule le bounding box de tous les noeuds visibles et ajuste le viewport pour tout afficher avec un padding de 40px.
- **Centre sur un noeud** : apres une recherche, l'arbre scrolle avec animation vers le noeud trouve (`d3.transition().duration(750)`), le zoom s'ajuste pour que le noeud soit centre, et un highlight pulse (anneau bleu qui grossit et fade-out en 1s) attire l'attention.
- **Minimap** : panneau semi-transparent 160x120px en bas a gauche affichant une vue simplifiee de l'arbre entier. Le viewport courant est represente par un rectangle bleu deplacable par drag. Le clic sur la minimap centre la vue sur la position cliquee. La minimap est masquable via un toggle (icone `Map`).

### 1.11 Lignes de connexion
Les connexions parent-enfant utilisent des paths SVG en courbe cubique Bezier (`d3.linkVertical()` ou `d3.linkHorizontal()` selon l'orientation). Les lignes ont un `stroke-width` de 2px et un `stroke` de `border` (s'adapte au theme clair/sombre). Les lignes en pointilles (`stroke-dasharray: 6,4`) indiquent un rattachement fonctionnel (vs hierarchique). Les lignes sont rendues sous les noeuds dans le SVG (z-index inferieur). Animation lors de l'expansion : la ligne se dessine progressivement (`stroke-dashoffset` anime de longueur totale vers 0 en 300ms).

---

## Categorie 2 -- Recherche et filtrage

### 2.1 Barre de recherche
Barre de recherche en haut de la page (`Input` shadcn/ui) avec icone `Search` et placeholder `Rechercher un collaborateur, une equipe...`. La recherche commence apres 2 caracteres (debounce 200ms). Resultats en dropdown (`Popover`) sous la barre : max 10 resultats, chaque resultat affiche avatar (24px), nom complet, titre du poste, departement. Selection d'un resultat (`Enter` ou clic) centre l'arbre sur le noeud et l'ouvre avec le highlight anime. `Escape` ferme le dropdown. `Arrow Up/Down` navigue dans les resultats.

### 2.2 Recherche fuzzy -- pg_trgm et Fuse.js
Deux niveaux de recherche :
- **Client-side** (si < 500 noeuds charges) : Fuse.js (Apache-2.0) avec keys `['name', 'title', 'email', 'department']`, threshold 0.3. Resultats instantanes.
- **Server-side** (si > 500 noeuds ou recherche avancee) : requete `GET /api/v1/team/search?q=...`. La requete SQL utilise `pg_trgm` : `WHERE name % $1 OR title % $1 ORDER BY similarity(name, $1) DESC LIMIT 10`. L'extension `pg_trgm` est activee dans la migration. Tolerance aux fautes de frappe et aux variantes.

### 2.3 Filtres par departement
Dropdown `Select` dans la toolbar avec la liste des departements/equipes (arbre hierarchique). La selection d'un departement affiche uniquement le sous-arbre de ce departement (le departement devient la racine temporaire). Multi-selection possible (`MultiSelect` composant). Un bouton `Reinitialiser` retablit la vue complete. Les filtres actifs sont affiches sous la barre de recherche comme des badges removables.

### 2.4 Filtre par site/localisation
Dropdown de filtre par site geographique (valeurs extraites du champ `location` des users). Les noeuds sont filtres pour n'afficher que les collaborateurs du site selectionne. Les noeuds groupes vides apres filtrage sont masques. Compteur de resultats : `23 collaborateurs a Paris`.

### 2.5 Filtre par niveau hierarchique
Slider (`Slider` shadcn/ui) pour filtrer par profondeur dans l'arbre. Plage : 1 (racine seulement) a max_depth. Valeur par defaut : max_depth. Deplacer le slider vers la gauche masque les niveaux les plus profonds. Label dynamique : `Niveaux 1-3 affiches`. Utile pour les vues de synthese.

### 2.6 Filtre par statut de presence
Dropdown avec options : `Tous`, `En ligne`, `Absent`, `En conge`. Le filtre masque les noeuds personnes qui ne correspondent pas au statut selectionne. Les noeuds groupes restent visibles avec un compteur mis a jour : `Engineering (12 en ligne / 28 total)`.

### 2.7 Resultats combines
Les filtres sont combinables (AND). Exemple : departement `Engineering` + site `Paris` + en ligne. Le compteur de resultats s'affiche dans un badge en haut a droite : `23 collaborateurs trouves`. Si aucun resultat, message : `Aucun collaborateur ne correspond aux filtres actifs` avec bouton `Reinitialiser les filtres`.

---

## Categorie 3 -- Vues alternatives

### 3.1 Onglets de navigation
La page /team propose des onglets dans la toolbar (`Tabs` shadcn/ui) : `Organigramme` (defaut), `Annuaire`, `Trombinoscope`, `Matriciel`. Chaque onglet est une sous-route : `/team/org-chart`, `/team/directory`, `/team/gallery`, `/team/matrix`. La barre de recherche et les filtres sont partages entre toutes les vues. La vue active est persistee en localStorage.

### 3.2 Vue Annuaire (liste)
Vue tabulaire (`Table` shadcn/ui) avec colonnes : photo (avatar 32px), nom + prenom, titre du poste, departement, email (lien `mailto:`), telephone, site, statut de presence (pastille). Tri par colonne au clic sur l'en-tete (icone `ArrowUpDown`). Pagination server-side (50 par page, composant `Pagination` avec page numbers). Export CSV/Excel via bouton `Exporter` (icone `Download`). Barre de recherche et filtres identiques a l'organigramme. Sur ecrans < 1024px, les colonnes telephone et site sont masquees. Sur mobile, seules les colonnes photo, nom et departement sont visibles.

### 3.3 Vue Trombinoscope (grille)
Grille de cartes (`Card` shadcn/ui) avec : photo grande (120x120px, cercle), nom en `font-semibold`, titre du poste en `text-sm text-muted-foreground`, departement en badge `outline`. Cartes cliquables vers le profil (drawer). Layout responsive : `grid-cols-5` desktop (> 1280px), `grid-cols-4` (1024-1280px), `grid-cols-3` tablette, `grid-cols-2` mobile. Filtres actifs appliques. Tri : alphabetique par nom (defaut), par departement. Animation d'entree : stagger fade-in de 30ms entre chaque carte.

### 3.4 Vue Matricielle (projets)
Tableau croise (`Table`) affichant les equipes en lignes et les projets/domaines en colonnes. Les cellules contiennent les avatars (24px, cercle) des collaborateurs impliques. Hover sur une cellule affiche un tooltip avec la liste des noms. Clic sur une cellule ouvre un dropdown avec la liste des membres et des liens vers leurs profils. Utile pour visualiser les equipes transverses et les double-rattachements. Les donnees proviennent de la table `group_memberships` filtree par les groupes de type `project`.

### 3.5 Vue par competences
Sous-vue optionnelle (onglet additionnel si active par l'admin) filtrant les collaborateurs par competence/skill tag. Interface : champ de recherche de competences avec auto-completion, puis grille de resultats (meme rendu que le trombinoscope) filtree par la competence selectionnee. Chaque collaborateur peut declarer ses competences dans son profil (tags libres). La recherche par competence utilise `ILIKE '%skill%'` sur le champ JSONB `skills` de la table `users`.

### 3.6 Vue par localisation (carte)
Sous-vue affichant une carte OpenStreetMap (via Leaflet, BSD-2-Clause) avec des marqueurs pour chaque site. Les marqueurs utilisent un `ClusterGroup` pour eviter la surcharge visuelle quand plusieurs sites sont proches. Clic sur un marqueur ouvre un popup avec : nom du site, adresse, nombre de collaborateurs, liste des 5 premiers (avec avatars). Lien `Voir tous` filtre l'annuaire par ce site. Les coordonnees GPS des sites sont stockees dans la table `org_sites` : `id`, `name`, `address`, `latitude`, `longitude`.

---

## Categorie 4 -- Profil collaborateur

### 4.1 Panneau lateral de profil (drawer)
Le clic sur un collaborateur (dans n'importe quelle vue) ouvre un panneau lateral (drawer, 400px, cote droit) avec le profil detaille. Le panneau ne masque pas la vue principale. Fermeture par : clic en dehors, bouton `X`, touche `Escape`, swipe vers la droite sur mobile. Animation : slide-in 200ms. Le drawer est rendu avec le composant `Sheet` de shadcn/ui (side `right`).

### 4.2 Informations affichees dans le drawer
Le profil est organise en sections avec separateurs :

**En-tete** (fond `bg-muted`, padding 24px) :
- Photo de profil (80px, cercle) avec pastille de presence (12px)
- Nom complet en `text-xl font-bold`
- Titre du poste en `text-muted-foreground`
- Departement en badge `outline`
- Bouton `...` (menu contextuel : `Copier l'email`, `Copier le telephone`)

**Contact** (section avec icones a gauche) :
- Email (icone `Mail`, lien `mailto:`)
- Telephone fixe (icone `Phone`, lien `tel:`)
- Telephone mobile (icone `Smartphone`, lien `tel:`)
- Bureau/etage (icone `MapPin`, texte)
- Fuseau horaire (icone `Clock`, texte : `14:30 (UTC+1) -- 2h de plus que vous`)

**Hierarchie** :
- Manager direct (N+1) : avatar 24px + nom (lien cliquable qui centre l'arbre sur le manager)
- Subordonnes directs (N-1) : liste d'avatars 24px + noms (liens cliquables), compteur si > 5 avec `+N autres`

**Equipes** : liste des groupes d'appartenance avec icone du type et nom (liens vers le filtre par groupe)

**Competences** : tags de skills en badges `secondary`, max 10 affiches + `+N` si plus

**Localisation** : site, pays (flag emoji 🇫🇷), fuseau horaire

### 4.3 Actions rapides
Barre de boutons en bas du header du drawer (flex horizontal, gap 8px) :
- **Envoyer un message** (icone `MessageSquare`) : ouvre `/chat` avec la conversation DM pre-selectionnee
- **Envoyer un email** (icone `Mail`) : ouvre `/mail/compose?to={email}`
- **Planifier une reunion** (icone `Calendar`) : ouvre `/calendar/new?attendees={email}`
- **Appeler** (icone `Video`) : ouvre `/meet/call/{userId}`
- **Voir les fichiers partages** (icone `FolderOpen`) : ouvre `/drive?shared_with={userId}`

Chaque bouton est un `Button` variant `outline` size `sm` avec tooltip au hover. Sur mobile, les boutons sont empiles en colonne.

### 4.4 Lien vers le profil complet
Lien `Voir le profil complet` en `text-sm text-primary underline` en bas du drawer. Ouvre la page `/profile/:userId` avec toutes les informations detaillees, les statistiques d'activite, et les parametres du collaborateur.

### 4.5 Indicateur de presence temps reel
L'indicateur de presence (pastille) est mis a jour en temps reel via WebSocket (signapps-collab, port 3013). Le protocole : le client souscrit a `presence:{userId}` et recoit les mises a jour `{ status: "online" | "away" | "dnd" | "offline", last_seen: timestamp }`. Le statut `en conge` est derive du module Calendar (si un evenement de type `leave` couvre la date courante). La pastille est rendue avec le composant `Avatar` de shadcn/ui qui accepte un prop `status`.

### 4.6 Fuseau horaire et heure locale
Pour les equipes distribuees, le profil affiche l'heure locale du collaborateur et le decalage par rapport a l'utilisateur courant. Format : `14:30 (UTC+1)` en `text-sm font-mono`. Si decalage : `-- 2h de plus que vous` ou `-- 3h de moins que vous`. L'heure se met a jour chaque minute via `setInterval`. Le fuseau horaire est stocke dans le profil utilisateur (champ `timezone`, ex: `Europe/Paris`).

---

## Categorie 5 -- Gestion de la structure (admin)

### 5.1 Mode edition de l'organigramme
Les administrateurs (roles `admin`, `super_admin`, `hr_manager`) voient un bouton `Modifier la structure` (icone `Pencil`) dans la toolbar. Le clic active le mode edition : le fond du canvas passe en `bg-muted` avec un pattern pointille, une banniere jaune en haut annonce `Mode edition actif -- les modifications sont visibles par vous uniquement jusqu'a publication`, les noeuds deviennent draggables, et des boutons d'action apparaissent sur chaque noeud. Bouton `Quitter l'edition` pour revenir au mode lecture.

### 5.2 Ajout d'un noeud
Bouton `+` (cercle 24px, `bg-primary text-primary-foreground`) visible a droite de chaque noeud en mode edition. Le clic ouvre un dialogue modal :
- **Type** : `Select` avec les 11 types de noeuds (icone + label)
- **Si groupe** : champ `Nom` (obligatoire, VARCHAR 255)
- **Si personne** : `Combobox` de recherche d'utilisateurs existants (recherche par nom/email). L'utilisateur selectionne est rattache au noeud parent.
- **Si poste vacant** : champ `Titre du poste` (obligatoire), champ `Description` (optionnel), lien vers l'offre d'emploi (URL optionnel)

Validation : un utilisateur ne peut etre rattache qu'a un seul noeud parent hierarchique (mais peut appartenir a plusieurs groupes de type `project`, `committee`, `virtual`). Le nouveau noeud apparait immediatement dans l'arbre avec animation fade-in.

### 5.3 Deplacement d'un noeud (drag-drop avec confirmation)
En mode edition, un noeud peut etre glisse vers un nouveau parent. Implementation avec les events SVG (`mousedown`, `mousemove`, `mouseup`). Pendant le drag : le noeud devient semi-transparent (opacity 0.6), une ligne pointillee relie le noeud au curseur, les parents potentiels (zones de drop) sont surlignees en bleu. Au drop sur un parent valide, un dialogue de confirmation s'ouvre : `Deplacer "[Nom]" sous "[Nouveau parent]" ? Les [N] sous-noeuds suivront.` Deux boutons : `Annuler` et `Deplacer`. Le deplacement appelle `PUT /api/v1/team/org-chart/:nodeId/parent` avec `{ new_parent_id }`. Les sous-noeuds suivent le parent deplace.

Validation : le systeme empeche les cycles (un noeud ne peut pas devenir enfant de ses propres descendants). Si un cycle est detecte, le drop est refuse avec un toast rouge : `Deplacement impossible : creerait une reference circulaire.`

### 5.4 Suppression d'un noeud
Bouton supprimer (icone `Trash2`, rouge) visible sur chaque noeud en mode edition. Le clic ouvre un dialogue de confirmation avec deux options radio :
- `Supprimer uniquement ce noeud (les enfants remontent d'un niveau)` -- les enfants deviennent enfants du parent du noeud supprime
- `Supprimer ce noeud et tous ses enfants` -- suppression en cascade

La suppression d'un noeud personne ne supprime pas l'utilisateur, seulement son rattachement dans `org_structure`. L'API appelle `DELETE /api/v1/team/org-chart/:nodeId?mode=promote_children` ou `?mode=cascade`.

### 5.5 Import depuis Active Directory / LDAP
Bouton `Importer depuis AD/LDAP` dans `/admin/organization`. Le flux :
1. **Connexion** : champs `Serveur LDAP` (URL), `Base DN`, `Bind DN`, `Mot de passe`. Bouton `Tester la connexion` (appelle `POST /api/v1/identity/ldap/test`).
2. **Mapping** : l'admin mappe les champs LDAP vers les champs SignApps. Mapping par defaut : `ou` -> departement, `manager` -> rattachement hierarchique, `cn` -> nom complet, `mail` -> email, `title` -> titre du poste, `telephoneNumber` -> telephone.
3. **Preview** : l'arbre genere depuis les donnees AD est affiche en preview. L'admin peut valider chaque noeud ou exclure des branches. Indicateurs : `Nouveaux` (vert), `Modifies` (jaune), `Supprimes` (rouge) par rapport a la structure existante.
4. **Import** : bouton `Appliquer` execute l'import. Barre de progression. Les conflits (utilisateur deja rattache ailleurs) sont listes pour resolution manuelle.
5. **Synchronisation planifiee** : toggle `Synchronisation automatique` avec frequence : `Quotidienne` (2h du matin), `Hebdomadaire` (dimanche 2h), `Mensuelle`. Stocke dans `admin_settings` (JSONB).

### 5.6 Import depuis fichier CSV
Upload d'un fichier CSV via drag-drop ou bouton `Choisir un fichier`. Format attendu (colonnes) : `nom`, `prenom`, `email`, `titre`, `departement`, `manager_email`, `site`, `telephone`. Le systeme reconstruit l'arbre hierarchique a partir des relations `manager_email` -> `email`. Preview avec :
- Detection d'erreurs : `manager_email` inconnu (badge rouge), doublons d'email (badge orange), cycles (badge rouge)
- Compteurs : `42 utilisateurs detectes, 5 departements, 3 erreurs`
- Bouton `Corriger` pour les erreurs (modal d'edition par ligne)
Apres validation, `POST /api/v1/team/import/csv` avec le CSV corrige.

### 5.7 Export CSV
Bouton `Exporter CSV` dans la toolbar. Colonnes : nom, prenom, email, titre, departement, manager_nom, manager_email, site, telephone, date_embauche. L'export respecte les filtres actifs (si un departement est filtre, seul ce departement est exporte). Le fichier est genere cote serveur (`GET /api/v1/team/export?format=csv`) et telecharge.

### 5.8 Historique des modifications et audit
Chaque modification de la structure (ajout, deplacement, suppression de noeud) est tracee dans la table `org_audit_log` : `id`, `action` (enum: `node_created`, `node_moved`, `node_deleted`, `import_ldap`, `import_csv`), `node_id`, `node_name`, `old_parent_id`, `new_parent_id`, `performed_by` (UUID FK users), `metadata` (JSONB), `created_at`. L'admin peut consulter l'historique dans `/admin/organization/history` : timeline chronologique avec filtres par action et par auteur. Bouton `Annuler` sur les modifications recentes (< 24h) qui inverse l'operation.

### 5.9 Snapshots historiques (vue de l'organigramme a une date passee)
L'admin peut visualiser l'organigramme tel qu'il etait a n'importe quelle date passee. Un composant `DatePicker` dans la toolbar permet de selectionner une date. L'API `GET /api/v1/team/org-chart?at=2026-01-15` reconstruit l'arbre depuis les snapshots. Implementation : la table `org_structure_snapshots` stocke un snapshot JSON de l'arbre complet a chaque modification. La vue historique est en lecture seule avec un bandeau bleu : `Vue historique -- Organigramme au 15 janvier 2026`. Bouton `Comparer avec aujourd'hui` affiche un diff visuel (noeuds ajoutes en vert, supprimes en rouge, deplaces en jaune).

### 5.10 Reorganisation planifiee (draft mode)
L'admin peut preparer une reorganisation en mode brouillon. Le bouton `Nouvelle reorganisation` (dans `/admin/organization`) cree un draft : `org_restructure_drafts` table avec `id`, `name`, `created_by`, `status` (draft/published/cancelled), `changes` (JSONB -- liste des operations), `scheduled_for` (TIMESTAMPTZ nullable), `created_at`. Les modifications du draft sont invisibles pour les utilisateurs. L'admin peut previsualiser le resultat (diff visuel avant/apres). Le bouton `Publier` applique toutes les modifications atomiquement. Si `scheduled_for` est defini, un job CRON publie automatiquement a la date programmee.

---

## Categorie 6 -- Synchronisation et donnees

### 6.1 Schema PostgreSQL
```sql
CREATE TABLE org_structure (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id   UUID REFERENCES org_structure(id) ON DELETE SET NULL,
    node_type   VARCHAR(20) NOT NULL,  -- company, division, department, team, unit, committee, project, role, position, virtual, external
    entity_id   UUID,  -- FK vers groups.id ou users.id selon node_type
    name        VARCHAR(255) NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    metadata    JSONB DEFAULT '{}',  -- champs additionnels selon le type
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_parent ON org_structure(parent_id);
CREATE INDEX idx_org_type ON org_structure(node_type);
CREATE INDEX idx_org_entity ON org_structure(entity_id);

-- Recursive CTE pour obtenir l'arbre complet
-- WITH RECURSIVE org_tree AS (
--   SELECT *, 0 AS depth FROM org_structure WHERE parent_id IS NULL
--   UNION ALL
--   SELECT os.*, ot.depth + 1 FROM org_structure os JOIN org_tree ot ON os.parent_id = ot.id
-- )
-- SELECT * FROM org_tree ORDER BY depth, sort_order;

CREATE TABLE org_sites (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    address     TEXT,
    latitude    DOUBLE PRECISION,
    longitude   DOUBLE PRECISION,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE org_structure_snapshots (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot    JSONB NOT NULL,  -- arbre complet au moment de la modification
    action      VARCHAR(50) NOT NULL,
    performed_by UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE org_audit_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action        VARCHAR(50) NOT NULL,
    node_id       UUID,
    node_name     VARCHAR(255),
    old_parent_id UUID,
    new_parent_id UUID,
    performed_by  UUID REFERENCES users(id),
    metadata      JSONB DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_created ON org_audit_log(created_at DESC);
```

### 6.2 API REST complete
Endpoints servis par le service signapps-gateway (port 3099) :

| Methode | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/team/org-chart` | Arbre complet (ou premiers niveaux). Query: `depth` (defaut 2), `at` (date pour snapshot historique). | JWT requis |
| `GET` | `/api/v1/team/org-chart/:nodeId/children` | Enfants d'un noeud (lazy loading). | JWT requis |
| `GET` | `/api/v1/team/directory` | Liste paginee des collaborateurs. Query: `page`, `limit`, `sort`, `department`, `site`, `status`, `search`. | JWT requis |
| `GET` | `/api/v1/team/search?q=...` | Recherche textuelle (pg_trgm). Retourne max 10 resultats. | JWT requis |
| `POST` | `/api/v1/team/org-chart` | Ajouter un noeud. Body: `{ parent_id, node_type, name, entity_id? }`. | JWT admin |
| `PUT` | `/api/v1/team/org-chart/:nodeId/parent` | Deplacer un noeud. Body: `{ new_parent_id }`. | JWT admin |
| `PUT` | `/api/v1/team/org-chart/:nodeId` | Modifier un noeud (nom, type, metadata). | JWT admin |
| `DELETE` | `/api/v1/team/org-chart/:nodeId` | Supprimer un noeud. Query: `mode` (promote_children, cascade). | JWT admin |
| `GET` | `/api/v1/team/export` | Exporter. Query: `format` (csv, json, pdf, png, svg). | JWT requis |
| `POST` | `/api/v1/team/import/csv` | Importer depuis CSV. Body: multipart avec fichier. | JWT admin |
| `POST` | `/api/v1/team/import/ldap` | Importer depuis AD/LDAP. Body: `{ config, mapping }`. | JWT admin |
| `GET` | `/api/v1/team/analytics` | Metriques organisationnelles (admin). | JWT admin |

### 6.3 Lazy loading des sous-arbres
Pour les grandes organisations (> 200 noeuds), l'arbre n'est pas charge entierement a l'ouverture. Le premier appel `GET /api/v1/team/org-chart?depth=2` retourne les 2 premiers niveaux. L'expansion d'un noeud appelle `GET /api/v1/team/org-chart/:nodeId/children`. Pendant le fetch, un spinner (16px) remplace le chevron du noeud. Les donnees sont mises en cache dans TanStack Query (staleTime 60s, query key `['org-chart', nodeId, 'children']`).

### 6.4 Cache et performance
Cote serveur : signapps-cache moka avec TTL 5 minutes pour l'arbre complet (cle `org_chart_tree`). L'invalidation se fait sur les events PgEventBus de type `org_structure_changed`. Cote client : TanStack Query avec staleTime 60s. Le rendu SVG de l'arbre est optimise : seuls les noeuds visibles dans le viewport sont rendus (SVG viewport culling). Pour les arbres > 1000 noeuds, les noeuds hors viewport sont remplaces par des placeholders legers (rectangle gris).

### 6.5 Export de l'organigramme
Boutons d'export dans la toolbar (dropdown `DropdownMenu`) :
- **PDF** : rendu de l'arbre visible via `jsPDF` (MIT) + capture SVG. Options : format (A4, A3, Letter), orientation (portrait/paysage), titre, logo. Generation cote client.
- **PNG** : capture du canvas SVG via `html-to-image` (MIT). Resolution : 2x pour haute qualite. Le fichier est telecharge immediatement.
- **SVG** : export du SVG brut (DOM SVG serialise). Conserve les polices et couleurs.
- **CSV** : export des donnees tabulaires via l'API backend.

### 6.6 Synchronisation temps reel
Les modifications de la structure (par un admin en mode edition) sont propagees en temps reel via WebSocket (signapps-collab) a tous les utilisateurs visualisant l'organigramme. Evenements : `org:node_added`, `org:node_moved`, `org:node_deleted`. Les noeuds ajoutes apparaissent avec animation fade-in + scale-up. Les noeuds deplaces glissent vers leur nouvelle position (transition 500ms). Les noeuds supprimes disparaissent avec animation fade-out + scale-down.

---

## Categorie 7 -- Securite et permissions

### 7.1 Lecture pour tous
Tous les utilisateurs authentifies ont acces en lecture a l'organigramme. Ils peuvent naviguer, rechercher et consulter les profils. La visibilite des informations de contact depend des preferences de confidentialite de chaque utilisateur (champs `phone_visible`, `email_visible` dans le profil, defaut `true`).

### 7.2 Modification restreinte
La modification de la structure est reservee aux roles : `super_admin`, `admin`, `hr_manager`. Le middleware auth verifie le role dans le JWT claims. Les endpoints `POST`, `PUT`, `DELETE` sur `/api/v1/team/org-chart` retournent 403 pour les roles non autorises. Le bouton `Modifier la structure` n'est pas rendu dans le DOM pour les utilisateurs non autorises (pas juste masque en CSS).

### 7.3 Informations sensibles masquees
Certaines informations du profil peuvent etre masquees selon les preferences de chaque utilisateur :
- Telephone personnel : masquable (defaut visible)
- Adresse email secondaire : masquable
- Date de naissance : masquable (defaut masque)
L'admin configure les champs visibles par defaut dans `/admin/settings/privacy`. Le masquage est applique cote backend (les champs masques ne sont pas inclus dans la reponse API, pas juste masques en frontend).

### 7.4 Audit log
Les modifications de structure et les exports sont traces dans `org_audit_log`. Les consultations de l'organigramme ne sont pas loguees (trop de volume). Les acces aux informations sensibles (telephone, email d'un utilisateur qui les a masques via un admin override) sont traces.

### 7.5 RGPD et droit d'acces
Les donnees affichees dans l'organigramme sont soumises au RGPD. L'utilisateur peut demander la suppression de ses informations personnelles via /help. L'admin dispose d'un outil de pseudonymisation dans `/admin/users/:id/anonymize` pour les anciens employes : remplace le nom par `Ancien collaborateur #[hash]`, supprime la photo, l'email et le telephone, conserve le noeud dans l'arbre avec le titre du poste pour l'historique.

### 7.6 Separation des contextes (multi-tenant)
L'organigramme respecte les unites organisationnelles (OU) et les politiques GPO. Un utilisateur d'une filiale ne voit que l'organigramme de sa filiale (filtre par le champ `org_unit_id` dans le JWT claims), sauf si l'admin active la visibilite globale. Les cross-functional groups (type `virtual`) sont visibles dans la vue matricielle uniquement pour les membres concernes.

---

## Categorie 8 -- Analytics et reporting

### 8.1 Dashboard effectifs
Vue admin `/admin/organization/analytics` affichant les metriques cles dans des `Card` :
- **Effectif total** : compteur grand format (ex: `142 collaborateurs`)
- **Repartition par departement** : bar chart horizontal (`recharts` BarChart), clickable pour filtrer
- **Repartition par site** : pie chart (`recharts` PieChart) avec legende
- **Ratio managers/contributeurs** : donut chart (ex: `1:7`)
- **Postes vacants** : compteur + liste des postes ouverts avec lien vers l'offre
- **Anciennete moyenne** : valeur en annees, bar chart par departement

Les donnees sont calculees en temps reel depuis la base (views materialisees rafraichies toutes les heures).

### 8.2 Span of control
Metrique indiquant le nombre moyen de subordonnes directs par manager. Calcul SQL : `SELECT avg(child_count) FROM (SELECT parent_id, count(*) as child_count FROM org_structure WHERE node_type IN ('team','unit') GROUP BY parent_id)`. Affichage par departement et par niveau hierarchique (heatmap). Alertes visuelles si un manager depasse le seuil configurable (defaut : 12 subordonnes directs, badge rouge).

### 8.3 Profondeur de l'arbre
Indicateur du nombre de niveaux hierarchiques. Calcul via le CTE recursif (`max(depth)`). Benchmark interne affiche en texte : `4 niveaux (optimal : 4-6)` en vert, `8 niveaux (attention : > 6)` en orange, `10 niveaux (alerte : > 8)` en rouge. L'indicateur est affiche comme un progress bar colore.

### 8.4 Taux de completude des profils
Pourcentage de profils ayant toutes les informations renseignees. Champs verifies : photo (non null), titre du poste, departement, telephone, competences (au moins 1). Affichage en donut chart (ex: `78% complets`). Liste des profils incomplets avec bouton `Envoyer un rappel` (email via signapps-notifications). Le rappel est envoye max 1 fois par mois par utilisateur.

### 8.5 Historique des reorganisations
Timeline (`Timeline` composant custom) affichant les modifications structurelles majeures : creation de departement, fusion d'equipes, deplacements de personnes. Chaque evenement est une `Card` avec : date, auteur (avatar + nom), description de l'action, bouton `Voir le diff` qui affiche l'arbre avant/apres (cote a cote ou superpose avec couleurs). Filtres par type d'action et par periode.

### 8.6 Export rapport organisationnel
Bouton `Generer un rapport` dans le dashboard admin. Generation d'un PDF complet contenant : page de titre, organigramme visuel (capture SVG), tableau des effectifs par departement, metriques cles (span of control, profondeur, completude), postes vacants, historique des reorganisations recentes. Le PDF est genere cote serveur (signapps-office, port 3018) et telecharge. Format A4 paysage, logo de l'organisation en en-tete.

---

## Categorie 9 -- Accessibilite et responsive

### 9.1 Navigation clavier de l'organigramme
L'arbre SVG est entierement navigable au clavier via des handlers d'evenements clavier sur le container :
- `Arrow Down` : naviguer vers le premier enfant du noeud en focus
- `Arrow Up` : naviguer vers le parent
- `Arrow Right` : naviguer vers le frere suivant (meme niveau)
- `Arrow Left` : naviguer vers le frere precedent
- `Enter` : ouvrir le profil (drawer) du noeud en focus
- `Space` : toggle expand/collapse du noeud en focus
- `Tab` : passer aux controles (recherche, filtres, boutons toolbar)
- `Home` : aller au noeud racine
- `End` : aller au dernier noeud visible
- `/` : activer la barre de recherche

Le focus visible est un anneau bleu (`ring-2 ring-primary`) autour du noeud SVG actif. Le noeud en focus est annonce par le lecteur d'ecran.

### 9.2 Accessibilite ARIA
Chaque noeud SVG utilise `role="treeitem"` avec `aria-expanded` pour les noeuds groupes (true/false). Le container de l'arbre utilise `role="tree"`. Les niveaux hierarchiques sont annonces par `aria-level`. Les tooltips utilisent `aria-describedby`. Le compteur de resultats de recherche utilise `aria-live="polite"`. Les boutons d'action (expand, drawer, actions rapides) ont des `aria-label` explicites.

### 9.3 Vue responsive mobile (< 768px)
Sur mobile, l'organigramme arbre est remplace par une vue liste hierarchique verticale avec indentation (4 niveaux de padding-left : 0px, 16px, 32px, 48px). Chaque noeud est un item de liste (`Card` compact, hauteur 56px) avec : chevron d'expansion a gauche, avatar (32px), nom, titre du poste truncate. Le clic ouvre le profil en plein ecran (bottom sheet via `Sheet` shadcn/ui side `bottom`). Les filtres sont accessibles via un bouton `Filter` (icone `SlidersHorizontal`) qui ouvre un drawer. Le zoom et le pan SVG sont remplaces par du scroll natif. La minimap est masquee.

### 9.4 Vue responsive tablette (768-1024px)
Sur tablette, l'organigramme affiche 2 niveaux visibles par defaut (au lieu de 3 sur desktop). Le canvas SVG prend toute la largeur avec scroll horizontal natif. Le panneau de profil s'ouvre en demi-ecran lateral (50% de la largeur). Les filtres restent dans la toolbar mais sont compresses (dropdown au lieu de boutons visibles).

### 9.5 Mode impression
Bouton `Imprimer` (icone `Printer`) dans la toolbar. Genere une version CSS `@media print` : fond blanc, lignes noires, photos en niveaux de gris (`filter: grayscale(1)`), une page par departement si l'arbre est trop grand. Les noeuds sont rendus a une taille fixe pour eviter le debordement. Le titre de l'organisation et la date d'impression sont ajoutes en en-tete. Les controles (recherche, filtres, zoom) sont masques a l'impression.

### 9.6 Mode sombre
L'organigramme s'adapte au theme sombre de SignApps : fond du canvas `bg-background`, lignes de connexion `stroke: hsl(var(--border))`, noeuds avec fond `bg-card` et bordure `border`, avatars avec contour blanc (2px) pour la lisibilite. Les couleurs des types de noeuds sont ajustees pour le mode sombre (luminosite +10% pour compenser le fond fonce). La minimap utilise le meme schema de couleurs. Les pastilles de presence conservent leurs couleurs vives.

---

## Categorie 10 -- State management et animations

### 10.1 Store Zustand pour l'organigramme
Le store `useOrgChartStore` gere l'etat de la vue organigramme :
```typescript
interface OrgChartState {
  orientation: 'vertical' | 'horizontal';
  expandedNodeIds: Set<string>;
  selectedNodeId: string | null;
  focusedNodeId: string | null;
  zoom: number;
  panOffset: { x: number; y: number };
  isEditMode: boolean;
  activeFilters: {
    department: string[];
    site: string[];
    level: number;
    status: string;
  };
  searchQuery: string;
  activeView: 'org-chart' | 'directory' | 'gallery' | 'matrix';
}
```
Le store persiste `orientation`, `expandedNodeIds`, `zoom`, `panOffset` et `activeView` dans localStorage via le middleware `persist` de Zustand. Les mutations de structure (mode edition) ne passent pas par le store mais par TanStack Query (`useMutation`) avec invalidation du cache `['org-chart']` apres success.

### 10.2 Animations d3 de l'arbre
Toutes les transitions de l'arbre utilisent `d3.transition()` :
- **Expansion d'un noeud** : les enfants apparaissent depuis la position du parent, glissent vers leur position finale en 300ms (ease `d3.easeCubicOut`). Les lignes de connexion se dessinent progressivement (stroke-dashoffset).
- **Repliage** : les enfants glissent vers la position du parent et disparaissent en 300ms.
- **Changement d'orientation** : tous les noeuds glissent vers leur nouvelle position en 500ms.
- **Centre sur un noeud (apres recherche)** : le viewport scrolle en 750ms vers le noeud, zoom ajuste, puis highlight pulse (anneau bleu, 2 pulses de 500ms chacun).
- **Ajout de noeud (mode edition)** : fade-in + scale 0 -> 1 en 200ms.
- **Suppression de noeud** : fade-out + scale 1 -> 0 en 200ms, puis repositionnement des freres en 300ms.
- **Deplacement de noeud** : le noeud glisse vers sa nouvelle position en 500ms, les lignes se redessinent.

### 10.3 Gestion du mode edition (draft)
En mode edition, les modifications sont appliquees localement dans un etat `draftChanges` du store. Les changements ne sont pas envoyes au serveur immediatement. L'admin voit un badge `3 modifications non publiees` dans la banniere. Le bouton `Publier les modifications` envoie toutes les operations en batch (`POST /api/v1/team/org-chart/batch` avec `{ operations: [{ type, nodeId, ... }] }`). Le bouton `Annuler tout` reinitialise le draft. Cela permet de preparer plusieurs modifications et de les valider ensemble, evitant les etats intermediaires incoherents.

---

## References OSS

**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License -- ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **d3-hierarchy** (github.com/d3/d3-hierarchy) | **ISC** | Module D3.js pour les layouts hierarchiques (tree, cluster, treemap, partition). Algorithmes de layout pour positionner les noeuds automatiquement. Directement utilisable. |
| **React Flow** (github.com/xyflow/xyflow) | **MIT** | Bibliotheque React pour les diagrammes interactifs (noeuds + edges). Pattern pour le canvas zoomable, le pan, et les connexions. Alternative a d3 pur pour le rendu. |
| **react-organizational-chart** (github.com/nicehash/react-organizational-chart) | **MIT** | Composant React specifique pour les organigrammes. Pattern basique de rendu arborescent avec expansion/repliage. Leger et extensible. |
| **Dagre** (github.com/dagrejs/dagre) | **MIT** | Layout engine pour les graphes diriges. Algorithme de positionnement automatique des noeuds pour des arbres complexes. Utilisable avec React Flow ou d3. |
| **html-to-image** (github.com/nicehash/html-to-image) | **MIT** | Capture de HTML/SVG en PNG/SVG/JPEG. Pattern pour l'export de l'organigramme en image haute resolution. |
| **jsPDF** (github.com/parallax/jsPDF) | **MIT** | Generation de PDF cote client. Pattern pour l'export PDF de l'organigramme. |
| **Fuse.js** (github.com/krisk/Fuse) | **Apache-2.0** | Recherche fuzzy cote client. Pattern pour la recherche instantanee dans l'annuaire des collaborateurs. |
| **Leaflet** (github.com/Leaflet/Leaflet) | **BSD-2-Clause** | Carte interactive pour la vue par localisation. Leger, mobile-friendly, extensible. |
| **recharts** (github.com/recharts/recharts) | **MIT** | Graphiques React pour les analytics (bar chart, pie chart, donut). |

---

## Assertions E2E cles (a tester)

- Navigation vers /team redirige vers /team/org-chart
- La page affiche le titre `Organigramme` et le sous-titre descriptif
- Le noeud racine (type `company`) est visible a l'ouverture avec le nom de l'organisation et le compteur de membres
- Toggle orientation vertical/horizontal : l'arbre se reoriente avec animation de transition 500ms
- Les noeuds de type `department` affichent l'icone `Briefcase` et la couleur bleu moyen
- Les noeuds de type `person` affichent l'avatar, le nom, le titre et la pastille de presence
- Les noeuds de type `position` (poste vacant) affichent le badge `Ouvert`
- Les boutons `Tout deplier` et `Tout replier` sont presents et fonctionnels
- Clic sur `Tout deplier` : tous les noeuds enfants sont visibles avec animation
- Clic sur `Tout replier` : seul le noeud racine et ses enfants directs sont visibles
- Clic sur le chevron d'un noeud groupe : les enfants apparaissent avec animation fade-in
- Etat vide (aucun noeud) : message `Aucun noeud dans cet organigramme` avec bouton de configuration
- Survol d'un noeud personne : tooltip riche avec photo 64px, nom, titre, email, telephone apres 300ms
- Clic sur un noeud personne : drawer lateral avec profil complet et actions rapides
- Actions rapides : clic `Envoyer un message` : ouverture de /chat avec le bon destinataire
- Actions rapides : clic `Planifier une reunion` : ouverture de /calendar/new avec l'invite pre-remplie
- Recherche par nom dans la barre : resultats en dropdown avec avatars, selection centre l'arbre sur le noeud avec highlight anime
- Recherche avec faute de frappe : le fuzzy matching trouve quand meme le resultat
- Filtre par departement : seul le sous-arbre du departement selectionne est affiche
- Filtre par site : seuls les collaborateurs du site selectionne sont affiches
- Slider de profondeur : deplacer vers la gauche masque les niveaux les plus profonds
- Filtres combines (departement + site) : compteur de resultats affiche
- Onglet `Annuaire` : vue tabulaire avec colonnes triables et pagination
- Onglet `Trombinoscope` : grille de cartes avec photos 120px et noms
- Onglet `Matriciel` : tableau croise equipes x projets avec avatars dans les cellules
- Export CSV depuis l'annuaire : fichier telecharge avec les colonnes attendues
- Export PNG de l'organigramme : image haute resolution 2x du canvas SVG
- Export PDF : fichier PDF avec l'arbre et les metadonnees
- Zoom molette : l'arbre se zoom/dezoom fluidement
- Pan (clic+drag) : le canvas se deplace
- Bouton `Fit to screen` : l'arbre entier est visible dans le viewport
- Minimap visible en bas a gauche : le rectangle bleu represente le viewport courant
- Drag du rectangle dans la minimap : le viewport principal se deplace
- L'indicateur de presence est affiche en temps reel (pastille verte/orange/rouge/grise)
- Mode edition (admin) : bouton `Modifier la structure` visible, fond pointille active
- Mode edition : drag-drop d'un noeud vers un nouveau parent : dialogue de confirmation, deplacement effectif
- Mode edition : cycle detecte lors du drag-drop : toast rouge `reference circulaire` affiche
- Mode edition : ajout d'un noeud enfant via bouton `+` : dialogue modal, le noeud apparait dans l'arbre
- Mode edition : suppression d'un noeud avec option `promote children` : les enfants remontent
- Les utilisateurs non-admin ne voient pas le bouton `Modifier la structure`
- Import CSV : upload, preview avec detection d'erreurs, import avec barre de progression
- Snapshot historique : selection d'une date passee dans le DatePicker : arbre en lecture seule avec bandeau bleu
- Dashboard analytics (admin) : effectif total, repartition par departement, span of control affiches
- Span of control : alerte rouge si un manager depasse 12 subordonnes
- Profondeur de l'arbre : indicateur avec benchmark (vert si 4-6, orange si > 6, rouge si > 8)
- Taux de completude des profils : donut chart avec pourcentage
- Vue mobile (< 768px) : l'organigramme est remplace par une liste avec indentation
- Mode sombre : les noeuds, lignes et minimap s'adaptent au theme sombre
- Navigation clavier : Arrow Down/Up/Left/Right naviguent entre les noeuds, Enter ouvre le drawer
- ARIA : les noeuds utilisent `role="treeitem"` et `aria-expanded`
- Fuseau horaire dans le profil : l'heure locale et le decalage sont affiches correctement
