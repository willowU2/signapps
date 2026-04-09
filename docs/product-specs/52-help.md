# Module Centre d'aide (Help) -- Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Zendesk Help Center** | Knowledge base hierarchique (categories/sections/articles), recherche full-text avec suggestions, widget embeddable, feedback par article (utile/pas utile), versionning d'articles, themes custom, multi-langue, community forums, analytics de consultation, SEO optimise |
| **Intercom Help** | Articles organises par collection, editeur WYSIWYG, recherche instantanee avec autosuggestions, messenger integre, bots de triage, resolution automatique par AI, analytics de performance des articles, feedback utilisateur, multi-langue, targeted content |
| **Notion Help Center** | Structure en pages imbriquees, breadcrumb navigation, table des matieres auto, recherche rapide, categories visuelles avec icones, liens croises entre articles, mise a jour frequente, design epure |
| **Google Workspace Help** | FAQ par produit, articles step-by-step avec captures d'ecran, troubleshooter interactif, communaute d'entraide, status dashboard des services, formulaire de signalement, chat support, assistant AI |
| **Freshdesk Knowledge Base** | Categorisation multi-niveaux, editeur rich text, articles publics et internes, workflow d'approbation, SEO meta, feedback article, analytics, multi-langue, auto-suggest dans le widget support, conversion article vers ticket |
| **Atlassian Confluence Help** | Spaces par produit, macros interactives (expand, status, code), labels/tags, arborescence de pages, recherche avancee avec filtres, templates d'articles, permissions par page, commentaires inline |
| **HubSpot Knowledge Base** | Categories et sous-categories, editeur drag-drop, analytics par article (vues, votes, tickets evites), SEO auto, recherche avec suggestions, widget de support integre, feedback loop, multi-langue |
| **Crisp Helpdesk** | Knowledge base categorisee, recherche instantanee, widget chat + help center combine, editeur markdown, statut des articles (draft/published), analytics, multi-langue, SDK embeddable, bot integre |

## Principes directeurs

1. **Self-service d'abord** -- l'utilisateur doit trouver la reponse a 80% de ses questions sans contacter le support. La FAQ, les guides et le troubleshooter sont les premiers points de contact. Le formulaire de ticket est le dernier recours.
2. **Organisation par domaine fonctionnel** -- les articles sont groupes par section correspondant aux modules SignApps (Compte, Documents, Mail, Calendrier, Stockage, IA, Securite, Administration, Navigation). L'utilisateur identifie immediatement la section pertinente.
3. **Recherche et decouverte rapides** -- barre de recherche en haut de page avec auto-suggestions. Chaque section est scannable en quelques secondes grace aux questions affichees sous forme d'accordeons expansibles.
4. **Feedback bidirectionnel** -- chaque article propose un vote utile/pas utile. Le formulaire de support permet de soumettre des demandes non couvertes. Le retour utilisateur alimente l'amelioration continue du contenu.
5. **Statut operationnel transparent** -- le centre d'aide inclut un verificateur de sante des services (health check). L'utilisateur peut voir en temps reel quels services sont operationnels, degrades ou en panne.
6. **Assistance AI contextuelle** -- l'assistant IA SignApps est integre dans le centre d'aide. Il peut repondre aux questions en langage naturel, citer les articles pertinents, et escalader vers un ticket humain si necessaire.

---

## Categorie 1 -- FAQ et articles d'aide

### 1.1 Structure par sections
La page /help affiche les sections suivantes, chacune correspondant a un domaine fonctionnel :
- **Compte** -- gestion du profil, mot de passe, authentification
- **Documents** -- editeur, partage, historique de versions
- **Mail** -- configuration, envoi/reception, filtres
- **Calendrier** -- evenements, invitations, synchronisation
- **Stockage** -- upload, telechargement, partage de fichiers
- **IA** -- assistant, fonctionnalites AI, modeles
- **Securite** -- chiffrement, 2FA, sessions
- **Administration** -- parametres organisation, roles, utilisateurs
- **Navigation generale** -- raccourcis, interface, personnalisation

Chaque section est un bloc visuel distinct (`Card` shadcn/ui) avec un titre en `text-lg font-semibold`, une icone representative (lucide-react) a gauche du titre, et la liste des questions. Les sections sont rendues en grille 2 colonnes desktop, 1 colonne mobile. L'ordre des sections est configurable par l'admin.

### 1.2 Questions sous forme d'accordeon
Chaque question est affichee sous forme d'un element accordeon (`Accordion` shadcn/ui, base sur Radix UI). Le titre de la question est visible en `font-medium`. Clic sur la question : l'accordeon s'ouvre avec animation slide-down 200ms (`ease-out`), affichant la reponse detaillee. Un seul accordeon ouvert a la fois par section (`type="single" collapsible`). Le chevron tourne de 0 a 180 degres pendant l'ouverture. L'URL est mise a jour avec un hash (`#section-question-id`) permettant le deep linking direct vers une question.

### 1.3 Contenu des reponses -- format Markdown
Les reponses sont stockees en Markdown dans la base de donnees et rendues en HTML via `marked` (MIT). Le rendu supporte : paragraphes, titres H2-H4, listes a puces et numerotees, liens hypertextes (ouvrent dans un nouvel onglet si externe), code inline avec backticks, blocs de code avec syntax highlighting (pour les raccourcis clavier), images avec alt text, tableaux Markdown, blockquotes pour les notes et avertissements. Le Markdown est sanitise cote serveur avec `ammonia` (Rust, MIT) pour prevenir les injections XSS.

### 1.4 Gestion de contenu admin (CRUD articles)
L'admin accede a `/admin/help/articles` pour gerer les articles. Interface en deux colonnes : sidebar avec la liste des sections et articles (arbre), zone principale avec l'editeur. Chaque article a les champs :
- `title` (VARCHAR 300, obligatoire) -- la question
- `content` (TEXT, obligatoire) -- la reponse en Markdown
- `section_id` (UUID FK) -- la section parente
- `sort_order` (INTEGER) -- ordre dans la section
- `status` (enum: `draft`, `published`, `archived`) -- seuls les `published` sont visibles aux utilisateurs
- `tags` (VARCHAR[] array) -- tags pour la recherche et le filtrage
- `created_by` (UUID FK users) -- auteur
- `updated_by` (UUID FK users) -- dernier editeur
- `created_at`, `updated_at` (TIMESTAMPTZ)

L'editeur admin est un textarea Markdown avec preview cote-a-cote (split view). Bouton `Apercu` pour voir le rendu final. Bouton `Publier` passe le statut a `published`. Bouton `Enregistrer comme brouillon` garde en `draft`. L'admin peut reordonner les articles par drag-and-drop dans la sidebar (persiste `sort_order`).

### 1.5 Categories et sections admin
L'admin peut creer, renommer, reordonner et supprimer les sections depuis `/admin/help/sections`. Chaque section a : `name` (VARCHAR 100), `icon` (nom d'icone lucide-react), `sort_order` (INTEGER), `description` (TEXT optionnel). La suppression d'une section avec des articles oblige a les reassigner ou les supprimer (dialogue de confirmation avec choix).

### 1.6 Articles de la section Compte
- Comment changer mon mot de passe ?
- Comment activer la double authentification (2FA) ?
- Comment modifier mon adresse email ?
- Comment mettre a jour ma photo de profil ?
- Comment configurer mes preferences de notification ?
- Comment supprimer mon compte ?
- Comment recuperer l'acces a mon compte verrouille ?

### 1.7 Articles de la section Documents
- Comment creer un nouveau document ?
- Comment partager un document avec des collegues ?
- Comment consulter l'historique des versions ?
- Comment restaurer une version precedente ?
- Comment exporter un document en PDF ?
- Comment utiliser les modeles de documents ?
- Comment collaborer en temps reel sur un document ?

### 1.8 Articles de la section Mail
- Comment configurer mon compte mail ?
- Comment envoyer un email avec piece jointe ?
- Comment creer des filtres de tri automatique ?
- Comment creer une signature email ?
- Comment programmer l'envoi d'un email ?
- Comment gerer les dossiers et labels ?
- Comment signaler un email comme spam ?

### 1.9 Articles de la section Calendrier
- Comment creer un evenement ?
- Comment inviter des participants a une reunion ?
- Comment synchroniser avec Google Calendar ?
- Comment configurer les rappels ?
- Comment gerer les plages de disponibilite ?
- Comment creer un evenement recurrent ?
- Comment partager mon calendrier ?

### 1.10 Articles de la section Stockage
- Comment uploader un fichier ?
- Comment organiser mes fichiers en dossiers ?
- Comment partager un fichier ou un dossier ?
- Comment generer un lien de partage externe ?
- Quels formats de fichiers sont supportes ?
- Quelle est la taille maximale d'upload ?
- Comment recuperer un fichier supprime ?

### 1.11 Articles de la section IA
- Quelles fonctionnalites IA sont disponibles ?
- Comment utiliser l'assistant IA dans l'editeur ?
- Comment generer un resume de document par IA ?
- Comment utiliser la transcription vocale ?
- Comment configurer le fournisseur IA (Ollama, OpenAI, Anthropic) ?
- Quels modeles IA sont disponibles localement ?
- Les donnees sont-elles envoyees a l'exterieur avec l'IA locale ?

### 1.12 Articles de la section Securite
- Comment activer le chiffrement de bout en bout ?
- Comment gerer mes sessions actives ?
- Comment revoquer un token d'acces ?
- Comment configurer les politiques de mot de passe ?
- Comment consulter les logs d'audit de securite ?
- Comment detecter les connexions suspectes ?

### 1.13 Articles de la section Administration
- Comment ajouter un nouvel utilisateur ?
- Comment configurer les roles et permissions ?
- Comment gerer les groupes organisationnels ?
- Comment configurer le domaine personnalise ?
- Comment consulter les statistiques d'utilisation ?
- Comment configurer les politiques de retention ?

### 1.14 Articles de la section Navigation generale
- Quels sont les raccourcis clavier disponibles ?
- Comment personnaliser la barre laterale ?
- Comment activer le mode sombre ?
- Comment changer la langue de l'interface ?
- Comment utiliser la recherche globale ?
- Comment configurer le tableau de bord ?

---

## Categorie 2 -- Recherche et decouverte

### 2.1 Barre de recherche principale
En haut de la page /help, barre de recherche (`Input` shadcn/ui) pleine largeur avec icone `Search` a gauche et placeholder `Rechercher dans l'aide...`. La recherche s'active des le 2e caractere tape (debounce 200ms). Resultats affiches en temps reel sous la barre sous forme de dropdown (`Popover`) avec les questions correspondantes groupees par section. Maximum 10 resultats affiches dans le dropdown. Chaque resultat montre : icone de la section, titre de la question, extrait du contenu avec les termes recherches surlignees en `<mark>`. `Escape` ferme le dropdown. `Enter` sur un resultat navigue vers la question et l'ouvre.

### 2.2 Algorithme de recherche -- Fuse.js fuzzy matching
La recherche cote client utilise Fuse.js (Apache-2.0) avec la configuration :
- `keys`: `[{ name: 'title', weight: 2 }, { name: 'content', weight: 1 }]` -- le titre a le double de poids
- `threshold`: 0.35 -- tolerance aux fautes de frappe (0 = exact, 1 = tout)
- `distance`: 100 -- distance maximale pour le fuzzy
- `includeMatches`: true -- pour le highlighting
- `minMatchCharLength`: 2

Le dataset est charge au premier focus sur la barre de recherche (lazy load). Les articles sont pre-indexes une fois et caches en memoire. Fuse.js gere la tolerance aux accents, aux fautes de frappe et aux variantes (`mot de passe` trouve `password`, `mdp`). Les termes recherches sont mis en surbrillance dans les resultats.

### 2.3 Suggestions de recherche
Quand l'utilisateur commence a taper (avant que les resultats apparaissent), le systeme affiche les 5 questions les plus consultees en italique sous la barre. Label : `Questions populaires`. Les suggestions sont calculees a partir du compteur `view_count` de chaque article. Elles disparaissent quand les resultats de recherche commencent a s'afficher.

### 2.4 Zero resultats
Si aucun resultat n'est trouve, affichage dans le dropdown : icone `SearchX` grisee, texte `Aucun article ne correspond a votre recherche` en `text-muted-foreground`, puis trois suggestions :
1. `Reformuler votre question` -- texte informatif
2. `Parcourir les sections ci-dessous` -- lien vers les sections
3. `Contacter le support` -- lien `Ouvrir un ticket` qui ouvre le formulaire
Le terme recherche sans resultat est logue en base pour analyse (table `help_search_logs`).

### 2.5 Analytics de recherche (admin)
Les termes recherches sont loggues dans la table `help_search_logs` : `id`, `query` (VARCHAR 500), `results_count` (INTEGER), `clicked_article_id` (UUID nullable -- si l'utilisateur a clique un resultat), `user_id` (UUID nullable -- anonymise apres 30 jours), `created_at`. Dashboard admin `/admin/help/analytics` affichant :
- Top 20 termes les plus recherches (barre horizontale)
- Recherches sans resultat (top 20, marquees en rouge) -- ces recherches indiquent les articles manquants
- Taux de clic (% de recherches qui aboutissent a un clic sur un resultat)
- Evolution hebdomadaire du volume de recherches (line chart)

---

## Categorie 3 -- Verification des services (Health Check)

### 3.1 Bouton Verifier les services
Bouton prominent dans un `Card` dedie en haut de la page /help : icone `Activity` + texte `Verifier les services`. Le bouton utilise le variant `default` avec taille `lg`. Au clic, le bouton passe en etat loading (spinner + texte `Verification en cours...`) pendant le fetch. Le fetch appelle `GET /api/v1/gateway/health` qui aggregate les health checks de tous les services.

### 3.2 Implementation du health check
L'endpoint `GET /api/v1/gateway/health` du gateway (port 3099) envoie en parallele des requetes `GET /health` a chaque service backend. Timeout par service : 5 secondes. La reponse de chaque service est un JSON `{ "status": "ok", "version": "1.2.3", "uptime_seconds": 86400 }`. Le gateway retourne un objet agrege :
```json
{
  "services": [
    { "name": "Identity", "port": 3001, "status": "ok", "latency_ms": 12, "version": "1.2.3" },
    { "name": "Storage", "port": 3004, "status": "ok", "latency_ms": 8, "version": "1.2.3" },
    { "name": "AI Gateway", "port": 3005, "status": "degraded", "latency_ms": 4200, "version": "1.2.3" },
    { "name": "Docs", "port": 3010, "status": "down", "latency_ms": null, "error": "Connection refused" }
  ],
  "overall": "degraded",
  "checked_at": "2026-04-09T14:30:00Z"
}
```
Regles de statut : `ok` si latence < 2000ms et reponse 200; `degraded` si latence 2000-5000ms ou reponse 5xx intermittente; `down` si timeout ou connection refused.

### 3.3 Affichage de l'etat des services
Apres verification, affichage dans un `Card` avec une liste de lignes. Chaque ligne contient :
- Pastille de couleur : vert (`bg-green-500`) pour `ok`, jaune (`bg-yellow-500`) pour `degraded`, rouge (`bg-red-500`) pour `down`
- Nom du service en `font-medium`
- Port entre parentheses en `text-muted-foreground text-sm`
- Latence en ms (ex: `12ms`) ou `--` si down
- Version du service en `text-xs text-muted-foreground`
- Icone de statut : `CheckCircle2` (vert), `AlertTriangle` (jaune), `XCircle` (rouge)

Animation d'entree : chaque ligne apparait avec un fade-in + slide-right stagger de 50ms entre chaque service. La pastille de couleur pulse une fois apres l'apparition.

### 3.4 Liste des services verifies
Les services suivants sont verifies (dans cet ordre) : Identity (3001), Storage (3004), AI Gateway (3005), Docs (3010), Calendar (3011), Mail (3012), Collab (3013), Meet (3014), Forms (3015), Chat (3020), Notifications (8095), Gateway (3099 -- self-check). Le nombre de services affiches est dynamique : si un service n'est pas configure (pas de port defini), il est omis. Le total est affiche : `12/12 services operationnels` ou `10/12 services operationnels`.

### 3.5 Rafraichissement automatique
Toggle `Auto-refresh` (`Switch` shadcn/ui) a cote du bouton de verification. Quand active, le health check est relance toutes les 60 secondes. Indicateur : `Derniere verification : il y a 45s` mis a jour chaque seconde via `setInterval`. Le toggle est desactive par defaut. L'etat est persiste en localStorage. Quand l'onglet est en arriere-plan (`document.hidden`), le polling est mis en pause pour economiser les ressources.

### 3.6 Historique de disponibilite (sparkline)
A cote de chaque service, un mini-graphique sparkline (8 points, hauteur 20px, largeur 80px) affiche l'historique de statut sur les 24 dernieres heures. Chaque point represente un check (1 check toutes les 5 minutes = 288 points, echantillonnes a 8). Couleur du point : vert si ok, jaune si degraded, rouge si down. Le sparkline est rendu en SVG inline (pas de librairie externe). Vue admin etendue : uptime sur 7j et 30j avec pourcentage (ex: `99.8% sur 30j`). Table `service_health_history` : `service_name`, `status`, `latency_ms`, `checked_at`. Job CRON toutes les 5 minutes via signapps-metrics (port 3008).

### 3.7 Notification de degradation
Si un service est detecte comme `degraded` ou `down` lors du health check, une banniere d'alerte s'affiche en haut de la page /help (et optionnellement en haut de toutes les pages SignApps si l'admin l'active). Rendu avec le composant `Alert` shadcn/ui, variant `destructive` pour down et variant `default` (jaune) pour degraded. Texte : `Certains services rencontrent des difficultes. [Nom du service] est actuellement [en panne / degrade].` Bouton `Details` qui scrolle vers la section health check.

---

## Categorie 4 -- Formulaire de support (tickets)

### 4.1 Bouton de contact
Bouton `Contacter le support` en bas de la page /help dans un `Card` dedie avec icone `MessageSquare`. Le clic ouvre un dialogue modal (`Dialog` shadcn/ui, largeur 600px). Le formulaire est egalement accessible via le lien dans les resultats de recherche vides et depuis le widget assistant IA (escalade).

### 4.2 Champs du formulaire
- **Sujet** (obligatoire) -- `Input` texte libre, max 200 caracteres, compteur `42/200` en bas a droite, autofocus
- **Categorie** (obligatoire) -- `Select` dropdown avec les sections (Compte, Documents, Mail, Calendrier, Stockage, IA, Securite, Administration, Autre)
- **Priorite** (obligatoire) -- `RadioGroup` avec 4 options : `Basse` (gris), `Moyenne` (bleu, defaut), `Haute` (orange), `Critique` (rouge). Chaque option a une icone et une description courte
- **Description** (obligatoire) -- `Textarea` rich text, max 5000 caracteres, compteur de caracteres, support du Markdown, placeholder `Decrivez votre probleme en detail...`. Support du paste de captures d'ecran (Ctrl+V insere l'image en base64 dans le champ)
- **Pieces jointes** (optionnel) -- zone de drag-drop (`Dropzone`) ou bouton `Ajouter des fichiers`. Max 5 fichiers, 10 Mo chacun. Types acceptes : images (png, jpg, gif, webp), documents (pdf, docx, xlsx), archives (zip). Progress bar par fichier pendant l'upload. Bouton supprimer (X) par fichier ajoute
- **Email de contact** -- pre-rempli avec l'email de l'utilisateur connecte, en lecture seule mais modifiable si l'utilisateur le souhaite

Validation : les champs obligatoires non remplis affichent un message d'erreur inline en rouge sous le champ (`text-destructive text-sm`). Le bouton `Envoyer` est desactive tant que la validation echoue.

### 4.3 Soumission et confirmation
Le clic sur `Envoyer` appelle `POST /api/v1/help/tickets` avec le body multipart (pour les fichiers). Le bouton passe en etat loading (spinner + `Envoi en cours...`). Apres success (201), le dialogue se ferme et un toast vert confirme : `Votre demande #HELP-2026-00042 a ete envoyee. Vous recevrez une reponse par email.` Le numero de ticket est genere cote serveur : format `HELP-{annee}-{sequence_5_digits}`. Un email de confirmation automatique est envoye via signapps-mail avec le recapitulatif.

### 4.4 Schema PostgreSQL des tickets
```sql
CREATE TABLE help_tickets (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number  VARCHAR(20) UNIQUE NOT NULL,  -- HELP-2026-00042
    user_id        UUID NOT NULL REFERENCES users(id),
    subject        VARCHAR(200) NOT NULL,
    category       VARCHAR(50) NOT NULL,
    priority       VARCHAR(20) NOT NULL DEFAULT 'medium',  -- low, medium, high, critical
    description    TEXT NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'open',  -- open, in_progress, resolved, closed
    assigned_to    UUID REFERENCES users(id),  -- admin/support assigne
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at    TIMESTAMPTZ
);

CREATE TABLE help_ticket_attachments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id   UUID NOT NULL REFERENCES help_tickets(id) ON DELETE CASCADE,
    file_name   VARCHAR(255) NOT NULL,
    file_size   INTEGER NOT NULL,  -- bytes
    mime_type   VARCHAR(100) NOT NULL,
    storage_key TEXT NOT NULL,  -- cle OpenDAL dans signapps-storage
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE help_ticket_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id   UUID NOT NULL REFERENCES help_tickets(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(id),
    content     TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT false,  -- notes internes admin
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_user ON help_tickets(user_id, created_at DESC);
CREATE INDEX idx_tickets_status ON help_tickets(status);
CREATE INDEX idx_ticket_messages ON help_ticket_messages(ticket_id, created_at);
```

### 4.5 Suivi des tickets (Mes demandes)
Section `/help/tickets` accessible via un bouton `Mes demandes` en haut de /help (badge avec le nombre de tickets ouverts). Liste avec colonnes : numero de ticket (lien), sujet, categorie (badge), priorite (badge colore), statut (badge : vert `open`, bleu `in_progress`, gris `resolved`, `closed`), date de soumission, date de derniere mise a jour. Tri par defaut : date decroissante. Clic sur un ticket ouvre le detail avec l'historique des echanges (conversation threadee). L'utilisateur peut ajouter un message de suivi (textarea + bouton `Repondre`).

### 4.6 Reponse au ticket et conversation
L'admin ou le support repond au ticket via `/admin/help/tickets/:id`. L'interface affiche la conversation en chronologique (bulle gauche = utilisateur, bulle droite = support). L'admin peut ajouter des notes internes (`is_internal = true`) visibles uniquement par les admins (fond jaune). Le changement de statut (open -> in_progress -> resolved -> closed) est logge comme evenement dans la conversation. L'utilisateur recoit une notification par email et push a chaque reponse du support.

### 4.7 Satisfaction post-resolution
Quand un ticket passe au statut `resolved`, l'utilisateur recoit un email avec un sondage inline : `Cette reponse a-t-elle resolu votre probleme ?` Trois boutons : `Oui` (vert), `Partiellement` (jaune), `Non` (rouge). Le clic enregistre le feedback dans la table `help_ticket_feedback` : `ticket_id`, `rating` (enum: positive, partial, negative), `comment` (TEXT optionnel), `created_at`. Si `Non`, l'utilisateur peut ajouter un commentaire et le ticket est reouvert automatiquement.

---

## Categorie 5 -- Assistant IA integre

### 5.1 Widget assistant IA
Bouton flottant en bas a droite de la page /help : icone `Bot` (lucide-react) avec label `Aide IA` dans un `Button` variant `default` avec `rounded-full` et ombre portee. Le clic ouvre un panneau de chat (400px largeur, 500px hauteur) ancre en bas a droite avec animation slide-up 200ms. Le panneau a un header avec titre `Assistant IA`, un bouton fermer (X), et un bouton `Nouvelle conversation`. Le corps est une zone de messages scrollable. Le pied est un input avec placeholder `Posez votre question...` et un bouton envoyer.

### 5.2 RAG -- Retrieval Augmented Generation
L'assistant IA repond en s'appuyant sur deux corpus :
1. **Articles FAQ** -- les articles du centre d'aide sont indexes dans la table vectorielle `help_article_embeddings` : `article_id` (UUID FK), `chunk_text` (TEXT), `embedding` (vector(384)). Chaque article est decoupe en chunks de 500 tokens avec overlap de 50 tokens. Les embeddings sont generes par le modele configure dans signapps-ai.
2. **Documentation technique** -- optionnellement, les fichiers Markdown du repo (`docs/`) sont indexes de la meme maniere pour les questions avancees.

Le pipeline RAG : (1) embed la question utilisateur, (2) recherche les 5 chunks les plus proches (cosine similarity via pgvector), (3) injecte les chunks dans le prompt LLM comme contexte, (4) genere la reponse. Chaque reponse cite les articles sources avec des liens cliquables : `[Source: Comment changer mon mot de passe ?](/help#compte-password)`.

### 5.3 Configuration du modele IA
L'assistant utilise le AI Gateway (signapps-ai, port 3005). Le texte informatif en bas du panneau : `Propulse par [nom du modele] via SignApps AI. Vos donnees restent privees.` Le modele utilise depend de la configuration admin : Ollama (local), vLLM (local), OpenAI API, Anthropic API, llama.cpp (local). Le streaming est supporte : les reponses apparaissent token par token (Server-Sent Events).

### 5.4 Historique des conversations
Les conversations sont stockees dans la table `help_ai_conversations` : `id`, `user_id`, `title` (genere automatiquement a partir du premier message), `created_at`, `updated_at`. Les messages sont dans `help_ai_messages` : `id`, `conversation_id`, `role` (enum: user, assistant), `content` (TEXT), `sources` (JSONB -- liste des article_id cites), `created_at`. L'utilisateur peut voir ses conversations passees via un bouton `Historique` dans le header du panneau. Clic sur une conversation la recharge.

### 5.5 Escalade vers ticket
Si l'assistant IA ne peut pas resoudre le probleme apres 3 echanges, il propose automatiquement en bas de sa reponse : `Je ne parviens pas a resoudre votre probleme. Souhaitez-vous creer un ticket de support ?` avec un bouton `Creer un ticket`. Le clic ouvre le formulaire de ticket pre-rempli : le sujet est le premier message de l'utilisateur (tronque a 200 chars), la description contient le resume de la conversation IA, la categorie est deduite du contexte.

### 5.6 Feedback sur les reponses IA
Chaque reponse de l'assistant propose un vote `ThumbsUp` / `ThumbsDown` (icones lucide-react) en bas a droite du message. Le vote est enregistre dans la table `help_ai_feedback` : `message_id`, `rating` (positive/negative), `created_at`. Les votes negatifs sont remontes dans le dashboard admin `/admin/help/ai-analytics` avec le contenu de la question et la reponse, pour identifier les lacunes du corpus RAG.

---

## Categorie 6 -- Administration du centre d'aide

### 6.1 Editeur d'articles (admin)
Interface admin `/admin/help/articles/:id/edit` avec un editeur Markdown split-view : panneau gauche = textarea Markdown avec syntax highlighting (CodeMirror-like), panneau droit = preview HTML rendue. Toolbar au-dessus du textarea avec boutons : **Gras**, *Italique*, Lien, Image (upload vers signapps-storage), Liste a puces, Liste numerotee, Code inline, Bloc de code, Titre H2/H3. L'editeur supporte le drag-drop d'images (upload automatique, insertion du lien Markdown). Auto-save toutes les 30 secondes (brouillon).

### 6.2 Workflow de publication
Les articles suivent un workflow : `draft` (brouillon) -> `published` (publie) -> `archived` (archive). L'admin peut assigner un relecteur via un dropdown dans l'editeur. Le relecteur recoit une notification `Relecture demandee pour l'article "[titre]"`. Le relecteur peut approuver (passe a `published`) ou demander des modifications (commentaire inline). L'historique des modifications est conserve avec diff (table `help_article_revisions` : `article_id`, `content_before`, `content_after`, `changed_by`, `created_at`).

### 6.3 Analytics d'utilisation
Dashboard admin `/admin/help/analytics` affichant dans des `Card` :
- **Articles les plus consultes** -- top 20 par `view_count`, barre horizontale, clickable vers l'article
- **Taux de feedback positif** -- par article, donut chart (% utile vs pas utile)
- **Termes de recherche** -- top 20 requetes, avec badge rouge pour les `results_count = 0`
- **Tickets soumis** -- compteur mensuel, line chart sur 12 mois
- **Temps moyen de resolution** -- en heures, par categorie
- **Taux de satisfaction** -- % de tickets resolus avec feedback positif
Les donnees sont calculees par des vues materialisees PostgreSQL rafraichies toutes les heures.

### 6.4 Multi-langue (i18n)
Chaque article peut etre traduit en plusieurs langues. Table `help_article_translations` : `article_id`, `locale` (VARCHAR 10, ex: `en`, `fr`, `de`), `title`, `content`, `status`. L'utilisateur voit les articles dans sa langue preferee (header `Accept-Language` ou preference profil). Fallback vers la langue par defaut (`fr`) si la traduction n'existe pas. L'admin voit un indicateur par article : `FR`, `EN` avec badge vert si traduit, gris si manquant.

### 6.5 Import/export de la base de connaissances
Export de tous les articles en JSON structure (tableau d'objets avec section, titre, contenu Markdown, tags, status) ou en fichiers Markdown (un fichier `.md` par article, dans des dossiers par section) via bouton `Exporter` dans `/admin/help`. Import depuis un fichier JSON ou un ZIP de Markdown. L'import affiche un preview avec le nombre d'articles detectes et les conflits (articles existants avec le meme titre). Options : `Ecraser les existants` ou `Ignorer les doublons`.

### 6.6 Feedback articles (utile/pas utile)
En bas de chaque article ouvert, deux boutons : `Cet article vous a-t-il ete utile ?` avec `ThumbsUp` (Oui) et `ThumbsDown` (Non). Le vote est enregistre dans `help_article_feedback` : `article_id`, `user_id`, `rating` (boolean), `created_at`. Un seul vote par utilisateur par article (upsert). Apres le vote, texte de remerciement : `Merci pour votre retour !`. Si `Non`, un champ optionnel apparait : `Comment pourrions-nous ameliorer cet article ?` (textarea, max 500 chars). Les feedbacks negatifs avec commentaire sont visibles dans le dashboard admin.

---

## Categorie 7 -- Guides interactifs et onboarding

### 7.1 Guides pas-a-pas (walkthroughs) via Shepherd.js
Tutoriels interactifs guides par des tooltips et highlights sur l'interface reelle. Implementation avec Shepherd.js (MIT). Chaque guide est une sequence d'etapes (`Step[]`). Chaque etape definit : `attachTo` (selecteur CSS de l'element cible, ex: `#compose-button`), `text` (contenu HTML du tooltip), `position` (top/bottom/left/right), `advanceOn` (evenement pour passer a l'etape suivante, ex: clic sur l'element). L'element cible est surligne avec un overlay sombre autour (spotlight). Navigation par boutons `Precedent` / `Suivant` / `Terminer` dans le tooltip. Bouton `Quitter` (X) pour abandonner le guide a tout moment.

### 7.2 Declenchement des guides
Les guides se declenchent de trois manieres :
1. **Automatiquement** pour les nouveaux utilisateurs : au premier login, le guide `Decouvrir l'interface SignApps` se lance. L'utilisateur peut le reporter (`Me rappeler demain`) ou le skipper (`Ne plus afficher`). La preference est stockee dans `user_preferences` (JSONB, cle `onboarding_completed`).
2. **Manuellement** depuis le centre d'aide `/help` > onglet `Guides`.
3. **Contextuellement** via un lien dans un article FAQ : `Suivre le guide pas a pas ->` qui lance le guide correspondant.

### 7.3 Bibliotheque de guides
Liste des guides disponibles sur la page `/help` > onglet `Guides` (sous-route `/help/guides`). Rendu en grille de `Card` avec pour chaque guide :
- Titre en `font-medium`
- Duree estimee (ex: `3 min`)
- Nombre d'etapes (ex: `7 etapes`)
- Statut : badge `Non commence` (gris), `En cours` (bleu, avec barre de progression), `Termine` (vert avec icone `CheckCircle2`)
- Bouton `Commencer` ou `Reprendre` ou `Revoir`

Guides disponibles :
- Decouvrir l'interface SignApps (8 etapes, 5 min)
- Envoyer votre premier email (6 etapes, 3 min)
- Creer et partager un document (7 etapes, 4 min)
- Organiser votre Drive (5 etapes, 3 min)
- Planifier une reunion (6 etapes, 3 min)
- Utiliser l'assistant IA (5 etapes, 3 min)
- Configurer votre profil et securite (4 etapes, 2 min)

### 7.4 Progression et completion
La progression du guide est sauvegardee dans `user_guide_progress` : `user_id`, `guide_id`, `current_step` (INTEGER), `status` (not_started/in_progress/completed), `started_at`, `completed_at`. Si l'utilisateur quitte en cours de route (ferme l'onglet, clique ailleurs), il reprend la ou il s'est arrete au prochain lancement. Un guide termine est marque avec un badge vert `Termine`. Le systeme de gamification (si actif) accorde des XP bonus pour les guides completes.

### 7.5 Guides custom (admin)
L'admin peut creer des guides personnalises depuis `/admin/help/guides/new`. Interface : liste ordonnee d'etapes. Pour chaque etape : selecteur CSS cible (avec un outil de selection visuel : l'admin clique sur l'element dans un iframe de preview), texte du tooltip (Markdown), position du tooltip, condition d'avancement (clic, saisie, navigation). L'admin peut tester le guide en mode preview avant publication. Les guides custom sont utiles pour les formations specifiques a l'organisation.

---

## Categorie 8 -- Panneau de raccourcis clavier et What's New

### 8.1 Reference des raccourcis clavier
Section dans /help > onglet `Raccourcis clavier` (sous-route `/help/shortcuts`). Les raccourcis sont groupes par module dans des `Card` :
- **Global** : `Ctrl+K` (recherche globale), `Ctrl+/` (ouvrir aide), `Ctrl+,` (preferences), `B` (basculer favori)
- **Documents** : `Ctrl+B` (gras), `Ctrl+I` (italique), `Ctrl+K` (lien), `Ctrl+Alt+1-6` (titres), `Ctrl+J` (IA)
- **Mail** : `C` (composer), `R` (repondre), `A` (repondre a tous), `F` (transferer), `E` (archiver), `#` (supprimer)
- **Calendar** : `N` (nouvel evenement), `T` (aujourd'hui), `D` (vue jour), `W` (vue semaine), `M` (vue mois)
- **Drive** : `U` (uploader), `Shift+N` (nouveau dossier), `F2` (renommer), `Delete` (supprimer)
- **Chat** : `Enter` (envoyer), `Shift+Enter` (nouvelle ligne), `Ctrl+Shift+M` (mute), `Escape` (fermer)

Chaque raccourci est affiche avec le composant `Kbd` (touche clavier stylisee, fond `bg-muted`, borde, `font-mono text-sm`). Les raccourcis macOS affichent `Cmd` au lieu de `Ctrl` (detecte via `navigator.platform`). Le panneau est egalement accessible via `Ctrl+/` depuis n'importe quelle page (raccourci global).

### 8.2 Aide contextuelle (bouton ?)
Chaque page de chaque module affiche un petit bouton `?` discret (icone `HelpCircle`, 20px, `text-muted-foreground`) dans le coin superieur droit de la toolbar. Le clic ouvre un panneau lateral (drawer, 400px) affichant les articles FAQ de la section correspondant au module courant. Par exemple, le `?` dans /mail ouvre les articles de la section `Mail`. Le mapping page -> section est defini dans un fichier de configuration `helpContextMap.ts`. Si aucun article ne correspond, le drawer affiche : `Pas d'aide disponible pour cette page. Rechercher dans le centre d'aide.` avec un lien vers /help.

### 8.3 What's New -- changelog auto-genere
Section dans /help > onglet `Nouveautes` (sous-route `/help/changelog`). Le contenu est genere automatiquement depuis `git-cliff` (CHANGELOG.md) et affiche les changements groupes par version et par type (feat, fix, perf). Chaque entree est un `Card` avec :
- Version et date en header (`v1.42.0 -- 9 avril 2026`)
- Liste des changements avec icone par type : `Sparkles` (feat), `Bug` (fix), `Zap` (perf), `RefreshCw` (refactor)
- Le scope est affiche en badge (ex: `calendar`, `mail`, `docs`)

Un badge `NEW` rouge apparait sur l'onglet `Nouveautes` si des changements ont ete publies depuis la derniere visite de l'utilisateur. La derniere date de visite est stockee dans `user_preferences` (cle `last_changelog_visit`). Le contenu du changelog est parse depuis le fichier `CHANGELOG.md` a la racine du projet et expose via `GET /api/v1/help/changelog`.

### 8.4 Texte informatif AI Gateway
En bas de la page /help, un paragraphe d'information : `L'assistant IA utilise le modele configure dans votre instance SignApps. Avec les modeles locaux (Ollama, vLLM, llama.cpp), vos donnees restent 100% privees et ne quittent jamais votre serveur. Avec les modeles cloud (OpenAI, Anthropic), les donnees sont envoyees au fournisseur selon ses conditions d'utilisation.` Le texte est en `text-sm text-muted-foreground` dans un `Card` avec icone `Info`.

---

## Categorie 9 -- Panneau de raccourcis clavier et What's New (suite)

### 9.1 Schema PostgreSQL des articles FAQ
```sql
CREATE TABLE help_sections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    icon        VARCHAR(50) NOT NULL,  -- nom d'icone lucide-react
    description TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE help_articles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id  UUID NOT NULL REFERENCES help_sections(id),
    title       VARCHAR(300) NOT NULL,
    content     TEXT NOT NULL,  -- Markdown
    status      VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, published, archived
    tags        VARCHAR(100)[] DEFAULT '{}',
    view_count  INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_by  UUID REFERENCES users(id),
    updated_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_articles_section ON help_articles(section_id, sort_order);
CREATE INDEX idx_articles_status ON help_articles(status);
CREATE INDEX idx_articles_fulltext ON help_articles
    USING gin(to_tsvector('french', title || ' ' || content));

CREATE TABLE help_article_feedback (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id  UUID NOT NULL REFERENCES help_articles(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id),
    rating      BOOLEAN NOT NULL,  -- true = utile, false = pas utile
    comment     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(article_id, user_id)
);

CREATE TABLE help_search_logs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query             VARCHAR(500) NOT NULL,
    results_count     INTEGER NOT NULL DEFAULT 0,
    clicked_article_id UUID REFERENCES help_articles(id),
    user_id           UUID REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE help_article_embeddings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id  UUID NOT NULL REFERENCES help_articles(id) ON DELETE CASCADE,
    chunk_text  TEXT NOT NULL,
    embedding   vector(384) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_embeddings_vector ON help_article_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);
```

### 9.2 API REST du centre d'aide
Endpoints servis par le service signapps-gateway (port 3099) :

| Methode | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/help/sections` | Lister les sections avec leurs articles publies. | JWT requis |
| `GET` | `/api/v1/help/articles/:id` | Obtenir un article. Incremente `view_count`. | JWT requis |
| `GET` | `/api/v1/help/search?q=...` | Recherche full-text. Retourne max 10 resultats. | JWT requis |
| `POST` | `/api/v1/help/tickets` | Creer un ticket de support (multipart). | JWT requis |
| `GET` | `/api/v1/help/tickets` | Lister mes tickets. Query: `status`, `page`, `limit`. | JWT requis |
| `GET` | `/api/v1/help/tickets/:id` | Detail d'un ticket avec messages. | JWT owner/admin |
| `POST` | `/api/v1/help/tickets/:id/messages` | Ajouter un message a un ticket. | JWT owner/admin |
| `PUT` | `/api/v1/help/tickets/:id/status` | Changer le statut d'un ticket. | JWT admin |
| `POST` | `/api/v1/help/ai/chat` | Envoyer un message a l'assistant IA (streaming SSE). | JWT requis |
| `GET` | `/api/v1/help/ai/conversations` | Lister mes conversations IA. | JWT requis |
| `GET` | `/api/v1/help/changelog` | Obtenir le changelog parse. | JWT requis |
| `GET` | `/api/v1/gateway/health` | Health check agrege de tous les services. | JWT requis |
| `POST` | `/api/v1/help/articles/:id/feedback` | Voter utile/pas utile sur un article. | JWT requis |
| `POST` | `/admin/help/articles` | Creer un article (admin). | JWT admin |
| `PUT` | `/admin/help/articles/:id` | Modifier un article (admin). | JWT admin |
| `DELETE` | `/admin/help/articles/:id` | Supprimer un article (admin). | JWT admin |

---

## Categorie 10 -- Securite, performance et accessibilite

### 10.1 Permissions de gestion du contenu
Seuls les utilisateurs avec le role `admin` ou `help_editor` peuvent creer, modifier et supprimer des articles. Les utilisateurs standard ont un acces en lecture seule au centre d'aide. La gestion des tickets est reservee aux roles `admin` et `support`. Les analytics sont visibles uniquement par les `admin`.

### 10.2 Rate limiting
L'endpoint de creation de ticket est rate-limite a 5 tickets par heure par utilisateur (via `signapps-cache` moka rate limiter). Au-dela, HTTP 429 avec message `Vous avez soumis trop de demandes. Reessayez dans [N] minutes.` L'endpoint de recherche est rate-limite a 60 requetes par minute par utilisateur.

### 10.3 Accessibilite ARIA
Les accordeons FAQ utilisent les attributs ARIA natifs de Radix UI : `role="region"`, `aria-labelledby` sur le contenu, `aria-expanded` sur le trigger. La barre de recherche a `role="combobox"` avec `aria-autocomplete="list"`. Les resultats de recherche utilisent `role="listbox"` et `role="option"`. Le health check utilise `role="status"` pour annoncer les changements aux lecteurs d'ecran. Les boutons de feedback (utile/pas utile) ont des `aria-label` explicites.

### 10.4 Performance
La page /help doit charger en < 1.5s (LCP). Les articles sont pre-rendus cote serveur (SSR Next.js) pour le SEO interne. Le dataset Fuse.js est charge en lazy (au premier focus sur la recherche). Les images dans les articles sont lazy-loaded (`loading="lazy"`). Le health check est declenche manuellement (pas de charge au chargement de page).

### 10.5 Mode responsive
Sur mobile (< 768px) : les sections FAQ passent en colonne unique, la barre de recherche prend toute la largeur, le panneau assistant IA s'ouvre en plein ecran (bottom sheet), le formulaire de ticket s'ouvre en plein ecran. Sur tablette (768-1024px) : grille 2 colonnes, panneau IA en demi-ecran.

### 10.6 Mode sombre
Tous les composants du centre d'aide s'adaptent au theme sombre de SignApps. Les `Card` utilisent `bg-card` (adaptatif). Les badges de statut conservent leurs couleurs (vert, jaune, rouge) avec un fond ajuste pour le contraste. Le code dans les articles utilise un theme sombre (fond `bg-muted`, texte clair). Les images dans les articles ne sont pas invertees (elles conservent leurs couleurs d'origine).

---

## References OSS

**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License -- ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Docusaurus** (github.com/facebook/docusaurus) | **MIT** | Framework de documentation avec recherche, versionning, sidebar, i18n. Pattern de structure d'articles et de navigation. |
| **Nextra** (github.com/shuding/nextra) | **MIT** | Documentation Next.js avec MDX, recherche, sidebar auto, themes. Pattern d'integration avec Next.js App Router. |
| **Shepherd.js** (github.com/shepherd-pro/shepherd) | **MIT** | Bibliotheque de guides interactifs (tours). Pattern pour les walkthroughs step-by-step avec tooltips et highlights. Directement utilisable. |
| **react-joyride** (github.com/gilbarbara/react-joyride) | **MIT** | Tours guides pour React. Pattern pour les walkthroughs avec spotlights, tooltips, et progression. Alternative a Shepherd.js. |
| **Radix UI Accordion** (github.com/radix-ui/primitives) | **MIT** | Composant accordeon accessible. Pattern pour les FAQ expand/collapse. Deja utilise dans SignApps (via shadcn/ui). |
| **Fuse.js** (github.com/krisk/Fuse) | **Apache-2.0** | Recherche fuzzy client-side. Pattern pour la recherche instantanee dans les articles FAQ sans appel serveur. |
| **Marked** (github.com/markedjs/marked) | **MIT** | Parser Markdown vers HTML. Pattern pour le rendu des articles FAQ stockes en Markdown. |
| **ammonia** (github.com/rust-ammonia/ammonia) | **MIT/Apache-2.0** | Sanitizer HTML en Rust. Pattern pour le nettoyage du HTML genere depuis le Markdown (prevention XSS). |

---

## Assertions E2E cles (a tester)

- Navigation vers /help affiche le titre `Centre d'aide` et toutes les sections FAQ en grille
- Chaque section affiche son titre, son icone et sa liste de questions sous forme d'accordeons
- Clic sur une question : l'accordeon s'ouvre avec animation slide-down et affiche la reponse
- Clic sur une autre question dans la meme section : la precedente se ferme, la nouvelle s'ouvre
- Deep linking : navigation vers `/help#compte-password` ouvre directement la question correspondante
- La section Compte contient la question `Comment changer mon mot de passe ?` avec une reponse formatee
- La section Securite contient la question `Comment activer le chiffrement de bout en bout ?`
- Recherche `mot de passe` dans la barre : resultats affiches en dropdown avec articles pertinents, termes surlignees
- Recherche `xyzzzz` (aucun resultat) : message `Aucun article ne correspond` avec lien vers le formulaire
- Recherche avec faute de frappe `mot de pass` : Fuse.js trouve quand meme les resultats grace au fuzzy matching
- Clic sur `Verifier les services` : bouton en loading, puis liste des services avec pastilles de couleur
- Chaque service affiche un indicateur vert ou rouge avec le temps de reponse en ms
- Toggle `Auto-refresh` : le health check se relance toutes les 60s, indicateur de derniere verification mis a jour
- Sparkline d'historique visible a cote de chaque service (8 points, couleur par statut)
- Clic sur `Contacter le support` : dialogue modal avec champs Sujet, Categorie, Priorite, Description
- Soumission du formulaire avec tous les champs remplis : toast de confirmation avec numero de ticket
- Soumission du formulaire sans sujet : message d'erreur inline en rouge sous le champ
- Upload de piece jointe : progress bar visible, fichier ajoute avec bouton supprimer
- Section `Mes demandes` affiche la liste des tickets soumis avec statut en badge colore
- Clic sur un ticket : detail avec conversation threadee et bouton Repondre
- Le widget assistant IA s'ouvre au clic sur le bouton flottant `Aide IA` avec animation slide-up
- L'assistant IA repond a une question avec des liens vers les articles sources pertinents
- Le streaming de la reponse IA affiche les tokens un par un
- Vote pouce haut/pouce bas sur une reponse IA : feedback enregistre, remerciement affiche
- Apres 3 echanges sans resolution, l'assistant propose de creer un ticket
- Onglet `Guides` affiche la liste des guides avec duree, etapes et statut
- Lancement du guide `Decouvrir l'interface` : tooltip spotlight sur le premier element cible
- Onglet `Raccourcis clavier` affiche les raccourcis groupes par module avec composant Kbd
- Onglet `Nouveautes` affiche le changelog avec badge `NEW` si non consulte
- Admin : creation d'un article dans `/admin/help/articles/new` avec editeur Markdown split-view
- Admin : publication d'un article brouillon : l'article apparait dans /help
- Admin : analytics affiche les articles les plus consultes et les recherches sans resultat
- Le bouton `?` dans /mail ouvre un drawer avec les articles de la section Mail
- La page est responsive : les sections en colonne unique sur mobile, panneau IA en plein ecran
- Mode sombre : les cartes, accordeons et badges s'adaptent au theme sombre
- Feedback article : clic `Oui` sur `Cet article vous a-t-il ete utile ?` : remerciement affiche
- Feedback article : clic `Non` : champ de commentaire optionnel apparait
