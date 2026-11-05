import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CvManager } from '@/components/admin/cv-manager';
import { adminGet } from '@/lib/admin-server';
import type { AdminCv } from '@/lib/admin-types';

export const metadata: Metadata = { title: 'CV' };

export default async function AdminCvPage() {
  const cv = await adminGet<AdminCv>('/cv');
  if (!cv) notFound();
  return (
    <>
      <h1 className="text-2xl">CV</h1>
      <p className="mt-2 text-sm text-muted">
        <code>/cv</code> descarga la versión vigente del perfil principal. El historial se conserva.
      </p>
      <div className="mt-6">
        <CvManager cv={cv} />
      </div>
    </>
  );
}
