# Module Wiki / Knowledge Base — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Confluence (Atlassian)** | Spaces, pages hiérarchiques, templates, permissions granulaires, macros, integrations Jira, whiteboards, team calendars, database pages (new), inline comments, page history, search puissante |
| **Notion** | Blocks + databases, page tree infini, templates, AI, synced blocks, linked databases, shared pages, guests, mentions, portable |
| **Slab** | Minimalistic, beautiful reading experience, topic-based, verification (info reviewed), integrations, version history |
| **GitBook** | Docs-as-code, Markdown, Git sync, API docs with OpenAPI, custom domains, beautiful themes |
| **Outline** | Clean UX, real-time collab, markdown-based, search, beautiful reading |
| **Nuclino** | Simple, graph view, fast |
| **Docuo** | Developer docs-focused, API docs |
| **Document360** | AI-powered, version control, analytics, SEO, Zendesk alternative |
| **ClickUp Docs** | Integrated with task management |
| **BookStack** | Self-hosted, books/chapters/pages hierarchy |
| **Wiki.js** | Modern self-hosted wiki, multiple storage backends |
| **MediaWiki** | La base de Wikipedia, massively scalable |
| **DokuWiki** | Plain text files, easy self-hosting |

## Principes directeurs

1. **Trouver plutôt que chercher** — arborescence claire, recherche instantanée, structure qui guide naturellement.
2. **Écrire comme un doc, lire comme un wiki** — WYSIWYG pour la création, rendu propre pour la consommation.
3. **Sources de vérité** — chaque information critique doit avoir un owner, une date de dernière vérification, un statut (draft, published, outdated).
4. **Accès contextuel** — depuis n'importe où dans SignApps, rechercher dans le wiki sans quitter l'app courante.
5. **Pages vivantes** — mises à jour collaboratives, historique, commentaires, feedback.
6. **Templates pour stopper la blank page** — dizaines de templates pour démarrer rapidement.

---

## Catégorie 1 — Structure et navigation

### 1.1 Spaces (espaces)
Top level : un ou plusieurs spaces par organisation. `Engineering`, `Sales`, `HR`, `Product`, `Handbook public`. Chacun avec ses permissions, ses members, son thème.

### 1.2 Pages hiérarchiques
Dans un space, arborescence infinie de pages. Une page peut avoir des sous-pages, des sous-sous-pages, etc. Navigation tree dans la sidebar.

### 1.3 Sidebar navigation
Sidebar gauche avec :
- Tous les spaces accessibles (liste pliable)
- Page actuelle et son arbre
- Épinglés personnels
- Récents
- Favoris
- Recherche

### 1.4 Breadcrumb
En haut de chaque page : `Space > Parent > Sous-parent > Page actuelle`. Navigation clickable.

### 1.5 Tree view plié/déplié
Chevrons pour plier/déplier les sous-sections de l'arbre. État sauvegardé.

### 1.6 Drag-drop pour restructurer
Glisser une page dans l'arbre pour la déplacer. Réorganisation de sous-pages.

### 1.7 Quick navigation
`Ctrl+K` ouvre un quick switcher : rechercher une page par nom, même dans d'autres spaces.

### 1.8 Page hiérarchie visuelle (mind map)
Vue alternative en graphe/mind map de la structure du space. Navigation visuelle.

### 1.9 Récents
Liste des 20 dernières pages consultées par l'utilisateur.

### 1.10 Favoris / Bookmark
Marquer des pages comme favorites pour accès rapide.

### 1.11 Followed pages
Suivre une page → recevoir des notifs quand elle est modifiée.

### 1.12 Table of contents (TOC)
Sur chaque page, TOC auto-généré dans un sidebar de droite avec tous les H1-H6. Clic pour scroll.

### 1.13 Breadcrumb navigation avec context
Breadcrumb montre aussi le space. Utile pour les utilisateurs avec plusieurs spaces ouverts.

### 1.14 Pinned pages
Épingler une page en haut du space (visibilité admin-only pour les infos critiques).

---

## Catégorie 2 — Création et édition de pages

### 2.1 Création de page
Bouton `+ Nouvelle page` ou raccourci. Page vide ou depuis template.

### 2.2 Templates
Galerie de templates pour wiki :
- **Handbook d'entreprise** (onboarding, policies, benefits)
- **Documentation produit** (features, FAQ, troubleshooting)
- **Guide technique** (architecture, API docs, tutoriels)
- **Post-mortem incident**
- **ADR** (Architecture Decision Record)
- **Retrospective** d'équipe
- **Meeting notes**
- **Playbook / Runbook**
- **Research notes**
- **Interview notes**
- **Decision log**
- **OKRs**
- **Team charter**
- **Style guide**

### 2.3 Éditeur rich text
Même éditeur que le module Docs (Tiptap). Tous les features : titres, listes, tables, images, code, embeds, math, etc.

### 2.4 Raccourcis markdown
Comme dans Docs : `# ` pour H1, `- ` pour liste, `> ` pour quote, etc.

### 2.5 Slash commands
`/` pour insérer rapidement : heading, list, table, image, code, embed, mention, etc.

### 2.6 Callouts et banners
Blocs colorés pour `Info`, `Warning`, `Success`, `Danger`, `Tip`. Icône configurable.

### 2.7 Synced blocks
Contenu réutilisable : un bloc édité à un endroit se met à jour partout où il est utilisé. Utile pour les disclaimers, les infos d'équipe, les policies.

### 2.8 Embed de pages
`@page` insère un embed d'une autre page (titre, description, lien). Live preview.

### 2.9 Columns layout
Organiser le contenu en colonnes (2, 3, 4). Drag-drop pour réorganiser.

### 2.10 Toggles (collapsible)
Blocs pliables pour les FAQ, les détails optionnels, les exemples longs.

### 2.11 Tabs
Onglets dans une page (ex: `Mac`, `Windows`, `Linux` pour une doc de setup).

### 2.12 Code blocks avec syntaxe
Blocks de code avec 100+ langages. Tabs pour les exemples multi-langages. Runnable (pour JavaScript/Python via sandbox).

### 2.13 Diagrams (Mermaid)
Blocks Mermaid pour flowcharts, séquences, gantt, class diagrams, ER diagrams.

### 2.14 Math équations
LaTeX via KaTeX pour les formules mathématiques.

### 2.15 Embed external services
YouTube, Vimeo, Figma, Miro, Loom, GitHub, CodePen, Twitter, Spotify, Google Maps, Airtable, Notion, Confluence.

### 2.16 Tables
Tables Notion-style avec tri, filter, formules simples. Intégration avec les databases (si on promeut une table en base).

### 2.17 Images et médias
Upload, drag-drop, from URL, from drive. Caption, alt text, alignement, crop, annotations.

### 2.18 Attachments
Fichiers PDF, DOCX, ZIP, etc. rendus comme cards avec preview et download button.

### 2.19 Auto-save
Sauvegarde automatique à chaque frappe (Yjs).

### 2.20 Brouillons
Option `Sauver comme brouillon` : la page n'est pas publiée, visible uniquement par l'auteur et les co-auteurs invités.

### 2.21 Publish
Bouton `Publish` pour rendre la page accessible aux autres (selon les permissions du space).

### 2.22 Unpublish
Retirer une page publiée → elle redevient brouillon.

---

## Catégorie 3 — Collaboration

### 3.1 Édition temps réel
Plusieurs utilisateurs peuvent éditer une même page simultanément. Curseurs visibles avec noms et couleurs. Yjs pour le CRDT.

### 3.2 Commentaires inline
Sélectionner du texte → bouton `Commenter`. Bulle latérale avec thread. @mention pour notifier.

### 3.3 Commentaires page-level
Section commentaires en bas de page pour discussion globale.

### 3.4 Résolution de commentaires
Marquer un commentaire comme résolu. Le commentaire est archivé mais consultable.

### 3.5 Mode suggestion
Toggle `Mode suggestion` : les modifications deviennent des propositions à accepter/rejeter.

### 3.6 Version history
Historique complet des modifications. Comparer deux versions. Restaurer une version antérieure.

### 3.7 Nommage de versions
Marquer des versions importantes (`v1.0 publiée`, `Post-review`).

### 3.8 Watch page
Suivre une page pour être notifié des modifications.

### 3.9 @mentions de personnes
Taper `@` → autocomplétion des utilisateurs. Mention crée une notification.

### 3.10 @mentions de pages
Taper `@` → autocomplétion des pages. Mention crée un lien bidirectionnel.

### 3.11 Notifications
Notifs pour : nouvelles mentions, commentaires sur mes pages, modifications de pages suivies, réponses dans mes threads.

### 3.12 Activity log
Timeline des modifications d'une page ou d'un space.

### 3.13 Like / Helpful votes
Boutons "helpful" ou "like" sur les pages. Classement par utilité.

### 3.14 Suggest edit (external)
Pour les wikis publics, les externes peuvent suggérer des edits sans avoir accès direct (review nécessaire).

---

## Catégorie 4 — Recherche et découverte

### 4.1 Recherche globale
Barre de recherche en haut, toujours accessible. Résultats progressifs pendant la saisie.

### 4.2 Full-text search
Indexation de tout le contenu des pages (titres, corps, commentaires). Résultats triés par pertinence.

### 4.3 Filters
- **Space** : limiter à un ou plusieurs spaces
- **Auteur** : par créateur ou éditeur
- **Date** : créé/modifié dans une période
- **Tags** : pages avec certains tags
- **Type** : page, template, comment, attachment

### 4.4 Search operators
```
in:engineering        → dans le space "engineering"
author:jean           → écrit par Jean
after:2026-01-01      → modifié après
tag:policy            → avec ce tag
"exact phrase"        → phrase exacte
```

### 4.5 Résultats avec contexte
Résultats affichent le titre + un extrait du contenu avec les mots-clés surlignés.

### 4.6 Search ranking intelligent
Pages récemment visitées remontent. Pages très lues par l'équipe sont boostées. Pages "verified" priorisées.

### 4.7 Recherche sémantique (IA)
"Comment configurer VPN ?" trouve même si le texte exact est "Setup du Virtual Private Network". Embeddings vectoriels.

### 4.8 Recherche dans les pièces jointes
Contenu des PDFs, DOCX indexé (OCR pour les images). Cherchable.

### 4.9 Q&A direct (AI)
Dans la barre de recherche, poser une question : "Quelle est la politique de télétravail ?". L'IA répond directement avec citation de la page source.

### 4.10 Recherches sauvegardées
Sauvegarder une recherche comme un "smart filter". Consultable et re-exécutable.

### 4.11 Recherches suggérées / populaires
Page d'accueil du wiki avec les recherches populaires de l'équipe ("Onboarding", "Policy", "API docs").

### 4.12 Related pages
Sur chaque page, widget "Pages similaires" basé sur le contenu (ML).

### 4.13 Backlinks
Sur chaque page, liste des autres pages qui la référencent. Graph bidirectionnel.

---

## Catégorie 5 — Gouvernance et qualité

### 5.1 Page owners
Chaque page a un propriétaire (personne ou équipe) responsable de son contenu et de sa maintenance.

### 5.2 Statut de page
Labels : `Draft`, `Published`, `Verified`, `Outdated`, `Archived`. Visible en badge en haut de la page.

### 5.3 Verification workflow
Page marquée `Needs review` → un reviewer désigné doit vérifier et marquer `Verified` avec sa signature.

### 5.4 Expiration et rappels
Chaque page peut avoir une date d'expiration. À cette date, le owner est notifié pour revoir.

### 5.5 Outdated warning
Si une page n'a pas été modifiée ni vérifiée depuis X mois, bandeau `Cette page pourrait être obsolète`.

### 5.6 Archive
Archiver une page : elle n'apparaît plus dans la recherche, mais reste accessible via lien direct. Restaurable.

### 5.7 Delete avec corbeille
Supprimer une page → corbeille avec rétention de 30 jours. Restauration possible.

### 5.8 Stats par page
Nombre de vues, utilisateurs uniques, temps moyen passé, feedback score. Dashboard pour le owner.

### 5.9 Contribution stats
Stats par utilisateur : pages créées, éditées, commentées. Leaderboard.

### 5.10 Content audit
Rapport listant : pages obsolètes, sans owner, peu vues, sans mises à jour récentes. Pour le cleanup régulier.

### 5.11 Duplicate detection
L'IA détecte les pages très similaires (fuzzy match sur contenu). Suggestion de fusion.

### 5.12 Link checker
Scan automatique des liens (internes et externes). Rapport des liens cassés.

---

## Catégorie 6 — Permissions et partage

### 6.1 Permissions par space
Chaque space a ses permissions globales : public (tout le monde peut voir), restricted (membres seulement), private (invités seulement).

### 6.2 Permissions par page
Override des permissions du space pour une page spécifique.

### 6.3 Rôles
- **Viewer** : peut lire seulement
- **Commenter** : peut lire et commenter
- **Editor** : peut lire, commenter, éditer
- **Owner** : peut supprimer, gérer permissions

### 6.4 Groupes et teams
Partager avec des groupes prédéfinis (`@engineering`, `@management`). Propagation automatique.

### 6.5 Lien public
Générer un lien public pour une page (avec restrictions : expiration, password).

### 6.6 External users / Guests
Inviter des externes avec accès limité à certaines pages. Pour les partenaires, clients, freelances.

### 6.7 Personal space
Chaque utilisateur a un "Personal space" pour ses notes privées. Non partageable par défaut.

### 6.8 Public wiki (handbook public)
Option de publier un space comme site web public (custom domain, SEO). Utile pour les handbooks comme GitLab Handbook.

### 6.9 Export d'une page
PDF, Markdown, HTML, Word.

### 6.10 Export d'un space entier
Export bulk en ZIP avec structure de dossiers et fichiers Markdown/HTML.

### 6.11 Access request
Si un utilisateur reçoit un lien mais n'a pas accès, bouton `Request access`. Notification au owner.

### 6.12 Audit logs
Log : qui a lu/édité/partagé/supprimé quelles pages. Pour compliance.

---

## Catégorie 7 — Intégrations et imports

### 7.1 Import Markdown
Upload de fichiers `.md` ou dossier → création des pages correspondantes en préservant la hiérarchie.

### 7.2 Import depuis Notion
Connecteur pour importer des pages depuis un workspace Notion. Préservation de la structure.

### 7.3 Import depuis Confluence
Upload d'un export Confluence (HTML/XML) → parsing et import.

### 7.4 Import depuis Google Docs
Sélection d'un dossier Google Drive avec des docs → import comme pages wiki.

### 7.5 Import depuis GitHub (README.md)
Sync d'un repository GitHub avec des `.md` → création de pages. Update automatique à chaque push.

### 7.6 Export Markdown
Tout le wiki exportable en MD pour portability.

### 7.7 Export PDF
Page ou space entier exportable en PDF avec TOC, numérotation, cover page.

### 7.8 Export static site
Générer un site statique du space (HTML, CSS, JS) pour hébergement externe (GitHub Pages, Netlify, Vercel).

### 7.9 Intégration Docs
Lien bidirectionnel : une page wiki peut embarquer un doc Docs, et vice versa.

### 7.10 Intégration Drive
Attacher des fichiers du Drive aux pages wiki.

### 7.11 Intégration Tasks
Créer des tâches depuis une page wiki (`/task`). Les tâches apparaissent dans le module Tasks et restent liées.

### 7.12 Intégration Chat
Partager une page wiki dans un channel chat → smart chip avec titre, description, auteur.

### 7.13 Intégration Mail
Envoyer une page wiki par email (copie du contenu ou lien).

### 7.14 API REST
Endpoints pour CRUD sur les pages, spaces, permissions. Webhooks pour les events.

### 7.15 Webhook sortant
À chaque modification de page, POST vers une URL externe. Pour les notifications custom ou sync.

---

## Catégorie 8 — IA intégrée

### 8.1 Recherche sémantique
Questions en langage naturel, l'IA comprend l'intention.

### 8.2 Q&A conversationnel
Chatbot au-dessus du wiki : poser une question, l'IA répond avec sources citées. Pour onboarding et support interne.

### 8.3 Résumé automatique
Bouton `Résumer cette page` pour un TL;DR.

### 8.4 Génération de page
Prompt "Créer une page sur la politique de télétravail" → l'IA génère un brouillon structuré à partir de templates.

### 8.5 Amélioration de wording
Sur sélection → `IA > Améliorer`. Plus clair, concis, professionnel.

### 8.6 Traduction automatique
Traduire une page dans une autre langue. Version multilingue gérée automatiquement.

### 8.7 Détection d'incohérences
L'IA détecte les contradictions entre pages (ex: deux pages disent des choses différentes sur une même policy).

### 8.8 Suggestions de tags
Tags auto-suggérés basés sur le contenu.

### 8.9 Liens internes suggérés
L'IA repère des concepts mentionnés dans le texte et suggère d'ajouter des liens vers les pages correspondantes.

### 8.10 Summary de changements
Sur le version history, résumé IA des changements entre deux versions ("Ajout d'une section sur le RGPD, mise à jour des procédures d'urgence").

### 8.11 FAQ generation
À partir d'une page longue, générer automatiquement une FAQ.

### 8.12 Duplicate / similar content detection
L'IA identifie les pages traitant du même sujet. Suggestion de merge.

---

## Catégorie 9 — Mobile et accessibilité

### 9.1 Application mobile native
iOS / Android pour consulter et éditer légèrement. Recherche, favoris, pages récentes.

### 9.2 Mode offline
Pages pinned accessibles hors-ligne. Modifications synchronisées au retour.

### 9.3 Accessibilité WCAG AA
Screen reader, navigation clavier, contrastes, focus visible.

### 9.4 Keyboard shortcuts
- `Ctrl+K` : quick switcher
- `/` : recherche
- `Ctrl+E` : mode édition
- `Ctrl+S` : publier (manuel si désiré)
- `Ctrl+B/I/U` : gras/italique/souligné
- `Ctrl+Shift+N` : nouvelle page
- `?` : aide shortcuts

### 9.5 Mode focus / reading
Masquer la sidebar et les distractions pour une lecture confortable.

### 9.6 Mode sombre
Dark theme pour la lecture et l'édition.

### 9.7 Taille de police ajustable
Slider pour augmenter la taille du texte. Important pour l'accessibilité.

### 9.8 Voice reading
TTS (text-to-speech) pour écouter une page. Utile pour multitâche ou accessibilité visuelle.

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **Confluence Support** (support.atlassian.com/confluence-cloud) — docs complètes spaces, macros, templates, permissions.
- **Notion Help** (notion.so/help) — wiki patterns, databases, templates.
- **Slab Help** (help.slab.com) — verification workflow, topics.
- **GitBook Docs** (docs.gitbook.com) — docs-as-code, themes.
- **Outline Docs** (docs.getoutline.com) — collab wiki patterns.
- **GitLab Handbook** (about.gitlab.com/handbook) — exemple public d'un grand wiki.
- **Basecamp Handbook** (basecamp.com/handbook) — autre exemple beau et simple.

### Projets open source permissifs
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **Outline** (github.com/outline/outline) | **BSL 1.1** | **INTERDIT depuis 2022**. Forks pre-BSL étaient BSD. |
| **BookStack** (bookstackapp.com) | **MIT** | Self-hosted wiki avec books/chapters/pages. **À étudier**. Bon pattern simple. |
| **Wiki.js** (wiki.js.org) | **AGPL v3** | **INTERDIT**. |
| **DokuWiki** (dokuwiki.org) | **GPL v2** | **INTERDIT**. Format de fichiers libres. |
| **TiddlyWiki** (tiddlywiki.com) | **BSD-3-Clause** | Non-linear, single-file wiki. Intéressant pattern. |
| **MediaWiki** (mediawiki.org) | **GPL v2+** | **INTERDIT pour copie**. Format wikitext documenté. |
| **XWiki** (xwiki.org) | **LGPL v2.1** | **Weak copyleft** — OK comme consommateur. |
| **Docusaurus** (docusaurus.io) | **MIT** | Générateur de site de docs statique. Meta/React. Parfait pour les docs publiques. |
| **VuePress** (vuepress.vuejs.org) | **MIT** | Générateur Vue. |
| **MkDocs** (mkdocs.org) | **BSD-2-Clause** | Générateur Python. Très utilisé pour les docs techniques. |
| **Material for MkDocs** (squidfunk.github.io/mkdocs-material) | **MIT** | Thème très populaire pour MkDocs. |
| **Nextra** (nextra.site) | **MIT** | Next.js docs framework. Moderne et beau. |
| **Starlight** (starlight.astro.build) | **MIT** | Astro docs framework. Très performant. |
| **Mintlify** | Proprietary | Pour inspiration uniquement. |
| **Tiptap** (tiptap.dev) | **MIT** | Éditeur (déjà utilisé). |
| **Yjs** (yjs.dev) | **MIT** | CRDT pour collab. |
| **Prosemirror** (prosemirror.net) | **MIT** | Base de Tiptap. |
| **Tantivy** (quickwit.io) | **MIT** | Recherche full-text. |
| **MeiliSearch** (meilisearch.com) | **MIT** | Recherche instantanée alternative. |
| **ElasticSearch** (elastic.co) | **SSPL** (since 2021) | **INTERDIT depuis 2021**. OpenSearch (Apache-2.0) est l'alternative fork. |
| **OpenSearch** (opensearch.org) | **Apache-2.0** | Fork d'Elasticsearch permissif. OK. |
| **Algolia DocSearch** | Service | Gratuit pour OSS. Pour les docs publiques. |
| **Mermaid** (mermaid.js.org) | **MIT** | Diagrammes. |
| **KaTeX** (katex.org) | **MIT** | LaTeX rendu. |
| **Shiki** (shiki.matsu.io) | **MIT** | Syntax highlighting. |
| **react-markdown** (remarkjs.github.io) | **MIT** | Rendu Markdown en React. |
| **remark / rehype** (unifiedjs.com) | **MIT** | Pipeline Markdown. |
| **fuse.js** (fusejs.io) | **Apache-2.0** | Fuzzy search côté client. |

### Pattern d'implémentation recommandé
1. **Éditeur** : Tiptap (MIT) comme pour Docs, cohérence cross-module.
2. **Collaboration** : Yjs (MIT) + y-prosemirror.
3. **Stockage** : signapps-db avec tables pages, spaces, revisions, permissions.
4. **Recherche** : Tantivy (MIT) ou MeiliSearch (MIT) pour full-text + embeddings vectoriels pour sémantique.
5. **Sémantique search** : sentence-transformers (Apache-2.0) pour générer les embeddings, stockés dans pgvector (PostgreSQL extension).
6. **Markdown** : remark/rehype (MIT) pour parse et render.
7. **Code highlighting** : Shiki (MIT) pour les blocks de code.
8. **Diagrams** : Mermaid (MIT) intégré.
9. **Math** : KaTeX (MIT).
10. **Static export** : générateur custom ou Starlight (MIT) pour les handbooks publics.
11. **Permissions** : signapps-sharing crate interne.
12. **Version history** : révisions LWW avec Yjs state vectors pour le diff.
13. **AI features** : LLM interne avec RAG (Retrieval-Augmented Generation) sur les pages du wiki.
14. **Templates** : stockés comme pages normales dans un space dédié, marquées "template".

### Ce qu'il ne faut PAS faire
- **Pas de fork** de Wiki.js (AGPL), Outline post-2022 (BSL), MediaWiki, DokuWiki (GPL).
- **Pas d'Elasticsearch post-2021** (SSPL). Utiliser OpenSearch si besoin.
- **Attention à XWiki** : LGPL OK consommateur mais architectures complexes.

---

## Assertions E2E clés (à tester)

- Création d'un space avec nom, description
- Création d'une page dans un space
- Création d'une sous-page
- Drag-drop pour réorganiser l'arbre
- Édition de page avec rich text
- Slash commands (/heading, /list, /table, /code, /embed)
- Callout blocks
- Table of contents auto-généré
- Sauvegarde automatique
- Publish / Unpublish
- Recherche globale avec opérateurs
- Recherche sémantique (question natural language)
- Filters par space, auteur, date
- Quick switcher (Ctrl+K)
- @mention d'une personne (notif)
- @mention d'une page (lien bidirectionnel)
- Backlinks visibles
- Commentaire inline et résolution
- Version history et restore
- Mode suggestion
- Permissions par page (viewer/editor/owner)
- Invitation d'un guest
- Export PDF d'une page
- Export Markdown d'un space
- Import depuis Notion / Confluence
- Template appliqué
- AI : Q&A sur le wiki
- AI : résumer une page
- Statut de page (Verified, Outdated)
- Notification de page suivie modifiée
- Mobile : lecture et favori
