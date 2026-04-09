# Module Communication interne (Comms) -- Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Workplace by Meta** | Fil d'actualites social-style, groupes, annonces avec lecture obligatoire, sondages, live video, translations, knowledge library, org chart, integrations, analytics d'engagement, multi-company groups |
| **Yammer / Microsoft Viva Engage** | Communities, annonces officielles, storylines (feed personnel), Q&A structurees, praise, leadership corner, campaigns, analytics, integration SharePoint/Teams, compliance enterprise |
| **Slack Announcements** | Channel d'annonces en lecture seule, workflows pour sondages, canvas pour newsletters, scheduled messages, bookmarks, channel topics, granular permissions |
| **Staffbase** | Plateforme de communication interne complete, app mobile employee, newsletter builder drag-and-drop, digital signage, intranet pages, analytics de reach, campagnes, segmentation par audience, multi-langue |
| **Beekeeper** | Communication frontline workers, chat + annonces, sondages rapides, digital forms, campagnes push, analytics engagement, shift scheduling integration, multi-langue, offline access |
| **Simpplr** | Intranet moderne AI-driven, newsletters auto-generees, annonces ciblees, analytics de sentiment, content governance, employee directory, search unifie, personalization, branding |
| **Happeo** | Intranet + communication, channels thematiques, pages CMS, universal search, analytics, integration Google Workspace, social features (likes, comments), templates de pages |
| **LumApps** | Plateforme experience employe, communication ciblee par audience/departement, campaigns, newsletters, digital signage, communities, knowledge base, integrations Google/Microsoft, analytics detailles |

## Principes directeurs

1. **Hub de navigation central** -- la page `/comms` est un hub qui dirige vers 6 sous-modules (Annonces, Actualites, Suggestions, Sondages, Newsletter, Affichage numerique). Chaque sous-module est une page dediee avec son propre workflow. Les cartes sur le hub montrent le nombre d'elements actifs par sous-module.
2. **Communication ciblee** -- chaque publication (annonce, actualite, newsletter) peut cibler une audience specifique : toute l'organisation, un departement, un groupe, un site geographique, un role. Le ciblage determine qui voit le contenu et qui recoit la notification.
3. **Engagement mesurable** -- chaque publication enregistre les metriques d'engagement : vues, reactions (like/coeur/bravo), commentaires, partages. Les annonces critiques supportent la lecture obligatoire avec accuse de reception.
4. **Workflow de validation** -- les publications suivent un workflow : brouillon -> en revue -> approuvee -> publiee -> archivee. Les approbateurs sont configurables par sous-module. Programmation de publication a une date/heure future.
5. **Richesse editoriale** -- l'editeur de contenu supporte le texte riche (Tiptap), les images, videos, liens, fichiers joints, mentions d'utilisateurs et embeds de contenu SignApps (taches, events, documents). Preview avant publication.
6. **Accessibilite multi-canal** -- les publications sont accessibles via l'interface web, l'app mobile (PWA), les notifications push, et l'email digest. L'affichage numerique (digital signage) permet de diffuser sur des ecrans physiques.

---

## Categorie 1 -- Page Hub Communication

### 1.1 En-tete de page
Titre `Communication` avec sous-titre `Gerez vos communications internes et externes`. Breadcrumb : Accueil > Communication. Fond `bg-card` avec bordure inferieure `border-border`.

### 1.2 Grille de sous-modules
Six cartes disposees en grille responsive (3 colonnes desktop, 2 tablette, 1 mobile). Chaque carte affiche : icone, titre du sous-module, description courte, badge compteur (elements actifs/non lus), bouton `Acceder a [module]`. Les cartes sont cliquables dans leur integralite. Effet hover : ombre portee `shadow-md` et translation verticale de -2px avec transition 150ms. Etat focus : outline bleu `ring-2 ring-primary`.

### 1.3 Carte Annonces
Icone megaphone. Titre `Annonces`. Description `Communications officielles et obligatoires`. Badge : nombre d'annonces actives non lues par l'utilisateur courant. Couleur du badge : rouge si annonces critiques non lues, bleu sinon. Navigation vers `/comms/announcements`.

### 1.4 Carte Actualites
Icone journal. Titre `Actualites`. Description `Fil d'actualites de l'organisation`. Badge : nombre d'articles publies cette semaine. Navigation vers `/comms/news`.

### 1.5 Carte Suggestions
Icone ampoule. Titre `Suggestions`. Description `Boite a idees collaborative`. Badge : nombre de suggestions ouvertes. Navigation vers `/comms/suggestions`.

### 1.6 Carte Sondages
Icone graphique barres. Titre `Sondages`. Description `Consultez et participez aux sondages`. Badge : nombre de sondages actifs auxquels l'utilisateur n'a pas repondu. Couleur orange pour rappeler l'action requise. Navigation vers `/comms/polls`.

### 1.7 Carte Newsletter
Icone enveloppe. Titre `Newsletter`. Description `Creer et envoyer des newsletters`. Badge : nombre de newsletters en brouillon. Navigation vers `/comms/newsletter`.

### 1.8 Carte Affichage numerique
Icone ecran/moniteur. Titre `Affichage numerique`. Description `Digital signage pour vos ecrans`. Badge : nombre de playlists actives. Navigation vers `/comms/signage`.

### 1.9 Recherche globale communications
Barre de recherche en haut de la page permettant de chercher dans tous les sous-modules a la fois : annonces, articles, suggestions, sondages, newsletters. Resultats groupes par type avec icone distinctive. Debounce de 300ms sur la saisie. Minimum 2 caracteres pour declencher la recherche. Raccourci clavier : `Ctrl+K` pour focus la barre de recherche depuis n'importe quelle page comms.

### 1.10 Statistiques rapides
Bandeau optionnel sous le titre : nombre total de publications ce mois, taux d'engagement moyen (vues/publications), nombre de suggestions en attente de traitement. Visible uniquement pour les roles `comms:editor` et `comms:admin`. Chaque metrique est cliquable et navigue vers le sous-module correspondant.

---

## Categorie 2 -- Annonces

### 2.1 Liste des annonces
Page `/comms/announcements` avec liste des annonces triees par date de publication (plus recente en haut). Chaque annonce affiche : titre, extrait (150 caracteres), auteur avec avatar, date de publication (format relatif : "il y a 2h", "hier"), badge de priorite (normal = gris, important = orange, critique = rouge avec animation pulse), compteur de vues, indicateur de lecture obligatoire (icone cadenas). Les annonces non lues ont un fond `bg-muted` et un point bleu a gauche.

### 2.2 Filtres et recherche
Filtres par : statut (actif, archive), priorite (normal, important, critique), auteur (dropdown avec recherche), date (plage avec date picker), audience cible (departement, groupe). Recherche full-text dans le titre et le contenu avec highlighting des termes trouves. Les filtres actifs sont affiches comme des chips sous la barre de recherche avec un bouton `x` pour les supprimer individuellement. Bouton `Reinitialiser` pour effacer tous les filtres.

### 2.3 Detail d'une annonce
Page de detail `/comms/announcements/{id}` avec : titre en grand (text-2xl font-bold), badge priorite a droite du titre, auteur avec avatar et nom cliquable (navigue vers le profil), date de publication, contenu riche (texte, images, videos, fichiers joints), metriques d'engagement (vues, reactions, commentaires) dans un bandeau sous le contenu, section commentaires en bas. Animation fade-in au chargement. Bouton retour en haut a gauche.

### 2.4 Lecture obligatoire et accuses de reception
Les annonces marquees `lecture obligatoire` affichent un bandeau jaune en haut `Cette annonce requiert votre confirmation de lecture` avec un bouton `Confirmer la lecture`. Apres confirmation, le bandeau disparait et est remplace par `Lu le JJ/MM/AAAA a HH:MM`. L'auteur accede a un onglet `Suivi des lectures` dans le detail de l'annonce : tableau avec colonnes (Nom, Departement, Statut [Lu/Non lu], Date de lecture). Barre de progression circulaire : `X% des destinataires ont confirme`. Bouton `Relancer les non-lecteurs` envoie une notification push et un email aux personnes n'ayant pas confirme. Relances automatiques configurables par l'auteur : J+1, J+3, J+7 apres publication.

### 2.5 Selecteur d'audience cible
Composant reutilisable dans tous les sous-modules. Arborescence hierarchique : Organisation entiere (radio) > Departement(s) (multi-select) > Groupe(s) (multi-select) > Site(s) geographique(s) (multi-select). Preview en bas : `Cette annonce sera visible par N personnes`. Recherche dans la liste des departements/groupes. Mode avance : liste nominative d'utilisateurs via un champ de recherche a autocompletion. Les audiences selectionnees sont affichees comme des tags colores.

### 2.6 Creation d'annonce
Formulaire de creation accessible via le bouton `+ Nouvelle annonce` en haut a droite de la liste. Champs : titre (obligatoire, max 200 caracteres avec compteur), contenu riche (editeur Tiptap avec toolbar : gras, italique, souligne, titres H2/H3, listes, citations, liens, images, videos, mentions @utilisateur, embed fichier SignApps), priorite (select : normal/important/critique avec icones couleur), audience cible (composant 2.5), lecture obligatoire (toggle avec tooltip explicatif), date de publication (immediate par defaut, ou programmee via date+heure picker -- la date future affiche un bandeau `Sera publiee le JJ/MM/AAAA a HH:MM`), date d'expiration (optionnelle, tooltip : `L'annonce sera archivee automatiquement`), fichiers joints (drag-and-drop zone, max 10 fichiers, 50 Mo par fichier, formats acceptes : PDF, DOCX, XLSX, images, videos). Boutons : `Enregistrer en brouillon`, `Soumettre pour approbation`. Validation cote client : titre requis, contenu non vide.

### 2.7 Workflow de publication
Statuts : brouillon -> en revue -> approuvee -> publiee -> archivee. Les brouillons sont visibles uniquement par l'auteur. Le passage en revue notifie les approbateurs designes (configures dans les parametres du module par l'admin). Chaque approbateur recoit un email et une notification push avec lien direct. L'approbateur peut `Approuver`, `Demander des modifications` (avec commentaire), ou `Rejeter` (avec motif). L'approbation declenche la publication (ou la programmation si date future). Archivage manuel via bouton dans le detail, ou automatique a la date d'expiration. Les annonces archivees restent consultables dans le filtre `Archive`.

### 2.8 Reactions et commentaires
Sous chaque annonce : barre de reactions avec 4 emojis (pouce, coeur, applaudissement, fusee). Clic sur un emoji : animation scale 1.2x pendant 200ms, compteur incremente. Clic a nouveau retire la reaction. Les compteurs affichent le nombre total et la liste des reacteurs au survol. Section commentaires en dessous : textarea avec support Tiptap (gras, italique, mentions @). Chaque commentaire affiche : avatar, nom, date relative, contenu. Reponse en thread : bouton `Repondre` ouvre un sous-commentaire indente. Moderation : l'auteur de l'annonce ou un `comms:admin` peut supprimer un commentaire (confirmation dialog). Les commentaires supprimes affichent `[Commentaire supprime]`.

### 2.9 Notifications push
A la publication, une notification push est envoyee aux membres de l'audience cible via signapps-notifications. Payload : titre de l'annonce, extrait 80 caracteres, lien direct. Les annonces critiques envoient une notification avec la priorite `high` qui declenche un son/vibration distinctif sur les appareils mobiles. Les annonces normales utilisent la priorite `default`.

### 2.10 Epinglage
Les annonces peuvent etre epinglees en haut de la liste via un bouton `Epingler` dans le menu d'actions (icone punaise). Maximum 3 annonces epinglees simultanement. Si on tente d'en epingler une 4e, un dialog demande quelle annonce desepingler. Les annonces epinglees sont affichees dans une section separee en haut avec un fond legerement different (`bg-muted`). Ordre des epinglees : par date d'epinglage (plus recente en haut).

### 2.11 Analytics par annonce
Onglet `Statistiques` dans le detail d'une annonce (visible par l'auteur et les admins). Metriques : nombre de vues uniques, nombre de reactions par type, nombre de commentaires, taux de lecture obligatoire (si applicable). Graphique en ligne : vues par jour depuis la publication. Graphique en barres : reactions par type. Tableau : top 10 des departements ayant le plus lu.

---

## Categorie 3 -- Actualites (News Feed)

### 3.1 Fil d'actualites
Page `/comms/news` avec un fil de type blog/magazine. Layout : articles en cartes sur 2 colonnes desktop, 1 colonne mobile. Chaque carte affiche : image de couverture (ratio 16:9, placeholder gris si absente), titre (text-lg font-semibold, max 2 lignes avec ellipsis), extrait (max 3 lignes), auteur avec avatar miniature, date de publication (format relatif), tags/categories (chips colores, max 3 visibles + `+N` si plus), temps de lecture estime (calcule a ~200 mots/min), compteur de vues (icone oeil). Effet hover sur la carte : image zoom 1.05x avec transition 300ms, ombre portee augmentee.

### 3.2 Article mis en avant (featured)
Le premier article marque `featured` est affiche en grand en haut du fil : image de couverture pleine largeur (ratio 21:9), titre en overlay blanc sur fond degrade noir, extrait plus long (200 caracteres), auteur et date. Un seul article featured a la fois. L'editeur le designe via un toggle `Mettre en avant` dans l'editeur d'article. Les articles pinnees sont affiches sous le featured, avant le fil chronologique, avec un badge `Epingle`.

### 3.3 Categories d'articles
Systeme de categories configurables par l'admin dans les parametres : Vie d'entreprise, Technique, RH, Evenements, Projets, Partenaires, etc. Chaque categorie a un nom, une couleur, et une icone. Filtre par categorie via des onglets horizontaux en haut du fil (scrollable si nombreuses). Onglet `Toutes` par defaut. Clic sur une categorie filtre le fil instantanement (client-side si <100 articles, server-side sinon).

### 3.4 Tags
Systeme de tags libres en complement des categories. Chaque article peut avoir 0-10 tags. Saisie avec autocompletion sur les tags existants. Nuage de tags dans la sidebar droite (desktop) avec taille proportionnelle a la frequence. Clic sur un tag filtre le fil.

### 3.5 Editeur d'article
Editeur WYSIWYG complet (Tiptap) pleine page avec toolbar flottante (apparait au-dessus de la selection de texte) : gras (Ctrl+B), italique (Ctrl+I), souligne (Ctrl+U), barre (Ctrl+Shift+X), titres (H1 reserve au titre, H2/H3 pour les sections), listes a puces, listes numerotees, citations (blockquote avec barre bleue a gauche), code inline et blocs de code avec syntax highlighting, images (upload drag-and-drop ou depuis le Drive SignApps, redimensionnement dans l'editeur, texte alt obligatoire), videos (embed YouTube/Vimeo par URL ou upload direct MP4 max 200 Mo), tableaux (insertion, ajout/suppression de lignes/colonnes), separateurs horizontaux, mentions @utilisateur (dropdown de recherche), liens internes SignApps (vers taches, events, documents -- affichage en smart chip avec titre et icone). Raccourcis : Ctrl+Z undo, Ctrl+Y redo, Ctrl+S sauvegarde brouillon. Compteur de mots en bas a gauche.

### 3.6 Image de couverture
Champ upload dedie au-dessus de l'editeur. Drag-and-drop ou clic pour selectionner. Formats acceptes : JPEG, PNG, WebP (max 10 Mo). Recadrage automatique aux dimensions standard (16:9) avec possibilite d'ajuster le cadrage manuellement (crop tool). Texte alternatif obligatoire pour l'accessibilite (champ texte sous l'image). Si pas d'image, le fil utilise un placeholder de couleur basee sur la categorie.

### 3.7 Metadonnees article
Panneau lateral droit dans l'editeur avec les champs : titre (obligatoire, max 200 caracteres), sous-titre (optionnel, max 300 caracteres), categorie (select unique, obligatoire), tags (multi-input avec autocompletion), auteur (par defaut l'utilisateur courant, modifiable par admin -- dropdown de recherche), date de publication (immediate ou programmee), audience cible (composant selecteur d'audience de la categorie 2.5), extrait personnalise (textarea 300 caracteres max, sinon auto-genere depuis les 150 premiers caracteres du contenu).

### 3.8 Programmation de publication
Date/heure de publication future via date-time picker. L'article reste en statut `programme` jusqu'a l'heure prevue (affiche dans la liste avec badge gris `Programme pour le JJ/MM`), puis bascule automatiquement en `publie` par un job cron cote serveur (interval 1 min). Preview de l'article avant publication : bouton `Previsualiser` ouvre un dialog plein ecran simulant le rendu final.

### 3.9 Interactions sociales
Sous chaque article : compteur de vues (incremente a l'ouverture du detail, deduplique par user+article sur 24h), barre de reactions (memes que les annonces : pouce, coeur, applaudissement, fusee), compteur de commentaires. Section commentaires avec threads (reponse a un commentaire indentee d'un niveau, max 3 niveaux de profondeur). Bouton de partage : menu dropdown avec `Copier le lien`, `Envoyer en chat SignApps` (ouvre le chat picker), `Envoyer par email` (ouvre le compose mail avec lien).

### 3.10 RSS feed interne
Un flux RSS Atom est genere automatiquement a `/api/v1/comms/news/feed.xml`. Contenu : titre, auteur, date, extrait, lien vers l'article. Limite : 50 derniers articles. Authentification requise (token JWT dans le query string ou header). Permet l'integration dans des lecteurs RSS internes ou des dashboards.

---

## Categorie 4 -- Boite a suggestions

### 4.1 Liste des suggestions
Page `/comms/suggestions` avec deux modes de tri : `Plus votees` (par defaut, score decroissant) et `Plus recentes` (date decroissante). Toggle en haut a droite. Chaque suggestion affiche en carte : bouton de vote a gauche (fleche haut + compteur + fleche bas, style Reddit/StackOverflow), titre (text-lg font-semibold), description courte (max 2 lignes avec ellipsis), auteur avec avatar (ou icone `Anonyme` si anonyme), date de soumission (format relatif), badge de statut colore (submitted = gris, under_review = bleu, planned = violet, in_progress = orange, done = vert, rejected = rouge), categorie (chip colore). Filtres en haut : statut (multi-select), categorie, auteur, date.

### 4.2 Soumission de suggestion
Formulaire accessible via le bouton `+ Nouvelle suggestion`. Champs : titre (obligatoire, max 200 caracteres), description detaillee (editeur Tiptap avec formatage basique : gras, italique, listes, liens, images), categorie (select : Processus, Outils, Conditions de travail, Communication, Formation, Securite, Autre -- configurables par l'admin), anonyme (toggle -- si active, tooltip : `Votre nom ne sera pas affiche publiquement mais reste visible par les administrateurs`). Fichiers joints possibles (max 5, formats images et PDF, 20 Mo par fichier). Bouton `Soumettre`. Apres soumission, toast de confirmation : `Votre suggestion a ete soumise. Vous serez notifie de son evolution.`

### 4.3 Systeme de votes (upvote/downvote)
Chaque utilisateur peut voter une fois par suggestion : upvote (+1) ou downvote (-1). Clic sur la fleche haut donne un upvote (fleche devient bleue). Clic a nouveau retire le vote. Clic sur la fleche bas donne un downvote (fleche devient rouge). Le score total est la somme algebrique des votes. L'utilisateur peut changer son vote a tout moment. Animation : le compteur fait une micro-animation de translation verticale (slide up/down) au changement. Les votes sont visibles (nombre total) mais la liste des votants n'est visible que par les admins (sauf si la suggestion est anonyme, ou seul le compteur est montre a tous).

### 4.4 Statuts et workflow
Workflow : `submitted` -> `under_review` -> `planned` / `rejected` -> `in_progress` -> `done`. Le changement de statut est effectue par un admin ou un responsable assigne. A chaque changement : notification push et email a l'auteur et aux votants. Le responsable peut (et doit) ajouter un commentaire officiel (arriere-plan bleu clair, badge `Reponse officielle`) expliquant la decision. Les suggestions rejetees affichent le motif de rejet en bandeau rouge dans le detail. Les suggestions `done` affichent un bandeau vert `Implementee`.

### 4.5 Detail d'une suggestion
Page `/comms/suggestions/{id}` avec : titre, description complete, auteur, date, statut avec historique (timeline verticale des changements de statut avec dates et auteurs), votes (meme composant que la liste), fichiers joints, reponse officielle (si presente, mise en avant avec bordure bleue), section commentaires (meme composant que les annonces).

### 4.6 Commentaires et discussion
Section commentaires sous chaque suggestion pour que la communaute discute de la faisabilite, propose des ameliorations, ou apporte du contexte supplementaire. Les commentaires supportent le texte riche (Tiptap basique) et les mentions @utilisateur. Thread a un niveau de profondeur. L'auteur du commentaire peut l'editer pendant 15 minutes apres la publication. Moderation par les admins.

### 4.7 Moderation et administration
Les administrateurs (`comms:admin`) peuvent : modifier le statut (dropdown dans le detail), assigner un responsable d'evaluation (user picker), fusionner des suggestions doublons (selectionner 2+ suggestions -> action `Fusionner` qui conserve la plus votee et redirige les autres), masquer les suggestions inappropriees (bouton `Masquer` avec motif), exporter la liste en CSV (bouton dans la barre d'actions de la liste, colonnes : titre, auteur, date, statut, score, categorie, nombre de commentaires).

### 4.8 Tableau de bord suggestions
Vue admin accessible via un onglet `Tableau de bord` en haut de la page suggestions. Metriques : nombre de suggestions par statut (pie chart), top 10 les plus votees (bar chart horizontal), tendance de soumission (line chart par semaine sur les 12 dernieres semaines), temps moyen de traitement (submitted -> done/rejected, affiche en jours), taux d'acceptation (done / (done + rejected) en pourcentage). Periode filtrable : 30 jours, 90 jours, 1 an, tout.

---

## Categorie 5 -- Sondages

### 5.1 Liste des sondages
Page `/comms/polls` avec sondages actifs affiches en priorite (badge vert `En cours`), suivis des sondages clotures (badge gris `Cloture`). Chaque sondage affiche en carte : question principale (titre, text-lg), nombre de reponses (icone utilisateurs + compteur), date de cloture (format relatif : `Cloture dans 3 jours` ou `Cloture il y a 2 semaines`), barre de progression de participation (si audience definie), indicateur si l'utilisateur a deja repondu (check vert `Vous avez repondu` ou badge orange `En attente de votre reponse`).

### 5.2 Creation de sondage
Formulaire accessible via `+ Nouveau sondage`. Champs : titre/question principale (obligatoire, max 300 caracteres), description (optionnelle, Tiptap basique), type de reponse (voir 5.3), options de reponse (ajout dynamique via bouton `+ Ajouter une option`, reordonnement par drag-and-drop, suppression par bouton `x`), date de cloture (date-time picker, obligatoire), audience cible (composant selecteur d'audience), anonyme (toggle -- si active, tooltip : `Les reponses individuelles ne pourront pas etre associees aux repondants`), resultat visible avant cloture (toggle -- si active, les participants voient les resultats apres avoir vote). Boutons : `Enregistrer en brouillon`, `Publier`. Validation : au moins 2 options pour choix unique/multiple, date de cloture dans le futur.

### 5.3 Types de questions
- **Choix unique** : radio buttons, une seule reponse possible. Options affichees verticalement. Nombre d'options : 2-20.
- **Choix multiple** : checkboxes, plusieurs reponses possibles. Option `Autre` avec texte libre (toggle dans la config). Nombre max de selections configurable (optionnel).
- **Echelle** : slider ou radio 1-5 (ou 1-10, configurable). Labels personnalisables sur les extremites (ex: `Pas du tout d'accord` -> `Tout a fait d'accord`). Affichage en etoiles ou en barre horizontale.
- **Texte libre** : textarea pour reponse ouverte (max 2000 caracteres). Compteur de caracteres.
- **Matrice** : grille avec lignes (sous-questions, max 10) et colonnes (echelle ou options, max 7). Chaque cellule est un radio button (une reponse par ligne). Utile pour les evaluations multi-criteres.

### 5.4 Sondage multi-questions
Un sondage peut contenir plusieurs questions (sections). Bouton `+ Ajouter une question` dans le formulaire de creation. Navigation par etapes (step wizard avec indicateur 1/N) si >3 questions, ou affichage en scroll si <=3. Barre de progression en haut pour les sondages longs. Chaque question peut avoir un type different. Bouton `Precedent` / `Suivant` / `Soumettre` (derniere etape).

### 5.5 Resultats en temps reel
Apres avoir vote (ou si les resultats sont visibles avant cloture), les resultats s'affichent sous forme de graphiques Recharts :
- **Choix unique/multiple** : bar chart horizontal avec pourcentage et nombre absolu par option. La barre de l'option selectionnee par l'utilisateur est mise en surbrillance.
- **Echelle** : distribution en bar chart vertical (une barre par valeur 1-5) + moyenne affichee en grand.
- **Texte libre** : nuage de mots genere par signapps-ai (termes les plus frequents en plus gros).
- **Matrice** : heatmap avec couleurs (vert = positif, rouge = negatif).
Mise a jour en temps reel via PgEventBus : quand un vote arrive, les graphiques se mettent a jour avec une animation de transition de 300ms.

### 5.6 Anonymat
Si le sondage est anonyme, les reponses individuelles ne sont pas tracables. La table `poll_responses` stocke `user_id = NULL` et un hash de verification (pour empecher le double vote). Seuls les resultats agreges sont visibles. L'admin ne peut pas associer une reponse a un utilisateur. Un bandeau dans l'interface confirme : `Ce sondage est anonyme -- vos reponses ne seront pas associees a votre identite`.

### 5.7 Cloture et rappels
Le sondage se cloture automatiquement a la date prevue (job cron, interval 1 min). Rappels automatiques envoyes aux non-repondants via signapps-notifications : J-3 (email uniquement), J-1 (push + email), jour J a 10h (push + email avec `Dernier jour pour repondre !`). Frequences configurables par l'auteur lors de la creation. Cloture manuelle anticipee possible par l'auteur via bouton `Cloturer maintenant` (confirmation dialog). Apres cloture, les resultats sont figes et ne changent plus.

### 5.8 Export des resultats
Bouton `Exporter` dans le detail d'un sondage cloture. Options : CSV (une ligne par reponse, colonnes = questions, reponses anonymisees si sondage anonyme -- `Repondant 1`, `Repondant 2` au lieu des noms), PDF (rapport graphique avec les charts rendus en images, titre, date, nombre de repondants, graphiques par question, synthese textuelle). Export via signapps-office pour le PDF.

---

## Categorie 6 -- Newsletter

### 6.1 Liste des newsletters
Page `/comms/newsletter` avec liste des newsletters triees par date. Trois onglets : `Brouillons`, `Programmees`, `Envoyees`. Chaque entree affiche : titre, date d'envoi (ou date de programmation, ou date de derniere modification pour les brouillons), nombre de destinataires, taux d'ouverture (pourcentage, affiches uniquement pour les envoyees), nombre de clics (affiches uniquement pour les envoyees). Actions rapides : `Editer`, `Dupliquer`, `Supprimer` (brouillons), `Annuler` (programmees, si >5 min avant l'envoi).

### 6.2 Editeur de newsletter MJML
Editeur drag-and-drop type Staffbase/Mailchimp avec panneau de blocs a gauche et zone de preview a droite. Blocs disponibles :
- **En-tete** : logo de l'organisation (configurable) + titre de la newsletter (texte editable)
- **Texte riche** : paragraphe avec Tiptap (gras, italique, liens, listes)
- **Image** : upload ou selection depuis le Drive SignApps. Redimensionnement automatique (max 600px largeur). Texte alt obligatoire. Lien optionnel au clic.
- **Bouton CTA** : texte + URL + couleur de fond + couleur de texte. Border-radius configurable. Alignement (gauche, centre, droite).
- **Separateur** : ligne horizontale avec couleur et epaisseur configurables.
- **Colonnes 2** : deux blocs cote a cote (50/50 ou 40/60 ou 60/40). Chaque colonne accepte les blocs ci-dessus.
- **Colonnes 3** : trois blocs cote a cote (33/33/33).
- **Citation** : texte en italique avec bordure gauche coloree. Auteur optionnel.
- **Article SignApps** : selection d'un article du fil d'actualites. Affiche automatiquement : image de couverture, titre, extrait, bouton `Lire la suite`. Lien vers l'article.
- **Evenement** : selection d'un event du calendrier. Affiche : titre, date, lieu, bouton `Voir l'evenement`.
Drag-and-drop des blocs depuis le panneau vers la zone de preview. Reordonnement des blocs dans la preview par drag-and-drop. Suppression d'un bloc : icone poubelle au survol. Duplication d'un bloc : icone copie au survol.

### 6.3 Templates
Bibliotheque de templates accessible via un bouton `Choisir un template` a la creation. Templates par defaut :
- **Hebdo** : en-tete + 3 blocs article + separateur + texte de conclusion + pied de page
- **Mensuelle** : en-tete + section statistiques (colonnes 3) + 5 blocs article + sondage embed + pied de page
- **Flash info** : en-tete + 1 bloc texte court + bouton CTA + pied de page
- **Rapport mensuel** : en-tete + sommaire (liste) + sections structurees avec titres H2 + graphiques en images + pied de page
L'admin peut creer des templates custom (sauvegarder une newsletter comme template via `Sauvegarder comme template` dans le menu). Les templates custom sont partages avec toute l'organisation.

### 6.4 Audience et segmentation
Panneau `Destinataires` dans l'editeur. Selection des destinataires via le composant selecteur d'audience (2.5) : toute l'organisation, departement(s), groupe(s), liste de diffusion personnalisee (saisie d'emails ou import CSV). Preview du nombre de destinataires en bas : `Cette newsletter sera envoyee a N personnes`. Exclusion des desabonnes automatique (voir 6.8). Test d'envoi : bouton `Envoyer un apercu` envoie la newsletter a l'email de l'auteur uniquement pour verification du rendu.

### 6.5 Programmation d'envoi
Date et heure d'envoi futur via date-time picker. La newsletter est generee en HTML MJML, convertie en HTML responsive, et mise en queue dans signapps-mail. Statut `programmee` avec affichage : `Envoi programme le JJ/MM/AAAA a HH:MM`. Annulation possible jusqu'a 5 minutes avant l'heure programmee via bouton `Annuler l'envoi` (confirmation dialog). Apres annulation, la newsletter repasse en `brouillon`.

### 6.6 Rendu email et envoi
La newsletter est rendue en HTML responsive via MJML (compile en HTML compatible Outlook, Gmail, Apple Mail, Yahoo Mail). Version texte brut generee automatiquement en fallback (extraction du texte sans formatage). Envoi par email via signapps-mail (SMTP). Le `From` est configurable par l'admin (`newsletter@organisation.com`). Le `Reply-To` est l'email de l'auteur. Headers : `List-Unsubscribe` avec lien de desabonnement. Envoi par lots de 50 emails/seconde pour eviter le throttling SMTP. Si le serveur SMTP renvoie une erreur, retry 3 fois avec backoff exponentiel (1s, 5s, 15s).

### 6.7 Metriques post-envoi (open/click tracking)
Apres envoi, le tableau de bord affiche en onglet `Statistiques` :
- Nombre d'emails envoyes / delivres / en erreur (bounces)
- Taux d'ouverture : pixel de tracking 1x1 insere dans le HTML (comptage des chargements uniques par destinataire)
- Taux de clic : chaque lien dans la newsletter est enveloppe dans un redirect tracker (`/api/v1/comms/newsletter/{id}/track?url=...&recipient=...`). Comptage des clics uniques par lien.
- Graphique en ligne : ouvertures par heure dans les 48h suivant l'envoi
- Tableau : liens les plus cliques (URL, nombre de clics, taux)
- Desabonnements declenches par cette newsletter

### 6.8 Desabonnement
Lien de desabonnement obligatoire en bas de chaque newsletter : `Se desabonner des newsletters`. Clic redirige vers `/comms/newsletter/unsubscribe?token=...` qui affiche une confirmation. Apres confirmation, l'utilisateur est ajoute a la liste des desabonnes. Il ne recoit plus les newsletters mais reste dans l'organisation. L'admin peut voir la liste des desabonnes dans les parametres du module et les reinscrire manuellement (apres consentement). L'utilisateur peut se reabonner depuis ses preferences de notification.

### 6.9 Archive publique
Les newsletters envoyees sont archivees et consultables dans l'interface web a `/comms/newsletter/archive`. Liste par date avec titre et extrait. Clic ouvre le rendu HTML de la newsletter dans une page web. Utile pour les nouveaux arrivants qui veulent rattraper l'historique. L'archive est accessible a tous les utilisateurs authentifies (pas de filtre par audience d'envoi).

---

## Categorie 7 -- Affichage numerique (Digital Signage)

### 7.1 Vue d'ensemble
Page `/comms/signage` avec la liste des ecrans enregistres et des playlists de contenu. Dashboard en haut : nombre d'ecrans connectes (badge vert), nombre d'ecrans hors ligne (badge rouge), nombre de playlists actives, contenu en diffusion actuellement. Deux onglets : `Ecrans` et `Playlists`.

### 7.2 Gestion des ecrans
Onglet `Ecrans` affiche la liste des ecrans enregistres en table : nom, emplacement (batiment/etage/salle), resolution (ex: 1920x1080), orientation (paysage/portrait avec icone), playlist assignee, statut (en ligne = badge vert, hors ligne = badge rouge avec duree depuis la derniere connexion, en pause = badge orange). Bouton `+ Enregistrer un ecran` ouvre un dialog : nom (obligatoire), emplacement (champs texte : batiment, etage, salle), resolution (dropdown des standards : 1920x1080, 3840x2160, 1080x1920 portrait), orientation (radio : paysage/portrait), fuseau horaire (dropdown). A la sauvegarde, un code d'appairage a 6 chiffres est genere (valide 24h). L'URL unique d'affichage est `/signage/display/{id}`. Actions par ecran : `Editer`, `Assigner une playlist`, `Mettre en pause`, `Supprimer`.

### 7.3 Playlists de contenu
Onglet `Playlists` affiche la liste des playlists : nom, nombre de slides, duree totale, ecrans assignes, statut (active/inactive). Bouton `+ Nouvelle playlist` ouvre l'editeur de playlist. L'editeur affiche la liste ordonnee des slides a gauche (vignettes) et la preview d'une slide a droite. Chaque slide a une duree d'affichage configurable (en secondes, defaut 10s, min 3s, max 300s). La playlist boucle indefiniment. Drag-and-drop pour reordonner les slides. Boutons par slide : `Editer`, `Dupliquer`, `Supprimer`. Duree totale affichee en bas : `Cycle complet : MM:SS`.

### 7.4 Types de slides
- **Texte riche** : message avec titre (text-3xl), corps (text-xl), couleur de fond (color picker), couleur de texte, police (select parmi 5 options lisibles a distance). Pour les annonces rapides.
- **Image** : image plein ecran uploadee ou depuis le Drive SignApps. Support JPEG, PNG, WebP. Modes d'ajustement : `cover` (recadrage), `contain` (barres noires), `stretch`. Max 10 Mo.
- **Video** : video en boucle (MP4, WebM, max 200 Mo). Duree du slide = duree de la video (non configurable). Lecture automatique sans son par defaut. Toggle pour activer le son.
- **Annonce SignApps** : slide dynamique qui affiche automatiquement la derniere annonce critique publiee dans le module annonces. Mise a jour automatique quand une nouvelle annonce critique est publiee. Rendu : titre en grand, extrait, badge critique, auteur.
- **Meteo** : widget meteo avec la localisation de l'ecran. Source : API meteo configuree par l'admin (OpenWeatherMap ou autre). Affiche : temperature actuelle, icone conditions, previsions J+1/J+2. Rafraichissement toutes les 30 minutes.
- **Horloge** : affichage date/heure en grand format. Fuseau horaire de l'ecran. Format configurable : 24h/12h, avec/sans secondes, avec/sans date. Utile comme slide de fond entre les contenus.
- **Webpage embed** : iframe vers une URL configurable (dashboard interne, page web, rapport Grafana). Dimensions = plein ecran. Attention : le contenu doit autoriser l'embedding (X-Frame-Options).
- **Actualites SignApps** : carrousel des 5 derniers articles du fil d'actualites. Affiche : image de couverture, titre, extrait. Defilement automatique toutes les 8 secondes.

### 7.5 Planification de diffusion
Chaque playlist peut etre planifiee. Configuration : jours de la semaine (checkboxes : lun-dim, presets `Lun-Ven`, `Tous les jours`, `Week-end`), heures de diffusion (time range picker : defaut 8h00-20h00), date de debut (optionnelle), date de fin (optionnelle). En dehors des heures de diffusion, l'ecran affiche un ecran de veille configurable (image statique, horloge, ou ecran noir). Les plages de diffusion sont affichees visuellement sur un calendrier hebdomadaire dans l'editeur.

### 7.6 Assignation ecran-playlist
Dans le detail d'un ecran : dropdown `Playlist assignee` pour selectionner une playlist. Si plusieurs playlists doivent etre jouees, utiliser le mode `Programmation` : assigner des playlists a des creneaux horaires specifiques (ex: playlist A de 8h a 12h, playlist B de 12h a 14h, playlist C de 14h a 20h). Priorite d'interruption : une annonce urgente (priorite `critique` dans le module annonces) peut interrompre la playlist courante pour afficher un slide d'annonce urgente pendant 60 secondes, puis reprendre la playlist.

### 7.7 Preview
Bouton `Previsualiser` dans l'editeur de playlist ouvre une fenetre modale plein ecran simulant le rendu sur l'ecran physique. La simulation defile les slides avec les durees configurees. Boutons de controle : play/pause, slide suivante, slide precedente, vitesse (1x, 2x, 4x). Affichage de la duree restante par slide. Option de previsualiser dans une resolution specifique (dropdown : 1920x1080, 3840x2160, 1080x1920).

### 7.8 Mode kiosque
L'URL d'affichage (`/signage/display/{id}`) est concue pour tourner en mode kiosque (plein ecran, pas de barre d'adresse). Compatible Chromium kiosk mode (`--kiosk`) sur Raspberry Pi, smart TV avec navigateur integre, ou PC dedie. Pas de scroll, pas de selection de texte, pas de curseur visible (CSS `cursor: none`). Reconnexion automatique en cas de perte reseau : ecran de veille avec message `Reconnexion en cours...` et retry toutes les 5 secondes. Reprise de la playlist a la slide courante apres reconnexion.

### 7.9 Push de contenu en temps reel
Quand une playlist est modifiee (ajout/suppression/reordonnement de slide, changement de duree), le changement est pousse en temps reel vers tous les ecrans assignes via WebSocket (signapps-collab). L'ecran recoit le diff et met a jour sa playlist sans interruption visible (la slide en cours termine son affichage, puis la nouvelle playlist prend effet). Pas besoin de rafraichir manuellement l'ecran.

### 7.10 Analytics d'affichage
Metriques par ecran : uptime (pourcentage de temps en ligne sur les 30 derniers jours), nombre de slides affichees (total et par slide), duree totale de diffusion. Metriques par slide : nombre d'impressions (combien de fois la slide a ete affichee). Dashboard admin : vue en grille de tous les ecrans avec miniature du contenu en cours, statut en temps reel, derniere activite. Alerte si un ecran est hors ligne depuis plus de 1 heure (notification push a l'admin signage).

### 7.11 Controle a distance des ecrans
Depuis le dashboard admin, actions par ecran : `Redemarrer l'affichage` (recharge la page), `Mettre en pause` (affiche l'ecran de veille), `Reprendre`, `Changer de playlist` (application immediate via WebSocket). Utile pour les situations d'urgence ou les evenements speciaux.

---

## Categorie 8 -- PostgreSQL Schema

### 8.1 Table announcements
```sql
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    content_html TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'critical')),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'published', 'archived')),
    author_id UUID NOT NULL REFERENCES users(id),
    audience JSONB NOT NULL DEFAULT '{"type": "all"}',
    mandatory_read BOOLEAN NOT NULL DEFAULT FALSE,
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    pinned_at TIMESTAMPTZ,
    publish_at TIMESTAMPTZ,
    expire_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_announcements_status ON announcements(status);
CREATE INDEX idx_announcements_published_at ON announcements(published_at DESC);
CREATE INDEX idx_announcements_author ON announcements(author_id);
```

### 8.2 Table announcement_reads
```sql
CREATE TABLE announcement_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(announcement_id, user_id)
);

CREATE INDEX idx_announcement_reads_announcement ON announcement_reads(announcement_id);
```

### 8.3 Table announcement_reactions
```sql
CREATE TABLE announcement_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    reaction_type VARCHAR(20) NOT NULL CHECK (reaction_type IN ('thumbs_up', 'heart', 'clap', 'rocket')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(announcement_id, user_id, reaction_type)
);
```

### 8.4 Table news_articles
```sql
CREATE TABLE news_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    subtitle VARCHAR(300),
    content TEXT NOT NULL,
    content_html TEXT NOT NULL,
    excerpt VARCHAR(300),
    cover_image_url TEXT,
    cover_image_alt VARCHAR(200),
    category_id UUID REFERENCES news_categories(id),
    author_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    audience JSONB NOT NULL DEFAULT '{"type": "all"}',
    publish_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    reading_time_minutes INTEGER NOT NULL DEFAULT 1,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE news_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    icon VARCHAR(50),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE news_article_tags (
    article_id UUID NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    PRIMARY KEY(article_id, tag)
);
```

### 8.5 Table suggestions
```sql
CREATE TABLE suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    description_html TEXT NOT NULL,
    category VARCHAR(100),
    author_id UUID NOT NULL REFERENCES users(id),
    anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'planned', 'in_progress', 'done', 'rejected')),
    assigned_to UUID REFERENCES users(id),
    official_response TEXT,
    official_response_at TIMESTAMPTZ,
    official_response_by UUID REFERENCES users(id),
    merged_into UUID REFERENCES suggestions(id),
    score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE suggestion_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id UUID NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    vote_type SMALLINT NOT NULL CHECK (vote_type IN (-1, 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(suggestion_id, user_id)
);
```

### 8.6 Table polls
```sql
CREATE TABLE polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(300) NOT NULL,
    description TEXT,
    author_id UUID NOT NULL REFERENCES users(id),
    audience JSONB NOT NULL DEFAULT '{"type": "all"}',
    anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    show_results_before_close BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
    close_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    reminder_config JSONB DEFAULT '{"days_before": [3, 1, 0]}',
    response_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE poll_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    question_text VARCHAR(500) NOT NULL,
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('single_choice', 'multiple_choice', 'scale', 'free_text', 'matrix')),
    config JSONB NOT NULL DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES poll_questions(id) ON DELETE CASCADE,
    option_text VARCHAR(200) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE poll_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES poll_questions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    user_hash VARCHAR(64),
    option_id UUID REFERENCES poll_options(id),
    scale_value INTEGER,
    free_text TEXT,
    matrix_row VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_poll_responses_poll ON poll_responses(poll_id);
CREATE INDEX idx_poll_responses_question ON poll_responses(question_id);
```

### 8.7 Table newsletters
```sql
CREATE TABLE newsletters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content_mjml TEXT NOT NULL,
    content_html TEXT,
    content_text TEXT,
    template_id UUID REFERENCES newsletter_templates(id),
    author_id UUID NOT NULL REFERENCES users(id),
    audience JSONB NOT NULL DEFAULT '{"type": "all"}',
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    recipient_count INTEGER NOT NULL DEFAULT 0,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    bounced_count INTEGER NOT NULL DEFAULT 0,
    opened_count INTEGER NOT NULL DEFAULT 0,
    clicked_count INTEGER NOT NULL DEFAULT 0,
    unsubscribed_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE newsletter_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    content_mjml TEXT NOT NULL,
    thumbnail_url TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE newsletter_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    newsletter_id UUID NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255) NOT NULL,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('sent', 'delivered', 'bounced', 'opened', 'clicked', 'unsubscribed')),
    link_url TEXT,
    event_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_newsletter_tracking_newsletter ON newsletter_tracking(newsletter_id);

CREATE TABLE newsletter_unsubscribes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
    unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 8.8 Table signage
```sql
CREATE TABLE signage_screens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    building VARCHAR(100),
    floor VARCHAR(50),
    room VARCHAR(100),
    resolution VARCHAR(20) NOT NULL DEFAULT '1920x1080',
    orientation VARCHAR(10) NOT NULL DEFAULT 'landscape' CHECK (orientation IN ('landscape', 'portrait')),
    timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Paris',
    status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'paused')),
    pairing_code VARCHAR(6),
    pairing_code_expires_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE signage_playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    schedule_config JSONB DEFAULT '{"days": [1,2,3,4,5], "start_time": "08:00", "end_time": "20:00"}',
    screensaver_type VARCHAR(20) DEFAULT 'clock' CHECK (screensaver_type IN ('black', 'clock', 'image')),
    screensaver_image_url TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE signage_slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id UUID NOT NULL REFERENCES signage_playlists(id) ON DELETE CASCADE,
    slide_type VARCHAR(20) NOT NULL CHECK (slide_type IN ('text', 'image', 'video', 'announcement', 'weather', 'clock', 'iframe', 'news_carousel')),
    config JSONB NOT NULL DEFAULT '{}',
    duration_seconds INTEGER NOT NULL DEFAULT 10 CHECK (duration_seconds BETWEEN 3 AND 300),
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE signage_screen_playlists (
    screen_id UUID NOT NULL REFERENCES signage_screens(id) ON DELETE CASCADE,
    playlist_id UUID NOT NULL REFERENCES signage_playlists(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 0,
    time_slot_start TIME,
    time_slot_end TIME,
    PRIMARY KEY(screen_id, playlist_id)
);

CREATE TABLE signage_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    screen_id UUID NOT NULL REFERENCES signage_screens(id) ON DELETE CASCADE,
    slide_id UUID REFERENCES signage_slides(id) ON DELETE SET NULL,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('online', 'offline', 'slide_displayed')),
    event_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_signage_analytics_screen ON signage_analytics(screen_id, event_at);
```

### 8.9 Table comments (shared across sub-modules)
```sql
CREATE TABLE comms_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('announcement', 'article', 'suggestion')),
    entity_id UUID NOT NULL,
    parent_id UUID REFERENCES comms_comments(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    content_html TEXT NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comms_comments_entity ON comms_comments(entity_type, entity_id);
CREATE INDEX idx_comms_comments_parent ON comms_comments(parent_id);
```

---

## Categorie 9 -- REST API Endpoints

### 9.1 Announcements API

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/comms/announcements` | List announcements (paginated, filterable by status/priority/audience) |
| `GET` | `/api/v1/comms/announcements/{id}` | Get announcement detail |
| `POST` | `/api/v1/comms/announcements` | Create announcement (draft) |
| `PUT` | `/api/v1/comms/announcements/{id}` | Update announcement |
| `DELETE` | `/api/v1/comms/announcements/{id}` | Delete announcement (draft only) |
| `POST` | `/api/v1/comms/announcements/{id}/submit` | Submit for review |
| `POST` | `/api/v1/comms/announcements/{id}/approve` | Approve announcement |
| `POST` | `/api/v1/comms/announcements/{id}/reject` | Reject with reason |
| `POST` | `/api/v1/comms/announcements/{id}/publish` | Force publish (admin) |
| `POST` | `/api/v1/comms/announcements/{id}/archive` | Archive announcement |
| `POST` | `/api/v1/comms/announcements/{id}/pin` | Pin announcement |
| `DELETE` | `/api/v1/comms/announcements/{id}/pin` | Unpin announcement |
| `POST` | `/api/v1/comms/announcements/{id}/read` | Mark as read (mandatory read) |
| `GET` | `/api/v1/comms/announcements/{id}/reads` | Get read receipts |
| `POST` | `/api/v1/comms/announcements/{id}/reactions` | Add reaction |
| `DELETE` | `/api/v1/comms/announcements/{id}/reactions/{type}` | Remove reaction |
| `GET` | `/api/v1/comms/announcements/{id}/stats` | Get announcement analytics |

### 9.2 News API

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/comms/news` | List articles (paginated, filterable by category/tag/author) |
| `GET` | `/api/v1/comms/news/{id}` | Get article detail |
| `POST` | `/api/v1/comms/news` | Create article |
| `PUT` | `/api/v1/comms/news/{id}` | Update article |
| `DELETE` | `/api/v1/comms/news/{id}` | Delete article |
| `POST` | `/api/v1/comms/news/{id}/publish` | Publish article |
| `POST` | `/api/v1/comms/news/{id}/feature` | Mark as featured |
| `DELETE` | `/api/v1/comms/news/{id}/feature` | Remove featured |
| `GET` | `/api/v1/comms/news/feed.xml` | RSS Atom feed |
| `GET` | `/api/v1/comms/news/categories` | List categories |
| `POST` | `/api/v1/comms/news/categories` | Create category (admin) |

### 9.3 Suggestions API

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/comms/suggestions` | List suggestions (sortable by score/date, filterable by status/category) |
| `GET` | `/api/v1/comms/suggestions/{id}` | Get suggestion detail |
| `POST` | `/api/v1/comms/suggestions` | Create suggestion |
| `PUT` | `/api/v1/comms/suggestions/{id}` | Update suggestion (author only) |
| `POST` | `/api/v1/comms/suggestions/{id}/vote` | Upvote or downvote (body: `{"type": 1}` or `{"type": -1}`) |
| `DELETE` | `/api/v1/comms/suggestions/{id}/vote` | Remove vote |
| `PUT` | `/api/v1/comms/suggestions/{id}/status` | Change status (admin) |
| `POST` | `/api/v1/comms/suggestions/{id}/respond` | Add official response (admin) |
| `POST` | `/api/v1/comms/suggestions/merge` | Merge suggestions (admin, body: `{"target_id": "...", "source_ids": ["..."]}`) |
| `GET` | `/api/v1/comms/suggestions/dashboard` | Get dashboard metrics (admin) |

### 9.4 Polls API

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/comms/polls` | List polls (active first, paginated) |
| `GET` | `/api/v1/comms/polls/{id}` | Get poll detail with questions and options |
| `POST` | `/api/v1/comms/polls` | Create poll |
| `PUT` | `/api/v1/comms/polls/{id}` | Update poll (draft only) |
| `DELETE` | `/api/v1/comms/polls/{id}` | Delete poll (draft only) |
| `POST` | `/api/v1/comms/polls/{id}/publish` | Publish poll (set status to active) |
| `POST` | `/api/v1/comms/polls/{id}/close` | Close poll manually |
| `POST` | `/api/v1/comms/polls/{id}/respond` | Submit responses (body: array of question_id + answer) |
| `GET` | `/api/v1/comms/polls/{id}/results` | Get aggregated results |
| `GET` | `/api/v1/comms/polls/{id}/export/csv` | Export results as CSV |
| `GET` | `/api/v1/comms/polls/{id}/export/pdf` | Export results as PDF report |

### 9.5 Newsletter API

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/comms/newsletters` | List newsletters (filterable by status) |
| `GET` | `/api/v1/comms/newsletters/{id}` | Get newsletter detail |
| `POST` | `/api/v1/comms/newsletters` | Create newsletter |
| `PUT` | `/api/v1/comms/newsletters/{id}` | Update newsletter |
| `DELETE` | `/api/v1/comms/newsletters/{id}` | Delete newsletter (draft only) |
| `POST` | `/api/v1/comms/newsletters/{id}/preview` | Send preview to author email |
| `POST` | `/api/v1/comms/newsletters/{id}/schedule` | Schedule send (body: `{"scheduled_at": "..."}`) |
| `POST` | `/api/v1/comms/newsletters/{id}/send` | Send immediately |
| `DELETE` | `/api/v1/comms/newsletters/{id}/schedule` | Cancel scheduled send |
| `GET` | `/api/v1/comms/newsletters/{id}/stats` | Get send metrics |
| `GET` | `/api/v1/comms/newsletters/{id}/track` | Redirect tracker for link clicks |
| `GET` | `/api/v1/comms/newsletters/archive` | List sent newsletters (public archive) |
| `GET` | `/api/v1/comms/newsletters/templates` | List templates |
| `POST` | `/api/v1/comms/newsletters/templates` | Create template |
| `POST` | `/api/v1/comms/newsletters/unsubscribe` | Unsubscribe from newsletters |

### 9.6 Signage API

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/comms/signage/screens` | List screens |
| `POST` | `/api/v1/comms/signage/screens` | Register screen |
| `PUT` | `/api/v1/comms/signage/screens/{id}` | Update screen |
| `DELETE` | `/api/v1/comms/signage/screens/{id}` | Delete screen |
| `POST` | `/api/v1/comms/signage/screens/{id}/pause` | Pause screen |
| `POST` | `/api/v1/comms/signage/screens/{id}/resume` | Resume screen |
| `POST` | `/api/v1/comms/signage/screens/{id}/restart` | Restart display |
| `GET` | `/api/v1/comms/signage/playlists` | List playlists |
| `POST` | `/api/v1/comms/signage/playlists` | Create playlist |
| `PUT` | `/api/v1/comms/signage/playlists/{id}` | Update playlist |
| `DELETE` | `/api/v1/comms/signage/playlists/{id}` | Delete playlist |
| `GET` | `/api/v1/comms/signage/playlists/{id}/slides` | Get slides for a playlist |
| `POST` | `/api/v1/comms/signage/playlists/{id}/slides` | Add slide |
| `PUT` | `/api/v1/comms/signage/playlists/{id}/slides/{slide_id}` | Update slide |
| `DELETE` | `/api/v1/comms/signage/playlists/{id}/slides/{slide_id}` | Delete slide |
| `PUT` | `/api/v1/comms/signage/playlists/{id}/slides/reorder` | Reorder slides (body: array of slide_ids) |
| `GET` | `/api/v1/comms/signage/display/{id}` | Display endpoint for kiosk mode (returns HTML page) |
| `WS` | `/api/v1/comms/signage/display/{id}/ws` | WebSocket for real-time playlist updates |

---

## Categorie 10 -- PgEventBus Events

### 10.1 Events emitted

| Event | Payload | Consumers |
|---|---|---|
| `comms.announcement.published` | `{id, title, priority, audience, author_id}` | signapps-notifications (push), signapps-gateway (search index), signage (critical announcements) |
| `comms.announcement.read` | `{announcement_id, user_id}` | signapps-notifications (update read counters) |
| `comms.news.published` | `{id, title, category, audience, author_id}` | signapps-notifications (push), signapps-gateway (search index), signage (news carousel) |
| `comms.suggestion.created` | `{id, title, anonymous, author_id}` | signapps-notifications (notify admins) |
| `comms.suggestion.voted` | `{suggestion_id, user_id, vote_type, new_score}` | signapps-notifications (notify author if milestone: 10, 50, 100 votes) |
| `comms.suggestion.status_changed` | `{suggestion_id, old_status, new_status, changed_by}` | signapps-notifications (notify author and voters) |
| `comms.poll.created` | `{id, title, audience, close_at}` | signapps-notifications (push to audience) |
| `comms.poll.responded` | `{poll_id, question_id}` | Real-time results update (WebSocket broadcast) |
| `comms.poll.closed` | `{id, title, response_count}` | signapps-notifications (notify author with results summary) |
| `comms.newsletter.sent` | `{id, title, recipient_count}` | signapps-notifications (confirm to author) |
| `comms.newsletter.opened` | `{newsletter_id, recipient_email}` | Increment open counter |
| `comms.newsletter.clicked` | `{newsletter_id, link_url, recipient_email}` | Increment click counter |
| `comms.signage.playlist_updated` | `{playlist_id, slides}` | WebSocket push to connected screens |
| `comms.signage.screen_status` | `{screen_id, status, timestamp}` | Admin dashboard real-time update |

---

## Categorie 11 -- Transversalites

### 11.1 Permissions par role
Roles : `comms:reader` (lecture seule, voter suggestions, repondre sondages), `comms:contributor` (reader + creer suggestions), `comms:editor` (contributor + creer annonces, articles, newsletters, sondages), `comms:admin` (tout, y compris signage, moderation, configuration des categories/templates, acces aux analytics). Mapping avec les roles RBAC de signapps-identity. Par defaut, tous les utilisateurs authentifies ont `comms:reader`.

### 11.2 Audit trail
Chaque action (creation, modification, publication, suppression, changement de statut, vote, reaction, lecture obligatoire) est enregistree dans la table `audit_log` avec : horodatage, user_id, action (ex: `comms.announcement.created`), entity_type, entity_id, metadata JSONB (ancien statut, nouveau statut, etc.). Consultable par les admins via `/admin/comms/audit`. Retention : 1 an. Export CSV.

### 11.3 Multi-langue
Les publications peuvent etre redigees en plusieurs langues. Champ `locale` sur chaque publication. L'utilisateur voit la version dans sa langue preferee (fallback : langue par defaut de l'organisation, defaut : `fr`). Traduction assistee par IA via signapps-ai : bouton `Traduire` dans l'editeur qui envoie le contenu au LLM et propose la traduction dans un panneau lateral.

### 11.4 Recherche unifiee
Toutes les publications (annonces, articles, suggestions, sondages, newsletters) sont indexees dans la recherche globale SignApps (`/search`). A la publication, un event PgEventBus declenche l'indexation dans le moteur de recherche. Resultats avec preview (titre, extrait 100 caracteres, type, date) et lien direct.

### 11.5 Integration chat
Partage rapide d'une publication dans un channel ou une DM du chat SignApps. Bouton `Partager` dans le menu d'actions de chaque publication. Le lien s'affiche avec un embed riche dans le chat : titre, extrait 80 caracteres, image de couverture (si article), badge de type (Annonce/Article/Suggestion/Sondage).

### 11.6 Notifications consolidees
Les notifications de communication sont groupees dans un digest pour eviter le spam. Frequence configurable par l'utilisateur dans ses preferences : temps reel (chaque notification individuellement), horaire (digest toutes les heures), quotidien (digest a 9h chaque matin). Le digest est envoye par email et/ou notification in-app. Contenu du digest : titre de chaque publication avec lien, groupe par type.

---

## References OSS

**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License -- ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Tiptap** (github.com/ueberdosis/tiptap) | **MIT** | Deja utilise dans SignApps. Editeur riche pour le contenu des annonces, articles, newsletters. Extensions (mentions, images, embeds). |
| **react-email** (github.com/resend/react-email) | **MIT** | Composants React pour generer du HTML email responsive. Pattern pour le rendu des newsletters en email. |
| **MJML** (github.com/mjmlio/mjml) | **MIT** | Framework de markup pour emails responsives. Compile en HTML compatible tous clients email. Base du builder newsletter. |
| **Strapi** (github.com/strapi/strapi) | **MIT** (avec EE modules) | Headless CMS. Pattern pour la gestion de contenu, workflows de publication, API REST auto. Attention aux modules EE. |
| **Novu** (github.com/novuhq/novu) | **MIT** | Infrastructure de notifications. Pattern pour le digest, les preferences utilisateur, les templates de notification. |
| **react-dnd** (github.com/react-dnd/react-dnd) | **MIT** | Drag-and-drop pour React. Pattern pour l'editeur de newsletter (blocs drag-and-drop) et l'ordonnancement des playlists signage. |
| **Recharts** (github.com/recharts/recharts) | **MIT** | Deja utilise dans SignApps. Graphiques pour les resultats de sondages (bar, pie) et analytics d'engagement. |

---

## Assertions E2E cles (a tester)

- Page `/comms` -> le hub s'affiche avec le titre `Communication` et 6 cartes de sous-modules
- Carte Annonces -> clic navigue vers `/comms/announcements`
- Carte Actualites -> clic navigue vers `/comms/news`
- Carte Suggestions -> clic navigue vers `/comms/suggestions`
- Carte Sondages -> clic navigue vers `/comms/polls`
- Carte Newsletter -> clic navigue vers `/comms/newsletter`
- Carte Affichage numerique -> clic navigue vers `/comms/signage`
- Recherche globale -> taper un terme retourne des resultats groupes par type
- Page Annonces -> la liste des annonces s'affiche avec titre, auteur, date, badge priorite
- Creation annonce -> le formulaire s'ouvre avec les champs titre, contenu, priorite, audience
- Annonce lecture obligatoire -> le bouton `Confirmer la lecture` est visible pour les destinataires
- Annonce lecture obligatoire -> le tableau de suivi affiche lu/non lu par destinataire avec barre de progression
- Annonce critique -> badge rouge avec animation pulse affiche
- Epinglage annonce -> l'annonce apparait dans la section epinglee en haut de la liste
- Reactions -> clic sur un emoji incremente le compteur et colore l'emoji
- Commentaire -> soumettre un commentaire l'affiche sous la publication
- Commentaire thread -> repondre a un commentaire affiche la reponse indentee
- Page Actualites -> le fil d'articles s'affiche en cartes avec image de couverture
- Article featured -> le premier article mis en avant est affiche en grand en haut
- Creation article -> l'editeur Tiptap se charge avec toolbar flottante
- Article programmation -> un article programme n'apparait pas dans le fil avant la date/heure
- Categories -> clic sur un onglet categorie filtre le fil instantanement
- RSS feed -> `GET /api/v1/comms/news/feed.xml` retourne un flux Atom valide
- Page Suggestions -> les suggestions sont triees par nombre de votes decroissant
- Vote suggestion -> clic sur fleche haut incremente le score de 1 et colore la fleche
- Downvote -> clic sur fleche bas decremente le score de 1
- Suggestion anonyme -> le nom de l'auteur n'est pas affiche publiquement
- Changement statut suggestion -> notification envoyee a l'auteur et aux votants
- Reponse officielle -> affichee avec bordure bleue et badge officiel
- Page Sondages -> les sondages actifs sont affiches en priorite avec indicateur non repondu
- Creation sondage -> ajout dynamique d'options, selection du type de question
- Participation sondage -> soumettre une reponse met a jour les resultats en temps reel
- Sondage multi-questions -> navigation par etapes avec barre de progression
- Sondage anonyme -> les resultats ne montrent pas les repondants individuels
- Export sondage CSV -> le fichier contient les reponses anonymisees si sondage anonyme
- Page Newsletter -> la liste des newsletters affiche brouillons, programmees, envoyees
- Editeur newsletter -> les blocs drag-and-drop (texte, image, bouton, colonnes) sont disponibles
- Template newsletter -> selectionner un template pre-remplit l'editeur
- Preview newsletter -> bouton envoie un email de test a l'auteur
- Metriques newsletter -> taux d'ouverture et clics affiches apres envoi
- Desabonnement -> clic sur le lien desabonne l'utilisateur et confirme
- Page Signage -> la liste des ecrans et playlists s'affiche
- Enregistrement ecran -> le code d'appairage a 6 chiffres est genere
- Editeur playlist -> drag-and-drop des slides pour reordonner
- Types de slides -> chaque type (texte, image, video, meteo, horloge, iframe) est ajouable
- Preview playlist -> la simulation des slides defile avec les durees configurees
- URL d'affichage signage -> la page `/signage/display/{id}` charge le contenu plein ecran sans barre d'adresse
- Push temps reel -> modifier une playlist met a jour l'ecran connecte sans rechargement
- Ecran hors ligne -> le statut passe a rouge apres 1 minute sans ping
- Recherche globale -> une annonce publiee apparait dans les resultats de recherche SignApps
- Permissions -> un `comms:reader` ne voit pas les boutons de creation
- Service indisponible -> message d'erreur gracieux `Donnees non disponibles`
