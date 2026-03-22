"use client";

import { useState, useCallback, useRef } from "react";
import { Plus, Save, X, Eye, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface EmailTemplate {
    id: string;
    name: string;
    content: string;
    createdAt: Date;
}

const TEMPLATE_VARIABLES = [
    { name: "prenom", label: "Prénom" },
    { name: "entreprise", label: "Entreprise" },
    { name: "date", label: "Date" },
];

const SAMPLE_DATA: Record<string, string> = {
    prenom: "Jean",
    entreprise: "Acme Corp",
    date: new Date().toLocaleDateString("fr-FR"),
};

export function EmailTemplateEditor() {
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [templateName, setTemplateName] = useState("");
    const [templateContent, setTemplateContent] = useState("");
    const [previewContent, setPreviewContent] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const insertVariable = (variable: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = templateContent.substring(0, start);
        const after = templateContent.substring(end);
        const newContent = `${before}{${variable}}${after}`;

        setTemplateContent(newContent);
        setTimeout(() => {
            textarea.focus();
            textarea.selectionStart = start + variable.length + 2;
            textarea.selectionEnd = start + variable.length + 2;
        }, 0);
    };

    const renderPreview = (content: string): string => {
        let preview = content;
        Object.entries(SAMPLE_DATA).forEach(([key, value]) => {
            preview = preview.replace(new RegExp(`\\{${key}\\}`, "g"), value);
        });
        return preview;
    };

    const handlePreview = () => {
        setPreviewContent(renderPreview(templateContent));
        setIsPreviewOpen(true);
    };

    const handleSave = useCallback(() => {
        if (!templateName.trim() || !templateContent.trim()) {
            toast.error("Veuillez remplir le nom et le contenu du modèle");
            return;
        }

        if (editingId) {
            setTemplates((prev) =>
                prev.map((t) =>
                    t.id === editingId
                        ? { ...t, name: templateName, content: templateContent }
                        : t
                )
            );
            toast.success("Modèle mis à jour");
        } else {
            const newTemplate: EmailTemplate = {
                id: `template-${Date.now()}`,
                name: templateName,
                content: templateContent,
                createdAt: new Date(),
            };
            setTemplates((prev) => [newTemplate, ...prev]);
            toast.success("Modèle enregistré");
        }

        setTemplateName("");
        setTemplateContent("");
        setEditingId(null);
        setIsDialogOpen(false);
    }, [templateName, templateContent, editingId]);

    const handleEdit = (template: EmailTemplate) => {
        setTemplateName(template.name);
        setTemplateContent(template.content);
        setEditingId(template.id);
        setIsDialogOpen(true);
    };

    const handleDelete = (id: string) => {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        toast.success("Modèle supprimé");
    };

    const handleCancel = () => {
        setTemplateName("");
        setTemplateContent("");
        setEditingId(null);
        setIsDialogOpen(false);
    };

    const handleCopyTemplate = (content: string) => {
        navigator.clipboard.writeText(content);
        toast.success("Modèle copié au presse-papiers");
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Modèles Email</h2>
                <Button
                    onClick={() => setIsDialogOpen(true)}
                    className="gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Nouveau modèle
                </Button>
            </div>

            {/* Template List */}
            <div className="space-y-2">
                {templates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Aucun modèle. Créez-en un pour commencer.
                    </p>
                ) : (
                    templates.map((template) => (
                        <div
                            key={template.id}
                            className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                        >
                            <div className="flex-1">
                                <p className="font-medium">{template.name}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                    {template.content}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        handleCopyTemplate(template.content)
                                    }
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(template)}
                                >
                                    Éditer
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(template.id)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Editor Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingId ? "Modifier le modèle" : "Créer un modèle"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Template Name */}
                        <div>
                            <Label htmlFor="template-name">Nom du modèle</Label>
                            <Input
                                id="template-name"
                                value={templateName}
                                onChange={(e) =>
                                    setTemplateName(e.target.value)
                                }
                                placeholder="Ex: Bienvenue client"
                                className="mt-1"
                            />
                        </div>

                        {/* Variable Buttons */}
                        <div>
                            <Label>Variables disponibles</Label>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {TEMPLATE_VARIABLES.map((variable) => (
                                    <Button
                                        key={variable.name}
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            insertVariable(variable.name)
                                        }
                                    >
                                        {variable.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Template Content */}
                        <div>
                            <Label htmlFor="template-content">
                                Contenu du modèle
                            </Label>
                            <textarea
                                ref={textareaRef}
                                id="template-content"
                                value={templateContent}
                                onChange={(e) =>
                                    setTemplateContent(e.target.value)
                                }
                                placeholder="Entrez le contenu de votre modèle..."
                                className="w-full h-40 mt-1 p-3 border rounded-md font-mono text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between gap-2">
                            <Button
                                variant="outline"
                                onClick={handlePreview}
                            >
                                <Eye className="h-4 w-4 mr-2" />
                                Aperçu
                            </Button>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={handleCancel}
                                >
                                    Annuler
                                </Button>
                                <Button onClick={handleSave}>
                                    <Save className="h-4 w-4 mr-2" />
                                    Enregistrer
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Preview Dialog */}
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Aperçu du modèle</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Données d&apos;exemple utilisées :
                        </p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            {Object.entries(SAMPLE_DATA).map(([key, value]) => (
                                <div key={key} className="p-2 bg-muted rounded">
                                    <p className="font-medium">{key}</p>
                                    <p className="text-muted-foreground">
                                        {value}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-muted rounded-lg border whitespace-pre-wrap break-words text-sm">
                            {previewContent}
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => handleCopyTemplate(previewContent)}
                            className="w-full"
                        >
                            <Copy className="h-4 w-4 mr-2" />
                            Copier le rendu
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default EmailTemplateEditor;
