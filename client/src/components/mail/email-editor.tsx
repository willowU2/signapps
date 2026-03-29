"use client";

import { SpinnerInfinity } from 'spinners-react';

import React, { useRef, useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import type EmailEditorType from "react-email-editor";
import type { EditorRef, EmailEditorProps } from "react-email-editor";
import { Button } from "@/components/ui/button";
import { Save, Send, Eye, Code } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

// Dynamic import to avoid SSR issues
const EmailEditor = dynamic(() => import("react-email-editor"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full min-h-[500px]">
            <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8  text-muted-foreground" />
        </div>
    ),
});

interface EmailComposerProps {
    initialDesign?: object;
    onSave?: (html: string, design: object) => void;
    onSend?: (html: string, design: object) => void;
    readOnly?: boolean;
}

export function EmailComposer({
    initialDesign,
    onSave,
    onSend,
    readOnly = false,
}: EmailComposerProps) {
    const emailEditorRef = useRef<EditorRef>(null);
    const [mounted, setMounted] = useState(false);
    const [editorReady, setEditorReady] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewHtml, setPreviewHtml] = useState("");
    const [sourceOpen, setSourceOpen] = useState(false);
    const [sourceHtml, setSourceHtml] = useState("");

    useEffect(() => {
        setMounted(true);
    }, []);

    const onReady: EmailEditorProps["onReady"] = useCallback(() => {
        setEditorReady(true);
        // Load initial design if provided
        if (initialDesign && emailEditorRef.current?.editor) {
            emailEditorRef.current.editor.loadDesign(initialDesign);
        }
    }, [initialDesign]);

    const handleSave = useCallback(() => {
        if (!emailEditorRef.current?.editor) return;

        emailEditorRef.current.editor.exportHtml((data: { html: string; design: any }) => {
            const { html, design } = data;
            onSave?.(html, design);
        });
    }, [onSave]);

    const handleSend = useCallback(() => {
        if (!emailEditorRef.current?.editor) return;

        emailEditorRef.current.editor.exportHtml((data: { html: string; design: any }) => {
            const { html, design } = data;
            onSend?.(html, design);
        });
    }, [onSend]);

    const handlePreview = useCallback(() => {
        if (!emailEditorRef.current?.editor) return;

        emailEditorRef.current.editor.exportHtml((data: { html: string; design: any }) => {
            setPreviewHtml(data.html);
            setPreviewOpen(true);
        });
    }, []);

    const handleViewSource = useCallback(() => {
        if (!emailEditorRef.current?.editor) return;

        emailEditorRef.current.editor.exportHtml((data: { html: string; design: any }) => {
            setSourceHtml(data.html);
            setSourceOpen(true);
        });
    }, []);

    if (!mounted) {
        return (
            <div className="flex items-center justify-center h-full min-h-[500px]">
                <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8  text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 border-b bg-background">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePreview}
                        disabled={!editorReady}
                    >
                        <Eye className="h-4 w-4 mr-2" />
                        Aperçu
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleViewSource}
                        disabled={!editorReady}
                    >
                        <Code className="h-4 w-4 mr-2" />
                        HTML
                    </Button>
                </div>
                <div className="flex items-center gap-2">
                    {onSave && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSave}
                            disabled={!editorReady}
                        >
                            <Save className="h-4 w-4 mr-2" />
                            Enregistrer
                        </Button>
                    )}
                    {onSend && (
                        <Button
                            size="sm"
                            onClick={handleSend}
                            disabled={!editorReady}
                            className="bg-primary"
                        >
                            <Send className="h-4 w-4 mr-2" />
                            Envoyer
                        </Button>
                    )}
                </div>
            </div>

            {/* Editor */}
            <div className="flex-1 min-h-[500px]">
                <EmailEditor
                    ref={emailEditorRef}
                    onReady={onReady}
                    minHeight="100%"
                    options={{
                        locale: "fr-FR",
                        appearance: {
                            theme: "modern_light",
                        },
                        features: {
                            stockImages: {
                                enabled: false,
                            },
                            userUploads: true,
                            textEditor: {
                                tables: true,
                                emojis: true,
                            },
                        },
                        tools: {
                            image: {
                                enabled: true,
                            },
                            button: {
                                enabled: true,
                            },
                            divider: {
                                enabled: true,
                            },
                            heading: {
                                enabled: true,
                            },
                            html: {
                                enabled: true,
                            },
                            menu: {
                                enabled: true,
                            },
                            social: {
                                enabled: true,
                            },
                            text: {
                                enabled: true,
                            },
                            timer: {
                                enabled: true,
                            },
                            video: {
                                enabled: true,
                            },
                        },
                        displayMode: readOnly ? "web" : "email",
                    }}
                />
            </div>

            {/* Preview Dialog */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>Aperçu de l&apos;email</DialogTitle>
                    </DialogHeader>
                    <div className="overflow-auto max-h-[70vh] border rounded-lg bg-card">
                        <iframe
                            srcDoc={previewHtml}
                            title="Email Preview"
                            className="w-full min-h-[500px] border-0"
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Source Dialog */}
            <Dialog open={sourceOpen} onOpenChange={setSourceOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>Code HTML</DialogTitle>
                    </DialogHeader>
                    <div className="overflow-auto max-h-[70vh]">
                        <pre className="p-4 bg-muted rounded-lg text-xs overflow-auto">
                            <code>{sourceHtml}</code>
                        </pre>
                    </div>
                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                navigator.clipboard.writeText(sourceHtml);
                            }}
                        >
                            Copier
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default EmailComposer;
