import Link from 'next/link';
import { formatRange, TIMELINE_TYPE_LABEL } from '@/lib/format';
import type { TimelineEntry } from '@/lib/types';
import { Text } from './text';

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="relative max-w-prose border-l border-border-strong">
      {entries.map((e, i) => {
        // Una certificación tiene fecha de emisión, no un período en curso.
        const dates = formatRange(e.startDate, e.endDate, e.datePrecision, {
          ongoingIfNoEnd: e.type !== 'CERTIFICATION',
        });
        return (
          <li key={`${e.type}-${e.startDate}-${i}`} className="relative pb-10 pl-6 last:pb-0">
            <span
              aria-hidden="true"
              className="absolute top-2 -left-[5px] size-2.5 rounded-full bg-accent"
            />
            <p className="font-mono text-label tracking-(--text-label--letter-spacing) text-muted uppercase">
              {TIMELINE_TYPE_LABEL[e.type]}
              {dates && (
                <>
                  <span aria-hidden="true"> · </span>
                  {dates}
                </>
              )}
            </p>
            <h3 className="mt-1 text-lg">{e.title}</h3>
            <p className="text-muted">{e.organization}</p>
            {e.description && (
              <p className="mt-2">
                <Text value={e.description} />
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              {e.credentialUrl && (
                <a href={e.credentialUrl} rel="noopener" target="_blank">
                  Ver credencial<span className="sr-only"> (abre en otra pestaña)</span>
                </a>
              )}
              {e.relatedProjectSlug && (
                <Link href={`/proyectos/${e.relatedProjectSlug}`}>Ver proyecto relacionado</Link>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
