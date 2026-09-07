// src/lib/cloudinary.ts
/**
 * Upload a Blob (image/audio/video) to Cloudinary using an unsigned preset.
 * @param blob - The media Blob to upload.
 * @param type - Resource type: "image" | "audio" | "video".
 * @param onProgress - Optional callback receiving upload progress (0‑100).
 * @returns The secure URL of the uploaded asset.
 */
export async function uploadToCloudinary(
  blob: Blob,
  type: "image" | "audio" | "video",
  onProgress?: (pct: number) => void
): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary environment variables are not set");
  }

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${type}/upload`;
  const form = new FormData();
  form.append("file", blob);
  form.append("upload_preset", uploadPreset);

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress(pct);
      }
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url);
        } catch (e) {
          reject(new Error("Failed to parse Cloudinary response"));
        }
      } else {
        reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during Cloudinary upload"));
    xhr.send(form);
  });
}
