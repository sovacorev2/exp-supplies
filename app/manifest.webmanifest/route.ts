import type { MetadataRoute } from 'next'

// Served as a plain route (not app/manifest.ts) so the <link rel="manifest">
// can be left off public form pages — respondents shouldn't be offered an
// "install app" prompt for the admin app. Linked from the root layout and
// nulled out in app/f/[slug]/page.tsx.
const manifest: MetadataRoute.Manifest = {
  name: 'Exp Forms',
  short_name: 'Exp Forms',
  description: 'Data collection forms platform',
  start_url: '/admin',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#d41820',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}

export function GET() {
  return Response.json(manifest, {
    headers: { 'Content-Type': 'application/manifest+json' },
  })
}
