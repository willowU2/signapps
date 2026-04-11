# Module Mail — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Gmail** | Threading parfait, labels (tags), filtres puissants, recherche quasi-instantanée, undo send, schedule send, snooze, smart compose (autocomplétion IA), smart reply (réponses suggérées), confidential mode, multi-account, keyboard shortcuts exhaustifs, spam filter leader |
| **Outlook** | Règles serveur, calendrier intégré, rules engine très riche, ignorer une conversation, search folders (smart folders), pinning, mail merge, focused inbox, delegation, Groups |
| **Hey (Basecamp)** | Screener (approuver les nouveaux expéditeurs avant qu'ils atteignent l'inbox), Imbox/Feed/Paper Trail séparés, reply later workflow, set aside, bubble up, clip collections |
| **Superhuman** | Vitesse obsessionnelle, shortcuts clavier omniprésents, snippets (templates), follow-up reminders, read receipts, split inbox, share a draft, undo send 30s |
| **Shortwave** (Gmail-based) | Bundles automatiques (IA groupe par sujet), AI summarization des threads, AI assistant conversationnel, pinned sections |
| **Spark** | Smart inbox (groupement auto personnel/newsletters/notifications), template, team mail collaboration, delegate, send later |
| **Front** | Team inbox, assigning conversations, internal comments on emails, rules, SLAs, analytics |
| **ProtonMail** | E2E encryption, self-destructing emails, zero-knowledge, GDPR-first, custom domain |
| **FastMail** | Professional, custom domain, rules, snooze, calendars integrated, privacy-focused |
| **Apple Mail** | Hide My Email (aliases), Markup des attachments, iCloud sync, simplicité |
| **Tutanota** | E2E, zero-knowledge, open source |
| **Airmail** | Customizable, multi-provider, aliases |

## Principes directeurs

1. **Inbox Zero atteignable** — l'outil doit guider vers un triage rapide et efficace, pas être un puits à mails.
2. **Clavier-first** — tout doit être faisable sans souris : triage, composition, recherche, navigation.
3. **IA pour réduire le volume, pas pour créer** — résumé, triage, smart reply. Pas de newsletters générées automatiquement.
4. **Respect de la vie privée** — pas de tracking d'ouverture externe sans consentement, pas de lecture du contenu par tiers.
5. **Unifier les comptes** — un utilisateur avec 3 comptes (pro, perso, association) doit les voir dans une seule boîte unifiée ou facilement basculables.
6. **Offline résilient** — lire, composer, chercher, même déconnecté.

---

## Catégorie 1 — Inbox et navigation

### 1.1 Vue Inbox
Liste verticale des emails, les plus récents en haut. Chaque ligne montre : avatar/initiale de l'expéditeur, nom, objet en gras si non lu, snippet du contenu, pièces jointes icône, date/heure, étoile (favori), labels colorés. Sélection par clic, multi-sélection avec checkbox ou Shift+clic.

### 1.2 Threading de conversations
Tous les emails d'une même conversation sont groupés sous un seul item dans la liste. Numéro affiché (ex: `Jean Dupont · 3`). Expansion dans la vue détail avec messages empilés chronologiquement (le plus récent en bas). Quote collapsé par défaut (click to expand).

### 1.3 Dossiers système et personnalisés
- **Boîte de réception** (Inbox)
- **Envoyés** (Sent)
- **Brouillons** (Drafts)
- **Corbeille** (Trash) — 30 jours de rétention
- **Spam / Courrier indésirable** — 30 jours
- **Archives** — rétention illimitée
- **Important** (marqué par l'utilisateur ou l'IA)
- **Dossiers personnalisés** hiérarchiques (créables, renommables, déplaçables)

### 1.4 Labels (tags)
Labels multi-couleurs applicables à un email. Un email peut avoir plusieurs labels. Label `À faire`, `Urgent`, `Client A`, etc. Hiérarchie de labels (parent/enfant). Drag-drop un label sur un email pour l'appliquer.

### 1.5 Tri et filtres
Tri par : date (par défaut), expéditeur, objet, taille, importance, pièces jointes. Filtres rapides : `Non lus`, `Avec pièces jointes`, `Étoilés`, `Avec @mention`, `Depuis X jours`.

### 1.6 Recherche rapide
`/` focus la barre de recherche. Recherche instantanée sur : expéditeur, destinataire, objet, corps, pièces jointes (nom), dossier, label. Opérateurs avancés : `from:`, `to:`, `subject:`, `has:attachment`, `larger:10MB`, `older:2026-01-01`, `label:urgent`. Suggestions d'autocomplétion.

### 1.7 Recherche full-text indexée
Index local + serveur. Tous les mails historiques cherchables, même hors-ligne. Résultats en <500ms sur 100k+ emails.

### 1.8 Recherche avancée (dialog)
Bouton `Recherche avancée` ouvre un dialog avec tous les champs structurés : de, à, objet, contient, ne contient pas, dans le dossier, sans pièce jointe, plage de dates. Génère une query avec les opérateurs.

### 1.9 Focused inbox / Smart inbox (IA)
Séparation automatique entre `Principal` (important, personnel, réponses) et `Autres` (newsletters, notifications, promo). Basé sur l'historique d'interaction de l'utilisateur. Formation par "move to focused" ou "move to other" (feedback loop).

### 1.10 Groupement automatique (bundles)
Les newsletters, notifications GitHub, factures, rapports automatiques sont regroupés automatiquement par type dans des bundles (Shortwave-style). Cliquable pour déplier.

### 1.11 Pinning (épingle en haut)
Épingler un email pour qu'il reste en haut de la liste jusqu'à désépinglage. Utilisé pour les emails importants qu'on veut voir en arrivant.

### 1.12 Snooze (mettre de côté)
Repousser un email à une date/heure future. Il disparaît de l'inbox et réapparaît à l'heure choisie. Options rapides : `Ce soir`, `Demain matin`, `Weekend prochain`, `Lundi matin`, `Date personnalisée`.

### 1.13 Set aside / Reply later (Hey-style)
Marquer un email comme "à traiter plus tard" sans le déplacer. Pile `À traiter` séparée accessible rapidement, prioritaire.

### 1.14 Infinite scroll + virtualisation
Scroll fluide sur des millions d'emails. Seuls les items visibles sont rendus.

---

## Catégorie 2 — Composition

### 2.1 Nouveau message (compose)
Bouton `Composer` ou raccourci `c`. Ouvre une fenêtre de composition : À, Cc, Bcc (optionnels), objet, corps rich text, pièces jointes. Mode popover ou plein écran.

### 2.2 Champs À / Cc / Bcc avec autocomplétion
Taper un nom, une email, une organisation → suggestions depuis les contacts, les emails récents, l'annuaire d'entreprise. Chips colorés pour les destinataires validés. Détection des adresses invalides avant envoi.

### 2.3 Éditeur de corps rich text
Formatage : gras, italique, souligné, barré, couleur, taille, police, listes, alignement, citations, liens, images inline, tables, signatures. Base : Tiptap (le même que Docs).

### 2.4 Smart compose (IA autocomplétion)
Pendant qu'on tape, suggestion grisée en fin de ligne pour compléter la phrase. `Tab` pour accepter, continuer à taper pour rejeter. Apprend du style d'écriture de l'utilisateur.

### 2.5 Smart reply (réponses suggérées)
Sous un email reçu, 3 réponses courtes générées par IA : "Merci !", "Je vais regarder", "Compris". Clic insère dans le champ de réponse, éditable avant envoi.

### 2.6 Templates et snippets
Bibliothèque de templates réutilisables : `Refus poliment`, `Suivi de demande`, `Demande de devis`, etc. Variable `{{nom}}`, `{{entreprise}}`, `{{date}}` remplies automatiquement. Raccourci `Ctrl+/` pour insérer un snippet par nom (`;refus`, `;demande`).

### 2.7 Signatures multiples
Plusieurs signatures configurables (pro, perso, lang-FR, lang-EN). Auto-sélection par compte expéditeur. Signature riche avec logo, liens, disclaimer.

### 2.8 Pièces jointes
Drag-drop de fichiers, upload depuis le drive SignApps, lien vers un fichier drive (pas d'upload). Preview des images, icône pour les PDF, DOCX, XLSX. Suppression de pièce jointe avant envoi.

### 2.9 Images inline
Glisser une image directement dans le corps → elle est insérée inline. Redimensionnement par poignée, alignement (gauche, centre, droite, wrap).

### 2.10 Tables dans le corps
Insertion d'une table (comme dans Docs), pratique pour des listes structurées.

### 2.11 Code blocks
Insertion d'un bloc de code avec coloration syntaxique. Utile pour les devs.

### 2.12 Citation de l'email précédent
Quand on répond, le message original est cité en-dessous avec un séparateur et une marge (quote). Possibilité de masquer/afficher la citation, de la modifier.

### 2.13 Répondre / Répondre à tous / Transférer
Boutons dédiés. Répondre à tous ajoute les Cc/Bcc originaux. Transférer joint les pièces jointes par défaut (désactivable).

### 2.14 Schedule send (envoi différé)
Bouton avec flèche à côté de `Envoyer` : `Planifier l'envoi` → date/heure. L'email reste en brouillon dans `Planifiés` jusqu'à l'heure choisie. Options : `Demain matin 9h`, `Lundi prochain 10h`, etc.

### 2.15 Undo send
Après un `Envoyer`, toast en bas "Envoyé · Annuler" pendant 5/10/30 secondes (configurable). Clic `Annuler` récupère le brouillon.

### 2.16 Send later / Follow-up reminder
Après envoi, option `Me rappeler si pas de réponse dans X jours`. Si aucune réponse, notification à la date choisie pour relancer.

### 2.17 Sauvegarde auto des brouillons
Chaque frappe sauvegarde le brouillon côté serveur. Fermer la fenêtre = sauvegarde. Restauration au prochain ouverture. Pas de perte de travail.

### 2.18 Composition multi-fenêtres
Plusieurs brouillons ouverts en parallèle (popovers empilés ou onglets). Alt+Tab entre eux.

### 2.19 Récipients BCC auto
Règle : pour certains destinataires ou dossiers, auto-BCC d'un email archive (compte d'audit).

### 2.20 Alias et identités multiples
Envoyer avec un alias (`contact@monentreprise.com` au lieu de `jean@monentreprise.com`). Switch d'identité avant envoi.

---

## Catégorie 3 — Triage et actions de masse

### 3.1 Actions rapides sur un email
Toolbar au survol d'un email dans la liste : Archive, Supprimer, Marquer lu/non-lu, Marquer important, Étoile, Label, Snooze. Raccourcis clavier : `e` (archiver), `#` (supprimer), `u` (non lu), `!` (important), `s` (étoile), `l` (label), `b` (snooze).

### 3.2 Multi-sélection
Checkbox à gauche de chaque ligne, ou Shift+clic pour une plage, ou Ctrl+clic pour individuel. `*` pour tout sélectionner sur la page, `*a` pour tout selecting, `*n` pour tout desélectionner.

### 3.3 Actions de masse
Sur une multi-sélection : `Archiver`, `Supprimer`, `Marquer comme lu/non-lu`, `Appliquer un label`, `Déplacer vers`, `Ajouter au spam`, `Signaler`. Undo disponible dans un toast.

### 3.4 Archive vs Delete
- **Archive** : retire de l'inbox, reste cherchable. `e` au clavier.
- **Delete** : va en corbeille, supprimé définitivement après 30 jours. `#` au clavier.

### 3.5 Marquer comme spam
Bouton `Signaler comme spam`. L'email va dans `Spam` et l'expéditeur est blacklisté pour les futurs mails. Feedback au filtre anti-spam pour apprentissage.

### 3.6 Désabonnement intelligent
Détection automatique des newsletters (headers `List-Unsubscribe`). Bouton `Se désabonner` dans l'email qui envoie une requête de désabonnement et archive.

### 3.7 Rules (filtres automatiques)
Créer des règles : `Si expéditeur = X et objet contient Y, alors appliquer label Z et archiver`. Conditions : expéditeur, destinataire, objet, corps, a des pièces jointes, taille, âge. Actions : marquer, labelliser, déplacer, transférer, supprimer, répondre automatiquement.

### 3.8 Filtres serveur vs client
Les règles s'exécutent côté serveur (dès la réception, même mobile hors-ligne) ou client (au chargement de l'inbox). Choix par règle.

### 3.9 Swipe gestures (mobile)
Sur mobile, swipe gauche/droite pour des actions rapides (archive, snooze, label). Actions configurables.

### 3.10 Block sender
Menu contextuel `Bloquer cet expéditeur` → ses emails vont automatiquement en corbeille sans passer par l'inbox.

### 3.11 Ignorer une conversation
Bouton `Ignorer` sur un thread → les futures réponses à ce thread n'apparaîtront plus dans l'inbox (elles vont en archive). Utile pour les discussions de groupe qui bruitent.

### 3.12 Mute newsletters
Un mute spécifique pour les newsletters : elles ne notifient plus mais restent consultables dans leur dossier dédié.

---

## Catégorie 4 — Recherche et filtres avancés

### 4.1 Barre de recherche globale
En haut, toujours visible. Autocomplétion progressive avec résultats en direct (preview des 5 premiers hits).

### 4.2 Syntaxe avancée
```
from:jean@exemple.com      → expéditeur
to:me                       → destinataire
subject:"compte rendu"      → objet exact
has:attachment              → avec PJ
filename:*.pdf              → nom de PJ
larger:5mb                  → taille
older_than:30d              → plus vieux que
newer_than:7d               → plus récent que
before:2026-01-01           → avant date
after:2025-12-01            → après date
label:urgent                → label
in:trash                    → dossier
is:unread                   → état lu
is:starred                  → état étoilé
```

### 4.3 Recherche dans les pièces jointes
Indexation du contenu des PDFs, DOCX, XLSX (OCR pour les images). Rechercher `CDI 2024` trouvera un PDF dont le corps contient cette phrase.

### 4.4 Sauvegarde de recherches (search folders)
Transformer une recherche en dossier virtuel. `Emails de Client A avec pièces jointes dernier mois` → dossier qui se met à jour en live.

### 4.5 Historique de recherches
Les 20 dernières recherches sauvegardées, accessibles au focus sur la barre de recherche.

### 4.6 Recherche Boolean
Support de `AND`, `OR`, `NOT` et parenthèses. `(from:X OR from:Y) AND has:attachment NOT subject:facture`.

### 4.7 Recherche fuzzy sur noms
`Jean` match `Jean Dupont`, `Jean-Pierre`, `Jeannot`. Tolérance aux fautes de frappe.

### 4.8 Recherche par mots-clés dans le sujet seulement
Option `Titre seulement` pour restreindre.

### 4.9 Recherche dans un dossier
`in:mondossier query` limite la recherche à un dossier et ses sous-dossiers.

---

## Catégorie 5 — IA intégrée

### 5.1 Résumé automatique d'un thread
Bouton `Résumer` sur un thread de 10+ emails → l'IA génère un résumé des points clés (questions posées, décisions, actions). Mise à jour dynamique quand de nouveaux messages arrivent.

### 5.2 Triage intelligent
L'IA classe les nouveaux emails : `Important (réponse requise)`, `Nécessite action`, `Info`, `Notification`, `Marketing`, `Spam probable`. Affichage de la catégorie en badge.

### 5.3 Extraction d'action items
Sur un thread : bouton `Extraire les actions`. L'IA liste ce qui est à faire ("Envoyer le devis", "Valider le contrat") et crée des tâches dans le module Tasks.

### 5.4 Composition assistée par IA
Bouton `IA écrire` dans le compose : prompt naturel ("Décliner poliment en proposant une autre date") → l'IA génère un brouillon. Boutons `Plus court`, `Plus formel`, `Plus chaleureux`.

### 5.5 Réponses suggérées contextuelles
Sous un email, 3 réponses courtes générées par l'IA (plus élaborées que les smart reply classiques, tenant compte du ton et du contexte complet du thread).

### 5.6 Traduction automatique
Si un email est détecté dans une autre langue, bandeau en haut : `Cet email est en anglais. Traduire ?`. Bouton `Traduire` fait la traduction inline. Respect de la mise en forme.

### 5.7 Détection de rendez-vous
Si un email propose une réunion ou une date, bouton `Ajouter au calendrier` apparaît, pré-rempli avec les infos extraites.

### 5.8 Détection d'adresses et lieux
Les adresses postales dans les emails deviennent des liens vers Google Maps. Les dates deviennent des chips cliquables.

### 5.9 Détection de liens de suivi (tracking pixels)
L'IA détecte les pixels de tracking (beacons) dans les emails et les bloque optionnellement pour préserver la vie privée.

### 5.10 Warning phishing
Détection IA des signaux de phishing (urgence, menace, usurpation, liens suspicious) avec un bandeau rouge d'alerte.

### 5.11 Synthesis hebdomadaire
Email du vendredi résumant la semaine : nombre d'emails reçus/traités, top expéditeurs, emails sans réponse, actions créées.

### 5.12 Assistant conversationnel
Panneau `Ask AI` dans l'inbox : "Combien d'emails de Jean cette semaine ?", "Quels emails n'ont pas eu de réponse ?", "Résume les dernières conversations avec Client A". L'IA traverse l'inbox pour répondre.

---

## Catégorie 6 — Sécurité et confidentialité

### 6.1 Chiffrement au repos et en transit
TLS 1.3 pour tous les transferts. AES-256 pour le stockage. HSM pour les clés.

### 6.2 S/MIME et PGP
Support S/MIME (standard entreprise) et PGP (standard geek) pour le chiffrement de bout en bout. Auto-détection des clés publiques destinataires, auto-chiffrement si disponible.

### 6.3 Confidential mode (Gmail-style)
Envoyer un email qui expire après X jours, ne peut pas être transféré, copié, imprimé, et nécessite un code SMS pour être lu. Utilisé pour les informations sensibles.

### 6.4 Email jetable / Alias anonymes
Créer des alias `xyz@monentreprise.com` qui forwardent vers mon email principal. Chaque alias peut être désactivé individuellement pour bloquer le spam. Utilisé pour les inscriptions à des services.

### 6.5 Blacklist / Whitelist
Liste des expéditeurs bloqués (mails → corbeille directement) et autorisés (jamais en spam).

### 6.6 Audit logs
Qui a consulté, envoyé, transféré quels emails. Export pour conformité.

### 6.7 DLP (Data Loss Prevention)
Détection automatique de données sensibles (cartes bancaires, IBAN, mots de passe) dans un email sortant → warning avant envoi.

### 6.8 Rétention et archivage
Règles par dossier ou par label : suppression automatique après X ans, archivage après X mois.

### 6.9 Legal hold
Marquer un email ou un dossier comme préservé → aucune suppression possible.

### 6.10 Classification
Public, Interne, Confidentiel, Secret. Règles de partage/transfert selon la classification.

### 6.11 Detection de spoofing / DKIM / SPF / DMARC
Vérification des headers DKIM/SPF/DMARC. Bandeau warning si l'email prétend venir d'un domaine mais échoue l'authentification.

### 6.12 Block tracking pixels
Option pour ne pas charger automatiquement les images (désactive les pixels de tracking d'ouverture).

---

## Catégorie 7 — Collaboration et partage

### 7.1 Team inbox (comptes partagés)
Un compte `support@` accessible par plusieurs membres de l'équipe. Chaque membre voit les emails, peut en assigner à un collègue, laisser des commentaires internes.

### 7.2 Assignation d'un email
Bouton `Assigner à` sur un email → choisir un membre de l'équipe. L'assignation est visible par tous.

### 7.3 Commentaires internes sur un email
Thread de discussion privée attaché à un email (pas visible pour l'expéditeur). "Paul, tu peux répondre à ça ?". @mention pour notifier.

### 7.4 Partage de brouillon
"Share a draft" : partager un brouillon avec un collègue pour review avant envoi. Collègue peut suggérer des modifications. Sign-off avant envoi.

### 7.5 Délégation
Donner à un assistant l'accès à mon inbox pour gérer à ma place. Options : voir, répondre en mon nom, envoyer en son nom avec "on behalf of".

### 7.6 Vue d'équipe
Panneau de gauche avec section "Équipe" listant les inboxes partagées auxquelles j'ai accès.

### 7.7 SLAs sur les tickets
Pour les team inboxes de support, définir des SLAs (ex: première réponse dans les 2h, résolution dans les 24h). Dashboard des SLAs.

### 7.8 Canned responses (réponses pré-définies)
Bibliothèque partagée de réponses types pour l'équipe support. Insertion en un clic.

### 7.9 Analytics d'équipe
Dashboard : volume d'emails, temps de réponse moyen, tickets en attente, par membre, par label. Export CSV.

### 7.10 Audit sur les team inboxes
Log : qui a ouvert/répondu/assigné/supprimé quels emails. Pour la conformité et le management.

---

## Catégorie 8 — Paramètres et personnalisation

### 8.1 Multi-comptes
Ajouter plusieurs comptes (Gmail, Outlook, IMAP, Exchange). Vue unifiée ou par compte. Switcher dans la sidebar ou via raccourci.

### 8.2 Configuration IMAP/SMTP manuelle
Pour les domaines pros personnalisés. Host, port, TLS, identifiants. Auto-détection si MX records standards.

### 8.3 OAuth Google / Microsoft / Apple
Login OAuth2 pour les providers qui le supportent. Sync automatique, pas de mot de passe stocké.

### 8.4 Notifications
Par compte ou global : son, vibration, badge, contenu (preview ou juste notifier), calme les nuits, calme les weekends.

### 8.5 Apparence
Thème clair, sombre, système. Densité : compact (plus d'emails visibles) vs confortable. Police et taille. Couleurs des labels.

### 8.6 Vue inbox
Prioritaire, chronologique, avec preview, sans preview, split view (liste + détail côte à côte).

### 8.7 Raccourcis clavier configurables
Éditeur visuel pour reassigner les raccourcis. Presets : Gmail, Outlook, Superhuman, vim-like.

### 8.8 Langue et fuseau horaire
Multi-langue UI. Timezone du calendrier et des dates.

### 8.9 Signature HTML avec WYSIWYG
Éditeur pour les signatures riches.

### 8.10 Import depuis un autre provider
Import de mails, contacts et signatures depuis Gmail, Outlook, iCloud, mbox.

---

## Catégorie 9 — Performance et mobile

### 9.1 Synchronisation incrémentale
Seuls les nouveaux mails et les changements sont téléchargés. Pas de re-sync complète à chaque ouverture.

### 9.2 Offline mode
Lire, composer, chercher, archiver hors-ligne. Actions synchronisées au retour en ligne.

### 9.3 Push notifications
Notifications push natives quand un nouveau mail arrive (IMAP IDLE, Gmail push API, Microsoft Graph webhooks).

### 9.4 Mobile responsive
Version mobile avec swipe gestures, floating compose button, bottom nav, grandes zones de tap.

### 9.5 Keyboard shortcuts exhaustifs (Gmail-compatible)
Shortcuts Gmail de base : `c`, `r`, `a`, `f`, `e`, `#`, `u`, `!`, `s`, `l`, `b`, `j/k`, `o/Enter`, `*a`, `u` (retour), `?` (aide). Configurables et désactivables.

### 9.6 Quick switcher
`Ctrl+K` ouvre un quick switcher pour naviguer : `Compose`, `Inbox`, `Sent`, `Drafts`, dossier X, label Y, email spécifique.

### 9.7 Multi-window
Ouvrir une conversation dans une nouvelle fenêtre/onglet pour comparer avec une autre.

### 9.8 Indexation et cache local
Cache local SQLite des derniers X mois d'emails pour accès ultra-rapide offline.

---

## Sources d'inspiration

### Aides utilisateur publiques et démos
- **Gmail Help** (support.google.com/mail) — guides complets sur labels, filters, search, keyboard, security.
- **Outlook Help** (support.microsoft.com/outlook) — rules, search folders, delegation, Exchange features.
- **Hey Guide** (hey.com/features) — workflows innovants (Screener, Imbox, Paper Trail, Reply Later, Set Aside).
- **Superhuman Help** (help.superhuman.com) — keyboard shortcuts cheat sheet, snippets, follow-up.
- **Shortwave Help** (shortwave.com/docs) — bundles, AI features, channels.
- **ProtonMail Support** (proton.me/support/mail) — E2E, PGP, bridge.
- **Fastmail Help** (fastmail.help) — rules, calendars, aliases.
- **Front Help** (help.front.com) — team inbox workflows, SLAs.

### Projets open source permissifs à étudier comme pattern
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL**

| Projet | Licence | Ce qu'on peut étudier/adapter |
|---|---|---|
| **Stalwart Mail Server** (stalw.art, github.com/stalwartlabs/mail-server) | **AGPL v3** | **INTERDIT**. Serveur mail complet Rust avec JMAP/IMAP. Ne pas utiliser ni copier. |
| **Maddy Mail Server** (maddy.email, github.com/foxcpp/maddy) | **GPL v3** | **INTERDIT**. |
| **Postal** (github.com/postalserver/postal) | **MIT** | Serveur mail transactionnel (outgoing). Pattern pour le SMTP de sortie. |
| **Haraka** (haraka.github.io) | **MIT** | SMTP server Node.js. Pattern pour les plugins SMTP. |
| **Roundcube Webmail** | **GPL v3** | **INTERDIT** comme code, mais la UI est pédagogique dans sa démo publique. |
| **SnappyMail** (github.com/the-djmaze/snappymail) | **AGPL v3** | **INTERDIT**. Alternative à Roundcube. |
| **Rainloop** | **AGPL v3** | **INTERDIT**. |
| **nodemailer** (nodemailer.com) | **MIT** | Library Node.js pour envoyer des emails SMTP. Pattern standard. |
| **mailparser** (github.com/nodemailer/mailparser) | **MIT** | Parser email (MIME, headers, body, attachments). |
| **imap-simple** / **imapflow** (github.com/postalsys/imapflow) | **MIT** | Client IMAP Node.js moderne. Pour la sync d'inbox. |
| **mailauth** (github.com/postalsys/mailauth) | **MIT** | SPF, DKIM, DMARC, ARC verification. Indispensable. |
| **jsmime** (github.com/dkf/jsmime) | **MPL-2.0** | **Weak copyleft** OK comme consommateur. Parser MIME. |
| **letter-opener** (Ruby) | **MIT** | Preview d'emails en dev. Pattern pour les previews. |
| **maizzle** (maizzle.com) | **MIT** | Framework pour templates d'emails responsives. Pour les newsletters et transactional. |
| **mjml** (mjml.io) | **MIT** | Markup language pour créer des emails responsives. |
| **react-email** (react.email, github.com/resend/react-email) | **MIT** | Composer des emails en React. Pattern moderne pour les templates. |
| **jmap-client** (github.com/linagora/jmap-client-ts) | **MIT** | Client JMAP en TypeScript. Protocole moderne (alternative à IMAP). |
| **Gmail API** (developers.google.com/gmail/api) | API propriétaire | À utiliser en connecteur, pas à réimplémenter. |
| **Microsoft Graph API** (docs.microsoft.com/graph) | API propriétaire | Idem pour Outlook/Exchange. |
| **SpamAssassin** (spamassassin.apache.org) | **Apache-2.0** | Filtre anti-spam mature. Peut être utilisé en dépendance externe. |
| **rspamd** (rspamd.com) | **Apache-2.0** | Alternative moderne à SpamAssassin, plus rapide. |

### Pattern d'implémentation recommandé
1. **Protocoles de sync** : JMAP (moderne, RFC 8620) en priorité, IMAP IDLE en fallback pour les providers legacy. Gmail API et MS Graph pour les providers cloud.
2. **Parsing MIME** : `mailparser` (MIT) côté Node, ou `mail-parser-rs` (Apache-2.0) côté Rust.
3. **Envoi SMTP** : `lettre` (Apache-2.0) côté Rust. Pas de Node dependency.
4. **Authentification** : `mailauth` (MIT) pour SPF/DKIM/DMARC.
5. **Anti-spam** : rspamd (Apache-2.0) comme service externe. Score inclus dans l'UI.
6. **Full-text search** : Tantivy (MIT) ou MeiliSearch (MIT) pour l'indexation.
7. **Templates transactionnels** : react-email (MIT) ou MJML (MIT).
8. **Signature riche WYSIWYG** : Tiptap (MIT) — le même éditeur que Docs.
9. **Composition rich text** : Tiptap (MIT), cohérent avec le reste de SignApps.
10. **Chiffrement E2E** : OpenPGP.js (LGPL - **ATTENTION** linkage dynamique, à vérifier) ou `rage` (Apache-2.0 / MIT) en Rust pour une alternative moderne.

### Ce qu'il ne faut PAS faire
- **Pas de fork** de Roundcube, SnappyMail, Rainloop (tous GPL/AGPL).
- **Pas de copie** de code Stalwart/Maddy (AGPL/GPL).
- **Attention à OpenPGP.js** (LGPL) : valider le linkage dynamique avant utilisation, ou utiliser une alternative permissive.
- **Pas de tracking d'ouverture sortant par défaut** — fonctionnalité optionnelle et signalée.

---

## Assertions E2E clés (à tester)

- Vue inbox avec liste virtualisée
- Threading des conversations
- Recherche avec opérateurs (`from:`, `has:attachment`, etc.)
- Création d'un email (compose), envoi, réception
- Réponse, répondre à tous, transfert
- Pièces jointes : upload, preview, download
- Labels : création, application, filtrage
- Dossiers : création, déplacement d'emails
- Snooze : email disparaît et réapparaît
- Archive vs suppression
- Undo send pendant 5s
- Schedule send
- Smart compose pendant la saisie
- Smart reply sous un email
- Brouillons auto-sauvegardés
- Rules/filters appliquées automatiquement
- Multi-comptes avec switcher
- Keyboard shortcuts (compose, archive, etc.)
- Offline : lire et composer sans connexion, sync au retour
- Team inbox : assignation, commentaires internes
- Signature riche appliquée
- Export d'un mail en EML ou PDF
- DLP : warning sur donnée sensible
