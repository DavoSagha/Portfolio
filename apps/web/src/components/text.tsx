const TODO_PREFIX = 'TODO:';

export const isTodo = (value: string | null | undefined): boolean =>
  typeof value === 'string' && value.trimStart().startsWith(TODO_PREFIX);

/**
 * Renderiza un texto editable. Si es un marcador de dato pendiente ("TODO: …"), lo muestra
 * resaltado para que no pase inadvertido; antes de producción no debe quedar ninguno.
 */
export function Text({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  if (!value) return null;
  if (isTodo(value)) {
    return (
      <span className="todo" title="Dato pendiente de completar desde el panel">
        {value}
      </span>
    );
  }
  return <span className={`whitespace-pre-line ${className ?? ''}`}>{value}</span>;
}
