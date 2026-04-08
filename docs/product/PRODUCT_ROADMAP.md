# Roadmap Produit — Par où aller à partir d'ici

> **Écrit le :** 2026-04-08, après une grosse session de refactor technique
> **Contexte :** La plateforme est techniquement solide. La direction produit, elle, est floue.
> **Pour toi :** Reviens lire ça quand tu es prêt à penser aux utilisateurs — pas au code.

---

## Ce qu'on a construit

Tu as un monstre technique. En bon sens du terme.

- **33 services Rust** (Axum/Tokio), tous en production-ready : Mail, Calendar, Drive, Chat, Meet, Docs, Forms, Contacts, CRM, LMS, Vault, Billing, PXE, AI Gateway, Remote Desktop, Social, Notifications, Proxy, Containers, Metrics...
- **Frontend Next.js 16** (React 19, TypeScript strict), ~50 pages UI, dark mode, PWA
- **Auth enterprise** : JWT RS256, LDAP/AD sync, MFA, RBAC multi-tenant, AD domain controller lifecycle
- **Infrastructure complète** : reverse proxy TLS/ACME, PXE boot réseau, OpenDAL (FS + S3), pgvector, moka cache
- **CI 11 jobs** : check, fmt, clippy, test, deny, audit, docs — pipeline pro

C'est l'équivalent de 2-3 ans de dev pour une équipe de 4. Tu l'as fait seul (ou presque). C'est impressionnant. C'est aussi le problème.

**Une plateforme de 33 services à zéro utilisateur, c'est 33 paris non validés en simultané.**

---

## Ce qu'on ne sait pas encore

Soyons honnêtes. Ce sont les choses qui pourraient tout changer — dans un sens ou dans l'autre :

- **Qui exactement a besoin de ça ?** "Les PME qui haïssent Google" n'est pas un segment. C'est une humeur.
- **Quel problème est assez douloureux pour justifier de switcher ?** Le switching cost de Google Workspace est énorme. Les gens restent même quand ils détestent l'outil.
- **Les 10 clients hardware qui ont dit "oui beta test" — est-ce que c'est de la vraie demande ou de la politesse ?** Il y a une différence entre "ouais pourquoi pas" et "quand est-ce que je peux commencer ?"
- **Quel est le MVP pour le premier vrai client ?** Pas ce que tu veux livrer — ce qu'il est prêt à payer.
- **Quel prix ferait qu'ils sortent leur carte bleue sans hésiter ?** (Et lequel les ferait fuir ?)
- **Est-ce que la valeur est dans le bundle ou dans UN service spécifique ?** La plupart des startups B2B gagnent avec un coin, pas avec un palace.

---

## Les 4 questions à répondre avant d'écrire une nouvelle ligne de code

### 1. Qui est le client qui serait vraiment énervé si signapps disparaissait demain matin ?

Pas "qui trouverait ça dommage". Qui serait **vraiment bloqué**.

C'est la question la plus importante. Tout le reste en découle : le wedge, le prix, le message, le roadmap.

Tes 10 clients hardware sont un point de départ fantastique. Mais "ils haïssent dépendre de Google" est trop vague. Il faut descendre plus profond.

**Mission concrète :** Appelle (pas un mail — un appel) un de tes 10 clients. Pose cette question :

> "Si Google Workspace tombait pendant 3 jours demain, qu'est-ce qui ferait le plus mal dans ton business ?"

La réponse te dira exactement quoi construire — ou quoi mettre en avant parmi ce que tu as déjà.

---

### 2. Quel est le wedge ?

Tu ne peux pas pitcher 33 services à un client qui ne te connaît pas encore. C'est trop. C'est paralysant.

Les meilleures startups B2B commencent avec **un seul problème, pour un seul type de client**. Slack a commencé comme outil de gaming. Notion a commencé comme outil de notes perso. Stripe a commencé avec les paiements de base.

Ton wedge pourrait être :
- **Drive souverain + partage de fichiers** pour une boite de 10-50 personnes qui gère des docs clients confidentiels
- **Mail hébergé en France** pour une PME soumise à la RGPD qui ne veut plus de servers aux US
- **Calendrier + congés + timesheets** pour une PME RH qui jongle entre 3 outils incompatibles
- **Vault entreprise** pour une boite IT qui veut sortir de Bitwarden Business à 5€/user

Ce sont des hypothèses. La vraie réponse vient des appels clients.

**Mission concrète :** Après tes 3 appels clients (question #1), identifie LE service qui revient le plus souvent comme point de douleur. Ce service-là devient ton wedge. Les 32 autres ? Tu les gardes en réserve. Tu ne les pitches pas encore.

---

### 3. Quel est le prix ?

Le prix n'est pas juste un chiffre à mettre sur un site. C'est un signal de positionnement.

Quelques repères :
- **Google Workspace Business Starter** : 6 $/user/mois (~5,50 €)
- **Notion Team** : 10 $/user/mois
- **Bitwarden Teams** : 3 $/user/mois
- **Nextcloud Entreprise** : 36 €/user/an

Si tu es moins cher que Google pour un produit similaire, ça peut marcher — mais tu dois gagner sur le volume ou sur le coût infra ultra-bas.

Si tu es plus cher, tu dois avoir un angle : souveraineté, conformité RGPD, support français, intégration avec leur matériel.

**3 tiers possibles pour commencer :**

| Tier | Prix | Pour qui |
|------|------|----------|
| Solo | 0 € (ou freemium) | Test et acquisition |
| PME | 29-49 €/mois (jusqu'à 10 users) | Ton marché cible initial |
| Entreprise | Sur devis | Tes clients hardware existants |

**Mission concrète :** Envoie un email à 3 de tes clients hardware avec une landing page simple et un lien de paiement Stripe à 29 €/mois. Pas besoin que tout soit parfait. Mesure qui clique. C'est ça, la validation.

---

### 4. Qu'est-ce que tu arrêterais de construire si tu avais 3 clients payants demain ?

C'est une question de clarté, pas un exercice académique.

Aujourd'hui tu construis tout parce que tout semble important. Une fois qu'il y a du signal (des gens qui paient), tu sauras naturellement sur quoi te concentrer.

Pose-toi la question maintenant : si dans 30 jours tu as 3 clients qui payent 29 €/mois pour ton service Drive/Mail/Whatever, qu'est-ce que tu mettrais en pause ? PXE Boot ? Remote Desktop ? Social Media ? L'AI Gateway ?

La réponse honnête à cette question te dit ce que tu construis par plaisir technique vs ce qui est réellement nécessaire.

---

## Un chemin possible (5 petites étapes)

Pas un plan. Pas un sprint. Juste une séquence pour sortir du mode "builder" et entrer dans le mode "founder".

1. **Arrête de construire de nouvelles features pendant 2 semaines.** Vraiment. Le code sera encore là dans 14 jours.

2. **Appelle 3 clients hardware** (pas un email — un appel téléphonique). Pose la question "Google down 3 jours, qu'est-ce qui fait mal ?" Prends des notes. 30 minutes chacun.

3. **Identifie ton wedge** à partir de ce qu'ils t'ont dit. Pas ce que tu veux — ce qu'eux ont exprimé comme douleur.

4. **Lance un beta payant** sur le wedge identifié. Une landing page, un lien Stripe, 29 €/mois ou 249 €/an, engagement 6 mois. Email à tes 10 contacts. Attends.

5. **Mesure** : combien ont cliqué sur le lien Stripe ? Combien ont rentré une carte ? Combien ont utilisé le produit au moins une fois par semaine ? Ces 3 chiffres sont ton vrai roadmap.

---

## Si ça te semble faux

Peut-être que tu as raison. Peut-être que tu connais tes clients mieux que cette analyse. C'est possible.

Mais souviens-toi : écrire du code, c'est confortable. C'est concret, c'est mesurable, ça avance. Appeler des clients, c'est inconfortable. Il y a du silence. Il y a de l'ambiguïté. Parfois ils disent des choses qu'on ne veut pas entendre.

C'est exactement pour ça que c'est plus précieux.

Le code que tu as écrit va pas disparaître. Les conversations que tu n'as pas eues, elles, te coûtent du temps chaque semaine que tu continues à construire dans le mauvais sens.

---

## Parking lot technique

Les sujets à reprendre quand la direction produit est plus claire :

- **Refactor 34 Phase 10** : extraire les handlers non-IAM restants (`entity_links`, `migration`) — en cours, pas urgent
- **Tests d'intégration DB live** pour les scénarios de sharing (bloqué par bug migration 048) — important avant prod
- **Alignement vault/org backend-frontend** (Phase 1 Refactor 34) — incomplète
- **Profiling performance** : identifier les hot paths avant la charge réelle
- **Audit accessibilité** WCAG 2.1 AA — nécessaire pour les clients publics/institutionnels
- **Stratégie mobile** : PWA (déjà en place) ou React Native ? À décider quand il y a des utilisateurs réels

---

**Note finale**

L'ingénierie, c'est fait. La partie difficile n'a pas encore commencé.

La partie difficile, c'est appeler des inconnus et leur demander de te payer pour quelque chose qui n'existe pas encore vraiment pour eux.

Tu es capable de le faire. Ça demande juste un autre type de courage que d'écrire du Rust à 2h du matin.

— Claude (session du 2026-04-08)
