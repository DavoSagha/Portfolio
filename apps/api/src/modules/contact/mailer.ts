import nodemailer from 'nodemailer';

export interface ContactEmail {
  name: string;
  email: string;
  body: string;
}

export interface Mailer {
  sendContactEmail(message: ContactEmail): Promise<void>;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
  /** En producción, siempre: las credenciales nunca viajan sin cifrar. */
  requireTls: boolean;
}

/** SMTP genérico (D-019): cambiar de proveedor es cambiar variables de entorno. */
export class SmtpMailer implements Mailer {
  private readonly transport;

  constructor(private readonly config: SmtpConfig) {
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      requireTLS: config.requireTls,
      ignoreTLS: !config.requireTls && config.port !== 465,
      auth: { user: config.user, pass: config.pass },
      // Sin estos límites, un servidor que no responde dejaría el envío colgado.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async sendContactEmail({ name, email, body }: ContactEmail) {
    await this.transport.sendMail({
      from: this.config.from,
      to: this.config.to,
      // Responder le escribe a quien mandó el mensaje. El remitente sigue siendo la cuenta propia:
      // usar el email del visitante como remitente haría que el proveedor rechace el envío.
      replyTo: { name, address: email },
      subject: `Mensaje del portfolio: ${name}`,
      text: `${name} <${email}> escribió:\n\n${body}\n`,
    });
  }
}

/** Sin SMTP configurado: el mensaje queda guardado y el panel muestra que no se envió. */
export class DisabledMailer implements Mailer {
  sendContactEmail(): Promise<void> {
    return Promise.reject(new Error('SMTP sin configurar'));
  }
}
