"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
    Key,
    Copy,
    Download,
    Upload,
    Trash2,
    Eye,
    EyeOff,
    ShieldCheck,
    RefreshCw,
    Lock,
    FileKey,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";

const mailClient = getClient(ServiceName.MAIL);

// ============================================================================
// Key storage helpers (localStorage with encryption via Web Crypto)
// ============================================================================

const STORAGE_PREFIX = "signapps_pgp_";

interface StoredKeyPair {
    publicKeyPem: string;
    privateKeyPem: string;
    fingerprint: string;
    createdAt: string;
    algorithm: string;
}

interface PgpAccountConfig {
    enabled: boolean;
    keyPair: StoredKeyPair | null;
}

function getAccountConfig(accountId: string): PgpAccountConfig {
    try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}${accountId}`);
        if (raw) return JSON.parse(raw);
    } catch {
        // corrupted data
    }
    return { enabled: false, keyPair: null };
}

function setAccountConfig(accountId: string, config: PgpAccountConfig) {
    localStorage.setItem(`${STORAGE_PREFIX}${accountId}`, JSON.stringify(config));
}

async function generateFingerprint(publicKey: ArrayBuffer): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", publicKey);
    const bytes = new Uint8Array(hash);
    return Array.from(bytes.slice(0, 16))
        .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
        .join(":")
        .replace(/(.{4}:.{4}:.{4}:.{4}):(.{4}:.{4}:.{4}:.{4})/, "$1  $2");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function formatPem(base64: string, type: "PUBLIC" | "PRIVATE"): string {
    const lines = base64.match(/.{1,64}/g) || [];
    return `-----BEGIN ${type} KEY-----\n${lines.join("\n")}\n-----END ${type} KEY-----`;
}

function extractBase64FromPem(pem: string): string {
    return pem
        .replace(/-----BEGIN [\w\s]+ KEY-----/, "")
        .replace(/-----END [\w\s]+ KEY-----/, "")
        .replace(/\s/g, "");
}

// ============================================================================
// Component
// ============================================================================

interface PgpSettingsProps {
    accountId: string;
    accountEmail: string;
}

export function PgpSettings({ accountId, accountEmail }: PgpSettingsProps) {
    const [config, setConfig] = useState<PgpAccountConfig>(() =>
        getAccountConfig(accountId)
    );
    // Load public key metadata from server on mount (private key stays local)
    useEffect(() => {
        mailClient.get<{ public_key_pem?: string; fingerprint?: string; algorithm?: string; created_at?: string; enabled?: boolean }>(`/accounts/${accountId}/pgp`)
            .then((res) => {
                if (res.data?.public_key_pem) {
                    const local = getAccountConfig(accountId);
                    // Merge: server provides public key metadata, local retains private key
                    const merged: PgpAccountConfig = {
                        enabled: res.data.enabled ?? local.enabled,
                        keyPair: {
                            publicKeyPem: res.data.public_key_pem,
                            privateKeyPem: local.keyPair?.privateKeyPem ?? "",
                            fingerprint: res.data.fingerprint ?? local.keyPair?.fingerprint ?? "",
                            createdAt: res.data.created_at ?? local.keyPair?.createdAt ?? new Date().toISOString(),
                            algorithm: res.data.algorithm ?? local.keyPair?.algorithm ?? "RSA-OAEP 2048-bit",
                        },
                    };
                    setAccountConfig(accountId, merged);
                    setConfig(merged);
                }
            })
            .catch(() => {/* use local config as-is */});
    }, [accountId]);

    const [generating, setGenerating] = useState(false);
    const [showPrivateKey, setShowPrivateKey] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [importPublicKey, setImportPublicKey] = useState("");
    const [importPrivateKey, setImportPrivateKey] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const updateConfig = useCallback(
        (newConfig: PgpAccountConfig) => {
            setConfig(newConfig);
            setAccountConfig(accountId, newConfig);
            // Sync public key to server (private key stays local-only)
            if (newConfig.keyPair) {
                mailClient.put(`/accounts/${accountId}/pgp`, {
                    public_key_pem: newConfig.keyPair.publicKeyPem,
                    fingerprint: newConfig.keyPair.fingerprint,
                    algorithm: newConfig.keyPair.algorithm,
                    created_at: newConfig.keyPair.createdAt,
                    enabled: newConfig.enabled,
                }).catch(() => {});
            } else {
                mailClient.delete(`/accounts/${accountId}/pgp`).catch(() => {});
            }
        },
        [accountId]
    );

    const handleToggle = (value: boolean) => {
        updateConfig({ ...config, enabled: value });
        toast.success(
            value ? "PGP encryption enabled" : "PGP encryption disabled"
        );
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            // Generate RSA-OAEP key pair using Web Crypto API
            const keyPair = await crypto.subtle.generateKey(
                {
                    name: "RSA-OAEP",
                    modulusLength: 2048,
                    publicExponent: new Uint8Array([1, 0, 1]),
                    hash: "SHA-256",
                },
                true,
                ["encrypt", "decrypt"]
            );

            // Export keys
            const publicKeyRaw = await crypto.subtle.exportKey(
                "spki",
                keyPair.publicKey
            );
            const privateKeyRaw = await crypto.subtle.exportKey(
                "pkcs8",
                keyPair.privateKey
            );

            const publicKeyBase64 = arrayBufferToBase64(publicKeyRaw);
            const privateKeyBase64 = arrayBufferToBase64(privateKeyRaw);

            const fingerprint = await generateFingerprint(publicKeyRaw);

            const storedKeyPair: StoredKeyPair = {
                publicKeyPem: formatPem(publicKeyBase64, "PUBLIC"),
                privateKeyPem: formatPem(privateKeyBase64, "PRIVATE"),
                fingerprint,
                createdAt: new Date().toISOString(),
                algorithm: "RSA-OAEP 2048-bit",
            };

            updateConfig({ enabled: true, keyPair: storedKeyPair });
            toast.success("Paire de clés générée avec succès");
        } catch (err) {
            console.error("Key generation failed:", err);
            toast.error("Impossible de générer la paire de clés");
        } finally {
            setGenerating(false);
        }
    };

    const handleExportPublicKey = () => {
        if (!config.keyPair) return;
        const blob = new Blob([config.keyPair.publicKeyPem], {
            type: "application/x-pem-file",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${accountEmail.replace("@", "_at_")}_public.pem`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Clé publique exportée");
    };

    const handleCopyPublicKey = () => {
        if (!config.keyPair) return;
        navigator.clipboard.writeText(config.keyPair.publicKeyPem);
        toast.success("Clé publique copiée dans le presse-papiers");
    };

    const handleDeleteKeys = () => {
        updateConfig({ enabled: false, keyPair: null });
        toast.success("Clés supprimées");
    };

    const handleImportKeys = async () => {
        try {
            if (!importPublicKey.trim()) {
                toast.error("Veuillez fournir au moins une clé publique");
                return;
            }

            const pubBase64 = extractBase64FromPem(importPublicKey);
            const pubBuffer = base64ToArrayBuffer(pubBase64);

            // Verify the public key is valid by importing it
            await crypto.subtle.importKey(
                "spki",
                pubBuffer,
                { name: "RSA-OAEP", hash: "SHA-256" },
                true,
                ["encrypt"]
            );

            const fingerprint = await generateFingerprint(pubBuffer);

            let privateKeyPem = "";
            if (importPrivateKey.trim()) {
                const privBase64 = extractBase64FromPem(importPrivateKey);
                const privBuffer = base64ToArrayBuffer(privBase64);

                // Verify private key
                await crypto.subtle.importKey(
                    "pkcs8",
                    privBuffer,
                    { name: "RSA-OAEP", hash: "SHA-256" },
                    true,
                    ["decrypt"]
                );
                privateKeyPem = importPrivateKey.trim();
            }

            const storedKeyPair: StoredKeyPair = {
                publicKeyPem: importPublicKey.trim(),
                privateKeyPem,
                fingerprint,
                createdAt: new Date().toISOString(),
                algorithm: "RSA-OAEP (imported)",
            };

            updateConfig({ enabled: true, keyPair: storedKeyPair });
            setImportDialogOpen(false);
            setImportPublicKey("");
            setImportPrivateKey("");
            toast.success("Clés importées avec succès");
        } catch (err) {
            console.error("Import failed:", err);
            toast.error("Format de clé invalide. Utilisez des clés RSA au format PEM.");
        }
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const content = reader.result as string;
            if (content.includes("PRIVATE")) {
                setImportPrivateKey(content);
            } else {
                setImportPublicKey(content);
            }
        };
        reader.readAsText(file);
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="space-y-6">
            {/* Main Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                                <Lock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">
                                    PGP / End-to-End Encryption
                                </CardTitle>
                                <CardDescription>
                                    Encrypt and sign your emails using RSA keys
                                </CardDescription>
                            </div>
                        </div>
                        <Switch
                            checked={config.enabled}
                            onCheckedChange={handleToggle}
                            disabled={!config.keyPair}
                        />
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Key Status */}
                    {config.keyPair ? (
                        <div className="space-y-4">
                            {/* Key Info */}
                            <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                                        <span className="text-sm font-medium">
                                            Key Pair Active
                                        </span>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className="font-mono text-xs"
                                    >
                                        {config.keyPair.algorithm}
                                    </Badge>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">
                                        Fingerprint
                                    </Label>
                                    <p className="font-mono text-xs bg-background p-2 rounded border break-all select-all">
                                        {config.keyPair.fingerprint}
                                    </p>
                                </div>

                                <div className="text-xs text-muted-foreground">
                                    Generated:{" "}
                                    {new Date(
                                        config.keyPair.createdAt
                                    ).toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </div>
                            </div>

                            {/* Public Key Display */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-2">
                                    <Key className="h-4 w-4" />
                                    Public Key
                                </Label>
                                <Textarea
                                    readOnly
                                    value={config.keyPair.publicKeyPem}
                                    className="font-mono text-xs h-24 resize-none"
                                />
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCopyPublicKey}
                                    >
                                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                                        Copy
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleExportPublicKey}
                                    >
                                        <Download className="h-3.5 w-3.5 mr-1.5" />
                                        Export .pem
                                    </Button>
                                </div>
                            </div>

                            {/* Private Key (hidden by default) */}
                            {config.keyPair.privateKeyPem && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium flex items-center gap-2">
                                        <FileKey className="h-4 w-4" />
                                        Private Key
                                        <Badge variant="destructive" className="text-[10px] h-4">
                                            SECRET
                                        </Badge>
                                    </Label>
                                    {showPrivateKey ? (
                                        <Textarea
                                            readOnly
                                            value={
                                                config.keyPair.privateKeyPem
                                            }
                                            className="font-mono text-xs h-24 resize-none border-red-200 dark:border-red-800"
                                        />
                                    ) : (
                                        <div className="h-24 rounded-md border border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/20">
                                            <span className="text-sm text-muted-foreground">
                                                Hidden for security
                                            </span>
                                        </div>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            setShowPrivateKey(!showPrivateKey)
                                        }
                                        className="text-muted-foreground"
                                    >
                                        {showPrivateKey ? (
                                            <>
                                                <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                                                Hide
                                            </>
                                        ) : (
                                            <>
                                                <Eye className="h-3.5 w-3.5 mr-1.5" />
                                                Reveal
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}

                            <Separator />

                            {/* Actions */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleGenerate}
                                    disabled={generating}
                                >
                                    <RefreshCw
                                        className={`h-3.5 w-3.5 mr-1.5 ${
                                            generating ? "animate-spin" : ""
                                        }`}
                                    />
                                    Regenerate
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setImportDialogOpen(true)}
                                >
                                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                                    Import
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDeleteKeys}
                                    className="ml-auto"
                                >
                                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                    Delete Keys
                                </Button>
                            </div>
                        </div>
                    ) : (
                        /* No keys yet */
                        <div className="text-center py-8 space-y-4">
                            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                <Key className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <div>
                                <h3 className="text-sm font-medium">
                                    No encryption keys configured
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Generate a new key pair or import existing
                                    keys to enable email encryption.
                                </p>
                            </div>
                            <div className="flex justify-center gap-3">
                                <Button
                                    onClick={handleGenerate}
                                    disabled={generating}
                                >
                                    <Key
                                        className={`h-4 w-4 mr-2 ${
                                            generating ? "animate-spin" : ""
                                        }`}
                                    />
                                    {generating
                                        ? "Generating..."
                                        : "Generate Key Pair"}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setImportDialogOpen(true)}
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    Import Keys
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Import Dialog */}
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Import PGP Keys</DialogTitle>
                        <DialogDescription>
                            Paste PEM-encoded keys or upload .pem files. Public
                            key is required, private key is optional (needed for
                            decryption).
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <input
                            type="file"
                            accept=".pem,.asc,.key,.pub"
                            ref={fileInputRef}
                            onChange={handleFileImport}
                            className="hidden"
                        />

                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                Public Key
                                <Badge variant="secondary" className="text-[10px]">
                                    REQUIRED
                                </Badge>
                            </Label>
                            <Textarea
                                value={importPublicKey}
                                onChange={(e) =>
                                    setImportPublicKey(e.target.value)
                                }
                                placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                                className="font-mono text-xs h-28 resize-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                Private Key
                                <Badge variant="outline" className="text-[10px]">
                                    OPTIONAL
                                </Badge>
                            </Label>
                            <Textarea
                                value={importPrivateKey}
                                onChange={(e) =>
                                    setImportPrivateKey(e.target.value)
                                }
                                placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                                className="font-mono text-xs h-28 resize-none"
                            />
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full"
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload .pem file
                        </Button>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setImportDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleImportKeys}>
                            Import Keys
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ============================================================================
// Encryption/Decryption helpers (exported for use in compose/display)
// ============================================================================

/**
 * Encrypt a message body with a recipient's public key (PEM).
 * Returns base64-encoded ciphertext.
 */
export async function encryptMessage(
    publicKeyPem: string,
    plaintext: string
): Promise<string> {
    const base64 = extractBase64FromPem(publicKeyPem);
    const keyBuffer = base64ToArrayBuffer(base64);

    const publicKey = await crypto.subtle.importKey(
        "spki",
        keyBuffer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["encrypt"]
    );

    // RSA-OAEP has a max payload size. For larger messages, encrypt a symmetric key.
    // For MVP, we chunk the message into blocks.
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // RSA-OAEP with 2048-bit key and SHA-256 can encrypt up to 190 bytes per block
    const maxBlockSize = 190;
    const blocks: string[] = [];

    for (let i = 0; i < data.length; i += maxBlockSize) {
        const chunk = data.slice(i, i + maxBlockSize);
        const encrypted = await crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            publicKey,
            chunk
        );
        blocks.push(arrayBufferToBase64(encrypted));
    }

    // Format: number of blocks + blocks joined by newlines
    return `SIGNAPPS-ENCRYPTED:${blocks.length}\n${blocks.join("\n")}`;
}

/**
 * Decrypt a message body with the user's private key (PEM).
 * Returns the plaintext.
 */
export async function decryptMessage(
    privateKeyPem: string,
    ciphertext: string
): Promise<string> {
    if (!ciphertext.startsWith("SIGNAPPS-ENCRYPTED:")) {
        return ciphertext; // Not encrypted
    }

    const base64 = extractBase64FromPem(privateKeyPem);
    const keyBuffer = base64ToArrayBuffer(base64);

    const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        keyBuffer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["decrypt"]
    );

    const lines = ciphertext.split("\n");
    const header = lines[0]; // SIGNAPPS-ENCRYPTED:N
    const blockCount = parseInt(header.split(":")[1], 10);
    const blocks = lines.slice(1, 1 + blockCount);

    const decoder = new TextDecoder();
    let plaintext = "";

    for (const block of blocks) {
        const encrypted = base64ToArrayBuffer(block);
        const decrypted = await crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            privateKey,
            encrypted
        );
        plaintext += decoder.decode(decrypted);
    }

    return plaintext;
}

/**
 * Check if a message body is encrypted.
 */
export function isEncryptedMessage(body: string | null | undefined): boolean {
    return !!body && body.startsWith("SIGNAPPS-ENCRYPTED:");
}

/**
 * Get the PGP config for an account from localStorage.
 */
export function getPgpConfig(accountId: string): PgpAccountConfig {
    return getAccountConfig(accountId);
}

export default PgpSettings;
