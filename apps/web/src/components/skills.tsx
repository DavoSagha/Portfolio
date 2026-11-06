import { SKILL_LEVEL_LABEL } from '@/lib/format';
import { sortByLevel, splitIntoColumns } from '@/lib/skills';
import type { SkillGroup, SkillLevel } from '@/lib/types';

type Skill = SkillGroup['skills'][number];

const MAX_COLUMNS = 3;

const LEVEL_STYLE: Record<SkillLevel, string> = {
  SOLID: 'border-accent bg-accent text-accent-contrast',
  INTERMEDIATE: 'border-accent text-text',
  BASIC: 'border-border-strong text-text',
};

// Clases completas para que Tailwind las genere: con menos categorías, menos columnas.
const DESKTOP_COLUMNS = ['', 'lg:grid-cols-1', 'lg:grid-cols-2', 'lg:grid-cols-3'];

/** Mismo ancho en todas las filas, para que los niveles queden alineados. */
function LevelTag({ level }: { level: SkillLevel | null }) {
  if (!level) return <span aria-hidden="true" className="w-24 shrink-0" />;
  return (
    <span
      data-level={level}
      className={`w-24 shrink-0 rounded-sm border py-0.5 text-center font-mono text-label ${LEVEL_STYLE[level]}`}
    >
      {SKILL_LEVEL_LABEL[level]}
    </span>
  );
}

const ROW = 'flex min-h-11 items-center gap-3 py-1.5';

function SkillRow({ skill }: { skill: Skill }) {
  const name = <span className="min-w-0 flex-1 font-medium">{skill.name}</span>;

  if (skill.projects.length === 0) {
    return (
      <div className={ROW}>
        {name}
        <LevelTag level={skill.level} />
        {/* Conserva el lugar de la flecha: así los niveles se alinean con las otras filas. */}
        <span aria-hidden="true" className="w-4 shrink-0" />
      </div>
    );
  }

  // <details> da teclado y lector de pantalla sin JavaScript. La animación está en globals.css.
  return (
    <details className="skill-row group">
      <summary
        className={`${ROW} cursor-pointer list-none rounded-sm hover:text-accent [&::-webkit-details-marker]:hidden`}
      >
        {name}
        <span className="sr-only">. Ver proyectos donde se usó. Nivel:</span>
        <LevelTag level={skill.level} />
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-90"
        >
          <path
            d="M6 3.5 10.5 8 6 12.5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
          />
        </svg>
      </summary>
      <div className="skill-row-panel">
        <p className="pb-3 text-sm text-muted">
          Usada en{' '}
          {skill.projects.map((project, i) => (
            <span key={project.slug}>
              {i > 0 && ', '}
              {/* Un <a> y no un Link: son muchos, y así no cargan ni precargan nada. */}
              <a href={`/proyectos/${project.slug}`} className="underline">
                {project.title}
              </a>
            </span>
          ))}
        </p>
      </div>
    </details>
  );
}

function SkillCard({ group }: { group: SkillGroup }) {
  return (
    // Si la columna tiene espacio de sobra, lo reparten las filas en partes iguales: así no queda
    // una tarjeta con un hueco al final. flexGrow solo actúa en las columnas de escritorio.
    <div
      className="flex flex-col rounded-md border border-border bg-surface p-4"
      style={{ flexGrow: group.skills.length }}
    >
      <h3 className="text-lg">{group.category}</h3>
      <ul className="mt-2 flex grow flex-col divide-y divide-border">
        {sortByLevel(group.skills).map((skill) => (
          <li key={skill.name} className="flex grow flex-col justify-center">
            <SkillRow skill={skill} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Una tarjeta por categoría. El nivel va en texto, sin barras ni porcentajes (docs/diseno.md). */
export function Skills({ groups }: { groups: SkillGroup[] }) {
  const columns = splitIntoColumns(groups, MAX_COLUMNS);
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${DESKTOP_COLUMNS[columns.length] ?? ''}`}>
      {columns.map((column, index) => (
        // Hasta escritorio la columna no existe (contents): las tarjetas siguen el orden del panel.
        <div key={index} className="contents lg:flex lg:flex-col lg:gap-4">
          {column.map((group) => (
            <SkillCard key={group.category} group={group} />
          ))}
        </div>
      ))}
    </div>
  );
}
