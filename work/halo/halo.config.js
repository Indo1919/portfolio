/* Optional runtime config for live AI.
   Leave proxyUrl empty to run with demo answers (or a key each visitor adds in Settings).
   To go live for everyone, deploy /worker to Cloudflare and paste its URL here:
     window.HALO_CONFIG = { proxyUrl: 'https://halo-ai.<your-subdomain>.workers.dev/v1/messages' };
   Never put an API key in this file. */
window.HALO_CONFIG = window.HALO_CONFIG || { proxyUrl: '' };
