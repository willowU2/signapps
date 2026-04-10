"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Store,
  Search,
  Filter,
  Plus,
  Users,
  Star,
  Send,
  AlertCircle,
  RefreshCw,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  socialApi,
  type MarketplaceOffer,
  type MarketplacePlatform,
  type MarketplaceNiche,
} from "@/lib/api/social";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const PLATFORM_COLORS: Record<MarketplacePlatform, string> = {
  twitter: "bg-black text-white",
  instagram: "bg-pink-500 text-white",
  linkedin: "bg-blue-600 text-white",
  tiktok: "bg-gray-900 text-white",
  youtube: "bg-red-600 text-white",
  facebook: "bg-blue-500 text-white",
};

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function OfferCardSkeleton() {
  return (
    <Card className="flex flex-col h-full">
      <CardContent className="pt-5 flex flex-col flex-1 gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="space-y-1 text-right">
            <Skeleton className="h-4 w-12 ml-auto" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
        <div className="space-y-1 flex-1">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
        <Skeleton className="h-3 w-24" />
        <Separator />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}

function OffersGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <OfferCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error / Empty states
// ---------------------------------------------------------------------------

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="w-10 h-10 text-destructive mb-3" />
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="w-3.5 h-3.5 mr-2" />
        Retry
      </Button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Inbox className="w-10 h-10 text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground">
        No offers match your filters
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Offer card
// ---------------------------------------------------------------------------

interface OfferCardProps {
  offer: MarketplaceOffer;
  onRequest: (offer: MarketplaceOffer) => void;
  isRequesting: boolean;
}

function OfferCard({ offer, onRequest, isRequesting }: OfferCardProps) {
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
            <p className="font-bold text-sm">{offer.price}&#8364;</p>
            <p className="text-xs text-muted-foreground">{offer.turnaround}</p>
          </div>
        </div>

        {/* Niche badge */}
        <Badge variant="secondary" className="text-xs w-fit capitalize">
          {offer.niche}
        </Badge>

        {/* Description */}
        <p className="text-sm text-muted-foreground flex-1 line-clamp-3">
          {offer.description}
        </p>

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
          disabled={offer.status !== "available" || isRequesting}
          onClick={() => onRequest(offer)}
        >
          <Send className="h-3.5 w-3.5 mr-1" />
          {offer.status === "available"
            ? "Request"
            : offer.status === "pending"
              ? "Pending..."
              : "Accepted"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// New offer form
// ---------------------------------------------------------------------------

interface NewOfferFormProps {
  onClose: () => void;
}

function NewOfferForm({ onClose }: NewOfferFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    platform: "instagram" as MarketplacePlatform,
    followers: "",
    niche: "other" as MarketplaceNiche,
    description: "",
    price: "",
    turnaround: "3 days",
  });

  const createMutation = useMutation({
    mutationFn: (
      data: Parameters<typeof socialApi.marketplace.createOffer>[0],
    ) => socialApi.marketplace.createOffer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace", "offers"] });
      toast.success("Offer published");
      onClose();
    },
    onError: () => {
      toast.error("Failed to publish offer");
    },
  });

  const handleSubmit = () => {
    if (!form.description.trim() || !form.price || !form.followers) {
      toast.error("Please fill all required fields");
      return;
    }
    createMutation.mutate({
      platform: form.platform,
      followers: parseInt(form.followers) || 0,
      niche: form.niche,
      description: form.description,
      price: parseFloat(form.price) || 0,
      turnaround: form.turnaround,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Platform *</Label>
          <Select
            value={form.platform}
            onValueChange={(v) =>
              setForm({ ...form, platform: v as MarketplacePlatform })
            }
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                [
                  "twitter",
                  "instagram",
                  "linkedin",
                  "tiktok",
                  "youtube",
                  "facebook",
                ] as MarketplacePlatform[]
              ).map((p) => (
                <SelectItem key={p} value={p} className="capitalize">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Niche *</Label>
          <Select
            value={form.niche}
            onValueChange={(v) =>
              setForm({ ...form, niche: v as MarketplaceNiche })
            }
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                [
                  "tech",
                  "fashion",
                  "fitness",
                  "food",
                  "travel",
                  "business",
                  "gaming",
                  "other",
                ] as MarketplaceNiche[]
              ).map((n) => (
                <SelectItem key={n} value={n} className="capitalize">
                  {n}
                </SelectItem>
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
          <Label className="text-xs">Price (&#8364;) *</Label>
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
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? "Publishing..." : "Publish Offer"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SocialMarketplacePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterPlatform, setFilterPlatform] = useState<
    MarketplacePlatform | "all"
  >("all");
  const [filterNiche, setFilterNiche] = useState<MarketplaceNiche | "all">(
    "all",
  );
  const [maxPrice, setMaxPrice] = useState("");
  const [newOfferOpen, setNewOfferOpen] = useState(false);

  const {
    data: offersResp,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["marketplace", "offers"],
    queryFn: () => socialApi.marketplace.listOffers(),
  });

  const offers: MarketplaceOffer[] = useMemo(
    () => offersResp?.data ?? [],
    [offersResp?.data],
  );

  const requestMutation = useMutation({
    mutationFn: (offerId: string) =>
      socialApi.marketplace.requestOffer(offerId),
    onSuccess: (_data, offerId) => {
      queryClient.invalidateQueries({ queryKey: ["marketplace", "offers"] });
      const offer = offers.find((o) => o.id === offerId);
      if (offer) {
        toast.success(`Request sent to ${offer.authorName}`);
      }
    },
    onError: () => {
      toast.error("Failed to send request");
    },
  });

  const filtered = useMemo(() => {
    return offers.filter((o) => {
      if (filterPlatform !== "all" && o.platform !== filterPlatform)
        return false;
      if (filterNiche !== "all" && o.niche !== filterNiche) return false;
      if (maxPrice && o.price > parseFloat(maxPrice)) return false;
      if (
        search &&
        !o.description.toLowerCase().includes(search.toLowerCase()) &&
        !o.authorName.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [offers, filterPlatform, filterNiche, maxPrice, search]);

  const handleRequest = useCallback(
    (offer: MarketplaceOffer) => {
      requestMutation.mutate(offer.id);
    },
    [requestMutation],
  );

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
            <NewOfferForm onClose={() => setNewOfferOpen(false)} />
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
                  placeholder="Search offers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Platform</Label>
              <Select
                value={filterPlatform}
                onValueChange={(v) =>
                  setFilterPlatform(v as MarketplacePlatform | "all")
                }
              >
                <SelectTrigger className="text-sm w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All platforms</SelectItem>
                  {(
                    [
                      "twitter",
                      "instagram",
                      "linkedin",
                      "tiktok",
                      "youtube",
                      "facebook",
                    ] as MarketplacePlatform[]
                  ).map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Niche</Label>
              <Select
                value={filterNiche}
                onValueChange={(v) =>
                  setFilterNiche(v as MarketplaceNiche | "all")
                }
              >
                <SelectTrigger className="text-sm w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All niches</SelectItem>
                  {(
                    [
                      "tech",
                      "fashion",
                      "fitness",
                      "food",
                      "travel",
                      "business",
                      "gaming",
                      "other",
                    ] as MarketplaceNiche[]
                  ).map((n) => (
                    <SelectItem key={n} value={n} className="capitalize">
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Max price (&#8364;)</Label>
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
              onClick={() => {
                setSearch("");
                setFilterPlatform("all");
                setFilterNiche("all");
                setMaxPrice("");
              }}
            >
              <Filter className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div>
        {isLoading ? (
          <OffersGridSkeleton />
        ) : isError ? (
          <ErrorState
            message="Failed to load marketplace offers."
            onRetry={() => refetch()}
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              {filtered.length} offer{filtered.length !== 1 ? "s" : ""} found
            </p>
            {filtered.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    onRequest={handleRequest}
                    isRequesting={requestMutation.isPending}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
