
'use client';

import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getApp } from 'firebase/app';

/**
 * Uploads a Blob/File to Firebase Storage under the given path.
 * Reports progress via onProgress (0–100).
 * Returns the public download URL on success.
 */
export async function uploadMedia(
  blob: Blob,
  storagePath: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const storage = getStorage(getApp());
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, blob);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const pct = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        onProgress?.(pct);
      },
      (error) => reject(error),
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

/**
 * Derives a file extension from a MIME type.
 */
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
  return map[mimeType] || 'bin';
}
