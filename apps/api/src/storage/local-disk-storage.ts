import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { notFound } from '../http/errors.js';
import { FILE_KINDS, type FileKind } from '../lib/file-type.js';
import type { StorageService } from './storage.js';

// Las claves las genera el sistema; cualquier otra forma se rechaza (evita path traversal).
const KEY_PATTERN = /^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/;

export class LocalDiskStorage implements StorageService {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir);
  }

  async put(data: Buffer, kind: FileKind): Promise<{ key: string }> {
    const key = `${randomUUID()}.${FILE_KINDS[kind].extension}`;
    await mkdir(this.baseDir, { recursive: true });
    // flag "wx": falla si por algún motivo la clave ya existe, en vez de sobrescribir.
    await writeFile(this.resolve(key), data, { flag: 'wx' });
    return { key };
  }

  async getStream(key: string): Promise<Readable> {
    const filePath = this.resolve(key);
    try {
      await access(filePath);
    } catch {
      throw notFound('Archivo no encontrado');
    }
    return createReadStream(filePath);
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  private resolve(key: string): string {
    if (!KEY_PATTERN.test(key)) {
      throw new Error(`Clave de almacenamiento inválida: ${key}`);
    }
    return path.join(this.baseDir, key);
  }
}
