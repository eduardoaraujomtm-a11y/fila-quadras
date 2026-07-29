export default function manifest() {
  return {
    name: 'Fila das Quadras',
    short_name: 'Fila Quadras',
    description: 'Fila virtual por ordem de chegada das quadras de tênis do clube.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FBF8F2',
    theme_color: '#17402F',
    lang: 'pt-BR',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
