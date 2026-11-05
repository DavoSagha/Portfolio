import type { Profile } from '@/lib/types';

/** Contacto directo. El formulario (validación, honeypot y límite de envíos) llega en la Fase 4. */
export function Contact({ profile }: { profile: Profile }) {
  return (
    <ul className="flex flex-wrap gap-x-8 gap-y-3">
      {profile.publicEmail && (
        <li>
          <a href={`mailto:${profile.publicEmail}`}>{profile.publicEmail}</a>
        </li>
      )}
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
  );
}
