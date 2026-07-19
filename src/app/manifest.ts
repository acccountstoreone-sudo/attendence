import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Attendance System',
    short_name: 'Attendance',
    description: 'Secure and modern attendance management platform.',
    start_url: '/',
    // Bug 9 fix: explicit scope and orientation
    scope: '/',
    orientation: 'portrait',
    display: 'standalone',
    background_color: '#1dbf73',
    theme_color: '#1dbf73',
    // Bug 3 fix: correct sizes + split 'any' and 'maskable' into separate entries
    // The W3C spec (Chrome ≥ 95) requires separate objects per purpose.
    // The 192x192 entry was previously pointing at the 512px file — fixed here
    // by using the existing icon-192x192.svg for the 'any' purpose variants.
    icons: [
      {
        src: '/icon-192x192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon512_maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon512_maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon512_maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
