'use client';

import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Search, ChevronDown, ChevronRight, Copy, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  auth?: boolean;
  admin?: boolean;
}

interface ApiService {
  name: string;
  port: number;
  prefix: string;
  description: string;
  endpoints: ApiEndpoint[];
}

// ---------------------------------------------------------------------------
// API Reference Data
// ---------------------------------------------------------------------------

const API_SERVICES: ApiService[] = [
  {
    name: 'Identity',
    port: 3001,
    prefix: '/api/v1',
    description: 'Authentification, utilisateurs, groupes, LDAP, RBAC',
    endpoints: [
      { method: 'POST', path: '/auth/login', description: 'Connexion utilisateur (retourne JWT)' },
      { method: 'POST', path: '/auth/refresh', description: 'Renouveler le token JWT', auth: true },
      { method: 'POST', path: '/auth/logout', description: 'Deconnexion (invalide le token)', auth: true },
      { method: 'GET', path: '/auth/sessions', description: 'Lister les sessions actives', auth: true },
      { method: 'DELETE', path: '/auth/sessions/:id', description: 'Revoquer une session', auth: true },
      { method: 'GET', path: '/auth/me', description: 'Profil de l\'utilisateur connecte', auth: true },
      { method: 'GET', path: '/users', description: 'Lister tous les utilisateurs', auth: true, admin: true },
      { method: 'POST', path: '/users', description: 'Creer un utilisateur', auth: true, admin: true },
      { method: 'GET', path: '/users/:id', description: 'Details d\'un utilisateur', auth: true },
      { method: 'PUT', path: '/users/:id', description: 'Modifier un utilisateur', auth: true, admin: true },
      { method: 'DELETE', path: '/users/:id', description: 'Supprimer un utilisateur', auth: true, admin: true },
      { method: 'GET', path: '/groups', description: 'Lister les groupes', auth: true },
      { method: 'POST', path: '/groups', description: 'Creer un groupe', auth: true, admin: true },
      { method: 'PUT', path: '/groups/:id', description: 'Modifier un groupe', auth: true, admin: true },
      { method: 'DELETE', path: '/groups/:id', description: 'Supprimer un groupe', auth: true, admin: true },
      { method: 'GET', path: '/ldap/config', description: 'Configuration LDAP', auth: true, admin: true },
      { method: 'PUT', path: '/ldap/config', description: 'Modifier la config LDAP', auth: true, admin: true },
      { method: 'POST', path: '/ldap/test', description: 'Tester la connexion LDAP', auth: true, admin: true },
      { method: 'POST', path: '/ldap/sync', description: 'Synchroniser les utilisateurs LDAP', auth: true, admin: true },
      { method: 'GET', path: '/roles', description: 'Lister les roles disponibles', auth: true },
      { method: 'GET', path: '/mfa/status', description: 'Statut 2FA de l\'utilisateur', auth: true },
      { method: 'POST', path: '/mfa/enable', description: 'Activer la 2FA', auth: true },
      { method: 'POST', path: '/mfa/verify', description: 'Verifier un code TOTP', auth: true },
      { method: 'POST', path: '/mfa/disable', description: 'Desactiver la 2FA', auth: true },
    ],
  },
  {
    name: 'Containers',
    port: 3002,
    prefix: '/api/v1',
    description: 'Gestion du cycle de vie des conteneurs Docker (bollard)',
    endpoints: [
      { method: 'GET', path: '/containers', description: 'Lister les conteneurs', auth: true },
      { method: 'POST', path: '/containers', description: 'Creer un conteneur', auth: true, admin: true },
      { method: 'GET', path: '/containers/:id', description: 'Details d\'un conteneur', auth: true },
      { method: 'POST', path: '/containers/:id/start', description: 'Demarrer un conteneur', auth: true },
      { method: 'POST', path: '/containers/:id/stop', description: 'Arreter un conteneur', auth: true },
      { method: 'POST', path: '/containers/:id/restart', description: 'Redemarrer un conteneur', auth: true },
      { method: 'DELETE', path: '/containers/:id', description: 'Supprimer un conteneur', auth: true, admin: true },
      { method: 'GET', path: '/containers/:id/logs', description: 'Logs d\'un conteneur (SSE)', auth: true },
      { method: 'GET', path: '/containers/:id/stats', description: 'Stats CPU/RAM d\'un conteneur', auth: true },
      { method: 'GET', path: '/images', description: 'Lister les images Docker', auth: true },
      { method: 'POST', path: '/images/pull', description: 'Telecharger une image', auth: true, admin: true },
      { method: 'DELETE', path: '/images/:id', description: 'Supprimer une image', auth: true, admin: true },
      { method: 'GET', path: '/networks', description: 'Lister les reseaux Docker', auth: true },
      { method: 'GET', path: '/volumes', description: 'Lister les volumes Docker', auth: true },
    ],
  },
  {
    name: 'Proxy',
    port: 3003,
    prefix: '/api/v1',
    description: 'Reverse proxy, TLS/ACME, SmartShield, routes',
    endpoints: [
      { method: 'GET', path: '/routes', description: 'Lister les routes proxy', auth: true },
      { method: 'POST', path: '/routes', description: 'Creer une route', auth: true, admin: true },
      { method: 'PUT', path: '/routes/:id', description: 'Modifier une route', auth: true, admin: true },
      { method: 'DELETE', path: '/routes/:id', description: 'Supprimer une route', auth: true, admin: true },
      { method: 'GET', path: '/certificates', description: 'Lister les certificats TLS', auth: true },
      { method: 'POST', path: '/certificates/acme', description: 'Demander un certificat ACME', auth: true, admin: true },
      { method: 'GET', path: '/smartshield/status', description: 'Statut SmartShield (WAF)', auth: true },
    ],
  },
  {
    name: 'Storage',
    port: 3004,
    prefix: '/api/v1',
    description: 'Stockage de fichiers (OpenDAL : local FS ou S3)',
    endpoints: [
      { method: 'GET', path: '/files', description: 'Lister les fichiers d\'un dossier', auth: true },
      { method: 'POST', path: '/files/upload', description: 'Telecharger un fichier (multipart)', auth: true },
      { method: 'GET', path: '/files/:id', description: 'Telecharger un fichier', auth: true },
      { method: 'GET', path: '/files/:id/metadata', description: 'Metadonnees d\'un fichier', auth: true },
      { method: 'PUT', path: '/files/:id', description: 'Modifier les metadonnees', auth: true },
      { method: 'DELETE', path: '/files/:id', description: 'Supprimer un fichier', auth: true },
      { method: 'POST', path: '/files/:id/share', description: 'Creer un lien de partage', auth: true },
      { method: 'GET', path: '/buckets', description: 'Lister les buckets/espaces', auth: true },
      { method: 'POST', path: '/buckets', description: 'Creer un bucket', auth: true, admin: true },
      { method: 'DELETE', path: '/buckets/:id', description: 'Supprimer un bucket', auth: true, admin: true },
      { method: 'GET', path: '/quota', description: 'Espace utilise / quota', auth: true },
    ],
  },
  {
    name: 'AI',
    port: 3005,
    prefix: '/api/v1',
    description: 'RAG, LLM (multi-provider + GGUF natif), pgvector, indexation',
    endpoints: [
      { method: 'POST', path: '/chat', description: 'Envoyer un message au LLM (streaming SSE)', auth: true },
      { method: 'POST', path: '/chat/completions', description: 'Completion OpenAI-compatible', auth: true },
      { method: 'GET', path: '/conversations', description: 'Lister les conversations', auth: true },
      { method: 'GET', path: '/conversations/:id', description: 'Historique d\'une conversation', auth: true },
      { method: 'DELETE', path: '/conversations/:id', description: 'Supprimer une conversation', auth: true },
      { method: 'POST', path: '/search', description: 'Recherche semantique (pgvector)', auth: true },
      { method: 'POST', path: '/index', description: 'Indexer un document pour RAG', auth: true },
      { method: 'GET', path: '/models', description: 'Lister les modeles disponibles', auth: true },
      { method: 'POST', path: '/image/generate', description: 'Generer une image (DALL-E / SD)', auth: true },
      { method: 'POST', path: '/embeddings', description: 'Calculer des embeddings', auth: true },
      { method: 'GET', path: '/providers', description: 'Lister les fournisseurs LLM configures', auth: true },
    ],
  },
  {
    name: 'SecureLink',
    port: 3006,
    prefix: '/api/v1',
    description: 'Tunnels web, DNS avec blocage publicitaire',
    endpoints: [
      { method: 'GET', path: '/tunnels', description: 'Lister les tunnels actifs', auth: true },
      { method: 'POST', path: '/tunnels', description: 'Creer un tunnel', auth: true },
      { method: 'DELETE', path: '/tunnels/:id', description: 'Fermer un tunnel', auth: true },
      { method: 'GET', path: '/dns/zones', description: 'Lister les zones DNS', auth: true },
      { method: 'POST', path: '/dns/zones', description: 'Creer une zone DNS', auth: true, admin: true },
      { method: 'GET', path: '/dns/blocklist', description: 'Liste de blocage DNS (ads)', auth: true },
      { method: 'PUT', path: '/dns/blocklist', description: 'Modifier la liste de blocage', auth: true, admin: true },
    ],
  },
  {
    name: 'Scheduler',
    port: 3007,
    prefix: '/api/v1',
    description: 'Gestion des taches planifiees (CRON)',
    endpoints: [
      { method: 'GET', path: '/jobs', description: 'Lister les taches planifiees', auth: true },
      { method: 'POST', path: '/jobs', description: 'Creer une tache CRON', auth: true, admin: true },
      { method: 'GET', path: '/jobs/:id', description: 'Details d\'une tache', auth: true },
      { method: 'PUT', path: '/jobs/:id', description: 'Modifier une tache', auth: true, admin: true },
      { method: 'DELETE', path: '/jobs/:id', description: 'Supprimer une tache', auth: true, admin: true },
      { method: 'POST', path: '/jobs/:id/run', description: 'Executer immediatement', auth: true, admin: true },
      { method: 'GET', path: '/jobs/:id/history', description: 'Historique d\'execution', auth: true },
    ],
  },
  {
    name: 'Metrics',
    port: 3008,
    prefix: '/api/v1',
    description: 'Monitoring systeme, Prometheus, alertes',
    endpoints: [
      { method: 'GET', path: '/metrics', description: 'Metriques systeme (CPU, RAM, disque)', auth: true },
      { method: 'GET', path: '/metrics/prometheus', description: 'Export Prometheus format', auth: true },
      { method: 'GET', path: '/health', description: 'Health check de tous les services' },
      { method: 'GET', path: '/alerts', description: 'Lister les alertes actives', auth: true },
      { method: 'POST', path: '/alerts', description: 'Creer une regle d\'alerte', auth: true, admin: true },
      { method: 'PUT', path: '/alerts/:id', description: 'Modifier une alerte', auth: true, admin: true },
      { method: 'DELETE', path: '/alerts/:id', description: 'Supprimer une alerte', auth: true, admin: true },
    ],
  },
  {
    name: 'Media',
    port: 3009,
    prefix: '/api/v1',
    description: 'STT/TTS/OCR natif (whisper-rs, piper-rs, ocrs), pipeline vocale WebSocket',
    endpoints: [
      { method: 'POST', path: '/stt/transcribe', description: 'Transcrire un fichier audio (whisper)', auth: true },
      { method: 'POST', path: '/tts/synthesize', description: 'Synthese vocale (piper)', auth: true },
      { method: 'POST', path: '/ocr/extract', description: 'Extraire le texte d\'une image (ocrs)', auth: true },
      { method: 'GET', path: '/voices', description: 'Lister les voix TTS disponibles', auth: true },
      { method: 'GET', path: '/models', description: 'Lister les modeles media charges', auth: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// Method badge colors
// ---------------------------------------------------------------------------

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-500/10 text-green-700 border-green-500/20',
  POST: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  PUT: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
  PATCH: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
  DELETE: 'bg-red-500/10 text-red-700 border-red-500/20',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApiDocsPage() {
  const [search, setSearch] = useState('');
  const [expandedServices, setExpandedServices] = useState<Set<string>>(
    new Set(API_SERVICES.map((s) => s.name)),
  );
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const toggleService = (name: string) => {
    setExpandedServices((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const expandAll = () => setExpandedServices(new Set(API_SERVICES.map((s) => s.name)));
  const collapseAll = () => setExpandedServices(new Set());

  const filteredServices = useMemo(() => {
    if (!search.trim()) return API_SERVICES;
    const q = search.toLowerCase();
    return API_SERVICES.map((service) => ({
      ...service,
      endpoints: service.endpoints.filter(
        (ep) =>
          ep.path.toLowerCase().includes(q) ||
          ep.description.toLowerCase().includes(q) ||
          ep.method.toLowerCase().includes(q) ||
          service.name.toLowerCase().includes(q),
      ),
    })).filter((s) => s.endpoints.length > 0);
  }, [search]);

  const totalEndpoints = API_SERVICES.reduce((sum, s) => sum + s.endpoints.length, 0);
  const filteredCount = filteredServices.reduce((sum, s) => sum + s.endpoints.length, 0);

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
    toast.success('Chemin copie');
  };

  return (
    <AppLayout>
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Documentation API</h1>
              <p className="text-sm text-muted-foreground">
                Reference interactive de tous les endpoints SignApps
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">
              {filteredCount} / {totalEndpoints} endpoints
            </Badge>
            <Badge variant="outline">{API_SERVICES.length} services</Badge>
          </div>
        </div>

        {/* Search + controls */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un endpoint, service, methode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="sm" onClick={expandAll}>
            Tout ouvrir
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Tout fermer
          </Button>
        </div>

        {/* Service groups */}
        <div className="space-y-4">
          {filteredServices.map((service) => {
            const isExpanded = expandedServices.has(service.name);
            return (
              <Card key={service.name}>
                <CardHeader
                  className="cursor-pointer select-none py-4"
                  onClick={() => toggleService(service.name)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {service.name}
                          <Badge variant="secondary" className="font-mono text-xs">
                            :{service.port}
                          </Badge>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {service.description}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {service.endpoints.length} endpoint
                      {service.endpoints.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="pt-0 pb-2">
                    <div className="divide-y">
                      {service.endpoints.map((ep, idx) => {
                        const fullPath = `${service.prefix}${ep.path}`;
                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-3 py-2.5 px-2 hover:bg-accent/40 rounded transition-colors group"
                          >
                            {/* Method badge */}
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded border min-w-[56px] text-center ${METHOD_COLORS[ep.method] || 'bg-muted text-muted-foreground'}`}
                            >
                              {ep.method}
                            </span>

                            {/* Path */}
                            <code className="text-sm font-mono flex-1">{fullPath}</code>

                            {/* Badges */}
                            <div className="flex items-center gap-1.5">
                              {ep.auth && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  AUTH
                                </Badge>
                              )}
                              {ep.admin && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 border-red-500/30 text-red-600"
                                >
                                  ADMIN
                                </Badge>
                              )}
                            </div>

                            {/* Description */}
                            <span className="text-xs text-muted-foreground min-w-[200px] text-right">
                              {ep.description}
                            </span>

                            {/* Copy button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyPath(fullPath);
                              }}
                            >
                              {copiedPath === fullPath ? (
                                <Check className="h-3.5 w-3.5 text-green-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          {filteredServices.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground">
                  Aucun endpoint ne correspond a la recherche &quot;{search}&quot;
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Base URL info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Convention d&apos;URL</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Tous les services exposent leurs API sous <code className="bg-muted px-1 rounded">/api/v1/...</code>.
              En mode developpement, le frontend se connecte directement au port de chaque service.
            </p>
            <p>
              L&apos;authentification se fait par JWT dans le header{' '}
              <code className="bg-muted px-1 rounded">Authorization: Bearer &lt;token&gt;</code>.
              Les endpoints marques <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/30 text-red-600">ADMIN</Badge>{' '}
              necessitent le role administrateur.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
