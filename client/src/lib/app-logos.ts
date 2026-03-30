/**
 * App logo resolver — 200 logos served locally from /app-logos/.
 * Fallback: Google favicon API for unknown apps.
 *
 * Resolution:
 * 1. app.icon from source → used directly if valid
 * 2. getAppLogo() → local /app-logos/{name}.png
 * 3. Google favicon → https://www.google.com/s2/favicons?domain={name}.com&sz=128
 */

/** Map app id/name to local logo filename */
const APP_LOGO_MAP: Record<string, string> = {
  '2fauth': '2fauth', 'activepieces': 'activepieces', 'actual-server': 'actual-server',
  'adguard': 'adguard', 'adminer': 'adminer', 'alist': 'alist', 'ansible': 'ansible',
  'appsmith': 'appsmith', 'archivebox': 'archivebox', 'audiobookshelf': 'audiobookshelf',
  'authentik': 'authentik', 'baserow': 'baserow', 'bazarr': 'bazarr', 'bitwarden': 'bitwarden',
  'blender': 'blender', 'bookstack': 'bookstack', 'brave': 'brave', 'budibase': 'budibase',
  'caddy': 'caddy', 'calcom': 'calcom', 'calibre': 'calibre', 'calibre-web': 'calibre-web',
  'changedetection': 'changedetection', 'chatwoot': 'chatwoot', 'chrome': 'chrome',
  'chromium': 'chromium', 'cloudflared': 'cloudflared', 'coder': 'coder', 'consul': 'consul',
  'coolify': 'coolify', 'crowdsec': 'crowdsec', 'dashy': 'dashy', 'deluge': 'deluge',
  'directus': 'directus', 'discord': 'discord', 'discourse': 'discourse', 'docker': 'docker',
  'dockge': 'dockge', 'docmost': 'docmost', 'dozzle': 'dozzle', 'drawio': 'drawio',
  'drone': 'drone', 'drupal': 'drupal', 'duplicati': 'duplicati', 'elasticsearch': 'elasticsearch',
  'element': 'element', 'emby': 'emby', 'esphome': 'esphome', 'excalidraw': 'excalidraw',
  'filebrowser': 'filebrowser', 'firefly': 'firefly', 'firefly-iii': 'firefly',
  'firefox': 'firefox', 'flarum': 'flarum', 'flowise': 'flowise', 'forgejo': 'forgejo',
  'freshrss': 'freshrss', 'frigate': 'frigate', 'ghost': 'ghost', 'ghostfolio': 'ghostfolio',
  'gitea': 'gitea', 'github': 'github', 'gitlab': 'gitlab', 'glances': 'glances',
  'gotify': 'gotify', 'grafana': 'grafana', 'grocy': 'grocy', 'guacamole': 'guacamole',
  'handbrake': 'handbrake', 'harbor': 'harbor', 'healthchecks': 'healthchecks',
  'hedgedoc': 'hedgedoc', 'heimdall': 'heimdall', 'homarr': 'homarr',
  'homeassistant': 'homeassistant', 'homepage': 'homepage', 'homer': 'homer',
  'hoppscotch': 'hoppscotch', 'huginn': 'huginn', 'immich': 'immich',
  'invoice-ninja': 'invoice-ninja', 'it-tools': 'it-tools', 'jellyfin': 'jellyfin',
  'jellyseerr': 'jellyseerr', 'jenkins': 'jenkins', 'jira': 'jira', 'jitsi': 'jitsi',
  'joplin': 'joplin', 'kavita': 'kavita', 'keycloak': 'keycloak', 'kitchenowl': 'kitchenowl',
  'komga': 'komga', 'kopia': 'kopia', 'kubernetes': 'kubernetes', 'lemmy': 'lemmy',
  'libretranslate': 'libretranslate', 'linkwarden': 'linkwarden', 'listmonk': 'listmonk',
  'lobe-chat': 'lobe-chat', 'mailpit': 'mailpit', 'mariadb': 'mariadb',
  'mastodon': 'mastodon', 'matomo': 'matomo', 'mattermost': 'mattermost', 'mealie': 'mealie',
  'mediawiki': 'mediawiki', 'meilisearch': 'meilisearch', 'memos': 'memos',
  'metube': 'metube', 'minecraft-server': 'minecraft-server', 'minio': 'minio',
  'miniflux': 'miniflux', 'mongodb': 'mongodb', 'monica': 'monica', 'moodle': 'moodle',
  'mysql': 'mysql', 'n8n': 'n8n', 'navidrome': 'navidrome', 'netdata': 'netdata',
  'nextcloud': 'nextcloud', 'nextcloud-ls': 'nextcloud-ls', 'nginx': 'nginx',
  'nocodb': 'nocodb', 'node-red': 'node-red', 'nodered': 'nodered', 'ntfy': 'ntfy',
  'nzbget': 'nzbget', 'obsidian': 'obsidian', 'octoprint': 'octoprint', 'odoo': 'odoo',
  'ollama-amd': 'ollama-amd', 'ollama-cpu': 'ollama-cpu', 'ollama-nvidia': 'ollama-nvidia',
  'onlyoffice': 'onlyoffice', 'open-webui': 'open-webui', 'outline': 'outline',
  'overseerr': 'overseerr', 'owncloud': 'owncloud', 'paperless': 'paperless-ngx',
  'paperless-ngx': 'paperless-ngx', 'passbolt': 'passbolt', 'penpot': 'penpot',
  'phpmyadmin': 'phpmyadmin', 'photoprism': 'photoprism', 'pihole': 'pihole',
  'pingvin-share': 'pingvin-share', 'piped': 'piped', 'plane': 'plane', 'planka': 'planka',
  'plausible': 'plausible', 'plex': 'plex', 'pocketbase': 'pocketbase',
  'portainer': 'portainer', 'postiz': 'postiz', 'postgresql': 'postgresql',
  'privatebin': 'privatebin', 'prometheus': 'prometheus', 'prowlarr': 'prowlarr',
  'pterodactyl-panel': 'pterodactyl-panel', 'qbittorrent': 'qbittorrent',
  'rabbitmq': 'rabbitmq', 'radarr': 'radarr', 'rancher': 'rancher',
  'reactive-resume': 'reactive-resume', 'readarr': 'readarr', 'readeck': 'readeck',
  'redis': 'redis', 'redmine': 'redmine', 'rocket-chat': 'rocket-chat',
  'rocketchat': 'rocketchat', 'sabnzbd': 'sabnzbd', 'scrutiny': 'scrutiny',
  'searxng': 'searxng', 'semaphore': 'semaphore', 'sentry': 'sentry', 'slack': 'slack',
  'sonarr': 'sonarr', 'sonarqube': 'sonarqube', 'speedtest-tracker': 'speedtest-tracker',
  'stalwart-mail': 'stalwart-mail', 'stirlingpdf': 'stirlingpdf',
  'stirling-pdf': 'stirlingpdf', 'strapi': 'strapi', 'supabase': 'supabase',
  'syncthing': 'syncthing', 'tailscale': 'tailscale', 'tandoor': 'tandoor',
  'tautulli': 'tautulli', 'terraform': 'terraform', 'traccar': 'traccar',
  'traefik': 'traefik', 'transmission': 'transmission', 'trilium': 'trilium',
  'umami': 'umami', 'unifi-network-application': 'unifi-network-application',
  'uptime-kuma': 'uptime-kuma', 'vault': 'vault', 'vaultwarden': 'bitwarden',
  'vikunja': 'vikunja', 'wallabag': 'wallabag', 'wallos': 'wallos',
  'wg-easy': 'wg-easy', 'wikijs': 'wikijs', 'wireguard': 'wireguard',
  'wordpress': 'wordpress', 'zigbee2mqtt': 'zigbee2mqtt',
  // Aliases
  'postgres': 'postgresql', 'wiki': 'wikijs', 'wiki.js': 'wikijs',
  'pi-hole': 'pihole', 'code-server': 'coder', 'home-assistant': 'homeassistant',
  'draw.io': 'drawio', 'rocket.chat': 'rocketchat', 'mongo': 'mongodb',
  'adguard-home': 'adguard', 'adguardhome': 'adguard', 'uptime': 'uptime-kuma',
  'uptimekuma': 'uptime-kuma',
};

/**
 * Get logo for an app.
 *
 * 1. Local match in /app-logos/{name}.png (200 logos)
 * 2. Docker image name match
 * 3. Fuzzy match (contains)
 * 4. Google favicon fallback for unknown apps
 */
export function getAppLogo(appIdOrName: string, dockerImage?: string): string {
  const key = appIdOrName.toLowerCase().trim();

  // Direct match
  if (APP_LOGO_MAP[key]) {
    return `/app-logos/${APP_LOGO_MAP[key]}.png`;
  }

  // Strip Docker prefixes
  const stripped = key
    .replace(/^linuxserver\//, '').replace(/^lscr\.io\/linuxserver\//, '')
    .replace(/^ghcr\.io\/[^/]+\//, '').replace(/^docker\.io\//, '').replace(/^library\//, '');
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

  // Fallback: Google favicon API
  const sanitized = key.replace(/[^a-z0-9-]/g, '');
  return `https://www.google.com/s2/favicons?domain=${sanitized}.com&sz=128`;
}
