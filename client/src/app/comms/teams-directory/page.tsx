'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Search, Hash, Lock, Globe, MessageSquare, Settings } from 'lucide-react';
import { usePageTitle } from '@/hooks/use-page-title';

interface TeamChannel {
  id: string;
  name: string;
  description: string;
  type: 'public' | 'private';
  members: number;
  lastActive: string;
  tags: string[];
  owner: string;
  category: string;
}

const TEAMS: TeamChannel[] = [
  { id: '1', name: 'Engineering', description: 'All things code, architecture, and technical decisions', type: 'public', members: 24, lastActive: '2 min ago', tags: ['development', 'tech'], owner: 'Alice M.', category: 'Technical' },
  { id: '2', name: 'Product', description: 'Product roadmap, specs, and feature discussions', type: 'public', members: 12, lastActive: '15 min ago', tags: ['roadmap', 'ux'], owner: 'Bob K.', category: 'Product' },
  { id: '3', name: 'Sales', description: 'Sales pipeline, leads, and customer updates', type: 'public', members: 18, lastActive: '1 hour ago', tags: ['crm', 'revenue'], owner: 'Carol P.', category: 'Business' },
  { id: '4', name: 'HR', description: 'Human resources, recruitment, and people ops', type: 'public', members: 8, lastActive: '3 hours ago', tags: ['people', 'recruitment'], owner: 'Dave L.', category: 'Operations' },
  { id: '5', name: 'IT Support', description: 'Technical support and infrastructure', type: 'public', members: 6, lastActive: '30 min ago', tags: ['support', 'infra'], owner: 'Eve S.', category: 'Technical' },
  { id: '6', name: 'Finance', description: 'Budget, accounting, and financial reporting', type: 'private', members: 5, lastActive: '1 day ago', tags: ['budget', 'accounting'], owner: 'Frank B.', category: 'Business' },
  { id: '7', name: 'Marketing', description: 'Campaigns, content, and brand management', type: 'public', members: 9, lastActive: '45 min ago', tags: ['content', 'brand'], owner: 'Grace T.', category: 'Business' },
  { id: '8', name: 'Design', description: 'UX/UI design, assets, and design system', type: 'public', members: 7, lastActive: '20 min ago', tags: ['design', 'ui'], owner: 'Henry W.', category: 'Product' },
  { id: '9', name: 'Legal', description: 'Contracts, compliance, and legal matters', type: 'private', members: 4, lastActive: '2 days ago', tags: ['contracts', 'compliance'], owner: 'Iris N.', category: 'Operations' },
  { id: '10', name: 'Customer Success', description: 'Onboarding, support, and customer health', type: 'public', members: 11, lastActive: '5 min ago', tags: ['support', 'cx'], owner: 'Jack O.', category: 'Business' },
  { id: '11', name: 'DevOps', description: 'CI/CD, deployments, infrastructure management', type: 'public', members: 5, lastActive: '10 min ago', tags: ['devops', 'ci-cd'], owner: 'Kate R.', category: 'Technical' },
  { id: '12', name: 'Data', description: 'Analytics, BI, and data engineering', type: 'public', members: 6, lastActive: '2 hours ago', tags: ['analytics', 'bi'], owner: 'Leo M.', category: 'Technical' },
];

const CATEGORIES = ['All', 'Technical', 'Product', 'Business', 'Operations'];

export default function TeamsDirectoryPage() {
  usePageTitle('Annuaire equipes');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [typeFilter, setTypeFilter] = useState<'all' | 'public' | 'private'>('all');

  const filtered = TEAMS.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase()) || t.tags.some(tag => tag.includes(search.toLowerCase()));
    const matchCat = category === 'All' || t.category === category;
    const matchType = typeFilter === 'all' || t.type === typeFilter;
    return matchSearch && matchCat && matchType;
  });

  const grouped = CATEGORIES.slice(1).reduce((acc, cat) => {
    const teams = filtered.filter(t => t.category === cat);
    if (teams.length > 0) acc[cat] = teams;
    return acc;
  }, {} as Record<string, TeamChannel[]>);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Teams Directory</h1>
            <p className="text-sm text-muted-foreground">Browse all teams and channels across the organization</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="pl-9" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', 'public', 'private'].map(t => (
              <Button key={t} variant={typeFilter === t ? 'default' : 'outline'} size="sm" onClick={() => setTypeFilter(t as typeof typeFilter)} className="capitalize">{t === 'public' ? <Globe className="h-3.5 w-3.5 mr-1" /> : t === 'private' ? <Lock className="h-3.5 w-3.5 mr-1" /> : null}{t}</Button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(c => (
            <Button key={c} variant={category === c ? 'default' : 'outline'} size="sm" onClick={() => setCategory(c)}>{c}</Button>
          ))}
        </div>

        {category === 'All' ? (
          <div className="space-y-8">
            {Object.entries(grouped).map(([cat, teams]) => (
              <div key={cat}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{cat}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teams.map(team => <TeamCard key={team.id} team={team} />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(team => <TeamCard key={team.id} team={team} />)}
          </div>
        )}

        {filtered.length === 0 && (
          <Card className="border-dashed"><CardContent className="flex flex-col items-center py-12 text-muted-foreground"><Users className="h-8 w-8 mb-2 opacity-30" /><p>No teams match your search</p></CardContent></Card>
        )}

        <div className="text-xs text-muted-foreground text-right">{filtered.length} of {TEAMS.length} teams shown</div>
      </div>
    </AppLayout>
  );
}

function TeamCard({ team }: { team: TeamChannel }) {
  const initials = team.name.slice(0, 2).toUpperCase();
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 rounded-lg"><AvatarFallback className="rounded-lg text-xs font-bold">{initials}</AvatarFallback></Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-semibold text-sm">{team.name}</span>
              {team.type === 'private' ? <Lock className="h-3 w-3 text-muted-foreground ml-auto" /> : <Globe className="h-3 w-3 text-muted-foreground ml-auto opacity-50" />}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{team.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {team.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">#{tag}</Badge>)}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{team.members} members</span>
          <span>{team.lastActive}</span>
        </div>
        <Button size="sm" className="w-full" variant="outline">
          <MessageSquare className="h-3.5 w-3.5 mr-1.5" />Open Channel
        </Button>
      </CardContent>
    </Card>
  );
}
