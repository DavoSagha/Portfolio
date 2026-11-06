import type { SkillGroup, SkillLevel } from './types';

type Skill = SkillGroup['skills'][number];

const LEVEL_RANK: Record<SkillLevel, number> = { SOLID: 0, INTERMEDIATE: 1, BASIC: 2 };
const NO_LEVEL_RANK = 3;

/** Sólido, Intermedio y Básico. El orden es estable: dentro de cada nivel, respeta el del panel. */
export function sortByLevel(skills: Skill[]): Skill[] {
  const rank = (skill: Skill) => (skill.level ? LEVEL_RANK[skill.level] : NO_LEVEL_RANK);
  return skills.toSorted((a, b) => rank(a) - rank(b));
}

/** Alto aproximado de una tarjeta, en filas: el título ocupa como dos. */
const cardWeight = (group: SkillGroup) => group.skills.length + 2;

/**
 * Reparte las categorías en columnas sin cambiar su orden, buscando que la más alta sea lo más
 * baja posible. Se calcula una sola vez: a diferencia de las columnas de CSS, las tarjetas no
 * saltan de columna cuando se despliega una fila.
 */
export function splitIntoColumns(groups: SkillGroup[], maxColumns: number): SkillGroup[][] {
  const count = Math.min(maxColumns, groups.length);
  let best: SkillGroup[][] = [];
  let bestTallest = Infinity;

  const place = (start: number, columns: SkillGroup[][]) => {
    if (columns.length === count - 1) {
      const candidate = [...columns, groups.slice(start)];
      const tallest = Math.max(
        ...candidate.map((column) => column.reduce((sum, group) => sum + cardWeight(group), 0)),
      );
      if (tallest < bestTallest) {
        best = candidate;
        bestTallest = tallest;
      }
      return;
    }
    const remainingColumns = count - columns.length - 1;
    for (let end = start + 1; end <= groups.length - remainingColumns; end++) {
      place(end, [...columns, groups.slice(start, end)]);
    }
  };

  if (count > 0) place(0, []);
  return best;
}
