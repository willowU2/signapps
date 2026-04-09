# Module Gamification — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Spinify** | Leaderboards TV-ready, gamification des KPIs de vente, competitions d'équipe, celebrations vidéo, intégration CRM (Salesforce, HubSpot), badges custom, points par métrique, coaching AI |
| **Ambition** | Scorecards gamifiées, coaching workflows, fantasy sports-style leagues, benchmarking, TV dashboards, intégration Salesforce/Gong/Outreach, OKR tracking gamifié |
| **LevelEleven** | Sales gamification, contests configurables, leaderboards par métrique, badges, points, streaks, TV displays, CRM-native (Salesforce), coaching scorecards |
| **Bunchball / Nitro (BI Worldwide)** | Enterprise gamification platform, missions, quests, leaderboards, virtual economy, badges, levels, social feed, analytics, 200+ enterprise integrations |
| **Badgeville (SAP)** | Comportement-based gamification, missions, badges, leaderboards, reputation points, activity streams, insights analytics, profils gamifiés, widget embeddable |
| **Habitica** | RPG de productivité, avatar personnalisé avec armure/équipement, quests de groupe, streaks daily, damage sur tâches manquées, rewards custom, guilds, challenges communautaires |
| **Todoist Karma** | Système de karma points, streaks quotidiens/hebdomadaires, niveaux (Beginner → Enlightened → Master → Grand Master), trending graphs, goals quotidiens/hebdomadaires |
| **Duolingo** | Référence gamification : XP par leçon, streaks daily avec freeze, leagues hebdomadaires (Bronze→Diamond), gems (currency virtuelle), achievements, hearts/vies, leaderboards sociaux |
| **Forest** | Focus gamification, planter un arbre virtuel par session de focus, forêt qui grandit, social planting, achievements, coins pour vrais arbres plantés |
| **Microsoft Viva Engage** | Badges communautaires, recognition posts, streaks de publication, achievements, leadership acknowledgments, analytics d'engagement |
| **Kahoot!** | Quiz gamifiés temps réel, podium, musique, streaks, points par rapidité de réponse, leaderboards, reports, templates, mode équipe |
| **Octalysis (framework)** | Framework de gamification de Yu-kai Chou — 8 core drives : Epic Meaning, Accomplishment, Empowerment, Ownership, Social Influence, Scarcity, Unpredictability, Avoidance. Référence théorique. |

## Principes directeurs

1. **Motivation intrinsèque d'abord** — la gamification récompense les comportements vertueux (collaboration, complétion, ponctualité) plutôt que la compétition pure. Le leaderboard est opt-in et les niveaux valorisent la progression personnelle.
2. **Non-punitive** — pas de points négatifs, pas de rétrogradation de niveau, pas de pénalité pour inactivité. Les streaks perdus ne font pas perdre de XP acquis. Le système encourage, jamais ne punit.
3. **Transparence des mécaniques** — l'utilisateur voit exactement quelles actions rapportent des XP, comment les badges sont débloqués, et où il en est dans sa progression. Pas de boîte noire.
4. **Optionnelle et discrète** — la gamification est activable/désactivable par utilisateur et par organisation. Quand désactivée, aucun élément gamifié n'apparaît. Quand activée, les éléments sont intégrés subtilement (pas de popups intrusifs).
5. **Équitable** — les XP sont calibrés pour que tous les rôles (commercial, développeur, manager, assistant) puissent progresser à un rythme similaire. Pas de biais en faveur d'un type d'utilisateur.
6. **Données privées par défaut** — le niveau et les badges sont visibles sur le profil de l'utilisateur. Le leaderboard est opt-in. Les statistiques détaillées (actions, heures) ne sont visibles que par l'utilisateur lui-même.

---

## Catégorie 1 — Système XP et niveaux

### 1.1 Points d'expérience (XP)
Chaque action dans SignApps rapporte des XP. Les XP sont cumulatifs et ne diminuent jamais. Le total XP détermine le niveau. Les XP sont gagnés instantanément avec un feedback visuel discret (toast +15 XP).

### 1.2 Barème des actions XP
| Action | XP |
|---|---|
| Document créé | +15 |
| Document partagé | +10 |
| Email envoyé | +5 |
| Email répondu (< 24h) | +8 |
| Réunion organisée | +20 |
| Réunion rejointe | +10 |
| Tâche créée | +5 |
| Tâche terminée | +10 |
| Tâche terminée avant deadline | +15 |
| Revue soumise (code review, document review) | +25 |
| Commentaire constructif | +5 |
| Contact ajouté | +3 |
| Fichier uploadé dans Drive | +5 |
| Formulaire créé | +10 |
| Formulaire répondu | +5 |
| Wiki page créée | +15 |
| Wiki page mise à jour | +8 |
| Participation brainstorm | +20 |
| Vote dans un brainstorm | +3 |
Le barème est configurable par l'admin de l'organisation.

### 1.3 Système de niveaux
Progression par paliers :
| Niveau | Nom | XP requis | Badge visuel |
|---|---|---|---|
| 1 | Débutant | 0 | Étoile bronze |
| 2 | Initié | 100 | Étoile bronze ×2 |
| 3 | Contributeur | 300 | Étoile argent |
| 4 | Actif | 600 | Étoile argent ×2 |
| 5 | Engagé | 1 000 | Étoile or |
| 6 | Expert | 1 500 | Étoile or ×2 |
| 7 | Maître | 2 500 | Diamant |
| 8 | Champion | 4 000 | Diamant ×2 |
| 9 | Légende | 6 000 | Couronne |
| 10 | Virtuose | 10 000 | Couronne dorée |
Le passage de niveau déclenche une animation de célébration et une notification.

### 1.4 Barre de progression
Widget affichant le niveau actuel, les XP accumulés, les XP restants pour le prochain niveau, et une barre de progression animée. Visible dans le profil et optionnellement dans le dashboard.

### 1.5 Historique des XP
Panneau détaillant chaque gain d'XP : date/heure, action, module, XP gagnés. Filtrable par période et par module. Graphique de progression sur 30 jours.

### 1.6 Multiplicateurs temporaires
Événements ponctuels (décidés par l'admin) : « Semaine du partage : ×2 XP sur les documents partagés », « Journée zéro inbox : ×3 XP sur les emails traités ». Bandeau d'annonce et icône sur les actions concernées.

---

## Catégorie 2 — Badges et achievements

### 2.1 Catalogue de badges
Bibliothèque de badges déblocables par l'accomplissement de critères spécifiques. Chaque badge a : nom, icône, description, critère, rareté (Commun, Rare, Épique, Légendaire). Les badges sont affichés sur le profil.

### 2.2 Badges par module
Exemples de badges par module :
- **Mail** : « Inbox Zero » (0 email non lu pendant 24h), « Speed Responder » (réponse < 1h à 50 emails), « Diplomatic » (100 emails envoyés sans pièce jointe oubliée)
- **Calendar** : « Ponctuel » (rejoint 20 réunions à l'heure), « Organisateur » (créé 50 événements), « Efficace » (0 réunion sans agenda ce mois)
- **Docs** : « Auteur prolifique » (50 documents créés), « Réviseur » (25 reviews soumises), « Collaborateur » (participé à 20 documents partagés)
- **Tasks** : « Productif » (100 tâches terminées), « Avant l'heure » (30 tâches terminées avant deadline), « Streak master » (7 jours consécutifs avec au moins 1 tâche terminée)
- **Drive** : « Organisé » (30 fichiers classés dans des dossiers), « Partageur » (50 fichiers partagés)
- **Chat** : « Communicant » (500 messages envoyés), « Réactif » (100 réponses dans le chat)

### 2.3 Badges progressifs (multi-tiers)
Certains badges ont plusieurs niveaux : Bronze (seuil 1), Argent (seuil 2), Or (seuil 3). Ex : « Auteur » Bronze (10 docs) → Argent (50 docs) → Or (200 docs). Chaque tier remplace le précédent sur le profil.

### 2.4 Badges secrets
Certains badges ne sont pas affichés dans le catalogue tant qu'ils ne sont pas débloqués. Critères cachés pour encourager l'exploration. Ex : « Easter Egg » (utilisé toutes les fonctionnalités SignApps au moins une fois).

### 2.5 Notification de badge
Quand un badge est débloqué, notification toast avec animation (badge qui apparaît avec effet brillant). Option de partager sur le chat d'équipe. Historique des badges débloqués par date.

### 2.6 Badges custom (admin)
L'admin peut créer des badges personnalisés avec critère custom : nom, icône (upload ou bibliothèque), description, critère (nombre d'actions, date, condition). Ex : « Hackathon Q1 » attribué manuellement aux participants.

---

## Catégorie 3 — Streaks (séries)

### 3.1 Streak quotidien
Compteur de jours consécutifs avec au moins une action productive (configurable : 1 tâche terminée, 1 email traité, 1 document édité, connexion au moins). Le streak s'incrémente chaque jour à minuit si la condition est remplie.

### 3.2 Affichage du streak
Widget avec le compteur de jours (ex: « 12 jours ») et une icône de flamme. La flamme change de couleur/taille selon la longueur du streak (bronze < 7j, argent 7-30j, or 30-100j, diamant > 100j).

### 3.3 Streak freeze (joker)
L'utilisateur dispose de N streak freezes (1 par défaut, gagnables en XP). Un freeze protège le streak pour un jour d'inactivité (weekend, congé, maladie). Activation automatique ou manuelle. Indicateur visuel quand un freeze est utilisé.

### 3.4 Streak recovery
Si le streak est perdu, il ne disparaît pas : l'ancien record est conservé (« Meilleur streak : 45 jours »). Un nouveau streak démarre à 1. Pas de pénalité XP.

### 3.5 Streaks d'équipe
Streak collectif : si tous les membres d'une équipe maintiennent leur streak individuel, le streak d'équipe s'incrémente. Bonus XP pour le streak d'équipe. Visible dans le dashboard d'équipe.

### 3.6 Streak hebdomadaire
En plus du streak quotidien, un streak hebdomadaire compte les semaines consécutives avec un objectif atteint (ex : 5 tâches terminées cette semaine). Moins sensible aux jours de congé.

---

## Catégorie 4 — Classement (Leaderboard)

### 4.1 Leaderboard opt-in
Le classement est désactivé par défaut. L'utilisateur doit explicitement choisir de participer (toggle dans les paramètres). Les utilisateurs non participants n'apparaissent pas et ne voient pas le classement.

### 4.2 Classement par XP hebdomadaire
Le leaderboard affiche le classement des participants par XP gagnés cette semaine (pas le total cumulé). Reset chaque lundi. Cela permet aux nouveaux de rivaliser avec les anciens.

### 4.3 Podium et positions
Top 3 mis en avant avec avatar, nom, XP, niveau et badges principaux. Les autres positions affichées en liste. La position de l'utilisateur courant est toujours visible (même s'il est 50e).

### 4.4 Classement par équipe
Agrégation des XP par équipe. Classement inter-équipes. Utile pour les challenges d'entreprise. L'équipe gagnante reçoit un badge spécial.

### 4.5 Classement par module
Filtrer le leaderboard par module : top contributeurs Docs, top communicants Mail, top organisateurs Calendar, etc. Permet de reconnaître l'expertise par domaine.

### 4.6 Historique des classements
Archives des classements précédents (semaine par semaine). L'utilisateur peut voir sa progression : « Semaine 12 : 5e, Semaine 13 : 3e, Semaine 14 : 1er ».

### 4.7 Challenges et compétitions
L'admin peut créer des challenges temporaires : « Cette semaine, celui qui termine le plus de tâches gagne le badge Gold Challenger ». Durée, critère et récompense configurables. Annonce dans le dashboard et le chat.

---

## Catégorie 5 — Quêtes d'onboarding

### 5.1 Quête de bienvenue
Pour les nouveaux utilisateurs, une quête guidée « Découvrez SignApps » avec 8 étapes :
1. Compléter son profil (avatar, bio)
2. Envoyer son premier email
3. Créer un document
4. Ajouter un contact
5. Créer un événement dans le calendrier
6. Terminer une tâche
7. Uploader un fichier dans Drive
8. Envoyer un message dans le chat
Chaque étape complétée rapporte des XP bonus et débloque un badge « Premier pas ».

### 5.2 Barre de progression de la quête
Widget dédié affichant « Découvrez SignApps 3/8 » avec barre de progression et liste des étapes (complétées et restantes). Lien direct vers l'action requise pour chaque étape.

### 5.3 Quêtes avancées
Après la quête de bienvenue, quêtes thématiques débloquées progressivement :
- « Maîtrisez le Mail » (10 actions mail)
- « Expert Documents » (créer, partager, commenter)
- « Collaborateur » (participer à 3 réunions, commenter, partager)
- « Organisé » (créer des dossiers, des labels, des filtres)

### 5.4 Quêtes d'équipe
Quêtes collaboratives : « L'équipe complète 50 tâches cette semaine ». Barre de progression partagée. Récompense collective (badge d'équipe, XP bonus pour chaque membre).

### 5.5 Quêtes custom (admin)
L'admin peut créer des quêtes personnalisées : nom, description, étapes (conditions), XP de récompense, badge de récompense. Ex : « Onboarding Projet X : lire le wiki, rejoindre le channel chat, compléter la checklist ».

---

## Catégorie 6 — Profil gamifié et social

### 6.1 Carte de profil gamifiée
Section du profil utilisateur affichant : niveau actuel (badge visuel), XP total, barre de progression, streak courant, badges épinglés (3 badges choisis par l'utilisateur en vitrine).

### 6.2 Showcase de badges
Page dédiée listant tous les badges débloqués avec date d'obtention. Les badges non débloqués sont affichés en gris avec le critère. Tri par date, rareté, module.

### 6.3 Comparaison de profils
Possibilité de comparer son profil gamifié avec celui d'un collègue (si celui-ci a opt-in) : niveaux, badges en commun, badges uniques.

### 6.4 Feed d'activité gamifiée
Dans le chat d'équipe ou un channel dédié, messages automatiques (opt-in) : « Alice a atteint le niveau 7 (Maître) ! », « Bob a débloqué le badge Inbox Zero », « L'équipe Marketing a 30 jours de streak ».

### 6.5 Reconnaissance entre pairs
Bouton « Féliciter » sur le profil d'un collègue. Envoie un kudos avec un message personnalisé (+5 XP pour le destinataire). Historique des kudos reçus/envoyés. Limite quotidienne anti-spam.

---

## Catégorie 7 — Administration et analytics

### 7.1 Dashboard admin gamification
Vue d'ensemble : nombre d'utilisateurs actifs dans la gamification, taux d'opt-in du leaderboard, XP total distribués cette semaine, badges les plus/moins débloqués, streaks moyens.

### 7.2 Configuration du barème XP
Interface pour modifier les XP par action. Validation : les changements s'appliquent aux futures actions (pas rétroactif). Preview de l'impact sur la distribution des niveaux.

### 7.3 Activation/désactivation
Toggle global pour activer/désactiver la gamification pour toute l'organisation. Toggle par module (désactiver les XP mail mais garder les XP tasks). Toggle par rôle (désactiver pour les managers si souhaité).

### 7.4 Rapports d'engagement
Graphiques montrant : évolution du nombre d'utilisateurs actifs, corrélation gamification vs utilisation des modules, taux de complétion des quêtes d'onboarding, retention des streaks.

### 7.5 Anti-gaming
Détection de comportements abusifs : création massive de documents vides, envoi d'emails à soi-même, tâches créées et terminées immédiatement. Les actions détectées comme abusives ne rapportent pas d'XP. Seuil configurable.

### 7.6 Reset et migration
Possibilité de remettre à zéro les XP/niveaux (avec confirmation). Migration du barème avec recalcul rétroactif optionnel. Export des données gamification en CSV.

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **Duolingo Blog** (blog.duolingo.com) — articles sur la gamification, les streaks, les leagues, la rétention utilisateur.
- **Habitica Wiki** (habitica.fandom.com) — documentation sur le système RPG, les quests, les streaks, les rewards.
- **Todoist Karma** (todoist.com/help/articles/karma) — documentation sur le système de karma points, niveaux, goals.
- **Octalysis Framework** (yukaichou.com/gamification-examples/octalysis-complete-gamification-framework) — framework théorique de gamification, 8 core drives, White Hat vs Black Hat.
- **Spinify Resources** (spinify.com/resources) — guides sur les leaderboards, les competitions, la gamification des ventes.
- **Bunchball / BI Worldwide** (biworldwide.com) — études de cas enterprise gamification.
- **Gamification.co** — articles et use cases sur la gamification en entreprise.
- **Extra Credits (YouTube)** — séries vidéo sur le game design et la gamification appliquée.

### Projets open source permissifs à étudier comme pattern
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **Habitica** (github.com/HabitRPG/habitica) | **GPL-3.0** (serveur) / **MIT** (client mobile) | **INTERDIT** pour le serveur (GPL). Le client mobile MIT peut être étudié pour les patterns UI de gamification (XP bar, streaks, badges). |
| **Framer Motion** (framer.com/motion) | **MIT** | Animations de célébration (level-up, badge unlock, confetti). Pattern pour les micro-interactions gamifiées. |
| **canvas-confetti** (github.com/catdad/canvas-confetti) | **ISC** | Effet confetti pour les célébrations (level-up, badge débloqué, streak milestone). Léger et configurable. |
| **react-rewards** (github.com/thedevelobear/react-rewards) | **MIT** | Micro-animations de récompense (confetti, emoji rain, balloons) pour React. Pattern direct pour les feedbacks gamifiés. |
| **Lottie / lottie-web** (github.com/airbnb/lottie-web) | **MIT** | Animations JSON (After Effects → Web). Pattern pour les animations de badges et de level-up. |
| **Chart.js** (chartjs.org) | **MIT** | Graphiques de progression (XP over time, engagement trends). Déjà utilisé dans SignApps. |
| **Zustand** (github.com/pmndrs/zustand) | **MIT** | State management pour le store gamification (XP, level, badges, streaks). Déjà utilisé dans SignApps. |
| **date-fns** (date-fns.org) | **MIT** | Calculs de streaks (jours consécutifs, semaines). Déjà utilisé dans SignApps. |
| **nanoid** (github.com/ai/nanoid) | **MIT** | Génération d'IDs courts pour les badges et quêtes. Léger. |

### Pattern d'implémentation recommandé
1. **XP Engine** : handler Axum dans un service dédié ou dans `signapps-gateway`. Écoute les événements PgEventBus de tous les modules et attribue les XP selon le barème configurable.
2. **Stockage** : tables PostgreSQL : `user_xp` (user_id, total_xp, level), `xp_log` (user_id, action, xp, timestamp, module), `badges` (id, name, criteria, rarity), `user_badges` (user_id, badge_id, unlocked_at), `streaks` (user_id, current, best, last_active).
3. **Badges** : évaluation des critères à chaque gain d'XP. Query sur les compteurs (nombre de docs, tâches, etc.) via les repositories existants. Attribution asynchrone pour ne pas ralentir l'action.
4. **Streaks** : cron job quotidien à minuit. Pour chaque utilisateur, vérifier si une action qualifiante a eu lieu dans les 24h. Incrémenter ou reset le streak.
5. **Leaderboard** : query PostgreSQL `ORDER BY weekly_xp DESC LIMIT 50`. Cache moka (signapps-cache) avec TTL 5 min. Invalidation sur nouveau gain d'XP.
6. **Animations** : `canvas-confetti` (ISC) pour les level-up. `react-rewards` (MIT) pour les gains d'XP. `Lottie` (MIT) pour les animations de badges custom.
7. **Anti-gaming** : rate limiting via `signapps-cache` (moka). Max N actions XP par type par heure. Les actions au-delà du seuil ne rapportent pas d'XP.

---

## Assertions E2E clés (à tester)

- La création d'un document génère un toast « +15 XP » et incrémente le compteur XP
- L'envoi d'un email génère +5 XP
- La complétion d'une tâche génère +10 XP (ou +15 si avant deadline)
- Le passage de niveau déclenche une animation de célébration
- La barre de progression XP reflète le ratio XP actuel / XP requis pour le niveau suivant
- L'historique XP liste les gains par date et par action
- Le badge « Inbox Zero » se débloque après 24h sans email non lu
- Le badge progressif « Auteur » passe de Bronze à Argent quand le seuil est atteint
- Le badge secret reste invisible dans le catalogue tant qu'il n'est pas débloqué
- La notification de badge affiche une animation avec le nom et l'icône du badge
- Le streak quotidien s'incrémente à minuit si une action qualifiante a eu lieu
- Le streak freeze protège le streak pour un jour d'inactivité
- Le streak perdu conserve le record du meilleur streak
- Le leaderboard n'affiche que les utilisateurs opt-in
- Le classement hebdomadaire se reset chaque lundi
- Le classement par module filtre les XP par module sélectionné
- La quête d'onboarding « Découvrez SignApps » affiche la progression 0/8 au départ
- La complétion d'une étape de quête incrémente la progression et attribue les XP bonus
- La quête se marque comme terminée quand les 8 étapes sont complétées
- Le profil gamifié affiche le niveau, les XP, le streak et les badges épinglés
- Le bouton « Féliciter » envoie un kudos et génère +5 XP pour le destinataire
- L'admin peut modifier le barème XP et les changements s'appliquent aux futures actions
- Le toggle global désactive tous les éléments gamifiés pour l'organisation
- L'anti-gaming bloque les XP pour les actions abusives (création massive de documents vides)
- Le feed d'activité gamifiée publie les milestones dans le chat d'équipe
