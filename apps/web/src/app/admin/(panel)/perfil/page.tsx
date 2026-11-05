import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PhotoForm, ProfileForm } from '@/components/admin/profile-forms';
import { adminGet } from '@/lib/admin-server';
import type { AdminProfile } from '@/lib/admin-types';

export const metadata: Metadata = { title: 'Perfil' };

export default async function AdminProfilePage() {
  const profile = await adminGet<AdminProfile>('/profile');
  if (!profile) notFound();
  return (
    <>
      <h1 className="text-2xl">Perfil</h1>
      <div className="mt-6 grid gap-10 lg:grid-cols-[2fr_1fr]">
        <ProfileForm profile={profile} />
        <PhotoForm photoUrl={profile.photoUrl} name={profile.fullName} />
      </div>
    </>
  );
}
