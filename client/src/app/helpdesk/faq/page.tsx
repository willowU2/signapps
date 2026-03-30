'use client';

import { useState, useEffect } from 'react';
import { usePageTitle } from '@/hooks/use-page-title';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Search,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Ticket,
  BookOpen,
} from 'lucide-react';
import { AiChatbot } from '@/components/helpdesk/ai-chatbot';

// ── Types ──
interface FaqArticle {
  id: string;
  question: string;
  answer: string;
  category: string;
  likes: number;
  dislikes: number;
  userVote?: 'like' | 'dislike' | null;
}

interface FaqCategory {
  id: string;
  label: string;
  icon: string;
}

// ── Data ──
const FAQ_CATEGORIES: FaqCategory[] = [
  { id: 'getting-started', label: 'Prise en main', icon: '🚀' },
  { id: 'account', label: 'Compte et acces', icon: '👤' },
  { id: 'billing', label: 'Facturation', icon: '💳' },
  { id: 'features', label: 'Fonctionnalites', icon: '⚙️' },
  { id: 'security', label: 'Securite', icon: '🔒' },
  { id: 'integrations', label: 'Integrations', icon: '🔗' },
];

const INITIAL_ARTICLES: FaqArticle[] = [
  {
    id: 'a1',
    question: 'Comment creer mon premier compte ?',
    answer: 'Pour creer votre compte, rendez-vous sur la page de connexion et cliquez sur "Creer un compte". Renseignez votre email professionnel et suivez les instructions de configuration. Un email de verification vous sera envoye.',
    category: 'getting-started',
    likes: 42,
    dislikes: 2,
    userVote: null,
  },
  {
    id: 'a2',
    question: 'Comment inviter des membres dans mon espace de travail ?',
    answer: 'Depuis les Parametres > Membres, cliquez sur "Inviter". Saisissez les adresses email de vos collaborateurs et definissez leur role (Admin, Editeur, Lecteur). Ils recevront une invitation par email valable 7 jours.',
    category: 'getting-started',
    likes: 38,
    dislikes: 1,
    userVote: null,
  },
  {
    id: 'a3',
    question: 'Comment changer mon mot de passe ?',
    answer: 'Allez dans Parametres > Securite > Mot de passe. Saisissez votre mot de passe actuel puis le nouveau deux fois pour confirmation. Le mot de passe doit contenir au moins 8 caracteres, une majuscule et un chiffre.',
    category: 'account',
    likes: 29,
    dislikes: 0,
    userVote: null,
  },
  {
    id: 'a4',
    question: 'Comment activer l\'authentification a deux facteurs (2FA) ?',
    answer: 'Rendez-vous dans Parametres > Securite > Authentification. Cliquez sur "Activer la 2FA" et scannez le QR code avec une application d\'authentification (Google Authenticator, Authy). Entrez le code a 6 chiffres pour confirmer.',
    category: 'security',
    likes: 55,
    dislikes: 3,
    userVote: null,
  },
  {
    id: 'a5',
    question: 'Quelles sont les options de facturation disponibles ?',
    answer: 'SignApps propose trois plans : Starter (gratuit, 5 utilisateurs), Business (19€/utilisateur/mois) et Enterprise (tarif sur mesure). La facturation est mensuelle ou annuelle avec -20% sur l\'annuel. Cartes bancaires, virements SEPA et bons de commande acceptes.',
    category: 'billing',
    likes: 67,
    dislikes: 5,
    userVote: null,
  },
  {
    id: 'a6',
    question: 'Comment telecharger ma facture ?',
    answer: 'Dans Parametres > Facturation > Historique, vous retrouvez toutes vos factures. Cliquez sur l\'icone de telechargement a cote de la facture souhaitee. Les factures sont au format PDF avec les mentions legales obligatoires.',
    category: 'billing',
    likes: 44,
    dislikes: 1,
    userVote: null,
  },
  {
    id: 'a7',
    question: 'Comment creer un formulaire avec signature electronique ?',
    answer: 'Dans l\'application Formulaires, cliquez sur "Nouveau formulaire". Ajoutez vos champs puis depuis la palette de champs, selectionnez "Signature electronique". Vous pouvez definir les signataires et configurer les rappels automatiques.',
    category: 'features',
    likes: 89,
    dislikes: 4,
    userVote: null,
  },
  {
    id: 'a8',
    question: 'Quelles integrations sont disponibles ?',
    answer: 'SignApps s\'integre avec : Slack, Teams, Zapier, Make, Google Workspace, Microsoft 365, Salesforce, HubSpot et plus de 200 applications via Zapier. Les integrations se configurent dans Parametres > Integrations.',
    category: 'integrations',
    likes: 76,
    dislikes: 6,
    userVote: null,
  },
  {
    id: 'a9',
    question: 'Ou sont stockees mes donnees ?',
    answer: 'Vos donnees sont hebergees en France dans des datacenters certifies ISO 27001 et HDS. SignApps est conforme RGPD. Vous pouvez exporter toutes vos donnees a tout moment depuis Parametres > Confidentialite > Exporter mes donnees.',
    category: 'security',
    likes: 102,
    dislikes: 2,
    userVote: null,
  },
];

const STORAGE_KEY_VOTES = 'signapps-faq-votes';

export default function FaqPage() {
  usePageTitle('FAQ');
  const [articles, setArticles] = useState<FaqArticle[]>(INITIAL_ARTICLES);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [openArticles, setOpenArticles] = useState<Set<string>>(new Set());

  // Load votes from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_VOTES);
      if (stored) {
        const votes = JSON.parse(stored) as Record<string, 'like' | 'dislike'>;
        setArticles((prev) =>
          prev.map((a) => ({ ...a, userVote: votes[a.id] ?? null }))
        );
      }
    } catch { /* ignore */ }
  }, []);

  const toggleArticle = (id: string) => {
    setOpenArticles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleVote = (articleId: string, vote: 'like' | 'dislike') => {
    setArticles((prev) => {
      const updated = prev.map((a) => {
        if (a.id !== articleId) return a;
        const prev_vote = a.userVote;
        if (prev_vote === vote) {
          // Toggle off
          return {
            ...a,
            userVote: null,
            likes: vote === 'like' ? a.likes - 1 : a.likes,
            dislikes: vote === 'dislike' ? a.dislikes - 1 : a.dislikes,
          };
        }
        return {
          ...a,
          userVote: vote,
          likes: vote === 'like' ? a.likes + 1 : prev_vote === 'like' ? a.likes - 1 : a.likes,
          dislikes: vote === 'dislike' ? a.dislikes + 1 : prev_vote === 'dislike' ? a.dislikes - 1 : a.dislikes,
        };
      });

      // Persist votes
      const votes: Record<string, string> = {};
      updated.forEach((a) => { if (a.userVote) votes[a.id] = a.userVote; });
      try { localStorage.setItem(STORAGE_KEY_VOTES, JSON.stringify(votes)); } catch { /* ignore */ }

      return updated;
    });
  };

  const filtered = articles.filter((a) => {
    const matchSearch =
      !search ||
      a.question.toLowerCase().includes(search.toLowerCase()) ||
      a.answer.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !activeCategory || a.category === activeCategory;
    return matchSearch && matchCategory;
  });

  const groupedByCategory = FAQ_CATEGORIES.map((cat) => ({
    ...cat,
    articles: filtered.filter((a) => a.category === cat.id),
  })).filter((cat) => cat.articles.length > 0);

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto" id="main-content">
        {/* Header */}
        <div className="text-center py-6">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Centre d'aide</h1>
          <p className="text-muted-foreground mt-2">
            Trouvez rapidement des reponses a vos questions
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher dans la FAQ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-base"
            aria-label="Rechercher dans la FAQ"
          />
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !activeCategory
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            }`}
          >
            Toutes les categories
          </button>
          {FAQ_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Results count */}
        {search && (
          <p className="text-sm text-muted-foreground text-center">
            {filtered.length} resultat{filtered.length !== 1 ? 's' : ''} pour "{search}"
          </p>
        )}

        {/* Articles grouped by category */}
        {groupedByCategory.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">Aucun article trouve</p>
              <p className="text-sm text-muted-foreground mt-1">
                Essayez une recherche differente ou ouvrez un ticket de support.
              </p>
              <Button className="mt-4" asChild>
                <a href="/helpdesk">
                  <Ticket className="w-4 h-4 mr-2" />
                  Ouvrir un ticket
                </a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groupedByCategory.map((cat) => (
              <div key={cat.id}>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span role="img" aria-label={cat.label}>{cat.icon}</span>
                  {cat.label}
                  <Badge variant="secondary" className="ml-1">{cat.articles.length}</Badge>
                </h2>
                <div className="space-y-2">
                  {cat.articles.map((article) => {
                    const isOpen = openArticles.has(article.id);
                    return (
                      <Collapsible
                        key={article.id}
                        open={isOpen}
                        onOpenChange={() => toggleArticle(article.id)}
                      >
                        <Card className={`transition-colors ${isOpen ? 'border-primary/40' : ''}`}>
                          <CollapsibleTrigger asChild>
                            <button className="w-full text-left">
                              <CardHeader className="py-4">
                                <div className="flex items-center justify-between gap-3">
                                  <CardTitle className="text-base font-medium">
                                    {article.question}
                                  </CardTitle>
                                  {isOpen ? (
                                    <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                                  )}
                                </div>
                              </CardHeader>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <CardContent className="pt-0 pb-4">
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {article.answer}
                              </p>
                              {/* Like/Dislike */}
                              <div className="flex items-center gap-3 mt-4 pt-3 border-t">
                                <span className="text-xs text-muted-foreground">Cet article vous a aide ?</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleVote(article.id, 'like'); }}
                                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
                                    article.userVote === 'like'
                                      ? 'bg-green-100 text-green-700'
                                      : 'hover:bg-muted text-muted-foreground'
                                  }`}
                                  aria-label={`J'aime cet article (${article.likes})`}
                                  aria-pressed={article.userVote === 'like'}
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                  {article.likes}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleVote(article.id, 'dislike'); }}
                                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
                                    article.userVote === 'dislike'
                                      ? 'bg-red-100 text-red-700'
                                      : 'hover:bg-muted text-muted-foreground'
                                  }`}
                                  aria-label={`Je n'aime pas cet article (${article.dislikes})`}
                                  aria-pressed={article.userVote === 'dislike'}
                                >
                                  <ThumbsDown className="w-3 h-3" />
                                  {article.dislikes}
                                </button>
                              </div>
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-6 text-center">
            <HelpCircle className="w-8 h-8 text-primary mx-auto mb-3" />
            <h3 className="font-semibold text-lg">Pas trouve ce que vous cherchez ?</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Notre equipe de support est disponible pour vous aider.
            </p>
            <Button asChild>
              <a href="/helpdesk">
                <Ticket className="w-4 h-4 mr-2" />
                Ouvrir un ticket de support
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* AI chatbot */}
      <AiChatbot />
    </AppLayout>
  );
}
