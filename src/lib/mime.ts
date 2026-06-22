// src/lib/mime.ts
// Simple utility to map MIME types to file extensions.
// This mirrors the `mimeToExt` function that used to live in `src/firebase/storage.ts`.

export function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/webm': 'webm',
    'video/mp4': 'mp4',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/mpeg': 'mp3',
  };
  return map[mimeType] ?? 'bin';
}
