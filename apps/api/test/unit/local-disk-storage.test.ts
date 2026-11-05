import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { text } from 'node:stream/consumers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalDiskStorage } from '../../src/storage/local-disk-storage.js';

describe('LocalDiskStorage', () => {
  let dir: string;
  let storage: LocalDiskStorage;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'storage-test-'));
    storage = new LocalDiskStorage(dir);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('guarda con un nombre propio y lo lee de vuelta', async () => {
    const { key } = await storage.put(Buffer.from('%PDF-hola'), 'pdf');
    expect(key).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(await text(await storage.getStream(key))).toBe('%PDF-hola');
  });

  it('rechaza claves que no generó el sistema (path traversal)', async () => {
    await expect(storage.getStream('../../etc/passwd')).rejects.toThrow(/inválida/);
    await expect(storage.delete('../secreto.pdf')).rejects.toThrow(/inválida/);
  });

  it('borra el archivo', async () => {
    const { key } = await storage.put(Buffer.from('x'), 'png');
    await storage.delete(key);
    expect(await readdir(dir)).toHaveLength(0);
  });
});
