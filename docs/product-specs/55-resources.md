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
2. **Disponibilite temps reel** — le calendrier de disponibilite est mis a jour en temps reel (WebSocket ou polling court). Si un utilisateur consulte une salle affichee comme libre, elle doit effectivement etre libre au moment de la reservation. Gestion optimiste avec conflit detecte au commit via exclusion constraint PostgreSQL.
3. **Multi-type extensible** — le systeme gere trois types de base (salles de reunion, equipements, vehicules) mais l'administrateur peut creer des types personnalises (bureaux, places de parking, outils, materiels de pret). Chaque type a ses attributs specifiques et ses regles de reservation.
4. **Integration calendrier** — les reservations apparaissent automatiquement dans le calendrier SignApps (signapps-calendar, port 3011) de l'utilisateur. Synchronisation bidirectionnelle : une reservation creee depuis le calendrier reserve la ressource, et inversement.
5. **Regles metier configurables** — chaque type de ressource peut avoir ses propres regles : duree min/max de reservation, delai de reservation a l'avance (max 30j), quotas par utilisateur (max 2 salles/jour), creneaux autorises (heures ouvrables uniquement), approbation requise ou non.
6. **Analytics d'utilisation** — le systeme collecte les donnees d'utilisation (taux d'occupation, no-shows, duree moyenne, pics d'utilisation) pour permettre aux administrateurs d'optimiser l'allocation des ressources et de justifier les investissements.

---

## Categorie 1 — Catalogue et navigation des ressources

### 1.1 Page principale
Route `/resources`. En-tete : "Reserver une ressource" en `text-2xl font-bold` avec sous-titre "Parcourez et reservez les salles, equipements et vehicules disponibles" en `text-muted-foreground`. En dessous, une barre de filtres horizontale et la liste des ressources disponibles. Si aucune ressource n'est configuree, affichage d'un etat vide centre : icone building, titre "Aucune ressource configuree", sous-titre "Contactez votre administrateur pour ajouter des salles, equipements ou vehicules", bouton "Configurer les ressources" (visible uniquement pour les admins, lien vers `/admin/resources`).

### 1.2 Filtre par type
Dropdown de filtre "Tous les types" avec les options :
- **Tous les types** (defaut) — affiche toutes les ressources
- **Salles de reunion** (icone door) — filtrer les salles
- **Equipements** (icone wrench) — filtrer le materiel pretable
- **Vehicules** (icone car) — filtrer les vehicules de service
- **Types personnalises** — chaque type cree par l'admin apparait comme option supplementaire avec son icone

Le filtre est persistant dans l'URL (query param `?type=room`) pour le partage de liens. Le changement de filtre est instantane (filtrage cote client si les donnees sont deja chargees, sinon appel API avec `?type=room`).

### 1.3 Recherche
Barre de recherche textuelle pour trouver une ressource par nom, description ou localisation. Recherche instantanee (debounced 300ms) avec highlight des termes trouves en jaune (`<mark>`). Compatible avec la recherche globale SignApps via `Ctrl+K`. Le champ utilise le composant shadcn/ui `Input` avec une icone Search a gauche et un bouton clear (X) a droite quand le champ n'est pas vide.

### 1.4 Filtres avances
Panneau de filtres avances (expandable via bouton "Filtres" avec icone chevron) :
- **Localisation** : dropdowns cascades — batiment, etage, zone (si renseigne dans les ressources)
- **Capacite minimale** : input numerique (pour les salles) — ex: "Au moins 8 personnes"
- **Equipements requis** : checkboxes — projecteur, whiteboard, visioconference, telephone, climatisation, ecran TV, microphone. Filtrage inclusif (la ressource doit avoir TOUS les equipements coches).
- **Disponibilite** : radio buttons — "Tous", "Disponible maintenant", "Disponible le [date picker] de [heure debut] a [heure fin]"
- **Etat** : dropdown — Tous, Actif, Inactif, En maintenance (admin uniquement)
- **Tags** : multi-select de tags personnalises definis par l'admin

Bouton "Reinitialiser les filtres" pour revenir aux valeurs par defaut. Les filtres actifs sont affiches sous la barre de filtres sous forme de chips supprimables (ex: "Capacite >= 8 x", "Projecteur x"). L'URL est mise a jour avec les query params pour le partage.

### 1.5 Modes d'affichage
Trois modes d'affichage, selectionnables via un groupe de boutons icones :
- **Liste** (defaut, icone list) : cartes empilees verticalement avec photo a gauche (120x80px), nom, type, capacite, localisation, equipements (icones), badge de disponibilite. Chaque carte utilise `flex gap-4 items-center p-4 border rounded-lg`.
- **Grille** (icone grid) : cartes en grille 3 colonnes (desktop `lg:grid-cols-3`), 2 colonnes (tablette `md:grid-cols-2`), 1 colonne (mobile). Photo en haut (aspect-ratio 16/9), details en dessous.
- **Plan d'etage** (icone map, si des plans sont configures) : fond SVG/PNG du plan d'etage avec des marqueurs cliquables positionnes aux emplacements des ressources. Chaque marqueur a un cercle colore : vert (disponible), rouge (occupe), gris (en maintenance). Clic sur un marqueur affiche un popover avec les details de la ressource et un bouton "Reserver".

Le mode selectionne est memorise dans `localStorage` et persiste entre les sessions.

### 1.6 Carte de ressource
Chaque ressource est presentee dans une carte contenant :
- **Photo** : image de la ressource (salle, equipement, vehicule) ou placeholder generique par type (icone door/wrench/car sur fond `bg-muted`). Image chargee via `next/image` avec lazy loading.
- **Nom** (ex: "Salle Everest", "Projecteur Epson EB-X51", "Renault Kangoo #3") en `font-semibold`
- **Type** avec icone en `text-xs text-muted-foreground uppercase`
- **Capacite** (pour les salles : "8 personnes" avec icone users)
- **Localisation** (batiment, etage, numero — ex: "Batiment A, 2e etage, Salle 204")
- **Equipements** : icones des amenities en `text-muted-foreground` avec tooltip sur chaque icone (projecteur, whiteboard, visio, etc.)
- **Disponibilite** : badge — "Disponible" (`bg-green-100 text-green-800`) ou "Occupe jusqu'a 15h30" (`bg-red-100 text-red-800`) ou "Reserve" (`bg-amber-100 text-amber-800`)
- **Bouton "Reserver"** : bouton primaire shadcn/ui, desactive avec tooltip "Cette ressource est actuellement occupee" si non disponible

Pour les **salles de reunion**, la carte affiche en plus :
- Capacite (ex: "8 personnes max")
- Etage et numero de salle
- Equipements AV (projecteur, ecran, visio, whiteboard)

Pour les **equipements**, la carte affiche en plus :
- Numero de serie (ex: "S/N: EPX-2024-0042")
- Modele (ex: "Epson EB-X51")
- Etat de condition : Neuf, Bon, Correct, A remplacer — badge colore

Pour les **vehicules**, la carte affiche en plus :
- Immatriculation (ex: "AB-123-CD")
- Kilometrage (ex: "45 230 km")
- Type de carburant (Essence, Diesel, Electrique, Hybride) — icone
- Derniere revision (ex: "15/03/2026")

### 1.7 Detail d'une ressource
Clic sur une carte ouvre la vue detaillee (route `/resources/{id}`) :
- Photo(s) en carrousel (si plusieurs, navigation par fleches gauche/droite, indicateurs de pagination en points). Photo unique en pleine largeur si une seule.
- **Description complete** : texte libre rich text (ex: "Salle de reunion au 2e etage avec vue sur le parc. Ideal pour les presentations et workshops.")
- **Attributs specifiques au type** :
  - Salles : capacite, etage, numero, superficie (m2), equipements detailles
  - Equipements : numero de serie, modele, marque, condition, date d'achat, date de derniere maintenance
  - Vehicules : immatriculation, marque/modele, annee, kilometrage, type de carburant, date de derniere revision, assurance (date d'expiration)
- **Calendrier de disponibilite** : vue semaine (defaut) avec creneaux occupes en rouge et creneaux libres en vert. Navigation semaine precedente/suivante. Clic sur un creneau libre ouvre le formulaire de reservation pre-rempli.
- **Prochaines reservations** : liste des 5 prochaines reservations avec date, heure, utilisateur (si autorise par la politique de confidentialite)
- **Historique des reservations recentes** (admin uniquement) : 20 dernieres reservations avec utilisateur, date, duree, statut
- **Bouton "Reserver"** : meme que sur la carte, ouvre le formulaire de reservation

Raccourcis clavier : `r` ouvre le formulaire de reservation, `Escape` revient a la liste.

---

## Categorie 2 — Reservation

### 2.1 Formulaire de reservation
Depuis la vue detaillee ou le bouton "Reserver" d'une carte, un dialog (shadcn/ui `Dialog`, largeur 560px) s'ouvre avec le formulaire :
- **Ressource** : pre-selectionnee, affichee en lecture seule (nom + type + localisation)
- **Date** : date picker (composant shadcn/ui `Calendar`, defaut : aujourd'hui). Les jours passes sont desactives. Les jours au-dela de la limite de reservation a l'avance sont desactives (defaut 30j).
- **Heure de debut** : selecteur dropdown par paliers de 15 min (defaut : prochain creneau libre arrondi au quart d'heure suivant). Les creneaux en dehors des heures autorisees sont desactives.
- **Heure de fin** : selecteur dropdown par paliers de 15 min (defaut : debut + 1h). La duree minimale et maximale est respectee (defaut min 15min, max 8h). Si la fin depasse un creneau deja reserve, un message d'avertissement s'affiche en temps reel sous le champ.
- **Objet** (optionnel) : champ texte libre (max 200 caracteres) decrivant la raison de la reservation (ex: "Reunion client Acme", "Formation securite")
- **Participants** (optionnel, pour les salles) : multi-select d'utilisateurs SignApps avec autocompletion sur le nom ou l'email. Les participants recoivent une notification d'invitation.
- **Recurrence** (optionnel, section expandable) : radio buttons — Aucune (defaut), Quotidienne, Hebdomadaire, Mensuelle, Personnalisee. Si recurrence selectionnee :
  - Quotidienne : tous les N jours (defaut 1), date de fin de recurrence
  - Hebdomadaire : jours de la semaine (checkboxes lun-dim), tous les N semaines, date de fin
  - Mensuelle : le Neme jour du mois ou le Neme [jour] du mois, date de fin
  - Personnalisee : expression RRULE (mode expert)
  - **Dates d'exception** : multi-select de dates a exclure de la recurrence (ex: jours feries). Les dates exclues sont barrees dans le resume de recurrence.
- **Notes** (optionnel) : textarea pour informations complementaires (max 1000 caracteres)

Bouton "Confirmer la reservation" (primaire) et "Annuler" (secondaire). Si conflit detecte au moment de la soumission, le dialog reste ouvert avec un message d'erreur rouge sous les champs de date/heure, et une suggestion du prochain creneau disponible sous forme de bouton cliquable ("Prochain creneau : 15h30-16h30 — Selectionner").

### 2.2 Calendrier de disponibilite
Vue calendrier integree au formulaire (panneau droit du dialog sur desktop, section scrollable sur mobile) montrant les creneaux occupes (rouge `bg-red-100`) et libres (vert `bg-green-50`) pour la ressource selectionnee. Navigation par jour ou semaine via des boutons fleches. Les creneaux libres sont cliquables et pre-remplissent les heures de debut et fin. Les reservations existantes affichent le nom du reservant et l'objet (si autorise par la politique de confidentialite ; sinon affiche "Reserve"). La vue couvre les heures autorisees (defaut 8h-20h) avec des bandes grisees pour les heures non-autorisees.

### 2.3 Detection de conflits
Lors de la soumission, le backend verifie qu'aucune reservation active ne chevauche le creneau demande pour la meme ressource. La verification utilise la contrainte d'exclusion PostgreSQL (voir section 8.3) qui garantit l'atomicite meme sous charge concurrente.

En cas de conflit :
- Message d'erreur : "Cette ressource est deja reservee de 14h00 a 15h30 par {utilisateur}." (ou "par un autre utilisateur" si confidentialite)
- Suggestion automatique : "Prochains creneaux disponibles : 15h30-16h30, 17h00-18h00" — calcules via une requete SQL qui trouve les gaps dans les reservations du jour.
- Option de mettre en liste d'attente si la fonctionnalite est activee pour ce type de ressource (bouton "S'inscrire en liste d'attente" sous le message d'erreur)

Le handler Rust capture l'erreur `23P01` (exclusion violation) de PostgreSQL et retourne un `AppError::Conflict` avec un body contenant le creneau en conflit et les suggestions.

### 2.4 Reservation recurrente
L'utilisateur peut creer une reservation recurrente (ex: salle de reunion chaque lundi de 10h a 11h). Le systeme :
1. Genere toutes les occurrences futures jusqu'a la date de fin de recurrence (max 52 semaines)
2. Exclut les dates d'exception configurees
3. Verifie les conflits sur chaque occurrence en une seule requete SQL (batch check)
4. Affiche un resume : "12 occurrences creees, 2 conflits detectes"
5. Si certaines occurrences sont en conflit, l'utilisateur peut :
   - Exclure les occurrences en conflit et reserver les autres (bouton "Reserver les creneaux disponibles")
   - Annuler toute la serie (bouton "Annuler")
   - Voir le detail des conflits (expandable : date, heure, reservant concurrent)
6. Chaque occurrence est un enregistrement distinct dans `resource_bookings` avec un `parent_booking_id` pointant vers la premiere occurrence. La modification ou annulation peut s'appliquer a une seule occurrence ou a toute la serie (radio buttons : "Cette occurrence uniquement" / "Cette occurrence et les suivantes" / "Toute la serie").

### 2.5 Reservation multi-ressources
Pour les evenements necessitant plusieurs ressources (salle + projecteur + vehicule), l'utilisateur peut ajouter plusieurs ressources a une meme reservation via un bouton "+ Ajouter une ressource" dans le formulaire. Chaque ressource ajoutee est affichee dans une liste sous le formulaire avec son propre indicateur de disponibilite. Le systeme verifie la disponibilite de toutes les ressources sur le meme creneau. Si une ressource est en conflit, seule celle-ci est signalee (les autres restent reservables). Le recapitulatif avant confirmation liste toutes les ressources avec leur statut.

### 2.6 Confirmation et notification
Apres confirmation de la reservation :
- Toast de succes : "Reservation confirmee — {ressource} le {date} de {debut} a {fin}" avec un lien "Voir dans le calendrier"
- La reservation apparait dans le calendrier SignApps de l'utilisateur (evenement de type `booking` cree via PgEventBus)
- Les participants invites recoivent une notification in-app + email avec les details (ressource, date, heure, objet, lien pour accepter/decliner)
- La ressource passe en "reservee" sur le creneau concerne dans la vue disponibilite
- Un email de confirmation est envoye au reservant avec : details de la reservation, lien pour modifier, lien pour annuler, fichier ICS en piece jointe

### 2.7 Workflow d'approbation (optionnel)
Pour certains types de ressources (vehicules, equipements couteux, salles VIP), l'administrateur peut activer un workflow d'approbation dans les regles du type de ressource :
- A la soumission, la reservation passe en statut "En attente d'approbation" (badge jaune)
- Le(s) approbateur(s) designe(s) recoivent une notification in-app + email avec un lien d'approbation directe (un clic pour approuver ou refuser)
- L'approbateur voit une page avec les details de la demande : utilisateur, ressource, creneau, objet, historique des reservations de l'utilisateur
- Boutons "Approuver" (vert) et "Refuser" (rouge) avec champ commentaire obligatoire en cas de refus
- Si approuvee, la reservation est confirmee, la ressource bloquee, et l'utilisateur notifie
- Si refusee, l'utilisateur est notifie avec le motif et la ressource reste libre
- Timeout d'approbation : si l'approbateur ne repond pas dans les 24h (configurable), une notification de rappel est envoyee. Apres 48h, la demande est automatiquement refusee avec le motif "Delai d'approbation depasse".

### 2.8 Check-in / No-show
Fonctionnalite optionnelle (configurable par type de ressource dans les regles) :
- **Check-in** : l'utilisateur doit confirmer sa presence dans les N premieres minutes de la reservation (defaut 15 min). Trois methodes de check-in :
  1. **Application** : bouton "Confirmer ma presence" dans la notification push et sur la page de la reservation
  2. **QR code** : scanner le QR code affiche a l'entree de la salle/ressource. Le QR code contient une URL `https://{domain}/resources/{id}/checkin?booking={booking_id}&token={otp}`. Le scan ouvre une page de confirmation en un tap.
  3. **Ecran tactile** : sur l'ecran d'affichage a l'entree de la salle (mode kiosk), bouton "Check-in" a cote de la reservation en cours
- **No-show** : si pas de check-in dans le delai, la reservation est automatiquement annulee et la ressource est liberee. Le reservant recoit une notification : "Votre reservation de {ressource} a ete annulee pour absence de check-in." Le no-show est comptabilise dans les analytics et dans le profil de l'utilisateur (visible par l'admin).
- **Seuil d'alerte no-show** : si un utilisateur accumule plus de 3 no-shows sur 30 jours, l'admin recoit une notification. Optionnel : blocage temporaire de reservation pour l'utilisateur (configurable).

---

## Categorie 3 — Gestion des reservations

### 3.1 Mes reservations
Page `/resources/my-bookings` listant les reservations de l'utilisateur connecte :
- Onglets : A venir (defaut), Passees, Annulees — avec compteur sur chaque onglet
- Pour chaque reservation : photo miniature de la ressource, nom de la ressource, date, heures, statut (badge : confirmee vert, en attente jaune, annulee gris, no-show rouge)
- Actions par reservation : Modifier (icone edit), Annuler (icone trash), Dupliquer (icone copy — cree une nouvelle reservation similaire sur un autre creneau)
- Tri par date (defaut, croissant pour A venir, decroissant pour Passees)
- Lien "Ajouter au calendrier" pour chaque reservation (telecharge un fichier ICS)

### 3.2 Modification d'une reservation
L'utilisateur peut modifier les heures, la date, l'objet et les participants d'une reservation existante. Clic sur le bouton Modifier ouvre le meme dialog que la creation, pre-rempli. Si la modification entraine un conflit, meme traitement que pour une nouvelle reservation (message d'erreur + suggestions). La modification est possible jusqu'a N minutes avant le debut (configurable par type, defaut 30 min). Au-dela, le bouton Modifier est desactive avec un tooltip : "Modification impossible moins de 30 minutes avant le debut." Si la reservation a un workflow d'approbation et que la modification change le creneau, une nouvelle approbation est requise (statut repasse en "En attente").

### 3.3 Annulation
L'utilisateur peut annuler sa reservation a tout moment avant la fin du creneau. Clic sur le bouton Annuler ouvre un dialog de confirmation : "Etes-vous sur de vouloir annuler cette reservation de {ressource} le {date} de {debut} a {fin} ?" avec boutons "Confirmer l'annulation" (destructif, rouge) et "Conserver" (secondaire). La ressource est immediatement liberee. Les participants recoivent une notification d'annulation in-app + email. L'annulation est enregistree dans l'historique avec le timestamp et le motif (optionnel). Pour les reservations recurrentes, le dialog demande : "Annuler cette occurrence uniquement" / "Cette occurrence et les suivantes" / "Toute la serie".

### 3.4 Delegation
L'utilisateur peut deleguer sa reservation a un autre utilisateur via un bouton "Deleguer" (icone arrow-right-left) dans les actions de la reservation. Un dialog s'ouvre avec un champ de recherche d'utilisateur (autocompletion). Le nouveau responsable recoit une notification de delegation : "{Prenom} vous a delegue sa reservation de {ressource} le {date}." Le nouveau responsable peut accepter ou decliner la delegation. Si acceptee, il devient le proprietaire de la reservation. Si declinee, la reservation reste au delegateur.

### 3.5 Liste d'attente
Si la fonctionnalite est activee pour un type de ressource, un utilisateur peut s'inscrire sur la liste d'attente pour un creneau occupe via le bouton "S'inscrire en liste d'attente" sur la page de detail d'une ressource occupee. L'utilisateur voit sa position dans la file (ex: "Position 2 sur 3"). Si la reservation existante est annulee ou si un no-show est detecte, le premier de la liste recoit une notification : "Le creneau {heure} de {ressource} est maintenant disponible. Confirmez votre reservation dans les 30 prochaines minutes." Un lien de confirmation directe est inclus. Si le delai expire sans confirmation, passage au suivant dans la liste.

---

## Categorie 4 — Administration des ressources

### 4.1 CRUD des ressources
L'administrateur peut creer, modifier et supprimer des ressources depuis `/admin/resources` :
- **Creer** : bouton "Nouvelle ressource" ouvre un formulaire a etapes (step wizard) :
  1. Type de ressource (selection parmi les types existants)
  2. Informations generales (nom, description, localisation, photo)
  3. Attributs specifiques au type (capacite, equipements, numero de serie, immatriculation)
  4. Regles de reservation (duree, quotas, approbation, check-in)
  5. Recapitulatif et confirmation
- **Modifier** : meme formulaire pre-rempli, accessible via le bouton edit sur chaque ressource dans le tableau admin
- **Supprimer** : dialog de confirmation avec gestion des reservations futures. Si des reservations existent : "Cette ressource a 5 reservations futures. Que souhaitez-vous faire ?" Options : "Annuler toutes les reservations" (notifie les utilisateurs) ou "Migrer vers une autre ressource" (dropdown de selection de la ressource de remplacement).
- **Desactiver** : toggle pour rendre une ressource invisible et non-reservable sans la supprimer (maintenance, renovation). Les reservations futures sont conservees mais un bandeau d'avertissement est affiche.

### 4.2 Types de ressources personnalises
L'administrateur peut creer des types de ressources au-dela des trois types par defaut depuis `/admin/resources/types` :
- **Nom du type** (ex: "Place de parking", "Bureau individuel", "Salle de formation")
- **Icone** : selection parmi une bibliotheque d'icones Lucide (search + grid d'icones)
- **Slug** : identifiant URL-safe genere automatiquement depuis le nom (editable)
- **Attributs specifiques** : constructeur de champs personnalises. Pour chaque attribut :
  - Nom du champ (ex: "Superficie", "Nombre d'ecrans")
  - Type de donnees : texte, nombre, booleen, selection (liste de valeurs predefinies), date
  - Requis : oui/non
  - Affiche sur la carte : oui/non (certains attributs sont uniquement dans le detail)
- **Regles par defaut** : regles de reservation appliquees par defaut a toutes les ressources de ce type (modifiables par ressource individuelle)

### 4.3 Regles de reservation
Configuration des regles par type de ressource ou par ressource individuelle (surcharge type -> ressource) :
- **Duree minimale** (defaut 15 min, paliers de 15 min)
- **Duree maximale** (defaut 8h, paliers de 30 min)
- **Reservation a l'avance maximale** (defaut 30 jours, max 365 jours)
- **Quota par utilisateur** : nombre max de reservations actives simultanees (defaut illimite). Ex: "Max 2 salles reservees en meme temps".
- **Quota quotidien** : nombre max de reservations par jour par utilisateur (defaut illimite)
- **Creneaux autorises** : heures d'ouverture (defaut 8h00-20h00, paliers de 30 min) et jours (checkboxes lun-dim, defaut lun-ven)
- **Buffer entre reservations** : temps de menage/preparation entre deux reservations (defaut 0, paliers de 5 min). Le buffer est automatiquement insere apres chaque reservation et bloque le creneau.
- **Check-in obligatoire** : toggle oui/non, delai en minutes (defaut 15)
- **Auto-liberation apres no-show** : toggle oui/non (defaut oui si check-in obligatoire)
- **Approbation requise** : toggle oui/non. Si oui : multi-select des approbateurs (utilisateurs avec role admin ou custom)
- **Liste d'attente** : toggle oui/non (defaut non)

### 4.4 Import en masse
Import de ressources depuis un fichier CSV via `/admin/resources/import` :
- Upload du fichier (drag-and-drop ou clic, max 5MB)
- Colonnes attendues : nom, type (slug du type), capacite, batiment, etage, salle, description, equipements (separes par `;`), tags (separes par `;`)
- **Etape de validation** : avant import, le systeme affiche un apercu des 5 premieres lignes avec detection des erreurs :
  - Doublons (nom deja existant) : badge jaune "Doublon — sera ignore"
  - Type inconnu : badge rouge "Type '{slug}' inexistant"
  - Champ requis manquant : badge rouge "Nom manquant"
- Rapport d'import : nombre de ressources creees, erreurs, doublons ignores, temps d'execution. Telechargeable en CSV (rapport d'erreurs).

### 4.5 Plan d'etage interactif
L'administrateur peut uploader un plan d'etage (image PNG/SVG, max 10MB) depuis `/admin/resources/floor-plans` :
1. Upload de l'image de fond (glisser-deposer)
2. Saisie des metadonnees : nom du plan (ex: "Batiment A - 2e etage"), batiment, etage
3. Placement des ressources par drag-and-drop : l'admin selectionne une ressource dans une liste laterale et la glisse sur le plan. Un marqueur est place a la position. Le marqueur est repositionnable. Coordonnees (x%, y%) stockees en base.
4. Enregistrement du plan avec les positions

Les utilisateurs voient le plan interactif dans le mode d'affichage "Plan d'etage" (section 1.5). Chaque marqueur a un cercle de 16px avec couleur de disponibilite (vert/rouge/gris). Au survol, un popover affiche le nom, le statut et un bouton "Reserver". Le plan supporte le zoom (scroll) et le panning (drag du fond) pour les grands batiments. Rendu via un composant React avec `<svg>` pour les marqueurs au-dessus de l'image de fond.

### 4.6 Ecran d'affichage kiosk (signalisation)
Page `/resources/{id}/display` optimisee pour un ecran d'affichage a l'entree d'une salle :
- **Layout plein ecran** : pas de header, pas de sidebar, police extra-large (nom de la salle en 48px)
- **Fond colore selon l'etat** : vert (`bg-green-500`) si disponible, rouge (`bg-red-500`) si occupe
- **Statut actuel** :
  - Disponible : "Disponible" en blanc sur fond vert, avec boutons rapides "Reserver 30 min" et "Reserver 1h"
  - Occupe : "{Objet}" en blanc sur fond rouge, "Jusqu'a {heure_fin}", nom du reservant, barre de progression du temps restant
- **Prochaine reservation** : "{Objet} a {heure}" ou "Aucune reservation aujourd'hui"
- **Timeline du jour** : barre horizontale 8h-20h avec les creneaux reserves en rouge et les creneaux libres en vert
- **Horloge** : heure actuelle en grand format (HH:mm) dans le coin superieur droit
- **QR code** : en bas a gauche, QR code pour check-in et reservation rapide depuis mobile
- **Rafraichissement** : auto-refresh toutes les 30 secondes. La page ne se verrouille jamais (meta tag `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` + wake lock API).
- Rotation automatique entre les infos si la salle est libre depuis plus de 5 minutes (affichage de statistiques d'utilisation ou message personnalise par l'admin).

---

## Categorie 5 — Integration calendrier

### 5.1 Synchronisation avec signapps-calendar
Chaque reservation est automatiquement creee comme un evenement dans le calendrier SignApps de l'utilisateur via PgEventBus. L'evenement contient :
- Titre : "Reservation: {nom_ressource}"
- Lieu : localisation de la ressource (batiment, etage, salle)
- Participants : utilisateurs invites dans la reservation
- Description : objet de la reservation + lien vers la page de la reservation
- Type d'evenement : `booking`
- Couleur : cyan (`#06b6d4`) pour distinguer des evenements normaux

L'evenement PgEventBus `resource.booking.created` est emis avec le payload complet de la reservation. Le service `signapps-calendar` (port 3011) consomme cet evenement et cree l'entree calendrier. Les mises a jour et annulations sont propagees via `resource.booking.updated` et `resource.booking.cancelled`.

### 5.2 Reservation depuis le calendrier
L'utilisateur peut reserver une ressource directement depuis la vue calendrier en creant un evenement de type "Reservation". Dans le formulaire de creation d'evenement du calendrier, un champ "Ressource" apparait (dropdown avec recherche) montrant les ressources disponibles sur le creneau choisi. Les ressources indisponibles sont grisees avec le motif ("Reserve par {user}"). La reservation est creee en meme temps que l'evenement. Le champ "Lieu" est automatiquement rempli avec la localisation de la ressource selectionnee.

### 5.3 Calendrier par ressource
Vue calendrier dediee a une ressource specifique (`/resources/{id}/calendar`). Affiche tous les creneaux occupes et libres en vue jour ou semaine. Navigation par semaine (boutons fleches et date picker). Les creneaux occupes sont en rouge avec le nom du reservant et l'objet. Les creneaux libres sont en vert pale. Clic sur un creneau libre ouvre le formulaire de reservation pre-rempli avec la ressource, la date et les heures du creneau clique. Vue par defaut : semaine en cours. Rendu avec le composant react-big-calendar (MIT).

### 5.4 Rappels
Le systeme envoie des rappels automatiques avant une reservation via `signapps-notifications` :
- **24h avant** : email avec les details (ressource, date, heure, lieu, objet). Configurable : toggle on/off dans les preferences utilisateur.
- **15 min avant** : notification push in-app ("Votre reservation de {ressource} commence dans 15 minutes"). Non desactivable.
- **Au moment du debut** si check-in active : notification push "Confirmez votre presence dans les 15 prochaines minutes" avec bouton de check-in dans la notification.
- **5 min avant la fin** : notification push "Votre reservation de {ressource} se termine dans 5 minutes" (utile pour liberer la salle a temps).

### 5.5 ICS export
Chaque reservation est exportable au format ICS (.ics) pour import dans un calendrier externe (Outlook, Google Calendar, Apple Calendar) :
- Lien "Ajouter au calendrier" dans l'email de confirmation et sur la page de la reservation
- Le fichier ICS contient : VEVENT avec DTSTART, DTEND, SUMMARY, LOCATION, DESCRIPTION, ORGANIZER, ATTENDEE(s), UID unique
- Flux ICS par ressource : `GET /resources/{id}/calendar.ics` retourne un calendrier ICS complet avec toutes les reservations futures de la ressource. Utile pour abonnement dans un calendrier externe (lien de souscription). Le flux est protege par un token unique par utilisateur.

---

## Categorie 6 — Analytics et reporting

### 6.1 Dashboard d'utilisation
Page `/admin/resources/analytics` avec les KPIs en cartes horizontales :
- **Taux d'occupation global** : pourcentage du temps ou les ressources sont reservees vs disponibles sur la periode (defaut 30 jours). Formule : `heures_reservees / (heures_ouvrables * nombre_ressources) * 100`. Couleur verte si > 50%, orange si 20-50%, rouge si < 20% (sous-utilisation).
- **Nombre de reservations** : total sur la periode. Delta par rapport a la periode precedente (ex: "+12% vs mois precedent").
- **Taux de no-show** : pourcentage de reservations sans check-in parmi celles avec check-in obligatoire. Couleur verte si < 5%, orange si 5-15%, rouge si > 15%.
- **Duree moyenne** : duree moyenne des reservations en heures et minutes (ex: "1h 15min").
- **Ressource la plus demandee** : nom de la ressource avec le plus de reservations, avec son taux d'occupation.

Selecteur de periode : 7j, 30j, 90j, personnalise (date range picker). Filtre par type de ressource.

### 6.2 Taux d'occupation par ressource
Graphique en barres horizontales (Recharts `BarChart` horizontal) montrant le taux d'occupation de chaque ressource sur la periode selectionnee. Tri decroissant par defaut. Barres colorees : vert (> 50%), orange (20-50%), rouge (< 20%). Identification des ressources sous-utilisees (< 20%) avec un badge "Sous-utilisee" et des ressources sur-sollicitees (> 80%) avec un badge "Forte demande". Tooltip au survol : nom, taux, nombre de reservations, duree moyenne. Aide a la decision pour ajouter ou retirer des ressources.

### 6.3 Heatmap d'utilisation
Matrice jour de la semaine (Y : lundi a dimanche) x heure (X : 8h a 20h) coloree par densite de reservations. Intensite de la couleur proportionnelle au nombre de reservations (blanc = 0, bleu fonce = maximum). Tooltip au survol : jour, heure, nombre de reservations, taux d'occupation. Permet d'identifier les creneaux de pointe (ex: mardi 10h = peak) et les periodes creuses (ex: vendredi apres-midi). Filtrable par type de ressource et par ressource individuelle. Rendu avec un composant SVG custom ou Recharts `ScatterChart` avec cellules colorees.

### 6.4 Rapport de no-shows
Tableau des utilisateurs avec le plus de no-shows sur la periode :
- Colonnes : Utilisateur, Nombre de no-shows, Total reservations, Taux de no-show (%), Derniere occurrence
- Tri par nombre de no-shows decroissant
- Seuil d'alerte configurable : les lignes depassant le seuil (defaut 3 no-shows) sont surlignees en rouge
- Actions admin : bouton "Envoyer un avertissement" (email template), bouton "Bloquer les reservations" (temporaire, 7 jours)

### 6.5 Export des rapports
Export des donnees d'analytics :
- **CSV** : donnees brutes — une ligne par reservation (id, ressource, utilisateur, date, debut, fin, duree, statut, check-in, no-show)
- **PDF** : rapport formate avec logo, graphiques (occupation, heatmap, no-shows), KPIs, top 10 ressources, recommandations. Genere via signapps-office (port 3018).
- Generation automatique mensuelle envoyee aux administrateurs (configurable dans `/admin/resources/settings`, toggle "Rapport mensuel", multi-select destinataires). Le rapport est genere le 1er du mois a 9h via une tache scheduler.

### 6.6 Tendances
Graphique en courbes (Recharts `LineChart`) montrant l'evolution des KPIs dans le temps :
- Taux d'occupation (courbe bleue)
- Nombre de reservations par jour (courbe verte)
- Taux de no-show (courbe rouge)

Periode : 30j, 90j, 365j. Granularite : quotidienne (30j), hebdomadaire (90j), mensuelle (365j). Comparaison mois-sur-mois en overlay (courbe actuelle en trait plein, mois precedent en pointilles). Utile pour detecter les tendances saisonnieres et mesurer l'impact des actions correctives (ex: activation du check-in).

---

## Categorie 7 — Notifications et communication

### 7.1 Notifications de reservation
L'utilisateur recoit des notifications pour :
- Confirmation de reservation (in-app + email avec ICS)
- Modification de reservation (par lui ou un admin) — in-app + email
- Annulation de reservation (par lui, un admin, ou auto no-show) — in-app + email
- Approbation ou refus (si workflow d'approbation actif) — in-app + email
- Rappels (24h avant email, 15 min avant push, check-in push, 5 min avant fin push)
- Delegation recue — in-app + email
- Liste d'attente : creneau disponible — in-app + email + push

Canaux : in-app (toujours), email (configurable par type dans les preferences utilisateur), push mobile (si PWA installe). Les notifications email utilisent des templates react-email responsives avec le branding SignApps.

### 7.2 Notifications admin
L'administrateur recoit des notifications pour :
- Demandes d'approbation en attente (in-app avec badge compteur + email quotidien recapitulatif)
- No-shows detectes (in-app si seuil depasse)
- Ressource desactivee avec reservations futures (in-app : "{N} reservations a migrer pour {ressource}")
- Rapport mensuel automatique (email)
- Seuil d'alerte no-show depasse pour un utilisateur (in-app + email)

### 7.3 Ecran d'affichage (signalisation)
Voir section 4.6 pour le detail complet du mode kiosk. Resume : page `/resources/{id}/display` optimisee pour un ecran a l'entree d'une salle, avec fond colore (vert/rouge), statut actuel, prochaine reservation, timeline du jour, QR code de check-in, et rafraichissement automatique. L'admin configure les ecrans dans `/admin/resources/displays` : associer un ecran a une ressource, personnaliser le message de bienvenue et le logo.

---

## Categorie 8 — Architecture backend

### 8.1 Modele de donnees

```sql
-- Types de ressources
CREATE TABLE resource_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) NOT NULL DEFAULT 'building',
    slug VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attributs personnalises par type
CREATE TABLE resource_type_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_id UUID NOT NULL REFERENCES resource_types(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    data_type VARCHAR(20) NOT NULL, -- text, number, boolean, select, date
    options JSONB, -- for select type: ["Option A", "Option B"]
    required BOOLEAN NOT NULL DEFAULT false,
    show_on_card BOOLEAN NOT NULL DEFAULT true,
    display_order INT NOT NULL DEFAULT 0,
    UNIQUE (type_id, name)
);

-- Ressources
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    type_id UUID NOT NULL REFERENCES resource_types(id),
    description TEXT,
    capacity INT,
    location_building VARCHAR(100),
    location_floor VARCHAR(50),
    location_room VARCHAR(50),
    photo_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, inactive, maintenance
    floor_plan_id UUID,
    floor_plan_x NUMERIC(5, 2), -- percentage 0-100
    floor_plan_y NUMERIC(5, 2),
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_resources_type ON resources (type_id);
CREATE INDEX idx_resources_status ON resources (status);

-- Valeurs d'attributs personnalises
CREATE TABLE resource_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    attribute_id UUID NOT NULL REFERENCES resource_type_attributes(id) ON DELETE CASCADE,
    value JSONB NOT NULL,
    UNIQUE (resource_id, attribute_id)
);

-- Equipements des ressources (lookup rapide pour les filtres)
CREATE TABLE resource_amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    amenity VARCHAR(50) NOT NULL, -- projector, whiteboard, videoconference, phone, ac, tv, microphone
    UNIQUE (resource_id, amenity)
);
CREATE INDEX idx_amenities_resource ON resource_amenities (resource_id);

-- Reservations
CREATE TABLE resource_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES resources(id),
    user_id UUID NOT NULL,
    title VARCHAR(200),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed', -- confirmed, pending, cancelled, no_show
    recurrence_rule TEXT, -- RRULE string
    parent_booking_id UUID REFERENCES resource_bookings(id) ON DELETE SET NULL,
    notes TEXT,
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_booking_window CHECK (end_at > start_at)
);
CREATE INDEX idx_bookings_resource_time
    ON resource_bookings (resource_id, start_at, end_at);
CREATE INDEX idx_bookings_user ON resource_bookings (user_id);
CREATE INDEX idx_bookings_status ON resource_bookings (status);

-- Exclusion constraint: no overlapping bookings for the same resource
-- Requires btree_gist extension
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE resource_bookings ADD CONSTRAINT no_booking_overlap
    EXCLUDE USING gist (
        resource_id WITH =,
        tstzrange(start_at, end_at) WITH &&
    ) WHERE (status NOT IN ('cancelled', 'no_show'));

-- Participants des reservations
CREATE TABLE resource_booking_participants (
    booking_id UUID NOT NULL REFERENCES resource_bookings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'invited', -- invited, accepted, declined
    PRIMARY KEY (booking_id, user_id)
);

-- Approbations
CREATE TABLE resource_booking_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES resource_bookings(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL,
    decision VARCHAR(20), -- approved, rejected, NULL = pending
    comment TEXT,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Regles de reservation
CREATE TABLE resource_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
    type_id UUID REFERENCES resource_types(id) ON DELETE CASCADE,
    min_duration_min INT NOT NULL DEFAULT 15,
    max_duration_min INT NOT NULL DEFAULT 480,
    max_advance_days INT NOT NULL DEFAULT 30,
    daily_quota INT, -- NULL = unlimited
    concurrent_quota INT, -- NULL = unlimited
    allowed_hours_start TIME NOT NULL DEFAULT '08:00',
    allowed_hours_end TIME NOT NULL DEFAULT '20:00',
    allowed_days JSONB NOT NULL DEFAULT '[1,2,3,4,5]', -- 1=Mon, 7=Sun
    buffer_minutes INT NOT NULL DEFAULT 0,
    checkin_required BOOLEAN NOT NULL DEFAULT false,
    checkin_delay_minutes INT NOT NULL DEFAULT 15,
    approval_required BOOLEAN NOT NULL DEFAULT false,
    approver_ids UUID[] NOT NULL DEFAULT '{}',
    waitlist_enabled BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT one_scope CHECK (
        (resource_id IS NOT NULL AND type_id IS NULL) OR
        (resource_id IS NULL AND type_id IS NOT NULL)
    )
);

-- Liste d'attente
CREATE TABLE resource_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES resources(id),
    user_id UUID NOT NULL,
    desired_start_at TIMESTAMPTZ NOT NULL,
    desired_end_at TIMESTAMPTZ NOT NULL,
    position INT NOT NULL,
    notified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting', -- waiting, notified, confirmed, expired
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Plans d'etage
CREATE TABLE resource_floor_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    building VARCHAR(100),
    floor VARCHAR(50),
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 8.2 Service de reservation
Le module de reservation est implemente dans `signapps-calendar` (port 3011) car les reservations sont fondamentalement des evenements calendrier de type `booking`. Les endpoints REST :

**`GET /api/v1/resources`** — Lister les ressources. Query params : `type` (slug), `search` (nom/description), `building`, `floor`, `capacity_min`, `amenities` (comma-separated), `available_at` (ISO 8601), `available_duration_min`, `status`, `page`, `per_page` (defaut 20). Retourne un tableau pagine de ressources avec leurs attributs et disponibilite en temps reel.

**`GET /api/v1/resources/{id}`** — Detail d'une ressource avec tous ses attributs, amenities, regles, et calendrier de disponibilite pour la semaine en cours.

**`GET /api/v1/resources/{id}/availability?date=2026-04-09`** — Creneaux disponibles pour un jour donne. Retourne un tableau de `{ start, end }` representant les creneaux libres.

**`POST /api/v1/resources/{id}/bookings`** — Creer une reservation. Body : `{ "start_at", "end_at", "title", "participants": [], "recurrence_rule", "exception_dates": [], "notes" }`. Retourne 201 avec la reservation creee, ou 409 (Conflict) avec les details du conflit et les suggestions.

**`PUT /api/v1/resources/{id}/bookings/{booking_id}`** — Modifier une reservation. Body partiel (seuls les champs a modifier).

**`DELETE /api/v1/resources/{id}/bookings/{booking_id}`** — Annuler. Query param `?scope=single|future|all` pour les recurrences.

**`POST /api/v1/resources/{id}/bookings/{booking_id}/checkin`** — Check-in. Body : `{ "token" }` (OTP du QR code) ou vide si check-in depuis l'app.

**`POST /api/v1/resources/{id}/bookings/{booking_id}/delegate`** — Deleguer. Body : `{ "target_user_id" }`.

**`GET /api/v1/resources/{id}/bookings`** — Reservations d'une ressource. Query params : `from`, `to`, `status`, `page`, `per_page`.

**`GET /api/v1/resources/my-bookings`** — Reservations de l'utilisateur connecte. Query params : `tab` (upcoming, past, cancelled), `page`, `per_page`.

**Admin endpoints** (role `resources.admin` requis) :
- `POST /api/v1/admin/resources` — Creer une ressource
- `PUT /api/v1/admin/resources/{id}` — Modifier une ressource
- `DELETE /api/v1/admin/resources/{id}` — Supprimer une ressource
- `POST /api/v1/admin/resources/import` — Import CSV
- `GET /api/v1/admin/resources/analytics` — Donnees analytics
- `POST /api/v1/admin/resource-types` — Creer un type
- `PUT /api/v1/admin/resource-types/{id}` — Modifier un type
- `DELETE /api/v1/admin/resource-types/{id}` — Supprimer un type

### 8.3 Gestion des conflits
La detection de conflit utilise une contrainte d'exclusion PostgreSQL sur la table `resource_bookings` :
```sql
ALTER TABLE resource_bookings ADD CONSTRAINT no_booking_overlap
    EXCLUDE USING gist (
        resource_id WITH =,
        tstzrange(start_at, end_at) WITH &&
    ) WHERE (status NOT IN ('cancelled', 'no_show'));
```
Cela garantit qu'aucune reservation active ne chevauche une autre pour la meme ressource, meme sous charge concurrente (serialisable au niveau PostgreSQL). Le handler Rust capture l'erreur de contrainte (`sqlx::Error::Database` avec code `23P01`) et retourne un `AppError::Conflict` avec :
```json
{
  "type": "https://api.signapps.com/errors/booking-conflict",
  "title": "Booking conflict",
  "status": 409,
  "detail": "Resource is already booked from 14:00 to 15:30",
  "conflict": { "start_at": "...", "end_at": "...", "booked_by": "..." },
  "suggestions": [
    { "start_at": "2026-04-09T15:30:00Z", "end_at": "2026-04-09T16:30:00Z" },
    { "start_at": "2026-04-09T17:00:00Z", "end_at": "2026-04-09T18:00:00Z" }
  ]
}
```

### 8.4 Integration PgEventBus
Evenements emis sur le bus :
- `resource.booking.created` — reservation creee (payload : booking complet avec ressource, utilisateur, creneau). Consomme par `signapps-calendar` pour creer l'evenement calendrier et par `signapps-notifications` pour envoyer les notifications.
- `resource.booking.updated` — reservation modifiee (payload : booking mis a jour)
- `resource.booking.cancelled` — reservation annulee (payload : booking_id, reason)
- `resource.booking.checkin` — check-in confirme (payload : booking_id, checked_in_at)
- `resource.booking.noshow` — no-show detecte (payload : booking_id, user_id)
- `resource.booking.approved` — reservation approuvee (payload : booking_id, approver_id)
- `resource.booking.rejected` — reservation refusee (payload : booking_id, approver_id, comment)

### 8.5 Job CRON no-show
Un job planifie via signapps-scheduler (port 3007) s'execute toutes les 5 minutes pour detecter les reservations sans check-in :
1. Requete SQL : `SELECT * FROM resource_bookings b JOIN resource_rules r ON ... WHERE r.checkin_required = true AND b.status = 'confirmed' AND b.start_at < now() - interval '{delay} minutes' AND b.checked_in_at IS NULL`
2. Pour chaque reservation trouvee : passer le statut a `no_show`
3. Emettre l'evenement `resource.booking.noshow` sur PgEventBus
4. Liberer le creneau (la reservation en `no_show` est exclue de la contrainte d'exclusion)
5. Notifier le premier utilisateur en liste d'attente s'il y en a

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
- Le filtre par type persiste dans l'URL sous forme de query param
- La recherche par nom trouve la ressource correspondante et highlight le terme
- Les filtres avances par capacite, equipements et disponibilite fonctionnent
- Les filtres actifs sont affiches sous forme de chips supprimables
- L'etat vide s'affiche quand aucune ressource n'est configuree
- La carte d'une salle affiche nom, capacite, localisation, equipements et disponibilite
- La carte d'un equipement affiche le numero de serie, le modele et la condition
- La carte d'un vehicule affiche l'immatriculation, le kilometrage et le type de carburant
- Le badge "Disponible" est vert quand la ressource n'a pas de reservation en cours
- Le badge "Occupe" est rouge quand la ressource est reservee sur le creneau actuel
- Le toggle de mode d'affichage (liste/grille/plan) fonctionne et persiste en localStorage
- Le plan d'etage affiche les marqueurs colores aux positions configurees
- Le clic sur une carte ouvre la vue detaillee avec le calendrier de disponibilite
- Le clic sur un creneau libre dans le calendrier ouvre le formulaire de reservation pre-rempli
- Le formulaire de reservation valide la duree min/max et les creneaux autorises
- La soumission d'une reservation valide cree la reservation et affiche un toast de confirmation
- Un conflit de reservation affiche un message d'erreur 409 et suggere le prochain creneau
- Le bouton de suggestion de creneau pre-remplit les nouvelles heures
- La reservation apparait dans le calendrier SignApps de l'utilisateur
- Les participants invites recoivent une notification in-app et par email
- La modification d'une reservation met a jour les heures et notifie les participants
- La modification est bloquee si moins de 30 minutes avant le debut
- L'annulation d'une reservation libere le creneau et notifie les participants
- L'annulation d'une recurrence demande le scope (single/future/all)
- Le workflow d'approbation affiche le statut "En attente" jusqu'a la decision
- L'approbation confirme la reservation et notifie le demandeur
- Le refus annule la reservation et notifie le demandeur avec le motif
- Le timeout d'approbation (48h) refuse automatiquement la demande
- Le check-in via l'app confirme la presence dans le delai
- Le check-in via QR code ouvre la page de confirmation et enregistre le check-in
- L'absence de check-in apres le delai annule la reservation (no-show)
- Le no-show est comptabilise dans les analytics de l'utilisateur
- La liste d'attente notifie le premier inscrit quand un creneau se libere
- La reservation recurrente cree les occurrences sans conflit
- Les occurrences en conflit sont signalees et peuvent etre exclues
- La delegation transfere la reservation au nouvel utilisateur
- La vue plan d'etage affiche les ressources avec leur pastille de disponibilite
- Le mode kiosk `/resources/{id}/display` affiche le statut en plein ecran avec fond colore
- Le QR code de check-in sur l'ecran kiosk fonctionne depuis un mobile
- Le dashboard analytics affiche le taux d'occupation, le nombre de reservations et les no-shows
- Le heatmap d'utilisation montre les creneaux de pointe correctement colores
- L'admin peut creer, modifier et desactiver une ressource depuis `/admin/resources`
- L'import CSV cree les ressources valides et affiche un rapport d'erreurs
- Les regles de reservation (duree max, quotas, creneaux autorises, buffer) sont respectees
- Le RBAC restreint la gestion des ressources aux administrateurs
