# Module Social Media Management (SignSocial) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Hootsuite** | Pioneer du SMM, dashboard multi-comptes unifie, planification en masse (bulk composer CSV), streams temps reel (mentions, mots-cles, hashtags), Hootsuite Insights (powered by Brandwatch), integration publicitaire (boost posts), role-based team workflows (approval chains), 35+ reseaux supportes, Hootsuite Academy |
| **Buffer** | UX minimaliste et rapide, Start Page (link-in-bio), AI Assistant integre, analytics par canal avec export PDF, slot-based scheduling (file d'attente fixe), Shopify integration, prix accessible, API publique REST bien documentee |
| **Sprout Social** | Social CRM integre (profil unifie par contact), Smart Inbox (conversation routing), sentiment analysis natif, competitive benchmarking, advocacy (employee sharing), publishing calendar drag-drop, reporting PDF presentation-ready, integration Salesforce/HubSpot |
| **Later** | Visual planner Instagram-first (drag-drop grid preview), Linkin.bio (link-in-bio avec analytics), UGC management (collecter/repost user-generated content), best time to post AI, preview du feed Instagram avant publication, media library avec labels |
| **Loomly** | Post ideas feed (inspirations calendrier, trending topics, RSS), workflow d'approbation configurable (draft/pending/approved/scheduled), real-time post preview par plateforme, asset library avec brand guidelines, hashtag suggestions, integrations Unsplash/Giphy |
| **Planable** | Collaboration-first : commentaires inline sur chaque post, approbation multi-niveau avec roles, preview pixel-perfect par plateforme (Instagram grid, Facebook card, LinkedIn article), workspace par client, calendrier visuel drag-drop, version history |
| **SocialBee** | Categories de contenu (evergreen, time-sensitive, curated), recyclage automatique de posts performants, Canva integration directe, variations A/B sur un meme post, RSS auto-posting, concierge service (equipe humaine), AI copilot |
| **ContentStudio** | Content discovery engine (trending topics par niche), automation recipes (IF trigger THEN action), white-label reports, blog discovery + curation, influencer finder, multi-workspace, bulk upload |
| **Publer** | Scheduling multi-plateforme avec preview, auto-scheduling par creneaux optimaux, bulk scheduling CSV/XLSX, watermark automatique sur images, link shortener integre, RSS auto-posting, Calendar/List/Feed views, pricing agressif |
| **Metricool** | Analytics-first (dashboard unifie avec historique illimite), SmartLinks (link-in-bio avec analytics), competitor tracker, ads management (Google/Facebook/TikTok), best time to post heatmap, hashtag tracker evolution, rapports automatiques PDF email, prix tres competitif |
| **Sendible** | White-label complet (rebranding integral pour agences), Smart Queues (recyclage de contenu), content suggestions, reporting personnalise par client, integration CRM, groupes de profils, mobile app complete |
| **Agorapulse** | Social inbox zero (workflow comment/DM), ROI tracking (attribution de revenus aux posts), moderation rules (auto-hide, auto-reply), shared calendar avec approbation, competitor benchmarking, CRM social integre, rapports Power Reports |
| **Zoho Social** | Integration native Zoho CRM/Desk/Analytics, SmartQ (auto-schedule par audience), zShare (extension browser pour curation), monitoring columns (recherches sauvegardees), predictions de contenu, dashboard d'equipe avec KPIs |
| **Crowdfire** | Content curation automatique par niche, tailored posts (adaptation automatique par plateforme), queue meter (indicateur de couverture), RSS auto-posting, image editor integre, competitor tracking |
| **CoSchedule** | Marketing calendar unifie (blog + social + email + ads), ReQueue (recyclage intelligent), Top Content Report, Social Message Optimizer (score de qualite avant publication), integrations WordPress/HubSpot, headline analyzer |

## Principes directeurs

1. **Plateforme-agnostique par conception** — chaque plateforme sociale est un adaptateur enfichable (trait Rust `SocialPlatform`) avec ses contraintes specifiques (limites de caracteres, formats media, ratios d'image). Ajouter un nouveau reseau = implementer le trait + config OAuth, zero changement dans le moteur de publication.
2. **Inbox zero comme objectif** — la boite de reception unifiee (commentaires, mentions, DMs) doit converger vers zero via des outils de triage rapide : reponse rapide, assignation, archivage, tags, reponses automatiques. Chaque interaction sociale traitee = progres mesurable.
3. **IA suggestive, jamais autonome** — l'assistant IA propose des textes, hashtags, horaires et variations, mais l'humain valide toujours avant publication. Le mode "auto-publish" n'existe pas par defaut (activation explicite dans Automation).
4. **Analytique actionnable** — les metriques ne sont pas decoratives. Chaque chiffre (engagement, reach, follower growth) est lie a une action concrete : "Publiez plus de Reels (engagement +42% vs posts classiques)", "Meilleur horaire : mardi 10h", "Hashtag #innovation en baisse, remplacer par #tech".
5. **Multi-tenant natif** — un utilisateur peut gerer N espaces de travail (marques/clients) avec des comptes sociaux distincts, des calendriers separes et des rapports isoles. Zero fuite de donnees entre workspaces.
6. **Offline-resilient et queue-first** — la publication passe toujours par une file d'attente persistante (PostgreSQL). Meme en cas de panne API d'une plateforme, le post est reessaye avec backoff exponentiel. L'utilisateur voit le statut en temps reel (queued/publishing/published/failed/retrying).

---

## Categorie 1 — Dashboard et vue d'ensemble

### 1.1 KPIs en temps reel
Quatre cartes en haut du dashboard : **Abonnes total** (somme cross-plateforme avec delta 7j), **Posts cette semaine** (publies vs programmes), **Taux d'engagement moyen** (interactions / reach, 30j glissants), **Messages en attente** (inbox non lus). Chaque carte cliquable pour naviguer vers la section detaillee. Sparkline 7j sous chaque valeur avec couleur verte (hausse) ou rouge (baisse). Animation `countUp` sur les valeurs au chargement initial. Skeleton loader pendant le fetch. API : `GET /api/v1/social/dashboard/kpis` retourne les 4 metriques en un appel agrege.

### 1.2 Feed d'activite recente
Timeline chronologique des dernieres actions : posts publies, commentaires recus, nouveaux abonnes, mentions, DMs. Icone de plateforme + horodatage relatif. Filtre par plateforme et par type d'activite. Infinite scroll avec chargement par lots de 20 elements. Clic sur un element navigue vers le contexte source (post, inbox message). Bouton "Rafraichir" force le rechargement. Animation fade-in pour les nouveaux elements. API : `GET /api/v1/social/activity?page=1&per_page=20&platform=all&type=all`.

### 1.3 Mini-calendrier des publications a venir
Calendrier compact (7 jours) montrant les posts programmes avec pastille de couleur par plateforme. Clic sur un jour ouvre le calendrier complet a cette date. Chaque pastille affiche un tooltip au survol avec le titre du post tronque a 60 caracteres et l'heure programmee. Indicateur numerique si plus de 3 posts le meme jour ("3+" au lieu de pastilles individuelles). Fleches gauche/droite pour decaler la fenetre de 7 jours. Raccourci clavier `C` depuis le dashboard pour ouvrir le calendrier complet.

### 1.4 Performance rapide par plateforme
Tableau synthetique : une ligne par compte connecte, colonnes : plateforme (icone + nom), followers (nombre + delta 7j), posts 30j (compteur), engagement rate (% avec code couleur : vert >3%, orange 1-3%, rouge <1%), reach 30j (nombre formate), trend arrow (hausse/baisse/stable). Tri par colonne avec clic sur l'en-tete. Clic sur une ligne navigue vers les analytics detailles de ce compte. Ligne surlignee en rouge si le token OAuth est expire. API : `GET /api/v1/social/accounts/performance`.

### 1.5 Alertes et notifications
Bandeau d'alertes en haut du dashboard : token OAuth expire (orange), post echoue (rouge), pic de mentions potentiel bad buzz (rouge clignotant), milestone atteint comme 10k followers (vert). Actions directes depuis l'alerte : reconnecter le compte, retenter la publication, voir le detail. Chaque alerte est dismissable avec icone `X`. Les alertes critiques (token expire, post failed) persistent jusqu'a resolution. Badge compteur d'alertes sur l'icone du module dans la sidebar. PgEventBus event `social.alert.created` declenche la notification en temps reel.

### 1.6 Widget best time to post
Heatmap 7x24 (jours de la semaine x heures) montrant les creneaux d'engagement optimal par plateforme. Base sur l'historique des 90 derniers jours du compte. Cellules colorees du vert fonce (meilleur) au gris clair (pire). Tooltip au survol : "Mardi 10h — engagement moyen 4.2%, 12 posts historiques". Selecteur de plateforme au-dessus de la heatmap. Bouton "Programmer a ce creneau" qui ouvre le compose pre-rempli avec la date/heure. API : `GET /api/v1/social/analytics/best-times?platform=linkedin&days=90`.

### 1.7 Quick compose
Bouton flottant "Nouveau post" (FAB, bottom-right, icone `+`) accessible depuis toute page du module. Ouvre le compose dialog en overlay modal sans quitter le contexte actuel. Raccourci clavier `N` pour ouvrir. Le dialog se ferme avec `Escape` et sauvegarde automatiquement en brouillon si du contenu a ete saisi. Animation slide-up depuis le bas de l'ecran (300ms ease-out).

---

## Categorie 2 — Composition et publication

### 2.1 Editeur de post multi-plateforme
Zone de texte riche avec compteur de caracteres dynamique adapte a la plateforme selectionnee (280 Twitter/X, 2200 Instagram, 3000 LinkedIn, 500 TikTok, 63206 Facebook, 500 Threads, 300 Bluesky). Le compteur passe en orange a 80% de la limite et en rouge a 95%. Preview en temps reel dans un mockup de chaque plateforme ciblee (rendu fidele avec avatar, nom du compte, horodatage simule). Mentions `@` avec autocompletion depuis les contacts et hashtags `#` avec autocompletion depuis l'historique. Emoji picker integre. Raccourcis : `Ctrl+B` gras (LinkedIn/Facebook), `Ctrl+Enter` publier/programmer, `Ctrl+S` sauvegarder brouillon.

### 2.2 Selecteur de plateformes "Post to"
Grille de toggles avec icones des plateformes supportees : Twitter/X, Facebook (page/groupe), Instagram (feed/story/reel), LinkedIn (profil/page), TikTok, YouTube (community/short), Pinterest, Threads, Mastodon, Bluesky. Activation/desactivation par clic. Badge warning jaune si le contenu depasse les contraintes d'une plateforme (nombre de caracteres, format media non supporte). Badge erreur rouge si le compte est deconnecte. Tooltip au survol de chaque toggle : nom du compte, statut de connexion, limite de caracteres restante. Groupes de comptes selectionnables en un clic ("Tous les comptes France"). Animation checkmark lors de l'activation.

### 2.3 Upload media (drag-drop)
Zone de drop pour images et videos. Support JPEG, PNG, WebP, GIF, MP4, MOV, AVI. Preview en thumbnail avec crop/resize inline. Limites affichees par plateforme (Instagram 1:1 / 4:5 / 16:9, Twitter max 4 images ou 1 video, LinkedIn max 9 images). Alt text obligatoire pour l'accessibilite (champ sous chaque media). Barre de progression pendant l'upload. Reordonnancement par drag-drop pour les carousels. Suppression d'un media par clic sur l'icone `X` en overlay. Taille max par fichier : 50 Mo images, 500 Mo videos. Formats non supportes affichent un toast d'erreur avec les formats acceptes. Les medias sont uploades vers `signapps-storage` (port 3004) et traites par `signapps-media` (port 3009) pour le resize. API : `POST /api/v1/social/media/upload` (multipart/form-data).

### 2.4 Assistance IA a la redaction
Bouton "Generer avec IA" dans la toolbar du compose. Saisir un brief ("nouveau produit eco-responsable pour millennials") et l'IA propose 3 variations de texte adaptees au ton de la marque. Options selectionnables : ton (formel / decontracte / humoristique / inspirant / educatif), longueur (courte <100 chars / moyenne / longue), emoji (oui / non / modere). Chaque variation est affichee dans un card cliquable. Clic selectionne et insere dans l'editeur. Bouton "Regenerer" pour obtenir 3 nouvelles variations. L'IA prend en compte l'historique des 10 derniers posts performants pour calibrer le style. Appel au service `signapps-ai` (port 3005) via `POST /api/v1/social/ai/generate`. Latence cible <3 secondes. Indicateur de chargement "Generation en cours..." avec animation de typing.

### 2.5 Suggestions de hashtags IA
Panneau lateral avec hashtags suggeres classes par pertinence et popularite. Trois categories visuelles : **Trending** (fleche vers le haut, badge rouge), **Stable** (badge gris), **Niche** (badge bleu, faible volume mais forte pertinence). Indicateurs affiches : volume d'utilisation mensuel, score de competitivite (1-100), score de pertinence par rapport au contenu du post (1-100). Clic pour ajouter au post. Double-clic pour voir les posts historiques utilisant ce hashtag. Maximum configurable par plateforme (defaut : 30 Instagram, 5 LinkedIn, 3 Twitter). Champ de recherche pour trouver un hashtag specifique. API : `POST /api/v1/social/ai/hashtags` avec le texte du post en body.

### 2.6 Planification (Schedule)
Date picker calendrier + time picker avec increments de 15 minutes. Quatre options radio : "Publier maintenant", "Programmer" (date/heure specifique), "Ajouter a la file" (prochain creneau optimal calcule par l'algorithme best-time), "Sauvegarder en brouillon". Fuseau horaire configurable avec dropdown (par defaut celui de l'utilisateur, override possible par compte). Affichage de l'heure locale et de l'heure UTC. Warning si l'heure programmee est dans le passe. Warning si un autre post est deja programme dans les 30 minutes precedentes ou suivantes (risque de spam). Raccourci clavier `Ctrl+Shift+S` pour programmer. API : `POST /api/v1/social/posts` avec le champ `scheduled_at` en ISO 8601.

### 2.7 Publication immediate
Bouton "Publier maintenant" avec confirmation modale ("Publier sur 3 plateformes ? Cette action est irreversible."). Publication parallele sur toutes les plateformes selectionnees via des tasks tokio. Statut en temps reel par plateforme : spinner (en cours), checkmark vert (succes), croix rouge (echec avec message d'erreur). Retry manuel en cas d'echec (bouton "Retenter" par plateforme). Apres succes complet, redirection vers le calendrier avec le post visible. Toast de confirmation "Post publie sur 3 plateformes". PgEventBus event `social.post.published` emis pour chaque plateforme. Erreurs possibles : rate limit (429), token expire (401), contenu rejete par la plateforme (400).

### 2.8 Brouillons et sauvegarde automatique
Auto-save toutes les 30 secondes via `PATCH /api/v1/social/drafts/:id`. Indicateur "Sauvegarde..." puis "Sauvegarde reussie" dans le header du compose. Liste des brouillons accessible depuis le menu lateral (`/social/drafts`). Chaque brouillon affiche : titre (premiers 60 caracteres du texte), plateformes cibles (icones), date de derniere modification, auteur. Reprise d'un brouillon avec tout le contexte (texte, media, plateformes, hashtags, premier commentaire). Suppression de brouillon avec modale de confirmation. Tri des brouillons par date (plus recents en premier). Recherche par texte. API : `GET /api/v1/social/drafts`, `POST /api/v1/social/drafts`, `DELETE /api/v1/social/drafts/:id`.

### 2.9 Thread / Carousel builder
Mode thread pour Twitter/X : cliquer "Ajouter un tweet" ajoute un bloc de texte lie avec numerotation automatique ("1/n") et navigation fleche entre les tweets. Preview du thread complet avec separateurs visuels. Compteur de caracteres par tweet. Mode carousel pour Instagram/LinkedIn : ordonnancer les images/slides avec drag-drop. Preview du swipe horizontal avec navigation par dots. Maximum 10 slides Instagram, 20 slides LinkedIn. Chaque slide peut avoir son propre texte alternatif. Bouton "Ajouter un slide" et "Supprimer" avec confirmation si contenu present.

### 2.10 Variations par plateforme
Apres selection de plusieurs plateformes, onglets par plateforme dans l'editeur pour personnaliser le texte. Texte long et formel pour LinkedIn, concis pour Twitter, avec emojis pour Instagram. Preview cote a cote en mode split-screen (jusqu'a 3 previews simultanees). Bouton "Copier le texte principal vers toutes les plateformes" pour reinitialiser. L'IA peut proposer l'adaptation automatique via "Auto-adapter" : le texte principal est reformule pour chaque plateforme selon ses conventions. API : le champ `platform_overrides` dans le body du POST contient un objet `{twitter: "texte court", linkedin: "texte long"}`.

### 2.11 Premier commentaire automatique
Option checkbox "Ajouter un premier commentaire" qui revele un champ texte supplementaire. Le commentaire est publie automatiquement 10 secondes apres le post principal (delai configurable 5-60s). Utilise sur Instagram pour les hashtags (evite le spam look dans le texte principal) et LinkedIn pour les liens (meilleur reach sans lien dans le post). Preview du commentaire dans le mockup de la plateforme. Erreur possible : si le post n'a pas encore d'ID (publication en cours), le commentaire est mis en queue.

### 2.12 Geolocalisation et tagging
Ajout de localisation au post via recherche de lieu (autocompletion Google Places ou OpenStreetMap). Tag d'autres comptes/pages via `@mention` dans le texte ou via un champ dedie "Taguer des comptes" (autocompletion par plateforme). Preview du rendu avec les tags visibles. La geolocalisation n'est supportee que par certaines plateformes (Instagram, Facebook). Warning si la plateforme cible ne supporte pas la geolocalisation.

### 2.13 A/B testing de posts
Creer 2 a 4 variations d'un meme post (texte different, media different, hashtags differents). Chaque variation est publiee sur un sous-ensemble de l'audience (si la plateforme le supporte) ou a des horaires differents. Apres 24h, le systeme identifie la variation gagnante par engagement rate. Dashboard de resultats A/B : graphique comparatif par variation, metrique gagnante en vert. Option "Publier la variation gagnante" sur les plateformes restantes. API : `POST /api/v1/social/posts/ab-test` avec un tableau de `variations[]`.

### 2.14 Bulk scheduling (import CSV/XLSX)
Importer un fichier CSV ou XLSX avec les colonnes : `text`, `platform`, `scheduled_at`, `media_url` (optionnel), `hashtags` (optionnel), `first_comment` (optionnel). Preview en tableau avec validation : cellules en rouge si erreur (date dans le passe, plateforme inconnue, texte trop long). Bouton "Programmer tout" cree les posts en batch. Limite : 200 posts par import. Barre de progression pendant la creation. Template CSV telechargeable. API : `POST /api/v1/social/posts/bulk` avec multipart/form-data.

---

## Categorie 3 — Calendrier de publication

### 3.1 Vues multiples
Quatre vues : **Mois** (grille classique avec pastilles de couleur par plateforme, cellules cliquables), **Semaine** (7 colonnes avec creneaux horaires de 30 min, posts positionnes sur leur heure), **Jour** (timeline verticale detaillee avec preview du media et texte complet), **Liste** (tableau triable avec colonnes : date, heure, plateforme, statut, texte apercu, auteur, engagement si publie). Toggle rapide entre vues via boutons icones en haut a droite. Raccourcis clavier : `M` mois, `W` semaine, `D` jour, `L` liste. L'URL reflete la vue active : `/social/calendar?view=month&date=2026-04`. Persistance de la derniere vue utilisee dans localStorage.

### 3.2 Code couleur par plateforme
Chaque plateforme a sa couleur distinctive : bleu ciel Twitter/X, bleu fonce Facebook, gradient rose-orange Instagram, bleu LinkedIn, noir TikTok, rouge YouTube, rouge fonce Pinterest, noir Threads, violet Mastodon, bleu Bluesky. Legende visible en bas du calendrier avec toggles pour afficher/masquer chaque plateforme. Les pastilles multi-plateforme affichent un degrade des couleurs concernees ou un stack de points colores.

### 3.3 Drag-drop pour replanifier
Glisser un post d'un creneau a un autre pour changer sa date/heure de publication. Curseur `grab` au survol, `grabbing` pendant le drag. Ghost semi-transparent du post pendant le deplacement. Zone de drop surlignee en bleu. Confirmation modale si le post est deja publie ("Ce post est deja publie, impossible de le deplacer"). Animation fluide 200ms ease-out a la depose. Le backend est appele via `PATCH /api/v1/social/posts/:id` avec le nouveau `scheduled_at`. Rollback visuel si le backend retourne une erreur.

### 3.4 Filtres par plateforme, statut, auteur
Barre de filtres en haut : toggles plateforme (afficher/masquer, icones avec checkbox), statut (brouillon jaune / programme bleu / publie vert / echoue rouge), auteur (dropdown multi-select avec avatars en mode equipe). Les filtres se combinent avec AND. Compteur de resultats affiche ("12 posts affiches sur 34"). Les filtres sont persistants dans l'URL query params pour le partage de liens.

### 3.5 Creation rapide depuis le calendrier
Clic sur un creneau vide ouvre le compose dialog pre-rempli avec la date/heure du creneau clique. En vue semaine et jour, le clic est precis a 30 minutes pres. En vue mois, le clic selectionne le jour et l'heure est celle du prochain creneau optimal. Curseur `pointer` au survol des creneaux vides. Animation de pulse sur le creneau pour confirmer la selection.

### 3.6 Vue d'ensemble multi-compte
En mode agence/multi-marque, toggle pour voir le calendrier de tous les workspaces superposes (pastilles avec initiales du workspace) ou par onglets separes. Identification visuelle par workspace (badge couleur dans le coin de chaque post). Dropdown de selection workspace en haut du calendrier. Le filtre par workspace est persistant dans la session.

### 3.7 Export du calendrier
Export du planning en CSV (colonnes : date, heure, plateforme, texte, statut, auteur, engagement), PDF (mise en page calendrier visuel avec logo du workspace), ou iCal (.ics) pour integration dans un calendrier externe. Filtre par periode et plateforme avant export. Bouton "Exporter" dans le header du calendrier. API : `GET /api/v1/social/calendar/export?format=csv&from=2026-04-01&to=2026-04-30`.

### 3.8 Creneaux recurrents
Definir des creneaux de publication recurrents ("tous les mardis et jeudis a 10h sur LinkedIn"). Interface : selecteur de jours (lundi a dimanche, checkboxes) + time picker + plateforme. Les creneaux apparaissent en fond gris clair dans le calendrier comme des "slots" vides a remplir. Les posts non assignes a un creneau sont places dans la file d'attente automatique et distribues sur le prochain slot disponible. CRUD via `POST /api/v1/social/slots`, `GET /api/v1/social/slots`, `DELETE /api/v1/social/slots/:id`.

### 3.9 Indicateur de densite
Barre de densite en haut du calendrier (vue mois) montrant le nombre de posts par jour sous forme de barres verticales. Couleur verte si 1-3 posts, orange si 4-5, rouge si >5 (sur-publication). Seuil configurable par workspace. Tooltip au survol : "Lundi 7 avril : 4 posts (2 LinkedIn, 1 Twitter, 1 Instagram)".

### 3.10 Historique de publication
Les posts publies restent visibles dans le calendrier avec un badge checkmark vert et les metriques de performance (likes, comments, shares, reach) en tooltip au survol. Clic sur un post publie ouvre un panneau de detail avec les metriques completes, le lien direct vers le post natif, et le bouton "Recycler ce post". Les posts echoues affichent un badge croix rouge avec le message d'erreur.

---

## Categorie 4 — Boite de reception unifiee (Inbox)

### 4.1 Flux unifie multi-plateforme
Tous les commentaires, mentions, DMs, reponses de toutes les plateformes dans un seul flux chronologique. Chaque element affiche : icone de plateforme, avatar de l'auteur, nom et handle, type de message (badge : "Commentaire", "DM", "Mention"), apercu du message (2 lignes max), horodatage relatif. Point bleu a gauche si non lu. Clic sur un element ouvre le panneau de detail a droite (split-view). Infinite scroll avec chargement par lots de 30. Badge compteur de non lus dans le sidebar du module. API : `GET /api/v1/social/inbox?status=unread&page=1&per_page=30`.

### 4.2 Filtres et segmentation
Barre de filtres en haut de l'inbox : plateforme (toggles icones), type (commentaire / mention / DM / review / reaction), statut (non lu / lu / archive / assigne / resolu), sentiment (positif vert / neutre gris / negatif rouge via IA), auteur (recherche par nom), date (date picker plage). Recherche full-text dans les messages avec highlight des termes trouves. Filtres combinables. Bouton "Reinitialiser les filtres". Compteur de resultats affiches. Les filtres sont refletes dans l'URL pour le partage.

### 4.3 Reponse rapide inline
Repondre directement depuis l'inbox sans ouvrir la plateforme native. Zone de texte en bas du panneau de detail avec emoji picker, mentions `@`, et compteur de caracteres (adapte a la plateforme). Preview du rendu avant envoi. Bouton "Repondre" ou `Ctrl+Enter` pour envoyer. La reponse est postee via l'API de la plateforme concernee. Confirmation toast "Reponse publiee". Erreur toast si echec avec bouton retry. L'historique de la conversation est visible au-dessus du champ de reponse. API : `POST /api/v1/social/inbox/:id/reply`.

### 4.4 Assignation en equipe
Dropdown "Assigner a" dans le panneau de detail de chaque message. Liste des membres de l'equipe avec avatar et nom. Statuts : non assigne (gris), assigne (bleu), en cours (orange), resolu (vert). Notification push et in-app au membre assigne. Vue "Mes messages assignes" dans le sidebar avec compteur. Note interne optionnelle lors de l'assignation ("Gere cette reclamation en priorite"). Historique des assignations dans le log d'activite. API : `PATCH /api/v1/social/inbox/:id/assign` avec `assigned_to` user_id.

### 4.5 Tags et categorisation
Appliquer des tags personnalises (ex: "reclamation", "lead", "partenariat", "spam", "compliment") via un selecteur multi-tag. Tags avec couleur personnalisable. Creation de nouveaux tags inline. Filtrer l'inbox par tag. Statistiques de volume par tag dans le dashboard (camembert ou barres). Utile pour identifier les tendances : "30% des messages cette semaine sont des reclamations sur le produit X". CRUD des tags : `GET /api/v1/social/tags`, `POST /api/v1/social/tags`.

### 4.6 Reponses predefinies (canned responses)
Bibliotheque de reponses types creees par l'equipe. Chaque reponse a un titre, un corps avec variables (`{{author_name}}`, `{{product_name}}`), et des tags de categorisation. Insertion en un clic ou recherche par mot-cle. Raccourci `/` dans le champ de reponse ouvre la liste des reponses predefinies. Les variables sont remplies automatiquement depuis le contexte du message (nom de l'auteur detecte). CRUD : `GET /api/v1/social/canned-responses`, `POST /api/v1/social/canned-responses`.

### 4.7 Moderation automatique
Regles de moderation configurables : masquer automatiquement les commentaires contenant des mots-cles (insultes, spam, liens suspects). Liste de mots-cles par workspace. Reponse automatique optionnelle ("Ce commentaire a ete masque pour non-respect de nos regles"). Actions disponibles : masquer, supprimer, marquer comme spam, repondre automatiquement. Log de moderation immuable pour audit avec : date, message original, regle declenchee, action executee. Configuration via `POST /api/v1/social/moderation/rules`.

### 4.8 Detection de sentiment
Badge couleur sur chaque message : vert (positif), gris (neutre), rouge (negatif). Score de sentiment (0.0 a 1.0) calcule par le service `signapps-ai`. Filtre "negatif uniquement" pour prioriser la gestion de crise. Alerte temps reel si plus de 5 messages negatifs en 1 heure (potentiel bad buzz) via PgEventBus event `social.sentiment.spike`. Dashboard de sentiment avec evolution sur 30 jours.

### 4.9 Conversation threading
Les messages lies a un meme post ou thread sont regroupes visuellement avec indentation. Vue conversation complete avec le post original en tete (texte + media + metriques). Navigation entre les messages du thread par fleches haut/bas. Nombre de messages dans le thread affiche en badge ("12 messages"). Clic "Voir sur la plateforme" ouvre le lien natif dans un nouvel onglet.

### 4.10 Notifications temps reel
Push notification et badge sur le sidebar quand un nouveau message arrive dans l'inbox. WebSocket channel `social.inbox.new` ecoute par le frontend. Son optionnel (configurable dans les preferences). Configuration granulaire par plateforme et type : DM = notification immediate, commentaire = batch digest toutes les heures, mention = immediate. PgEventBus event `social.inbox.new_message` traite par le service notifications (port 8095).

---

## Categorie 5 — Analytique et reporting

### 5.1 Dashboard analytique global
Vue consolidee avec graphiques interactifs : followers total cross-plateforme (courbe 30j avec ligne de tendance), engagement rate moyen (jauge + sparkline), reach total (barres empilees par plateforme), impressions (aire empilee), clics sur liens (barres). Comparaison periode precedente avec delta % et fleche (vert hausse, rouge baisse). Date range picker en haut : 7j, 30j, 90j, custom. Chaque graphique est cliquable pour drill-down. Export des graphiques en PNG/SVG. API : `GET /api/v1/social/analytics/overview?from=2026-03-01&to=2026-03-31`.

### 5.2 Analytique par plateforme
Onglets par plateforme connectee. Metriques specifiques par plateforme : **Twitter/X** (tweets, retweets, likes, replies, profile visits, link clicks), **Instagram** (reach, impressions, saves, stories views, reels plays, profile visits), **LinkedIn** (impressions, clicks, CTR, shares, company page followers, reactions by type), **Facebook** (reach, engagements, page views, page likes), **TikTok** (views, likes, comments, shares, profile views), **YouTube** (views, watch time, subscribers, likes). Chaque metrique affichee avec valeur absolue + delta % vs periode precedente. Graphiques specifiques par plateforme.

### 5.3 Top performing posts
Classement des posts par engagement, reach, ou clics (selecteur de tri). Periode configurable (7j/30j/90j/custom). Chaque post affiche : texte apercu (80 caracteres), media thumbnail, plateformes (icones), metriques cles (likes, comments, shares, reach), date de publication. Bouton "Recycler ce post" pour le programmer a nouveau. Bouton "Voir sur la plateforme" ouvre le lien natif. Pagination par 10. API : `GET /api/v1/social/analytics/top-posts?sort=engagement&period=30d&page=1`.

### 5.4 Evolution des hashtags
Graphique de tendance des hashtags utilises sur 30/90 jours. Axe X : temps, axe Y : engagement genere. Chaque hashtag est une ligne coloree. Tableau sous le graphique : hashtag, nombre d'utilisations, engagement moyen par post, correlation avec la performance. Indicateurs : fleche hausse/baisse vs periode precedente. Suggestions de l'IA : "Hashtag #innovation en baisse (-15%), remplacer par #tech (+42%)". API : `GET /api/v1/social/analytics/hashtags?period=90d`.

### 5.5 Suivi de la concurrence (Competitor Monitoring)
Ajouter des handles concurrents par plateforme (formulaire : plateforme + handle). Suivi automatique via scraping des donnees publiques : nombre de followers, frequence de publication, engagement moyen, croissance. Comparaison cote a cote dans un graphique multi-lignes. Tableau comparatif : une ligne par concurrent, colonnes : handle, followers, posts/semaine, engagement rate, growth 30j. Alertes configurables : "Concurrent X a depasse vos followers", "Concurrent Y a un engagement 2x superieur". Limite : 10 concurrents par workspace. API : `GET /api/v1/social/competitors`, `POST /api/v1/social/competitors`.

### 5.6 Heatmap d'engagement
Grille 7x24 (jour de la semaine x heure) montrant les creneaux ou l'audience est la plus reactive. Basee sur les 90 derniers jours du compte. Distinction par plateforme via onglets. Cellules colorees du vert fonce (meilleur engagement) au gris clair (faible activite). Clic sur une cellule affiche les posts publies dans ce creneau et leur performance. Recommandation automatique des 3 meilleurs creneaux affichee sous la heatmap.

### 5.7 Export PDF / CSV
Generation d'un rapport PDF avec : logo du workspace, periode, KPIs principaux, graphiques followers/engagement/reach, top 10 posts, recommandations IA. Mise en page professionnelle (prête pour presentation). Export CSV des donnees brutes pour analyse dans un tableur (colonnes : date, plateforme, post_id, texte, likes, comments, shares, reach, impressions). Planification d'envoi automatique : rapport hebdomadaire ou mensuel par email aux membres selectionnes. API : `GET /api/v1/social/analytics/export?format=pdf&from=2026-03-01&to=2026-03-31`.

### 5.8 Filtre Feed Posts / Stories & Reels
Toggle pour filtrer les analytiques par type de contenu : posts classiques, Stories, Reels/Shorts, Threads. Comparaison des performances par format dans un graphique a barres groupees. Recommandation IA : "Vos Reels performent 3.2x mieux que vos posts images. Augmentez la frequence de Reels de 2 a 5 par semaine."

### 5.9 Audience demographics
Repartition geographique (carte choropleth avec intensite de couleur), tranche d'age (barres horizontales), genre (camembert), langue des followers (barres). Disponible par plateforme (onglets). Utile pour cibler le ton, la langue et les horaires de publication. Donnees actualisees quotidiennement via les APIs des plateformes. API : `GET /api/v1/social/analytics/audience?platform=instagram`.

### 5.10 ROI et attribution
Si un lien est publie avec UTM tracking (genere automatiquement via le UTM builder), suivi des clics, conversions et revenus attribues. Integration avec Google Analytics via API (configuration dans les parametres). Calcul du cout par engagement si budget publicitaire renseigne. Tableau ROI : post, cout (si ads), clics, conversions, revenu attribue, ROI %. Graphique ROI cumule sur la periode. API : `GET /api/v1/social/analytics/roi?from=2026-03-01&to=2026-03-31`.

### 5.11 Analytics per-post detail
Clic sur un post dans n'importe quelle vue affiche un panneau de metriques detaillees : courbe d'engagement sur 7 jours post-publication (pic initial puis decroissance), repartition des interactions (likes vs comments vs shares vs saves), sources de trafic (organic vs paid vs viral), performance relative ("Ce post est dans le top 10% de vos publications"). Bouton "Comparer avec" pour superposer les metriques d'un autre post.

---

## Categorie 6 — Agent IA

### 6.1 Generation de contenu contextuelle
L'agent IA connait l'historique des publications (50 derniers posts), le ton de la marque (analyse automatique), les hashtags performants (top 20) et les creneaux optimaux. Il propose des posts complets (texte + hashtags + heure optimale + suggestion de media) bases sur un brief libre ou un evenement calendrier. Interface : champ de saisie "Decrivez votre post..." + bouton "Generer". Resultat : 3 cards avec texte complet, hashtags, heure suggeree. Selection par clic, edition possible. API : `POST /api/v1/social/ai/generate`.

### 6.2 Reformulation multi-ton
Soumettre un texte existant et obtenir des variations : professionnel, decontracte, inspirant, humoristique, educatif, provocateur. Chaque variation est affichee dans un card avec un label de ton et un score de qualite (1-10). Selection par clic, edition avant insertion dans le compose. Bouton "Regenerer ce ton" pour obtenir une nouvelle variation du meme style. API : `POST /api/v1/social/ai/rephrase` avec `text` et `tones[]`.

### 6.3 Traduction automatique
Traduire un post dans une ou plusieurs langues avec adaptation culturelle (pas une traduction litterale — les expressions idiomatiques sont adaptees). Langues supportees : les 20 principales (francais, anglais, espagnol, allemand, italien, portugais, neerlandais, arabe, chinois, japonais, coreen...). Preview par langue dans des onglets avec compteur de caracteres adapte a la plateforme. Publication simultanee du meme contenu en plusieurs langues sur des comptes differents. API : `POST /api/v1/social/ai/translate` avec `text`, `source_lang`, `target_langs[]`.

### 6.4 Analyse de performance et recommandations
L'IA analyse les 30 derniers jours et produit un rapport textuel actionnable structure en sections : **Ce qui marche** (formats, hashtags, horaires performants), **Ce qui ne marche pas** (formats sous-performants, horaires a eviter), **Recommandations** (3 a 5 actions concretes avec impact estime). Exemple : "Vos Reels performent 3x mieux que vos posts images. Publiez plus de Reels le mardi matin. Evitez les hashtags generiques (#motivation) au profit de niches (#techleadership)." Genere a la demande via bouton "Analyser ma performance". API : `POST /api/v1/social/ai/analyze-performance`.

### 6.5 Reponse assistee dans l'inbox
Dans l'inbox, bouton "Suggerer une reponse" sur chaque message. L'IA genere un brouillon contextuel base sur le message recu, l'historique de conversation, le ton de la marque et les reponses predefinies. Le brouillon est insere dans le champ de reponse, editable avant envoi. Trois variations proposees si le message est complexe (plainte, question technique, demande de prix). L'IA detecte la langue du message et repond dans la meme langue. Latence cible <2 secondes.

### 6.6 Detecteur de tendances
L'IA surveille les sujets tendance pertinents pour la marque (base sur les hashtags historiques, le secteur d'activite configure, et les mots-cles de monitoring). Notification quand un sujet pertinent trend : "Le hashtag #IA est en forte hausse (+300% cette semaine). Voulez-vous creer un post sur ce sujet ?" avec brouillon pre-genere. Configuration des mots-cles de monitoring dans les parametres du workspace. Frequence d'analyse : toutes les 6 heures. API : `GET /api/v1/social/ai/trends`.

### 6.7 Optimisation de texte existant
Coller un texte existant, l'IA suggere des ameliorations : concision (reduire la longueur de 20%), call-to-action (ajouter une question ou un CTA), emojis (ajouter ou retirer selon la plateforme), hooks d'accroche (reformuler la premiere phrase pour capter l'attention), questions d'engagement (ajouter une question ouverte en fin de post). Score de qualite avant/apres sur une echelle 1-100 avec decomposition par critere. API : `POST /api/v1/social/ai/optimize` avec `text` et `platform`.

### 6.8 Planning editorial automatique
A partir d'un brief mensuel ("theme avril : eco-responsabilite, 3 posts par semaine, ton inspirant"), l'IA genere un planning de 12-30 posts repartis sur le mois. Chaque post inclut : texte complet, hashtags, plateforme suggeree, creneau optimal, type de contenu (image/video/texte). Le planning est affiche dans le calendrier en mode preview (posts en pointilles). L'utilisateur peut editer chaque post individuellement, supprimer les non pertinents, ou valider le lot entier en un clic ("Programmer tout"). API : `POST /api/v1/social/ai/editorial-plan`.

---

## Categorie 7 — Mediatheque (Content Library)

### 7.1 Bibliotheque de medias centralisee
Upload, stockage et organisation d'images et videos reutilisables. Affichage en grille de vignettes (thumbnails 200x200) avec overlay au survol : nom, taille, dimensions, format, date d'upload. Recherche par nom, tag, ou contenu visuel (description IA generee automatiquement au upload). Tri par date, nom, taille, utilisation. Compteur d'utilisation par media (nombre de posts utilisant ce media). API : `GET /api/v1/social/media?q=produit&sort=date&page=1`.

### 7.2 Organisation par dossiers et tags
Creer des dossiers hierarchiques (par campagne, client, plateforme, mois). Ajouter des tags libres avec couleur. Filtrer par dossier, tag, type (image/video/GIF), date de creation, dimensions. Drag-drop pour deplacer un media entre dossiers. Breadcrumb de navigation en haut de la bibliotheque. CRUD dossiers : `POST /api/v1/social/media/folders`, `PATCH`, `DELETE`.

### 7.3 Edition d'image integree
Editeur inline ouvrant un modal au clic sur "Editer". Outils : crop (libre + ratios predefinis 1:1, 4:5, 16:9, 2:3), resize (dimensions personnalisees), rotation (90 degres + libre), filtres basiques (luminosite, contraste, saturation, noir et blanc, sepia), ajout de texte (police, taille, couleur, position), ajout de watermark (image overlay avec opacite). Preview avant/apres. Bouton "Sauvegarder une copie" (ne remplace pas l'original). Traitement via `signapps-media` (port 3009).

### 7.4 Preview par plateforme
Avant d'utiliser un media dans un post, preview du rendu sur chaque plateforme avec crop guides : Instagram 1:1 (carre), 4:5 (portrait), 16:9 (paysage), Twitter 16:9, Pinterest 2:3 (vertical), LinkedIn 1.91:1. Zones de securite (safe zones) affichees en overlay semi-transparent pour les textes et avatars qui recouvrent les bords. Bouton "Crop pour cette plateforme" qui cree une version optimisee.

### 7.5 Integration Unsplash / Pexels
Onglet "Stock photos" dans la mediatheque. Barre de recherche connectee a Unsplash et Pexels. Resultats en grille avec attribution automatique ("Photo by X on Unsplash"). Filtre par orientation (paysage/portrait/carre), couleur dominante, theme. Clic sur une photo l'ajoute a la bibliotheque locale. Pas d'appel API depuis le frontend — tout passe par le backend `signapps-social` qui proxifie les API Unsplash/Pexels.

### 7.6 Stockage via signapps-storage
Les medias sont stockes via le service `signapps-storage` (port 3004, OpenDAL FS/S3). Deduplication par hash SHA-256 (deux uploads du meme fichier ne consomment qu'un seul slot de stockage). Versionning des fichiers (historique des editions). URLs signees pour l'affichage frontend (expirent en 1 heure). Backup automatique selon la politique du workspace.

### 7.7 Limites et quotas
Affichage de l'espace utilise vs quota alloue (barre de progression : vert <70%, orange 70-90%, rouge >90%). Avertissement par notification a 80% et 95%. Purge assistee : bouton "Medias non utilises depuis X mois" qui liste les candidats a la suppression avec checkbox de selection et suppression en batch. Quota par defaut : 10 Go par workspace (configurable par l'admin). API : `GET /api/v1/social/media/quota`.

---

## Categorie 8 — Automatisation

### 8.1 Auto-posting RSS
Connecter un flux RSS (blog, actualites) via URL. Chaque nouvel article est automatiquement transforme en post social : titre comme texte, lien de l'article, image OG extraite comme media. Delai configurable entre detection et publication (0 min a 24h). Choix des plateformes cibles. Ajout de hashtags par defaut. Preview avant publication optionnel (mode semi-auto : le post est cree en brouillon et attend validation). Frequence de polling du RSS : configurable (15 min a 24h, defaut 1h). CRUD : `POST /api/v1/social/automation/rss`, `GET /api/v1/social/automation/rss`, `DELETE /api/v1/social/automation/rss/:id`.

### 8.2 Auto-Share Queue
File d'attente de partage automatique avec parametres : delai minimum entre publications (defaut 2h), inclure la description de l'article (oui/non), ajouter le lien source (oui/non, avec raccourcissement automatique), hashtags par defaut (liste configurable). Possibilite de revue avant publication (mode semi-auto : notification pour chaque nouvel article detecte). Vue de la queue avec les articles en attente, ordre de publication, et boutons d'action (publier maintenant, reporter, supprimer).

### 8.3 Evergreen Recycling
Les posts performants (engagement au-dessus d'un seuil configurable, defaut top 20%) sont automatiquement remis dans la file de publication en rotation. Intervalle minimum entre republication configurable (defaut 60 jours). Texte legerement modifie par l'IA pour eviter le duplicate content (reformulation, emojis differents, hashtags actualises). Maximum de recyclages par post configurable (defaut 3). Dashboard de recyclage : posts en rotation, prochaine republication, historique des performances par iteration.

### 8.4 Regles conditionnelles (IF/THEN)
Creer des regles d'automatisation visuelles : interface avec bloc IF (declencheur + condition) et bloc THEN (action). Declencheurs : nouveau commentaire, nouveau DM, post publie, post atteint X likes, mention detectee. Conditions : contient mot-cle, sentiment negatif, plateforme specifique, heure de la journee. Actions : notifier l'equipe, assigner au community manager, masquer le commentaire, repondre automatiquement, creer une tache. Regles combinables avec AND/OR. Log d'execution de chaque regle. CRUD : `POST /api/v1/social/automation/rules`.

### 8.5 Publication multi-fuseaux
Programmer un meme post pour publication a des heures differentes par region (ex: 10h Paris, 10h New York, 10h Tokyo). Interface : ajouter des fuseaux horaires cibles, le systeme calcule les heures UTC et cree des posts programmes distincts. Preview du planning par fuseau horaire. Le contenu peut etre adapte par region (traduction ou variation). Utile pour les marques internationales.

### 8.6 Auto-delete programme
Programmer la suppression automatique d'un post apres une duree (ex: 24h pour une promo flash, 7j pour un evenement termine). Checkbox "Supprimer apres" dans le compose avec duree configurable. Notification 1h avant suppression. Possibilite d'annuler la suppression programmee. Le post est supprime via l'API de la plateforme (si supportee) et marque comme "supprime" dans la base locale.

### 8.7 Webhook et evenements
Declencher un webhook externe a chaque evenement : publication reussie, publication echouee, nouveau message inbox, milestone atteint. Configuration : URL du webhook, evenements a ecouter, secret pour la signature HMAC des payloads. Format du payload JSON : `{event, timestamp, data}`. Retry 3 fois avec backoff exponentiel si le webhook retourne une erreur. CRUD : `POST /api/v1/social/webhooks`.

### 8.8 Integration PgEventBus
Les evenements de publication sont emis sur le PgEventBus interne de SignApps. Evenements : `social.post.published` (post_id, platform, status), `social.post.failed` (post_id, platform, error), `social.post.scheduled` (post_id, scheduled_at), `social.inbox.new_message` (message_id, platform, type, sentiment), `social.account.disconnected` (account_id, platform, reason), `social.metrics.updated` (account_id, metrics). D'autres modules (notifications, CRM, chat, dashboard) peuvent ecouter et reagir a ces evenements. Aucun appel HTTP direct entre services.

---

## Categorie 9 — Templates

### 9.1 Bibliotheque de templates
Collection de modeles de posts reutilisables, classes par categorie (promo, annonce, question, citation, temoignage, behind-the-scenes, evenement, recrutement, produit). Preview avec placeholder en texte gris italique. Clic pour utiliser dans le compose : le template est copie et les placeholders sont surliges en jaune pour indiquer les champs a remplir. Filtre par categorie et recherche par nom. Compteur d'utilisation par template. API : `GET /api/v1/social/templates?category=promo`.

### 9.2 Variables dynamiques
Templates avec placeholders : `{{product_name}}`, `{{price}}`, `{{event_date}}`, `{{link}}`, `{{company_name}}`, `{{author_name}}`. Remplissage lors de l'utilisation via un formulaire dynamique genere a partir des variables detectees. Preview en temps reel avec les valeurs renseignees. Valeurs par defaut configurables. Variables custom creables par l'equipe.

### 9.3 Templates par plateforme
Un meme template peut avoir des variantes par plateforme (texte long pour LinkedIn, court pour Twitter, avec emojis pour Instagram, hashtags pour tous). Selection automatique de la variante lors du choix des plateformes cibles dans le compose. Preview cote a cote des variantes. Fallback au texte principal si aucune variante n'existe pour une plateforme.

### 9.4 Templates d'equipe
Templates partages au niveau du workspace. Permissions : creer (editeurs+), editer (editeurs+), utiliser (contributeurs+), supprimer (admins). Verrouillage des templates valides : seuls les admins peuvent modifier un template marque comme "approuve". Historique des modifications (qui, quand, quoi). Templates epingles en haut de la liste.

### 9.5 Import/Export de templates
Export de tous les templates ou d'une selection en JSON pour backup ou partage entre workspaces. Import avec detection de conflits (meme nom : options renommer, remplacer, ignorer). Import depuis un fichier JSON glisse dans la zone de drop. Validation du format avant import. API : `POST /api/v1/social/templates/import`, `GET /api/v1/social/templates/export`.

---

## Categorie 10 — Gestion des comptes et OAuth

### 10.1 Connexion OAuth multi-plateforme
Connecter des comptes via OAuth 2.0 pour chaque plateforme : Twitter/X (OAuth 2.0 PKCE), Facebook pages et groupes (Facebook Login), Instagram Business (via Facebook), LinkedIn profil et page (LinkedIn OAuth 2.0), TikTok (TikTok Login Kit), YouTube (Google OAuth 2.0), Pinterest (Pinterest OAuth 2.0), Threads (Meta OAuth), Mastodon (OAuth 2.0, instance configurable via URL), Bluesky (identifiant AT Protocol, authentification par app password). Workflow : bouton "Connecter" par plateforme -> redirection vers la plateforme -> autorisation -> callback vers SignApps -> stockage du token chiffre. Scopes demandes : publication, lecture inbox, analytics.

### 10.2 Statut de connexion
Dashboard des comptes connectes (`/social/accounts`) avec statut en temps reel : connecte (badge vert), token expirant bientot <24h (badge orange), token expire (badge rouge), erreur API (badge rouge avec message). Bouton "Reconnecter" pour les comptes en erreur. Date de derniere activite (dernier post publie, dernier inbox sync). Date d'expiration du token affichee. Notification automatique 48h avant expiration du token si le refresh automatique echoue.

### 10.3 Multi-profils par plateforme
Connecter plusieurs comptes sur une meme plateforme (ex: page Facebook marque + page Facebook produit, profil LinkedIn perso + page entreprise). Selection du profil lors de la composition via dropdown dans la barre de plateformes. Chaque profil a son propre jeu de metriques et son propre historique. Limite configurable de comptes par plateforme (defaut 5).

### 10.4 Permissions granulaires par compte
Par compte connecte, definir les permissions de chaque membre de l'equipe. Matrice : lignes = membres, colonnes = actions (publier, programmer, brouillon, repondre inbox, voir analytics, gerer le compte). Roles predefinis : admin (tout), editeur (publier + programmer + repondre), contributeur (brouillon seulement), viewer (analytics en lecture seule). Modifiable par l'admin du workspace.

### 10.5 Rotation de tokens
Refresh automatique des tokens OAuth avant expiration via un job cron qui verifie les tokens expirant dans les 24h. Le refresh est tente 3 fois avec backoff exponentiel. Si le refresh echoue (changement de mot de passe cote plateforme, revocation manuelle), notification push et email a l'utilisateur avec bouton "Reconnecter". Historique des connexions/deconnexions/refreshs dans le log d'audit. Tokens stockes chiffres en AES-256 dans PostgreSQL.

### 10.6 Groupes de comptes
Creer des groupes de comptes (ex: "Tous les comptes France", "Produit X", "Campagne ete"). Ajouter/retirer des comptes dans un groupe. Publier vers un groupe en un clic au lieu de selectionner chaque compte individuellement. Les groupes apparaissent comme des options dans le selecteur de plateformes du compose. CRUD : `POST /api/v1/social/account-groups`, `PATCH`, `DELETE`.

### 10.7 Deconnexion et nettoyage
Deconnecter un compte revoque le token OAuth via l'API de la plateforme et supprime le token local. Modale de confirmation avec options : "Conserver l'historique des posts et analytics" ou "Tout purger (posts, analytics, inbox)". Si l'historique est conserve, les posts sont marques comme "compte deconnecte" et restent consultables en lecture seule. API : `DELETE /api/v1/social/accounts/:id?purge=false`.

---

## Categorie 11 — Collaboration et workflow d'equipe

### 11.1 Workflow d'approbation
Pipeline configurable par workspace : Brouillon -> Revue -> Approuve -> Programme -> Publie. Chaque transition declenche une notification au role concerne. Nombre de niveaux configurable (simple : Brouillon -> Approuve, ou multi-niveaux : Brouillon -> Revue editeur -> Revue manager -> Approuve). Commentaires internes obligatoires lors du rejet (raison du rejet). Boutons d'action dans la vue du post : "Soumettre pour revue", "Approuver", "Rejeter", "Demander des modifications". Indicateur visuel du statut dans le calendrier et la liste des posts (badges couleur). API : `PATCH /api/v1/social/posts/:id/workflow` avec `action` (submit/approve/reject/request_changes).

### 11.2 Roles et permissions
Cinq roles : **Admin** (tout : comptes, parametres, suppression, workflow), **Manager** (approuver, publier, analytics, gestion d'equipe), **Editeur** (creer, editer, programmer, repondre inbox), **Contributeur** (proposer, brouillons seulement, pas de publication directe), **Viewer** (lecture analytics, calendrier en lecture seule). Configuration par workspace. Un utilisateur peut avoir des roles differents par workspace. Matrice de permissions visible dans les parametres admin.

### 11.3 Commentaires internes
Annoter un post en cours de redaction avec des commentaires visibles uniquement par l'equipe (jamais publies). Thread de discussion par post avec avatar, nom, horodatage. Mentions `@membre` avec notification push. Markdown basique supporte (gras, italique, liens). Compteur de commentaires affiche sur le post dans le calendrier. Resolvable individuellement. API : `POST /api/v1/social/posts/:id/comments`.

### 11.4 Historique d'activite
Log immuable de toutes les actions par membre : qui a cree, edite, approuve, rejete, publie, supprime chaque post. Filtrable par date, membre, action, post. Non modifiable (audit trail). Exportable en CSV pour conformite. Affichage dans un panneau lateral du post ou dans une page dediee `/social/activity-log`. API : `GET /api/v1/social/activity-log?page=1&member=user_id&action=published`.

### 11.5 Calendrier partage
Le calendrier de publication est visible par toute l'equipe selon les permissions. Chacun voit les posts des autres (filtrable par auteur). Evite les doublons et conflits de planning. Badge avec initiales de l'auteur sur chaque post dans le calendrier. Mode "Mon calendrier" pour ne voir que ses propres posts.

### 11.6 Notes et briefings internes
Attacher des notes internes a un post (brief creatif, objectifs de campagne, liens de reference, inspirations) ou a une journee du calendrier (context du jour, evenements marketing). Visible par l'equipe, jamais inclus dans la publication. Markdown supporte. Pièces jointes possibles (images de reference, documents). API : `POST /api/v1/social/posts/:id/notes` et `POST /api/v1/social/calendar/:date/notes`.

---

## Categorie 12 — Configuration et parametres

### 12.1 Parametres generaux du module
Page `/social/settings` avec sections : fuseau horaire par defaut (dropdown avec recherche), langue de l'interface, preferences de notifications (email, push, in-app pour chaque type d'evenement), theme sombre/clair (herite du theme global SignApps). Sauvegarde automatique des modifications. API : `GET /api/v1/social/settings`, `PATCH /api/v1/social/settings`.

### 12.2 Limites de publication
Definir des garde-fous par workspace : nombre max de posts par jour par plateforme (defaut : respecte les limites API de chaque plateforme), intervalle minimum entre deux posts sur la meme plateforme (defaut 1h), plages horaires autorisees (ex: 8h-22h). Empeche la sur-publication et protege des erreurs de bulk scheduling. Warning affiche dans le compose si une limite est atteinte. API : `GET /api/v1/social/settings/limits`, `PATCH /api/v1/social/settings/limits`.

### 12.3 Link shortener integre
URLs dans les posts raccourcies automatiquement avec un domaine personnalise (ex: `sign.link/abc`). Tracking des clics par lien avec analytics : nombre de clics, pays d'origine, device, referrer. Integration avec le service `signapps-securelink` (port 3006). Configuration : activer/desactiver, domaine personnalise, expiration des liens. Dashboard des liens raccourcis avec metriques.

### 12.4 UTM builder
Ajout automatique de parametres UTM aux liens dans les posts : source (plateforme), medium ("social"), campaign (configurable), content (post_id). Templates UTM reutilisables (creer un template "Campagne ete 2026" et l'appliquer a tous les posts de la campagne). Preview de l'URL finale avant publication. Les UTM sont ajoutes automatiquement si un template par defaut est configure. API : `GET /api/v1/social/settings/utm-templates`, `POST /api/v1/social/settings/utm-templates`.

### 12.5 Export/Import de donnees
Export complet de toutes les donnees du module (posts, analytics, comptes metadata sans tokens, templates, regles d'automatisation) en JSON ou CSV. Import pour migration depuis un autre outil (Hootsuite, Buffer, etc.) via upload de fichier JSON. Mapping des champs a l'import. API : `GET /api/v1/social/export?format=json`, `POST /api/v1/social/import`.

### 12.6 API REST documentee
Endpoints documentes avec `utoipa` et Swagger UI sur `/swagger-ui/` du service `signapps-social` (port 3019). Authentification JWT requise sur toutes les routes. Rate limiting : 100 requetes/minute par utilisateur. Pagination standard : `page`, `per_page`, `total` dans les headers. Format de reponse JSON avec envelope `{data, meta, errors}`.

### 12.7 Webhooks entrants
Recevoir des declencheurs externes pour publier un post (ex: nouveau commit GitHub -> tweet automatique, nouvelle vente -> post de celebration, nouveau blog -> partage social). Configuration : URL du webhook entrant (generee par SignApps), mapping du payload JSON vers les champs du post, plateformes cibles, mode (auto-publish ou brouillon). Secret partage pour authentification HMAC. API : `POST /api/v1/social/webhooks/inbound`.

### 12.8 Configuration des reponses automatiques
Definir des reponses automatiques par plateforme et par type : message de bienvenue pour les nouveaux followers (si la plateforme le supporte), reponse hors heures d'ouverture (configurer les heures de bureau), accuse de reception des DMs ("Merci pour votre message, nous revenons vers vous sous 24h"). Chaque reponse est un template avec variables. Activation/desactivation individuelle. Log des reponses automatiques envoyees.

---

## Schema PostgreSQL

```sql
-- Table principale des comptes sociaux connectes
CREATE TABLE social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    platform VARCHAR(32) NOT NULL, -- twitter, facebook, instagram, linkedin, tiktok, youtube, pinterest, threads, mastodon, bluesky
    platform_account_id VARCHAR(255) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_handle VARCHAR(255),
    avatar_url TEXT,
    access_token_encrypted BYTEA NOT NULL,
    refresh_token_encrypted BYTEA,
    token_expires_at TIMESTAMPTZ,
    scopes TEXT[], -- permissions granted
    status VARCHAR(32) NOT NULL DEFAULT 'connected', -- connected, expired, error
    last_synced_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, platform, platform_account_id)
);

-- Posts (brouillons, programmes, publies)
CREATE TABLE social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    author_id UUID NOT NULL REFERENCES users(id),
    text_content TEXT NOT NULL DEFAULT '',
    platform_overrides JSONB DEFAULT '{}', -- {twitter: "short text", linkedin: "long text"}
    hashtags TEXT[] DEFAULT '{}',
    media_ids UUID[] DEFAULT '{}', -- references to social_media
    first_comment TEXT,
    first_comment_delay_seconds INT DEFAULT 10,
    geolocation JSONB, -- {name, lat, lng}
    tagged_accounts TEXT[] DEFAULT '{}',
    status VARCHAR(32) NOT NULL DEFAULT 'draft', -- draft, pending_review, approved, scheduled, publishing, published, failed
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    workflow_status VARCHAR(32) DEFAULT 'draft', -- draft, pending_review, changes_requested, approved, rejected
    ab_test_group_id UUID, -- null if not A/B test
    post_type VARCHAR(32) DEFAULT 'post', -- post, thread, carousel, story, reel
    auto_delete_at TIMESTAMPTZ,
    retry_count INT DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_social_posts_workspace_status ON social_posts(workspace_id, status);
CREATE INDEX idx_social_posts_scheduled ON social_posts(scheduled_at) WHERE status = 'scheduled';

-- Liaison post <-> comptes cibles
CREATE TABLE social_post_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES social_accounts(id),
    platform_post_id VARCHAR(255), -- ID on the platform after publishing
    platform_post_url TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, publishing, published, failed
    error_message TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_post_targets_post ON social_post_targets(post_id);

-- Medias de la mediatheque
CREATE TABLE social_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    folder_id UUID REFERENCES social_media_folders(id),
    storage_key TEXT NOT NULL, -- reference in signapps-storage
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    width INT,
    height INT,
    duration_seconds FLOAT, -- for videos
    alt_text TEXT,
    tags TEXT[] DEFAULT '{}',
    ai_description TEXT, -- auto-generated by AI
    sha256_hash VARCHAR(64) NOT NULL,
    usage_count INT DEFAULT 0,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, sha256_hash) -- deduplication
);

-- Dossiers de la mediatheque
CREATE TABLE social_media_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    parent_id UUID REFERENCES social_media_folders(id),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inbox (messages entrants)
CREATE TABLE social_inbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    account_id UUID NOT NULL REFERENCES social_accounts(id),
    platform VARCHAR(32) NOT NULL,
    message_type VARCHAR(32) NOT NULL, -- comment, dm, mention, review, reaction
    platform_message_id VARCHAR(255) NOT NULL,
    parent_post_id UUID REFERENCES social_posts(id), -- null for DMs
    author_name VARCHAR(255),
    author_handle VARCHAR(255),
    author_avatar_url TEXT,
    content TEXT NOT NULL,
    sentiment VARCHAR(16), -- positive, neutral, negative
    sentiment_score FLOAT,
    status VARCHAR(32) NOT NULL DEFAULT 'unread', -- unread, read, archived, resolved
    assigned_to UUID REFERENCES users(id),
    tags TEXT[] DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    received_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, platform, platform_message_id)
);
CREATE INDEX idx_inbox_workspace_status ON social_inbox(workspace_id, status);
CREATE INDEX idx_inbox_assigned ON social_inbox(assigned_to) WHERE assigned_to IS NOT NULL;

-- Analytics par post
CREATE TABLE social_post_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_target_id UUID NOT NULL REFERENCES social_post_targets(id),
    likes INT DEFAULT 0,
    comments INT DEFAULT 0,
    shares INT DEFAULT 0,
    saves INT DEFAULT 0,
    reach INT DEFAULT 0,
    impressions INT DEFAULT 0,
    clicks INT DEFAULT 0,
    engagement_rate FLOAT DEFAULT 0.0,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_post_metrics_target ON social_post_metrics(post_target_id);

-- Analytics par compte (snapshots periodiques)
CREATE TABLE social_account_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES social_accounts(id),
    followers INT DEFAULT 0,
    following INT DEFAULT 0,
    posts_count INT DEFAULT 0,
    avg_engagement_rate FLOAT DEFAULT 0.0,
    reach_30d INT DEFAULT 0,
    impressions_30d INT DEFAULT 0,
    snapshot_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(account_id, snapshot_date)
);

-- Templates de posts
CREATE TABLE social_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(64), -- promo, annonce, question, citation, temoignage, etc.
    text_content TEXT NOT NULL,
    platform_variants JSONB DEFAULT '{}',
    variables TEXT[] DEFAULT '{}', -- detected {{variable_name}} list
    is_approved BOOLEAN DEFAULT FALSE,
    usage_count INT DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Creneaux recurrents
CREATE TABLE social_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    account_id UUID REFERENCES social_accounts(id), -- null = all accounts
    day_of_week INT NOT NULL, -- 0=monday, 6=sunday
    time_utc TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Regles d'automatisation
CREATE TABLE social_automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    name VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(64) NOT NULL, -- new_comment, new_dm, post_published, engagement_threshold, mention
    conditions JSONB NOT NULL, -- {keyword: "prix", sentiment: "negative", platform: "instagram"}
    actions JSONB NOT NULL, -- [{type: "notify", target: "user_id"}, {type: "auto_reply", template_id: "..."}]
    is_active BOOLEAN DEFAULT TRUE,
    execution_count INT DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Flux RSS pour auto-posting
CREATE TABLE social_rss_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    feed_url TEXT NOT NULL,
    name VARCHAR(255),
    target_accounts UUID[] DEFAULT '{}',
    default_hashtags TEXT[] DEFAULT '{}',
    auto_publish BOOLEAN DEFAULT FALSE, -- false = create as draft
    poll_interval_minutes INT DEFAULT 60,
    last_polled_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Concurrents suivis
CREATE TABLE social_competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    platform VARCHAR(32) NOT NULL,
    handle VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, platform, handle)
);

-- Metriques concurrents (snapshots)
CREATE TABLE social_competitor_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID NOT NULL REFERENCES social_competitors(id),
    followers INT DEFAULT 0,
    posts_count INT DEFAULT 0,
    avg_engagement_rate FLOAT DEFAULT 0.0,
    snapshot_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(competitor_id, snapshot_date)
);

-- Groupes de comptes
CREATE TABLE social_account_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    name VARCHAR(255) NOT NULL,
    account_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Commentaires internes sur les posts
CREATE TABLE social_post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reponses predefinies
CREATE TABLE social_canned_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    usage_count INT DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Regles de moderation
CREATE TABLE social_moderation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    keywords TEXT[] NOT NULL,
    action VARCHAR(32) NOT NULL, -- hide, delete, spam, auto_reply
    auto_reply_template TEXT,
    platforms TEXT[] DEFAULT '{}', -- empty = all platforms
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhooks sortants
CREATE TABLE social_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    url TEXT NOT NULL,
    events TEXT[] NOT NULL, -- post.published, post.failed, inbox.new_message, etc.
    secret VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Log d'audit
CREATE TABLE social_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(64) NOT NULL, -- created, edited, approved, rejected, published, deleted
    entity_type VARCHAR(32) NOT NULL, -- post, account, template, rule
    entity_id UUID NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_workspace_date ON social_audit_log(workspace_id, created_at DESC);
```

---

## REST API Endpoints

All endpoints require JWT authentication. Base path: `signapps-social` service, port 3019.

### Dashboard & KPIs
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/social/dashboard/kpis` | Aggregated KPIs (followers, posts, engagement, inbox count) |
| GET | `/api/v1/social/activity?page=&per_page=&platform=&type=` | Recent activity feed |
| GET | `/api/v1/social/analytics/best-times?platform=&days=` | Best time to post heatmap data |

### Posts & Compose
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/social/posts` | Create post (draft, schedule, or publish now) |
| GET | `/api/v1/social/posts?status=&platform=&page=` | List posts with filters |
| GET | `/api/v1/social/posts/:id` | Get post detail |
| PATCH | `/api/v1/social/posts/:id` | Update post (reschedule, edit text) |
| DELETE | `/api/v1/social/posts/:id` | Delete post |
| POST | `/api/v1/social/posts/:id/retry` | Retry failed publication |
| PATCH | `/api/v1/social/posts/:id/workflow` | Workflow action (submit/approve/reject) |
| POST | `/api/v1/social/posts/bulk` | Bulk create from CSV/XLSX |
| POST | `/api/v1/social/posts/ab-test` | Create A/B test post group |

### Drafts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/social/drafts` | List drafts |
| POST | `/api/v1/social/drafts` | Create draft |
| PATCH | `/api/v1/social/drafts/:id` | Update draft (auto-save) |
| DELETE | `/api/v1/social/drafts/:id` | Delete draft |

### Calendar
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/social/calendar?view=&from=&to=&platform=` | Calendar data |
| GET | `/api/v1/social/calendar/export?format=&from=&to=` | Export calendar (CSV/PDF/iCal) |

### Inbox
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/social/inbox?status=&platform=&type=&sentiment=&page=` | List inbox messages |
| GET | `/api/v1/social/inbox/:id` | Get message detail with conversation |
| PATCH | `/api/v1/social/inbox/:id/read` | Mark as read |
| POST | `/api/v1/social/inbox/read-all` | Mark all as read (filtered) |
| PATCH | `/api/v1/social/inbox/:id/assign` | Assign to team member |
| POST | `/api/v1/social/inbox/:id/reply` | Reply to message |
| PATCH | `/api/v1/social/inbox/:id/archive` | Archive message |
| PATCH | `/api/v1/social/inbox/:id/tags` | Update tags |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/social/analytics/overview?from=&to=` | Global analytics dashboard |
| GET | `/api/v1/social/analytics/platform/:platform?from=&to=` | Per-platform analytics |
| GET | `/api/v1/social/analytics/top-posts?sort=&period=&page=` | Top performing posts |
| GET | `/api/v1/social/analytics/hashtags?period=` | Hashtag evolution |
| GET | `/api/v1/social/analytics/audience?platform=` | Audience demographics |
| GET | `/api/v1/social/analytics/roi?from=&to=` | ROI and attribution |
| GET | `/api/v1/social/analytics/export?format=&from=&to=` | Export report (PDF/CSV) |

### Accounts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/social/accounts` | List connected accounts |
| POST | `/api/v1/social/accounts/connect/:platform` | Initiate OAuth flow |
| GET | `/api/v1/social/accounts/callback/:platform` | OAuth callback |
| DELETE | `/api/v1/social/accounts/:id?purge=` | Disconnect account |
| GET | `/api/v1/social/accounts/performance` | Per-account performance summary |
| POST | `/api/v1/social/account-groups` | Create account group |
| GET | `/api/v1/social/account-groups` | List account groups |
| DELETE | `/api/v1/social/account-groups/:id` | Delete account group |

### Media Library
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/social/media?q=&folder=&tag=&type=&sort=&page=` | List media |
| POST | `/api/v1/social/media/upload` | Upload media (multipart) |
| DELETE | `/api/v1/social/media/:id` | Delete media |
| PATCH | `/api/v1/social/media/:id` | Update metadata (tags, alt text) |
| GET | `/api/v1/social/media/quota` | Storage quota info |
| POST | `/api/v1/social/media/folders` | Create folder |
| GET | `/api/v1/social/media/stock?q=&source=&orientation=` | Search Unsplash/Pexels |

### AI
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/social/ai/generate` | Generate post from brief |
| POST | `/api/v1/social/ai/rephrase` | Rephrase with tone variations |
| POST | `/api/v1/social/ai/hashtags` | Suggest hashtags for text |
| POST | `/api/v1/social/ai/translate` | Translate post |
| POST | `/api/v1/social/ai/optimize` | Optimize existing text |
| POST | `/api/v1/social/ai/analyze-performance` | Performance analysis report |
| POST | `/api/v1/social/ai/editorial-plan` | Generate editorial plan |
| GET | `/api/v1/social/ai/trends` | Trending topics |

### Automation
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/social/automation/rules` | Create automation rule |
| GET | `/api/v1/social/automation/rules` | List rules |
| PATCH | `/api/v1/social/automation/rules/:id` | Update rule |
| DELETE | `/api/v1/social/automation/rules/:id` | Delete rule |
| POST | `/api/v1/social/automation/rss` | Add RSS feed |
| GET | `/api/v1/social/automation/rss` | List RSS feeds |
| DELETE | `/api/v1/social/automation/rss/:id` | Remove RSS feed |

### Templates
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/social/templates?category=` | List templates |
| POST | `/api/v1/social/templates` | Create template |
| PATCH | `/api/v1/social/templates/:id` | Update template |
| DELETE | `/api/v1/social/templates/:id` | Delete template |
| POST | `/api/v1/social/templates/import` | Import templates (JSON) |
| GET | `/api/v1/social/templates/export` | Export templates (JSON) |

### Settings
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/social/settings` | Get workspace settings |
| PATCH | `/api/v1/social/settings` | Update settings |
| GET | `/api/v1/social/settings/limits` | Publication limits |
| PATCH | `/api/v1/social/settings/limits` | Update limits |

### Moderation & Canned Responses
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/social/moderation/rules` | Create moderation rule |
| GET | `/api/v1/social/moderation/rules` | List rules |
| GET | `/api/v1/social/canned-responses` | List canned responses |
| POST | `/api/v1/social/canned-responses` | Create canned response |

### Webhooks
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/social/webhooks` | Create outbound webhook |
| GET | `/api/v1/social/webhooks` | List webhooks |
| DELETE | `/api/v1/social/webhooks/:id` | Delete webhook |
| POST | `/api/v1/social/webhooks/inbound` | Inbound webhook receiver |

### Competitors
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/social/competitors` | List competitors |
| POST | `/api/v1/social/competitors` | Add competitor |
| DELETE | `/api/v1/social/competitors/:id` | Remove competitor |

### Slots
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/social/slots` | List recurring slots |
| POST | `/api/v1/social/slots` | Create slot |
| DELETE | `/api/v1/social/slots/:id` | Delete slot |

### Tags
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/social/tags` | List tags |
| POST | `/api/v1/social/tags` | Create tag |

---

## PgEventBus Events

| Event | Payload | Consumers |
|-------|---------|-----------|
| `social.post.published` | `{post_id, platform, account_id, platform_post_url}` | notifications, dashboard, analytics |
| `social.post.failed` | `{post_id, platform, account_id, error}` | notifications, dashboard |
| `social.post.scheduled` | `{post_id, scheduled_at, platforms[]}` | calendar, dashboard |
| `social.inbox.new_message` | `{message_id, platform, type, sentiment, author}` | notifications, dashboard |
| `social.account.disconnected` | `{account_id, platform, reason}` | notifications, dashboard |
| `social.account.token_expiring` | `{account_id, platform, expires_at}` | notifications |
| `social.metrics.updated` | `{account_id, platform, followers, engagement_rate}` | dashboard, analytics |
| `social.sentiment.spike` | `{workspace_id, platform, negative_count, timeframe}` | notifications (alert) |
| `social.competitor.milestone` | `{competitor_id, metric, old_value, new_value}` | notifications |

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Hootsuite Blog & Academy** (blog.hootsuite.com, education.hootsuite.com) — tutoriels SMM, certifications, best practices par plateforme, rapports annuels tendances social media.
- **Buffer Blog & Resources** (buffer.com/resources) — guides de strategie par plateforme, etudes de cas, State of Social reports, calculateurs d'engagement.
- **Sprout Social Insights** (sproutsocial.com/insights) — articles approfondis sur le social listening, benchmarks d'industrie, templates de reporting.
- **Later Blog** (later.com/blog) — guides Instagram-first, strategies Reels, bonnes pratiques visual planning, etudes hashtags.
- **Metricool Blog** (metricool.com/blog) — tutoriels analytics, guides ads, comparatifs d'outils, templates de calendrier editorial.
- **Social Media Examiner** (socialmediaexaminer.com) — reference de l'industrie, podcasts, conference annuelle, guides debutants a avances.
- **Documentation API des plateformes** — Twitter API v2 (developer.twitter.com), Facebook Graph API (developers.facebook.com), Instagram Graph API, LinkedIn Marketing API, TikTok Developer Portal, YouTube Data API, Pinterest API, Mastodon API, AT Protocol (Bluesky).

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Mixpost** (github.com/inovector/mixpost) | **MIT** | Architecture Laravel d'un outil SMM self-hosted. Pattern multi-plateforme, scheduling, analytics. Reference principale pour l'architecture modulaire. |
| **Postiz** (github.com/gitroomhq/postiz-app) | **Apache-2.0** | Social scheduling open source. Pattern calendar, compose multi-plateforme, AI integration. |
| **Socioboard** (github.com/nickatnight/tag-youre-it-backend) | **Apache-2.0** | Backend Python pour social media. Pattern API abstraction layer, queue management. |
| **node-twitter-api-v2** (github.com/PLhery/node-twitter-api-v2) | **Apache-2.0** | Client Twitter API v2 en TypeScript. Pattern OAuth 2.0 PKCE, rate limiting, pagination. |
| **instagram-private-api** | **MIT** | Pattern pour les interactions Instagram. Attention : API non-officielle, a ne pas utiliser en production mais utile comme reference d'architecture. |
| **bull** / **bullmq** (github.com/taskforcesh/bullmq) | **MIT** | Queue de jobs Redis-based. Pattern retry, backoff, rate limiting, priorites. Inspiration pour notre queue PostgreSQL-based. |
| **date-fns** (github.com/date-fns/date-fns) | **MIT** | Manipulation de dates/fuseaux horaires pour la planification cross-timezone. Deja utilise dans SignApps. |
| **rrule.js** (github.com/jakubroztocil/rrule) | **MIT** (verifier) | Recurrence rules RFC 5545. Pattern pour les creneaux recurrents de publication. |
| **sharp** (github.com/lovell/sharp) | **Apache-2.0** | Traitement d'image haute performance (resize, crop, watermark). Pattern pour la mediatheque. |
| **react-big-calendar** (github.com/jquense/react-big-calendar) | **MIT** | Composant calendrier React (Month/Week/Day/Agenda). Pattern pour le calendrier de publication. |
| **recharts** (github.com/recharts/recharts) | **MIT** | Graphiques React declaratifs. Pattern pour les dashboards analytiques. |
| **Chart.js** (github.com/chartjs/Chart.js) | **MIT** | Graphiques canvas. Alternative pour les visualisations de metriques. |
| **tiptap** (github.com/ueberdosis/tiptap) | **MIT** | Editeur rich text. Deja utilise dans SignApps pour le compose. |
| **mastodon-api** (github.com/mastodon/mastodon) | **AGPL-3.0** | **INTERDIT** (AGPL). Ne pas copier le code. Etudier uniquement la documentation API publique et les specs ActivityPub. |
| **elk** (github.com/elk-zone/elk) | **MIT** | Client Mastodon web. Pattern pour l'integration ActivityPub/Mastodon. |
| **megalodon** (github.com/h3poteto/megalodon) | **MIT** | Client TypeScript pour Mastodon/Pleroma/Misskey. Pattern d'abstraction multi-instance. |

### Pattern d'implementation recommande
1. **Trait `SocialPlatform`** : chaque plateforme implemente un trait Rust avec les methodes `publish()`, `delete()`, `get_metrics()`, `get_inbox()`, `reply()`, `get_profile()`. Toute la logique specifique est encapsulee dans l'adaptateur.
2. **Queue de publication** : table PostgreSQL `social_posts` avec statut (draft/scheduled/publishing/published/failed). Worker async tokio consomme les posts dont `scheduled_at <= now()` et `status = scheduled`. Backoff exponentiel (1s, 5s, 30s, 5min, 30min). Max 5 retries.
3. **OAuth token management** : stockage chiffre (AES-256) des tokens dans `social_accounts`. Refresh automatique via job cron avant expiration. Notification utilisateur si refresh impossible.
4. **Analytics aggregation** : job cron toutes les heures qui interroge les APIs des plateformes et stocke les metriques dans `social_post_metrics` et `social_account_metrics`. Vues materialisees pour les dashboards. Pas de call API a chaque chargement de page.
5. **Inbox polling** : polling periodique (configurable, defaut 5min) des commentaires/DMs via les APIs. Stockage local avec deduplication par `platform_message_id`. WebSocket + PgEventBus pour push temps reel vers le frontend.
6. **Media processing** : upload vers `signapps-storage`, traitement via `signapps-media` (resize, thumbnails, extraction metadata). URLs signees pour l'affichage frontend.
7. **IA** : appels au service `signapps-ai` (port 3005) pour la generation de texte, suggestions de hashtags, analyse de sentiment. Modeles locaux par defaut, fallback cloud configurable.
8. **Evenements inter-services** : PgEventBus pour tous les evenements `social.*`. Le module notifications ecoute ces evenements.

### Ce qu'il ne faut PAS faire
- **Pas d'appels directs aux APIs sociales depuis le frontend** — tout passe par le backend `signapps-social` qui gere l'authentification, le rate limiting et le retry.
- **Pas de stockage de tokens OAuth en clair** — toujours chiffre avec la cle de l'environnement.
- **Pas de scraping** des plateformes sociales — utiliser uniquement les APIs officielles documentees.
- **Pas de copier-coller** depuis les projets open source, meme MIT. On s'inspire des patterns, on reecrit.
- **Pas d'ajout de Mastodon server code** (AGPL) ni aucun fork GPL — meme comme dependance transitive.
- **Pas de publication automatique sans validation humaine** par defaut — le mode full-auto est une option explicite dans Automation, desactivee par defaut.
- **Pas de rate limiting naif** — respecter les limites de chaque API plateforme (ex: Twitter 300 tweets/3h, LinkedIn 100 posts/jour) avec compteur par compte.
- **Pas de metriques en temps reel** via polling agressif — agreger par batch toutes les heures, cache les dashboards.
- **Respect strict** de la politique de licences (voir `deny.toml` et `memory/feedback_license_policy.md`).

---

## Assertions E2E cles (a tester)

- Dashboard affiche les 4 KPIs avec donnees reelles des comptes connectes
- Compose : rediger un post, selectionner 3 plateformes, preview adapte par plateforme
- Compose : upload d'image drag-drop avec preview thumbnail
- Compose : assistance IA genere 3 variations de texte
- Compose : suggestions de hashtags avec indicateurs de popularite
- Publish Now : publication sur une plateforme et statut "publie" confirme
- Schedule : programmer un post a une date future, visible dans le calendrier
- Draft : sauvegarder un brouillon, le retrouver dans la liste, le reprendre
- Calendar Month/Week/Day/List : basculer entre les 4 vues
- Calendar : drag-drop un post programme vers un autre creneau
- Calendar : code couleur par plateforme visible et correct
- Inbox : affiche les commentaires et DMs de toutes les plateformes connectees
- Inbox : filtrer par plateforme, type, sentiment
- Inbox : repondre a un commentaire inline et verifier la publication de la reponse
- Inbox : assigner un message a un membre de l'equipe
- Analytics : graphique followers 30j avec donnees reelles
- Analytics : top performing posts classes par engagement
- Analytics : export PDF du rapport genere et telechargeable
- Analytics : competitor monitoring — ajouter un handle, voir les stats comparees
- Accounts : connecter un compte Twitter via OAuth, statut "connecte" vert
- Accounts : deconnecter un compte, statut mis a jour, token revoque
- Automation RSS : ajouter un flux RSS, voir les articles importes, publication auto
- Automation Evergreen : activer le recyclage, verifier qu'un post ancien est re-programme
- Templates : creer un template avec variables, l'utiliser dans compose avec remplissage
- Media : upload une image, retrouver dans la mediatheque, utiliser dans un post
- Workflow : contributeur cree un brouillon, manager approuve, post programme automatiquement
- Thread builder : creer un thread Twitter de 3 tweets, preview correct
- Agent IA : generer un planning editorial mensuel a partir d'un brief
- Settings : modifier le fuseau horaire, verifier que les heures du calendrier s'adaptent
- A/B test : creer 2 variations, verifier qu'elles sont publiees et comparees apres 24h
- Bulk scheduling : importer un CSV de 10 posts, verifier la creation dans le calendrier
- Moderation : configurer un mot-cle interdit, verifier le masquage automatique du commentaire

---

## Historique

| Date | Modification |
|---|---|
| 2026-04-09 | Creation de la specification initiale — 12 categories, 10 plateformes, benchmark 15 concurrents |
| 2026-04-10 | Enrichissement P0 : PostgreSQL schema (20 tables), REST API (80+ endpoints), PgEventBus events, A/B testing, bulk scheduling, per-post analytics, detailed UI behaviors |
