# SignApps E2E Tests

Tests end-to-end avec Playwright pour le frontend SignApps.

## Installation

```bash
# Installer les dependances
npm install

# Installer les navigateurs Playwright
npx playwright install
```

## Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run test:e2e` | Executer tous les tests E2E |
| `npm run test:e2e:ui` | Ouvrir l'interface UI Playwright |
| `npm run test:e2e:headed` | Executer les tests avec navigateur visible |
| `npm run test:e2e:debug` | Mode debug avec breakpoints |
| `npm run test:e2e:chromium` | Executer uniquement sur Chromium |
| `npm run test:e2e:report` | Voir le rapport HTML des tests |

## Structure des tests

```
e2e/
  auth.setup.ts       # Setup d'authentification
  auth.spec.ts        # Tests de login/logout/protection routes
  containers.spec.ts  # Tests de la page containers
  storage.spec.ts     # Tests de la page storage
  navigation.spec.ts  # Tests de navigation sidebar/header
  fixtures.ts         # Fixtures et helpers communs
  global.setup.ts     # Setup global
```

## Configuration

Le fichier `playwright.config.ts` configure:
- Base URL: `http://localhost:3010`
- Navigateurs: Chromium, Firefox, WebKit
- Mobile: Pixel 5, iPhone 12
- Screenshots et videos sur echec
- Serveur de dev automatique

## Donnees de test

Les credentials de test sont definis dans `fixtures.ts`:
- Username: `admin`
- Password: `admin123`

Pour les tests en CI, utilisez des variables d'environnement.

## Execution

```bash
# Demarrer le serveur de dev (optionnel, Playwright le fait automatiquement)
npm run dev -- -p 3010

# Dans un autre terminal, lancer les tests
npm run test:e2e
```

## Debug

```bash
# Mode debug avec Playwright Inspector
npm run test:e2e:debug

# Executer un test specifique
npx playwright test auth.spec.ts

# Voir les traces d'un test echoue
npx playwright show-trace test-results/*/trace.zip
```
