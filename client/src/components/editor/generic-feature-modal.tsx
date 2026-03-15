import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Clock, Plus, Settings, Puzzle, Globe, Activity, ShieldAlert, Cpu } from 'lucide-react';

interface GenericFeatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    actionId: string | null;
    actionLabel?: string;
}

export function GenericFeatureModal({ isOpen, onClose, actionId, actionLabel }: GenericFeatureModalProps) {
    if (!isOpen || !actionId) return null;

    // Fallback names if actionLabel is missing
    const getModalTitle = () => {
        if (actionLabel && actionLabel !== 'todo') return actionLabel;
        switch (actionId) {
            case 'version_history': return 'Historique des versions';
            case 'page_setup': return 'Configuration de la page';
            case 'add_ons': return 'Modules complémentaires';
            case 'share_advanced': return 'Partage avancé';
            case 'translate': return 'Traduire le document';
            case 'spelling': return 'Orthographe et grammaire';
            default: return 'Fonctionnalité en cours de développement';
        }
    };

    const title = getModalTitle();

    // Render specific mock UIs based on actionId
    const renderContent = () => {
        // --- 1. Version History Fake UI ---
        if (actionId === 'version_history') {
            return (
                <div className="flex bg-background dark:bg-[#1f1f1f] h-[400px] border rounded-md overflow-hidden mt-4">
                    <div className="flex-1 p-8 flex flex-col items-center justify-center text-center border-r border-gray-200 dark:border-gray-800">
                        <Clock className="w-16 h-16 text-gray-300 dark:text-gray-700 mb-4" />
                        <h3 className="text-lg font-medium">Aperçu de la version</h3>
                        <p className="text-sm text-gray-500 mt-2 max-w-sm">Sélectionnez une version dans le panneau latéral pour voir les modifications apportées à cette date.</p>
                    </div>
                    <div className="w-80 bg-gray-50 dark:bg-[#141414] flex flex-col">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                            <span className="font-medium">Aujourd'hui</span>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-2 space-y-1">
                                {[1, 2, 3].map((_, i) => (
                                    <button key={i} className="w-full text-left p-3 hover:bg-background dark:hover:bg-[#1f1f1f] rounded-md transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-800 flex items-start gap-3">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                        <div>
                                            <div className="text-sm font-medium">{14 - i * 2}:30</div>
                                            <div className="text-xs text-gray-500 mt-1">Modifié par Vous</div>
                                        </div>
                                    </button>
                                ))}
                                <div className="p-4 border-b border-t border-gray-200 dark:border-gray-800 flex justify-between items-center mt-4">
                                    <span className="font-medium text-gray-600 dark:text-gray-400">Hier</span>
                                </div>
                                <button className="w-full text-left p-3 hover:bg-background dark:hover:bg-[#1f1f1f] rounded-md transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-800 flex items-start gap-3">
                                        <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                                        <div>
                                            <div className="text-sm font-medium">10:15</div>
                                            <div className="text-xs text-gray-500 mt-1">Version initiale</div>
                                        </div>
                                </button>
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            );
        }

        // --- 2. Add-ons Fake Store UI ---
        if (actionId === 'add_ons' || actionId === 'extensions') {
            return (
                <div className="mt-4 flex flex-col h-[400px]">
                    <div className="flex gap-2 mb-4 relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <Input placeholder="Rechercher des applications..." className="flex-1 pl-9" />
                    </div>
                    <ScrollArea className="flex-1 -mx-2 px-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                            {[
                                { name: "SignApps AI Writer", desc: "Génération de texte avancée", color: "bg-purple-100 dark:bg-purple-900/30 text-purple-600", icon: <Cpu className="w-6 h-6" /> },
                                { name: "Multi-Translate Pro", desc: "Traduction instantanée 40 langues", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600", icon: <Globe className="w-6 h-6" /> },
                                { name: "Advanced Analytics", desc: "Statistiques de lecture du document", color: "bg-green-100 dark:bg-green-900/30 text-green-600", icon: <Activity className="w-6 h-6" /> },
                                { name: "Security Scanner", desc: "Audit DLP et conformité RGPD", color: "bg-red-100 dark:bg-red-900/30 text-red-600", icon: <ShieldAlert className="w-6 h-6" /> },
                            ].map((app, i) => (
                                <div key={i} className="flex gap-4 p-4 border rounded-lg hover:border-blue-500 transition-colors bg-background dark:bg-[#1f1f1f]">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${app.color}`}>
                                        {app.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-sm truncate">{app.name}</h4>
                                        <p className="text-xs text-gray-500 mt-1">{app.desc}</p>
                                        <Button variant="secondary" size="sm" className="mt-3 h-7 text-xs w-full">Installer</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            );
        }

        // --- 3. Page Setup UI ---
        if (actionId === 'page_setup') {
            return (
                <div className="mt-4 space-y-6">
                    <Tabs defaultValue="pages">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="pages">Pages</TabsTrigger>
                            <TabsTrigger value="pageless">Sans pages</TabsTrigger>
                        </TabsList>
                        <TabsContent value="pages" className="space-y-4 mt-4">
                            <div className="space-y-3">
                                <Label>Orientation</Label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 border p-3 rounded-md flex-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1a1a1a]">
                                        <input type="radio" name="orientation" defaultChecked className="hidden" />
                                        <div className="w-4 h-4 rounded-full border border-blue-500 flex items-center justify-center after:w-2 after:h-2 after:bg-blue-500 after:rounded-full" />
                                        Portrait
                                    </label>
                                    <label className="flex items-center gap-2 border p-3 rounded-md flex-1 cursor-pointer opacity-50">
                                        <input type="radio" name="orientation" disabled className="hidden" />
                                        <div className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600" />
                                        Paysage
                                    </label>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <Label>Marges (cm)</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label className="text-xs text-gray-500">Haut</Label><Input type="number" defaultValue={2.54} /></div>
                                    <div><Label className="text-xs text-gray-500">Bas</Label><Input type="number" defaultValue={2.54} /></div>
                                    <div><Label className="text-xs text-gray-500">Gauche</Label><Input type="number" defaultValue={2.54} /></div>
                                    <div><Label className="text-xs text-gray-500">Droite</Label><Input type="number" defaultValue={2.54} /></div>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="pageless" className="p-8 text-center text-gray-500">
                            Le format sans pages permet à votre document de s'adapter à n'importe quel écran.
                        </TabsContent>
                    </Tabs>
                </div>
            );
        }

        // --- 4. Default / Generic Fallback UI ---
        // NO DEAD ENDS: Ce fallback ne devrait pas apparaître si les actions
        // non-implémentées sont correctement filtrées dans les menus
        return (
            <div className="mt-6 flex flex-col items-center justify-center text-center py-8">
                <div className="w-16 h-16 bg-muted text-muted-foreground rounded-full flex items-center justify-center mb-6">
                    <Settings className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                    Cette fonctionnalité n'est pas disponible dans cette version.
                </p>
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={actionId === 'version_history' ? 'sm:max-w-[900px]' : 'sm:max-w-[425px]'}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {actionId !== 'version_history' && actionId !== 'add_ons' && (
                        <DialogDescription>
                            Configuration et options pour {title.toLowerCase()}.
                        </DialogDescription>
                    )}
                </DialogHeader>
                
                {renderContent()}

                <DialogFooter className="mt-6 sm:justify-end">
                    <Button variant="outline" onClick={onClose}>Fermer</Button>
                    {actionId === 'page_setup' && <Button onClick={onClose}>Appliquer</Button>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
