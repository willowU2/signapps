# UX Design Document - SignApps Unified Platform

**Author:** Etienne
**Date:** 2026-03-16
**Version:** 1.0
**Status:** Complete

---

## Executive Summary

Ce document définit l'architecture UX pour la refonte complète du frontend SignApps. L'objectif est de créer une **interface unifiée** pour utilisateurs et administrateurs, basée sur des **composants génériques** hautement personnalisables, avec une approche **"low-code platform"** permettant une customisation maximale contrôlée par l'administrateur.

### Principes Fondamentaux

| Principe | Description |
|----------|-------------|
| **Interface Unifiée** | Admin et User voient la même interface, les permissions contrôlent la visibilité |
| **Blocs Universels** | Chaque entité (User, File, Task, Event) est un bloc réutilisable et interconnectable |
| **Composants Génériques** | DataTable, Form, Sheet, Dashboard utilisables dans tous les contextes |
| **Customisation Contrôlée** | L'admin définit ce que les utilisateurs peuvent personnaliser |
| **Sync Backend** | Toutes les préférences utilisateur synchronisées multi-device |
| **Multi-tenant Branding** | Chaque organisation peut personnaliser son apparence |

---

## 1. Architecture de Navigation

### 1.1 Structure Globale

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HEADER (Global)                                                         │
│  ┌─────────┬──────────────────────────────────────┬──────────┬────────┐ │
│  │  Logo   │  Command Bar (Cmd+K)                 │ Notifs   │ Avatar │ │
│  │ (tenant)│  "Rechercher ou taper une commande"  │          │        │ │
│  └─────────┴──────────────────────────────────────┴──────────┴────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────┐  ┌─────────────────────────────────────────────────────┐  │
│  │ SIDEBAR │  │  MAIN CONTENT                                       │  │
│  │         │  │                                                     │  │
│  │ Modules │  │  ┌─────────────────────────────────────────────┐   │  │
│  │ ─────── │  │  │  Page Content                               │   │  │
│  │ Dashboard│  │  │  (DataTable, Cards, Calendar, etc.)        │   │  │
│  │ Storage │  │  │                                             │   │  │
│  │ Docs    │  │  │                                             │   │  │
│  │ Tasks   │  │  │                                             │   │  │
│  │ Calendar│  │  │                                             │   │  │
│  │ Mail    │  │  └─────────────────────────────────────────────┘   │  │
│  │ Chat    │  │                                                     │  │
│  │         │  │  ┌─────────────────────────┐  ← SHEET (contextuel) │  │
│  │ ─────── │  │  │  Entity Details         │                       │  │
│  │ Admin   │  │  │  (superposé à droite)   │                       │  │
│  │ (si     │  │  │                         │                       │  │
│  │  admin) │  │  └─────────────────────────┘                       │  │
│  │         │  │                                                     │  │
│  └─────────┘  └─────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Command Bar (Recherche Omniprésente)

La Command Bar est accessible partout via `Cmd+K` (ou `Ctrl+K`). Elle permet :

- **Recherche universelle** : Fichiers, Users, Tasks, Events, Documents
- **Actions rapides** : "Créer tâche", "Nouveau document", "Inviter utilisateur"
- **Navigation** : "Aller à Storage", "Ouvrir paramètres"
- **Commandes admin** : "Suspendre user X", "Voir logs" (si admin)

```
┌──────────────────────────────────────────────────────────────┐
│  🔍 Rechercher ou taper une commande...              Cmd+K  │
├──────────────────────────────────────────────────────────────┤
│  RÉCENTS                                                     │
│  📄 rapport-q1.docx                              Document   │
│  👤 Alice Martin                                 Utilisateur │
│  ✅ Finaliser présentation                       Tâche      │
├──────────────────────────────────────────────────────────────┤
│  ACTIONS                                                     │
│  ➕ Créer un document                                        │
│  ➕ Créer une tâche                                          │
│  📤 Uploader un fichier                                      │
├──────────────────────────────────────────────────────────────┤
│  NAVIGATION                                                  │
│  📁 Storage                                                  │
│  📋 Tasks                                                    │
│  ⚙️ Paramètres                                               │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 Sheets Contextuels (Navigation Sans Perte de Contexte)

Les détails d'une entité s'ouvrent en **Sheet** (panneau glissant) plutôt qu'une nouvelle page :

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Liste des fichiers                                                     │
│  ┌────────────────────────────────────────────┬────────────────────────┐│
│  │  📄 rapport-q1.docx      12 Ko    Hier     │ ← SHEET OUVERT        ││
│  │  📄 budget-2026.xlsx     45 Ko    Lundi    │                        ││
│  │  📁 Projets/             -        Samedi   │  rapport-q1.docx       ││
│  │  📄 notes.md             3 Ko     Vendredi │  ────────────────────  ││
│  │                                            │                        ││
│  │  (liste continue visible)                  │  📊 Détails            ││
│  │                                            │  Taille: 12 Ko         ││
│  │                                            │  Modifié: Hier 14:32   ││
│  │                                            │  Propriétaire: Alice   ││
│  │                                            │                        ││
│  │                                            │  👥 Partagé avec       ││
│  │                                            │  @Bob @Carol           ││
│  │                                            │                        ││
│  │                                            │  [Télécharger] [Éditer]││
│  └────────────────────────────────────────────┴────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

**Avantages :**
- Le contexte parent reste visible
- Navigation fluide (pas de rechargement)
- Possibilité d'empiler plusieurs sheets
- Fermeture = retour immédiat (Escape ou clic extérieur)

---

## 2. Système de Blocs Universels (Entity-First Design)

### 2.1 Concept

Toutes les entités SignApps deviennent des **"blocs"** avec un comportement unifié :

| Propriété | Description |
|-----------|-------------|
| **Affichage** | Peut s'afficher en inline, card, row, preview, full |
| **Liaison** | Peut être lié à d'autres blocs (relations) |
| **Embarquement** | Peut être embarqué dans d'autres blocs |
| **Recherche** | Cherchable de manière uniforme |
| **Métadonnées** | Créé par, date, tags (standard) |
| **Actions** | Actions contextuelles selon permissions |

### 2.2 Types de Blocs

```typescript
type BlockType = 'user' | 'file' | 'folder' | 'task' | 'event' |
                 'document' | 'message' | 'comment' | 'group';

interface UniversalBlock {
  id: string;
  type: BlockType;
  title: string;
  subtitle?: string;
  icon: string;
  color?: string;
  metadata: {
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    tags: string[];
  };
  linkedBlocks: string[];
  permissions: Permission[];
}
```

### 2.3 Variantes d'Affichage

**Inline** (dans du texte) :
```
Le fichier @[File: rapport-q1.docx] a été partagé par @[User: Alice]
```

**Card** (grille) :
```
┌──────────────────┐
│  📄              │
│  rapport-q1.docx │
│  12 Ko • Hier    │
│  👤 Alice        │
└──────────────────┘
```

**Row** (liste) :
```
📄 rapport-q1.docx    12 Ko    Hier 14:32    Alice    [•••]
```

**Preview** (sheet compact) :
```
┌─────────────────────────┐
│ 📄 rapport-q1.docx      │
│ ────────────────────────│
│ [Aperçu du document]    │
│                         │
│ Taille: 12 Ko           │
│ Modifié: Hier           │
│ [Ouvrir] [Télécharger]  │
└─────────────────────────┘
```

### 2.4 Interconnexions

Un document peut embarquer d'autres blocs :

```markdown
# Rapport Q1 2026

## Équipe projet
@[User: Alice Martin]
@[User: Bob Dupont]

## Fichiers associés
@[File: budget-q1.xlsx]
@[File: présentation.pptx]

## Tâches liées
@[Task: Finaliser chiffres] ☐
@[Task: Valider avec direction] ☑

## Réunion de suivi
@[Event: Review Q1 - 20 mars 14h]
```

---

## 3. Composants Génériques

### 3.1 DataTable

Composant de liste universel utilisable pour toutes les entités.

**Features :**
- Colonnes configurables (ordre, visibilité, largeur)
- Tri multi-colonnes
- Filtres avancés (sauvegardables)
- Recherche inline
- Sélection multiple + bulk actions
- Row actions contextuelles
- Pagination / infinite scroll / virtual scroll
- Export (CSV, Excel, PDF)
- Vues multiples (table, cards, kanban, calendar)

**Configuration par contexte :**

```typescript
const configs = {
  'users': {
    columns: ['avatar', 'name', 'email', 'role', 'status', 'lastLogin'],
    actions: ['edit', 'suspend', 'delete'],
    bulkActions: ['suspend', 'delete', 'export'],
    filters: ['role', 'status', 'createdAt'],
    viewModes: ['table', 'cards'],
  },
  'files': {
    columns: ['icon', 'name', 'size', 'modified', 'owner'],
    actions: ['preview', 'download', 'share', 'delete'],
    filters: ['type', 'owner', 'size', 'modified'],
    viewModes: ['table', 'grid', 'details'],
  },
  'tasks': {
    columns: ['checkbox', 'title', 'assignee', 'dueDate', 'priority'],
    actions: ['complete', 'assign', 'delete'],
    groupBy: ['status', 'priority', 'assignee'],
    viewModes: ['table', 'kanban', 'calendar'],
  },
};
```

### 3.2 UniversalSheet

Panneau latéral pour afficher/éditer les détails d'une entité.

**Structure :**

```
┌─────────────────────────────────────┐
│  HEADER                             │
│  [←] Titre de l'entité    [Actions] │
├─────────────────────────────────────┤
│  TABS                               │
│  [Détails] [Activité] [Permissions] │
├─────────────────────────────────────┤
│                                     │
│  CONTENT (selon tab active)         │
│                                     │
│  - Formulaire dynamique             │
│  - Timeline d'activité              │
│  - Matrice de permissions           │
│  - Blocs liés                       │
│                                     │
├─────────────────────────────────────┤
│  FOOTER (actions)                   │
│  [Annuler]              [Enregistrer]│
└─────────────────────────────────────┘
```

### 3.3 DynamicForm

Formulaires générés depuis un schema JSON.

**Capabilities :**
- Champs standards (text, email, number, date, select, multiselect)
- Champs custom (file upload, rich text, color picker)
- Champs relationnels (entity picker avec recherche)
- Sections conditionnelles (selon rôle ou valeur)
- Validation intégrée (Zod)
- Mode view / edit / create

```typescript
const userFormSchema = {
  sections: [
    {
      id: 'personal',
      title: 'Informations personnelles',
      fields: [
        { name: 'firstName', type: 'text', required: true },
        { name: 'lastName', type: 'text', required: true },
        { name: 'email', type: 'email', required: true },
        { name: 'avatar', type: 'image' },
      ],
    },
    {
      id: 'role',
      title: 'Rôle et permissions',
      visibleTo: ['admin'],
      fields: [
        { name: 'role', type: 'select', options: 'roles' },
        { name: 'groups', type: 'entity-multi', entityType: 'group' },
      ],
    },
  ],
};
```

### 3.4 CustomizableDashboard

Dashboard avec widgets drag-and-drop.

**Widgets disponibles :**

| Widget | Description | Tailles |
|--------|-------------|---------|
| RecentFiles | Derniers fichiers modifiés | sm, md, lg |
| MyTasks | Tâches assignées | sm, md, lg |
| CalendarMini | Agenda compact | md, lg |
| QuickActions | Boutons d'actions rapides | sm, md |
| StorageUsage | Quota de stockage | sm |
| TeamActivity | Activité récente équipe | md, lg |
| SystemHealth | État du système (admin) | sm, md |
| UserStats | Statistiques users (admin) | md, lg |
| AuditLog | Journal d'audit (admin) | lg |

**Layout sauvegardé par utilisateur :**

```typescript
interface DashboardLayout {
  widgets: Array<{
    id: string;
    widgetType: string;
    position: { x: number; y: number };
    size: 'sm' | 'md' | 'lg';
    config?: Record<string, any>;
  }>;
}
```

### 3.5 ViewSelector & ViewBuilder

Système de vues personnalisées style Airtable.

**ViewSelector :**

```
┌─────────────────────────────────────────────┐
│  Vues                              [+ Créer]│
├─────────────────────────────────────────────┤
│  📋 Tous les fichiers (défaut)              │
│  📋 Mes fichiers récents ⭐                 │
│  📋 Partagés avec moi                       │
│  📋 Par type de document     (partagée 👥)  │
├─────────────────────────────────────────────┤
│  VUES ADMIN                                 │
│  🔒 Fichiers volumineux (imposée)           │
│  🔒 Audit de sécurité (imposée)             │
└─────────────────────────────────────────────┘
```

**ViewBuilder :**

```
┌─────────────────────────────────────────────┐
│  Créer une vue                              │
├─────────────────────────────────────────────┤
│  Nom: [Mes fichiers cette semaine    ]      │
│  Icône: 📋 ▼                                │
│                                             │
│  Type d'affichage:                          │
│  [Table ✓] [Kanban] [Calendrier] [Galerie]  │
│                                             │
│  ─────────────────────────────────────────  │
│  FILTRES                           [+ Ajouter│
│  ┌─────────────────────────────────────────┐│
│  │ Propriétaire = Moi                      ││
│  │ Modifié >= Début de semaine             ││
│  └─────────────────────────────────────────┘│
│                                             │
│  TRI                                        │
│  Modifié ▼ (décroissant)                    │
│                                             │
│  ─────────────────────────────────────────  │
│  ☐ Partager avec l'équipe                  │
│                                             │
│  [Annuler]                    [Sauvegarder] │
└─────────────────────────────────────────────┘
```

---

## 4. Système de Customisation

### 4.1 Hiérarchie de Configuration

```
┌─────────────────────────────────────────────────────────────┐
│  NIVEAU 1: SYSTEM DEFAULTS                                  │
│  Définis dans le code (entity configs, composants)          │
│  Non modifiables par utilisateurs                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  NIVEAU 2: TENANT CONFIG (Admin)                            │
│  • Branding (logo, couleurs)                                │
│  • Policies de customisation                                │
│  • Vues par défaut par rôle                                 │
│  • Vues imposées                                            │
│  • Features activées/désactivées                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  NIVEAU 3: USER PREFERENCES                                 │
│  • Thème (si autorisé)                                      │
│  • Layout personnel                                         │
│  • Vues custom (si autorisé)                                │
│  • Dashboard widgets                                        │
│  • Colonnes, tri, filtres par vue                           │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Policies de Customisation

L'admin contrôle ce que les utilisateurs peuvent personnaliser :

| Policy | Description | Default |
|--------|-------------|---------|
| `users_can_customize_theme` | Choix mode clair/sombre | true |
| `users_can_create_views` | Créer des vues personnalisées | true |
| `users_can_share_views` | Partager ses vues | true |
| `users_can_customize_dashboard` | Modifier widgets dashboard | true |
| `users_can_reorder_columns` | Réorganiser colonnes tables | true |
| `users_can_create_filters` | Créer des filtres sauvegardés | true |
| `users_can_export_data` | Exporter en CSV/Excel | true |
| `users_can_customize_shortcuts` | Raccourcis clavier custom | false |
| `max_custom_views_per_user` | Limite de vues (0=illimité) | 0 |
| `max_dashboard_widgets` | Limite de widgets | 12 |

### 4.3 Branding Tenant

```typescript
interface TenantBranding {
  name: string;           // "Acme Corp"
  logo_url: string;       // Logo header
  favicon_url: string;    // Favicon
  primary_color: string;  // #3b82f6
  secondary_color: string;
  accent_color: string;
  dark_mode_default: boolean;
  custom_css?: string;    // CSS additionnel (optionnel)
}
```

### 4.4 Vues Imposées vs Partagées

| Type | Créé par | Modifiable par user | Supprimable |
|------|----------|---------------------|-------------|
| **Système** | Code | Non | Non |
| **Admin (imposée)** | Admin | Non | Non |
| **Admin (partagée)** | Admin | Non (copie possible) | Non |
| **User (privée)** | User | Oui | Oui |
| **User (partagée)** | User | Créateur seulement | Créateur |

---

## 5. Interface Unifiée Admin/User

### 5.1 Principe

L'admin et l'utilisateur voient **exactement la même interface**. Seules les **permissions** déterminent :
- Ce qui est visible (menus, colonnes, boutons)
- Ce qui est actionnable (actions, modifications)

### 5.2 Exemples de Différences

**Menu Sidebar :**

| Module | User | Admin |
|--------|------|-------|
| Dashboard | ✅ | ✅ |
| Storage | ✅ | ✅ |
| Docs | ✅ | ✅ |
| Tasks | ✅ | ✅ |
| Calendar | ✅ | ✅ |
| **Administration** | ❌ | ✅ |
| → Users | ❌ | ✅ |
| → Groups | ❌ | ✅ |
| → Settings | ❌ | ✅ |
| → Audit Logs | ❌ | ✅ |

**DataTable Users (pour admin) :**

```
┌──────────────────────────────────────────────────────────────────────┐
│  Users                                         [+ Inviter] [Export] │
├──────────────────────────────────────────────────────────────────────┤
│  ☐  Avatar  Nom           Email              Rôle    Status  Actions│
│  ☐  👤      Alice Martin  alice@acme.com     Admin   Actif   [•••]  │
│  ☐  👤      Bob Dupont    bob@acme.com       User    Actif   [•••]  │
│  ☐  👤      Carol White   carol@acme.com     User    Suspendu[•••]  │
└──────────────────────────────────────────────────────────────────────┘

Menu Actions [•••] :
┌────────────────────┐
│ 👁️ Voir profil     │
│ ✏️ Modifier        │
│ 🔄 Réinitialiser   │  ← Actions admin
│ ⏸️ Suspendre       │
│ 🗑️ Supprimer       │
└────────────────────┘
```

**Sheet User (vue par l'admin) :**

```
┌─────────────────────────────────────┐
│  [←] Alice Martin            [•••]  │
├─────────────────────────────────────┤
│  [Profil] [Activité] [Permissions]  │  ← Tab "Permissions" visible admin
├─────────────────────────────────────┤
│                                     │
│  INFORMATIONS                       │
│  Email: alice@acme.com              │
│  Rôle: Admin                        │
│  Créé: 12 janvier 2026              │
│  Dernière connexion: Aujourd'hui    │
│                                     │
│  GROUPES                            │
│  • Direction                        │
│  • IT                               │
│                                     │
│  ACTIONS ADMIN                      │
│  [Réinitialiser mot de passe]       │
│  [Suspendre le compte]              │
│  [Générer rapport d'activité]       │
│                                     │
└─────────────────────────────────────┘
```

### 5.3 Gestion des Permissions dans les Composants

```typescript
// Chaque composant filtre selon les permissions
function DataTable({ entityType, data }) {
  const { permissions } = useCurrentUser();
  const config = useEntityConfig(entityType);

  // Filtrer les colonnes selon permissions
  const visibleColumns = config.columns.filter(col =>
    !col.requiredPermission || permissions.includes(col.requiredPermission)
  );

  // Filtrer les actions selon permissions
  const availableActions = config.actions.filter(action =>
    !action.requiredPermission || permissions.includes(action.requiredPermission)
  );

  return (
    <Table>
      {/* Render avec colonnes/actions filtrées */}
    </Table>
  );
}
```

---

## 6. Wireframes Détaillés

### 6.1 Dashboard Personnalisable

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Dashboard                                    [Personnaliser] [⟳ 5min] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────┐  ┌─────────────────────────┐              │
│  │ 📁 FICHIERS RÉCENTS     │  │ ✅ MES TÂCHES           │              │
│  │ ───────────────────     │  │ ───────────────────     │              │
│  │ 📄 rapport-q1.docx      │  │ ☐ Finaliser rapport     │              │
│  │ 📄 budget-2026.xlsx     │  │ ☐ Répondre à Alice      │              │
│  │ 📁 Projets/             │  │ ☑ Valider devis         │              │
│  │ [Voir tout →]           │  │ [Voir tout →]           │              │
│  └─────────────────────────┘  └─────────────────────────┘              │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 📅 CALENDRIER                                                    │   │
│  │ ─────────────────────────────────────────────────────────────── │   │
│  │  Lun    Mar    Mer    Jeu    Ven    Sam    Dim                  │   │
│  │  16     17     18     19     20     21     22                   │   │
│  │  ┌──┐                 ┌──────────┐                              │   │
│  │  │14h│                │ Review   │                              │   │
│  │  │Call│               │ Q1       │                              │   │
│  │  └──┘                 └──────────┘                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────┐  ┌─────────────────────────┐              │
│  │ 💾 STOCKAGE             │  │ ⚡ ACTIONS RAPIDES      │              │
│  │ ───────────────────     │  │ ───────────────────     │              │
│  │ ████████░░ 78%          │  │ [📄 Nouveau doc]        │              │
│  │ 7.8 Go / 10 Go          │  │ [📤 Uploader]           │              │
│  │                         │  │ [✅ Nouvelle tâche]     │              │
│  │ [Gérer →]               │  │ [📅 Nouvel événement]   │              │
│  └─────────────────────────┘  └─────────────────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Mode Personnalisation Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Dashboard (Mode édition)                [Ajouter widget] [Terminer]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐              │
│  │ ⋮⋮ FICHIERS RÉCENTS  ×│  │ ⋮⋮ MES TÂCHES        ×│  ← Draggable │
│  │ ───────────────────   │  │ ───────────────────   │              │
│  │ (contenu)             │  │ (contenu)             │              │
│  │                       │  │                       │              │
│  │            [S][M][L]  │  │            [S][M][L]  │  ← Resize    │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘              │
│                                                                         │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │
│  │ ⋮⋮ CALENDRIER                                                  × │   │
│  │ (contenu)                                                        │   │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  + Glissez un widget ici ou cliquez "Ajouter widget"            │   │
│  │    pour ajouter une nouvelle section                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.3 DataTable avec Customisation Colonnes

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Fichiers                    [Vue: Mes récents ▼]  [Filtres]  [⚙️]     │
├─────────────────────────────────────────────────────────────────────────┤
│  Rechercher...                                            [+ Uploader] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ☐  │ Nom           ↕│ Taille │ Modifié     │ Propriétaire │ Actions  │
│  ────────────────────────────────────────────────────────────────────  │
│  ☐  │ 📄 rapport    │ 12 Ko  │ Hier 14:32  │ 👤 Alice     │ [•••]    │
│  ☐  │ 📄 budget     │ 45 Ko  │ Lundi       │ 👤 Bob       │ [•••]    │
│  ☐  │ 📁 Projets/   │ -      │ Samedi      │ 👤 Alice     │ [•••]    │
│                                                                         │
│  [←] Page 1 / 5 [→]                                   20 résultats / 96│
└─────────────────────────────────────────────────────────────────────────┘

Clic sur [⚙️] ouvre :
┌────────────────────────────────────┐
│  Personnaliser les colonnes        │
├────────────────────────────────────┤
│  ☑ Nom                    [═══]   │ ← Drag pour réordonner
│  ☑ Taille                 [═══]   │
│  ☑ Modifié                [═══]   │
│  ☑ Propriétaire           [═══]   │
│  ☐ Type                   [═══]   │ ← Caché
│  ☐ Tags                   [═══]   │
│  ☐ Chemin                 [═══]   │
├────────────────────────────────────┤
│  [Réinitialiser]   [Appliquer]    │
└────────────────────────────────────┘
```

### 6.4 Admin Panel - Customization Settings

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Administration > Personnalisation                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  BRANDING                                                        │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │                                                                  │   │
│  │  Logo:     [📷 Changer]  Acme_logo.png                          │   │
│  │  Nom:      [Acme Corporation                    ]               │   │
│  │  Couleur:  [■ #3b82f6] Primaire  [■ #64748b] Secondaire        │   │
│  │  Mode:     ○ Clair par défaut  ● Sombre par défaut             │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  PERMISSIONS DE PERSONNALISATION                                 │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │                                                                  │   │
│  │  ☑ Les utilisateurs peuvent changer leur thème                 │   │
│  │  ☑ Les utilisateurs peuvent créer des vues                     │   │
│  │  ☑ Les utilisateurs peuvent partager leurs vues                │   │
│  │  ☑ Les utilisateurs peuvent personnaliser le dashboard         │   │
│  │  ☑ Les utilisateurs peuvent réorganiser les colonnes           │   │
│  │  ☑ Les utilisateurs peuvent exporter les données               │   │
│  │  ☐ Les utilisateurs peuvent personnaliser les raccourcis       │   │
│  │                                                                  │   │
│  │  Max vues personnalisées par utilisateur: [10    ] (0=illimité)│   │
│  │  Max widgets dashboard:                   [12    ]              │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  VUES PAR DÉFAUT                                                 │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │                                                                  │   │
│  │  Fichiers:                                                       │   │
│  │    • Admin → [Vue détaillée        ▼]                           │   │
│  │    • User  → [Vue simple           ▼]                           │   │
│  │                                                                  │   │
│  │  Utilisateurs:                                                   │   │
│  │    • Admin → [Vue complète         ▼]                           │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                                                    [Sauvegarder]        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Flux Utilisateur Clés

### 7.1 Créer une Vue Personnalisée

```
1. User ouvre /storage
2. Clique sur le sélecteur de vue "Tous les fichiers ▼"
3. Clique sur "+ Créer une vue"
4. Sheet ViewBuilder s'ouvre
5. User définit:
   - Nom: "Mes documents Word récents"
   - Type: Table
   - Filtres: Type = docx, Propriétaire = Moi, Modifié > 7 jours
   - Tri: Modifié décroissant
6. Clique "Sauvegarder"
7. Nouvelle vue apparaît dans le sélecteur
8. Préférences sync vers backend
```

### 7.2 Admin Impose une Vue

```
1. Admin ouvre /admin/customization/views
2. Clique "Créer vue imposée"
3. Définit:
   - Entité: Files
   - Nom: "Fichiers volumineux (audit)"
   - Filtres: Taille > 100Mo
   - Colonnes: Nom, Taille, Propriétaire, Dernière modification
   - Imposée: ☑ (users ne peuvent pas modifier)
   - Visible pour: Tous les rôles
4. Sauvegarde
5. Tous les users voient cette vue dans leur sélecteur (avec 🔒)
```

### 7.3 User Personnalise son Dashboard

```
1. User ouvre /dashboard
2. Clique "Personnaliser"
3. Mode édition s'active:
   - Widgets deviennent draggables
   - Bouton × apparaît pour supprimer
   - Boutons S/M/L pour resize
4. User drag "Fichiers récents" en haut à gauche
5. User clique "Ajouter widget"
6. Sheet s'ouvre avec widgets disponibles
7. User ajoute "Activité équipe"
8. User redimensionne en "L"
9. Clique "Terminer"
10. Layout sync vers backend
```

---

## 8. Considérations Techniques

### 8.1 State Management

```typescript
// Zustand stores
stores/
├── config-store.ts      // Tenant config, policies
├── preferences-store.ts // User preferences (synced)
├── views-store.ts       // Custom views
└── ui-store.ts          // UI state (modals, sheets, etc.)
```

### 8.2 API Endpoints

```
// Tenant Config
GET    /api/v1/tenant/config
PUT    /api/v1/tenant/config

// User Preferences
GET    /api/v1/users/me/preferences
PUT    /api/v1/users/me/preferences
PATCH  /api/v1/users/me/preferences/:key

// Custom Views
GET    /api/v1/views
POST   /api/v1/views
PUT    /api/v1/views/:id
DELETE /api/v1/views/:id

// Admin Views
GET    /api/v1/admin/views
POST   /api/v1/admin/views
PUT    /api/v1/admin/views/:id
DELETE /api/v1/admin/views/:id
```

### 8.3 Sync Strategy

1. **Initial Load**: Fetch tenant config + user preferences
2. **Updates**: Debounced sync (500ms) vers backend
3. **Offline**: Queue changes, sync on reconnect
4. **Conflicts**: Last-write-wins avec timestamp

### 8.4 Performance

- Virtual scrolling pour grandes listes
- Lazy loading des widgets dashboard
- Memoization des configs résolues
- Prefetch des vues fréquentes

---

## 9. Accessibilité

- Navigation clavier complète
- ARIA labels sur tous les composants interactifs
- Contraste minimum WCAG AA
- Focus visible distinct
- Screen reader support

---

## 10. Prochaines Étapes

1. **Validation** - Review avec stakeholders
2. **Prototypage** - Maquettes interactives (Figma)
3. **Epic Planning** - Découpage en stories
4. **Implémentation** - Sprints de développement
5. **Testing** - Tests utilisateurs et ajustements

---

*Document généré avec BMAD Method v6.0.4*
