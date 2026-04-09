# Module Recherche (Search) — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Google Workspace Search** | Recherche unifiée cross-app (Gmail, Drive, Calendar, Contacts, Chat), chips de filtres contextuels, suggestions autocomplete, résultats classés par pertinence + récence, Knowledge Graph cards, search operators (from:, to:, has:, is:, after:, before:) |
| **Microsoft 365 Search** | Microsoft Search unifié (SharePoint, OneDrive, Outlook, Teams), Copilot intégré, bookmarks admin, Q&A cards, acronyms, people cards, org chart, topic cards, custom verticals |
| **Elasticsearch** | Full-text search distribué, analyzers custom (stemming, synonymes, n-grams), fuzzy matching, aggregations facettées, boosting par champ, highlighting, suggest (did-you-mean), relevance tuning |
| **Algolia** | Typo-tolerance instantanée, faceted search, filters, InstantSearch UI components, analytics (clicks, conversions), A/B testing relevance, synonymes, rules personnalisées, geo-search |
| **MeiliSearch** | Search-as-you-type ultra-rapide (< 50ms), typo-tolerance intégrée, faceted filters, highlighting, multi-index search, tenant tokens, auto-batching |
| **Typesense** | Typo-tolerance native, faceted search, geo-search, curation (pins/hides), synonymes, vector search hybride, groupage de résultats, scoped API keys |
| **Notion Search** | Recherche full-text dans les pages/databases, filtres par espace/créateur/date, sort par pertinence/date, quick search (Ctrl+K), search in page (Ctrl+F), AI search avec résumé |
| **Slack Search** | Filtres contextuels (in:channel, from:user, has:link, during:, before:, after:), résultats par type (messages, fichiers, channels), search modifiers, saved searches, search history |
| **Confluence Search** | Recherche dans les espaces/pages/blogs, filtres par espace/label/auteur/date, CQL (Confluence Query Language), macros de recherche, content by label |
| **Coveo** | Relevance cloud, machine learning rankings, query suggestions, facets dynamiques, analytics avancées, unified index multi-source, personalized results |
| **Apache Solr** | Full-text search, faceted search, highlighting, spell-check, more-like-this, spatial search, join queries, streaming expressions |
| **Qdrant** | Recherche vectorielle pure, filtrage payload, hybrid search (sparse + dense vectors), multi-tenancy, quantization, recommendations |

## Principes directeurs

1. **Recherche universelle, un seul champ** — une barre de recherche unique (`Ctrl+K`) interroge simultanément tous les modules (Documents, Emails, Contacts, Événements, Fichiers, Tâches, Chat, Wiki). L'utilisateur ne choisit pas où chercher, il cherche.
2. **Deux modes complémentaires** — la recherche standard (full-text, exacte, rapide) et la recherche sémantique (vectorielle, compréhension du sens) coexistent en onglets. Le mode standard est le défaut ; le sémantique est un clic de plus.
3. **Résultats instantanés** — search-as-you-type avec résultats affichés en < 200ms. Pas d'écran vide entre les frappes.
4. **Filtres progressifs** — les filtres apparaissent après la première recherche, contextualisés selon les résultats (type, date, auteur, module). Pas de formulaire complexe à remplir avant de chercher.
5. **Sauvegarde et réutilisation** — les recherches fréquentes sont sauvegardées comme raccourcis. L'historique de recherche est accessible et supprimable.
6. **Pertinence apprise** — les clics sur les résultats alimentent un signal de pertinence. Les résultats les plus cliqués pour une requête donnée remontent progressivement.

---

## Catégorie 1 — Barre de recherche globale

### 1.1 Accès rapide (Ctrl+K / Cmd+K)
Raccourci clavier global qui ouvre une barre de recherche modale centrée (type Spotlight/Alfred). Disponible depuis n'importe quelle page de SignApps. Fermeture par Escape ou clic en dehors.

### 1.2 Search-as-you-type avec suggestions
Dès la première lettre, des suggestions apparaissent sous la barre : résultats récents, recherches précédentes, contacts correspondants, documents correspondants. Mise à jour à chaque frappe avec debounce de 150ms.

### 1.3 Catégorisation automatique des suggestions
Les suggestions sont groupées par type dans le dropdown : « Documents » (icône fichier), « Emails » (icône enveloppe), « Contacts » (icône personne), « Événements » (icône calendrier), « Tâches » (icône checkbox), « Chat » (icône bulle). Maximum 3 résultats par catégorie dans le dropdown.

### 1.4 Opérateurs de recherche
Syntaxe avancée reconnue dans la barre : `from:alice` (auteur), `in:mail` (module), `type:pdf` (type de fichier), `after:2026-01-01` (date), `before:2026-04-01`, `has:attachment`, `is:unread`, `label:urgent`, `tag:projet-alpha`. Autocomplétion des opérateurs avec description.

### 1.5 Historique de recherche
Clic sur la barre vide affiche les 10 dernières recherches avec horodatage. Bouton supprimer pour chaque entrée. Bouton « Effacer l'historique ». L'historique est local à l'utilisateur et stocké en base.

### 1.6 Navigation clavier dans les résultats
Flèches haut/bas pour naviguer dans les suggestions. Entrée pour ouvrir le résultat sélectionné. Tab pour passer à la catégorie suivante. Escape pour fermer.

---

## Catégorie 2 — Recherche standard (full-text)

### 2.1 Onglet « Recherche standard »
Premier onglet de la page de résultats. Recherche full-text classique basée sur la correspondance exacte des termes, avec tokenization, stemming français/anglais et suppression des stop words.

### 2.2 Résultats avec highlighting
Les termes recherchés sont surlignés en jaune dans le titre et l'extrait du résultat. L'extrait montre le passage le plus pertinent du document (snippet de 2-3 lignes autour du terme trouvé).

### 2.3 Classement par pertinence
Score de pertinence basé sur : correspondance exacte du titre (boost x3), correspondance dans le body (boost x1), récence (boost logarithmique), popularité (nombre de vues/ouvertures), signal de clic (résultats déjà cliqués pour cette requête).

### 2.4 Recherche par phrase exacte
Guillemets pour forcer la correspondance exacte : `"rapport trimestriel Q1"` ne retourne que les documents contenant cette phrase exacte dans cet ordre.

### 2.5 Opérateurs booléens
`AND`, `OR`, `NOT` supportés : `budget AND 2026 NOT brouillon`. Parenthèses pour grouper : `(budget OR forecast) AND Q1`. Par défaut, les termes sont combinés en AND implicite.

### 2.6 Recherche wildcard
`budget*` matche « budget », « budgets », « budgétaire ». `*port` matche « rapport », « transport ». Wildcard en début de mot plus coûteux (avertissement si requête lente).

### 2.7 Correction orthographique (did-you-mean)
Si aucun résultat ou peu de résultats, suggestion « Vouliez-vous dire : [terme corrigé] ? ». Basé sur la distance de Levenshtein et le dictionnaire des termes indexés.

### 2.8 Synonymes et abréviations
Table de synonymes configurable par l'admin : `RH` = `Ressources Humaines`, `CA` = `Chiffre d'Affaires`, `RGPD` = `GDPR`. La recherche « RH » retourne aussi les documents contenant « Ressources Humaines ».

---

## Catégorie 3 — Recherche sémantique (vectorielle)

### 3.1 Onglet « Recherche sémantique »
Deuxième onglet de la page de résultats. Recherche basée sur la similarité de sens (embeddings vectoriels) plutôt que sur la correspondance textuelle. Permet de trouver des documents pertinents même sans les mots-clés exacts.

### 3.2 Requête en langage naturel
L'utilisateur tape une question ou une description : « politique de télétravail de l'entreprise » retourne les documents traitant du sujet même s'ils ne contiennent pas ces mots exacts (ex : « charte du travail à distance », « remote work guidelines »).

### 3.3 Embeddings pré-calculés
Chaque document, email, contact et événement est vectorisé à l'indexation via le service `signapps-ai` (port 3005). Les embeddings sont stockés dans pgvector (384 dimensions pour le texte, 1024 pour le multimodal). Re-vectorisation incrémentale à chaque modification.

### 3.4 Recherche hybride (full-text + vectorielle)
Option « Hybride » qui combine les scores full-text et vectoriels avec pondération configurable (par défaut 60% sémantique, 40% full-text). Meilleure précision que chaque méthode seule.

### 3.5 Similarité de documents (more-like-this)
Depuis un résultat, bouton « Trouver des documents similaires ». Utilise l'embedding du document comme vecteur de requête pour trouver les N documents les plus proches dans l'espace vectoriel.

### 3.6 Score de confiance affiché
Chaque résultat sémantique affiche un score de similarité (0-100%) pour que l'utilisateur évalue la pertinence. Les résultats sous un seuil configurable (ex : < 30%) sont masqués.

---

## Catégorie 4 — Filtres et facettes

### 4.1 Panneau de filtres latéral
Panneau à gauche de la page de résultats avec les facettes : Type de contenu, Module source, Date de création, Date de modification, Auteur/Propriétaire, Tags/Labels, Statut. Chaque facette affiche le compteur de résultats.

### 4.2 Filtre par type de contenu
Checkboxes : Documents (Word, Excel, PDF, etc.), Emails, Contacts, Événements, Tâches, Fichiers (images, vidéos, archives), Messages Chat, Pages Wiki. Multi-sélection. Le compteur se met à jour en temps réel.

### 4.3 Filtre par date
Plages prédéfinies : Aujourd'hui, Cette semaine, Ce mois, Ce trimestre, Cette année, Personnalisé (date picker début/fin). Applicable à la date de création ou de dernière modification.

### 4.4 Filtre par auteur
Champ avec autocomplétion sur les utilisateurs de l'organisation. Multi-sélection. Affiche l'avatar et le nom.

### 4.5 Filtre par tags/labels
Sélection parmi les tags existants (autocomplétion). Les tags sont ceux appliqués dans les modules sources (labels Gmail-style, tags Drive, catégories Calendar).

### 4.6 Filtres combinés
Tous les filtres se combinent en AND. L'état des filtres actifs est affiché en « chips » cliquables au-dessus des résultats. Clic sur une chip la supprime. Bouton « Réinitialiser les filtres ».

### 4.7 Compteurs de facettes dynamiques
Les compteurs de chaque facette se recalculent en fonction des filtres déjà appliqués. Si un filtre « Type: Email » est actif, les compteurs des autres facettes reflètent uniquement les emails.

---

## Catégorie 5 — Résultats et affichage

### 5.1 Liste de résultats unifiée
Les résultats sont affichés dans une liste verticale avec, pour chaque résultat : icône du type, titre (avec highlighting), module source (badge), extrait/snippet (avec highlighting), auteur, date, taille (pour les fichiers).

### 5.2 Preview inline
Survol ou clic sur un chevron à droite affiche un aperçu du document/email dans un panneau latéral sans quitter la page de résultats. Pour les documents : preview du contenu. Pour les emails : objet + body. Pour les contacts : fiche résumée.

### 5.3 Tri des résultats
Options de tri : Pertinence (défaut), Date (plus récent d'abord), Date (plus ancien d'abord), Nom (A-Z), Taille. Le tri est persistant pendant la session de recherche.

### 5.4 Pagination et scroll infini
Par défaut, scroll infini avec chargement progressif (20 résultats par batch). Option de basculer en pagination classique (20 résultats par page avec numéros de page).

### 5.5 Résultats groupés par module
Mode d'affichage alternatif : les résultats sont groupés par module (section Documents, section Emails, section Contacts, etc.) avec un « Voir plus » par section. Utile pour avoir une vue d'ensemble rapide.

### 5.6 Actions sur les résultats
Menu contextuel sur chaque résultat : Ouvrir, Ouvrir dans un nouvel onglet, Copier le lien, Partager, Télécharger (si fichier), Ajouter aux favoris, Ajouter à une collection.

### 5.7 Résultat zéro (empty state)
Si aucun résultat : message « Aucun résultat pour [requête] » avec suggestions (correction orthographique, requêtes alternatives, essayer la recherche sémantique si on est en standard et vice versa).

---

## Catégorie 6 — Recherches sauvegardées et collections

### 6.1 Sauvegarder une recherche
Bouton « Sauvegarder cette recherche » en haut de la page de résultats. Nom personnalisable. La recherche sauvegardée conserve la requête, les filtres et le mode (standard/sémantique).

### 6.2 Liste des recherches sauvegardées
Accessible depuis le panneau latéral ou le menu utilisateur. Affiche le nom, la requête, le nombre de résultats actuels (dynamique), la date de création.

### 6.3 Alertes de recherche
Option sur une recherche sauvegardée : « M'alerter quand un nouveau résultat apparaît ». Notification push/email quand un nouveau document/email correspond à la requête sauvegardée.

### 6.4 Collections de résultats
Créer une collection nommée et y ajouter des résultats de recherche manuellement. Utile pour constituer un dossier thématique (ex : « Veille concurrentielle Q1 », « Documents projet Alpha »).

### 6.5 Partage de recherche
Générer un lien vers une recherche (requête + filtres). Le destinataire voit les résultats filtrés par ses propres permissions (pas d'escalade de privilèges).

---

## Catégorie 7 — Indexation et administration

### 7.1 Indexation incrémentale temps réel
Chaque création/modification/suppression dans un module déclenche une ré-indexation asynchrone via PgEventBus. Le nouveau contenu est cherchable en < 5 secondes après la modification.

### 7.2 Index full-text PostgreSQL
Utilisation des index GIN avec `tsvector` et `ts_query` PostgreSQL pour la recherche standard. Dictionnaires français et anglais configurés. Poids par champ (titre A, body B, métadonnées C).

### 7.3 Index vectoriel pgvector
Embeddings stockés dans les tables `VectorRepository` (384d) et `MultimodalVectorRepository` (1024d) du crate `signapps-db`. Index IVFFlat ou HNSW selon le volume.

### 7.4 Statistiques de recherche (admin)
Panneau admin avec : top 50 requêtes, requêtes sans résultats (zero-hit), taux de clic par résultat, temps de réponse moyen, volume de requêtes par jour. Utile pour améliorer la pertinence et identifier les lacunes.

### 7.5 Gestion des synonymes (admin)
Interface admin pour ajouter/modifier/supprimer des synonymes. Application immédiate sans ré-indexation complète. Import/export CSV.

### 7.6 Poids et boosting (admin)
Configuration des poids par module (ex : Documents x2, Emails x1, Chat x0.5) et par champ (titre x3, body x1). Permet d'ajuster la pertinence globale sans modifier le code.

### 7.7 Respect des permissions
Les résultats de recherche sont filtrés par les permissions de l'utilisateur connecté. Un document partagé uniquement avec Alice n'apparaît pas dans les résultats de Bob. Le filtrage est appliqué au niveau de la requête (pas en post-filter).

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **Google Workspace Search** (support.google.com) — documentation sur les opérateurs de recherche, filtres, Cloud Search.
- **Microsoft 365 Search** (learn.microsoft.com/microsoftsearch) — guides sur les bookmarks, Q&A, custom verticals, search analytics.
- **Elasticsearch Reference** (elastic.co/guide) — documentation exhaustive sur les analyzers, queries, aggregations, relevance tuning.
- **Algolia Documentation** (algolia.com/doc) — guides InstantSearch, typo-tolerance, faceted search, analytics, A/B testing.
- **MeiliSearch Documentation** (docs.meilisearch.com) — guides sur le search-as-you-type, facets, filters, tenant tokens.
- **Typesense Documentation** (typesense.org/docs) — guides sur la curation, synonymes, vector search hybride.
- **Notion Search Help** (notion.so/help/search) — documentation sur la recherche full-text, filtres, quick search.
- **Slack Search Tips** (slack.com/help/articles) — guide des opérateurs de recherche, filtres contextuels, search modifiers.

### Projets open source permissifs à étudier comme pattern
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **MeiliSearch** (github.com/meilisearch/meilisearch) | **MIT** | Moteur de recherche full-text en Rust. Pattern pour le search-as-you-type, typo-tolerance, facets. Référence architecturale. |
| **Typesense** (github.com/typesense/typesense) | **GPL-3.0** | **INTERDIT** (GPL). Ne pas utiliser ni copier. Étudier les docs publiques uniquement. |
| **Tantivy** (github.com/quickwit-oss/tantivy) | **MIT** | Moteur de recherche full-text en Rust (équivalent Lucene). Pattern pour l'indexation, le scoring, les analyzers. |
| **Sonic** (github.com/valeriansaliou/sonic) | **MPL-2.0** | Moteur d'auto-suggestion rapide en Rust. Pattern pour le search-as-you-type léger. Consommation OK (MPL-2.0). |
| **cmdk** (github.com/pacocoursey/cmdk) | **MIT** | Composant React pour commande palette (Ctrl+K). Pattern direct pour la barre de recherche modale. |
| **kbar** (github.com/timc1/kbar) | **MIT** | Command bar React extensible. Alternative à cmdk avec animations et groupes. |
| **instantsearch.js** (github.com/algolia/instantsearch) | **MIT** | Widgets UI pour la recherche facettée (hits, facets, pagination, search box). Pattern pour les composants de résultats. |
| **react-instantsearch** (github.com/algolia/instantsearch) | **MIT** | Version React d'InstantSearch. Pattern pour les hooks de recherche et les composants facettés. |
| **Qdrant** (github.com/qdrant/qdrant) | **Apache-2.0** | Moteur de recherche vectorielle en Rust. Pattern pour le hybrid search et le filtrage payload. |
| **pgvector** (github.com/pgvector/pgvector) | **PostgreSQL License** (permissive) | Extension PostgreSQL pour les embeddings vectoriels. Déjà utilisée dans SignApps. |

### Pattern d'implémentation recommandé
1. **Full-text** : index GIN PostgreSQL natif avec `tsvector`/`ts_query`. Dictionnaires `french` et `english`. Pas de moteur externe pour limiter la complexité opérationnelle.
2. **Sémantique** : embeddings via `signapps-ai` (port 3005), stockés dans pgvector, requêtés via `signapps-db` `VectorRepository`.
3. **Barre de recherche** : `cmdk` (MIT) pour la commande palette Ctrl+K. Composant custom pour la page de résultats.
4. **Facettes** : compteurs calculés par des requêtes PostgreSQL `GROUP BY` avec `COUNT`. Pas d'aggregation engine externe.
5. **Indexation** : événements PgEventBus déclenchés à chaque CRUD dans les modules. Worker asynchrone pour la vectorisation.
6. **Permissions** : clause `WHERE` ajoutée dynamiquement aux requêtes de recherche, basée sur les permissions de l'utilisateur (propriétaire, partagé, public).

---

## Assertions E2E clés (à tester)

- Ctrl+K ouvre la barre de recherche modale depuis n'importe quelle page
- La saisie d'un terme affiche des suggestions en < 200ms
- Les suggestions sont groupées par type (Documents, Emails, Contacts, etc.)
- Entrée sur une suggestion ouvre le résultat correspondant
- Escape ferme la barre de recherche
- L'onglet Recherche standard retourne des résultats full-text avec highlighting
- L'onglet Recherche sémantique retourne des résultats pertinents pour une question en langage naturel
- Les opérateurs de recherche fonctionnent : `from:`, `in:`, `type:`, `after:`, `before:`
- Le filtre par type de contenu réduit les résultats au type sélectionné
- Le filtre par date restreint les résultats à la plage choisie
- Le filtre par auteur restreint les résultats à l'auteur sélectionné
- Les compteurs de facettes se mettent à jour dynamiquement
- Les chips de filtres actifs s'affichent au-dessus des résultats et sont supprimables
- Le tri par pertinence, date et nom fonctionne
- Le preview inline affiche le contenu du document sélectionné
- La correction orthographique propose une alternative quand aucun résultat n'est trouvé
- Une recherche sauvegardée apparaît dans la liste des recherches sauvegardées
- L'historique de recherche affiche les 10 dernières requêtes
- Un document non partagé avec l'utilisateur n'apparaît pas dans ses résultats
- Le bouton « Trouver des documents similaires » retourne des résultats sémantiquement proches
- La recherche par phrase exacte (guillemets) ne retourne que les correspondances exactes
- Scroll infini charge les résultats suivants au scroll
- La page affiche un empty state cohérent quand aucun résultat ne correspond
- Le mode résultats groupés par module affiche les sections avec « Voir plus »
