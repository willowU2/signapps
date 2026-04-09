# Module Hub Equipe & Organigramme (Team) — Specification fonctionnelle

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

1. **Source de verite unique** — l'organigramme est genere automatiquement depuis les donnees organisationnelles stockees dans la base SignApps (utilisateurs, groupes, roles, rattachements hierarchiques). Pas de saisie manuelle dupliquee : modifier la structure dans l'admin met a jour l'organigramme instantanement.
2. **Navigation intuitive** — l'arbre est explorable par expansion/repliage des noeuds, par recherche textuelle, et par filtres (departement, site, role). L'utilisateur trouve n'importe quel collaborateur en 3 clics maximum.
3. **Vue hierarchique vivante** — chaque noeud de l'organigramme est interactif : survol affiche un apercu (photo, nom, titre, email, telephone), clic ouvre le profil complet. Les noeuds sont des portes d'entree vers la collaboration (envoyer un message, planifier une reunion, voir les fichiers partages).
4. **Multi-vues complementaires** — en plus de l'arbre hierarchique classique, le module propose une vue liste (annuaire), une vue grille (trombinoscope), et une vue matricielle (projets transverses). Chaque vue repond a un besoin different.
5. **Scalabilite visuelle** — l'organigramme reste lisible de 10 a 10 000 employes grace au lazy loading des sous-arbres, au zoom semantique, et au regroupement automatique des grands departements.
6. **Gouvernance stricte** — seuls les administrateurs et les managers designes peuvent modifier la structure organisationnelle. L'organigramme est en lecture seule pour les utilisateurs standard. Chaque modification est tracee dans l'audit log.

---

## Categorie 1 — Organigramme hierarchique (vue arbre)

### 1.1 Page principale /team
La route /team redirige vers /team/org-chart. La page affiche le titre `Organigramme` et le sous-titre `Vue hierarchique de la structure organisationnelle`. La mise en page est un canvas scrollable avec zoom.

### 1.2 Noeud racine
L'organigramme demarre par un noeud racine representant l'organisation (ex: `SignApps Corp`). Le noeud racine affiche : nom de l'organisation, type `group`, logo optionnel, nombre total de membres. Il est toujours visible et ne peut pas etre replie.

### 1.3 Noeuds enfants
Chaque noeud peut avoir des enfants (sous-groupes ou individus). Les enfants sont connectes au parent par des lignes verticales et horizontales (tree layout). Le layout s'adapte automatiquement au nombre d'enfants (horizontal si < 8, vertical sinon).

### 1.4 Types de noeuds
Trois types de noeuds avec rendu visuel distinct :
- **Groupe** (departement, equipe, direction) — icone dossier, fond colore par niveau, compteur de membres entre parentheses
- **Personne** (employe) — avatar photo, nom complet, titre du poste, indicateur de presence en ligne
- **Poste vacant** — icone ghost, titre du poste, badge `Ouvert`, lien vers l'offre d'emploi (si existante)

### 1.5 Expansion et repliage des noeuds
Chaque noeud groupe possede un toggle expand/collapse (icone chevron). Etat par defaut : seul le premier niveau est deploye. Boutons globaux `Tout deplier` et `Tout replier` en haut de la page. L'etat d'expansion est sauvegarde par session (localStorage).

### 1.6 Etat vide
Quand aucun noeud n'existe dans l'organigramme, affichage centre : icone arbre grisee, texte `Aucun noeud dans cet organigramme`, bouton `Configurer la structure` (lien vers /admin/organization). Cet etat apparait pour les nouvelles installations.

### 1.7 Apercu au survol (tooltip)
Le survol d'un noeud personne affiche un tooltip riche : photo agrandie, nom complet, titre du poste, departement, email, telephone, indicateur de presence (en ligne, absent, occupe, ne pas deranger). Le tooltip disparait en quittant le noeud.

### 1.8 Clic sur un noeud
Le clic sur un noeud personne ouvre un panneau lateral (drawer) avec le profil complet : informations de contact, rattachement hierarchique (N+1, N-1), equipes, projets, competences, et actions rapides (envoyer un message, planifier une reunion, appeler).

### 1.9 Zoom et navigation
- **Zoom** — molette de souris ou boutons +/- pour zoomer/dezoomer. Niveau de zoom sauvegarde.
- **Pan** — glisser le canvas pour naviguer (clic + drag sur le fond).
- **Fit to screen** — bouton pour ajuster le zoom afin que l'arbre entier soit visible.
- **Centre sur un noeud** — apres une recherche, l'arbre se recentre sur le noeud trouve avec un highlight anime.

### 1.10 Lignes de connexion
Les connexions parent-enfant utilisent des lignes orthogonales (angle droit) avec des coins arrondis. La couleur des lignes correspond au niveau hierarchique. Les lignes en pointilles indiquent un rattachement fonctionnel (vs hierarchique).

---

## Categorie 2 — Recherche et filtrage

### 2.1 Barre de recherche
Barre de recherche en haut de la page avec placeholder `Rechercher un collaborateur, une equipe...`. Recherche sur : nom, prenom, titre du poste, nom de departement, email. Resultats en dropdown avec avatars et titres. Selection d'un resultat centre l'arbre sur le noeud.

### 2.2 Recherche fuzzy
Tolerance aux fautes de frappe et aux variantes (Jean-Pierre → J.P., Marketing → Mkg). Utilisation de trigram matching (pg_trgm) cote serveur pour les requetes complexes. Resultats tries par pertinence.

### 2.3 Filtres par departement
Dropdown de filtres par departement/equipe. La selection d'un departement affiche uniquement le sous-arbre de ce departement. Multi-selection possible (afficher Marketing + Ventes).

### 2.4 Filtre par site/localisation
Dropdown de filtre par site geographique (siege, agence, teletravail). Les noeuds sont filtres pour n'afficher que les collaborateurs du site selectionne. Utile pour les organisations multi-sites.

### 2.5 Filtre par niveau hierarchique
Slider ou dropdown pour filtrer par profondeur dans l'arbre : N (direction), N-1 (managers), N-2 (equipes), etc. Utile pour les vues de synthese (afficher uniquement les 3 premiers niveaux).

### 2.6 Filtre par statut de presence
Filtre par statut en ligne : tous, en ligne, absent, en conge. Permet de trouver rapidement les collaborateurs disponibles.

### 2.7 Resultats combines
Les filtres sont combinables (AND). Exemple : departement `Engineering` + site `Paris` + en ligne. Le compteur de resultats s'affiche : `23 collaborateurs trouves`.

---

## Categorie 3 — Vues alternatives

### 3.1 Onglets de navigation
La page /team propose des onglets en haut : `Organigramme` (defaut), `Annuaire`, `Trombinoscope`, `Matriciel`. Chaque onglet est une sous-route : /team/org-chart, /team/directory, /team/gallery, /team/matrix.

### 3.2 Vue Annuaire (liste)
Vue tabulaire avec colonnes : photo, nom, prenom, titre, departement, email, telephone, site, statut. Tri par colonne (clic sur l'en-tete). Pagination (50 par page). Export CSV/Excel. Barre de recherche et filtres identiques a l'organigramme.

### 3.3 Vue Trombinoscope (grille)
Grille de cartes avec : photo (grande), nom, titre, departement. Cartes cliquables vers le profil. Responsive : 5 colonnes desktop, 3 tablette, 2 mobile. Filtres actifs appliques. Tri par nom alphabetique ou par departement.

### 3.4 Vue Matricielle (projets)
Tableau croise affichant les equipes en lignes et les projets/domaines en colonnes. Les cellules contiennent les avatars des collaborateurs impliques. Utile pour visualiser les equipes transverses et les double-rattachements. Clic sur une cellule affiche la liste des membres.

### 3.5 Vue par competences
Sous-vue optionnelle filtrant les collaborateurs par competence/skill tag. Chaque collaborateur peut avoir des competences declarees (ex: React, Rust, UX Design, Gestion de projet). Recherche par competence pour trouver un expert.

### 3.6 Vue par localisation (carte)
Sous-vue affichant une carte geographique avec des marqueurs pour chaque site. Clic sur un marqueur affiche la liste des collaborateurs du site. Utile pour les organisations distribuees.

---

## Categorie 4 — Profil collaborateur

### 4.1 Panneau lateral de profil
Le clic sur un collaborateur (dans n'importe quelle vue) ouvre un panneau lateral (drawer) avec le profil detaille. Le panneau ne masque pas la vue principale et se ferme par clic en dehors, bouton fermer ou touche Escape.

### 4.2 Informations affichees
Le profil affiche :
- **En-tete** : photo, nom complet, titre du poste, departement, indicateur de presence
- **Contact** : email, telephone fixe, telephone mobile, bureau (numero/etage)
- **Hierarchie** : manager direct (N+1) avec lien cliquable, subordonnes directs (N-1) avec liens
- **Equipes** : liste des groupes et equipes d'appartenance
- **Competences** : tags de skills declares
- **Localisation** : site, fuseau horaire, flag pays

### 4.3 Actions rapides
Boutons d'action dans le profil :
- **Envoyer un message** → ouvre le chat avec ce collaborateur
- **Envoyer un email** → ouvre le compositeur mail avec le destinataire pre-rempli
- **Planifier une reunion** → ouvre le calendrier avec l'invitation pre-remplie
- **Appeler** → lance un appel Meet
- **Voir les fichiers partages** → ouvre Drive filtre par fichiers partages avec cette personne

### 4.4 Lien vers le profil complet
Lien `Voir le profil complet` en bas du panneau lateral. Ouvre la page /profile/:userId avec toutes les informations detaillees, l'historique, les statistiques et les parametres du collaborateur.

### 4.5 Indicateur de presence temps reel
L'indicateur de presence (pastille verte/orange/rouge/grise) est mis a jour en temps reel via WebSocket. Etats : en ligne (vert), absent (orange), ne pas deranger (rouge), hors ligne (gris), en conge (icone palmier).

### 4.6 Fuseau horaire et heure locale
Pour les equipes distribuees, le profil affiche l'heure locale du collaborateur et le decalage horaire par rapport a l'utilisateur courant. Exemple : `14:30 (UTC+1) — 2h de plus que vous`.

---

## Categorie 5 — Gestion de la structure (admin)

### 5.1 Edition de l'organigramme (admin)
Les administrateurs accedent a un mode edition via le bouton `Modifier la structure` (visible uniquement pour les admins). En mode edition, les noeuds sont deplacables par drag-drop, et des boutons d'ajout/suppression apparaissent.

### 5.2 Ajout d'un noeud
Bouton `+` sur chaque noeud pour ajouter un enfant. Choix du type : groupe (departement/equipe) ou personne (selection depuis la liste des utilisateurs). Le nouveau noeud apparait immediatement dans l'arbre.

### 5.3 Deplacement d'un noeud (drag-drop)
En mode edition, un noeud peut etre glisse vers un nouveau parent. Confirmation : `Deplacer [Nom] sous [Nouveau parent] ?`. Le deplacement met a jour le rattachement hierarchique dans la base de donnees. Les sous-noeuds suivent le parent deplace.

### 5.4 Suppression d'un noeud
Bouton supprimer sur chaque noeud en mode edition. Confirmation avec options : `Supprimer uniquement ce noeud (les enfants remontent d'un niveau)` ou `Supprimer ce noeud et tous ses enfants`. La suppression d'un noeud personne ne supprime pas l'utilisateur, seulement son rattachement.

### 5.5 Import depuis Active Directory / LDAP
Bouton `Importer depuis AD/LDAP` dans les parametres admin. Connexion au serveur AD/LDAP (via signapps-identity), mapping des champs (OU → departement, manager → rattachement), import avec preview avant validation. Synchronisation planifiable (quotidienne, hebdomadaire).

### 5.6 Import depuis fichier CSV
Upload d'un fichier CSV avec colonnes : nom, prenom, email, titre, departement, manager_email. Le systeme reconstruit l'arbre hierarchique a partir des relations manager. Preview avec detection d'erreurs (manager inconnu, doublons, cycles).

### 5.7 Historique des modifications
Chaque modification de la structure (ajout, deplacement, suppression de noeud) est tracee dans l'audit log avec : date, auteur, action, noeud concerne, ancien parent, nouveau parent. L'admin peut consulter l'historique et annuler une modification recente.

### 5.8 Reorganisation planifiee
L'admin peut preparer une reorganisation en mode brouillon. Les modifications sont invisibles pour les utilisateurs tant qu'elles ne sont pas publiees. Comparaison avant/apres (diff visuel de l'arbre). Publication a une date programmee.

---

## Categorie 6 — Synchronisation et donnees

### 6.1 Source de donnees
L'organigramme est alimente par les tables `users`, `groups`, `group_memberships` et `org_structure` de la base PostgreSQL. La table `org_structure` stocke les relations parent-enfant : `id`, `parent_id`, `node_type` (group|person), `entity_id` (FK vers groups ou users), `sort_order`, `created_at`.

### 6.2 API REST
Endpoints :
- `GET /api/v1/team/org-chart` — arbre complet (ou niveau par niveau avec lazy loading)
- `GET /api/v1/team/org-chart/:nodeId/children` — enfants d'un noeud (lazy loading)
- `GET /api/v1/team/directory` — liste paginee des collaborateurs
- `GET /api/v1/team/search?q=...` — recherche textuelle
- `PUT /api/v1/team/org-chart/:nodeId/parent` — deplacer un noeud (admin)
- `POST /api/v1/team/org-chart` — ajouter un noeud (admin)
- `DELETE /api/v1/team/org-chart/:nodeId` — supprimer un noeud (admin)

### 6.3 Lazy loading des sous-arbres
Pour les grandes organisations, l'arbre n'est pas charge entierement a l'ouverture. Seuls les 2 premiers niveaux sont charges. L'expansion d'un noeud declenche un appel API pour charger ses enfants. Indicateur de chargement (spinner) pendant le fetch.

### 6.4 Cache et performance
Les donnees de l'organigramme sont cachees cote serveur (signapps-cache moka, TTL 5 min) et cote client (React Query, staleTime 60s). L'invalidation se fait sur les events PgEventBus de type `org_structure_changed`.

### 6.5 Export de l'organigramme
Boutons d'export en haut a droite :
- **PDF** — rendu de l'arbre visible en PDF vectoriel
- **PNG** — capture du canvas en image haute resolution
- **SVG** — export vectoriel pour impression grand format
- **CSV** — export des donnees tabulaires (nom, titre, departement, manager)

### 6.6 Synchronisation temps reel
Les modifications de la structure (par un admin) sont propagees en temps reel via WebSocket a tous les utilisateurs visualisant l'organigramme. Animation de transition quand un noeud est ajoute, deplace ou supprime.

---

## Categorie 7 — Securite et permissions

### 7.1 Lecture pour tous
Tous les utilisateurs authentifies ont acces en lecture a l'organigramme. Ils peuvent naviguer, rechercher et consulter les profils. La visibilite des informations de contact depend des preferences de confidentialite de chaque utilisateur.

### 7.2 Modification restreinte
La modification de la structure (ajout, deplacement, suppression de noeuds) est reservee aux roles : super_admin, admin, hr_manager. Les managers peuvent voir leur sous-arbre avec des indicateurs supplementaires mais ne peuvent pas le modifier.

### 7.3 Informations sensibles masquees
Certaines informations du profil peuvent etre masquees selon les preferences : telephone personnel, adresse, date de naissance. L'admin configure les champs visibles par defaut. Chaque utilisateur peut ajuster la visibilite de ses propres informations.

### 7.4 Audit log
Toutes les consultations de l'organigramme ne sont pas loggees (trop de volume). En revanche, les modifications de structure, les exports, et les acces aux informations sensibles sont traces dans l'audit log avec : user_id, action, timestamp, details.

### 7.5 RGPD et droit d'acces
Les donnees affichees dans l'organigramme sont soumises au RGPD. L'utilisateur peut demander la suppression de ses informations personnelles via /help. L'admin dispose d'un outil de pseudonymisation pour les anciens employes (remplacer les donnees par des placeholders).

### 7.6 Separation des contextes
L'organigramme respecte les unites organisationnelles (OU) et les politiques GPO. Un utilisateur d'une filiale ne voit que l'organigramme de sa filiale, sauf configuration globale par l'admin. Les cross-functional groups sont visibles dans la vue matricielle uniquement pour les membres concernes.

---

## Categorie 8 — Analytics et reporting

### 8.1 Dashboard effectifs
Vue admin affichant les metriques cles de l'organisation : effectif total, repartition par departement (bar chart), repartition par site (pie chart), ratio managers/contributeurs, postes vacants, anciennete moyenne. Donnees en temps reel depuis la base utilisateurs.

### 8.2 Span of control
Metrique indiquant le nombre moyen de subordonnes directs par manager. Affichage par departement et par niveau hierarchique. Alertes si un manager depasse le seuil configurable (defaut : 12 subordonnes directs). Utile pour equilibrer la structure.

### 8.3 Profondeur de l'arbre
Indicateur du nombre de niveaux hierarchiques dans l'organisation. Benchmark interne : les organisations performantes ont 4-6 niveaux. Alerte si la profondeur depasse 8 niveaux (risque de bureaucratie).

### 8.4 Taux de completude des profils
Pourcentage de profils ayant toutes les informations renseignees (photo, titre, departement, telephone, competences). Liste des profils incomplets. L'admin peut envoyer un rappel aux utilisateurs concernes.

### 8.5 Historique des reorganisations
Timeline affichant les modifications structurelles majeures : creation de departement, fusion d'equipes, deplacements de personnes. Chaque evenement est cliquable pour voir le diff avant/apres. Utile pour l'audit et la conformite.

### 8.6 Export rapport organisationnel
Generation d'un rapport PDF complet contenant : organigramme visuel, tableau des effectifs, metriques cles, postes vacants, profondeur hierarchique. Destine aux comites de direction et audits externes.

---

## Categorie 9 — Accessibilite et responsive

### 9.1 Navigation clavier de l'organigramme
L'arbre est entierement navigable au clavier : fleches haut/bas pour naviguer entre freres, fleche droite pour deployer un noeud, fleche gauche pour replier, Enter pour ouvrir le profil, Tab pour passer aux controles (recherche, filtres, boutons). Focus visible sur le noeud actif.

### 9.2 Accessibilite ARIA
Chaque noeud utilise `role="treeitem"` avec `aria-expanded` pour les noeuds groupes. L'arbre utilise `role="tree"`. Les niveaux hierarchiques sont annonces par `aria-level`. Les tooltips utilisent `aria-describedby`.

### 9.3 Vue responsive mobile
Sur mobile (< 768px), l'organigramme arbre est remplace par une vue liste hierarchique avec indentation. Chaque noeud est un item de liste avec chevron d'expansion. Le panneau de profil s'ouvre en plein ecran (bottom sheet). Les filtres sont accessibles via un bouton filtre qui ouvre un drawer.

### 9.4 Vue responsive tablette
Sur tablette (768-1024px), l'organigramme affiche 2 niveaux visibles par defaut. Le zoom est remplace par un scroll natif. Le panneau de profil s'ouvre en demi-ecran lateral.

### 9.5 Mode impression
Bouton `Imprimer` generant une version optimisee pour l'impression : fond blanc, lignes noires, photos en niveaux de gris, une page par departement si l'arbre est trop grand. CSS `@media print` dedie.

### 9.6 Mode sombre
L'organigramme s'adapte au theme sombre de SignApps : fond fonce, lignes claires, noeuds avec bordures contrastees, avatars avec contour. Les couleurs des niveaux hierarchiques sont ajustees pour rester lisibles en mode sombre.

---

## References OSS

**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **React Flow** (github.com/xyflow/xyflow) | **MIT** | Bibliotheque React pour les diagrammes interactifs (noeuds + edges). Pattern pour le canvas zoomable, le drag-drop de noeuds, et les connexions. Directement applicable pour le rendu de l'organigramme. |
| **d3-hierarchy** (github.com/d3/d3-hierarchy) | **ISC** | Module D3.js pour les layouts hierarchiques (tree, cluster, treemap, partition). Algorithmes de layout pour positionner les noeuds de l'organigramme automatiquement. |
| **react-organizational-chart** (github.com/nicehash/react-organizational-chart) | **MIT** | Composant React specifique pour les organigrammes. Pattern basique de rendu arborescent avec expansion/repliage. Leger et extensible. |
| **Dagre** (github.com/dagrejs/dagre) | **MIT** | Layout engine pour les graphes diriges. Algorithme de positionnement automatique des noeuds pour des arbres complexes. Utilisable avec React Flow. |
| **elkjs** (github.com/kieler/elkjs) | **EPL-2.0** | **ATTENTION** Eclipse Public License — verifier la compatibilite commerciale. Layout engine avance pour les graphes hierarchiques. Reference pedagogique pour les algorithmes de layout. |
| **html-to-image** (github.com/nicehash/html-to-image) | **MIT** | Capture de HTML en PNG/SVG/JPEG. Pattern pour l'export de l'organigramme en image haute resolution. |
| **jsPDF** (github.com/parallax/jsPDF) | **MIT** | Generation de PDF cote client. Pattern pour l'export PDF de l'organigramme. |
| **Fuse.js** (github.com/krisk/Fuse) | **Apache-2.0** | Recherche fuzzy cote client. Pattern pour la recherche instantanee dans l'annuaire des collaborateurs. |

---

## Assertions E2E cles (a tester)

- Navigation vers /team redirige vers /team/org-chart
- La page affiche le titre `Organigramme` et le sous-titre descriptif
- Le noeud racine `SignApps Corp (group)` est visible a l'ouverture
- Les boutons `Tout deplier` et `Tout replier` sont presents et fonctionnels
- Clic sur `Tout deplier` → tous les noeuds enfants sont visibles
- Clic sur `Tout replier` → seul le noeud racine est visible
- Clic sur le chevron d'un noeud groupe → les enfants apparaissent avec animation
- Etat vide (aucun noeud) → message `Aucun noeud dans cet organigramme` affiche
- Survol d'un noeud personne → tooltip avec photo, nom, titre, email
- Clic sur un noeud personne → panneau lateral avec profil complet et actions rapides
- Recherche par nom dans la barre → resultats en dropdown, selection centre l'arbre sur le noeud
- Filtre par departement → seul le sous-arbre du departement selectionne est affiche
- Onglet `Annuaire` → vue tabulaire avec colonnes triables et pagination
- Onglet `Trombinoscope` → grille de cartes avec photos et noms
- Export CSV depuis l'annuaire → fichier telecharge avec les colonnes attendues
- Export PNG de l'organigramme → image haute resolution du canvas
- Zoom molette → l'arbre se zoom/dezoom fluidement
- Bouton `Fit to screen` → l'arbre entier est visible dans le viewport
- Actions rapides du profil : clic `Envoyer un message` → ouverture du chat avec le bon destinataire
- Mode edition (admin) : drag-drop d'un noeud vers un nouveau parent → confirmation et deplacement effectif
- Mode edition (admin) : ajout d'un noeud enfant → le noeud apparait dans l'arbre
- Les utilisateurs non-admin ne voient pas le bouton `Modifier la structure`
- L'indicateur de presence est affiche en temps reel (pastille verte/orange/rouge/grise)
