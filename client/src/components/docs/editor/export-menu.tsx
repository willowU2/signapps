'use client';

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
import {
  Download,
  FileText,
  FileType,
  FileCode,
  FileJson,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { useDocumentExport } from '@/hooks/use-document-export';
import { ExportComment } from '@/lib/api/office';

interface ExportMenuProps {
  editor: Editor | null;
  documentTitle?: string;
  comments?: ExportComment[];
}

export function ExportMenu({ editor, documentTitle = 'document', comments }: ExportMenuProps) {
  const {
    isExporting,
    exportFormat,
    exportAsDocx,
    exportAsPdf,
    exportAsMarkdown,
    exportAsHtml,
    exportAsText,
  } = useDocumentExport({ editor, documentTitle, comments });

  const hasComments = comments && comments.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[#444746] hover:bg-[#f1f3f4] dark:text-[#e8eaed] dark:hover:bg-[#303134]"
          disabled={isExporting}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Export...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-1.5" />
              Exporter
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Télécharger comme
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={exportAsDocx}
          disabled={isExporting}
          className="cursor-pointer"
        >
          <FileText className="h-4 w-4 mr-2 text-blue-600" />
          <div className="flex flex-col">
            <span className="flex items-center gap-1">
              Microsoft Word
              {hasComments && (
                <MessageSquare className="h-3 w-3 text-yellow-500" />
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              .docx{hasComments && ` (${comments.length} commentaires)`}
            </span>
          </div>
          {isExporting && exportFormat === 'docx' && (
            <Loader2 className="h-4 w-4 ml-auto animate-spin" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={exportAsPdf}
          disabled={isExporting}
          className="cursor-pointer"
        >
          <FileType className="h-4 w-4 mr-2 text-red-600" />
          <div className="flex flex-col">
            <span>PDF</span>
            <span className="text-xs text-muted-foreground">.pdf</span>
          </div>
          {isExporting && exportFormat === 'pdf' && (
            <Loader2 className="h-4 w-4 ml-auto animate-spin" />
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={exportAsMarkdown}
          disabled={isExporting}
          className="cursor-pointer"
        >
          <FileCode className="h-4 w-4 mr-2 text-purple-600" />
          <div className="flex flex-col">
            <span>Markdown</span>
            <span className="text-xs text-muted-foreground">.md</span>
          </div>
          {isExporting && exportFormat === 'markdown' && (
            <Loader2 className="h-4 w-4 ml-auto animate-spin" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={exportAsHtml}
          disabled={isExporting}
          className="cursor-pointer"
        >
          <FileJson className="h-4 w-4 mr-2 text-orange-600" />
          <div className="flex flex-col">
            <span>HTML</span>
            <span className="text-xs text-muted-foreground">.html</span>
          </div>
          {isExporting && exportFormat === 'html' && (
            <Loader2 className="h-4 w-4 ml-auto animate-spin" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={exportAsText}
          disabled={isExporting}
          className="cursor-pointer"
        >
          <FileText className="h-4 w-4 mr-2 text-gray-600" />
          <div className="flex flex-col">
            <span>Texte brut</span>
            <span className="text-xs text-muted-foreground">.txt</span>
          </div>
          {isExporting && exportFormat === 'text' && (
            <Loader2 className="h-4 w-4 ml-auto animate-spin" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
