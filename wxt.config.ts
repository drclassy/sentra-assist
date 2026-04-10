// Designed and constructed by Claudesy.
import { defineConfig } from 'wxt';

export default defineConfig({
  outDir: '.output',
  outDirTemplate: 'chrome-mv3-dev',
  entrypointsDir: 'entrypoints',
  manifest: {
    name: 'Sentra Assist 2.1',
    version_name: 'Sentra Assist 2.1 — Clinical Decision Support',
    description:
      'AI-powered clinical decision support for primary care physicians. ICD-10 diagnosis workflows, smart vital screening, automatic drug interaction checks, and seamless ePuskesmas integration — safe, accurate, and efficient.',
    version: '2.1.0',
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png',
    },
    permissions: ['activeTab', 'storage', 'sidePanel', 'identity', 'scripting', 'alarms'],
    host_permissions: [
      'https://kotakediri.epuskesmas.id/*',
      'https://*.googleapis.com/*',
      'https://crew.puskesmasbalowerti.com/*',
      'https://primary-healthcare-production.up.railway.app/*',
      'http://localhost:*/*',
    ],
    action: {
      default_title: 'Sentra Assist',
      // Jangan set default_popup: klik ikon harus membuka side panel (sidepanel.html),
      // bukan popup login — itu bundle terpisah sehingga "bypass login" di sidepanel tidak terlihat.
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        128: 'icon/128.png',
      },
    },
    oauth2: {
      client_id: '822368940562-qis7fdf5ivccgeov04o75rtrf7ghc7u4.apps.googleusercontent.com',
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    },
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; font-src 'self' data:;",
    },
    web_accessible_resources: [
      {
        resources: ['icon/*', 'assets/*', 'assets/sounds/*'],
        matches: ['<all_urls>'],
      },
    ],
  },
  modules: ['@wxt-dev/module-react'],
  webExt: {
    disabled: true, // Disable auto-open browser
  },
  vite: () => ({
    build: {
      chunkSizeWarningLimit: 2000,
    },
  }),
});
