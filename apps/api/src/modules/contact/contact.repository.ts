import type { Db } from '../../db/client.js';

export class ContactRepository {
  constructor(private readonly db: Db) {}

  create(data: { name: string; email: string; body: string }) {
    return this.db.contactMessage.create({ data });
  }

  markSent(id: string) {
    return this.db.contactMessage.update({
      where: { id },
      data: { emailSentAt: new Date(), emailError: null },
    });
  }

  markFailed(id: string, emailError: string) {
    return this.db.contactMessage.update({ where: { id }, data: { emailError } });
  }

  /** Más nuevos primero. Se ordena también por id para que la paginación sea estable. */
  list(options: { unreadOnly: boolean; limit: number; cursor?: string }) {
    return this.db.contactMessage.findMany({
      where: options.unreadOnly ? { readAt: null } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
  }

  countUnread() {
    return this.db.contactMessage.count({ where: { readAt: null } });
  }

  setRead(id: string, read: boolean) {
    return this.db.contactMessage.update({
      where: { id },
      data: { readAt: read ? new Date() : null },
    });
  }

  delete(id: string) {
    return this.db.contactMessage.delete({ where: { id } });
  }
}
