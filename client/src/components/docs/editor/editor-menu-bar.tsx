import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Editor } from '@tiptap/react';
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
interface EditorMenuBarProps {
    editor: Editor | null;
}

export function EditorMenuBar({ editor }: EditorMenuBarProps) {
    if (!editor) return null;

    return (
        <div className="flex items-center gap-0.5 px-0 py-0 bg-transparent text-[13px] text-[#444746] dark:text-[#9aa0a6]">
            {/* Fichier (File) Menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-[26px] px-2 font-normal rounded-sm hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-inherit transition-colors">
                        Fichier
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[300px]">
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <File className="mr-2 h-4 w-4" />
                            <span>Nouveau</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Document</DropdownMenuItem>
                            <DropdownMenuItem>À partir d'un modèle</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem>
                        <FolderOpen className="mr-2 h-4 w-4" />
                        <span>Ouvrir</span>
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+O</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <Copy className="mr-2 h-4 w-4" />
                        <span>Créer une copie</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <UserPlus className="mr-2 h-4 w-4" />
                            <span>Partager</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Partager avec d'autres personnes</DropdownMenuItem>
                            <DropdownMenuItem>Publier sur le Web</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Mail className="mr-2 h-4 w-4" />
                            <span>Envoyer par e-mail</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Envoyer ce fichier par e-mail</DropdownMenuItem>
                            <DropdownMenuItem>M'envoyer une copie par e-mail</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Download className="mr-2 h-4 w-4" />
                            <span>Télécharger</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem onClick={() => { /* Export to PDF */ }}>
                                Document PDF (.pdf)
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                Format texte simple (.txt)
                            </DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        <span>Approbations</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                        <Edit2 className="mr-2 h-4 w-4" />
                        <span>Renommer</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Placer dans la corbeille</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <History className="mr-2 h-4 w-4" />
                            <span>Historique des versions</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Nommer la version actuelle</DropdownMenuItem>
                            <DropdownMenuItem>Afficher l'historique des versions</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem>
                        <CheckCircle2 className="mr-2 h-4 w-4 opacity-50" />
                        <span>Rendre disponible hors connexion</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                        <Info className="mr-2 h-4 w-4 opacity-50" />
                        <span>Détails</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <AtSign className="mr-2 h-4 w-4 opacity-50" />
                        <span>Limites de sécurité</span>
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Globe className="mr-2 h-4 w-4" />
                            <span>Langue</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Français</DropdownMenuItem>
                            <DropdownMenuItem>English</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Configuration de la page</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" />
                        <span>Imprimer</span>
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+P</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Édition (Edit) Menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-[26px] px-2 font-normal rounded-sm hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-inherit transition-colors">
                        Édition
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuItem 
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().undo()}
                    >
                        <Undo2 className="mr-2 h-4 w-4" />
                        <span>Annuler</span>
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+Z</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().redo()}
                    >
                        <Redo2 className="mr-2 h-4 w-4" />
                        <span>Rétablir</span>
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+Y</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                        <Scissors className="mr-2 h-4 w-4" />
                        <span>Couper</span>
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+X</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <Copy className="mr-2 h-4 w-4" />
                        <span>Copier</span>
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+C</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <Clipboard className="mr-2 h-4 w-4" />
                        <span>Coller</span>
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+V</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <ClipboardPaste className="mr-2 h-4 w-4" />
                        <span>Coller sans la mise en forme</span>
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+Maj+V</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                        <BoxSelect className="mr-2 h-4 w-4 opacity-50" />
                        <span>Tout sélectionner</span>
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+A</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                        <Trash2 className="mr-2 h-4 w-4 opacity-50" />
                        <span>Supprimer</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                        <Search className="mr-2 h-4 w-4" />
                        <span>Rechercher et remplacer</span>
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+H</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Affichage (View) Menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-[26px] px-2 font-normal rounded-sm hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-inherit transition-colors">
                        Affichage
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <span>Mode</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>
                                <Edit2 className="mr-2 h-4 w-4" />
                                <span>Modification</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <MessageSquarePlus className="mr-2 h-4 w-4" />
                                <span>Suggestion</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <BookOpen className="mr-2 h-4 w-4" />
                                <span>Lecture</span>
                            </DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        <span>Afficher la règle</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        <span>Afficher le plan</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <CheckCircle2 className="mr-2 h-4 w-4 opacity-0" />
                        <span>Afficher la barre d'équations</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <CheckCircle2 className="mr-2 h-4 w-4 opacity-0" />
                        <span>Afficher les caractères non imprimables</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                        <Layout className="mr-2 h-4 w-4 opacity-50" />
                        <span>Plein écran</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Insertion Menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-[26px] px-2 font-normal rounded-sm hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-inherit transition-colors">
                        Insertion
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[320px]">
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <ImageIcon className="mr-2 h-4 w-4" />
                            <span>Image</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Importer depuis l'ordinateur</DropdownMenuItem>
                            <DropdownMenuItem>Rechercher sur le Web</DropdownMenuItem>
                            <DropdownMenuItem>Drive</DropdownMenuItem>
                            <DropdownMenuItem>Photos</DropdownMenuItem>
                            <DropdownMenuItem>URL</DropdownMenuItem>
                            <DropdownMenuItem>Caméra</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Table className="mr-2 h-4 w-4" />
                            <span>Tableau</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                                Tableau 3x3
                            </DropdownMenuItem>
                            <DropdownMenuItem>Modèles de tableaux</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Blocks className="mr-2 h-4 w-4" />
                            <span>Composants de base</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Notes de réunion</DropdownMenuItem>
                            <DropdownMenuItem>Brouillon d'e-mail</DropdownMenuItem>
                            <DropdownMenuItem>Outil de suivi des avis</DropdownMenuItem>
                            <DropdownMenuItem>Suivi des éléments de projet</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Tag className="mr-2 h-4 w-4" />
                            <span>Chips intelligents</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Date</DropdownMenuItem>
                            <DropdownMenuItem>Menu déroulant</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <PenLine className="mr-2 h-4 w-4" />
                            <span>Champs de signature électronique</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Signature</DropdownMenuItem>
                            <DropdownMenuItem>Initiales</DropdownMenuItem>
                            <DropdownMenuItem>Date de signature</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuItem>
                        <Link2 className="mr-2 h-4 w-4" />
                        <span>Lien</span>
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+K</span>
                    </DropdownMenuItem>

                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <PenTool className="mr-2 h-4 w-4 opacity-50" />
                            <span>Dessin</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Nouveau</DropdownMenuItem>
                            <DropdownMenuItem>À partir de Drive</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <BarChart2 className="mr-2 h-4 w-4 opacity-50" />
                            <span>Graphique</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Barres</DropdownMenuItem>
                            <DropdownMenuItem>Colonnes</DropdownMenuItem>
                            <DropdownMenuItem>Ligne</DropdownMenuItem>
                            <DropdownMenuItem>Secteur</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>À partir de Sheets</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuItem>
                        <Smile className="mr-2 h-4 w-4 opacity-50" />
                        <span>Symboles</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem>
                        <Layout className="mr-2 h-4 w-4 opacity-50" />
                        <span>Onglet</span>
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">Maj+F11</span>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                        <Minus className="mr-2 h-4 w-4" />
                        <span>Ligne horizontale</span>
                    </DropdownMenuItem>

                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <ArrowRightToLine className="mr-2 h-4 w-4 opacity-50" />
                            <span>Saut</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Saut de page</DropdownMenuItem>
                            <DropdownMenuItem>Saut de section (page suivante)</DropdownMenuItem>
                            <DropdownMenuItem>Saut de section (en continu)</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuItem>
                        <Bookmark className="mr-2 h-4 w-4 opacity-50" />
                        <span>Signet</span>
                    </DropdownMenuItem>

                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <LayoutTemplate className="mr-2 h-4 w-4 opacity-50" />
                            <span>Éléments de page</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>En-tête</DropdownMenuItem>
                            <DropdownMenuItem>Pied de page</DropdownMenuItem>
                            <DropdownMenuItem>Numéros de page</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem>
                        <MessageSquarePlus className="mr-2 h-4 w-4 opacity-50" />
                        <span>Commentaire</span>
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+Alt+M</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Format Menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-[26px] px-2 font-normal rounded-sm hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-inherit transition-colors">
                        Format
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[300px]">
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Type className="mr-2 h-4 w-4" />
                            <span>Texte</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48">
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleBold().run()}>
                                <span className={editor.isActive('bold') ? 'font-bold' : ''}>Gras</span>
                                <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+B</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleItalic().run()}>
                                <span className={editor.isActive('italic') ? 'italic' : ''}>Italique</span>
                                <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+I</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleUnderline().run()}>
                                <span className={editor.isActive('underline') ? 'underline' : ''}>Souligné</span>
                                <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+U</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleStrike().run()}>
                                <span className={editor.isActive('strike') ? 'line-through' : ''}>Barré</span>
                                <span className="ml-auto text-xs tracking-widest text-muted-foreground">Alt+Maj+5</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                                <span>Exposant</span>
                                <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+.</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <span>Indice</span>
                                <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+,</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <span>Taille</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <span>Majuscules/Minuscules</span>
                            </DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Heading1 className="mr-2 h-4 w-4" />
                            <span>Styles de paragraphe</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Bordures et trame</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Texte normal</DropdownMenuItem>
                            <DropdownMenuItem>Titre</DropdownMenuItem>
                            <DropdownMenuItem>Sous-titre</DropdownMenuItem>
                            <DropdownMenuItem>Titre 1</DropdownMenuItem>
                            <DropdownMenuItem>Titre 2</DropdownMenuItem>
                            <DropdownMenuItem>Titre 3</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Options</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <AlignLeft className="mr-2 h-4 w-4" />
                            <span>Aligner et mettre en retrait</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem onClick={() => editor.chain().focus().setTextAlign('left').run()}>
                                <span>À gauche</span>
                                <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+Maj+L</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().setTextAlign('center').run()}>
                                <span>Au centre</span>
                                <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+Maj+E</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().setTextAlign('right').run()}>
                                <span>À droite</span>
                                <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+Maj+R</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
                                <span>Justifier</span>
                                <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+Maj+J</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Augmenter le retrait</DropdownMenuItem>
                            <DropdownMenuItem>Diminuer le retrait</DropdownMenuItem>
                            <DropdownMenuItem>Options de retrait</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <MoveVertical className="mr-2 h-4 w-4" />
                            <span>Interligne et espace entre paragraphes</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Simple</DropdownMenuItem>
                            <DropdownMenuItem>1.15</DropdownMenuItem>
                            <DropdownMenuItem>1.5</DropdownMenuItem>
                            <DropdownMenuItem>Double</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Ajouter un espace avant</DropdownMenuItem>
                            <DropdownMenuItem>Ajouter un espace après</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Columns className="mr-2 h-4 w-4" />
                            <span>Colonnes</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>1 colonne</DropdownMenuItem>
                            <DropdownMenuItem>2 colonnes</DropdownMenuItem>
                            <DropdownMenuItem>3 colonnes</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <List className="mr-2 h-4 w-4" />
                            <span>Puces et numéros</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Liste numérotée</DropdownMenuItem>
                            <DropdownMenuItem>Liste à puces</DropdownMenuItem>
                            <DropdownMenuItem>Checklist</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem>
                        <LayoutTemplate className="mr-2 h-4 w-4 opacity-50" />
                        <span>En-têtes et pieds de page</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <Hash className="mr-2 h-4 w-4 opacity-50" />
                        <span>Numéros de page</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <TabletSmartphone className="mr-2 h-4 w-4 opacity-50" />
                        <span>Orientation de la page</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <Layout className="mr-2 h-4 w-4 opacity-50" />
                        <span>Passer au format Sans pages</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Table className="mr-2 h-4 w-4 opacity-50" />
                            <span>Tableau</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Propriétés du tableau</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <ImageIcon className="mr-2 h-4 w-4 opacity-50" />
                            <span>Image</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Options d'image</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Grid3X3 className="mr-2 h-4 w-4 opacity-50" />
                            <span>Bordures et lignes</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Couleur de la bordure</DropdownMenuItem>
                            <DropdownMenuItem>Épaisseur de la bordure</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
                        <Eraser className="mr-2 h-4 w-4" />
                        <span>Supprimer la mise en forme</span>
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+\</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Outils (Tools) Menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-[26px] px-2 font-normal rounded-sm hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-inherit transition-colors">
                        Outils
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[320px]">
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <SpellCheck2 className="mr-2 h-4 w-4" />
                            <span>Grammaire et orthographe</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>
                                <span>Vérification orthographique et grammaticale</span>
                                <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+Alt+X</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>Dictionnaire personnel</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuItem>
                        <Hash className="mr-2 h-4 w-4" />
                        <span>Nombre de mots</span>
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+Maj+C</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem>
                        <MessageSquareDiff className="mr-2 h-4 w-4 opacity-50" />
                        <span>Examiner les modifications suggérées</span>
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+Alt+O Ctrl+Alt+U</span>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem>
                        <SplitSquareHorizontal className="mr-2 h-4 w-4 opacity-50" />
                        <span>Comparer des documents</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem>
                        <Quote className="mr-2 h-4 w-4 opacity-50" />
                        <span>Citations</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem>
                        <PenLine className="mr-2 h-4 w-4 opacity-50" />
                        <span>Signatures électroniques</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem>
                        <CheckSquare className="mr-2 h-4 w-4 opacity-50" />
                        <span>Tâches</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem>
                        <ListOrdered className="mr-2 h-4 w-4 opacity-50" />
                        <span>Numéros de ligne</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem>
                        <Link2 className="mr-2 h-4 w-4 opacity-50" />
                        <span>Objets associés</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem>
                        <BookOpen className="mr-2 h-4 w-4 opacity-50" />
                        <span>Dictionnaire</span>
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+Maj+Y</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem>
                        <Languages className="mr-2 h-4 w-4 opacity-50" />
                        <span>Traduire le document</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem>
                        <Mic className="mr-2 h-4 w-4 opacity-50" />
                        <span>Saisie vocale</span>
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">Ctrl+Maj+S</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem>
                        <Wand2 className="mr-2 h-4 w-4" />
                        <span>Gemini</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem>
                        <Bell className="mr-2 h-4 w-4 opacity-50" />
                        <span>Paramètres de notification</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem>
                        <Settings className="mr-2 h-4 w-4 opacity-50" />
                        <span>Préférences</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem>
                        <User className="mr-2 h-4 w-4 opacity-50" />
                        <span>Accessibilité</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Extensions / Aide Menu placeholders */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 font-medium hidden sm:inline-flex">
                        Extensions
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem>Gérer les extensions</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 font-medium hidden sm:inline-flex">
                        Aide
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem>Recherche... (Alt+/)</DropdownMenuItem>
                    <DropdownMenuItem>Aide</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

        </div>
    );
}
