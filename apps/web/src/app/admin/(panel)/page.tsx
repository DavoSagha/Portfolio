import Link from 'next/link';

const SECTIONS = [
  { href: '/admin/perfil', title: 'Perfil', text: 'Datos personales, textos, redes y foto.' },
  { href: '/admin/proyectos', title: 'Proyectos', text: 'Textos, stack, links, imágenes y orden.' },
  {
    href: '/admin/trayectoria',
    title: 'Trayectoria',
    text: 'Experiencia, educación y certificaciones.',
  },
  { href: '/admin/skills', title: 'Skills', text: 'Categorías, skills y niveles.' },
  { href: '/admin/idiomas', title: 'Idiomas', text: 'Idiomas y niveles.' },
  { href: '/admin/cv', title: 'CV', text: 'Versiones por perfil y CV principal.' },
  {
    href: '/admin/mensajes',
    title: 'Mensajes',
    text: 'Lo que llega por el formulario de contacto.',
  },
  { href: '/admin/metricas', title: 'Métricas', text: 'Visitas, descargas, clics y origen.' },
];

export default function AdminHomePage() {
  return (
    <>
      <h1 className="text-2xl">Panel</h1>
      <p className="mt-2 text-muted">
        Los cambios se ven en el sitio público en un minuto como máximo, sin redesplegar.
      </p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <li key={section.href} className="rounded-md border border-border bg-surface p-4">
            <h2 className="text-lg">
              <Link href={section.href}>{section.title}</Link>
            </h2>
            <p className="mt-1 text-sm text-muted">{section.text}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
