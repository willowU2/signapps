/**
 * Built-in document templates for Docs, Sheets, and Slides.
 * Templates are stored in localStorage for user-created ones.
 */

// ── Docs Templates ──────────────────────────────────────────────────────────

export type TemplateDepartment =
  | "general"
  | "rh"
  | "finance"
  | "commercial"
  | "technique"
  | "juridique"
  | "marketing"
  | "direction";

export const DEPARTMENT_LABELS: Record<TemplateDepartment, string> = {
  general: "Général",
  rh: "RH",
  finance: "Finance",
  commercial: "Commercial",
  technique: "Technique",
  juridique: "Juridique",
  marketing: "Marketing",
  direction: "Direction",
};

export interface DocTemplate {
  id: string;
  title: string;
  description: string;
  category: "builtin" | "user";
  department: TemplateDepartment;
  type: "document" | "spreadsheet" | "presentation";
  content: string; // HTML for docs, JSON for sheets/slides
  createdAt: string;
}

export const BUILTIN_DOC_TEMPLATES: DocTemplate[] = [
  {
    id: "doc-compte-rendu",
    title: "Compte-rendu de r\u00e9union",
    description: "Mod\u00e8le de compte-rendu structur\u00e9",
    category: "builtin",
    department: "general" as TemplateDepartment,
    type: "document",
    content: `<h1>Compte-rendu de r\u00e9union</h1>
<p><strong>Date :</strong> ${new Date().toLocaleDateString("fr-FR")}</p>
<p><strong>Lieu :</strong> [Salle / Visioconf\u00e9rence]</p>
<p><strong>Participants :</strong></p>
<ul>
  <li>[Nom 1] - [R\u00f4le]</li>
  <li>[Nom 2] - [R\u00f4le]</li>
  <li>[Nom 3] - [R\u00f4le]</li>
</ul>
<h2>Ordre du jour</h2>
<ol>
  <li>[Point 1]</li>
  <li>[Point 2]</li>
  <li>[Point 3]</li>
</ol>
<h2>D\u00e9cisions prises</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false">[D\u00e9cision 1 - Responsable - \u00c9ch\u00e9ance]</li>
  <li data-type="taskItem" data-checked="false">[D\u00e9cision 2 - Responsable - \u00c9ch\u00e9ance]</li>
</ul>
<h2>Points discut\u00e9s</h2>
<h3>1. [Sujet 1]</h3>
<p>[R\u00e9sum\u00e9 de la discussion...]</p>
<h3>2. [Sujet 2]</h3>
<p>[R\u00e9sum\u00e9 de la discussion...]</p>
<h2>Actions \u00e0 suivre</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false">[Action 1] - [Responsable] - [Date limite]</li>
  <li data-type="taskItem" data-checked="false">[Action 2] - [Responsable] - [Date limite]</li>
</ul>
<h2>Prochaine r\u00e9union</h2>
<p><strong>Date :</strong> [Date]</p>
<p><strong>Sujets pr\u00e9vus :</strong> [Sujets]</p>`,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "doc-proposition-commerciale",
    title: "Proposition commerciale",
    description: "Mod\u00e8le de proposition professionnelle",
    category: "builtin",
    department: "commercial" as TemplateDepartment,
    type: "document",
    content: `<h1>Proposition Commerciale</h1>
<p style="text-align: center"><em>Confidentiel</em></p>
<hr>
<p><strong>Client :</strong> [Nom de l'entreprise]</p>
<p><strong>Contact :</strong> [Nom du contact]</p>
<p><strong>Date :</strong> ${new Date().toLocaleDateString("fr-FR")}</p>
<p><strong>R\u00e9f\u00e9rence :</strong> PROP-${new Date().getFullYear()}-[XXX]</p>
<h2>1. Contexte et objectifs</h2>
<p>[D\u00e9crivez le contexte du projet et les objectifs du client...]</p>
<h2>2. Solution propos\u00e9e</h2>
<p>[D\u00e9tail de la solution technique et fonctionnelle...]</p>
<h3>2.1 P\u00e9rim\u00e8tre</h3>
<ul>
  <li>[Fonctionnalit\u00e9 1]</li>
  <li>[Fonctionnalit\u00e9 2]</li>
  <li>[Fonctionnalit\u00e9 3]</li>
</ul>
<h3>2.2 Livrables</h3>
<ul>
  <li>[Livrable 1]</li>
  <li>[Livrable 2]</li>
</ul>
<h2>3. Planning pr\u00e9visionnel</h2>
<table>
  <tr><th>Phase</th><th>D\u00e9but</th><th>Fin</th><th>Dur\u00e9e</th></tr>
  <tr><td>Cadrage</td><td>[Date]</td><td>[Date]</td><td>2 semaines</td></tr>
  <tr><td>D\u00e9veloppement</td><td>[Date]</td><td>[Date]</td><td>6 semaines</td></tr>
  <tr><td>Recette</td><td>[Date]</td><td>[Date]</td><td>2 semaines</td></tr>
  <tr><td>Mise en production</td><td>[Date]</td><td>[Date]</td><td>1 semaine</td></tr>
</table>
<h2>4. Tarification</h2>
<table>
  <tr><th>Prestation</th><th>Quantit\u00e9</th><th>Prix unitaire</th><th>Total HT</th></tr>
  <tr><td>[Prestation 1]</td><td>[X] jours</td><td>[XXX] \u20ac</td><td>[X XXX] \u20ac</td></tr>
  <tr><td>[Prestation 2]</td><td>[X] jours</td><td>[XXX] \u20ac</td><td>[X XXX] \u20ac</td></tr>
  <tr><td><strong>Total</strong></td><td></td><td></td><td><strong>[XX XXX] \u20ac HT</strong></td></tr>
</table>
<h2>5. Conditions g\u00e9n\u00e9rales</h2>
<p>[Conditions de paiement, validit\u00e9 de l'offre, etc.]</p>`,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "doc-note-service",
    title: "Note de service",
    description: "Communication interne officielle",
    category: "builtin",
    department: "direction" as TemplateDepartment,
    type: "document",
    content: `<p style="text-align: right"><strong>[Nom de l'entreprise]</strong></p>
<p style="text-align: right">[Adresse]</p>
<p style="text-align: right">${new Date().toLocaleDateString("fr-FR")}</p>
<br>
<h1 style="text-align: center">NOTE DE SERVICE</h1>
<p style="text-align: center"><strong>R\u00e9f. :</strong> NS-${new Date().getFullYear()}-[XXX]</p>
<hr>
<p><strong>De :</strong> [Nom de l'\u00e9metteur] - [Fonction]</p>
<p><strong>\u00c0 :</strong> [Destinataires / Service concern\u00e9]</p>
<p><strong>Objet :</strong> [Objet de la note]</p>
<hr>
<p>Madame, Monsieur,</p>
<p>[Corps de la note de service. D\u00e9crivez l'information, la d\u00e9cision ou la consigne \u00e0 communiquer...]</p>
<p>[D\u00e9taillez les modalit\u00e9s d'application, les dates d'effet, etc.]</p>
<p>[Pr\u00e9cisez les cons\u00e9quences pratiques pour les destinataires...]</p>
<p>Je vous remercie de bien vouloir prendre note de ces dispositions et de les appliquer d\u00e8s r\u00e9ception de la pr\u00e9sente note.</p>
<p>Cordialement,</p>
<br>
<p><strong>[Nom et signature]</strong></p>
<p><em>[Fonction]</em></p>`,
    createdAt: "2024-01-01T00:00:00Z",
  },
];

// ── Sheets Templates ────────────────────────────────────────────────────────

export const BUILTIN_SHEET_TEMPLATES: DocTemplate[] = [
  {
    id: "sheet-budget",
    title: "Budget mensuel",
    description: "Suivi des revenus et d\u00e9penses",
    category: "builtin",
    department: "finance" as TemplateDepartment,
    type: "spreadsheet",
    content: JSON.stringify({
      "0_0": "Cat\u00e9gorie",
      "1_0": "Budget pr\u00e9vu",
      "2_0": "D\u00e9penses r\u00e9elles",
      "3_0": "\u00c9cart",
      "0_1": "Loyer",
      "1_1": "1200",
      "2_1": "1200",
      "3_1": "=B2-C2",
      "0_2": "Alimentation",
      "1_2": "400",
      "2_2": "",
      "3_2": "=B3-C3",
      "0_3": "Transport",
      "1_3": "150",
      "2_3": "",
      "3_3": "=B4-C4",
      "0_4": "\u00c9nergie",
      "1_4": "120",
      "2_4": "",
      "3_4": "=B5-C5",
      "0_5": "T\u00e9l\u00e9com",
      "1_5": "60",
      "2_5": "",
      "3_5": "=B6-C6",
      "0_6": "Loisirs",
      "1_6": "200",
      "2_6": "",
      "3_6": "=B7-C7",
      "0_7": "\u00c9pargne",
      "1_7": "300",
      "2_7": "",
      "3_7": "=B8-C8",
      "0_8": "Divers",
      "1_8": "100",
      "2_8": "",
      "3_8": "=B9-C9",
      "0_10": "TOTAL",
      "1_10": "=SUM(B2:B9)",
      "2_10": "=SUM(C2:C9)",
      "3_10": "=B11-C11",
      "0_12": "Revenus",
      "1_12": "Montant",
      "0_13": "Salaire net",
      "1_13": "2800",
      "0_14": "Autres revenus",
      "1_14": "0",
      "0_15": "Total revenus",
      "1_15": "=SUM(B14:B15)",
      "0_17": "Solde du mois",
      "1_17": "=B16-C11",
    }),
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "sheet-suivi-projet",
    title: "Suivi de projet",
    description: "Gestion des t\u00e2ches et jalons",
    category: "builtin",
    department: "technique" as TemplateDepartment,
    type: "spreadsheet",
    content: JSON.stringify({
      "0_0": "T\u00e2che",
      "1_0": "Responsable",
      "2_0": "Statut",
      "3_0": "Priorit\u00e9",
      "4_0": "D\u00e9but",
      "5_0": "Fin",
      "6_0": "Progression",
      "0_1": "Analyse des besoins",
      "1_1": "[Nom]",
      "2_1": "En cours",
      "3_1": "Haute",
      "4_1": "",
      "5_1": "",
      "6_1": "50%",
      "0_2": "Maquettes UI/UX",
      "1_2": "[Nom]",
      "2_2": "\u00c0 faire",
      "3_2": "Haute",
      "4_2": "",
      "5_2": "",
      "6_2": "0%",
      "0_3": "D\u00e9veloppement backend",
      "1_3": "[Nom]",
      "2_3": "\u00c0 faire",
      "3_3": "Moyenne",
      "4_3": "",
      "5_3": "",
      "6_3": "0%",
      "0_4": "D\u00e9veloppement frontend",
      "1_4": "[Nom]",
      "2_4": "\u00c0 faire",
      "3_4": "Moyenne",
      "4_4": "",
      "5_4": "",
      "6_4": "0%",
      "0_5": "Tests unitaires",
      "1_5": "[Nom]",
      "2_5": "\u00c0 faire",
      "3_5": "Moyenne",
      "4_5": "",
      "5_5": "",
      "6_5": "0%",
      "0_6": "Tests int\u00e9gration",
      "1_6": "[Nom]",
      "2_6": "\u00c0 faire",
      "3_6": "Basse",
      "4_6": "",
      "5_6": "",
      "6_6": "0%",
      "0_7": "Documentation",
      "1_7": "[Nom]",
      "2_7": "\u00c0 faire",
      "3_7": "Basse",
      "4_7": "",
      "5_7": "",
      "6_7": "0%",
      "0_8": "Mise en production",
      "1_8": "[Nom]",
      "2_8": "\u00c0 faire",
      "3_8": "Haute",
      "4_8": "",
      "5_8": "",
      "6_8": "0%",
    }),
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "sheet-facture",
    title: "Facture",
    description: "Mod\u00e8le de facture professionnelle",
    category: "builtin",
    department: "finance" as TemplateDepartment,
    type: "spreadsheet",
    content: JSON.stringify({
      "0_0": "FACTURE",
      "3_0": "N\u00b0 FA-2024-001",
      "0_1": "[Votre entreprise]",
      "3_1": "Date :",
      "4_1": new Date().toLocaleDateString("fr-FR"),
      "0_2": "[Adresse]",
      "3_2": "\u00c9ch\u00e9ance :",
      "4_2": "",
      "0_3": "[T\u00e9l / Email]",
      "0_5": "Client :",
      "1_5": "[Nom du client]",
      "0_6": "Adresse :",
      "1_6": "[Adresse du client]",
      "0_8": "D\u00e9signation",
      "1_8": "Quantit\u00e9",
      "2_8": "Prix unitaire HT",
      "3_8": "Total HT",
      "0_9": "[Prestation 1]",
      "1_9": "1",
      "2_9": "500",
      "3_9": "=B10*C10",
      "0_10": "[Prestation 2]",
      "1_10": "2",
      "2_10": "250",
      "3_10": "=B11*C11",
      "0_11": "[Prestation 3]",
      "1_11": "1",
      "2_11": "300",
      "3_11": "=B12*C12",
      "0_13": "",
      "2_13": "Total HT",
      "3_13": "=SUM(D10:D12)",
      "0_14": "",
      "2_14": "TVA (20%)",
      "3_14": "=D14*0.20",
      "0_15": "",
      "2_15": "Total TTC",
      "3_15": "=D14+D15",
      "0_17": "Conditions de paiement : 30 jours fin de mois",
      "0_18": "RIB : [IBAN]",
    }),
    createdAt: "2024-01-01T00:00:00Z",
  },
];

// ── Slides Templates ────────────────────────────────────────────────────────

export const BUILTIN_SLIDE_TEMPLATES: DocTemplate[] = [
  {
    id: "slide-entreprise",
    title: "Pr\u00e9sentation d'entreprise",
    description: "Pr\u00e9senter votre soci\u00e9t\u00e9",
    category: "builtin",
    department: "direction" as TemplateDepartment,
    type: "presentation",
    content: JSON.stringify({
      slides: [
        {
          id: "1",
          elements: [
            {
              type: "text",
              content: "[Nom de l'entreprise]",
              x: 100,
              y: 150,
              width: 800,
              height: 80,
              fontSize: 48,
              fontWeight: "bold",
              textAlign: "center",
            },
            {
              type: "text",
              content: "Pr\u00e9sentation corporate",
              x: 100,
              y: 250,
              width: 800,
              height: 40,
              fontSize: 24,
              textAlign: "center",
              color: "#666",
            },
          ],
          background: "#ffffff",
        },
        {
          id: "2",
          elements: [
            {
              type: "text",
              content: "Notre mission",
              x: 60,
              y: 40,
              width: 800,
              height: 60,
              fontSize: 36,
              fontWeight: "bold",
            },
            {
              type: "text",
              content:
                "[D\u00e9crivez la mission de votre entreprise, sa vision et ses valeurs fondamentales.]",
              x: 60,
              y: 120,
              width: 800,
              height: 200,
              fontSize: 18,
              color: "#444",
            },
          ],
          background: "#ffffff",
        },
        {
          id: "3",
          elements: [
            {
              type: "text",
              content: "Nos chiffres cl\u00e9s",
              x: 60,
              y: 40,
              width: 800,
              height: 60,
              fontSize: 36,
              fontWeight: "bold",
            },
            {
              type: "text",
              content:
                "[X]+ clients\n[X] M\u20ac de CA\n[X] collaborateurs\n[X] pays",
              x: 60,
              y: 130,
              width: 400,
              height: 250,
              fontSize: 24,
              color: "#333",
            },
          ],
          background: "#f8f9fa",
        },
        {
          id: "4",
          elements: [
            {
              type: "text",
              content: "Contact",
              x: 100,
              y: 150,
              width: 800,
              height: 60,
              fontSize: 36,
              fontWeight: "bold",
              textAlign: "center",
            },
            {
              type: "text",
              content:
                "[email@entreprise.com]\n[+33 1 23 45 67 89]\n[www.entreprise.com]",
              x: 100,
              y: 230,
              width: 800,
              height: 120,
              fontSize: 20,
              textAlign: "center",
              color: "#666",
            },
          ],
          background: "#ffffff",
        },
      ],
    }),
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "slide-rapport-trimestriel",
    title: "Rapport trimestriel",
    description: "Bilan et r\u00e9sultats du trimestre",
    category: "builtin",
    department: "direction" as TemplateDepartment,
    type: "presentation",
    content: JSON.stringify({
      slides: [
        {
          id: "1",
          elements: [
            {
              type: "text",
              content: "Rapport trimestriel",
              x: 100,
              y: 130,
              width: 800,
              height: 80,
              fontSize: 48,
              fontWeight: "bold",
              textAlign: "center",
            },
            {
              type: "text",
              content: `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`,
              x: 100,
              y: 230,
              width: 800,
              height: 40,
              fontSize: 28,
              textAlign: "center",
              color: "#2563eb",
            },
          ],
          background: "#ffffff",
        },
        {
          id: "2",
          elements: [
            {
              type: "text",
              content: "R\u00e9sum\u00e9 ex\u00e9cutif",
              x: 60,
              y: 40,
              width: 800,
              height: 60,
              fontSize: 36,
              fontWeight: "bold",
            },
            {
              type: "text",
              content:
                "- [Point cl\u00e9 1]\n- [Point cl\u00e9 2]\n- [Point cl\u00e9 3]",
              x: 60,
              y: 120,
              width: 800,
              height: 200,
              fontSize: 20,
              color: "#444",
            },
          ],
          background: "#ffffff",
        },
        {
          id: "3",
          elements: [
            {
              type: "text",
              content: "Performance financi\u00e8re",
              x: 60,
              y: 40,
              width: 800,
              height: 60,
              fontSize: 36,
              fontWeight: "bold",
            },
            {
              type: "text",
              content:
                "CA : [X] M\u20ac (+[X]%)\nMarge brute : [X]%\nEBITDA : [X] M\u20ac\nR\u00e9sultat net : [X] M\u20ac",
              x: 60,
              y: 120,
              width: 800,
              height: 200,
              fontSize: 20,
              color: "#333",
            },
          ],
          background: "#f0f9ff",
        },
        {
          id: "4",
          elements: [
            {
              type: "text",
              content: "Objectifs Q+1",
              x: 60,
              y: 40,
              width: 800,
              height: 60,
              fontSize: 36,
              fontWeight: "bold",
            },
            {
              type: "text",
              content: "1. [Objectif 1]\n2. [Objectif 2]\n3. [Objectif 3]",
              x: 60,
              y: 120,
              width: 800,
              height: 200,
              fontSize: 20,
              color: "#444",
            },
          ],
          background: "#ffffff",
        },
      ],
    }),
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "slide-pitch-deck",
    title: "Pitch deck",
    description: "Pr\u00e9sentation pour investisseurs",
    category: "builtin",
    department: "commercial" as TemplateDepartment,
    type: "presentation",
    content: JSON.stringify({
      slides: [
        {
          id: "1",
          elements: [
            {
              type: "text",
              content: "[Nom du projet]",
              x: 100,
              y: 120,
              width: 800,
              height: 80,
              fontSize: 52,
              fontWeight: "bold",
              textAlign: "center",
            },
            {
              type: "text",
              content: "[Slogan / Tagline]",
              x: 100,
              y: 220,
              width: 800,
              height: 40,
              fontSize: 24,
              textAlign: "center",
              color: "#7c3aed",
            },
          ],
          background: "#ffffff",
        },
        {
          id: "2",
          elements: [
            {
              type: "text",
              content: "Le probl\u00e8me",
              x: 60,
              y: 40,
              width: 800,
              height: 60,
              fontSize: 36,
              fontWeight: "bold",
              color: "#dc2626",
            },
            {
              type: "text",
              content:
                "[D\u00e9crivez le probl\u00e8me que vous r\u00e9solvez...]",
              x: 60,
              y: 120,
              width: 800,
              height: 200,
              fontSize: 20,
              color: "#444",
            },
          ],
          background: "#fff5f5",
        },
        {
          id: "3",
          elements: [
            {
              type: "text",
              content: "Notre solution",
              x: 60,
              y: 40,
              width: 800,
              height: 60,
              fontSize: 36,
              fontWeight: "bold",
              color: "#16a34a",
            },
            {
              type: "text",
              content: "[D\u00e9crivez votre solution unique...]",
              x: 60,
              y: 120,
              width: 800,
              height: 200,
              fontSize: 20,
              color: "#444",
            },
          ],
          background: "#f0fdf4",
        },
        {
          id: "4",
          elements: [
            {
              type: "text",
              content: "March\u00e9 adressable",
              x: 60,
              y: 40,
              width: 800,
              height: 60,
              fontSize: 36,
              fontWeight: "bold",
            },
            {
              type: "text",
              content:
                "TAM : [X] Mds \u20ac\nSAM : [X] M\u20ac\nSOM : [X] M\u20ac",
              x: 60,
              y: 130,
              width: 800,
              height: 200,
              fontSize: 24,
              color: "#333",
            },
          ],
          background: "#ffffff",
        },
        {
          id: "5",
          elements: [
            {
              type: "text",
              content: "Mod\u00e8le \u00e9conomique",
              x: 60,
              y: 40,
              width: 800,
              height: 60,
              fontSize: 36,
              fontWeight: "bold",
            },
            {
              type: "text",
              content:
                "[SaaS / Marketplace / Freemium...]\n\nPrix : [X]\u20ac/mois\nCAC : [X]\u20ac\nLTV : [X]\u20ac",
              x: 60,
              y: 120,
              width: 800,
              height: 250,
              fontSize: 20,
              color: "#444",
            },
          ],
          background: "#ffffff",
        },
        {
          id: "6",
          elements: [
            {
              type: "text",
              content: "Lev\u00e9e de fonds",
              x: 100,
              y: 120,
              width: 800,
              height: 60,
              fontSize: 40,
              fontWeight: "bold",
              textAlign: "center",
            },
            {
              type: "text",
              content:
                "Montant recherch\u00e9 : [X] M\u20ac\nUtilisation : [D\u00e9veloppement, Recrutement, Marketing]",
              x: 100,
              y: 200,
              width: 800,
              height: 100,
              fontSize: 20,
              textAlign: "center",
              color: "#666",
            },
          ],
          background: "#faf5ff",
        },
      ],
    }),
    createdAt: "2024-01-01T00:00:00Z",
  },
];

// ── User Templates (localStorage) ───────────────────────────────────────────

const USER_TEMPLATES_KEY = "signapps-user-templates";

export function getUserTemplates(): DocTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(USER_TEMPLATES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveUserTemplate(
  template: Omit<DocTemplate, "id" | "category" | "createdAt">,
): DocTemplate {
  const newTemplate: DocTemplate = {
    ...template,
    id: `user-${crypto.randomUUID()}`,
    category: "user",
    createdAt: new Date().toISOString(),
  };
  const templates = getUserTemplates();
  templates.unshift(newTemplate);
  localStorage.setItem(USER_TEMPLATES_KEY, JSON.stringify(templates));
  return newTemplate;
}

export function deleteUserTemplate(id: string): void {
  const templates = getUserTemplates().filter((t) => t.id !== id);
  localStorage.setItem(USER_TEMPLATES_KEY, JSON.stringify(templates));
}

export function getTemplatesForType(
  type: "document" | "spreadsheet" | "presentation",
): DocTemplate[] {
  const builtins =
    type === "document"
      ? BUILTIN_DOC_TEMPLATES
      : type === "spreadsheet"
        ? BUILTIN_SHEET_TEMPLATES
        : BUILTIN_SLIDE_TEMPLATES;
  const user = getUserTemplates().filter((t) => t.type === type);
  return [...builtins, ...user];
}
