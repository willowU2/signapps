# Module Timesheet (Pointage) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Toggl Track** | One-click timer, detection d'inactivite, tracking automatique par app/site, rapports visuels (barres, camemberts), projet/client/tag, Pomodoro, integrations 100+, extension navigateur, app mobile, export detaille |
| **Clockify** | 100% gratuit pour equipes, timesheet hebdomadaire grid, approbation manager, tarifs horaires par projet/membre, rappels de saisie, kiosk mode (pointeuse physique), Gantt depuis les entrees, facturation integree |
| **Harvest** | Timer + saisie manuelle, integration facturation (invoices depuis les heures), budgets par projet avec alertes %, rapports par client/projet/tache, integration QuickBooks/Xero, approbation, forecast |
| **TimeCamp** | Tracking automatique par app (capture les apps/sites utilises), timesheet approbation workflow, budgets, attendance (presences), productivite par categorie, GPS tracking mobile, integrations PM |
| **Hubstaff** | Screenshots periodiques, activity levels (clavier/souris), GPS tracking, geofencing (pointage auto par lieu), timesheet approbation, paie automatisee, budgets, rapports d'equipe, integrations PM |
| **Paymo** | Timer + timesheet + facturation + gestion de projet en un, Kanban, Gantt, rapports financiers, multi-devise, clients, depenses, milestones, roles et permissions par projet |
| **RescueTime** | Tracking 100% automatique en arriere-plan (apps, sites, fichiers), score de productivite, objectifs, FocusTime (bloque les distractions), rapports automatiques quotidiens/hebdomadaires, pas de saisie manuelle |
| **Kimai** | Open source (MIT), self-hosted, multi-utilisateur, projets/activites/tags, export CSV/PDF/XLSX, API REST, plugins (approbation, factures, budgets, depenses), theme sombre, permissions granulaires |

## Principes directeurs

1. **Chronometre en un clic** — demarrer le suivi du temps doit etre aussi simple que cliquer Play. Le nom de la tache, le toggle facturable et le timer sont sur une seule ligne, toujours visible.
2. **Saisie manuelle complementaire** — pour les oublis ou les entrees retrospectives, un formulaire compact permet d'ajouter une entree avec date, duree, tache et billable en 5 secondes.
3. **KPIs hebdomadaires en haut de page** — trois metriques toujours visibles : total travaille cette semaine, total facturable, nombre d'entrees. Permettent un coup d'oeil sur l'avancement.
4. **Export vers facturation** — un bouton exporte les entrees facturables vers le module Billing (signapps-billing port 8096) via un custom event inter-modules. Zero double saisie.
5. **Historique complet et auditable** — chaque entree conserve sa source (timer vs manuelle), sa date, sa duree, son statut facturable. L'historique est filtrable et exportable.
6. **Integration calendrier** — les entrees de timesheet apparaissent optionnellement dans le calendrier SignApps et inversement : un evenement calendrier peut generer une entree de temps.

---

## Categorie 1 — Chronometre et saisie de temps

### 1.1 Timer widget
Widget chronometre toujours visible en haut de la page dans une barre fixe (sticky top). Layout horizontal sur une seule ligne :
- Champ texte `Nom de la tache...` (flex-grow, min-width 200px)
- Select projet (dropdown, optionnel)
- Toggle facturable (checkbox avec label `$`, defaut coche)
- Affichage du temps ecoule en format `HH:MM:SS` (police monospace, taille 20px, `text-foreground`)
- Bouton Play/Pause (cercle 40px, fond `primary`, icone blanche) — toggle entre play et pause
- Bouton Stop (cercle 40px, fond `destructive`, icone carree blanche) — arrete et enregistre

Quand le timer tourne, le bouton Play se transforme en Pause (deux barres verticales). Le temps ecoule s'actualise chaque seconde. L'affichage clignote brievement toutes les 60 secondes (flash `primary/20` pendant 200ms) comme rappel visuel que le timer tourne. Si l'onglet est en arriere-plan, le titre de la page affiche `[01:23:45] Timesheet` pour que l'utilisateur voie le temps dans l'onglet du navigateur. Raccourci clavier : `Ctrl+Shift+T` toggle play/pause globalement (fonctionne meme si le focus est dans une autre page SignApps).

### 1.2 Demarrage du timer
Clic sur Play declenche le chronometre. Si le champ nom de tache est vide, un toast d'erreur `Saisissez un nom de tache avant de demarrer` apparait et le timer ne demarre pas. Le champ nom recoit le focus automatiquement. Si un nom est present, le timer demarre immediatement : le timestamp de debut (`started_at`) est enregistre cote client. L'autocompletion sur le champ nom suggere les taches recentes (dernieres 10 taches distinctes, triees par frequence d'utilisation). Clic sur une suggestion remplit le nom ET le projet associe.

### 1.3 Pause et reprise
Clic sur Pause suspend le timer. Le temps ecoule reste fige a l'ecran. Le bouton redevient Play. Le timer n'enregistre pas le temps de pause (les periodes de pause sont trackees dans un tableau `pauses` en memoire). Clic sur Play reprend le comptage la ou il s'etait arrete. Le temps total affiche est toujours `temps_actif` (excluant les pauses). Pas de limite de nombre de pauses par session.

### 1.4 Arret et enregistrement
Clic sur Stop arrete le timer et enregistre l'entree dans l'historique via `POST /api/v1/timesheet/entries`. L'entree contient : nom de tache, projet_id (optionnel), duree totale (en secondes, pauses exclues), date de debut, date de fin, facturable (bool), source = `timer`. Toast de confirmation : `Entree enregistree : 1h 23m sur "Nom de tache"`. Le timer se reset a `00:00:00`, le champ nom est vide pour la prochaine entree. Si la duree est inferieure a 30 secondes, un dialogue demande confirmation `La duree est tres courte (XX secondes). Enregistrer quand meme ?`.

### 1.5 Saisie manuelle
Bouton `+ Saisie manuelle` a droite du timer widget. Clic ouvre un formulaire inline (ou modal sur mobile) avec les champs :
- Nom de tache (texte, obligatoire, autocompletion)
- Projet (select, optionnel, liste des projets depuis Tasks/Projects)
- Date (datepicker, defaut aujourd'hui)
- Heure de debut (time input HH:MM, optionnel)
- Duree (deux inputs : heures [0-23] et minutes [0-59], obligatoire)
- Facturable (checkbox, defaut coche)
- Description (textarea, optionnel, max 500 caracteres)
- Tags (input chips, optionnel)

Validation : la duree doit etre > 0. La date ne peut pas etre dans le futur. Bouton `Enregistrer` cree l'entree via `POST /api/v1/timesheet/entries` avec source = `manual`. Toast de confirmation. Le formulaire se ferme apres enregistrement.

### 1.6 Entree par projet
Chaque entree peut etre associee a un projet. Le select projet dans le timer et le formulaire manuel liste les projets recuperes depuis le module Tasks/Projects via `GET /api/v1/projects?user_id=me&status=active`. Chaque projet affiche son nom et sa couleur (pastille coloree a gauche). Les projets recents apparaissent en premier. Un bouton `Aucun projet` permet de dissocier. L'association projet permet le regroupement et le reporting par projet.

### 1.7 Tags sur les entrees
Systeme de tags libres par entree. Input de type chips : taper un tag et `Enter` pour l'ajouter. Autocompletion sur les tags deja utilises. Tags predicts : `dev`, `meeting`, `admin`, `support`, `review`, `design`. Un tag est un texte court (max 30 caracteres, alphanumerique + tirets). Max 5 tags par entree. Les tags sont stockes comme array de strings dans la colonne JSONB `tags`. Utiles pour le filtrage et les rapports de productivite par categorie.

### 1.8 Detection d'inactivite (optionnel)
Si le timer tourne et qu'aucune activite clavier/souris n'est detectee pendant 10 minutes (configurable), un dialogue apparait : `Vous etes inactif depuis 10 minutes. Que souhaitez-vous faire ?` avec options :
- `Garder le temps` — le timer continue sans modification
- `Soustraire le temps d'inactivite` — le timer recule de la duree d'inactivite
- `Arreter le timer` — le timer est stoppe et l'entree enregistree

La detection est desactivable dans les parametres utilisateur (`Settings > Timesheet > Detection d'inactivite`).

---

## Categorie 2 — KPIs et tableau de bord

### 2.1 Total travaille cette semaine
Carte KPI en haut de page (premiere position). Icone horloge, label `Cette semaine`, valeur en format `XXh YYm` (police 24px, bold, `text-foreground`). Somme des durees de toutes les entrees de la semaine en cours (lundi 00:00 a dimanche 23:59, fuseau horaire local). Sous-texte comparatif : `+2h 15m vs semaine derniere` ou `-1h 30m vs semaine derniere` avec fleche haut (verte) ou bas (rouge).

### 2.2 Total facturable
Carte KPI (deuxieme position). Icone dollar, label `Facturable`, valeur en `XXh YYm`. Couleur d'accent verte. Somme des durees des entrees marquees facturables cette semaine. Sous-texte : pourcentage facturable `72% du total`.

### 2.3 Heures supplementaires
Carte KPI (troisieme position). Icone alerte, label `Overtime`. Valeur = total semaine - heures contractuelles (configurable, defaut 35h pour la France, 40h pour le reste). Si positif : affichage en rouge `+3h 15m` avec icone alerte. Si negatif (sous-utilise) : affichage en `text-muted-foreground` `-4h 45m`. Si nul : `0h` en vert. Les heures contractuelles sont configurables dans `Settings > Timesheet > Heures hebdomadaires`.

### 2.4 Nombre d'entrees
Carte KPI (quatrieme position). Icone liste, label `Entrees`, valeur numerique (ex: `23`). Sous-texte : `dont 15 par timer, 8 manuelles`. Indicateur de la granularite du suivi.

### 2.5 Graphique de la semaine
Bar chart horizontal sous les KPIs (hauteur 200px, pleine largeur). Axe Y : jours de la semaine (Lun, Mar, Mer, Jeu, Ven, Sam, Dim). Axe X : heures (0h a 12h+). Chaque barre est divisee en deux segments empiles :
- Facturable (couleur `primary`)
- Non-facturable (couleur `muted-foreground/40`)

Ligne de reference verticale pointillee a 7h ou 8h (journee standard, configurable) en rouge. Tooltip au hover sur une barre : `Lundi : 7h 30m (5h 15m facturable, 2h 15m non-facturable)`. Le jour courant est highlight avec un fond `bg-accent/10`. Les jours futurs sont vides.

### 2.6 Repartition par projet
Donut chart a droite du bar chart (taille 200x200px). Segments colores par projet (couleur du projet). Centre du donut : total heures de la semaine. Legende a droite avec : pastille de couleur, nom du projet, duree, pourcentage. Les projets sans entrees cette semaine ne sont pas affiches. Clic sur un segment filtre l'historique par ce projet.

### 2.7 Budget de temps par projet
Pour les projets qui ont un budget temps configure (heures estimees), une barre de progression s'affiche sous le nom du projet dans la legende du donut :
- Vert si <75% du budget consomme
- Orange si 75-100%
- Rouge si >100% (depassement)
Tooltip : `42h / 60h budget (70%)`. Le budget est configure dans le module Tasks/Projects et recupere via API.

### 2.8 Comparaison semaine/semaine
Section sous les graphiques : mini bar chart compact comparant les 4 dernieres semaines. Chaque barre = total heures de la semaine. Couleur plus foncee pour la semaine courante. Labels : `S-3`, `S-2`, `S-1`, `Cette semaine`. Fleche de tendance (haut/bas) entre les semaines. Permet de detecter les baisses ou hausses d'activite sans naviguer dans l'historique.

### 2.9 Objectif hebdomadaire
Un objectif d'heures hebdomadaires est configurable par l'utilisateur dans ses parametres (defaut : heures contractuelles). Une barre de progression circulaire s'affiche a droite des KPIs : `32h / 35h` avec pourcentage. Couleur verte si >= 90% de l'objectif, orange si 50-90%, rouge si <50%. L'objectif est distinct des heures contractuelles (l'utilisateur peut viser 40h meme avec un contrat de 35h). Quand l'objectif est atteint, confetti animation subtile (une seule fois par semaine, desactivable).

---

## Categorie 3 — Historique et gestion des entrees

### 3.1 Vue liste des entrees
Table sous les KPIs avec colonnes :
- **Date** — format `jj/mm` avec jour de la semaine (ex: `Lun 07/04`). Triable.
- **Tache** — nom de la tache (tronque a 40 caracteres). Clic ouvre l'edition.
- **Projet** — nom du projet avec pastille de couleur (ou `—` si aucun)
- **Duree** — format `Xh Ym` (ex: `2h 15m`). Triable.
- **Facturable** — badge vert `$` si facturable, gris `—` sinon
- **Source** — icone timer (chronometre) ou icone clavier (manuelle)
- **Tags** — chips compacts (max 2 visibles, `+N` si plus)
- **Actions** — boutons icones : editer (crayon), dupliquer (copie), supprimer (poubelle)

Pagination par page (20 entrees par page, boutons Precedent/Suivant). Tri par defaut : date decroissante. Lignes alternees avec fond `bg-muted/50` (zebra). Hover : fond `bg-accent/10`.

### 3.2 Groupement par jour
Dans la vue liste, les entrees sont groupees par date avec un en-tete de groupe : `Lundi 7 avril 2026 — 7h 30m` (nom du jour, date complete, sous-total de duree). Sections repliables via chevron a gauche de l'en-tete. Section du jour courant ouverte par defaut, les jours precedents ouverts egalement (les semaines precedentes sont repliees).

### 3.3 Filtres sur l'historique
Barre de filtres au-dessus de la table, combinables :
- **Periode** : datepicker range (du/au). Presets : `Aujourd'hui`, `Cette semaine`, `Semaine derniere`, `Ce mois`, `Mois dernier`, `Personnalise`
- **Projet** : multi-select avec pastilles de couleur
- **Tags** : multi-select
- **Facturable** : boutons `Tous`, `Facturable`, `Non-facturable`
- **Source** : boutons `Tous`, `Timer`, `Manuelle`

Les filtres actifs sont affiches comme chips sous la barre avec un bouton `X` pour chacun et un bouton `Reinitialiser tous les filtres`. Les filtres sont persistes dans l'URL (query params) pour le partage et le rechargement.

### 3.4 Edition d'une entree
Clic sur le bouton editer (crayon) ou clic sur la ligne ouvre un formulaire d'edition inline (la ligne s'expande pour reveler les champs editables) ou modal sur mobile. Memes champs que la saisie manuelle : nom, projet, date, duree (heures + minutes), facturable, description, tags. Sauvegarde via bouton `Enregistrer` ou `Enter`. Annulation via `Annuler` ou `Escape`. La modification est loggee dans l'audit trail (ancien/nouveau valeur).

### 3.5 Suppression d'une entree
Bouton supprimer (poubelle) sur chaque entree. Dialogue de confirmation : `Supprimer l'entree "Nom de tache" (2h 15m) ?`. Soft-delete avec possibilite de restauration dans les 30 jours (vue admin uniquement). Toast `Entree supprimee` avec bouton `Annuler` (5 secondes, undo la suppression). Les KPIs et graphiques se recalculent immediatement. Les entrees soumises ou approuvees ne peuvent pas etre supprimees — le bouton est desactive avec tooltip `Impossible de supprimer une entree soumise`.

### 3.6 Recherche dans l'historique
Barre de recherche au-dessus des filtres. Recherche full-text sur le nom de tache, le nom du projet, la description, et les tags. Debounce 200ms. Les termes trouves sont highlight dans les resultats. La recherche est combinable avec les filtres (intersection). Raccourci : `/` place le focus dans la barre de recherche.

### 3.6 Timesheet hebdomadaire (grid view)
Vue grille alternative (toggle en haut a droite : icone liste / icone grille). Layout :
- Lignes = projets/taches (groupees par projet, sous-lignes par tache)
- Colonnes = jours de la semaine (Lun-Dim) + colonne Total
- Cellules editables : clic sur une cellule ouvre un mini-input pour saisir directement les heures (format `HH:MM` ou nombre decimal, ex: `2.5` = 2h30)

Total par ligne (somme horizontale du projet/tache). Total par colonne (somme verticale du jour). Total general en bas a droite. Cellules vides affichent `—` en gris. Cellules avec duree affichent `2h 15m`. Background de cellule colore si la journee depasse 8h (orange clair) ou 10h (rouge clair). Ajout d'une nouvelle ligne via bouton `+ Ajouter un projet/tache` en bas de la grille.

Pattern Clockify/Harvest : la grille est le mode principal pour la saisie hebdomadaire retrospective. Le timer est le mode principal pour le tracking en temps reel.

### 3.8 Running entries indicator
Si le timer est actif, une ligne speciale en haut de la table d'historique montre l'entree en cours : fond `bg-primary/5`, bordure gauche `primary` (3px), le temps ecoule s'actualise en temps reel (`HH:MM:SS`), badge `En cours` anime (pulsation lente). Clic sur cette ligne arrete le timer et enregistre l'entree.

### 3.9 Duplication d'une entree
Bouton dupliquer (icone copie) sur chaque entree. Cree une nouvelle entree identique sauf la date (defaut : aujourd'hui) et l'heure de debut (vide). Utile pour les taches repetitives. L'entree dupliquee est ouverte en mode edition pour ajustements.

---

## Categorie 4 — Workflow d'approbation

### 4.1 Soumission pour approbation
L'employe soumet sa feuille de temps hebdomadaire pour validation. Bouton `Soumettre la semaine` en haut de la page (visible seulement si des entrees non soumises existent pour la semaine). Dialogue de confirmation : `Soumettre votre feuille de temps pour la semaine du X au Y ? (Z entrees, XXh YYm total)`. Statuts du cycle de vie :
- `draft` (brouillon) — editable par l'employe
- `submitted` (soumis) — en attente d'approbation, non editable par l'employe
- `approved` (approuve) — valide par le manager, verrouille
- `rejected` (rejete) — retourne a l'employe avec commentaire, redevient editable

Apres soumission, le manager recoit une notification push + email via PgEventBus event `timesheet.week.submitted { user_id, week_start, week_end, total_hours, entry_count }`.

### 4.2 Vue manager
Le manager accede a la vue equipe via un onglet `Equipe` en haut de la page (visible seulement pour les roles manager/admin). La vue affiche une table :
- Lignes = membres de l'equipe (avatar + nom)
- Colonnes = semaines (selecteur de semaine en haut)
- Cellules = total heures + statut (badge colore : gris=brouillon, bleu=soumis, vert=approuve, rouge=rejete)

Clic sur une cellule `soumis` ouvre le detail de la feuille de temps de l'employe (toutes les entrees de la semaine en lecture seule). Deux boutons en haut : `Approuver` (vert) et `Rejeter` (rouge). Le rejet requiert un commentaire obligatoire (textarea, min 10 caracteres). L'approbation accepte un commentaire optionnel.

### 4.3 Notification et retour
Apres approbation : notification push a l'employe `Votre feuille de temps semaine X a ete approuvee par [Manager]` avec lien vers la feuille. Badge vert `Approuve` dans la barre laterale du Timesheet. Apres rejet : notification push `Votre feuille de temps semaine X a ete rejetee par [Manager] : "commentaire"` avec lien direct. Badge rouge `Rejete` visible. L'employe peut modifier ses entrees (qui redeviennent editables) et resoumettre. Le commentaire de rejet est affiche en banner jaune en haut de la feuille de temps : `Rejet du JJ/MM par [Manager] : "Veuillez detailler le projet X"`. Le commentaire disparait apres resoumission.

### 4.4 Verrouillage apres approbation
Une feuille de temps approuvee ne peut plus etre modifiee par l'employe. Les boutons d'edition et de suppression sont desactives. Un badge `Approuve le JJ/MM par [Manager]` s'affiche en haut. Seul le manager ou l'admin peut deverrouiller (action `Reouvrir`) pour permettre des corrections. La reouverture remet le statut a `draft` et loggue l'action dans l'audit trail.

### 4.5 Rapports d'equipe (manager)
Tableau de bord manager sous l'onglet `Equipe` avec :
- **Table recapitulative** : par personne — avatar, nom, total heures semaine, taux facturable (%), overtime (+/-), nombre d'entrees, statut de soumission (badge). Triable par colonne.
- **Graphique empile** : barres par personne avec heures facturables (couleur `primary`) / non-facturables (couleur `muted`). Ligne de reference a la moyenne de l'equipe.
- **Alerte** : liste des employes n'ayant pas soumis leur feuille de la semaine passee (badge rouge, icone warning)
- **Comparaison** : evolution semaine/semaine du total equipe

Filtres : par periode (semaine, mois, trimestre), par personne, par projet.

### 4.6 Audit trail
Log de chaque action sur les entrees et feuilles de temps : creation, modification (champs changes), suppression, soumission, approbation, rejet, reouverture. Chaque entree du log contient : `entry_id`, `user_id`, `action`, `old_values`, `new_values`, `performed_by`, `created_at`. Visible par l'admin et le manager dans un onglet `Audit` de la page Timesheet.

---

## Categorie 5 — Tarification et facturation

### 5.1 Taux horaire par projet
Chaque projet peut avoir un taux horaire (billing rate) configure dans les parametres du projet (module Tasks/Projects). Le taux est stocke en centimes (integer) pour eviter les erreurs de floating point. Devise configurable (EUR par defaut). Quand un taux est configure, les entrees de ce projet affichent le montant calcule : `duree * taux_horaire` dans une colonne supplementaire `Montant` de l'historique.

### 5.2 Taux horaire par utilisateur
En complement du taux projet, un taux horaire par utilisateur peut etre configure dans les parametres RH (module Workforce). Priorite de taux : taux utilisateur-projet (le plus specifique) > taux projet > taux utilisateur > taux par defaut organisation.

### 5.3 Export vers Billing
Bouton `Exporter vers Billing` dans la barre d'actions en haut de page. Selectionne les entrees facturables de la periode filtree. Dialogue de confirmation : `Exporter X entrees facturables vers Billing ? Montant total : XXX EUR`. L'export envoie les donnees via PgEventBus event `timesheet.entries.exported { entries: [{entry_id, project_id, hours, rate, amount}], total_amount, period }`. Le module signapps-billing (port 8096) ecoute cet evenement et cree les lignes de facture correspondantes. Toast de confirmation : `X entrees exportees vers Billing pour un total de XXX EUR`.

### 5.4 Export CSV/Excel
Bouton `Exporter` dans la barre d'actions avec options CSV et XLSX. Inclut toutes les colonnes : date, tache, projet, duree (decimal), facturable, source, tags, description, montant (si taux configure). Les filtres actifs s'appliquent a l'export. Nom du fichier : `timesheet_{user}_{date_debut}_{date_fin}.csv`.

### 5.5 Export PDF rapport
Rapport PDF formate avec :
- En-tete : logo entreprise, nom de l'utilisateur, poste, departement, periode couverte, total heures, total facturable, total montant (si taux configure)
- Tableau detaille avec toutes les entrees : date, tache, projet, duree, facturable, description
- Resume par projet : sous-totaux heures et montants avec barre de proportion
- Resume par jour : sous-totaux avec mini bar chart
- Resume par tag : repartition du temps par categorie d'activite
- Graphique de la semaine (bar chart) integre dans le PDF
- Pied de page avec date de generation, numero de page, signature numerique

Utile pour les rapports clients, les demandes d'approbation hors-systeme, et l'archivage comptable. Le PDF est genere cote serveur via un template HTML2PDF. Le bouton est aussi accessible depuis la vue manager pour exporter les feuilles de l'equipe.

### 5.6 Integration comptable
Les entrees de temps avec taux horaire genere un flux financier exportable vers les outils comptables. Format d'export : CSV comptable avec colonnes normalisees (code analytique, compte, libelle, debit/credit, date). Le mapping code analytique ← projet est configurable dans `Settings > Timesheet > Plan analytique`. Chaque projet peut etre associe a un code analytique pour la ventilation comptable.

---

## Categorie 6 — Integration et automatisation

### 6.0 Facturation par tache (billable rates avancees)
En complement des taux par projet et par utilisateur, des taux specifiques par tache peuvent etre configures. Hierarchie de resolution du taux (du plus specifique au plus general) :
1. Taux par couple (utilisateur, projet, tache) — le plus precis
2. Taux par couple (utilisateur, projet)
3. Taux par projet
4. Taux par utilisateur
5. Taux par defaut de l'organisation

Quand une entree de temps est creee, le systeme resout le taux applicable et le stocke dans `billing_rate_cents` de l'entree. Si le taux change apres la creation de l'entree, les entrees existantes conservent l'ancien taux (pas de recalcul retroactif sauf action explicite de l'admin). Le montant calcule (`duree * taux`) est affiche dans la colonne `Montant` de l'historique et pris en compte dans l'export Billing.

### 6.1 Integration calendrier
Les entrees de timesheet peuvent creer des blocs dans le calendrier SignApps (signapps-calendar port 3011) via PgEventBus event `timesheet.entry.created { entry_id, user_id, project_id, start_time, duration, title }`. Le calendrier ecoute et cree un CalendarEvent de type `timesheet`. Inversement, un evenement calendrier peut pre-remplir une entree de temps : depuis le calendrier, bouton `Creer une entree de temps` extrait la duree et le titre de l'evenement. L'integration est bidirectionnelle et optionnelle (toggle dans les parametres).

### 6.2 Rappels de saisie
Notification quotidienne (configurable : heure, jours actifs) si l'utilisateur n'a pas saisi de temps pour la journee (aucune entree avec date = aujourd'hui). Via signapps-notifications (port 8095). Message : `N'oubliez pas de saisir votre temps aujourd'hui !`. Desactivable dans les parametres. PgEventBus event `timesheet.reminder.sent { user_id, date }`.

### 6.3 Integration Tasks/Projects
Quand l'utilisateur demarre un timer ou cree une entree manuelle, le champ projet est recupere depuis le module Tasks/Projects. La completion de taches dans le module Tasks peut optionnellement creer une entree de temps automatique (si le toggle est active dans les parametres). Le temps total passe sur une tache est visible dans la fiche de la tache (widget `Temps passe : Xh Ym`).

### 6.4 API REST complete

**Base path :** `/api/v1/timesheet`

| Methode | Endpoint | Description |
|---|---|---|
| `GET` | `/entries` | Liste paginee. Query params : `cursor`, `limit`, `date_from`, `date_to`, `project_id`, `billable`, `source`, `tags`, `status`, `sort_by`, `sort_order` |
| `GET` | `/entries/:id` | Detail d'une entree |
| `POST` | `/entries` | Creer une entree. Body : `{ task_name, project_id?, date, start_time?, duration_seconds, billable, source, description?, tags? }` |
| `PUT` | `/entries/:id` | Modifier une entree |
| `DELETE` | `/entries/:id` | Supprimer une entree (soft-delete) |
| `POST` | `/entries/:id/duplicate` | Dupliquer une entree |
| `GET` | `/stats/week` | KPIs de la semaine en cours. Query params : `week_start` |
| `GET` | `/stats/project-breakdown` | Repartition par projet pour une periode |
| `POST` | `/weeks/:week_start/submit` | Soumettre la semaine pour approbation |
| `POST` | `/weeks/:week_start/approve` | Approuver (manager). Body : `{ comment? }` |
| `POST` | `/weeks/:week_start/reject` | Rejeter (manager). Body : `{ comment }` |
| `POST` | `/weeks/:week_start/reopen` | Reouvrir (manager/admin) |
| `GET` | `/team/weeks` | Vue equipe (manager). Query params : `week_start`, `team_id` |
| `POST` | `/export/billing` | Export vers Billing. Body : `{ date_from, date_to }` |
| `GET` | `/export/csv` | Export CSV. Query params : memes filtres que `/entries` |
| `GET` | `/export/pdf` | Export PDF. Query params : memes filtres |

### 6.5 PostgreSQL schema

```sql
-- Entrees de temps
CREATE TABLE timesheet_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_name VARCHAR(255) NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    billable BOOLEAN NOT NULL DEFAULT TRUE,
    source VARCHAR(10) NOT NULL CHECK (source IN ('timer', 'manual', 'calendar')),
    description TEXT DEFAULT '',
    tags JSONB DEFAULT '[]'::jsonb,
    billing_rate_cents INTEGER,
    billing_currency VARCHAR(3) DEFAULT 'EUR',
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timesheet_entries_user_date ON timesheet_entries(user_id, date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_timesheet_entries_user_project ON timesheet_entries(user_id, project_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_timesheet_entries_project ON timesheet_entries(project_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_timesheet_entries_billable ON timesheet_entries(user_id, billable, date) WHERE is_deleted = FALSE;

-- Feuilles de temps hebdomadaires (pour le workflow d'approbation)
CREATE TABLE timesheet_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    total_seconds INTEGER NOT NULL DEFAULT 0,
    billable_seconds INTEGER NOT NULL DEFAULT 0,
    entry_count INTEGER NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    review_comment TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);

CREATE INDEX idx_timesheet_weeks_user ON timesheet_weeks(user_id, week_start DESC);
CREATE INDEX idx_timesheet_weeks_status ON timesheet_weeks(status, week_start);
CREATE INDEX idx_timesheet_weeks_reviewer ON timesheet_weeks(reviewed_by);

-- Configuration des taux horaires par utilisateur-projet
CREATE TABLE timesheet_billing_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    rate_cents INTEGER NOT NULL CHECK (rate_cents >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (user_id IS NOT NULL OR project_id IS NOT NULL)
);

CREATE INDEX idx_timesheet_billing_rates_user ON timesheet_billing_rates(user_id, effective_from);
CREATE INDEX idx_timesheet_billing_rates_project ON timesheet_billing_rates(project_id, effective_from);

-- Audit log
CREATE TABLE timesheet_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID REFERENCES timesheet_entries(id) ON DELETE SET NULL,
    week_id UUID REFERENCES timesheet_weeks(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    performed_by UUID NOT NULL REFERENCES users(id),
    action VARCHAR(30) NOT NULL,
    old_values JSONB DEFAULT '{}'::jsonb,
    new_values JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timesheet_audit_log_entry ON timesheet_audit_log(entry_id, created_at DESC);
CREATE INDEX idx_timesheet_audit_log_week ON timesheet_audit_log(week_id, created_at DESC);
```

### 6.6 PgEventBus events

| Event | Payload | Consumers |
|---|---|---|
| `timesheet.entry.created` | `{ entry_id, user_id, project_id, task_name, duration_seconds, date, billable }` | Calendar, Metrics, Projects |
| `timesheet.entry.updated` | `{ entry_id, user_id, fields_changed }` | Calendar, Metrics |
| `timesheet.entry.deleted` | `{ entry_id, user_id }` | Calendar, Metrics |
| `timesheet.week.submitted` | `{ user_id, week_start, week_end, total_hours, entry_count }` | Notifications (manager) |
| `timesheet.week.approved` | `{ user_id, week_start, reviewed_by, comment }` | Notifications (employee) |
| `timesheet.week.rejected` | `{ user_id, week_start, reviewed_by, comment }` | Notifications (employee) |
| `timesheet.week.reopened` | `{ user_id, week_start, reopened_by }` | Notifications (employee) |
| `timesheet.entries.exported` | `{ user_id, entries_count, total_amount, period }` | Billing |
| `timesheet.reminder.sent` | `{ user_id, date }` | Notifications |

---

## Categorie 7 — Raccourcis clavier, accessibilite et mobile

### 7.1 Raccourcis clavier
| Raccourci | Action |
|---|---|
| `Ctrl+Shift+T` | Toggle play/pause du timer (global, fonctionne sur toute page SignApps) |
| `Ctrl+Shift+S` | Arreter le timer et enregistrer (global) |
| `Ctrl+Shift+M` | Ouvrir le formulaire de saisie manuelle |
| `Ctrl+Shift+G` | Basculer entre vue liste et vue grille |
| `F` | Focus sur le champ nom de tache du timer |
| `Escape` | Fermer le formulaire de saisie manuelle |

Les raccourcis globaux (`Ctrl+Shift+T/S`) fonctionnent meme quand l'onglet Timesheet n'est pas actif — ils sont enregistres au niveau de l'app via un event listener global. Un panneau `?` affiche la liste des raccourcis.

### 7.2 Accessibilite WCAG AA
- Le timer est accessible au lecteur d'ecran : `aria-live="polite"` sur le compteur de temps (annonce toutes les minutes)
- Les boutons Play/Pause/Stop ont des `aria-label` descriptifs (`aria-label="Demarrer le chronometre"`)
- Les KPIs sont dans des `<article>` avec `aria-labelledby` lie au label
- La table d'historique est un `<table>` semantique avec `<th>` et `scope="col"`
- La vue grille hebdomadaire est navigable au clavier : Tab entre les cellules, Enter pour editer, Escape pour annuler
- Les toasts de confirmation sont `aria-live="assertive"` pour les erreurs, `aria-live="polite"` pour les succes

### 7.3 Mobile responsive
Sur mobile (<640px) :
- Le widget timer occupe toute la largeur en haut (sticky), avec le nom de tache sur une premiere ligne et les boutons Play/Stop sur une deuxieme ligne
- Les KPIs s'empilent en 2x2 au lieu de 4 en ligne
- Le graphique de la semaine passe en mode vertical (barres horizontales)
- La table d'historique se transforme en liste de cartes (une carte par entree avec nom, duree, badge projet)
- Le formulaire de saisie manuelle s'ouvre en dialogue plein ecran
- La vue grille hebdomadaire se transforme en vue jour-par-jour (carousel horizontal, swipe pour changer de jour)
- Le datepicker utilise le picker natif du navigateur mobile (`type="date"`)

### 7.4 Widget timer persistant
Si l'utilisateur navigue vers une autre page de SignApps pendant que le timer tourne :
- Un mini-widget timer s'affiche dans le header global de l'application (barre de navigation) avec : nom de la tache (tronque), temps ecoule, bouton stop
- Le timer continue de tourner en arriere-plan (basculement d'onglet ne l'arrete pas)
- Le titre de l'onglet du navigateur affiche le temps (`[01:23:45] Timesheet — SignApps`)
- Si l'utilisateur ferme l'onglet avec un timer actif, le timestamp de debut est persiste dans localStorage. A la reouverture, le timer reprend avec le temps ecoule calcule depuis le timestamp de debut (pas de perte de temps).

### 7.5 Performance et limites
- Nombre max d'entrees par utilisateur : 100 000 (historique illimite en pratique)
- Duree max d'une entree : 24 heures (au-dela, avertissement et confirmation)
- Le timer persiste dans localStorage avec le timestamp de debut — pas de perte en cas de crash navigateur
- La vue grille hebdomadaire est virtualisee pour les utilisateurs avec 20+ projets (seules les lignes visibles sont rendues)
- L'autocompletion du nom de tache utilise un index trigram PostgreSQL pour la recherche floue
- Le graphique de la semaine et le donut projet sont rendus via Recharts (MIT) avec transitions de 300ms
- Les KPIs se rafraichissent toutes les 30 secondes via React Query avec stale time de 10 secondes
- L'export CSV de 10 000 entrees prend < 3 secondes (generation cote serveur, streaming)

### 7.6 Multi-fuseau horaire
Les entrees de temps sont stockees en UTC en base de donnees. L'affichage est converti au fuseau horaire local de l'utilisateur (detecte automatiquement via `Intl.DateTimeFormat().resolvedOptions().timeZone`). Pour les equipes distribuees, un manager peut voir les feuilles de temps de son equipe en horaire local de chaque employe ou en un fuseau de reference (configurable). Le fuseau est affiche en petit a cote de la date : `Lun 07/04 (Europe/Paris)`. Les changements d'heure ete/hiver sont geres automatiquement.

### 7.7 Integration Pomodoro (optionnel)
Mode Pomodoro activable dans les parametres (`Settings > Timesheet > Pomodoro`). Quand active, le timer alterne automatiquement entre periodes de travail (25 min defaut) et pauses (5 min defaut, 15 min apres 4 cycles). Un indicateur visuel montre le cycle en cours (1/4, 2/4, etc.). A la fin d'un cycle de travail, une notification `Pause ! Reprise dans 5 min` s'affiche. A la fin de la pause, `Reprise du travail !`. Les durees sont configurables (travail : 15-60 min, pause courte : 3-15 min, pause longue : 10-30 min). Le Pomodoro est un overlay sur le timer normal — les entrees de temps sont enregistrees normalement.

### 7.8 Historique du timer (timeline)
Un sous-onglet `Timeline` dans la vue liste affiche les entrees sous forme de timeline visuelle par jour. Chaque entree est un bloc colore (couleur du projet) positionne sur un axe horizontal 24h. Les pauses du timer sont representees par des espaces blancs. Hover sur un bloc : tooltip avec nom de tache, projet, duree, heure debut/fin. La timeline permet de visualiser d'un coup d'oeil la repartition du temps dans la journee et d'identifier les periodes non trackees.

### 7.9 Notifications
- **Rappel de saisie** : notification quotidienne (push + optionnel email) si aucune entree pour la journee. Configurable : heure d'envoi (defaut 17h), jours actifs (defaut lun-ven). Desactivable.
- **Timer oublie** : si le timer tourne depuis plus de 12h, notification push `Votre timer tourne depuis 12h — est-ce volontaire ?` avec actions `Continuer` / `Arreter`.
- **Approbation** : notification push au manager quand un employe soumet sa semaine. Notification push a l'employe quand le manager approuve/rejete.
- **Deadline de soumission** : notification push le vendredi soir si la feuille de la semaine n'a pas ete soumise.

---

## Sources d'inspiration

### Aides utilisateur publiques et demos
- **Toggl Track Knowledge Base** (support.toggl.com) — guides timer, rapports, integrations.
- **Clockify Help** (clockify.me/help) — timesheet, approbation, kiosk, rapports.
- **Harvest Support** (support.getharvest.com) — time tracking, budgets, invoicing.
- **Kimai Documentation** (www.kimai.org/documentation) — open source, API, configuration, plugins.
- **TimeCamp Blog** (www.timecamp.com/blog) — productivite, time tracking best practices.

### Projets open source permissifs a etudier comme pattern
**Licences autorisees : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL, BSL, Elastic License — ne pas copier**

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **Kimai** (github.com/kimai/kimai) | **MIT** | Reference principale. Architecture PHP/Symfony pour le time tracking. Pattern pour les timesheets, approbation, export, API REST. |
| **Traggo** (github.com/traggo/server) | **GPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Tags-based time tracking. |
| **ActivityWatch** (github.com/ActivityWatch/activitywatch) | **MPL-2.0** | Tracking automatique. Pattern pour la detection d'activite et les rapports. Consommation OK (MPL-2.0). |
| **Wakapi** (github.com/muety/wakapi) | **MIT** | Time tracking pour developpeurs. Pattern pour les rapports visuels, l'API REST, les statistiques. |
| **Super Productivity** (github.com/johannesjo/super-productivity) | **MIT** | Time tracking + taches. Pattern pour le timer, la saisie, l'integration projet, les rapports. |
| **Cattr** (github.com/cattr-app/server-application) | **AGPL-3.0** | **INTERDIT** — reference pedagogique uniquement. Approbation, screenshots. |
| **recharts** (github.com/recharts/recharts) | **MIT** | Graphiques React. Deja utilise dans SignApps pour les bar/pie charts. |

---

## Securite et gouvernance

### 8.1 Permissions
- Un employe ne peut voir et modifier que ses propres entrees de temps
- Un manager peut voir les entrees de son equipe (departement) et approuver/rejeter les feuilles
- Un admin peut voir toutes les entrees, modifier les taux, configurer les politiques, acceder aux logs d'audit
- Les entrees soumises ne sont modifiables que par le manager (reouverture) ou l'admin
- Les entrees approuvees sont immutables sauf deverrouillage explicite par le manager/admin

### 8.2 Donnees sensibles
- Les taux horaires sont visibles uniquement par l'employe concerne, son manager, et l'admin
- Les montants calcules sont masques dans la vue equipe du manager (il ne voit que les heures)
- L'export Billing ne contient les montants que si l'utilisateur a la permission `billing:export`
- Les rapports PDF excluent les taux et montants sauf si explicitement inclus (option dans le dialogue d'export)

### 8.3 Retention et archivage
- Les entrees de temps sont conservees indefiniment (pas de purge automatique)
- Les entrees soft-deleted sont purgees apres 90 jours
- Les logs d'audit sont conserves 2 ans
- Les exports CSV/PDF sont generes a la demande (pas de cache persistant)

---

## Assertions E2E cles (a tester)

- Saisir un nom de tache, cliquer Play → le chronometre demarre et affiche le temps ecoule (`HH:MM:SS`)
- Cliquer Pause → le chronometre se fige, le bouton redevient Play
- Cliquer Play apres Pause → le chronometre reprend au meme point (pauses exclues)
- Cliquer Stop → l'entree est creee dans l'historique avec la bonne duree, toast de confirmation
- Demarrer sans nom de tache → toast d'erreur, timer ne demarre pas
- Saisie manuelle : remplir le formulaire, valider → entree ajoutee a l'historique
- Saisie manuelle avec duree 0 → erreur de validation, formulaire non soumis
- KPI `Total semaine` → la somme est correcte apres ajout d'une entree
- KPI `Facturable` → n'inclut que les entrees marquees facturables
- KPI `Overtime` → calcul correct par rapport aux heures contractuelles
- Toggle facturable sur une entree → le badge change et les KPIs se mettent a jour
- Supprimer une entree → elle disparait de la liste, les KPIs se recalculent
- Filtrer par projet → seules les entrees du projet apparaissent
- Filtrer par periode → seules les entrees de la periode apparaissent
- Vue timesheet grid → saisie directe dans les cellules, totaux par ligne et par colonne recalcules
- Groupement par jour → les entrees sont separees par date avec sous-totaux corrects
- Export vers Billing → toast confirme le nombre d'entrees et le montant total
- Export CSV → fichier telecharge avec toutes les colonnes et filtres appliques
- Soumettre la semaine → statut passe a `submitted`, entrees non editables
- Manager approuve → statut `approved`, employe notifie, entrees verrouillees
- Manager rejette → statut `rejected`, commentaire visible, employe peut modifier
- Dupliquer une entree → nouvelle entree identique avec date du jour
- Autocompletion du nom de tache → les taches recentes apparaissent
- Timer en arriere-plan → titre de l'onglet affiche le temps ecoule
- Raccourci `Ctrl+Shift+T` → toggle play/pause du timer
- Detection d'inactivite → dialogue apres 10 minutes sans activite
