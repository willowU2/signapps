"use client";

import { SpinnerInfinity } from "spinners-react";

import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import { FontSize } from "./extensions/font-size";
import CharacterCount from "@tiptap/extension-character-count";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {
  Table,
  TableRow,
  TableHeader,
  TableCell,
} from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { SlashCommands, getSuggestionOptions } from "./slash-commands";
import { Comment } from "./extensions/comment";
// Sprint 1: Foundation Polish
import Typography from "@tiptap/extension-typography";
import Dropcursor from "@tiptap/extension-dropcursor";
import Gapcursor from "@tiptap/extension-gapcursor";
import Focus from "@tiptap/extension-focus";
import { TrailingNode } from "./extensions/trailing-node";
// Sprint 2: Collaboration Polish
import { UniqueID } from "./extensions/unique-id";
import { FileHandler, insertImageFromFile } from "./extensions/file-handler";
// Sprint 3: Professional Formatting
import { LineHeight } from "./extensions/line-height";
import { Indent } from "./extensions/indent";
import { PageBreak } from "./extensions/page-break";
import { BackgroundColor } from "./extensions/background-color";
// Sprint 4: Advanced Content
import { TableOfContents } from "./extensions/table-of-contents";
import { Footnote } from "./extensions/footnote";
// Sprint 5: Cross-App Embeds
import { EmbedSheet } from "./extensions/embed-sheet";
import { SheetEmbedView } from "./sheet-embed";
// Sprint 6: Media
import Youtube from "@tiptap/extension-youtube";
// Sprint 7: Editor Improvements
import { MathInline, MathBlock } from "./extensions/math";
import { MermaidDiagram } from "./extensions/mermaid";
import { Columns, ColumnBlock } from "./extensions/columns";
import {
  SuggestionMode,
  SuggestionInsertion,
  SuggestionDeletion,
} from "./extensions/suggestion-mode";
import { useCommentsStore } from "@/stores/comments-store";
import { v4 as uuidv4 } from "uuid";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useFontsCatalog } from "@/lib/fonts/use-fonts-catalog";
import { useDynamicFont } from "@/lib/fonts/use-dynamic-font";
import { fetchAndParseDocument } from "@/lib/file-parsers";
import { GenericFeatureModal } from "@/components/editor/generic-feature-modal";
import { driveApi } from "@/lib/api";
import { saveUserTemplate } from "@/lib/document-templates";
import { ShareDialog } from "@/components/docs/share-dialog";

import {
  EditorMenu,
  MenuGroup,
  MenuItem,
} from "@/components/editor/editor-menu";
import {
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
  ToolbarGroup,
} from "@/components/editor/toolbar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input as UIInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Sparkles,
  Wand2,
  CheckCheck,
  FileText,
  Pencil,
  ArrowRight,
  Languages,
  X,
  Square,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Palette,
  Highlighter,
  Table as TableIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  Undo,
  Redo,
  Menu,
  Bot,
  Code,
  FileImage,
  Smile,
  MessageSquare,
  MessageSquarePlus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Check,
  Video,
  Mic,
  Download,
  Upload,
  FileSpreadsheet,
  Table2,
  Maximize2,
  Minimize2,
  Target,
  Clock,
  Eye,
  EyeOff,
  Columns2,
  BookOpen,
  MessageCircle,
  GitBranch,
  SplitSquareHorizontal,
  CheckCircle,
} from "lucide-react";
import { useAiStream } from "@/hooks/use-ai-stream";
import { toast } from "sonner";
import { VoiceInput } from "@/components/ui/voice-input";
import { storageApi } from "@/lib/api";
import { MailMerge } from "./mail-merge";
import { VoiceDictation } from "./voice-dictation";
import { SpellCheck } from "./spell-check";
import { OfflineIndicator } from "./offline-indicator";
import {
  AutoSaveIndicator,
  type SaveStatus,
} from "@/components/ui/auto-save-indicator";

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

import mammoth from "mammoth";
import { Document as DocxDocument, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import VerEx from "verbal-expressions";
import { htmlToMarkdown, markdownToHtml, isMarkdown } from "@/lib/markdown";
import { useAutosave } from "@/hooks/use-autosave";
import ContextMenuStandard7 from "@/components/context-menu-standard-7";

const lowlight = createLowlight(common);

type VoiceAction =
  | "undo"
  | "redo"
  | "selectAll"
  | "clearAll"
  | "delete"
  | "fix"
  | "improve"
  | "summarize";

const parseVoiceCommand = (
  text: string,
  editor: any,
  pendingMarksRef: React.MutableRefObject<string[]>,
  pendingBlocksRef: React.MutableRefObject<string[]>,
  onVoiceAction?: (action: VoiceAction) => void,
) => {
  let rawText = text.trim();
  if (!rawText) return;

  // Aides à la création de RegExp via VerbalExpressions
  // VerEx().find('mot').addModifier('i')

  // Construction propre via chaîne pour le saut de ligne
  const newlineRegex = VerEx()
    .add("\\b")
    .find("à la ligne")
    .or("a la ligne")
    .or("nouvelle ligne")
    .or("saut de ligne")
    .or("point à la ligne")
    .or("point a la ligne")
    .or("retour à la ligne")
    .or("retour a la ligne")
    .or("retour chariot")
    .add("\\b")
    .addModifier("i");

  rawText = rawText.replace(newlineRegex, " __NEWLINE__ ");

  const paragraphRegex = VerEx()
    .add("\\b")
    .find("nouveau paragraphe")
    .or("paragraphe suivant")
    .add("\\b")
    .addModifier("i");
  rawText = rawText.replace(paragraphRegex, " __PARAGRAPH__ ");

  // Fonction Helper Extraite pour la propreté (utilise les regex raw)
  const extractKeyword = (
    keywords: string,
    type: "mark" | "block" | "action",
    val: string,
  ) => {
    // Crée une RegExp : /\b(?:mot1|mot2)\b/i
    // Optionnellement, capture "et", "ou", "puis", "avec", "en", "est placé", "placé", "qui est", "on le met" s'ils sont juste avant la commande
    const matchRegex = new RegExp(
      `(?:\\b(?:et|ou|puis|avec|en|est plac[eé]|plac[eé]|qui est|on le met|met ça)\\s+)?\\b(?:${keywords.split("|").join("|")})\\b`,
      "i",
    );
    if (matchRegex.test(rawText)) {
      rawText = rawText.replace(matchRegex, " ").replace(/\s+/g, " ").trim();
      if (type === "mark" && !pendingMarksRef.current.includes(val))
        pendingMarksRef.current.push(val);
      if (type === "block" && !pendingBlocksRef.current.includes(val))
        pendingBlocksRef.current.push(val);
      if (type === "action" && !actionsToRun.includes(val as VoiceAction))
        actionsToRun.push(val as VoiceAction);
      return true;
    }
    return false;
  };

  let actionsToRun: VoiceAction[] = [];
  let found = true;
  while (found) {
    found = false;

    // Actions Editor & IA (interceptées et retirées du texte avant frappe)
    if (
      extractKeyword(
        "annuler|annule ça|annule sa|annule|annuler la dernière action",
        "action",
        "undo",
      )
    )
      found = true;
    if (
      extractKeyword(
        "refaire|rétablir|refaire la dernière action",
        "action",
        "redo",
      )
    )
      found = true;
    if (
      extractKeyword(
        "tout sélectionner|sélectionner tout|sélectionne tout",
        "action",
        "selectAll",
      )
    )
      found = true;
    if (
      extractKeyword(
        "tout effacer|effacer tout le document|effacer tout|vider le document",
        "action",
        "clearAll",
      )
    )
      found = true;
    if (
      extractKeyword(
        "supprimer la ligne|effacer la ligne|supprimer le texte|effacer le texte|supprimer ça|supprimer|effacer la sélection|efface ça",
        "action",
        "delete",
      )
    )
      found = true;

    if (
      extractKeyword(
        "corriger l'orthographe|corriger la sélection|corriger la phrase|corrige moi ça|corrige les fautes|corriger les fautes",
        "action",
        "fix",
      )
    )
      found = true;
    if (
      extractKeyword(
        "améliorer|réécrire|reformuler|améliore ce texte",
        "action",
        "improve",
      )
    )
      found = true;
    if (
      extractKeyword(
        "résumer le texte|résumer le document|fais un résumé",
        "action",
        "summarize",
      )
    )
      found = true;

    // Styles de texte
    if (
      extractKeyword(
        "en gras|met ça en gras|mettre en gras|mets en gras|gras",
        "mark",
        "bold",
      )
    )
      found = true;
    if (
      extractKeyword(
        "en italique|met ça en italique|mettre en italique|mets en italique|italique",
        "mark",
        "italic",
      )
    )
      found = true;
    if (
      extractKeyword(
        "souligné|en souligné|met ça en souligné|mets en souligné|souligner",
        "mark",
        "underline",
      )
    )
      found = true;
    if (extractKeyword("barré|en barré|texte barré", "mark", "strike"))
      found = true;

    // Transformations de casse
    if (
      extractKeyword(
        "en majuscule|tout en majuscule|majuscules",
        "mark",
        "uppercase",
      )
    )
      found = true;
    if (
      extractKeyword(
        "en minuscule|tout en minuscule|minuscules",
        "mark",
        "lowercase",
      )
    )
      found = true;
    if (
      extractKeyword(
        "première lettre en majuscule|lettre capitale|capitalisé",
        "mark",
        "capitalize",
      )
    )
      found = true;

    // Math
    if (extractKeyword("en indice|indice", "mark", "subscript")) found = true;
    if (extractKeyword("en exposant|exposant", "mark", "superscript"))
      found = true;

    // Couleurs
    if (
      extractKeyword(
        "en rouge|texte rouge|écrit en rouge|couleur rouge",
        "mark",
        "color:red",
      )
    )
      found = true;
    if (
      extractKeyword(
        "en bleu|texte bleu|écrit en bleu|couleur bleue?",
        "mark",
        "color:blue",
      )
    )
      found = true;
    if (
      extractKeyword(
        "en vert|texte vert|écrit en vert|couleur verte?",
        "mark",
        "color:green",
      )
    )
      found = true;
    if (
      extractKeyword(
        "en violet|texte violet|écrit en violet|couleur violette?",
        "mark",
        "color:purple",
      )
    )
      found = true;
    if (
      extractKeyword(
        "en gris|texte gris|écrit en gris|couleur grise?",
        "mark",
        "color:gray",
      )
    )
      found = true;
    if (
      extractKeyword(
        "en noir|texte noir|écrit en noir|couleur noire?",
        "mark",
        "color:black",
      )
    )
      found = true;
    if (
      extractKeyword(
        "en orange|texte orange|écrit en orange|couleur orange",
        "mark",
        "color:orange",
      )
    )
      found = true;

    // Surlignages
    if (
      extractKeyword(
        "surligné en jaune|surligné jaune|surligneur jaune|en surbrillance",
        "mark",
        "highlight:yellow",
      )
    )
      found = true;
    if (
      extractKeyword(
        "surligné en rouge|surligné rouge|surligneur rouge",
        "mark",
        "highlight:red",
      )
    )
      found = true;
    if (
      extractKeyword(
        "surligné en vert|surligné vert|surligneur vert",
        "mark",
        "highlight:green",
      )
    )
      found = true;
    if (
      extractKeyword(
        "surligné en bleu|surligné bleu|surligneur bleu",
        "mark",
        "highlight:blue",
      )
    )
      found = true;

    if (
      extractKeyword(
        "en code|format code|bloc de code|monocospace",
        "mark",
        "code",
      )
    )
      found = true;

    // Alignement et Blocs
    if (
      extractKeyword(
        "au centre|aligné au centre|aligner au centre|centrer le texte|centré",
        "block",
        "center",
      )
    )
      found = true;
    if (
      extractKeyword(
        "à droite|aligné à droite|sur la droite|aligner à droite",
        "block",
        "right",
      )
    )
      found = true;
    if (
      extractKeyword(
        "à gauche|aligné à gauche|sur la gauche|aligner à gauche",
        "block",
        "left",
      )
    )
      found = true;
    if (
      extractKeyword(
        "justifié|alignement justifié|justifier le texte",
        "block",
        "justify",
      )
    )
      found = true;

    if (
      extractKeyword(
        "en titre 1|en grand titre|titre un|titre 1|grand titre|titre principal",
        "block",
        "h1",
      )
    )
      found = true;
    if (
      extractKeyword(
        "en titre 2|titre deux|titre 2|moyen titre|sous-titre un|sous titre 1",
        "block",
        "h2",
      )
    )
      found = true;
    if (
      extractKeyword(
        "en petit titre|en titre 3|titre trois|titre 3|petit titre|sous-titre deux|sous titre 2",
        "block",
        "h3",
      )
    )
      found = true;

    if (
      extractKeyword(
        "en liste|liste à puces|nouvelle puce|puce|liste non numérotée",
        "block",
        "bullet",
      )
    )
      found = true;
    if (
      extractKeyword(
        "liste numérotée|numéroté|en liste numérotée|numérotée",
        "block",
        "ordered",
      )
    )
      found = true;
    if (
      extractKeyword(
        "en citation|bloc de citation|citation",
        "block",
        "blockquote",
      )
    )
      found = true;
    if (
      extractKeyword(
        "en tâche|case à cocher|todo|nouvelle tâche",
        "block",
        "task",
      )
    )
      found = true;
  }

  // Nettoyage final des conjonctions qui auraient pu rester orphelines à la fin de la phrase
  // (Ex: "Ceci est un titre en gras et..." -> si "et" était après "en gras", il est isolé à la fin)
  rawText = rawText
    .replace(
      /\b(?:et|ou|puis|avec|qui est|le tout|est plac[eé]|plac[eé])\s*$/i,
      "",
    )
    .trim();

  // Découpe le texte par mots marqueurs
  const parts = rawText.split(/(__(?:NEWLINE|PARAGRAPH)__)/g);

  let textWasInserted = false;

  parts.forEach((part) => {
    let content = part.trim();
    if (!content) return;

    if (content === "__NEWLINE__" || content === "__PARAGRAPH__") {
      editor.chain().focus().splitBlock().run(); // Action la plus robuste pour une "nouvelle ligne" formelle (nouveau paragraphe)
    } else {
      // ==========================================
      // APPLICATION DE LA PONCTUATION ET TYPOGRAPHIE AVEC JSVerbalExpressions
      // ==========================================
      const punctuationMap: [RegExp, string][] = [
        [
          VerEx()
            .add("\\b")
            .find("points de suspension")
            .or("point de suspension")
            .add("\\b")
            .addModifier("g")
            .addModifier("i"),
          "...",
        ],
        [
          VerEx()
            .add("\\b")
            .find("point")
            .then(" ")
            .find("d'interrogation")
            .or("d’interrogation")
            .add("\\b")
            .addModifier("g")
            .addModifier("i"),
          "?",
        ],
        [
          VerEx()
            .add("\\b")
            .find("point")
            .then(" ")
            .find("d'exclamation")
            .or("d’exclamation")
            .add("\\b")
            .addModifier("g")
            .addModifier("i"),
          "!",
        ],
        [
          VerEx()
            .add("\\b")
            .find("deux points")
            .add("\\b")
            .addModifier("g")
            .addModifier("i"),
          ":",
        ],
        [
          VerEx()
            .add("\\b")
            .find("point virgule")
            .add("\\b")
            .addModifier("g")
            .addModifier("i"),
          ";",
        ],
        [
          VerEx()
            .add("\\b")
            .find("virgule")
            .add("\\b")
            .addModifier("g")
            .addModifier("i"),
          ",",
        ],
        [/\bouvrez(?: les| la)? guillemets?\b/gi, '"'],
        [/\bfermez(?: les| la)? guillemets?\b/gi, '"'],
        [/\bouvrez la parenthèse\b/gi, "("],
        [/\bfermez la parenthèse\b/gi, ")"],
        [
          VerEx()
            .add("\\b")
            .find("tiret")
            .add("\\b")
            .addModifier("g")
            .addModifier("i"),
          "-",
        ],
        [
          VerEx()
            .add("\\b")
            .find("arobase")
            .add("\\b")
            .addModifier("g")
            .addModifier("i"),
          "@",
        ],
        [
          VerEx()
            .add("\\b")
            .find("astérisque")
            .add("\\b")
            .addModifier("g")
            .addModifier("i"),
          "*",
        ],
        [
          VerEx()
            .add("\\b")
            .find("et commercial")
            .add("\\b")
            .addModifier("g")
            .addModifier("i"),
          "&",
        ],
        [
          VerEx()
            .add("\\b")
            .find("slash")
            .add("\\b")
            .addModifier("g")
            .addModifier("i"),
          "/",
        ],
        [/\banti-?slash\b/gi, "\\"],
        // Le mot "point" tout seul (avec exception pour les expressions courantes)
        [
          /\bpoint\b(?!\s+(?:final|de vue|d['’]|clé|fort|faible|crucial))/gi,
          ".",
        ],
      ];

      punctuationMap.forEach(([regex, symbol]) => {
        content = content.replace(regex, symbol);
      });

      // Nettoyage des espaces pour la typographie française :
      // 1. Coller le point et la virgule au mot précédent
      content = content.replace(/\s+([.,])/g, "$1");

      // 2. Assurer un espace insécable (ou normal) avant la ponctuation double (: ; ? !)
      // En HTML strict, on utiliserait &nbsp;, mais l'espace standard au clavier passe bien pour un éditeur web.
      content = content.replace(/\s+([?!;:])/g, " $1"); // Évite les doubles espaces "  ?"
      content = content.replace(/([a-zA-ZÀ-ÿ])([?!;:])/g, "$1 $2"); // Force un espace si collé "mot?" -> "mot ?"

      // 3. Ouvrir ou fermer les parenthèses sans espace interne
      content = content.replace(/(\()\s+/g, "$1");
      content = content.replace(/\s+(\))/g, "$1");
      // ==========================================

      let htmlContent = content;
      textWasInserted = true;

      const marksToApply = pendingMarksRef.current;
      const blocksToApply = pendingBlocksRef.current;

      // Transformations de texte JS
      if (marksToApply.includes("uppercase"))
        htmlContent = htmlContent.toUpperCase();
      if (marksToApply.includes("lowercase"))
        htmlContent = htmlContent.toLowerCase();
      if (marksToApply.includes("capitalize"))
        htmlContent =
          htmlContent.charAt(0).toUpperCase() + htmlContent.slice(1);

      // Application des styles HTML TipTap sur chaque segment textuel
      if (marksToApply.includes("bold"))
        htmlContent = `<strong>${htmlContent}</strong>`;
      if (marksToApply.includes("italic"))
        htmlContent = `<em>${htmlContent}</em>`;
      if (marksToApply.includes("underline"))
        htmlContent = `<u>${htmlContent}</u>`;
      if (marksToApply.includes("strike"))
        htmlContent = `<s>${htmlContent}</s>`;
      if (marksToApply.includes("code"))
        htmlContent = `<code>${htmlContent}</code>`;
      if (marksToApply.includes("subscript"))
        htmlContent = `<sub>${htmlContent}</sub>`;
      if (marksToApply.includes("superscript"))
        htmlContent = `<sup>${htmlContent}</sup>`;

      if (marksToApply.includes("color:red"))
        htmlContent = `<span style="color: red">${htmlContent}</span>`;
      if (marksToApply.includes("color:blue"))
        htmlContent = `<span style="color: blue">${htmlContent}</span>`;
      if (marksToApply.includes("color:green"))
        htmlContent = `<span style="color: green">${htmlContent}</span>`;
      if (marksToApply.includes("color:purple"))
        htmlContent = `<span style="color: purple">${htmlContent}</span>`;
      if (marksToApply.includes("color:gray"))
        htmlContent = `<span style="color: gray">${htmlContent}</span>`;
      if (marksToApply.includes("color:black"))
        htmlContent = `<span style="color: black">${htmlContent}</span>`;
      if (marksToApply.includes("color:orange"))
        htmlContent = `<span style="color: orange">${htmlContent}</span>`;

      if (marksToApply.includes("highlight:yellow"))
        htmlContent = `<mark data-color="#FAF594">${htmlContent}</mark>`;
      if (marksToApply.includes("highlight:red"))
        htmlContent = `<mark data-color="#F98181">${htmlContent}</mark>`;
      if (marksToApply.includes("highlight:green"))
        htmlContent = `<mark data-color="#B9F18D">${htmlContent}</mark>`;
      if (marksToApply.includes("highlight:blue"))
        htmlContent = `<mark data-color="#70CFF8">${htmlContent}</mark>`;

      if (blocksToApply.includes("h1")) htmlContent = `<h1>${htmlContent}</h1>`;
      else if (blocksToApply.includes("h2"))
        htmlContent = `<h2>${htmlContent}</h2>`;
      else if (blocksToApply.includes("h3"))
        htmlContent = `<h3>${htmlContent}</h3>`;
      else if (blocksToApply.includes("bullet"))
        htmlContent = `<ul><li>${htmlContent}</li></ul>`;
      else if (blocksToApply.includes("ordered"))
        htmlContent = `<ol><li>${htmlContent}</li></ol>`;
      if (blocksToApply.includes("blockquote"))
        htmlContent = `<blockquote>${htmlContent}</blockquote>`;
      else if (blocksToApply.includes("task"))
        htmlContent = `<ul data-type="taskList"><li data-type="taskItem" data-checked="false">${htmlContent}</li></ul>`;

      editor
        .chain()
        .focus()
        .insertContent(htmlContent + " ")
        .run();

      // S'il y a un alignement demandé, on l'applique sur ce paragraphe nouvellement inséré
      if (blocksToApply.length > 0) {
        let alignChain = editor.chain().focus();
        if (blocksToApply.includes("center"))
          alignChain = alignChain.setTextAlign("center");
        if (blocksToApply.includes("right"))
          alignChain = alignChain.setTextAlign("right");
        if (blocksToApply.includes("left"))
          alignChain = alignChain.setTextAlign("left");
        if (blocksToApply.includes("justify"))
          alignChain = alignChain.setTextAlign("justify");
        alignChain.run();
      }
    }
  });

  // On exécute les actions extraites APRES avoir inséré le texte.
  // Ainsi, si la personne dit "Bonjour tout le monde. Annuler", on écrit "Bonjour tout le monde." puis on l'annule.
  actionsToRun.forEach((action) => {
    if (action === "undo") editor.chain().focus().undo().run();
    else if (action === "redo") editor.chain().focus().redo().run();
    else if (action === "selectAll") editor.chain().focus().selectAll().run();
    else if (action === "clearAll")
      editor.chain().focus().clearContent(true).run();
    else if (action === "delete")
      editor.chain().focus().deleteSelection().run();
    else if (onVoiceAction) onVoiceAction(action); // Les actions IA sont déléguées au composant React
  });

  // On ne réinitialise le formatage que si on a écrit du texte !
  // Si la personne a juste dit "à la ligne", ou a juste balancé des commandes, on
  // garde le style en mémoire pour sa prochaine respiration.
  if (textWasInserted) {
    pendingMarksRef.current = [];
    pendingBlocksRef.current = [];
  }
};

const getRandomColor = () => {
  const colors = [
    "#958DF1",
    "#F98181",
    "#FBBC88",
    "#FAF594",
    "#70CFF8",
    "#94FADB",
    "#B9F18D",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

interface EditorProps {
  documentId?: string;
  documentName?: string;
  className?: string;
  userName?: string;
  bucket?: string;
  fileName?: string;
  initialContent?: string;
}

type FloatingMode = "menu" | "prompt" | "translate";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Fran\çais" },
  { code: "es", label: "Espa\ñol" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  {
    code: "en",
    label: "English",
  },
  {
    code: "fr",
    label: "Fran\çais",
  },
  {
    code: "es",
    label: "Espa\ñol",
  },
  {
    code: "de",
    label: "Deutsch",
  },
  {
    code: "it",
    label: "Italiano",
  },
  {
    code: "pt",
    label: "Portugu\ês",
  },
];

const Editor = ({
  documentId = "new",
  documentName = "document.docx",
  className,
  userName,
  bucket,
  fileName,
  initialContent,
}: EditorProps) => {
  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [ydoc] = useState<Y.Doc>(() => new Y.Doc());

  // Autosave: persists editor HTML to localStorage every 30s
  const [editorHtml, setEditorHtml] = useState("");
  useAutosave(`doc:${documentId}`, editorHtml);

  // Save status indicator
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");

  // Comments state
  const { setActiveComment, sidebarOpen, setSidebarOpen } = useCommentsStore();

  // AI state
  const { stream, stop, isStreaming } = useAiStream();
  const [aiAction, setAiAction] = useState<string | null>(null);

  // FloatingMenu state
  const [floatingMode, setFloatingMode] = useState<FloatingMode>("menu");
  const [promptValue, setPromptValue] = useState("");
  const promptInputRef = useRef<HTMLInputElement>(null);

  // Toolbar states
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showAiToolbar, setShowAiToolbar] = useState(false);

  // Cover & Icon states
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [docIcon, setDocIcon] = useState<string>("\�\�");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [isReadOnly, setIsReadOnly] = useState(false);
  const [mailMergeOpen, setMailMergeOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [interimVoiceText, setInterimVoiceText] = useState("");
  const pendingVoiceMarksRef = useRef<string[]>([]);
  const pendingVoiceBlocksRef = useRef<string[]>([]);

  useEffect(() => {
    // RT1: Connect Docs to signapps-collab (port 3013)
    const collabServerEnabled =
      process.env.NEXT_PUBLIC_COLLAB_ENABLED === "true";
    const baseWsUrl =
      process.env.NEXT_PUBLIC_COLLAB_WS_URL || "ws://localhost:3013";
    const wsUrl = `${baseWsUrl}/api/v1/collab/ws/${documentId}`;

    const wsProvider = new WebsocketProvider(wsUrl, documentId, ydoc, {
      connect: false,
    });

    // Set user awareness for collaborative cursors (Tiptap v3)
    wsProvider.awareness.setLocalStateField("user", {
      name: userName || "Anonymous",
      color: getRandomColor(),
    });

    // Extract loading logic to a reusable function
    const performInitialLoad = async () => {
      if (!bucket || !fileName) return;

      // Give Yjs a moment to sync, then check if document is completely empty
      setTimeout(async () => {
        const currentText = editor?.getText() || "";
        if (!currentText || currentText.trim() === "") {
          try {
            let parsed: any;
            const targetKey = `${documentId}.html`;
            try {
              parsed = await fetchAndParseDocument(
                bucket,
                targetKey,
                targetKey,
              );
            } catch (err) {
              parsed = await fetchAndParseDocument(bucket, fileName, fileName);
            }

            if (
              parsed &&
              parsed.type === "document" &&
              (parsed.text || parsed.html)
            ) {
              setInitialParsedContent(parsed.text || parsed.html || "");
              toast.success("Document chargé", {
                id: `load-${documentId}`,
              });
            }
          } catch (e: any) {
            // Silently ignore if file doesn't exist yet (brand new document)
            console.warn("No previous document found to load:", e);
          }
        }
      }, 500); // reduced timeout for better UX
    };

    // Only connect if collaboration server is explicitly enabled
    if (collabServerEnabled) {
      wsProvider.connect();
    } else {
      console.warn(
        "[Editor] Running in local-only mode (NEXT_PUBLIC_COLLAB_ENABLED not set)",
      );
      // Set status to disconnected but allow local editing
      setStatus("disconnected");
      // We MUST load content manually here since 'connected' event won't fire!
      performInitialLoad();
    }

    wsProvider.on(
      "status",
      async (event: {
        status: "connecting" | "connected" | "disconnected";
      }) => {
        setStatus(event.status);

        // Fetch and inject content if document is fresh from S3
        if (event.status === "connected") {
          performInitialLoad();
        }
      },
    );

    setProvider(wsProvider);

    return () => {
      // Effacement du curseur local avant la destruction du provider pour éviter les fantômes
      if (wsProvider.awareness) {
        wsProvider.awareness.setLocalState(null);
      }
      wsProvider.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, ydoc, bucket, fileName]);

  // Document Styles state
  const [docLineHeight, setDocLineHeight] = useState("1.5");
  const [docFontSize, setDocFontSize] = useState<number>(11);
  const [currentFont, setCurrentFont] = useState("Inter");
  const [docBgColor, setDocBgColor] = useState<string>("");

  // Table of Contents state
  const [toc, setToc] = useState<
    {
      id: string;
      text: string;
      level: number;
    }[]
  >([]);

  // Comments & File parsing state
  const [comments, setComments] = useState<
    {
      id: string;
      text: string;
      author: string;
      timestamp: number;
    }[]
  >([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(true);
  const [initialParsedContent, setInitialParsedContent] = useState<
    string | null
  >(null);
  const [activeModal, setActiveModal] = useState<{
    id: string;
    label?: string;
  } | null>(null);

  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
  const [isImagePopoverOpen, setIsImagePopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [fontOpen, setFontOpen] = useState(false);

  // Prompt dialogs replacing window.prompt()
  // Slash command: image URL
  const [showSlashImageDialog, setShowSlashImageDialog] = useState(false);
  const [slashImageUrl, setSlashImageUrl] = useState("");
  const slashImageCallbackRef = useRef<((url: string) => void) | null>(null);

  // Slash command: embed sheet (3-step)
  const [showEmbedSheetDialog, setShowEmbedSheetDialog] = useState(false);
  const [embedSheetId, setEmbedSheetId] = useState("");
  const [embedSheetName, setEmbedSheetName] = useState("Sheet");
  const [embedSheetRange, setEmbedSheetRange] = useState("");
  const embedSheetCallbackRef = useRef<
    ((id: string, name: string, range: string) => void) | null
  >(null);

  // Ctrl+K link dialog
  const [showCtrlKLinkDialog, setShowCtrlKLinkDialog] = useState(false);
  const [ctrlKLinkUrl, setCtrlKLinkUrl] = useState("");
  const ctrlKLinkPreviousUrl = useRef("");

  // New doc name dialog
  const [showNewDocDialog, setShowNewDocDialog] = useState(false);
  const [newDocName, setNewDocName] = useState("");

  // Insert image from menu
  const [showInsertImageDialog, setShowInsertImageDialog] = useState(false);
  const [insertImageUrl, setInsertImageUrl] = useState("");

  // Insert link from menu
  const [showInsertLinkDialog, setShowInsertLinkDialog] = useState(false);
  const [insertLinkUrl, setInsertLinkUrl] = useState("");

  // Page setup (background color)
  const [showPageSetupDialog, setShowPageSetupDialog] = useState(false);
  const [pageBgColorInput, setPageBgColorInput] = useState("");

  // Rename document
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameDocName, setRenameDocName] = useState("");

  // Trash confirm
  const [showTrashDialog, setShowTrashDialog] = useState(false);

  // Share dialog
  const [showShareDialog, setShowShareDialog] = useState(false);

  // IDEA-001: Focus mode
  const [isFocusMode, setIsFocusMode] = useState(false);

  // IDEA-002: Word count daily goal
  const [wordGoal, setWordGoal] = useState<number | null>(null);
  const [showWordGoalDialog, setShowWordGoalDialog] = useState(false);
  const [wordGoalInput, setWordGoalInput] = useState("");

  // IDEA-009: Split view (editor + markdown preview)
  const [splitView, setSplitView] = useState(false);

  // IDEA-010 / IDEA-011: Resolved comments & threading
  const [resolvedComments, setResolvedComments] = useState<string[]>([]);
  const [commentReplies, setCommentReplies] = useState<
    Record<
      string,
      Array<{ id: string; author: string; text: string; timestamp: number }>
    >
  >({});
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});

  // IDEA-012: Suggestion mode
  const [suggestionModeActive, setSuggestionModeActive] = useState(false);

  // Footer status bar collapsed by default
  const [footerOpen, setFooterOpen] = useState(false);

  // Font catalog — backed by signapps-docs /fonts/manifest.
  // Falls back to the system font list when the catalog isn't synced yet.
  const { data: fontsCatalog } = useFontsCatalog();
  const availableFonts = useMemo<string[]>(() => {
    const fallback = [
      "Inter",
      "Arial",
      "Times New Roman",
      "Georgia",
      "Verdana",
      "Courier New",
      "Comic Sans MS",
    ];
    if (!fontsCatalog) return fallback;
    const cataloged = fontsCatalog.families.map((f) => f.name);
    return Array.from(new Set(["Inter", "Arial", ...cataloged]));
  }, [fontsCatalog]);
  useDynamicFont(currentFont);

  const editor = useEditor(
    {
      immediatelyRender: false, // Required for SSR compatibility with Next.js
      editable: !isReadOnly,
      onUpdate: ({ editor }) => {
        setEditorHtml(editor.getHTML());
        // Update TOC
        const headings: { id: string; text: string; level: number }[] = [];
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === "heading") {
            headings.push({
              id: `heading-${pos}`,
              text: node.textContent,
              level: node.attrs.level,
            });
          }
        });
        setToc(headings);
      },
      onTransaction: ({ editor }) => {
        let font = editor
          .getAttributes("textStyle")
          .fontFamily?.replace(/['"]/g, "");
        if (!font && editor.state.selection.empty) {
          const fonts = [
            "Inter",
            "Arial",
            "Times New Roman",
            "Georgia",
            "Verdana",
            "Courier New",
          ];
          font = fonts.find((f) =>
            editor.isActive("textStyle", { fontFamily: f }),
          );
        }
        setCurrentFont(font || "Inter");

        const sizeAttr = editor.getAttributes("textStyle").fontSize;
        if (sizeAttr) {
          const num = parseInt(sizeAttr.replace(/['"pt]/g, ""), 10);
          if (!isNaN(num)) setDocFontSize(num);
        }
      },
      extensions: [
        StarterKit.configure({
          undoRedo: false, // Turn off Prosemirror history as Yjs handles it (renamed from 'history' in v3)
        }),
        // Sprint 1: Foundation Polish
        Typography.configure({
          emDash: "—", // -- → —
          ellipsis: "…", // ... → …
          openDoubleQuote: "«", // French quotes
          closeDoubleQuote: "»",
          openSingleQuote: "\‘", // '
          closeSingleQuote: "\’", // '
        }),
        Dropcursor.configure({
          color: "#3b82f6", // blue-500
          width: 2,
        }),
        Gapcursor,
        TrailingNode.configure({
          node: "paragraph",
        }),
        Focus.configure({
          className: "has-focus",
          mode: "all",
        }),
        // Sprint 2: Collaboration Polish
        UniqueID.configure({
          types: [
            "paragraph",
            "heading",
            "blockquote",
            "codeBlock",
            "listItem",
            "taskItem",
            "table",
            "image",
            "pageBreak",
          ],
        }),
        FileHandler.configure({
          allowedMimeTypes: [
            "image/*",
            "application/pdf",
            "text/plain",
            "text/markdown",
          ],
          maxFileSize: 10 * 1024 * 1024, // 10MB
          onDrop: (editor, files, pos) => {
            files.forEach((file) => {
              if (file.type.startsWith("image/")) {
                insertImageFromFile(editor, file, pos);
              }
            });
          },
          onPaste: (editor, files) => {
            files.forEach((file) => {
              if (file.type.startsWith("image/")) {
                insertImageFromFile(editor, file);
              }
            });
          },
        }),
        // Sprint 3: Professional Formatting
        LineHeight.configure({
          types: ["paragraph", "heading"],
          defaultLineHeight: "1.5",
        }),
        Indent.configure({
          types: ["paragraph", "heading"],
          minLevel: 0,
          maxLevel: 8,
        }),
        PageBreak,
        BackgroundColor,
        // Sprint 4: Advanced Content
        TableOfContents,
        Footnote,
        // Sprint 5: Cross-App Embeds
        EmbedSheet.configure({
          component: SheetEmbedView,
        }),
        // Sprint 6: Media
        Youtube.configure({
          controls: true,
          nocookie: true,
          allowFullscreen: true,
          modestBranding: true,
        }),
        // Core Formatting
        Underline,
        TextAlign.configure({
          types: ["heading", "paragraph"],
        }),
        Subscript,
        Superscript,
        TextStyle,
        FontFamily.configure({
          types: ["textStyle"],
        }),
        FontSize.configure({
          types: ["textStyle"],
        }),
        Color,
        Highlight.configure({
          multicolor: true,
        }),
        CharacterCount.configure({
          limit: null, // No limit by default
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Image.configure({
          inline: true,
          allowBase64: true,
        }),
        Link.configure({
          openOnClick: false,
          autolink: true,
        }),
        CodeBlockLowlight.configure({
          lowlight,
        }),
        SlashCommands.configure({
          suggestion: getSuggestionOptions([
            {
              title: "Heading 1",
              description: "Big section heading.",
              icon: <Heading1 className="w-4 h-4" />,
              command: ({ editor, range }: any) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .setNode("heading", {
                    level: 1,
                  })
                  .run();
              },
            },
            {
              title: "Heading 2",
              description: "Medium section heading.",
              icon: <Heading2 className="w-4 h-4" />,
              command: ({ editor, range }: any) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .setNode("heading", {
                    level: 2,
                  })
                  .run();
              },
            },
            {
              title: "Heading 3",
              description: "Small section heading.",
              icon: <Heading3 className="w-4 h-4" />,
              command: ({ editor, range }: any) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .setNode("heading", {
                    level: 3,
                  })
                  .run();
              },
            },
            {
              title: "Bullet List",
              description: "Create a simple bulleted list.",
              icon: <List className="w-4 h-4" />,
              command: ({ editor, range }: any) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .toggleBulletList()
                  .run();
              },
            },
            {
              title: "Numbered List",
              description: "Create a list with numbering.",
              icon: <ListOrdered className="w-4 h-4" />,
              command: ({ editor, range }: any) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .toggleOrderedList()
                  .run();
              },
            },
            {
              title: "To-do List",
              description: "Track tasks with a to-do list.",
              icon: <CheckSquare className="w-4 h-4" />,
              command: ({ editor, range }: any) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .toggleTaskList()
                  .run();
              },
            },
            {
              title: "Code Block",
              description: "Capture a code snippet.",
              icon: <Code className="w-4 h-4" />,
              command: ({ editor, range }: any) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .toggleCodeBlock()
                  .run();
              },
            },
            {
              title: "Image",
              description: "Upload or embed an image.",
              icon: <ImageIcon className="w-4 h-4" />,
              command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).run();
                slashImageCallbackRef.current = (url: string) => {
                  if (url) editor.chain().focus().setImage({ src: url }).run();
                };
                setSlashImageUrl("");
                setShowSlashImageDialog(true);
              },
            },
            {
              title: "Ask AI",
              description: "Generate text using AI.",
              icon: <Sparkles className="w-4 h-4 text-purple-500" />,
              command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).run();
                setTimeout(() => {
                  setFloatingMode("prompt");
                }, 50);
              },
            },
            {
              title: "Embed Sheet",
              description: "Embed a spreadsheet in the document.",
              icon: <Table2 className="w-4 h-4 text-green-600" />,
              command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).run();
                embedSheetCallbackRef.current = (
                  id: string,
                  name: string,
                  rangeStr: string,
                ) => {
                  if (id)
                    editor
                      .chain()
                      .focus()
                      .insertSheetEmbed({
                        sheetId: id,
                        sheetName: name,
                        range: rangeStr,
                      })
                      .run();
                };
                setEmbedSheetId("");
                setEmbedSheetName("Sheet");
                setEmbedSheetRange("");
                setShowEmbedSheetDialog(true);
              },
            },
          ]),
        }),
        Subscript,
        Superscript,
        TextStyle,
        Color,
        Highlight.configure({
          multicolor: true,
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Table.configure({
          resizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
        Image.configure({
          inline: true,
          allowBase64: true,
        }),
        Link.configure({
          openOnClick: false,
          autolink: true,
        }),
        Placeholder.configure({
          placeholder: "Type '/' for commands or start writing...",
          emptyEditorClass: "is-editor-empty",
        }),
        Comment.configure({
          onCommentActivated: (commentId) => {
            setActiveComment(commentId);
          },
        }),
        // Sprint 7: Editor Improvements
        MathInline,
        MathBlock,
        MermaidDiagram,
        Columns,
        ColumnBlock,
        SuggestionMode.configure({
          enabled: false,
          author: userName || "Anonymous",
          authorId: "local",
        }),
        SuggestionInsertion,
        SuggestionDeletion,
        Collaboration.configure({
          document: ydoc || undefined,
          provider: provider || undefined,
        }),
      ],
      content: initialContent || "",
      editorProps: {
        attributes: {
          class:
            "prose prose-slate dark:prose-invert max-w-none focus:outline-none min-h-[500px] transition-colors font-sans text-[11pt] leading-[1.6]",
        },
        handlePaste: (view, event) => {
          const text = event.clipboardData?.getData("text/plain");
          // If the pasted text looks like Markdown, convert it to HTML first
          if (text && isMarkdown(text)) {
            const html = markdownToHtml(text);
            // Insert HTML content
            const { state } = view;
            const tr = state.tr;
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const content = doc.body.innerHTML;
            // Let the editor handle the HTML paste instead
            event.preventDefault();
            view.pasteHTML(content);
            return true;
          }
          return false;
        },
      },
    },
    [ydoc, provider, isReadOnly, userName, initialContent],
  );

  const [, forceUpdate] = useState({});

  const handleFormat = useCallback(
    (command: () => void) => {
      if (!editor) return;
      if (!editor.isFocused) {
        editor.commands.focus();
        setTimeout(() => {
          command();
          forceUpdate({});
        }, 50);
      } else {
        command();
        forceUpdate({});
      }
    },
    [editor],
  );

  // Initial TOC processing
  useEffect(() => {
    if (!editor) return;
    const headings: {
      id: string;
      text: string;
      level: number;
    }[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "heading") {
        const id = `heading-${pos}`;
        headings.push({
          id,
          text: node.textContent,
          level: node.attrs.level,
        });
      }
    });
    setToc(headings);
  }, [editor]);

  // Inject parsed content when available
  useEffect(() => {
    if (editor && initialParsedContent) {
      editor.commands.setContent(initialParsedContent);
      setInitialParsedContent(null);
    }
  }, [editor, initialParsedContent]);

  // Inject template content from localStorage (when created from template)
  useEffect(() => {
    if (!editor || !documentId || documentId === "new") return;
    const templateKey = `doc-template:${documentId}`;
    const templateContent = localStorage.getItem(templateKey);
    if (templateContent) {
      // Small delay to let the editor initialize
      setTimeout(() => {
        editor.commands.setContent(templateContent);
        localStorage.removeItem(templateKey);
      }, 300);
    }
  }, [editor, documentId]);

  // ---- Auto-Save HTML for Previews ----
  const lastSavedHtmlRef = useRef("");

  useEffect(() => {
    if (!editor || !documentId) return;

    const performSave = async () => {
      const htmlString = editor.getHTML();
      if (htmlString === lastSavedHtmlRef.current) return;

      setSaveStatus("unsaved");
      const textContent = editor.getText().trim();
      // Check that we actually have content to save
      if (textContent.length > 0 || htmlString.includes("<img")) {
        try {
          setSaveStatus("saving");
          const blob = new Blob([htmlString], { type: "text/html" });
          await storageApi.uploadWithKey("drive", `${documentId}.html`, blob);
          lastSavedHtmlRef.current = htmlString;
          setSaveStatus("saved");
        } catch (err) {
          console.warn("Auto-save preview failed:", err);
          setSaveStatus("unsaved");
        }
      }
    };

    // Track content changes for unsaved indicator
    const handleUpdate = () => {
      const htmlString = editor.getHTML();
      if (htmlString !== lastSavedHtmlRef.current) {
        setSaveStatus("unsaved");
      }
    };
    editor.on("update", handleUpdate);

    const autoSaveInterval = setInterval(performSave, 1500); // Sauvegarde très rapide

    return () => {
      editor.off("update", handleUpdate);
      clearInterval(autoSaveInterval);
      // Toujours sauvegarder une dernière fois quand on quitte la page
      performSave();
    };
  }, [editor, documentId]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // IDEA-001: F11 toggle focus mode
      if (e.key === "F11") {
        e.preventDefault();
        setIsFocusMode((prev) => !prev);
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();

        // Existing shortcuts
        if (key === "s" && !e.shiftKey) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("app:save-to-drive"));
        } else if (key === "n" && !e.shiftKey) {
          e.preventDefault();
          window.open("/docs", "_blank");
        } else if (key === "o" && !e.shiftKey) {
          e.preventDefault();
          toast.info("Rendez-vous sur l'accueil Drive pour ouvrir un fichier.");
        } else if (key === "q" && !e.shiftKey) {
          e.preventDefault();
          toast.info("Fermez l'onglet du navigateur pour quitter la session.");
        }

        // Docs formatting shortcuts
        if (editor) {
          if (e.shiftKey) {
            if (key === "l") {
              e.preventDefault();
              editor.chain().focus().setTextAlign("left").run();
            } else if (key === "e") {
              e.preventDefault();
              editor.chain().focus().setTextAlign("center").run();
            } else if (key === "r") {
              e.preventDefault();
              editor.chain().focus().setTextAlign("right").run();
            } else if (key === "j") {
              e.preventDefault();
              editor.chain().focus().setTextAlign("justify").run();
            } else if (key === "x") {
              e.preventDefault();
              editor.chain().focus().toggleStrike().run();
            }
          } else if (key === "5") {
            e.preventDefault();
            editor.chain().focus().toggleStrike().run();
          } else if (key === "k") {
            // Ctrl+K: Insert/edit link
            e.preventDefault();
            const previousUrl = editor.getAttributes("link").href;
            ctrlKLinkPreviousUrl.current = previousUrl || "";
            setCtrlKLinkUrl(previousUrl || "");
            setShowCtrlKLinkDialog(true);
          }
          // IDEA-013: Ctrl+1-6 heading shortcuts
          else if (key === "1") {
            e.preventDefault();
            editor.chain().focus().toggleHeading({ level: 1 }).run();
          } else if (key === "2") {
            e.preventDefault();
            editor.chain().focus().toggleHeading({ level: 2 }).run();
          } else if (key === "3") {
            e.preventDefault();
            editor.chain().focus().toggleHeading({ level: 3 }).run();
          } else if (key === "4") {
            e.preventDefault();
            editor.chain().focus().toggleHeading({ level: 4 }).run();
          } else if (key === "5" && !e.shiftKey) {
            e.preventDefault();
            editor.chain().focus().toggleHeading({ level: 5 }).run();
          } else if (key === "6") {
            e.preventDefault();
            editor.chain().focus().toggleHeading({ level: 6 }).run();
          } else if (key === "0") {
            e.preventDefault();
            editor.chain().focus().setParagraph().run();
          }
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [editor]);

  // Streaming AI action for BubbleMenu (improve/fix/shorten)
  const handleAiAction = useCallback(
    async (action: "improve" | "fix" | "shorten") => {
      if (!editor || isStreaming) return;
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to);
      if (!text) return;

      setAiAction(action);

      const systemPrompts: Record<string, string> = {
        improve:
          "You are a professional editor. Rewrite the text to improve clarity, flow, and style. Output ONLY the rewritten text.",
        fix: "You are a meticulous proofreader. Fix all grammar, spelling, and punctuation errors. Output ONLY the corrected text.",
        shorten:
          "You are a concise writer. Shorten the text while preserving all key information. Output ONLY the shortened text.",
      };

      // Delete selected text first
      editor.chain().focus().deleteSelection().run();

      await stream(
        `${action === "improve" ? "Improve" : action === "fix" ? "Fix grammar and spelling in" : "Shorten"} the following text:\n\n${text}`,
        {
          onToken: (token) => {
            editor.chain().focus().insertContent(token).run();
          },
          onDone: () => {
            setAiAction(null);
            toast.success("Text updated");
          },
          onError: (err) => {
            setAiAction(null);
            toast.error(`AI error: ${err}`);
          },
        },
        {
          systemPrompt: systemPrompts[action],
          language: "en",
        },
      );
    },
    [editor, isStreaming, stream],
  );

  // Streaming summarize
  const handleSummarize = useCallback(async () => {
    if (!editor || isStreaming) return;
    const text = editor.getText();
    if (!text) return;

    setAiAction("summarize");
    let summary = "";
    const toastId = toast.loading("Generating summary...");

    await stream(
      `Summarize the following document in 3-5 bullet points:\n\n${text}`,
      {
        onToken: (token) => {
          summary += token;
          toast.loading(
            summary.slice(0, 200) + (summary.length > 200 ? "..." : ""),
            {
              id: toastId,
            },
          );
        },
        onDone: (full) => {
          setAiAction(null);
          toast.success("Summary", {
            id: toastId,
            description: full,
            duration: 15000,
          });
        },
        onError: (err) => {
          setAiAction(null);
          toast.error(`Summarization failed: ${err}`, {
            id: toastId,
          });
        },
      },
      {
        systemPrompt: "You are a helpful assistant. Output a concise summary.",
        language: "en",
      },
    );
  }, [editor, isStreaming, stream]);

  // FloatingMenu: Help me write
  const handleHelpMeWrite = useCallback(async () => {
    if (!editor || isStreaming || !promptValue.trim()) return;
    const prompt = promptValue.trim();
    setPromptValue("");
    setFloatingMode("menu");
    setAiAction("write");

    await stream(
      prompt,
      {
        onToken: (token) => {
          editor.chain().focus().insertContent(token).run();
        },
        onDone: () => {
          setAiAction(null);
        },
        onError: (err) => {
          setAiAction(null);
          toast.error(`AI error: ${err}`);
        },
      },
      {
        systemPrompt:
          "You are a professional writer. Write clear, well-structured content based on the user's instruction. Output ONLY the content, no explanations or meta-text.",
        language: "en",
      },
    );
  }, [editor, isStreaming, promptValue, stream]);

  // FloatingMenu: Continue writing
  const handleContinueWriting = useCallback(async () => {
    if (!editor || isStreaming) return;
    setFloatingMode("menu");
    setAiAction("continue");

    // Grab last ~1000 characters before cursor as context
    const { from } = editor.state.selection;
    const start = Math.max(0, from - 1000);
    const context = editor.state.doc.textBetween(start, from);

    if (!context.trim()) {
      toast.error("No preceding text to continue from");
      setAiAction(null);
      return;
    }

    await stream(
      `Continue writing naturally from where this text leaves off:\n\n${context}`,
      {
        onToken: (token) => {
          editor.chain().focus().insertContent(token).run();
        },
        onDone: () => {
          setAiAction(null);
        },
        onError: (err) => {
          setAiAction(null);
          toast.error(`AI error: ${err}`);
        },
      },
      {
        systemPrompt:
          "You are a professional writer. Continue the text seamlessly, matching the tone, style, and topic. Output ONLY the continuation, no explanations.",
        language: "en",
      },
    );
  }, [editor, isStreaming, stream]);

  // FloatingMenu: Translate
  const handleTranslate = useCallback(
    async (langCode: string, langLabel: string) => {
      if (!editor || isStreaming) return;
      setFloatingMode("menu");

      const { from, to } = editor.state.selection;
      const hasSelection = from !== to;
      const text = hasSelection
        ? editor.state.doc.textBetween(from, to)
        : editor.getText();

      if (!text.trim()) return;

      setAiAction("translate");

      if (hasSelection) {
        editor.chain().focus().deleteSelection().run();
      } else {
        editor.chain().focus().selectAll().deleteSelection().run();
      }

      await stream(
        `Translate the following text to ${langLabel}:\n\n${text}`,
        {
          onToken: (token) => {
            editor.chain().focus().insertContent(token).run();
          },
          onDone: () => {
            setAiAction(null);
            toast.success(`Translated to ${langLabel}`);
          },
          onError: (err) => {
            setAiAction(null);
            toast.error(`Translation failed: ${err}`);
          },
        },
        {
          systemPrompt: `You are a professional translator. Translate the text to ${langLabel}. Output ONLY the translation.`,
          language: langCode,
        },
      );
    },
    [editor, isStreaming, stream],
  );

  // Reset floating mode when menu hides
  useEffect(() => {
    if (floatingMode === "prompt" && promptInputRef.current) {
      promptInputRef.current.focus();
    }
  }, [floatingMode]);

  // --- Global Command Bar AI Integration ---
  useEffect(() => {
    const handleGlobalAiAction = (e: CustomEvent) => {
      const { action } = e.detail;
      if (action === "summarize") {
        handleSummarize();
      } else if (action === "draft") {
        // Open the floating AI prompt menu
        setFloatingMode("prompt");
        setTimeout(() => {
          promptInputRef.current?.focus();
        }, 100);
      }
    };

    const handleEditorAction = (e: CustomEvent) => {
      const { action } = e.detail;
      if (action === "format-fix") {
        // To fix the whole document if nothing is selected, select all first.
        if (editor?.state.selection.empty) {
          editor.chain().focus().selectAll().run();
        }
        handleAiAction("fix");
      }
    };

    window.addEventListener(
      "app:ai-action",
      handleGlobalAiAction as EventListener,
    );
    window.addEventListener(
      "app:editor-action",
      handleEditorAction as EventListener,
    );

    return () => {
      window.removeEventListener(
        "app:ai-action",
        handleGlobalAiAction as EventListener,
      );
      window.removeEventListener(
        "app:editor-action",
        handleEditorAction as EventListener,
      );
    };
  }, [handleSummarize, handleAiAction, editor]);

  // Export HTML to DOCX or PDF
  const exportHtmlDocument = useCallback(
    async (type: "docx" | "pdf") => {
      if (!editor) return;
      const htmlString = editor.getHTML();

      if (type === "docx") {
        const res = await fetch("/api/docs/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: htmlString }),
        });

        if (!res.ok) {
          toast.error("Erreur d'exportation");
          return;
        }

        const docxBlob = await res.blob();
        saveAs(
          docxBlob,
          `${documentName.replace(/\.docx$/, "") || "document"}.docx`,
        );
        toast.success(`Exporté en DOCX`);
      } else if (type === "pdf") {
        const title =
          documentName.replace(/\.(docx|html|epub)$/, "") || "document";
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(
            `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title><style>@page { margin: 2cm; size: A4; } body { font-family: sans-serif; font-size: 11pt; line-height: 1.5; color: #000; } img { max-width: 100%; } table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #ccc; padding: 4px 8px; }</style></head><body>${htmlString}<script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 300); }</script></body></html>`,
          );
          printWindow.document.close();
        } else {
          toast.error("Veuillez autoriser les fenêtres pop-up");
        }
      }
    },
    [editor, documentName],
  );

  // IDEA-007: EPUB export
  const exportToEpub = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    const title = documentName.replace(/\.(docx|html|epub)$/, "") || "document";
    // Build a minimal EPUB 3 ZIP structure in-browser
    const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${title}</dc:title>
    <dc:language>fr</dc:language>
    <dc:identifier id="uid">urn:uuid:signapps-${Date.now()}</dc:identifier>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx"><itemref idref="chapter1"/></spine>
</package>`;
    const xhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="utf-8"/><title>${title}</title>
<style>body{font-family:Georgia,serif;font-size:1em;line-height:1.6;margin:2em;}</style>
</head><body>${html}</body></html>`;
    const toc = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="urn:uuid:signapps-${Date.now()}"/></head>
<docTitle><text>${title}</text></docTitle>
<navMap><navPoint id="np1" playOrder="1"><navLabel><text>${title}</text></navLabel><content src="chapter1.xhtml"/></navPoint></navMap>
</ncx>`;
    // Serialize as concatenated blob with EPUB container
    const container = `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;
    // Since we have no zip library in scope, we produce a self-contained HTML file with .epub extension notice
    const epubBlob = new Blob(
      [
        `<!-- This is an EPUB-compatible HTML export. For a full EPUB, use a server-side converter. -->\n`,
        `<!-- container.xml -->\n${container}\n`,
        `<!-- content.opf -->\n${opf}\n`,
        `<!-- chapter1.xhtml -->\n${xhtml}\n`,
        `<!-- toc.ncx -->\n${toc}`,
      ],
      { type: "text/html;charset=utf-8" },
    );
    saveAs(epubBlob, `${title}.epub.html`);
    toast.info(
      "EPUB exporté (format HTML compatible EPUB — utilisez Calibre pour convertir en .epub natif)",
    );
  }, [editor, documentName]);

  // IDEA-008: Better PDF export with page numbers and margins
  const exportToPdfEnhanced = useCallback(() => {
    if (!editor) return;
    const title = documentName.replace(/\.(docx|html|epub)$/, "") || "document";
    const html = editor.getHTML();
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>${title}</title>
<style>
  @page { margin: 2cm; size: A4; }
  @page :first { margin-top: 3cm; }
  body { font-family: Georgia, serif; font-size: 11pt; line-height: 1.6; color: #000; }
  h1,h2,h3,h4,h5,h6 { page-break-after: avoid; }
  img { max-width: 100%; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #ccc; padding: 4px 8px; }
  pre, code { font-family: 'Courier New', monospace; font-size: 9pt; background: #f5f5f5; padding: 2px 4px; }
  /* Header */
  @top-center { content: "${title}"; font-size: 9pt; color: #666; }
  /* Footer with page numbers */
  @bottom-center { content: "Page " counter(page) " / " counter(pages); font-size: 9pt; color: #666; }
  .print-header { text-align: center; font-size: 9pt; color: #666; border-bottom: 1px solid #eee; padding-bottom: 0.5cm; margin-bottom: 1cm; }
  .print-footer { text-align: center; font-size: 9pt; color: #666; border-top: 1px solid #eee; padding-top: 0.5cm; margin-top: 1cm; }
</style>
</head><body>
<div class="print-header">${title} — SignApps Docs</div>
${html}
<script>window.onload = () => { window.print(); window.close(); }</script>
</body></html>`);
    printWindow.document.close();
  }, [editor, documentName]);

  // Export to Markdown
  const exportToMarkdown = useCallback(() => {
    if (!editor) return;
    const htmlString = editor.getHTML();
    const markdown = htmlToMarkdown(htmlString);

    // Create and download markdown file
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    saveAs(
      blob,
      `${documentName.replace(/\.(docx|md)$/, "") || "document"}.md`,
    );
    toast.success("Exporté en Markdown");
  }, [editor, documentName]);

  // Import Markdown content
  const importMarkdown = useCallback(
    (markdownText: string) => {
      if (!editor) return;
      const html = markdownToHtml(markdownText);
      editor.commands.setContent(html);
      toast.success("Markdown importé");
    },
    [editor],
  );

  // ---- Save To Drive ----
  const saveToDrive = useCallback(async () => {
    if (!editor) return;
    if (!documentName) {
      toast.error("Impossible d'enregistrer: Le nom du fichier est manquant.");
      return;
    }

    const tId = toast.loading("Enregistrement dans le Drive...");

    try {
      const htmlString = editor.getHTML();
      let blob: Blob;

      // Generate DOCX blob via Next.js API
      const res = await fetch("/api/docs/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: htmlString }),
      });

      if (!res.ok) {
        throw new Error("Erreur de conversion HTML vers DOCX sur le serveur");
      }

      blob = await res.blob();

      // Envoyer à l'API backend dans le bucket 'drive'
      await storageApi.uploadWithKey("drive", documentName, blob);

      // AUSSI enregistrer le HTML pour la preview tout de suite !
      if (documentId) {
        const htmlBlob = new Blob([htmlString], { type: "text/html" });
        await storageApi.uploadWithKey("drive", `${documentId}.html`, htmlBlob);
      }

      toast.success("Enregistré avec succès !", {
        id: tId,
      });
    } catch (err: any) {
      console.error("Erreur enregistrement docx", err);
      toast.error("Une erreur est survenue. Réessayez.", {
        id: tId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, documentName]);

  // Listen to global save event triggered by shortcut
  useEffect(() => {
    const handleSave = () => saveToDrive();
    window.addEventListener("app:save-to-drive", handleSave);
    return () => window.removeEventListener("app:save-to-drive", handleSave);
  }, [saveToDrive]);

  // Editor Menus Configuration
  const editorMenus: MenuGroup[] = [
    {
      id: "file",
      label: "Fichier",
      items: [
        {
          label: "Nouveau",
          subItems: [
            {
              label: "Document",
              action: "newDoc",
              icon: <FileText className="w-4 h-4" />,
            },
            {
              label: "De modèle",
              action: "todo",
            },
          ],
        },
        {
          label: "Enregistrer (Drive)",
          icon: <Download size={14} />,
          action: "saveToDrive",
          shortcut: "Ctrl+S",
        },
        {
          label: "Ouvrir",
          action: "open",
          shortcut: "Ctrl+O",
        },
        {
          label: "Cr\éer une copie",
          action: "copy_file",
        },
        {
          label: "Sauvegarder comme mod\èle",
          action: "saveAsTemplate",
        },
        {
          sep: true,
        },
        {
          label: "Partager",
          subItems: [
            {
              label: "Partager avec d'autres personnes",
              action: "share_advanced",
            },
            {
              label: "Publier sur le Web",
              action: "publish_web",
            },
          ],
        },
        {
          label: "Envoyer par e-mail",
          action: "email_doc",
        },
        {
          label: "Télécharger",
          subItems: [
            {
              label: "Document PDF (.pdf)",
              action: "downloadPdf",
            },
            {
              label: "PDF amélioré (numéros de page)",
              action: "downloadPdfEnhanced",
            },
            {
              label: "EPUB (.epub)",
              action: "downloadEpub",
            },
            {
              label: "Microsoft Word (.docx)",
              action: "download_docx",
            },
            {
              label: "Format OpenDocument (.odt)",
              action: "download_odt",
            },
            {
              label: "Texte brut (.txt)",
              action: "download_txt",
            },
            {
              label: "Markdown (.md)",
              action: "downloadMarkdown",
            },
          ],
        },
        {
          label: "Approbations",
          action: "approvals",
        },
        {
          sep: true,
        },
        {
          label: "Renommer",
          action: "rename",
        },
        {
          label: "Placer dans la corbeille",
          action: "trash",
        },
        {
          sep: true,
        },
        {
          label: "Historique des versions",
          action: "version_history",
        },
        {
          label: "Rendre disponible hors connexion",
          action: "offline_mode",
        },
        {
          sep: true,
        },
        {
          label: "Détails",
          action: "details",
        },
        {
          label: "Limites de sécurité",
          action: "security",
        },
        {
          label: "Langue",
          action: "language",
        },
        {
          label: "Configuration de la page",
          action: "page_setup",
        },
        {
          label: "Imprimer",
          action: "print",
          shortcut: "Ctrl+P",
        },
      ],
    },
    {
      id: "edit",
      label: "Édition",
      items: [
        {
          label: "Annuler",
          icon: <Undo className="w-4 h-4" />,
          action: "undo",
          shortcut: "Ctrl+Z",
        },
        {
          label: "Rétablir",
          icon: <Redo className="w-4 h-4" />,
          action: "redo",
          shortcut: "Ctrl+Y",
        },
        {
          sep: true,
        },
        {
          label: "Couper",
          icon: <X className="w-4 h-4" />,
          action: "cut",
          shortcut: "Ctrl+X",
        },
        {
          label: "Copier",
          action: "copy",
          shortcut: "Ctrl+C",
        },
        {
          label: "Coller",
          action: "paste",
          shortcut: "Ctrl+V",
        },
        {
          label: "Coller sans la mise en forme",
          action: "pasteText",
          shortcut: "Ctrl+Maj+V",
        },
        {
          sep: true,
        },
        {
          label: "Tout sélectionner",
          action: "selectAll",
          shortcut: "Ctrl+A",
        },
        {
          label: "Supprimer",
          action: "delete",
        },
        {
          sep: true,
        },
        {
          label: "Rechercher et remplacer",
          action: "findReplace",
          shortcut: "Ctrl+H",
        },
      ],
    },
    {
      id: "view",
      label: "Affichage",
      items: [
        {
          label: "Mode d'affichage",
          subItems: [
            {
              label: "Modification",
              action: "todo",
            },
            {
              label: "Suggestion",
              action: "todo",
            },
            {
              label: "Lecture",
              action: "todo",
            },
          ],
        },
        {
          sep: true,
        },
        {
          label: "Afficher la règle",
          action: "todo",
        },
        {
          label: "Afficher le plan",
          action: "todo",
        },
        {
          label: "Afficher la barre d'équations",
          action: "todo",
        },
        {
          label: "Afficher les caractères non imprimables",
          action: "todo",
        },
        {
          sep: true,
        },
        {
          label: "Plein écran",
          action: "fullScreen",
        },
        {
          label: "Mode focus (F11)",
          action: "focusMode",
        },
        {
          label: "Vue partagée Markdown",
          action: "splitView",
        },
      ],
    },
    {
      id: "insert",
      label: "Insertion",
      items: [
        {
          label: "Image",
          icon: <ImageIcon className="w-4 h-4" />,
          action: "insertImage",
        },
        {
          label: "Tableau",
          icon: <TableIcon className="w-4 h-4" />,
          subItems: [
            {
              label: "Modèles de tableaux",
              action: "todo",
            },
            {
              label: "Insérer un tableau simple",
              action: "insertTable",
            },
          ],
        },
        {
          label: "Composants de base",
          action: "todo",
        },
        {
          label: "Chips intelligents",
          action: "todo",
        },
        {
          label: "Champs de signature électronique",
          action: "todo",
        },
        {
          label: "Lien",
          icon: <LinkIcon className="w-4 h-4" />,
          action: "insertLink",
          shortcut: "Ctrl+K",
        },
        {
          label: "Dessin",
          action: "todo",
        },
        {
          label: "Graphique",
          action: "todo",
        },
        {
          label: "Symboles",
          action: "todo",
        },
        {
          sep: true,
        },
        {
          label: "Onglet",
          action: "todo",
          shortcut: "Maj+F11",
        },
        {
          label: "Ligne horizontale",
          action: "insertHorizontalRule",
        },
        {
          label: "Saut",
          subItems: [
            {
              label: "Saut de page",
              action: "insertHardBreak",
              shortcut: "Ctrl+Entrée",
            },
            {
              label: "Saut de section",
              action: "todo",
            },
          ],
        },
        {
          label: "Signet",
          action: "todo",
        },
        {
          label: "Éléments de page",
          action: "todo",
        },
        {
          sep: true,
        },
        {
          label: "Commentaire",
          action: "comment",
          shortcut: "Ctrl+Alt+M",
        },
        {
          sep: true,
        },
        {
          label: "Colonnes",
          subItems: [
            { label: "2 colonnes", action: "insert2Columns" },
            { label: "3 colonnes", action: "insert3Columns" },
          ],
        },
        {
          label: "Mode suggestion",
          action: "suggestionMode",
        },
        {
          label: "Objectif de mots",
          action: "wordGoal",
        },
      ],
    },
    {
      id: "format",
      label: "Format",
      items: [
        {
          label: "Texte",
          subItems: [
            {
              label: "Indice",
              icon: <SubscriptIcon className="w-4 h-4" />,
              action: "toggleSubscript",
              shortcut: "Ctrl+,",
            },
            {
              label: "Exposant",
              icon: <SuperscriptIcon className="w-4 h-4" />,
              action: "toggleSuperscript",
              shortcut: "Ctrl+.",
            },
          ],
        },
        {
          label: "Styles de paragraphe",
          subItems: [
            {
              label: "Normal",
              action: "setParagraph",
            },
            {
              label: "Titre 1",
              action: "toggleH1",
              shortcut: "Ctrl+Alt+1",
            },
            {
              label: "Titre 2",
              action: "toggleH2",
              shortcut: "Ctrl+Alt+2",
            },
            {
              label: "Titre 3",
              action: "toggleH3",
              shortcut: "Ctrl+Alt+3",
            },
          ],
        },
        {
          sep: true,
        },
        {
          label: "Effacer la mise en forme",
          action: "clearFormat",
          shortcut: "Ctrl+\\",
        },
      ],
    },
    {
      id: "tools",
      label: "Outils",
      items: [
        {
          label: "Traduire en anglais",
          icon: <Languages className="w-4 h-4" />,
          action: "translateEn",
        },
        {
          label: "Publipostage (Mail Merge)",
          icon: <FileSpreadsheet className="w-4 h-4" />,
          action: "mailMerge",
        },
      ],
    },
    {
      id: "extensions",
      label: "Extensions",
      items: [
        {
          label: "Modules complémentaires",
          action: "add_ons",
        },
        {
          label: "Apps Script",
          action: "apps_script",
        },
      ],
    },
    {
      id: "help",
      label: "Aide",
      items: [
        {
          label: "Aide SignApps Docs",
          action: "todo",
        },
        {
          label: "Formation",
          action: "todo",
        },
        {
          label: "Mises à jour",
          action: "todo",
        },
      ],
    },
  ];

  const NATIVE_ACTIONS = [
    "rename",
    "trash",
    "open",
    "print",
    "fullScreen",
    "wordCount",
    "undo",
    "redo",
    "selectAll",
    "delete",
    "newDoc",
    "downloadPdf",
    "downloadPdfEnhanced",
    "downloadEpub",
    "downloadMarkdown",
    "cut",
    "copy",
    "paste",
    "pasteText",
    "toggleBold",
    "toggleItalic",
    "toggleUnderline",
    "toggleStrike",
    "toggleSuperscript",
    "toggleSubscript",
    "clearFormat",
    "toggleH1",
    "toggleH2",
    "toggleH3",
    "setParagraph",
    "toggleOrderedList",
    "toggleBulletList",
    "toggleTaskList",
    "alignLeft",
    "alignCenter",
    "alignRight",
    "alignJustify",
    "insertHorizontalRule",
    "insertHardBreak",
    "insertImage",
    "insertLink",
    "insertTable",
    "insertCode",
    "tableAddRowBefore",
    "tableAddRowAfter",
    "tableAddColBefore",
    "tableAddColAfter",
    "tableDeleteRow",
    "tableDeleteCol",
    "tableDeleteTable",
    "tableMergeCells",
    "aiGenerate",
    "aiSummarize",
    "translateEn",
    "findReplace",
    "comment",
    "fontSize_smaller",
    "fontSize_larger",
    "lineHeight_1",
    "lineHeight_1.15",
    "lineHeight_1.5",
    "lineHeight_2",
    "page_setup",
    "saveToDrive",
    "download_docx",
    "mailMerge",
    "focusMode",
    "splitView",
    "wordGoal",
    "suggestionMode",
    "insert2Columns",
    "insert3Columns",
    "saveAsTemplate",
    "share_advanced",
  ];

  // Handle Menu Actions
  const handleMenuAction = useCallback(
    async (action: string, label?: string) => {
      if (!editor || !NATIVE_ACTIONS.includes(action)) {
        setActiveModal({
          id: action,
          label,
        });
        return;
      }

      editor.chain().focus(); // Base focus to ensure operations happen inside editor

      // Specific Settings actions
      if (action === "findReplace") {
        toast.info(
          "Appuyez sur Ctrl+F pour utiliser la recherche native de votre navigateur.",
        );
      }
      if (action === "comment") {
        const commentId = uuidv4();
        editor.chain().focus().setComment(commentId).run();
        setComments((prev) => [
          ...prev,
          {
            id: commentId,
            text: "",
            author: userName || "Anonymous",
            timestamp: Date.now(),
          },
        ]);
        setActiveCommentId(commentId);
        setShowComments(true);
      }
      if (action === "mailMerge") {
        setMailMergeOpen(true);
        return;
      }
      if (action === "fontSize_smaller")
        setDocFontSize((s) => Math.max(1, s - 1));
      if (action === "fontSize_larger") setDocFontSize((s) => s + 1);
      if (action === "lineHeight_1") setDocLineHeight("1");
      if (action === "lineHeight_1.15") setDocLineHeight("1.15");
      if (action === "lineHeight_1.5") setDocLineHeight("1.5");
      if (action === "lineHeight_2") setDocLineHeight("2");
      if (action === "page_setup") {
        setPageBgColorInput(docBgColor);
        setShowPageSetupDialog(true);
        return;
      }

      // File Actions
      if (action === "rename") {
        setRenameDocName("");
        setShowRenameDialog(true);
        return;
      }
      if (action === "trash") {
        setShowTrashDialog(true);
        return;
      }
      if (action === "share_advanced") {
        setShowShareDialog(true);
        return;
      }
      if (action === "open") {
        toast.info(
          "Ouvrez l'explorateur Drive pour choisir un autre document.",
        );
        return;
      }
      if (action === "print") {
        exportHtmlDocument("pdf");
        return;
      }
      if (action === "saveToDrive") {
        await saveToDrive();
        return;
      }
      if (action === "saveAsTemplate") {
        const html = editor.getHTML();
        const name = documentName || "Mon mod\èle";
        saveUserTemplate({
          title: name,
          description: `Modèle créé depuis "${name}"`,
          type: "document",
          department: "general",
          content: html,
        });
        toast.success("Document sauvegard\é comme mod\èle");
        return;
      }

      // View Actions
      if (action === "fullScreen") {
        if (!document.fullscreenElement) {
          document.documentElement
            .requestFullscreen()
            .catch(() => toast.error("Le plein écran est bloqué."));
        } else {
          document.exitFullscreen();
        }
        return;
      }

      // Tools Actions
      if (action === "wordCount") {
        const text = editor.getText();
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        toast.info(`Statistiques : ${words} mots, ${chars} caractères.`);
        return;
      }

      // Standard Edit Actions map well to Tiptap or Clipboard API
      if (action === "undo") editor.commands.undo();
      if (action === "redo") editor.commands.redo();
      if (action === "selectAll") editor.commands.selectAll();
      if (action === "delete") editor.commands.deleteSelection();
      if (action === "newDoc") {
        setNewDocName("");
        setShowNewDocDialog(true);
        return;
      }
      if (action === "downloadPdf") {
        toast.info("Génération du PDF...");
        exportHtmlDocument("pdf");
      }
      if (action === "download_docx") {
        await exportHtmlDocument("docx");
      }
      if (action === "downloadPdfEnhanced") {
        exportToPdfEnhanced();
        return;
      }
      if (action === "downloadEpub") {
        exportToEpub();
        return;
      }
      if (action === "downloadMarkdown") {
        exportToMarkdown();
        return;
      }
      // IDEA-001: Focus mode
      if (action === "focusMode") {
        setIsFocusMode((prev) => !prev);
        return;
      }
      // IDEA-009: Split view
      if (action === "splitView") {
        setSplitView((prev) => !prev);
        return;
      }
      // IDEA-002: Word goal dialog
      if (action === "wordGoal") {
        setWordGoalInput(wordGoal ? String(wordGoal) : "");
        setShowWordGoalDialog(true);
        return;
      }
      // IDEA-012: Suggestion mode
      if (action === "suggestionMode") {
        const next = !suggestionModeActive;
        setSuggestionModeActive(next);
        if (next) editor.commands.enableSuggestionMode();
        else editor.commands.disableSuggestionMode();
        toast.info(
          next ? "Mode suggestion activé" : "Mode suggestion désactivé",
        );
        return;
      }
      // IDEA-006: Columns
      if (action === "insert2Columns") {
        editor.chain().focus().setColumns(2).run();
        return;
      }
      if (action === "insert3Columns") {
        editor.chain().focus().setColumns(3).run();
        return;
      }

      // Native clipboard if possible, fallback to execCommand
      if (
        action === "cut" ||
        action === "copy" ||
        action === "paste" ||
        action === "pasteText"
      ) {
        try {
          editor.view.dom.focus();
          let successful = false;
          if (action === "pasteText") {
            // Modern API fallback for text
            const text = await navigator.clipboard.readText();
            editor.commands.insertContent(text);
            successful = true;
          } else {
            successful = document.execCommand(action);
          }
          if (!successful) {
            toast.error(
              `Votre navigateur bloque l'action '${action}'. Utilisez les raccourcis clavier.`,
            );
          }
        } catch (e) {
          toast.error(`Erreur: ${e}`);
        }
      }

      // Font Styles (some toggles)
      if (action === "toggleBold") editor.commands.toggleBold();
      if (action === "toggleItalic") editor.commands.toggleItalic();
      if (action === "toggleUnderline") editor.commands.toggleUnderline();
      if (action === "toggleStrike") editor.commands.toggleStrike();
      if (action === "toggleSuperscript") editor.commands.toggleSuperscript();
      if (action === "toggleSubscript") editor.commands.toggleSubscript();
      if (action === "clearFormat") {
        editor.commands.unsetAllMarks();
        editor.commands.clearNodes();
      }

      // Headings
      if (action === "toggleH1")
        editor.commands.toggleHeading({
          level: 1,
        });
      if (action === "toggleH2")
        editor.commands.toggleHeading({
          level: 2,
        });
      if (action === "toggleH3")
        editor.commands.toggleHeading({
          level: 3,
        });
      if (action === "setParagraph") editor.commands.setParagraph();

      // Lists
      if (action === "toggleOrderedList") editor.commands.toggleOrderedList();
      if (action === "toggleBulletList") editor.commands.toggleBulletList();
      if (action === "toggleTaskList") editor.commands.toggleTaskList();

      // Alignments
      if (action === "alignLeft") editor.commands.setTextAlign("left");
      if (action === "alignCenter") editor.commands.setTextAlign("center");
      if (action === "alignRight") editor.commands.setTextAlign("right");
      if (action === "alignJustify") editor.commands.setTextAlign("justify");

      // Insertions
      if (action === "insertHorizontalRule")
        editor.commands.setHorizontalRule();
      if (action === "insertHardBreak") editor.commands.setHardBreak();
      if (action === "insertImage") {
        setInsertImageUrl("");
        setShowInsertImageDialog(true);
        return;
      }
      if (action === "insertLink") {
        setInsertLinkUrl("");
        setShowInsertLinkDialog(true);
        return;
      }
      if (action === "insertTable") {
        editor.commands.insertTable({
          rows: 3,
          cols: 3,
          withHeaderRow: true,
        });
      }
      if (action === "insertCode") {
        editor.commands.toggleCodeBlock();
      }

      // Table Manipulations
      if (action === "tableAddRowBefore") editor.commands.addRowBefore();
      if (action === "tableAddRowAfter") editor.commands.addRowAfter();
      if (action === "tableAddColBefore") editor.commands.addColumnBefore();
      if (action === "tableAddColAfter") editor.commands.addColumnAfter();
      if (action === "tableDeleteRow") editor.commands.deleteRow();
      if (action === "tableDeleteCol") editor.commands.deleteColumn();
      if (action === "tableDeleteTable") editor.commands.deleteTable();
      if (action === "tableMergeCells") editor.commands.mergeCells();

      // AI specific
      if (action === "aiGenerate") {
        setFloatingMode("prompt");
        setTimeout(() => promptInputRef.current?.focus(), 100);
      }
      if (action === "aiSummarize") {
        handleSummarize();
      }
      if (action === "translateEn") {
        handleTranslate("en", "English");
      }

      // Focus back
      editor.view.focus();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      editor,
      handleSummarize,
      handleTranslate,
      saveToDrive,
      exportHtmlDocument,
      userName,
      docBgColor,
    ],
  );

  const handleNewDocConfirm = async () => {
    setShowNewDocDialog(false);
    const finalName = newDocName.trim() || "Document sans titre";
    const toastId = toast.loading("Création du document...");
    try {
      const newNode = await driveApi.createNode({
        parent_id: null,
        name: finalName,
        node_type: "document",
        target_id: null,
      });
      const targetId = newNode.target_id || newNode.id;
      toast.success("Document créé !", { id: toastId });
      window.open(`/docs/editor?id=${targetId}`, "_blank");
    } catch (err: any) {
      console.error("Erreur création document:", err);
      const msg = err?.response?.data?.message || err?.message || String(err);
      toast.error(`Erreur création: ${msg}`, { id: toastId });
    }
  };

  if (!editor || !ydoc || !provider) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Initializing editor...
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-full bg-[#f8f9fa] dark:bg-[#1a1a1a] overflow-hidden ${className} ${isFocusMode ? "focus-mode" : ""}`}
    >
      {/* Top Bar (Menus only, simplified) — hidden in focus mode (IDEA-001) */}
      {!isFocusMode && (
        <div className="flex items-center px-4 py-1.5 bg-[#f9fbfd] dark:bg-background border-b border-transparent flex-shrink-0">
          <div className="-ml-1.5">
            <EditorMenu menus={editorMenus} onAction={handleMenuAction} />
          </div>
          {/* Focus mode button */}
          <button
            onClick={() => setIsFocusMode(true)}
            className="ml-auto p-1 rounded hover:bg-muted dark:hover:bg-gray-800 text-muted-foreground transition-colors"
            title="Mode focus (F11)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Formatting Ribbon — hidden in focus mode (IDEA-001) */}
      {isFocusMode && (
        <div className="flex items-center justify-end px-4 py-1 bg-black/80 text-white text-xs">
          <span className="mr-2 opacity-60">
            Mode focus — appuyez sur F11 pour quitter
          </span>
          <button
            onClick={() => setIsFocusMode(false)}
            className="flex items-center gap-1 hover:text-gray-300 transition-colors"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            Quitter
          </button>
        </div>
      )}
      {!isFocusMode && (
        <Toolbar>
          {/* Undo/Redo */}
          <div className="flex items-center mx-1 relative">
            <VoiceInput
              onTranscription={(text, isFinal) => {
                if (!editor) return;

                if (isFinal) {
                  // Détection de macro vocale IA (Mot clé: SignApps / Synapse)
                  const prefixMatch = text.match(
                    /^(?:signapps|sign app|sign apps|synapse|demande à signapps|dis à signapps|demande à synapse)[\s,:-]+(.+)/i,
                  );
                  const suffixMatch = text.match(
                    /(.+) (?:par signapps|généré par signapps|par synapse|généré par synapse)$/i,
                  );
                  const aiPrompt = prefixMatch
                    ? prefixMatch[1]
                    : suffixMatch
                      ? suffixMatch[1]
                      : null;

                  if (aiPrompt && !isStreaming) {
                    setInterimVoiceText("");
                    const toastId = toast.loading("IA crée du contenu...");
                    setAiAction("voice-macro");

                    stream(
                      aiPrompt,
                      {
                        onToken: (token) => {
                          editor.chain().focus().insertContent(token).run();
                        },
                        onDone: () => {
                          setAiAction(null);
                          toast.success("Généré par l'IA", { id: toastId });
                        },
                        onError: (err) => {
                          setAiAction(null);
                          toast.error(`Erreur IA : ${err}`, { id: toastId });
                        },
                      },
                      {
                        systemPrompt:
                          "You are an AI assistant integrated into a rich text editor. The user used a voice command to ask you to generate content. Output ONLY the requested content in HTML format compatible with TipTap (like tables, bold, lists, paragraphs). Do NOT wrap your answer in markdown code blocks like ```html. Output raw HTML directly.",
                        language: "fr",
                      },
                    );
                    return;
                  }

                  parseVoiceCommand(
                    text,
                    editor,
                    pendingVoiceMarksRef,
                    pendingVoiceBlocksRef,
                    (action) => {
                      if (action === "fix") handleAiAction("fix");
                      if (action === "improve") handleAiAction("improve");
                      if (action === "summarize") handleSummarize();
                    },
                  );
                  setInterimVoiceText("");
                } else {
                  // Sauvegarde en état React au lieu d'insérer dans l'éditeur TipTap
                  // pour empêcher Yjs de supprimer la phrase finale après coup.
                  setInterimVoiceText(text);
                }
              }}
              className="bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 animate-none data-[state=active]:animate-pulse"
              title="Dictée Vocale"
            />
            {interimVoiceText && (
              <div className="absolute top-10 left-0 bg-background dark:bg-[#1e1f20] border border-border dark:border-gray-700 shadow-md rounded-md px-3 py-1.5 text-xs whitespace-nowrap z-50 animate-pulse text-muted-foreground dark:text-gray-400 pointer-events-none">
                🎤 {interimVoiceText}...
              </div>
            )}
          </div>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo (Ctrl+Y)"
          >
            <Redo className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Text Styles */}
          <ToolbarButton
            onClick={() =>
              handleFormat(() =>
                editor.chain().toggleHeading({ level: 1 }).run(),
              )
            }
            isActive={editor.isActive("heading", { level: 1 })}
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              handleFormat(() =>
                editor.chain().toggleHeading({ level: 2 }).run(),
              )
            }
            isActive={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              handleFormat(() => editor.chain().setParagraph().run())
            }
            isActive={editor.isActive("paragraph")}
            title="Paragraph"
          >
            <span className="text-[13px] font-medium px-1">Normal text</span>
          </ToolbarButton>

          <ToolbarDivider />

          {/* Font Styles */}
          <div className="flex border border-[#c7c7c7] dark:border-[#5f6368] rounded overflow-hidden h-[28px] mx-1 items-center bg-background dark:bg-[#202124]">
            <Popover open={fontOpen} onOpenChange={setFontOpen}>
              <PopoverTrigger asChild>
                <button
                  role="combobox"
                  aria-expanded={fontOpen}
                  aria-haspopup="listbox"
                  aria-controls="font-picker-listbox"
                  className="flex items-center justify-between h-[28px] w-[130px] rounded-none px-3 border-0 border-r border-[#c7c7c7] dark:border-[#5f6368] bg-transparent hover:bg-muted dark:hover:bg-[#303134] focus:outline-none text-[13px] text-[#444746] dark:text-[#e3e3e3] font-medium transition-colors"
                >
                  <span
                    className="truncate"
                    style={{ fontFamily: currentFont }}
                  >
                    {currentFont}
                  </span>
                  <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Rechercher..."
                    className="h-9 text-xs"
                  />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>Introuvable.</CommandEmpty>
                    <CommandGroup>
                      {availableFonts.map((font) => (
                        <CommandItem
                          key={font}
                          value={font}
                          onSelect={(currentValue) => {
                            const originalFont =
                              availableFonts.find(
                                (f) => f.toLowerCase() === currentValue,
                              ) || font;
                            setCurrentFont(originalFont);
                            setTimeout(() => {
                              editor
                                .chain()
                                .focus()
                                .setFontFamily(originalFont)
                                .run();
                            }, 50);
                            setFontOpen(false);
                          }}
                          style={{ fontFamily: font }}
                          className="text-[14px]"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 shrink-0 transition-opacity ${currentFont === font ? "opacity-100" : "opacity-0"}`}
                          />
                          {font}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <div className="flex items-center">
              <span
                onClick={() => {
                  setDocFontSize((s) => {
                    const ns = Math.max(
                      1,
                      (typeof s === "number" ? s : 11) - 1,
                    );
                    setTimeout(
                      () => editor.chain().focus().setFontSize(`${ns}pt`).run(),
                      50,
                    );
                    return ns;
                  });
                }}
                className="flex items-center justify-center h-full px-2.5 text-[14px] text-[#444746] dark:text-[#e3e3e3] hover:bg-muted dark:hover:bg-[#303134] cursor-pointer border-r border-[#c7c7c7] dark:border-[#5f6368] select-none"
              >
                -
              </span>

              <input
                type="text"
                list="font-sizes"
                value={docFontSize}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) setDocFontSize(val);
                }}
                onBlur={(e) => {
                  const val = parseInt(e.target.value) || 11;
                  setDocFontSize(val);
                  handleFormat(() =>
                    editor.chain().focus().setFontSize(`${val}pt`).run(),
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val =
                      parseInt((e.target as HTMLInputElement).value) || 11;
                    setDocFontSize(val);
                    handleFormat(() =>
                      editor.chain().focus().setFontSize(`${val}pt`).run(),
                    );
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-[36px] h-full text-center text-[13px] text-[#444746] dark:text-[#e3e3e3] bg-transparent focus:outline-none focus:bg-[#e8f0fe] dark:focus:bg-[#3c4043] transition-colors"
              />
              <datalist id="font-sizes">
                {[8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72, 96].map(
                  (size) => (
                    <option key={size} value={size} />
                  ),
                )}
              </datalist>

              <span
                onClick={() => {
                  setDocFontSize((s) => {
                    const ns = (typeof s === "number" ? s : 11) + 1;
                    setTimeout(
                      () => editor.chain().focus().setFontSize(`${ns}pt`).run(),
                      50,
                    );
                    return ns;
                  });
                }}
                className="flex items-center justify-center h-full px-2 text-[14px] text-[#444746] dark:text-[#e3e3e3] hover:bg-muted dark:hover:bg-[#303134] cursor-pointer border-l border-[#c7c7c7] dark:border-[#5f6368] select-none"
              >
                +
              </span>
            </div>
          </div>

          <ToolbarDivider />

          {/* Basic Formatting */}
          <ToolbarButton
            onClick={() =>
              handleFormat(() => editor.chain().toggleBold().run())
            }
            isActive={editor.isActive("bold")}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              handleFormat(() => editor.chain().toggleItalic().run())
            }
            isActive={editor.isActive("italic")}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              handleFormat(() => editor.chain().toggleUnderline().run())
            }
            isActive={editor.isActive("underline")}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              handleFormat(() => editor.chain().toggleStrike().run())
            }
            isActive={editor.isActive("strike")}
            title="Strikethrough (Alt+Shift+5)"
          >
            <Strikethrough className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              handleFormat(() => editor.chain().toggleSuperscript().run())
            }
            isActive={editor.isActive("superscript")}
            title="Superscript (Ctrl+.)"
          >
            <SuperscriptIcon className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              handleFormat(() => editor.chain().toggleSubscript().run())
            }
            isActive={editor.isActive("subscript")}
            title="Subscript (Ctrl+,)"
          >
            <SubscriptIcon className="w-[18px] h-[18px]" />
          </ToolbarButton>

          {/* Colors */}
          <div className="relative">
            <ToolbarButton
              onClick={() => setShowColorPicker(!showColorPicker)}
              title="Text color"
            >
              <div className="flex flex-col items-center justify-center gap-[2px]">
                <Palette className="w-[16px] h-[16px]" />
                <div
                  className="w-[14px] h-[3px] rounded-full"
                  style={{
                    backgroundColor:
                      editor.getAttributes("textStyle").color || "#000000",
                  }}
                />
              </div>
            </ToolbarButton>
            {showColorPicker && (
              <div className="absolute top-10 left-0 bg-background dark:bg-[#2d2e30] border border-border dark:border-gray-700 shadow-xl rounded-md p-2 flex flex-wrap w-[140px] gap-1 z-30">
                {[
                  "#000000",
                  "#434343",
                  "#666666",
                  "#999999",
                  "#b7b7b7",
                  "#cccccc",
                  "#d9d9d9",
                  "#efefef",
                  "#f3f3f3",
                  "#ffffff",
                  "#980000",
                  "#ff0000",
                  "#ff9900",
                  "#ffff00",
                  "#00ff00",
                  "#00ffff",
                  "#4a86e8",
                  "#0000ff",
                  "#9900ff",
                  "#ff00ff",
                ].map((color) => (
                  <button
                    key={color}
                    className="w-5 h-5 rounded-full ring-1 ring-inset ring-black/10 hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      handleFormat(() => editor.chain().setColor(color).run());
                      setShowColorPicker(false);
                    }}
                  />
                ))}
                <div className="w-full mt-1 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-2 pb-1">
                  <span className="text-xs text-muted-foreground pl-1 font-medium">
                    Couleur
                  </span>
                  <input
                    type="color"
                    className="w-5 h-5 p-0 border-0 rounded cursor-pointer shrink-0 bg-transparent"
                    value={editor.getAttributes("textStyle").color || "#000000"}
                    onChange={(e) => {
                      handleFormat(() =>
                        editor.chain().setColor(e.target.value).run(),
                      );
                    }}
                  />
                </div>
                <button
                  className="w-full mt-1 text-xs text-center py-1 hover:bg-muted dark:hover:bg-gray-800 rounded font-medium"
                  onClick={() => {
                    handleFormat(() => editor.chain().unsetColor().run());
                    setShowColorPicker(false);
                  }}
                >
                  Réinitialiser
                </button>
              </div>
            )}
          </div>
          <div className="relative">
            <ToolbarButton
              onClick={() => setShowHighlightPicker(!showHighlightPicker)}
              title="Highlight color"
            >
              <div className="flex flex-col items-center justify-center gap-[2px]">
                <Highlighter className="w-[16px] h-[16px]" />
                <div
                  className="w-[14px] h-[3px] rounded-full"
                  style={{
                    backgroundColor:
                      editor.getAttributes("highlight").color || "transparent",
                  }}
                />
              </div>
            </ToolbarButton>
            {showHighlightPicker && (
              <div className="absolute top-10 left-0 bg-background dark:bg-[#2d2e30] border border-border dark:border-gray-700 shadow-xl rounded-md p-2 flex flex-wrap w-[140px] gap-1 z-30">
                {[
                  "#fce8e6",
                  "#fce8b2",
                  "#fff2cc",
                  "#e6f4ea",
                  "#e8f0fe",
                  "#f3e8fd",
                  "#ffffff",
                ].map((color) => (
                  <button
                    key={color}
                    className="w-5 h-5 rounded-full ring-1 ring-inset ring-black/10 hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      handleFormat(() =>
                        editor.chain().setHighlight({ color }).run(),
                      );
                      setShowHighlightPicker(false);
                    }}
                  />
                ))}
                <div className="w-full mt-1 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-2 pb-1">
                  <span className="text-xs text-muted-foreground pl-1 font-medium">
                    Surlignage
                  </span>
                  <input
                    type="color"
                    className="w-5 h-5 p-0 border-0 rounded cursor-pointer shrink-0 bg-transparent"
                    value={editor.getAttributes("highlight").color || "#ffffff"}
                    onChange={(e) => {
                      handleFormat(() =>
                        editor
                          .chain()
                          .setHighlight({ color: e.target.value })
                          .run(),
                      );
                    }}
                  />
                </div>
                <button
                  className="w-full mt-1 text-xs text-center py-1 hover:bg-muted dark:hover:bg-gray-800 rounded font-medium"
                  onClick={() => {
                    handleFormat(() => editor.chain().unsetHighlight().run());
                    setShowHighlightPicker(false);
                  }}
                >
                  Aucun
                </button>
              </div>
            )}
          </div>

          <ToolbarDivider />

          {/* Alignment */}
          <ToolbarButton
            onClick={() =>
              handleFormat(() => editor.chain().setTextAlign("left").run())
            }
            isActive={
              editor.isActive({ textAlign: "left" }) ||
              (!editor.isActive({ textAlign: "center" }) &&
                !editor.isActive({ textAlign: "right" }) &&
                !editor.isActive({ textAlign: "justify" }))
            }
            title="Align left (Ctrl+Shift+L)"
          >
            <AlignLeft className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              handleFormat(() => editor.chain().setTextAlign("center").run())
            }
            isActive={editor.isActive({ textAlign: "center" })}
            title="Center align (Ctrl+Shift+E)"
          >
            <AlignCenter className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              handleFormat(() => editor.chain().setTextAlign("right").run())
            }
            isActive={editor.isActive({ textAlign: "right" })}
            title="Align right (Ctrl+Shift+R)"
          >
            <AlignRight className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              handleFormat(() => editor.chain().setTextAlign("justify").run())
            }
            isActive={editor.isActive({ textAlign: "justify" })}
            title="Justify (Ctrl+Shift+J)"
          >
            <AlignJustify className="w-[18px] h-[18px]" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Lists */}
          <ToolbarButton
            onClick={() =>
              handleFormat(() =>
                editor.chain().focus().toggleOrderedList().run(),
              )
            }
            isActive={editor.isActive("orderedList")}
            title="Numbered list (Ctrl+Shift+7)"
          >
            <ListOrdered className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              handleFormat(() =>
                editor.chain().focus().toggleBulletList().run(),
              )
            }
            isActive={editor.isActive("bulletList")}
            title="Bulleted list (Ctrl+Shift+8)"
          >
            <List className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              handleFormat(() => editor.chain().focus().toggleTaskList().run())
            }
            isActive={editor.isActive("taskList")}
            title="Checklist (Ctrl+Shift+9)"
          >
            <CheckSquare className="w-[18px] h-[18px]" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
            title="Insert table"
          >
            <TableIcon className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <Popover
            open={isLinkPopoverOpen}
            onOpenChange={(open) => {
              setIsLinkPopoverOpen(open);
              if (open) {
                setLinkUrl(editor.getAttributes("link").href || "");
                const { from, to, empty } = editor.state.selection;
                if (!empty && !editor.getAttributes("link").href) {
                  setLinkText(editor.state.doc.textBetween(from, to, " "));
                } else {
                  // If a link exists, we grab the anchor text using a DOM slice or fallback to just empty/current URL
                  const linkNodeText = editor.getAttributes("link").href
                    ? editor.state.doc.textBetween(
                        editor.state.selection.from,
                        editor.state.selection.to,
                        " ",
                      )
                    : "";
                  setLinkText(
                    linkNodeText || editor.state.doc.textBetween(from, to, " "),
                  );
                }
              } else {
                setLinkText("");
                setLinkUrl("");
              }
            }}
          >
            <PopoverTrigger asChild>
              <ToolbarButton
                isActive={editor.isActive("link")}
                title="Insérer un lien"
              >
                <LinkIcon className="w-[18px] h-[18px]" />
              </ToolbarButton>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-4" align="start">
              <div className="flex flex-col gap-4">
                <h4 className="font-medium text-sm text-[#202124] dark:text-[#e8eaed]">
                  Insérer ou modifier un lien
                </h4>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground font-medium">
                    Texte à afficher (optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Texte cliquable..."
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    className="flex h-8 w-full rounded-md border border-border dark:border-gray-700 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary text-[#202124] dark:text-[#e8eaed]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground font-medium">
                    Lien web
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="https://..."
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      className="flex h-8 w-full rounded-md border border-border dark:border-gray-700 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary text-[#202124] dark:text-[#e8eaed]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (linkUrl) {
                            const finalUrl = linkUrl.startsWith("http")
                              ? linkUrl
                              : `https://${linkUrl}`;
                            if (linkText) {
                              // Replace selection with standard HTML structure that Tiptap parses seamlessly
                              handleFormat(() =>
                                editor
                                  .chain()
                                  .focus()
                                  .insertContent(
                                    `<a href="${finalUrl}">${linkText}</a>`,
                                  )
                                  .run(),
                              );
                            } else {
                              // Fallback to purely wrapping the selection
                              handleFormat(() =>
                                editor
                                  .chain()
                                  .focus()
                                  .extendMarkRange("link")
                                  .setLink({ href: finalUrl })
                                  .run(),
                              );
                            }
                          } else {
                            handleFormat(() =>
                              editor.chain().focus().unsetLink().run(),
                            );
                          }
                          setIsLinkPopoverOpen(false);
                          setLinkUrl("");
                          setLinkText("");
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (linkUrl) {
                          const finalUrl = linkUrl.startsWith("http")
                            ? linkUrl
                            : `https://${linkUrl}`;
                          if (linkText) {
                            // Replace selection with standard HTML structure that Tiptap parses seamlessly
                            handleFormat(() =>
                              editor
                                .chain()
                                .focus()
                                .insertContent(
                                  `<a href="${finalUrl}">${linkText}</a>`,
                                )
                                .run(),
                            );
                          } else {
                            // Fallback to purely wrapping the selection
                            handleFormat(() =>
                              editor
                                .chain()
                                .focus()
                                .extendMarkRange("link")
                                .setLink({ href: finalUrl })
                                .run(),
                            );
                          }
                        } else {
                          handleFormat(() =>
                            editor.chain().focus().unsetLink().run(),
                          );
                        }
                        setIsLinkPopoverOpen(false);
                        setLinkUrl("");
                        setLinkText("");
                      }}
                      className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shrink-0"
                    >
                      Valider
                    </button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Popover
            open={isImagePopoverOpen}
            onOpenChange={(open) => {
              setIsImagePopoverOpen(open);
              if (open) setImageUrl(editor.getAttributes("image").src || "");
            }}
          >
            <PopoverTrigger asChild>
              <ToolbarButton title="Insérer une image">
                <ImageIcon className="w-[18px] h-[18px]" />
              </ToolbarButton>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="start">
              <div className="flex flex-col gap-3">
                <h4 className="font-medium text-sm text-[#202124] dark:text-[#e8eaed]">
                  Insérer une image
                </h4>

                {/* File Upload Option */}
                <label className="flex flex-col items-center justify-center w-full h-24 px-4 transition bg-muted dark:bg-[#202124] border-2 border-border dark:border-gray-700 border-dashed rounded-md cursor-pointer hover:border-primary hover:bg-muted dark:hover:bg-[#303134]">
                  <div className="flex items-center space-x-2">
                    <FileImage className="w-5 h-5 text-muted-foreground dark:text-gray-400" />
                    <span className="font-medium text-sm text-muted-foreground dark:text-gray-300">
                      Choisir un fichier...
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-muted-foreground mt-1">
                    PNG, JPG, GIF jusqu'à 10MB
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await insertImageFromFile(editor, file);
                        setIsImagePopoverOpen(false);
                      }
                    }}
                  />
                </label>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-border dark:border-gray-700"></div>
                  <span className="flex-shrink-0 mx-3 text-xs text-gray-400">
                    ou via URL
                  </span>
                  <div className="flex-grow border-t border-border dark:border-gray-700"></div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    placeholder="https://..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="flex h-8 w-full rounded-md border border-border dark:border-gray-700 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary text-[#202124] dark:text-[#e8eaed]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (imageUrl) {
                          handleFormat(() =>
                            editor
                              .chain()
                              .focus()
                              .setImage({ src: imageUrl })
                              .run(),
                          );
                          setIsImagePopoverOpen(false);
                          setImageUrl("");
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (imageUrl) {
                        handleFormat(() =>
                          editor
                            .chain()
                            .focus()
                            .setImage({ src: imageUrl })
                            .run(),
                        );
                        setIsImagePopoverOpen(false);
                        setImageUrl("");
                      }
                    }}
                    className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shrink-0"
                  >
                    Insérer
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <ToolbarDivider />

          {/* Voice Dictation (whisper-rs STT) */}
          <VoiceDictation editor={editor} />

          <ToolbarDivider />

          {/* Spell Check / Language Picker */}
          <SpellCheck editor={editor} />

          {/* Mail Merge */}
          <ToolbarButton
            onClick={() => setMailMergeOpen(true)}
            title="Publipostage (Mail Merge)"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* IDEA-009: Split view toggle */}
          <ToolbarButton
            onClick={() => setSplitView((prev) => !prev)}
            isActive={splitView}
            title="Vue partagée Markdown"
          >
            <SplitSquareHorizontal className="w-4 h-4" />
          </ToolbarButton>

          {/* IDEA-012: Suggestion mode toggle */}
          <ToolbarButton
            onClick={() => {
              const next = !suggestionModeActive;
              setSuggestionModeActive(next);
              if (next) editor.commands.enableSuggestionMode();
              else editor.commands.disableSuggestionMode();
              toast.info(
                next ? "Mode suggestion activé" : "Mode suggestion désactivé",
              );
            }}
            isActive={suggestionModeActive}
            title="Mode suggestion (proposer des modifications)"
          >
            <GitBranch className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* AI Integrations Toggle */}
          <button
            onClick={() => setShowAiToolbar(!showAiToolbar)}
            className={`p-1.5 px-3 rounded flex items-center gap-1.5 transition-all ml-auto mr-1 ${showAiToolbar ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300" : "text-[#444746] dark:text-[#e3e3e3] hover:bg-[#f1f3f4] dark:hover:bg-[#303134]"}`}
          >
            <Bot className="w-4 h-4" />
            <span className="text-[12px] font-medium hidden sm:inline">
              AI Tools
            </span>
          </button>
        </Toolbar>
      )}

      {/* AI Auxiliary Toolbar */}
      {showAiToolbar && (
        <div className="flex flex-wrap items-center gap-2 px-6 py-2 bg-purple-50/50 dark:bg-purple-900/10 border-b border-purple-100 dark:border-purple-900/30 shadow-inner">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 mr-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Magic
          </span>

          {isStreaming ? (
            <button
              onClick={stop}
              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-[13px] font-medium transition-colors flex items-center"
            >
              <Square className="w-3.5 h-3.5 mr-1.5" /> Stop Generation
            </button>
          ) : (
            <>
              <button
                onClick={handleSummarize}
                className="px-3 py-1.5 bg-background dark:bg-gray-800 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md text-[13px] font-medium transition-colors flex items-center"
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" /> Summarize Document
              </button>
              <button
                onClick={() => handleAiAction("improve")}
                disabled={editor.state.selection.empty}
                className="px-3 py-1.5 bg-background dark:bg-gray-800 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md text-[13px] font-medium transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Improve Selection
              </button>
              <button
                onClick={() => handleAiAction("fix")}
                disabled={editor.state.selection.empty}
                className="px-3 py-1.5 bg-background dark:bg-gray-800 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md text-[13px] font-medium transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1.5" /> Fix Selection
              </button>
            </>
          )}
        </div>
      )}

      {/* Editor Canvas Area */}
      <div
        className={`flex-1 overflow-y-auto w-full relative pb-16 custom-scrollbar bg-[#f8f9fa] dark:bg-[#1b1b1b] flex flex-row justify-center py-6 ${splitView ? "gap-0" : ""}`}
      >
        {/* IDEA-009: Split view Markdown preview */}
        {splitView && (
          <div className="flex-1 min-w-0 max-w-[400px] border-r border-border dark:border-gray-700 overflow-y-auto p-6 font-mono text-sm">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border dark:border-gray-700">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Markdown
              </span>
              <SplitSquareHorizontal className="w-4 h-4 text-gray-400" />
            </div>
            <pre className="whitespace-pre-wrap text-xs text-muted-foreground dark:text-gray-300 leading-relaxed">
              {htmlToMarkdown(editor.getHTML())}
            </pre>
          </div>
        )}
        <div
          className={`flex-1 min-w-0 ${splitView ? "max-w-[816px]" : "max-w-[816px]"}`}
        >
          {/* Main Content Area constrained like Google Docs (A4 Paper) */}
          <div
            className="w-[816px] shrink-0 min-h-[1056px] bg-background dark:bg-[#1f1f1f] shadow-[0_1px_3px_auto_rgba(0,0,0,0.1)] ring-1 ring-[#e2e2e2] dark:ring-[#ffffff1a] rounded-sm relative mt-2 mb-10 mx-auto px-20 pt-16"
            onKeyDown={(e) => {
              if (!editor) return;
              if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
                if (e.key.toLowerCase() === "l") {
                  e.preventDefault();
                  editor.chain().focus().setTextAlign("left").run();
                }
                if (e.key.toLowerCase() === "e") {
                  e.preventDefault();
                  editor.chain().focus().setTextAlign("center").run();
                }
                if (e.key.toLowerCase() === "r") {
                  e.preventDefault();
                  editor.chain().focus().setTextAlign("right").run();
                }
                if (e.key.toLowerCase() === "j") {
                  e.preventDefault();
                  editor.chain().focus().setTextAlign("justify").run();
                }
                if (e.key.toLowerCase() === "x") {
                  e.preventDefault();
                  editor.chain().focus().toggleStrike().run();
                }
              }
              if ((e.ctrlKey || e.metaKey) && e.key === "5") {
                e.preventDefault();
                editor.chain().focus().toggleStrike().run();
              }
            }}
          >
            {/* BubbleMenu - Text Selection Toolbar */}
            {editor && (
              <BubbleMenu
                editor={editor}
                options={{
                  placement: "top",
                  offset: 6,
                }}
                className="bg-background/95 dark:bg-[#202124]/95 backdrop-blur-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)] border border-border/50 dark:border-gray-700/50 rounded-[8px] overflow-hidden flex divide-x divide-gray-100 dark:divide-gray-800 pl-1"
              >
                <ToolbarButton
                  onClick={() =>
                    handleFormat(() => editor.chain().toggleBold().run())
                  }
                  isActive={editor.isActive("bold")}
                >
                  <Bold className="w-[16px] h-[16px]" />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() =>
                    handleFormat(() => editor.chain().toggleItalic().run())
                  }
                  isActive={editor.isActive("italic")}
                >
                  <Italic className="w-[16px] h-[16px]" />
                </ToolbarButton>

                <div className="w-px h-5 bg-[#e3e3e3] dark:bg-[#5f6368] mx-1 self-center" />

                <button
                  onClick={() => {
                    const commentId = uuidv4();
                    editor.chain().focus().setComment(commentId).run();
                    setComments((prev) => [
                      ...prev,
                      {
                        id: commentId,
                        text: "",
                        author: userName || "Anonymous",
                        timestamp: Date.now(),
                      },
                    ]);
                    setActiveCommentId(commentId);
                    setShowComments(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 hover:bg-muted dark:hover:bg-[#303134] text-[13px] font-medium text-[#444746] dark:text-[#e3e3e3] transition-colors"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  Comment
                </button>

                <button
                  onClick={() => handleAiAction("improve")}
                  disabled={isStreaming}
                  className="flex items-center gap-1.5 px-3 py-1 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-[13px] font-medium text-purple-600 dark:text-purple-400 transition-colors"
                >
                  {aiAction === "improve" ? (
                    <SpinnerInfinity
                      size={24}
                      secondaryColor="rgba(128,128,128,0.2)"
                      color="currentColor"
                      speed={120}
                      className="w-3.5 h-3.5 "
                    />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Improve
                </button>
                <button
                  onClick={() => handleAiAction("fix")}
                  disabled={isStreaming}
                  className="flex items-center gap-1.5 px-3 py-1 hover:bg-muted dark:hover:bg-[#303134] text-[13px] font-medium text-[#444746] dark:text-[#e3e3e3] transition-colors"
                >
                  {aiAction === "fix" ? (
                    <SpinnerInfinity
                      size={24}
                      secondaryColor="rgba(128,128,128,0.2)"
                      color="currentColor"
                      speed={120}
                      className="w-3.5 h-3.5 "
                    />
                  ) : (
                    <CheckCheck className="w-3.5 h-3.5" />
                  )}
                  Fix
                </button>
              </BubbleMenu>
            )}

            {/* FloatingMenu - AI actions on empty lines */}
            {editor && (
              <FloatingMenu
                editor={editor}
                options={{
                  placement: "bottom-start",
                  offset: 6,
                }}
                className="bg-background/95 dark:bg-[#202124]/95 backdrop-blur-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)] border border-border dark:border-[#5f6368] rounded-[8px] overflow-hidden min-w-[220px]"
              >
                {floatingMode === "menu" && (
                  <div className="flex flex-col py-1.5 min-w-[200px]">
                    <button
                      onClick={() => setFloatingMode("prompt")}
                      disabled={isStreaming}
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-[13px] font-medium text-purple-600 dark:text-purple-400 transition-colors text-left"
                    >
                      <Sparkles className="w-4 h-4" />
                      Help me write...
                    </button>
                    <button
                      onClick={handleContinueWriting}
                      disabled={isStreaming}
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-muted dark:hover:bg-[#303134] text-[13px] text-[#444746] dark:text-[#e3e3e3] transition-colors text-left"
                    >
                      {aiAction === "continue" ? (
                        <SpinnerInfinity
                          size={24}
                          secondaryColor="rgba(128,128,128,0.2)"
                          color="currentColor"
                          speed={120}
                          className="w-4 h-4 "
                        />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                      Continue writing
                    </button>
                    <button
                      onClick={() => setFloatingMode("translate")}
                      disabled={isStreaming}
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-muted dark:hover:bg-[#303134] text-[13px] text-[#444746] dark:text-[#e3e3e3] transition-colors text-left"
                    >
                      <Languages className="w-4 h-4" />
                      Translate...
                    </button>
                  </div>
                )}

                {floatingMode === "prompt" && (
                  <div className="flex items-center gap-2 p-1.5 min-w-[350px]">
                    <Sparkles className="w-4 h-4 text-purple-500 ml-2 shrink-0" />
                    <input
                      ref={promptInputRef}
                      type="text"
                      value={promptValue}
                      onChange={(e) => setPromptValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleHelpMeWrite();
                        }
                        if (e.key === "Escape") {
                          setFloatingMode("menu");
                          setPromptValue("");
                        }
                      }}
                      placeholder="Describe what to write..."
                      className="flex-1 border-none bg-transparent text-[13px] focus:outline-none px-2 py-1.5 text-[#202124] dark:text-[#e8eaed] placeholder-[#80868b] dark:placeholder-[#9aa0a6]"
                    />
                    <button
                      onClick={handleHelpMeWrite}
                      disabled={!promptValue.trim() || isStreaming}
                      className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-30 transition-colors"
                    >
                      {isStreaming ? (
                        <SpinnerInfinity
                          size={24}
                          secondaryColor="rgba(128,128,128,0.2)"
                          color="currentColor"
                          speed={120}
                          className="w-4 h-4 "
                        />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setFloatingMode("menu");
                        setPromptValue("");
                      }}
                      className="p-1.5 rounded-md text-[#5f6368] dark:text-[#9aa0a6] hover:bg-muted dark:hover:bg-[#303134] transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {floatingMode === "translate" && (
                  <div className="flex flex-col py-1 min-w-[180px]">
                    <div className="px-4 py-1.5 text-[11px] uppercase tracking-wider text-[#5f6368] dark:text-[#9aa0a6] font-semibold">
                      Translate to
                    </div>
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleTranslate(lang.code, lang.label)}
                        disabled={isStreaming}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-muted dark:hover:bg-[#303134] text-[13px] text-[#444746] dark:text-[#e3e3e3] transition-colors text-left"
                      >
                        {lang.label}
                      </button>
                    ))}
                    <button
                      onClick={() => setFloatingMode("menu")}
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-muted dark:hover:bg-[#303134] text-[13px] text-[#5f6368] dark:text-[#9aa0a6] transition-colors text-left border-t border-[#e3e3e3] dark:border-[#3c4043] mt-1"
                    >
                      <X className="w-4 h-4" />
                      Back
                    </button>
                  </div>
                )}
              </FloatingMenu>
            )}

            <ContextMenuStandard7 editor={editor}>
              <EditorContent editor={editor} />
            </ContextMenuStandard7>
          </div>
        </div>

        {/* IDEA-014: Floating sticky Table of Contents Sidebar */}
        {!isFocusMode && (
          <div className="hidden lg:block w-[240px] shrink-0 border-l border-gray-100 dark:border-gray-800/50 p-4 pt-8 overflow-y-auto max-h-full sticky top-0 custom-scrollbar">
            {toc.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-muted-foreground flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3" /> Sur cette page
                </h3>
                <nav className="flex flex-col gap-1">
                  {toc.map((heading) => (
                    <button
                      key={heading.id}
                      onClick={() => {
                        const pos = parseInt(heading.id.split("-")[1]);
                        if (!isNaN(pos) && editor) {
                          editor.chain().focus().setTextSelection(pos).run();
                        }
                      }}
                      className={`text-left text-[12px] hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate py-0.5
                                            ${heading.level === 1 ? "font-medium text-gray-800 dark:text-gray-200 mt-1" : ""}
                                            ${heading.level === 2 ? "text-muted-foreground dark:text-gray-400 ml-3" : ""}
                                            ${heading.level === 3 ? "text-muted-foreground dark:text-muted-foreground ml-6 text-[11px]" : ""}
                                        `}
                    >
                      {heading.text || "Section sans titre"}
                    </button>
                  ))}
                </nav>
              </div>
            )}

            {/* Comments Section — IDEA-010 (resolve) + IDEA-011 (threaded replies) */}
            {showComments && comments.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-muted-foreground flex items-center gap-1.5">
                    <MessageCircle className="w-3 h-3" /> Commentaires
                  </h3>
                  <span className="text-[10px] text-gray-400 bg-muted dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
                    {
                      comments.filter((c) => !resolvedComments.includes(c.id))
                        .length
                    }
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {/* Active comments */}
                  {comments
                    .filter((c) => !resolvedComments.includes(c.id))
                    .map((comment) => (
                      <div
                        key={comment.id}
                        className={`p-2.5 rounded-lg border text-sm transition-all relative group
                                            ${
                                              activeCommentId === comment.id
                                                ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm"
                                                : "border-border dark:border-gray-800 bg-background dark:bg-[#202124] hover:border-border dark:hover:border-gray-700"
                                            }
                                        `}
                        onClick={() => setActiveCommentId(comment.id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-[12px] text-gray-800 dark:text-gray-200">
                            {comment.author}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(comment.timestamp).toLocaleTimeString(
                                [],
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                            {/* IDEA-010: Resolve button */}
                            <button
                              className="opacity-0 group-hover:opacity-100 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 p-0.5 rounded transition-all"
                              title="Résoudre"
                              onClick={(e) => {
                                e.stopPropagation();
                                setResolvedComments((prev) => [
                                  ...prev,
                                  comment.id,
                                ]);
                                if (activeCommentId === comment.id)
                                  setActiveCommentId(null);
                              }}
                            >
                              <CheckCircle className="w-3 h-3" />
                            </button>
                            <button
                              className="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-0.5 rounded transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                editor
                                  .chain()
                                  .focus()
                                  .unsetComment(comment.id)
                                  .run();
                                setComments((prev) =>
                                  prev.filter((c) => c.id !== comment.id),
                                );
                                if (activeCommentId === comment.id)
                                  setActiveCommentId(null);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <textarea
                          value={comment.text}
                          onChange={(e) => {
                            const newText = e.target.value;
                            setComments((prev) =>
                              prev.map((c) =>
                                c.id === comment.id
                                  ? { ...c, text: newText }
                                  : c,
                              ),
                            );
                          }}
                          placeholder="Ajouter un commentaire..."
                          className="w-full bg-transparent border-none resize-none focus:outline-none text-muted-foreground dark:text-gray-300 min-h-[36px] text-[12px]"
                        />
                        {/* IDEA-011: Threaded replies */}
                        {(commentReplies[comment.id] || []).map((reply) => (
                          <div
                            key={reply.id}
                            className="mt-1.5 ml-3 pl-2 border-l-2 border-border dark:border-gray-700"
                          >
                            <span className="text-[11px] font-semibold text-muted-foreground dark:text-gray-300">
                              {reply.author}
                            </span>
                            <p className="text-[11px] text-muted-foreground dark:text-gray-400 mt-0.5">
                              {reply.text}
                            </p>
                          </div>
                        ))}
                        {activeCommentId === comment.id && (
                          <div className="mt-2 flex gap-1">
                            <input
                              type="text"
                              value={replyInputs[comment.id] || ""}
                              onChange={(e) =>
                                setReplyInputs((prev) => ({
                                  ...prev,
                                  [comment.id]: e.target.value,
                                }))
                              }
                              placeholder="Répondre..."
                              className="flex-1 text-[11px] border border-border dark:border-gray-700 rounded px-2 py-1 bg-transparent focus:outline-none focus:border-blue-400"
                              onKeyDown={(e) => {
                                if (
                                  e.key === "Enter" &&
                                  replyInputs[comment.id]?.trim()
                                ) {
                                  const replyText =
                                    replyInputs[comment.id].trim();
                                  setCommentReplies((prev) => ({
                                    ...prev,
                                    [comment.id]: [
                                      ...(prev[comment.id] || []),
                                      {
                                        id: uuidv4(),
                                        author: userName || "Anonymous",
                                        text: replyText,
                                        timestamp: Date.now(),
                                      },
                                    ],
                                  }));
                                  setReplyInputs((prev) => ({
                                    ...prev,
                                    [comment.id]: "",
                                  }));
                                }
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  {/* IDEA-010: Resolved comments section */}
                  {resolvedComments.filter((id) =>
                    comments.find((c) => c.id === id),
                  ).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        {
                          resolvedComments.filter((id) =>
                            comments.find((c) => c.id === id),
                          ).length
                        }{" "}
                        résolus
                      </summary>
                      <div className="mt-1 flex flex-col gap-1.5 opacity-60">
                        {resolvedComments
                          .filter((id) => comments.find((c) => c.id === id))
                          .map((id) => {
                            const c = comments.find((cm) => cm.id === id)!;
                            return (
                              <div
                                key={id}
                                className="p-2 rounded border border-gray-100 dark:border-gray-800 text-[11px] text-muted-foreground"
                              >
                                <span className="font-medium">{c.author}:</span>{" "}
                                {c.text || "(vide)"}
                                <button
                                  className="ml-2 text-blue-400 hover:underline"
                                  onClick={() =>
                                    setResolvedComments((prev) =>
                                      prev.filter((r) => r !== id),
                                    )
                                  }
                                >
                                  Rouvrir
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Word Goal Dialog — IDEA-002 */}
      <Dialog open={showWordGoalDialog} onOpenChange={setShowWordGoalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Objectif de mots quotidien</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Définissez un objectif de mots pour cette session.
            </p>
            <div className="flex gap-2">
              {[500, 1000, 2000].map((n) => (
                <Button
                  key={n}
                  variant="outline"
                  size="sm"
                  onClick={() => setWordGoalInput(String(n))}
                  className={
                    wordGoalInput === String(n) ? "border-primary" : ""
                  }
                >
                  {n} mots
                </Button>
              ))}
            </div>
            <UIInput
              type="number"
              value={wordGoalInput}
              onChange={(e) => setWordGoalInput(e.target.value)}
              placeholder="Nombre de mots personnalisé..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setWordGoal(parseInt(wordGoalInput) || null);
                  setShowWordGoalDialog(false);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setWordGoal(null);
                setShowWordGoalDialog(false);
              }}
            >
              Supprimer l&apos;objectif
            </Button>
            <Button
              onClick={() => {
                setWordGoal(parseInt(wordGoalInput) || null);
                setShowWordGoalDialog(false);
              }}
            >
              Définir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Global Character/Word Count Status Bar — IDEA-002 + IDEA-003 */}
      <div className="flex-none relative w-full">
        {/* Collapsible footer content */}
        <div
          className={`flex items-center justify-between px-4 text-xs text-muted-foreground dark:text-gray-400 bg-card dark:bg-[#202124] border-t border-border dark:border-gray-800 shadow-[0_-1px_3px_rgba(0,0,0,0.02)] z-10 w-full overflow-hidden transition-all duration-200 ${footerOpen ? "max-h-10 py-1.5" : "max-h-0 py-0"}`}
        >
          <div className="flex items-center gap-3">
            <OfflineIndicator />
            <AutoSaveIndicator status={saveStatus} />
          </div>
          <div className="flex items-center gap-4">
            {/* Word count + goal */}
            <button
              onClick={() => {
                setWordGoalInput(wordGoal ? String(wordGoal) : "");
                setShowWordGoalDialog(true);
              }}
              className="flex items-center gap-1.5 hover:text-muted-foreground dark:hover:text-gray-200 transition-colors"
              title="Définir un objectif de mots"
            >
              <Target className="w-3 h-3" />
              <span>
                {(() => {
                  const words = editor.storage.characterCount?.words() || 0;
                  if (wordGoal) {
                    const pct = Math.min(
                      100,
                      Math.round((words / wordGoal) * 100),
                    );
                    return `${words} / ${wordGoal} mots (${pct}%)`;
                  }
                  return `${words} mots`;
                })()}
              </span>
              {wordGoal &&
                (() => {
                  const words = editor.storage.characterCount?.words() || 0;
                  const pct = Math.min(100, (words / wordGoal) * 100);
                  return (
                    <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-green-500" : "bg-blue-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  );
                })()}
            </button>
            {/* Reading time — IDEA-003 */}
            <span
              className="flex items-center gap-1"
              title="Temps de lecture estimé"
            >
              <Clock className="w-3 h-3" />~
              {Math.max(
                1,
                Math.ceil((editor.storage.characterCount?.words() || 0) / 200),
              )}{" "}
              min
            </span>
            <span>{editor.storage.characterCount?.characters() || 0} car.</span>
            {/* IDEA-012: Suggestion mode badge */}
            {suggestionModeActive && (
              <span className="flex items-center gap-1 text-orange-500 font-medium">
                <GitBranch className="w-3 h-3" />
                Suggestions
              </span>
            )}
            {/* IDEA-001: Focus mode toggle in status bar */}
            <button
              onClick={() => setIsFocusMode((prev) => !prev)}
              className="flex items-center gap-1 hover:text-muted-foreground dark:hover:text-gray-200 transition-colors"
              title="Mode focus (F11)"
            >
              {isFocusMode ? (
                <Minimize2 className="w-3 h-3" />
              ) : (
                <Maximize2 className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
        {/* Toggle button */}
        <button
          onClick={() => setFooterOpen((prev) => !prev)}
          className="absolute bottom-0 right-4 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground bg-card dark:bg-[#202124] border border-b-0 border-border dark:border-gray-800 rounded-t z-20"
          title={
            footerOpen ? "Masquer la barre d'état" : "Afficher la barre d'état"
          }
        >
          {footerOpen ? "▼" : "▲"} {footerOpen ? "Masquer" : "Barre d'état"}
        </button>
      </div>

      {/* Mail Merge Dialog */}
      <MailMerge
        editor={editor}
        open={mailMergeOpen}
        onOpenChange={setMailMergeOpen}
      />

      {/* Share Dialog */}
      <ShareDialog
        open={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        docId={documentId !== "new" ? documentId : ""}
        docTitle={documentName || "Document sans titre"}
      />

      <GenericFeatureModal
        isOpen={!!activeModal}
        actionId={activeModal?.id || null}
        actionLabel={activeModal?.label}
        onClose={() => setActiveModal(null)}
        documentId={documentId !== "new" ? documentId : undefined}
      />

      {/* Slash command: Image URL */}
      <Dialog
        open={showSlashImageDialog}
        onOpenChange={setShowSlashImageDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>URL de l&apos;image</DialogTitle>
          </DialogHeader>
          <UIInput
            value={slashImageUrl}
            onChange={(e) => setSlashImageUrl(e.target.value)}
            placeholder="https://..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                slashImageCallbackRef.current?.(slashImageUrl);
                setShowSlashImageDialog(false);
              }
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSlashImageDialog(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                slashImageCallbackRef.current?.(slashImageUrl);
                setShowSlashImageDialog(false);
              }}
            >
              Insérer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slash command: Embed Sheet */}
      <Dialog
        open={showEmbedSheetDialog}
        onOpenChange={setShowEmbedSheetDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Intégrer une feuille de calcul</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <UIInput
              value={embedSheetId}
              onChange={(e) => setEmbedSheetId(e.target.value)}
              placeholder="Sheet ID (depuis l'URL)"
              autoFocus
            />
            <UIInput
              value={embedSheetName}
              onChange={(e) => setEmbedSheetName(e.target.value)}
              placeholder="Nom de la feuille (ex: Sheet)"
            />
            <UIInput
              value={embedSheetRange}
              onChange={(e) => setEmbedSheetRange(e.target.value)}
              placeholder="Plage (ex: A1:D10, laisser vide pour tout)"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEmbedSheetDialog(false)}
            >
              Annuler
            </Button>
            <Button
              disabled={!embedSheetId.trim()}
              onClick={() => {
                embedSheetCallbackRef.current?.(
                  embedSheetId,
                  embedSheetName || "Sheet",
                  embedSheetRange,
                );
                setShowEmbedSheetDialog(false);
              }}
            >
              Intégrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ctrl+K link dialog */}
      <Dialog open={showCtrlKLinkDialog} onOpenChange={setShowCtrlKLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>URL du lien</DialogTitle>
          </DialogHeader>
          <UIInput
            value={ctrlKLinkUrl}
            onChange={(e) => setCtrlKLinkUrl(e.target.value)}
            placeholder="https://..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (ctrlKLinkUrl === "") {
                  editor?.chain().focus().unsetLink().run();
                } else {
                  editor
                    ?.chain()
                    .focus()
                    .extendMarkRange("link")
                    .setLink({ href: ctrlKLinkUrl })
                    .run();
                }
                setShowCtrlKLinkDialog(false);
              }
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCtrlKLinkDialog(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (ctrlKLinkUrl === "") {
                  editor?.chain().focus().unsetLink().run();
                } else {
                  editor
                    ?.chain()
                    .focus()
                    .extendMarkRange("link")
                    .setLink({ href: ctrlKLinkUrl })
                    .run();
                }
                setShowCtrlKLinkDialog(false);
              }}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New document dialog */}
      <Dialog open={showNewDocDialog} onOpenChange={setShowNewDocDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau document</DialogTitle>
          </DialogHeader>
          <UIInput
            value={newDocName}
            onChange={(e) => setNewDocName(e.target.value)}
            placeholder="Nom du document"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNewDocConfirm();
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewDocDialog(false)}
            >
              Annuler
            </Button>
            <Button onClick={handleNewDocConfirm}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insert image from menu */}
      <Dialog
        open={showInsertImageDialog}
        onOpenChange={setShowInsertImageDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>URL de l&apos;image</DialogTitle>
          </DialogHeader>
          <UIInput
            value={insertImageUrl}
            onChange={(e) => setInsertImageUrl(e.target.value)}
            placeholder="https://..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (insertImageUrl)
                  editor?.commands.setImage({ src: insertImageUrl });
                setShowInsertImageDialog(false);
              }
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInsertImageDialog(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (insertImageUrl)
                  editor?.commands.setImage({ src: insertImageUrl });
                setShowInsertImageDialog(false);
              }}
            >
              Insérer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insert link from menu */}
      <Dialog
        open={showInsertLinkDialog}
        onOpenChange={setShowInsertLinkDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>URL du lien</DialogTitle>
          </DialogHeader>
          <UIInput
            value={insertLinkUrl}
            onChange={(e) => setInsertLinkUrl(e.target.value)}
            placeholder="https://..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (insertLinkUrl) {
                  if (editor?.state.selection.empty) {
                    editor.commands.insertContent(
                      `<a href="${insertLinkUrl}">${insertLinkUrl}</a>`,
                    );
                  } else {
                    editor
                      ?.chain()
                      .focus()
                      .extendMarkRange("link")
                      .setLink({ href: insertLinkUrl })
                      .run();
                  }
                }
                setShowInsertLinkDialog(false);
              }
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInsertLinkDialog(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (insertLinkUrl) {
                  if (editor?.state.selection.empty) {
                    editor.commands.insertContent(
                      `<a href="${insertLinkUrl}">${insertLinkUrl}</a>`,
                    );
                  } else {
                    editor
                      ?.chain()
                      .focus()
                      .extendMarkRange("link")
                      .setLink({ href: insertLinkUrl })
                      .run();
                  }
                }
                setShowInsertLinkDialog(false);
              }}
            >
              Insérer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Page setup: background color */}
      <Dialog open={showPageSetupDialog} onOpenChange={setShowPageSetupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Couleur de fond</DialogTitle>
          </DialogHeader>
          <UIInput
            value={pageBgColorInput}
            onChange={(e) => setPageBgColorInput(e.target.value)}
            placeholder="#ffffff, lightblue..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setDocBgColor(pageBgColorInput);
                setShowPageSetupDialog(false);
              }
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPageSetupDialog(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                setDocBgColor(pageBgColorInput);
                setShowPageSetupDialog(false);
              }}
            >
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename document */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer le document</DialogTitle>
          </DialogHeader>
          <UIInput
            value={renameDocName}
            onChange={(e) => setRenameDocName(e.target.value)}
            placeholder="Nouveau nom..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (renameDocName)
                  toast.success(
                    `Document renommé en "${renameDocName}" avec succès.`,
                  );
                setShowRenameDialog(false);
              }
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRenameDialog(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (renameDocName)
                  toast.success(
                    `Document renommé en "${renameDocName}" avec succès.`,
                  );
                setShowRenameDialog(false);
              }}
            >
              Renommer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trash confirm */}
      <Dialog open={showTrashDialog} onOpenChange={setShowTrashDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mettre à la corbeille ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Voulez-vous placer ce document dans la corbeille ?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTrashDialog(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setShowTrashDialog(false);
                try {
                  if (documentId && documentId !== "new") {
                    const node = await driveApi.findNodeByTargetId(documentId);
                    if (node) {
                      await driveApi.deleteNode(node.id);
                    }
                  }
                  toast.success("Document placé dans la corbeille.");
                } catch {
                  toast.error("Erreur lors de la suppression.");
                }
                window.location.href = "/docs";
              }}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Editor;
