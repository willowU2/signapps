"use client";

import { useState, useCallback } from "react";
import { RefreshCw, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { generatePassword, evaluatePasswordStrength } from "@/lib/vault-crypto";

interface PasswordGeneratorProps {
  /** Appelé quand l'utilisateur clique sur "Utiliser" */
  onUse?: (password: string) => void;
  className?: string;
}

const STRENGTH_CONFIG = {
  faible: { label: "Faible", color: "bg-red-500", width: "w-1/4" },
  correct: { label: "Correct", color: "bg-amber-500", width: "w-2/4" },
  fort: { label: "Fort", color: "bg-blue-500", width: "w-3/4" },
  excellent: { label: "Excellent", color: "bg-emerald-500", width: "w-full" },
};

export function PasswordGenerator({
  onUse,
  className,
}: PasswordGeneratorProps) {
  const [length, setLength] = useState(16);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(false);
  const [password, setPassword] = useState(() =>
    generatePassword({
      length: 16,
      upper: true,
      lower: true,
      digits: true,
      symbols: false,
    }),
  );
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(() => {
    const next = generatePassword({ length, upper, lower, digits, symbols });
    setPassword(next);
    setCopied(false);
  }, [length, upper, lower, digits, symbols]);

  const handleCopy = () => {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      toast.success("Mot de passe copié");
      setTimeout(() => setCopied(false), 2_000);
    });
  };

  const handleUse = () => {
    onUse?.(password);
  };

  const { score, label } = evaluatePasswordStrength(password);
  const strengthCfg = STRENGTH_CONFIG[label];

  return (
    <div className={cn("space-y-4 p-4", className)}>
      {/* Preview */}
      <div className="relative">
        <div className="font-mono text-sm bg-muted rounded-md px-3 py-2.5 pr-16 break-all select-all min-h-[40px] leading-relaxed">
          {password}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          onClick={refresh}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Force</span>
          <span
            className={cn(
              "font-medium",
              label === "faible" && "text-red-500",
              label === "correct" && "text-amber-500",
              label === "fort" && "text-blue-500",
              label === "excellent" && "text-emerald-500",
            )}
          >
            {strengthCfg.label}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              strengthCfg.color,
              strengthCfg.width,
            )}
          />
        </div>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "flex-1 h-1 rounded-full transition-colors",
                i < score ? strengthCfg.color : "bg-muted",
              )}
            />
          ))}
        </div>
      </div>

      {/* Length slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <Label>Longueur</Label>
          <span className="font-medium text-foreground">{length}</span>
        </div>
        <Slider
          min={8}
          max={128}
          step={1}
          value={[length]}
          onValueChange={([v]) => {
            setLength(v);
            setPassword(
              generatePassword({ length: v, upper, lower, digits, symbols }),
            );
          }}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>8</span>
          <span>128</span>
        </div>
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-2 gap-3">
        <ToggleOption
          label="Majuscules (A-Z)"
          checked={upper}
          onChange={(v) => {
            setUpper(v);
            setPassword(
              generatePassword({ length, upper: v, lower, digits, symbols }),
            );
          }}
        />
        <ToggleOption
          label="Minuscules (a-z)"
          checked={lower}
          onChange={(v) => {
            setLower(v);
            setPassword(
              generatePassword({ length, upper, lower: v, digits, symbols }),
            );
          }}
        />
        <ToggleOption
          label="Chiffres (0-9)"
          checked={digits}
          onChange={(v) => {
            setDigits(v);
            setPassword(
              generatePassword({ length, upper, lower, digits: v, symbols }),
            );
          }}
        />
        <ToggleOption
          label="Symboles (!@#…)"
          checked={symbols}
          onChange={(v) => {
            setSymbols(v);
            setPassword(
              generatePassword({ length, upper, lower, digits, symbols: v }),
            );
          }}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          className="flex-1 gap-1.5"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? "Copié !" : "Copier"}
        </Button>
        {onUse && (
          <Button className="flex-1 gap-1.5" onClick={handleUse}>
            Utiliser
          </Button>
        )}
      </div>
    </div>
  );
}

function ToggleOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        id={`toggle-${label}`}
        className="scale-90"
      />
      <Label htmlFor={`toggle-${label}`} className="text-xs cursor-pointer">
        {label}
      </Label>
    </div>
  );
}
