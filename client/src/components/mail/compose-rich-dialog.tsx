"use client";

import { useState, useCallback } from "react";
import { X, Minimize2, Maximize2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailComposer } from "./email-editor";
import { mailApi } from "@/lib/api-mail";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ComposeEncryptToggle } from "./pgp-indicator";
import { encryptMessage } from "./pgp-settings";

interface ComposeRichDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    accountId?: string;
    replyTo?: {
        email: string;
        subject: string;
    };
}

export function ComposeRichDialog({
    open,
    onOpenChange,
    accountId,
    replyTo,
}: ComposeRichDialogProps) {
    const [recipient, setRecipient] = useState(replyTo?.email || "");
    const [cc, setCc] = useState("");
    const [bcc, setBcc] = useState("");
    const [subject, setSubject] = useState(
        replyTo?.subject ? `Re: ${replyTo.subject}` : ""
    );
    const [showCcBcc, setShowCcBcc] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [encryptEnabled, setEncryptEnabled] = useState(false);
    const [recipientPublicKey, setRecipientPublicKey] = useState("");

    const handleSave = useCallback(
        async (html: string, design: object) => {
            if (!accountId) {
                toast.error("Select a mail account first");
                return;
            }
            try {
                await mailApi.send({
                    account_id: accountId,
                    recipient: recipient.trim(),
                    subject: subject.trim() || "(Sans objet)",
                    body_html: html,
                    // Store design as JSON for future editing
                    metadata: JSON.stringify({ design }),
                });
                toast.success("Brouillon enregistré");
            } catch {
                toast.error("Erreur lors de l'enregistrement");
            }
        },
        [accountId, recipient, subject]
    );

    const handleSend = useCallback(
        async (html: string, _design: object) => {
            if (!recipient.trim()) {
                toast.error("Veuillez saisir un destinataire");
                return;
            }

            if (!accountId) {
                toast.error("Select a mail account first");
                return;
            }
            setIsSending(true);
            try {
                let bodyHtml = html;

                // Encrypt if enabled and recipient key is provided
                if (encryptEnabled && recipientPublicKey.trim()) {
                    try {
                        bodyHtml = await encryptMessage(recipientPublicKey, html);
                    } catch {
                        toast.error("Encryption failed. Check recipient's public key.");
                        setIsSending(false);
                        return;
                    }
                } else if (encryptEnabled && !recipientPublicKey.trim()) {
                    toast.error("Please provide the recipient's public key to encrypt.");
                    setIsSending(false);
                    return;
                }

                await mailApi.send({
                    account_id: accountId,
                    recipient: recipient.trim(),
                    cc: cc.trim() || undefined,
                    bcc: bcc.trim() || undefined,
                    subject: subject.trim() || "(Sans objet)",
                    body_html: bodyHtml,
                });
                toast.success(encryptEnabled ? "Encrypted email sent!" : "Email envoyé !");
                handleReset();
                onOpenChange(false);
            } catch {
                toast.error("Erreur lors de l'envoi");
            } finally {
                setIsSending(false);
            }
        },
        [accountId, recipient, cc, bcc, subject, onOpenChange, encryptEnabled, recipientPublicKey]
    );

    const handleReset = () => {
        setRecipient("");
        setCc("");
        setBcc("");
        setSubject("");
        setShowCcBcc(false);
        setEncryptEnabled(false);
        setRecipientPublicKey("");
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!v) handleReset();
                onOpenChange(v);
            }}
        >
            <DialogContent
                className={cn(
                    "p-0 gap-0 overflow-hidden",
                    isFullscreen
                        ? "w-screen h-screen max-w-none max-h-none rounded-none"
                        : "max-w-4xl h-[85vh]"
                )}
            >
                <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between space-y-0">
                    <DialogTitle className="text-lg font-semibold">
                        Nouveau message
                    </DialogTitle>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                        >
                            {isFullscreen ? (
                                <Minimize2 className="h-4 w-4" />
                            ) : (
                                <Maximize2 className="h-4 w-4" />
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onOpenChange(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex flex-col h-full overflow-hidden">
                    {/* Email fields */}
                    <div className="px-4 py-2 space-y-2 border-b bg-muted/30">
                        <div className="flex items-center gap-2">
                            <Label className="w-12 text-sm text-muted-foreground">
                                À
                            </Label>
                            <Input
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                placeholder="destinataire@exemple.com"
                                className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-0"
                            />
                            {!showCcBcc && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-muted-foreground"
                                    onClick={() => setShowCcBcc(true)}
                                >
                                    Cc/Cci
                                </Button>
                            )}
                        </div>

                        {showCcBcc && (
                            <>
                                <div className="flex items-center gap-2">
                                    <Label className="w-12 text-sm text-muted-foreground">
                                        Cc
                                    </Label>
                                    <Input
                                        value={cc}
                                        onChange={(e) => setCc(e.target.value)}
                                        placeholder="copie@exemple.com"
                                        className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-0"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label className="w-12 text-sm text-muted-foreground">
                                        Cci
                                    </Label>
                                    <Input
                                        value={bcc}
                                        onChange={(e) => setBcc(e.target.value)}
                                        placeholder="copie-cachee@exemple.com"
                                        className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-0"
                                    />
                                </div>
                            </>
                        )}

                        <div className="flex items-center gap-2">
                            <Label className="w-12 text-sm text-muted-foreground">
                                Objet
                            </Label>
                            <Input
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Objet de l'email"
                                className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-0"
                            />
                        </div>

                        {/* PGP Encryption Toggle */}
                        <ComposeEncryptToggle
                            accountId={accountId ?? ""}
                            enabled={encryptEnabled}
                            onToggle={setEncryptEnabled}
                            recipientPublicKey={recipientPublicKey}
                            onRecipientKeyChange={setRecipientPublicKey}
                        />
                    </div>

                    {/* Email Editor */}
                    <div className="flex-1 overflow-hidden">
                        <EmailComposer
                            onSave={handleSave}
                            onSend={handleSend}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default ComposeRichDialog;
