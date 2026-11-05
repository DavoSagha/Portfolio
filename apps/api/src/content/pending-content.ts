import type { Db } from '../db/client.js';
import { isTodo } from '../seed/placeholder.js';

/**
 * Lista el contenido pendiente: textos con marcador TODO y datos obligatorios vacíos.
 * Antes de producción tiene que devolver una lista vacía (definición de terminado).
 */
export async function findPendingContent(db: Db): Promise<string[]> {
  const pending: string[] = [];
  const checkTexts = (where: string, fields: Record<string, unknown>) => {
    for (const [field, value] of Object.entries(fields)) {
      if (typeof value === 'string' && isTodo(value)) pending.push(`${where} · ${field}: ${value}`);
    }
  };

  const profile = await db.profile.findUnique({
    where: { id: 1 },
    include: { translations: true },
  });
  if (!profile) {
    pending.push('Perfil: no existe');
  } else {
    if (!profile.photoFileId) pending.push('Perfil · foto: falta');
    for (const t of profile.translations) checkTexts(`Perfil (${t.locale})`, t);
  }

  const projects = await db.project.findMany({
    include: { translations: true },
    orderBy: { order: 'asc' },
  });
  for (const p of projects) {
    if (!p.team) pending.push(`Proyecto ${p.slug} · equipo: falta`);
    if (!p.origin) pending.push(`Proyecto ${p.slug} · origen: falta`);
    for (const t of p.translations) checkTexts(`Proyecto ${p.slug} (${t.locale})`, t);
  }

  const skillsWithoutLevel = await db.skill.findMany({
    where: { level: null },
    select: { name: true },
  });
  if (skillsWithoutLevel.length > 0) {
    pending.push(`Skills sin nivel (ocultas): ${skillsWithoutLevel.map((s) => s.name).join(', ')}`);
  }

  const certs = await db.timelineEntry.findMany({
    where: { type: 'CERTIFICATION', credentialUrl: null },
    include: { translations: true },
  });
  for (const c of certs) {
    pending.push(`Certificación "${c.translations[0]?.title ?? c.id}" · link: falta`);
  }

  const timeline = await db.timelineEntryTranslation.findMany();
  for (const t of timeline) checkTexts(`Trayectoria ${t.entryId} (${t.locale})`, t);

  const cvProfiles = await db.cvProfile.findMany({ where: { currentVersionId: null } });
  for (const cv of cvProfiles) pending.push(`CV ${cv.key.toLowerCase()}: sin versión vigente`);

  return pending;
}
