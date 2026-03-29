'use client';

import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Users, Calendar, Briefcase, TrendingUp, Tag } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface CompanyCardProps {
  id: string;
  name: string;
  sector: string;
  contactsCount: number;
  lastInteractionDate: string;
  annualRevenue: number;
  tags: string[];
}

const SECTOR_COLORS: Record<string, { bg: string; text: string }> = {
  'Technologie': { bg: 'bg-blue-100', text: 'text-blue-800' },
  'Santé': { bg: 'bg-red-100', text: 'text-red-800' },
  'Finance': { bg: 'bg-purple-100', text: 'text-purple-800' },
  'Éducation': { bg: 'bg-green-100', text: 'text-green-800' },
  'Retail': { bg: 'bg-orange-100', text: 'text-orange-800' },
  'Industrie': { bg: 'bg-slate-100', text: 'text-slate-800' },
  'Services': { bg: 'bg-cyan-100', text: 'text-cyan-800' },
};

export function CompanyCard({
  id,
  name,
  sector,
  contactsCount,
  lastInteractionDate,
  annualRevenue,
  tags,
}: CompanyCardProps) {
  const sectorColor = SECTOR_COLORS[sector] || { bg: 'bg-muted', text: 'text-gray-800' };
  const formattedDate = format(parseISO(lastInteractionDate), 'd MMM yyyy', { locale: fr });
  const formattedRevenue = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(annualRevenue);

  return (
    <Card className="p-4 hover:shadow-lg transition-shadow">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate text-lg">{name}</h3>
            <Badge className={`${sectorColor.bg} ${sectorColor.text} border-0 mt-1`}>
              {sector}
            </Badge>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-muted-foreground text-xs">Contacts</p>
              <p className="font-semibold text-foreground">{contactsCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-amber-600" />
            <div>
              <p className="text-muted-foreground text-xs">Dernière interaction</p>
              <p className="font-semibold text-foreground text-xs">{formattedDate}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm col-span-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <div className="flex-1">
              <p className="text-muted-foreground text-xs">CA Annuel</p>
              <p className="font-semibold text-foreground">{formattedRevenue}</p>
            </div>
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="pt-2 border-t">
            <div className="flex flex-wrap gap-1">
              {tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  <Tag className="h-2.5 w-2.5 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
