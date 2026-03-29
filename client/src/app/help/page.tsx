'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  HelpCircle,
  Keyboard,
  BookOpen,
  Server,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  ExternalLink,
  Zap,
  Shield,
  Users,
  HardDrive,
  Mail,
  Calendar,
  FileText,
  Container,
  Brain,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/use-page-title';

// ============================================================================
// FAQ Data
// ============================================================================

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    category: 'Compte',
    question: 'Comment changer mon mot de passe ?',
    answer: 'Accedez a Parametres > Profile et cliquez sur "Changer le mot de passe". Entrez votre ancien mot de passe puis le nouveau deux fois pour confirmer.',
  },
  {
    category: 'Compte',
    question: 'Comment activer la double authentification (MFA) ?',
    answer: 'Dans Parametres > Profile > Securite, activez "Authentification a deux facteurs". Scannez le QR code avec une application comme Google Authenticator ou Authy.',
  },
  {
    category: 'Documents',
    question: 'Comment partager un document avec mon equipe ?',
    answer: 'Ouvrez le document puis cliquez sur le bouton "Partager" en haut a droite. Vous pouvez inviter des membres par email ou generer un lien de partage avec differents niveaux d\'acces (lecture, commentaire, edition).',
  },
  {
    category: 'Documents',
    question: 'Comment recuperer un document supprime ?',
    answer: 'Les documents supprimes sont conserves dans la corbeille pendant 30 jours. Accedez a Drive > Corbeille pour restaurer un fichier. Apres 30 jours, la suppression est definitive.',
  },
  {
    category: 'Mail',
    question: 'Comment configurer ma signature email ?',
    answer: 'Allez dans Parametres > Signature. L\'editeur vous permet de creer une signature riche avec images, liens et mise en forme. La signature est automatiquement ajoutee a vos nouveaux emails.',
  },
  {
    category: 'Mail',
    question: 'Comment creer des filtres de messagerie ?',
    answer: 'Dans Mail, cliquez sur l\'icone des filtres en haut. Definissez des regles basees sur l\'expediteur, le sujet ou les mots-cles pour trier automatiquement vos messages dans des dossiers.',
  },
  {
    category: 'Calendrier',
    question: 'Comment synchroniser mon calendrier avec Google Calendar ?',
    answer: 'Accedez a Parametres > Calendrier > Comptes externes. Cliquez sur "Connecter Google Calendar" et autorisez l\'acces. Vos evenements seront synchronises dans les deux sens.',
  },
  {
    category: 'Stockage',
    question: 'Quelle est la limite de stockage ?',
    answer: 'La limite de stockage depend de votre plan. Le plan standard offre 15 Go. Consultez Parametres > General pour voir votre utilisation actuelle. Contactez l\'administrateur pour augmenter votre quota.',
  },
  {
    category: 'IA',
    question: 'Comment utiliser l\'assistant IA ?',
    answer: 'Accedez a la section "Intelligence" depuis le menu lateral. Vous pouvez poser des questions, generer du texte, analyser des documents et obtenir des suggestions. L\'IA est aussi integree dans l\'editeur de documents.',
  },
  {
    category: 'Securite',
    question: 'Mes donnees sont-elles chiffrees ?',
    answer: 'Oui. Toutes les communications sont chiffrees via TLS/HTTPS. Les fichiers stockes sont chiffres au repos. Les mots de passe sont hashes avec bcrypt. L\'infrastructure est hebergee localement pour un controle total.',
  },
  {
    category: 'Administration',
    question: 'Comment ajouter un nouvel utilisateur ?',
    answer: 'Accedez a Users via le menu lateral. Cliquez sur "Nouvel utilisateur" et remplissez le formulaire. Vous pouvez aussi importer des utilisateurs depuis un annuaire LDAP/Active Directory dans Parametres > LDAP.',
  },
  {
    category: 'Administration',
    question: 'Comment configurer les sauvegardes automatiques ?',
    answer: 'Allez dans Backups depuis le menu lateral. Configurez la frequence (quotidien, hebdomadaire) et la destination de sauvegarde. Les sauvegardes incluent la base de donnees et les fichiers.',
  },
];

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; description: string }[];
}

const KEYBOARD_SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Navigation generale',
    shortcuts: [
      { keys: 'Ctrl + K', description: 'Recherche rapide (Command Palette)' },
      { keys: 'Ctrl + /', description: 'Afficher les raccourcis clavier' },
      { keys: 'Ctrl + B', description: 'Basculer la barre laterale' },
      { keys: 'Alt + 1-9', description: 'Naviguer vers le module N' },
      { keys: 'Escape', description: 'Fermer le panneau actif' },
    ],
  },
  {
    title: 'Documents',
    shortcuts: [
      { keys: 'Ctrl + N', description: 'Nouveau document' },
      { keys: 'Ctrl + S', description: 'Sauvegarder' },
      { keys: 'Ctrl + Z', description: 'Annuler' },
      { keys: 'Ctrl + Shift + Z', description: 'Retablir' },
      { keys: 'Ctrl + P', description: 'Imprimer' },
    ],
  },
  {
    title: 'Mail',
    shortcuts: [
      { keys: 'C', description: 'Nouveau message' },
      { keys: 'R', description: 'Repondre' },
      { keys: 'A', description: 'Repondre a tous' },
      { keys: 'F', description: 'Transferer' },
      { keys: 'E', description: 'Archiver' },
      { keys: 'Delete', description: 'Supprimer' },
    ],
  },
  {
    title: 'Chat',
    shortcuts: [
      { keys: 'Ctrl + Enter', description: 'Envoyer le message' },
      { keys: 'Ctrl + Shift + N', description: 'Nouvelle conversation' },
      { keys: 'Ctrl + F', description: 'Rechercher dans la conversation' },
    ],
  },
  {
    title: 'Taches',
    shortcuts: [
      { keys: 'T', description: 'Nouvelle tache' },
      { keys: 'Space', description: 'Marquer comme termine' },
      { keys: 'D', description: 'Definir une date limite' },
      { keys: 'P', description: 'Changer la priorite' },
    ],
  },
];

// ============================================================================
// Service Status
// ============================================================================

interface ServiceInfo {
  name: string;
  port: number;
  icon: React.ReactNode;
  description: string;
}

const SERVICES: ServiceInfo[] = [
  { name: 'Identity', port: 3001, icon: <Users className="h-4 w-4" />, description: 'Authentification, LDAP, MFA, RBAC' },
  { name: 'Containers', port: 3002, icon: <Container className="h-4 w-4" />, description: 'Gestion des conteneurs Docker' },
  { name: 'Proxy', port: 3003, icon: <Shield className="h-4 w-4" />, description: 'Reverse proxy, TLS, SmartShield' },
  { name: 'Storage', port: 3004, icon: <HardDrive className="h-4 w-4" />, description: 'Stockage fichiers (local/S3)' },
  { name: 'AI', port: 3005, icon: <Brain className="h-4 w-4" />, description: 'RAG, LLM, embeddings, pgvector' },
  { name: 'SecureLink', port: 3006, icon: <Shield className="h-4 w-4" />, description: 'Tunnels web, DNS, ad-blocking' },
  { name: 'Scheduler', port: 3007, icon: <Clock className="h-4 w-4" />, description: 'Gestion des taches CRON' },
  { name: 'Metrics', port: 3008, icon: <Zap className="h-4 w-4" />, description: 'Monitoring, Prometheus, alertes' },
  { name: 'Media', port: 3009, icon: <FileText className="h-4 w-4" />, description: 'STT/TTS/OCR natif, pipeline voix' },
];

// ============================================================================
// Help Page
// ============================================================================

export default function HelpPage() {
  usePageTitle('Aide');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqItems, setOpenFaqItems] = useState<Set<number>>(new Set());
  const [contactForm, setContactForm] = useState({ subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [serviceStatuses, setServiceStatuses] = useState<Record<string, 'online' | 'offline' | 'checking'>>({});

  // Filter FAQ items by search
  const filteredFaq = searchQuery
    ? FAQ_ITEMS.filter(
        (item) =>
          item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : FAQ_ITEMS;

  // Group FAQ by category
  const faqCategories = [...new Set(filteredFaq.map((item) => item.category))];

  const toggleFaq = (index: number) => {
    setOpenFaqItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const checkServiceStatus = async (port: number, name: string) => {
    setServiceStatuses((prev) => ({ ...prev, [name]: 'checking' }));
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      await fetch(`http://localhost:${port}/api/v1/health`, {
        signal: controller.signal,
        mode: 'no-cors',
      });
      clearTimeout(timeout);
      setServiceStatuses((prev) => ({ ...prev, [name]: 'online' }));
    } catch {
      setServiceStatuses((prev) => ({ ...prev, [name]: 'offline' }));
    }
  };

  const checkAllServices = () => {
    SERVICES.forEach((service) => checkServiceStatus(service.port, service.name));
  };

  const handleContactSubmit = async () => {
    if (!contactForm.subject.trim() || !contactForm.message.trim()) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    setSending(true);
    // Simulate sending
    await new Promise((resolve) => setTimeout(resolve, 1000));
    toast.success('Message envoyé. Nous vous répondrons dans les plus brefs délais.');
    setContactForm({ subject: '', message: '' });
    setSending(false);
  };

  return (
    <AppLayout>
      <div className="space-y-8 w-full">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 rounded-xl">
            <HelpCircle className="h-7 w-7 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Centre d&apos;aide</h1>
            <p className="text-sm text-muted-foreground">
              Documentation, raccourcis et support technique
            </p>
          </div>
        </div>

        {/* Quoi de neuf */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Quoi de neuf
            </CardTitle>
            <CardDescription>
              Dernières mises à jour et nouvelles fonctionnalités.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                {
                  icon: <Brain className="h-4 w-4 text-purple-500" />,
                  title: 'AI Multimodal Gateway',
                  description: 'Génération d\'images, vidéo, audio et 3D via une interface unifiée. Support multi-providers (OpenAI, Anthropic, Ollama, natif GGUF).',
                },
                {
                  icon: <Mail className="h-4 w-4 text-blue-500" />,
                  title: 'Mail intégré',
                  description: 'Client email complet avec boîte de réception, composition, filtres et signatures personnalisées.',
                },
                {
                  icon: <FileText className="h-4 w-4 text-green-500" />,
                  title: 'Import Excel',
                  description: 'Importation et prévisualisation de fichiers Excel (.xlsx) directement dans la plateforme.',
                },
                {
                  icon: <Zap className="h-4 w-4 text-orange-500" />,
                  title: 'PWA Support',
                  description: 'Installez SignApps comme application native sur desktop et mobile avec support offline.',
                },
                {
                  icon: <Star className="h-4 w-4 text-yellow-500" />,
                  title: '50+ pages',
                  description: 'Plus de 50 pages et modules couvrant tous les besoins de collaboration : Drive, Chat, Calendrier, Tâches, IA, Monitoring et plus.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans l'aide..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <a href="#faq" className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">FAQ</span>
          </a>
          <a href="#shortcuts" className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
            <Keyboard className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">Raccourcis</span>
          </a>
          <a href="#system" className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
            <Server className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium">Systeme</span>
          </a>
          <a href="#contact" className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
            <MessageSquare className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium">Contact</span>
          </a>
        </div>

        {/* FAQ Section */}
        <section id="faq">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-500" />
                Foire aux questions
              </CardTitle>
              <CardDescription>
                Trouvez des reponses aux questions les plus frequentes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {faqCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun resultat pour &quot;{searchQuery}&quot;
                </p>
              ) : (
                faqCategories.map((category) => (
                  <div key={category} className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      {category}
                    </h3>
                    {filteredFaq
                      .filter((item) => item.category === category)
                      .map((item, idx) => {
                        const globalIdx = FAQ_ITEMS.indexOf(item);
                        return (
                          <Collapsible
                            key={globalIdx}
                            open={openFaqItems.has(globalIdx)}
                            onOpenChange={() => toggleFaq(globalIdx)}
                          >
                            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors">
                              <span className="text-sm font-medium pr-2">
                                {item.question}
                              </span>
                              {openFaqItems.has(globalIdx) ? (
                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                              )}
                            </CollapsibleTrigger>
                            <CollapsibleContent className="px-3 py-2 text-sm text-muted-foreground">
                              {item.answer}
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        {/* Keyboard Shortcuts */}
        <section id="shortcuts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-green-500" />
                Raccourcis clavier
              </CardTitle>
              <CardDescription>
                Gagnez en productivite avec les raccourcis clavier.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {KEYBOARD_SHORTCUTS.map((group) => (
                  <div key={group.title} className="space-y-3">
                    <h3 className="text-sm font-semibold">{group.title}</h3>
                    <div className="space-y-1.5">
                      {group.shortcuts.map((shortcut) => (
                        <div
                          key={shortcut.keys}
                          className="flex items-center justify-between py-1"
                        >
                          <span className="text-sm text-muted-foreground">
                            {shortcut.description}
                          </span>
                          <kbd className="inline-flex h-6 items-center rounded border bg-muted px-2 text-[11px] font-mono font-medium text-muted-foreground">
                            {shortcut.keys}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* System Info */}
        <section id="system">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-orange-500" />
                    Informations systeme
                  </CardTitle>
                  <CardDescription>
                    Version, services et etat du systeme.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={checkAllServices}>
                  Verifier les services
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Version Info */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Version</p>
                  <p className="text-sm font-semibold">SignApps v0.1.0</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Frontend</p>
                  <p className="text-sm font-semibold">Next.js 16 + React 19</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Backend</p>
                  <p className="text-sm font-semibold">Rust (Axum/Tokio)</p>
                </div>
              </div>

              <Separator />

              {/* Services */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Services</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {SERVICES.map((service) => {
                    const status = serviceStatuses[service.name];
                    return (
                      <div
                        key={service.name}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          {service.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{service.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              :{service.port}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {service.description}
                          </p>
                        </div>
                        {status === 'online' && (
                          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                        )}
                        {status === 'offline' && (
                          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        )}
                        {status === 'checking' && (
                          <Clock className="h-4 w-4 text-yellow-500 animate-pulse shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Documentation Links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-indigo-500" />
              Documentation
            </CardTitle>
            <CardDescription>
              Liens vers la documentation detaillee.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { title: 'Guide de demarrage', description: 'Premiers pas avec SignApps', icon: <Zap className="h-4 w-4" /> },
                { title: 'Administration', description: 'Gestion des utilisateurs et parametres', icon: <Shield className="h-4 w-4" /> },
                { title: 'API Reference', description: 'Documentation des APIs REST', icon: <Server className="h-4 w-4" /> },
                { title: 'Securite', description: 'Bonnes pratiques de securite', icon: <Shield className="h-4 w-4" /> },
                { title: 'Gestion des fichiers', description: 'Drive, stockage et partage', icon: <HardDrive className="h-4 w-4" /> },
                { title: 'Intelligence artificielle', description: 'Utiliser les fonctionnalites IA', icon: <Brain className="h-4 w-4" /> },
              ].map((doc) => (
                <div
                  key={doc.title}
                  className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0">
                    {doc.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{doc.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contact Support */}
        <section id="contact">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-500" />
                Contacter le support
              </CardTitle>
              <CardDescription>
                Besoin d&apos;aide supplementaire ? Envoyez-nous un message.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="support-subject">Sujet</Label>
                <Input
                  id="support-subject"
                  placeholder="Decrivez brievement votre probleme"
                  value={contactForm.subject}
                  onChange={(e) =>
                    setContactForm((prev) => ({ ...prev, subject: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-message">Message</Label>
                <Textarea
                  id="support-message"
                  placeholder="Decrivez votre probleme en detail..."
                  rows={5}
                  value={contactForm.message}
                  onChange={(e) =>
                    setContactForm((prev) => ({ ...prev, message: e.target.value }))
                  }
                />
              </div>
              <Button onClick={handleContactSubmit} disabled={sending}>
                <Send className="mr-2 h-4 w-4" />
                {sending ? 'Envoi en cours...' : 'Envoyer'}
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </AppLayout>
  );
}
