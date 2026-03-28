'use client';

import { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const STORAGE_KEY = 'signapps-color-blindness-filter';

type FilterType = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export function ColorBlindnessFilters() {
  const [filterType, setFilterType] = useState<FilterType>('none');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY) as FilterType;
    if (stored && ['none', 'protanopia', 'deuteranopia', 'tritanopia'].includes(stored)) {
      setFilterType(stored);
      applyFilter(stored);
    }
  }, []);

  const applyFilter = (type: FilterType) => {
    if (type === 'none') {
      document.body.style.filter = 'none';
    } else {
      document.body.style.filter = `url(#${type})`;
    }
  };

  const handleValueChange = (val: FilterType) => {
    setFilterType(val);
    localStorage.setItem(STORAGE_KEY, val);
    applyFilter(val);
  };

  if (!mounted) return null;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="color-blindness-select" className="font-medium">
            Filtres de Daltonisme
          </Label>
        </div>
        <p className="text-xs text-muted-foreground ml-6">
          Ajuste les couleurs pour corriger l'affichage selon le trouble visuel.
        </p>
      </div>

      <Select value={filterType} onValueChange={(val: FilterType) => handleValueChange(val)}>
        <SelectTrigger id="color-blindness-select" className="w-[180px]">
          <SelectValue placeholder="Aucun filtre" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Normal (Désactivé)</SelectItem>
          <SelectItem value="protanopia">Protanopie (Rouge)</SelectItem>
          <SelectItem value="deuteranopia">Deutéranopie (Vert)</SelectItem>
          <SelectItem value="tritanopia">Tritanopie (Bleu)</SelectItem>
        </SelectContent>
      </Select>

      {/* SVG Filters definitions injected globally when component is active */}
      <svg style={{ height: 0, width: 0, position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id="protanopia">
            <feColorMatrix type="matrix" values="0.567, 0.433, 0, 0, 0   0.558, 0.442, 0, 0, 0   0, 0.242, 0.758, 0, 0   0, 0, 0, 1, 0" />
          </filter>
          <filter id="deuteranopia">
            <feColorMatrix type="matrix" values="0.625, 0.375, 0, 0, 0   0.7, 0.3, 0, 0, 0   0, 0.3, 0.7, 0, 0   0, 0, 0, 1, 0" />
          </filter>
          <filter id="tritanopia">
            <feColorMatrix type="matrix" values="0.95, 0.05,  0, 0, 0   0,  0.433, 0.567, 0, 0   0,  0.475, 0.525, 0, 0   0,  0, 0, 1, 0" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}
