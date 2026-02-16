'use client';

import { useEffect, useState } from 'react';
import { Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface CodePreviewProps {
  src: string;
  fileName: string;
  fileType?: string;
}

/**
 * CodePreview - Afficheur de code avec syntax highlighting simple.
 * Utilise une approche légère sans dépendances lourdes.
 */
export function CodePreview({
  src,
  fileName,
  fileType,
}: CodePreviewProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    fetchContent();
  }, [src]);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const response = await fetch(src);
      const text = await response.text();
      setContent(text);
      setLines(text.split('\n'));
    } catch (error) {
      console.error('Failed to load code:', error);
      toast.error('Impossible de charger le fichier');
    } finally {
      setLoading(false);
    }
  };

  const getLanguage = () => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'jsx': 'javascript',
      'py': 'python',
      'rs': 'rust',
      'go': 'go',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'rb': 'ruby',
      'php': 'php',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'xml': 'xml',
      'sql': 'sql',
      'sh': 'bash',
    };
    return langMap[ext] || ext;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copié !');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Impossible de copier');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-lg overflow-hidden font-mono">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700">
        <div>
          <p className="text-sm text-slate-300">{fileName}</p>
          <p className="text-xs text-slate-500">{getLanguage()}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={copyToClipboard}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>

      {/* Code */}
      <div className="bg-slate-900 overflow-auto max-h-[600px]">
        <table className="w-full">
          <tbody>
            {lines.slice(0, 500).map((line, idx) => (
              <tr key={idx} className="hover:bg-slate-800/50">
                <td className="select-none w-12 px-3 py-1 bg-slate-950 text-slate-600 text-right text-xs">
                  {idx + 1}
                </td>
                <td className="px-4 py-1 text-slate-100 whitespace-pre-wrap break-words">
                  {line === '' ? '\u00a0' : highlightLine(line)}
                </td>
              </tr>
            ))}
            {lines.length > 500 && (
              <tr>
                <td colSpan={2} className="px-4 py-3 text-center text-sm text-slate-500">
                  ... {lines.length - 500} lignes de plus
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Simple syntax highlighting pour les patterns courants.
 * Ne highlight que les patterns très courants pour rester léger.
 */
function highlightLine(line: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Patterns: strings, comments, keywords, numbers
  const patterns = [
    // Strings
    { re: /(["'`])(?:\\.|(?!\1).)*?\1/g, class: 'text-green-400' },
    // Comments
    { re: /(\/\/|#|--).*/g, class: 'text-slate-500' },
    // Keywords
    {
      re: /\b(function|const|let|var|if|else|for|while|return|class|async|await|import|export|from|default)\b/g,
      class: 'text-blue-400',
    },
    // Numbers
    { re: /\b\d+\.?\d*\b/g, class: 'text-yellow-400' },
  ];

  let result = line;
  patterns.forEach(({ re, class: className }) => {
    result = result.replace(
      re,
      (match) => `<span class="${className}">${match}</span>`
    );
  });

  return (
    <div
      dangerouslySetInnerHTML={{
        __html: result || line,
      }}
    />
  );
}
