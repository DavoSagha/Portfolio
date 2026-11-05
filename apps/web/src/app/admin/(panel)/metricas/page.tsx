import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { DailyChart } from '@/components/admin/daily-chart';
import { adminGet } from '@/lib/admin-server';
import type { AdminMetricsSummary } from '@/lib/admin-types';

export const metadata: Metadata = { title: 'Métricas' };

const inputClass =
  'mt-1 block min-h-11 rounded-md border border-border-strong bg-surface px-3 py-2 text-text';

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold">{value}</dd>
    </div>
  );
}

function DataTable({
  title,
  headers,
  rows,
  empty,
}: {
  title: string;
  headers: [string, ...string[]];
  rows: { key: string; cells: ReactNode[] }[];
  empty: string;
}) {
  return (
    <section className="min-w-0">
      <h2 className="text-lg">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              {headers.map((header, i) => (
                <th
                  key={header}
                  scope="col"
                  className={`py-1 font-medium ${i > 0 ? 'text-right' : ''}`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-border">
                {row.cells.map((cell, i) => (
                  <td key={i} className={`py-1 ${i > 0 ? 'text-right font-mono' : 'break-words'}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default async function AdminMetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { desde, hasta } = await searchParams;
  const query = new URLSearchParams();
  if (desde) query.set('from', desde);
  if (hasta) query.set('to', hasta);
  const suffix = query.size > 0 ? `&${query}` : '';
  const [summary, days] = await Promise.all([
    adminGet<AdminMetricsSummary>(`/metrics/summary?${query}`),
    adminGet<{ date: string; count: number }[]>(`/metrics/timeseries?type=PAGE_VIEW${suffix}`),
  ]);

  return (
    <>
      <h1 className="text-2xl">Métricas</h1>
      <p className="mt-2 text-sm text-muted">
        Sin cookies y sin guardar IP. Tus visitas con sesión no se cuentan. Los días van en UTC.
      </p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-sm font-medium">Desde</span>
          <input type="date" name="desde" defaultValue={desde} className={inputClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Hasta</span>
          <input type="date" name="hasta" defaultValue={hasta} className={inputClass} />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-md border border-border-strong px-3 py-2 text-sm font-medium hover:border-accent hover:text-accent"
        >
          Aplicar
        </button>
        {(desde || hasta) && (
          <Link href="/admin/metricas" className="inline-flex min-h-11 items-center text-sm">
            Últimos 30 días
          </Link>
        )}
      </form>

      {!summary || !days ? (
        <p role="alert" className="mt-6 text-danger">
          El rango no es válido: la fecha inicial debe ser anterior a la final, con hasta 366 días
          entre ambas.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tile label="Visitas" value={summary.pageViews} />
            <Tile label="Visitantes únicos" value={summary.uniqueVisitors} />
            <Tile label="Descargas de CV" value={summary.cvDownloads} />
            <Tile label="Clics a proyectos" value={summary.projectClicks} />
            <Tile label="Mensajes" value={summary.contactSubmits} />
          </dl>
          <p className="text-sm text-muted">
            Visitantes únicos suma los de cada día: quien vuelve otro día cuenta otra vez.
          </p>

          <DailyChart days={days} />

          <div className="grid gap-8 lg:grid-cols-2">
            <DataTable
              title="Origen (?ref=)"
              headers={['Origen', 'Visitas', 'Descargas']}
              empty="Sin visitas con origen."
              rows={summary.byRef.map((row) => ({
                key: row.ref,
                cells: [row.ref, row.pageViews, row.cvDownloads],
              }))}
            />
            <DataTable
              title="Descargas por versión de CV"
              headers={['Versión', 'Descargas']}
              empty="Sin descargas."
              rows={summary.byCvVersion.map((row) => ({
                key: row.versionId,
                cells: [
                  row.label ? `${row.label} (${row.profile})` : 'Versión borrada',
                  row.downloads,
                ],
              }))}
            />
            <DataTable
              title="Páginas más visitadas"
              headers={['Página', 'Visitas']}
              empty="Sin visitas."
              rows={summary.topPages.map((row) => ({
                key: row.path,
                cells: [row.path, row.views],
              }))}
            />
            <DataTable
              title="Proyectos con más clics"
              headers={['Proyecto', 'Clics']}
              empty="Sin clics."
              rows={summary.topProjects.map((row) => ({
                key: row.slug,
                cells: [row.title, row.clicks],
              }))}
            />
          </div>
        </div>
      )}
    </>
  );
}
