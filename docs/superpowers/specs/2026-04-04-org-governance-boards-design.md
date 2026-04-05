# Org Governance Boards — Design Specification

**Date:** 2026-04-04
**Status:** Approved
**Scope:** Backend (signapps-workforce) + Frontend (org-structure page) + Migration SQL

---

## 1. Objectif

Chaque noeud organisationnel peut avoir un **board de gouvernance** : un ensemble de personnes responsables de ce noeud. Le board a exactement un **décisionnaire final** (obligatoire sur le noeud racine) et des membres avec des rôles configurables. Si un noeud n'a pas de board, il hérite de celui de son parent.

## 2. Modele de données

### Table `workforce_org_boards`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | UUID | PK |
| node_id | UUID | NOT NULL, FK org_nodes, UNIQUE |
| is_inherited | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

Un board par noeud maximum (UNIQUE sur node_id). `is_inherited` est calculé côté lecture — si le noeud n'a pas de board row, il hérite.

### Table `workforce_org_board_members`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | UUID | PK |
| board_id | UUID | NOT NULL, FK boards ON DELETE CASCADE |
| person_id | UUID | NOT NULL |
| role | TEXT | NOT NULL (ex: president, vice_president, member, treasurer, secretary, dpo, cfo, cto...) |
| is_decision_maker | BOOLEAN | DEFAULT false |
| sort_order | INT | DEFAULT 0 |
| start_date | DATE | |
| end_date | DATE | |
| created_at | TIMESTAMPTZ | DEFAULT now() |

**Contrainte** : exactement un `is_decision_maker = true` par board (enforced par trigger ou applicatif).

### Règles de composition via GPO + org_node_types

**org_node_types.schema** (defaults par type) :
```json
{
  "board": {
    "required": true,
    "min_members": 1,
    "required_roles": ["president"],
    "optional_roles": ["vice_president", "treasurer", "secretary"]
  }
}
```

**GPO domain `governance`** (override par scope) :
```json
{
  "governance.board_required": true,
  "governance.min_members": 3,
  "governance.required_roles": ["president", "cfo"],
  "governance.optional_roles": ["dpo", "cto", "secretary"],
  "governance.max_members": 15
}
```

### Resolution du board effectif d'un noeud

```
get_effective_board(node_id):
  1. Si le noeud a un board propre → retourner ce board
  2. Sinon, remonter les parents (via parent_id) jusqu'a trouver un board
  3. Retourner le board trouvé + marquer is_inherited = true
  4. Si aucun board trouvé → erreur (ne devrait pas arriver si racine a un board)
```

### Enforcement des règles

A la création/modification d'un noeud racine : un board avec au moins un décisionnaire est obligatoire.
A la création d'un board : valider contre les règles du node_type + GPO governance.

## 3. Allowed children (types hiérarchiques)

Enrichir le seed `org_node_types` avec `allowed_children` :
- group → [subsidiary, bu, department]
- subsidiary → [bu, department, service]
- bu → [department, service, team]
- department → [service, team, position]
- service → [team, position]
- team → [position]
- position → []

Enforced à la création de noeud : le backend refuse si le type enfant n'est pas dans `allowed_children` du parent.

## 4. Endpoints API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/workforce/org/nodes/:id/board` | Board du noeud (propre ou hérité) |
| POST | `/workforce/org/nodes/:id/board` | Créer le board du noeud |
| PUT | `/workforce/org/nodes/:id/board` | Modifier le board |
| DELETE | `/workforce/org/nodes/:id/board` | Supprimer le board (revient à hériter) |
| POST | `/workforce/org/nodes/:id/board/members` | Ajouter un membre |
| PUT | `/workforce/org/nodes/:id/board/members/:member_id` | Modifier un membre |
| DELETE | `/workforce/org/nodes/:id/board/members/:member_id` | Retirer un membre |
| GET | `/workforce/org/nodes/:id/effective-board` | Board résolu (avec héritage) |

## 5. UI

### Dans le DetailPanel — nouvel onglet "Gouvernance"

- Affiche le board actuel (propre ou hérité, avec indication)
- Liste les membres avec rôle, badge "Décisionnaire" sur le decision maker
- Boutons : Ajouter membre, Modifier rôle, Retirer
- Si hérité : message "Hérité de [nom du parent]" + bouton "Définir un board propre"

### Dans le dialog de création d'arbre (noeud racine)

- Étape obligatoire : sélectionner au moins une personne comme décisionnaire (Directeur Général)
- Le bouton "Créer" est disabled tant qu'aucun décisionnaire n'est sélectionné

### Dans le dialog d'ajout de noeud

- Optionnel : définir un board pour ce noeud
- Sinon il hérite du parent (indication visuelle)

### Dans l'arbre visuel

- Petit avatar du décisionnaire affiché à côté du nom du noeud
- Icône différente si board propre vs hérité
