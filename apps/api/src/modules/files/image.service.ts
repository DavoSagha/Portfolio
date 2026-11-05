import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { AppError } from '../../http/errors.js';
import { detectFileKind, FILE_KINDS } from '../../lib/file-type.js';
import type { StorageService } from '../../storage/storage.js';
import type { FilesRepository } from './files.repository.js';

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const IMAGE_KINDS = new Set(['jpg', 'png', 'webp']);

/**
 * Valida y reprocesa imágenes (D-017): solo JPG, PNG o WebP reales, hasta 5 MB.
 * Se vuelven a codificar como WebP, lo que descarta EXIF, GPS y cualquier otro metadato.
 * Lo usan el comando photo:import (Fase 1) y el panel (Fase 3).
 */
export class ImageService {
  constructor(
    private readonly repo: FilesRepository,
    private readonly storage: StorageService,
  ) {}

  /** Reprocesa la imagen y devuelve los bytes limpios, sin guardarlos. */
  async sanitize(data: Buffer): Promise<Buffer> {
    if (data.length > IMAGE_MAX_BYTES) {
      throw new AppError(413, 'FILE_TOO_LARGE', 'La imagen supera los 5 MB');
    }
    const kind = detectFileKind(data);
    if (!kind || !IMAGE_KINDS.has(kind)) {
      throw new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'La imagen debe ser JPG, PNG o WebP');
    }
    try {
      return await sharp(data, { failOn: 'error' })
        .rotate() // aplica la orientación EXIF antes de descartar los metadatos
        .resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer(); // sharp no copia metadatos salvo que se pida con withMetadata()
    } catch {
      // Firma válida pero contenido corrupto o malicioso: no se puede decodificar.
      throw new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'La imagen está dañada o no se puede leer');
    }
  }

  async importImage(input: { data: Buffer; originalName: string }) {
    const clean = await this.sanitize(input.data);
    const { key } = await this.storage.put(clean, 'webp');
    try {
      return await this.repo.createFile({
        storageKey: key,
        originalName: input.originalName.slice(0, 255),
        mimeType: FILE_KINDS.webp.mimeType,
        size: clean.length,
        sha256: createHash('sha256').update(clean).digest('hex'),
      });
    } catch (err) {
      await this.storage.delete(key);
      throw err;
    }
  }

  async importProfilePhoto(input: { data: Buffer; originalName: string }) {
    const file = await this.importImage(input);
    await this.repo.setProfilePhoto(file.id);
    return file;
  }
}
