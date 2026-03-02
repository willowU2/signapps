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
import { useCallback, useState } from 'react';

interface EditorToolbarProps {
    editor: Editor | null;
    isStreaming?: boolean;
    aiQuery?: string;
    setAiQuery?: (v: string) => void;
    onAiGenerate?: (e?: React.FormEvent) => void;
    stopAi?: () => void;
}

export function EditorToolbar({
    editor,
    isStreaming,
    aiQuery = '',
    setAiQuery,
    onAiGenerate,
    stopAi,
}: EditorToolbarProps) {
    const [isAiOpen, setIsAiOpen] = useState(false);

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

                <Select defaultValue="arial">
                    <SelectTrigger className="h-7 w-[95px] border-transparent bg-transparent hover:bg-muted focus:ring-0 text-sm font-medium text-[#444746] dark:text-[#e8eaed]">
                        <SelectValue placeholder="Arial" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="arial">Arial</SelectItem>
                        <SelectItem value="times">Times New Roman</SelectItem>
                        <SelectItem value="courier">Courier New</SelectItem>
                    </SelectContent>
                </Select>

                <Separator orientation="vertical" className="h-5 mx-0.5" />

                <div className="flex items-center -space-x-1">
                    <Button variant="ghost" size="icon" className="h-7 w-6 rounded-r-none text-[#444746] hover:bg-muted">
                        <Minus className="h-3 w-3" />
                    </Button>
                    <div className="flex items-center justify-center h-7 w-8 border border-transparent hover:border-border text-xs font-medium cursor-text text-[#444746] dark:text-[#e8eaed]">
                        11
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-6 rounded-l-none text-[#444746] hover:bg-muted">
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
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed]">
                    <Baseline className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed]">
                    <Highlighter className="h-4 w-4" />
                </Button>
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
