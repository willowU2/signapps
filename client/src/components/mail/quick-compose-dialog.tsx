'use client';

import { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Send, Loader2 } from 'lucide-react';
import { mailApi, accountApi, type MailAccount } from '@/lib/api-mail';
import { toast } from 'sonner';

interface QuickComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickComposeDialog({ open, onOpenChange }: QuickComposeDialogProps) {
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadAccounts() {
      setLoadingAccounts(true);
      try {
        const result = await accountApi.list();
        if (!cancelled) {
          setAccounts(result);
          if (result.length === 1) {
            setSelectedAccountId(result[0].id);
          }
        }
      } catch {
        // Mail service may be unavailable
        if (!cancelled) setAccounts([]);
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    }

    loadAccounts();
    return () => { cancelled = true; };
  }, [open]);

  const handleReset = () => {
    setRecipient('');
    setSubject('');
    setBody('');
    setSelectedAccountId(accounts.length === 1 ? accounts[0].id : '');
  };

  const handleSend = async () => {
    if (!recipient.trim()) {
      toast.error('Veuillez saisir un destinataire');
      return;
    }
    if (!selectedAccountId) {
      toast.error('Veuillez selectionner un compte mail');
      return;
    }

    setIsSending(true);
    try {
      await mailApi.send({
        account_id: selectedAccountId,
        recipient: recipient.trim(),
        subject: subject.trim() || '(Sans objet)',
        body_text: body.trim(),
        body_html: `<p>${body.trim().replace(/\n/g, '<br/>')}</p>`,
      });
      toast.success('Email envoye !');
      handleReset();
      onOpenChange(false);
    } catch {
      toast.error("Erreur lors de l'envoi de l'email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleReset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Envoi rapide</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Account selector */}
          {accounts.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="qc-account">Compte</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger id="qc-account">
                  <SelectValue placeholder="Choisir un compte..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.display_name || acc.email_address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {accounts.length === 0 && !loadingAccounts && (
            <p className="text-sm text-muted-foreground">
              Aucun compte mail configure. Ajoutez-en un dans les parametres Mail.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="qc-to">Destinataire</Label>
            <Input
              id="qc-to"
              type="email"
              placeholder="destinataire@exemple.com"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qc-subject">Objet</Label>
            <Input
              id="qc-subject"
              placeholder="Objet de l'email"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qc-body">Message</Label>
            <Textarea
              id="qc-body"
              placeholder="Votre message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Ctrl+Entree pour envoyer
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !recipient.trim() || !selectedAccountId}
          >
            {isSending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
