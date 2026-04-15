"use client";

import { SpinnerInfinity } from "spinners-react";

import { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Download,
  FileText,
  FileType,
  FileCode,
  FileJson,
  MessageSquare,
} from "lucide-react";
import { useDocumentExport } from "@/hooks/use-document-export";
import { ExportComment } from "@/lib/api/office";

interface ExportMenuProps {
  editor: Editor | null;
  documentTitle?: string;
  comments?: ExportComment[];
}

export function ExportMenu({
  editor,
  documentTitle = "document",
  comments,
}: ExportMenuProps) {
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
              <SpinnerInfinity
                size={24}
                secondaryColor="rgba(128,128,128,0.2)"
                color="currentColor"
                speed={120}
                className="h-4 w-4 mr-1.5 "
              />
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
          {isExporting && exportFormat === "docx" && (
            <SpinnerInfinity
              size={24}
              secondaryColor="rgba(128,128,128,0.2)"
              color="currentColor"
              speed={120}
              className="h-4 w-4 ml-auto "
            />
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
          {isExporting && exportFormat === "pdf" && (
            <SpinnerInfinity
              size={24}
              secondaryColor="rgba(128,128,128,0.2)"
              color="currentColor"
              speed={120}
              className="h-4 w-4 ml-auto "
            />
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
          {isExporting && exportFormat === "markdown" && (
            <SpinnerInfinity
              size={24}
              secondaryColor="rgba(128,128,128,0.2)"
              color="currentColor"
              speed={120}
              className="h-4 w-4 ml-auto "
            />
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
          {isExporting && exportFormat === "html" && (
            <SpinnerInfinity
              size={24}
              secondaryColor="rgba(128,128,128,0.2)"
              color="currentColor"
              speed={120}
              className="h-4 w-4 ml-auto "
            />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={exportAsText}
          disabled={isExporting}
          className="cursor-pointer"
        >
          <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
          <div className="flex flex-col">
            <span>Texte brut</span>
            <span className="text-xs text-muted-foreground">.txt</span>
          </div>
          {isExporting && exportFormat === "text" && (
            <SpinnerInfinity
              size={24}
              secondaryColor="rgba(128,128,128,0.2)"
              color="currentColor"
              speed={120}
              className="h-4 w-4 ml-auto "
            />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
