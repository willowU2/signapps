use axum::{
    extract::Path,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};

struct Template {
    id: &'static str,
    name: &'static str,
    category: &'static str,
    content: &'static str,
}

const DEFAULT_TEMPLATES: &[Template] = &[
    Template {
        id: "blank",
        name: "Document vierge",
        category: "general",
        content: "",
    },
    Template {
        id: "meeting-notes",
        name: "Notes de reunion",
        category: "business",
        content: "# Notes de Reunion\n\n**Date:** \n**Participants:** \n\n## Ordre du jour\n\n## Decisions\n\n## Actions",
    },
    Template {
        id: "invoice",
        name: "Facture",
        category: "business",
        content: "# Facture\n\n**Numero:** \n**Date:** \n**Echeance:** \n\n## Emetteur\n\n## Destinataire\n\n## Prestations\n\n| Description | Quantite | Prix unitaire | Total |\n|-------------|----------|---------------|-------|\n| | | | |\n\n**Total HT:** \n**TVA:** \n**Total TTC:** ",
    },
    Template {
        id: "report",
        name: "Rapport",
        category: "business",
        content: "# Rapport\n\n**Date:** \n**Auteur:** \n\n## Resume\n\n## Analyse\n\n## Conclusions\n\n## Recommandations",
    },
    Template {
        id: "cv",
        name: "Curriculum Vitae",
        category: "personal",
        content: "# [Nom]\n\n**Email:** | **Tel:** | **Localite:** \n\n## Experience\n\n### [Poste] — [Entreprise] (AAAA–AAAA)\n- \n\n## Formation\n\n### [Diplome] — [Etablissement] (AAAA)\n\n## Competences\n\n- ",
    },
    Template {
        id: "quote",
        name: "Devis",
        category: "business",
        content: "# DEVIS\n\n**Devis No.:** [XXXX-2026]\n**Date:** [Date]\n**Validite:** 30 jours\n\n## De\n\n[Nom Entreprise]\n[Adresse]\n[Tel] | [Email]\nSIREN: [SIRET]\n\n## Client\n\n[Nom Client]\n[Adresse]\n[Contact]\n\n## Description des prestations\n\n| Prestation | Quantite | Unite | P.U. HT | Total HT |\n|-----------|----------|-------|--------|----------|\n| | | | | |\n\n**Total HT:** [Montant]\n**TVA (20%):** [Montant]\n**Total TTC:** [Montant]\n\n## Conditions\n\n- Validite: 30 jours\n- Delai de realisation: [X jours]\n- Conditions de paiement: Net [X jours]\n- Acompte requis: [X%]",
    },
    Template {
        id: "employment-contract",
        name: "Contrat de travail",
        category: "business",
        content: "# CONTRAT DE TRAVAIL\n\n**Entre les parties:**\n\n- **Employeur:** [Nom Entreprise], representee par [Nom]\n- **Salarie:** [Nom du salarie], ne le [Date de naissance]\n\n## I. Dispositions generales\n\n**Poste:** [Intitule du poste]\n**Lieu de travail:** [Adresse]\n**Date de debut:** [Date]\n**Duree:** CDI\n\n## II. Remuneration\n\n**Salaire brut mensuel:** [Montant] €\n**Periode de paie:** Mensuel\n\n## III. Horaires de travail\n\n**Duree hebdomadaire:** 35 heures\n**Horaires:** [Horaires]\n\n## IV. Periode d'essai\n\nDuree: [X mois]\nPreavis de rupture: [X jours]\n\n## V. Conges payes\n\n2,5 jours ouvrables par mois travaille\n\n## VI. Dispositions finales\n\nFait a [Lieu], le [Date]\n\nSignature Employeur: ___________\nSignature Salarie: ___________",
    },
    Template {
        id: "nda",
        name: "Accord de confidentialite (NDA)",
        category: "business",
        content: "# ACCORD DE CONFIDENTIALITÉ\n\n**Date:** [Date]\n\n**PARTIES:**\n\n- **Partie Divulgatrice:** [Nom Entreprise A]\n- **Partie Receptrice:** [Nom Entreprise B]\n\n## 1. Definition des Informations Confidentielles\n\nLes Informations Confidentielles incluent tous les renseignements commerciaux, techniques, financiers ou strategiques communiques sous quelque forme que ce soit.\n\n## 2. Obligations de Confidentialite\n\nLa Partie Receptrice s'engage a:\n\n- Garder confidentielles les Informations Confidentielles\n- Limiter l'acces a ces informations aux employes qui en ont besoin\n- Ne pas divulguer sans consentement ecrit prealable\n\n## 3. Exceptions\n\nNe sont pas confidentielles les informations qui:\n\n- Sont deja de domaine public\n- Etaient connues avant communication\n- Sont developpees independamment\n- Doivent etre revelees par obligation legale\n\n## 4. Duree\n\nCet accord reste en vigueur pour une duree de [X ans] apres sa signature.\n\n## 5. Dispositions finales\n\nFait a [Lieu], le [Date]\n\nSignature Partie A: ___________\nSignature Partie B: ___________",
    },
    Template {
        id: "letter-mission",
        name: "Lettre de mission",
        category: "business",
        content: "# LETTRE DE MISSION\n\n[Lieu], le [Date]\n\nA l'attention de [Nom du client]\n\nChre Madame, Cher Monsieur,\n\nNous vous proposons de realiser une mission de [Type de mission] selon les modalites suivantes:\n\n## Objet de la mission\n\n[Description detaillee de la mission]\n\n## Objectifs\n\n- [Objectif 1]\n- [Objectif 2]\n- [Objectif 3]\n\n## Duree\n\nDebut: [Date de debut]\nFin: [Date de fin]\n\n## Remuneration\n\nFortait: [Montant] € HT\nou\nJournee: [Montant] € HT par jour\n\n## Frais\n\n[Detailler les frais couverts/non couverts]\n\n## Conditions particulieres\n\n- Confidentialite: [Oui/Non]\n- Propriete intellectuelle: [Clause]\n- Responsabilite: [Clause]\n\n## Acceptation\n\nCet accord est valide une fois signe par les deux parties.\n\nCordialement,\n\n[Nom]\n[Titre]\n[Entreprise]\n\nAcceptation du client:\n\nNom: ___________\nSignature: ___________\nDate: ___________",
    },
    Template {
        id: "meeting-report",
        name: "Compte-rendu de reunion",
        category: "business",
        content: "# COMPTE-RENDU DE REUNION\n\n**Date:** [Date]\n**Heure:** [Heure debut] - [Heure fin]\n**Lieu:** [Lieu/Teleconference]\n**Redacteur:** [Nom]\n\n## Participants\n\n- [Nom] - [Fonction]\n- [Nom] - [Fonction]\n- [Nom] - [Fonction]\n- Excuses: [Noms]\n\n## Ordre du jour\n\n1. [Sujet 1]\n2. [Sujet 2]\n3. [Sujet 3]\n\n## Points abordes\n\n### 1. [Sujet 1]\n\nDiscussion: [Resume]\n\nDecisions:\n- [Decision 1]\n- [Decision 2]\n\nActions:\n- [Action 1] - Responsable: [Nom] - Delai: [Date]\n- [Action 2] - Responsable: [Nom] - Delai: [Date]\n\n### 2. [Sujet 2]\n\n[Idem]\n\n## Prochaine reunion\n\n**Date:** [Date]\n**Heure:** [Heure]\n**Lieu:** [Lieu]\n\n## Signatures\n\nRedacteur: ___________ Date: ___________\nChef de reunion: ___________ Date: ___________",
    },
    Template {
        id: "specification",
        name: "Cahier des charges",
        category: "project",
        content: "# CAHIER DES CHARGES\n\n**Projet:** [Nom du projet]\n**Version:** 1.0\n**Date:** [Date]\n**Auteur:** [Nom]\n**Approbation:** [Nom/Date]\n\n## 1. Contexte et objectifs\n\n### 1.1 Contexte\n\n[Description du contexte du projet]\n\n### 1.2 Objectifs\n\n- Objectif 1: [Description]\n- Objectif 2: [Description]\n- Objectif 3: [Description]\n\n## 2. Besoins fonctionnels\n\n### 2.1 Besoins principaux\n\n| ID | Besoin | Priorite | Description |\n|----|--------|----------|-------------|\n| F1 | | HIGH | |\n| F2 | | HIGH | |\n| F3 | | MEDIUM | |\n\n## 3. Besoins non-fonctionnels\n\n- Performance: [Specification]\n- Securite: [Specification]\n- Scalabilite: [Specification]\n\n## 4. Contraintes\n\n- Technique: [Contrainte]\n- Budget: [Montant]\n- Delai: [Delai]\n- Juridique: [Contrainte]\n\n## 5. Ressources\n\n- Equipe: [Description]\n- Outils: [Outils]\n- Budget: [Montant] €\n\n## 6. Planning\n\n- Phase 1: [Dates] — [Description]\n- Phase 2: [Dates] — [Description]\n- Phase 3: [Dates] — [Description]\n\n## 7. Criteres d'acceptation\n\n- [Critere 1]\n- [Critere 2]\n- [Critere 3]",
    },
    Template {
        id: "tech-spec",
        name: "Specification technique",
        category: "project",
        content: "# SPECIFICATION TECHNIQUE\n\n**Projet:** [Nom]\n**Version:** 1.0\n**Date:** [Date]\n**Auteur:** [Nom architecte]\n\n## 1. Architecture generale\n\n```\n[Ascii diagram ou description]\n```\n\n## 2. Technologies utilisees\n\n| Domaine | Technologie | Version | Justification |\n|---------|-------------|---------|---------------|\n| Frontend | [Tech] | [V] | |\n| Backend | [Tech] | [V] | |\n| BDD | [Tech] | [V] | |\n| Infrastructure | [Tech] | [V] | |\n\n## 3. Composants principaux\n\n### 3.1 [Composant 1]\n\n**Role:** [Description]\n**Interfaces:** [Interfaces]\n**Dependances:** [Dependances]\n\n### 3.2 [Composant 2]\n\n[Idem]\n\n## 4. Interfaces et APIs\n\n### 4.1 API REST [Endpoint]\n\n```\nPOST /api/v1/[ressource]\nBody: {...}\nResponse: {...}\nStatus: 200, 400, 500\n```\n\n## 5. Securite\n\n- Authentification: [Methode]\n- Autorisations: [Methode]\n- Chiffrement: [Methode]\n- Validation: [Methode]\n\n## 6. Performance\n\n- Latence cible: [ms]\n- Throughput: [Requetes/s]\n- Stockage: [GB]\n\n## 7. Considerations operationnelles\n\n- Deployment: [Procedure]\n- Monitoring: [Outils]\n- Logs: [Strategie]\n- Backup: [Strategie]",
    },
    Template {
        id: "test-plan",
        name: "Plan de test",
        category: "project",
        content: "# PLAN DE TEST\n\n**Projet:** [Nom]\n**Version:** 1.0\n**Date:** [Date]\n**Testeur responsable:** [Nom]\n\n## 1. Objectifs du test\n\n- [Objectif 1]\n- [Objectif 2]\n- [Objectif 3]\n\n## 2. Perimetre du test\n\nInclu:\n- [Composant/Fonction]\n\nExclu:\n- [Composant/Fonction]\n\n## 3. Strategie de test\n\n### 3.1 Types de test\n\n- Tests unitaires: [Outils/Framework]\n- Tests d'integration: [Outils/Framework]\n- Tests de regression: [Outils/Framework]\n- Tests de performance: [Outils]\n- Tests d'acceptation utilisateur: [Methode]\n\n## 4. Cas de test\n\n| ID | Description | Preconditions | Etapes | Resultat attendu | Priorite |\n|----|-------------|---------------|--------|------------------|----------|\n| TC1 | | | | | |\n| TC2 | | | | | |\n| TC3 | | | | | |\n\n## 5. Environnement de test\n\n- OS: [OS]\n- Navigateurs: [Navigateurs]\n- Serveurs: [Serveurs]\n- BDD: [BDD]\n\n## 6. Ressources requises\n\n- Testeurs: [Nombre]\n- Outils: [Outils]\n- Donnees de test: [Sources]\n\n## 7. Planning et calendrier\n\n- Debut: [Date]\n- Fin prevue: [Date]\n- Rapport final: [Date]\n\n## 8. Criteres de succes\n\n- Couverture: [Pourcentage]\n- Defauts critiques: 0\n- Defauts majeurs: < [Nombre]\n- Taux de passage: > [Pourcentage]%",
    },
    Template {
        id: "cover-letter",
        name: "Lettre de motivation",
        category: "personal",
        content: "[Ville], le [Date]\n\n[Nom du recruteur]\n[Titre]\n[Entreprise]\n[Adresse]\n[Code postal] [Ville]\n\nChre Madame, Cher Monsieur,\n\nC'est avec un grand interet que j'ai decouvert l'offre d'emploi pour le poste de [Intitule du poste] au sein de votre entreprise. Vos valeurs d'innovation et d'excellence correspondent parfaitement a mes aspirations professionnelles.\n\n## Mon interet pour votre entreprise\n\n[1-2 lignes expliquant pourquoi cette entreprise]\n\n## Mes competences et experiences\n\nAvec [X annees] d'experience dans [Domaine], j'ai developpe une expertise solide en:\n\n- [Competence 1]\n- [Competence 2]\n- [Competence 3]\n\nParmi mes realisations:\n- [Realisation 1]\n- [Realisation 2]\n\n## Pourquoi je suis le candidat ideal\n\n[2-3 lignes montrant la coherence avec le poste]\n\nJ'ai confiance que mon profil et ma motivation correspondent a vos attentes. Je serais ravi de pouvoir en discuter lors d'un entretien.\n\nCordialement,\n\n[Nom]\n[Telephone]\n[Email]",
    },
    Template {
        id: "weekly-schedule",
        name: "Planning hebdomadaire",
        category: "personal",
        content: "# PLANNING HEBDOMADAIRE\n\n**Semaine du [Date] au [Date]**\n**Responsable:** [Nom]\n\n## Lundi [Date]\n\n| Horaire | Activite | Lieu | Notes |\n|---------|----------|------|-------|\n| 09:00 - 10:00 | [Tache] | | |\n| 10:00 - 12:00 | [Tache] | | |\n| 14:00 - 17:00 | [Tache] | | |\n\n## Mardi [Date]\n\n| Horaire | Activite | Lieu | Notes |\n|---------|----------|------|-------|\n| | | | |\n\n## Mercredi [Date]\n\n| Horaire | Activite | Lieu | Notes |\n|---------|----------|------|-------|\n| | | | |\n\n## Jeudi [Date]\n\n| Horaire | Activite | Lieu | Notes |\n|---------|----------|------|-------|\n| | | | |\n\n## Vendredi [Date]\n\n| Horaire | Activite | Lieu | Notes |\n|---------|----------|------|-------|\n| | | | |\n\n## Priorites de la semaine\n\n1. [Priorite 1]\n2. [Priorite 2]\n3. [Priorite 3]\n\n## Reunions importantes\n\n- [Date/Heure] - [Type de reunion] - [Participants]\n- [Date/Heure] - [Type de reunion] - [Participants]\n\n## Notes personnelles\n\n[Espace libre pour notes]",
    },
    Template {
        id: "course-sheet",
        name: "Fiche de cours",
        category: "education",
        content: "# FICHE DE COURS\n\n**Matiere:** [Nom de la matiere]\n**Niveau:** [Niveau]\n**Date:** [Date du cours]\n**Professeur:** [Nom]\n**Duree:** [Duree]\n\n## Theme du cours\n\n[Titre principal du chapitre]\n\n## Objectifs pedagogiques\n\nA la fin de ce cours, l'etudiant pourra:\n\n- [Objectif 1]\n- [Objectif 2]\n- [Objectif 3]\n\n## I. Definitions\n\n**[Terme 1]:** [Definition et explication]\n\n**[Terme 2]:** [Definition et explication]\n\n## II. Concepts cles\n\n### 2.1 [Concept 1]\n\n[Explication avec exemples]\n\n### 2.2 [Concept 2]\n\n[Explication avec exemples]\n\n## III. Formules et methodes\n\n```\n[Formule 1]: description\n[Formule 2]: description\n```\n\n## IV. Exemples pratiques\n\n**Exemple 1:** [Enonce]\n\nSolution: [Resolution]\n\n**Exemple 2:** [Enonce]\n\nSolution: [Resolution]\n\n## V. Exercices d'application\n\n1. [Exercice 1]\n2. [Exercice 2]\n3. [Exercice 3]\n\n## VI. Synthese\n\n- Point 1: [Resume]\n- Point 2: [Resume]\n- Point 3: [Resume]\n\n## Ressources supplementaires\n\n- [Livre/Reference]\n- [Site web]\n- [Video/Lien]",
    },
    Template {
        id: "evaluation-grid",
        name: "Grille d'evaluation",
        category: "education",
        content: "# GRILLE D'EVALUATION\n\n**Discipline:** [Nom de la discipline]\n**Evaluateur:** [Nom]\n**Date:** [Date]\n**Periode:** [Periode]\n\n## Candidat/Etudiant\n\n**Nom:** [Nom]\n**Groupe/Classe:** [Groupe]\n**ID:** [Numero]\n\n## Competences a evaluer\n\n| N° | Competence | Description | Niveau 1 (Insuffisant) | Niveau 2 (Adequate) | Niveau 3 (Bon) | Niveau 4 (Excellent) | Score |\n|----|------------|-------------|----------------------|-------------------|----------|---------------------|-------|\n| 1 | [Competence] | [Description] | | | | | |\n| 2 | [Competence] | [Description] | | | | | |\n| 3 | [Competence] | [Description] | | | | | |\n| 4 | [Competence] | [Description] | | | | | |\n| 5 | [Competence] | [Description] | | | | | |\n\n## Criteres specifiques (si applicable)\n\n### Travail ecrit\n\n- Clarte de l'expression: [Score/4]\n- Organisation et structure: [Score/4]\n- Precision technique: [Score/4]\n- Orthographe et grammaire: [Score/4]\n\n### Travail oral (si applicable)\n\n- Clarté de la presentation: [Score/4]\n- Fluidité et assurance: [Score/4]\n- Reponses aux questions: [Score/4]\n- Respect du temps imparti: [Score/4]\n\n## Score global\n\n**Score total:** [Points] / [Points max]\n**Pourcentage:** [%]\n**Appreciation:** [Appreciation]\n\n## Commentaires de l'evaluateur\n\n[Espace pour retours personnalises et suggestions d'amelioration]\n\n## Signature et date\n\nEvaluateur: ___________ Date: ___________\nSignature: ___________\n\n## Visas\n\nDirecteur/Responsable: ___________ Date: ___________",
    },
    Template {
        id: "internal-memo",
        name: "Memorandum interne",
        category: "business",
        content: "# MEMORANDUM\n\n**EMETTEUR:** [Nom et titre]\n**DATE:** [Date]\n**DESTINATAIRE(S):** [Nom(s)]\n**SUJET:** [Sujet du memorandum]\n**CONFIDENTIALITE:** [Public/Confidentiel]\n\n## Resume executif\n\n[Resulume en 2-3 lignes du point principal]\n\n## Contexte\n\n[Explication du contexte et des raisons pour ce memorandum]\n\n## Points clés\n\n1. [Point 1]\n2. [Point 2]\n3. [Point 3]\n\n## Recommandations\n\n- [Recommandation 1]\n- [Recommandation 2]\n- [Recommandation 3]\n\n## Actions requises\n\n| Action | Responsable | Delai | Statut |\n|--------|-------------|-------|--------|\n| [Action 1] | [Nom] | [Date] | |\n| [Action 2] | [Nom] | [Date] | |\n\n## Questions ou clarifications\n\nVeuillez contacter [Nom] a [Email] ou [Telephone]\n\n**Signature:** ___________\n**Tampon d'approbation (si requis):** ___________",
    },
];

#[derive(Serialize)]
pub struct TemplateSummary {
    pub id: &'static str,
    pub name: &'static str,
    pub category: &'static str,
}

#[derive(Serialize)]
pub struct TemplateDetail {
    pub id: &'static str,
    pub name: &'static str,
    pub category: &'static str,
    pub content: &'static str,
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct CreateTemplateRequest {
    pub id: String,
    pub name: String,
    pub category: String,
    pub content: String,
}

/// GET /api/v1/docs/templates — list all templates with metadata
pub async fn list_templates() -> Json<Vec<TemplateSummary>> {
    let summaries: Vec<TemplateSummary> = DEFAULT_TEMPLATES
        .iter()
        .map(|t| TemplateSummary {
            id: t.id,
            name: t.name,
            category: t.category,
        })
        .collect();
    Json(summaries)
}

/// GET /api/v1/docs/templates/:id — get full template content
pub async fn get_template(
    Path(id): Path<String>,
) -> Result<Json<TemplateDetail>, (StatusCode, String)> {
    DEFAULT_TEMPLATES
        .iter()
        .find(|t| t.id == id.as_str())
        .map(|t| {
            Json(TemplateDetail {
                id: t.id,
                name: t.name,
                category: t.category,
                content: t.content,
            })
        })
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                format!("Template '{}' not found", id),
            )
        })
}

/// POST /api/v1/docs/templates — create a template (admin only, in-memory stub)
pub async fn create_template(
    Json(_payload): Json<CreateTemplateRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    // In-memory implementation: custom templates are not persisted between restarts.
    // A future iteration will store them in the database.
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({
            "error": "Persistent custom templates not yet supported. Use default templates.",
        })),
    )
}
