"use client";

import { useState, useEffect } from "react";
import {
  Key,
  FileText,
  CreditCard,
  Terminal,
  Code,
  User,
  Shield,
  Eye,
  EyeOff,
  Copy,
  Wand2,
  Plus,
  Trash2,
  Star,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useVaultStore } from "@/stores/vault-store";
import { TotpDisplay } from "@/components/vault/totp-display";
import { PasswordGenerator } from "@/components/vault/password-generator";
import { evaluatePasswordStrength } from "@/lib/vault-crypto";
import type { DecryptedVaultItem, VaultItemType } from "@/types/vault";

// ─────────────────────────────────────────────────────────────────────────────
// Type metadata
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_META: Record<
  VaultItemType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  login: { label: "Identifiants", icon: Key },
  secure_note: { label: "Note sécurisée", icon: FileText },
  card: { label: "Carte bancaire", icon: CreditCard },
  ssh_key: { label: "Clé SSH", icon: Terminal },
  api_token: { label: "Jeton API", icon: Code },
  identity: { label: "Identité", icon: User },
  passkey: { label: "Passkey", icon: Shield },
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface VaultItemFormProps {
  open: boolean;
  itemType: VaultItemType;
  item?: DecryptedVaultItem;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Password field with show/hide, copy, generate
// ─────────────────────────────────────────────────────────────────────────────

function PasswordField({
  value,
  onChange,
  label = "Mot de passe",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const [show, setShow] = useState(false);
  const { score, label: strengthLabel } = evaluatePasswordStrength(value);

  const strengthColors = [
    "bg-transparent",
    "bg-red-500",
    "bg-amber-500",
    "bg-blue-500",
    "bg-emerald-500",
  ];
  const strengthColor = strengthColors[score] || "bg-transparent";

  const copyPassword = () => {
    if (!value) return;
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success("Mot de passe copié"));
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="pr-8 font-mono"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {show ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Copy */}
        <Button
          variant="outline"
          size="icon"
          type="button"
          onClick={copyPassword}
          title="Copier"
          aria-label="Copier"
        >
          <Copy className="h-4 w-4" />
        </Button>

        {/* Generator popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              type="button"
              title="Générer"
              aria-label="Générer"
            >
              <Wand2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <PasswordGenerator onUse={onChange} />
          </PopoverContent>
        </Popover>
      </div>

      {/* Strength bar */}
      {value && (
        <div className="space-y-0.5">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  "flex-1 h-1 rounded-full transition-colors",
                  i <= score ? strengthColor : "bg-muted",
                )}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground capitalize">
            {strengthLabel}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function VaultItemForm({
  open,
  itemType,
  item,
  onClose,
}: VaultItemFormProps) {
  const { createItem, updateItem, loading } = useVaultStore();
  const meta = TYPE_META[itemType];
  const Icon = meta.icon;
  const isEdit = !!item;

  // ── Common fields ──────────────────────────────────────────────────────────
  const [name, setName] = useState(item?.name || "");
  const [notes, setNotes] = useState(item?.notes || "");
  const [favorite, setFavorite] = useState(item?.favorite || false);
  const [reprompt, setReprompt] = useState(item?.reprompt || false);
  const [totpSecret, setTotpSecret] = useState(item?.totp_secret || "");
  const [uri, setUri] = useState(item?.uri || "");

  // ── Login fields ───────────────────────────────────────────────────────────
  const [loginUsername, setLoginUsername] = useState(
    (item?.data as Record<string, string>)?.username || "",
  );
  const [loginPassword, setLoginPassword] = useState(
    (item?.data as Record<string, string>)?.password || "",
  );
  const [uris, setUris] = useState<string[]>(
    (item?.data as Record<string, string[]>)?.uris ||
      (item?.uri ? [item.uri] : [""]),
  );

  // ── Card fields ────────────────────────────────────────────────────────────
  const [cardHolder, setCardHolder] = useState(
    (item?.data as Record<string, string>)?.cardholder || "",
  );
  const [cardNumber, setCardNumber] = useState(
    (item?.data as Record<string, string>)?.number || "",
  );
  const [cardExpiry, setCardExpiry] = useState(
    (item?.data as Record<string, string>)?.expiry || "",
  );
  const [cardCvv, setCardCvv] = useState(
    (item?.data as Record<string, string>)?.cvv || "",
  );
  const [showCardNumber, setShowCardNumber] = useState(false);
  const [showCvv, setShowCvv] = useState(false);

  // ── SSH key fields ─────────────────────────────────────────────────────────
  const [sshPrivateKey, setSshPrivateKey] = useState(
    (item?.data as Record<string, string>)?.private_key || "",
  );
  const [sshPublicKey, setSshPublicKey] = useState(
    (item?.data as Record<string, string>)?.public_key || "",
  );
  const [sshPassphrase, setSshPassphrase] = useState(
    (item?.data as Record<string, string>)?.passphrase || "",
  );

  // ── API token fields ───────────────────────────────────────────────────────
  const [apiToken, setApiToken] = useState(
    (item?.data as Record<string, string>)?.token || "",
  );
  const [apiEndpoint, setApiEndpoint] = useState(
    (item?.data as Record<string, string>)?.endpoint || "",
  );

  // ── Identity fields ────────────────────────────────────────────────────────
  const [idFirstName, setIdFirstName] = useState(
    (item?.data as Record<string, string>)?.first_name || "",
  );
  const [idLastName, setIdLastName] = useState(
    (item?.data as Record<string, string>)?.last_name || "",
  );
  const [idEmail, setIdEmail] = useState(
    (item?.data as Record<string, string>)?.email || "",
  );
  const [idPhone, setIdPhone] = useState(
    (item?.data as Record<string, string>)?.phone || "",
  );
  const [idAddress, setIdAddress] = useState(
    (item?.data as Record<string, string>)?.address || "",
  );
  const [idNumber, setIdNumber] = useState(
    (item?.data as Record<string, string>)?.id_number || "",
  );

  // ── Secure note ────────────────────────────────────────────────────────────
  const [noteContent, setNoteContent] = useState(
    (item?.data as Record<string, string>)?.content || "",
  );

  // ── Passkey (read-only) ────────────────────────────────────────────────────
  const [pkRelyingParty] = useState(
    (item?.data as Record<string, string>)?.relying_party || "",
  );
  const [pkCredentialId] = useState(
    (item?.data as Record<string, string>)?.credential_id || "",
  );
  const [pkPublicKey] = useState(
    (item?.data as Record<string, string>)?.public_key || "",
  );

  // ── Submit ─────────────────────────────────────────────────────────────────

  const buildData = (): Record<string, unknown> => {
    switch (itemType) {
      case "login":
        return { username: loginUsername, password: loginPassword, uris };
      case "secure_note":
        return { content: noteContent };
      case "card":
        return {
          cardholder: cardHolder,
          number: cardNumber,
          expiry: cardExpiry,
          cvv: cardCvv,
        };
      case "ssh_key":
        return {
          private_key: sshPrivateKey,
          public_key: sshPublicKey,
          passphrase: sshPassphrase,
        };
      case "api_token":
        return { token: apiToken, endpoint: apiEndpoint };
      case "identity":
        return {
          first_name: idFirstName,
          last_name: idLastName,
          email: idEmail,
          phone: idPhone,
          address: idAddress,
          id_number: idNumber,
        };
      case "passkey":
        return {
          relying_party: pkRelyingParty,
          credential_id: pkCredentialId,
          public_key: pkPublicKey,
        };
      default:
        return {};
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }

    const data = buildData();
    const opts = {
      notes: notes || undefined,
      totp_secret: totpSecret || undefined,
      uri: itemType === "login" ? uris.filter(Boolean)[0] : uri || undefined,
      favorite,
      reprompt,
    };

    try {
      if (isEdit && item) {
        await updateItem(item.id, name, data, opts);
        toast.success("Élément mis à jour");
      } else {
        await createItem(itemType, name, data, opts);
        toast.success("Élément créé");
      }
      onClose();
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-emerald-500" />
            {isEdit ? `Modifier : ${item.name}` : `Nouveau ${meta.label}`}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Modifiez les champs et enregistrez."
              : "Renseignez les informations et enregistrez."}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <form
            id="vault-item-form"
            onSubmit={handleSubmit}
            className="px-6 py-4 space-y-4"
          >
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="item-name">Nom *</Label>
              <Input
                id="item-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Ex. : ${itemType === "login" ? "GitHub" : meta.label}`}
                required
              />
            </div>

            <Separator />

            {/* ── Login ── */}
            {itemType === "login" && (
              <>
                <div className="space-y-1.5">
                  <Label>Identifiant</Label>
                  <Input
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="user@exemple.com"
                    autoComplete="off"
                  />
                </div>
                <PasswordField
                  value={loginPassword}
                  onChange={setLoginPassword}
                />
                {/* URIs */}
                <div className="space-y-1.5">
                  <Label>URL(s)</Label>
                  {uris.map((u, i) => (
                    <div key={i} className="flex gap-1.5">
                      <Input
                        value={u}
                        onChange={(e) => {
                          const next = [...uris];
                          next[i] = e.target.value;
                          setUris(next);
                        }}
                        placeholder="https://exemple.com"
                      />
                      {uris.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() =>
                            setUris(uris.filter((_, j) => j !== i))
                          }
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="gap-1.5 text-xs"
                    onClick={() => setUris([...uris, ""])}
                  >
                    <Plus className="h-3.5 w-3.5" /> Ajouter une URL
                  </Button>
                </div>
                {/* TOTP */}
                <div className="space-y-1.5">
                  <Label>Clé TOTP (optionnel)</Label>
                  <Input
                    value={totpSecret}
                    onChange={(e) => setTotpSecret(e.target.value)}
                    placeholder="JBSWY3DPEHPK3PXP"
                    className="font-mono"
                  />
                  {totpSecret && (
                    <TotpDisplay totpSecret={totpSecret} className="pt-1" />
                  )}
                </div>
              </>
            )}

            {/* ── Secure note ── */}
            {itemType === "secure_note" && (
              <div className="space-y-1.5">
                <Label>Contenu</Label>
                <Textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Contenu de la note…"
                  rows={8}
                  className="resize-y font-mono text-sm"
                />
              </div>
            )}

            {/* ── Card ── */}
            {itemType === "card" && (
              <>
                <div className="space-y-1.5">
                  <Label>Titulaire</Label>
                  <Input
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    placeholder="Jean Dupont"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Numéro</Label>
                  <div className="relative">
                    <Input
                      type={showCardNumber ? "text" : "password"}
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="4111 1111 1111 1111"
                      className="font-mono pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCardNumber((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showCardNumber ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Expiration (MM/AA)</Label>
                    <Input
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="12/27"
                      maxLength={5}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CVV</Label>
                    <div className="relative">
                      <Input
                        type={showCvv ? "text" : "password"}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        placeholder="•••"
                        className="font-mono pr-8"
                        maxLength={4}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCvv((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showCvv ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── SSH key ── */}
            {itemType === "ssh_key" && (
              <>
                <div className="space-y-1.5">
                  <Label>Clé privée</Label>
                  <Textarea
                    value={sshPrivateKey}
                    onChange={(e) => setSshPrivateKey(e.target.value)}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                    rows={6}
                    className="font-mono text-xs resize-y"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Clé publique</Label>
                  <Textarea
                    value={sshPublicKey}
                    onChange={(e) => setSshPublicKey(e.target.value)}
                    placeholder="ssh-ed25519 AAAA…"
                    rows={3}
                    className="font-mono text-xs resize-y"
                  />
                </div>
                <PasswordField
                  value={sshPassphrase}
                  onChange={setSshPassphrase}
                  label="Phrase secrète (optionnel)"
                />
              </>
            )}

            {/* ── API token ── */}
            {itemType === "api_token" && (
              <>
                <PasswordField
                  value={apiToken}
                  onChange={setApiToken}
                  label="Jeton"
                />
                <div className="space-y-1.5">
                  <Label>URL de l&apos;API (optionnel)</Label>
                  <Input
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                    placeholder="https://api.exemple.com"
                  />
                </div>
              </>
            )}

            {/* ── Identity ── */}
            {itemType === "identity" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Prénom</Label>
                    <Input
                      value={idFirstName}
                      onChange={(e) => setIdFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nom</Label>
                    <Input
                      value={idLastName}
                      onChange={(e) => setIdLastName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={idEmail}
                    onChange={(e) => setIdEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Téléphone</Label>
                  <Input
                    type="tel"
                    value={idPhone}
                    onChange={(e) => setIdPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Adresse</Label>
                  <Textarea
                    value={idAddress}
                    onChange={(e) => setIdAddress(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>N° de pièce d&apos;identité</Label>
                  <Input
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* ── Passkey (read-only) ── */}
            {itemType === "passkey" && (
              <>
                <div className="space-y-1.5">
                  <Label>Partie relying</Label>
                  <Input
                    value={pkRelyingParty}
                    readOnly
                    className="bg-muted font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>ID de credential</Label>
                  <Input
                    value={pkCredentialId}
                    readOnly
                    className="bg-muted font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Clé publique</Label>
                  <Textarea
                    value={pkPublicKey}
                    readOnly
                    rows={3}
                    className="bg-muted font-mono text-xs resize-none"
                  />
                </div>
              </>
            )}

            {/* ── Notes (shared) ── */}
            {itemType !== "secure_note" && (
              <div className="space-y-1.5">
                <Label>Notes (optionnel)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Remarques…"
                  rows={3}
                  className="resize-y"
                />
              </div>
            )}

            <Separator />

            {/* ── Options ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label
                    htmlFor="favorite-toggle"
                    className="text-sm font-medium"
                  >
                    Favori
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Épingler dans les favoris
                  </p>
                </div>
                <Switch
                  id="favorite-toggle"
                  checked={favorite}
                  onCheckedChange={setFavorite}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label
                    htmlFor="reprompt-toggle"
                    className="text-sm font-medium"
                  >
                    Reprompt
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Demander le MDP maître avant d'afficher
                  </p>
                </div>
                <Switch
                  id="reprompt-toggle"
                  checked={reprompt}
                  onCheckedChange={setReprompt}
                />
              </div>
            </div>
          </form>
        </ScrollArea>

        <SheetFooter className="px-6 py-4 border-t border-border gap-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="submit"
            form="vault-item-form"
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? "Enregistrement…" : isEdit ? "Mettre à jour" : "Créer"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
