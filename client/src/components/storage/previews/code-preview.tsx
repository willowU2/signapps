"use client";

import { SpinnerInfinity } from "spinners-react";

import { useEffect, useState, useMemo } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { common, createLowlight } from "lowlight";

const lowlight = createLowlight(common);

interface CodePreviewProps {
  src: string;
  fileName: string;
  fileType?: string;
}

const EXT_TO_LANG: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  tsx: "typescript",
  jsx: "javascript",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  rb: "ruby",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  scala: "scala",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  sql: "sql",
  html: "html",
  css: "css",
  scss: "scss",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",
  xml: "xml",
  md: "markdown",
};

/** Recursively extract text + className from a lowlight hast tree node */
type HastNode =
  | { type: "text"; value: string }
  | {
      type: "element";
      tagName: string;
      properties?: { className?: string[] };
      children: HastNode[];
    };

function hastToReact(node: HastNode, key: string | number): React.ReactNode {
  if (node.type === "text") return node.value;
  const cls = node.properties?.className?.join(" ") ?? "";
  return (
    <span key={key} className={cls}>
      {node.children.map((c, i) => hastToReact(c, i))}
    </span>
  );
}

function HighlightedLine({ line, lang }: { line: string; lang: string }) {
  const nodes = useMemo(() => {
    if (!lang || line === "") return null;
    try {
      const result = lowlight.highlight(lang, line);
      return result.children as HastNode[];
    } catch {
      return null;
    }
  }, [line, lang]);

  if (!nodes) {
    return <span className="text-slate-300">{line || "\u00a0"}</span>;
  }

  return <>{nodes.map((n, i) => hastToReact(n, i))}</>;
}

export function CodePreview({
  src,
  fileName,
  fileType: _fileType,
}: CodePreviewProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<string[]>([]);

  const lang = useMemo(() => {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    return EXT_TO_LANG[ext] ?? "";
  }, [fileName]);

  useEffect(() => {
    fetchContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const response = await fetch(src);
      const text = await response.text();
      setContent(text);
      setLines(text.split("\n"));
    } catch {
      toast.error("Impossible de charger le fichier");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Copié !");
    } catch {
      toast.error("Impossible de copier");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <SpinnerInfinity
          size={24}
          secondaryColor="rgba(128,128,128,0.2)"
          color="currentColor"
          speed={120}
          className="h-8 w-8 text-muted-foreground"
        />
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-lg overflow-hidden font-mono">
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700">
        <div>
          <p className="text-sm text-slate-300">{fileName}</p>
          <p className="text-xs text-slate-500">{lang || "text"}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={copyToClipboard}
        >
          <Copy className="h-4 w-4 text-slate-400" />
        </Button>
      </div>

      <div className="bg-slate-900 overflow-auto max-h-[600px]">
        <table className="w-full">
          <tbody>
            {lines.slice(0, 500).map((line, idx) => (
              <tr key={idx} className="hover:bg-slate-800/50">
                <td className="select-none w-12 px-3 py-0.5 bg-slate-950 text-slate-600 text-right text-xs">
                  {idx + 1}
                </td>
                <td className="px-4 py-0.5 text-slate-100 whitespace-pre-wrap break-words text-sm">
                  <HighlightedLine line={line} lang={lang} />
                </td>
              </tr>
            ))}
            {lines.length > 500 && (
              <tr>
                <td
                  colSpan={2}
                  className="px-4 py-3 text-center text-sm text-slate-500"
                >
                  ... {lines.length - 500} more lines
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
