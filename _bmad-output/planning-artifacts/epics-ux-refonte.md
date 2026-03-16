---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments: ['ux-design.md']
validationStatus: 'passed'
totalEpics: 8
totalStories: 52
uxCoverage: '100%'
---

# SignApps UX Refonte - Epic Breakdown

## Overview

Ce document définit les Epics et Stories pour la refonte complète du frontend SignApps, basée sur le document UX Design. L'objectif est de créer une interface unifiée Admin/User avec des composants génériques hautement personnalisables.

## Principes de la Refonte

| Principe | Description |
|----------|-------------|
| **Interface Unifiée** | Admin et User voient la même interface, permissions contrôlent la visibilité |
| **Blocs Universels** | Chaque entité (User, File, Task) est un bloc réutilisable |
| **Composants Génériques** | DataTable, Form, Sheet, Dashboard utilisables partout |
| **Customisation Contrôlée** | Admin définit ce que users peuvent personnaliser |
| **Sync Backend** | Préférences utilisateur synchronisées multi-device |
| **Multi-tenant Branding** | Chaque organisation personnalise son apparence |

---

## UX Requirements Inventory

### Navigation & Discovery
UX1: Command Bar accessible via Cmd+K pour recherche universelle
UX2: Navigation par Sheets contextuels (pas de changement de page)
UX3: Sidebar avec modules conditionnels selon permissions
UX4: Breadcrumb navigation

### Universal Blocks
UX5: Toutes entités transformées en blocs uniformes
UX6: Blocs affichables en inline, card, row, preview, full
UX7: Blocs interconnectables (relations)
UX8: Blocs embarquables dans documents
UX9: Blocs recherchables uniformément

### Generic Components
UX10: DataTable générique avec colonnes configurables
UX11: Filtres avancés sauvegardables
UX12: Multi-view modes (table, cards, kanban, calendar)
UX13: UniversalSheet pour détails entités
UX14: DynamicForm généré depuis schema
UX15: Dashboard avec widgets drag-and-drop
UX16: ViewSelector avec vues custom

### Customization System
UX17: Tenant branding (logo, couleurs)
UX18: Policies de customisation admin
UX19: Préférences utilisateur avec sync backend
UX20: Vues imposées par admin
UX21: Vues partagées entre users
UX22: Colonnes personnalisables par user
UX23: Dashboard layout persistant

### Unified Admin/User Interface
UX24: Même interface pour tous, permissions filtrent
UX25: Colonnes conditionnelles selon rôle
UX26: Actions conditionnelles selon permissions
UX27: Menus conditionnels (Admin section visible si admin)

---

## Epic List Summary

| Epic | Title | Stories | UXs |
|------|-------|---------|-----|
| 10 | Generic Component Infrastructure | 8 | UX10-UX16 |
| 11 | Universal Blocks System | 6 | UX5-UX9 |
| 12 | Command Bar & Search | 5 | UX1, UX4 |
| 13 | Customizable Dashboard | 7 | UX15, UX23 |
| 14 | Views System | 8 | UX16, UX20, UX21 |
| 15 | Tenant Config & Branding | 6 | UX17, UX18 |
| 16 | User Preferences Sync | 5 | UX19, UX22 |
| 17 | Permissions-Based UI | 7 | UX24-UX27 |

**Total: 8 Epics, 52 Stories**

---

## Epic 10: Generic Component Infrastructure

Créer les composants génériques de base réutilisables dans toute l'application.

**User Outcome:** Les développeurs peuvent utiliser DataTable, Sheet, Form dans n'importe quel contexte avec une configuration simple.

**UXs covered:** UX10, UX11, UX12, UX13, UX14, UX15, UX16

### Story 10.1: DataTable Core Component

En tant que développeur,
Je veux un composant DataTable générique,
Pour afficher n'importe quelle entité en liste.

**Acceptance Criteria:**

**Given** une configuration d'entité (users, files, tasks)
**When** je rends le DataTable avec cette config
**Then** les colonnes définies s'affichent
**And** le tri par clic sur header fonctionne
**And** la pagination s'affiche
**And** les row actions sont disponibles
**And** le composant utilise TanStack Table v8

---

### Story 10.2: DataTable Column Customization

En tant qu'utilisateur,
Je veux personnaliser les colonnes affichées,
Pour voir uniquement les informations pertinentes.

**Acceptance Criteria:**

**Given** un DataTable affiché
**When** je clique sur le bouton de configuration colonnes
**Then** un dropdown montre toutes les colonnes disponibles
**When** je coche/décoche des colonnes
**Then** l'affichage se met à jour immédiatement
**When** je drag-and-drop les colonnes
**Then** l'ordre change
**And** ma configuration persiste (localStorage + backend si auth)

---

### Story 10.3: DataTable Advanced Filters

En tant qu'utilisateur,
Je veux créer des filtres avancés,
Pour trouver rapidement les données recherchées.

**Acceptance Criteria:**

**Given** un DataTable avec filtrage activé
**When** je clique sur "Filtres"
**Then** une interface de construction de filtres apparaît
**When** je choisis un champ, opérateur et valeur
**Then** le filtre s'applique immédiatement
**When** je combine plusieurs filtres (AND/OR)
**Then** la logique s'applique correctement
**And** je peux sauvegarder le filtre comme vue

---

### Story 10.4: DataTable Multi-View Modes

En tant qu'utilisateur,
Je veux basculer entre table, cards, kanban,
Pour visualiser les données différemment selon le contexte.

**Acceptance Criteria:**

**Given** un DataTable configuré avec viewModes: ['table', 'cards', 'kanban']
**When** je clique sur l'icône de vue
**Then** je peux choisir parmi les modes disponibles
**When** je sélectionne "cards"
**Then** les données s'affichent en grille de cards
**When** je sélectionne "kanban"
**Then** les données sont groupées par colonne définie (status, priority)
**And** le drag-and-drop entre colonnes met à jour l'entité

---

### Story 10.5: UniversalSheet Component

En tant qu'utilisateur,
Je veux voir les détails d'une entité dans un panneau latéral,
Pour ne pas perdre mon contexte de liste.

**Acceptance Criteria:**

**Given** une liste d'entités
**When** je clique sur une ligne ou card
**Then** un Sheet s'ouvre à droite avec les détails
**And** la liste reste visible (opacité réduite)
**When** j'appuie sur Escape ou clique en dehors
**Then** le Sheet se ferme
**And** le Sheet a tabs (Détails, Activité, Permissions si admin)
**And** animation d'ouverture/fermeture fluide (300ms)

---

### Story 10.6: DynamicForm Component

En tant que développeur,
Je veux générer des formulaires depuis un schema,
Pour ne pas réécrire les forms pour chaque entité.

**Acceptance Criteria:**

**Given** un schema JSON de formulaire
**When** je rends DynamicForm avec ce schema
**Then** les champs appropriés s'affichent (text, select, date, etc.)
**And** les validations Zod s'appliquent
**And** les sections conditionnelles (visibleTo) fonctionnent
**When** je soumets le form
**Then** les données sont validées et retournées
**And** mode view/edit/create supportés

---

### Story 10.7: EntityPicker Component

En tant qu'utilisateur,
Je veux sélectionner des entités liées facilement,
Pour créer des relations entre données.

**Acceptance Criteria:**

**Given** un champ de type "entity-picker" dans un form
**When** je clique dessus
**Then** un popover de recherche s'ouvre
**When** je tape pour chercher
**Then** les résultats se filtrent en temps réel
**When** je sélectionne une entité
**Then** elle s'affiche comme tag dans le champ
**And** multi-select supporté si configuré
**And** types d'entités: user, file, task, event, document

---

### Story 10.8: Component Config Registry

En tant que développeur,
Je veux un registry centralisé des configurations d'entités,
Pour maintenir la cohérence et éviter la duplication.

**Acceptance Criteria:**

**Given** les différents types d'entités
**When** je consulte le registry
**Then** je trouve la config pour users, files, tasks, events, documents
**And** chaque config définit: columns, actions, filters, viewModes
**And** les configs sont extensibles via spread operator
**And** les configs sont typées avec TypeScript generics

---

## Epic 11: Universal Blocks System

Transformer toutes les entités en blocs uniformes et interconnectables.

**User Outcome:** Les utilisateurs peuvent voir et interagir avec n'importe quelle entité de manière uniforme, les lier entre elles, et les embarquer dans des documents.

**UXs covered:** UX5, UX6, UX7, UX8, UX9

### Story 11.1: Block Interface & Types

En tant que développeur,
Je veux une interface TypeScript UniversalBlock,
Pour standardiser toutes les entités.

**Acceptance Criteria:**

**Given** les types existants (User, File, Task, Event, Document)
**When** j'implémente l'adapter pour chaque type
**Then** chaque entité peut être convertie en UniversalBlock
**And** les propriétés standard sont: id, type, title, subtitle, icon, color, metadata
**And** linkedBlocks permet les relations
**And** permissions définit les actions autorisées

---

### Story 11.2: Block Inline Renderer

En tant qu'utilisateur,
Je veux voir des références inline à d'autres entités,
Pour avoir des liens contextuels dans le texte.

**Acceptance Criteria:**

**Given** un texte avec références @[User: Alice] ou @[File: rapport.docx]
**When** le texte est rendu
**Then** la référence s'affiche comme chip inline (avatar + nom)
**When** je clique sur le chip
**Then** un mini-preview apparaît
**When** je double-clique
**Then** le sheet détail s'ouvre
**And** style cohérent avec couleur selon type

---

### Story 11.3: Block Card Renderer

En tant qu'utilisateur,
Je veux voir les entités en cards,
Pour visualisation grille ou dashboard.

**Acceptance Criteria:**

**Given** un bloc de type file, task ou user
**When** je le rends en mode "card"
**Then** une card s'affiche avec: icon, title, subtitle, metadata
**And** les couleurs reflètent le type ou status
**When** je survole la card
**Then** les actions apparaissent (preview, open, more)
**And** la card est draggable si contexte le permet

---

### Story 11.4: Block Row Renderer

En tant qu'utilisateur,
Je veux voir les entités en lignes,
Pour une vue liste compacte.

**Acceptance Criteria:**

**Given** un bloc quelconque
**When** je le rends en mode "row"
**Then** une ligne compacte s'affiche: icon | title | metadata | actions
**And** la ligne est cliquable pour ouvrir sheet
**And** checkbox de sélection si bulk actions activé
**And** actions sur hover (plus discret que card)

---

### Story 11.5: Block Linking & Relations

En tant qu'utilisateur,
Je veux lier des blocs entre eux,
Pour créer des relations (document lié à task, user assigné, etc.).

**Acceptance Criteria:**

**Given** un bloc ouvert en sheet
**When** je vais dans la section "Liens"
**Then** je vois les blocs liés existants
**When** je clique "Ajouter lien"
**Then** un EntityPicker s'ouvre
**When** je sélectionne un bloc
**Then** le lien est créé (bidirectionnel optionnel)
**And** les liens sont persistés en base
**And** suppression de lien avec confirmation

---

### Story 11.6: Universal Block Search

En tant qu'utilisateur,
Je veux chercher parmi tous les blocs,
Pour trouver n'importe quoi rapidement.

**Acceptance Criteria:**

**Given** le système de blocs unifié
**When** j'ouvre la recherche (Cmd+K ou search bar)
**Then** je peux chercher parmi tous les types
**And** les résultats sont groupés par type
**And** chaque résultat affiche: icon, title, type badge
**When** je filtre par type
**Then** seuls les blocs de ce type apparaissent
**And** recherche fuzzy tolérante aux typos

---

## Epic 12: Command Bar & Search

Implémenter la barre de commande omniprésente pour navigation et actions rapides.

**User Outcome:** Les utilisateurs peuvent accéder à n'importe quelle fonction, entité ou page via Cmd+K sans quitter le clavier.

**UXs covered:** UX1, UX4

### Story 12.1: Command Bar UI Component

En tant qu'utilisateur,
Je veux une barre de commande type Spotlight/Raycast,
Pour accéder rapidement à tout.

**Acceptance Criteria:**

**Given** n'importe quelle page de l'application
**When** j'appuie sur Cmd+K (Ctrl+K sur Windows)
**Then** la command bar s'ouvre au centre de l'écran
**And** le focus est automatiquement sur l'input
**When** j'appuie sur Escape
**Then** la command bar se ferme
**And** animation d'ouverture/fermeture (150ms)
**And** backdrop semi-transparent

---

### Story 12.2: Recent Items & Quick Actions

En tant qu'utilisateur,
Je veux voir mes éléments récents et actions courantes,
Pour y accéder en un clic.

**Acceptance Criteria:**

**Given** la command bar est ouverte sans texte
**When** elle s'affiche
**Then** je vois sections: RÉCENTS, ACTIONS, NAVIGATION
**And** les récents montrent les 5 derniers éléments consultés
**And** les actions montrent: Nouveau document, Nouvelle tâche, Uploader
**When** je sélectionne une action
**Then** elle s'exécute (modal création ou navigation)

---

### Story 12.3: Universal Search Integration

En tant qu'utilisateur,
Je veux chercher parmi toutes les entités,
Pour trouver n'importe quoi rapidement.

**Acceptance Criteria:**

**Given** je tape du texte dans la command bar
**When** le texte change
**Then** les résultats se mettent à jour (debounce 200ms)
**And** résultats groupés: Fichiers, Documents, Tâches, Users, Pages
**And** chaque résultat montre: icon, titre, chemin/context
**When** je navigue avec flèches haut/bas
**Then** la sélection change
**When** j'appuie Entrée
**Then** l'élément sélectionné s'ouvre

---

### Story 12.4: Admin Commands

En tant qu'administrateur,
Je veux des commandes admin dans la command bar,
Pour gérer rapidement users et paramètres.

**Acceptance Criteria:**

**Given** je suis connecté en tant qu'admin
**When** j'ouvre la command bar et tape "user" ou "admin"
**Then** les commandes admin apparaissent: "Inviter user", "Voir logs", "Paramètres"
**And** ces commandes sont invisibles pour les non-admins
**When** je sélectionne "Suspendre user"
**Then** un sub-menu de recherche user s'ouvre
**And** les permissions sont vérifiées côté serveur

---

### Story 12.5: Keyboard Navigation & Shortcuts

En tant qu'utilisateur avancé,
Je veux naviguer entièrement au clavier,
Pour une efficacité maximale.

**Acceptance Criteria:**

**Given** la command bar est ouverte
**When** j'utilise Tab
**Then** je navigue entre sections
**When** j'utilise flèches
**Then** je navigue dans une section
**When** je tape ">"
**Then** le mode commandes s'active (navigation rapide)
**And** shortcuts listés à droite des actions (⌘N pour nouveau)
**And** historique de commandes avec flèche haut

---

## Epic 13: Customizable Dashboard

Permettre aux utilisateurs de personnaliser leur dashboard avec widgets drag-and-drop.

**User Outcome:** Chaque utilisateur peut composer son dashboard idéal avec les widgets qui lui importent, sauvegardé et sync multi-device.

**UXs covered:** UX15, UX23

### Story 13.1: Dashboard Layout Engine

En tant que développeur,
Je veux un système de layout grid pour widgets,
Pour permettre le positionnement flexible.

**Acceptance Criteria:**

**Given** un dashboard avec widgets
**When** les widgets sont rendus
**Then** ils se positionnent selon leur config (x, y, size)
**And** le grid est responsive (colonnes selon viewport)
**And** les widgets ne se chevauchent pas
**And** utilise react-grid-layout ou similar

---

### Story 13.2: Widget Library

En tant qu'utilisateur,
Je veux une bibliothèque de widgets disponibles,
Pour choisir ce que j'affiche.

**Acceptance Criteria:**

**Given** le mode personnalisation du dashboard
**When** je clique "Ajouter widget"
**Then** un catalogue s'ouvre avec tous les widgets
**And** widgets groupés: Productivité, Données, Admin (si admin)
**And** chaque widget montre: preview, description, tailles disponibles
**When** je sélectionne un widget
**Then** il s'ajoute au dashboard

---

### Story 13.3: Widget Implementations

En tant qu'utilisateur,
Je veux des widgets utiles prêts à l'emploi,
Pour avoir un dashboard fonctionnel.

**Acceptance Criteria:**

**Given** le dashboard
**When** je configure mes widgets
**Then** les widgets suivants sont disponibles:
- **RecentFiles**: Derniers fichiers modifiés
- **MyTasks**: Mes tâches assignées avec filtres
- **CalendarMini**: Agenda de la semaine
- **QuickActions**: Boutons d'actions rapides
- **StorageUsage**: Quota utilisé
- **TeamActivity**: Activité récente équipe
- **SystemHealth**: État système (admin)
- **UserStats**: Statistiques users (admin)
**And** chaque widget a props de configuration

---

### Story 13.4: Widget Drag & Drop

En tant qu'utilisateur,
Je veux déplacer mes widgets en drag-and-drop,
Pour organiser mon dashboard.

**Acceptance Criteria:**

**Given** le mode personnalisation actif
**When** je drag un widget par sa poignée
**Then** il se déplace avec feedback visuel
**When** je le drop à un nouvel emplacement
**Then** les autres widgets se réarrangent
**And** snap to grid pour alignement propre
**And** undo disponible si erreur

---

### Story 13.5: Widget Resize

En tant qu'utilisateur,
Je veux redimensionner mes widgets,
Pour donner plus de place aux importants.

**Acceptance Criteria:**

**Given** un widget en mode personnalisation
**When** je drag le coin ou le bord
**Then** le widget se redimensionne
**And** tailles: sm (1x1), md (2x1), lg (2x2 ou 3x1)
**When** le widget change de taille
**Then** son contenu s'adapte (plus de données, etc.)
**And** certains widgets ont des tailles min/max

---

### Story 13.6: Dashboard Layout Persistence

En tant qu'utilisateur,
Je veux que ma config dashboard soit sauvegardée,
Pour la retrouver sur tous mes devices.

**Acceptance Criteria:**

**Given** je modifie mon dashboard
**When** je quitte le mode personnalisation
**Then** le layout est sauvegardé automatiquement
**And** sauvegarde en localStorage immédiate
**And** sync vers backend (debounced 2s)
**When** je me connecte depuis un autre device
**Then** mon layout est restauré
**And** conflict resolution: server wins si timestamp plus récent

---

### Story 13.7: Admin Dashboard Presets

En tant qu'administrateur,
Je veux définir des presets de dashboard,
Pour donner un bon départ aux nouveaux users.

**Acceptance Criteria:**

**Given** le panneau admin customization
**When** je crée un "preset dashboard"
**Then** je définis un layout de widgets
**When** un nouveau user se connecte
**Then** le preset de son rôle est appliqué
**And** l'user peut ensuite personnaliser
**And** presets par rôle: Admin, User, Manager

---

## Epic 14: Views System

Permettre la création, sauvegarde et partage de vues personnalisées pour chaque entité.

**User Outcome:** Les utilisateurs peuvent créer des vues filtrées/triées réutilisables, les partager, et les admins peuvent imposer des vues par rôle.

**UXs covered:** UX16, UX20, UX21

### Story 14.1: ViewSelector Component

En tant qu'utilisateur,
Je veux choisir parmi mes vues sauvegardées,
Pour basculer rapidement entre configurations.

**Acceptance Criteria:**

**Given** une page avec DataTable (files, users, tasks)
**When** je clique sur le sélecteur de vue
**Then** un dropdown montre: Vues système, Mes vues, Vues partagées, Vues admin
**When** je sélectionne une vue
**Then** filtres, tri, colonnes, viewMode s'appliquent
**And** la vue sélectionnée est mémorisée comme dernière utilisée
**And** icône étoile pour marquer favoris

---

### Story 14.2: ViewBuilder UI

En tant qu'utilisateur,
Je veux créer mes propres vues,
Pour organiser les données selon mes besoins.

**Acceptance Criteria:**

**Given** le sélecteur de vue
**When** je clique "+ Créer une vue"
**Then** un Sheet ViewBuilder s'ouvre
**And** je peux définir: nom, icône, viewMode
**And** je peux ajouter des filtres (champ, opérateur, valeur)
**And** je peux définir le tri (champ, direction)
**And** je peux choisir les colonnes visibles
**When** je sauvegarde
**Then** la vue apparaît dans mes vues

---

### Story 14.3: View Persistence Backend

En tant qu'utilisateur,
Je veux que mes vues soient sync au backend,
Pour les retrouver partout.

**Acceptance Criteria:**

**Given** une vue créée
**When** elle est sauvegardée
**Then** POST /api/v1/views avec: entity_type, name, filters, sort, columns
**And** la vue a un ID unique
**When** je modifie une vue
**Then** PUT /api/v1/views/:id
**When** je supprime
**Then** DELETE /api/v1/views/:id
**And** soft delete avec possibilité de restore 30 jours

---

### Story 14.4: View Sharing

En tant qu'utilisateur,
Je veux partager mes vues avec collègues,
Pour collaborer efficacement.

**Acceptance Criteria:**

**Given** une vue personnelle
**When** je clique "Partager"
**Then** options: Privé, Équipe, Tout le monde (tenant)
**When** je partage avec équipe
**Then** les membres de mon groupe voient la vue
**And** vue marquée avec icône 👥
**And** seul le créateur peut modifier/supprimer
**And** les autres peuvent copier pour personnaliser

---

### Story 14.5: Admin Imposed Views

En tant qu'administrateur,
Je veux imposer des vues aux utilisateurs,
Pour garantir des standards (audit, sécurité).

**Acceptance Criteria:**

**Given** le panneau admin views
**When** je crée une "vue imposée"
**Then** je configure: entity, filters, columns, target_roles
**When** j'active la vue imposée
**Then** tous les users des rôles ciblés la voient
**And** vue marquée 🔒 non modifiable par users
**And** peut être définie comme vue par défaut pour le rôle

---

### Story 14.6: Default Views Per Role

En tant qu'administrateur,
Je veux définir la vue par défaut selon le rôle,
Pour une expérience adaptée.

**Acceptance Criteria:**

**Given** le panneau admin views
**When** je configure "Vues par défaut"
**Then** je peux assigner: Entité + Rôle → Vue
**Example** Files + User → "Vue simple", Files + Admin → "Vue complète"
**When** un user ouvre /storage pour la première fois
**Then** la vue par défaut de son rôle s'applique
**And** l'user peut changer s'il a permission

---

### Story 14.7: View Filter Operators

En tant qu'utilisateur,
Je veux des opérateurs de filtrage complets,
Pour créer des vues précises.

**Acceptance Criteria:**

**Given** le ViewBuilder section filtres
**When** je crée un filtre
**Then** opérateurs disponibles selon type:
- **Text**: equals, contains, starts_with, ends_with, is_empty
- **Number**: equals, gt, lt, gte, lte, between
- **Date**: equals, before, after, between, last_n_days, this_week
- **Select**: equals, in, not_in
- **Boolean**: is_true, is_false
**And** combinaison AND/OR supportée

---

### Story 14.8: View Quick Apply from Filters

En tant qu'utilisateur,
Je veux sauvegarder rapidement mes filtres actuels,
Sans passer par le ViewBuilder complet.

**Acceptance Criteria:**

**Given** j'ai appliqué des filtres ad-hoc sur un DataTable
**When** je clique "Sauvegarder comme vue"
**Then** un dialog minimal demande juste le nom
**And** la vue est créée avec les filtres actuels
**And** option "inclure colonnes actuelles" checkbox

---

## Epic 15: Tenant Config & Branding

Permettre aux administrateurs de personnaliser l'apparence et les policies de leur organisation.

**User Outcome:** Chaque organisation a son branding (logo, couleurs) et contrôle ce que les utilisateurs peuvent personnaliser.

**UXs covered:** UX17, UX18

### Story 15.1: Tenant Branding Settings UI

En tant qu'administrateur,
Je veux personnaliser le branding de mon organisation,
Pour une expérience cohérente avec notre identité.

**Acceptance Criteria:**

**Given** /admin/customization/branding
**When** j'accède à cette page
**Then** je vois les paramètres actuels: logo, nom, couleurs
**When** j'upload un nouveau logo
**Then** il remplace l'ancien dans le header
**When** je change la couleur primaire
**Then** preview live des changements
**And** sauvegarde applique à tous les users du tenant

---

### Story 15.2: Color Theme Configuration

En tant qu'administrateur,
Je veux définir les couleurs de l'interface,
Pour matcher notre charte graphique.

**Acceptance Criteria:**

**Given** la section branding
**When** je configure les couleurs
**Then** je peux définir: primary, secondary, accent
**And** un color picker avec HEX/RGB input
**And** contrast ratio affiché (WCAG)
**And** preview du thème clair et sombre
**When** je sauvegarde
**Then** CSS variables sont mises à jour pour le tenant

---

### Story 15.3: Customization Policies Backend

En tant qu'administrateur,
Je veux définir ce que les users peuvent personnaliser,
Pour garder le contrôle sur l'UX.

**Acceptance Criteria:**

**Given** POST /api/v1/tenant/config
**When** j'envoie customization_policies
**Then** les policies sont validées et sauvegardées
**And** policies supportées:
- users_can_customize_theme
- users_can_create_views
- users_can_share_views
- users_can_customize_dashboard
- users_can_reorder_columns
- users_can_export_data
- max_custom_views_per_user
- max_dashboard_widgets
**And** defaults sensibles si non spécifié

---

### Story 15.4: Customization Policies UI

En tant qu'administrateur,
Je veux une interface pour gérer les policies,
Pour configurer facilement.

**Acceptance Criteria:**

**Given** /admin/customization/policies
**When** j'accède à cette page
**Then** je vois toutes les policies avec toggles
**And** groupées par catégorie: Thème, Vues, Dashboard, Données
**When** je toggle une policy
**Then** preview des impacts (ex: "Users ne pourront plus créer de vues")
**When** je sauvegarde
**Then** changements effectifs immédiatement

---

### Story 15.5: Tenant Config API

En tant que développeur frontend,
Je veux récupérer la config tenant au login,
Pour appliquer branding et policies.

**Acceptance Criteria:**

**Given** GET /api/v1/tenant/config
**When** l'endpoint est appelé
**Then** retourne: branding, policies, features_enabled
**And** endpoint public si juste branding, auth requis pour policies
**And** caché 5 minutes côté client
**And** webhook ou polling pour changements temps réel (optionnel v2)

---

### Story 15.6: Branding Application in UI

En tant qu'utilisateur,
Je veux voir le branding de mon organisation,
Pour une expérience personnalisée.

**Acceptance Criteria:**

**Given** je me connecte à SignApps
**When** l'app charge
**Then** le logo du tenant s'affiche dans le header
**And** les couleurs primary/secondary sont appliquées via CSS vars
**And** le favicon est celui du tenant
**And** le nom du tenant apparaît dans le title

---

## Epic 16: User Preferences Sync

Synchroniser les préférences utilisateur entre frontend et backend pour persistance multi-device.

**User Outcome:** Les utilisateurs retrouvent leurs préférences (thème, colonnes, layout) sur tous leurs appareils.

**UXs covered:** UX19, UX22

### Story 16.1: Preferences Store Frontend

En tant que développeur,
Je veux un store Zustand pour les préférences,
Pour gérer l'état de personnalisation.

**Acceptance Criteria:**

**Given** l'application Next.js
**When** je crée preferences-store.ts
**Then** le store contient: theme, language, timezone, density
**And** contient entity_views: { [entityType]: { columns, sort, view_id } }
**And** contient dashboard_layout
**And** hydration depuis localStorage au mount
**And** sync vers localStorage à chaque changement

---

### Story 16.2: Preferences API Endpoints

En tant que développeur backend,
Je veux des endpoints pour les préférences,
Pour la persistance côté serveur.

**Acceptance Criteria:**

**Given** user authentifié
**When** GET /api/v1/users/me/preferences
**Then** retourne toutes les préférences JSON
**When** PUT /api/v1/users/me/preferences
**Then** remplace toutes les préférences
**When** PATCH /api/v1/users/me/preferences/:key
**Then** met à jour une préférence spécifique
**And** validation du schema des préférences
**And** tenant_id implicite depuis JWT

---

### Story 16.3: Preferences Sync Service

En tant que développeur frontend,
Je veux un service de sync des préférences,
Pour la synchronisation bidirectionnelle.

**Acceptance Criteria:**

**Given** le preferences store
**When** une préférence change
**Then** sync vers backend debounced (2s)
**When** l'app charge
**Then** fetch les préférences serveur si plus récentes
**And** merge intelligent (server wins si timestamp plus récent)
**And** queue offline avec sync on reconnect

---

### Story 16.4: Column Preferences Per Entity

En tant qu'utilisateur,
Je veux que mes choix de colonnes soient mémorisés,
Pour ne pas reconfigurer à chaque visite.

**Acceptance Criteria:**

**Given** je personnalise les colonnes d'un DataTable
**When** je change l'ordre ou la visibilité
**Then** les changements sont sauvés dans preferences.entity_views[type]
**When** je reviens sur cette page
**Then** ma configuration est restaurée
**And** distinct par entityType (files, users, tasks)
**And** merge avec config système pour colonnes obligatoires

---

### Story 16.5: Config Resolution Logic

En tant que développeur,
Je veux une fonction de résolution de config,
Pour merger System + Admin + User correctement.

**Acceptance Criteria:**

**Given** les trois niveaux de config
**When** j'appelle resolveConfig(systemDefault, adminOverride, userPref, policies)
**Then** la résolution suit la priorité: System < Admin < User
**But** les policies peuvent bloquer user prefs
**Example**: si users_can_customize_theme: false, alors user theme ignoré
**And** TypeScript generic pour type-safety

---

## Epic 17: Permissions-Based UI

Implémenter le filtrage dynamique de l'interface selon les permissions utilisateur.

**User Outcome:** Les utilisateurs voient uniquement ce qu'ils peuvent utiliser, sans "dead ends" ni boutons désactivés.

**UXs covered:** UX24, UX25, UX26, UX27

### Story 17.1: Permissions Context Provider

En tant que développeur,
Je veux un context avec les permissions courantes,
Pour filtrer l'UI partout.

**Acceptance Criteria:**

**Given** l'utilisateur connecté
**When** l'app charge
**Then** PermissionsProvider fetch les permissions depuis JWT/API
**And** expose usePermissions() hook
**And** permissions incluent: rôle, features, entité-permissions
**And** rafraîchi si JWT refresh

---

### Story 17.2: Conditional Sidebar Navigation

En tant qu'utilisateur,
Je veux voir uniquement les modules auxquels j'ai accès,
Pour une navigation claire.

**Acceptance Criteria:**

**Given** le sidebar
**When** il se rend
**Then** chaque NavItem vérifie permissions
**And** "Administration" visible seulement si role >= admin
**And** modules désactivés (features disabled) sont cachés
**And** pas de "Coming soon" - si pas ready, pas visible

---

### Story 17.3: Column Visibility by Permission

En tant qu'utilisateur,
Je veux que les colonnes sensibles soient cachées si pas autorisé,
Pour la sécurité des données.

**Acceptance Criteria:**

**Given** une config DataTable avec colonnes ayant requiredPermission
**When** le DataTable se rend
**Then** les colonnes sans permission sont exclues
**Example**: colonne "salaire" visible seulement si permission "hr.view_salary"
**And** pas de placeholder "—" ou "hidden", simplement absent

---

### Story 17.4: Action Filtering by Permission

En tant qu'utilisateur,
Je veux voir uniquement les actions que je peux effectuer,
Pour éviter la frustration.

**Acceptance Criteria:**

**Given** un menu d'actions (dropdown, context menu)
**When** il se rend
**Then** chaque action vérifie sa permission
**And** actions non autorisées sont absentes (pas disabled)
**Example**: "Supprimer user" absent si pas permission users.delete
**And** permission check côté serveur aussi (defense in depth)

---

### Story 17.5: Sheet Tabs by Permission

En tant qu'utilisateur,
Je veux voir uniquement les tabs pertinentes dans les sheets,
Pour une interface épurée.

**Acceptance Criteria:**

**Given** un UniversalSheet avec tabs: Détails, Activité, Permissions, Admin
**When** un user standard ouvre le sheet
**Then** tabs "Permissions" et "Admin" sont absentes
**When** un admin ouvre le sheet
**Then** toutes les tabs sont visibles
**And** le contenu des tabs aussi filtré selon permissions

---

### Story 17.6: Bulk Actions Permission Check

En tant qu'utilisateur,
Je veux que les bulk actions respectent les permissions par item,
Pour éviter les erreurs partielles.

**Acceptance Criteria:**

**Given** une sélection multiple d'items
**When** je choisis une bulk action
**Then** seuls les items où j'ai la permission sont affectés
**And** message indique "X sur Y traités, Z sans permission"
**Or** si aucun autorisé, action bloquée avec explication
**And** preview avant exécution pour actions destructives

---

### Story 17.7: Admin Role Detection

En tant qu'utilisateur admin,
Je veux que l'interface reconnaisse mon rôle automatiquement,
Pour voir les options admin sans configuration.

**Acceptance Criteria:**

**Given** un utilisateur avec role: 'admin' dans JWT
**When** l'app évalue les permissions
**Then** isAdmin() retourne true
**And** les features admin s'activent automatiquement
**And** pas de "mode admin" toggle - juste permissions
**And** super_admin a toutes les permissions

---

## Dependencies & Technical Notes

### Dependencies Between Epics

```
Epic 10 (Components) ──┬──► Epic 11 (Blocks) uses DataTable, Sheet
                       │
                       ├──► Epic 13 (Dashboard) uses Widget components
                       │
                       └──► Epic 14 (Views) uses DataTable config

Epic 15 (Tenant) ─────────► Epic 16 (User Prefs) needs policies
                           │
Epic 17 (Permissions) ◄────┘ needs both for filtering
```

### Suggested Implementation Order

1. **Phase 1 - Foundation**
   - Epic 17: Permissions (enables conditional UI)
   - Epic 10: Generic Components (building blocks)

2. **Phase 2 - Core Features**
   - Epic 16: User Preferences (persistence)
   - Epic 15: Tenant Config (branding, policies)
   - Epic 11: Universal Blocks

3. **Phase 3 - Advanced Features**
   - Epic 12: Command Bar
   - Epic 14: Views System
   - Epic 13: Customizable Dashboard

### Technology Stack

| Component | Technology |
|-----------|------------|
| DataTable | TanStack Table v8 |
| Drag & Drop | dnd-kit |
| Dashboard Grid | react-grid-layout |
| Form | react-hook-form + zod |
| State | Zustand |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Search | Fuse.js (client) + pgvector (server) |

### API Endpoints Summary

```
# Tenant Config
GET    /api/v1/tenant/config
PUT    /api/v1/tenant/config

# User Preferences
GET    /api/v1/users/me/preferences
PUT    /api/v1/users/me/preferences
PATCH  /api/v1/users/me/preferences/:key

# Custom Views
GET    /api/v1/views
POST   /api/v1/views
PUT    /api/v1/views/:id
DELETE /api/v1/views/:id

# Admin Views
GET    /api/v1/admin/views
POST   /api/v1/admin/views
PUT    /api/v1/admin/views/:id
DELETE /api/v1/admin/views/:id

# Search
GET    /api/v1/search?q=&types=
```

---

*Generated by BMAD Method v6.0.4 - Create Epics and Stories Workflow*
