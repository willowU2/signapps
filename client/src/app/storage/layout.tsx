import { ReactNode } from 'react';


export const metadata = {
  title: 'Storage - SignApps',
};

interface StorageLayoutProps {
  children: ReactNode;
}

export default function StorageLayout({ children }: StorageLayoutProps) {
  return (
    <div className="space-y-6">
      <div className="w-full">
        {children}
      </div>
    </div>
  );
}
