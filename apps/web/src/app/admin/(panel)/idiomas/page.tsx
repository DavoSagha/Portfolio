import type { Metadata } from 'next';
import { LanguagesEditor } from '@/components/admin/languages-editor';
import { adminGet } from '@/lib/admin-server';
import type { AdminLanguage } from '@/lib/admin-types';

export const metadata: Metadata = { title: 'Idiomas' };

export default async function AdminLanguagesPage() {
  const languages = (await adminGet<AdminLanguage[]>('/languages')) ?? [];
  return (
    <>
      <h1 className="text-2xl">Idiomas</h1>
      <div className="mt-6">
        <LanguagesEditor languages={languages} />
      </div>
    </>
  );
}
