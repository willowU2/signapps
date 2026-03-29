'use client';

/**
 * Feature 14: Drive → share file via email
 */

import { useState } from 'react';
import { Mail, Send, Loader2, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { DriveNode } from '@/lib/api/drive';
import { driveNodeUrl } from '@/hooks/use-cross-module';

interface DriveShareEmailProps {
  node: DriveNode;
}

export function DriveShareEmail({ node }: DriveShareEmailProps) {
  const [open, setOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const fileUrl = driveNodeUrl(node.id);

  const addEmail = () => {
    const email = emailInput.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Email invalide');
      return;
    }
    if (recipients.includes(email)) {
      toast.error('Email déjà ajouté');
      return;
    }
    setRecipients((r) => [...r, email]);
    setEmailInput('');
  };

  const handleSend = async () => {
    if (recipients.length === 0) { toast.error('Ajoutez au moins un destinataire'); return; }
    setLoading(true);
    try {
      // Use the mail API if available
      const { mailApi } = await import('@/lib/api/mail').catch(() => ({ mailApi: null }));
      if (mailApi && (mailApi as any).send) {
        await (mailApi as any).send({
          to: recipients,
          subject: `Partage de fichier : ${node.name}`,
          body: `${message || `Bonjour,\n\nJe partage avec vous le fichier "${node.name}".\n`}\n\nLien d'accès : ${fileUrl}\n\nCordialement`,
        });
      } else {
        // Fallback: mailto link
        const subject = encodeURIComponent(`Partage : ${node.name}`);
        const body = encodeURIComponent(`${message || `Bonjour,\n\nFichier partagé : ${node.name}`}\n\n${fileUrl}`);
        window.open(`mailto:${recipients.join(',')}?subject=${subject}&body=${body}`);
      }
      toast.success('Email envoyé');
      setOpen(false);
      setRecipients([]);
      setMessage('');
    } catch {
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
          <Mail className="h-3.5 w-3.5" />
          Envoyer
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Mail className="h-4 w-4 text-primary" />
          Partager par email
        </p>

        <div className="text-xs text-muted-foreground truncate bg-muted/30 rounded p-1.5">
          {node.name}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Destinataires</Label>
          <div className="flex gap-1">
            <Input
              type="email"
              placeholder="email@exemple.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
              className="h-8 text-xs flex-1"
            />
            <Button size="sm" variant="outline" onClick={addEmail} className="h-8 px-2">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          {recipients.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {recipients.map((r) => (
                <Badge key={r} variant="secondary" className="gap-1 text-xs">
                  {r}
                  <button onClick={() => setRecipients((prev) => prev.filter((e) => e !== r))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Message (optionnel)</Label>
          <Textarea
            placeholder="Message personnalisé..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            className="text-xs resize-none"
          />
        </div>

        <Button size="sm" className="w-full gap-1.5" onClick={handleSend} disabled={loading || recipients.length === 0}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Envoyer
        </Button>
      </PopoverContent>
    </Popover>
  );
}
