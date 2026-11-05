'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { ApiError, forgetCsrfToken, request } from '@/lib/admin-client';
import { Button, TextField } from './fields';

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await request('/api/v1/auth/login', {
          method: 'POST',
          json: { username: data.get('username'), password: data.get('password') },
        });
        forgetCsrfToken();
        router.replace('/admin');
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
          setError('Completá el usuario y la contraseña.');
        } else {
          setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión.');
        }
      }
    });
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <TextField label="Usuario" name="username" autoComplete="username" required />
      <TextField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending} className="w-full">
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}
