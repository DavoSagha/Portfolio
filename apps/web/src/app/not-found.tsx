import Link from 'next/link';
import { Container } from '@/components/ui';

export default function NotFound() {
  return (
    <Container className="py-24">
      <p className="font-mono text-label text-muted">404</p>
      <h1 className="mt-2 text-3xl">Página no encontrada</h1>
      <p className="mt-6">
        <Link href="/">Volver al inicio</Link>
      </p>
    </Container>
  );
}
