'use client';

import { useState } from 'react';
import { Copy, Download, RotateCcw } from 'lucide-react';

// Mermaid diagram templates
const DIAGRAM_TEMPLATES = {
  flowchart: `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process 1]
    B -->|No| D[Process 2]
    C --> E[End]
    D --> E`,

  sequence: `sequenceDiagram
    actor User
    participant API
    participant DB
    User->>API: Request Data
    API->>DB: Query
    DB-->>API: Result
    API-->>User: Response`,

  class: `classDiagram
    class Animal {
      +String name
      +int age
      +void makeSound()
    }
    class Dog {
      +void bark()
    }
    Animal <|-- Dog`
};

export default function MermaidEditor() {
  const [diagram, setDiagram] = useState(DIAGRAM_TEMPLATES.flowchart);
  const [copied, setCopied] = useState(false);

  const handleTemplateSelect = (template: keyof typeof DIAGRAM_TEMPLATES) => {
    setDiagram(DIAGRAM_TEMPLATES[template]);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(diagram);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(diagram)}`);
    element.setAttribute('download', 'diagram.mmd');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleReset = () => {
    setDiagram(DIAGRAM_TEMPLATES.flowchart);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-lg border border-gray-200">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-200 bg-white">
        <button
          onClick={() => handleTemplateSelect('flowchart')}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors"
        >
          Flowchart
        </button>
        <button
          onClick={() => handleTemplateSelect('sequence')}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors"
        >
          Sequence
        </button>
        <button
          onClick={() => handleTemplateSelect('class')}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors"
        >
          Class Diagram
        </button>

        <div className="w-px h-6 bg-gray-300" />

        <button
          onClick={handleCopy}
          title="Copy to clipboard"
          className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          <Copy size={18} />
        </button>
        <button
          onClick={handleDownload}
          title="Download as .mmd file"
          className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          <Download size={18} />
        </button>
        <button
          onClick={handleReset}
          title="Reset to default"
          className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          <RotateCcw size={18} />
        </button>

        {copied && <span className="text-sm text-green-600 font-medium">Copied!</span>}
      </div>

      {/* Editor Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* Textarea (Left) */}
        <div className="flex-1 flex flex-col border-r border-gray-200">
          <label className="text-xs font-medium text-gray-600 px-4 pt-3 pb-2 bg-gray-50">
            Mermaid Syntax
          </label>
          <textarea
            value={diagram}
            onChange={(e) => setDiagram(e.target.value)}
            className="flex-1 p-4 font-mono text-sm text-gray-900 resize-none focus:outline-none border-none bg-white"
            placeholder="Enter Mermaid diagram syntax..."
            spellCheck="false"
          />
        </div>

        {/* Preview (Right) */}
        <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
          <label className="text-xs font-medium text-gray-600 px-4 pt-3 pb-2 bg-gray-100">
            Preview
          </label>
          <div className="flex-1 overflow-auto p-4">
            <pre className="text-xs text-gray-700 bg-white p-3 rounded border border-gray-200 font-mono whitespace-pre-wrap break-words">
              {diagram}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
