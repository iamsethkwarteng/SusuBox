import { CLOUDINARY_UPLOAD_PRESET, CLOUDINARY_UPLOAD_URL } from '@/src/constants/api';

export type CloudinaryFolder = 'id_cards' | 'selfies' | 'profiles';

export interface CloudinaryUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Uploads a local image to Cloudinary via the unsigned upload API and returns
 * the hosted secure_url. Only that URL is persisted anywhere in the app — the
 * raw file never leaves the OS camera cache, and we never copy it into app
 * storage, so sensitive ID photos don't linger on the device.
 *
 * Folder routing keeps the media library organised and lets Cloudinary access
 * rules differ per document type:
 *   id_cards -> susutrack/id_cards/   selfies -> susutrack/selfies/
 *   profiles -> susutrack/profiles/
 *
 * BACKEND REQUIRED: for production, switch to *signed* uploads — the backend
 * generates a short-lived signature (POST /api/uploads/sign) so the preset
 * cannot be abused by third parties extracting it from the app bundle.
 */
export async function uploadToCloudinary(
  uri: string,
  folder: CloudinaryFolder,
  uploadPreset: string = CLOUDINARY_UPLOAD_PRESET,
): Promise<CloudinaryUploadResult> {
  try {
    const form = new FormData();
    // React Native's fetch accepts {uri, name, type} file descriptors in FormData.
    form.append('file', {
      uri,
      name: `${folder}-${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as unknown as Blob);
    form.append('upload_preset', uploadPreset);
    form.append('folder', `susutrack/${folder}`);

    const response = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: form });
    const data = (await response.json()) as { secure_url?: string; error?: { message?: string } };

    if (!response.ok || !data.secure_url) {
      return {
        success: false,
        error: data.error?.message ?? `Upload failed (HTTP ${response.status}). Please try again.`,
      };
    }
    return { success: true, url: data.secure_url };
  } catch {
    return { success: false, error: 'Could not reach the upload server. Check your connection and retry.' };
  }
}

export default uploadToCloudinary;
