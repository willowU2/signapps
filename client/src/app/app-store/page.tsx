'use client';

import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Star,
  Download,
  Check,
  Trash2,
  ExternalLink,
  Package,
  Shield,
  Cpu,
  MessageSquare,
  Briefcase,
  Brain,
  Blocks,
} from 'lucide-react';
import { toast } from 'sonner';

// --- Types ---

interface MarketplaceApp {
  id: string;
  name: string;
  category: string;
  description: string;
  longDescription: string;
  icon: string;
  rating: number;
  downloads: string;
  version: string;
  author: string;
  installed: boolean;
}

// --- Constants ---

const CATEGORIES = [
  { id: 'all', label: 'Toutes', icon: Blocks },
  { id: 'Productivité', label: 'Productivité', icon: Briefcase },
  { id: 'Communication', label: 'Communication', icon: MessageSquare },
  { id: 'Sécurité', label: 'Sécurité', icon: Shield },
  { id: 'DevOps', label: 'DevOps', icon: Cpu },
  { id: 'IA', label: 'IA', icon: Brain },
];

const INITIAL_APPS: MarketplaceApp[] = [
  {
    id: '1',
    name: 'Slack',
    category: 'Communication',
    description: 'Messagerie d\'équipe en temps réel',
    longDescription: 'Plateforme de communication collaborative pour les équipes. Canaux organisés, messages directs, intégrations avec plus de 2000 outils. Partage de fichiers, appels audio/vidéo et automatisation des workflows.',
    icon: '💬',
    rating: 4.5,
    downloads: '12.5k',
    version: '4.35.2',
    author: 'Salesforce',
    installed: false,
  },
  {
    id: '2',
    name: 'Jira',
    category: 'Productivité',
    description: 'Gestion de projets agile',
    longDescription: 'Outil de suivi de projets et de gestion agile. Tableaux Scrum et Kanban, backlogs, sprints, rapports de vélocité. Intégration CI/CD et suivi des bugs avec workflows personnalisables.',
    icon: '📋',
    rating: 4.2,
    downloads: '8.3k',
    version: '9.12.0',
    author: 'Atlassian',
    installed: false,
  },
  {
    id: '3',
    name: 'GitHub',
    category: 'DevOps',
    description: 'Hébergement de code source et CI/CD',
    longDescription: 'Plateforme de développement collaborative. Gestion de versions Git, pull requests, revues de code, GitHub Actions pour CI/CD, Codespaces pour le développement dans le cloud, et GitHub Copilot.',
    icon: '🐙',
    rating: 4.8,
    downloads: '25.1k',
    version: '3.12.1',
    author: 'Microsoft',
    installed: true,
  },
  {
    id: '4',
    name: 'Grafana',
    category: 'DevOps',
    description: 'Tableaux de bord de monitoring',
    longDescription: 'Plateforme de visualisation et d\'observabilité. Tableaux de bord interactifs, alertes configurables, support de multiples sources de données (Prometheus, InfluxDB, Elasticsearch, etc.).',
    icon: '📊',
    rating: 4.6,
    downloads: '15.8k',
    version: '10.4.0',
    author: 'Grafana Labs',
    installed: true,
  },
  {
    id: '5',
    name: 'Vault',
    category: 'Sécurité',
    description: 'Gestion des secrets et chiffrement',
    longDescription: 'Outil de gestion des secrets, du chiffrement et de l\'accès privilégié. Stockage sécurisé des tokens, mots de passe, certificats. Rotation automatique des secrets et audit complet.',
    icon: '🔐',
    rating: 4.4,
    downloads: '6.2k',
    version: '1.15.0',
    author: 'HashiCorp',
    installed: false,
  },
  {
    id: '6',
    name: 'OpenAI',
    category: 'IA',
    description: 'API d\'intelligence artificielle',
    longDescription: 'Accès aux modèles GPT-4, DALL-E, Whisper et plus. Génération de texte, analyse d\'images, transcription audio, embeddings pour la recherche sémantique et assistants IA personnalisés.',
    icon: '🤖',
    rating: 4.7,
    downloads: '18.9k',
    version: '2.1.0',
    author: 'OpenAI',
    installed: true,
  },
  {
    id: '7',
    name: 'Notion',
    category: 'Productivité',
    description: 'Espace de travail tout-en-un',
    longDescription: 'Plateforme de productivité combinant notes, documents, bases de données, tableaux Kanban et wikis. Templates personnalisables et collaboration en temps réel pour les équipes.',
    icon: '📝',
    rating: 4.6,
    downloads: '11.2k',
    version: '3.8.1',
    author: 'Notion Labs',
    installed: false,
  },
  {
    id: '8',
    name: 'Prometheus',
    category: 'DevOps',
    description: 'Monitoring et alertes',
    longDescription: 'Système de monitoring et d\'alertes open-source. Collecte de métriques par scraping, stockage en séries temporelles, langage de requêtes PromQL, et intégration avec Grafana et Alertmanager.',
    icon: '🔥',
    rating: 4.5,
    downloads: '14.3k',
    version: '2.48.0',
    author: 'CNCF',
    installed: false,
  },
  {
    id: '9',
    name: 'Teams',
    category: 'Communication',
    description: 'Visioconférence et collaboration',
    longDescription: 'Plateforme de communication unifiée. Réunions vidéo, chat d\'équipe, partage de fichiers, tableaux blancs collaboratifs. Intégration native avec Microsoft 365 et applications tierces.',
    icon: '📹',
    rating: 4.1,
    downloads: '9.7k',
    version: '24.3.0',
    author: 'Microsoft',
    installed: false,
  },
  {
    id: '10',
    name: 'CrowdStrike',
    category: 'Sécurité',
    description: 'Protection des endpoints',
    longDescription: 'Plateforme de cybersécurité de nouvelle génération. Détection et réponse aux menaces en temps réel, analyse comportementale, threat intelligence et protection cloud-native des endpoints.',
    icon: '🛡️',
    rating: 4.3,
    downloads: '5.4k',
    version: '7.12.0',
    author: 'CrowdStrike',
    installed: false,
  },
  {
    id: '11',
    name: 'Claude',
    category: 'IA',
    description: 'Assistant IA conversationnel',
    longDescription: 'Assistant IA avancé par Anthropic. Analyse de documents, génération de code, raisonnement complexe, résumés. Fenêtre de contexte étendue et capacités de vision pour l\'analyse d\'images.',
    icon: '🧠',
    rating: 4.9,
    downloads: '20.3k',
    version: '3.5.0',
    author: 'Anthropic',
    installed: true,
  },
  {
    id: '12',
    name: 'Docker',
    category: 'DevOps',
    description: 'Conteneurisation d\'applications',
    longDescription: 'Plateforme de conteneurisation pour le développement et le déploiement d\'applications. Docker Engine, Docker Compose, registre d\'images, orchestration et gestion du cycle de vie des conteneurs.',
    icon: '🐳',
    rating: 4.7,
    downloads: '22.0k',
    version: '25.0.3',
    author: 'Docker Inc.',
    installed: true,
  },
  {
    id: '13',
    name: 'Confluence',
    category: 'Productivité',
    description: 'Wiki et documentation d\'équipe',
    longDescription: 'Espace de travail collaboratif pour la documentation. Création de pages et de blogs, templates, espaces d\'équipe, arbre de pages hiérarchique et recherche full-text.',
    icon: '📖',
    rating: 4.0,
    downloads: '7.1k',
    version: '8.7.0',
    author: 'Atlassian',
    installed: false,
  },
  {
    id: '14',
    name: 'Mattermost',
    category: 'Communication',
    description: 'Messagerie open-source auto-hébergée',
    longDescription: 'Alternative open-source à Slack. Messagerie d\'équipe auto-hébergée, canaux publics et privés, intégrations webhooks, compliance et archivage des messages.',
    icon: '💭',
    rating: 4.3,
    downloads: '4.8k',
    version: '9.4.0',
    author: 'Mattermost Inc.',
    installed: false,
  },
  {
    id: '15',
    name: 'SonarQube',
    category: 'Sécurité',
    description: 'Analyse de qualité du code',
    longDescription: 'Plateforme d\'inspection continue de la qualité du code. Détection de bugs, vulnérabilités et code smells. Support de 30+ langages, quality gates et rapports de dette technique.',
    icon: '🔍',
    rating: 4.2,
    downloads: '6.8k',
    version: '10.3.0',
    author: 'SonarSource',
    installed: false,
  },
  {
    id: '16',
    name: 'Hugging Face',
    category: 'IA',
    description: 'Hub de modèles ML',
    longDescription: 'Plateforme communautaire pour le machine learning. Hébergement de modèles, datasets, et spaces. Transformers, diffusers, accélération d\'inférence et fine-tuning de modèles.',
    icon: '🤗',
    rating: 4.8,
    downloads: '16.5k',
    version: '4.37.0',
    author: 'Hugging Face',
    installed: false,
  },
];

// --- Helpers ---

function renderStars(rating: number) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.25;
  const stars = [];
  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(
        <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      );
    } else if (i === fullStars && hasHalf) {
      stars.push(
        <Star key={i} className="h-3.5 w-3.5 fill-amber-400/50 text-amber-400" />
      );
    } else {
      stars.push(
        <Star key={i} className="h-3.5 w-3.5 text-muted-foreground/30" />
      );
    }
  }
  return stars;
}

const CATEGORY_COLORS: Record<string, string> = {
  Productivité: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Communication: 'bg-green-500/10 text-green-400 border-green-500/20',
  Sécurité: 'bg-red-500/10 text-red-400 border-red-500/20',
  DevOps: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  IA: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

// --- Component ---

export default function AppStorePage() {
  const [apps, setApps] = useState<MarketplaceApp[]>(INITIAL_APPS);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [detailApp, setDetailApp] = useState<MarketplaceApp | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState<MarketplaceApp | null>(null);

  const installedApps = useMemo(() => apps.filter((a) => a.installed), [apps]);

  const filteredApps = useMemo(() => {
    let result = apps.filter((a) => !a.installed);

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (app) =>
          app.name.toLowerCase().includes(q) ||
          app.description.toLowerCase().includes(q) ||
          app.category.toLowerCase().includes(q) ||
          app.author.toLowerCase().includes(q)
      );
    }

    if (activeCategory !== 'all') {
      result = result.filter((app) => app.category === activeCategory);
    }

    return result;
  }, [apps, search, activeCategory]);

  const handleInstall = (appId: string) => {
    setApps((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, installed: true } : a))
    );
    const app = apps.find((a) => a.id === appId);
    toast.success(`${app?.name} installé avec succès`);
    setDetailApp(null);
  };

  const handleUninstall = (appId: string) => {
    setApps((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, installed: false } : a))
    );
    const app = apps.find((a) => a.id === appId);
    toast.success(`${app?.name} désinstallé`);
    setConfirmUninstall(null);
    setDetailApp(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Marketplace</h1>
            <p className="text-sm text-muted-foreground">
              {apps.length} applications disponibles &middot; {installedApps.length} installée{installedApps.length > 1 ? 's' : ''}
            </p>
          </div>
          <Badge variant="outline" className="px-3 py-1.5 text-sm">
            <Package className="mr-2 h-4 w-4" />
            {installedApps.length} installée{installedApps.length > 1 ? 's' : ''}
          </Badge>
        </div>

        {/* Search bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une application..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(cat.id)}
              >
                <Icon className="mr-1.5 h-3.5 w-3.5" />
                {cat.label}
              </Button>
            );
          })}
        </div>

        {/* Installed apps section */}
        {installedApps.length > 0 && activeCategory === 'all' && !search && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Applications installées
              <Badge variant="secondary">{installedApps.length}</Badge>
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {installedApps.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  onDetail={setDetailApp}
                  onInstall={handleInstall}
                  onUninstall={(a) => setConfirmUninstall(a)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Available apps */}
        <div className="space-y-3">
          {(activeCategory !== 'all' || search) ? (
            <h2 className="text-lg font-semibold">
              Résultats
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filteredApps.length} application{filteredApps.length > 1 ? 's' : ''})
              </span>
            </h2>
          ) : (
            <h2 className="text-lg font-semibold">
              Découvrir
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filteredApps.length} disponible{filteredApps.length > 1 ? 's' : ''})
              </span>
            </h2>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredApps.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                onDetail={setDetailApp}
                onInstall={handleInstall}
                onUninstall={(a) => setConfirmUninstall(a)}
              />
            ))}
          </div>

          {filteredApps.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              Aucune application ne correspond à votre recherche
            </div>
          )}
        </div>
      </div>

      {/* App Detail Dialog */}
      <Dialog open={!!detailApp} onOpenChange={(open) => !open && setDetailApp(null)}>
        <DialogContent className="sm:max-w-lg">
          {detailApp && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{detailApp.icon}</div>
                  <div className="flex-1">
                    <DialogTitle className="text-xl">{detailApp.name}</DialogTitle>
                    <DialogDescription className="mt-1">
                      {detailApp.description}
                    </DialogDescription>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-0.5">
                        {renderStars(detailApp.rating)}
                        <span className="ml-1 text-sm text-muted-foreground">
                          {detailApp.rating}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={CATEGORY_COLORS[detailApp.category] || ''}
                      >
                        {detailApp.category}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {detailApp.longDescription}
                </p>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium">{detailApp.version}</div>
                    <div className="text-xs text-muted-foreground">Version</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium">{detailApp.downloads}</div>
                    <div className="text-xs text-muted-foreground">Téléchargements</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium">{detailApp.author}</div>
                    <div className="text-xs text-muted-foreground">Éditeur</div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                {detailApp.installed ? (
                  <div className="flex gap-2 w-full justify-end">
                    <Button variant="outline">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Ouvrir
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setConfirmUninstall(detailApp)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Désinstaller
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => handleInstall(detailApp.id)} className="w-full sm:w-auto">
                    <Download className="mr-2 h-4 w-4" />
                    Installer
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Uninstall confirmation dialog */}
      <Dialog
        open={!!confirmUninstall}
        onOpenChange={(open) => !open && setConfirmUninstall(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Désinstaller {confirmUninstall?.name} ?</DialogTitle>
            <DialogDescription>
              Cette action supprimera l&apos;application et ses données associées. Vous pourrez
              la réinstaller ultérieurement.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUninstall(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmUninstall && handleUninstall(confirmUninstall.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Désinstaller
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// --- App Card Sub-component ---

function AppCard({
  app,
  onDetail,
  onInstall,
  onUninstall,
}: {
  app: MarketplaceApp;
  onDetail: (app: MarketplaceApp) => void;
  onInstall: (id: string) => void;
  onUninstall: (app: MarketplaceApp) => void;
}) {
  return (
    <Card
      className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
      onClick={() => onDetail(app)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{app.icon}</div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{app.name}</h3>
              <p className="text-xs text-muted-foreground">{app.author}</p>
            </div>
          </div>
          {app.installed && (
            <Badge variant="secondary" className="shrink-0 text-green-500 border-green-500/20">
              <Check className="mr-1 h-3 w-3" />
              Installé
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <p className="text-sm text-muted-foreground line-clamp-2">{app.description}</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge
            variant="outline"
            className={`text-[10px] ${CATEGORY_COLORS[app.category] || ''}`}
          >
            {app.category}
          </Badge>
          <span className="text-xs text-muted-foreground">v{app.version}</span>
        </div>
      </CardContent>
      <CardFooter className="pt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {renderStars(app.rating)}
          <span className="ml-1 text-xs text-muted-foreground">{app.rating}</span>
        </div>
        {app.installed ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onUninstall(app);
            }}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Retirer
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onInstall(app.id);
            }}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            Installer
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
