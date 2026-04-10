# Module Dashboard — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Google Workspace Home** | Priorites intelligentes (emails, invitations, fichiers recents), suggestions AI proactives (Smart Compose, Smart Reply), integration cross-app fluide (Drive, Calendar, Gmail, Tasks dans une seule vue), chips contextuels |
| **Microsoft Viva Insights / M365 Home** | Focus time recommande, wellbeing metrics, meeting insights, digest email quotidien, integration Teams/Outlook/OneDrive, Copilot daily briefing, suggested tasks |
| **Notion Dashboard** | Blocks composables (databases inline, embeds, toggles, callouts), templates communautaires, relations cross-database, formulas 2.0, synced blocks, AI summary |
| **Monday.com Dashboard** | Widgets drag-and-drop (chart, battery, numbers, timeline, table), dashboard multi-boards, filtres globaux, benchmarks KPI avec objectifs, partage public |
| **ClickUp Dashboard** | 50+ widget types (time tracking, sprint burndown, chat, embed, portfolio, goals), custom calculations, filtres par espace/projet/liste, mode TV |
| **Asana Home** | My Tasks triees par priorite, goals tracking, inbox notifications centralisees, reporting portfolios, status updates, recommended tasks |
| **Salesforce Home** | Assistant AI Einstein, KPI cards configurable, recent records, pinned lists, news feed, performance chart, quarterly pipeline, customizable compact layout |
| **Todoist Home** | Productivity trends, weekly review, karma score, daily goals, taches overdue mises en avant, integration calendrier |
| **Geckoboard** | Dashboards TV-optimized, data sources multiples, live wallboard, alertes seuil, branding custom, spreadsheet integration |
| **Klipfolio PowerMetrics** | Metrics catalog, data modelling layer, automated insights, drill-down, scheduled snapshots, unified metrics definitions |
| **Databox** | Scorecards, goals tracking, daily/weekly digests, 70+ integrations, mobile-first dashboard, annotations timeline |
| **Grafana** | Panels composables (graph, stat, gauge, table, heatmap, logs), templating variables, alerting rules, annotations, dashboard-as-code JSON |

## Principes directeurs

1. **Vue unifiee cross-modules** — le dashboard agrege les donnees de tous les modules SignApps (Mail, Calendar, Drive, Tasks, Contacts, Chat, Social, Meet, Voice) dans une seule interface sans navigation aller-retour.
2. **AI proactive, pas intrusive** — le resume quotidien AI est genere automatiquement mais reste un widget optionnel. L'utilisateur choisit quels insights recevoir.
3. **Personnalisation par drag-and-drop** — chaque utilisateur compose son dashboard en ajoutant, retirant, redimensionnant et reordonnant des widgets sans intervention admin.
4. **Temps reel sans refresh** — les KPIs, notifications et listes se mettent a jour via WebSocket. Le bouton Actualiser force un rechargement complet mais le flux normal est push.
5. **Performance au premier rendu** — le dashboard doit s'afficher en < 1 seconde avec les donnees essentielles ; les widgets secondaires se chargent progressivement (skeleton loading).
6. **Responsive et imprimable** — la grille de widgets s'adapte du mobile (1 colonne) au desktop (3-4 colonnes) et le mode impression restitue un rapport PDF propre.

---

## Categorie 1 — Resume quotidien AI (Morning Briefing)

### 1.1 Generation automatique du briefing matinal
Au premier acces de la journee (detecte par comparaison `last_briefing_date` dans les preferences utilisateur vs date du jour), le dashboard affiche un widget "Briefing du matin" en haut de la page, au-dessus de la grille de widgets. Le resume AI est genere a partir de : emails non lus (top 5 par priorite), evenements du jour (tous), taches en retard (toutes), taches dues aujourd'hui, fichiers recemment partages avec l'utilisateur (dernieres 24h), mentions dans le chat (non lues). Le resume est un paragraphe structure (3-5 phrases) avec des liens cliquables inline (le nom d'un email est cliquable vers le mail, un evenement vers le calendrier). Generation via `signapps-ai` (port 3005). Indicateur de chargement : skeleton text pulsant pendant la generation (<3s). Bouton "Regenerer" pour relancer la generation. Bouton "Fermer" (X) pour masquer le briefing pour la journee. API : `GET /api/v1/dashboard/briefing` (genere a la demande ou retourne le cache du jour).

### 1.2 Priorites suggerees
Sous le resume textuel, l'AI identifie les 3-5 actions prioritaires de la journee. Chaque priorite est une card compacte (64px) avec : icone du module source, description de l'action ("Repondre a l'email de Jean Dupont concernant le budget Q3"), deadline ou urgence (badge rouge "En retard", orange "Aujourd'hui", vert "Cette semaine"), et deux boutons d'action : checkbox (marquer comme fait -> disparait avec animation fade-out) et bouton "Reporter" (ouvre un date picker, deplace dans les suggestions du jour suivant). Ordre de priorite calcule par : deadline imminence, expediteur (manager > collegue > externe), age du sujet (plus ancien = plus urgent), nombre de relances.

### 1.3 Insights proactifs
Detection automatique de patterns inhabituels, affiches comme des cartes d'alerte colorees sous les priorites :
- **Pic d'emails** : "Vous avez 42 emails non lus, 15 de plus que la moyenne" (fond bleu, icone mail)
- **Reunion sans agenda** : "Votre reunion de 14h 'Sync Marketing' n'a pas d'agenda" (fond orange, icone calendar)
- **Tache bloquee** : "La tache 'Design landing page' est en cours depuis 5 jours sans mise a jour" (fond rouge, icone tasks)
- **Fichier non ouvert** : "Alice vous a partage 'Budget Q3.xlsx' il y a 3 jours, non ouvert" (fond gris, icone drive)
- **Conflit de calendrier** : "Vous avez 2 reunions qui se chevauchent a 15h" (fond rouge, icone calendar)
Chaque alerte a une action suggeree (bouton : "Voir les emails", "Ajouter un agenda", "Mettre a jour la tache", "Ouvrir le fichier", "Resoudre le conflit"). Limite : max 5 insights affiches. Les insights vus sont masques pendant 24h.

### 1.4 Resume configurable
Widget de configuration (accessible via l'icone engrenage du briefing) : l'utilisateur choisit les sources du resume AI via des checkboxes : Mail, Calendar, Tasks, Drive, Chat, Social, Meet. Niveau de detail : "Concis" (3 phrases, pas de chiffres) ou "Detaille" (5+ phrases avec metriques). Option de recevoir le briefing par email (envoye a l'heure configuree) ou par notification push en plus de l'affichage dashboard. Configuration de l'heure du briefing (defaut 8h00 heure locale). API : `PATCH /api/v1/dashboard/briefing/settings`.

### 1.5 Historique des resumes
Acces aux resumes des jours precedents via un selecteur de date (icone calendrier dans le header du widget briefing). Navigation par fleches gauche/droite (jour precedent/suivant). Le resume du jour selectionne est affiche dans le meme format. Utile pour retrouver un contexte apres une absence ou des conges. Les resumes sont stockes pendant 90 jours. API : `GET /api/v1/dashboard/briefing?date=2026-04-07`.

---

## Categorie 2 — KPIs et metriques

### 2.1 Cartes KPI principales
Rangee de 4 cartes KPI en haut du dashboard (sous le briefing si actif). Chaque carte occupe 1/4 de la largeur (responsive : 1/2 en tablette, pleine largeur en mobile). Cartes par defaut :
- **Emails non lus** : icone mail bleu, compteur bold (ex: "12"), sous-titre "3 de haute priorite", sparkline 7j
- **Evenements aujourd'hui** : icone calendar vert, compteur ("4 reunions"), sous-titre "Prochaine dans 45 min", sparkline 7j
- **Taches dues** : icone tasks orange, compteur ("7 taches"), sous-titre "2 en retard", sparkline 7j
- **Fichiers recents** : icone drive gris, compteur ("5 nouveaux"), sous-titre "Partages cette semaine", sparkline 7j
Chaque carte est cliquable (navigue vers le module correspondant). Animation `countUp` au chargement (nombre passe de 0 a la valeur en 600ms). Actualisation en temps reel via WebSocket PgEventBus. Couleur de fond de la carte selon la tendance : bordure gauche verte si amelioration, rouge si degradation, grise si stable. API : `GET /api/v1/dashboard/kpis` (retourne les 4 metriques en un appel agrege via le gateway port 3099).

### 2.2 Tendances et sparklines
Chaque KPI affiche une sparkline SVG (64x24px) sur 7 jours sous la valeur principale. Points de donnees : 1 par jour (lundi a dimanche). Ligne lissee (courbe bezier). Couleur verte si tendance a la hausse sur les 3 derniers jours, rouge si a la baisse, grise si stable (variation <5%). Tooltip au survol d'un point : "Mardi : 8 emails" (date + valeur). La sparkline est generee cote client a partir des donnees retournees par l'API (`kpi.history[]`). Librairie : recharts SparklineChart ou SVG custom.

### 2.3 KPIs personnalisables
L'utilisateur peut ajouter des cartes KPI supplementaires depuis le panneau de personnalisation (voir 4.2). KPIs disponibles :
- Taches terminees cette semaine (compteur + sparkline)
- Contacts ajoutes ce mois (compteur)
- Reunions cette semaine (compteur + sparkline)
- Fichiers partages cette semaine (compteur)
- Messages Chat non lus (compteur)
- Posts sociaux programmes (compteur)
- Temps passe en reunion cette semaine (duree + sparkline)
- Notes vocales cette semaine (compteur)
Chaque KPI supplementaire est une carte 1x1 dans la grille. Max 8 KPIs affiches simultanement. L'ordre est personnalisable par drag-drop.

### 2.4 Objectifs et seuils
Definir un objectif par KPI en cliquant sur l'icone cible dans la carte : "Repondre a tous les emails avant 18h" (seuil : 0 emails non lus a 18h), "Maximum 3 reunions par jour" (seuil : <=3), "Completer 5 taches par semaine" (seuil : >=5). Barre de progression circulaire (ring progress) affichee quand un objectif est defini. Couleur verte si objectif atteint, orange si en cours (>50%), rouge si en danger (<50%). Notification push quand un objectif est atteint ("Felicitations ! Vous avez atteint votre objectif de 5 taches cette semaine"). Notification d'alerte si l'objectif est en danger ("Attention : il vous reste 3 taches a completer et il est 16h"). Les objectifs sont stockes dans `dashboard_widgets.config` du layout.

### 2.5 KPIs d'equipe (managers)
Les utilisateurs avec le role RBAC `manager` ou `admin` voient une section supplementaire "Equipe" dans la zone KPI. KPIs d'equipe :
- Taches completees par l'equipe cette semaine (compteur + sparkline + breakdown par membre)
- Temps moyen de reponse email de l'equipe (duree)
- Taux de presence aux reunions de l'equipe (%)
- Charge de travail par membre (barres horizontales, couleur selon la charge : vert <80%, orange 80-100%, rouge >100%)
Acces conditionne au role RBAC : le backend verifie les claims JWT avant de retourner les donnees d'equipe. Un manager ne voit que les KPIs de ses N-1 directs (pas toute l'organisation). API : `GET /api/v1/dashboard/kpis/team`.

---

## Categorie 3 — Widgets de contenu

### 3.1 Widget Taches recentes
Liste des 5-10 dernieres taches assignees a l'utilisateur, triees par deadline (les plus urgentes en haut). Chaque tache affiche : checkbox (cliquable pour marquer comme terminee sans quitter le dashboard, optimistic update avec rollback), titre (1 ligne, bold si en retard), projet (badge colore), priorite (dot colore : rouge haute, orange moyenne, gris basse), deadline (date relative : "Aujourd'hui", "Demain", "3 avr." ; rouge si en retard), statut (badge petit : "A faire" gris, "En cours" bleu, "Fait" vert). Clic sur le titre ouvre la tache dans le module Tasks. Footer du widget : compteur "7 taches au total" + lien "Voir toutes les taches". Filtre rapide dans le header du widget : dropdown "Toutes / En retard / Aujourd'hui / Cette semaine". Taille du widget : 2x2 dans la grille. API : `GET /api/v1/tasks?assigned_to=me&sort=deadline&limit=10` (via gateway).

### 3.2 Widget Agenda du jour
Timeline verticale des evenements de la journee. Chaque evenement affiche : heure de debut et de fin (colonne gauche, 48px), barre coloree verticale (couleur du calendrier source), titre de l'evenement (bold), participants (avatars empiles, max 3 + "+N"), lieu ou lien visio (icone camera si Meet). Les creneaux libres sont visibles comme des espaces vides entre les evenements. L'heure actuelle est marquee par une ligne horizontale rouge animee (pulse subtil). Clic sur un evenement ouvre le detail dans Calendar. Bouton rapide "Ajouter un evenement" en bas du widget (ouvre le formulaire Calendar en dialog modal). Navigation par fleches : "< Hier" | "Demain >". Widget de taille 1x2 ou 2x2. Raccourci : `E` pour creer un evenement rapide. API : `GET /api/v1/calendar/events?date=today` (via gateway).

### 3.3 Widget Emails recents
Liste des 5-10 derniers emails recus. Chaque email affiche : avatar de l'expediteur (cercle 32px, initiales si pas d'avatar), nom de l'expediteur (bold si non lu), objet (1 ligne, tronque avec ellipsis), apercu du body (1 ligne, opacite 60%), date/heure (relatif : "Il y a 5 min"), badge bleu "Non lu" a droite si applicable. Clic sur un email ouvre le message dans Mail. Actions rapides au survol (icones 20px) : marquer comme lu (icone check), archiver (icone archive), repondre (icone fleche). Le widget indique "Aucun nouvel email" avec illustration si la boite est vide. Widget de taille 2x2. API : `GET /api/v1/mail/messages?folder=inbox&sort=date&limit=10` (via gateway).

### 3.4 Widget Fichiers recents
Grille ou liste (toggle dans le header du widget) des 5-10 derniers fichiers ouverts/modifies/partages. Chaque fichier affiche : icone du type (doc bleu, sheet vert, pdf rouge, image violet, video orange, dossier jaune, autre gris), nom (1 ligne, tronque), taille du fichier, dernier modifie (date relative), proprietaire (avatar miniature). Clic sur un fichier ouvre le fichier dans le module Docs/Sheets/Drive selon le type. Actions rapides au survol : partager (icone), telecharger (icone), renommer (icone). Filtre dans le header : "Tous / Modifies par moi / Partages avec moi". Widget de taille 2x1 ou 2x2. API : `GET /api/v1/drive/files?sort=modified&limit=10` (via gateway).

### 3.5 Widget Activite recente (flux d'activite)
Timeline chronologique des actions de l'utilisateur et de son equipe. Chaque entree affiche : avatar de l'acteur (cercle 28px), texte de l'action ("Alice a partage Budget Q2.xlsx", "Bob vous a mentionne dans #projet-alpha", "Reunion 'Sprint Review' dans 30 min"), timestamp relatif, icone du module source. Entrees liees : clic navigue vers l'element concerne. Filtre dans le header : dropdown "Tout / Mes actions / Mon equipe". Le flux est mis a jour en temps reel via WebSocket (nouvelle entree slide-in en haut avec animation). Infinite scroll pour charger les entrees plus anciennes. Widget de taille 2x2 ou 3x2. API : `GET /api/v1/dashboard/activity?page=1&per_page=20`.

### 3.6 Widget Notes rapides (Quick Notes)
Bloc de texte libre persistent entre les sessions (type sticky note). Editeur Markdown basique : gras (`**texte**`), listes (`-` ou `1.`), liens, checkboxes (`- [ ]`), italique. Auto-save toutes les 5 secondes (debounce). Indicateur "Sauvegarde..." puis "Sauvegarde OK" en bas du widget. Fond jaune pale (style sticky note) ou fond neutre (configurable). Taille du widget ajustable. Le contenu est stocke dans `dashboard_widgets.config.content` du layout utilisateur. Raccourci : focus direct avec `Q` (quick note). Limite : 5000 caracteres. API : sauvegarde via `PATCH /api/v1/dashboard/layouts/:id` (update du widget config).

### 3.7 Widget Favoris / Raccourcis (Quick Actions)
Grille d'icones de raccourcis vers les pages les plus visitees ou les elements epingles. Raccourcis par defaut : "Nouveau document" (icone + texte), "Nouvel email" (icone + texte), "Nouvel evenement" (icone + texte), "Nouvelle tache" (icone + texte). Chaque raccourci est un bouton 80x80px avec icone centree (32px) et label en dessous (12px). Clic execute l'action (ouvre le dialog modal de creation). L'utilisateur peut ajouter des raccourcis personnalises : drag-drop depuis n'importe quel module (le "pin" ajoute l'element au widget), ou via le menu contextuel "Ajouter aux raccourcis" disponible dans tous les modules. Limite : 12 raccourcis. Reordonnement par drag-drop. Widget de taille 2x1 ou 3x1.

### 3.8 Widget Notifications
Version compacte du centre de notifications (voir module 27-notifications). Affiche les 5 dernieres notifications non lues avec : icone type, titre (1 ligne), timestamp. Clic navigue vers l'element source. Badge compteur en haut a droite du widget. Bouton "Voir tout" navigue vers `/notifications`. Les notifications se mettent a jour en temps reel via WebSocket. Widget de taille 1x2.

---

## Categorie 4 — Personnalisation et layout (react-grid-layout)

### 4.1 Grille drag-and-drop
Le dashboard est une grille responsive geree par `react-grid-layout` (MIT). Parametres de la grille : 12 colonnes, row height 80px, margin [16, 16] (horizontal, vertical), container padding [16, 16]. Chaque widget occupe un rectangle defini par `{x, y, w, h}` avec des contraintes `{minW, maxW, minH, maxH}`. L'utilisateur deplace les widgets par drag-and-drop : handle de drag dans le header du widget (icone grip 6 points, curseur `grab`/`grabbing`). Redimensionnement en tirant le coin bas-droit (icone resize triangle, curseur `nwse-resize`). Pendant le drag : ghost semi-transparent du widget, grille de placement affichee en pointilles, zone de depot surlignee en bleu, les autres widgets se reordonnent en temps reel. L'arrangement est sauvegarde automatiquement 1 seconde apres le dernier changement (debounce) via `PATCH /api/v1/dashboard/layouts/:id`. Raccourci : `Ctrl+Shift+E` pour basculer en mode edition (affiche les handles et bordures de tous les widgets) / mode normal (masque les handles).

### 4.2 Catalogue de widgets (Widget Picker)
Bouton "Personnaliser" (icone engrenage + texte) dans le header du dashboard. Ouvre un panneau lateral droit (slide-in, 400px, overlay sur la grille). Le panneau liste tous les widgets disponibles par categorie :
- **AI** : Briefing matinal, Insights proactifs
- **KPIs** : Emails non lus, Evenements, Taches, Fichiers, KPI personnalise
- **Contenu** : Taches recentes, Agenda du jour, Emails recents, Fichiers recents, Activite recente, Notifications
- **Productivite** : Notes rapides, Favoris/Raccourcis, Objectifs OKR
- **Donnees** : Graphique custom, Widget embed iframe
- **Equipe** : Compteurs equipe, Charge de travail (managers uniquement)
- **Systeme** : Meteo/Horloge, Calendrier compact, Chat recent
Chaque widget dans le catalogue affiche : icone, nom, description (1 ligne), taille par defaut (ex: "2x2"), apercu miniature (thumbnail 120x80). Ajout par clic sur le bouton "+" (le widget apparait en haut a gauche de la grille avec animation fade-in) ou par drag depuis le catalogue vers la grille. Les widgets deja presents sont marques "Ajoute" (badge vert) et le bouton "+" est remplace par un bouton "Retirer" (icone corbeille). Barre de recherche en haut du catalogue pour trouver un widget par nom.

### 4.3 Dashboards multiples
Possibilite de creer plusieurs dashboards nommes. Navigation par onglets en haut de la page (au-dessus de la grille). Bouton "+" pour creer un nouveau dashboard (dialog : nom, description, template optionnel). Clic droit sur un onglet : renommer, dupliquer, supprimer (avec confirmation), definir comme defaut. Le dashboard par defaut est affiche a la connexion. Les dashboards sont independants (chacun a son propre layout et ses propres widgets). Limite : 10 dashboards par utilisateur. Le nom apparait dans l'URL : `/dashboard/mon-bureau`, `/dashboard/vue-projet-alpha`. API : `GET /api/v1/dashboard/layouts` (liste), `POST /api/v1/dashboard/layouts` (creer), `DELETE /api/v1/dashboard/layouts/:id` (supprimer).

### 4.4 Templates de dashboard
Bibliotheque de templates pre-configures par role, accessible lors de la creation d'un nouveau dashboard ou via "Appliquer un template" dans les parametres. Templates :
- **Manager** : KPIs equipe, taches equipe, agenda, activite equipe, charge de travail
- **Developpeur** : taches assignees, emails, chat recent, notes rapides, fichiers recents
- **Commercial** : KPIs CRM (pipeline, deals, contacts), agenda, emails, notes
- **RH** : KPIs conges, effectifs, agenda, demandes en attente
- **Direction** : KPIs globaux (chiffre d'affaires, effectifs, satisfaction), graphiques, objectifs OKR
Application en un clic : remplace le layout actuel (confirmation modale : "Remplacer le layout actuel ? Les widgets actuels seront supprimes."). Personnalisable ensuite sans restriction. L'admin peut creer des templates d'organisation visibles par tous les utilisateurs. API : `GET /api/v1/dashboard/templates`, `POST /api/v1/dashboard/templates` (admin).

### 4.5 Dashboards partages (equipe)
Un manager peut creer un dashboard et le partager en lecture (ou edition) avec son equipe. Bouton "Partager" dans le header du dashboard -> dialog de partage (similaire a Drive : ajouter des utilisateurs/groupes, permissions lecture seule / lecture+edition). Les widgets d'un dashboard partage affichent les donnees agregees de l'equipe (pas les donnees individuelles de chaque membre, sauf si le widget le supporte). Le dashboard partage apparait dans la section "Partages avec moi" de l'onglet de selection de dashboards. Badge "Partage" sur l'onglet. API : `POST /api/v1/dashboard/layouts/:id/share`.

### 4.6 Mode sombre / clair
Le dashboard respecte le theme global SignApps (dark/light). Les widgets utilisent les tokens semantiques CSS : `bg-card` pour le fond des widgets, `text-foreground` pour le texte, `border-border` pour les bordures, `bg-muted` pour les arriere-plans secondaires. Les graphiques (Chart.js / Recharts) s'adaptent : couleurs de grille, labels et tooltips ajustes selon le theme. Le passage dark/light est instantane (pas de rechargement). Les sparklines utilisent `text-primary` pour la ligne et `bg-primary/10` pour le fond.

### 4.7 Widget lock (verrouillage)
Chaque widget a une option "Verrouiller" dans son menu contextuel (icone cadenas). Un widget verrouille ne peut pas etre deplace ni redimensionne (les handles de drag/resize sont masques). Icone cadenas affichee dans le header du widget verrouille. Utile pour empecher les modifications accidentelles sur un layout bien organise. Bouton "Verrouiller tout" dans le header du dashboard verrouille tous les widgets d'un coup. Mode verrouillage global : si tout est verrouille, le bouton "Personnaliser" n'ouvre pas le panneau de catalogue. Deverrouillage par clic sur le cadenas ou via "Deverrouiller tout".

### 4.8 Widget refresh intervals
Chaque widget a un intervalle de rafraichissement configurable (accessible via le menu contextuel du widget > "Parametres") : 30 secondes (temps reel), 1 minute, 5 minutes, 15 minutes, Manuel (pas de rafraichissement auto). Defaut par type : KPIs = 30s, Emails = 60s, Fichiers = 120s, Activite = 30s, Meteo = 15min. Un compteur discret (icone horloge + temps restant) est affiche dans le header du widget au survol. Le bouton "Actualiser" (icone refresh) dans le header du widget force le rechargement instantane en ignorant le TTL. API : chaque widget fait son propre appel API selon son intervalle via `react-query` avec `refetchInterval`.

---

## Categorie 5 — Actions et interactions

### 5.1 Bouton Actualiser global
Bouton dans le header du dashboard (icone refresh, tooltip "Actualiser tous les widgets"). Force le rechargement de tous les widgets simultanement. Animation de rotation sur l'icone pendant le chargement (rotate 360deg en boucle). Chaque widget affiche son skeleton loader individuellement puis se remplit. Raccourci clavier : `Ctrl+R` est intercepte par le dashboard avant le refresh navigateur (via `event.preventDefault()`). Un toast confirme : "Dashboard actualise". Le briefing AI n'est PAS regenere par le refresh (il faut cliquer "Regenerer" explicitement).

### 5.2 Bouton Imprimer / Export PDF
Bouton dans le header du dashboard (icone imprimante, tooltip "Exporter en PDF"). Genere une version imprimable du dashboard via CSS `@media print` : widgets disposes en colonnes (max 2 par ligne), fond blanc, pas de boutons d'action, pas de skeleton, graphiques rendus en image statique. Mise en page optimisee pour A4 (297mm x 210mm landscape). En-tete : nom du dashboard + date de generation + nom de l'utilisateur. Pagination automatique (saut de page entre les widgets qui ne rentrent pas). Export PDF via `html2canvas` (MIT) + `jsPDF` (MIT). Raccourci : `Ctrl+P` ouvre d'abord la preview print, puis le dialog systeme. Le PDF est genere cote client (pas d'appel serveur). Nom du fichier : `dashboard-{nom}-{date}.pdf`.

### 5.3 Barre d'actions rapides (Quick Actions Bar)
Barre horizontale sous le briefing AI / au-dessus de la grille. 4 a 6 boutons d'action rapide : "Nouveau document" (icone doc +), "Nouvel email" (icone mail +), "Nouvel evenement" (icone calendar +), "Nouvelle tache" (icone tasks +), "Rechercher" (icone loupe), "Nouveau post" (icone social +). Chaque bouton est un rectangle 120x40px avec icone a gauche et texte a droite. Clic ouvre un dialog modal (creation rapide sans quitter le dashboard). Le dialog contient un formulaire minimal : titre + champs essentiels + boutons "Creer" et "Annuler". Apres creation, toast de confirmation avec lien "Ouvrir" vers l'element cree. Raccourcis clavier : `D` nouveau document, `M` nouvel email, `T` nouvelle tache, `K` recherche globale. La barre est masquable dans les parametres du dashboard.

### 5.4 Recherche contextuelle
Barre de recherche integree au dashboard (champ texte en haut, icone loupe, placeholder "Rechercher dans le dashboard..."). La recherche filtre les widgets affiches : par exemple, taper "budget" filtre les taches contenant "budget", les fichiers contenant "budget", et les emails contenant "budget". Les widgets sans resultat sont temporairement reduits (hauteur minimale avec message "Aucun resultat"). Les termes trouves sont surliges en jaune dans les widgets. Effacer le champ restaure le dashboard normal. Recherche debounce 300ms. Raccourci : `Ctrl+F` ou `/`. Distinction avec la recherche globale (`Ctrl+K`) qui cherche dans toute la plateforme.

### 5.5 Notifications inline
Les widgets affichent des badges de notification integres (compteur non lu dans le coin haut-droit du widget pour Emails, Tasks, Chat). Les taches avec deadline imminente (<24h) affichent un badge horloge rouge. Les evenements qui commencent dans <30 minutes affichent un badge "Bientot" clignotant. Un panneau lateral "Notifications" est accessible via l'icone cloche dans la navbar (voir module 27-notifications) — le dashboard n'a pas son propre panneau de notifications mais integre les badges dans les widgets.

---

## Categorie 6 — Widgets avances

### 6.1 Widget Meteo / Horloge
**Horloge** : affichage numerique de l'heure actuelle (format HH:MM, police monospace bold 36px) avec date en dessous (format "Mardi 7 avril 2026"). Fuseau horaire configurable (dropdown dans les parametres du widget). Mise a jour chaque seconde. Option d'afficher plusieurs fuseaux horaires simultanement (utile pour les equipes distribuees) : nom de la ville + heure, en liste verticale (max 4 fuseaux).
**Meteo** : temperature actuelle (grande valeur + icone condition : soleil, nuage, pluie, neige), ville auto-detectee ou configurable, previsions 3 jours (icones + min/max). Donnees via API publique OpenWeatherMap (cle API configuree par l'admin). Rafraichissement toutes les 15 minutes. Widget de taille 1x1 (horloge seule) ou 2x1 (horloge + meteo). Desactivable si la cle API meteo n'est pas configuree. API : `GET /api/v1/dashboard/weather?lat=&lon=` (proxifie par le backend pour cacher la cle API).

### 6.2 Widget Objectifs OKR
Affichage des objectifs trimestriels de l'utilisateur avec barre de progression circulaire (ring progress). Chaque objectif affiche : titre (1 ligne), cible (valeur numerique ou pourcentage), progression actuelle, barre de progression (vert si >=70%, orange si 30-70%, rouge si <30%). Lie au module Tasks/Projects si configure (la progression est calculee automatiquement a partir des taches completees). Mise a jour manuelle possible (clic sur la valeur pour editer). Max 5 objectifs par widget. Widget de taille 2x2. API : `GET /api/v1/dashboard/okrs` et `PATCH /api/v1/dashboard/okrs/:id`.

### 6.3 Widget Graphique custom
Widget configurable par l'utilisateur : choisir une source de donnees et un type de graphique. Sources : taches par statut (pie), emails par jour (line), evenements par semaine (bar), fichiers par type (doughnut), taches completees par membre (bar horizontal). Types : barres, lignes, aires, camembert, donut, radar. Configuration via dialog : selecteur source (dropdown) + selecteur type (icones), periode (7j, 30j, 90j), couleur (theme par defaut ou custom). Rendu via Chart.js (MIT) avec options responsive. Tooltip au survol des points/barres. Export du graphique en PNG (bouton dans le menu contextuel du widget). Widget de taille 2x2 ou 3x2. Les donnees sont rafraichies selon l'intervalle du widget. API : `GET /api/v1/dashboard/charts?source=tasks_by_status&period=30d`.

### 6.4 Widget Embed iframe
Integrer une page externe (URL) dans un widget. Configuration : champ URL, titre custom, taille min/max. Restrictions CSP configurables par l'admin (`frame-src` whitelist). Le widget affiche un iframe avec sandbox attributes (`allow-scripts allow-same-origin`). Utile pour : dashboards BI (Grafana, Metabase), pages intranet, formulaires externes. L'admin peut restreindre les domaines autorises dans `/admin/settings/dashboard`. Un message "Contenu bloque par la politique de securite" s'affiche si le domaine n'est pas whiteliste. Widget de taille configurable (min 2x2).

### 6.5 Widget Calendrier compact (Mini Calendar)
Mini-calendrier mensuel (grille 7x6 max). Les jours ayant des evenements sont marques par un dot colore (couleur du calendrier source). Dot multiple si plusieurs evenements (max 3 dots). Clic sur un jour affiche un popover avec la liste des evenements du jour (titre + heure). Double-clic navigue vers le calendrier complet a cette date. Navigation mois par mois (fleches gauche/droite). Le jour actuel est surligné (fond bleu, texte blanc). Les jours du week-end ont un fond legerement gris. Widget de taille 1x2 ou 2x2. API : `GET /api/v1/calendar/events?month=2026-04` (retourne les jours avec evenements, pas le detail).

### 6.6 Widget Chat recent
Affiche les 5 dernieres conversations Chat avec apercu du dernier message. Chaque conversation affiche : avatar (personne ou icone channel), nom (personne ou #channel), apercu du dernier message (1 ligne, tronque), timestamp relatif. Badge compteur de messages non lus par conversation. Clic ouvre la conversation dans le module Chat. Indicateur "est en train d'ecrire..." si applicable. Widget de taille 1x2 ou 2x2. Mise a jour en temps reel via WebSocket. API : `GET /api/v1/chat/conversations?sort=recent&limit=5`.

### 6.7 Widget Compteurs equipe (managers)
Pour les managers uniquement (verification RBAC). Quatre mini-KPIs : nombre de membres presents aujourd'hui (icone personne verte), en conge (icone calendrier orange), en teletravail (icone maison bleue), en reunion (icone camera violette). Donnees issues du module Calendar (evenements du jour) et HR/Workforce (statuts de presence). Clic sur un compteur affiche la liste des personnes dans un popover. Widget de taille 2x1. API : `GET /api/v1/dashboard/team-status` (managers uniquement).

### 6.8 Widget AI Summary on demand
Widget permettant de poser une question en langage naturel sur ses donnees : "Quels emails importants ai-je recus cette semaine ?", "Quel est l'avancement du projet Alpha ?", "Resumez les decisions de mes reunions d'hier". L'IA genere une reponse structuree avec des liens cliquables vers les elements references. Champ de saisie en haut du widget, reponse affichee en dessous (Markdown rendu). Historique des questions dans le widget (liste cliquable). Widget de taille 2x2 ou 3x2. API : `POST /api/v1/dashboard/ai-query` avec `{question}`.

---

## Categorie 7 — Performance et technique

### 7.1 Chargement progressif (skeleton loading)
Au premier rendu, chaque widget affiche un skeleton loader (rectangles gris animes, animation pulse 1.5s). Les skeletons correspondent a la structure du widget (lignes pour les listes, cercles pour les KPIs, rectangle large pour les graphiques). Les widgets se remplissent independamment des que leur API repond (pas d'attente globale). L'ordre de chargement est prioritaire : KPIs en premier (<300ms cible), puis briefing AI (<3s), puis widgets de contenu (<1s chacun). Le skeleton est implemente avec les composants Skeleton de shadcn/ui.

### 7.2 Cache local et stale-while-revalidate
Les donnees du dashboard sont mises en cache localement via `react-query` avec la strategie `staleTime: 30_000, cacheTime: 300_000`. Au chargement, les donnees en cache sont affichees immediatement (pas de skeleton si le cache est frais) pendant que les donnees fraiches sont recuperees en arriere-plan. Quand les nouvelles donnees arrivent, le widget se met a jour silencieusement (pas de flash). Le cache persiste entre les navigations (global react-query cache). Pour les donnees lourdes (graphiques, activite), le cache est egalement sauvegarde en IndexedDB pour persistance apres fermeture du navigateur.

### 7.3 WebSocket pour les mises a jour temps reel
Les KPIs (emails non lus, taches) sont mis a jour via WebSocket PgEventBus. Le frontend souscrit aux events pertinents pour l'utilisateur connecte : `mail.received`, `mail.read`, `tasks.assigned`, `tasks.completed`, `calendar.event.created`, `chat.message.received`. Chaque event declenche un invalidation du cache react-query du widget concerne (pas de refetch complet, juste le delta). Pas de polling. Reconnexion automatique du WebSocket avec backoff exponentiel si la connexion est perdue (1s, 2s, 4s, 8s, max 30s). Indicateur "Deconnecte" (dot rouge) dans le footer du dashboard si le WebSocket est down.

### 7.4 Agregation cote gateway
Le backend Gateway (`signapps-gateway`, port 3099) agrege les donnees de tous les services en un seul appel API `GET /api/v1/dashboard/summary`. Ce endpoint fait des requetes paralleles vers : Mail (port 3012, compteur non lus), Calendar (port 3011, evenements du jour), Tasks (compteur taches assignees), Drive/Storage (port 3004, fichiers recents). Le gateway retourne un objet JSON unifie en <500ms. Les widgets individuels peuvent aussi appeler leurs services directement pour les donnees detaillees (liste de taches, liste d'emails). Le summary est cache 30 secondes cote gateway avec invalidation par PgEventBus.

### 7.5 Responsive mobile
Sur mobile (viewport < 768px), la grille passe en colonne unique (1 colonne). Les widgets sont empiles verticalement dans l'ordre defini par le layout (top-left first). Les widgets peu utiles sur petit ecran (graphiques embed, embed iframe) sont masques par defaut (l'utilisateur peut les reactiver dans les parametres mobile). Gestures : pull-to-refresh (recharge tous les widgets), swipe horizontal entre dashboards (si multiples). Le briefing AI est affiche en plein ecran sur mobile avec scroll vertical. La barre d'actions rapides est remplacee par un FAB (floating action button) avec menu radial.

### 7.6 Accessibilite WCAG AA
Navigation complete au clavier entre les widgets : `Tab` / `Shift+Tab` pour naviguer entre widgets (chaque widget a `tabindex="0"`). `Enter` pour entrer dans un widget (focus sur le premier element interactif). `Escape` pour sortir d'un widget. Chaque widget a un `role="region"` avec `aria-label` descriptif ("Widget taches recentes — 7 taches"). Les KPIs sont annonces par les lecteurs d'ecran avec valeur et tendance ("12 emails non lus, en hausse"). Contrastes AA sur toutes les couleurs. Focus visible (outline 2px bleu) sur tous les elements interactifs. Skip link en haut de page "Aller au contenu du dashboard".

---

## Categorie 8 — Donnees et integrations backend

### 8.1 API agregee Gateway
Le endpoint `GET /api/v1/dashboard/summary` du gateway (port 3099) agrege en un seul appel : nombre d'emails non lus (Mail, port 3012), nombre d'evenements du jour (Calendar, port 3011), taches assignees avec deadline (Tasks), fichiers recents (Drive/Storage, port 3004), compteur notifications non lues (Notifications, port 8095), messages Chat non lus. Response format :
```json
{
  "emails_unread": 12,
  "emails_unread_high_priority": 3,
  "events_today": 4,
  "next_event": {"title": "Sync Marketing", "starts_at": "2026-04-10T14:00:00Z"},
  "tasks_assigned": 7,
  "tasks_overdue": 2,
  "files_recent_count": 5,
  "notifications_unread": 8,
  "chat_unread": 3,
  "kpi_history": {
    "emails": [8, 12, 5, 15, 10, 9, 12],
    "events": [3, 5, 2, 4, 6, 3, 4],
    "tasks": [5, 7, 3, 8, 6, 4, 7]
  }
}
```
Le frontend fait un seul appel au chargement initial, puis les mises a jour incrementales arrivent via WebSocket.

### 8.2 Evenements PgEventBus
Les mises a jour incrementales sont poussees via PgEventBus. Le dashboard frontend ecoute (via le WebSocket de notifications) :
- `mail.received` -> increment emails_unread
- `mail.read` -> decrement emails_unread
- `tasks.assigned` -> increment tasks_assigned
- `tasks.completed` -> decrement tasks_assigned
- `calendar.event.created` -> refresh events_today
- `calendar.event.updated` -> refresh events_today
- `chat.message.received` -> increment chat_unread
- `drive.file.shared` -> refresh files_recent
- `notification.created` -> increment notifications_unread
Chaque event PgEventBus declenche un `queryClient.invalidateQueries()` cible dans le store react-query.

### 8.3 Preferences utilisateur persistantes
Le layout du dashboard (position/taille de chaque widget), les widgets selectionnes, les dashboards nommes et les preferences (theme, mode d'affichage, intervalles de rafraichissement) sont stockes dans la table `dashboard_layouts` via l'API Identity (port 3001). Synchronisation cross-device : la modification du layout sur un device est refletee sur les autres en <5 secondes via WebSocket event `dashboard.layout.updated`. Pas de conflit : le dernier write gagne (last-write-wins), ce qui est acceptable pour les preferences UI.

### 8.4 Rate limiting des widgets
Chaque widget a un TTL de rafraichissement minimum cote serveur : KPIs 30s, emails 60s, fichiers 120s, activite 30s, meteo 900s. Les requetes en dessous du TTL retournent la reponse cachee (header `X-Cache: HIT`). Le bouton Actualiser du widget force le rechargement en ajoutant `?force=true` qui bypass le cache serveur. Le gateway maintient un cache en memoire (moka) par utilisateur et par endpoint avec les TTL configures.

### 8.5 Fallback gracieux
Si un service backend est indisponible (timeout, erreur 5xx), le widget correspondant affiche un message "Service temporairement indisponible" avec une icone warning (triangle orange) et un bouton "Reessayer". Les autres widgets restent fonctionnels (isolation totale). Si le gateway est indisponible, le dashboard entier affiche un message "Impossible de charger le dashboard" avec le bouton Reessayer. Les donnees en cache react-query/IndexedDB sont affichees en mode degrade avec un badge "Donnees du [date]".

---

## Schema PostgreSQL

```sql
-- Layouts de dashboard (un par dashboard nomme)
CREATE TABLE dashboard_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL DEFAULT 'Mon Dashboard',
    slug VARCHAR(255) NOT NULL, -- URL-friendly name
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_shared BOOLEAN NOT NULL DEFAULT FALSE,
    template_source VARCHAR(64), -- null or template name used
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, slug)
);
CREATE INDEX idx_layouts_user ON dashboard_layouts(user_id);

-- Widgets dans un layout
CREATE TABLE dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layout_id UUID NOT NULL REFERENCES dashboard_layouts(id) ON DELETE CASCADE,
    widget_type VARCHAR(64) NOT NULL, -- kpi_emails, kpi_events, kpi_tasks, kpi_files, kpi_custom, agenda, tasks, emails, files, activity, notes, shortcuts, notifications, weather_clock, okr, chart, embed, calendar_mini, chat_recent, team_counters, ai_summary, ai_query
    -- Grid position (react-grid-layout)
    grid_x INT NOT NULL DEFAULT 0,
    grid_y INT NOT NULL DEFAULT 0,
    grid_w INT NOT NULL DEFAULT 2, -- width in columns (1-12)
    grid_h INT NOT NULL DEFAULT 2, -- height in rows
    min_w INT DEFAULT 1,
    max_w INT DEFAULT 12,
    min_h INT DEFAULT 1,
    max_h INT DEFAULT 8,
    -- Configuration
    config JSONB DEFAULT '{}', -- widget-specific config (refresh_interval, source, filters, content for notes, etc.)
    is_locked BOOLEAN DEFAULT FALSE,
    is_visible BOOLEAN DEFAULT TRUE,
    refresh_interval_seconds INT DEFAULT 60,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_widgets_layout ON dashboard_widgets(layout_id);

-- Partage de dashboards
CREATE TABLE dashboard_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layout_id UUID NOT NULL REFERENCES dashboard_layouts(id) ON DELETE CASCADE,
    shared_with_user_id UUID REFERENCES users(id),
    shared_with_group_id UUID, -- team or group
    permission VARCHAR(16) NOT NULL DEFAULT 'read', -- read, edit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(layout_id, shared_with_user_id)
);

-- Templates de dashboard (crees par admin ou systeme)
CREATE TABLE dashboard_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    role_target VARCHAR(64), -- manager, developer, sales, hr, executive, null=all
    widgets JSONB NOT NULL, -- [{widget_type, grid_x, grid_y, grid_w, grid_h, config}]
    is_system BOOLEAN DEFAULT FALSE, -- true = built-in, false = admin-created
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Objectifs OKR du dashboard
CREATE TABLE dashboard_okrs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(512) NOT NULL,
    target_value FLOAT NOT NULL,
    current_value FLOAT NOT NULL DEFAULT 0.0,
    unit VARCHAR(32) DEFAULT '%', -- %, count, hours, etc.
    linked_task_filter JSONB, -- optional: {project_id, status} to auto-calculate
    quarter VARCHAR(8), -- Q1-2026, Q2-2026, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_okrs_user ON dashboard_okrs(user_id);

-- Briefings AI (cache quotidien)
CREATE TABLE dashboard_briefings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    briefing_date DATE NOT NULL,
    content JSONB NOT NULL, -- {summary, priorities[], insights[], sources_used[]}
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, briefing_date)
);
CREATE INDEX idx_briefings_user_date ON dashboard_briefings(user_id, briefing_date DESC);

-- Briefing settings
CREATE TABLE dashboard_briefing_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
    sources TEXT[] DEFAULT '{mail,calendar,tasks,drive,chat}',
    detail_level VARCHAR(16) DEFAULT 'concise', -- concise, detailed
    delivery_channels TEXT[] DEFAULT '{in_app}', -- in_app, email, push
    briefing_time TIME DEFAULT '08:00',
    timezone VARCHAR(64) DEFAULT 'UTC',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI query history (for on-demand AI widget)
CREATE TABLE dashboard_ai_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sources_used JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_queries_user ON dashboard_ai_queries(user_id, created_at DESC);

-- Widget weather cache (shared across users by location)
CREATE TABLE dashboard_weather_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_key VARCHAR(64) NOT NULL UNIQUE, -- "lat:lon" rounded to 2 decimals
    data JSONB NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## REST API Endpoints

All endpoints require JWT authentication. Base path: routes spread across `signapps-gateway` (port 3099) and `signapps-identity` (port 3001).

### Dashboard Summary (Gateway)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/dashboard/summary` | Aggregated KPIs from all services |
| GET | `/api/v1/dashboard/kpis` | KPI cards data with 7-day history |
| GET | `/api/v1/dashboard/kpis/team` | Team KPIs (managers only) |
| GET | `/api/v1/dashboard/activity?page=&per_page=` | Activity feed |
| GET | `/api/v1/dashboard/team-status` | Team presence counters (managers only) |

### AI Briefing
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/dashboard/briefing?date=` | Get or generate daily briefing |
| POST | `/api/v1/dashboard/briefing/regenerate` | Force regenerate today briefing |
| GET | `/api/v1/dashboard/briefing/settings` | Get briefing settings |
| PATCH | `/api/v1/dashboard/briefing/settings` | Update briefing settings |

### AI Query
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/dashboard/ai-query` | Ask AI question about user data |
| GET | `/api/v1/dashboard/ai-query/history` | Query history |

### Layouts (Identity service)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/dashboard/layouts` | List user dashboards |
| POST | `/api/v1/dashboard/layouts` | Create new dashboard |
| GET | `/api/v1/dashboard/layouts/:id` | Get layout with widgets |
| PATCH | `/api/v1/dashboard/layouts/:id` | Update layout (widget positions) |
| DELETE | `/api/v1/dashboard/layouts/:id` | Delete dashboard |
| POST | `/api/v1/dashboard/layouts/:id/share` | Share dashboard |
| GET | `/api/v1/dashboard/layouts/shared` | List dashboards shared with me |

### Templates
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/dashboard/templates` | List available templates |
| POST | `/api/v1/dashboard/templates` | Create template (admin) |
| DELETE | `/api/v1/dashboard/templates/:id` | Delete template (admin) |

### OKRs
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/dashboard/okrs` | List user OKRs |
| POST | `/api/v1/dashboard/okrs` | Create OKR |
| PATCH | `/api/v1/dashboard/okrs/:id` | Update OKR progress |
| DELETE | `/api/v1/dashboard/okrs/:id` | Delete OKR |

### Charts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/dashboard/charts?source=&period=` | Chart data by source |

### Weather
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/dashboard/weather?lat=&lon=` | Weather data (proxied) |

### Widgets (via layout update)
Widgets do not have individual CRUD endpoints. They are managed as part of the layout. The `PATCH /api/v1/dashboard/layouts/:id` endpoint accepts the full widget array:
```json
{
  "widgets": [
    {
      "id": "uuid",
      "widget_type": "tasks",
      "grid_x": 0, "grid_y": 0,
      "grid_w": 2, "grid_h": 2,
      "config": {"filter": "overdue", "limit": 10},
      "is_locked": false,
      "refresh_interval_seconds": 60
    }
  ]
}
```

---

## PgEventBus Events

### Events consumed (dashboard listens via WebSocket)
| Event | Dashboard action |
|-------|-----------------|
| `mail.received` | Increment emails_unread KPI, add to email widget |
| `mail.read` | Decrement emails_unread KPI |
| `calendar.event.created` | Refresh agenda widget |
| `calendar.event.updated` | Refresh agenda widget |
| `calendar.event.deleted` | Refresh agenda widget |
| `calendar.event.reminder` | Show "Bientot" badge on agenda widget |
| `tasks.assigned` | Increment tasks KPI, add to tasks widget |
| `tasks.completed` | Decrement tasks KPI, update tasks widget |
| `tasks.status_changed` | Update task status in widget |
| `drive.file.shared` | Refresh files widget |
| `drive.file.updated` | Refresh files widget |
| `chat.message.received` | Increment chat_unread, update chat widget |
| `chat.message.read` | Decrement chat_unread |
| `notification.created` | Increment notifications badge |
| `notification.read` | Decrement notifications badge |
| `social.post.published` | Update activity feed |
| `social.post.failed` | Show alert in activity feed |

### Events emitted
| Event | Payload | Description |
|-------|---------|-------------|
| `dashboard.layout.updated` | `{user_id, layout_id}` | Layout changed (for cross-device sync) |
| `dashboard.briefing.generated` | `{user_id, briefing_date}` | Daily briefing generated |

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Google Workspace Home** (workspace.google.com) — documentation sur la page d'accueil unifiee, priorites intelligentes, integration cross-app.
- **Microsoft Viva Insights** (learn.microsoft.com/viva) — guides sur les wellbeing metrics, focus time, daily briefings.
- **Notion Templates Gallery** (notion.so/templates) — templates de dashboards personnels et d'equipe, patterns de databases inline.
- **Monday.com Help Center** (support.monday.com) — documentation sur les dashboard widgets, filtres globaux, benchmarks KPI.
- **ClickUp University** (university.clickup.com) — cours sur la creation de dashboards, 50+ types de widgets, custom calculations.
- **Asana Guide** (asana.com/guide) — documentation sur Home, My Tasks, Portfolios, Status Updates.
- **Geckoboard Blog** (geckoboard.com/blog) — bonnes pratiques pour les dashboards TV, choix de metriques, design de KPIs.
- **Databox Blog** (databox.com/blog) — guides sur les scorecards, goals tracking, dashboard design patterns.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **react-grid-layout** (github.com/react-grid-layout/react-grid-layout) | **MIT** | Grille drag-and-drop responsive. Pattern de reference pour le layout de widgets. |
| **gridstack.js** (github.com/gridstack/gridstack.js) | **MIT** | Grille de widgets avec resize, drag, serialization. Alternative a react-grid-layout. |
| **dnd-kit** (github.com/clauderic/dnd-kit) | **MIT** | Drag-and-drop accessible et performant pour React. Pattern pour les interactions widget. |
| **Chart.js** (chartjs.org) | **MIT** | Graphiques canvas pour les widgets KPI (barres, lignes, donut). Deja utilise dans SignApps. |
| **Apache ECharts** (echarts.apache.org) | **Apache-2.0** | Graphiques riches pour les widgets avances (gauge, heatmap, treemap). |
| **Recharts** (recharts.org) | **MIT** | Graphiques React declaratifs. Pattern pour les sparklines et mini-charts dans les KPIs. |
| **@tanstack/react-query** (tanstack.com/query) | **MIT** | Stale-while-revalidate, cache, refetch. Pattern pour le chargement des donnees widgets. |
| **date-fns** (date-fns.org) | **MIT** | Manipulation de dates pour l'agenda, les deadlines, les tendances KPI. |
| **Zustand** (github.com/pmndrs/zustand) | **MIT** | State management leger. Deja utilise dans SignApps pour les stores. |
| **Framer Motion** (framer.com/motion) | **MIT** | Animations fluides pour les transitions de widgets, skeleton loading, drag feedback. |

### Pattern d'implementation recommande
1. **Layout** : `react-grid-layout` (MIT) pour la grille drag-and-drop. Composant `<ResponsiveGridLayout>` avec breakpoints `{lg: 1200, md: 996, sm: 768, xs: 480}` et colonnes `{lg: 12, md: 8, sm: 4, xs: 1}`. Persistance du layout dans PostgreSQL via `PATCH /api/v1/dashboard/layouts/:id`.
2. **Data fetching** : `@tanstack/react-query` (MIT) avec stale-while-revalidate pour chaque widget independamment. Chaque widget a sa propre query key et son propre `refetchInterval`.
3. **Temps reel** : WebSocket via PgEventBus pour les compteurs (emails, notifications, taches). `queryClient.invalidateQueries()` cible sur chaque event.
4. **Graphiques** : Chart.js (MIT) pour les sparklines et widgets chart simples. ECharts (Apache-2.0) pour les graphiques complexes (gauge, heatmap).
5. **AI Summary** : appel au service `signapps-ai` (port 3005) via le gateway. Resume genere par le LLM configure. Cache du resume dans `dashboard_briefings` (1 par jour par utilisateur).
6. **Impression** : CSS `@media print` avec layout optimise 2 colonnes. Export PDF via `html2canvas` (MIT) + `jsPDF` (MIT).
7. **Skeleton loading** : composants Skeleton de shadcn/ui avec dimensions correspondant au contenu attendu.
8. **Widget isolation** : chaque widget est un composant React independant avec son propre ErrorBoundary. Un crash dans un widget n'affecte pas les autres.

### Ce qu'il ne faut PAS faire
- **Pas de chargement sequentiel** des widgets — tous les widgets chargent en parallele.
- **Pas de polling** pour les mises a jour temps reel — utiliser uniquement WebSocket PgEventBus.
- **Pas de donnees sensibles** dans les widgets partages — les dashboards equipe affichent des agregats, pas des donnees individuelles.
- **Pas de copier-coller** depuis les projets open source, meme MIT. On s'inspire des patterns, on reecrit.
- **Respect strict** de la politique de licences (voir `deny.toml` et `memory/feedback_license_policy.md`).

---

## Assertions E2E cles (a tester)

- Le dashboard affiche les 4 KPIs principaux (Emails, Evenements, Taches, Fichiers) au chargement
- Les KPIs affichent des valeurs numeriques correctes correspondant aux donnees reelles
- Les sparklines 7j sont visibles sous chaque KPI
- Le resume AI quotidien se genere et affiche un texte coherent avec des liens cliquables
- Clic sur un KPI redirige vers le module correspondant
- Le widget Taches recentes affiche les taches assignees a l'utilisateur connecte
- Checkbox sur une tache la marque comme terminee sans quitter le dashboard
- Le widget Agenda du jour affiche les evenements de la date courante
- L'heure actuelle est marquee par une ligne rouge dans l'agenda
- Le widget Emails recents affiche les derniers emails avec badge non lu
- Le widget Fichiers recents affiche les fichiers modifies recemment
- Le widget Activite recente affiche un flux chronologique
- Le bouton Personnaliser ouvre le panneau de catalogue de widgets
- Drag-and-drop d'un widget le repositionne dans la grille
- Redimensionnement d'un widget change ses dimensions visuelles
- Ajout d'un widget depuis le catalogue l'insere dans la grille
- Suppression d'un widget le retire de la grille
- Le layout personnalise persiste apres rechargement de la page
- Le layout se synchronise entre deux devices (ouvrir sur un autre navigateur)
- Le bouton Actualiser recharge les donnees de tous les widgets
- Le bouton Imprimer genere un rendu PDF coherent
- Les actions rapides (Nouveau document, Nouvel email, etc.) ouvrent les dialogs modaux
- La recherche contextuelle filtre les widgets par terme
- Le widget notes rapides sauvegarde le texte entre les sessions
- Creation d'un second dashboard nomme, visible en onglet
- Application d'un template (Manager) remplace le layout
- Dashboard partage visible par un autre utilisateur
- Le dashboard s'adapte en colonne unique sur mobile (viewport < 768px)
- Les skeleton loaders s'affichent pendant le chargement des widgets
- Les KPIs d'equipe ne sont visibles que pour les utilisateurs avec le role manager
- Le mode sombre applique les bonnes couleurs sur tous les widgets
- Navigation clavier complete entre les widgets (Tab / Shift+Tab)
- Widget verrouille : impossible de le deplacer
- Widget meteo affiche la temperature et les previsions
- Widget OKR affiche la progression des objectifs
- Widget graphique custom affiche le bon type de graphique
- Widget AI query repond a une question en langage naturel

---

## Historique

| Date | Modification |
|---|---|
| 2026-04-09 | Creation de la specification initiale — 8 categories, benchmark 12 concurrents |
| 2026-04-10 | Enrichissement P0 : react-grid-layout detail, widget catalog, widget lock, refresh intervals, PostgreSQL schema (8 tables), REST API (25+ endpoints), PgEventBus events consumed/emitted, morning briefing AI detail, KPI sparklines, responsive breakpoints, quick actions bar, widget isolation, AI query widget |
