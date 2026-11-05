const dayFormat = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const formatDay = (date: string) => dayFormat.format(new Date(`${date}T00:00:00Z`));

/**
 * Visitas por día: una sola serie, así que el título la nombra y no hace falta leyenda.
 * Cada columna completa es el área de hover, más grande que la barra. La tabla es la vista
 * accesible, y también la manera de leer los valores exactos.
 */
export function DailyChart({ days }: { days: { date: string; count: number }[] }) {
  const max = Math.max(...days.map((day) => day.count), 0);
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const first = days[0];
  const last = days.at(-1);

  return (
    <figure>
      <figcaption className="text-lg font-semibold">Visitas por día</figcaption>
      {max === 0 ? (
        <p className="mt-3 text-sm text-muted">No hay visitas en este período.</p>
      ) : (
        <>
          <div className="mt-4 flex gap-3">
            <div
              aria-hidden="true"
              className="flex h-40 flex-col justify-between text-right font-mono text-label text-muted"
            >
              <span>{max}</span>
              <span>0</span>
            </div>
            <div className="min-w-0 flex-1">
              <div
                role="img"
                aria-label={`${total} visitas entre ${first && formatDay(first.date)} y ${last && formatDay(last.date)}. El máximo diario fue ${max}. El detalle está en la tabla.`}
                className="flex h-40 items-end gap-0.5 border-b border-border-strong"
              >
                {days.map((day) => (
                  <div
                    key={day.date}
                    className="group relative flex h-full min-w-0 flex-1 items-end hover:bg-border/40"
                  >
                    <div
                      className="w-full rounded-t-sm bg-chart"
                      style={{
                        // Un día con visitas siempre se ve, aunque sean pocas frente al máximo.
                        height: day.count === 0 ? 0 : `max(${(day.count / max) * 100}%, 3px)`,
                      }}
                    />
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-sm border border-border-strong bg-surface px-2 py-1 text-sm whitespace-nowrap text-text group-hover:block">
                      {formatDay(day.date)}: {day.count}
                    </div>
                  </div>
                ))}
              </div>
              <div
                aria-hidden="true"
                className="mt-1 flex justify-between font-mono text-label text-muted"
              >
                <span>{first && formatDay(first.date)}</span>
                <span>{last && formatDay(last.date)}</span>
              </div>
            </div>
          </div>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted">Ver como tabla</summary>
            <table className="mt-2 w-full max-w-xs">
              <thead className="text-left text-muted">
                <tr>
                  <th scope="col" className="py-1 font-medium">
                    Día
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Visitas
                  </th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.date} className="border-t border-border">
                    <td className="py-1">{formatDay(day.date)}</td>
                    <td className="py-1 text-right font-mono">{day.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </figure>
  );
}
