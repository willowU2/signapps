# Module Centre d'aide (Help) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Zendesk Help Center** | Knowledge base hierarchique (categories/sections/articles), recherche full-text avec suggestions, widget embeddable, feedback par article (utile/pas utile), versionning d'articles, themes custom, multi-langue, community forums, analytics de consultation, SEO optimise |
| **Intercom Help** | Articles organises par collection, editeur WYSIWYG, recherche instantanee avec autosuggestions, messenger integre, bots de triage, resolution automatique par AI, analytics de performance des articles, feedback utilisateur, multi-langue, targeted content |
| **Notion Help Center** | Structure en pages imbriquees, breadcrumb navigation, table des matieres auto, recherche rapide, categories visuelles avec icones, liens croises entre articles, mise a jour frequente, design epure |
| **Google Workspace Help** | FAQ par produit, articles step-by-step avec captures d'ecran, troubleshooter interactif, communaute d'entraide, status dashboard des services, formulaire de signalement, chat support, assistant AI |
| **Freshdesk Knowledge Base** | Categorisation multi-niveaux, editeur rich text, articles publics et internes, workflow d'approbation, SEO meta, feedback article, analytics, multi-langue, auto-suggest dans le widget support, conversion article → ticket |
| **Atlassian Confluence Help** | Spaces par produit, macros interactives (expand, status, code), labels/tags, arborescence de pages, recherche avancee avec filtres, templates d'articles, permissions par page, commentaires inline |
| **HubSpot Knowledge Base** | Categories et sous-categories, editeur drag-drop, analytics par article (vues, votes, tickets evites), SEO auto, recherche avec suggestions, widget de support integre, feedback loop, multi-langue |
| **Crisp Helpdesk** | Knowledge base categorisee, recherche instantanee, widget chat + help center combine, editeur markdown, statut des articles (draft/published), analytics, multi-langue, SDK embeddable, bot integre |

## Principes directeurs

1. **Self-service d'abord** — l'utilisateur doit trouver la reponse a 80% de ses questions sans contacter le support. La FAQ, les guides et le troubleshooter sont les premiers points de contact. Le formulaire de ticket est le dernier recours.
2. **Organisation par domaine fonctionnel** — les articles sont groupes par section correspondant aux modules SignApps (Compte, Documents, Mail, Calendrier, Stockage, IA, Securite, Administration, Navigation). L'utilisateur identifie immediatement la section pertinente.
3. **Recherche et decouverte rapides** — barre de recherche en haut de page avec auto-suggestions. Chaque section est scannable en quelques secondes grace aux questions affichees sous forme d'accordeons expansibles.
4. **Feedback bidirectionnel** — chaque article propose un vote utile/pas utile. Le formulaire de support permet de soumettre des demandes non couvertes. Le retour utilisateur alimente l'amelioration continue du contenu.
5. **Statut operationnel transparent** — le centre d'aide inclut un verificateur de sante des services (health check). L'utilisateur peut voir en temps reel quels services sont operationnels, degrades ou en panne.
6. **Assistance AI contextuelle** — l'assistant IA SignApps est integre dans le centre d'aide. Il peut repondre aux questions en langage naturel, citer les articles pertinents, et escalader vers un ticket humain si necessaire.

---

## Categorie 1 — FAQ et articles d'aide

### 1.1 Structure par sections
La page /help affiche les sections suivantes, chacune correspondant a un domaine fonctionnel :
- **Compte** — gestion du profil, mot de passe, authentification
- **Documents** — editeur, partage, historique de versions
- **Mail** — configuration, envoi/reception, filtres
- **Calendrier** — evenements, invitations, synchronisation
- **Stockage** — upload, telechargement, partage de fichiers
- **IA** — assistant, fonctionnalites AI, modeles
- **Securite** — chiffrement, 2FA, sessions
- **Administration** — parametres organisation, roles, utilisateurs
- **Navigation generale** — raccourcis, interface, personnalisation

Chaque section est un bloc visuel distinct avec un titre, une icone representative et la liste des questions.

### 1.2 Questions sous forme d'accordeon
Chaque question est affichee sous forme d'un element accordeon (expand/collapse). Titre de la question visible. Clic sur la question → expansion du contenu avec la reponse detaillee. Un seul accordeon ouvert a la fois par section (ou mode multi-ouverture configurable).

### 1.3 Contenu des reponses
Les reponses contiennent du texte structure avec : paragraphes, listes a puces, liens vers d'autres sections/modules, code inline pour les raccourcis clavier, images/captures d'ecran annotees, et etapes numerotees pour les procedures. Le format est du rich text stocke en HTML sanitise.

### 1.4 Articles de la section Compte
- Comment changer mon mot de passe ?
- Comment activer la double authentification (2FA) ?
- Comment modifier mon adresse email ?
- Comment mettre a jour ma photo de profil ?
- Comment configurer mes preferences de notification ?
- Comment supprimer mon compte ?
- Comment recuperer l'acces a mon compte verrouille ?

### 1.5 Articles de la section Documents
- Comment creer un nouveau document ?
- Comment partager un document avec des collegues ?
- Comment consulter l'historique des versions ?
- Comment restaurer une version precedente ?
- Comment exporter un document en PDF ?
- Comment utiliser les modeles de documents ?
- Comment collaborer en temps reel sur un document ?

### 1.6 Articles de la section Mail
- Comment configurer mon compte mail ?
- Comment envoyer un email avec piece jointe ?
- Comment creer des filtres de tri automatique ?
- Comment creer une signature email ?
- Comment programmer l'envoi d'un email ?
- Comment gerer les dossiers et labels ?
- Comment signaler un email comme spam ?

### 1.7 Articles de la section Calendrier
- Comment creer un evenement ?
- Comment inviter des participants a une reunion ?
- Comment synchroniser avec Google Calendar ?
- Comment configurer les rappels ?
- Comment gerer les plages de disponibilite ?
- Comment creer un evenement recurrent ?
- Comment partager mon calendrier ?

### 1.8 Articles de la section Stockage
- Comment uploader un fichier ?
- Comment organiser mes fichiers en dossiers ?
- Comment partager un fichier ou un dossier ?
- Comment generer un lien de partage externe ?
- Quels formats de fichiers sont supportes ?
- Quelle est la taille maximale d'upload ?
- Comment recuperer un fichier supprime ?

### 1.9 Articles de la section IA
- Quelles fonctionnalites IA sont disponibles ?
- Comment utiliser l'assistant IA dans l'editeur ?
- Comment generer un resume de document par IA ?
- Comment utiliser la transcription vocale ?
- Comment configurer le fournisseur IA (Ollama, OpenAI, Anthropic) ?
- Quels modeles IA sont disponibles localement ?
- Les donnees sont-elles envoyees a l'exterieur avec l'IA locale ?

### 1.10 Articles de la section Securite
- Comment activer le chiffrement de bout en bout ?
- Comment gerer mes sessions actives ?
- Comment revoquer un token d'acces ?
- Comment configurer les politiques de mot de passe ?
- Comment consulter les logs d'audit de securite ?
- Comment detecter les connexions suspectes ?

### 1.11 Articles de la section Administration
- Comment ajouter un nouvel utilisateur ?
- Comment configurer les roles et permissions ?
- Comment gerer les groupes organisationnels ?
- Comment configurer le domaine personnalise ?
- Comment consulter les statistiques d'utilisation ?
- Comment configurer les politiques de retention ?

### 1.12 Articles de la section Navigation generale
- Quels sont les raccourcis clavier disponibles ?
- Comment personnaliser la barre laterale ?
- Comment activer le mode sombre ?
- Comment changer la langue de l'interface ?
- Comment utiliser la recherche globale ?
- Comment configurer le tableau de bord ?

---

## Categorie 2 — Recherche et decouverte

### 2.1 Barre de recherche principale
En haut de la page /help, barre de recherche avec placeholder `Rechercher dans l'aide...`. La recherche s'active des le 2e caractere tape. Resultats affiches en temps reel sous la barre sous forme de dropdown avec les questions correspondantes groupees par section.

### 2.2 Algorithme de recherche
Recherche full-text sur le titre de la question et le contenu de la reponse. Ranking par pertinence (titre match > contenu match). Stemming et tolerance aux fautes de frappe (fuzzy matching). Les termes recherches sont mis en surbrillance dans les resultats.

### 2.3 Suggestions de recherche
Quand l'utilisateur commence a taper, le systeme suggere des questions populaires (basees sur les consultations les plus frequentes). Les suggestions sont affichees en italique sous la barre avant que les resultats apparaissent.

### 2.4 Zero resultats
Si aucun resultat n'est trouve, affichage : `Aucun article ne correspond a votre recherche` avec suggestions : (1) Reformuler la question, (2) Parcourir les sections ci-dessous, (3) Contacter le support via le formulaire. Un lien direct vers le formulaire de ticket est propose.

### 2.5 Analytics de recherche
Les termes recherches sont loggues (anonymises) pour identifier les questions frequentes non couvertes. Un dashboard admin affiche : termes les plus recherches, recherches sans resultat, taux de clic sur les resultats.

---

## Categorie 3 — Verification des services (Health Check)

### 3.1 Bouton Verifier les services
Bouton prominent sur la page /help : `Verifier les services`. Le clic lance un health check de tous les microservices SignApps via l'API gateway.

### 3.2 Affichage de l'etat des services
Apres verification, affichage d'une liste des services avec indicateur d'etat :
- **Vert** (operationnel) — le service repond normalement
- **Jaune** (degrade) — le service repond avec latence elevee ou erreurs intermittentes
- **Rouge** (en panne) — le service ne repond pas
Chaque ligne affiche : nom du service, port, etat, temps de reponse (ms), derniere verification.

### 3.3 Liste des services verifies
Les services suivants sont verifies : Identity (3001), Storage (3004), AI Gateway (3005), Docs (3010), Calendar (3011), Mail (3012), Collab (3013), Meet (3014), Forms (3015), Chat (3020), Notifications (8095), Gateway (3099). Le health check appelle `GET /health` sur chaque service.

### 3.4 Rafraichissement automatique
Le health check peut etre configure en rafraichissement automatique (toutes les 60 secondes). Toggle `Auto-refresh` a cote du bouton. Indicateur de derniere verification : `Derniere verification : il y a 45s`.

### 3.5 Historique de disponibilite
Vue optionnelle (admin) affichant l'uptime de chaque service sur les 24h, 7 jours, 30 jours. Graphique de disponibilite (barres vertes/rouges). Integre avec signapps-metrics (port 3008).

### 3.6 Notification de degradation
Si un service est detecte comme degrade ou en panne, une banniere d'alerte s'affiche en haut de la page /help (et optionnellement en haut de toutes les pages SignApps). Texte : `Certains services rencontrent des difficultes. Nous travaillons a resoudre le probleme.`

---

## Categorie 4 — Formulaire de support (tickets)

### 4.1 Bouton Envoyer (formulaire de contact)
Bouton `Envoyer` en bas de la page /help ouvrant un formulaire de soumission de ticket. Le formulaire est egalement accessible via le lien `Contacter le support` dans les resultats de recherche vides.

### 4.2 Champs du formulaire
- **Sujet** (obligatoire) — champ texte libre, max 200 caracteres
- **Categorie** (obligatoire) — dropdown avec les sections (Compte, Documents, Mail, etc.)
- **Priorite** (obligatoire) — dropdown : Basse, Moyenne, Haute, Critique
- **Description** (obligatoire) — textarea rich text, max 5000 caracteres, support des captures d'ecran par paste
- **Pieces jointes** (optionnel) — upload de fichiers (max 5 fichiers, 10 Mo chacun), screenshots, logs
- **Email de contact** (pre-rempli avec l'email de l'utilisateur connecte)

### 4.3 Soumission et confirmation
Le clic sur `Envoyer` cree un ticket dans le systeme. Toast de confirmation : `Votre demande a ete envoyee. Vous recevrez une reponse par email.` Le ticket recoit un numero unique (ex: `HELP-2024-00042`). Email de confirmation automatique.

### 4.4 Stockage des tickets
Les tickets sont stockes en PostgreSQL. Table `help_tickets` : `id` (UUID PK), `ticket_number` (VARCHAR unique), `user_id` (UUID FK), `subject` (VARCHAR 200), `category` (VARCHAR), `priority` (VARCHAR), `description` (TEXT), `status` (enum: open, in_progress, resolved, closed), `created_at`, `updated_at`, `resolved_at`.

### 4.5 Suivi des tickets
L'utilisateur peut consulter ses tickets soumis depuis la page /help > section `Mes demandes`. Liste avec : numero, sujet, statut (badge colore), date de soumission, date de derniere mise a jour. Clic sur un ticket affiche le detail et l'historique des echanges.

### 4.6 Reponse au ticket par email
L'admin ou le support repond au ticket via l'interface admin ou par email. La reponse est notifiee a l'utilisateur par email et dans les notifications SignApps. L'utilisateur peut repondre a son tour (conversation threadee).

### 4.7 Satisfaction post-resolution
Quand un ticket passe au statut `resolved`, l'utilisateur recoit un email avec un sondage : `Cette reponse a-t-elle resolu votre probleme ? Oui / Non / Partiellement`. Le feedback est enregistre pour mesurer la qualite du support.

---

## Categorie 5 — Assistant IA integre

### 5.1 Widget assistant IA
Bouton flottant en bas a droite de la page /help : icone robot avec label `Aide IA`. Le clic ouvre un panneau de chat ou l'utilisateur peut poser des questions en langage naturel.

### 5.2 Reponse contextuelle
L'assistant IA repond en s'appuyant sur la base d'articles du centre d'aide (RAG — Retrieval Augmented Generation). Chaque reponse cite les articles sources avec des liens cliquables. Si aucun article ne correspond, l'assistant propose de creer un ticket.

### 5.3 Configuration du modele IA
L'assistant utilise le AI Gateway (signapps-ai, port 3005). Le texte informatif sur la page /help precise : `L'assistant IA utilise le modele configure dans votre instance SignApps (Ollama, OpenAI, Anthropic, vLLM, llama.cpp). Vos donnees restent privees avec les modeles locaux.`

### 5.4 Historique des conversations
Les conversations avec l'assistant IA sont sauvegardees par session. L'utilisateur peut reprendre une conversation ou en demarrer une nouvelle. Historique consultable dans le panneau `Mes conversations IA`.

### 5.5 Escalade vers ticket
Si l'assistant IA ne peut pas resoudre le probleme apres 3 echanges, il propose automatiquement : `Je ne parviens pas a resoudre votre probleme. Souhaitez-vous creer un ticket de support ?` Le clic pre-remplit le formulaire avec le resume de la conversation.

### 5.6 Feedback sur les reponses IA
Chaque reponse de l'assistant propose un vote pouce haut/pouce bas. Les votes negatifs sont remontes dans les analytics admin pour ameliorer la base de connaissances.

---

## Categorie 6 — Administration du centre d'aide

### 6.1 Editeur d'articles (admin)
Interface admin pour creer, editer et supprimer les articles FAQ. Editeur WYSIWYG avec : titres, paragraphes, listes, images, liens, code inline, tableaux. Chaque article a un statut : brouillon, publie, archive.

### 6.2 Gestion des sections
L'admin peut creer, renommer, reordonner et supprimer les sections. Chaque section a un nom, une icone et un ordre d'affichage. Les articles sont assignes a une section.

### 6.3 Analytics d'utilisation
Dashboard admin affichant : articles les plus consultes, taux de feedback positif par article, termes de recherche les plus frequents, termes sans resultat, nombre de tickets soumis, temps moyen de resolution, taux de satisfaction.

### 6.4 Workflow de publication
Les articles suivent un workflow : brouillon → en review → publie. L'admin peut assigner un relecteur. Notification au relecteur. Approbation ou demande de modification. Historique des modifications avec diff.

### 6.5 Multi-langue (i18n)
Chaque article peut etre traduit en plusieurs langues. L'utilisateur voit les articles dans sa langue preferee. Fallback vers la langue par defaut (francais) si la traduction n'existe pas. Indicateur de articles non traduits pour l'admin.

### 6.6 Import/export de la base de connaissances
Export de tous les articles en JSON ou Markdown (backup, migration). Import depuis un fichier JSON structure. Utile pour la migration depuis un autre systeme de help center ou pour le deploiement multi-instance.

---

## Categorie 7 — Guides interactifs et onboarding

### 7.1 Guides pas-a-pas (walkthroughs)
Tutoriels interactifs guides par des tooltips et highlights sur l'interface reelle. Par exemple : `Guide : Envoyer votre premier email` met en surbrillance le bouton Composer, puis le champ destinataire, puis le bouton Envoyer. Navigation par boutons Suivant/Precedent.

### 7.2 Declenchement des guides
Les guides se declenchent : (1) automatiquement pour les nouveaux utilisateurs (onboarding), (2) manuellement depuis le centre d'aide > section `Guides`, (3) via un lien dans un article FAQ.

### 7.3 Bibliotheque de guides
Liste des guides disponibles sur la page /help > onglet `Guides` :
- Decouvrir l'interface SignApps
- Envoyer votre premier email
- Creer et partager un document
- Organiser votre Drive
- Planifier une reunion
- Utiliser l'assistant IA
- Configurer votre profil et securite

Chaque guide affiche : titre, duree estimee, nombre d'etapes, statut (non commence, en cours, termine).

### 7.4 Progression et completion
La progression du guide est sauvegardee. Si l'utilisateur quitte en cours de route, il reprend la ou il s'est arrete. Un guide termine est marque avec un badge vert. Integration avec le systeme de gamification (XP bonus pour les guides completes).

### 7.5 Guides custom (admin)
L'admin peut creer des guides personnalises : definir les etapes (element CSS cible, texte tooltip, position), l'ordre, la condition de declenchement. Utile pour les formations specifiques a l'organisation.

---

## References OSS

**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Docusaurus** (github.com/facebook/docusaurus) | **MIT** | Framework de documentation avec recherche, versionning, sidebar, i18n. Pattern de structure d'articles et de navigation. |
| **Nextra** (github.com/shuding/nextra) | **MIT** | Documentation Next.js avec MDX, recherche, sidebar auto, themes. Pattern d'integration avec Next.js App Router. |
| **Shepherd.js** (github.com/shepherd-pro/shepherd) | **MIT** | Bibliotheque de guides interactifs (tours). Pattern pour les walkthroughs step-by-step avec tooltips et highlights. |
| **Intro.js** (github.com/usablica/intro.js) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Pattern de step-by-step onboarding. |
| **react-joyride** (github.com/gilbarbara/react-joyride) | **MIT** | Tours guides pour React. Pattern pour les walkthroughs avec spotlights, tooltips, et progression. Directement utilisable. |
| **Radix UI Accordion** (github.com/radix-ui/primitives) | **MIT** | Composant accordeon accessible. Pattern pour les FAQ expand/collapse. Deja utilise dans SignApps (via shadcn/ui). |
| **Fuse.js** (github.com/krisk/Fuse) | **Apache-2.0** | Recherche fuzzy client-side. Pattern pour la recherche instantanee dans les articles FAQ sans appel serveur. |
| **Marked** (github.com/markedjs/marked) | **MIT** | Parser Markdown vers HTML. Pattern pour le rendu des articles FAQ stockes en Markdown. |

---

## Assertions E2E cles (a tester)

- Navigation vers /help affiche le titre `Centre d'aide` et toutes les sections FAQ
- Chaque section affiche son titre et sa liste de questions sous forme d'accordeons
- Clic sur une question → l'accordeon s'ouvre et affiche la reponse detaillee
- Clic sur une autre question → la precedente se ferme, la nouvelle s'ouvre
- La section Compte contient la question `Comment changer mon mot de passe ?`
- La section Securite contient la question `Comment activer la double authentification ?`
- Recherche `mot de passe` dans la barre → resultats affiches avec articles pertinents de la section Compte
- Recherche sans resultat → message `Aucun article ne correspond` avec lien vers le formulaire
- Clic sur `Verifier les services` → affichage de la liste des services avec indicateurs d'etat colores
- Chaque service affiche un indicateur vert (operationnel) ou rouge (en panne) avec le temps de reponse
- Clic sur `Envoyer` → ouverture du formulaire de ticket avec les champs requis
- Soumission du formulaire avec tous les champs remplis → toast de confirmation avec numero de ticket
- Soumission du formulaire sans sujet → message d'erreur de validation
- Section `Mes demandes` affiche la liste des tickets soumis avec statut
- Le widget assistant IA s'ouvre au clic sur le bouton flottant
- L'assistant IA repond a une question avec des liens vers les articles pertinents
- Vote pouce haut/pouce bas sur une reponse IA → feedback enregistre
- Les sous-sections Documents, Mail, Chat, Taches, Services sont presentes et navigables
- Le texte informatif sur l'AI Gateway est affiche correctement
- La page est responsive : les accordeons et le formulaire s'adaptent au mobile
