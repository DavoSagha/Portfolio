import type { Readable } from 'node:stream';
import type { FileKind } from '../lib/file-type.js';

/**
 * Almacenamiento de archivos detrás de una interfaz (D-018).
 * Los servicios no saben si los bytes viven en disco o en un almacenamiento de objetos.
 */
export interface StorageService {
  /** Guarda los bytes con un nombre generado por el sistema y devuelve su clave. */
  put(data: Buffer, kind: FileKind): Promise<{ key: string }>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}
