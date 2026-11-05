import { createInterface } from 'node:readline/promises';

export function requireTerminal() {
  if (!process.stdin.isTTY) {
    throw new Error(
      'Este comando es interactivo: ejecutalo en una terminal (docker compose exec).',
    );
  }
}

export async function ask(question: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

/** Lee sin eco. La contraseña no pasa por argumentos ni variables: no queda en el historial. */
export function askHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;
  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (done: () => void) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      stdout.write('\n');
      done();
    };
    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\u0003') return finish(() => reject(new Error('Cancelado')));
        if (char === '\r' || char === '\n') return finish(() => resolve(value));
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on('data', onData);
  });
}
