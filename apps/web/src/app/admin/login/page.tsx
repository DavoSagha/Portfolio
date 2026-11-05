import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/login-form';
import { Container } from '@/components/ui';
import { currentAdmin } from '@/lib/admin-server';

export const metadata: Metadata = { title: 'Iniciar sesión' };

export default async function LoginPage() {
  if (await currentAdmin()) redirect('/admin');
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl">Iniciar sesión</h1>
        <LoginForm />
      </div>
    </Container>
  );
}
