'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Store, Search, Filter, Plus, Users, Star, Send } from 'lucide-react';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Platform = 'twitter' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'facebook';
type Niche = 'tech' | 'fashion' | 'fitness' | 'food' | 'travel' | 'business' | 'gaming' | 'other';

interface MarketplaceOffer {
  id: string;
  authorName: string;
  authorAvatar: string;
  platform: Platform;
  followers: number;
  niche: Niche;
  description: string;
  price: number; // EUR
  rating: number;
  reviewCount: number;
  turnaround: string; // e.g. "3 days"
  status: 'available' | 'pending' | 'accepted';
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Mock data (ready for backend)
// ---------------------------------------------------------------------------

const MOCK_OFFERS: MarketplaceOffer[] = [
  {
    id: 'offer_1',
    authorName: 'Sarah M.',
    authorAvatar: 'SM',
    platform: 'instagram',
    followers: 45000,
    niche: 'fashion',
    description: "I'll create a genuine story + feed post about your product to my engaged fashion audience.",
    price: 150,
    rating: 4.8,
    reviewCount: 34,
    turnaround: '3 days',
    status: 'available',
    createdAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'offer_2',
    authorName: 'Alex K.',
    authorAvatar: 'AK',
    platform: 'twitter',
    followers: 12000,
    niche: 'tech',
    description: 'Thread + tweet about your SaaS product to my tech-savvy followers.',
    price: 80,
    rating: 4.5,
    reviewCount: 19,
    turnaround: '1 day',
    status: 'available',
    createdAt: '2026-03-05T14:30:00Z',
  },
  {
    id: 'offer_3',
    authorName: 'Maria L.',
    authorAvatar: 'ML',
    platform: 'tiktok',
    followers: 200000,
    niche: 'fitness',
    description: '60s Reel/TikTok featuring your product in an authentic workout context.',
    price: 400,
    rating: 4.9,
    reviewCount: 71,
    turnaround: '5 days',
    status: 'available',
    createdAt: '2026-03-10T09:15:00Z',
  },
  {
    id: 'offer_4',
    authorName: 'James T.',
    authorAvatar: 'JT',
    platform: 'linkedin',
    followers: 8500,
    niche: 'business',
    description: 'Professional article or post promoting your B2B product/service.',
    price: 200,
    rating: 4.7,
    reviewCount: 28,
    turnaround: '2 days',
    status: 'available',
    createdAt: '2026-03-12T11:00:00Z',
  },
  {
    id: 'offer_5',
    authorName: 'Yuki N.',
    authorAvatar: 'YN',
    platform: 'youtube',
    followers: 55000,
    niche: 'gaming',
    description: 'Product placement or dedicated review in my weekly gaming video.',
    price: 600,
    rating: 4.6,
    reviewCount: 42,
    turnaround: '7 days',
    status: 'available',
    createdAt: '2026-03-15T16:00:00Z',
  },
];

const STORAGE_KEY = 'signapps_marketplace_offers';

function loadOffers(): MarketplaceOffer[] {
  if (typeof window === 'undefined') return MOCK_OFFERS;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return stored ?? MOCK_OFFERS;
  } catch {
    return MOCK_OFFERS;
  }
}

function saveOffers(offers: MarketplaceOffer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(offers));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const PLATFORM_COLORS: Record<Platform, string> = {
  twitter: 'bg-black text-white',
  instagram: 'bg-pink-500 text-white',
  linkedin: 'bg-blue-600 text-white',
  tiktok: 'bg-gray-900 text-white',
  youtube: 'bg-red-600 text-white',
  facebook: 'bg-blue-500 text-white',
};

// ---------------------------------------------------------------------------
// Offer card
// ---------------------------------------------------------------------------

interface OfferCardProps {
  offer: MarketplaceOffer;
  onRequest: (offer: MarketplaceOffer) => void;
}

function OfferCard({ offer, onRequest }: OfferCardProps) {
  return (
    <Card className="flex flex-col h-full">
      <CardContent className="pt-5 flex flex-col flex-1 gap-3">
        {/* Author */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
            {offer.authorAvatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{offer.authorName}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge
                className={`text-xs ${PLATFORM_COLORS[offer.platform]} capitalize`}
                variant="outline"
              >
                {offer.platform}
              </Badge>
              <span className="text-xs text-muted-foreground">
                <Users className="inline h-3 w-3 mr-0.5" />
                {formatFollowers(offer.followers)}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-sm">{offer.price}€</p>
            <p className="text-xs text-muted-foreground">{offer.turnaround}</p>
          </div>
        </div>

        {/* Niche badge */}
        <Badge variant="secondary" className="text-xs w-fit capitalize">
          {offer.niche}
        </Badge>

        {/* Description */}
        <p className="text-sm text-muted-foreground flex-1 line-clamp-3">{offer.description}</p>

        {/* Rating */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
          <span className="font-medium">{offer.rating}</span>
          <span>({offer.reviewCount} reviews)</span>
        </div>

        <Separator />

        {/* CTA */}
        <Button
          size="sm"
          className="w-full"
          disabled={offer.status !== 'available'}
          onClick={() => onRequest(offer)}
        >
          <Send className="h-3.5 w-3.5 mr-1" />
          {offer.status === 'available' ? 'Request' : offer.status === 'pending' ? 'Pending…' : 'Accepted'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// New offer form
// ---------------------------------------------------------------------------

interface NewOfferFormProps {
  onCreated: (offer: MarketplaceOffer) => void;
  onClose: () => void;
}

function NewOfferForm({ onCreated, onClose }: NewOfferFormProps) {
  const [form, setForm] = useState({
    platform: 'instagram' as Platform,
    followers: '',
    niche: 'other' as Niche,
    description: '',
    price: '',
    turnaround: '3 days',
  });

  const handleSubmit = () => {
    if (!form.description.trim() || !form.price || !form.followers) {
      toast.error('Please fill all required fields');
      return;
    }
    const offer: MarketplaceOffer = {
      id: `offer_${Date.now()}`,
      authorName: 'You',
      authorAvatar: 'ME',
      platform: form.platform,
      followers: parseInt(form.followers) || 0,
      niche: form.niche,
      description: form.description,
      price: parseFloat(form.price) || 0,
      rating: 0,
      reviewCount: 0,
      turnaround: form.turnaround,
      status: 'available',
      createdAt: new Date().toISOString(),
    };
    onCreated(offer);
    toast.success('Offer published');
    onClose();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Platform *</Label>
          <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v as Platform })}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(['twitter', 'instagram', 'linkedin', 'tiktok', 'youtube', 'facebook'] as Platform[]).map((p) => (
                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Niche *</Label>
          <Select value={form.niche} onValueChange={(v) => setForm({ ...form, niche: v as Niche })}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(['tech', 'fashion', 'fitness', 'food', 'travel', 'business', 'gaming', 'other'] as Niche[]).map((n) => (
                <SelectItem key={n} value={n} className="capitalize">{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Followers *</Label>
          <Input
            type="number"
            placeholder="10000"
            value={form.followers}
            onChange={(e) => setForm({ ...form, followers: e.target.value })}
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Price (€) *</Label>
          <Input
            type="number"
            placeholder="150"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Turnaround</Label>
        <Input
          placeholder="3 days"
          value={form.turnaround}
          onChange={(e) => setForm({ ...form, turnaround: e.target.value })}
          className="text-sm"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Description *</Label>
        <Textarea
          placeholder="What will you deliver?"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="min-h-[80px] resize-none text-sm"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit}>Publish Offer</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SocialMarketplacePage() {
  const [offers, setOffers] = useState<MarketplaceOffer[]>(loadOffers);
  const [search, setSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<Platform | 'all'>('all');
  const [filterNiche, setFilterNiche] = useState<Niche | 'all'>('all');
  const [maxPrice, setMaxPrice] = useState('');
  const [newOfferOpen, setNewOfferOpen] = useState(false);

  const filtered = useMemo(() => {
    return offers.filter((o) => {
      if (filterPlatform !== 'all' && o.platform !== filterPlatform) return false;
      if (filterNiche !== 'all' && o.niche !== filterNiche) return false;
      if (maxPrice && o.price > parseFloat(maxPrice)) return false;
      if (search && !o.description.toLowerCase().includes(search.toLowerCase()) && !o.authorName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [offers, filterPlatform, filterNiche, maxPrice, search]);

  const handleRequest = useCallback((offer: MarketplaceOffer) => {
    const updated = offers.map((o) =>
      o.id === offer.id ? { ...o, status: 'pending' as const } : o
    );
    setOffers(updated);
    saveOffers(updated);
    toast.success(`Request sent to ${offer.authorName}`);
  }, [offers]);

  const handleCreated = useCallback((offer: MarketplaceOffer) => {
    const updated = [offer, ...offers];
    setOffers(updated);
    saveOffers(updated);
  }, [offers]);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Social Marketplace</h1>
            <p className="text-sm text-muted-foreground">
              Find influencers to promote your content
            </p>
          </div>
        </div>
        <Dialog open={newOfferOpen} onOpenChange={setNewOfferOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Post an Offer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Post a New Offer</DialogTitle>
            </DialogHeader>
            <NewOfferForm onCreated={handleCreated} onClose={() => setNewOfferOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px] space-y-1">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search offers…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Platform</Label>
              <Select value={filterPlatform} onValueChange={(v) => setFilterPlatform(v as any)}>
                <SelectTrigger className="text-sm w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All platforms</SelectItem>
                  {(['twitter', 'instagram', 'linkedin', 'tiktok', 'youtube', 'facebook'] as Platform[]).map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Niche</Label>
              <Select value={filterNiche} onValueChange={(v) => setFilterNiche(v as any)}>
                <SelectTrigger className="text-sm w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All niches</SelectItem>
                  {(['tech', 'fashion', 'fitness', 'food', 'travel', 'business', 'gaming', 'other'] as Niche[]).map((n) => (
                    <SelectItem key={n} value={n} className="capitalize">{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Max price (€)</Label>
              <Input
                type="number"
                placeholder="500"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="text-sm w-[100px]"
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(''); setFilterPlatform('all'); setFilterNiche('all'); setMaxPrice(''); }}
            >
              <Filter className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div>
        <p className="text-sm text-muted-foreground mb-3">{filtered.length} offer{filtered.length !== 1 ? 's' : ''} found</p>
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No offers match your filters
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((offer) => (
              <OfferCard key={offer.id} offer={offer} onRequest={handleRequest} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
