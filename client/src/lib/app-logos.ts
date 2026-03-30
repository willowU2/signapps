/**
 * Official logo URLs for popular Docker/self-hosted apps.
 *
 * Used as fallback when the app store doesn't provide an icon or the icon URL is broken.
 * Logos are sourced from official GitHub repos, Docker Hub, or CDNs.
 */

const APP_LOGOS: Record<string, string> = {
  // ── Productivity & Office ───────────────────────────────────────
  nextcloud: 'https://raw.githubusercontent.com/nextcloud/promo/master/nextcloud-icon.svg',
  onlyoffice: 'https://raw.githubusercontent.com/nicehash/NiceHashQuickMiner/main/images/onlyoffice.png',
  collabora: 'https://www.collaboraoffice.com/wp-content/uploads/2022/03/cropped-collabora-productivity-nav-icon.png',
  cryptpad: 'https://raw.githubusercontent.com/xwiki-labs/cryptpad/main/customize.dist/CryptPad_logo.svg',
  etherpad: 'https://raw.githubusercontent.com/ether/etherpad-lite/develop/src/static/favicon.ico',
  hedgedoc: 'https://raw.githubusercontent.com/hedgedoc/hedgedoc/develop/public/icons/android-chrome-512x512.png',
  bookstack: 'https://raw.githubusercontent.com/BookStackApp/BookStack/development/public/icon.png',
  wiki: 'https://raw.githubusercontent.com/requarks/wiki/main/assets/favicon.png',
  'wiki.js': 'https://raw.githubusercontent.com/requarks/wiki/main/assets/favicon.png',
  wikijs: 'https://raw.githubusercontent.com/requarks/wiki/main/assets/favicon.png',
  outline: 'https://raw.githubusercontent.com/outline/outline/main/public/images/icon-512.png',

  // ── Communication ──────────────────────────────────────────────
  'rocket.chat': 'https://raw.githubusercontent.com/RocketChat/Rocket.Chat.Artwork/master/Logos/2020/png/logo-dark.png',
  rocketchat: 'https://raw.githubusercontent.com/RocketChat/Rocket.Chat.Artwork/master/Logos/2020/png/logo-dark.png',
  mattermost: 'https://raw.githubusercontent.com/nicehash/NiceHashQuickMiner/main/images/mattermost.png',
  element: 'https://element.io/images/logo-mark-primary.svg',
  matrix: 'https://matrix.org/images/matrix-logo.svg',
  jitsi: 'https://raw.githubusercontent.com/jitsi/jitsi-meet/master/images/oig512.png',

  // ── Media & Entertainment ──────────────────────────────────────
  jellyfin: 'https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/SVG/icon-transparent.svg',
  plex: 'https://www.plex.tv/wp-content/themes/flavor/assets/img/plex-logo.svg',
  emby: 'https://emby.media/resources/logowhite_1881.png',
  navidrome: 'https://raw.githubusercontent.com/navidrome/navidrome/master/resources/logo-192x192.png',
  immich: 'https://raw.githubusercontent.com/immich-app/immich/main/docs/static/img/immich-logo.svg',
  photoprism: 'https://raw.githubusercontent.com/photoprism/photoprism/develop/assets/static/icons/logo/logo-192x192.png',

  // ── Development & CI ───────────────────────────────────────────
  gitea: 'https://raw.githubusercontent.com/go-gitea/gitea/main/public/assets/img/gitea.svg',
  gitlab: 'https://about.gitlab.com/images/press/press-kit-icon.svg',
  drone: 'https://raw.githubusercontent.com/harness/drone/master/web/public/logo.svg',
  jenkins: 'https://www.jenkins.io/images/logos/jenkins/jenkins.svg',
  'code-server': 'https://raw.githubusercontent.com/coder/code-server/main/src/browser/media/pwa-icon-512.png',
  coder: 'https://raw.githubusercontent.com/coder/code-server/main/src/browser/media/pwa-icon-512.png',
  portainer: 'https://raw.githubusercontent.com/portainer/portainer/develop/app/assets/ico/favicon.svg',
  n8n: 'https://raw.githubusercontent.com/n8n-io/n8n/master/assets/n8n-logo.png',

  // ── Monitoring & Infra ─────────────────────────────────────────
  grafana: 'https://raw.githubusercontent.com/grafana/grafana/main/public/img/grafana_icon.svg',
  prometheus: 'https://raw.githubusercontent.com/prometheus/docs/main/static/prometheus_logo_orange_circle.svg',
  uptime: 'https://raw.githubusercontent.com/louislam/uptime-kuma/master/public/icon.svg',
  'uptime-kuma': 'https://raw.githubusercontent.com/louislam/uptime-kuma/master/public/icon.svg',
  traefik: 'https://raw.githubusercontent.com/traefik/traefik/master/docs/content/assets/img/traefik.logo.png',
  nginx: 'https://raw.githubusercontent.com/nginxinc/docker-nginx/master/logo.svg',
  caddy: 'https://caddyserver.com/resources/images/caddy-circle-lock.svg',

  // ── Databases ──────────────────────────────────────────────────
  postgres: 'https://raw.githubusercontent.com/docker-library/docs/01c12653951b2fe592c1f93a13b4e289ada0e3a1/postgres/logo.png',
  postgresql: 'https://raw.githubusercontent.com/docker-library/docs/01c12653951b2fe592c1f93a13b4e289ada0e3a1/postgres/logo.png',
  mariadb: 'https://raw.githubusercontent.com/docker-library/docs/74e3b3d4d60f68f1a22bfb9c08b03e5f3bfbfafe/mariadb/logo.png',
  mysql: 'https://raw.githubusercontent.com/docker-library/docs/c408469abbac35ad1e4a50a6618836420eb9502e/mysql/logo.png',
  mongodb: 'https://raw.githubusercontent.com/docker-library/docs/01c12653951b2fe592c1f93a13b4e289ada0e3a1/mongo/logo.png',
  redis: 'https://raw.githubusercontent.com/docker-library/docs/01c12653951b2fe592c1f93a13b4e289ada0e3a1/redis/logo.png',

  // ── Storage & Files ────────────────────────────────────────────
  minio: 'https://raw.githubusercontent.com/minio/minio/master/.github/logo.svg',
  filebrowser: 'https://raw.githubusercontent.com/filebrowser/frontend/master/public/img/logo.svg',
  seafile: 'https://raw.githubusercontent.com/haiwen/seafile/master/image/seafile-logo.png',
  syncthing: 'https://raw.githubusercontent.com/syncthing/syncthing/main/assets/logo-128.png',

  // ── Security & VPN ─────────────────────────────────────────────
  vaultwarden: 'https://raw.githubusercontent.com/dani-garcia/vaultwarden/main/resources/vaultwarden-icon.svg',
  bitwarden: 'https://raw.githubusercontent.com/bitwarden/brand/master/icons/icon.svg',
  wireguard: 'https://www.wireguard.com/img/wireguard.svg',
  pihole: 'https://raw.githubusercontent.com/pi-hole/web/master/img/logo.svg',
  'pi-hole': 'https://raw.githubusercontent.com/pi-hole/web/master/img/logo.svg',
  adguard: 'https://raw.githubusercontent.com/nicehash/NiceHashQuickMiner/main/images/adguard-home.png',
  'adguard-home': 'https://raw.githubusercontent.com/nicehash/NiceHashQuickMiner/main/images/adguard-home.png',
  authentik: 'https://raw.githubusercontent.com/goauthentik/authentik/main/web/icons/icon.png',
  keycloak: 'https://raw.githubusercontent.com/keycloak/keycloak/main/themes/src/main/resources/theme/keycloak.v2/login/resources/img/keycloak-logo-text.svg',

  // ── Home Automation ────────────────────────────────────────────
  'home-assistant': 'https://raw.githubusercontent.com/home-assistant/assets/master/logo/logo-small.png',
  homeassistant: 'https://raw.githubusercontent.com/home-assistant/assets/master/logo/logo-small.png',
  nodered: 'https://raw.githubusercontent.com/node-red/node-red/master/packages/node_modules/node-red/node-red-256.png',
  'node-red': 'https://raw.githubusercontent.com/node-red/node-red/master/packages/node_modules/node-red/node-red-256.png',
  mosquitto: 'https://mosquitto.org/images/mosquitto-text-side-28.png',

  // ── Misc ───────────────────────────────────────────────────────
  wordpress: 'https://s.w.org/style/images/about/WordPress-logotype-simplified.png',
  ghost: 'https://raw.githubusercontent.com/TryGhost/Ghost/main/ghost/admin/public/assets/icons/icon-512x512.png',
  freshrss: 'https://raw.githubusercontent.com/FreshRSS/FreshRSS/edge/p/themes/icons/FreshRSS-logo.svg',
  homer: 'https://raw.githubusercontent.com/bastienwirtz/homer/main/public/logo.png',
  homarr: 'https://raw.githubusercontent.com/ajnart/homarr/dev/public/imgs/logo/logo.svg',
  dashy: 'https://raw.githubusercontent.com/Lissy93/dashy/master/public/web-icons/dashy-logo.png',
  heimdall: 'https://raw.githubusercontent.com/linuxserver/Heimdall/master/public/img/heimdall-icon-small.png',
  mailpit: 'https://raw.githubusercontent.com/axllent/mailpit/develop/server/ui-src/favicon.svg',
  metube: 'https://raw.githubusercontent.com/alexta69/metube/master/favicon/android-chrome-512x512.png',
  stirlingpdf: 'https://raw.githubusercontent.com/Stirling-Tools/Stirling-PDF/main/docs/stirling.png',
  'stirling-pdf': 'https://raw.githubusercontent.com/Stirling-Tools/Stirling-PDF/main/docs/stirling.png',
  paperless: 'https://raw.githubusercontent.com/paperless-ngx/paperless-ngx/dev/resources/logo/web/png/Black%20logo%20-%20no%20background.png',
  'paperless-ngx': 'https://raw.githubusercontent.com/paperless-ngx/paperless-ngx/dev/resources/logo/web/png/Black%20logo%20-%20no%20background.png',
};

/**
 * Get the official logo URL for a given app.
 *
 * Tries to match by:
 * 1. Exact app id/name match
 * 2. Docker image name (without registry/tag)
 * 3. Normalized lowercase match
 *
 * @returns URL string or null if no logo found
 */
export function getAppLogo(appIdOrName: string, dockerImage?: string): string | null {
  const key = appIdOrName.toLowerCase().trim();

  // Direct match
  if (APP_LOGOS[key]) return APP_LOGOS[key];

  // Try without common prefixes
  const stripped = key
    .replace(/^linuxserver\//, '')
    .replace(/^lscr\.io\//, '')
    .replace(/^ghcr\.io\//, '')
    .replace(/^docker\.io\//, '');
  if (APP_LOGOS[stripped]) return APP_LOGOS[stripped];

  // Try from Docker image
  if (dockerImage) {
    const imgBase = dockerImage.split(':')[0].split('/').pop()?.toLowerCase() || '';
    if (APP_LOGOS[imgBase]) return APP_LOGOS[imgBase];
  }

  // Fuzzy match — check if any key is contained in the app name
  for (const [logoKey, url] of Object.entries(APP_LOGOS)) {
    if (key.includes(logoKey) || logoKey.includes(key)) {
      return url;
    }
  }

  return null;
}
