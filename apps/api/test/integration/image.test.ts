import request from 'supertest';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FilesRepository } from '../../src/modules/files/files.repository.js';
import { IMAGE_MAX_BYTES, ImageService } from '../../src/modules/files/image.service.js';
import { runSeed } from '../../src/seed/seed.js';
import { createTestApp, samplePdf } from '../helpers/app.js';
import { createTestDb, resetDb } from '../helpers/db.js';

const db = createTestDb();
let ctx: Awaited<ReturnType<typeof createTestApp>>;
let service: ImageService;

/** JPG de prueba con EXIF (incluye un dato de GPS y un comentario). */
const jpegWithExif = () =>
  sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#336699' } })
    .jpeg()
    .withMetadata({
      exif: {
        IFD0: { Copyright: 'dato privado', ImageDescription: 'casa' },
        IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '34/1 36/1 0/1' },
      },
    })
    .toBuffer();

beforeAll(async () => {
  ctx = await createTestApp(db);
  service = new ImageService(new FilesRepository(db), ctx.storage);
});
afterAll(async () => {
  await ctx.cleanup();
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb(db);
  await runSeed(db);
});

describe('ImageService', () => {
  it('reprocesa a WebP, elimina los metadatos y limita el tamaño', async () => {
    const original = await jpegWithExif();
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const clean = await service.sanitize(original);
    const meta = await sharp(clean).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(meta.iptc).toBeUndefined();
    expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(1600);
    expect(clean.includes(Buffer.from('dato privado'))).toBe(false);
  });

  it('rechaza archivos que no son imágenes aunque tengan extensión de imagen', async () => {
    await expect(service.sanitize(samplePdf())).rejects.toMatchObject({ status: 415 });
  });

  it('rechaza una imagen con firma válida pero contenido dañado', async () => {
    const corrupt = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
    await expect(service.sanitize(corrupt)).rejects.toMatchObject({ status: 415 });
  });

  it('rechaza imágenes de más de 5 MB', async () => {
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(IMAGE_MAX_BYTES)]);
    await expect(service.sanitize(big)).rejects.toMatchObject({ status: 413 });
  });

  it('la foto de perfil queda publicada en /files y en el inicio', async () => {
    const file = await service.importProfilePhoto({
      data: await jpegWithExif(),
      originalName: 'foto.jpg',
    });
    const home = await request(ctx.app).get('/api/v1/public/home');
    expect(home.body.profile.photoUrl).toBe(`/files/${file.id}`);

    const res = await request(ctx.app).get(`/files/${file.id}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
  });
});
