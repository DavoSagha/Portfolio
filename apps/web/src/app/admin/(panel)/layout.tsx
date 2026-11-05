import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminNav } from '@/components/admin/admin-nav';
import { Container } from '@/components/ui';
import { currentAdmin } from '@/lib/admin-server';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');
  return (
    <Container className="flex flex-col gap-8 py-8 md:flex-row">
      <AdminNav username={admin.username} />
      <div className="min-w-0 flex-1">{children}</div>
    </Container>
  );
}
