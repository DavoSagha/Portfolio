import Link from 'next/link';

/** Ruta de navegación. El último elemento es la página actual y no lleva link. */
export function Breadcrumb({
  items,
  current,
}: {
  items: { href: string; label: string }[];
  current: string;
}) {
  return (
    <nav aria-label="Ruta de navegación" className="text-sm">
      <ol className="flex flex-wrap items-center gap-x-2">
        {items.map((item) => (
          <li key={item.href} className="flex items-center gap-x-2">
            <Link href={item.href} className="inline-block py-1">
              {item.label}
            </Link>
            <span aria-hidden="true" className="text-muted">
              /
            </span>
          </li>
        ))}
        <li>
          <span aria-current="page" className="inline-block py-1 text-text">
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}
