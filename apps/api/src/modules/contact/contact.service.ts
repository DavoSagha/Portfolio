import type { ContactRepository } from './contact.repository.js';
import type { ContactEmail, Mailer } from './mailer.js';

export class ContactService {
  constructor(
    private readonly repo: ContactRepository,
    private readonly mailer: Mailer,
  ) {}

  /**
   * Primero guarda, después envía: un fallo del SMTP no pierde el mensaje (D-019).
   * El envío no bloquea la respuesta: la persona no espera al proveedor ni se entera si falla.
   */
  async receive(message: ContactEmail) {
    const saved = await this.repo.create(message);
    void this.deliver(saved.id, message);
  }

  private async deliver(id: string, message: ContactEmail) {
    try {
      await this.mailer.sendContactEmail(message);
      await this.repo.markSent(id);
    } catch (err) {
      // Solo el motivo: al log y a la base no van el mensaje ni los datos de quien lo mandó.
      const reason = err instanceof Error ? err.message.slice(0, 200) : 'Error desconocido';
      console.error(`No se pudo enviar el mensaje ${id} por email: ${reason}`);
      await this.repo.markFailed(id, reason).catch((dbErr: unknown) => {
        console.error(`No se pudo registrar el fallo del mensaje ${id}:`, dbErr);
      });
    }
  }
}
