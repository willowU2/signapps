import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
    Search, Clock, Plus, Settings, Puzzle, Globe, Activity, ShieldAlert, Cpu,
    Share2, Mail, FileCheck, Download, Info, Shield, FileText, Users, Link2,
    Copy, Check, Calendar, HardDrive, Eye, Edit3, Trash2, ExternalLink,
    Grid3X3, BarChart3, PieChart, Table, Calculator, Database
} from 'lucide-react';

interface GenericFeatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    actionId: string | null;
    actionLabel?: string;
}

export function GenericFeatureModal({ isOpen, onClose, actionId, actionLabel }: GenericFeatureModalProps) {
    const [copied, setCopied] = useState(false);

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
            case 'templates': return 'Modèles de feuille de calcul';
            case 'share': return 'Partager avec d\'autres personnes';
            case 'publish_web': return 'Publier sur le Web';
            case 'email_send': return 'Envoyer par e-mail';
            case 'approvals': return 'Approbations';
            case 'name_version': return 'Nommer la version actuelle';
            case 'offline_mode': return 'Accès hors connexion';
            case 'file_details': return 'Détails du document';
            case 'security_limits': return 'Limites de sécurité';
            case 'file_settings': return 'Paramètres du document';
            case 'protected_ranges': return 'Plages protégées';
            case 'group_rows_cols': return 'Associer lignes/colonnes';
            case 'ungroup_rows_cols': return 'Dissocier lignes/colonnes';
            case 'show_comments': return 'Commentaires';
            case 'hidden_sheets': return 'Feuilles masquées';
            case 'shift_cells_right': return 'Décaler les cellules';
            case 'shift_cells_down': return 'Décaler les cellules';
            case 'generate_table': return 'Générer un tableau';
            case 'preset_tables': return 'Tableaux prédéfinis';
            case 'insert_timeline': return 'Chronologie';
            case 'pivot_table': return 'Tableau croisé dynamique';
            case 'image_in_cell': return 'Image dans la cellule';
            case 'image_over_cells': return 'Image sur les cellules';
            case 'insert_drawing': return 'Dessin';
            case 'format_custom': return 'Formats personnalisés';
            case 'convert_to_table': return 'Convertir en tableau';
            case 'analyze_data': return 'Analyser les données';
            case 'group_view': return 'Vue de regroupement';
            case 'filtered_view': return 'Vue filtrée';
            case 'add_slicer': return 'Segment';
            case 'protect_sheets': return 'Protéger feuilles et plages';
            case 'named_ranges': return 'Plages nommées';
            case 'named_functions': return 'Fonctions nommées';
            case 'random_range': return 'Plage aléatoire';
            case 'column_stats': return 'Statistiques de colonne';
            case 'cleanup_suggestions': return 'Suggestions de nettoyage';
            case 'remove_duplicates': return 'Supprimer les doublons';
            case 'trim_whitespace': return 'Supprimer les espaces';
            case 'split_text': return 'Scinder le texte en colonnes';
            case 'create_form': return 'Créer un formulaire';
            case 'spell_check': return 'Vérification orthographique';
            case 'personal_dictionary': return 'Dictionnaire personnel';
            case 'auto_complete_settings': return 'Suggestions automatiques';
            case 'conditional_notifications': return 'Notifications conditionnelles';
            case 'notify_changes': return 'Paramètres de notification';
            case 'accessibility_settings': return 'Accessibilité';
            case 'activity_dashboard': return 'Tableau de bord des activités';
            case 'ai_analyze': return 'Analyser les données';
            case 'ai_charts': return 'Générer des graphiques';
            case 'ai_pivot': return 'Générer un tableau croisé dynamique';
            case 'ai_table': return 'Générer un tableau';
            case 'ai_image': return 'Générer une image';
            case 'ai_formula': return 'Générer une formule';
            case 'ai_summarize': return 'Résumer du texte';
            case 'ai_classify': return 'Classer du texte';
            case 'ai_sentiment': return 'Analyser les sentiments';
            case 'ai_generate': return 'Générer du texte';
            case 'record_macro': return 'Enregistrer une macro';
            case 'apps_script': return 'Apps Script';
            case 'create_app': return 'Créer une application';
            case 'help_docs': return 'Aide de Sheets';
            case 'send_feedback': return 'Envoyer des commentaires';
            case 'functions_list': return 'Liste des fonctions';
            case 'keyboard_shortcuts': return 'Raccourcis clavier';
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

        // --- Templates Gallery ---
        if (actionId === 'templates') {
            const templates = [
                { name: 'Budget personnel', icon: <Calculator className="w-6 h-6" />, color: 'bg-green-100 dark:bg-green-900/30 text-green-600', desc: 'Suivez vos revenus et dépenses' },
                { name: 'Planning projet', icon: <Calendar className="w-6 h-6" />, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600', desc: 'Diagramme de Gantt simplifié' },
                { name: 'Inventaire', icon: <Database className="w-6 h-6" />, color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600', desc: 'Gérez votre stock produits' },
                { name: 'Tableau de bord KPI', icon: <BarChart3 className="w-6 h-6" />, color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600', desc: 'Indicateurs de performance' },
                { name: 'Liste de tâches', icon: <FileCheck className="w-6 h-6" />, color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600', desc: 'Suivi des tâches d\'équipe' },
                { name: 'Facture', icon: <FileText className="w-6 h-6" />, color: 'bg-red-100 dark:bg-red-900/30 text-red-600', desc: 'Modèle de facturation' },
            ];
            return (
                <div className="mt-4 flex flex-col h-[400px]">
                    <div className="flex gap-2 mb-4 relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <Input placeholder="Rechercher un modèle..." className="flex-1 pl-9" />
                    </div>
                    <ScrollArea className="flex-1 -mx-2 px-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                            {templates.map((tpl, i) => (
                                <button key={i} className="flex gap-4 p-4 border rounded-lg hover:border-blue-500 transition-colors bg-background dark:bg-[#1f1f1f] text-left">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${tpl.color}`}>
                                        {tpl.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-sm">{tpl.name}</h4>
                                        <p className="text-xs text-gray-500 mt-1">{tpl.desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            );
        }

        // --- Share Dialog ---
        if (actionId === 'share') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Ajouter des personnes</Label>
                        <div className="flex gap-2">
                            <Input placeholder="Adresse e-mail ou nom..." className="flex-1" />
                            <Button variant="secondary">
                                <Users className="w-4 h-4 mr-2" />
                                Ajouter
                            </Button>
                        </div>
                    </div>
                    <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 text-sm font-medium">V</div>
                                <div>
                                    <div className="text-sm font-medium">Vous (Propriétaire)</div>
                                    <div className="text-xs text-gray-500">vous@exemple.com</div>
                                </div>
                            </div>
                            <span className="text-xs text-gray-500">Propriétaire</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Lien de partage</Label>
                        <div className="flex gap-2">
                            <Input readOnly value="https://signapps.io/s/abc123..." className="flex-1 text-xs" />
                            <Button variant="outline" onClick={() => { navigator.clipboard.writeText('https://signapps.io/s/abc123'); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <Link2 className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500">Toute personne disposant du lien peut consulter</span>
                        </div>
                    </div>
                </div>
            );
        }

        // --- Publish to Web ---
        if (actionId === 'publish_web') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex gap-3">
                            <Globe className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">Publication sur le Web</h4>
                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                    Une fois publié, votre document sera accessible à tous via une URL publique.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label>Publier ce document</Label>
                            <Switch />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-500">URL publique</Label>
                            <Input readOnly value="https://signapps.io/pub/..." className="text-xs" disabled />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-500">Intégrer dans un site</Label>
                            <Input readOnly value='<iframe src="https://signapps.io/embed/..." />' className="text-xs font-mono" disabled />
                        </div>
                    </div>
                </div>
            );
        }

        // --- Email Send ---
        if (actionId === 'email_send') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Destinataires</Label>
                        <Input placeholder="Adresses e-mail séparées par des virgules..." />
                    </div>
                    <div className="space-y-2">
                        <Label>Objet</Label>
                        <Input defaultValue="[SignApps] Feuille de calcul partagée" />
                    </div>
                    <div className="space-y-2">
                        <Label>Message (optionnel)</Label>
                        <textarea className="w-full h-20 px-3 py-2 border rounded-md text-sm resize-none dark:bg-[#1f1f1f]" placeholder="Ajoutez un message personnel..." />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs text-gray-500">Format d'envoi</Label>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1">
                                <Link2 className="w-4 h-4 mr-2" />
                                Lien
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1">
                                <FileText className="w-4 h-4 mr-2" />
                                PDF
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1">
                                <Table className="w-4 h-4 mr-2" />
                                Excel
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        // --- Approvals ---
        if (actionId === 'approvals') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="bg-gray-50 dark:bg-[#1a1a1a] border rounded-lg p-4 text-center">
                        <FileCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <h4 className="text-sm font-medium">Aucune approbation en cours</h4>
                        <p className="text-xs text-gray-500 mt-1">Demandez l'approbation de collaborateurs pour ce document.</p>
                    </div>
                    <Button className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Demander une approbation
                    </Button>
                </div>
            );
        }

        // --- Name Version ---
        if (actionId === 'name_version') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Nom de la version</Label>
                        <Input placeholder="ex: Version finale, Draft v2..." />
                    </div>
                    <p className="text-xs text-gray-500">
                        Les versions nommées sont conservées indéfiniment et apparaissent en haut de l'historique.
                    </p>
                </div>
            );
        }

        // --- Offline Mode ---
        if (actionId === 'offline_mode') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <HardDrive className="w-5 h-5 text-gray-400" />
                            <div>
                                <div className="text-sm font-medium">Accès hors connexion</div>
                                <div className="text-xs text-gray-500">Modifiez ce fichier sans Internet</div>
                            </div>
                        </div>
                        <Switch />
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                            Les modifications hors ligne seront synchronisées automatiquement lors de la reconnexion.
                        </p>
                    </div>
                </div>
            );
        }

        // --- File Details ---
        if (actionId === 'file_details') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Propriétaire</div>
                            <div className="font-medium">Vous</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Emplacement</div>
                            <div className="font-medium">Mon Drive</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Créé le</div>
                            <div className="font-medium">{new Date().toLocaleDateString('fr-FR')}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Modifié le</div>
                            <div className="font-medium">{new Date().toLocaleDateString('fr-FR')}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Taille</div>
                            <div className="font-medium">24 Ko</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Feuilles</div>
                            <div className="font-medium">1</div>
                        </div>
                    </div>
                    <div className="border-t pt-4">
                        <div className="text-xs text-gray-500 mb-2">Description</div>
                        <textarea className="w-full h-16 px-3 py-2 border rounded-md text-sm resize-none dark:bg-[#1f1f1f]" placeholder="Ajoutez une description..." />
                    </div>
                </div>
            );
        }

        // --- Security Limits ---
        if (actionId === 'security_limits') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                                <Download className="w-4 h-4 text-gray-400" />
                                <span className="text-sm">Autoriser le téléchargement</span>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                                <Copy className="w-4 h-4 text-gray-400" />
                                <span className="text-sm">Autoriser la copie</span>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                                <Share2 className="w-4 h-4 text-gray-400" />
                                <span className="text-sm">Autoriser le partage</span>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                                <ExternalLink className="w-4 h-4 text-gray-400" />
                                <span className="text-sm">Autoriser l'impression</span>
                            </div>
                            <Switch defaultChecked />
                        </div>
                    </div>
                </div>
            );
        }

        // --- File Settings ---
        if (actionId === 'file_settings') {
            return (
                <div className="mt-4 space-y-4">
                    <Tabs defaultValue="general">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="general">Général</TabsTrigger>
                            <TabsTrigger value="calcul">Calcul</TabsTrigger>
                        </TabsList>
                        <TabsContent value="general" className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label>Fuseau horaire</Label>
                                <Input defaultValue="Europe/Paris (UTC+1)" />
                            </div>
                            <div className="space-y-2">
                                <Label>Paramètres régionaux</Label>
                                <Input defaultValue="France" />
                            </div>
                        </TabsContent>
                        <TabsContent value="calcul" className="space-y-4 mt-4">
                            <div className="flex items-center justify-between">
                                <Label>Recalcul automatique</Label>
                                <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label>Mode itératif</Label>
                                <Switch />
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            );
        }

        // --- Protected Ranges ---
        if (actionId === 'protected_ranges') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="bg-gray-50 dark:bg-[#1a1a1a] border rounded-lg p-4 text-center">
                        <Shield className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <h4 className="text-sm font-medium">Aucune plage protégée</h4>
                        <p className="text-xs text-gray-500 mt-1">Protégez des cellules ou plages contre les modifications.</p>
                    </div>
                    <Button className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter une plage protégée
                    </Button>
                </div>
            );
        }

        // --- Group Rows/Cols ---
        if (actionId === 'group_rows_cols') {
            return (
                <div className="mt-4 space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Sélectionnez les lignes ou colonnes à grouper dans la feuille, puis cliquez sur Associer.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <Button variant="outline" className="h-20 flex-col">
                            <Grid3X3 className="w-6 h-6 mb-2" />
                            Associer lignes
                        </Button>
                        <Button variant="outline" className="h-20 flex-col">
                            <Grid3X3 className="w-6 h-6 mb-2 rotate-90" />
                            Associer colonnes
                        </Button>
                    </div>
                </div>
            );
        }

        // --- Ungroup Rows/Cols ---
        if (actionId === 'ungroup_rows_cols') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="bg-gray-50 dark:bg-[#1a1a1a] border rounded-lg p-4 text-center">
                        <Grid3X3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <h4 className="text-sm font-medium">Aucun groupe actif</h4>
                        <p className="text-xs text-gray-500 mt-1">Créez d'abord un groupe de lignes ou colonnes.</p>
                    </div>
                </div>
            );
        }

        // --- Show Comments ---
        if (actionId === 'show_comments') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <Eye className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">Afficher les commentaires</span>
                        </div>
                        <Switch defaultChecked />
                    </div>
                    <div className="bg-gray-50 dark:bg-[#1a1a1a] border rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-500">Aucun commentaire dans ce document.</p>
                    </div>
                </div>
            );
        }

        // --- Hidden Sheets ---
        if (actionId === 'hidden_sheets') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="bg-gray-50 dark:bg-[#1a1a1a] border rounded-lg p-4 text-center">
                        <Eye className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <h4 className="text-sm font-medium">Aucune feuille masquée</h4>
                        <p className="text-xs text-gray-500 mt-1">Toutes les feuilles sont visibles.</p>
                    </div>
                </div>
            );
        }

        // --- Shift Cells ---
        if (actionId === 'shift_cells_right' || actionId === 'shift_cells_down') {
            const direction = actionId === 'shift_cells_right' ? 'droite' : 'bas';
            return (
                <div className="mt-4 space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Insérer une cellule et décaler les cellules existantes vers la {direction}.
                    </p>
                    <Button className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Insérer et décaler vers la {direction}
                    </Button>
                </div>
            );
        }

        // --- Generate Table ---
        if (actionId === 'generate_table') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Nombre de lignes</Label>
                        <Input type="number" defaultValue={5} min={1} max={100} />
                    </div>
                    <div className="space-y-2">
                        <Label>Nombre de colonnes</Label>
                        <Input type="number" defaultValue={3} min={1} max={26} />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>En-têtes de colonnes</Label>
                        <Switch defaultChecked />
                    </div>
                </div>
            );
        }

        // --- Preset Tables ---
        if (actionId === 'preset_tables') {
            const presets = [
                { name: 'Budget mensuel', icon: <Calculator className="w-5 h-5" />, color: 'bg-green-100 dark:bg-green-900/30 text-green-600' },
                { name: 'Calendrier', icon: <Calendar className="w-5 h-5" />, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' },
                { name: 'Liste de contacts', icon: <Users className="w-5 h-5" />, color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' },
                { name: 'Suivi de projet', icon: <FileCheck className="w-5 h-5" />, color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' },
            ];
            return (
                <div className="mt-4">
                    <ScrollArea className="h-[250px] -mx-2 px-2">
                        <div className="space-y-2">
                            {presets.map((preset, i) => (
                                <button key={i} className="w-full flex items-center gap-3 p-3 border rounded-lg hover:border-blue-500 transition-colors text-left">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${preset.color}`}>
                                        {preset.icon}
                                    </div>
                                    <span className="text-sm font-medium">{preset.name}</span>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            );
        }

        // --- Timeline ---
        if (actionId === 'insert_timeline') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex gap-3">
                            <Calendar className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">Chronologie</h4>
                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                    Sélectionnez une plage contenant des dates pour créer une chronologie interactive.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Plage de données</Label>
                        <Input placeholder="A1:B10" />
                    </div>
                </div>
            );
        }

        // --- Pivot Table ---
        if (actionId === 'pivot_table') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Plage de données</Label>
                        <Input placeholder="A1:D100" />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>Créer dans une nouvelle feuille</Label>
                        <Switch defaultChecked />
                    </div>
                    <div className="bg-gray-50 dark:bg-[#1a1a1a] border rounded-lg p-4 text-center">
                        <PieChart className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">Analysez vos données avec un tableau croisé dynamique</p>
                    </div>
                </div>
            );
        }

        // --- Image in Cell ---
        if (actionId === 'image_in_cell') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Plus className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium">Glissez une image ici</p>
                        <p className="text-xs text-gray-500 mt-1">ou cliquez pour sélectionner</p>
                    </div>
                    <p className="text-xs text-gray-500 text-center">
                        L'image sera redimensionnée pour tenir dans la cellule sélectionnée.
                    </p>
                </div>
            );
        }

        // --- Image over Cells ---
        if (actionId === 'image_over_cells') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Plus className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium">Glissez une image ici</p>
                        <p className="text-xs text-gray-500 mt-1">ou cliquez pour sélectionner</p>
                    </div>
                    <p className="text-xs text-gray-500 text-center">
                        L'image flotte au-dessus des cellules et peut être redimensionnée librement.
                    </p>
                </div>
            );
        }

        // --- Drawing ---
        if (actionId === 'insert_drawing') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="bg-gray-50 dark:bg-[#1a1a1a] border rounded-lg p-4 text-center">
                        <Edit3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <h4 className="text-sm font-medium">Éditeur de dessin</h4>
                        <p className="text-xs text-gray-500 mt-1">Créez des formes, lignes et annotations.</p>
                    </div>
                    <Button className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Ouvrir l'éditeur de dessin
                    </Button>
                </div>
            );
        }

        // --- Custom Format ---
        if (actionId === 'format_custom') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Format personnalisé</Label>
                        <Input placeholder="#,##0.00" className="font-mono" />
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                        <p><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">#,##0.00</code> — Nombre avec séparateurs</p>
                        <p><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">0%</code> — Pourcentage</p>
                        <p><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">dd/mm/yyyy</code> — Date</p>
                        <p><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">hh:mm:ss</code> — Heure</p>
                    </div>
                </div>
            );
        }

        // --- Convert to Table ---
        if (actionId === 'convert_to_table') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Plage de données</Label>
                        <Input placeholder="A1:D10" />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>La première ligne contient des en-têtes</Label>
                        <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>Appliquer les couleurs en alternance</Label>
                        <Switch defaultChecked />
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                            Les tableaux permettent un tri, filtrage et mise en forme automatiques.
                        </p>
                    </div>
                </div>
            );
        }

        // --- Analyze Data ---
        if (actionId === 'analyze_data') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                        <div className="flex gap-3">
                            <BarChart3 className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-medium text-purple-900 dark:text-purple-100">Analyse automatique</h4>
                                <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                                    L'IA analysera vos données et suggérera des graphiques et insights.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Plage à analyser</Label>
                        <Input placeholder="A1:Z100" />
                    </div>
                </div>
            );
        }

        // --- Filtered View ---
        if (actionId === 'filtered_view' || actionId === 'group_view') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Nom de la vue</Label>
                        <Input placeholder="Ma vue filtrée" />
                    </div>
                    <div className="space-y-2">
                        <Label>Plage de données</Label>
                        <Input placeholder="A1:D100" />
                    </div>
                    <p className="text-xs text-gray-500">
                        Les vues filtrées vous permettent de créer des filtres personnalisés sans affecter les autres utilisateurs.
                    </p>
                </div>
            );
        }

        // --- Slicer ---
        if (actionId === 'add_slicer') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Colonne source</Label>
                        <Input placeholder="Colonne A" />
                    </div>
                    <p className="text-xs text-gray-500">
                        Les segments permettent de filtrer rapidement vos données avec des boutons visuels.
                    </p>
                    <div className="bg-gray-50 dark:bg-[#1a1a1a] border rounded-lg p-4 text-center">
                        <Database className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">Aperçu du segment</p>
                    </div>
                </div>
            );
        }

        // --- Protect Sheets ---
        if (actionId === 'protect_sheets') {
            return (
                <div className="mt-4 space-y-4">
                    <Tabs defaultValue="sheet">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="sheet">Feuille</TabsTrigger>
                            <TabsTrigger value="range">Plage</TabsTrigger>
                        </TabsList>
                        <TabsContent value="sheet" className="space-y-4 mt-4">
                            <div className="flex items-center justify-between">
                                <Label>Protéger cette feuille</Label>
                                <Switch />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-gray-500">Exceptions (utilisateurs autorisés)</Label>
                                <Input placeholder="email@exemple.com" />
                            </div>
                        </TabsContent>
                        <TabsContent value="range" className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label>Plage à protéger</Label>
                                <Input placeholder="A1:D10" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-gray-500">Description</Label>
                                <Input placeholder="Données importantes" />
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            );
        }

        // --- Named Ranges ---
        if (actionId === 'named_ranges') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="bg-gray-50 dark:bg-[#1a1a1a] border rounded-lg p-4 text-center">
                        <Table className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <h4 className="text-sm font-medium">Aucune plage nommée</h4>
                        <p className="text-xs text-gray-500 mt-1">Les plages nommées facilitent l'utilisation dans les formules.</p>
                    </div>
                    <Button className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter une plage nommée
                    </Button>
                </div>
            );
        }

        // --- Named Functions ---
        if (actionId === 'named_functions') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="bg-gray-50 dark:bg-[#1a1a1a] border rounded-lg p-4 text-center">
                        <Calculator className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <h4 className="text-sm font-medium">Aucune fonction nommée</h4>
                        <p className="text-xs text-gray-500 mt-1">Créez des fonctions personnalisées réutilisables.</p>
                    </div>
                    <Button className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Créer une fonction
                    </Button>
                </div>
            );
        }

        // --- Random Range ---
        if (actionId === 'random_range') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Plage de destination</Label>
                        <Input placeholder="A1:A10" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-500">Valeur min</Label>
                            <Input type="number" defaultValue={1} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-500">Valeur max</Label>
                            <Input type="number" defaultValue={100} />
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>Nombres entiers uniquement</Label>
                        <Switch defaultChecked />
                    </div>
                </div>
            );
        }

        // --- Column Stats ---
        if (actionId === 'column_stats') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Colonne à analyser</Label>
                        <Input placeholder="Colonne A" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-3 border rounded-lg">
                            <div className="text-xs text-gray-500">Somme</div>
                            <div className="font-medium">—</div>
                        </div>
                        <div className="p-3 border rounded-lg">
                            <div className="text-xs text-gray-500">Moyenne</div>
                            <div className="font-medium">—</div>
                        </div>
                        <div className="p-3 border rounded-lg">
                            <div className="text-xs text-gray-500">Min</div>
                            <div className="font-medium">—</div>
                        </div>
                        <div className="p-3 border rounded-lg">
                            <div className="text-xs text-gray-500">Max</div>
                            <div className="font-medium">—</div>
                        </div>
                    </div>
                </div>
            );
        }

        // --- Cleanup Suggestions ---
        if (actionId === 'cleanup_suggestions') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex gap-3">
                            <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-medium text-green-900 dark:text-green-100">Données propres</h4>
                                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                                    Aucun problème détecté dans vos données.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // --- Remove Duplicates ---
        if (actionId === 'remove_duplicates') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Plage à vérifier</Label>
                        <Input placeholder="A1:D100" />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>Les données ont des en-têtes</Label>
                        <Switch defaultChecked />
                    </div>
                    <p className="text-xs text-gray-500">
                        Les lignes en double seront supprimées en conservant la première occurrence.
                    </p>
                </div>
            );
        }

        // --- Trim Whitespace ---
        if (actionId === 'trim_whitespace') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Plage à nettoyer</Label>
                        <Input placeholder="A1:D100" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs text-gray-500">Options</Label>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" defaultChecked className="accent-blue-600" />
                                Supprimer les espaces au début et à la fin
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" defaultChecked className="accent-blue-600" />
                                Remplacer les espaces multiples par un seul
                            </label>
                        </div>
                    </div>
                </div>
            );
        }

        // --- Split Text ---
        if (actionId === 'split_text') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Colonne source</Label>
                        <Input placeholder="Colonne A" />
                    </div>
                    <div className="space-y-2">
                        <Label>Séparateur</Label>
                        <Input placeholder="Virgule, point-virgule, espace..." />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>Détecter automatiquement</Label>
                        <Switch defaultChecked />
                    </div>
                </div>
            );
        }

        // --- Create Form ---
        if (actionId === 'create_form') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex gap-3">
                            <FileText className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">Formulaire lié</h4>
                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                    Créez un formulaire dont les réponses alimenteront automatiquement cette feuille.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Titre du formulaire</Label>
                        <Input placeholder="Mon formulaire" />
                    </div>
                </div>
            );
        }

        // --- Spell Check ---
        if (actionId === 'spell_check') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex gap-3">
                            <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-medium text-green-900 dark:text-green-100">Aucune erreur détectée</h4>
                                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                                    Votre feuille de calcul ne contient pas d'erreurs orthographiques.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs text-gray-500">Langue</Label>
                        <Input defaultValue="Français (France)" />
                    </div>
                </div>
            );
        }

        // --- Personal Dictionary ---
        if (actionId === 'personal_dictionary') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Ajouter un mot</Label>
                        <div className="flex gap-2">
                            <Input placeholder="Nouveau mot..." className="flex-1" />
                            <Button variant="secondary">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-[#1a1a1a] border rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-500">Votre dictionnaire est vide</p>
                    </div>
                </div>
            );
        }

        // --- Auto Complete Settings ---
        if (actionId === 'auto_complete_settings') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                            <div className="text-sm font-medium">Suggestion automatique</div>
                            <div className="text-xs text-gray-500">Proposer des valeurs basées sur le contenu existant</div>
                        </div>
                        <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                            <div className="text-sm font-medium">Compléter les formules</div>
                            <div className="text-xs text-gray-500">Suggérer des fonctions pendant la saisie</div>
                        </div>
                        <Switch defaultChecked />
                    </div>
                </div>
            );
        }

        // --- Conditional Notifications ---
        if (actionId === 'conditional_notifications') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="bg-gray-50 dark:bg-[#1a1a1a] border rounded-lg p-4 text-center">
                        <Activity className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <h4 className="text-sm font-medium">Aucune règle de notification</h4>
                        <p className="text-xs text-gray-500 mt-1">Créez des règles pour être notifié automatiquement.</p>
                    </div>
                    <Button className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter une règle
                    </Button>
                </div>
            );
        }

        // --- Notify Changes ---
        if (actionId === 'notify_changes') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                            <div className="text-sm font-medium">Toutes les modifications</div>
                            <div className="text-xs text-gray-500">Recevoir une notification pour chaque changement</div>
                        </div>
                        <Switch />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                            <div className="text-sm font-medium">Résumé quotidien</div>
                            <div className="text-xs text-gray-500">Un récapitulatif par e-mail chaque jour</div>
                        </div>
                        <Switch defaultChecked />
                    </div>
                </div>
            );
        }

        // --- Accessibility Settings ---
        if (actionId === 'accessibility_settings') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                            <div className="text-sm font-medium">Lecteur d'écran</div>
                            <div className="text-xs text-gray-500">Optimiser pour les lecteurs d'écran</div>
                        </div>
                        <Switch />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                            <div className="text-sm font-medium">Contraste élevé</div>
                            <div className="text-xs text-gray-500">Augmenter le contraste des couleurs</div>
                        </div>
                        <Switch />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                            <div className="text-sm font-medium">Navigation au clavier</div>
                            <div className="text-xs text-gray-500">Améliorer la navigation au clavier</div>
                        </div>
                        <Switch defaultChecked />
                    </div>
                </div>
            );
        }

        // --- Activity Dashboard ---
        if (actionId === 'activity_dashboard') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 border rounded-lg text-center">
                            <div className="text-2xl font-bold text-blue-600">12</div>
                            <div className="text-xs text-gray-500">Modifications aujourd'hui</div>
                        </div>
                        <div className="p-3 border rounded-lg text-center">
                            <div className="text-2xl font-bold text-green-600">3</div>
                            <div className="text-xs text-gray-500">Collaborateurs actifs</div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="text-xs text-gray-500 font-medium">Activité récente</div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm p-2 bg-gray-50 dark:bg-[#1a1a1a] rounded">
                                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 text-xs">V</div>
                                <span>Vous avez modifié la cellule A1</span>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // --- AI Analyze ---
        if (actionId === 'ai_analyze') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                        <div className="flex gap-3">
                            <Cpu className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-medium text-purple-900 dark:text-purple-100">Analyse IA</h4>
                                <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                                    L'IA analysera vos données et fournira des insights.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Plage à analyser</Label>
                        <Input placeholder="A1:Z100 ou sélection actuelle" />
                    </div>
                </div>
            );
        }

        // --- AI Charts ---
        if (actionId === 'ai_charts') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Décrivez le graphique souhaité</Label>
                        <textarea className="w-full h-20 px-3 py-2 border rounded-md text-sm resize-none dark:bg-[#1f1f1f]" placeholder="Ex: Un graphique à barres comparant les ventes par région..." />
                    </div>
                    <div className="space-y-2">
                        <Label>Plage de données</Label>
                        <Input placeholder="A1:D10" />
                    </div>
                </div>
            );
        }

        // --- AI Pivot ---
        if (actionId === 'ai_pivot') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Décrivez l'analyse souhaitée</Label>
                        <textarea className="w-full h-20 px-3 py-2 border rounded-md text-sm resize-none dark:bg-[#1f1f1f]" placeholder="Ex: Somme des ventes par catégorie et par mois..." />
                    </div>
                    <div className="space-y-2">
                        <Label>Plage source</Label>
                        <Input placeholder="A1:F100" />
                    </div>
                </div>
            );
        }

        // --- AI Table ---
        if (actionId === 'ai_table') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Décrivez le tableau souhaité</Label>
                        <textarea className="w-full h-20 px-3 py-2 border rounded-md text-sm resize-none dark:bg-[#1f1f1f]" placeholder="Ex: Un tableau de suivi des dépenses avec date, catégorie, montant..." />
                    </div>
                </div>
            );
        }

        // --- AI Image ---
        if (actionId === 'ai_image') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Décrivez l'image souhaitée</Label>
                        <textarea className="w-full h-20 px-3 py-2 border rounded-md text-sm resize-none dark:bg-[#1f1f1f]" placeholder="Ex: Un logo moderne pour une entreprise de technologie..." />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <Button variant="outline" size="sm">Carré</Button>
                        <Button variant="outline" size="sm">Portrait</Button>
                        <Button variant="outline" size="sm">Paysage</Button>
                    </div>
                </div>
            );
        }

        // --- AI Formula ---
        if (actionId === 'ai_formula') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Que voulez-vous calculer ?</Label>
                        <textarea className="w-full h-20 px-3 py-2 border rounded-md text-sm resize-none dark:bg-[#1f1f1f]" placeholder="Ex: La somme de A1:A10 divisée par le nombre de cellules non vides..." />
                    </div>
                    <div className="bg-gray-50 dark:bg-[#1a1a1a] border rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Formule générée</div>
                        <code className="text-sm font-mono">—</code>
                    </div>
                </div>
            );
        }

        // --- AI Summarize ---
        if (actionId === 'ai_summarize') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Texte à résumer</Label>
                        <Input placeholder="Colonne ou plage contenant le texte" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs text-gray-500">Longueur du résumé</Label>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1">Court</Button>
                            <Button variant="outline" size="sm" className="flex-1">Moyen</Button>
                            <Button variant="outline" size="sm" className="flex-1">Détaillé</Button>
                        </div>
                    </div>
                </div>
            );
        }

        // --- AI Classify ---
        if (actionId === 'ai_classify') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Texte à classer</Label>
                        <Input placeholder="Colonne contenant le texte" />
                    </div>
                    <div className="space-y-2">
                        <Label>Catégories</Label>
                        <Input placeholder="Positif, Négatif, Neutre..." />
                    </div>
                </div>
            );
        }

        // --- AI Sentiment ---
        if (actionId === 'ai_sentiment') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Texte à analyser</Label>
                        <Input placeholder="Colonne contenant le texte" />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>Inclure le score de confiance</Label>
                        <Switch defaultChecked />
                    </div>
                </div>
            );
        }

        // --- AI Generate ---
        if (actionId === 'ai_generate') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Instruction de génération</Label>
                        <textarea className="w-full h-20 px-3 py-2 border rounded-md text-sm resize-none dark:bg-[#1f1f1f]" placeholder="Ex: Générer 10 noms de produits pour une boutique de vêtements..." />
                    </div>
                    <div className="space-y-2">
                        <Label>Cellule de destination</Label>
                        <Input placeholder="A1" />
                    </div>
                </div>
            );
        }

        // --- Record Macro ---
        if (actionId === 'record_macro') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <div className="flex gap-3">
                            <Activity className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-medium text-red-900 dark:text-red-100">Enregistrement de macro</h4>
                                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                    Toutes vos actions seront enregistrées pour créer une macro réutilisable.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Nom de la macro</Label>
                        <Input placeholder="Ma macro" />
                    </div>
                </div>
            );
        }

        // --- Apps Script ---
        if (actionId === 'apps_script') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="bg-gray-50 dark:bg-[#1a1a1a] border rounded-lg p-4 text-center">
                        <Cpu className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <h4 className="text-sm font-medium">Éditeur de scripts</h4>
                        <p className="text-xs text-gray-500 mt-1">Écrivez du code JavaScript pour automatiser vos feuilles.</p>
                    </div>
                    <Button className="w-full">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Ouvrir l'éditeur
                    </Button>
                </div>
            );
        }

        // --- Create App ---
        if (actionId === 'create_app') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex gap-3">
                            <Globe className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">AppSheet</h4>
                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                    Créez une application mobile à partir de vos données.
                                </p>
                            </div>
                        </div>
                    </div>
                    <Button className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Créer l'application
                    </Button>
                </div>
            );
        }

        // --- Help Docs ---
        if (actionId === 'help_docs') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="flex gap-2 relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <Input placeholder="Rechercher dans l'aide..." className="pl-9" />
                    </div>
                    <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                            {['Premiers pas', 'Formules et fonctions', 'Mise en forme', 'Graphiques', 'Partage et collaboration'].map((topic, i) => (
                                <button key={i} className="w-full text-left p-3 border rounded-lg hover:border-blue-500 transition-colors">
                                    <div className="text-sm font-medium">{topic}</div>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            );
        }

        // --- Send Feedback ---
        if (actionId === 'send_feedback') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Type de commentaire</Label>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1">Suggestion</Button>
                            <Button variant="outline" size="sm" className="flex-1">Bug</Button>
                            <Button variant="outline" size="sm" className="flex-1">Autre</Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Votre commentaire</Label>
                        <textarea className="w-full h-24 px-3 py-2 border rounded-md text-sm resize-none dark:bg-[#1f1f1f]" placeholder="Décrivez votre suggestion ou le problème rencontré..." />
                    </div>
                </div>
            );
        }

        // --- Functions List ---
        if (actionId === 'functions_list') {
            const categories = ['Mathématiques', 'Texte', 'Date et heure', 'Logique', 'Recherche', 'Statistiques'];
            return (
                <div className="mt-4 space-y-4">
                    <div className="flex gap-2 relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <Input placeholder="Rechercher une fonction..." className="pl-9" />
                    </div>
                    <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                            {categories.map((cat, i) => (
                                <button key={i} className="w-full text-left p-3 border rounded-lg hover:border-blue-500 transition-colors">
                                    <div className="text-sm font-medium">{cat}</div>
                                    <div className="text-xs text-gray-500 mt-1">12 fonctions</div>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            );
        }

        // --- Keyboard Shortcuts ---
        if (actionId === 'keyboard_shortcuts') {
            const shortcuts = [
                { key: 'Ctrl+C', desc: 'Copier' },
                { key: 'Ctrl+V', desc: 'Coller' },
                { key: 'Ctrl+Z', desc: 'Annuler' },
                { key: 'Ctrl+Y', desc: 'Rétablir' },
                { key: 'Ctrl+B', desc: 'Gras' },
                { key: 'Ctrl+I', desc: 'Italique' },
                { key: 'Ctrl+S', desc: 'Enregistrer' },
                { key: 'F2', desc: 'Modifier la cellule' },
            ];
            return (
                <div className="mt-4">
                    <ScrollArea className="h-[250px]">
                        <div className="space-y-1">
                            {shortcuts.map((s, i) => (
                                <div key={i} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded">
                                    <span className="text-sm">{s.desc}</span>
                                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">{s.key}</kbd>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
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

    const getModalWidth = () => {
        if (actionId === 'version_history') return 'sm:max-w-[900px]';
        if (actionId === 'templates' || actionId === 'add_ons' || actionId === 'extensions') return 'sm:max-w-[600px]';
        return 'sm:max-w-[425px]';
    };

    const getActionButton = () => {
        switch (actionId) {
            case 'page_setup':
            case 'file_settings':
            case 'security_limits':
                return <Button onClick={onClose}>Appliquer</Button>;
            case 'share':
                return <Button onClick={onClose}>Partager</Button>;
            case 'publish_web':
                return <Button onClick={onClose}>Publier</Button>;
            case 'email_send':
                return <Button onClick={onClose}><Mail className="w-4 h-4 mr-2" />Envoyer</Button>;
            case 'name_version':
                return <Button onClick={onClose}>Enregistrer</Button>;
            case 'file_details':
                return <Button onClick={onClose}>Enregistrer</Button>;
            default:
                return null;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={getModalWidth()}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {!['version_history', 'add_ons', 'extensions', 'templates'].includes(actionId) && (
                        <DialogDescription>
                            Configuration et options pour {title.toLowerCase()}.
                        </DialogDescription>
                    )}
                </DialogHeader>

                {renderContent()}

                <DialogFooter className="mt-6 sm:justify-end">
                    <Button variant="outline" onClick={onClose}>Fermer</Button>
                    {getActionButton()}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
