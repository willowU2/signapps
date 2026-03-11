const fs = require('fs');
const path = require('path');

const pages = [
  { dir: 'settings', title: 'Paramètres Globaux', desc: 'Gestion du profil utilisateur, des préférences et du thème applicatif.' },
  { dir: 'apps', title: 'Applications & Store', desc: "Déploiement et gestion des applications de l'écosystème SignApps." },
  { dir: 'monitoring', title: 'Monitoring & Logs', desc: 'Tableau de bord de supervision des microservices et serveurs.' },
  { dir: 'vpn', title: 'Client VPN', desc: 'Gestion des tunnels sécurisés et de la connectivité réseau.' },
  { dir: 'pxe', title: 'Boot PXE', desc: 'Déploiement réseau des postes clients via Preboot Execution Environment.' },
  { dir: 'remote', title: 'Accès Distant', desc: 'Prise en main à distance des postes et serveurs du parc.' },
  { dir: 'routes', title: 'Routage Réseau', desc: 'Configuration des tables de routage et de la topologie réseau.' },
  { dir: 'it-assets', title: 'Parc Informatique', desc: 'Gestion des actifs IT, inventaire et cycle de vie.' },
  { dir: 'containers', title: 'Conteneurs Docker', desc: 'Orchestration et gestion des conteneurs applicatifs.' },
  { dir: 'backups', title: 'Sauvegardes', desc: 'Planification et restauration des sauvegardes globales.' }
];

pages.forEach(p => {
  const dirPath = path.join(__dirname, 'src', 'app', p.dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  const filePath = path.join(dirPath, 'page.tsx');
  if (!fs.existsSync(filePath)) {
    const content = `import { UnderConstruction } from "@/components/ui/under-construction";\n\nexport default function Page() {\n  return <UnderConstruction title="${p.title}" description="${p.desc}" />;\n}\n`;
    fs.writeFileSync(filePath, content);
  }
});
console.log('Pages created successfully.');
