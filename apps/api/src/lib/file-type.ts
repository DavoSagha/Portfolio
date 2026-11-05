/**
 * Detección del tipo real de un archivo por sus primeros bytes (magic bytes), sin confiar
 * en la extensión ni en el Content-Type que manda el cliente (D-017).
 */
export const FILE_KINDS = {
  pdf: { mimeType: 'application/pdf', extension: 'pdf' },
  jpg: { mimeType: 'image/jpeg', extension: 'jpg' },
  png: { mimeType: 'image/png', extension: 'png' },
  webp: { mimeType: 'image/webp', extension: 'webp' },
} as const;

export type FileKind = keyof typeof FILE_KINDS;

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

export function detectFileKind(buf: Buffer): FileKind | null {
  if (startsWith(buf, ascii('%PDF-'))) return 'pdf';
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(buf, ascii('RIFF')) && startsWith(buf, ascii('WEBP'), 8)) return 'webp';
  return null;
}
