"use client";

import { useState } from "react";
import { useAiStream } from "@/hooks/use-ai-stream";
import { useAiRouting } from "@/hooks/use-ai-routing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Sparkles, Loader2, Bot, Wand2, Calculator } from "lucide-react";
import { SelectionBounds, CellData } from "./types";
import { cn } from "@/lib/utils";
import { indexToCol } from "@/lib/sheets/formula";

interface AiSheetsDialogProps {
    onClose: () => void;
    selectionBounds: SelectionBounds | null;
    data: Record<string, CellData>;
    onApplyResult: (value: string, r: number, c: number) => void;
    activeCell: { r: number, c: number } | null;
}

export function AiSheetsDialog({ onClose, selectionBounds, data, onApplyResult, activeCell }: AiSheetsDialogProps) {
    const [prompt, setPrompt] = useState("");
    const [result, setResult] = useState("");
    const { stream, isStreaming } = useAiStream();
    const routing = useAiRouting();

    // Build context from selection
    const getSelectionContext = () => {
        if (!selectionBounds) return "Aucune sélection.";
        const rows = [];
        for (let r = selectionBounds.minR; r <= selectionBounds.maxR; r++) {
            const row = [];
            for (let c = selectionBounds.minC; c <= selectionBounds.maxC; c++) {
                row.push(data[`${r},${c}`]?.value || "");
            }
            rows.push(row.join("\t"));
        }
        return rows.join("\n");
    };

    const selectedRangeStr = selectionBounds
        ? `${indexToCol(selectionBounds.minC)}${selectionBounds.minR + 1}:${indexToCol(selectionBounds.maxC)}${selectionBounds.maxR + 1}`
        : "Aucune sélection";

    const handleGenerate = async (type: "formula" | "insight" | "macro") => {
        if (!prompt.trim() || isStreaming) return;
        setResult("");

        const context = type === "formula"
            ? `Objectif: Tu es un expert Excel/Google Sheets. L'utilisateur veut une formule pour faire: "${prompt}". Réponds JUSTE avec la formule commençant par =, RIEN d'autre.`
            : `Objectif: Tu es un analyste de données. Analyse ce contexte extrait d'un tableur (Plage ${selectedRangeStr}) : \n\n${getSelectionContext()}\n\nDemande de l'utilisateur: "${prompt}". Sois concis et direct.`;

        const modelConfig = routing.getRouteConfig('docs');

        await stream(prompt, {
            onToken: (token) => setResult(prev => prev + token),
            onError: (err) => setResult(`Erreur: ${err}`)
        }, {
            systemPrompt: context,
            provider: modelConfig.providerId || undefined,
            model: modelConfig.modelId || undefined
        });
    };

    const handleApply = () => {
        if (activeCell && result) {
            onApplyResult(result.trim(), activeCell.r, activeCell.c);
            onClose();
        }
    };

    return (
        <div className="absolute top-12 right-4 w-96 bg-white dark:bg-[#2d2e30] border border-[#dadce0] dark:border-[#5f6368] rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 border-b border-[#dadce0] dark:border-[#5f6368]">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-semibold">
                    <Sparkles className="w-4 h-4" />
                    <span>AI Sheets Assistant</span>
                </div>
                <button onClick={onClose} className="text-[#5f6368] hover:text-[#202124] dark:hover:text-[#e8eaed] transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="p-4 flex flex-col gap-4">
                <div className="text-xs text-[#5f6368] dark:text-[#9aa0a6] flex items-center gap-1.5 bg-[#f1f3f4] dark:bg-[#3c4043] p-2 rounded-md">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Cellule active: <strong className="text-[#202124] dark:text-[#e8eaed]">{activeCell ? `${indexToCol(activeCell.c)}${activeCell.r + 1}` : "Aucune"}</strong>
                    &nbsp;| Plage: <strong className="text-[#202124] dark:text-[#e8eaed]">{selectedRangeStr}</strong>
                </div>

                <div className="space-y-2">
                    <Textarea
                        placeholder="Ex: Calcule la moyenne des cellules sélectionnées s'ils sont > 100..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="text-sm resize-none h-20 bg-transparent border-[#dadce0] dark:border-[#5f6368] focus-visible:ring-1 focus-visible:ring-purple-500 rounded-md"
                    />
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs h-8 border-purple-200 hover:bg-purple-50 hover:text-purple-700 dark:border-purple-900 dark:hover:bg-purple-900/30 dark:hover:text-purple-300 transition-colors"
                            onClick={() => handleGenerate("formula")}
                            disabled={isStreaming || !prompt.trim()}
                        >
                            <Calculator className="w-3.5 h-3.5 mr-1.5" /> Generer Formule
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs h-8 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-indigo-900 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300 transition-colors"
                            onClick={() => handleGenerate("insight")}
                            disabled={isStreaming || !prompt.trim()}
                        >
                            <Wand2 className="w-3.5 h-3.5 mr-1.5" /> Analyser Données
                        </Button>
                    </div>
                </div>

                {result && (
                    <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] flex items-center gap-1.5">
                            {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" /> : <Bot className="w-3.5 h-3.5 text-purple-500" />}
                            Résultat IA :
                        </div>
                        <div className="p-3 bg-[#f8f9fa] dark:bg-[#202124] rounded-md border border-[#dadce0] dark:border-[#5f6368] text-sm text-[#202124] dark:text-[#e8eaed] whitespace-pre-wrap font-mono">
                            {result}
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button size="sm" variant="ghost" onClick={() => setResult("")} className="h-8 text-xs">Annuler</Button>
                            <Button size="sm" onClick={handleApply} disabled={!activeCell || isStreaming} className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-colors">
                                Appliquer à {activeCell ? `${indexToCol(activeCell.c)}${activeCell.r + 1}` : 'la cellule'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
