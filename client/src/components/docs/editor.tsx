'use client';

import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { SlashCommands, getSuggestionOptions } from './slash-commands';
import { Comment } from './comment-extension';
import { v4 as uuidv4 } from 'uuid';
import { useEffect, useState, useRef, useCallback } from 'react';
import { fetchAndParseDocument } from '@/lib/file-parsers';
import {
    Sparkles,
    Wand2,
    CheckCheck,
    FileText,
    Loader2,
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
    Video
} from 'lucide-react';
import { useAiStream } from '@/hooks/use-ai-stream';
import { toast } from 'sonner';

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const lowlight = createLowlight(common);

const getRandomColor = () => {
    const colors = ['#958DF1', '#F98181', '#FBBC88', '#FAF594', '#70CFF8', '#94FADB', '#B9F18D'];
    return colors[Math.floor(Math.random() * colors.length)];
};

interface EditorProps {
    documentId: string;
    className?: string;
    userName?: string;
    bucket?: string;
    fileName?: string;
    initialContent?: string;
}

type FloatingMode = 'menu' | 'prompt' | 'translate';

const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Fran\u00e7ais' },
    { code: 'es', label: 'Espa\u00f1ol' },
    { code: 'de', label: 'Deutsch' },
    { code: 'it', label: 'Italiano' },
    { code: 'pt', label: 'Portugu\u00eas' },
];

// =====================================================================
// MENU BAR COMPONENT (Docs)
// =====================================================================
function MenuBar({ editor, onAction }: { editor: any, onAction: (action: string) => void }) {
    const [openMenu, setOpenMenu] = useState<string | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenu(null)
            }
        }
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [])

    type MenuItem = { label?: string, action?: string, icon?: React.ReactNode, shortcut?: string, sep?: boolean, subItems?: MenuItem[] };
    type MenuGroup = { id: string, label: string, items: MenuItem[] };

    const menus: MenuGroup[] = [
        {
            id: 'file', label: 'Fichier', items: [
                { label: 'Nouveau', subItems: [
                    { label: 'Document', action: 'newDoc', icon: <FileText className="w-4 h-4" /> },
                    { label: 'De mod\u00E8le', action: 'todo' }
                ]},
                { label: 'Ouvrir', action: 'todo', shortcut: 'Ctrl+O' },
                { label: 'Cr\u00E9er une copie', action: 'todo' },
                { sep: true },
                { label: 'Partager', subItems: [
                    { label: 'Partager avec d\'autres personnes', action: 'todo' },
                    { label: 'Publier sur le Web', action: 'todo' }
                ]},
                { label: 'Envoyer par e-mail', action: 'todo' },
                { label: 'T\u00E9l\u00E9charger', subItems: [
                    { label: 'Document PDF (.pdf)', action: 'downloadPdf' },
                    { label: 'Microsoft Word (.docx)', action: 'todo' },
                    { label: 'Format OpenDocument (.odt)', action: 'todo' },
                    { label: 'Texte brut (.txt)', action: 'todo' }
                ]},
                { label: 'Approbations', action: 'todo' },
                { sep: true },
                { label: 'Renommer', action: 'todo' },
                { label: 'Placer dans la corbeille', action: 'todo' },
                { sep: true },
                { label: 'Historique des versions', action: 'todo' },
                { label: 'Rendre disponible hors connexion', action: 'todo' },
                { sep: true },
                { label: 'D\u00E9tails', action: 'todo' },
                { label: 'Limites de s\u00E9curit\u00E9', action: 'todo' },
                { label: 'Langue', action: 'todo' },
                { label: 'Configuration de la page', action: 'todo' },
                { label: 'Imprimer', action: 'print', shortcut: 'Ctrl+P' }
            ]
        },
        {
            id: 'edit', label: '\u00C9dition', items: [
                { label: 'Annuler', icon: <Undo className="w-4 h-4" />, action: 'undo', shortcut: 'Ctrl+Z' },
                { label: 'R\u00E9tablir', icon: <Redo className="w-4 h-4" />, action: 'redo', shortcut: 'Ctrl+Y' },
                { sep: true },
                { label: 'Couper', icon: <X className="w-4 h-4" />, action: 'cut', shortcut: 'Ctrl+X' },
                { label: 'Copier', action: 'copy', shortcut: 'Ctrl+C' },
                { label: 'Coller', action: 'paste', shortcut: 'Ctrl+V' },
                { label: 'Coller sans la mise en forme', action: 'pasteText', shortcut: 'Ctrl+Maj+V' },
                { sep: true },
                { label: 'Tout s\u00E9lectionner', action: 'selectAll', shortcut: 'Ctrl+A' },
                { label: 'Supprimer', action: 'delete' },
                { sep: true },
                { label: 'Rechercher et remplacer', action: 'todo', shortcut: 'Ctrl+H' }
            ]
        },
        {
            id: 'view', label: 'Affichage', items: [
                { label: 'Mode d\'affichage', subItems: [
                    { label: 'Modification', action: 'todo' },
                    { label: 'Suggestion', action: 'todo' },
                    { label: 'Lecture', action: 'todo' }
                ]},
                { sep: true },
                { label: 'Afficher la r\u00E8gle', action: 'todo' },
                { label: 'Afficher le plan', action: 'todo' },
                { label: 'Afficher la barre d\'\u00E9quations', action: 'todo' },
                { label: 'Afficher les caract\u00E8res non imprimables', action: 'todo' },
                { sep: true },
                { label: 'Plein \u00E9cran', action: 'todo' }
            ]
        },
        {
            id: 'insert', label: 'Insertion', items: [
                { label: 'Image', icon: <ImageIcon className="w-4 h-4" />, action: 'insertImage' },
                { label: 'Tableau', icon: <TableIcon className="w-4 h-4" />, subItems: [
                    { label: 'Mod\u00E8les de tableaux', action: 'todo' },
                    { label: 'Ins\u00E9rer un tableau simple', action: 'insertTable' }
                ]},
                { label: 'Composants de base', action: 'todo' },
                { label: 'Chips intelligents', action: 'todo' },
                { label: 'Champs de signature \u00E9lectronique', action: 'todo' },
                { label: 'Lien', icon: <LinkIcon className="w-4 h-4" />, action: 'insertLink', shortcut: 'Ctrl+K' },
                { label: 'Dessin', action: 'todo' },
                { label: 'Graphique', action: 'todo' },
                { label: 'Symboles', action: 'todo' },
                { sep: true },
                { label: 'Onglet', action: 'todo', shortcut: 'Maj+F11' },
                { label: 'Ligne horizontale', action: 'insertHorizontalRule' },
                { label: 'Saut', subItems: [
                    { label: 'Saut de page', action: 'insertHardBreak', shortcut: 'Ctrl+Entr\u00E9e' },
                    { label: 'Saut de section', action: 'todo' }
                ]},
                { label: 'Signet', action: 'todo' },
                { label: '\u00C9l\u00E9ments de page', action: 'todo' },
                { sep: true },
                { label: 'Commentaire', action: 'todo', shortcut: 'Ctrl+Alt+M' }
            ]
        },
        {
            id: 'format', label: 'Format', items: [
                { label: 'Texte', subItems: [
                    { label: 'Gras', icon: <Bold className="w-4 h-4" />, action: 'toggleBold', shortcut: 'Ctrl+B' },
                    { label: 'Italique', icon: <Italic className="w-4 h-4" />, action: 'toggleItalic', shortcut: 'Ctrl+I' },
                    { label: 'Soulign\u00E9', icon: <UnderlineIcon className="w-4 h-4" />, action: 'toggleUnderline', shortcut: 'Ctrl+U' },
                    { label: 'Barr\u00E9', icon: <Strikethrough className="w-4 h-4" />, action: 'toggleStrike', shortcut: 'Alt+Maj+5' },
                    { label: 'Exposant', action: 'toggleSuperscript', shortcut: 'Ctrl+.' },
                    { label: 'Indice', action: 'toggleSubscript', shortcut: 'Ctrl+,' },
                    { label: 'Taille', action: 'todo' }
                ]},
                { label: 'Styles de paragraphe', subItems: [
                    { label: 'Bordures et trames', action: 'todo' },
                    { label: 'En-t\u00EAte 1', action: 'toggleH1' },
                    { label: 'En-t\u00EAte 2', action: 'toggleH2' },
                    { label: 'En-t\u00EAte 3', action: 'toggleH3' },
                    { label: 'Texte normal', action: 'setParagraph' }
                ]},
                { label: 'Aligner et mettre en retrait', subItems: [
                    { label: 'Gauche', action: 'alignLeft', shortcut: 'Ctrl+Maj+L' },
                    { label: 'Centre', action: 'alignCenter', shortcut: 'Ctrl+Maj+E' },
                    { label: 'Droite', action: 'alignRight', shortcut: 'Ctrl+Maj+R' },
                    { label: 'Justifier', action: 'alignJustify', shortcut: 'Ctrl+Maj+J' },
                    { sep: true },
                    { label: 'Augmenter le retrait', action: 'todo' },
                    { label: 'Diminuer le retrait', action: 'todo' }
                ]},
                { label: 'Interligne et espace entre paragraphes', subItems: [
                    { label: 'Simple', action: 'todo' },
                    { label: '1.15', action: 'todo' },
                    { label: '1.5', action: 'todo' },
                    { label: 'Double', action: 'todo' }
                ]},
                { label: 'Colonnes', action: 'todo' },
                { label: 'Puces et num\u00E9ros', subItems: [
                    { label: 'Liste num\u00E9rot\u00E9e', action: 'toggleOrderedList', shortcut: 'Ctrl+Maj+7' },
                    { label: 'Liste \u00E0 puces', action: 'toggleBulletList', shortcut: 'Ctrl+Maj+8' },
                    { label: 'Checklist', action: 'toggleTaskList', shortcut: 'Ctrl+Maj+9' }
                ]},
                { sep: true },
                { label: 'En-t\u00EAtes et pieds de page', action: 'todo' },
                { label: 'Num\u00E9ros de page', action: 'todo' },
                { label: 'Orientation de la page', action: 'todo' },
                { label: 'Passer au format Sans pages', action: 'todo' },
                { sep: true },
                { label: 'Tableau', action: 'todo' },
                { label: 'Image', action: 'todo' },
                { label: 'Bordures et lignes', action: 'todo' },
                { sep: true },
                { label: 'Supprimer la mise en forme', action: 'clearFormat', shortcut: 'Ctrl+\\' }
            ]
        },
        {
            id: 'tools', label: 'Outils', items: [
                { label: 'Orthographe et grammaire', action: 'todo' },
                { label: 'D\u00E9compte des mots', action: 'todo', shortcut: 'Ctrl+Maj+C' },
                { label: 'R\u00E9viser les modifications sugg\u00E9r\u00E9es', action: 'todo' },
                { label: 'Citations', action: 'todo' },
                { sep: true },
                { label: 'Assistant IA (G\u00E9n\u00E9rer)', icon: <Sparkles className="w-4 h-4" />, action: 'aiGenerate' },
                { label: 'R\u00E9sumer', action: 'aiSummarize' },
                { label: 'Traduire en anglais', icon: <Languages className="w-4 h-4" />, action: 'translateEn' }
            ]
        },
        {
            id: 'extensions', label: 'Extensions', items: [
                { label: 'Modules compl\u00E9mentaires', action: 'todo' },
                { label: 'Apps Script', action: 'todo' }
            ]
        },
        {
            id: 'help', label: 'Aide', items: [
                { label: 'Aide SignApps Docs', action: 'todo' },
                { label: 'Formation', action: 'todo' },
                { label: 'Mises \u00E0 jour', action: 'todo' }
            ]
        }
    ]

    const renderMenuItem = (item: MenuItem, idx: number, level: number = 0) => {
        if (item.sep) {
            return <div key={`sep-${idx}`} className="h-px bg-[#dadce0] dark:bg-[#5f6368] my-1 mx-0" />;
        }
        
        const hasSubMenu = item.subItems && item.subItems.length > 0;
        
        return (
            <div key={item.label || idx} className="relative group/sub">
                <button
                    className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] flex items-center justify-between text-[#202124] dark:text-[#e8eaed] text-[13px]"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasSubMenu) return; // Do nothing if it's a submenu parent
                        if (item.action) onAction(item.action);
                        setOpenMenu(null);
                    }}
                >
                    <div className="flex items-center gap-3">
                        {item.icon ? <div className="text-[#5f6368] dark:text-[#9aa0a6] w-4">{item.icon}</div> : <div className="w-4" />}
                        <span>{item.label}</span>
                    </div>
                    <div className="flex items-center">
                        {item.shortcut && <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] font-sans tracking-wide ml-4">{item.shortcut}</span>}
                        {hasSubMenu && <span className="ml-3 text-[10px] text-[#5f6368] dark:text-[#9aa0a6]">▶</span>}
                    </div>
                </button>
                
                {/* Submenu rendering via CSS hover */}
                {hasSubMenu && (
                    <div className="absolute top-0 left-full -mt-1 hidden group-hover/sub:block bg-white dark:bg-[#2d2e30] border border-[#dadce0] dark:border-[#5f6368] rounded shadow-lg z-50 py-1 min-w-[220px]">
                        {item.subItems!.map((subItem, sIdx) => renderMenuItem(subItem, sIdx, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div ref={menuRef} className="flex gap-1 text-[13px] text-[#444746] dark:text-[#9aa0a6] mt-0.5 relative">
            {menus.map(menu => (
                <div key={menu.id} className="relative">
                    <button
                        className={`hover:bg-[#f1f3f4] dark:hover:bg-[#303134] px-2 py-0.5 rounded cursor-pointer transition-colors ${openMenu === menu.id ? 'bg-[#f1f3f4] dark:bg-[#303134] text-[#202124] dark:text-[#e8eaed]' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenu(openMenu === menu.id ? null : menu.id)
                        }}
                        onMouseEnter={() => {
                            if (openMenu && openMenu !== menu.id) setOpenMenu(menu.id)
                        }}
                    >
                        {menu.label}
                    </button>
                    {openMenu === menu.id && (
                        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#2d2e30] border border-[#dadce0] dark:border-[#5f6368] rounded shadow-lg z-50 py-1 min-w-[220px]">
                            {menu.items.map((item, idx) => renderMenuItem(item, idx))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}

const Editor = ({ documentId, className, userName, bucket, fileName, initialContent }: EditorProps) => {
    const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
    const [provider, setProvider] = useState<WebsocketProvider | null>(null);
    const [ydoc] = useState<Y.Doc>(() => new Y.Doc());

    // AI state
    const { stream, stop, isStreaming } = useAiStream();
    const [aiAction, setAiAction] = useState<string | null>(null);

    // FloatingMenu state
    const [floatingMode, setFloatingMode] = useState<FloatingMode>('menu');
    const [promptValue, setPromptValue] = useState('');
    const promptInputRef = useRef<HTMLInputElement>(null);

    // Toolbar states
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showHighlightPicker, setShowHighlightPicker] = useState(false);
    const [showAiToolbar, setShowAiToolbar] = useState(false);

    // Cover & Icon states
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [docIcon, setDocIcon] = useState<string>('\ud83d\udcc4');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    useEffect(() => {
        const baseUrl = process.env.NEXT_PUBLIC_DOCS_WS_URL || 'ws://localhost:3010/api/v1/docs/text';
        const wsUrl = `${baseUrl}/${documentId}`;

        const wsProvider = new WebsocketProvider(wsUrl, documentId, ydoc, { connect: false });

        // Directly connect the WebSocket provider
        // Tiptap's Hocuspocus/y-websocket provider handles reconnections automatically
        wsProvider.connect();

        wsProvider.on('status', async (event: { status: 'connecting' | 'connected' | 'disconnected' }) => {
            setStatus(event.status);

            // Fetch and inject content if document is fresh from S3
            if (event.status === 'connected' && bucket && fileName) {
                try {
                    // Give Yjs a moment to sync, then check if document is completely empty
                    setTimeout(async () => {
                         const currentText = ydoc.getText('default').toString();
                         if (!currentText || currentText.trim() === '') {
                             toast.loading("Chargement du contenu du fichier...", { id: `load-${documentId}` });
                             try {
                                 const parsed: any = await fetchAndParseDocument(bucket, fileName, fileName);
                                 if (parsed.type === 'document') {
                                     // Need to inject it using the TipTap editor instance, handled in a separate useEffect
                                     // since 'editor' isn't available here directly. We'll set a state.
                                     setInitialParsedContent(parsed.text || parsed.html || '');
                                 }
                                 toast.success("Fichier chargé", { id: `load-${documentId}` });
                             } catch (e: any) {
                                 toast.error(`Erreur de lecture: ${e.message}`, { id: `load-${documentId}` });
                             }
                         }
                    }, 1000);
                } catch(e) {
                    console.error("Failed to fetch initial content", e);
                }
            }
        });

        setProvider(wsProvider);

        return () => {
            wsProvider.destroy();
        };
    }, [documentId, ydoc]);

    // Table of Contents state
    const [toc, setToc] = useState<{ id: string, text: string, level: number }[]>([]);

    // Comments & File parsing state
    const [comments, setComments] = useState<{ id: string, text: string, author: string, timestamp: number }[]>([]);
    const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
    const [showComments, setShowComments] = useState(true);
    const [initialParsedContent, setInitialParsedContent] = useState<string | null>(null);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                history: false, // Turn off Prosemirror history as Yjs handles it
            }),
            Underline,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
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
                        title: 'Heading 1',
                        description: 'Big section heading.',
                        icon: <Heading1 className="w-4 h-4" />,
                        command: ({ editor, range }: any) => {
                            editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
                        },
                    },
                    {
                        title: 'Heading 2',
                        description: 'Medium section heading.',
                        icon: <Heading2 className="w-4 h-4" />,
                        command: ({ editor, range }: any) => {
                            editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
                        },
                    },
                    {
                        title: 'Heading 3',
                        description: 'Small section heading.',
                        icon: <Heading3 className="w-4 h-4" />,
                        command: ({ editor, range }: any) => {
                            editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
                        },
                    },
                    {
                        title: 'Bullet List',
                        description: 'Create a simple bulleted list.',
                        icon: <List className="w-4 h-4" />,
                        command: ({ editor, range }: any) => {
                            editor.chain().focus().deleteRange(range).toggleBulletList().run();
                        },
                    },
                    {
                        title: 'Numbered List',
                        description: 'Create a list with numbering.',
                        icon: <ListOrdered className="w-4 h-4" />,
                        command: ({ editor, range }: any) => {
                            editor.chain().focus().deleteRange(range).toggleOrderedList().run();
                        },
                    },
                    {
                        title: 'To-do List',
                        description: 'Track tasks with a to-do list.',
                        icon: <CheckSquare className="w-4 h-4" />,
                        command: ({ editor, range }: any) => {
                            editor.chain().focus().deleteRange(range).toggleTaskList().run();
                        },
                    },
                    {
                        title: 'Code Block',
                        description: 'Capture a code snippet.',
                        icon: <Code className="w-4 h-4" />,
                        command: ({ editor, range }: any) => {
                            editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
                        },
                    },
                    {
                        title: 'Image',
                        description: 'Upload or embed an image.',
                        icon: <ImageIcon className="w-4 h-4" />,
                        command: ({ editor, range }: any) => {
                            const url = window.prompt('Image URL');
                            if (url) {
                                editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
                            } else {
                                editor.chain().focus().deleteRange(range).run();
                            }
                        },
                    },
                    {
                        title: 'Ask AI',
                        description: 'Generate text using AI.',
                        icon: <Sparkles className="w-4 h-4 text-purple-500" />,
                        command: ({ editor, range }: any) => {
                            editor.chain().focus().deleteRange(range).run();
                            setTimeout(() => {
                                setFloatingMode('prompt');
                            }, 50);
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
                placeholder: 'Type \'/\' for commands or start writing...',
                emptyEditorClass: 'is-editor-empty',
            }),
            Comment,
            Collaboration.configure({
                document: ydoc || undefined,
            }),
            ...(provider ? [
                CollaborationCursor.configure({
                    provider: provider,
                    user: {
                        name: userName || 'Anonymous',
                        color: getRandomColor(),
                    },
                })
            ] : []),
        ],
        content: initialContent || '',
        editorProps: {
            attributes: {
                class: 'prose prose-slate dark:prose-invert max-w-none focus:outline-none min-h-[500px] transition-colors font-sans text-[11pt] leading-[1.6]',
            },
        },
        onUpdate: ({ editor }) => {
            const headings: { id: string, text: string, level: number }[] = [];
            editor.state.doc.descendants((node, pos) => {
                if (node.type.name === 'heading') {
                    const id = `heading-${pos}`;
                    headings.push({
                        id,
                        text: node.textContent,
                        level: node.attrs.level,
                    });
                }
            });
            setToc(headings);
        }
    }, [ydoc, provider]);

    // Initial TOC processing
    useEffect(() => {
        if (!editor) return;
        const headings: { id: string, text: string, level: number }[] = [];
        editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'heading') {
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

    // Streaming AI action for BubbleMenu (improve/fix/shorten)
    const handleAiAction = useCallback(async (action: 'improve' | 'fix' | 'shorten') => {
        if (!editor || isStreaming) return;
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to);
        if (!text) return;

        setAiAction(action);

        const systemPrompts: Record<string, string> = {
            improve: 'You are a professional editor. Rewrite the text to improve clarity, flow, and style. Output ONLY the rewritten text.',
            fix: 'You are a meticulous proofreader. Fix all grammar, spelling, and punctuation errors. Output ONLY the corrected text.',
            shorten: 'You are a concise writer. Shorten the text while preserving all key information. Output ONLY the shortened text.',
        };

        // Delete selected text first
        editor.chain().focus().deleteSelection().run();

        await stream(
            `${action === 'improve' ? 'Improve' : action === 'fix' ? 'Fix grammar and spelling in' : 'Shorten'} the following text:\n\n${text}`,
            {
                onToken: (token) => {
                    editor.chain().focus().insertContent(token).run();
                },
                onDone: () => {
                    setAiAction(null);
                    toast.success('Text updated');
                },
                onError: (err) => {
                    setAiAction(null);
                    toast.error(`AI error: ${err}`);
                },
            },
            { systemPrompt: systemPrompts[action], language: 'en' },
        );
    }, [editor, isStreaming, stream]);

    // Streaming summarize
    const handleSummarize = useCallback(async () => {
        if (!editor || isStreaming) return;
        const text = editor.getText();
        if (!text) return;

        setAiAction('summarize');
        let summary = '';
        const toastId = toast.loading('Generating summary...');

        await stream(
            `Summarize the following document in 3-5 bullet points:\n\n${text}`,
            {
                onToken: (token) => {
                    summary += token;
                    toast.loading(summary.slice(0, 200) + (summary.length > 200 ? '...' : ''), { id: toastId });
                },
                onDone: (full) => {
                    setAiAction(null);
                    toast.success('Summary', { id: toastId, description: full, duration: 15000 });
                },
                onError: (err) => {
                    setAiAction(null);
                    toast.error(`Summarization failed: ${err}`, { id: toastId });
                },
            },
            { systemPrompt: 'You are a helpful assistant. Output a concise summary.', language: 'en' },
        );
    }, [editor, isStreaming, stream]);

    // FloatingMenu: Help me write
    const handleHelpMeWrite = useCallback(async () => {
        if (!editor || isStreaming || !promptValue.trim()) return;
        const prompt = promptValue.trim();
        setPromptValue('');
        setFloatingMode('menu');
        setAiAction('write');

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
                systemPrompt: 'You are a professional writer. Write clear, well-structured content based on the user\'s instruction. Output ONLY the content, no explanations or meta-text.',
                language: 'en',
            },
        );
    }, [editor, isStreaming, promptValue, stream]);

    // FloatingMenu: Continue writing
    const handleContinueWriting = useCallback(async () => {
        if (!editor || isStreaming) return;
        setFloatingMode('menu');
        setAiAction('continue');

        // Grab last ~1000 characters before cursor as context
        const { from } = editor.state.selection;
        const start = Math.max(0, from - 1000);
        const context = editor.state.doc.textBetween(start, from);

        if (!context.trim()) {
            toast.error('No preceding text to continue from');
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
                systemPrompt: 'You are a professional writer. Continue the text seamlessly, matching the tone, style, and topic. Output ONLY the continuation, no explanations.',
                language: 'en',
            },
        );
    }, [editor, isStreaming, stream]);

    // FloatingMenu: Translate
    const handleTranslate = useCallback(async (langCode: string, langLabel: string) => {
        if (!editor || isStreaming) return;
        setFloatingMode('menu');

        const { from, to } = editor.state.selection;
        const hasSelection = from !== to;
        const text = hasSelection
            ? editor.state.doc.textBetween(from, to)
            : editor.getText();

        if (!text.trim()) return;

        setAiAction('translate');

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
    }, [editor, isStreaming, stream]);

    // Reset floating mode when menu hides
    useEffect(() => {
        if (floatingMode === 'prompt' && promptInputRef.current) {
            promptInputRef.current.focus();
        }
    }, [floatingMode]);

    // --- Global Command Bar AI Integration ---
    useEffect(() => {
        const handleGlobalAiAction = (e: CustomEvent) => {
            const { action } = e.detail;
            if (action === 'summarize') {
                handleSummarize();
            } else if (action === 'draft') {
                // Open the floating AI prompt menu
                setFloatingMode('prompt');
                setTimeout(() => {
                    promptInputRef.current?.focus();
                }, 100);
            }
        };

        const handleEditorAction = (e: CustomEvent) => {
            const { action } = e.detail;
            if (action === 'format-fix') {
                // To fix the whole document if nothing is selected, select all first.
                if (editor?.state.selection.empty) {
                    editor.chain().focus().selectAll().run();
                }
                handleAiAction('fix');
            }
        };

        window.addEventListener('app:ai-action', handleGlobalAiAction as EventListener);
        window.addEventListener('app:editor-action', handleEditorAction as EventListener);

        return () => {
            window.removeEventListener('app:ai-action', handleGlobalAiAction as EventListener);
            window.removeEventListener('app:editor-action', handleEditorAction as EventListener);
        }
    }, [handleSummarize, handleAiAction, editor]);

    // Handle Menu Actions
    const handleMenuAction = useCallback(async (action: string) => {
        if (!editor || action === 'todo') {
            if (action === 'todo') toast.info("Cette fonctionnalit\u00E9 sera bient\u00F4t disponible !");
            return;
        }

        editor.chain().focus(); // Base focus to ensure operations happen inside editor

        // File Actions
        if (action === 'print') {
            window.print();
            return;
        }

        // Standard Edit Actions map well to Tiptap or Clipboard API
        if (action === 'undo') editor.commands.undo();
        if (action === 'redo') editor.commands.redo();
        if (action === 'selectAll') editor.commands.selectAll();
        if (action === 'delete') editor.commands.deleteSelection();
        if (action === 'newDoc') window.open('/docs', '_blank');
        if (action === 'downloadPdf') {
            toast.info("G\u00E9n\u00E9ration du PDF via le gestionnaire d'impression...");
            window.print();
        }
        
        // Native clipboard if possible, fallback to execCommand
        if (action === 'cut' || action === 'copy' || action === 'paste' || action === 'pasteText') {
           try {
               editor.view.dom.focus();
               let successful = false;
               if (action === 'pasteText') {
                    // Modern API fallback for text
                    const text = await navigator.clipboard.readText();
                    editor.commands.insertContent(text);
                    successful = true;
               } else {
                    successful = document.execCommand(action);
               }
               if (!successful) {
                   toast.error(`Votre navigateur bloque l'action '${action}'. Utilisez les raccourcis clavier.`);
               }
           } catch(e) {
               toast.error(`Erreur: ${e}`);
           }
        }

        // Font Styles (some toggles)
        if (action === 'toggleBold') editor.commands.toggleBold();
        if (action === 'toggleItalic') editor.commands.toggleItalic();
        if (action === 'toggleUnderline') editor.commands.toggleUnderline();
        if (action === 'toggleStrike') editor.commands.toggleStrike();
        if (action === 'toggleSuperscript') editor.commands.toggleSuperscript();
        if (action === 'toggleSubscript') editor.commands.toggleSubscript();
        if (action === 'clearFormat') {
            editor.commands.unsetAllMarks();
            editor.commands.clearNodes();
        }

        // Headings
        if (action === 'toggleH1') editor.commands.toggleHeading({ level: 1 });
        if (action === 'toggleH2') editor.commands.toggleHeading({ level: 2 });
        if (action === 'toggleH3') editor.commands.toggleHeading({ level: 3 });
        if (action === 'setParagraph') editor.commands.setParagraph();

        // Lists
        if (action === 'toggleOrderedList') editor.commands.toggleOrderedList();
        if (action === 'toggleBulletList') editor.commands.toggleBulletList();
        if (action === 'toggleTaskList') editor.commands.toggleTaskList();

        // Alignments
        if (action === 'alignLeft') editor.commands.setTextAlign('left');
        if (action === 'alignCenter') editor.commands.setTextAlign('center');
        if (action === 'alignRight') editor.commands.setTextAlign('right');
        if (action === 'alignJustify') editor.commands.setTextAlign('justify');

        // Insertions
        if (action === 'insertHorizontalRule') editor.commands.setHorizontalRule();
        if (action === 'insertHardBreak') editor.commands.setHardBreak();
        if (action === 'insertImage') {
             const url = window.prompt('URL de l\'image:');
             if (url) editor.commands.setImage({ src: url });
        }
        if (action === 'insertLink') {
             const url = window.prompt('URL du lien:');
             if (url) {
                  // requires a text selection to link, otherwise insert bare text
                  if (editor.state.selection.empty) {
                      editor.commands.insertContent(`<a href="${url}">${url}</a>`);
                  } else {
                      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                  }
             }
        }
        if (action === 'insertTable') {
            editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
        }
        if (action === 'insertCode') {
            editor.commands.toggleCodeBlock();
        }

        // Table Manipulations
        if (action === 'tableAddRowBefore') editor.commands.addRowBefore();
        if (action === 'tableAddRowAfter') editor.commands.addRowAfter();
        if (action === 'tableAddColBefore') editor.commands.addColumnBefore();
        if (action === 'tableAddColAfter') editor.commands.addColumnAfter();
        if (action === 'tableDeleteRow') editor.commands.deleteRow();
        if (action === 'tableDeleteCol') editor.commands.deleteColumn();
        if (action === 'tableDeleteTable') editor.commands.deleteTable();
        if (action === 'tableMergeCells') editor.commands.mergeCells();

        // AI specific
        if (action === 'aiGenerate') {
             setFloatingMode('prompt');
             setTimeout(() => promptInputRef.current?.focus(), 100);
        }
        if (action === 'aiSummarize') {
             handleSummarize();
        }
        if (action === 'translateEn') {
             handleTranslate('en', 'English');
        }

        // Focus back
        editor.view.focus();
    }, [editor, handleSummarize, handleTranslate]);

    if (!editor || !ydoc || !provider) {
        return <div className="flex items-center justify-center p-8 text-gray-500">Initializing editor...</div>;
    }

    const ToolbarButton = ({
        onClick,
        isActive = false,
        disabled = false,
        children,
        title
    }: {
        onClick: () => void,
        isActive?: boolean,
        disabled?: boolean,
        children: React.ReactNode,
        title?: string
    }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`p-1.5 min-w-[32px] rounded flex items-center justify-center transition-all ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${isActive ? 'bg-[#e8f0fe] dark:bg-[#3c4043] text-[#1a73e8] dark:text-[#8ab4f8]' : 'text-[#444746] dark:text-[#e3e3e3] hover:bg-[#f1f3f4] dark:hover:bg-[#303134]'}`}
        >
            {children}
        </button>
    );

    const ToolbarDivider = () => <div className="w-px h-5 bg-[#e3e3e3] dark:bg-[#5f6368] mx-1 self-center" />;

    return (
        <div className={`flex flex-col h-full bg-[#f8f9fa] dark:bg-[#1a1a1a] overflow-hidden ${className}`}>
            {/* Top Bar (Title & Main Menus) */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#f9fbfd] dark:bg-background border-b border-transparent flex-shrink-0">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 mt-1 flex items-center justify-center text-[#1a73e8] shrink-0 cursor-pointer">
                        <FileText className="w-9 h-9" fill="#1a73e8" stroke="white" strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                        <div className="flex items-center gap-2">
                            <input
                                defaultValue="Untitled Document"
                                className="h-6 text-[18px] font-medium border-transparent hover:border-[#dadce0] focus:ring-2 focus:ring-[#1a73e8] px-1 py-0 w-auto min-w-[150px] bg-transparent shadow-none outline-none text-[#202124] dark:text-[#e8eaed]"
                            />
                        </div>
                        <div className="-ml-1.5">
                            <MenuBar editor={editor} onAction={handleMenuAction} />
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-3 py-1 mr-4">
                        <span className={`w-2 h-2 rounded-full shadow-sm ${status === 'connected' ? 'bg-[#1e8e3e] shadow-green-500/50' : 'bg-[#d93025] shadow-red-500/50'}`}></span>
                        <span className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6] font-medium">
                            {status === 'connected' ? 'Enregistr\u00E9 sur le cloud' : 'Enregistrement...'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="h-10 w-10 rounded-full text-[#5f6368] flex items-center justify-center hover:bg-[#f1f3f4] dark:text-[#9aa0a6] dark:hover:bg-[#303134]">
                            <MessageSquarePlus className="h-5 w-5" />
                        </button>
                        <button className="h-10 w-10 rounded-full text-[#5f6368] flex items-center justify-center hover:bg-[#f1f3f4] dark:text-[#9aa0a6] dark:hover:bg-[#303134] mr-2">
                            <Video className="h-5 w-5" />
                        </button>
                        <button className="bg-[#c2e7ff] hover:bg-[#a8d3f1] text-[#001d35] font-medium rounded-full px-6 h-9 flex items-center justify-center transition-colors shadow-none dark:bg-[#004a77] dark:text-[#c2e7ff] dark:hover:bg-[#005a92] mr-2">
                            Partager
                        </button>
                        <div className="h-8 w-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm shadow-sm cursor-pointer">
                            {userName ? userName[0].toUpperCase() : 'U'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Formatting Ribbon */}
            <div className="flex flex-wrap items-center gap-0.5 px-4 py-1.5 w-full bg-[#edf2fa] dark:bg-[#3c4043] shrink-0 border-b border-transparent dark:border-[#5f6368]">
                    {/* Undo/Redo */}
                    <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
                        <Undo className="w-4 h-4" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)">
                        <Redo className="w-4 h-4" />
                    </ToolbarButton>

                    <ToolbarDivider />

                    {/* Text Styles */}
                    <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="Heading 1">
                        <Heading1 className="w-4 h-4" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading 2">
                        <Heading2 className="w-4 h-4" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} isActive={editor.isActive('paragraph')} title="Paragraph">
                        <span className="text-[13px] font-medium px-1">Normal text</span>
                    </ToolbarButton>

                    <ToolbarDivider />

                    {/* Font Styles */}
                    <div className="flex border border-[#c7c7c7] dark:border-[#5f6368] rounded overflow-hidden h-[28px] mx-1 items-center bg-white dark:bg-[#202124]">
                        <span className="px-3 text-[13px] text-[#444746] dark:text-[#e3e3e3] border-r border-[#c7c7c7] dark:border-[#5f6368] flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-[#303134]">Inter</span>
                        <div className="flex items-center">
                            <span className="px-2 text-[13px] text-[#444746] dark:text-[#e3e3e3] hover:bg-gray-50 dark:hover:bg-[#303134] cursor-pointer border-r border-[#c7c7c7] dark:border-[#5f6368]">-</span>
                            <span className="px-3 text-[13px] text-[#444746] dark:text-[#e3e3e3]">11</span>
                            <span className="px-2 text-[13px] text-[#444746] dark:text-[#e3e3e3] hover:bg-gray-50 dark:hover:bg-[#303134] cursor-pointer border-l border-[#c7c7c7] dark:border-[#5f6368]">+</span>
                        </div>
                    </div>

                    <ToolbarDivider />

                    {/* Basic Formatting */}
                    <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold (Ctrl+B)">
                        <Bold className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic (Ctrl+I)">
                        <Italic className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline (Ctrl+U)">
                        <UnderlineIcon className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough (Alt+Shift+5)">
                        <Strikethrough className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleSuperscript().run()} isActive={editor.isActive('superscript')} title="Superscript (Ctrl+.)">
                        <SuperscriptIcon className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleSubscript().run()} isActive={editor.isActive('subscript')} title="Subscript (Ctrl+,)">
                        <SubscriptIcon className="w-[18px] h-[18px]" />
                    </ToolbarButton>

                    {/* Colors */}
                    <div className="relative">
                        <ToolbarButton onClick={() => setShowColorPicker(!showColorPicker)} title="Text color">
                            <Palette className="w-[18px] h-[18px]" />
                        </ToolbarButton>
                        {showColorPicker && (
                            <div className="absolute top-10 left-0 bg-white dark:bg-[#2d2e30] border border-gray-200 dark:border-gray-700 shadow-xl rounded-md p-2 flex flex-wrap w-[140px] gap-1 z-30">
                                {['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
                                    '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
                                ].map(color => (
                                    <button
                                        key={color}
                                        className="w-5 h-5 rounded-full ring-1 ring-inset ring-black/10 hover:scale-110 transition-transform"
                                        style={{ backgroundColor: color }}
                                        onClick={() => { editor.chain().focus().setColor(color).run(); setShowColorPicker(false); }}
                                    />
                                ))}
                                <button
                                    className="w-full mt-1 text-xs text-center py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                    onClick={() => { editor.chain().focus().unsetColor().run(); setShowColorPicker(false); }}
                                >
                                    Reset
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="relative">
                        <ToolbarButton onClick={() => setShowHighlightPicker(!showHighlightPicker)} title="Highlight color">
                            <Highlighter className="w-[18px] h-[18px]" />
                        </ToolbarButton>
                        {showHighlightPicker && (
                            <div className="absolute top-10 left-0 bg-white dark:bg-[#2d2e30] border border-gray-200 dark:border-gray-700 shadow-xl rounded-md p-2 flex flex-wrap w-[140px] gap-1 z-30">
                                {['#fce8e6', '#fce8b2', '#fff2cc', '#e6f4ea', '#e8f0fe', '#f3e8fd', '#ffffff',
                                ].map(color => (
                                    <button
                                        key={color}
                                        className="w-5 h-5 rounded-full ring-1 ring-inset ring-black/10 hover:scale-110 transition-transform"
                                        style={{ backgroundColor: color }}
                                        onClick={() => { editor.chain().focus().setHighlight({ color }).run(); setShowHighlightPicker(false); }}
                                    />
                                ))}
                                <button
                                    className="w-full mt-1 text-xs text-center py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                    onClick={() => { editor.chain().focus().unsetHighlight().run(); setShowHighlightPicker(false); }}
                                >
                                    None
                                </button>
                            </div>
                        )}
                    </div>

                    <ToolbarDivider />

                    {/* Alignment */}
                    <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Align left (Ctrl+Shift+L)">
                        <AlignLeft className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Center align (Ctrl+Shift+E)">
                        <AlignCenter className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Align right (Ctrl+Shift+R)">
                        <AlignRight className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} title="Justify (Ctrl+Shift+J)">
                        <AlignJustify className="w-[18px] h-[18px]" />
                    </ToolbarButton>

                    <ToolbarDivider />

                    {/* Lists */}
                    <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered list (Ctrl+Shift+7)">
                        <ListOrdered className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bulleted list (Ctrl+Shift+8)">
                        <List className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} title="Checklist (Ctrl+Shift+9)">
                        <CheckSquare className="w-[18px] h-[18px]" />
                    </ToolbarButton>

                    {/* Alignment */}
                    <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Align left">
                        <AlignLeft className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Align center">
                        <AlignCenter className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Align right">
                        <AlignRight className="w-[18px] h-[18px]" />
                    </ToolbarButton>

                    <ToolbarDivider />

                    {/* Lists */}
                    <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bulleted list">
                        <List className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered list">
                        <ListOrdered className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} title="Checklist">
                        <CheckSquare className="w-[18px] h-[18px]" />
                    </ToolbarButton>

                    <ToolbarDivider />

                    <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table">
                        <TableIcon className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => {
                        const url = window.prompt('URL');
                        if (url) {
                            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                        }
                    }} isActive={editor.isActive('link')} title="Insert link">
                        <LinkIcon className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => {
                        const url = window.prompt('Image URL');
                        if (url) {
                            editor.chain().focus().setImage({ src: url }).run();
                        }
                    }} title="Insert image">
                        <ImageIcon className="w-[18px] h-[18px]" />
                    </ToolbarButton>

                    <ToolbarDivider />

                    {/* AI Integrations Toggle */}
                    <button
                        onClick={() => setShowAiToolbar(!showAiToolbar)}
                        className={`p-1.5 px-3 rounded flex items-center gap-1.5 transition-all ml-auto mr-1 ${showAiToolbar ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' : 'text-[#444746] dark:text-[#e3e3e3] hover:bg-[#f1f3f4] dark:hover:bg-[#303134]'}`}
                    >
                        <Bot className="w-4 h-4" />
                        <span className="text-[12px] font-medium hidden sm:inline">AI Tools</span>
                    </button>
                </div>

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
                                    className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md text-[13px] font-medium transition-colors flex items-center"
                                >
                                    <FileText className="w-3.5 h-3.5 mr-1.5" /> Summarize Document
                                </button>
                                <button
                                    onClick={() => handleAiAction('improve')}
                                    disabled={editor.state.selection.empty}
                                    className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md text-[13px] font-medium transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Improve Selection
                                </button>
                                <button
                                    onClick={() => handleAiAction('fix')}
                                    disabled={editor.state.selection.empty}
                                    className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md text-[13px] font-medium transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <CheckCheck className="w-3.5 h-3.5 mr-1.5" /> Fix Selection
                                </button>
                            </>
                        )}
                    </div>
                )}


            {/* Editor Canvas Area */}
            <div className="flex-1 overflow-y-auto w-full relative pb-16 custom-scrollbar bg-[#f8f9fa] dark:bg-[#1b1b1b] flex flex-row justify-center py-6">
                <div className="flex-1 min-w-0 max-w-[816px]">
                        {/* Main Content Area constrained like Google Docs (A4 Paper) */}
                        <div className="w-[816px] shrink-0 min-h-[1056px] bg-white dark:bg-[#1f1f1f] shadow-[0_1px_3px_auto_rgba(0,0,0,0.1)] ring-1 ring-[#e2e2e2] dark:ring-[#ffffff1a] rounded-sm relative mt-2 mb-10 mx-auto px-20 pt-16">
                        {/* BubbleMenu - Text Selection Toolbar */}
                        {editor && (
                            <BubbleMenu
                                editor={editor}
                                tippyOptions={{ duration: 150, animation: 'fade' }}
                                className="bg-white/95 dark:bg-[#202124]/95 backdrop-blur-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)] border border-gray-200/50 dark:border-gray-700/50 rounded-[8px] overflow-hidden flex divide-x divide-gray-100 dark:divide-gray-800 pl-1"
                            >
                                <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')}>
                                    <Bold className="w-[16px] h-[16px]" />
                                </ToolbarButton>
                                <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')}>
                                    <Italic className="w-[16px] h-[16px]" />
                                </ToolbarButton>

                                <div className="w-px h-5 bg-[#e3e3e3] dark:bg-[#5f6368] mx-1 self-center" />

                                <button
                                    onClick={() => {
                                        const commentId = uuidv4();
                                        editor.chain().focus().setComment(commentId).run();
                                        setComments(prev => [...prev, { id: commentId, text: '', author: userName || 'Anonymous', timestamp: Date.now() }]);
                                        setActiveCommentId(commentId);
                                        setShowComments(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1 hover:bg-gray-100 dark:hover:bg-[#303134] text-[13px] font-medium text-[#444746] dark:text-[#e3e3e3] transition-colors"
                                >
                                    <MessageSquarePlus className="w-3.5 h-3.5" />
                                    Comment
                                </button>

                                <button
                                    onClick={() => handleAiAction('improve')}
                                    disabled={isStreaming}
                                    className="flex items-center gap-1.5 px-3 py-1 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-[13px] font-medium text-purple-600 dark:text-purple-400 transition-colors"
                                >
                                    {aiAction === 'improve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                    Improve
                                </button>
                                <button
                                    onClick={() => handleAiAction('fix')}
                                    disabled={isStreaming}
                                    className="flex items-center gap-1.5 px-3 py-1 hover:bg-gray-100 dark:hover:bg-[#303134] text-[13px] font-medium text-[#444746] dark:text-[#e3e3e3] transition-colors"
                                >
                                    {aiAction === 'fix' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
                                    Fix
                                </button>
                            </BubbleMenu>
                        )}

                        {/* FloatingMenu - AI actions on empty lines */}
                        {editor && (
                            <FloatingMenu
                                editor={editor}
                                tippyOptions={{
                                    duration: 150,
                                    animation: 'shift-toward',
                                    placement: 'bottom-start',
                                    onHide: () => {
                                        setFloatingMode('menu');
                                        setPromptValue('');
                                    },
                                }}
                                className="bg-white/95 dark:bg-[#202124]/95 backdrop-blur-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)] border border-gray-200 dark:border-[#5f6368] rounded-[8px] overflow-hidden min-w-[220px]"
                            >
                                {floatingMode === 'menu' && (
                                    <div className="flex flex-col py-1.5 min-w-[200px]">
                                        <button
                                            onClick={() => setFloatingMode('prompt')}
                                            disabled={isStreaming}
                                            className="flex items-center gap-2.5 px-4 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-[13px] font-medium text-purple-600 dark:text-purple-400 transition-colors text-left"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                            Help me write...
                                        </button>
                                        <button
                                            onClick={handleContinueWriting}
                                            disabled={isStreaming}
                                            className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#303134] text-[13px] text-[#444746] dark:text-[#e3e3e3] transition-colors text-left"
                                        >
                                            {aiAction === 'continue' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                                            Continue writing
                                        </button>
                                        <button
                                            onClick={() => setFloatingMode('translate')}
                                            disabled={isStreaming}
                                            className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#303134] text-[13px] text-[#444746] dark:text-[#e3e3e3] transition-colors text-left"
                                        >
                                            <Languages className="w-4 h-4" />
                                            Translate...
                                        </button>
                                    </div>
                                )}

                                {floatingMode === 'prompt' && (
                                    <div className="flex items-center gap-2 p-1.5 min-w-[350px]">
                                        <Sparkles className="w-4 h-4 text-purple-500 ml-2 shrink-0" />
                                        <input
                                            ref={promptInputRef}
                                            type="text"
                                            value={promptValue}
                                            onChange={(e) => setPromptValue(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleHelpMeWrite();
                                                }
                                                if (e.key === 'Escape') {
                                                    setFloatingMode('menu');
                                                    setPromptValue('');
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
                                            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => { setFloatingMode('menu'); setPromptValue(''); }}
                                            className="p-1.5 rounded-md text-[#5f6368] dark:text-[#9aa0a6] hover:bg-gray-100 dark:hover:bg-[#303134] transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}

                                {floatingMode === 'translate' && (
                                    <div className="flex flex-col py-1 min-w-[180px]">
                                        <div className="px-4 py-1.5 text-[11px] uppercase tracking-wider text-[#5f6368] dark:text-[#9aa0a6] font-semibold">Translate to</div>
                                        {LANGUAGES.map((lang) => (
                                            <button
                                                key={lang.code}
                                                onClick={() => handleTranslate(lang.code, lang.label)}
                                                disabled={isStreaming}
                                                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#303134] text-[13px] text-[#444746] dark:text-[#e3e3e3] transition-colors text-left"
                                            >
                                                {lang.label}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setFloatingMode('menu')}
                                            className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#303134] text-[13px] text-[#5f6368] dark:text-[#9aa0a6] transition-colors text-left border-t border-[#e3e3e3] dark:border-[#3c4043] mt-1"
                                        >
                                            <X className="w-4 h-4" />
                                            Back
                                        </button>
                                    </div>
                                )}
                            </FloatingMenu>
                        )}

                        <EditorContent editor={editor} />
                        </div>
                    </div>

                {/* Table of Contents Sidebar */}
                <div className="hidden lg:block w-[240px] shrink-0 border-l border-gray-100 dark:border-gray-800/50 p-6 pt-12 overflow-y-auto max-h-full sticky top-0 custom-scrollbar">
                    {toc.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">On this page</h3>
                            <nav className="flex flex-col gap-1.5">
                                {toc.map((heading) => (
                                    <button
                                        key={heading.id}
                                        onClick={() => {
                                            // Extract pos from heading.id (e.g. "heading-123" -> 123)
                                            const pos = parseInt(heading.id.split('-')[1]);
                                            if (!isNaN(pos) && editor) {
                                                // Set cursor to the heading
                                                editor.chain().focus().setTextSelection(pos).run();
                                                // Scroll into view (Tiptap handles this automatically with focus)
                                            }
                                        }}
                                        className={`text-left text-[13px] hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate
                                            ${heading.level === 1 ? 'font-medium text-gray-800 dark:text-gray-200 mt-2' : ''}
                                            ${heading.level === 2 ? 'text-gray-600 dark:text-gray-400 ml-3' : ''}
                                            ${heading.level === 3 ? 'text-gray-500 dark:text-gray-500 ml-6' : ''}
                                        `}
                                    >
                                        {heading.text || 'Untitled page section'}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    )}

                    {/* Comments Section */}
                    {showComments && comments.length > 0 && (
                        <div className="mt-8 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">Comments</h3>
                                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{comments.length}</span>
                            </div>
                            <div className="flex flex-col gap-3">
                                {comments.map((comment) => (
                                    <div
                                        key={comment.id}
                                        className={`p-3 rounded-lg border text-sm transition-all relative group
                                            ${activeCommentId === comment.id
                                                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm'
                                                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#202124] hover:border-gray-300 dark:hover:border-gray-700'
                                            }
                                        `}
                                        onClick={() => setActiveCommentId(comment.id)}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold text-[13px] text-gray-800 dark:text-gray-200">{comment.author}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] text-gray-500">{new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                <button
                                                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded transition-all"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (editor) {
                                                            editor.chain().focus().unsetComment(comment.id).run();
                                                        }
                                                        setComments(prev => prev.filter(c => c.id !== comment.id));
                                                        if (activeCommentId === comment.id) setActiveCommentId(null);
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
                                                setComments(prev => prev.map(c => c.id === comment.id ? { ...c, text: newText } : c));
                                            }}
                                            placeholder="Add a comment..."
                                            className="w-full bg-transparent border-none resize-none focus:outline-none text-gray-700 dark:text-gray-300 min-h-[40px] text-[13px]"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Editor;
