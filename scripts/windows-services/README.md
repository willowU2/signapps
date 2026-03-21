# SignApps Windows Services

Scripts PowerShell pour installer et gérer les services SignApps comme services Windows.

## Prérequis

- Windows 10/11 ou Windows Server 2016+
- PowerShell 5.1 ou supérieur
- Droits administrateur
- PostgreSQL installé et configuré comme service Windows
- Binaires compilés en mode release (`cargo build --release`)

## Scripts disponibles

| Script | Description |
|--------|-------------|
| `install-all.ps1` | Installe tous les services SignApps |
| `uninstall-all.ps1` | Désinstalle tous les services |
| `start-all.ps1` | Démarre tous les services |
| `stop-all.ps1` | Arrête tous les services |
| `status.ps1` | Affiche l'état des services |
| `config.ps1` | Configuration des services (ne pas exécuter directement) |

## Installation

### 1. Compiler les binaires

```powershell
cd C:\Prog\signapps-platform
cargo build --release --workspace
```

### 2. Configurer l'environnement

Assurez-vous que le fichier `.env` à la racine du projet contient les variables nécessaires :

```env
DATABASE_URL=postgres://signapps:password@localhost:5432/signapps
JWT_SECRET=your_secret_here_at_least_32_characters
```

### 3. Installer les services

Ouvrez PowerShell en tant qu'administrateur :

```powershell
cd C:\Prog\signapps-platform\scripts\windows-services
.\install-all.ps1
```

Ou avec build automatique :

```powershell
.\install-all.ps1 -BuildFirst
```

### 4. Démarrer les services

```powershell
.\start-all.ps1
```

## Utilisation

### Vérifier l'état des services

```powershell
.\status.ps1
```

### Arrêter tous les services

```powershell
.\stop-all.ps1
```

### Arrêter de force (sans attendre l'arrêt gracieux)

```powershell
.\stop-all.ps1 -Force
```

### Désinstaller tous les services

```powershell
.\uninstall-all.ps1
```

## Frontend (Next.js)

Le frontend nécessite [NSSM (Non-Sucking Service Manager)](https://nssm.cc/) pour être installé comme service Windows.

1. Téléchargez NSSM depuis https://nssm.cc/download
2. Extrayez-le et ajoutez-le au PATH
3. Installez avec le flag `-IncludeFrontend` :

```powershell
.\install-all.ps1 -IncludeFrontend
.\start-all.ps1 -IncludeFrontend
```

## Dépendances entre services

Les services sont configurés avec des dépendances Windows :

```
PostgreSQL (externe)
    └── SignAppsIdentity (3001)
            ├── SignAppsContainers (3002)
            ├── SignAppsProxy (3003)
            ├── SignAppsStorage (3004)
            ├── SignAppsAI (3005)
            ├── SignAppsSecurelink (3006)
            ├── SignAppsScheduler (3007)
            ├── SignAppsMetrics (3008)
            ├── SignAppsMedia (3009)
            ├── SignAppsDocs (3010)
            ├── SignAppsCalendar (3011)
            └── ... (autres services)
                    └── SignAppsFrontend (3000)
```

## Récupération en cas d'échec

Les services sont configurés pour redémarrer automatiquement en cas d'échec :
- 1ère tentative : après 5 secondes
- 2ème tentative : après 10 secondes
- 3ème tentative : après 30 secondes
- Réinitialisation du compteur : après 24 heures

## Logs

Les logs sont écrits sur la sortie standard et peuvent être consultés via :
- L'observateur d'événements Windows (eventvwr.msc)
- Les fichiers de log dans `./data/logs/` (si configuré)

## Dépannage

### Le service ne démarre pas

1. Vérifiez que PostgreSQL est en cours d'exécution
2. Vérifiez le fichier `.env`
3. Consultez les logs dans l'observateur d'événements

### Erreur "Accès refusé"

Assurez-vous d'exécuter PowerShell en tant qu'administrateur.

### Le service SignAppsIdentity doit démarrer en premier

Les autres services dépendent de SignAppsIdentity. Si un service ne démarre pas, vérifiez que SignAppsIdentity est en cours d'exécution.
