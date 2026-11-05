import type { StorageService } from '../../storage/storage.js';
import type { FilesRepository } from './files.repository.js';

/**
 * Borra archivos que ya nadie usa, de la base y del disco. Primero la base: si falla el disco
 * queda un archivo huérfano (inofensivo), y no un registro que apunta a la nada.
 */
export class FileCleanup {
  constructor(
    private readonly repo: FilesRepository,
    private readonly storage: StorageService,
  ) {}

  async remove(fileIds: (string | null | undefined)[]) {
    for (const id of new Set(fileIds)) {
      if (!id) continue;
      const storageKey = await this.repo.deleteIfUnreferenced(id);
      if (!storageKey) continue;
      await this.storage.delete(storageKey).catch((err: unknown) => {
        console.error(`No se pudo borrar del disco el archivo ${id}:`, err);
      });
    }
  }
}
