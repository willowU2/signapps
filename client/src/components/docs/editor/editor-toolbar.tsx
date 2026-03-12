import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
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
    ListTodo,
    Undo,
    Redo,
    Printer,
    Highlighter,
    Link as LinkIcon,
    Image as ImageIcon,
    Code,
    Sparkles,
    MessageSquarePlus,
    Minus,
    Plus,
    Search,
    SpellCheck2,
    PaintRoller,
    ZoomIn,
    Baseline,
    IndentDecrease,
    IndentIncrease,
    RemoveFormatting,
    MoveVertical
} from 'lucide-react';
import { useCallback, useState, useMemo } from 'react';

interface EditorToolbarProps {
    editor: Editor | null;
    isStreaming?: boolean;
    aiQuery?: string;
    setAiQuery?: (v: string) => void;
    onAiGenerate?: (e?: React.FormEvent) => void;
    stopAi?: () => void;
}

// Font families available in the editor
const FONT_FAMILIES = [
    { value: 'Arial', label: 'Arial' },
    { value: 'Times New Roman', label: 'Times New Roman' },
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Verdana', label: 'Verdana' },
    { value: 'Courier New', label: 'Courier New' },
    { value: 'Trebuchet MS', label: 'Trebuchet MS' },
    { value: 'Palatino Linotype', label: 'Palatino' },
];

// Font sizes available in the editor (in pt)
const FONT_SIZES = ['8', '10', '11', '12', '14', '18', '24', '36', '48', '72'];

// Text colors available in the editor
const TEXT_COLORS = [
    { value: '#000000', label: 'Noir' },
    { value: '#444444', label: 'Gris foncé' },
    { value: '#EA4335', label: 'Rouge' },
    { value: '#FF9900', label: 'Orange' },
    { value: '#FBBC04', label: 'Jaune' },
    { value: '#34A853', label: 'Vert' },
    { value: '#4285F4', label: 'Bleu' },
    { value: '#9334E6', label: 'Violet' },
];

// Highlight colors available in the editor
const HIGHLIGHT_COLORS = [
    { value: '#FFFF00', label: 'Jaune' },
    { value: '#00FF00', label: 'Vert' },
    { value: '#00FFFF', label: 'Cyan' },
    { value: '#FF69B4', label: 'Rose' },
    { value: '#FFA500', label: 'Orange' },
    { value: '#E6E6FA', label: 'Lavande' },
];

export function EditorToolbar({
    editor,
    isStreaming,
    aiQuery = '',
    setAiQuery,
    onAiGenerate,
    stopAi,
}: EditorToolbarProps) {
    const [isAiOpen, setIsAiOpen] = useState(false);

    // Get current font family from editor
    const currentFontFamily = useMemo(() => {
        if (!editor) return 'Arial';
        const attrs = editor.getAttributes('textStyle');
        return attrs.fontFamily || 'Arial';
    }, [editor?.state.selection]);

    // Get current font size from editor
    const currentFontSize = useMemo(() => {
        if (!editor) return '11';
        const attrs = editor.getAttributes('textStyle');
        // Extract numeric value from fontSize (e.g., '14pt' -> '14')
        const size = attrs.fontSize?.replace(/[^\d]/g, '') || '11';
        return size;
    }, [editor?.state.selection]);

    // Handle font family change
    const handleFontFamilyChange = useCallback((fontFamily: string) => {
        if (!editor) return;
        editor.chain().focus().setFontFamily(fontFamily).run();
    }, [editor]);

    // Handle font size change
    const handleFontSizeChange = useCallback((size: string) => {
        if (!editor) return;
        editor.chain().focus().setFontSize(`${size}pt`).run();
    }, [editor]);

    // Increment/decrement font size
    const adjustFontSize = useCallback((delta: number) => {
        if (!editor) return;
        const currentIndex = FONT_SIZES.indexOf(currentFontSize);
        const newIndex = Math.max(0, Math.min(FONT_SIZES.length - 1, currentIndex + delta));
        const newSize = FONT_SIZES[newIndex];
        editor.chain().focus().setFontSize(`${newSize}pt`).run();
    }, [editor, currentFontSize]);

    // Get current text color
    const currentTextColor = useMemo(() => {
        if (!editor) return '#000000';
        const color = editor.getAttributes('textStyle').color;
        return color || '#000000';
    }, [editor?.state.selection]);

    // Get current highlight color
    const currentHighlightColor = useMemo(() => {
        if (!editor) return null;
        const highlight = editor.getAttributes('highlight').color;
        return highlight || null;
    }, [editor?.state.selection]);

    // Handle text color change
    const handleTextColorChange = useCallback((color: string) => {
        if (!editor) return;
        editor.chain().focus().setColor(color).run();
    }, [editor]);

    // Handle highlight color change
    const handleHighlightChange = useCallback((color: string | null) => {
        if (!editor) return;
        if (color) {
            editor.chain().focus().toggleHighlight({ color }).run();
        } else {
            editor.chain().focus().unsetHighlight().run();
        }
    }, [editor]);

    if (!editor) return null;

    return (
        <div className="flex flex-wrap items-center gap-0.5 px-4 py-1.5 w-full bg-[#edf2fa] dark:bg-[#3c4043] shrink-0 border-b border-transparent dark:border-[#5f6368]">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground mr-1">
                <Search className="h-4 w-4 text-[#444746]" />
            </Button>
            
            {/* History & Print */}
            <div className="flex items-center">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-[#444746] dark:text-muted-foreground"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    title="Annuler (Ctrl+Z)"
                >
                    <Undo className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-[#444746] dark:text-muted-foreground"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    title="Rétablir (Ctrl+Y)"
                >
                    <Redo className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-[#444746] dark:text-muted-foreground"
                    onClick={() => window.print()}
                    title="Imprimer (Ctrl+P)"
                >
                    <Printer className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-[#444746] dark:text-muted-foreground ml-0.5">
                    <SpellCheck2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-[#444746] dark:text-muted-foreground">
                    <PaintRoller className="h-4 w-4" />
                </Button>
            </div>

            <Separator orientation="vertical" className="h-5 mx-1" />

            <div className="flex items-center gap-1">
                {/* Zoom */}
                <Select defaultValue="100%">
                    <SelectTrigger className="h-7 w-[75px] border-transparent bg-transparent hover:bg-muted focus:ring-0 text-sm font-medium text-[#444746] dark:text-[#e8eaed]">
                        <SelectValue placeholder="100%" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="50%">50%</SelectItem>
                        <SelectItem value="75%">75%</SelectItem>
                        <SelectItem value="100%">100%</SelectItem>
                        <SelectItem value="150%">150%</SelectItem>
                        <SelectItem value="200%">200%</SelectItem>
                    </SelectContent>
                </Select>

                <Separator orientation="vertical" className="h-5 mx-0.5" />

                {/* Formatting */}
                <Select
                    value={
                        editor.isActive('heading', { level: 1 }) ? 'h1' :
                        editor.isActive('heading', { level: 2 }) ? 'h2' :
                        editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'
                    }
                    onValueChange={(value) => {
                        if (value === 'p') editor.chain().focus().setParagraph().run();
                        else if (value === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
                        else if (value === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
                        else if (value === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
                    }}
                >
                    <SelectTrigger className="h-7 w-[110px] border-transparent bg-transparent hover:bg-muted focus:ring-0 text-sm font-medium text-[#444746] dark:text-[#e8eaed]">
                        <SelectValue placeholder="Texte normal" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="p">Texte normal</SelectItem>
                        <SelectItem value="h1">Titre 1</SelectItem>
                        <SelectItem value="h2">Titre 2</SelectItem>
                        <SelectItem value="h3">Titre 3</SelectItem>
                    </SelectContent>
                </Select>

                <Separator orientation="vertical" className="h-5 mx-0.5" />

                <Select value={currentFontFamily} onValueChange={handleFontFamilyChange}>
                    <SelectTrigger className="h-7 w-[120px] border-transparent bg-transparent hover:bg-muted focus:ring-0 text-sm font-medium text-[#444746] dark:text-[#e8eaed]">
                        <SelectValue placeholder="Arial" />
                    </SelectTrigger>
                    <SelectContent>
                        {FONT_FAMILIES.map((font) => (
                            <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                                {font.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Separator orientation="vertical" className="h-5 mx-0.5" />

                <div className="flex items-center -space-x-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-6 rounded-r-none text-[#444746] hover:bg-muted"
                        onClick={() => adjustFontSize(-1)}
                        title="Diminuer la taille"
                    >
                        <Minus className="h-3 w-3" />
                    </Button>
                    <Select value={currentFontSize} onValueChange={handleFontSizeChange}>
                        <SelectTrigger className="h-7 w-[50px] border-transparent bg-transparent hover:bg-muted focus:ring-0 text-xs font-medium text-[#444746] dark:text-[#e8eaed] rounded-none px-1">
                            <SelectValue placeholder="11" />
                        </SelectTrigger>
                        <SelectContent>
                            {FONT_SIZES.map((size) => (
                                <SelectItem key={size} value={size}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-6 rounded-l-none text-[#444746] hover:bg-muted"
                        onClick={() => adjustFontSize(1)}
                        title="Augmenter la taille"
                    >
                        <Plus className="h-3 w-3" />
                    </Button>
                </div>
            </div>

            <Separator orientation="vertical" className="h-5 mx-1" />

            {/* Marks */}
            <div className="flex items-center gap-0.5">
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed] ${editor.isActive('bold') ? 'bg-primary/20 text-primary' : ''}`}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    title="Gras (Ctrl+B)"
                >
                    <Bold className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed] ${editor.isActive('italic') ? 'bg-primary/20 text-primary' : ''}`}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    title="Italique (Ctrl+I)"
                >
                    <Italic className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed] ${editor.isActive('underline') ? 'bg-primary/20 text-primary' : ''}`}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    title="Souligné (Ctrl+U)"
                >
                    <UnderlineIcon className="h-4 w-4" />
                </Button>
                {/* Text Color Picker */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed]" title="Couleur du texte">
                            <div className="flex flex-col items-center">
                                <Baseline className="h-4 w-4" />
                                <div className="w-4 h-1 mt-0.5 rounded-sm" style={{ backgroundColor: currentTextColor }} />
                            </div>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2" align="start">
                        <div className="grid grid-cols-4 gap-1">
                            {TEXT_COLORS.map((color) => (
                                <button
                                    key={color.value}
                                    className="w-6 h-6 rounded-sm border border-gray-200 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: color.value }}
                                    onClick={() => handleTextColorChange(color.value)}
                                    title={color.label}
                                />
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
                {/* Highlight Color Picker */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed] ${currentHighlightColor ? 'bg-primary/20' : ''}`}
                            title="Surlignage"
                        >
                            <div className="flex flex-col items-center">
                                <Highlighter className="h-4 w-4" />
                                {currentHighlightColor && (
                                    <div className="w-4 h-1 mt-0.5 rounded-sm" style={{ backgroundColor: currentHighlightColor }} />
                                )}
                            </div>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2" align="start">
                        <div className="grid grid-cols-3 gap-1">
                            {HIGHLIGHT_COLORS.map((color) => (
                                <button
                                    key={color.value}
                                    className={`w-6 h-6 rounded-sm border hover:scale-110 transition-transform ${currentHighlightColor === color.value ? 'ring-2 ring-primary' : 'border-gray-200'}`}
                                    style={{ backgroundColor: color.value }}
                                    onClick={() => handleHighlightChange(color.value)}
                                    title={color.label}
                                />
                            ))}
                            <button
                                className="w-6 h-6 rounded-sm border border-gray-200 hover:scale-110 transition-transform flex items-center justify-center text-xs"
                                onClick={() => handleHighlightChange(null)}
                                title="Supprimer le surlignage"
                            >
                                ✕
                            </button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            <Separator orientation="vertical" className="h-5 mx-1" />
            
            <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed]">
                    <LinkIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed]">
                    <MessageSquarePlus className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed]">
                    <ImageIcon className="h-4 w-4" />
                </Button>
            </div>

            <Separator orientation="vertical" className="h-5 mx-1" />

            {/* Alignment */}
            <div className="flex items-center gap-0.5">
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed] ${editor.isActive({ textAlign: 'left' }) ? 'bg-primary/20 text-primary' : ''}`}
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    title="Aligner à gauche"
                >
                    <AlignLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed] ${editor.isActive({ textAlign: 'center' }) ? 'bg-primary/20 text-primary' : ''}`}
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    title="Centrer"
                >
                    <AlignCenter className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed] ${editor.isActive({ textAlign: 'right' }) ? 'bg-primary/20 text-primary' : ''}`}
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    title="Aligner à droite"
                >
                    <AlignRight className="h-4 w-4" />
                </Button>
                 <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed] ${editor.isActive({ textAlign: 'justify' }) ? 'bg-primary/20 text-primary' : ''}`}
                    onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                    title="Justifier"
                >
                    <AlignJustify className="h-4 w-4" />
                </Button>
            </div>

            <Separator orientation="vertical" className="h-5 mx-1" />
            
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed]">
                <MoveVertical className="h-4 w-4" />
            </Button>
            
            <Separator orientation="vertical" className="h-5 mx-1" />

            {/* Lists & Indents */}
            <div className="flex items-center gap-0.5">
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed] ${editor.isActive('taskList') ? 'bg-primary/20 text-primary' : ''}`}
                    onClick={() => editor.chain().focus().toggleTaskList().run()}
                    title="Liste de tâches"
                >
                    <ListTodo className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed] ${editor.isActive('bulletList') ? 'bg-primary/20 text-primary' : ''}`}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    title="Liste à puces"
                >
                    <List className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed] ${editor.isActive('orderedList') ? 'bg-primary/20 text-primary' : ''}`}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    title="Liste numérotée"
                >
                    <ListOrdered className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed]">
                    <IndentDecrease className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed]">
                    <IndentIncrease className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed]">
                    <RemoveFormatting className="h-4 w-4" />
                </Button>
            </div>

            <Separator orientation="vertical" className="h-5 flex-1 opacity-0" />

            {/* AI Help Me Write Tool aligned to right mostly */}
            {onAiGenerate && setAiQuery && (
                <Popover open={isAiOpen} onOpenChange={setIsAiOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-[#c2e7ff] hover:bg-[#a8d3f1] text-[#001d35] rounded-full border-transparent font-medium dark:bg-[#004a77] dark:hover:bg-[#005a92] dark:text-[#c2e7ff] shadow-sm transition-all group h-8 ml-auto px-4"
                        >
                            <Sparkles className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform text-[#0b57d0] dark:text-[#a8c7fa]" />
                            M'aider à écrire
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-3 glass" align="end">
                        {isStreaming ? (
                            <div className="space-y-3">
                                <p className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 animate-pulse" />
                                    Rédaction en cours...
                                </p>
                                <Button size="sm" variant="destructive" className="w-full" onClick={stopAi}>
                                    Arrêter la génération
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={(e) => { onAiGenerate(e); setIsAiOpen(false); }} className="grid gap-3">
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none text-blue-700 dark:text-blue-400 flex items-center gap-2">
                                        <Sparkles className="h-4 w-4" /> Assistant de rédaction
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                        Que voulez-vous ajouter à votre document ?
                                    </p>
                                </div>
                                <Input
                                    autoFocus
                                    placeholder="ex: Rédiger une introduction sur la Q3..."
                                    value={aiQuery}
                                    onChange={(e) => setAiQuery(e.target.value)}
                                    className="h-9 focus-visible:ring-blue-500"
                                />
                                <Button
                                    type="submit"
                                    size="sm"
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                    disabled={!aiQuery?.trim()}
                                >
                                    Générer
                                </Button>
                            </form>
                        )}
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
}
