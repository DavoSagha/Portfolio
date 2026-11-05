import { createHash } from 'node:crypto';
import type { CvProfileKey } from '../../generated/prisma/enums.js';
import { AppError, notFound } from '../../http/errors.js';
import { detectFileKind, FILE_KINDS } from '../../lib/file-type.js';
import type { StorageService } from '../../storage/storage.js';
import type { CvRepository } from './cv.repository.js';

export const CV_MAX_BYTES = 5 * 1024 * 1024;

const PROFILE_LABEL: Record<CvProfileKey, string> = {
  BACKEND: 'Backend',
  MAINFRAME: 'Mainframe',
  SOPORTE: 'Soporte',
};

/** "David Saghatelyan" + BACKEND → "CV-David-Saghatelyan-Backend.pdf" (solo ASCII seguro). */
export function cvFileName(fullName: string, key: CvProfileKey): string {
  const name = fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ['CV', name, PROFILE_LABEL[key]].filter(Boolean).join('-') + '.pdf';
}

export class CvService {
  constructor(
    private readonly repo: CvRepository,
    private readonly storage: StorageService,
  ) {}

  /** Versión vigente del perfil pedido, o del perfil principal si no se indica. */
  async getCurrentDownload(requested?: CvProfileKey) {
    const profile = await this.repo.findPrimaryProfileKey();
    const key = requested ?? profile?.primaryCvProfile ?? 'BACKEND';
    const row = await this.repo.findCurrentVersion(key);
    const version = row?.currentVersion;
    if (!version) throw notFound('No hay un CV vigente para este perfil');

    return {
      versionId: version.id,
      fileName: cvFileName(profile?.fullName ?? '', key),
      size: version.file.size,
      stream: await this.storage.getStream(version.file.storageKey),
    };
  }

  async listForAdmin() {
    const [profile, profiles] = await Promise.all([
      this.repo.findPrimaryProfileKey(),
      this.repo.findProfilesWithVersions(),
    ]);
    return {
      primaryProfile: (profile?.primaryCvProfile ?? 'BACKEND').toLowerCase(),
      profiles: profiles.map((p) => ({
        profile: p.key.toLowerCase(),
        currentVersionId: p.currentVersionId,
        versions: p.versions.map((v) => ({
          id: v.id,
          label: v.label,
          uploadedAt: v.uploadedAt,
          size: v.file.size,
        })),
      })),
    };
  }

  async setCurrent(key: CvProfileKey, versionId: string) {
    const version = await this.repo.findVersion(versionId);
    if (!version) throw notFound('Versión no encontrada');
    if (version.profileKey !== key) {
      throw new AppError(409, 'CONFLICT', 'La versión pertenece a otro perfil');
    }
    await this.repo.setCurrent(key, versionId);
  }

  async setPrimary(key: CvProfileKey) {
    const current = await this.repo.findCurrentVersion(key);
    if (!current?.currentVersion) {
      throw new AppError(409, 'CONFLICT', 'Ese perfil no tiene una versión vigente');
    }
    await this.repo.setPrimary(key);
  }

  async deleteVersion(id: string) {
    const version = await this.repo.findVersion(id);
    if (!version) throw notFound('Versión no encontrada');
    if (version.currentOf) {
      throw new AppError(409, 'CONFLICT', 'No se puede borrar la versión vigente');
    }
    await this.repo.deleteVersionAndFile(id, version.fileId);
    await this.storage.delete(version.file.storageKey).catch((err: unknown) => {
      console.error(`No se pudo borrar del disco la versión ${id}:`, err);
    });
  }

  async getVersionFile(id: string) {
    const version = await this.repo.findVersion(id);
    if (!version) throw notFound('Versión no encontrada');
    return {
      size: version.file.size,
      stream: await this.storage.getStream(version.file.storageKey),
    };
  }

  /** Valida y guarda una nueva versión del CV. La usan el CLI (Fase 1) y el panel (Fase 3). */
  async importVersion(input: {
    profileKey: CvProfileKey;
    label: string;
    data: Buffer;
    originalName: string;
    makeCurrent: boolean;
  }) {
    if (input.data.length > CV_MAX_BYTES) {
      throw new AppError(413, 'FILE_TOO_LARGE', 'El CV supera los 5 MB');
    }
    if (detectFileKind(input.data) !== 'pdf') {
      throw new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'El CV debe ser un PDF');
    }
    const label = input.label.trim();
    if (label.length === 0 || label.length > 100) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'La etiqueta debe tener entre 1 y 100 caracteres',
      );
    }

    const { key } = await this.storage.put(input.data, 'pdf');
    try {
      return await this.repo.createVersion({
        profileKey: input.profileKey,
        label,
        makeCurrent: input.makeCurrent,
        file: {
          storageKey: key,
          originalName: input.originalName.slice(0, 255),
          mimeType: FILE_KINDS.pdf.mimeType,
          size: input.data.length,
          sha256: createHash('sha256').update(input.data).digest('hex'),
        },
      });
    } catch (err) {
      // Si falla la base, no dejar el archivo huérfano en disco.
      await this.storage.delete(key);
      throw err;
    }
  }
}
