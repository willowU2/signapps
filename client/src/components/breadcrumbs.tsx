'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord', mail: 'Email', calendar: 'Calendrier',
  contacts: 'Contacts', drive: 'Fichiers', docs: 'Documents',
  chat: 'Chat', meet: 'Réunions', office: 'Bureau', forms: 'Formulaires',
  storage: 'Stockage', containers: 'Conteneurs', proxy: 'Proxy',
  metrics: 'Monitoring', securelink: 'SecureLink', media: 'Média',
  scheduler: 'Planificateur', workforce: 'Effectifs', billing: 'Facturation',
  notifications: 'Notifications', 'it-assets': 'Inventaire IT',
  admin: 'Administration', settings: 'Paramètres'
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
      <Link href="/" className="hover:text-foreground">Accueil</Link>
      {segments.map((seg, i) => (
        <span key={seg} className="flex items-center gap-1.5">
          <span>/</span>
          {i === segments.length - 1
            ? <span className="text-foreground font-medium">{LABELS[seg] || seg}</span>
            : <Link href={'/' + segments.slice(0, i + 1).join('/')} className="hover:text-foreground">{LABELS[seg] || seg}</Link>
          }
        </span>
      ))}
    </nav>
  );
}
