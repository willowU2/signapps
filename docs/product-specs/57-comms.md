# Module Communication interne (Comms) — Specification fonctionnelle

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

1. **Hub de navigation central** — la page `/comms` est un hub qui dirige vers 6 sous-modules (Annonces, Actualites, Suggestions, Sondages, Newsletter, Affichage numerique). Chaque sous-module est une page dediee avec son propre workflow. Les cartes sur le hub montrent le nombre d'elements actifs par sous-module.
2. **Communication ciblee** — chaque publication (annonce, actualite, newsletter) peut cibler une audience specifique : toute l'organisation, un departement, un groupe, un site geographique, un role. Le ciblage determine qui voit le contenu et qui recoit la notification.
3. **Engagement mesurable** — chaque publication enregistre les metriques d'engagement : vues, reactions (like/coeur/bravo), commentaires, partages. Les annonces critiques supportent la lecture obligatoire avec accusation de reception.
4. **Workflow de validation** — les publications suivent un workflow : brouillon → en revue → approuvee → publiee → archivee. Les approbateurs sont configurables par sous-module. Programmation de publication a une date/heure future.
5. **Richesse editoriale** — l'editeur de contenu supporte le texte riche (Tiptap), les images, videos, liens, fichiers joints, mentions d'utilisateurs et embeds de contenu SignApps (taches, events, documents). Preview avant publication.
6. **Accessibilite multi-canal** — les publications sont accessibles via l'interface web, l'app mobile (PWA), les notifications push, et l'email digest. L'affichage numerique (digital signage) permet de diffuser sur des ecrans physiques.

---

## Categorie 1 — Page Hub Communication

### 1.1 En-tete de page
Titre `Communication` avec sous-titre `Gerez vos communications internes et externes`. Breadcrumb : Accueil > Communication.

### 1.2 Grille de sous-modules
Six cartes disposees en grille responsive (3 colonnes desktop, 2 tablette, 1 mobile). Chaque carte affiche : icone, titre du sous-module, description courte, badge compteur (elements actifs/non lus), bouton `Acceder a [module]`. Les cartes sont cliquables dans leur integralite.

### 1.3 Carte Annonces
Icone megaphone. Titre `Annonces`. Description `Communications officielles et obligatoires`. Badge : nombre d'annonces actives non lues par l'utilisateur courant. Navigation vers `/comms/announcements`.

### 1.4 Carte Actualites
Icone journal. Titre `Actualites`. Description `Fil d'actualites de l'organisation`. Badge : nombre d'articles publies cette semaine. Navigation vers `/comms/news`.

### 1.5 Carte Suggestions
Icone ampoule. Titre `Suggestions`. Description `Boite a idees collaborative`. Badge : nombre de suggestions ouvertes. Navigation vers `/comms/suggestions`.

### 1.6 Carte Sondages
Icone graphique barres. Titre `Sondages`. Description `Consultez et participez aux sondages`. Badge : nombre de sondages actifs auxquels l'utilisateur n'a pas repondu. Navigation vers `/comms/polls`.

### 1.7 Carte Newsletter
Icone enveloppe. Titre `Newsletter`. Description `Creer et envoyer des newsletters`. Badge : nombre de newsletters en brouillon. Navigation vers `/comms/newsletter`.

### 1.8 Carte Affichage numerique
Icone ecran/moniteur. Titre `Affichage numerique`. Description `Digital signage pour vos ecrans`. Badge : nombre de playlists actives. Navigation vers `/comms/signage`.

### 1.9 Recherche globale communications
Barre de recherche en haut de la page permettant de chercher dans tous les sous-modules a la fois : annonces, articles, suggestions, sondages, newsletters. Resultats groupes par type.

### 1.10 Statistiques rapides
Bandeau optionnel sous le titre : nombre total de publications ce mois, taux d'engagement moyen, nombre de suggestions en attente de traitement. Visible uniquement pour les roles communication/admin.

---

## Categorie 2 — Annonces

### 2.1 Liste des annonces
Page `/comms/announcements` avec liste des annonces triees par date de publication (plus recente en haut). Chaque annonce affiche : titre, extrait (150 caracteres), auteur, date, badge de priorite (normal, important, critique), compteur de vues, indicateur de lecture obligatoire.

### 2.2 Filtres et recherche
Filtres par : statut (actif, archive), priorite (normal, important, critique), auteur, date (plage), audience cible. Recherche full-text dans le titre et le contenu.

### 2.3 Detail d'une annonce
Page de detail avec : titre en grand, badge priorite, auteur avec avatar, date de publication, contenu riche (texte, images, videos, fichiers joints), metriques d'engagement (vues, reactions, commentaires), section commentaires en bas.

### 2.4 Lecture obligatoire
Les annonces marquees `lecture obligatoire` affichent un bouton `Marquer comme lu` que chaque destinataire doit cliquer. L'auteur voit un tableau de suivi : liste des destinataires avec statut lu/non lu et date de lecture. Relance automatique par notification pour les retardataires (configurable : J+1, J+3, J+7).

### 2.5 Creation d'annonce
Formulaire : titre (obligatoire), contenu riche (editeur Tiptap), priorite (select : normal/important/critique), audience cible (multi-select : organisation/departement/groupe/site), lecture obligatoire (toggle), date de publication (immediate ou programmee), date d'expiration (optionnelle), fichiers joints (drag-and-drop).

### 2.6 Workflow de publication
Statuts : brouillon → en revue → approuvee → publiee → archivee. Les brouillons sont visibles uniquement par l'auteur. Le passage en revue notifie les approbateurs designes. L'approbation declenche la publication (ou la programmation). Archivage manuel ou automatique a la date d'expiration.

### 2.7 Reactions et commentaires
Sous chaque annonce : reactions (pouce, coeur, applaudissement, fusee) et section commentaires. Les commentaires supportent le texte riche et les mentions. Moderation : l'auteur ou un admin peut supprimer un commentaire.

### 2.8 Notifications push
A la publication, une notification push est envoyee aux membres de l'audience cible via signapps-notifications. Les annonces critiques envoient une notification avec son/vibration distinctif.

### 2.9 Epinglage
Les annonces peuvent etre epinglees en haut de la liste pour rester visibles meme quand de nouvelles annonces arrivent. Maximum 3 annonces epinglees simultanement.

---

## Categorie 3 — Actualites

### 3.1 Fil d'actualites
Page `/comms/news` avec un fil de type blog/magazine. Les articles sont affiches en cartes avec : image de couverture, titre, extrait, auteur, date, tags/categories, temps de lecture estime, compteur de vues.

### 3.2 Categories d'articles
Systeme de categories configurables par l'admin : Vie d'entreprise, Technique, RH, Evenements, Projets, Partenaires, etc. Filtre par categorie dans la sidebar ou via des onglets.

### 3.3 Editeur d'article
Editeur WYSIWYG complet (Tiptap) avec : titres (H1-H3), paragraphes, listes, citations, code, images (upload ou drag-and-drop), videos (embed YouTube/Vimeo ou upload), tableaux, separateurs, mentions, liens internes SignApps.

### 3.4 Image de couverture
Champ upload pour l'image de couverture affichee en haut de l'article et comme vignette dans le fil. Recadrage automatique aux dimensions standard (16:9). Texte alternatif obligatoire pour l'accessibilite.

### 3.5 Metadonnees article
Champs : titre, sous-titre (optionnel), categorie (select), tags (multi-input), auteur (par defaut l'utilisateur courant, modifiable par admin), date de publication, extrait personnalise (sinon auto-genere depuis le debut du contenu).

### 3.6 Programmation de publication
Date/heure de publication future. L'article reste en statut `programme` jusqu'a l'heure prevue, puis bascule automatiquement en `publie`. Preview de l'article avant publication.

### 3.7 Interactions sociales
Sous chaque article : compteur de vues, reactions (memes que les annonces), commentaires avec threads (reponse a un commentaire), bouton de partage (copier le lien, envoyer en chat SignApps).

### 3.8 Articles mis en avant
Les editeurs peuvent marquer un article comme `mis en avant` pour l'afficher en tete du fil avec un style visuel different (plus grand, bordure coloree).

### 3.9 RSS feed interne
Un flux RSS interne (`/api/v1/comms/news/feed.xml`) permet d'integrer les actualites dans d'autres outils ou lecteurs RSS.

---

## Categorie 4 — Boite a suggestions

### 4.1 Liste des suggestions
Page `/comms/suggestions` avec liste des suggestions triees par votes (plus populaires en haut) ou par date. Chaque suggestion affiche : titre, description courte, auteur (ou anonyme), date, nombre de votes, statut (ouverte, en cours d'etude, acceptee, rejetee, implementee).

### 4.2 Soumission de suggestion
Formulaire : titre (obligatoire), description detaillee (editeur riche), categorie (optionnel), anonyme (toggle — si active, l'auteur n'est pas visible publiquement mais reste enregistre pour l'admin). Fichiers joints possibles (captures d'ecran, documents).

### 4.3 Systeme de votes
Chaque utilisateur peut voter une fois par suggestion (upvote). Le score total determine le classement. L'utilisateur peut retirer son vote. Les votes sont visibles (liste des votants) sauf si la suggestion est anonyme (seul le compteur est montre).

### 4.4 Statuts et workflow
Workflow : ouverte → en cours d'etude → acceptee/rejetee → implementee. Le changement de statut est notifie a l'auteur et aux votants. Le responsable peut ajouter un commentaire officiel expliquant la decision.

### 4.5 Commentaires et discussion
Section commentaires sous chaque suggestion pour que la communaute discute de la faisabilite, propose des ameliorations, ou apporte du contexte supplementaire.

### 4.6 Moderation
Les administrateurs peuvent : modifier le statut, assigner un responsable d'evaluation, fusionner des suggestions doublons, masquer les suggestions inappropriees, exporter la liste en CSV.

### 4.7 Tableau de bord suggestions
Vue admin avec : nombre de suggestions par statut (camembert), top 10 les plus votees, tendance de soumission (line chart par semaine), temps moyen de traitement, taux d'acceptation.

---

## Categorie 5 — Sondages

### 5.1 Liste des sondages
Page `/comms/polls` avec sondages actifs affiches en priorite, suivis des sondages clotures. Chaque sondage affiche : question, nombre de reponses, date de cloture, statut (actif, cloture), indicateur si l'utilisateur a deja repondu.

### 5.2 Creation de sondage
Formulaire : question principale (texte), type de reponse (choix unique, choix multiple, echelle 1-5, texte libre, matrice), options de reponse (ajout dynamique), date de cloture, audience cible, anonyme (toggle), resultat visible avant cloture (toggle).

### 5.3 Types de questions
- **Choix unique** : radio buttons, une seule reponse possible
- **Choix multiple** : checkboxes, plusieurs reponses possibles, option `Autre` avec texte libre
- **Echelle** : slider ou radio 1-5 (ou 1-10), labels configurable (ex: Pas du tout d'accord → Tout a fait d'accord)
- **Texte libre** : textarea pour reponse ouverte
- **Matrice** : grille avec lignes (sous-questions) et colonnes (echelle), utile pour les evaluations multi-criteres

### 5.4 Sondage multi-questions
Un sondage peut contenir plusieurs questions (sections). Navigation par etapes ou affichage en scroll. Barre de progression pour les sondages longs.

### 5.5 Resultats en temps reel
Les resultats s'affichent sous forme de graphiques : bar chart horizontal pour les choix, pie chart pour les proportions, moyenne et distribution pour les echelles, nuage de mots pour les textes libres. Mise a jour en temps reel a mesure que les reponses arrivent.

### 5.6 Anonymat
Si le sondage est anonyme, les reponses individuelles ne sont pas tracables. Seuls les resultats agreges sont visibles. L'admin ne peut pas associer une reponse a un utilisateur.

### 5.7 Cloture et rappels
Le sondage se cloture automatiquement a la date prevue. Rappels automatiques envoyes aux non-repondants (configurable : J-3, J-1). Cloture manuelle anticipee possible par l'auteur.

### 5.8 Export des resultats
Bouton d'export CSV avec toutes les reponses (anonymisees si sondage anonyme). Export PDF du rapport graphique.

---

## Categorie 6 — Newsletter

### 6.1 Liste des newsletters
Page `/comms/newsletter` avec liste des newsletters triees par date. Statuts : brouillon, programmee, envoyee. Chaque entree affiche : titre, date d'envoi, nombre de destinataires, taux d'ouverture (apres envoi).

### 6.2 Editeur de newsletter
Editeur drag-and-drop type Staffbase/Mailchimp avec blocs : en-tete (logo + titre), texte riche, image, bouton CTA, separateur, colonnes 2/3, citation, lien vers article actualite SignApps. Templates preconfigures (Hebdo, Mensuelle, Flash info).

### 6.3 Templates
Bibliotheque de templates : layout simple (1 colonne), layout magazine (2 colonnes), flash info (court, 1 bloc), rapport mensuel (sections structurees avec stats). L'admin peut creer des templates custom.

### 6.4 Audience et segmentation
Selection des destinataires : toute l'organisation, departement(s), groupe(s), liste de diffusion personnalisee. Preview du nombre de destinataires avant envoi.

### 6.5 Programmation d'envoi
Date et heure d'envoi futur. L'email est genere et mis en queue. Annulation possible jusqu'a 5 minutes avant l'heure programmee.

### 6.6 Envoi par email
La newsletter est envoyee par email via signapps-mail (SMTP). Le contenu est rendu en HTML responsive compatible avec les principaux clients email (Outlook, Gmail, Apple Mail). Version texte brut en fallback.

### 6.7 Metriques post-envoi
Apres envoi, le tableau de bord affiche : nombre d'emails envoyes, delivres, ouverts (taux d'ouverture), clics sur liens (taux de clic), desabonnements. Graphique d'ouverture par heure.

### 6.8 Desabonnement
Lien de desabonnement obligatoire en bas de chaque newsletter. L'utilisateur desabonne ne recoit plus les newsletters mais reste dans l'organisation. Liste des desabonnes visible par l'admin.

### 6.9 Archive publique
Les newsletters envoyees sont archivees et consultables dans l'interface web a `/comms/newsletter/archive`. Utile pour les nouveaux arrivants qui veulent rattraper l'historique.

---

## Categorie 7 — Affichage numerique (Digital Signage)

### 7.1 Vue d'ensemble
Page `/comms/signage` avec la liste des ecrans enregistres et des playlists de contenu. Dashboard : nombre d'ecrans connectes, nombre de playlists actives, contenu en diffusion.

### 7.2 Gestion des ecrans
Enregistrement d'un ecran physique : nom, emplacement (batiment/etage/salle), resolution, orientation (paysage/portrait), fuseau horaire. Chaque ecran recoit une URL unique d'affichage (`/signage/display/{id}`). Statut : en ligne, hors ligne, en pause.

### 7.3 Playlists de contenu
Une playlist est une sequence ordonnee de diapositives (slides). Chaque slide a une duree d'affichage (en secondes, defaut 10s). La playlist boucle indefiniment. Drag-and-drop pour reordonner les slides.

### 7.4 Types de slides
- **Texte riche** : message avec titre, corps, couleur de fond, police. Pour les annonces rapides.
- **Image** : image plein ecran uploadee ou depuis le Drive SignApps. Support JPEG, PNG, WebP.
- **Video** : video en boucle (MP4, WebM). Duree = duree de la video.
- **Annonce SignApps** : affiche automatiquement la derniere annonce critique publiee dans le module annonces.
- **Meteo** : widget meteo avec la localisation de l'ecran (via API meteo externe ou config manuelle).
- **Horloge** : affichage date/heure en grand format. Utile comme slide de fond entre les contenus.
- **Webpage embed** : iframe vers une URL (dashboard interne, page web, rapport).
- **Actualites SignApps** : carrousel des 5 derniers articles du fil d'actualites.

### 7.5 Planification de diffusion
Chaque playlist peut etre planifiee : jours de la semaine (lun-ven, tous les jours, custom), heures de diffusion (8h-20h par defaut), date de debut et date de fin. En dehors des heures, l'ecran affiche un ecran de veille configurable.

### 7.6 Assignation ecran-playlist
Assigner une ou plusieurs playlists a un ecran. Si plusieurs playlists, elles sont jouees en sequence. Priorite configurable (une annonce urgente interrompt la playlist normale).

### 7.7 Preview
Bouton de preview pour visualiser une playlist dans le navigateur avant de l'assigner a un ecran physique. Simulation du cycle de slides avec les durees configurees.

### 7.8 Mode kiosque
L'URL d'affichage (`/signage/display/{id}`) est concue pour tourner en mode kiosque (plein ecran, pas de barre d'adresse). Compatible Chromium kiosk mode sur Raspberry Pi, smart TV, ou PC dedie. Reconnexion automatique en cas de perte reseau.

### 7.9 Push de contenu en temps reel
Quand une playlist est modifiee, le changement est pousse en temps reel vers l'ecran via WebSocket (signapps-collab). Pas besoin de rafraichir manuellement l'ecran.

### 7.10 Analytics d'affichage
Metriques par ecran : uptime, nombre de slides affichees, duree totale de diffusion. Metriques par slide : nombre d'impressions. Dashboard admin pour monitorer le parc d'ecrans.

---

## Categorie 8 — Transversalites

### 8.1 Permissions par role
Roles : `comms:reader` (lecture seule), `comms:contributor` (creer suggestions, repondre sondages), `comms:editor` (creer annonces, articles, newsletters, sondages), `comms:admin` (tout, y compris signage et moderation). Mapping avec les roles RBAC de signapps-identity.

### 8.2 Audit trail
Chaque action (creation, modification, publication, suppression, changement de statut) est enregistree dans un journal d'audit avec : horodatage, utilisateur, action, entite concernee. Consultable par les admins.

### 8.3 Multi-langue
Les publications peuvent etre redigees en plusieurs langues. L'utilisateur voit la version dans sa langue preferee (fallback : langue par defaut de l'organisation). Traduction assistee par IA via signapps-ai.

### 8.4 Recherche unifiee
Toutes les publications (annonces, articles, suggestions, sondages, newsletters) sont indexees dans la recherche globale SignApps (`/search`). Resultats avec preview et lien direct.

### 8.5 Integration chat
Partage rapide d'une publication dans un channel ou une DM du chat SignApps. Le lien s'affiche avec un embed riche (titre, extrait, image).

### 8.6 Notifications consolidees
Les notifications de communication sont groupees dans un digest (email ou in-app) pour eviter le spam. Frequence configurable par l'utilisateur : temps reel, horaire, quotidien.

### 8.7 API REST
Tous les sous-modules exposent une API REST documentee OpenAPI : `GET/POST/PUT/DELETE /api/v1/comms/announcements`, `/api/v1/comms/news`, `/api/v1/comms/suggestions`, `/api/v1/comms/polls`, `/api/v1/comms/newsletters`, `/api/v1/comms/signage`. Auth JWT requise.

### 8.8 PgEventBus
Les evenements de publication sont diffuses via PgEventBus : `comms.announcement.published`, `comms.news.published`, `comms.poll.created`, `comms.suggestion.voted`, `comms.newsletter.sent`. Les autres services (notifications, search, analytics) s'abonnent a ces evenements.

---

## References OSS

**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Tiptap** (github.com/ueberdosis/tiptap) | **MIT** | Deja utilise dans SignApps. Editeur riche pour le contenu des annonces, articles, newsletters. Extensions (mentions, images, embeds). |
| **react-email** (github.com/resend/react-email) | **MIT** | Composants React pour generer du HTML email responsive. Pattern pour le rendu des newsletters en email. |
| **MJML** (github.com/mjmlio/mjml) | **MIT** | Framework de markup pour emails responsives. Alternative a react-email pour le templating newsletter. |
| **Directus** (github.com/directus/directus) | **BSL-1.1** | **INTERDIT** — reference pedagogique uniquement. Pattern headless CMS, content modeling, permissions. |
| **Strapi** (github.com/strapi/strapi) | **MIT** (avec EE modules) | Headless CMS. Pattern pour la gestion de contenu, workflows de publication, API REST auto. Attention aux modules EE. |
| **Focalboard** (github.com/mattermost/focalboard) | **MIT/AGPL** | Pattern pour les vues kanban (suggestions par statut), votes, filtres. Verifier la licence par fichier. |
| **Novu** (github.com/novuhq/novu) | **MIT** | Infrastructure de notifications. Pattern pour le digest, les preferences utilisateur, les templates de notification. |
| **Rallly** (github.com/lukevella/rallly) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Pattern pour les sondages/polls avec planification. |
| **react-dnd** (github.com/react-dnd/react-dnd) | **MIT** | Drag-and-drop pour React. Pattern pour l'editeur de newsletter (blocs drag-and-drop) et l'ordonnancement des playlists signage. |
| **Recharts** (github.com/recharts/recharts) | **MIT** | Deja utilise dans SignApps. Graphiques pour les resultats de sondages (bar, pie) et analytics d'engagement. |

---

## Assertions E2E cles (a tester)

- Page `/comms` → le hub s'affiche avec le titre `Communication` et 6 cartes de sous-modules
- Carte Annonces → clic navigue vers `/comms/announcements`
- Carte Actualites → clic navigue vers `/comms/news`
- Carte Suggestions → clic navigue vers `/comms/suggestions`
- Carte Sondages → clic navigue vers `/comms/polls`
- Carte Newsletter → clic navigue vers `/comms/newsletter`
- Carte Affichage numerique → clic navigue vers `/comms/signage`
- Page Annonces → la liste des annonces s'affiche avec titre, auteur, date, badge priorite
- Creation annonce → le formulaire s'ouvre avec les champs titre, contenu, priorite, audience
- Annonce lecture obligatoire → le bouton `Marquer comme lu` est visible pour les destinataires
- Annonce lecture obligatoire → le tableau de suivi affiche lu/non lu par destinataire
- Page Actualites → le fil d'articles s'affiche en cartes avec image de couverture
- Creation article → l'editeur Tiptap se charge avec les blocs de contenu riche
- Article programmation → un article programme n'apparait pas dans le fil avant la date/heure
- Page Suggestions → les suggestions sont triees par nombre de votes decroissant
- Vote suggestion → clic sur le bouton vote incremente le compteur de 1
- Suggestion anonyme → le nom de l'auteur n'est pas affiche publiquement
- Page Sondages → les sondages actifs sont affiches en priorite avec indicateur non repondu
- Participation sondage → soumettre une reponse met a jour les resultats en temps reel
- Sondage anonyme → les resultats ne montrent pas les repondants individuels
- Page Newsletter → la liste des newsletters affiche brouillon, programmee, envoyee
- Editeur newsletter → les blocs drag-and-drop (texte, image, bouton) sont disponibles
- Page Signage → la liste des ecrans et playlists s'affiche
- Preview playlist → la simulation des slides defile avec les durees configurees
- URL d'affichage signage → la page `/signage/display/{id}` charge le contenu plein ecran
- Recherche globale → une annonce publiee apparait dans les resultats de recherche SignApps
- Service indisponible → message d'erreur gracieux `Donnees non disponibles`
