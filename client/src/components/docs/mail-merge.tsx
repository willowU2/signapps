'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Editor } from '@tiptap/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileSpreadsheet, Mail, FileDown, ChevronRight, ChevronLeft, Loader2, AlertCircle } from 'lucide-react';
import { driveApi, type DriveNode } from '@/lib/api/drive';
import { docsApi } from '@/lib/api/docs';
import { mailApi, type SendEmailRequest } from '@/lib/api/mail';
import { toast } from 'sonner';

interface MailMergeProps { editor: Editor | null; open: boolean; onOpenChange: (open: boolean) => void; }
interface SheetOption { id: string; name: string; targetId: string; }
interface VariableMapping { variable: string; column: string; }
type Step = 'source' | 'map' | 'preview' | 'action';

const STEPS: { key: Step; label: string }[] = [
    { key: 'source', label: '1. Source' }, { key: 'map', label: '2. Variables' },
    { key: 'preview', label: '3. Apercu' }, { key: 'action', label: '4. Action' },
];

function extractPlaceholders(html: string): string[] {
    const found = new Set<string>();
    let m: RegExpExecArray | null;
    const re = /\{\{(\w+(?:\s*\w+)*)\}\}/g;
    while ((m = re.exec(html)) !== null) found.add(m[1].trim());
    return Array.from(found);
}

function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function mergeTemplate(html: string, mappings: VariableMapping[], row: Record<string, string>): string {
    let result = html;
    for (const m of mappings) {
        if (m.column && row[m.column] !== undefined)
            result = result.replace(new RegExp(`\\{\\{\\s*${escapeRegex(m.variable)}\\s*\\}\\}`, 'g'), row[m.column]);
    }
    return result;
}

export function MailMerge({ editor, open, onOpenChange }: MailMergeProps) {
    const [step, setStep] = useState<Step>('source');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sheets, setSheets] = useState<SheetOption[]>([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [columns, setColumns] = useState<string[]>([]);
    const [rows, setRows] = useState<Record<string, string>[]>([]);
    const [placeholders, setPlaceholders] = useState<string[]>([]);
    const [mappings, setMappings] = useState<VariableMapping[]>([]);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [actionType, setActionType] = useState<'pdf' | 'email'>('email');
    const [emailColumn, setEmailColumn] = useState('');
    const [subjectColumn, setSubjectColumn] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!open) return;
        setStep('source'); setError(null);
        (async () => {
            try {
                setLoading(true);
                const nodes = await driveApi.listNodes();
                setSheets((nodes || []).filter((n: DriveNode) => n.node_type === 'spreadsheet')
                    .map((n: DriveNode) => ({ id: n.id, name: n.name, targetId: n.target_id || n.id })));
            } catch { setError('Impossible de charger la liste des classeurs.'); }
            finally { setLoading(false); }
        })();
    }, [open]);

    useEffect(() => {
        if (editor && open) setPlaceholders(extractPlaceholders(editor.getHTML()));
    }, [editor, open]);

    const loadSheetData = useCallback(async () => {
        if (!selectedSheet) return;
        setLoading(true); setError(null);
        try {
            const sheet = sheets.find((s) => s.id === selectedSheet);
            if (!sheet) throw new Error('Classeur introuvable');
            const response = await docsApi.getSpreadsheetRows(sheet.targetId);
            const rawRows = response.data?.rows || [];
            if (rawRows.length < 2) { setError('Le classeur doit contenir un en-tete et des donnees.'); setLoading(false); return; }
            const headers = rawRows[0].map((h: string) => String(h).trim());
            setColumns(headers);
            setRows(rawRows.slice(1).map((row: string[]) => {
                const obj: Record<string, string> = {};
                headers.forEach((h: string, i: number) => { obj[h] = String(row[i] ?? ''); });
                return obj;
            }));
            setMappings(placeholders.map((v) => ({
                variable: v, column: headers.find((h: string) => h.toLowerCase() === v.toLowerCase()) || '',
            })));
            setStep('map');
        } catch (err: any) { setError(err?.message || 'Erreur lors du chargement.'); }
        finally { setLoading(false); }
    }, [selectedSheet, sheets, placeholders]);

    const previewHtml = useMemo(() => {
        if (!editor || rows.length === 0) return '';
        return mergeTemplate(editor.getHTML(), mappings, rows[previewIndex] || rows[0]);
    }, [editor, rows, mappings, previewIndex]);

    const executeAction = useCallback(async () => {
        if (!editor) return;
        setProcessing(true);
        const html = editor.getHTML();
        try {
            if (actionType === 'email') {
                if (!emailColumn) { toast.error('Selectionnez la colonne e-mail.'); setProcessing(false); return; }
                const accts = await mailApi.listAccounts();
                const accounts = accts.data || [];
                if (!accounts.length) { toast.error('Aucun compte mail configure.'); setProcessing(false); return; }
                let sent = 0;
                for (const row of rows) {
                    const to = row[emailColumn];
                    if (!to?.includes('@')) continue;
                    const req: SendEmailRequest = {
                        account_id: accounts[0].id, recipient: to,
                        subject: subjectColumn && row[subjectColumn] ? row[subjectColumn] : 'Document - Mail Merge',
                        body_html: mergeTemplate(html, mappings, row),
                    };
                    await mailApi.sendEmail(req); sent++;
                }
                toast.success(`${sent} email(s) envoye(s).`);
            } else {
                let count = 0;
                for (const row of rows) {
                    const merged = mergeTemplate(html, mappings, row);
                    const url = URL.createObjectURL(new Blob([merged], { type: 'text/html' }));
                    const a = document.createElement('a');
                    a.href = url;
                    const nameCol = columns.find((c) => c.toLowerCase().includes('nom') || c.toLowerCase().includes('name'));
                    a.download = nameCol && row[nameCol] ? `document_${row[nameCol]}.html` : `document_${count + 1}.html`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    URL.revokeObjectURL(url); count++;
                }
                toast.success(`${count} document(s) genere(s).`);
            }
            onOpenChange(false);
        } catch (err: any) { toast.error(`Erreur: ${err?.message || 'Echec.'}`); }
        finally { setProcessing(false); }
    }, [editor, actionType, emailColumn, subjectColumn, rows, mappings, columns, onOpenChange]);

    const canProceed = (): boolean => {
        if (step === 'source') return !!selectedSheet;
        if (step === 'map') return mappings.every((m) => m.column !== '');
        if (step === 'action') return actionType === 'pdf' || !!emailColumn;
        return true;
    };

    const nextStep = () => {
        const idx = STEPS.findIndex((s) => s.key === step);
        if (step === 'source') { loadSheetData(); return; }
        if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].key);
    };
    const prevStep = () => { const idx = STEPS.findIndex((s) => s.key === step); if (idx > 0) setStep(STEPS[idx - 1].key); };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        Publipostage (Mail Merge)
                    </DialogTitle>
                    <DialogDescription>
                        Fusionnez ce document avec un classeur pour generer des e-mails ou documents personnalises.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-1 py-2">
                    {STEPS.map((s, i) => (
                        <div key={s.key} className="flex items-center gap-1">
                            <Badge variant={step === s.key ? 'default' : 'secondary'} className={`text-xs ${step === s.key ? '' : 'opacity-60'}`}>{s.label}</Badge>
                            {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                        </div>
                    ))}
                </div>
                <Separator />

                <div className="flex-1 overflow-y-auto py-4 min-h-[200px]">
                    {error && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md mb-4"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

                    {step === 'source' && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">Selectionnez un classeur comme source de donnees.</p>
                            {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement...</div>
                            : sheets.length === 0 ? <p className="text-sm text-muted-foreground">Aucun classeur dans le Drive.</p>
                            : <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                                <SelectTrigger><SelectValue placeholder="Choisir un classeur..." /></SelectTrigger>
                                <SelectContent>{sheets.map((s) => <SelectItem key={s.id} value={s.id}><span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-green-600" />{s.name}</span></SelectItem>)}</SelectContent>
                              </Select>}
                            {placeholders.length > 0 && <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">Variables detectees :</p><div className="flex flex-wrap gap-1.5">{placeholders.map((v) => <Badge key={v} variant="outline" className="text-xs font-mono">{`{{${v}}}`}</Badge>)}</div></div>}
                            {placeholders.length === 0 && <p className="text-xs text-amber-600 dark:text-amber-400">Aucune variable {'{{variable}}'} detectee dans le document.</p>}
                        </div>
                    )}

                    {step === 'map' && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">Associez chaque variable a une colonne ({rows.length} lignes).</p>
                            <div className="space-y-3">
                                {mappings.map((m) => (
                                    <div key={m.variable} className="flex items-center gap-3">
                                        <Badge variant="outline" className="font-mono text-xs min-w-[120px] justify-center">{`{{${m.variable}}}`}</Badge>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <Select value={m.column} onValueChange={(v) => setMappings((p) => p.map((x) => x.variable === m.variable ? { ...x, column: v } : x))}>
                                            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Colonne..." /></SelectTrigger>
                                            <SelectContent>{columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">Apercu ligne {previewIndex + 1}/{rows.length}</p>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))} disabled={previewIndex === 0}><ChevronLeft className="h-4 w-4" /></Button>
                                    <Button variant="outline" size="sm" onClick={() => setPreviewIndex(Math.min(rows.length - 1, previewIndex + 1))} disabled={previewIndex >= rows.length - 1}><ChevronRight className="h-4 w-4" /></Button>
                                </div>
                            </div>
                            <div className="border rounded-md p-4 bg-white dark:bg-[#1f1f1f] max-h-[300px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                        </div>
                    )}

                    {step === 'action' && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">Action pour les {rows.length} documents fusionnes :</p>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setActionType('email')} className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${actionType === 'email' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'}`}>
                                    <Mail className="h-8 w-8 text-blue-600" /><span className="text-sm font-medium">Envoyer par e-mail</span>
                                </button>
                                <button onClick={() => setActionType('pdf')} className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${actionType === 'pdf' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'}`}>
                                    <FileDown className="h-8 w-8 text-red-600" /><span className="text-sm font-medium">Telecharger</span>
                                </button>
                            </div>
                            {actionType === 'email' && (
                                <div className="space-y-3 pt-2">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">Colonne e-mail</label>
                                        <Select value={emailColumn} onValueChange={setEmailColumn}>
                                            <SelectTrigger><SelectValue placeholder="Colonne e-mail..." /></SelectTrigger>
                                            <SelectContent>{columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">Colonne sujet (optionnel)</label>
                                        <Select value={subjectColumn} onValueChange={setSubjectColumn}>
                                            <SelectTrigger><SelectValue placeholder="Sujet par defaut" /></SelectTrigger>
                                            <SelectContent><SelectItem value="">Sujet par defaut</SelectItem>{columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <Separator />
                <DialogFooter className="flex items-center justify-between gap-2 pt-2">
                    <Button variant="outline" onClick={prevStep} disabled={step === 'source'}><ChevronLeft className="h-4 w-4 mr-1" />Retour</Button>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
                        {step === 'action'
                            ? <Button onClick={executeAction} disabled={!canProceed() || processing}>{processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{actionType === 'email' ? 'Envoyer' : 'Generer'}</Button>
                            : <Button onClick={nextStep} disabled={!canProceed() || loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Suivant<ChevronRight className="h-4 w-4 ml-1" /></Button>}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
