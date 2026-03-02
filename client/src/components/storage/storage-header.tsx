import { ChevronDown, ChevronRight, Plus, Search, LayoutGrid, List as ListIcon, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

export interface Bucket {
  name: string;
  creationDate?: string;
}

export interface StorageHeaderProps {
  driveView: string;
  currentBucket: string;
  buckets: Bucket[];
  currentPath: string[];
  search: string;
  viewMode: 'grid' | 'list' | 'tree';
  onBucketSelect: (bucket: string) => void;
  onPathClick: (index: number) => void;
  onSearchChange: (search: string) => void;
  onViewModeChange: (mode: 'grid' | 'list' | 'tree') => void;
  onCreateBucket: () => void;
}

export function StorageHeader({
  driveView,
  currentBucket,
  buckets,
  currentPath,
  search,
  viewMode,
  onBucketSelect,
  onPathClick,
  onSearchChange,
  onViewModeChange,
  onCreateBucket
}: StorageHeaderProps) {
  if (driveView === 'home') return null;

  return (
    <div className="flex justify-between items-center px-6 py-3 bg-white dark:bg-[#202124]">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex items-center text-[22px] font-normal text-[#1f1f1f] dark:text-[#e3e3e3] overflow-hidden">
          {currentBucket ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-auto font-normal text-[22px] px-3 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#303134] rounded-full gap-1">
                    {currentBucket}
                    <ChevronDown className="h-5 w-5 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="start">
                  {buckets.map(b => (
                    <DropdownMenuItem key={b.name} onClick={() => onBucketSelect(b.name)}>
                      <Database className="mr-2 h-4 w-4 text-muted-foreground" />
                      {b.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onCreateBucket}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nouveau Bucket
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {currentPath.map((path, i) => (
                <div key={i} className="flex items-center shrink-0">
                  <ChevronRight className="h-5 w-5 mx-1 text-[#5f6368] dark:text-[#9aa0a6]" />
                  <Button
                    variant="ghost"
                    className="h-auto font-normal text-[22px] px-3 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#303134] rounded-full"
                    onClick={() => onPathClick(i)}
                  >
                    {path}
                  </Button>
                </div>
              ))}
            </>
          ) : (
            <h1 className="px-3 py-1.5">
               {driveView === 'my-drive' ? 'Mon Drive' : 
                driveView === 'shared' ? 'Partagés avec moi' : 
                driveView === 'recent' ? 'Récents' : 
                driveView === 'starred' ? 'Suivis' : 'Corbeille'}
            </h1>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:flex relative w-[300px] mr-2">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-5 w-5 text-[#5f6368] dark:text-[#9aa0a6]" />
          </div>
          <Input
            placeholder="Rechercher dans Drive"
            className="w-full bg-[#f1f3f4] dark:bg-[#303134] border-transparent hover:bg-white hover:border-[#dadce0] hover:shadow-sm focus:bg-white dark:hover:bg-[#3c4043] dark:focus:bg-[#3c4043] focus:border-[#1a73e8] dark:focus:border-[#8ab4f8] rounded-full pl-11 h-12 text-base transition-all"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-1 border border-[#dadce0] dark:border-[#5f6368] rounded-full p-1 bg-white dark:bg-[#202124]">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8 rounded-full text-[#5f6368] dark:text-[#9aa0a6]"
            onClick={() => onViewModeChange('grid')}
            title="Vue Grille"
          >
            <LayoutGrid className="h-[18px] w-[18px]" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8 rounded-full text-[#5f6368] dark:text-[#9aa0a6]"
            onClick={() => onViewModeChange('list')}
            title="Vue Liste"
          >
            <ListIcon className="h-[18px] w-[18px]" />
          </Button>
        </div>
      </div>
    </div>
  );
}
