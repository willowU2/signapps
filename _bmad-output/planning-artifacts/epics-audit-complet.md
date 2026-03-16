# Epics & Stories: Audit Complet SignApps

**Source:** Brainstorming Session 2026-03-16
**Principe:** NO DEAD ENDS - Si ça s'affiche, ça fonctionne

---

## Epic 18: Quick Wins - Éliminer les Dead Ends Visibles

**Priorité:** P0 - CRITIQUE
**Sprint:** 5
**Effort:** ~19h

### Story 18.1: Drive - Implémenter Renommer Fichier
**En tant qu'** utilisateur Drive
**Je veux** renommer un fichier via le menu contextuel
**Afin de** organiser mes fichiers sans dead end

**Critères d'acceptation:**
- [ ] Clic sur "Renommer" ouvre un dialog/input
- [ ] Validation du nouveau nom
- [ ] Appel API `PATCH /api/v1/files/{id}` avec nouveau nom
- [ ] Refresh de la liste après succès
- [ ] Toast de confirmation

**Fichiers:**
- `client/src/app/drive/page.tsx:382`
- `services/signapps-storage/src/handlers/files.rs`

**Effort:** 2h

---

### Story 18.2: Admin - Workspace Update API
**En tant qu'** administrateur
**Je veux** modifier les paramètres d'un workspace
**Afin de** gérer les espaces de travail

**Critères d'acceptation:**
- [ ] Endpoint `PUT /api/v1/workspaces/{id}` fonctionnel
- [ ] Mise à jour nom, description, settings
- [ ] UI appelle l'API au lieu du toast
- [ ] Feedback succès/erreur

**Fichiers:**
- `client/src/app/admin/workspaces/page.tsx:53`
- `services/signapps-identity/src/handlers/workspaces.rs`

**Effort:** 4h

---

### Story 18.3: Settings - General Settings API
**En tant qu'** utilisateur
**Je veux** sauvegarder mes préférences générales
**Afin de** personnaliser mon expérience

**Critères d'acceptation:**
- [ ] Endpoint `PUT /api/v1/users/{id}/settings` fonctionnel
- [ ] Sauvegarde theme, langue, notifications
- [ ] Bouton "Enregistrer" appelle l'API
- [ ] Feedback succès/erreur

**Fichiers:**
- `client/src/app/settings/page.tsx:533`
- `services/signapps-identity/src/handlers/users.rs`

**Effort:** 4h

---

### Story 18.4: Notifications Push WebSocket
**En tant qu'** administrateur
**Je veux** envoyer des notifications push aux utilisateurs
**Afin de** communiquer en temps réel

**Critères d'acceptation:**
- [ ] Endpoint `POST /api/v1/notifications/send` fonctionnel
- [ ] WebSocket broadcast aux clients connectés
- [ ] UI Admin envoie notification
- [ ] Clients reçoivent en temps réel
- [ ] Toast notification côté client

**Fichiers:**
- `client/src/components/notifications/send-notification-admin.tsx:40`
- `services/signapps-identity/src/handlers/notifications.rs` (créer)
- `client/src/hooks/use-notifications.ts` (créer)

**Effort:** 6h

---

### Story 18.5: Mail - IMAP Test Complet
**En tant qu'** administrateur
**Je veux** tester la connexion IMAP d'un compte mail
**Afin de** diagnostiquer les problèmes de configuration

**Critères d'acceptation:**
- [ ] Endpoint `POST /api/v1/mail/test-imap` fonctionnel
- [ ] Test connexion, auth, list folders
- [ ] Retourne diagnostic détaillé
- [ ] UI affiche résultat du test

**Fichiers:**
- `services/signapps-mail/src/api.rs:319`

**Effort:** 3h

---

## Epic 19: Storage Complet - Previews, Permissions, Versions

**Priorité:** P1 - HAUTE
**Sprint:** 6
**Effort:** ~50h

### Story 19.1: Preview - Image Thumbnails
**En tant qu'** utilisateur Drive
**Je veux** voir des miniatures de mes images
**Afin de** identifier visuellement mes fichiers

**Critères d'acceptation:**
- [ ] Génération thumbnail au upload (200x200, 400x400)
- [ ] Cache des thumbnails
- [ ] Endpoint `GET /api/v1/files/{id}/thumbnail`
- [ ] Formats: JPEG, PNG, GIF, WebP

**Fichiers:**
- `services/signapps-storage/src/handlers/preview.rs:144`

**Effort:** 8h

---

### Story 19.2: Preview - PDF Rendering
**En tant qu'** utilisateur Drive
**Je veux** voir un aperçu de mes PDFs
**Afin de** identifier le contenu sans ouvrir

**Critères d'acceptation:**
- [ ] Extraction première page en image
- [ ] Thumbnail PDF
- [ ] Métadonnées (pages, titre, auteur)

**Fichiers:**
- `services/signapps-storage/src/handlers/preview.rs:149`

**Effort:** 6h

---

### Story 19.3: Preview - Video Frame Extraction
**En tant qu'** utilisateur Drive
**Je veux** voir une miniature de mes vidéos
**Afin de** identifier le contenu

**Critères d'acceptation:**
- [ ] Extraction frame à 10% de la durée
- [ ] Thumbnail vidéo
- [ ] Métadonnées (durée, résolution, codec)

**Fichiers:**
- `services/signapps-storage/src/handlers/preview.rs:154`

**Effort:** 8h

---

### Story 19.4: Preview - Audio Waveform
**En tant qu'** utilisateur Drive
**Je veux** voir une forme d'onde de mes fichiers audio
**Afin de** identifier le contenu

**Critères d'acceptation:**
- [ ] Génération waveform SVG/PNG
- [ ] Métadonnées (durée, bitrate)

**Fichiers:**
- `services/signapps-storage/src/handlers/preview.rs:159`

**Effort:** 4h

---

### Story 19.5: Permissions - CRUD Database
**En tant qu'** utilisateur Drive
**Je veux** partager des fichiers avec des permissions
**Afin de** collaborer avec d'autres utilisateurs

**Critères d'acceptation:**
- [ ] Table `file_permissions` en DB
- [ ] CRUD permissions (read, write, admin)
- [ ] Partage par user, groupe, lien public
- [ ] Vérification permissions sur chaque accès

**Fichiers:**
- `services/signapps-storage/src/handlers/permissions.rs`
- `migrations/` - nouvelle migration

**Effort:** 8h

---

### Story 19.6: Version History - Backend Complet
**En tant qu'** utilisateur Drive
**Je veux** voir l'historique des versions d'un fichier
**Afin de** restaurer une version précédente

**Critères d'acceptation:**
- [ ] Table `file_versions` en DB
- [ ] Sauvegarde version à chaque modification
- [ ] Endpoint `GET /api/v1/files/{id}/versions`
- [ ] Endpoint `POST /api/v1/files/{id}/restore/{version}`
- [ ] UI affiche historique (plus 501)

**Fichiers:**
- `services/signapps-storage/src/handlers/versions.rs` (créer)
- `client/src/components/storage/version-history-sheet.tsx:89`

**Effort:** 8h

---

### Story 19.7: Archive Listing API
**En tant qu'** utilisateur Drive
**Je veux** voir le contenu d'une archive (ZIP, TAR)
**Afin de** savoir ce qu'elle contient avant extraction

**Critères d'acceptation:**
- [ ] Endpoint `GET /api/v1/files/{id}/archive-contents`
- [ ] Liste fichiers avec tailles
- [ ] Support ZIP, TAR, TAR.GZ

**Fichiers:**
- `services/signapps-storage/src/handlers/archive.rs` (créer)
- `client/src/components/storage/previews/archive-preview.tsx:33`

**Effort:** 4h

---

### Story 19.8: Document Metadata API
**En tant qu'** utilisateur Drive
**Je veux** voir les métadonnées d'un document
**Afin de** connaître ses propriétés

**Critères d'acceptation:**
- [ ] Endpoint `GET /api/v1/files/{id}/metadata`
- [ ] Métadonnées: auteur, date création, pages, mots
- [ ] Support DOCX, PDF, ODT

**Fichiers:**
- `services/signapps-storage/src/handlers/metadata.rs` (créer)
- `client/src/components/storage/previews/document-preview.tsx:35`

**Effort:** 4h

---

## Epic 20: Sheets - Suite Complète

**Priorité:** P1 - HAUTE
**Sprint:** 7-8
**Effort:** ~150h

### Story 20.1: Sheets - Menu Fichier Complet
- Nouveau depuis modèle
- Partager
- Publier sur le Web
- Envoyer par e-mail
- Historique des versions
- Disponible hors connexion
- Détails, Paramètres

**Effort:** 20h

### Story 20.2: Sheets - Menu Affichage Complet
- Barre de formules
- Plages protégées
- Grouper/Dissocier
- Commentaires
- Zoom (50%, 150%)

**Effort:** 15h

### Story 20.3: Sheets - Menu Insertion Complet
- Nouvelle feuille
- Générer tableau
- Tableaux prédéfinis
- Chronologie
- Tableau croisé dynamique
- Images dans/sur cellules
- Dessin

**Effort:** 25h

### Story 20.4: Sheets - Menu Format Complet
- Tous les formats numériques
- Texte: débordement, rotation
- Convertir en tableau

**Effort:** 30h

### Story 20.5: Sheets - Menu Données Complet
- Analyser les données
- Vues filtrées/groupées
- Segments
- Protection feuilles/plages
- Plages/Fonctions nommées
- Statistiques colonnes
- Nettoyage données

**Effort:** 25h

### Story 20.6: Sheets - Menu Outils Complet
- Créer formulaire
- Orthographe
- Suggestions automatiques
- Notifications conditionnelles
- Accessibilité
- Tableau de bord activités

**Effort:** 20h

### Story 20.7: Sheets - Menu IA Complet
- Analyser données
- Générer graphiques/tableaux
- Générer formules/images
- Résumer/Classer/Analyser texte

**Effort:** 15h

---

## Epic 21: Slides - Suite Complète

**Priorité:** P1 - HAUTE
**Sprint:** 9
**Effort:** ~38h

### Story 21.1: Import Diapositives
- Import depuis PPTX
- Import depuis autre présentation
**Effort:** 8h

### Story 21.2: Système de Templates
- Templates par défaut
- Templates personnalisés
- Galerie de templates
**Effort:** 12h

### Story 21.3: Export PPTX/PDF
- Lier au backend signapps-office
- UI menu export fonctionnel
**Effort:** 8h (4h PPTX + 4h PDF)

### Story 21.4: Insert Image
- Upload image
- Image depuis URL
- Redimensionnement
**Effort:** 6h

### Story 21.5: Créer Copie
- Dupliquer présentation
- Nouveau nom
**Effort:** 4h

---

## Epic 22: LDAP + Active Directory avec GPO

**Priorité:** P2 - MOYENNE
**Sprint:** 10-11
**Effort:** ~88h

### Story 22.1: LDAP Authentication
- Bind LDAP
- Vérification credentials
- Mapping attributs
**Effort:** 16h

### Story 22.2: LDAP Connection Test
- Test connexion
- Diagnostic détaillé
**Effort:** 4h

### Story 22.3: LDAP Group Sync
- Import groupes LDAP
- Mapping vers groupes locaux
- Sync périodique
**Effort:** 12h

### Story 22.4: LDAP User Sync
- Import utilisateurs LDAP
- Sync attributs
- Désactivation auto
**Effort:** 12h

### Story 22.5: Service AD (Samba AD DC)
- Configuration Samba AD DC
- Création domaine
- Gestion OUs
**Effort:** 24h

### Story 22.6: GPO Management UI
- Création GPO
- Édition paramètres
- Liaison aux OUs
- Templates GPO
**Effort:** 20h

---

## Epic 23: Drag & Drop Interconnexions

**Priorité:** P2 - MOYENNE
**Sprint:** 12
**Effort:** ~16h

### Story 23.1: DnD File → Task
- Glisser fichier sur tâche
- Créer lien fichier-tâche en DB
- Afficher fichiers liés dans tâche
**Effort:** 8h

### Story 23.2: DnD Task → Calendar
- Glisser tâche sur calendrier
- Créer événement avec deadline
- Lien bidirectionnel
**Effort:** 8h

---

## Epic 24: Remote Access Zero Trust

**Priorité:** P2 - MOYENNE
**Sprint:** 12
**Effort:** ~24h

### Story 24.1: Tunnel Agent
- Agent côté machine distante
- Connexion sortante vers SignApps
- Pas de port ouvert
**Effort:** 12h

### Story 24.2: Remote Session UI
- Liste machines connectées
- Établir session via tunnel
- Terminal/Desktop dans navigateur
**Effort:** 12h

---

## Résumé

| Epic | Titre | Stories | Effort | Sprint |
|------|-------|---------|--------|--------|
| 18 | Quick Wins | 5 | 19h | 5 |
| 19 | Storage Complet | 8 | 50h | 6 |
| 20 | Sheets Complet | 7 | 150h | 7-8 |
| 21 | Slides Complet | 5 | 38h | 9 |
| 22 | LDAP + AD/GPO | 6 | 88h | 10-11 |
| 23 | DnD Interconnexions | 2 | 16h | 12 |
| 24 | Remote Zero Trust | 2 | 24h | 12 |

**Total: 7 Epics, 35 Stories, ~385h**
