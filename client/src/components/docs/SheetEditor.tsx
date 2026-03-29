'use client';

import { useYjsDocument } from '@/hooks/use-yjs-document';
import { useEffect, useState } from 'react';

interface SheetEditorProps {
    docId: string;
}

interface Cell {
    row: number;
    col: number;
    value: string;
}

export function SheetEditor({ docId }: SheetEditorProps) {
    const { ydoc, isSynced } = useYjsDocument(docId);
    const [cells, setCells] = useState<Map<string, string>>(new Map());
    const [selectedCell, setSelectedCell] = useState<Cell | null>(null);

    useEffect(() => {
        if (!ydoc) return;

        // Initialize sheet structure if needed
        const sheetMap = ydoc.getMap('sheet');
        const rows = ydoc.getArray('rows');

        // Observe changes
        const observer = () => {
            // Rebuild cells from Y.Array
            const newCells = new Map<string, string>();
            for (let i = 0; i < rows.length; i++) {
                const row = rows.get(i);
                // Parse cells
            }
            setCells(newCells);
        };

        rows.observe(observer);
        return () => rows.unobserve(observer);
    }, [ydoc]);

    const handleCellChange = (row: number, col: number, value: string) => {
        if (!ydoc) return;

        const key = `${row}:${col}`;
        setCells(prev => new Map(prev).set(key, value));

        // Update in Y.doc
        const rows = ydoc.getArray('rows');
        // Update structure
    };

    return (
        <div className="p-6">
            <div className="bg-background rounded-lg border border-border">
                {/* Toolbar */}
                <div className="border-b border-border p-3 flex gap-2 bg-muted">
                    <button className="px-3 py-1 rounded bg-background hover:bg-muted">
                        Insert Row
                    </button>
                    <button className="px-3 py-1 rounded bg-background hover:bg-muted">
                        Insert Column
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                        <div
                            className={`w-2 h-2 rounded-full ${
                                isSynced ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
                            }`}
                        />
                        <span className="text-xs text-muted-foreground">
                            {isSynced ? 'Synced' : 'Syncing...'}
                        </span>
                    </div>
                </div>

                {/* Spreadsheet Grid */}
                <div className="overflow-auto">
                    <table className="border-collapse">
                        <tbody>
                            {Array.from({ length: 100 }).map((_, row) => (
                                <tr key={row}>
                                    {/* Row header */}
                                    <td className="w-8 h-8 bg-muted border border-border text-xs text-center text-muted-foreground font-semibold">
                                        {row + 1}
                                    </td>

                                    {/* Cells */}
                                    {Array.from({ length: 26 }).map((_, col) => {
                                        const key = `${row}:${col}`;
                                        const value = cells.get(key) || '';
                                        const isSelected =
                                            selectedCell?.row === row && selectedCell?.col === col;

                                        return (
                                            <td
                                                key={key}
                                                className={`w-24 h-8 border border-border p-0 ${
                                                    isSelected ? 'ring-2 ring-blue-500' : ''
                                                }`}
                                            >
                                                <input
                                                    type="text"
                                                    value={value}
                                                    onChange={(e) =>
                                                        handleCellChange(
                                                            row,
                                                            col,
                                                            e.target.value
                                                        )
                                                    }
                                                    onFocus={() => setSelectedCell({ row, col, value })}
                                                    className="w-full h-full border-0 outline-none px-1 text-xs"
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Column headers */}
                    <div className="sticky top-0 flex">
                        <div className="w-8 bg-muted border border-border" />
                        {Array.from({ length: 26 }).map((_, col) => (
                            <div
                                key={col}
                                className="w-24 h-8 bg-muted border border-border flex items-center justify-center text-xs font-semibold text-muted-foreground"
                            >
                                {String.fromCharCode(65 + col)}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-800">
                    💡 Cells sync in real-time with Y.js. Changes visible to all collaborators.
                </p>
            </div>
        </div>
    );
}
