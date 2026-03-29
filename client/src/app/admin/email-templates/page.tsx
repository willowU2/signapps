'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Mail,
  Edit2,
  Eye,
  Send,
  Save,
  Loader2,
  UserPlus,
  KeyRound,
  Users,
  BarChart3,
  CheckCircle2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/use-page-title';
import { PageHeader } from '@/components/ui/page-header';

// ─── Template types ─────────────────────────────────────────────────────────

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  subject: string;
  body: string;
  icon: React.ElementType;
  description: string;
  variables: string[];
  lastModified: string;
}

// ─── Default templates in French ────────────────────────────────────────────

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: 'welcome',
    name: 'Email de bienvenue',
    slug: 'welcome',
    subject: 'Bienvenue sur SignApps, {{prenom}} !',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; margin-bottom: 24px;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Bienvenue sur SignApps</h1>
  </div>

  <p>Bonjour <strong>{{prenom}}</strong>,</p>

  <p>Nous sommes ravis de vous accueillir sur la plateforme SignApps. Votre compte a ete cree avec succes.</p>

  <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <p style="margin: 0 0 8px 0;"><strong>Vos informations de connexion :</strong></p>
    <p style="margin: 0 0 4px 0;">Identifiant : <code style="background: #e9ecef; padding: 2px 6px; border-radius: 4px;">{{email}}</code></p>
    <p style="margin: 0;">Organisation : <code style="background: #e9ecef; padding: 2px 6px; border-radius: 4px;">{{organisation}}</code></p>
  </div>

  <p>Pour commencer, nous vous recommandons de :</p>
  <ol>
    <li>Completer votre profil utilisateur</li>
    <li>Activer l'authentification a deux facteurs (MFA)</li>
    <li>Explorer les applications disponibles</li>
  </ol>

  <div style="text-align: center; margin: 30px 0;">
    <a href="{{lien_connexion}}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
      Se connecter
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    Si vous n'avez pas cree ce compte, veuillez ignorer cet email ou contacter notre equipe de support.
  </p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
  <p style="color: #999; font-size: 12px; text-align: center;">
    SignApps Platform - {{organisation}}<br/>
    Cet email a ete envoye automatiquement, merci de ne pas y repondre.
  </p>
</body>
</html>`,
    icon: UserPlus,
    description: 'Envoye automatiquement lors de la creation d\'un nouveau compte utilisateur.',
    variables: ['prenom', 'email', 'organisation', 'lien_connexion'],
    lastModified: '2026-03-15',
  },
  {
    id: 'password-reset',
    name: 'Reinitialisation du mot de passe',
    slug: 'password-reset',
    subject: 'Reinitialisation de votre mot de passe SignApps',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, #f59e0b, #ef4444); border-radius: 12px; margin-bottom: 24px;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Reinitialisation du mot de passe</h1>
  </div>

  <p>Bonjour <strong>{{prenom}}</strong>,</p>

  <p>Une demande de reinitialisation de mot de passe a ete effectuee pour votre compte SignApps.</p>

  <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #f59e0b;">
    <p style="margin: 0; font-size: 14px;">
      <strong>Important :</strong> Ce lien expire dans <strong>{{duree_expiration}}</strong>. Si vous n'avez pas fait cette demande, ignorez simplement cet email.
    </p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="{{lien_reinitialisation}}" style="display: inline-block; background: #ef4444; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
      Reinitialiser mon mot de passe
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    Si le bouton ne fonctionne pas, copiez-collez le lien suivant dans votre navigateur :<br/>
    <code style="word-break: break-all; font-size: 12px; color: #6366f1;">{{lien_reinitialisation}}</code>
  </p>

  <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 20px 0;">
    <p style="margin: 0 0 4px 0; font-size: 13px; color: #666;"><strong>Details de la demande :</strong></p>
    <p style="margin: 0 0 2px 0; font-size: 12px; color: #999;">Date : {{date_demande}}</p>
    <p style="margin: 0; font-size: 12px; color: #999;">IP : {{ip_demande}}</p>
  </div>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
  <p style="color: #999; font-size: 12px; text-align: center;">
    SignApps Platform<br/>
    Cet email a ete envoye automatiquement, merci de ne pas y repondre.
  </p>
</body>
</html>`,
    icon: KeyRound,
    description: 'Envoye lorsqu\'un utilisateur demande la reinitialisation de son mot de passe.',
    variables: ['prenom', 'lien_reinitialisation', 'duree_expiration', 'date_demande', 'ip_demande'],
    lastModified: '2026-03-10',
  },
  {
    id: 'invitation',
    name: 'Invitation a rejoindre',
    slug: 'invitation',
    subject: '{{inviteur}} vous invite a rejoindre {{organisation}} sur SignApps',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, #10b981, #06b6d4); border-radius: 12px; margin-bottom: 24px;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Vous etes invite !</h1>
  </div>

  <p>Bonjour,</p>

  <p><strong>{{inviteur}}</strong> vous invite a rejoindre l'organisation <strong>{{organisation}}</strong> sur la plateforme SignApps.</p>

  <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #10b981;">
    <p style="margin: 0 0 8px 0;"><strong>Details de l'invitation :</strong></p>
    <p style="margin: 0 0 4px 0;">Organisation : <strong>{{organisation}}</strong></p>
    <p style="margin: 0 0 4px 0;">Role attribue : <strong>{{role}}</strong></p>
    <p style="margin: 0;">Expire le : <strong>{{date_expiration}}</strong></p>
  </div>

  <p>SignApps est une plateforme complete de gestion d'infrastructure et de productivite. En rejoignant {{organisation}}, vous aurez acces a :</p>
  <ul>
    <li>Gestion de fichiers et stockage collaboratif</li>
    <li>Outils d'intelligence artificielle integres</li>
    <li>Calendrier et gestion de taches</li>
    <li>Communication d'equipe</li>
  </ul>

  <div style="text-align: center; margin: 30px 0;">
    <a href="{{lien_invitation}}" style="display: inline-block; background: #10b981; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
      Accepter l'invitation
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    Cette invitation est valable jusqu'au {{date_expiration}}. Passe ce delai, vous devrez demander une nouvelle invitation.
  </p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
  <p style="color: #999; font-size: 12px; text-align: center;">
    SignApps Platform<br/>
    Cet email a ete envoye automatiquement, merci de ne pas y repondre.
  </p>
</body>
</html>`,
    icon: Users,
    description: 'Envoye lorsqu\'un administrateur invite un nouvel utilisateur a rejoindre l\'organisation.',
    variables: ['inviteur', 'organisation', 'role', 'date_expiration', 'lien_invitation'],
    lastModified: '2026-03-12',
  },
  {
    id: 'activity-digest',
    name: 'Resume d\'activite',
    slug: 'activity-digest',
    subject: 'Votre resume d\'activite SignApps - Semaine du {{date_debut}}',
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, #3b82f6, #6366f1); border-radius: 12px; margin-bottom: 24px;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Resume hebdomadaire</h1>
    <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Semaine du {{date_debut}} au {{date_fin}}</p>
  </div>

  <p>Bonjour <strong>{{prenom}}</strong>,</p>
  <p>Voici un apercu de votre activite sur SignApps cette semaine :</p>

  <div style="display: flex; gap: 12px; margin: 20px 0;">
    <div style="flex: 1; background: #f8f9fa; border-radius: 8px; padding: 16px; text-align: center;">
      <p style="margin: 0; font-size: 28px; font-weight: bold; color: #6366f1;">{{nb_fichiers}}</p>
      <p style="margin: 4px 0 0; font-size: 12px; color: #666;">Fichiers modifies</p>
    </div>
    <div style="flex: 1; background: #f8f9fa; border-radius: 8px; padding: 16px; text-align: center;">
      <p style="margin: 0; font-size: 28px; font-weight: bold; color: #10b981;">{{nb_taches}}</p>
      <p style="margin: 4px 0 0; font-size: 12px; color: #666;">Taches terminees</p>
    </div>
    <div style="flex: 1; background: #f8f9fa; border-radius: 8px; padding: 16px; text-align: center;">
      <p style="margin: 0; font-size: 28px; font-weight: bold; color: #f59e0b;">{{nb_collaborations}}</p>
      <p style="margin: 4px 0 0; font-size: 12px; color: #666;">Collaborations</p>
    </div>
  </div>

  <h3 style="margin: 24px 0 12px; font-size: 16px;">Activites recentes</h3>
  <div style="background: #f8f9fa; border-radius: 8px; padding: 16px;">
    {{liste_activites}}
  </div>

  <h3 style="margin: 24px 0 12px; font-size: 16px;">Taches a venir</h3>
  <div style="background: #fff7ed; border-radius: 8px; padding: 16px; border-left: 4px solid #f59e0b;">
    {{taches_a_venir}}
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="{{lien_dashboard}}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
      Voir mon tableau de bord
    </a>
  </div>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
  <p style="color: #999; font-size: 12px; text-align: center;">
    SignApps Platform - {{organisation}}<br/>
    Pour modifier vos preferences de notification, rendez-vous dans les <a href="{{lien_parametres}}" style="color: #6366f1;">parametres</a>.<br/>
    Cet email a ete envoye automatiquement.
  </p>
</body>
</html>`,
    icon: BarChart3,
    description: 'Envoye chaque semaine avec un resume de l\'activite de l\'utilisateur.',
    variables: ['prenom', 'date_debut', 'date_fin', 'nb_fichiers', 'nb_taches', 'nb_collaborations', 'liste_activites', 'taches_a_venir', 'lien_dashboard', 'lien_parametres', 'organisation'],
    lastModified: '2026-03-20',
  },
];

// ─── Preview iframe component ───────────────────────────────────────────────

function HtmlPreview({ html }: { html: string }) {
  return (
    <iframe
      srcDoc={html}
      className="w-full h-[500px] border rounded-lg bg-card"
      sandbox="allow-same-origin"
      title="Apercu du template"
    />
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function EmailTemplatesPage() {
  usePageTitle('Modeles email');
  const [templates, setTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testTemplateId, setTestTemplateId] = useState<string | null>(null);

  const openEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setEditSubject(template.subject);
    setEditBody(template.body);
  };

  const closeEdit = () => {
    setEditingTemplate(null);
    setEditSubject('');
    setEditBody('');
  };

  const handleSave = () => {
    if (!editingTemplate) return;
    setSaving(true);
    setTimeout(() => {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingTemplate.id
            ? { ...t, subject: editSubject, body: editBody, lastModified: new Date().toISOString().split('T')[0] }
            : t
        )
      );
      setSaving(false);
      closeEdit();
      toast.success(`Template "${editingTemplate.name}" sauvegardé`);
    }, 500);
  };

  const openTestDialog = (templateId: string) => {
    setTestTemplateId(templateId);
    setTestEmail('');
    setTestDialogOpen(true);
  };

  const handleTestSend = () => {
    if (!testTemplateId || !testEmail.trim()) return;
    setTestSending(testTemplateId);
    setTestDialogOpen(false);
    setTimeout(() => {
      setTestSending(null);
      toast.success(`Email de test envoye a ${testEmail}`);
    }, 1200);
  };

  // Replace variables with sample values for preview
  const getPreviewHtml = (template: EmailTemplate) => {
    const sampleValues: Record<string, string> = {
      prenom: 'Jean-Pierre',
      email: 'jean-pierre.dupont@corp.fr',
      organisation: 'SignApps Corp',
      lien_connexion: 'https://app.signapps.io/login',
      lien_reinitialisation: 'https://app.signapps.io/reset?token=abc123def456',
      duree_expiration: '24 heures',
      date_demande: '28 mars 2026 a 14:32',
      ip_demande: '192.168.1.42',
      inviteur: 'Marie Martin',
      role: 'Editeur',
      date_expiration: '4 avril 2026',
      lien_invitation: 'https://app.signapps.io/invite?token=xyz789',
      date_debut: '24 mars 2026',
      date_fin: '28 mars 2026',
      nb_fichiers: '23',
      nb_taches: '8',
      nb_collaborations: '12',
      liste_activites: '<p style="margin: 4px 0; font-size: 13px;">&#8226; Document "Rapport Q1" modifie</p><p style="margin: 4px 0; font-size: 13px;">&#8226; 3 nouveaux fichiers uploades dans "Marketing"</p><p style="margin: 4px 0; font-size: 13px;">&#8226; Tache "Revue budget" terminee</p>',
      taches_a_venir: '<p style="margin: 4px 0; font-size: 13px;">&#8226; Reunion equipe - Lundi 31 mars a 10:00</p><p style="margin: 4px 0; font-size: 13px;">&#8226; Date limite : Rapport mensuel - 2 avril</p>',
      lien_dashboard: 'https://app.signapps.io/dashboard',
      lien_parametres: 'https://app.signapps.io/settings/notifications',
    };

    let html = template.body;
    for (const [key, value] of Object.entries(sampleValues)) {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return html;
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          title="Templates d'emails"
          description="Gérez les templates de notifications email de la plateforme."
          icon={<Mail className="h-5 w-5" />}
        />

        {/* Template list */}
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => {
            const Icon = template.icon;
            return (
              <Card key={template.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">{template.description}</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Sujet</Label>
                    <p className="text-sm font-mono bg-muted/50 rounded px-2 py-1 mt-1 truncate">{template.subject}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {template.variables.map((v) => (
                      <Badge key={v} variant="outline" className="text-[10px] font-mono">
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground">
                      Modifie le {new Date(template.lastModified).toLocaleDateString('fr-FR')}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setPreviewTemplate(template)} title="Apercu">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(template)} title="Modifier">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openTestDialog(template.id)}
                        disabled={testSending === template.id}
                        title="Envoyer un test"
                      >
                        {testSending === template.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editingTemplate} onOpenChange={(open) => { if (!open) closeEdit(); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2 className="h-5 w-5" />
                Modifier : {editingTemplate?.name}
              </DialogTitle>
              <DialogDescription>
                Editez le sujet et le corps HTML du template. Utilisez les variables entre doubles accolades.
              </DialogDescription>
            </DialogHeader>

            {editingTemplate && (
              <Tabs defaultValue="editor" className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="editor">Editeur</TabsTrigger>
                  <TabsTrigger value="preview">Apercu</TabsTrigger>
                </TabsList>

                <TabsContent value="editor" className="space-y-4 mt-4">
                  <div className="space-y-1.5">
                    <Label>Sujet de l&apos;email</Label>
                    <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Corps HTML</Label>
                      <div className="flex gap-1">
                        {editingTemplate.variables.map((v) => (
                          <Badge
                            key={v}
                            variant="outline"
                            className="text-[10px] font-mono cursor-pointer hover:bg-primary/10"
                            onClick={() => setEditBody((prev) => prev + `{{${v}}}`)}
                          >
                            {`{{${v}}}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <textarea
                      className="w-full min-h-[400px] rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={closeEdit}>Annuler</Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Sauvegarder
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="mt-4">
                  <div className="space-y-2">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Sujet :</p>
                      <p className="text-sm font-medium">{editSubject}</p>
                    </div>
                    <HtmlPreview html={getPreviewHtml({ ...editingTemplate, body: editBody })} />
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={!!previewTemplate} onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Apercu : {previewTemplate?.name}
              </DialogTitle>
              <DialogDescription>
                Apercu avec des donnees de test.
              </DialogDescription>
            </DialogHeader>
            {previewTemplate && (
              <div className="mt-4 space-y-2">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Sujet :</p>
                  <p className="text-sm font-medium">{previewTemplate.subject}</p>
                </div>
                <HtmlPreview html={getPreviewHtml(previewTemplate)} />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Test Send Dialog */}
        <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Envoyer un email de test
              </DialogTitle>
              <DialogDescription>
                L&apos;email sera envoye avec des donnees de demonstration.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label>Adresse email du destinataire</Label>
                <Input
                  type="email"
                  placeholder="test@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setTestDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleTestSend} disabled={!testEmail.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  Envoyer le test
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
