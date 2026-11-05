import Image from 'next/image';
import type { Home } from '@/lib/types';
import { Text } from './text';
import { ButtonLink, Container } from './ui';

export function Hero({ home }: { home: Home }) {
  const { profile, cv, sections } = home;
  return (
    <section aria-labelledby="hero-title" className="border-b border-border py-14 sm:py-20">
      <Container className="grid items-center gap-10 md:grid-cols-[1fr_auto]">
        <div className="max-w-prose">
          <h1 id="hero-title" className="text-4xl sm:text-5xl">
            {profile.fullName}
          </h1>
          <p className="mt-4 text-lg font-medium text-text sm:text-xl">
            <Text value={profile.headline} />
          </p>
          <p className="mt-4 text-muted">
            <Text value={profile.valueProp} />
          </p>
          <ul
            className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-label text-muted"
            aria-label="Datos"
          >
            <li>
              <span className="sr-only">Ubicación: </span>
              {profile.location}
            </li>
            <li>
              <span className="sr-only">Disponibilidad: </span>
              <Text value={profile.availability} />
            </li>
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            {cv.primaryUrl && (
              <ButtonLink href={cv.primaryUrl} variant="primary">
                Descargar CV
              </ButtonLink>
            )}
            {sections.projects && <ButtonLink href="/#proyectos">Ver proyectos</ButtonLink>}
            {sections.contact && <ButtonLink href="/#contacto">Contactarme</ButtonLink>}
          </div>

          {(profile.linkedinUrl || profile.githubUrl) && (
            <ul className="mt-6 flex gap-5 text-sm">
              {profile.linkedinUrl && (
                <li>
                  <a href={profile.linkedinUrl} rel="me noopener" target="_blank">
                    LinkedIn<span className="sr-only"> (abre en otra pestaña)</span>
                  </a>
                </li>
              )}
              {profile.githubUrl && (
                <li>
                  <a href={profile.githubUrl} rel="me noopener" target="_blank">
                    GitHub<span className="sr-only"> (abre en otra pestaña)</span>
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>

        {profile.photoUrl ? (
          <Image
            src={profile.photoUrl}
            alt={`Foto de ${profile.fullName}`}
            width={224}
            height={224}
            priority
            // La API ya reprocesa y optimiza las imágenes al subirlas (Fase 3).
            unoptimized
            className="size-40 rounded-md border border-border object-cover sm:size-56"
          />
        ) : (
          <div className="hidden md:block">
            <Text value="TODO: foto" />
          </div>
        )}
      </Container>
    </section>
  );
}
