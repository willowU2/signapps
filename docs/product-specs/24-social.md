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
Quatre cartes en haut du dashboard : **Abonnes total** (somme cross-plateforme avec delta 7j), **Posts cette semaine** (publies vs programmes), **Taux d'engagement moyen** (interactions / reach, 30j glissants), **Messages en attente** (inbox non lus). Chaque carte cliquable pour naviguer vers la section detaillee.

### 1.2 Feed d'activite recente
Timeline chronologique des dernieres actions : posts publies, commentaires recus, nouveaux abonnes, mentions, DMs. Icone de plateforme + horodatage relatif. Filtre par plateforme et par type d'activite.

### 1.3 Mini-calendrier des publications a venir
Calendrier compact (7 jours) montrant les posts programmes avec pastille de couleur par plateforme. Clic sur un jour ouvre le calendrier complet a cette date.

### 1.4 Performance rapide par plateforme
Tableau synthetique : une ligne par compte connecte, colonnes : plateforme, followers, posts 30j, engagement rate, reach 30j, trend arrow (hausse/baisse). Tri par colonne.

### 1.5 Alertes et notifications
Bandeau d'alertes : token OAuth expire, post echoue, pic de mentions (potentiel bad buzz), milestone atteint (10k followers). Actions directes depuis l'alerte (reconnecter, retenter, voir).

### 1.6 Widget best time to post
Heatmap 7x24 (jours x heures) montrant les creneaux d'engagement optimal par plateforme. Base sur l'historique des 90 derniers jours du compte.

### 1.7 Quick compose
Bouton flottant "Nouveau post" accessible depuis toute page du module, ouvre le compose dialog en overlay sans quitter le contexte actuel.

---

## Categorie 2 — Composition et publication

### 2.1 Editeur de post multi-plateforme
Zone de texte riche avec compteur de caracteres dynamique adapte a la plateforme selectionnee (280 Twitter, 2200 Instagram, 3000 LinkedIn, 500 TikTok). Preview en temps reel dans un mockup de chaque plateforme ciblee. Mentions `@` et hashtags `#` avec autocompletion.

### 2.2 Selecteur de plateformes "Post to"
Grille de toggles avec icones des 10 plateformes supportees : Twitter/X, Facebook (page/groupe), Instagram (feed/story/reel), LinkedIn (profil/page), TikTok, YouTube (community/short), Pinterest, Threads, Mastodon, Bluesky. Activation/desactivation par clic. Badge warning si le contenu depasse les contraintes d'une plateforme.

### 2.3 Upload media (drag-drop)
Zone de drop pour images et videos. Support JPEG, PNG, WebP, GIF, MP4, MOV. Preview en thumbnail avec crop/resize inline. Limites affichees par plateforme (ex: Instagram 1:1 / 4:5 / 16:9, Twitter max 4 images, LinkedIn max 9). Alt text pour l'accessibilite.

### 2.4 Assistance IA a la redaction
Bouton "Generer avec IA" : saisir un brief ("nouveau produit eco-responsable pour millennials") et l'IA propose 3 variations de texte adaptees au ton de la marque. Options : ton formel/decontracte/humoristique, longueur courte/moyenne, emoji oui/non. L'utilisateur edite, accepte ou regenere.

### 2.5 Suggestions de hashtags IA
Panneau lateral avec hashtags suggeres classes par pertinence et popularite. Indicateurs : volume d'utilisation (trending/stable/niche), competitivite, pertinence par rapport au contenu. Clic pour ajouter au post. Maximum configurable par plateforme.

### 2.6 Planification (Schedule)
Date picker + time picker pour programmer la publication. Options : "Publier maintenant", "Programmer", "Ajouter a la file" (prochain creneau optimal), "Sauvegarder en brouillon". Fuseau horaire configurable (par defaut celui de l'utilisateur, override par compte).

### 2.7 Publication immediate
Bouton "Publier maintenant" avec confirmation modale. Publication parallele sur toutes les plateformes selectionnees. Statut en temps reel par plateforme (succes/echec avec message d'erreur). Retry manuel en cas d'echec.

### 2.8 Brouillons et sauvegarde automatique
Auto-save toutes les 30 secondes. Liste des brouillons accessible depuis le menu lateral. Reprise d'un brouillon avec tout le contexte (texte, media, plateformes, hashtags). Suppression de brouillon avec confirmation.

### 2.9 Thread / Carousel builder
Mode thread pour Twitter/X : ajouter des tweets lies avec numerotation automatique et navigation fleche. Mode carousel pour Instagram/LinkedIn : ordonnancer les images/slides avec drag-drop, preview du swipe.

### 2.10 Variations par plateforme
Apres selection de plusieurs plateformes, possibilite de personnaliser le texte par plateforme : texte long pour LinkedIn, concis pour Twitter, avec emojis pour Instagram. Preview cote a cote. L'IA peut proposer l'adaptation automatique.

### 2.11 Premier commentaire automatique
Option pour ajouter un premier commentaire programme (utilise sur Instagram et LinkedIn pour les hashtags, liens, ou CTA supplementaires). Publie automatiquement X secondes apres le post principal.

### 2.12 Geolocalisation et tagging
Ajout de localisation au post (recherche de lieu). Tag d'autres comptes/pages. Preview du rendu avec les tags visibles.

---

## Categorie 3 — Calendrier de publication

### 3.1 Vues multiples
Quatre vues : **Mois** (grille classique avec pastilles), **Semaine** (7 colonnes avec creneaux horaires), **Jour** (timeline verticale detaillee), **Liste** (tableau triable avec colonnes date, plateforme, statut, texte apercu). Toggle rapide entre vues.

### 3.2 Code couleur par plateforme
Chaque plateforme a sa couleur distinctive : bleu Twitter, bleu fonce Facebook, gradient Instagram, bleu LinkedIn, noir TikTok, rouge YouTube, rouge Pinterest, noir Threads, violet Mastodon, bleu Bluesky. Legende visible en bas du calendrier.

### 3.3 Drag-drop pour replanifier
Glisser un post d'un creneau a un autre pour changer sa date/heure de publication. Confirmation modale si le post est deja publie (impossible). Animation fluide avec preview ghost.

### 3.4 Filtres par plateforme, statut, auteur
Barre de filtres en haut : toggles plateforme (afficher/masquer), statut (brouillon/programme/publie/echoue), auteur (en mode equipe). Les filtres se combinent.

### 3.5 Creation rapide depuis le calendrier
Clic sur un creneau vide ouvre le compose dialog pre-rempli avec la date/heure du creneau. Permet de combler visuellement les "trous" dans le planning editorial.

### 3.6 Vue d'ensemble multi-compte
En mode agence/multi-marque, toggle pour voir le calendrier de tous les workspaces superposes ou par onglets. Identification visuelle par workspace (badge couleur).

### 3.7 Export du calendrier
Export du planning en CSV, PDF, ou iCal (.ics) pour integration dans un calendrier externe. Filtre par periode et plateforme avant export.

### 3.8 Creneaux recurrents
Definir des creneaux de publication recurrents ("tous les mardis et jeudis a 10h sur LinkedIn"). Les posts non assignes a un creneau sont places dans la file d'attente automatique.

### 3.9 Indicateur de densite
Barre de densite en haut du calendrier montrant le nombre de posts par jour. Alerte visuelle si un jour depasse le seuil recommande (ex: >5 posts/jour = sur-publication).

### 3.10 Historique de publication
Les posts publies restent visibles dans le calendrier avec un badge "publie" et les metriques de performance (likes, comments, shares) en tooltip au survol.

---

## Categorie 4 — Boite de reception unifiee (Inbox)

### 4.1 Flux unifie multi-plateforme
Tous les commentaires, mentions, DMs, reponses de toutes les plateformes dans un seul flux chronologique. Icone de plateforme, avatar de l'auteur, apercu du message, horodatage relatif.

### 4.2 Filtres et segmentation
Filtrer par : plateforme, type (commentaire/mention/DM/review), statut (non lu/lu/archive/assigne), sentiment (positif/neutre/negatif via IA), date, mot-cle. Recherche full-text dans les messages.

### 4.3 Reponse rapide inline
Repondre directement depuis l'inbox sans ouvrir la plateforme native. Zone de texte avec emoji picker, mentions, et preview. La reponse est postee via l'API de la plateforme concernee.

### 4.4 Assignation en equipe
Assigner un message a un membre de l'equipe. Statut : non assigne / assigne / en cours / resolu. Notification au membre assigne. Vue "Mes messages assignes" dans le sidebar.

### 4.5 Tags et categorisation
Appliquer des tags personnalises (ex: "reclamation", "lead", "partenariat", "spam"). Filtrer par tag. Statistiques de volume par tag pour identifier les tendances.

### 4.6 Reponses predefinies (canned responses)
Bibliotheque de reponses types ("Merci pour votre commentaire !", "Contactez-nous a support@..."). Insertion en un clic avec personnalisation (nom de l'auteur, produit mentionne). Raccourci clavier `/` pour ouvrir la liste.

### 4.7 Moderation automatique
Regles de moderation : masquer automatiquement les commentaires contenant des mots-cles (insultes, spam, liens suspects). Reponse automatique optionnelle ("Ce commentaire a ete masque"). Log de moderation pour audit.

### 4.8 Detection de sentiment
Badge couleur sur chaque message : vert (positif), gris (neutre), rouge (negatif). Analyse IA du texte. Filtre "negatif uniquement" pour prioriser la gestion de crise.

### 4.9 Conversation threading
Les messages lies a un meme post ou thread sont regroupes. Vue conversation complete avec contexte du post original. Evite les reponses hors-sujet.

### 4.10 Notifications temps reel
Push notification et badge sur le sidebar quand un nouveau message arrive. Son optionnel. Configuration granulaire par plateforme et type (ex: DM = notif immediate, commentaire = batch toutes les heures).

---

## Categorie 5 — Analytique et reporting

### 5.1 Dashboard analytique global
Vue consolidee : followers total cross-plateforme (courbe 30j), engagement rate moyen, reach total, impressions, clics sur liens. Comparaison periode precedente (delta % avec fleche).

### 5.2 Analytique par plateforme
Onglets par plateforme connectee. Metriques specifiques : Twitter (tweets, retweets, likes, replies, profile visits), Instagram (reach, impressions, saves, stories views, reels plays), LinkedIn (impressions, clicks, CTR, shares, company page followers), etc.

### 5.3 Top performing posts
Classement des posts par engagement, reach, ou clics. Periode configurable (7j/30j/90j/custom). Detail par post : texte apercu, media thumbnail, metriques, plateforme, date. Bouton "Recycler ce post" pour le republier.

### 5.4 Evolution des hashtags
Graphique de tendance des hashtags utilises sur 30/90 jours. Volume d'utilisation, engagement genere par hashtag, correlation avec la performance des posts. Suggestions de hashtags a abandonner ou renforcer.

### 5.5 Suivi de la concurrence (Competitor Monitoring)
Ajouter des handles concurrents par plateforme. Suivi automatique : nombre de followers, frequence de publication, engagement moyen, croissance. Comparaison cote a cote dans un graphique. Alertes si un concurrent depasse un seuil.

### 5.6 Heatmap d'engagement
Grille 7x24 (jour de la semaine x heure) montrant les creneaux ou l'audience est la plus reactive. Basee sur les 90 derniers jours. Distinction par plateforme. Recommandation automatique des meilleurs creneaux.

### 5.7 Export PDF / CSV
Generation d'un rapport PDF presentation-ready avec logo, graphiques, KPIs, top posts, recommandations. Export CSV des donnees brutes pour analyse dans un tableur. Planification d'envoi automatique (ex: rapport hebdomadaire par email).

### 5.8 Filtre Feed Posts / Stories & Reels
Toggle pour filtrer les analytiques par type de contenu : posts classiques vs Stories vs Reels/Shorts. Comparaison des performances par format pour orienter la strategie de contenu.

### 5.9 Audience demographics
Repartition geographique (carte), tranche d'age, genre, langue des followers. Disponible par plateforme. Aide a cibler le ton et les horaires.

### 5.10 ROI et attribution
Si un lien est publie avec UTM tracking, suivi des clics, conversions et revenus attribues. Integration avec les outils d'analytics (Google Analytics via API). Calcul du cout par engagement si budget publicitaire renseigne.

---

## Categorie 6 — Agent IA

### 6.1 Generation de contenu contextuelle
L'agent IA connait l'historique des publications, le ton de la marque, les hashtags performants. Il propose des posts complets (texte + hashtags + heure optimale) bases sur un brief libre ou un evenement calendrier.

### 6.2 Reformulation multi-ton
Soumettre un texte et obtenir des variations : professionnel, decontracte, inspirant, humoristique, educatif. Choisir et editer avant publication.

### 6.3 Traduction automatique
Traduire un post dans une ou plusieurs langues avec adaptation culturelle (pas une traduction litterale). Preview par langue avec compteur de caracteres.

### 6.4 Analyse de performance et recommandations
L'IA analyse les 30 derniers jours et produit un rapport textuel : "Vos Reels performent 3x mieux que vos posts images. Publiez plus de Reels le mardi matin. Evitez les hashtags generiques (#motivation) au profit de niches (#techleadership)."

### 6.5 Reponse assistee dans l'inbox
Dans l'inbox, bouton "Suggerer une reponse" genere un brouillon contextuel base sur le message recu et l'historique de conversation. L'utilisateur valide ou edite avant envoi.

### 6.6 Detecteur de tendances
L'IA surveille les sujets tendance pertinents pour la marque et notifie : "Le hashtag #IA est en forte hausse (+300% cette semaine). Voulez-vous creer un post sur ce sujet ?" avec brouillon pre-genere.

### 6.7 Optimisation de texte existant
Coller un texte existant et l'IA suggere des ameliorations : concision, call-to-action, emojis, questions d'engagement, hooks d'accroche. Score de qualite avant/apres.

### 6.8 Planning editorial automatique
A partir d'un brief mensuel ("theme avril : eco-responsabilite"), l'IA genere un planning de 20-30 posts repartis sur le mois avec themes, textes, hashtags et creneaux. L'utilisateur ajuste puis valide en bloc.

---

## Categorie 7 — Mediatheque

### 7.1 Bibliotheque de medias centralisee
Upload, stockage et organisation d'images et videos reutilisables. Vignettes avec metadata (taille, format, date, tags). Recherche par nom, tag ou contenu visuel (IA).

### 7.2 Organisation par dossiers et tags
Creer des dossiers (par campagne, client, plateforme). Ajouter des tags. Filtrer par dossier, tag, type (image/video/GIF), date.

### 7.3 Edition d'image integree
Crop, resize, rotation, filtres basiques, ajout de texte/watermark, ajustements (luminosite, contraste, saturation). Pas besoin de quitter l'application pour preparer les visuels.

### 7.4 Preview par plateforme
Avant d'utiliser un media dans un post, preview du rendu sur chaque plateforme (ratio Instagram 1:1, Twitter 16:9, Pinterest 2:3). Crop guide avec zones de securite.

### 7.5 Integration Unsplash / Pexels
Recherche et import de photos libres de droits directement depuis la mediatheque. Attribution automatique. Filtre par orientation, couleur, theme.

### 7.6 Stockage via signapps-storage
Les medias sont stockes via le service `signapps-storage` (port 3004, OpenDAL FS/S3). Deduplification par hash. Versionning des fichiers.

### 7.7 Limites et quotas
Affichage de l'espace utilise vs quota alloue. Avertissement a 80% et 95%. Purge assistee des medias non utilises depuis X mois.

---

## Categorie 8 — Automatisation

### 8.1 Auto-posting RSS
Connecter un flux RSS (blog, actualites). Chaque nouvel article est automatiquement transforme en post social (titre + lien + image OG). Delai configurable, choix des plateformes, ajout de hashtags par defaut.

### 8.2 Auto-Share Queue
File d'attente de partage automatique avec parametres : delai entre publications, inclure la description de l'article, ajouter le lien source, hashtags par defaut. Possibilite de revue avant publication (mode semi-auto).

### 8.3 Evergreen Recycling
Les posts performants (engagement au-dessus d'un seuil) sont automatiquement remis dans la file de publication en rotation. Intervalle minimum entre republication (ex: 60 jours). Texte legerement modifie par l'IA pour eviter le duplicate content.

### 8.4 Regles conditionnelles (IF/THEN)
Creer des regles d'automatisation : "SI un post recoit > 50 commentaires ALORS notifier l'equipe", "SI un DM contient 'prix' ALORS repondre avec la grille tarifaire", "SI un commentaire est negatif ALORS assigner au community manager".

### 8.5 Publication multi-fuseaux
Programmer un meme post pour publication a des heures differentes par region (ex: 10h Paris, 10h New York, 10h Tokyo). Le systeme duplique et planifie automatiquement.

### 8.6 Auto-delete programme
Programmer la suppression automatique d'un post apres une duree (ex: promo flash, evenement termine). Notification avant suppression.

### 8.7 Webhook et evenements
Declencher un webhook externe a chaque publication, echec, ou nouveau message inbox. Utile pour integrer avec des outils tiers (Zapier, n8n, CRM).

### 8.8 Integration PgEventBus
Les evenements de publication (post.published, post.failed, inbox.new_message) sont emis sur le PgEventBus interne de SignApps. D'autres modules (notifications, CRM, chat) peuvent y reagir.

---

## Categorie 9 — Templates

### 9.1 Bibliotheque de templates
Collection de modeles de posts reutilisables, classes par categorie (promo, annonce, question, citation, temoignage, behind-the-scenes). Preview avec placeholder. Clic pour utiliser dans le compose.

### 9.2 Variables dynamiques
Templates avec placeholders : `{{product_name}}`, `{{price}}`, `{{event_date}}`, `{{link}}`. Remplissage lors de l'utilisation. Preview en temps reel avec les valeurs renseignees.

### 9.3 Templates par plateforme
Un meme template peut avoir des variantes par plateforme (texte long LinkedIn, court Twitter). Selection automatique de la variante lors du choix des plateformes cibles.

### 9.4 Templates d'equipe
Templates partages au niveau du workspace. Roles : creer, editer, utiliser. Verrouillage des templates valides (seuls les admins peuvent modifier).

### 9.5 Import/Export de templates
Export en JSON pour backup ou partage entre workspaces. Import avec detection de conflits (meme nom).

---

## Categorie 10 — Gestion des comptes

### 10.1 Connexion OAuth multi-plateforme
Connecter des comptes via OAuth 2.0 : Twitter/X, Facebook (pages et groupes), Instagram Business, LinkedIn (profil et page), TikTok, YouTube, Pinterest, Threads, Mastodon (instance configurable), Bluesky (identifiant AT Protocol).

### 10.2 Statut de connexion
Dashboard des comptes connectes avec statut : connecte (vert), token expire (orange), erreur (rouge). Bouton reconnecter. Date de derniere activite.

### 10.3 Multi-profils par plateforme
Connecter plusieurs comptes sur une meme plateforme (ex: page Facebook marque + page Facebook produit). Selection du profil lors de la composition.

### 10.4 Permissions granulaires
Par compte connecte, definir qui dans l'equipe peut : publier, programmer, repondre aux messages, voir les analytics. Roles : admin, editeur, contributeur (propose mais ne publie pas), viewer.

### 10.5 Rotation de tokens
Refresh automatique des tokens OAuth avant expiration. Notification si le refresh echoue (changement de mot de passe cote plateforme). Historique des connexions/deconnexions.

### 10.6 Groupes de comptes
Creer des groupes (ex: "Tous les comptes France", "Produit X", "Campagne ete"). Publier vers un groupe en un clic au lieu de selectionner chaque compte.

### 10.7 Deconnexion et nettoyage
Deconnecter un compte revoque le token OAuth et supprime les donnees en cache. Option de conserver l'historique des posts et analytics ou tout purger.

---

## Categorie 11 — Collaboration et workflow d'equipe

### 11.1 Workflow d'approbation
Configurer un pipeline : Brouillon -> Revue -> Approuve -> Programme -> Publie. Notifications a chaque etape. Commentaires internes sur un post (non visibles publiquement).

### 11.2 Roles et permissions
Cinq roles : **Admin** (tout), **Manager** (approuver, publier, analytics), **Editeur** (creer, editer), **Contributeur** (proposer, brouillons seulement), **Viewer** (lecture analytics). Configuration par workspace.

### 11.3 Commentaires internes
Annoter un post en cours de redaction avec des commentaires visibles uniquement par l'equipe. Thread de discussion par post. Mentions `@membre` avec notification.

### 11.4 Historique d'activite
Log de toutes les actions par membre : qui a cree, edite, approuve, publie, rejete chaque post. Filtrable par date, membre, action. Non modifiable (audit trail).

### 11.5 Calendrier partage
Le calendrier de publication est visible par toute l'equipe. Chacun voit les posts des autres (selon permissions). Evite les doublons et conflits de planning.

### 11.6 Notes et briefings internes
Attacher des notes internes a un post ou a une journee du calendrier (brief creatif, objectifs de campagne, liens de reference). Visible par l'equipe, pas dans la publication.

---

## Categorie 12 — Configuration et parametres

### 12.1 Parametres generaux du module
Fuseau horaire par defaut, langue de l'interface, notifications (email, push, in-app), theme sombre/clair.

### 12.2 Limites de publication
Definir des garde-fous : nombre max de posts par jour par plateforme, intervalle minimum entre deux posts, plages horaires autorisees. Empeche la sur-publication.

### 12.3 Link shortener integre
URLs dans les posts raccourcies automatiquement avec un domaine personnalise (ex: `sign.link/abc`). Tracking des clics par lien. Integration avec le service `signapps-securelink` (port 3006).

### 12.4 UTM builder
Ajout automatique de parametres UTM aux liens dans les posts : source, medium, campaign, content. Templates UTM reutilisables. Preview de l'URL finale.

### 12.5 Export/Import de donnees
Export complet de toutes les donnees du module (posts, analytics, comptes, templates) en JSON/CSV. Import pour migration depuis un autre outil.

### 12.6 API REST documentee
Endpoints documentes avec `utoipa` et Swagger UI sur `/swagger-ui/` du service `signapps-social` (port 3019). Permet l'integration avec des outils tiers.

### 12.7 Webhooks entrants
Recevoir des declencheurs externes pour publier un post (ex: nouveau commit GitHub -> tweet automatique, nouvelle vente -> post de celebration).

### 12.8 Configuration des reponses automatiques
Definir des reponses automatiques par plateforme : message de bienvenue pour les nouveaux followers, reponse hors heures d'ouverture, accusé de reception des DMs.

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
2. **Queue de publication** : table PostgreSQL `publication_queue` avec statut (pending/publishing/published/failed/retrying), retry_count, next_retry_at. Worker async avec tokio qui consomme la queue. Backoff exponentiel (1s, 5s, 30s, 5min, 30min).
3. **OAuth token management** : stockage chiffre des tokens dans PostgreSQL. Refresh automatique via job cron avant expiration. Notification utilisateur si refresh impossible.
4. **Analytics aggregation** : job cron toutes les heures qui interroge les APIs des plateformes et stocke les metriques dans PostgreSQL. Vues materialisees pour les dashboards. Pas de call API a chaque chargement de page.
5. **Inbox polling** : polling periodique (configurable, defaut 5min) des commentaires/DMs via les APIs. Stockage local avec deduplication par ID plateforme. WebSocket pour push temps reel vers le frontend.
6. **Media processing** : upload vers `signapps-storage`, traitement via `signapps-media` (resize, thumbnails, extraction metadata). URLs signees pour l'affichage frontend.
7. **IA** : appels au service `signapps-ai` (port 3005) pour la generation de texte, suggestions de hashtags, analyse de sentiment. Modeles locaux par defaut, fallback cloud configurable.
8. **Evenements inter-services** : PgEventBus pour `social.post.published`, `social.inbox.new_message`, `social.account.disconnected`. Le module notifications ecoute ces evenements.

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

---

## Historique

| Date | Modification |
|---|---|
| 2026-04-09 | Creation de la specification initiale — 12 categories, 10 plateformes, benchmark 15 concurrents |
