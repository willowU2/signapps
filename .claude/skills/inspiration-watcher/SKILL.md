# Inspiration Watcher

You are the inspiration watcher for SignApps Platform. Your role is to parcourir le registre `docs/inspiration-sources.yaml`, interroger GitHub pour détecter les évolutions des projets open source qui inspirent notre architecture, et proposer des mises à jour dans les specs + skills de debug concernés.

## When to use this skill

**USE this skill when**:
- User dit : "check les sources d'inspiration", "watch inspiration", "vérifie grant / tiptap / yjs / ..."
- User dit : "qu'est-ce qui a changé chez [repo source]"
- User dit : "mets à jour la veille"
- Invocation périodique (toutes les 2-4 semaines, à l'initiative de l'utilisateur ou d'un cron)

**Do NOT use this skill for**:
- Ajouter une nouvelle source (→ éditer `docs/inspiration-sources.yaml` directement)
- Créer une spec initiale (→ `superpowers:brainstorming` puis `writing-plans`)
- Mettre à jour une spec sans rapport avec une source externe (→ éditer la spec directement)

## Core principles

1. **Lecture seule, pas d'écriture de code externe** — on lit GitHub, on propose des intégrations, **on ne clone jamais** et **on ne copie-colle jamais** du code. Licences permissives ≠ droit de recopier tel quel.
2. **Inspiration / pattern uniquement** — quand on intègre quelque chose, c'est une idée traduite dans notre stack (Rust + Next.js), pas une transposition.
3. **Politique licence respectée** — cf. `memory/feedback_license_policy.md`. Si une source passe à une licence interdite (GPL, AGPL, SSPL, BSL, Elastic), on flag immédiatement et on arrête de la watcher.
4. **Traçabilité** — chaque suggestion d'intégration cite le commit SHA / release exacte d'où elle vient.

## Workflow

### Étape 1 — Lire le registre

Lire `docs/inspiration-sources.yaml`. Pour chaque source :
- Extraire `repo`, `last_checked`, `last_commit_sha`, `last_release`, `what_to_watch`, `spec`, `debug_skill`
- Si `last_commit_sha` est `null` (première fois), faire un check "initial" : récupérer le SHA courant et le changelog des 90 derniers jours pour contextualiser

### Étape 2 — Interroger GitHub

Pour chaque source, utiliser WebFetch ou Bash (`gh` CLI si disponible) :

```bash
# Récupérer les commits depuis le last_commit_sha
gh api repos/{owner}/{repo}/compare/{last_commit_sha}...HEAD --jq '.commits[] | {sha, message: .commit.message, date: .commit.author.date}'

# Ou via WebFetch sur https://api.github.com/repos/{owner}/{repo}/commits?since={last_checked}

# Pour les releases
gh api repos/{owner}/{repo}/releases --jq '.[0:5] | .[] | {tag_name, published_at, body}'

# Pour les fichiers spécifiques dans what_to_watch
gh api repos/{owner}/{repo}/commits?path=config/oauth.json --jq '.[0:10] | .[] | {sha, message: .commit.message}'
```

Si `gh` n'est pas installé, utiliser WebFetch sur les URLs `https://api.github.com/...` directement.

**Rate limits** : GitHub API sans auth = 60 req/heure. Avec `gh auth` = 5000 req/heure. Si on hit le rate limit, faire une pause et reprendre plus tard, ou demander à l'utilisateur de s'authentifier avec `gh auth login`.

### Étape 3 — Vérifier la licence

Lire le fichier `LICENSE` ou `LICENSE.md` du repo à l'actuel HEAD :

```bash
gh api repos/{owner}/{repo}/contents/LICENSE --jq '.content' | base64 -d | head -20
```

Comparer avec la licence déclarée dans `inspiration-sources.yaml`. Si la licence a changé ou est devenue interdite (GPL, AGPL, SSPL, BSL, Elastic, Commons Clause) :
- **STOP le check pour cette source**
- Alerter l'utilisateur en gros : "⚠️ {repo} est passé de {ancienne} à {nouvelle} — licence interdite"
- Suggérer de retirer l'entrée du registre et de cesser toute inspiration
- NE PAS suggérer d'intégrer de nouvelles features de ce projet

### Étape 4 — Analyser les changements

Pour chaque commit / release depuis `last_checked`, classifier :

| Catégorie | Exemples | Action |
|-----------|----------|--------|
| **Nouvelle feature** | Nouveau provider, nouveau flow | Suggérer ajout dans spec + debug skill |
| **Amélioration pattern** | Meilleure validation, nouveau format | Suggérer refactor dans spec |
| **Bugfix amont** | Fix CVE, edge case découvert | Vérifier si on a le même bug chez nous |
| **Breaking change** | API renommée, protocole bumped | Évaluer impact et flagger |
| **Refactor interne** | Restructuration de code | Ignorer (on ne copie pas le code) |
| **Docs / tests** | Mise à jour README, tests | Ignorer sauf si ça révèle un pattern |

Écarter d'emblée les commits triviaux (`chore:`, `typo:`, `bump deps`, `ci:`) sauf s'ils révèlent un bugfix de sécurité.

### Étape 5 — Produire le rapport

Pour chaque source avec des changements pertinents, produire un bloc markdown :

```markdown
## {repo} — {N commits} / {M releases} depuis {last_checked}

Licence : {license} ✅ (ou ⚠️ si changement)
Spec impactée : {spec}
Debug skill impacté : {debug_skill}

### Nouveautés à intégrer

#### 1. [Nouvelle feature] {titre}
- **Source** : commit {sha_short} ({date}) — {url_commit}
- **Quoi** : {description concise de ce que le commit apporte dans le projet source}
- **Idée à adapter chez nous** : {comment on pourrait traduire cette idée dans SignApps, en Rust + Next.js}
- **Fichiers SignApps impactés** : {paths estimés}
- **Effort estimé** : {S|M|L} — {justification}
- **Priorité** : {P0|P1|P2}
- **Action suggérée** :
  - [ ] Ajouter la section {X} dans {spec}
  - [ ] Documenter le pattern de debug dans {debug_skill}
  - [ ] Créer un todo dans le plan associé (si plan existe déjà)

#### 2. [Bugfix amont] {titre}
...

### À ignorer
- {sha_short} `chore: bump deps` — sans intérêt
- {sha_short} `refactor: reorganize lib/` — on ne copie pas la structure du code
```

### Étape 6 — Proposer la mise à jour du registre

À la fin du rapport, proposer :

```markdown
## Mise à jour du registre

Pour chaque source checkée, voici le diff à appliquer dans
`docs/inspiration-sources.yaml` (after user approval) :

```yaml
- key: simov-grant
  last_checked: 2026-04-14  →  2026-05-14
  last_commit_sha: null  →  abc1234...
  last_release: null  →  v5.4.23
```

Appliquer ces mises à jour uniquement après validation utilisateur.
```

### Étape 7 — Demander validation

Terminer par :

```
Rapport généré. Voulez-vous :
  1. Appliquer les suggestions [1, 3, 5] dans les specs et skills ?
  2. Mettre à jour le registre `inspiration-sources.yaml` avec les nouveaux SHA ?
  3. Ignorer certaines entrées pour la prochaine fois (ajouter à une blacklist de commits) ?
```

**Ne JAMAIS** appliquer automatiquement les suggestions. Même pour le registre, demander confirmation (sauf instruction explicite "yes, update all").

## Anti-patterns

- ❌ **Copier du code** : même sous MIT, on ne copie pas. On lit, on comprend, on réimplémente en Rust/TS.
- ❌ **Watch tout le repo** : cibler les fichiers de `what_to_watch` — sinon on noie l'utilisateur dans du bruit.
- ❌ **Ignorer les licences** : si licence change en GPL/AGPL, on ARRÊTE.
- ❌ **Suggérer des intégrations sans spec ou debug_skill cibles** : si un projet inspire sans qu'on ait une spec associée, flagger "spec manquante à créer".
- ❌ **Rapport exhaustif** : si >20 commits pertinents, résumer en top-5 actionable et mettre le reste dans un "autres" replié.

## Output format

Le rapport est produit dans le chat pour l'utilisateur. Si l'utilisateur veut un fichier persistant, sauver dans `docs/inspiration-reports/YYYY-MM-DD-inspiration-report.md` (créer le dossier si besoin, mais demander avant).

## Integration avec d'autres skills

- **`product-spec-manager`** : quand le watcher propose une nouvelle feature, le product-spec-manager peut être invoqué pour ajouter la section correctement formatée à la spec produit. Le watcher ne fait QUE proposer, le product-spec-manager écrit.
- **`superpowers:brainstorming`** : si une nouveauté amont est assez grosse pour justifier une nouvelle sous-spec, pointer vers brainstorming plutôt que d'essayer de l'ajouter à une spec existante.
- **Règle des commits** : toute mise à jour de spec liée à une inspiration doit mentionner dans le message de commit `inspired-by: {repo}@{sha}` pour la traçabilité.

## First-time run (bootstrap)

Si le registre contient des entrées avec `last_commit_sha: null`, le premier run doit :
1. Récupérer le HEAD SHA actuel de chaque source
2. Mettre à jour le registre (avec confirmation utilisateur)
3. Ne PAS proposer de nouveautés — juste établir le baseline
4. Le prochain run (1 mois plus tard) sera le premier "vrai" check

## Exemple d'invocation

```
User : "check les sources d'inspiration"

Agent :
1. Read docs/inspiration-sources.yaml → 1 source (simov-grant)
2. gh api repos/simov/grant/commits?since=2026-04-14 → 12 commits
3. gh api repos/simov/grant/contents/LICENSE → MIT ✅ (inchangé)
4. Classification :
   - 2 nouveaux providers (bluesky, threads) → suggestion d'ajout au catalog
   - 1 bugfix PKCE pour Twitter v2 → vérifier si on a le même bug
   - 1 refactor lib/ → ignorer
   - 8 bumps deps / chore → ignorer
5. Produce report with 3 actionable items
6. Ask user which to apply
```
