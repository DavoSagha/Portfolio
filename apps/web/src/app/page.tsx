import Link from 'next/link';
import { Contact } from '@/components/contact';
import { Hero } from '@/components/hero';
import { Languages } from '@/components/languages';
import { ProjectCard } from '@/components/project-card';
import { Skills } from '@/components/skills';
import { Timeline } from '@/components/timeline';
import { Container, Section } from '@/components/ui';
import { api } from '@/lib/api';

export default async function HomePage() {
  const home = await api.home();
  if (!home) {
    return (
      <Container className="py-24">
        <h1 className="text-3xl">Sitio en preparación</h1>
        <p className="mt-4 text-muted">Todavía no hay contenido publicado.</p>
      </Container>
    );
  }

  const { sections } = home;
  // Cada sección se pide solo si tiene contenido publicado.
  const [timeline, skills, languages] = await Promise.all([
    sections.timeline ? api.timeline() : [],
    sections.skills ? api.skills() : [],
    sections.languages ? api.languages() : [],
  ]);

  return (
    <>
      <Hero home={home} />

      {sections.projects && home.featuredProjects.length > 0 && (
        <Section id="proyectos" label="Proyectos" title="Proyectos destacados">
          <ul className="grid gap-6 md:grid-cols-2">
            {home.featuredProjects.map((p) => (
              <li key={p.slug}>
                <ProjectCard project={p} />
              </li>
            ))}
          </ul>
          <p className="mt-8">
            <Link href="/proyectos">Ver todos los proyectos</Link>
          </p>
        </Section>
      )}

      {sections.timeline && (
        <Section
          id="trayectoria"
          label="Trayectoria"
          title="Experiencia, educación y certificaciones"
        >
          <Timeline entries={timeline} />
        </Section>
      )}

      {sections.skills && (
        <Section id="skills" label="Skills" title="Skills">
          <Skills groups={skills} />
        </Section>
      )}

      {sections.languages && (
        <Section id="idiomas" label="Idiomas" title="Idiomas">
          <Languages languages={languages} />
        </Section>
      )}

      {sections.contact && (
        <Section id="contacto" label="Contacto" title="Contacto">
          <Contact profile={home.profile} />
        </Section>
      )}
    </>
  );
}
