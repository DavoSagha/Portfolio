import type { Db } from '../../db/client.js';

export class FilesRepository {
  constructor(private readonly db: Db) {}

  /**
   * Devuelve el archivo solo si está referenciado por contenido publicado:
   * foto de perfil, portada o imagen de un proyecto publicado. Los CV se descargan por /cv.
   */
  findPublicFile(id: string) {
    return this.db.storedFile.findFirst({
      where: {
        id,
        OR: [
          { profilePhotoOf: { some: {} } },
          { projectCoverOf: { some: { status: 'PUBLISHED' } } },
          { projectImages: { some: { project: { status: 'PUBLISHED' } } } },
        ],
      },
    });
  }

  createFile(data: {
    storageKey: string;
    originalName: string;
    mimeType: string;
    size: number;
    sha256: string;
  }) {
    return this.db.storedFile.create({ data });
  }

  findFile(id: string) {
    return this.db.storedFile.findUnique({ where: { id } });
  }

  async findProfilePhotoId() {
    const profile = await this.db.profile.findUnique({
      where: { id: 1 },
      select: { photoFileId: true },
    });
    return profile?.photoFileId ?? null;
  }

  setProfilePhoto(fileId: string | null) {
    return this.db.profile.update({ where: { id: 1 }, data: { photoFileId: fileId } });
  }

  /** Borra el registro si ya nada lo usa y devuelve su clave de disco; si no, null. */
  deleteIfUnreferenced(id: string) {
    return this.db.$transaction(async (tx) => {
      const file = await tx.storedFile.findUnique({ where: { id } });
      if (!file) return null;
      // Una consulta por vez: dentro de una transacción comparten una sola conexión.
      const uses = [
        await tx.profile.count({ where: { photoFileId: id } }),
        await tx.project.count({ where: { coverFileId: id } }),
        await tx.projectImage.count({ where: { fileId: id } }),
        await tx.cvVersion.count({ where: { fileId: id } }),
      ];
      if (uses.some((count) => count > 0)) return null;
      await tx.storedFile.delete({ where: { id } });
      return file.storageKey;
    });
  }
}
