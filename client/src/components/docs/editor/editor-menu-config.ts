import { Editor } from '@tiptap/react';
import { LucideIcon } from 'lucide-react';
import { 
    Download, File, FolderOpen, Printer, Share, UserPlus, Mail, Copy, CheckCircle2, 
    Edit2, Trash2, History, Globe, Settings, FileText, Undo2, Redo2, Scissors, 
    Clipboard, ClipboardPaste, BoxSelect, Search, Image as ImageIcon, Table, 
    Blocks, Tag, PenTool, Link2, BarChart2, Smile, Layout, Minus, 
    ArrowRightToLine, Bookmark, LayoutTemplate, MessageSquarePlus, Bold, 
    Heading1, AlignLeft, MoveVertical, Columns, List, Hash, TabletSmartphone, 
    Grid3X3, Eraser, SpellCheck2, MessageSquareDiff, SplitSquareHorizontal, 
    Quote, PenLine, CheckSquare, ListOrdered, BookOpen, Languages, Mic, Wand2, 
    Bell, User, Type, Info, AtSign
} from 'lucide-react';

export type DynamicMenuItem =
  | {
      type: 'item';
      id: string;
      label: string;
      icon?: LucideIcon;
      iconOpacity?: string;
      shortcut?: string;
      action?: (editor: Editor | null) => void;
      isActive?: (editor: Editor | null) => boolean;
      isDisabled?: (editor: Editor | null) => boolean;
    }
  | {
      type: 'separator';
      id: string;
    }
  | {
      type: 'submenu';
      id: string;
      label: string;
      icon?: LucideIcon;
      iconOpacity?: string;
      contentClassName?: string;
      items: DynamicMenuItem[];
    }
  | {
      type: 'link';
      id: string;
      label: string;
      icon?: LucideIcon;
      iconOpacity?: string;
      href: string;
    };

export interface DynamicMenuCategory {
  id: string;
  label: string;
  contentClassName?: string;
  items: DynamicMenuItem[];
}

export const editorMenuConfig: DynamicMenuCategory[] = [
  {
    id: 'file',
    label: 'Fichier',
    contentClassName: 'w-[300px]',
    items: [
      {
        type: 'submenu',
        id: 'new',
        label: 'Nouveau',
        icon: File,
        items: [
          { type: 'link', id: 'new-doc', label: 'Document', href: '/docs' },
          { type: 'link', id: 'new-template', label: 'À partir d\'un modèle', href: '/docs' },
        ],
      },
      { type: 'item', id: 'open', label: 'Ouvrir', icon: FolderOpen, shortcut: 'Ctrl+O' },
      { type: 'item', id: 'copy-doc', label: 'Créer une copie', icon: Copy },
      { type: 'separator', id: 'sep1' },
      {
        type: 'submenu',
        id: 'share',
        label: 'Partager',
        icon: UserPlus,
        items: [
          { type: 'item', id: 'share-others', label: 'Partager avec d\'autres personnes' },
          { type: 'item', id: 'publish-web', label: 'Publier sur le Web' },
        ],
      },
      {
        type: 'submenu',
        id: 'email',
        label: 'Envoyer par e-mail',
        icon: Mail,
        items: [
          { type: 'item', id: 'email-file', label: 'Envoyer ce fichier par e-mail' },
          { type: 'item', id: 'email-copy', label: 'M\'envoyer une copie par e-mail' },
        ],
      },
      {
        type: 'submenu',
        id: 'download',
        label: 'Télécharger',
        icon: Download,
        items: [
          { type: 'item', id: 'download-pdf', label: 'Document PDF (.pdf)', action: () => window.print() },
          {
            type: 'item',
            id: 'download-txt',
            label: 'Format texte simple (.txt)',
            action: (editor) => {
              if (!editor) return;
              const element = document.createElement("a");
              const text = editor.getText();
              const file = new Blob([text], { type: 'text/plain' });
              element.href = URL.createObjectURL(file);
              element.download = "document.txt";
              document.body.appendChild(element); // Required for FireFox
              element.click();
              document.body.removeChild(element);
            },
          },
        ],
      },
      { type: 'item', id: 'approvals', label: 'Approbations', icon: CheckCircle2 },
      { type: 'separator', id: 'sep2' },
      { type: 'item', id: 'rename', label: 'Renommer', icon: Edit2 },
      { type: 'item', id: 'trash', label: 'Placer dans la corbeille', icon: Trash2 },
      { type: 'separator', id: 'sep3' },
      {
        type: 'submenu',
        id: 'history',
        label: 'Historique des versions',
        icon: History,
        items: [
          { type: 'item', id: 'name-version', label: 'Nommer la version actuelle' },
          { type: 'item', id: 'show-history', label: 'Afficher l\'historique des versions' },
        ],
      },
      { type: 'item', id: 'offline', label: 'Rendre disponible hors connexion', icon: CheckCircle2, iconOpacity: '50' },
      { type: 'separator', id: 'sep4' },
      { type: 'item', id: 'details', label: 'Détails', icon: Info, iconOpacity: '50' },
      { type: 'item', id: 'security', label: 'Limites de sécurité', icon: AtSign, iconOpacity: '50' },
      {
        type: 'submenu',
        id: 'language',
        label: 'Langue',
        icon: Globe,
        items: [
          { type: 'item', id: 'lang-fr', label: 'Français' },
          { type: 'item', id: 'lang-en', label: 'English' },
        ],
      },
      { type: 'item', id: 'page-setup', label: 'Configuration de la page', icon: Settings },
      { type: 'item', id: 'print', label: 'Imprimer', icon: Printer, shortcut: 'Ctrl+P', action: () => window.print() },
    ],
  },
  {
    id: 'edit',
    label: 'Édition',
    contentClassName: 'w-64',
    items: [
      { type: 'item', id: 'undo', label: 'Annuler', icon: Undo2, shortcut: 'Ctrl+Z', action: (e) => e?.chain().focus().undo().run(), isDisabled: (e) => !e?.can().undo() },
      { type: 'item', id: 'redo', label: 'Rétablir', icon: Redo2, shortcut: 'Ctrl+Y', action: (e) => e?.chain().focus().redo().run(), isDisabled: (e) => !e?.can().redo() },
      { type: 'separator', id: 'sep-e1' },
      { type: 'item', id: 'cut', label: 'Couper', icon: Scissors, shortcut: 'Ctrl+X', action: (e) => { e?.chain().focus().run(); document.execCommand('cut'); } },
      { type: 'item', id: 'copy', label: 'Copier', icon: Copy, shortcut: 'Ctrl+C', action: (e) => { e?.chain().focus().run(); document.execCommand('copy'); } },
      { type: 'item', id: 'paste', label: 'Coller', icon: Clipboard, shortcut: 'Ctrl+V', action: async (e) => {
          try {
            const text = await navigator.clipboard.readText();
            e?.chain().focus().insertContent(text).run();
          } catch (err) {
            console.error('Failed to read clipboard: ', err);
          }
        }
      },
      { type: 'item', id: 'paste-plain', label: 'Coller sans la mise en forme', icon: ClipboardPaste, shortcut: 'Ctrl+Maj+V', action: async (e) => {
          try {
            const text = await navigator.clipboard.readText();
            e?.chain().focus().insertContent(text).run();
          } catch (err) {
            console.error('Failed to read clipboard: ', err);
          }
        }
      },
      { type: 'separator', id: 'sep-e2' },
      { type: 'item', id: 'select-all', label: 'Tout sélectionner', icon: BoxSelect, shortcut: 'Ctrl+A', action: (e) => e?.chain().focus().selectAll().run() },
      { type: 'item', id: 'delete', label: 'Supprimer', icon: Trash2, action: (e) => e?.chain().focus().deleteSelection().run(), isDisabled: (e) => !!e?.state.selection.empty },
      { type: 'separator', id: 'sep-e3' },
      { type: 'item', id: 'find-replace', label: 'Rechercher et remplacer', icon: Search, shortcut: 'Ctrl+H' },
    ],
  },
  {
    id: 'view',
    label: 'Affichage',
    contentClassName: 'w-56',
    items: [
      {
        type: 'submenu',
        id: 'mode',
        label: 'Mode',
        items: [
          { type: 'item', id: 'mode-edit', label: 'Modification', icon: Edit2 },
          { type: 'item', id: 'mode-suggest', label: 'Suggestion', icon: MessageSquarePlus },
          { type: 'item', id: 'mode-read', label: 'Lecture', icon: BookOpen },
        ],
      },
      { type: 'separator', id: 'sep-v1' },
      { type: 'item', id: 'show-ruler', label: 'Afficher la règle', icon: CheckCircle2 },
      { type: 'item', id: 'show-outline', label: 'Afficher le plan', icon: CheckCircle2 },
      { type: 'item', id: 'show-eq', label: 'Afficher la barre d\'équations', icon: CheckCircle2, iconOpacity: '0' },
      { type: 'item', id: 'show-nonprint', label: 'Afficher les caractères non imprimables', icon: CheckCircle2, iconOpacity: '0' },
      { type: 'separator', id: 'sep-v2' },
      { type: 'item', id: 'fullscreen', label: 'Plein écran', icon: Layout, iconOpacity: '50' },
    ],
  },
  {
    id: 'insert',
    label: 'Insertion',
    contentClassName: 'w-[320px]',
    items: [
      {
        type: 'submenu',
        id: 'ins-image',
        label: 'Image',
        icon: ImageIcon,
        items: [
          { type: 'item', id: 'img-upload', label: 'Importer depuis l\'ordinateur' },
          { type: 'item', id: 'img-web', label: 'Rechercher sur le Web' },
          { type: 'item', id: 'img-drive', label: 'Drive' },
          { type: 'item', id: 'img-photos', label: 'Photos' },
          { type: 'item', id: 'img-url', label: 'URL' },
          { type: 'item', id: 'img-cam', label: 'Caméra' },
        ],
      },
      {
        type: 'submenu',
        id: 'ins-table',
        label: 'Tableau',
        icon: Table,
        items: [
          { type: 'item', id: 'tbl-3x3', label: 'Tableau 3x3', action: (e) => e?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
          { type: 'item', id: 'tbl-tpl', label: 'Modèles de tableaux' },
        ],
      },
      {
        type: 'submenu',
        id: 'ins-blocks',
        label: 'Composants de base',
        icon: Blocks,
        items: [
          { type: 'item', id: 'blk-meet', label: 'Notes de réunion' },
          { type: 'item', id: 'blk-mail', label: 'Brouillon d\'e-mail' },
          { type: 'item', id: 'blk-review', label: 'Outil de suivi des avis' },
          { type: 'item', id: 'blk-project', label: 'Suivi des éléments de projet' },
        ],
      },
      {
        type: 'submenu',
        id: 'ins-chips',
        label: 'Chips intelligents',
        icon: Tag,
        items: [
          { type: 'item', id: 'chip-date', label: 'Date' },
          { type: 'item', id: 'chip-dropdown', label: 'Menu déroulant' },
        ],
      },
      {
        type: 'submenu',
        id: 'ins-signature',
        label: 'Champs de signature électronique',
        icon: PenLine,
        items: [
          { type: 'item', id: 'sig-sig', label: 'Signature' },
          { type: 'item', id: 'sig-init', label: 'Initiales' },
          { type: 'item', id: 'sig-date', label: 'Date de signature' },
        ],
      },
      { type: 'item', id: 'ins-link', label: 'Lien', icon: Link2, shortcut: 'Ctrl+K' },
      {
        type: 'submenu',
        id: 'ins-draw',
        label: 'Dessin',
        icon: PenTool,
        iconOpacity: '50',
        items: [
          { type: 'item', id: 'draw-new', label: 'Nouveau' },
          { type: 'item', id: 'draw-drive', label: 'À partir de Drive' },
        ],
      },
      {
        type: 'submenu',
        id: 'ins-chart',
        label: 'Graphique',
        icon: BarChart2,
        iconOpacity: '50',
        items: [
          { type: 'item', id: 'chart-bar', label: 'Barres' },
          { type: 'item', id: 'chart-col', label: 'Colonnes' },
          { type: 'item', id: 'chart-line', label: 'Ligne' },
          { type: 'item', id: 'chart-pie', label: 'Secteur' },
          { type: 'separator', id: 'sep-chart' },
          { type: 'item', id: 'chart-sheets', label: 'À partir de Sheets' },
        ],
      },
      { type: 'item', id: 'ins-symbols', label: 'Symboles', icon: Smile, iconOpacity: '50' },
      { type: 'separator', id: 'sep-i1' },
      { type: 'item', id: 'ins-tab', label: 'Onglet', icon: Layout, iconOpacity: '50', shortcut: 'Maj+F11' },
      { type: 'item', id: 'ins-hr', label: 'Ligne horizontale', icon: Minus, action: (e) => e?.chain().focus().setHorizontalRule().run() },
      {
        type: 'submenu',
        id: 'ins-break',
        label: 'Saut',
        icon: ArrowRightToLine,
        iconOpacity: '50',
        items: [
          { type: 'item', id: 'brk-page', label: 'Saut de page' },
          { type: 'item', id: 'brk-sec-next', label: 'Saut de section (page suivante)' },
          { type: 'item', id: 'brk-sec-cont', label: 'Saut de section (en continu)' },
        ],
      },
      { type: 'item', id: 'ins-bookmark', label: 'Signet', icon: Bookmark, iconOpacity: '50' },
      {
        type: 'submenu',
        id: 'ins-page-elem',
        label: 'Éléments de page',
        icon: LayoutTemplate,
        iconOpacity: '50',
        items: [
          { type: 'item', id: 'pelem-header', label: 'En-tête' },
          { type: 'item', id: 'pelem-footer', label: 'Pied de page' },
          { type: 'item', id: 'pelem-num', label: 'Numéros de page' },
        ],
      },
      { type: 'separator', id: 'sep-i2' },
      { type: 'item', id: 'ins-comment', label: 'Commentaire', icon: MessageSquarePlus, iconOpacity: '50', shortcut: 'Ctrl+Alt+M' },
    ],
  },
  {
    id: 'format',
    label: 'Format',
    contentClassName: 'w-[300px]',
    items: [
      {
        type: 'submenu',
        id: 'fmt-text',
        label: 'Texte',
        icon: Type,
        contentClassName: 'w-48',
        items: [
          { type: 'item', id: 'bold', label: 'Gras', shortcut: 'Ctrl+B', action: (e) => e?.chain().focus().toggleBold().run(), isActive: (e) => !!e?.isActive('bold') },
          { type: 'item', id: 'italic', label: 'Italique', shortcut: 'Ctrl+I', action: (e) => e?.chain().focus().toggleItalic().run(), isActive: (e) => !!e?.isActive('italic') },
          { type: 'item', id: 'underline', label: 'Souligné', shortcut: 'Ctrl+U', action: (e) => e?.chain().focus().toggleUnderline().run(), isActive: (e) => !!e?.isActive('underline') },
          { type: 'item', id: 'strike', label: 'Barré', shortcut: 'Alt+Maj+5', action: (e) => e?.chain().focus().toggleStrike().run(), isActive: (e) => !!e?.isActive('strike') },
          { type: 'separator', id: 'sep-t1' },
          { type: 'item', id: 'sup', label: 'Exposant', shortcut: 'Ctrl+.' },
          { type: 'item', id: 'sub', label: 'Indice', shortcut: 'Ctrl+,' },
          { type: 'item', id: 'size', label: 'Taille' },
          { type: 'item', id: 'case', label: 'Majuscules/Minuscules' },
        ],
      },
      {
        type: 'submenu',
        id: 'fmt-para',
        label: 'Styles de paragraphe',
        icon: Heading1,
        items: [
          { type: 'item', id: 'para-border', label: 'Bordures et trame' },
          { type: 'separator', id: 'sep-p1' },
          { type: 'item', id: 'para-norm', label: 'Texte normal' },
          { type: 'item', id: 'para-title', label: 'Titre' },
          { type: 'item', id: 'para-sub', label: 'Sous-titre' },
          { type: 'item', id: 'para-h1', label: 'Titre 1' },
          { type: 'item', id: 'para-h2', label: 'Titre 2' },
          { type: 'item', id: 'para-h3', label: 'Titre 3' },
          { type: 'separator', id: 'sep-p2' },
          { type: 'item', id: 'para-opt', label: 'Options' },
        ],
      },
      {
        type: 'submenu',
        id: 'fmt-align',
        label: 'Aligner et mettre en retrait',
        icon: AlignLeft,
        items: [
          { type: 'item', id: 'align-left', label: 'À gauche', shortcut: 'Ctrl+Maj+L', action: (e) => e?.chain().focus().setTextAlign('left').run() },
          { type: 'item', id: 'align-center', label: 'Au centre', shortcut: 'Ctrl+Maj+E', action: (e) => e?.chain().focus().setTextAlign('center').run() },
          { type: 'item', id: 'align-right', label: 'À droite', shortcut: 'Ctrl+Maj+R', action: (e) => e?.chain().focus().setTextAlign('right').run() },
          { type: 'item', id: 'align-justify', label: 'Justifier', shortcut: 'Ctrl+Maj+J', action: (e) => e?.chain().focus().setTextAlign('justify').run() },
          { type: 'separator', id: 'sep-a1' },
          { type: 'item', id: 'indent-inc', label: 'Augmenter le retrait' },
          { type: 'item', id: 'indent-dec', label: 'Diminuer le retrait' },
          { type: 'item', id: 'indent-opt', label: 'Options de retrait' },
        ],
      },
      {
        type: 'submenu',
        id: 'fmt-spacing',
        label: 'Interligne et espace entre paragraphes',
        icon: MoveVertical,
        items: [
          { type: 'item', id: 'sp-single', label: 'Simple' },
          { type: 'item', id: 'sp-115', label: '1.15' },
          { type: 'item', id: 'sp-15', label: '1.5' },
          { type: 'item', id: 'sp-double', label: 'Double' },
          { type: 'separator', id: 'sep-s1' },
          { type: 'item', id: 'sp-add-b', label: 'Ajouter un espace avant' },
          { type: 'item', id: 'sp-add-a', label: 'Ajouter un espace après' },
        ],
      },
      {
        type: 'submenu',
        id: 'fmt-cols',
        label: 'Colonnes',
        icon: Columns,
        items: [
          { type: 'item', id: 'col-1', label: '1 colonne' },
          { type: 'item', id: 'col-2', label: '2 colonnes' },
          { type: 'item', id: 'col-3', label: '3 colonnes' },
        ],
      },
      {
        type: 'submenu',
        id: 'fmt-lists',
        label: 'Puces et numéros',
        icon: List,
        items: [
          { type: 'item', id: 'list-ol', label: 'Liste numérotée' },
          { type: 'item', id: 'list-ul', label: 'Liste à puces' },
          { type: 'item', id: 'list-chk', label: 'Checklist' },
        ],
      },
      { type: 'separator', id: 'sep-f1' },
      { type: 'item', id: 'fmt-hf', label: 'En-têtes et pieds de page', icon: LayoutTemplate, iconOpacity: '50' },
      { type: 'item', id: 'fmt-num', label: 'Numéros de page', icon: Hash, iconOpacity: '50' },
      { type: 'item', id: 'fmt-ori', label: 'Orientation de la page', icon: TabletSmartphone, iconOpacity: '50' },
      { type: 'item', id: 'fmt-page', label: 'Passer au format Sans pages', icon: Layout, iconOpacity: '50' },
      { type: 'separator', id: 'sep-f2' },
      {
        type: 'submenu',
        id: 'fmt-tbl',
        label: 'Tableau',
        icon: Table,
        iconOpacity: '50',
        items: [
          { type: 'item', id: 'tbl-prop', label: 'Propriétés du tableau' },
        ],
      },
      {
        type: 'submenu',
        id: 'fmt-img',
        label: 'Image',
        icon: ImageIcon,
        iconOpacity: '50',
        items: [
          { type: 'item', id: 'img-opt', label: 'Options d\'image' },
        ],
      },
      {
        type: 'submenu',
        id: 'fmt-borders',
        label: 'Bordures et lignes',
        icon: Grid3X3,
        iconOpacity: '50',
        items: [
          { type: 'item', id: 'brd-color', label: 'Couleur de la bordure' },
          { type: 'item', id: 'brd-width', label: 'Épaisseur de la bordure' },
        ],
      },
      { type: 'separator', id: 'sep-f3' },
      { type: 'item', id: 'fmt-clear', label: 'Supprimer la mise en forme', icon: Eraser, shortcut: 'Ctrl+\\', action: (e) => e?.chain().focus().clearNodes().unsetAllMarks().run() },
    ],
  },
  {
    id: 'tools',
    label: 'Outils',
    contentClassName: 'w-[320px]',
    items: [
      {
        type: 'submenu',
        id: 'tool-spell',
        label: 'Grammaire et orthographe',
        icon: SpellCheck2,
        items: [
          { type: 'item', id: 'spell-check', label: 'Vérification orthographique et grammaticale', shortcut: 'Ctrl+Alt+X' },
          { type: 'item', id: 'spell-dict', label: 'Dictionnaire personnel' },
        ],
      },
      { type: 'item', id: 'tool-wordcount', label: 'Nombre de mots', icon: Hash, shortcut: 'Ctrl+Maj+C' },
      { type: 'item', id: 'tool-review', label: 'Examiner les modifications suggérées', icon: MessageSquareDiff, iconOpacity: '50', shortcut: 'Ctrl+Alt+O Ctrl+Alt+U' },
      { type: 'item', id: 'tool-compare', label: 'Comparer des documents', icon: SplitSquareHorizontal, iconOpacity: '50' },
      { type: 'item', id: 'tool-quotes', label: 'Citations', icon: Quote, iconOpacity: '50' },
      { type: 'item', id: 'tool-esig', label: 'Signatures électroniques', icon: PenLine, iconOpacity: '50' },
      { type: 'item', id: 'tool-tasks', label: 'Tâches', icon: CheckSquare, iconOpacity: '50' },
      { type: 'item', id: 'tool-lineno', label: 'Numéros de ligne', icon: ListOrdered, iconOpacity: '50' },
      { type: 'item', id: 'tool-linked', label: 'Objets associés', icon: Link2, iconOpacity: '50' },
      { type: 'item', id: 'tool-dict', label: 'Dictionnaire', icon: BookOpen, iconOpacity: '50', shortcut: 'Ctrl+Maj+Y' },
      { type: 'separator', id: 'sep-o1' },
      { type: 'item', id: 'tool-translate', label: 'Traduire le document', icon: Languages, iconOpacity: '50' },
      { type: 'item', id: 'tool-voice', label: 'Saisie vocale', icon: Mic, iconOpacity: '50', shortcut: 'Ctrl+Maj+S' },
      { type: 'item', id: 'tool-gemini', label: 'Gemini', icon: Wand2 },
      { type: 'separator', id: 'sep-o2' },
      { type: 'item', id: 'tool-notif', label: 'Paramètres de notification', icon: Bell, iconOpacity: '50' },
      { type: 'item', id: 'tool-pref', label: 'Préférences', icon: Settings, iconOpacity: '50' },
      { type: 'item', id: 'tool-access', label: 'Accessibilité', icon: User, iconOpacity: '50' },
    ],
  },
  {
    id: 'extensions',
    label: 'Extensions',
    contentClassName: 'w-[200px]',
    items: [
      { type: 'item', id: 'ext-manage', label: 'Gérer les extensions' },
    ],
  },
  {
    id: 'help',
    label: 'Aide',
    contentClassName: 'w-[200px]',
    items: [
      { type: 'item', id: 'help-search', label: 'Recherche... (Alt+/)' },
      { type: 'item', id: 'help-help', label: 'Aide' },
    ],
  },
];
