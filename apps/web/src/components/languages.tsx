import { languageLevelLabel } from '@/lib/format';
import type { Language } from '@/lib/types';

export function Languages({ languages }: { languages: Language[] }) {
  return (
    <ul className="flex flex-wrap gap-3">
      {languages.map((l) => (
        <li key={l.code} className="rounded-md border border-border bg-surface px-4 py-3">
          <span className="font-medium">{l.name}</span>
          <span className="ml-3 font-mono text-label text-muted">
            {languageLevelLabel(l.level)}
          </span>
        </li>
      ))}
    </ul>
  );
}
