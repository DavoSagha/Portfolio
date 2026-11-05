import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';
import { themeInitScript } from '@/components/theme-toggle';
import { Container } from '@/components/ui';
import { api } from '@/lib/api';
import { SITE_URL } from '@/lib/site';
import './globals.css';

// Render en el servidor por request; los datos de la API se cachean 60 s (D-005).
// Así el build no depende de que la API esté levantada.
export const dynamic = 'force-dynamic';

// next/font descarga las fuentes en el build y las sirve desde el propio sitio.
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

async function safeHome() {
  try {
    return await api.home();
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const home = await safeHome();
  const name = home?.profile.fullName ?? 'Portfolio';
  const description = home?.profile.headline ?? undefined;
  const image = home?.profile.photoUrl ?? undefined;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: name, template: `%s · ${name}` },
    description,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      locale: 'es_AR',
      siteName: name,
      title: name,
      description,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary' },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0e1311' },
    { media: '(prefers-color-scheme: light)', color: '#f7f8f6' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const home = await safeHome();
  const name = home?.profile.fullName ?? 'Portfolio';
  return (
    // El script de tema modifica data-theme antes de hidratar.
    <html
      lang="es"
      className={`${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#contenido"
          className="sr-only z-20 rounded-md bg-accent px-4 py-2 text-accent-contrast focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Saltar al contenido
        </a>
        <SiteHeader name={name} sections={home?.sections ?? null} />
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-border py-8 text-sm text-muted">
          <Container>
            <p>
              {name} · {new Date().getFullYear()}
            </p>
          </Container>
        </footer>
      </body>
    </html>
  );
}
