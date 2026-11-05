import path from 'node:path';
import type { NextConfig } from 'next';

// En producción, Caddy enruta /api, /cv y /files directo a la API antes de llegar a Next.
// Estos rewrites hacen que lo mismo funcione en desarrollo (npm run dev:web) sin Caddy.
const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
      { source: '/cv', destination: `${apiUrl}/cv` },
      { source: '/cv/:profile', destination: `${apiUrl}/cv/:profile` },
      { source: '/files/:id', destination: `${apiUrl}/files/:id` },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // El panel (Fase 3) nunca se indexa.
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
