/**
 * Marcador de dato pendiente. El seed lo usa en vez de inventar contenido, la web lo
 * resalta y `npm run content:todos` lista todos los que quedan antes de producción.
 */
export const TODO_PREFIX = 'TODO:';
export const todo = (what: string) => `${TODO_PREFIX} ${what}`;
export const isTodo = (value: string | null | undefined) =>
  typeof value === 'string' && value.trimStart().startsWith(TODO_PREFIX);
