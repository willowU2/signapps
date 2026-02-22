"use client";

import { useEffect, useState } from "react";
import { AlignLeft, ChevronRight } from "lucide-react";

interface DocumentOutlineProps {
    canvasRef: React.RefObject<any>; // fabric.Canvas
}

interface OutlineItem {
    id: string;
    text: string;
    top: number;
    level: 1 | 2 | 3; // H1, H2, H3
}

export function DocumentOutline({ canvasRef }: DocumentOutlineProps) {
    const [items, setItems] = useState<OutlineItem[]>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Function to rescan all objects and build outline
        const scanOutline = () => {
            const currentObjects = canvas.getObjects();
            const currentItems: OutlineItem[] = [];

            currentObjects.forEach((obj: any) => {
                if (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') {
                    const fontSize = obj.fontSize || 0;
                    const text = obj.text || '';

                    // Define hierarchy heuristics based on fontSize
                    // H1 > 28px, H2 > 20px, H3 > 16px (bold)
                    let level: 1 | 2 | 3 | null = null;

                    if (fontSize >= 28) level = 1;
                    else if (fontSize >= 20) level = 2;
                    else if (fontSize >= 16 && obj.fontWeight >= 600) level = 3;

                    if (level && text.trim().length > 0) {
                        currentItems.push({
                            id: obj.id || Math.random().toString(),
                            text: text.split('\n')[0].substring(0, 40) + (text.length > 40 ? '...' : ''), // Take first line max 40 chars
                            top: obj.top || 0,
                            level
                        });
                    }
                }
            });

            // Sort by vertical position on the page
            currentItems.sort((a, b) => a.top - b.top);
            setItems(currentItems);
        };

        // Initial scan
        setTimeout(scanOutline, 500); // give canvas time to initialize

        // Rescan when objects are added, modified, or removed
        canvas.on('object:added', scanOutline);
        canvas.on('object:modified', scanOutline);
        canvas.on('object:removed', scanOutline);
        canvas.on('text:changed', scanOutline);

        return () => {
            canvas.off('object:added', scanOutline);
            canvas.off('object:modified', scanOutline);
            canvas.off('object:removed', scanOutline);
            canvas.off('text:changed', scanOutline);
        };
    }, [canvasRef]);

    const scrollToItem = (top: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Simple scroll in parent container
        const wrapper = canvas.wrapperEl?.parentElement;
        if (wrapper) {
            wrapper.scrollTo({
                top: Math.max(0, top - 100), // scroll with 100px padding
                behavior: 'smooth'
            });
        }
    };

    if (items.length === 0) {
        return (
            <div className="p-4 pt-6 text-sm text-gray-500 italic">
                Add titles (large text) to see the document outline here.
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/30 dark:bg-black/10">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-200/50 dark:border-gray-800/50">
                <AlignLeft className="w-4 h-4 text-gray-500" />
                <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Outline</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 no-scrollbar space-y-0.5">
                {items.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => scrollToItem(item.top)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${item.level === 1 ? 'ml-0 font-medium text-gray-800 dark:text-gray-200' :
                            item.level === 2 ? 'ml-3 text-gray-600 dark:text-gray-400 text-sm' :
                                'ml-6 text-gray-500 text-xs'
                            }`}
                        title={item.text}
                    >
                        {item.level === 1 && <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                        <span className="truncate">{item.text}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
