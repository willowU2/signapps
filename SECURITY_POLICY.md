# Politique de sécurité — SignApps Platform

> **CONFIDENTIEL** — Ce document est réservé à l'usage interne exclusif de l'équipe SignApps.
> Ne pas distribuer, publier ni partager hors des canaux internes sécurisés.

---

## 1. Politique de sécurité interne

Ce document définit les procédures et responsabilités en matière de sécurité applicative pour le projet SignApps Platform. Il couvre la détection des vulnérabilités, la gestion des secrets, les dépendances autorisées et les processus de réponse aux incidents.

**Champ d'application** : L'intégralité du code source, des dépendances, des services déployés et des données traitées par SignApps Platform.

**Responsable** : Le responsable sécurité désigné est le point de contact principal pour tout incident ou question liée à ce document.

---

## 2. Outils de détection

### 2.1 cargo audit — Vulnérabilités CVE

```bash
cargo audit
# ou via just :
just audit
```

`cargo audit` analyse le fichier `Cargo.lock` et le compare à la base [RustSec Advisory Database](https://rustsec.org/). Il détecte :

- Les crates avec des CVE connus
- Les crates dépréciées pour raisons de sécurité
- Les crates présentant des problèmes de soundness

**Intégration CI** : `cargo audit` s'exécute à chaque push sur `main` et `develop`. Un avis non résolu bloque le pipeline.

### 2.2 cargo deny check — Licences et dépendances

```bash
cargo deny check
# ou via just :
just deny
```

`cargo deny` applique les règles définies dans `deny.toml` :

- **Licences** : Seules les licences listées dans `deny.toml` sont autorisées (MIT, Apache-2.0, BSD-2/3-Clause, ISC, Unicode-DFS-2016)
- **Vulnérabilités** : Duplique et complète les vérifications de `cargo audit`
- **Doublons** : Détecte les dépendances en plusieurs versions (maintenance)
- **Sources** : Seules les sources autorisées (crates.io, dépôts internes) sont acceptées

### 2.3 Pre-commit hook — Détection de secrets

Un hook pre-commit est configuré dans `.git/hooks/pre-commit` pour bloquer les commits contenant :

- Des clés API en clair (patterns : `sk-`, `AKIA`, `AIza`, etc.)
- Des chaînes ressemblant à des JWT (`eyJ...`)
- Des mots de passe en dur dans le code (patterns configurables)
- Des fichiers `.env` accidentellement stagés

Pour installer le hook manuellement :

```bash
just install-hooks
```

---

## 3. Procédure de réponse aux vulnérabilités

### Étape 1 — Détection

La détection peut être :

- **Automatique** : Le pipeline CI (`cargo audit`, `cargo deny`) identifie un nouvel avis
- **Manuelle** : Un membre de l'équipe exécute `just audit` ou consulte la base RustSec
- **Externe** : Signalement interne d'un comportement suspect ou d'une anomalie

Dès la détection, ouvrir un ticket interne (label `security`) avec :
- Le nom de la crate affectée et sa version
- Le numéro d'avis RustSec ou CVE
- Les services SignApps potentiellement impactés

### Étape 2 — Évaluation

Évaluer l'impact réel sur SignApps Platform :

1. **Score CVSS** : Consulter le score fourni par l'avis RustSec ou NVD
2. **Surface d'attaque** : La crate vulnérable est-elle exposée à des entrées non fiables ?
3. **Services impactés** : Quels microservices utilisent cette dépendance ?
4. **Exploitabilité** : La vulnérabilité est-elle exploitable dans notre contexte d'utilisation ?
5. **Disponibilité d'un correctif** : Une version patchée de la crate est-elle disponible ?

### Étape 3 — Correction

Selon l'évaluation :

**Option A — Mise à jour de la dépendance (préférée) :**
```bash
cargo update -p <nom-crate>
# Vérifier que les tests passent toujours
just test
```

**Option B — Patch local (si pas de version corrigée) :**
- Utiliser `[patch.crates-io]` dans `Cargo.toml` pour pointer vers un fork interne patché
- Documenter le patch dans `PATCHES.md` avec le numéro d'avis et la date prévue de suppression

**Option C — Suppression de la dépendance :**
- Si la crate n'est plus maintenue ou si le risque est trop élevé
- Identifier une alternative ou implémenter la fonctionnalité en interne

### Étape 4 — Validation

```bash
# Validation complète obligatoire avant merge
just ci
# Inclut : fmt check + clippy -D warnings + nextest + audit + deny
```

La correction doit faire l'objet d'une pull request dédiée avec :
- Description de la vulnérabilité corrigée
- Référence à l'avis RustSec/CVE
- Revue obligatoire par le responsable sécurité

### Étape 5 — Déploiement

- Merger la PR de correction sur `main` après validation
- Créer un tag de release interne si la sévérité est Haute ou Critique
- Mettre à jour le registre interne des incidents de sécurité
- Pour les sévérités Critique et Haute, notifier l'ensemble de l'équipe via le canal sécurité interne

---

## 4. Matrice de sévérité

| Sévérité | Score CVSS | Délai de correction | Action requise |
|---|---|---|---|
| **Critique** | 9.0 – 10.0 | **24 heures** | Hotfix immédiat sur `main`, notification équipe complète, déploiement d'urgence |
| **Haute** | 7.0 – 8.9 | **72 heures** | Priorité absolue au sprint en cours, PR dédiée, revue sécurité obligatoire |
| **Moyenne** | 4.0 – 6.9 | **2 semaines** | Planifié dans le prochain sprint, traité comme une tâche prioritaire |
| **Basse** | 0.1 – 3.9 | **Prochain cycle** | Ajouté au backlog sécurité, traité lors de la maintenance régulière |

**Note** : Ces délais s'entendent à partir de la date de détection confirmée. Un contexte d'exploitation active d'une vulnérabilité peut justifier de reclasser la sévérité à la hausse.

---

## 5. Gestion des secrets

### Règle fondamentale

**Aucun secret ne doit jamais apparaître dans le dépôt Git.** Cette règle est absolue et sans exception.

### Variables d'environnement

Tous les secrets sont gérés via des variables d'environnement :

```bash
# .env — gitignored, jamais commité
DATABASE_URL=postgres://...
JWT_SECRET=<32+ chars aléatoires>
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...
```

Le fichier `.env` est listé dans `.gitignore`. Le hook pre-commit bloque tout commit accidentel de ce fichier.

### Rotation des secrets

| Secret | Fréquence de rotation recommandée |
|---|---|
| `JWT_SECRET` | Tous les 90 jours (ou immédiatement si compromis) |
| Clés API cloud (OpenAI, Anthropic, etc.) | Tous les 180 jours |
| Credentials PostgreSQL | Tous les 90 jours |
| Certificats TLS | Automatique via ACME (Let's Encrypt) |
| Tokens d'accès internes | Tous les 30 jours |

### En cas de fuite suspectée

1. Révoquer **immédiatement** le secret concerné (invalidation côté fournisseur)
2. Générer un nouveau secret et mettre à jour les configurations
3. Analyser les logs d'accès pour détecter une utilisation malveillante
4. Signaler l'incident au responsable sécurité
5. Documenter l'incident dans le registre interne

---

## 6. Dépendances autorisées

Les licences acceptées sont définies dans `deny.toml` :

```toml
[licenses]
allow = [
    "MIT",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "ISC",
    "Unicode-DFS-2016",
    "CC0-1.0",
    "OpenSSL",
]
```

**Licences interdites** : GPL, LGPL, AGPL, SSPL, Commons Clause, et toute licence imposant la divulgation du code source.

Toute dépendance avec une licence non listée doit être soumise à validation par le responsable sécurité avant intégration.

---

## 7. Audit périodique

### Fréquences recommandées

| Activité | Fréquence | Responsable |
|---|---|---|
| `cargo audit` automatique (CI) | À chaque push | Pipeline CI |
| `cargo deny check` automatique (CI) | À chaque push | Pipeline CI |
| Revue manuelle complète des dépendances | Mensuelle | Responsable sécurité |
| Audit de sécurité applicative | Trimestrielle | Équipe sécurité |
| Test de pénétration interne | Semestrielle | Équipe sécurité |
| Revue des accès et permissions | Mensuelle | Responsable sécurité |
| Rotation préventive des secrets critiques | Trimestrielle | DevOps / Ops |

### Registre des audits

Chaque audit manuel doit être consigné dans le registre interne avec :
- Date de l'audit
- Périmètre couvert
- Résultats (avis trouvés, avis ignorés avec justification)
- Actions prises

---

## 8. Interdictions

Les actions suivantes sont **strictement interdites** pour ce projet :

| Interdiction | Raison |
|---|---|
| Publication sur **GitHub Pages** | Exposition publique de code ou documentation confidentielle |
| Publication sur **crates.io** | Divulgation de bibliothèques internes |
| Publication sur **npm** | Divulgation de modules frontend internes |
| Publication sur **Docker Hub public** | Exposition d'images contenant du code ou des configurations propriétaires |
| Soumission de code à des **LLMs tiers** sans validation | Risque de fuite de propriété intellectuelle |
| Utilisation de **dépôts Git publics** comme miroirs | Exposition du code source |
| Partage de **dumps de base de données** hors environnement sécurisé | Fuite de données utilisateurs |
| Débogage avec des **clés de production** en local | Risque d'exposition ou de corruption de données réelles |

Toute violation de ces règles doit être signalée immédiatement au responsable sécurité et peut entraîner des mesures disciplinaires.

---

*Document maintenu par l'équipe sécurité — dernière mise à jour : 2026-03*
*Référence interne : SEC-POL-001*
