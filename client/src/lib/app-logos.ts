/**
 * App logo resolver — serves logos from local /app-logos/ directory.
 *
 * Logos are pre-downloaded in public/app-logos/ (no external requests at runtime).
 * Mapping: app name/id → local file path.
 */

/** Map app name/id/image to local logo filename (without extension) */
const APP_LOGO_MAP: Record<string, string> = {
  // Productivity & Office
  nextcloud: 'nextcloud', onlyoffice: 'onlyoffice', collabora: 'collabora',
  bookstack: 'bookstack', outline: 'outline', wiki: 'wikijs', 'wiki.js': 'wikijs', wikijs: 'wikijs',
  cryptpad: 'cryptpad', etherpad: 'etherpad', hedgedoc: 'hedgedoc',

  // Communication
  'rocket.chat': 'rocketchat', rocketchat: 'rocketchat', mattermost: 'mattermost',
  element: 'element', jitsi: 'jitsi', zulip: 'zulip', slack: 'slack', discord: 'discord',

  // Media & Entertainment
  jellyfin: 'jellyfin', plex: 'plex', emby: 'emby', immich: 'immich',
  photoprism: 'photoprism', navidrome: 'navidrome', sonarr: 'sonarr', radarr: 'radarr',
  overseerr: 'overseerr', audiobookshelf: 'audiobookshelf',

  // Development & CI
  gitea: 'gitea', gitlab: 'gitlab', github: 'github', jenkins: 'jenkins',
  portainer: 'portainer', n8n: 'n8n', coder: 'coder', 'code-server': 'coder', drone: 'drone',

  // No-code / Low-code
  nocodb: 'nocodb', appsmith: 'appsmith', directus: 'directus', strapi: 'strapi', supabase: 'supabase',

  // Monitoring & Infra
  grafana: 'grafana', prometheus: 'prometheus', traefik: 'traefik', nginx: 'nginx', caddy: 'caddy',
  netdata: 'netdata', sentry: 'sentry', plausible: 'plausible', umami: 'umami', matomo: 'matomo',
  uptime: 'uptime-kuma', 'uptime-kuma': 'uptime-kuma',

  // Databases
  postgres: 'postgresql', postgresql: 'postgresql', mariadb: 'mariadb', mysql: 'mysql',
  mongodb: 'mongodb', redis: 'redis', elasticsearch: 'elasticsearch', meilisearch: 'meilisearch',

  // Storage
  minio: 'minio', syncthing: 'syncthing', filebrowser: 'filebrowser', seafile: 'seafile',
  duplicati: 'duplicati',

  // Security & VPN
  vaultwarden: 'bitwarden', bitwarden: 'bitwarden', wireguard: 'wireguard',
  pihole: 'pihole', 'pi-hole': 'pihole', adguard: 'adguard', 'adguard-home': 'adguard',
  authentik: 'authentik', keycloak: 'keycloak', tailscale: 'tailscale', crowdsec: 'crowdsec',

  // Home Automation
  'home-assistant': 'homeassistant', homeassistant: 'homeassistant',
  nodered: 'nodered', 'node-red': 'nodered', frigate: 'frigate',

  // CMS
  wordpress: 'wordpress', ghost: 'ghost',

  // Misc
  freshrss: 'freshrss', dashy: 'dashy', homarr: 'homarr',
  paperless: 'paperless', 'paperless-ngx': 'paperless',
  stirlingpdf: 'stirlingpdf', 'stirling-pdf': 'stirlingpdf',
  mealie: 'mealie', excalidraw: 'excalidraw', drawio: 'drawio', 'draw.io': 'drawio',
  firefly: 'firefly', 'firefly-iii': 'firefly',
  changedetection: 'changedetection', mailpit: 'mailpit', metube: 'metube',

  // Infra
  docker: 'docker', kubernetes: 'kubernetes', rancher: 'rancher',
  harbor: 'harbor', vault: 'vault', consul: 'consul', terraform: 'terraform', ansible: 'ansible',
};

/**
 * Get the local logo path for an app.
 *
 * Resolution:
 * 1. Exact match by app id/name
 * 2. Docker image base name
 * 3. Fuzzy match (contains)
 * 4. null (fallback to Package icon)
 */
export function getAppLogo(appIdOrName: string, dockerImage?: string): string | null {
  const key = appIdOrName.toLowerCase().trim();

  // Direct match
  if (APP_LOGO_MAP[key]) {
    return `/app-logos/${APP_LOGO_MAP[key]}.png`;
  }

  // Strip common Docker prefixes
  const stripped = key
    .replace(/^linuxserver\//, '')
    .replace(/^lscr\.io\/linuxserver\//, '')
    .replace(/^ghcr\.io\/[^/]+\//, '')
    .replace(/^docker\.io\//, '')
    .replace(/^library\//, '');
  if (APP_LOGO_MAP[stripped]) {
    return `/app-logos/${APP_LOGO_MAP[stripped]}.png`;
  }

  // Docker image base name
  if (dockerImage) {
    const imgBase = dockerImage.split(':')[0].split('/').pop()?.toLowerCase() || '';
    if (APP_LOGO_MAP[imgBase]) {
      return `/app-logos/${APP_LOGO_MAP[imgBase]}.png`;
    }
  }

  // Fuzzy match
  for (const [logoKey, filename] of Object.entries(APP_LOGO_MAP)) {
    if (key.includes(logoKey) || logoKey.includes(key)) {
      return `/app-logos/${filename}.png`;
    }
  }

  // Fallback: Google favicon service (works for any domain)
  const sanitized = key.replace(/[^a-z0-9-]/g, '');
  return `https://www.google.com/s2/favicons?domain=${sanitized}.com&sz=128`;
}
