import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Además de X-Robots-Tag (next.config.ts) y robots.txt: el panel nunca se indexa.
export const metadata: Metadata = {
  title: 'Panel',
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return children;
}
