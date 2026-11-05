import { describe, expect, it } from 'vitest';
import { detectFileKind } from '../../src/lib/file-type.js';
import { samplePdf, samplePng } from '../helpers/app.js';

describe('detectFileKind', () => {
  it('reconoce PDF, JPG, PNG y WebP por sus magic bytes', () => {
    expect(detectFileKind(samplePdf())).toBe('pdf');
    expect(detectFileKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toBe('jpg');
    expect(detectFileKind(samplePng())).toBe('png');
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);
    expect(detectFileKind(webp)).toBe('webp');
  });

  it('rechaza contenido que no coincide aunque la extensión diga otra cosa', () => {
    // Un "cv.pdf" que en realidad es HTML.
    expect(detectFileKind(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    // RIFF que no es WebP (por ejemplo, un WAV).
    const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVEfmt ')]);
    expect(detectFileKind(wav)).toBeNull();
  });

  it('no falla con archivos vacíos o más cortos que la firma', () => {
    expect(detectFileKind(Buffer.alloc(0))).toBeNull();
    expect(detectFileKind(Buffer.from('%PD'))).toBeNull();
  });
});
