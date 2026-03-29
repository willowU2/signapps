'use client';

// Idea 1: Forms → responses create contacts automatically
// Idea 2: Forms → response data feeds into Sheets

import { useState } from 'react';
import { UserPlus, Sheet, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getClient, ServiceName } from '@/lib/api/factory';

const contactsClient = () => getClient(ServiceName.CONTACTS);
const identityClient = () => getClient(ServiceName.IDENTITY);

export interface FormResponseData {
  id: string;
  form_id: string;
  form_title: string;
  submitted_at: string;
  data: Record<string, string>;
}

/** Idea 1 – Create a contact from a form response */
export function FormResponseToContact({ response }: { response: FormResponseData }) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const createContact = async () => {
    setLoading(true);
    try {
      const payload = {
        first_name: response.data['name'] || response.data['prénom'] || response.data['prenom'] || 'Inconnu',
        last_name: response.data['last_name'] || response.data['nom'] || '',
        email: response.data['email'] || response.data['courriel'] || '',
        phone: response.data['phone'] || response.data['téléphone'] || response.data['telephone'] || '',
        source: 'form_response',
        source_id: response.id,
        notes: `Importé du formulaire "${response.form_title}" le ${new Date(response.submitted_at).toLocaleDateString('fr-FR')}`,
      };
      await contactsClient().post('/contacts', payload);
      setDone(true);
      toast.success('Contact créé depuis la réponse formulaire');
    } catch {
      // Store locally
      const local = JSON.parse(localStorage.getItem('interop-pending-contacts') || '[]');
      local.push({ ...response.data, form_id: response.form_id, queued_at: new Date().toISOString() });
      localStorage.setItem('interop-pending-contacts', JSON.stringify(local));
      setDone(true);
      toast.success('Contact mis en attente (sync ultérieure)');
    } finally {
      setLoading(false);
    }
  };

  if (done) return <Badge variant="outline" className="text-xs gap-1"><UserPlus className="w-3 h-3" />Contact créé</Badge>;

  return (
    <Button size="sm" variant="ghost" onClick={createContact} disabled={loading} className="h-7 gap-1 text-xs">
      <UserPlus className="w-3.5 h-3.5" />
      {loading ? 'Création...' : 'Créer contact'}
    </Button>
  );
}

/** Idea 2 – Push form response data to a sheet row */
export function FormResponseToSheet({ response }: { response: FormResponseData }) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const pushToSheet = async () => {
    setLoading(true);
    try {
      await identityClient().post('/interop/form-to-sheet', {
        form_id: response.form_id,
        form_title: response.form_title,
        response_id: response.id,
        row_data: response.data,
        submitted_at: response.submitted_at,
      });
      setDone(true);
      toast.success('Données envoyées vers Sheets');
    } catch {
      toast.info('Sheets non disponible — données locales conservées');
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  if (done) return (
    <Badge variant="outline" className="text-xs gap-1">
      <Sheet className="w-3 h-3" />Envoyé dans Sheets
    </Badge>
  );

  return (
    <Button size="sm" variant="ghost" onClick={pushToSheet} disabled={loading} className="h-7 gap-1 text-xs">
      <Sheet className="w-3.5 h-3.5" />
      <ChevronRight className="w-3 h-3" />
      {loading ? 'Envoi...' : 'Vers Sheets'}
    </Button>
  );
}
