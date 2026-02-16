import { ReactNode } from 'react';
import { FavoritesBar } from '@/components/storage/favorites-bar';

export const metadata = {
  title: 'Storage - SignApps',
};

interface StorageLayoutProps {
  children: ReactNode;
}

export default function StorageLayout({ children }: StorageLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Favorites Bar at the top */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">{children}</div>
        <div className="lg:col-span-1 lg:sticky lg:top-20 lg:h-fit">
          <FavoritesBar maxFavorites={4} />
        </div>
      </div>
    </div>
  );
}
