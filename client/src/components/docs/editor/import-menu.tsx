'use client';

import { SpinnerInfinity } from 'spinners-react';

import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Upload, FileText, FileCode, FileJson, Clipboard } from 'lucide-react';
import { useDocumentImport } from '@/hooks/use-document-import';

interface ImportMenuProps {
  editor: Editor | null;
}

export function ImportMenu({ editor }: ImportMenuProps) {
  const {
    isImporting,
    importFormat,
    triggerFileUpload,
    handleFileChange,
    importFromClipboard,
    fileInputRef,
  } = useDocumentImport(editor);

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.md,.markdown,.html,.htm,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[#444746] hover:bg-[#f1f3f4] dark:text-[#e8eaed] dark:hover:bg-[#303134]"
            disabled={isImporting}
          >
            {isImporting ? (
              <>
                <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4 mr-1.5 " />
                Import...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1.5" />
                Importer
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Importer un fichier
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={triggerFileUpload}
            disabled={isImporting}
            className="cursor-pointer"
          >
            <FileText className="h-4 w-4 mr-2 text-blue-600" />
            <div className="flex flex-col">
              <span>Depuis un fichier</span>
              <span className="text-xs text-muted-foreground">.docx, .md, .html, .txt</span>
            </div>
            {isImporting && importFormat && (
              <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4 ml-auto " />
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Depuis le presse-papier
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => importFromClipboard('markdown')}
            disabled={isImporting}
            className="cursor-pointer"
          >
            <FileCode className="h-4 w-4 mr-2 text-purple-600" />
            <div className="flex flex-col">
              <span>Coller comme Markdown</span>
              <span className="text-xs text-muted-foreground">Convertit le Markdown en formatage</span>
            </div>
            {isImporting && importFormat === 'markdown' && (
              <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4 ml-auto " />
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => importFromClipboard('html')}
            disabled={isImporting}
            className="cursor-pointer"
          >
            <FileJson className="h-4 w-4 mr-2 text-orange-600" />
            <div className="flex flex-col">
              <span>Coller comme HTML</span>
              <span className="text-xs text-muted-foreground">Préserve la mise en forme HTML</span>
            </div>
            {isImporting && importFormat === 'html' && (
              <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4 ml-auto " />
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
