'use client';

import { useState, useCallback } from 'react';
import {
  Link2,
  Copy,
  Check,
  Clock,
  Shield,
  ExternalLink,
  Loader2,
  Trash2,
  QrCode,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getClient, ServiceName } from '@/lib/api/factory';

// ============================================================================
// Types
// ============================================================================

export interface GuestLink {
  id: string;
  token: string;
  resource_type: string;
  resource_id: string;
  permission: 'read' | 'comment';
  expires_at: string | null;
  password_protected: boolean;
  created_at: string;
  access_count: number;
  is_active: boolean;
}

export interface GuestLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: string;
  resourceId: string;
  resourceName?: string;
}

// ============================================================================
// Expiry options
// ============================================================================

const EXPIRY_OPTIONS = [
  { value: 'none', label: 'Pas d\'expiration' },
  { value: '1h', label: '1 heure' },
  { value: '24h', label: '24 heures' },
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
];

function getExpiryDate(option: string): string | null {
  const now = new Date();
  switch (option) {
    case '1h':
      return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    case '24h':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    case '7d':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    case '90d':
      return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return null;
  }
}

// ============================================================================
// API helper
// ============================================================================

const securelinkClient = getClient(ServiceName.SECURELINK);

async function createGuestLink(data: {
  resource_type: string;
  resource_id: string;
  permission: 'read' | 'comment';
  expires_at: string | null;
  password?: string;
}): Promise<GuestLink> {
  const response = await securelinkClient.post<GuestLink>('/guest-links', data);
  return response.data;
}

async function listGuestLinks(resourceId: string): Promise<GuestLink[]> {
  const response = await securelinkClient.get<GuestLink[]>('/guest-links', {
    params: { resource_id: resourceId },
  });
  return response.data;
}

async function revokeGuestLink(linkId: string): Promise<void> {
  await securelinkClient.delete(`/guest-links/${linkId}`);
}

// ============================================================================
// Component
// ============================================================================

export function GuestLinkDialog({
  open,
  onOpenChange,
  resourceType,
  resourceId,
  resourceName,
}: GuestLinkDialogProps) {
  const [expiry, setExpiry] = useState('7d');
  const [permission, setPermission] = useState<'read' | 'comment'>('read');
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdLink, setCreatedLink] = useState<GuestLink | null>(null);
  const [existingLinks, setExistingLinks] = useState<GuestLink[]>([]);
  const [copied, setCopied] = useState(false);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);

  // Load existing links when dialog opens
  const loadLinks = useCallback(async () => {
    setIsLoadingLinks(true);
    try {
      const links = await listGuestLinks(resourceId);
      setExistingLinks(links.filter((l) => l.is_active));
    } catch {
      // Silently fail
    } finally {
      setIsLoadingLinks(false);
    }
  }, [resourceId]);

  // Load on open
  useState(() => {
    if (open) {
      loadLinks();
    }
  });

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const link = await createGuestLink({
        resource_type: resourceType,
        resource_id: resourceId,
        permission,
        expires_at: getExpiryDate(expiry),
        password: passwordProtected ? password : undefined,
      });
      setCreatedLink(link);
      setExistingLinks((prev) => [link, ...prev]);
      toast.success('Lien de partage cree');
    } catch {
      toast.error('Erreur lors de la creation du lien');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = () => {
    if (!createdLink) return;
    const url = `${window.location.origin}/guest/${createdLink.token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Lien copie');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (linkId: string) => {
    try {
      await revokeGuestLink(linkId);
      setExistingLinks((prev) => prev.filter((l) => l.id !== linkId));
      if (createdLink?.id === linkId) {
        setCreatedLink(null);
      }
      toast.success('Lien revoque');
    } catch {
      toast.error('Erreur lors de la revocation');
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setCreatedLink(null);
      setCopied(false);
      setPassword('');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Partager via lien invite
          </DialogTitle>
          <DialogDescription>
            {resourceName
              ? `Creer un lien d'acces invite pour "${resourceName}"`
              : `Creer un lien d'acces invite en lecture seule`}
          </DialogDescription>
        </DialogHeader>

        {/* Created link display — AQ-SHRL: with QR code */}
        {createdLink && (
          <div className="bg-muted/50 border rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Lien créé</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/guest/${createdLink.token}`}
                className="text-xs font-mono"
              />
              <Button size="sm" variant="outline" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {/* QR code for easy mobile scanning */}
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded border">
                <QRCodeSVG
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/guest/${createdLink.token}`}
                  size={80}
                  level="M"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                <div className="flex items-center gap-1 mb-1">
                  <QrCode className="h-3 w-3" />
                  Scanner avec un mobile
                </div>
                {createdLink.expires_at && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Expire : {new Date(createdLink.expires_at).toLocaleDateString('fr-FR')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Creation form */}
        {!createdLink && (
          <div className="space-y-4">
            {/* Permission */}
            <div className="space-y-2">
              <Label>Permission</Label>
              <Select
                value={permission}
                onValueChange={(v) => setPermission(v as 'read' | 'comment')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">
                    <span className="flex items-center gap-2">
                      <ExternalLink className="h-3 w-3" />
                      Lecture seule
                    </span>
                  </SelectItem>
                  <SelectItem value="comment">
                    <span className="flex items-center gap-2">
                      <ExternalLink className="h-3 w-3" />
                      Lecture + Commentaires
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Expiry */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Expiration
              </Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Password protection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Mot de passe
                </Label>
                <Switch
                  checked={passwordProtected}
                  onCheckedChange={setPasswordProtected}
                />
              </div>
              {passwordProtected && (
                <Input
                  type="password"
                  placeholder="Entrez un mot de passe..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </div>
          </div>
        )}

        {/* Existing links */}
        {existingLinks.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Liens actifs ({existingLinks.length})
            </Label>
            <div className="space-y-1 max-h-[120px] overflow-y-auto">
              {existingLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {link.permission}
                    </Badge>
                    <span className="truncate font-mono text-muted-foreground">
                      {link.token.slice(0, 12)}...
                    </span>
                    {link.expires_at && (
                      <span className="text-muted-foreground shrink-0">
                        exp. {new Date(link.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive shrink-0"
                    onClick={() => handleRevoke(link.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Fermer
          </Button>
          {!createdLink && (
            <Button
              onClick={handleCreate}
              disabled={isCreating || (passwordProtected && !password)}
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Creer le lien
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GuestLinkDialog;
