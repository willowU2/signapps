# Fusion AD dans l'Org-Structure — Design Specification

**Date:** 2026-04-05
**Status:** Approved
**Scope:** Frontend — refactorer le DetailPanel de la page org-structure pour intégrer les onglets AD avec catégories dynamiques

---

## 1. Objectif

Fusionner l'administration Active Directory dans l'interface org-structure existante. Le DetailPanel (panneau droit) affiche des onglets organisés en 3 catégories visuelles, dont la visibilité dépend du `node_type` du noeud sélectionné. La configuration est personnalisable via le champ `schema JSONB` de `workforce_org_node_types`.

## 2. Décisions architecturales

| Décision | Choix |
|---|---|
| Approche | Onglets enrichis dans le DetailPanel existant (pas de nouvelles pages) |
| Organisation | 3 catégories visuelles avec séparateurs |
| Visibilité | Dynamique par node_type, personnalisable via schema JSONB |
| Stockage config | `workforce_org_node_types.schema.visible_tabs` (existant, pas de migration) |
| Pages AD standalone | Conservées pour l'administration globale/transversale |

## 3. Catégories d'onglets

### Organisation
- **Details** — Nom, code, description, type, config (existant)
- **Personnes** — Assignments de personnes au noeud (existant)
- **Gouvernance** — Board de gouvernance, décisionnaire (existant)

### Groupes & Politiques
- **Groupes** — Groupes cross-fonctionnels liés (existant)
- **Sites** — Sites géographiques assignés (existant)
- **Policies** — Politiques org (security, naming, compliance) (existant)
- **GPO** — Group Policy Objects AD liées à ce noeud (NOUVEAU)

### Infrastructure
- **Ordinateurs** — Machines jointes dans cette OU et descendantes (NOUVEAU)
- **Kerberos** — Principals et clés liés à ce noeud (NOUVEAU)
- **DNS** — Records DNS associés (NOUVEAU)
- **Audit** — Historique des modifications (existant)

## 4. Mapping par défaut : type de noeud → onglets visibles

| Onglet | group | subsidiary | bu | department | service | team | position | computer |
|---|---|---|---|---|---|---|---|---|
| Details | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Personnes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Gouvernance | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| Groupes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Sites | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| Policies | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| GPO | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Ordinateurs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Kerberos | ✅ | ✅ | — | — | — | — | — | ✅ |
| DNS | ✅ | — | — | — | — | — | — | ✅ |
| Audit | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## 5. Personnalisation via schema JSONB

Le champ `workforce_org_node_types.schema` (existant) accepte une clé `visible_tabs` :

```json
{
  "board": { "required": true, "min_members": 1 },
  "visible_tabs": {
    "organisation": ["details", "people", "governance"],
    "groupes_politiques": ["groups", "sites", "policies", "gpo"],
    "infrastructure": ["computers", "kerberos", "dns", "audit"]
  }
}
```

- Si `visible_tabs` est absent → mapping par défaut du code frontend
- Si `visible_tabs` est présent → override complet pour ce type
- Personnalisable par un admin via la page de gestion des types de noeuds

## 6. UX du TabsList catégorisé

### Layout visuel

```
Organisation              │  Groupes & Politiques       │  Infrastructure
────────────────────────  │  ─────────────────────────  │  ──────────────────────
[Details] [Personnes]     │  [Groupes] [Sites] [GPO]    │  [PC] [Kerberos] [Audit]
  [Gouvernance]           │    [Policies]               │    [DNS]
```

### Styles CSS

- Label de catégorie : `text-[10px] text-muted-foreground uppercase tracking-wider mb-1`
- Séparateur entre catégories : `border-r border-border/30 pr-3 mr-3`
- Onglets masqués : non rendus (pas de `display:none`, pas de `disabled`)
- Onglet actif par défaut : premier onglet visible (toujours "Details")
- Les catégories vides (aucun onglet visible) sont masquées entièrement

### Responsive

- Desktop (>1024px) : catégories en ligne avec séparateurs
- Tablette (768-1024px) : catégories empilées verticalement, labels visibles
- Mobile (<768px) : dropdown/select pour choisir l'onglet (trop d'onglets pour des tabs)

## 7. Nouveaux composants d'onglet

### ComputersTab

- Table : Nom, DNS Hostname, OS, Dernière connexion, Créé le
- Source : `workforce_org_nodes WHERE node_type='computer'` dans le sous-arbre (closure table)
- Lien vers la fiche computer (ouvre le DetailPanel avec le noeud computer sélectionné)
- Actions : Reset password, Supprimer
- Vide : "Aucun ordinateur joint dans cette OU"

### GpoTab

- Table : Nom GPO, Version, Machine/User enabled, Statut
- Source : `workforce_org_policies WHERE domain='governance'` liées à ce noeud + héritées
- Indicateur "Hérité de [parent]" vs "Propre"
- Même pattern que GovernanceTab existant (héritage via parent chain)

### KerberosTab

- Table : Principal, Type, Enc Type, Version (kvno), Créé le
- Source : `ad_principal_keys` filtrés par entity_id (pour computers) ou par domain (pour racine)
- Bouton "Rotation des clés"
- Pour noeud racine : affiche krbtgt avec avertissement

### DnsTab

- Table : Nom, Type, Données, TTL, Statique/Dynamique
- Source : `ad_dns_records` filtrés par zone du domaine
- Pour noeud racine : tous les records de la zone
- Pour computer : seulement les records A/PTR de cette machine
- Bouton "Ajouter un record"

## 8. Fichiers impactés

| Fichier | Modification |
|---|---|
| `client/src/app/admin/org-structure/page.tsx` | Refactorer TabsList du DetailPanel : catégories + visibilité dynamique |
| `client/src/app/admin/org-structure/page.tsx` | Ajouter ComputersTab, GpoTab, KerberosTab, DnsTab |
| `client/src/types/org.ts` | Ajouter type `VisibleTabs` dans OrgNodeType schema |
| Aucune migration | Le champ schema JSONB existe déjà |
| Aucune nouvelle page | Tout dans le DetailPanel existant |

## 9. Données AD disponibles

Les hooks React Query existent déjà dans `client/src/hooks/use-active-directory.ts` :
- `useAdComputers(domainId)` → liste des machines
- `useAdGpos(domainId)` → liste des GPO
- `useAdKeys(domainId)` → principals et clés
- `useAdDnsRecords(zoneId)` → records DNS

L'API client existe dans `client/src/lib/api/active-directory.ts`.

## 10. Coexistence avec les pages AD standalone

Les pages `/admin/active-directory/*` restent pour :
- Dashboard global du DC (status, tous les domaines)
- Administration DNS transversale (toutes les zones)
- Kerberos global (tous les principals)
- GPO global (toutes les politiques)

L'org-structure montre les données **contextuelles** (scoped au noeud sélectionné).
Les pages AD montrent les données **globales** (tous les objets du domaine).
