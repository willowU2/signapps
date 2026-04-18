/**
 * Catalog of all supported form field types — used by the builder sidebar
 * to show categorized "add field" buttons (Google Forms / Typeform style).
 */
import {
  Type,
  AlignLeft,
  Mail,
  Hash,
  Phone,
  Link as LinkIcon,
  KeyRound,
  CircleDot,
  CheckSquare,
  ChevronDown,
  Image as ImageIcon,
  ToggleLeft,
  Star,
  BarChart3,
  TrendingUp,
  Calendar,
  Clock,
  CalendarClock,
  Sliders,
  Palette,
  MapPin,
  Upload,
  PenLine,
  Grid3X3,
  ArrowUpDown,
  ShieldCheck,
  Heading1,
  FileText,
  Minus,
  Image as PictureIcon,
  SeparatorHorizontal,
  type LucideIcon,
} from "lucide-react";
import type { FieldType } from "@/lib/api/forms";

export interface FieldTypeDef {
  type: FieldType;
  label: string;
  icon: LucideIcon;
  description: string;
  accent: string; // Tailwind bg color class for the icon chip
}

export interface FieldCategory {
  id: string;
  label: string;
  fields: FieldTypeDef[];
}

export const FIELD_CATEGORIES: FieldCategory[] = [
  {
    id: "text",
    label: "Texte",
    fields: [
      {
        type: "Text",
        label: "Texte court",
        icon: Type,
        description: "Réponse courte sur une ligne",
        accent: "bg-blue-500",
      },
      {
        type: "TextArea",
        label: "Paragraphe",
        icon: AlignLeft,
        description: "Texte long multi-ligne",
        accent: "bg-indigo-500",
      },
      {
        type: "Email",
        label: "E-mail",
        icon: Mail,
        description: "Adresse e-mail validée",
        accent: "bg-amber-500",
      },
      {
        type: "Number",
        label: "Nombre",
        icon: Hash,
        description: "Valeur numérique",
        accent: "bg-emerald-500",
      },
      {
        type: "Phone",
        label: "Téléphone",
        icon: Phone,
        description: "Numéro de téléphone",
        accent: "bg-green-500",
      },
      {
        type: "Url",
        label: "URL",
        icon: LinkIcon,
        description: "Adresse web",
        accent: "bg-sky-500",
      },
      {
        type: "Password",
        label: "Mot de passe",
        icon: KeyRound,
        description: "Champ masqué",
        accent: "bg-slate-500",
      },
    ],
  },
  {
    id: "choice",
    label: "Choix",
    fields: [
      {
        type: "SingleChoice",
        label: "Choix unique",
        icon: CircleDot,
        description: "Sélection radio",
        accent: "bg-violet-500",
      },
      {
        type: "MultipleChoice",
        label: "Cases à cocher",
        icon: CheckSquare,
        description: "Plusieurs réponses possibles",
        accent: "bg-purple-500",
      },
      {
        type: "Dropdown",
        label: "Liste déroulante",
        icon: ChevronDown,
        description: "Menu compact",
        accent: "bg-fuchsia-500",
      },
      {
        type: "ImageChoice",
        label: "Choix d'image",
        icon: ImageIcon,
        description: "Sélection visuelle",
        accent: "bg-pink-500",
      },
      {
        type: "YesNo",
        label: "Oui / Non",
        icon: ToggleLeft,
        description: "Bascule booléenne",
        accent: "bg-rose-500",
      },
      {
        type: "Rating",
        label: "Notation (étoiles)",
        icon: Star,
        description: "Note de 1 à 5 étoiles",
        accent: "bg-yellow-500",
      },
      {
        type: "LinearScale",
        label: "Échelle linéaire",
        icon: BarChart3,
        description: "Échelle numérique min/max",
        accent: "bg-orange-500",
      },
      {
        type: "NPS",
        label: "NPS (0-10)",
        icon: TrendingUp,
        description: "Net Promoter Score",
        accent: "bg-red-500",
      },
    ],
  },
  {
    id: "datetime",
    label: "Date & Heure",
    fields: [
      {
        type: "Date",
        label: "Date",
        icon: Calendar,
        description: "Sélecteur de date",
        accent: "bg-cyan-500",
      },
      {
        type: "Time",
        label: "Heure",
        icon: Clock,
        description: "Sélecteur d'heure",
        accent: "bg-teal-500",
      },
      {
        type: "DateTime",
        label: "Date & Heure",
        icon: CalendarClock,
        description: "Horodatage complet",
        accent: "bg-cyan-600",
      },
    ],
  },
  {
    id: "advanced",
    label: "Avancé",
    fields: [
      {
        type: "Slider",
        label: "Curseur",
        icon: Sliders,
        description: "Valeur sur une plage",
        accent: "bg-blue-600",
      },
      {
        type: "Color",
        label: "Couleur",
        icon: Palette,
        description: "Sélecteur de couleur",
        accent: "bg-gradient-to-br from-pink-500 to-violet-500",
      },
      {
        type: "Address",
        label: "Adresse",
        icon: MapPin,
        description: "Adresse postale complète",
        accent: "bg-lime-600",
      },
      {
        type: "File",
        label: "Fichier",
        icon: Upload,
        description: "Téléversement de fichier",
        accent: "bg-stone-500",
      },
      {
        type: "Signature",
        label: "Signature",
        icon: PenLine,
        description: "Signature manuscrite",
        accent: "bg-neutral-700",
      },
      {
        type: "Matrix",
        label: "Matrice / Grille",
        icon: Grid3X3,
        description: "Grille de choix (lignes × colonnes)",
        accent: "bg-zinc-500",
      },
      {
        type: "Ranking",
        label: "Classement",
        icon: ArrowUpDown,
        description: "Ordre de préférence",
        accent: "bg-amber-600",
      },
      {
        type: "Consent",
        label: "Consentement",
        icon: ShieldCheck,
        description: "Case RGPD / acceptation",
        accent: "bg-emerald-600",
      },
    ],
  },
  {
    id: "content",
    label: "Contenu (affichage)",
    fields: [
      {
        type: "Heading",
        label: "Titre",
        icon: Heading1,
        description: "Titre de section",
        accent: "bg-gray-500",
      },
      {
        type: "Description",
        label: "Texte explicatif",
        icon: FileText,
        description: "Bloc de texte descriptif",
        accent: "bg-gray-400",
      },
      {
        type: "Image",
        label: "Image",
        icon: PictureIcon,
        description: "Image d'illustration",
        accent: "bg-gray-600",
      },
      {
        type: "Divider",
        label: "Séparateur",
        icon: Minus,
        description: "Ligne de séparation",
        accent: "bg-gray-300",
      },
      {
        type: "PageBreak",
        label: "Saut de page",
        icon: SeparatorHorizontal,
        description: "Nouvelle page du formulaire",
        accent: "bg-gray-700",
      },
    ],
  },
];

/** Lookup by FieldType. */
export function fieldDef(t: FieldType): FieldTypeDef | undefined {
  for (const cat of FIELD_CATEGORIES) {
    const f = cat.fields.find((f) => f.type === t);
    if (f) return f;
  }
  return undefined;
}
