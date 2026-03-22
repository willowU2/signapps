'use client';

import { SpinnerInfinity } from 'spinners-react';

import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
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
    } catch {
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
    } catch {
      toast.error('Impossible de copier');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8  text-muted-foreground" />
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
 * Simple parser that prevents XSS by returning safe React nodes.
 * Heavy regex replacement using dangerouslySetInnerHTML was an XSS vulnerability.
 */
function highlightLine(line: string): React.ReactNode {
  return <span className="text-slate-300">{line}</span>;
}
