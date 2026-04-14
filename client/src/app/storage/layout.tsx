import { ReactNode } from 'react';


export const metadata = {
  title: 'Storage - SignApps',
};

interface StorageLayoutProps {
  children: ReactNode;
}

export default function StorageLayout({ children }: StorageLayoutProps) {
  return <>{children}</>;
}
