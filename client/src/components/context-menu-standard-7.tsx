import { ReactNode, useEffect, useRef } from "react";
import { type Editor } from "@tiptap/react";
import { Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify, Eraser, Type, Copy, Scissors, ClipboardPaste } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export const title = "Editor Context Menu";

export default function ContextMenuStandard7({ children, editor }: { children?: ReactNode, editor?: Editor | null }) {
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (!e.isTrusted) return; // Ignore synthetic events to prevent infinite loops

      const target = e.target as HTMLElement;
      if (
        triggerRef.current && 
        triggerRef.current.contains(target) && 
        (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        e.preventDefault(); 
        e.stopPropagation();

        triggerRef.current.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: e.clientX,
            clientY: e.clientY,
            button: 2,
          })
        );
      }
    };

    document.addEventListener("contextmenu", handleContextMenu, { capture: true });
    return () => document.removeEventListener("contextmenu", handleContextMenu, { capture: true });
  }, []);

  const handleCopy = () => document.execCommand('copy');
  const handleCut = () => document.execCommand('cut');
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (editor) editor.commands.insertContent(text);
    } catch {
      // ignore clipboard error
    }
  };

  const fonts = ["Inter", "Arial", "Times New Roman", "Courier New", "Georgia", "Verdana"];

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div ref={triggerRef} className="h-full w-full">
          {children || (
            <div className="flex h-[200px] w-full max-w-lg items-center justify-center rounded-md border border-dashed text-sm">
              Right click here
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      {editor ? (
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={handleCut}>
            <Scissors className="w-4 h-4 mr-2" />
            Couper
            <ContextMenuShortcut>Ctrl+X</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCopy}>
            <Copy className="w-4 h-4 mr-2" />
            Copier
            <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={handlePaste}>
            <ClipboardPaste className="w-4 h-4 mr-2" />
            Coller
            <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>
          
          <ContextMenuSeparator />

          <ContextMenuItem onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="w-4 h-4 mr-2" /> Gras
            <ContextMenuShortcut>Ctrl+B</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="w-4 h-4 mr-2" /> Italique
            <ContextMenuShortcut>Ctrl+I</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className="w-4 h-4 mr-2" /> Souligner
            <ContextMenuShortcut>Ctrl+U</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Type className="w-4 h-4 mr-2" /> Police
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              {fonts.map(font => (
                <ContextMenuItem key={font} onClick={() => editor.chain().focus().setFontFamily(font).run()}>
                  <span className={editor.isActive('textStyle', { fontFamily: font }) ? "font-bold" : ""}>
                    {font}
                  </span>
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />

          <ContextMenuItem onClick={() => editor.chain().focus().setTextAlign('left').run()}>
            <AlignLeft className="w-4 h-4 mr-2" /> Aligner à gauche
          </ContextMenuItem>
          <ContextMenuItem onClick={() => editor.chain().focus().setTextAlign('center').run()}>
            <AlignCenter className="w-4 h-4 mr-2" /> Centrer
          </ContextMenuItem>
          <ContextMenuItem onClick={() => editor.chain().focus().setTextAlign('right').run()}>
            <AlignRight className="w-4 h-4 mr-2" /> Aligner à droite
          </ContextMenuItem>
          <ContextMenuItem onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
            <AlignJustify className="w-4 h-4 mr-2" /> Justifier
          </ContextMenuItem>

          <ContextMenuSeparator />
          
          <ContextMenuItem onClick={() => editor.chain().focus().unsetAllMarks().run()}>
            <Eraser className="w-4 h-4 mr-2 text-red-500" /> 
            Effacer le formatage
          </ContextMenuItem>
        </ContextMenuContent>
      ) : (
        <ContextMenuContent className="w-56">
          <ContextMenuItem>Éditeur non chargé</ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}
