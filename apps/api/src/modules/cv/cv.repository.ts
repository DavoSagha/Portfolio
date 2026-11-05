import type { Db } from '../../db/client.js';
import type { CvProfileKey } from '../../generated/prisma/enums.js';

export class CvRepository {
  constructor(private readonly db: Db) {}

  findPrimaryProfileKey() {
    return this.db.profile.findUnique({
      where: { id: 1 },
      select: { primaryCvProfile: true, fullName: true },
    });
  }

  findCurrentVersion(key: CvProfileKey) {
    return this.db.cvProfile.findUnique({
      where: { key },
      select: { currentVersion: { include: { file: true } } },
    });
  }

  findProfilesWithVersions() {
    return this.db.cvProfile.findMany({
      orderBy: { key: 'asc' },
      include: {
        versions: { orderBy: { uploadedAt: 'desc' }, include: { file: true } },
      },
    });
  }

  findVersion(id: string) {
    return this.db.cvVersion.findUnique({
      where: { id },
      include: { file: true, currentOf: { select: { key: true } } },
    });
  }

  setCurrent(key: CvProfileKey, versionId: string) {
    return this.db.cvProfile.update({ where: { key }, data: { currentVersionId: versionId } });
  }

  setPrimary(key: CvProfileKey) {
    return this.db.profile.update({ where: { id: 1 }, data: { primaryCvProfile: key } });
  }

  /** Cada versión tiene su propio archivo: se borran juntos y se devuelve la clave de disco. */
  deleteVersionAndFile(id: string, fileId: string) {
    return this.db.$transaction([
      this.db.cvVersion.delete({ where: { id } }),
      this.db.storedFile.delete({ where: { id: fileId } }),
    ]);
  }

  /** Crea el archivo y la versión, y opcionalmente la marca vigente, en una transacción. */
  createVersion(input: {
    profileKey: CvProfileKey;
    label: string;
    makeCurrent: boolean;
    file: {
      storageKey: string;
      originalName: string;
      mimeType: string;
      size: number;
      sha256: string;
    };
  }) {
    return this.db.$transaction(async (tx) => {
      const file = await tx.storedFile.create({ data: input.file });
      await tx.cvProfile.upsert({
        where: { key: input.profileKey },
        create: { key: input.profileKey },
        update: {},
      });
      const version = await tx.cvVersion.create({
        data: { profileKey: input.profileKey, fileId: file.id, label: input.label },
      });
      if (input.makeCurrent) {
        await tx.cvProfile.update({
          where: { key: input.profileKey },
          data: { currentVersionId: version.id },
        });
      }
      return version;
    });
  }
}
