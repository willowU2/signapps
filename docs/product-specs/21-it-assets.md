# Module IT Assets — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Lansweeper** | Discovery automatique (network scan, LDAP, cloud), CMDB, software audit, license compliance, OS/BIOS inventory |
| **ServiceNow ITSM** | Enterprise leader, ITIL complet, CMDB, incidents, changes, problems, asset lifecycle, workflow, discovery agents |
| **Snipe-IT** | Open source, assets physiques (ordinateurs, téléphones, meubles), licenses, accessoires, users, locations, audits, custom fields |
| **Freshservice** | ITIL, ticket + asset, discovery agents, SAAS management |
| **JAMF** | Apple MDM (Mac, iPad, iPhone), zero-touch deployment, policies, app store, patching |
| **Microsoft Intune** | MDM multi-platform, device compliance, app protection, autopilot |
| **Kandji** | Apple MDM simplifiée, automated remediation, vulnerability management |
| **Jumpcloud** | Directory + device management + SSO unifiés |
| **ManageEngine AssetExplorer** | Asset + software + contracts |
| **Device42** | Data center infrastructure management (DCIM), network mapping |
| **Chef / Puppet / Ansible** | Configuration management, IaC |
| **Terraform / Pulumi** | Infrastructure as Code, cloud |
| **Crowdstrike / SentinelOne** | EDR (Endpoint Detection and Response), security |
| **BitDefender GravityZone** | EDR enterprise |
| **Osquery / Kolide** | Open source endpoint visibility |
| **Fleet (fleetdm.com)** | Osquery-based fleet management |

## Principes directeurs

1. **Inventaire automatique et continu** — discovery sans intervention manuelle pour les devices connectés au réseau.
2. **Source of truth unique** — CMDB centralisée reliant assets, licences, contrats, owners, tickets.
3. **Lifecycle complet** — de l'achat à la destruction en passant par l'attribution, le retour, la réparation.
4. **Coûts maîtrisés** — tracking des licences, contrats, dépenses IT, alerting sur les gaspillages (licences inutilisées, abonnements dupliqués).
5. **Sécurité** — detection des vulnérabilités, des devices non conformes, patch management.
6. **Integration IT stack** — LDAP/AD, cloud providers, EDR, ticketing.

---

## Catégorie 1 — Inventaire des assets

### 1.1 Types d'assets
- **Ordinateurs** : desktops, laptops, workstations
- **Serveurs** : physical, virtual, cloud
- **Appareils mobiles** : smartphones, tablets
- **Périphériques** : écrans, claviers, imprimantes, scanners
- **Réseau** : routeurs, switches, AP WiFi, firewalls
- **Infra** : NAS, SAN, UPS, climatisation
- **Audiovisuel** : TVs, projecteurs, visioconférence
- **Mobilier** : bureaux, chaises, armoires (optionnel)
- **Véhicules** : voitures de fonction (optionnel)
- **Autres** : accessoires, câbles, chargeurs

### 1.2 Fiche asset
Chaque asset a une fiche complète :
- Nom / tag (identifiant unique)
- Type et modèle
- Marque (Apple, Dell, HP, etc.)
- Serial number
- MAC addresses
- Date d'achat
- Prix d'achat
- Fournisseur
- Numéro de facture
- Garantie (date de fin)
- Contrat de maintenance
- État (neuf, bon, usagé, réparable, HS)
- Localisation (site, bâtiment, salle, personne)
- Assigned to (utilisateur)
- Statut (en service, stock, en réparation, déployé, retiré, perdu)
- Custom fields

### 1.3 Création manuelle
Formulaire pour ajouter un asset manuellement. Validation des champs requis.

### 1.4 Import CSV
Import bulk d'assets depuis CSV avec mapping des colonnes.

### 1.5 Discovery automatique (network scan)
Scanner le réseau local pour détecter tous les devices connectés. Récupération automatique : IP, MAC, hostname, OS, services ouverts. Agent-less via ICMP/SNMP/ARP.

### 1.6 Agents de discovery
Installer un agent léger sur chaque machine (Windows/macOS/Linux) pour remonter :
- OS et version
- CPU, RAM, disque
- Logiciels installés avec versions
- Processes en cours
- Utilisateur connecté
- BIOS, firmware
- Devices USB connectés
- Network config

### 1.7 Agent-based vs agent-less
Pour les serveurs et devices sensibles, agents pour info détaillée. Pour les IoT et devices basiques, scan réseau.

### 1.8 Cloud discovery
Discovery automatique des ressources cloud :
- **AWS** : EC2, S3, RDS, Lambda, etc.
- **Azure** : VMs, storage, SQL, Functions
- **GCP** : Compute Engine, Cloud SQL, GKE
- **OVH, Scaleway** (européens)

### 1.9 SaaS discovery
Détection des SaaS utilisés par l'organisation : via logs réseau, browser extension, analyse des dépenses (banque), SSO logs.

### 1.10 QR code / barcode
Chaque asset physique peut avoir un QR code imprimé à coller. Scanner avec mobile app pour identifier rapidement.

### 1.11 RFID tags
Support optionnel des RFID pour l'inventaire automatisé (scan d'une salle entière en quelques secondes).

### 1.12 Photos
Upload de photos de l'asset pour identification visuelle.

### 1.13 Documents joints
Factures, bons de garantie, manuels, contrats attachés à l'asset.

### 1.14 Custom fields
Champs custom définissables par l'admin selon les besoins (numéro d'imputation, centre de coût, projet, etc.).

### 1.15 Historical snapshots
Snapshot de l'état de l'asset à intervalles réguliers (pour voir l'évolution : changements de config, new installs, user changes).

---

## Catégorie 2 — Licences logicielles

### 2.1 Catalogue de logiciels
Liste de tous les logiciels trackés : nom, éditeur, version, type de licence (perpetual, subscription, open source).

### 2.2 Fiches licence
Pour chaque licence : numéro, date d'achat, date d'expiration, nombre de seats, seats utilisés, coût, contact fournisseur.

### 2.3 License compliance
Detection des écarts : installations sans licence, licences expirées, sous-utilisation (licences payées mais pas utilisées).

### 2.4 Alertes d'expiration
Notifications X jours avant expiration d'une licence pour anticipation du renouvellement.

### 2.5 License pool
Pool de licences disponibles qu'on peut assigner/désassigner aux utilisateurs selon les besoins.

### 2.6 Assigned users
Qui utilise quelle licence. Réassignation en cas de départ.

### 2.7 Floating licenses
Licences partagées (floating) avec tracking du nombre utilisé simultanément.

### 2.8 Software metering
Mesure du temps d'utilisation réelle de chaque logiciel par utilisateur. Identification des gaspillages.

### 2.9 Cost tracking
Coût total des licences. Répartition par département, par projet, par utilisateur.

### 2.10 Renewal management
Calendrier des renouvellements à venir avec workflow d'approbation.

### 2.11 Software request
Workflow pour qu'un utilisateur demande un nouveau logiciel. Approbation IT + manager.

### 2.12 License harvesting
Récupération automatique des licences quand un utilisateur ne les utilise plus depuis X jours.

---

## Catégorie 3 — Lifecycle management

### 3.1 Procurement (achat)
- Demande d'achat (approval workflow)
- Bon de commande
- Réception de matériel
- Entrée dans l'inventaire

### 3.2 Déploiement
- Configuration initiale
- Installation de logiciels
- Assignation à un utilisateur
- Signature de l'attribution

### 3.3 Utilisation
- Tracking de l'usage
- Maintenance préventive
- Monitoring (état, santé)

### 3.4 Réparation
- Demande de réparation
- Envoi au SAV
- Suivi du statut
- Retour dans l'inventaire

### 3.5 Mise à jour / Upgrade
- OS updates
- Firmware updates
- Hardware upgrades (plus de RAM, nouveau disque)

### 3.6 Retour (employé)
Quand un employé quitte : workflow de retour : checklist des items à rendre, vérification, remise en stock ou réassignation.

### 3.7 Recyclage / Destruction
Fin de vie : destruction sécurisée (effacement disque, broyage physique), certificat de destruction, impact environnemental.

### 3.8 Historique complet
Timeline d'un asset : quand il a été acheté, à qui assigné, quand retourné, réparé, etc.

### 3.9 Dépréciation comptable
Calcul de la valeur comptable d'un asset en fonction de la dépréciation (linéaire, dégressive).

### 3.10 Transfer of ownership
Réassignation d'un asset d'un utilisateur à un autre avec historique.

---

## Catégorie 4 — Attributions et utilisateurs

### 4.1 User directory integration
Sync avec LDAP/AD/Google Workspace/Microsoft Entra pour avoir la liste des utilisateurs.

### 4.2 Assignation d'un asset
Assigner un asset à un utilisateur. Signature électronique pour accusé de réception.

### 4.3 Vue utilisateur
Page par utilisateur listant tous les assets qui lui sont attribués.

### 4.4 Quotas par utilisateur
Limites : X ordinateurs max, Y téléphones max par personne selon son rôle.

### 4.5 Assignation à un lieu
Alternatives : asset fixe à un lieu (salle de réunion, bureau partagé), pas à une personne.

### 4.6 Multi-assignees
Plusieurs utilisateurs sur un même asset (ex: imprimante d'équipe).

### 4.7 Onboarding automation
Quand un nouvel employé arrive, workflow automatique pour attribuer les assets standards du poste.

### 4.8 Offboarding automation
Quand un employé part, checklist de récupération des assets.

### 4.9 Self-service
Portal où l'employé peut voir ses assets, signaler un problème, demander un nouvel équipement.

### 4.10 Asset transfer entre utilisateurs
Transferer un asset d'un utilisateur à un autre via workflow.

---

## Catégorie 5 — Contracts et fournisseurs

### 5.1 Contrats de service
- Contrats de maintenance
- Contrats de support
- SaaS subscriptions
- Hébergement cloud
- Assurance

### 5.2 Fiche contrat
Nom, fournisseur, type, date de début, date de fin, montant, auto-renewal, SLA, conditions.

### 5.3 Vendor directory
Base de fournisseurs : nom, contact, catégorie, note (rating), documents.

### 5.4 Alertes d'expiration
Notifications avant expiration des contrats.

### 5.5 Renouvellement workflow
Workflow de décision : renouveler, négocier, résilier, changer de fournisseur.

### 5.6 Attached documents
Contrats signés, factures, devis attachés à la fiche.

### 5.7 Cost tracking
Coût total des contrats par catégorie, par fournisseur, par période.

### 5.8 Multi-currency
Contrats en devises différentes avec conversion automatique.

### 5.9 Payment schedule
Échéances de paiement (mensuel, trimestriel, annuel). Alertes avant paiement.

### 5.10 SLA tracking
Mesure des SLAs des fournisseurs (ex: uptime 99.9%, response time < 1h).

---

## Catégorie 6 — Patch management et sécurité

### 6.1 Patch tracking
Liste des patches disponibles pour chaque OS et logiciel. Statut : pending, approved, installed, failed.

### 6.2 Patch deployment
Déploiement centralisé des patches sur tous les endpoints. Ordonné et rollbackable.

### 6.3 Patch compliance
% des endpoints à jour par OS, par logiciel critique.

### 6.4 CVE tracking
Intégration avec les bases CVE (Common Vulnerabilities and Exposures) : detection des vulnérabilités affectant les softwares installés.

### 6.5 Priority scoring
Score de priorité des vulnérabilités (CVSS) pour prioriser les patches.

### 6.6 Security posture
Dashboard de la santé sécurité : % de devices patchés, antivirus actif, firewall activé, disk encryption.

### 6.7 Compliance reports
Rapports de conformité aux standards (ISO 27001, NIS2, HIPAA, SOC 2).

### 6.8 EDR integration
Intégration avec Crowdstrike, SentinelOne, Microsoft Defender pour visibilité endpoint.

### 6.9 Alerting
Alertes pour : device non patché, antivirus désactivé, nouveau malware détecté, connexion à réseau inconnu.

### 6.10 Quarantine
Isoler un endpoint compromis du réseau automatiquement.

---

## Catégorie 7 — Mobile Device Management (MDM)

### 7.1 Device enrollment
Enrollement des devices mobiles (iOS, Android, macOS, Windows) dans le MDM via DEP/ADE (Apple), Android Enterprise, Autopilot (Windows).

### 7.2 Zero-touch deployment
Le device arrive déjà pré-configuré par le vendor. Premier allumage → enrollement automatique + applications automatiques.

### 7.3 Profiles et policies
Profils de configuration : WiFi, VPN, email, restrictions (bloquer app store, supprimer screenshot), passwords, encryption.

### 7.4 App store privé
App store d'entreprise avec les apps approuvées. Installation automatique ou à la demande.

### 7.5 App management
Push/remove d'apps à distance. Versions minimales imposées.

### 7.6 Remote wipe
Effacer un device perdu/volé à distance. Selective wipe (seulement les données pro).

### 7.7 Remote lock
Verrouiller un device à distance.

### 7.8 Locate device
Localiser un device (avec consentement et cadre légal).

### 7.9 Compliance
Définir les critères de compliance (OS à jour, passcode fort, pas de jailbreak). Devices non-compliant bloqués des ressources.

### 7.10 BYOD (Bring Your Own Device)
Séparation containers pro/perso sur les devices personnels. Accès aux apps d'entreprise sans contrôler le reste.

### 7.11 Kiosk mode
Configuration d'un device pour ne lancer qu'une seule app (utilisation en point de vente, réception).

### 7.12 Zero-trust access
Vérification du state du device à chaque connexion aux ressources. Pas de trust implicite.

---

## Catégorie 8 — Demandes et incidents IT

### 8.1 Service catalog
Catalogue des services IT demandables par les utilisateurs : nouveau poste de travail, nouvelle license, accès à une app, réparation, etc.

### 8.2 Incident management
Tickets pour les problèmes : poste en panne, imprimante down, accès perdu. Catégorisation, priorisation.

### 8.3 Change management
Workflow pour les changements importants (migration, update majeur, ajout de serveur). Approval chains.

### 8.4 Problem management
Tracking des problèmes récurrents pour identifier les causes racines.

### 8.5 Integration helpdesk
Intégration avec le module Helpdesk de SignApps pour la gestion des tickets.

### 8.6 Knowledge base IT
Articles pour self-service : "Comment configurer le VPN", "Réinitialiser son mot de passe", "Connecter une imprimante".

### 8.7 Service Level Agreements
SLAs par type de demande. Tracking et reporting.

### 8.8 Approvals workflow
Workflow d'approbation pour les demandes coûteuses ou sensibles.

### 8.9 Auto-provisioning
Provisioning automatique : pour certaines demandes (nouvel accès à une app SaaS), exécution automatique sans intervention.

### 8.10 Fulfillment tracking
Tracking du statut d'une demande de bout en bout : soumise → en cours → en attente → complétée.

---

## Catégorie 9 — Reporting et analytics

### 9.1 Dashboard IT
KPIs :
- Nombre total d'assets
- Répartition par type
- Devices obsolètes (>4 ans)
- Coût total des licences
- Contrats expirant sous 30 jours
- Tickets ouverts
- Compliance rate

### 9.2 Rapports
- Inventaire par type/localisation/utilisateur
- Software installations
- License compliance
- Cost by department/project
- Vendor spend
- Ticket metrics

### 9.3 Cost analytics
Coût IT total, par département, par type d'asset, par fournisseur. Évolution dans le temps.

### 9.4 Depreciation report
Valeur comptable actuelle des assets.

### 9.5 Warranty report
Assets encore sous garantie vs hors garantie.

### 9.6 Usage analytics
Utilisation des softwares : qui utilise quoi, fréquence, durée.

### 9.7 Asset utilization
Taux d'utilisation des assets (ex: pourcentage d'imprimantes utilisées, laptop en veille trop souvent).

### 9.8 Carbon footprint
Estimation de l'empreinte carbone des assets IT (Scope 3 selon GHG Protocol).

### 9.9 Forecasting
Prévision des achats futurs basés sur l'ancienneté et les cycles de remplacement.

### 9.10 Benchmarking
Comparaison avec des organisations similaires (moyennes industry).

---

## Catégorie 10 — Intégrations

### 10.1 LDAP / Active Directory
Sync des utilisateurs et groupes.

### 10.2 SSO (Okta, Azure AD, Google Workspace)
Authentification unifiée et provisioning.

### 10.3 Cloud providers (AWS, Azure, GCP)
Discovery automatique des ressources cloud.

### 10.4 SaaS providers
OAuth avec Slack, Zoom, Dropbox, GitHub, etc. pour discovery et provisioning.

### 10.5 EDR (Crowdstrike, SentinelOne)
Visibilité endpoint sécurité.

### 10.6 Helpdesk (interne SignApps)
Tickets liés aux assets.

### 10.7 Mail / Calendar / Chat
Notifications IT.

### 10.8 Billing / Procurement
Achats liés aux factures.

### 10.9 HR
Onboarding/offboarding workflows.

### 10.10 Monitoring (Datadog, Grafana, Prometheus)
Alertes de monitoring remontées dans les tickets IT.

### 10.11 Ansible / Terraform / Chef
Intégration avec les outils de configuration management.

### 10.12 API REST
CRUD sur tous les assets, licences, contrats. Webhooks.

---

## Catégorie 11 — Mobile et accessibilité

### 11.1 Application mobile native
iOS et Android pour scanner QR, prendre des photos, voir les assets, faire des audits physiques.

### 11.2 QR scanner
Scanner un QR pour accéder à la fiche asset.

### 11.3 Audit physique
Workflow d'audit : lister les assets d'une salle, scanner chacun pour confirmer la présence, détecter les manquants.

### 11.4 Photo uploads
Prendre des photos d'un asset (état, damages) depuis le mobile.

### 11.5 Accessibility WCAG AA
Navigation clavier, screen reader, contrastes.

### 11.6 Keyboard shortcuts
Shortcuts classiques : `/` search, `n` new asset, `f` filter.

---

## Catégorie 12 — IA intégrée

### 12.1 Détection d'anomalies
L'IA détecte les comportements anormaux : asset qui consomme trop, machine qui redémarre souvent, port USB inhabituel.

### 12.2 Suggestions de remplacement
Pour les assets âgés, suggestion de remplacement avec budget estimé.

### 12.3 License optimization
L'IA identifie les licences sur-provisionnées (payées, pas utilisées) et suggère des désabonnements.

### 12.4 Duplicate detection
Détection de doublons dans l'inventaire (même machine référencée deux fois).

### 12.5 Categorization automatique
Auto-catégorisation des assets et logiciels lors de l'import.

### 12.6 Q&A sur l'inventaire
"Combien de MacBooks dans l'équipe marketing ?", "Quelles licences expirent ce mois-ci ?", "Qui a un iPhone 12 ?".

### 12.7 Predictive maintenance
Prédiction des pannes matérielles basée sur les métriques (disk smart, température, cycles).

### 12.8 Automated troubleshooting
L'IA propose des solutions aux problèmes courants basées sur la KB et l'historique des tickets.

### 12.9 SaaS redundancy detection
Détection des SaaS qui se chevauchent (ex: Slack + Teams + Discord, probablement redondant).

### 12.10 Contract renegotiation alerts
L'IA identifie les contrats où une renégociation pourrait faire économiser (prix au-dessus du marché, features inutilisées).

---

## Sources d'inspiration

### Aides utilisateur publiques
- **Lansweeper Docs** (docs.lansweeper.com) — discovery, CMDB, software audit.
- **ServiceNow Docs** (docs.servicenow.com) — ITSM, CMDB, workflows, ITIL.
- **Snipe-IT Docs** (snipe-it.readme.io) — assets, licenses, users, audits.
- **JAMF Docs** (docs.jamf.com) — Apple MDM, policies, patches.
- **Microsoft Intune Docs** (docs.microsoft.com/intune) — MDM multi-platform.
- **Osquery Docs** (osquery.readthedocs.io) — endpoint visibility.
- **Fleet Docs** (fleetdm.com/docs) — fleet management.
- **ITIL Foundation** (axelos.com/itil) — ITSM best practices.

### Projets open source permissifs
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL**

| Projet | Licence | Ce qu'on peut étudier |
|---|---|---|
| **Snipe-IT** (github.com/snipe/snipe-it) | **AGPL v3** | **INTERDIT**. Asset management leader open source. Étudier via démo. |
| **GLPI** (glpi-project.org) | **GPL v3** | **INTERDIT**. ITSM et asset management. |
| **Ralph** (github.com/allegro/ralph) | **Apache-2.0** | Data center asset management. **OK à étudier**. |
| **OCS Inventory** | **GPL v2** | **INTERDIT**. Discovery et inventaire. |
| **Nagios** / **Icinga** | **GPL v2** | **INTERDIT**. Monitoring. |
| **Zabbix** | **AGPL v3** | **INTERDIT**. Monitoring. |
| **Checkmk Raw** | **GPL v2** | **INTERDIT**. |
| **LibreNMS** | **GPL v3** | **INTERDIT**. |
| **NetBox** (github.com/netbox-community/netbox) | **Apache-2.0** | DCIM leader. Excellente référence. **À étudier**. |
| **Nautobot** (nautobot.com) | **Apache-2.0** | Fork de NetBox avec plus de features. |
| **osquery** (osquery.io) | **Apache-2.0 / GPL v2 dual** | **Dual license**. OK avec la version Apache-2.0. Endpoint visibility. |
| **Fleet** (fleetdm.com) | **MIT** | Fleet management basé sur osquery. **À étudier**. |
| **Kolide** (kolide.com) | **MIT** (partie open) | Alternative Fleet. |
| **Wazuh** (wazuh.com) | **GPL v2** | **INTERDIT**. SIEM open source. |
| **OpenVAS** | **GPL v2** | **INTERDIT**. Vulnerability scanner. |
| **Nuclei** (github.com/projectdiscovery/nuclei) | **MIT** | Vulnerability scanner open source. |
| **Trivy** (github.com/aquasecurity/trivy) | **Apache-2.0** | Container vulnerability scanner. |
| **Nmap** (nmap.org) | **Custom NPSL** | **Attention licence** — usage OK mais pas dans un produit commercial sans vérifier. |
| **Masscan** | **AGPL v3** | **INTERDIT**. |
| **SmokePing** | **GPL v2** | **INTERDIT**. Latency monitor. |
| **Prometheus** (prometheus.io) | **Apache-2.0** | Metrics monitoring. |
| **Grafana** | **AGPL v3** (depuis 2021) | **INTERDIT depuis 2021**. Fork Apache (Mimir) possible. |

### Pattern d'implémentation recommandé
1. **Schéma CMDB** : signapps-db avec tables `assets`, `asset_types`, `software`, `licenses`, `contracts`, `vendors`, `assignments`.
2. **Discovery réseau** : `libpcap` via wrapper Rust (`pcap` crate MIT), ICMP/ARP scanner custom. Intégration avec `nmap` en CLI externe.
3. **Agent endpoint** : Rust pour multi-platform. Collecte via APIs système (systemctl, WMI, IOKit).
4. **Osquery integration** : utiliser osquery (Apache-2.0) comme agent primaire. Query language SQL-like très puissant.
5. **Cloud discovery** : SDKs officiels AWS/Azure/GCP pour lister les ressources.
6. **MDM Apple** : protocole MDM standard Apple (documentation publique). Push notifications via APNs.
7. **MDM Android** : Android Enterprise API.
8. **MDM Windows** : Windows CSP (Configuration Service Provider) / Autopilot.
9. **Patch management** : intégration WSUS (Windows), apt/yum repos (Linux), Homebrew (Mac).
10. **CVE feeds** : NVD API pour les CVEs officiels.
11. **Vulnerability scanning** : Nuclei (MIT) et Trivy (Apache-2.0) comme engines externes.
12. **QR generation** : `qrcode` (MIT).
13. **Barcode scanning** : `zxing-rs` (Apache-2.0).
14. **Monitoring** : Prometheus (Apache-2.0) + Mimir (Apache-2.0) comme alternative Grafana.

### Ce qu'il ne faut PAS faire
- **Pas de fork** de Snipe-IT, GLPI, OCS Inventory, Wazuh, Grafana post-2021 (GPL/AGPL).
- **Attention à osquery** : dual license, utiliser la version Apache-2.0 spécifiquement.
- **Attention à nmap** : NPSL custom, pas un vrai OSI.
- **Respect de la vie privée** : pas de collecte de données personnelles sans consentement.

---

## Assertions E2E clés (à tester)

- Création manuelle d'un asset
- Import CSV d'assets
- Discovery réseau lance et trouve des devices
- Fiche asset avec tous les champs
- Attribution d'un asset à un utilisateur
- Transfer d'asset entre utilisateurs
- Lifecycle : purchase → deployed → in use → retired
- Création d'une license
- Assignment de license à un user
- Alert sur license expirant
- Contract avec date d'expiration et alert
- Patch deployment sur un groupe de devices
- CVE detection sur software installé
- Dashboard IT avec KPIs
- Report par département
- QR code généré et scannable
- Audit physique via mobile
- Onboarding workflow créé automatiquement
- Offboarding : checklist de retour des assets
- MDM : device enrollé et policies appliquées
- Remote wipe d'un device
- AI : détection d'anomalie
- AI : Q&A sur l'inventaire
