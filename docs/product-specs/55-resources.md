# Module Gestion des Ressources (Resources) — Specification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives a capturer |
|---|---|
| **Robin** | Reservation de salles et bureaux, carte interactive du batiment (floor plan), capteurs d'occupation en temps reel, integration calendrier (Google/Outlook/Exchange), analytics d'utilisation, hot desking, visitor management, signalisation digitale sur ecran a l'entree des salles, API REST, SCIM provisioning |
| **Skedda** | Reservation self-service multi-ressource (salles, courts, studios, equipements), calendrier interactif drag-and-drop, regles de reservation (duree min/max, avance max, quotas), tarification optionnelle, portail public de reservation, QR code check-in, API REST, embeddable widget |
| **Condeco** | Workspace management enterprise, reservation de salles + bureaux + parking, planification hybride (jours au bureau), capteurs IoT, analytics avancees (taux d'occupation, no-show), integration Exchange/Google/Teams, wayfinding interactif, visitor pre-registration |
| **Microsoft Bookings** | Integration native Microsoft 365, page de reservation publique, formulaire personnalisable, rappels email/SMS, synchronisation Outlook, multi-staff scheduling, services configurables avec duree/prix, buffer time entre rendez-vous, Teams meeting auto-creation |
| **Google Calendar Resources** | Gestion de ressources (salles, equipements) dans Google Workspace Admin, reservation depuis Google Calendar, attributs de salle (capacite, equipements AV, accessibility), suggestions de salles basees sur la taille du meeting, auto-decline si conflit, resource directory consultable |
| **Envoy Rooms** | Reservation de salles centree sur l'experience visiteur, check-in depuis l'app mobile ou le panneau a l'entree, auto-liberation si no-show (5 min), analytics d'utilisation detaillees, integration Slack pour rechercher une salle libre, amenities listing (whiteboard, video, phone) |
| **OfficeSpace** | Plateforme de gestion de l'espace de travail, floor plans interactifs avec desk booking, move management, asset tracking (mobilier, equipements), space analytics (m2/personne, taux occupation), integration IWMS, scenario planning pour reorganisation |
| **Resource Guru** | Planification de ressources (personnes, salles, equipements), calendrier multi-ressource avec drag-and-drop, clash management (detection de conflits), approbations, reporting (utilisation, disponibilite), API REST, filtres avances (competences, localisation, type), leave management integre |

## Principes directeurs

1. **Reservation en 3 clics** — l'utilisateur doit pouvoir reserver une ressource disponible en un minimum d'etapes : selectionner le type, choisir le creneau, confirmer. Pas de workflow d'approbation sauf si explicitement configure par l'administrateur pour certaines categories de ressources.
2. **Disponibilite temps reel** — le calendrier de disponibilite est mis a jour en temps reel (WebSocket ou polling court). Si un utilisateur consulte une salle affichee comme libre, elle doit effectivement etre libre au moment de la reservation. Gestion optimiste avec conflit detecte au commit.
3. **Multi-type extensible** — le systeme gere trois types de base (salles de reunion, equipements, vehicules) mais l'administrateur peut creer des types personnalises (bureaux, places de parking, outils, materiels de pret). Chaque type a ses attributs specifiques et ses regles de reservation.
4. **Integration calendrier** — les reservations apparaissent automatiquement dans le calendrier SignApps (signapps-calendar, port 3011) de l'utilisateur. Synchronisation bidirectionnelle : une reservation creee depuis le calendrier reserve la ressource, et inversement.
5. **Regles metier configurables** — chaque type de ressource peut avoir ses propres regles : duree min/max de reservation, delai de reservation a l'avance (max 30j), quotas par utilisateur (max 2 salles/jour), creneaux autorises (heures ouvrables uniquement), approbation requise ou non.
6. **Analytics d'utilisation** — le systeme collecte les donnees d'utilisation (taux d'occupation, no-shows, duree moyenne, pics d'utilisation) pour permettre aux administrateurs d'optimiser l'allocation des ressources et de justifier les investissements.

---

## Categorie 1 — Catalogue et navigation des ressources

### 1.1 Page principale
Route `/resources`. En-tete : "Reserver une ressource" avec sous-titre "Parcourez et reservez les salles, equipements et vehicules disponibles". En dessous, un filtre dropdown et la liste des ressources disponibles. Si aucune ressource n'est configuree, affichage d'un etat vide : "Aucune ressource configuree — Contactez votre administrateur pour ajouter des salles, equipements ou vehicules."

### 1.2 Filtre par type
Dropdown de filtre "Tous les types" avec les options :
- **Tous les types** (defaut) — affiche toutes les ressources
- **Salles de reunion** — filtrer les salles
- **Equipements** — filtrer le materiel pretable
- **Vehicules** — filtrer les vehicules de service
- **Types personnalises** — chaque type cree par l'admin apparait comme option supplementaire

Le filtre est persistant dans l'URL (query param `?type=room`) pour le partage de liens.

### 1.3 Recherche
Barre de recherche textuelle pour trouver une ressource par nom, description ou localisation. Recherche instantanee (debounced 300ms) avec highlight des termes trouves. Compatible avec la recherche globale SignApps (signapps-search).

### 1.4 Filtres avances
Panneau de filtres avances (expandable) :
- **Localisation** : batiment, etage, zone (si renseigne)
- **Capacite minimale** : nombre de personnes (pour les salles)
- **Equipements requis** : checkboxes (projecteur, whiteboard, visioconference, telephone, climatisation)
- **Disponibilite** : "Disponible maintenant", "Disponible le [date] de [heure] a [heure]"
- **Tags** : tags personnalises definis par l'admin

### 1.5 Modes d'affichage
Deux modes d'affichage :
- **Liste** (defaut) : cartes empilees verticalement avec photo, nom, type, capacite, localisation, disponibilite
- **Grille** : cartes en grille 3 colonnes (desktop), plus compact, photo en miniature
- **Carte** (si localisation GPS/plan) : ressources affichees sur un plan d'etage interactif

Toggle de mode memorise par utilisateur.

### 1.6 Carte de ressource
Chaque ressource est presentee dans une carte contenant :
- **Photo** : image de la ressource (salle, equipement, vehicule) ou placeholder generique par type
- **Nom** (ex: "Salle Everest", "Projecteur Epson EB-X51", "Renault Kangoo #3")
- **Type** avec icone (salle, equipement, vehicule)
- **Capacite** (pour les salles : "8 personnes")
- **Localisation** (batiment, etage, numero)
- **Equipements** : icones des amenities (projecteur, whiteboard, visio, etc.)
- **Disponibilite** : badge "Disponible" (vert) ou "Occupe jusqu'a 15h30" (rouge) ou "Reserve" (orange)
- **Bouton "Reserver"** (actif si disponible)

### 1.7 Detail d'une ressource
Clic sur une carte ouvre la vue detaillee :
- Photo(s) en carrousel (si plusieurs)
- Description complete
- Attributs specifiques au type (capacite, equipements, immatriculation, numero de serie)
- Calendrier de disponibilite (semaine en cours par defaut)
- Historique des reservations recentes (pour l'admin)
- Bouton "Reserver" avec selection de creneau

---

## Categorie 2 — Reservation

### 2.1 Formulaire de reservation
Depuis la vue detaillee ou le bouton "Reserver" d'une carte :
- **Ressource** : pre-selectionnee (affichee en lecture seule)
- **Date** : date picker (defaut : aujourd'hui)
- **Heure de debut** : selecteur par paliers de 15 min (defaut : prochain creneau libre)
- **Heure de fin** : selecteur par paliers de 15 min (defaut : debut + 1h)
- **Objet** (optionnel) : texte libre decrivant la raison de la reservation
- **Participants** (optionnel, pour les salles) : multi-select d'utilisateurs SignApps
- **Recurrence** (optionnel) : quotidien, hebdomadaire, mensuel, personnalise (comme le calendrier)
- **Notes** (optionnel) : informations complementaires

Bouton "Confirmer la reservation". Si conflit detecte au moment de la soumission, message d'erreur avec suggestion du prochain creneau disponible.

### 2.2 Calendrier de disponibilite
Vue calendrier integree au formulaire montrant les creneaux occupes (rouge) et libres (vert) pour la ressource selectionnee. Navigation par jour/semaine. Clic sur un creneau libre pre-remplit les heures de debut et fin. Les reservations existantes affichent le nom du reservant (si autorise par la politique de confidentialite).

### 2.3 Detection de conflits
Lors de la soumission, le backend verifie qu'aucune reservation ne chevauche le creneau demande pour la meme ressource. En cas de conflit :
- Message d'erreur : "Cette ressource est deja reservee de 14h00 a 15h30 par [utilisateur]."
- Suggestion automatique : "Prochains creneaux disponibles : 15h30-16h30, 17h00-18h00"
- Option de mettre en liste d'attente si la fonctionnalite est activee

### 2.4 Reservation recurrente
L'utilisateur peut creer une reservation recurrente (ex: salle de reunion chaque lundi de 10h a 11h). Le systeme verifie les conflits sur toutes les occurrences. Si certaines occurrences sont en conflit, l'utilisateur peut :
- Exclure les occurrences en conflit et reserver les autres
- Annuler toute la serie
- Modifier les occurrences individuellement apres creation

### 2.5 Reservation multi-ressources
Pour les evenements necessitant plusieurs ressources (salle + projecteur + vehicule), l'utilisateur peut ajouter plusieurs ressources a une meme reservation. Le systeme verifie la disponibilite de toutes les ressources sur le meme creneau. Affichage d'un recapitulatif avant confirmation.

### 2.6 Confirmation et notification
Apres confirmation :
- La reservation apparait dans le calendrier SignApps de l'utilisateur
- Les participants invites recoivent une notification (in-app + email)
- La ressource passe en "reservee" sur le creneau concerne
- Un email de confirmation est envoye au reservant avec les details et un lien pour modifier/annuler

### 2.7 Check-in / No-show
Fonctionnalite optionnelle (configurable par type de ressource) :
- **Check-in** : l'utilisateur doit confirmer sa presence dans les N premieres minutes de la reservation (defaut 15 min). Confirmation via l'app, un QR code a l'entree de la salle, ou un bouton dans la notification.
- **No-show** : si pas de check-in dans le delai, la reservation est automatiquement annulee et la ressource est liberee. Notification au reservant. Le no-show est comptabilise dans les analytics.

---

## Categorie 3 — Gestion des reservations

### 3.1 Mes reservations
Page `/resources/my-bookings` listant les reservations de l'utilisateur connecte :
- Onglets : A venir, Passees, Annulees
- Pour chaque reservation : ressource, date, heures, statut (confirmee, en attente d'approbation, annulee)
- Actions : Modifier, Annuler, Dupliquer (creer une nouvelle reservation similaire)

### 3.2 Modification d'une reservation
L'utilisateur peut modifier les heures, la date, l'objet et les participants d'une reservation existante. Si la modification entraine un conflit, meme traitement que pour une nouvelle reservation (message d'erreur + suggestions). La modification est possible jusqu'a N minutes avant le debut (configurable, defaut 30 min).

### 3.3 Annulation
L'utilisateur peut annuler sa reservation a tout moment avant la fin du creneau. Confirmation requise : "Etes-vous sur de vouloir annuler cette reservation ?". La ressource est immediatement liberee. Les participants recoivent une notification d'annulation. L'annulation est enregistree dans l'historique.

### 3.4 Delegation
L'utilisateur peut deleguer sa reservation a un autre utilisateur (transfert de responsabilite). Le nouveau responsable recoit une notification de delegation. Utile quand un organisateur ne peut plus assister a la reunion.

### 3.5 Approbation (workflow optionnel)
Pour certains types de ressources (vehicules, equipements couteux), l'administrateur peut activer un workflow d'approbation :
- La reservation passe en statut "En attente d'approbation"
- Le(s) approbateur(s) designe(s) recoivent une notification
- L'approbateur peut approuver ou refuser avec un commentaire
- Si approuvee, la reservation est confirmee et la ressource bloquee
- Si refusee, l'utilisateur est notifie avec le motif

### 3.6 Liste d'attente
Si la fonctionnalite est activee pour un type de ressource, un utilisateur peut s'inscrire sur la liste d'attente pour un creneau occupe. Si la reservation existante est annulee, le premier de la liste recoit une notification et a N minutes pour confirmer sa reservation (defaut 30 min). Sinon, passage au suivant.

---

## Categorie 4 — Administration des ressources

### 4.1 CRUD des ressources
L'administrateur peut creer, modifier et supprimer des ressources depuis `/admin/resources` :
- **Creer** : formulaire avec nom, type, description, capacite, localisation, equipements, photo(s), tags, statut (actif/inactif)
- **Modifier** : meme formulaire pre-rempli
- **Supprimer** : confirmation + gestion des reservations futures (annuler ou migrer)
- **Desactiver** : rendre une ressource invisible sans la supprimer (maintenance, renovation)

### 4.2 Types de ressources personnalises
L'administrateur peut creer des types de ressources au-dela des trois types par defaut :
- **Nom du type** (ex: "Place de parking", "Bureau individuel", "Salle de formation")
- **Icone** : selection parmi une bibliotheque d'icones
- **Attributs specifiques** : champs personnalises (texte, nombre, booleen, selection) associes au type
- **Regles par defaut** : duree min/max, quotas, approbation, check-in

### 4.3 Regles de reservation
Configuration des regles par type de ressource ou par ressource individuelle :
- **Duree minimale** (defaut 15 min) et **maximale** (defaut 8h)
- **Reservation a l'avance maximale** (defaut 30 jours)
- **Quota par utilisateur** : nombre max de reservations actives (defaut illimite)
- **Creneaux autorises** : heures d'ouverture (ex: 8h-20h lun-ven)
- **Buffer entre reservations** : temps de menage/preparation entre deux reservations (defaut 0)
- **Check-in obligatoire** : oui/non, delai en minutes
- **Approbation requise** : oui/non, liste des approbateurs

### 4.4 Import en masse
Import de ressources depuis un fichier CSV :
- Colonnes attendues : nom, type, capacite, localisation, description, equipements (separes par `;`)
- Validation avant import : detection des doublons, verification des types
- Rapport d'import : nombre de ressources creees, erreurs, doublons ignores

### 4.5 Plan d'etage interactif
L'administrateur peut uploader un plan d'etage (image PNG/SVG) et y placer les ressources par drag-and-drop. Les utilisateurs peuvent ensuite naviguer sur le plan pour visualiser et reserver les ressources geographiquement. Chaque ressource sur le plan affiche une pastille de disponibilite (vert/rouge).

---

## Categorie 5 — Integration calendrier

### 5.1 Synchronisation avec signapps-calendar
Chaque reservation est automatiquement creee comme un evenement dans le calendrier SignApps de l'utilisateur (via PgEventBus). L'evenement contient : titre = "Reservation: {nom_ressource}", lieu = localisation, participants, description = objet. Type d'evenement : `booking`.

### 5.2 Reservation depuis le calendrier
L'utilisateur peut reserver une ressource directement depuis la vue calendrier en creant un evenement de type "Reservation". Un champ "Ressource" apparait avec un selecteur montrant les ressources disponibles sur le creneau choisi. La reservation est creee en meme temps que l'evenement.

### 5.3 Calendrier par ressource
Vue calendrier dediee a une ressource specifique (`/resources/{id}/calendar`). Affiche tous les creneaux occupes et libres en vue jour/semaine. Navigation par semaine. Clic sur un creneau libre ouvre le formulaire de reservation pre-rempli.

### 5.4 Rappels
Le systeme envoie des rappels automatiques avant une reservation :
- 24h avant (email, configurable)
- 15 min avant (notification in-app, configurable)
- Au moment du debut si check-in active ("Confirmez votre presence dans les 15 prochaines minutes")

### 5.5 ICS export
Chaque reservation est exportable au format ICS pour import dans un calendrier externe (Outlook, Google Calendar, Apple Calendar). Lien ICS dans l'email de confirmation. Flux ICS par ressource pour les ecrans d'affichage.

---

## Categorie 6 — Analytics et reporting

### 6.1 Dashboard d'utilisation
Page `/admin/resources/analytics` avec les KPIs :
- **Taux d'occupation global** : pourcentage du temps ou les ressources sont reservees vs disponibles
- **Nombre de reservations** : total sur la periode (jour, semaine, mois)
- **Taux de no-show** : pourcentage de reservations sans check-in (si active)
- **Duree moyenne** : duree moyenne des reservations
- **Ressource la plus demandee** : nom de la ressource avec le plus de reservations

### 6.2 Taux d'occupation par ressource
Graphique en barres horizontales montrant le taux d'occupation de chaque ressource sur la periode selectionnee. Tri decroissant. Identification des ressources sous-utilisees (< 20%) et sur-sollicitees (> 80%). Aide a la decision pour ajouter ou retirer des ressources.

### 6.3 Heatmap d'utilisation
Matrice jour de la semaine (Y) x heure (X) coloree par densite de reservations. Permet d'identifier les creneaux de pointe (ex: mardi 10h = peak) et les periodes creuses (ex: vendredi apres-midi). Filtrable par type de ressource.

### 6.4 Rapport de no-shows
Liste des utilisateurs avec le plus de no-shows sur la periode. Nombre de no-shows, taux (no-shows / reservations), derniere occurrence. Utile pour identifier les comportements problematiques et ajuster les quotas.

### 6.5 Export des rapports
Export des donnees d'analytics :
- **CSV** : donnees brutes (reservations, no-shows, occupation par jour)
- **PDF** : rapport formate avec graphiques et KPIs
- Generation automatique mensuelle envoyee aux administrateurs (configurable)

### 6.6 Tendances
Graphique en courbes montrant l'evolution des KPIs dans le temps : taux d'occupation, nombre de reservations, no-shows. Comparaison mois-sur-mois. Projection lineaire si la tendance se maintient.

---

## Categorie 7 — Notifications et communication

### 7.1 Notifications de reservation
L'utilisateur recoit des notifications pour :
- Confirmation de reservation
- Modification de reservation (par lui ou un admin)
- Annulation de reservation (par lui, un admin, ou auto no-show)
- Approbation ou refus (si workflow d'approbation actif)
- Rappels (24h avant, 15 min avant, check-in)
- Delegation recue

Canaux : in-app (toujours), email (configurable), push mobile (si PWA installe).

### 7.2 Notifications admin
L'administrateur recoit des notifications pour :
- Demandes d'approbation en attente
- No-shows detectes
- Conflits non resolus
- Ressource desactivee necessitant migration des reservations

### 7.3 Ecran d'affichage (signalisation)
Page `/resources/{id}/display` optimisee pour un ecran d'affichage a l'entree d'une salle :
- Nom de la salle en grand
- Statut actuel : "Disponible" (fond vert) ou "Occupe — {objet} jusqu'a {heure_fin}" (fond rouge)
- Prochaine reservation : "{objet} a {heure}" ou "Aucune reservation aujourd'hui"
- Bouton "Reserver maintenant" pour reservation rapide (30 min, 1h)
- Rotation automatique du contenu. Police grande, lisible a distance.

---

## Categorie 8 — Architecture backend

### 8.1 Modele de donnees
Tables principales :
- `resources` : id (UUID), name, type_id (FK), description, capacity, location_building, location_floor, location_room, photo_url, status (active/inactive/maintenance), created_at, updated_at
- `resource_types` : id (UUID), name, icon, slug, created_at
- `resource_type_attributes` : id, type_id (FK), name, data_type (text/number/boolean/select), options (JSONB), required
- `resource_attributes` : id, resource_id (FK), attribute_id (FK), value (JSONB)
- `resource_amenities` : id, resource_id (FK), amenity (enum: projector, whiteboard, videoconference, phone, ac, etc.)
- `resource_bookings` : id (UUID), resource_id (FK), user_id (FK), title, start_at (TIMESTAMPTZ), end_at (TIMESTAMPTZ), status (confirmed/pending/cancelled/no_show), recurrence_rule (TEXT NULL), parent_booking_id (UUID NULL), notes, created_at, updated_at
- `resource_booking_participants` : booking_id (FK), user_id (FK)
- `resource_booking_approvals` : id, booking_id (FK), approver_id (FK), decision (approved/rejected), comment, decided_at
- `resource_rules` : id, resource_id (FK NULL), type_id (FK NULL), min_duration_min, max_duration_min, max_advance_days, daily_quota, allowed_hours_start, allowed_hours_end, allowed_days (JSONB), buffer_minutes, checkin_required, approval_required

### 8.2 Service de reservation
Le module de reservation est implemente dans `signapps-calendar` (port 3011) car les reservations sont fondamentalement des evenements calendrier de type `booking`. Les endpoints REST :
- `GET /api/v1/resources` — lister les ressources (filtres query params)
- `GET /api/v1/resources/{id}` — detail d'une ressource
- `POST /api/v1/resources/{id}/bookings` — creer une reservation
- `PUT /api/v1/resources/{id}/bookings/{booking_id}` — modifier
- `DELETE /api/v1/resources/{id}/bookings/{booking_id}` — annuler
- `GET /api/v1/resources/{id}/availability?date=2026-04-09` — creneaux disponibles
- `POST /api/v1/resources/{id}/bookings/{booking_id}/checkin` — check-in

### 8.3 Gestion des conflits
La detection de conflit utilise une contrainte d'exclusion PostgreSQL sur la table `resource_bookings` :
```sql
ALTER TABLE resource_bookings ADD CONSTRAINT no_overlap
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_at, end_at) WITH &&
  ) WHERE (status != 'cancelled');
```
Cela garantit qu'aucune reservation active ne chevauche une autre pour la meme ressource, meme sous charge concurrente. Le handler Rust capture l'erreur de contrainte et retourne un `AppError::Conflict` avec les details.

### 8.4 Integration PgEventBus
Evenements emis sur le bus :
- `resource.booking.created` — reservation creee (declenche creation evenement calendrier + notifications)
- `resource.booking.updated` — reservation modifiee
- `resource.booking.cancelled` — reservation annulee
- `resource.booking.checkin` — check-in confirme
- `resource.booking.noshow` — no-show detecte (apres timeout du check-in)

### 8.5 Job CRON no-show
Un job planifie via signapps-scheduler (port 3007) s'execute toutes les 5 minutes pour detecter les reservations sans check-in :
- Selectionner les reservations avec `checkin_required = true`, `status = confirmed`, `start_at < now() - interval 'N minutes'`, pas de check-in enregistre
- Passer le statut a `no_show`
- Emettre l'evenement `resource.booking.noshow`
- Liberer le creneau

---

## References OSS

| Projet | Licence | Ce qu'on peut etudier/adapter |
|---|---|---|
| **QloApps** (github.com/webkul/hotelcommerce) | **OSL-3.0** | Pattern de reservation hoteliere avec disponibilite, tarification, calendrier. Architecture backend de reference (meme si PHP). |
| **Alf.io** (github.com/alfio-event/alf.io) | **GPL-3.0** | **INTERDIT** (GPL). Etudier les docs publiques pour les patterns de reservation d'evenements et gestion de quotas. |
| **Easy!Appointments** (github.com/alextselegidis/easyappointments) | **GPL-3.0** | **INTERDIT** (GPL). Etudier les docs publiques pour les patterns de booking self-service et notification. |
| **Cal.com** (github.com/calcom/cal.com) | **AGPL-3.0** | **INTERDIT** (AGPL). Etudier les docs publiques pour les patterns de scheduling et disponibilite. |
| **Rallly** (github.com/lukevella/rallly) | **AGPL-3.0** | **INTERDIT** (AGPL). Etudier les docs publiques pour le scheduling par sondage. |
| **react-big-calendar** (github.com/jquense/react-big-calendar) | **MIT** | Composant React de calendrier. Pattern pour la vue calendrier des reservations. Drag-and-drop, vues jour/semaine/mois. |
| **date-fns** (github.com/date-fns/date-fns) | **MIT** | Manipulation de dates et creneaux horaires. Calcul de disponibilite, recurrence. |
| **rrule** (github.com/jakubroztocil/rrule) | **BSD-3-Clause** | Parsing et generation de regles de recurrence iCalendar (RRULE). Pour les reservations recurrentes. |
| **react-grid-layout** (github.com/react-grid-layout/react-grid-layout) | **MIT** | Grille drag-and-drop. Pattern pour le placement de ressources sur un plan d'etage. |
| **Konva** (github.com/konvajs/konva) | **MIT** | Canvas 2D pour JavaScript. Pattern pour le plan d'etage interactif avec positionnement de ressources. |
| **zod** (github.com/colinhacks/zod) | **MIT** | Validation de schemas TypeScript. Deja utilise. Pour valider les formulaires de reservation cote client. |

---

## Assertions E2E cles (a tester)

- La page `/resources` affiche le titre "Reserver une ressource" et le sous-titre descriptif
- Le dropdown "Tous les types" liste les types de ressources configurees
- Le filtre par type restreint la liste aux ressources du type selectionne
- La recherche par nom trouve la ressource correspondante et highlight le terme
- L'etat vide s'affiche quand aucune ressource n'est configuree
- La carte d'une ressource affiche le nom, type, capacite, localisation et disponibilite
- Le badge "Disponible" est vert quand la ressource n'a pas de reservation en cours
- Le badge "Occupe" est rouge quand la ressource est reservee sur le creneau actuel
- Le clic sur une carte ouvre la vue detaillee avec le calendrier de disponibilite
- Le formulaire de reservation pre-remplit la ressource selectionnee et le prochain creneau libre
- La soumission d'une reservation valide cree la reservation et affiche une confirmation
- Un conflit de reservation affiche un message d'erreur et suggere le prochain creneau disponible
- La reservation apparait dans le calendrier SignApps de l'utilisateur
- Les participants invites recoivent une notification in-app et par email
- La modification d'une reservation met a jour les heures et notifie les participants
- L'annulation d'une reservation libere le creneau et notifie les participants
- Le workflow d'approbation affiche le statut "En attente" jusqu'a la decision
- L'approbation confirme la reservation et notifie le demandeur
- Le refus annule la reservation et notifie le demandeur avec le motif
- Le check-in dans le delai confirme la presence et maintient la reservation
- L'absence de check-in apres le delai annule la reservation (no-show)
- La reservation recurrente cree les occurrences sans conflit
- La vue plan d'etage affiche les ressources avec leur pastille de disponibilite
- Le dashboard analytics affiche le taux d'occupation, le nombre de reservations et les no-shows
- Le heatmap d'utilisation montre les creneaux de pointe correctement colores
- L'ecran d'affichage `/resources/{id}/display` affiche le statut actuel en grand format
- L'admin peut creer, modifier et desactiver une ressource depuis `/admin/resources`
- L'import CSV cree les ressources sans doublon
- Les regles de reservation (duree max, quotas, creneaux autorises) sont respectees
- Le RBAC restreint la gestion des ressources aux administrateurs
