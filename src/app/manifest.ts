import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AvCollect',
    short_name: 'AvCollect',
    description: 'Modern Asset Collection & Digital Management Tool',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#818cf8',
    icons: [
      {
        src: '/icon.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  }
}
