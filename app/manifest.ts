import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FreshMart Supermarket POS & Cloud ERP',
    short_name: 'FreshMart POS',
    description:
      'High-speed Indian supermarket POS, barcode & weighing scale billing, offline checkout queue, GST filing, wastage tracking, and cloud ERP.',
    start_url: '/admin/pos',
    display: 'standalone',
    background_color: '#0B1120',
    theme_color: '#047857',
    orientation: 'any',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
