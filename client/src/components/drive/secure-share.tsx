'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Link2, Copy, Check, Lock, Clock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { driveApi, type DriveNode, type NodeShareLink } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExpirationOption = '1h' | '1d' | '7d' | '30d' | 'never';

const EXPIRATION_OPTIONS: Array<{ value: ExpirationOption; label: string }> = [
  { value: '1h', label: '1 heure' },
  { value: '1d', label: '1 jour' },
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: 'never', label: 'Jamais' },
];

const EXPIRATION_HOURS: Record<ExpirationOption, number | null> = {
  '1h': 1,
  '1d': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
  never: null,
};

interface GeneratedShare {
  link: NodeShareLink;
  expiration: ExpirationOption;
  hasPassword: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SecureShareDialogProps {
  node: DriveNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SecureShareDialog({ node, open, onOpenChange }: SecureShareDialogProps) {
  const [expiration, setExpiration] = useState<ExpirationOption>('7d');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [generated, setGenerated] = useState<GeneratedShare | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!node) return;
    setGenerating(true);
    try {
      const hasPassword = usePassword && !!password;
      const link = await driveApi.createShareLink(node.id, {
        expires_in_hours: EXPIRATION_HOURS[expiration],
        password: hasPassword ? password : null,
        access_type: 'download',
      });
      setGenerated({ link, expiration, hasPassword });
      toast.success('Lien de partage généré');
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Impossible de générer le lien de partage';
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }, [node, expiration, usePassword, password]);

  const shareUrl = generated?.link.url ?? '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Lien copié dans le presse-papiers');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setGenerated(null);
    setCopied(false);
    setPassword('');
    setUsePassword(false);
    setExpiration('7d');
    onOpenChange(false);
  };

  if (!node) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Partager avec un lien
          </DialogTitle>
        </DialogHeader>

        {!generated ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Fichier : <strong className="text-foreground">{node.name}</strong>
            </p>

            {/* Expiration */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />Expiration
              </Label>
              <Select value={expiration} onValueChange={v => setExpiration(v as ExpirationOption)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRATION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Password protection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 cursor-pointer">
                  <Lock className="h-4 w-4" />Protection par mot de passe
                </Label>
                <Switch checked={usePassword} onCheckedChange={setUsePassword} />
              </div>
              {usePassword && (
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mot de passe pour le lien"
                    className="pr-10"
                  />
                  <Button
                    variant="ghost" size="icon"
                    className="absolute right-1 top-1 h-8 w-8"
                    onClick={() => setShowPassword(v => !v)}
                    type="button"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </div>

            {/* PDF watermark notice */}
            {node.name.toLowerCase().endsWith('.pdf') && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300">
                <strong>Note :</strong> Un filigrane &ldquo;CONFIDENTIEL&rdquo; sera ajouté à l&apos;aperçu PDF lors du partage externe.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">
              Lien généré avec succès !
            </div>

            <div className="space-y-1.5">
              <Label>Lien de partage</Label>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="text-xs font-mono bg-muted" />
                <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                {EXPIRATION_OPTIONS.find(o => o.value === generated.expiration)?.label}
              </Badge>
              {generated.hasPassword && (
                <Badge variant="secondary" className="gap-1">
                  <Lock className="h-3 w-3" />Protégé par mdp
                </Badge>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Fermer</Button>
          {!generated && (
            <Button onClick={handleGenerate} disabled={generating || (usePassword && !password)}>
              {generating ? 'Génération…' : 'Générer le lien'}
            </Button>
          )}
          {generated && (
            <Button onClick={handleCopy} variant={copied ? 'secondary' : 'default'}>
              {copied ? <><Check className="h-4 w-4 mr-2" />Copié !</> : <><Copy className="h-4 w-4 mr-2" />Copier le lien</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
