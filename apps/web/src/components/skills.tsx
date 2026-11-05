import Link from 'next/link';
import { SKILL_LEVEL_LABEL } from '@/lib/format';
import type { SkillGroup } from '@/lib/types';

/** Nivel en texto, sin barras ni porcentajes (docs/diseno.md). */
export function Skills({ groups }: { groups: SkillGroup[] }) {
  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <div key={group.category}>
          <h3 className="text-lg">{group.category}</h3>
          <ul className="mt-3 space-y-3">
            {group.skills.map((skill) => (
              <li key={skill.name}>
                <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium">{skill.name}</span>
                  {skill.level && (
                    <span className="font-mono text-label text-muted">
                      {SKILL_LEVEL_LABEL[skill.level]}
                    </span>
                  )}
                </p>
                {skill.projects.length > 0 && (
                  <p className="text-sm text-muted">
                    Usada en{' '}
                    {skill.projects.map((p, i) => (
                      <span key={p.slug}>
                        {i > 0 && ', '}
                        <Link href={`/proyectos/${p.slug}`}>{p.title}</Link>
                      </span>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
