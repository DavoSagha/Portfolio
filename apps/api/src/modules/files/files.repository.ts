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

  setProfilePhoto(fileId: string) {
    return this.db.profile.update({ where: { id: 1 }, data: { photoFileId: fileId } });
  }
}
