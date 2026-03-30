# Référence API — SignApps Platform

> Documentation interne des endpoints REST — dernière mise à jour : 2026-03-30

---

## 1. Convention générale

Tous les endpoints sont sous le préfixe `/api/v1/`. Les réponses sont en JSON (`Content-Type: application/json`).

### Authentification

```
Authorization: Bearer <jwt_token>
```

Les routes publiques (login, register, health) ne requièrent pas de token.

### Headers courants

| Header | Description |
|--------|-------------|
| `Authorization: Bearer <token>` | JWT d'authentification |
| `Content-Type: application/json` | Pour les requêtes avec body |
| `x-request-id` | ID de requête pour le tracing (auto-généré si absent) |
| `x-workspace-id` | ID workspace pour le mode multi-tenant |

---

## 2. Authentification (signapps-identity — port 3001)

### Authentification de base

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| POST | `/api/v1/auth/register` | Créer un compte utilisateur | Non |
| POST | `/api/v1/auth/login` | Se connecter, obtenir access + refresh token | Non |
| POST | `/api/v1/auth/refresh` | Renouveler l'access token via refresh token | Non |
| POST | `/api/v1/auth/logout` | Révoquer la session courante | Oui |
| GET | `/api/v1/auth/me` | Obtenir le profil de l'utilisateur connecté | Oui |
| POST | `/api/v1/bootstrap` | Créer le premier compte admin (one-shot) | Non |

### MFA

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| POST | `/api/v1/auth/mfa/setup` | Initialiser le TOTP (retourne QR code) | Oui |
| POST | `/api/v1/auth/mfa/verify` | Valider le TOTP et activer le MFA | Oui |
| POST | `/api/v1/auth/mfa/disable` | Désactiver le MFA | Oui |
| GET | `/api/v1/auth/mfa/status` | Statut MFA de l'utilisateur | Oui |

### Sessions et API Keys

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/auth/sessions` | Lister les sessions actives | Oui |
| DELETE | `/api/v1/auth/sessions` | Révoquer toutes les sessions | Oui |
| DELETE | `/api/v1/auth/sessions/:id` | Révoquer une session spécifique | Oui |
| GET | `/api/v1/api-keys` | Lister les API keys | Oui |
| POST | `/api/v1/api-keys` | Créer une API key | Oui |
| PATCH | `/api/v1/api-keys/:id` | Modifier une API key | Oui |
| DELETE | `/api/v1/api-keys/:id` | Révoquer une API key | Oui |

### Utilisateurs et profils

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/users/me` | Profil utilisateur complet | Oui |
| PUT | `/api/v1/users/me` | Mettre à jour le profil | Oui |
| GET | `/api/v1/users/me/profile` | Profil étendu (streak, historique) | Oui |
| PATCH | `/api/v1/users/me/profile` | Mettre à jour le profil étendu | Oui |
| GET | `/api/v1/users/me/preferences` | Préférences utilisateur | Oui |
| PATCH | `/api/v1/users/me/preferences/:section` | Modifier une section de préférences | Oui |
| POST | `/api/v1/users/me/preferences/sync` | Synchroniser les préférences | Oui |
| GET | `/api/v1/users/me/history` | Historique de navigation | Oui |
| POST | `/api/v1/users/me/history` | Ajouter une entrée d'historique | Oui |
| GET | `/api/v1/users/me/recent-docs` | Documents récents | Oui |
| POST | `/api/v1/users/me/streak/checkin` | Check-in quotidien | Oui |

---

## 3. Calendrier unifié (signapps-calendar — port 3011)

### Calendriers

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/calendars` | Lister les calendriers de l'utilisateur | Oui |
| POST | `/api/v1/calendars` | Créer un calendrier | Oui |
| GET | `/api/v1/calendars/:id` | Obtenir un calendrier | Oui |
| PUT | `/api/v1/calendars/:id` | Mettre à jour un calendrier | Oui |
| DELETE | `/api/v1/calendars/:id` | Supprimer un calendrier | Oui |
| GET | `/api/v1/calendars/:id/members` | Membres du calendrier | Oui |
| POST | `/api/v1/calendars/:id/members` | Ajouter un membre | Oui |
| PUT | `/api/v1/calendars/:id/members/:user_id` | Modifier le rôle d'un membre | Oui |
| DELETE | `/api/v1/calendars/:id/members/:user_id` | Retirer un membre | Oui |

### Événements

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/calendars/:calendar_id/events` | Lister les événements (fenêtre temporelle) | Oui |
| POST | `/api/v1/calendars/:calendar_id/events` | Créer un événement | Oui |
| GET | `/api/v1/events/:id` | Obtenir un événement | Oui |
| PUT | `/api/v1/events/:id` | Mettre à jour un événement | Oui |
| DELETE | `/api/v1/events/:id` | Supprimer un événement | Oui |
| POST | `/api/v1/events/:event_id/attendees` | Ajouter un participant | Oui |
| GET | `/api/v1/events/:event_id/attendees` | Lister les participants | Oui |
| PUT | `/api/v1/attendees/:attendee_id/rsvp` | Mettre à jour le RSVP | Oui |
| DELETE | `/api/v1/attendees/:attendee_id` | Retirer un participant | Oui |
| GET | `/api/v1/events/:event_id/instances` | Instances d'un événement récurrent | Oui |
| POST | `/api/v1/events/:event_id/exceptions` | Créer une exception récurrence | Oui |

### Tâches

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/calendars/:calendar_id/tasks` | Lister les tâches racines | Oui |
| POST | `/api/v1/calendars/:calendar_id/tasks` | Créer une tâche | Oui |
| GET | `/api/v1/calendars/:calendar_id/tasks/tree` | Arbre de tâches complet | Oui |
| GET | `/api/v1/tasks/:id` | Obtenir une tâche | Oui |
| PUT | `/api/v1/tasks/:id` | Mettre à jour une tâche | Oui |
| PUT | `/api/v1/tasks/:id/move` | Déplacer une tâche | Oui |
| POST | `/api/v1/tasks/:id/complete` | Marquer une tâche terminée | Oui |
| DELETE | `/api/v1/tasks/:id` | Supprimer une tâche | Oui |
| GET | `/api/v1/tasks/:task_id/children` | Sous-tâches | Oui |

### Ressources

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/resources` | Lister les ressources (salles, équipements) | Oui |
| POST | `/api/v1/resources` | Créer une ressource | Oui |
| GET | `/api/v1/resources/:id` | Obtenir une ressource | Oui |
| PUT | `/api/v1/resources/:id` | Mettre à jour une ressource | Oui |
| DELETE | `/api/v1/resources/:id` | Supprimer une ressource | Oui |
| GET | `/api/v1/resources/type/:resource_type` | Filtrer par type | Oui |
| POST | `/api/v1/resources/availability` | Vérifier la disponibilité | Oui |
| POST | `/api/v1/resources/:resource_id/book` | Réserver une ressource | Oui |

### Congés (Leave)

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| PUT | `/api/v1/events/:id/approve` | Approuver une demande de congé | Oui |
| PUT | `/api/v1/events/:id/reject` | Rejeter une demande de congé | Oui |
| GET | `/api/v1/leave/balances` | Soldes de congés de l'utilisateur | Oui |
| GET | `/api/v1/leave/balances/predict` | Solde prévisible après N jours | Oui |
| GET | `/api/v1/leave/team-conflicts` | Conflits d'équipe sur une période | Oui |
| POST | `/api/v1/leave/delegate` | Déléguer des tâches pendant un congé | Oui |

### Présence RH

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/presence/rules` | Lister les règles de présence | Oui |
| POST | `/api/v1/presence/rules` | Créer une règle de présence | Oui |
| PUT | `/api/v1/presence/rules/:id` | Mettre à jour une règle | Oui |
| DELETE | `/api/v1/presence/rules/:id` | Supprimer une règle | Oui |
| POST | `/api/v1/presence/validate` | Valider une action vs les règles | Oui |
| GET | `/api/v1/presence/team-status` | Statut de présence de l'équipe | Oui |
| GET | `/api/v1/presence/headcount` | Effectif présent par créneau | Oui |

### Catégories personnalisées

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/categories` | Lister les catégories | Oui |
| POST | `/api/v1/categories` | Créer une catégorie | Oui |
| PUT | `/api/v1/categories/:id` | Mettre à jour une catégorie | Oui |
| DELETE | `/api/v1/categories/:id` | Supprimer une catégorie | Oui |

### Fiches d'heures (Timesheets)

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/timesheets` | Lister les entrées de la semaine | Oui |
| PUT | `/api/v1/timesheets/:id` | Modifier une entrée | Oui |
| POST | `/api/v1/timesheets/validate` | Valider une semaine | Oui |
| POST | `/api/v1/timesheets/export` | Exporter les fiches d'heures | Oui |
| POST | `/api/v1/timesheets/generate` | Générer depuis les événements | Oui |

### Layers et configuration

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/layers/config` | Obtenir la config des layers de l'utilisateur | Oui |
| PUT | `/api/v1/layers/config` | Sauvegarder la config des layers | Oui |

### Workflows d'approbation

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/approval-workflows` | Lister les workflows | Oui |
| POST | `/api/v1/approval-workflows` | Créer un workflow | Oui |
| PUT | `/api/v1/approval-workflows/:id` | Modifier un workflow | Oui |
| DELETE | `/api/v1/approval-workflows/:id` | Supprimer un workflow | Oui |

### CRON Jobs

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/cron-jobs` | Lister les CRON jobs | Oui |
| POST | `/api/v1/cron-jobs` | Créer un CRON job | Oui |
| PUT | `/api/v1/cron-jobs/:id` | Mettre à jour un CRON job | Oui |
| DELETE | `/api/v1/cron-jobs/:id` | Supprimer un CRON job | Oui |
| POST | `/api/v1/cron-jobs/:id/run` | Exécuter un CRON job immédiatement | Oui |

---

## 4. Stockage (signapps-storage — port 3004)

### Fichiers

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/files/:bucket` | Lister les fichiers d'un bucket | Oui |
| POST | `/api/v1/files/:bucket` | Uploader un fichier | Oui |
| GET | `/api/v1/files/:bucket/*key` | Télécharger un fichier | Oui |
| PUT | `/api/v1/files/:bucket/*key` | Uploader avec une clé précise | Oui |
| DELETE | `/api/v1/files/:bucket/*key` | Supprimer un fichier | Oui |
| GET | `/api/v1/files/:bucket/info/*key` | Métadonnées d'un fichier | Oui |
| DELETE | `/api/v1/files/:bucket/batch` | Suppression en lot | Oui |
| POST | `/api/v1/files/copy` | Copier un fichier | Oui |
| POST | `/api/v1/files/move` | Déplacer un fichier | Oui |

### Buckets

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/buckets` | Lister les buckets | Oui |
| POST | `/api/v1/buckets` | Créer un bucket | Oui |
| GET | `/api/v1/buckets/:name` | Obtenir un bucket | Oui |
| DELETE | `/api/v1/buckets/:name` | Supprimer un bucket | Oui |

---

## 5. Conteneurs (signapps-containers — port 3002)

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/containers` | Lister les conteneurs | Oui |
| POST | `/api/v1/containers` | Créer un conteneur | Oui |
| GET | `/api/v1/containers/:id` | Détails d'un conteneur | Oui |
| POST | `/api/v1/containers/:id/start` | Démarrer | Oui |
| POST | `/api/v1/containers/:id/stop` | Arrêter | Oui |
| POST | `/api/v1/containers/:id/restart` | Redémarrer | Oui |
| DELETE | `/api/v1/containers/:id` | Supprimer | Oui |
| GET | `/api/v1/containers/:id/logs` | Logs (SSE streaming) | Oui |
| GET | `/api/v1/store/apps` | App store — lister les apps | Oui |
| POST | `/api/v1/store/install` | Installer une app | Oui |

---

## 6. AI Gateway (signapps-ai — port 3005)

### Chat / LLM

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| POST | `/api/v1/chat` | Chat avec le LLM (réponse complète) | Oui |
| POST | `/api/v1/chat/stream` | Chat en streaming SSE | Oui |

**Body `/api/v1/chat` :**
```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "model": "llama3",
  "temperature": 0.7,
  "collection": "optional-rag-collection"
}
```

### RAG / Indexation

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/search` | Recherche sémantique | Oui |
| POST | `/api/v1/index` | Indexer un document | Oui |
| DELETE | `/api/v1/index/:document_id` | Supprimer un document indexé | Oui |
| GET | `/api/v1/stats` | Statistiques de l'index | Oui |
| POST | `/api/v1/reindex` | Réindexer tout (admin) | Admin |

### Collections

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/collections` | Lister les collections | Oui |
| POST | `/api/v1/collections` | Créer une collection | Oui |
| GET | `/api/v1/collections/:name` | Obtenir une collection | Oui |
| DELETE | `/api/v1/collections/:name` | Supprimer une collection | Oui |
| GET | `/api/v1/collections/:name/stats` | Statistiques d'une collection | Oui |

### Modèles et fournisseurs

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/models` | Lister les modèles disponibles | Oui |
| GET | `/api/v1/providers` | Lister les fournisseurs configurés | Oui |
| GET | `/api/v1/models/local` | Modèles locaux téléchargés | Oui |
| GET | `/api/v1/models/available` | Modèles disponibles au téléchargement | Oui |
| POST | `/api/v1/models/download` | Télécharger un modèle | Oui |
| GET | `/api/v1/models/:model_id` | Statut d'un modèle | Oui |
| DELETE | `/api/v1/models/:model_id` | Supprimer un modèle local | Oui |
| GET | `/api/v1/hardware` | Profil matériel (GPU, VRAM, CPU) | Oui |

---

## 7. Monitoring (signapps-metrics — port 3008)

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/api/v1/metrics/system` | CPU, RAM, disque, réseau | Oui |
| GET | `/api/v1/metrics/history` | Historique des métriques | Oui |
| GET | `/api/v1/alerts` | Lister les alertes configurées | Oui |
| POST | `/api/v1/alerts` | Créer une règle d'alerte | Oui |
| PUT | `/api/v1/alerts/:id` | Modifier une alerte | Oui |
| DELETE | `/api/v1/alerts/:id` | Supprimer une alerte | Oui |
| GET | `/metrics` | Endpoint Prometheus scrape | Non |

---

## 8. Format d'erreur (RFC 7807 Problem Details)

Toutes les erreurs API respectent le format [RFC 7807](https://datatracker.ietf.org/doc/html/rfc7807).

### Structure

```json
{
  "type": "urn:signapps:error:not-found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "Event with id 'abc-123' not found",
  "instance": "/api/v1/events/abc-123",
  "error_code": "NOT_FOUND",
  "errors": null,
  "request_id": "req-789xyz"
}
```

### Codes HTTP courants

| Status | error_code | Situation |
|--------|-----------|-----------|
| 400 | `BAD_REQUEST` | Body JSON invalide, paramètre manquant |
| 401 | `UNAUTHORIZED` | Token absent ou invalide |
| 401 | `TOKEN_EXPIRED` | Token expiré |
| 403 | `FORBIDDEN` | Droits insuffisants |
| 403 | `MFA_REQUIRED` | MFA requis mais non validé |
| 404 | `NOT_FOUND` | Ressource introuvable |
| 409 | `CONFLICT` | Conflit (doublon, contrainte) |
| 422 | `VALIDATION` | Données invalides (détail dans `errors`) |
| 500 | `INTERNAL` | Erreur serveur inattendue |

### Exemple — Erreur de validation

```json
{
  "type": "urn:signapps:error:validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "Request body validation failed",
  "error_code": "VALIDATION",
  "errors": {
    "start_time": "must be before end_time",
    "title": "cannot be empty"
  },
  "request_id": "req-456abc"
}
```

---

## 9. Points de santé

Chaque service expose `/health` (public, pas d'auth) :

```json
{
  "status": "ok",
  "service": "signapps-calendar",
  "version": "0.1.0",
  "database": "connected",
  "uptime_seconds": 3600
}
```

---

*Pour l'architecture complète, voir `docs/ARCHITECTURE.md`. Pour le détail du calendrier unifié, voir `docs/CALENDAR_UNIFIED.md`.*
